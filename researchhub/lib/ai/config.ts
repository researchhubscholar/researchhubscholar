import "server-only";
import { google } from "@ai-sdk/google";

const previewEnabled = process.env.VERCEL_ENV === "preview" && process.env.SCHOLAR_AI_ENABLED !== "false";
// New Gemini projects may not receive access to every model generation. Keep
// explicit Vercel overrides, but always try stable Flash alternatives.
const selectedModel = process.env.SCHOLAR_AI_MODEL || "gemini-3.5-flash";
const googleConfigured = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
const fallbackModelIds = ["gemini-3.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
const modelIds = [selectedModel, ...fallbackModelIds.filter(model => model !== selectedModel)];

export const scholarAI = {
  enabled: process.env.SCHOLAR_AI_ENABLED === "true" || previewEnabled,
  backendConfigured: Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    googleConfigured,
  ),
  provider: "google" as const,
  model: selectedModel,
  structuredOutput: "native" as const,
  promptVersion: "ideas.v7-opportunity-map",
  reservedTokens: 10_000,
  maxIdeasOutputTokens: 6_000,
  maxAssistOutputTokens: 4_000,
  inputUsdPerToken: Number(process.env.SCHOLAR_AI_INPUT_USD_PER_TOKEN || "0"),
  outputUsdPerToken: Number(process.env.SCHOLAR_AI_OUTPUT_USD_PER_TOKEN || "0"),
} as const;

export const scholarAIModel = google(selectedModel);
export const scholarAIModels = modelIds.map(id => ({ id, model: google(id) }));
export const scholarAIReady = scholarAI.enabled && scholarAI.backendConfigured;

export function providerErrorText(error: unknown) {
  if (error instanceof Error) { const cause = (error as Error & { cause?: unknown }).cause; return `${error.name} ${error.message} ${cause ? providerErrorText(cause) : ""}`; }
  if (typeof error === "string") return error;
  try { return JSON.stringify(error); } catch { return String(error); }
}

export function retryWithFallback(error: unknown) {
  const raw = providerErrorText(error);
  return /high demand|temporar|unavailable|overloaded|resource.?exhausted|quota|rate.?limit|429|503|404|not.?found|unsupported model|invalid argument|schema|structured output|response.?format/i.test(raw);
}

export function estimatedCost(inputTokens: number, outputTokens: number) {
  return Number((inputTokens * scholarAI.inputUsdPerToken + outputTokens * scholarAI.outputUsdPerToken).toFixed(8));
}
