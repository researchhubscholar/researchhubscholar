import { NextResponse } from "next/server";
import { generateText, jsonSchema, Output } from "ai";
import { scholarAI, scholarAIReady, estimatedCost } from "@/lib/ai/config";
import { aiIdeasJsonSchema, ideasPrompt, isAIIdeasOutput, mergeAIProposals, type AIIdeasOutput, validateIdeasRequest } from "@/lib/ai/ideas";
import { outputBudget, parseValidatedJson, promptForJson } from "@/lib/ai/structured-output";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const generationTimeoutMs = 240_000;
const staleReservationMs = 10 * 60_000;

function generationTimedOut(error: unknown) {
  const raw = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /abort|timeout|timed out/i.test(raw);
}

type License = { id: string; status: string; mode: "simulation" | "live"; starts_at: string; ends_at: string };
type Wallet = { id: string; license_id: string; allowance: number; used: number; reserved: number };

function message(error: unknown) {
  const raw = error instanceof Error ? error.message : "Não foi possível concluir o aprimoramento.";
  if (generationTimedOut(error)) return "A geração demorou mais que o esperado e foi interrompida com segurança. Sua franquia será devolvida; tente novamente.";
  if (raw.includes("Franquia")) return raw;
  if (raw.includes("limite") || raw.includes("Limite") || raw.includes("andamento")) return raw;
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

async function activeWallet(userId: string) {
  await releaseStaleReservations(userId);
  const admin = supabaseAdmin();
  const { data: wallets, error } = await admin.from("scholar_wallets").select("id,license_id,allowance,used,reserved").eq("user_id", userId);
  if (error) throw error;
  const rows = (wallets || []) as Wallet[];
  if (!rows.length) throw new Error("Sua conta ainda não possui uma franquia de assistência.");
  const { data: licenses, error: licenseError } = await admin.from("scholar_licenses").select("id,status,mode,starts_at,ends_at").in("id", rows.map(row => row.license_id));
  if (licenseError) throw licenseError;
  const now = Date.now();
  const licenseMap = new Map(((licenses || []) as License[]).map(license => [license.id, license]));
  const available = rows.map(wallet => ({ wallet, license: licenseMap.get(wallet.license_id) })).filter(item => item.license && ["active", "trial"].includes(item.license.status) && Date.parse(item.license.starts_at) <= now && Date.parse(item.license.ends_at) >= now && item.wallet.allowance - item.wallet.used - item.wallet.reserved >= scholarAI.reservedTokens).sort((a, b) => (b.wallet.allowance - b.wallet.used - b.wallet.reserved) - (a.wallet.allowance - a.wallet.used - a.wallet.reserved));
  if (!available.length) throw new Error("Franquia indisponível ou insuficiente para esta operação.");
  return available[0] as { wallet: Wallet; license: License };
}

export async function POST(request: Request) {
  if (!scholarAIReady) return NextResponse.json({ error: "A assistência por IA ainda não está configurada neste ambiente." }, { status: 503 });
  const client = await supabaseServer();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Entre na sua conta para usar a assistência." }, { status: 401 });

  let operationId: string | null = null;
  let reserved = false;
  try {
    const input = validateIdeasRequest(await request.json());
    const { wallet, license } = await activeWallet(user.id);
    const admin = supabaseAdmin();
    operationId = crypto.randomUUID();
    const model = license.mode === "simulation" ? "simulation" : scholarAI.model;
    const { error: reserveError } = await admin.rpc("scholar_reserve", { p_request: operationId, p_wallet: wallet.id, p_user: user.id, p_feature: "ideas", p_model: model, p_tokens: scholarAI.reservedTokens, p_project: input.projectId });
    if (reserveError) throw reserveError;
    reserved = true;
    const snapshot = { context: input.context, ideas: input.ideas, projectId: input.projectId };
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

    const prompt = ideasPrompt(input.context, input.ideas);
    const common = {
      model: scholarAI.model,
      instructions: "Produza planejamento científico responsável. Nunca invente referências, resultados ou validações.",
      maxOutputTokens: outputBudget(prompt, aiIdeasJsonSchema, scholarAI.maxIdeasOutputTokens, scholarAI.reservedTokens, 3_500),
      abortSignal: AbortSignal.timeout(generationTimeoutMs),
      providerOptions: { gateway: { user: user.id, tags: ["scholar", "ideas", scholarAI.promptVersion] } },
    } as const;
    const result = scholarAI.structuredOutput === "native"
      ? await generateText({ ...common, output: Output.object({ schema: jsonSchema<AIIdeasOutput>(aiIdeasJsonSchema) }), prompt })
      : await generateText({ ...common, prompt: promptForJson(prompt, aiIdeasJsonSchema) });
    const output = scholarAI.structuredOutput === "native"
      ? result.output as AIIdeasOutput
      : parseValidatedJson(result.text, isAIIdeasOutput);
    if (!isAIIdeasOutput(output)) throw new Error("A resposta do modelo não corresponde ao formato científico esperado. Tente novamente.");
    const inputTokens = result.usage.inputTokens || 0;
    const outputTokens = result.usage.outputTokens || 0;
    if (inputTokens + outputTokens > scholarAI.reservedTokens) throw new Error("A resposta excedeu o limite de consumo da operação.");
    const costUsd = estimatedCost(inputTokens, outputTokens);
    const ideas = mergeAIProposals(input.ideas, output);
    const outputSnapshot = { ...output, ideas };
    const { error: updateError } = await admin.from("scholar_generation_artifacts").update({ output_snapshot: outputSnapshot }).eq("usage_id", operationId);
    if (updateError) throw updateError;
    const { error: settleError } = await admin.rpc("scholar_settle", { p_request: operationId, p_input: inputTokens, p_output: outputTokens, p_cost: costUsd, p_failed: false, p_provider_id: result.response.id });
    if (settleError) throw settleError;
    reserved = false;
    return NextResponse.json({ operationId, mode: "live", ideas, caution: output.caution, usage: { inputTokens, outputTokens, costUsd } });
  } catch (error) {
    const timedOut = generationTimedOut(error);
    console.error("[scholar-ai:ideas] generation failed", { operationId, model: scholarAI.model, timedOut, error: error instanceof Error ? error.message : "unknown" });
    if (operationId && reserved) {
      try {
        const admin = supabaseAdmin();
        await admin.from("scholar_generation_artifacts").update({ error_code: timedOut ? "GENERATION_TIMEOUT" : "GENERATION_FAILED" }).eq("usage_id", operationId);
        await admin.rpc("scholar_settle", { p_request: operationId, p_input: 0, p_output: 0, p_cost: 0, p_failed: true, p_provider_id: null });
      } catch (cleanupError) {
        console.error("[scholar-ai:ideas] cleanup failed", { operationId, error: cleanupError instanceof Error ? cleanupError.message : "unknown" });
      }
    }
    return NextResponse.json({ error: message(error), operationId }, { status: timedOut ? 504 : 400 });
  }
}
