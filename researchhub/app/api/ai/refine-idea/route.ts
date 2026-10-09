import { NextResponse } from "next/server";
import { generateText } from "ai";
import { scholarAI, scholarAIModels, scholarAIReady, estimatedCost, retryWithFallback } from "@/lib/ai/config";
import { isAIProposal, type AIProposal } from "@/lib/ai/ideas";
import { completeIdeaRefinement, ideaRefinementJsonSchema, ideaRefinementPrompt, isIdeaRefinementDraft, type IdeaRefinement } from "@/lib/ai/refine-idea";
import { outputBudget, parseValidatedJson, promptForJson } from "@/lib/ai/structured-output";
import { fetchArticleDetails, pubmedSearch } from "@/lib/literature/pubmed";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const timeoutMs = 240_000;
const staleReservationMs = 10 * 60_000;
type License = { id: string; status: string; mode: "simulation" | "live"; starts_at: string; ends_at: string };
type Wallet = { id: string; license_id: string; allowance: number; used: number; reserved: number };

function timedOut(error: unknown) {
  const raw = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /abort|timeout|timed out/i.test(raw);
}

function safeMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : "Não foi possível refinar a proposta.";
  if (timedOut(error)) return "O refinamento demorou mais que o esperado. Sua franquia será devolvida; tente novamente.";
  if (/NCBI|PubMed/i.test(raw)) return "O PubMed não respondeu ao refinamento agora. Sua franquia será devolvida; tente novamente em instantes.";
  if (/quota|rate.?limit|resource.?exhausted|429/i.test(raw)) return "O limite temporário do modelo foi atingido. Sua franquia será devolvida; tente novamente em alguns minutos.";
  if (/high demand|temporar|unavailable|overloaded|503/i.test(raw)) return "Os modelos estão temporariamente sobrecarregados. Sua franquia será devolvida; tente novamente em alguns minutos.";
  return raw.length < 260 ? raw : "Não foi possível concluir o refinamento agora.";
}

async function releaseStale(userId: string) {
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
  await releaseStale(userId);
  const admin = supabaseAdmin();
  const { data: walletData, error } = await admin.from("scholar_wallets").select("id,license_id,allowance,used,reserved").eq("user_id", userId);
  if (error) throw error;
  const wallets = (walletData || []) as Wallet[];
  if (!wallets.length) throw new Error("Sua conta ainda não possui uma franquia de assistência.");
  const { data: licenseData, error: licenseError } = await admin.from("scholar_licenses").select("id,status,mode,starts_at,ends_at").in("id", wallets.map(item => item.license_id));
  if (licenseError) throw licenseError;
  const now = Date.now();
  const licenses = new Map(((licenseData || []) as License[]).map(item => [item.id, item]));
  const available = wallets.map(wallet => ({ wallet, license: licenses.get(wallet.license_id) })).filter(item => item.license && ["active", "trial"].includes(item.license.status) && Date.parse(item.license.starts_at) <= now && Date.parse(item.license.ends_at) >= now && item.wallet.allowance - item.wallet.used - item.wallet.reserved >= scholarAI.reservedTokens).sort((a, b) => (b.wallet.allowance - b.wallet.used - b.wallet.reserved) - (a.wallet.allowance - a.wallet.used - a.wallet.reserved));
  if (!available.length) throw new Error("Franquia indisponível ou insuficiente para este refinamento.");
  return available[0] as { wallet: Wallet; license: License };
}

function validate(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Proposta não enviada.");
  const body = value as Record<string, unknown>;
  if (!isAIProposal(body.idea)) throw new Error("A proposta está incompleta e não pode ser refinada.");
  const projectId = typeof body.projectId === "string" && /^[0-9a-f-]{36}$/i.test(body.projectId) ? body.projectId : null;
  return { idea: body.idea as AIProposal, projectId };
}

export async function POST(request: Request) {
  if (!scholarAIReady) return NextResponse.json({ error: "A IA ainda não está ativada neste ambiente." }, { status: 503 });
  const client = await supabaseServer();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta para refinar a proposta." }, { status: 401 });

  let operationId: string | null = null;
  let reserved = false;
  try {
    const input = validate(await request.json());
    const query = input.idea.radar.trim();
    if (query.length < 5 || query.length > 1800) throw new Error("A estratégia bibliográfica desta proposta precisa ser revisada antes do refinamento.");

    const search = await pubmedSearch(query, 12, "relevance");
    if (!search.ids.length) throw new Error("Nenhum artigo foi encontrado com esta estratégia. Valide a busca no Radar antes de refinar.");
    const articles = await fetchArticleDetails(search.ids);
    if (!articles.length) throw new Error("O PubMed não retornou metadados suficientes para o refinamento.");

    const { wallet, license } = await activeWallet(user.id);
    const admin = supabaseAdmin();
    operationId = crypto.randomUUID();
    const model = license.mode === "simulation" ? "simulation" : scholarAI.model;
    const { error: reserveError } = await admin.rpc("scholar_reserve", { p_request: operationId, p_wallet: wallet.id, p_user: user.id, p_feature: "refinement", p_model: model, p_tokens: scholarAI.reservedTokens, p_project: input.projectId });
    if (reserveError) throw reserveError;
    reserved = true;
    const articleContext = articles.slice(0, 5).map(article => ({ pmid: article.pmid || "", title: article.title, year: article.year, publicationTypes: article.publicationTypes, abstract: article.abstract }));
    const { error: artifactError } = await admin.from("scholar_generation_artifacts").insert({ usage_id: operationId, user_id: user.id, prompt_version: "refinement.v2-compact-pubmed", input_snapshot: { idea: input.idea, query, pubmedTotal: search.count, articles: articleContext.map(article => ({ pmid: article.pmid, title: article.title, year: article.year })) } });
    if (artifactError) throw artifactError;
    if (license.mode === "simulation") throw new Error("O refinamento com literatura exige uma licença de IA ao vivo.");

    const prompt = ideaRefinementPrompt(input.idea, search.count, articleContext);
    let result: Awaited<ReturnType<typeof generateText>> | null = null;
    let output: IdeaRefinement | null = null;
    let lastError: unknown;
    let parseFailures = 0;
    const maxOutputTokens = outputBudget(prompt, ideaRefinementJsonSchema, 3_600, scholarAI.reservedTokens, 2_200);
    for (const candidate of scholarAIModels) {
      try {
        result = await generateText({ model: candidate.model, instructions: "Refine a proposta com rigor metodológico e rastreabilidade aos artigos fornecidos.", maxOutputTokens, maxRetries: 0, abortSignal: AbortSignal.timeout(timeoutMs), prompt: promptForJson(prompt, ideaRefinementJsonSchema) });
        const draft = parseValidatedJson(result.text, isIdeaRefinementDraft);
        output = completeIdeaRefinement(input.idea, draft);
        break;
      } catch (error) {
        lastError = error;
        if (/JSON|objeto.*completo|formato científico/i.test(error instanceof Error ? error.message : String(error))) {
          parseFailures += 1;
          if (parseFailures < 2) continue;
        }
        if (!retryWithFallback(error)) throw error;
      }
    }
    if (!result || !output) throw lastError || new Error("Nenhum modelo está disponível agora.");
    const inputTokens = result.usage.inputTokens || 0;
    const outputTokens = result.usage.outputTokens || 0;
    if (inputTokens + outputTokens > scholarAI.reservedTokens) throw new Error("O refinamento excedeu o limite de consumo da operação.");
    const costUsd = estimatedCost(inputTokens, outputTokens);
    const { error: updateError } = await admin.from("scholar_generation_artifacts").update({ output_snapshot: { ...output, pubmedQuery: query, pubmedTotal: search.count } }).eq("usage_id", operationId);
    if (updateError) throw updateError;
    const { error: settleError } = await admin.rpc("scholar_settle", { p_request: operationId, p_input: inputTokens, p_output: outputTokens, p_cost: costUsd, p_failed: false, p_provider_id: result.response.id || null });
    if (settleError) throw settleError;
    reserved = false;
    return NextResponse.json({ operationId, output, pubmedQuery: query, pubmedTotal: search.count, usage: { inputTokens, outputTokens, costUsd } });
  } catch (error) {
    console.error("[scholar-ai:refine-idea] failed", { operationId, stage: operationId ? "generation-or-settlement" : "input-or-literature", error: error instanceof Error ? error.message : "unknown" });
    if (operationId && reserved) {
      try {
        const admin = supabaseAdmin();
        await admin.from("scholar_generation_artifacts").update({ error_code: timedOut(error) ? "GENERATION_TIMEOUT" : "GENERATION_FAILED" }).eq("usage_id", operationId);
        await admin.rpc("scholar_settle", { p_request: operationId, p_input: 0, p_output: 0, p_cost: 0, p_failed: true, p_provider_id: null });
      } catch (cleanupError) {
        console.error("[scholar-ai:refine-idea] cleanup failed", cleanupError);
      }
    }
    return NextResponse.json({ error: safeMessage(error), operationId }, { status: timedOut(error) ? 504 : 400 });
  }
}
