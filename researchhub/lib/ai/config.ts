import "server-only";
import { google } from "@ai-sdk/google";
import { gateway } from "ai";

const previewEnabled = process.env.VERCEL_ENV === "preview" && process.env.SCHOLAR_AI_ENABLED !== "false";
// Preview uses Vercel OIDC and Gateway credits, independently of Google capacity.
// Production stays on its existing provider until Preview has been validated.
const useGateway = process.env.VERCEL_ENV === "preview";
const selectedModel = useGateway ? "anthropic/claude-haiku-5.5" : "gemini-3.6-flash";
const providerConfigured = useGateway
  // Vercel Functions expose OIDC through request context, not always env.
  ? Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL_ENV === "preview")
  : Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
const modelIds = [selectedModel];

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
  promptVersion: "ideas.v7-opportunity-map",
  reservedTokens: 10_000,
  maxIdeasOutputTokens: 6_000,
  maxAssistOutputTokens: 4_000,
  inputUsdPerToken: useGateway ? 0.0000001 : Number(process.env.SCHOLAR_AI_INPUT_USD_PER_TOKEN || "0"),
  outputUsdPerToken: useGateway ? 0.0000005 : Number(process.env.SCHOLAR_AI_OUTPUT_USD_PER_TOKEN || "0"),
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

export function retryWithFallback(error: unknown) {
  const raw = providerErrorText(error);
  return /high demand|temporar|unavailable|overloaded|resource.?exhausted|quota|rate.?limit|429|503|404|not.?found|no longer available|unsupported model|invalid argument|schema|structured output|response.?format/i.test(raw);
}

export function estimatedCost(inputTokens: number, outputTokens: number) {
  return Number((inputTokens * scholarAI.inputUsdPerToken + outputTokens * scholarAI.outputUsdPerToken).toFixed(8));
}
