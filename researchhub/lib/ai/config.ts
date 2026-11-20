import "server-only";
import { createOpenAI } from "@ai-sdk/openai";

// User decision, 20/11/2026: direct OpenAI GPT-6 Luna in every environment.
// Construct a provider object explicitly so the AI SDK never routes through Gateway.
const selectedModel = "gpt-6-luna";
const provider = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const previewEnabled = process.env.VERCEL_ENV === "preview" && process.env.SCHOLAR_AI_ENABLED !== "false";

export const scholarAI = {
  enabled: process.env.SCHOLAR_AI_ENABLED === "true" || previewEnabled,
  backendConfigured: Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.OPENAI_API_KEY,
  ),
  provider: "openai" as const,
  model: selectedModel,
  structuredOutput: "native" as const,
  reasoning: "none" as const,
  promptVersion: "ideas.v7-opportunity-map",
  reservedTokens: 10_000,
  maxIdeasOutputTokens: 6_000,
  maxAssistOutputTokens: 4_000,
  // Standard processing, prompts below 10k tokens. Cached input is conservatively
  // costed at the uncached rate. No paid tools or automatic provider switching.
  inputUsdPerToken: 0.0000001,
  outputUsdPerToken: 0.0000005,
} as const;

export const scholarAIProviderOptions = {
  openai: {
    store: false,
    reasoningEffort: "none" as const,
    serviceTier: "default" as const,
    // Existing schemas include optional fields. Keep native structured output
    // and the application's scientific validators without changing their contract.
    strictJsonSchema: false,
  },
};
export const scholarAIModel = provider.responses(selectedModel);
export const scholarAIModels = [{ id: selectedModel, model: scholarAIModel }];
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
  if (modelId !== scholarAI.model) throw new Error("Modelo sem tarifa configurada.");
  return Number((inputTokens * scholarAI.inputUsdPerToken + outputTokens * scholarAI.outputUsdPerToken).toFixed(8));
}
