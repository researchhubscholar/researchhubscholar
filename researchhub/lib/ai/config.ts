import "server-only";
import { google } from "@ai-sdk/google";

const previewEnabled = process.env.VERCEL_ENV === "preview" && process.env.SCHOLAR_AI_ENABLED !== "false";
// New Gemini projects may not receive access to legacy 2.5 models. Keep the
// default on the current Flash generation while still allowing an explicit
// model override through Vercel.
const selectedModel = process.env.SCHOLAR_AI_MODEL || "gemini-3.5-flash";
const googleConfigured = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
const fallbackModelIds = ["gemini-3.5-flash-lite", "gemini-2.5-flash-lite"];
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
  promptVersion: "ideas.v4-scientific-framing",
  reservedTokens: 10_000,
  maxIdeasOutputTokens: 6_000,
  maxAssistOutputTokens: 4_000,
  inputUsdPerToken: Number(process.env.SCHOLAR_AI_INPUT_USD_PER_TOKEN || "0"),
  outputUsdPerToken: Number(process.env.SCHOLAR_AI_OUTPUT_USD_PER_TOKEN || "0"),
} as const;

export const scholarAIModel = google(selectedModel);
export const scholarAIModels = modelIds.map(id => ({ id, model: google(id) }));
export const scholarAIReady = scholarAI.enabled && scholarAI.backendConfigured;

export function retryWithFallback(error: unknown) {
  const raw = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /high demand|temporar|unavailable|overloaded|resource.?exhausted|quota|rate.?limit|429|503/i.test(raw);
}

export function estimatedCost(inputTokens: number, outputTokens: number) {
  return Number((inputTokens * scholarAI.inputUsdPerToken + outputTokens * scholarAI.outputUsdPerToken).toFixed(8));
}
