import "server-only";
import { google } from "@ai-sdk/google";

const previewEnabled = process.env.VERCEL_ENV === "preview" && process.env.SCHOLAR_AI_ENABLED !== "false";
const selectedModel = process.env.SCHOLAR_AI_MODEL || "gemini-2.5-flash";
const googleConfigured = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

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
  promptVersion: "ideas.v3",
  reservedTokens: 10_000,
  maxIdeasOutputTokens: 6_000,
  maxAssistOutputTokens: 4_000,
  inputUsdPerToken: Number(process.env.SCHOLAR_AI_INPUT_USD_PER_TOKEN || "0"),
  outputUsdPerToken: Number(process.env.SCHOLAR_AI_OUTPUT_USD_PER_TOKEN || "0"),
} as const;

export const scholarAIModel = google(selectedModel);
export const scholarAIReady = scholarAI.enabled && scholarAI.backendConfigured;

export function estimatedCost(inputTokens: number, outputTokens: number) {
  return Number((inputTokens * scholarAI.inputUsdPerToken + outputTokens * scholarAI.outputUsdPerToken).toFixed(8));
}
