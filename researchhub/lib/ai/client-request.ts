export class AIRequestError extends Error {
  constructor(message: string, public operationId = "", public status?: number) {
    super(message);
    this.name = "AIRequestError";
  }
}

export type AIUsage = { inputTokens: number; outputTokens: number; costUsd: number };
export function readAIUsage(value: unknown): AIUsage | null {
  if (!value || typeof value !== "object") return null;
  const usage = value as Record<string, unknown>;
  if (!["inputTokens", "outputTokens"].every(key => Number.isSafeInteger(usage[key]) && Number(usage[key]) >= 0)
    || typeof usage.costUsd !== "number" || !Number.isFinite(usage.costUsd) || usage.costUsd < 0) return null;
  return usage as AIUsage;
}

// A lost response does not prove the server stopped or returned a token reservation.
// Send once; the user can inspect their recorded operation before trying again.
export async function postAI<T>(path: string, payload: unknown, timeoutMs = 310_000): Promise<{ data: T; elapsedMs: number }> {
  const started = Date.now();
  try {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs), body: JSON.stringify(payload) });
    let data: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(await response.text());
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      data = parsed as Record<string, unknown>;
    } catch {
      throw new AIRequestError("A resposta da IA não chegou completa. Confira o registro e o consumo em Minha licença antes de tentar novamente.", "", response.status);
    }
    const operationId = typeof data.operationId === "string" && /^[0-9a-f-]{36}$/i.test(data.operationId) ? data.operationId : "";
    if (!response.ok) throw new AIRequestError(typeof data.error === "string" ? data.error : `Não foi possível concluir a análise (erro ${response.status}).`, operationId, response.status);
    return { data: data as T, elapsedMs: Date.now() - started };
  } catch (error) {
    if (error instanceof AIRequestError) throw error;
    throw new AIRequestError("A conexão com a IA foi interrompida ou excedeu o tempo de espera. A operação pode continuar no servidor. Confira o registro e o consumo em Minha licença antes de tentar novamente.");
  }
}
