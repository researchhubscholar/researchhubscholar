import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { estimatedCost, scholarAI } from "@/lib/ai/config";

export type FailedReservation = "refunded" | "completed" | "pending";
export type ProviderMetering = { inputTokens: number; outputTokens: number; costUsd: number; providerId: string | null };
export function providerMetering(value: unknown): ProviderMetering | null {
  if (!value || typeof value !== "object") return null;
  const result = value as { usage?: { inputTokens?: unknown; outputTokens?: unknown }; response?: { id?: unknown } };
  const input = result.usage?.inputTokens, output = result.usage?.outputTokens;
  if (!Number.isSafeInteger(input) || !Number.isSafeInteger(output) || Number(input) < 0 || Number(output) < 0
    || Number(input) + Number(output) > scholarAI.reservedTokens) return null;
  return { inputTokens: Number(input), outputTokens: Number(output), costUsd: estimatedCost(Number(input), Number(output)), providerId: typeof result.response?.id === "string" ? result.response.id : null };
}

// Supabase normally returns { error } rather than rejecting its promise.
// Read the final ledger state as settlement may have committed before a lost response.
export async function settleFailedReservation(operationId: string, errorCode: string, metering: ProviderMetering | null = null): Promise<FailedReservation> {
  const admin = supabaseAdmin();
  try {
    const { error } = await admin.rpc("scholar_settle", { p_request: operationId, p_input: metering?.inputTokens || 0, p_output: metering?.outputTokens || 0, p_cost: metering?.costUsd || 0, p_failed: true, p_provider_id: metering?.providerId || null });
    if (error) console.error("[scholar-ai] failure settlement not confirmed", { operationId, code: error.code });
  } catch {
    console.error("[scholar-ai] failure settlement connection lost", { operationId });
  }
  try {
    const { data, error } = await admin.from("scholar_usage").select("status").eq("id", operationId).maybeSingle();
    if (error) return "pending";
    if (data?.status === "completed") return "completed";
    if (data?.status !== "failed") return "pending";
    // An artifact write failure cannot prevent returning the user's reservation.
    try {
      const { error: artifactError } = await admin.from("scholar_generation_artifacts").update({ error_code: errorCode }).eq("usage_id", operationId);
      if (artifactError) console.error("[scholar-ai] failure artifact not recorded", { operationId, code: artifactError.code });
    } catch { console.error("[scholar-ai] failure artifact connection lost", { operationId }); }
    return "refunded";
  } catch { return "pending"; }
}

export function reservationNotice(state: FailedReservation) {
  if (state === "refunded") return "A reserva de tokens foi liberada; esta tentativa não consumiu sua franquia.";
  if (state === "completed") return "A operação já foi concluída e o consumo está registrado. Consulte o registro antes de enviar outra solicitação.";
  return "Não foi possível confirmar a liberação da reserva de tokens. Consulte o registro e Minha licença antes de tentar novamente. Reservas interrompidas são verificadas na próxima tentativa após dez minutos.";
}
