import "server-only";

const previewEnabled = process.env.VERCEL_ENV === "preview" && process.env.SCHOLAR_AI_ENABLED !== "false";
const freePreviewModel = "inclusionai/ling-3.1-flash-free";
const paidDefaultModel = "openai/gpt-6.1-sol";
const selectedModel =
  process.env.SCHOLAR_AI_MODEL ||
  (process.env.VERCEL_ENV === "preview" ? freePreviewModel : paidDefaultModel);
const zeroCostModel = selectedModel === freePreviewModel;

export const scholarAI = {
  enabled: process.env.SCHOLAR_AI_ENABLED === "true" || previewEnabled,
  model: selectedModel,
  promptVersion: "ideas.v1",
  reservedTokens: 10_000,
  maxOutputTokens: 4_000,
  inputUsdPerToken: Number(
    process.env.SCHOLAR_AI_INPUT_USD_PER_TOKEN || (zeroCostModel ? "0" : "0.000002"),
  ),
  outputUsdPerToken: Number(
    process.env.SCHOLAR_AI_OUTPUT_USD_PER_TOKEN || (zeroCostModel ? "0" : "0.00001"),
  ),
} as const;

export function estimatedCost(inputTokens: number, outputTokens: number) {
  return Number((inputTokens * scholarAI.inputUsdPerToken + outputTokens * scholarAI.outputUsdPerToken).toFixed(8));
}
