import { settleFailedReservation, reservationNotice, providerMetering, type ProviderMetering } from "@/lib/ai/failed-reservation";
import { verifyFinancialEnvelope } from "@/lib/ai/financial-guard";
import { chooseWallet, walletsForOperation, requestedWallet } from "@/lib/ai/wallet-selection";
import { NextResponse } from "next/server";
import { generateText, Output, jsonSchema, type JSONSchema7 } from "ai";
import { scholarAI, scholarAIModels, scholarAIReady, estimatedCost, retryWithFallback } from "@/lib/ai/config";
import { aiIdeasDraftJsonSchema, automaticIdeasPrompt, completeAIIdeasDraft, isAIProposal, isAIIdeasDraft, isAIIdeasOutput, mergeAIProposals, proposalQualityIssues, proposalStructureIssues, type AIIdeasOutput, validateIdeasRequest } from "@/lib/ai/ideas";
import { outputBudget, promptForJson } from "@/lib/ai/structured-output";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const generationTimeoutMs = 120_000;
const modelAttemptTimeoutMs = 100_000;
const staleReservationMs = 10 * 60_000;

function generationTimedOut(error: unknown) {
  const raw = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /abort|timeout|timed out/i.test(raw);
}

type License = { id: string; status: string; mode: "simulation" | "live"; starts_at: string; ends_at: string };
type Wallet = { id: string; license_id: string; allowance: number; used: number; reserved: number; unlimited?:boolean };

function message(error: unknown) {
  const raw = error instanceof Error ? error.message : "Não foi possível concluir o aprimoramento.";
  if (generationTimedOut(error)) return "A geração demorou mais que o esperado e foi interrompida com segurança. tente novamente.";
  if (raw.includes("Franquia")) return raw;
  if (raw.includes("limite") || raw.includes("Limite") || raw.includes("andamento")) return raw;
  if (/quota|rate.?limit|resource.?exhausted|429/i.test(raw)) return "O limite temporário do provedor de IA foi atingido. tente novamente em alguns minutos.";
  if (/high demand|temporar|unavailable|overloaded|503/i.test(raw)) return "Os modelos de IA estão temporariamente sobrecarregados. tente novamente em alguns minutos.";
  if (/api.?key|unauthenticated|permission.?denied|forbidden|401|403/i.test(raw)) return "A chave do provedor de IA não foi aceita ou ainda não possui acesso ao modelo configurado.";
  if (/model.*not found|not found.*model|no longer available|unsupported model|404/i.test(raw)) return "O modelo configurado não está disponível para este projeto do provedor de IA.";
  if (/schema|structured output|response.?format/i.test(raw)) return "O provedor de IA não aceitou o formato estruturado desta geração.";
  return raw.length < 240 ? raw : "Não foi possível concluir o aprimoramento agora.";
}

async function releaseStaleReservations(userId: string) {
  const admin = supabaseAdmin();
  const cutoff = new Date(Date.now() - staleReservationMs).toISOString();
  const { data, error } = await admin.from("scholar_usage").select("id").eq("user_id", userId).eq("status", "reserved").lt("created_at", cutoff);
  if (error) throw error;
  for (const row of data || []) {
    const { error: settleError } = await admin.rpc("scholar_settle", { p_request: row.id, p_input: 0, p_output: 0, p_cost: 0, p_failed: true, p_provider_id: null });
    if (settleError) throw settleError;
  }
}

async function activeWallet(userId: string, selected: string | null) {
  await releaseStaleReservations(userId);
  const admin = supabaseAdmin();
  const { data: wallets, error } = await admin.from("scholar_wallets").select("*").eq("user_id", userId);
  if (error) throw error;
  const rows = (wallets || []) as Wallet[];
  if (!rows.length) throw new Error("Sua conta ainda não possui uma franquia de assistência.");
  const { data: licenses, error: licenseError } = await admin.from("scholar_licenses").select("id,status,mode,starts_at,ends_at").in("id", rows.map(row => row.license_id));
  if (licenseError) throw licenseError;
  const now = Date.now();
  const licenseMap = new Map(((licenses || []) as License[]).map(license => [license.id, license]));
  const available = walletsForOperation(rows.map(wallet => ({ wallet, license: licenseMap.get(wallet.license_id) })), selected, scholarAI.reservedTokens, now);
  return chooseWallet(available, selected) as { wallet: Wallet; license: License };
}

async function generateStructured<T>(schema: JSONSchema7, prompt: string, maxOutputTokens: number, validate: (value: unknown) => value is T, capture: (value: unknown) => void) {
  let lastError: unknown;
  let parseFailures = 0;
  const budget = outputBudget(prompt, schema, maxOutputTokens, scholarAI.reservedTokens, 2_500);
  const deadline = Date.now() + generationTimeoutMs;
  const candidates = scholarAIModels;
  for (const candidate of candidates) {
    const remaining = deadline - Date.now();
    if (remaining < 10_000) throw new Error("A geração atingiu o prazo máximo de espera. Tente novamente em instantes.");
    try {
      const result = await generateText({
        model: candidate.model, reasoning: scholarAI.reasoning,
        output: Output.object({ schema: jsonSchema<T>(schema) }),
        instructions: "Produza planejamento científico responsável. Nunca invente referências, resultados, instrumentos validados ou autorizações.",
        maxOutputTokens: budget,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(Math.min(modelAttemptTimeoutMs, remaining)),
        prompt: promptForJson(prompt, schema),
      });
      capture(result);
      console.info("[scholar-ai:ideas] response", { model: candidate.id, finishReason: result.finishReason, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens });
      if (result.finishReason === "length") throw new Error("A resposta atingiu o limite de tamanho. Tente gerar novamente com um recorte mais específico.");
      if (!validate(result.output)) throw new Error("A resposta do modelo não corresponde ao formato científico esperado.");
      return { result, output: result.output, modelId: candidate.id };
    } catch (error) {
      capture(error);
      lastError = error;
      const failure = error as { finishReason?: unknown; usage?: { inputTokens?: number; outputTokens?: number } };
      console.warn("[scholar-ai:ideas] incomplete response", { model: candidate.id, finishReason: failure?.finishReason, inputTokens: failure?.usage?.inputTokens, outputTokens: failure?.usage?.outputTokens });
      if (/JSON|objeto.*completo|formato científico/i.test(error instanceof Error ? error.message : String(error))) {
        parseFailures += 1;
        if (parseFailures < 2) continue;
      }
      if (!generationTimedOut(error) && !retryWithFallback(error)) throw error;
    }
  }
  throw lastError || new Error("Nenhum modelo de IA está disponível agora.");
}

export async function POST(request: Request) {
  if (!scholarAIReady) return NextResponse.json({ error: "A IA de teste ainda não está conectada ao provedor de IA neste ambiente." }, { status: 503 });
  const client = await supabaseServer();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Entre na sua conta para usar a assistência." }, { status: 401 });

  let operationId: string | null = null;
  let reserved = false;
  let metering: ProviderMetering | null = null;
  try {
    const input = validateIdeasRequest(await request.json());
    const { wallet, license } = await activeWallet(user.id, requestedWallet(request, user.id));
    await verifyFinancialEnvelope(license.mode);
    const admin = supabaseAdmin();
    operationId = crypto.randomUUID();
    const model = license.mode === "simulation" ? "simulation" : scholarAI.model;
    const { error: reserveError } = await admin.rpc("scholar_reserve", { p_request: operationId, p_wallet: wallet.id, p_user: user.id, p_feature: "ideas", p_model: model, p_tokens: scholarAI.reservedTokens, p_project: input.projectId });
    if (reserveError) throw reserveError;
    reserved = true;
    const snapshot = { context: input.context, ideas: input.ideas, projectId: input.projectId, language: input.language };
    const { error: artifactError } = await admin.from("scholar_generation_artifacts").insert({ usage_id: operationId, user_id: user.id, prompt_version: scholarAI.promptVersion, input_snapshot: snapshot });
    if (artifactError) throw artifactError;

    if (license.mode === "simulation") {
      const simulated = { proposals: input.ideas, caution: "Simulação concluída: o fluxo, a franquia e o histórico foram validados sem enviar dados a um modelo de IA." };
      const { error: updateError } = await admin.from("scholar_generation_artifacts").update({ output_snapshot: simulated }).eq("usage_id", operationId);
      if (updateError) throw updateError;
      const { error: settleError } = await admin.rpc("scholar_settle", { p_request: operationId, p_input: 0, p_output: 1, p_cost: 0, p_failed: false, p_provider_id: "simulation" });
      if (settleError) throw settleError;
      reserved = false;
      return NextResponse.json({ operationId, mode: "simulation", ideas: input.ideas, caution: simulated.caution, usage: { inputTokens: 0, outputTokens: 1, costUsd: 0 } });
    }

    const generation = await generateStructured(aiIdeasDraftJsonSchema, automaticIdeasPrompt(input.context, input.language), 4_300, isAIIdeasDraft, value => { metering = providerMetering(value) || metering; });
    const output: AIIdeasOutput = completeAIIdeasDraft(generation.output, input.ideas);
    if (!Array.isArray(output.proposals) || output.proposals.length !== 3) throw new Error("A IA não retornou as três propostas esperadas.");
    for (const proposal of output.proposals) {
      const structureIssues = proposalStructureIssues(proposal);
      if (structureIssues.length || !isAIProposal(proposal)) throw new Error(`A IA deixou um campo científico incompleto: ${structureIssues[0] || "formato inválido"}`);
    }
    const qualityChecks = output.proposals.map((proposal, index) => ({ proposalIndex: index, issues: proposalQualityIssues(proposal, input.context, output.proposals.slice(0, index)) }));
    const qualityIssues = qualityChecks.flatMap(check => check.issues);
    const inputTokens = generation.result.usage.inputTokens || 0;
    const outputTokens = generation.result.usage.outputTokens || 0;
    const providerResponseId = generation.result.response.id || null;
    if (!isAIIdeasOutput(output)) throw new Error("A resposta do modelo não corresponde ao formato científico esperado. Tente novamente.");
    if (inputTokens + outputTokens > scholarAI.reservedTokens) throw new Error("A resposta excedeu o limite de consumo da operação.");
    const costUsd = estimatedCost(inputTokens, outputTokens);
    const ideas = mergeAIProposals(input.ideas, output);
    const outputSnapshot = { ...output, ideas, qualityIssues };
    const { error: updateError } = await admin.from("scholar_generation_artifacts").update({ output_snapshot: outputSnapshot }).eq("usage_id", operationId);
    if (updateError) throw updateError;
    const { error: settleError } = await admin.rpc("scholar_settle", { p_request: operationId, p_input: inputTokens, p_output: outputTokens, p_cost: costUsd, p_failed: false, p_provider_id: providerResponseId });
    if (settleError) throw settleError;
    reserved = false;
    return NextResponse.json({ operationId, mode: "live", ideas, caution: output.caution, qualityChecks, usage: { inputTokens, outputTokens, costUsd } });
  } catch (error) {
    const timedOut = generationTimedOut(error);
    console.error("[scholar-ai:ideas] generation failed", { operationId, model: scholarAI.model, timedOut, error: error instanceof Error ? error.message : "unknown" });
    const reservation = operationId && reserved ? await settleFailedReservation(operationId, timedOut ? "GENERATION_TIMEOUT" : "GENERATION_FAILED", metering || providerMetering(error)) : null;
    return NextResponse.json({ error: reservation === "completed" ? reservationNotice(reservation) : [message(error), reservation ? reservationNotice(reservation) : ""].filter(Boolean).join(" "), operationId, reservation }, { status: reservation === "pending" ? 503 : timedOut ? 504 : 400 });
  }
}
