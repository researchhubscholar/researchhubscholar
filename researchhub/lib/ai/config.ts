import "server-only";
import { google } from "@ai-sdk/google";
import { gateway } from "ai";

const previewEnabled = process.env.VERCEL_ENV === "preview" && process.env.SCHOLAR_AI_ENABLED !== "false";
// Qwen 3.7 Flash already completed live Preview requests via AI Gateway.
// Use the same production-tested integration with Vercel OIDC in production.
// The direct Google model was repeatedly returning UNAVAILABLE / high demand.
const useGateway = process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "production";
const selectedModel = useGateway ? "alibaba/qwen3.7-flash" : "gemini-3.6-flash";
const providerConfigured = useGateway
  // OIDC is injected in both Preview and Production Vercel Functions.
  ? Boolean(
      process.env.AI_GATEWAY_API_KEY ||
      process.env.VERCEL_OIDC_TOKEN ||
      // Preview Functions can authenticate via the Vercel runtime's implicit OIDC
      // even when the token isn't exposed to process.env during readiness checks.
      // Allow the request to reach Gateway, which still validates authentication.
      process.env.VERCEL_ENV === "preview"
    )
  : Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
const modelIds = useGateway
  ? [selectedModel, "google/gemini-2.5-flash"]
  : [selectedModel, "gemini-2.5-flash"];

export const scholarAI = {
  enabled: process.env.SCHOLAR_AI_ENABLED === "true" || previewEnabled,
  backendConfigured: Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    providerConfigured,
  ),
  provider: useGateway ? "gateway" as const : "google" as const,
  model: selectedModel,
  structuredOutput: "native" as const,
  // Qwen structured output requires non-thinking mode.
  reasoning: useGateway ? "none" as const : undefined,
  promptVersion: "ideas.v7-opportunity-map",
  reservedTokens: 10_000,
  maxIdeasOutputTokens: 6_000,
  maxAssistOutputTokens: 4_000,
  // Use the highest configured model candidate tariff for the financial envelope.
  // Qwen is cheaper, so gateway costUsd is a conservative estimate when it succeeds.
  inputUsdPerToken: useGateway ? 0.0000003 : Number(process.env.SCHOLAR_AI_INPUT_USD_PER_TOKEN || "0"),
  outputUsdPerToken: useGateway ? 0.0000025 : Number(process.env.SCHOLAR_AI_OUTPUT_USD_PER_TOKEN || "0"),
} as const;

const createModel = (id: string) => useGateway ? gateway(id) : google(id);
export const scholarAIModel = createModel(selectedModel);
export const scholarAIModels = modelIds.map(id => ({ id, model: createModel(id) }));
export const scholarAIReady = scholarAI.enabled && scholarAI.backendConfigured;

export function providerErrorText(error: unknown): string {
  if (error instanceof Error) { const cause = (error as Error & { cause?: unknown }).cause; return `${error.name} ${error.message} ${cause ? providerErrorText(cause) : ""}`; }
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  try { return JSON.stringify(error); } catch { return String(error); }
}

export function providerErrorDiagnostic(error: unknown): { name: string; status?: number; code?: string; databaseReason?: string; retryable: boolean } {
  const value = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const status = typeof value.statusCode === "number" ? value.statusCode : typeof value.status === "number" ? value.status : undefined;
  const name = error instanceof Error ? error.name : typeof value.name === "string" ? value.name.slice(0, 80) : typeof error;
  const code = typeof value.code === "string" ? value.code.slice(0, 80) : undefined;
  const knownDatabaseMessages = [
    "Franquia indisponível", "Franquia insuficiente", "Já existe uma operação em andamento",
    "Limite diário atingido", "Limite financeiro diário da plataforma atingido",
    "Limite financeiro diário desta licença atingido", "Projeto indisponível",
    "Vínculo institucional indisponível", "Limite financeiro de IA ainda não configurado",
    "Limite de 10.000 tokens por operação",
  ];
  const databaseReason = code === "P0001" && typeof value.message === "string"
    ? knownDatabaseMessages.find(known => value.message === known)
    : undefined;
  return { name, ...(status === undefined ? {} : { status }), ...(code ? { code } : {}), ...(databaseReason ? { databaseReason } : {}), retryable: retryWithFallback(error) };
}

export function retryWithFallback(error: unknown) {
  const raw = providerErrorText(error);
  return /high demand|temporar|unavailable|overloaded|timeout|timed out|abort|resource.?exhausted|quota|rate.?limit|429|503|404|not.?found|no longer available|unsupported model|invalid argument|schema|structured output|response.?format/i.test(raw);
}

export function estimatedCost(inputTokens: number, outputTokens: number, modelId: string = scholarAI.model) {
  // Estimate the model actually used, not the conservative maximum for fallback admission.
  // Gateway pricing: Qwen 3.7 Flash <=32k tokens, Gemini 2.5 Flash standard.
  const googleFallback = useGateway && modelId === "google/gemini-2.5-flash";
  const inputRate = useGateway && !googleFallback ? 0.00000003 : scholarAI.inputUsdPerToken;
  const outputRate = useGateway && !googleFallback ? 0.00000013 : scholarAI.outputUsdPerToken;
  return Number((inputTokens * inputRate + outputTokens * outputRate).toFixed(8));
}
