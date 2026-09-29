import "server-only";

const previewEnabled = process.env.VERCEL_ENV === "preview" && process.env.SCHOLAR_AI_ENABLED !== "false";

export const scholarAI = {
  enabled: process.env.SCHOLAR_AI_ENABLED === "true" || previewEnabled,
  model: process.env.SCHOLAR_AI_MODEL || "openai/gpt-5.6-sol",
  promptVersion: "ideas.v1",
  reservedTokens: 10_000,
  maxOutputTokens: 4_000,
  inputUsdPerToken: Number(process.env.SCHOLAR_AI_INPUT_USD_PER_TOKEN || "0.000004"),
  outputUsdPerToken: Number(process.env.SCHOLAR_AI_OUTPUT_USD_PER_TOKEN || "0.00002"),
} as const;

export function estimatedCost(inputTokens: number, outputTokens: number) {
  return Number((inputTokens * scholarAI.inputUsdPerToken + outputTokens * scholarAI.outputUsdPerToken).toFixed(8));
}
