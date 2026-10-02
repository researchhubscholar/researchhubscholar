import { NextResponse } from "next/server";
import { generateText, jsonSchema, Output } from "ai";
import { scholarAI, estimatedCost } from "@/lib/ai/config";
import { aiIdeasJsonSchema, ideasPrompt, mergeAIProposals, type AIIdeasOutput, validateIdeasRequest } from "@/lib/ai/ideas";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type License = { id: string; status: string; mode: "simulation" | "live"; starts_at: string; ends_at: string };
type Wallet = { id: string; license_id: string; allowance: number; used: number; reserved: number };

function message(error: unknown) {
  const raw = error instanceof Error ? error.message : "Não foi possível concluir o aprimoramento.";
  if (raw.includes("Franquia")) return raw;
  if (raw.includes("limite") || raw.includes("Limite") || raw.includes("andamento")) return raw;
  return raw.length < 240 ? raw : "Não foi possível concluir o aprimoramento agora.";
}

async function activeWallet(userId: string) {
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
  if (!scholarAI.enabled) return NextResponse.json({ error: "A assistência por IA ainda não está ativada neste ambiente." }, { status: 503 });
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

    const result = await generateText({
      model: scholarAI.model,
      output: Output.object({ schema: jsonSchema<AIIdeasOutput>(aiIdeasJsonSchema) }),
      instructions: "Produza planejamento científico responsável. Nunca invente referências, resultados ou validações.",
      prompt: ideasPrompt(input.context, input.ideas),
      maxOutputTokens: scholarAI.maxOutputTokens,
      providerOptions: { gateway: { user: user.id, tags: ["scholar", "ideas", scholarAI.promptVersion] } },
    });
    const inputTokens = result.usage.inputTokens || 0;
    const outputTokens = result.usage.outputTokens || 0;
    if (inputTokens + outputTokens > scholarAI.reservedTokens) throw new Error("A resposta excedeu o limite de consumo da operação.");
    const costUsd = estimatedCost(inputTokens, outputTokens);
    const ideas = mergeAIProposals(input.ideas, result.output);
    const outputSnapshot = { ...result.output, ideas };
    const { error: updateError } = await admin.from("scholar_generation_artifacts").update({ output_snapshot: outputSnapshot }).eq("usage_id", operationId);
    if (updateError) throw updateError;
    const { error: settleError } = await admin.rpc("scholar_settle", { p_request: operationId, p_input: inputTokens, p_output: outputTokens, p_cost: costUsd, p_failed: false, p_provider_id: result.response.id });
    if (settleError) throw settleError;
    reserved = false;
    return NextResponse.json({ operationId, mode: "live", ideas, caution: result.output.caution, usage: { inputTokens, outputTokens, costUsd } });
  } catch (error) {
    if (operationId && reserved) {
      const admin = supabaseAdmin();
      await admin.from("scholar_generation_artifacts").update({ error_code: "GENERATION_FAILED" }).eq("usage_id", operationId);
      await admin.rpc("scholar_settle", { p_request: operationId, p_input: 0, p_output: 0, p_cost: 0, p_failed: true, p_provider_id: null });
    }
    return NextResponse.json({ error: message(error), operationId }, { status: 400 });
  }
}
