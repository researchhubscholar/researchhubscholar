import { localizeAIError } from "@/lib/ai/localized-output";
import { requestOutputLanguage } from "@/lib/ai/language";
import { settleFailedReservation, reservationNotice, providerMetering, type ProviderMetering } from "@/lib/ai/failed-reservation";
import { verifyFinancialEnvelope } from "@/lib/ai/financial-guard";
import { chooseWallet, walletsForOperation, requestedWallet } from "@/lib/ai/wallet-selection";
import { NextResponse } from "next/server";
import { generateText, jsonSchema, NoObjectGeneratedError, Output } from "ai";
import { scholarAI, scholarAIProviderOptions, scholarAIModels, scholarAIReady, retryWithFallback } from "@/lib/ai/config";
import { isAIProposal, type AIProposal } from "@/lib/ai/ideas";
import { groundRefinementSources, completeIdeaRefinement, ideaRefinementJsonSchema, ideaRefinementPrompt, isIdeaRefinementDraft, type IdeaRefinement, type IdeaRefinementDraft } from "@/lib/ai/refine-idea";
import { outputLanguage } from "@/lib/ai/language";
import { ideaRadarQuery } from "@/lib/ideas/radar";
import { outputBudget, parseValidatedJson } from "@/lib/ai/structured-output";
import { fetchArticleDetails, pubmedSearch } from "@/lib/literature/pubmed";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const timeoutMs = 240_000;
const staleReservationMs = 10 * 60_000;
type License = { id: string; status: string; mode: "simulation" | "live"; starts_at: string; ends_at: string };
type Wallet = { id: string; license_id: string; allowance: number; used: number; reserved: number; unlimited?:boolean };

function timedOut(error: unknown) {
  const raw = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /abort|timeout|timed out/i.test(raw);
}

function safeMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : "Não foi possível refinar a proposta.";
  if (timedOut(error)) return "O refinamento demorou mais que o esperado. tente novamente.";
  if (/NCBI|PubMed/i.test(raw)) return "O PubMed não respondeu ao refinamento agora. tente novamente em instantes.";
  if (/quota|rate.?limit|resource.?exhausted|429/i.test(raw)) return "O limite temporário do modelo foi atingido. tente novamente em alguns minutos.";
  if (/high demand|temporar|unavailable|overloaded|503/i.test(raw)) return "Os modelos estão temporariamente sobrecarregados. tente novamente em alguns minutos.";
  if (NoObjectGeneratedError.isInstance(error) || /resposta estruturada/i.test(raw)) return "A IA retornou um refinamento incompleto. Tente novamente.";
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

async function activeWallet(userId: string, selected: string | null) {
  await releaseStale(userId);
  const admin = supabaseAdmin();
  const { data: walletData, error } = await admin.from("scholar_wallets").select("*").eq("user_id", userId);
  if (error) throw error;
  const wallets = (walletData || []) as Wallet[];
  if (!wallets.length) throw new Error("Sua conta ainda não possui uma franquia de assistência.");
  const { data: licenseData, error: licenseError } = await admin.from("scholar_licenses").select("id,status,mode,starts_at,ends_at").in("id", wallets.map(item => item.license_id));
  if (licenseError) throw licenseError;
  const now = Date.now();
  const licenses = new Map(((licenseData || []) as License[]).map(item => [item.id, item]));
  const available = walletsForOperation(wallets.map(wallet => ({ wallet, license: licenses.get(wallet.license_id) })), selected, scholarAI.reservedTokens, now);
  return chooseWallet(available, selected) as { wallet: Wallet; license: License };
}

function validate(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Proposta não enviada.");
  const body = value as Record<string, unknown>;
  if (!isAIProposal(body.idea)) throw new Error("A proposta está incompleta e não pode ser refinada.");
  const projectId = typeof body.projectId === "string" && /^[0-9a-f-]{36}$/i.test(body.projectId) ? body.projectId : null;
  return { idea: body.idea as AIProposal, projectId, language: outputLanguage(body.language) };
}

function reply(request:Request,payload:Record<string,unknown>,init?:ResponseInit){return NextResponse.json(typeof payload.error==="string"?{...payload,error:localizeAIError(request,payload.error)}:payload,init);}
export async function POST(request: Request) {
  if (!scholarAIReady) return reply(request,{ error: "A IA ainda não está ativada neste ambiente." }, { status: 503 });
  const client = await supabaseServer();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return reply(request,{ error: "Entre na sua conta para refinar a proposta." }, { status: 401 });

  let operationId: string | null = null;
  let reserved = false;
  let metering: ProviderMetering | null = null;
  try {
    const body = await request.json();
    const input = validate(body);
    input.language = requestOutputLanguage(request, body.language);
    const query = ideaRadarQuery(input.idea.radar);
    if (query.length < 5 || query.length > 1800) throw new Error("A estratégia bibliográfica desta proposta precisa ser revisada antes do refinamento.");

    const search = await pubmedSearch(query, 12, "relevance");
    if (!search.ids.length) throw new Error("Nenhum artigo foi encontrado com esta estratégia. Valide a busca no Radar antes de refinar.");
    const articles = await fetchArticleDetails(search.ids);
    if (!articles.length) throw new Error("O PubMed não retornou metadados suficientes para o refinamento.");

    const { wallet, license } = await activeWallet(user.id, requestedWallet(request, user.id));
    await verifyFinancialEnvelope(license.mode);
    const admin = supabaseAdmin();
    operationId = crypto.randomUUID();
    const model = license.mode === "simulation" ? "simulation" : scholarAI.model;
    const { error: reserveError } = await admin.rpc("scholar_reserve", { p_request: operationId, p_wallet: wallet.id, p_user: user.id, p_feature: "refinement", p_model: model, p_tokens: scholarAI.reservedTokens, p_project: input.projectId });
    if (reserveError) throw reserveError;
    reserved = true;
    const articleContext = articles.slice(0, 5).map(article => ({ pmid: article.pmid || "", title: article.title, year: article.year, publicationTypes: article.publicationTypes, abstract: article.abstract }));
    const { error: artifactError } = await admin.from("scholar_generation_artifacts").insert({ usage_id: operationId, user_id: user.id, prompt_version: "refinement.v6-bilingual-sources", input_snapshot: { idea: input.idea, language: input.language, query, pubmedTotal: search.count, articles: articleContext.map(article => ({ pmid: article.pmid, title: article.title, year: article.year })) } });
    if (artifactError) throw artifactError;
    if (license.mode === "simulation") throw new Error("O refinamento com literatura exige uma licença de IA ao vivo.");

    const prompt = ideaRefinementPrompt(input.idea, search.count, articleContext, input.language);
    let completedUsage: ProviderMetering | null = null;
    let output: IdeaRefinement | null = null;
    let lastError: unknown;
    const maxOutputTokens = outputBudget(prompt, ideaRefinementJsonSchema, 4_800, scholarAI.reservedTokens, 2_200);
    for (const candidate of scholarAIModels) {
      let draft: IdeaRefinementDraft;
      let attemptUsage: ProviderMetering | null;
      try {
        const candidateResult = await generateText({
          model: candidate.model, reasoning: scholarAI.reasoning, providerOptions: scholarAIProviderOptions,
          instructions: "Refine a proposta com rigor metodológico e rastreabilidade aos artigos fornecidos. Responda exclusivamente no formato estruturado solicitado, com campos concisos e sem repetir informações.",
          maxOutputTokens,
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(timeoutMs),
          output: Output.object({ schema: jsonSchema<IdeaRefinementDraft>(ideaRefinementJsonSchema) }),
          prompt,
        });
        attemptUsage = providerMetering(candidateResult);
        metering = attemptUsage || metering;
        draft = candidateResult.output;
      } catch (error) {
        attemptUsage = providerMetering(error);
        metering = attemptUsage || metering;
        lastError = error;
        if (!NoObjectGeneratedError.isInstance(error)) {
          if (!retryWithFallback(error)) throw error;
          continue;
        }
        if (!error.text || error.finishReason !== "stop" || !attemptUsage) continue;
        try {
          draft = parseValidatedJson(error.text, isIdeaRefinementDraft);
        } catch {
          continue;
        }
      }
      if (!isIdeaRefinementDraft(draft)) {
        lastError = new Error("A resposta estruturada não corresponde ao refinamento científico esperado.");
        continue;
      }
      if (!attemptUsage) throw new Error("Não foi possível confirmar o consumo dentro do limite da operação.");
      output = groundRefinementSources(completeIdeaRefinement(input.idea, draft), articleContext);
      completedUsage = attemptUsage;
      break;
    }
    if (!completedUsage || !output) throw lastError || new Error("Nenhum modelo está disponível agora.");
    const { inputTokens, outputTokens, costUsd, providerId } = completedUsage;
    const { error: updateError } = await admin.from("scholar_generation_artifacts").update({ output_snapshot: { ...output, pubmedQuery: query, pubmedTotal: search.count } }).eq("usage_id", operationId);
    if (updateError) throw updateError;
    const { error: settleError } = await admin.rpc("scholar_settle", { p_request: operationId, p_input: inputTokens, p_output: outputTokens, p_cost: costUsd, p_failed: false, p_provider_id: providerId });
    if (settleError) throw settleError;
    reserved = false;
    return reply(request,{ operationId, language:input.language, output, pubmedQuery: query, pubmedTotal: search.count, usage: { inputTokens, outputTokens, costUsd } });
  } catch (error) {
    console.error("[scholar-ai:refine-idea] failed", { operationId, stage: operationId ? "generation-or-settlement" : "input-or-literature", error: error instanceof Error ? error.message : "unknown" });
    const reservation = operationId && reserved ? await settleFailedReservation(operationId, timedOut(error) ? "GENERATION_TIMEOUT" : "GENERATION_FAILED", metering || providerMetering(error)) : null;
    return reply(request,{ error: reservation === "completed" ? reservationNotice(reservation) : [safeMessage(error), reservation ? reservationNotice(reservation) : ""].filter(Boolean).join(" "), operationId, reservation }, { status: reservation === "pending" ? 503 : timedOut(error) ? 504 : 400 });
  }
}
