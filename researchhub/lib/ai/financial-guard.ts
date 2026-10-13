import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { scholarAI, scholarAIModels } from "@/lib/ai/config";

// Admission is enforced atomically by scholar_reserve; this checks pricing first.
export async function verifyFinancialEnvelope(mode: "live" | "simulation") {
  if (mode !== "live") return;
  const { data, error } = await supabaseAdmin().from("scholar_ai_budget_settings").select("enabled,operation_envelope_usd").eq("id", true).maybeSingle();
  if (error) {
    if (["42P01", "PGRST205"].includes(error.code) && process.env.VERCEL_ENV === "preview") return;
    throw new Error("Controle financeiro indisponível. Configure scholar_ai_budgets.sql antes de liberar IA paga.");
  }
  if (!data?.enabled) {
    if (process.env.VERCEL_ENV === "preview") return;
    throw new Error("Ative o controle financeiro antes de liberar IA em produção.");
  }
  const rates = [scholarAI.inputUsdPerToken, scholarAI.outputUsdPerToken];
  if (rates.some(rate => !Number.isFinite(rate) || rate <= 0)) throw new Error("Configure as tarifas de entrada e saída da IA antes de ativar o orçamento financeiro.");
  // Rates must cover the most expensive candidate, including reasoning output.
  const worstEstimate = scholarAI.reservedTokens * Math.max(...rates) * scholarAIModels.length;
  if (worstEstimate > Number(data.operation_envelope_usd)) throw new Error("O orçamento por operação não cobre as tentativas dos modelos configurados. Revise as tarifas e o limite financeiro.");
}
