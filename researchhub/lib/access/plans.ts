export const plans = {
  essential: { name: "Essencial", annualCents: 59900, tokens: 3000000 },
  plus: { name: "Plus", annualCents: 89900, tokens: 6000000 },
  premium: { name: "Premium", annualCents: 149900, tokens: 12000000 },
} as const;
export const policy = { maxOperationTokens: 10000, dailyOperations: 20, concurrentOperations: 1, rechargeCents: 7900, rechargeTokens: 1000000 } as const;
export const institutional = { seats: 30, annualCents: 1440000, tokens: 90000000, directorsIncluded: 1 } as const;
export const initialModels = { ideas: "gpt-5.6-terra", assistance: "gpt-5.6-luna" } as const;
export type PlanKey = keyof typeof plans;
export function usageAlert(used: number, granted: number): string {
  if (!granted) return "Sem franquia ativa";
  const ratio = used / granted;
  return ratio >= 1 ? "Franquia esgotada" : ratio >= .9 ? "Você já utilizou 90% ou mais da franquia" : ratio >= .75 ? "Você já utilizou 75% ou mais da franquia" : "Franquia disponível";
}
export function operationBudget(input: number, output: number) {
  if (![input, output].every(Number.isSafeInteger) || input < 0 || output < 1 || input + output > policy.maxOperationTokens) throw new Error("A operação deve caber em até 10.000 tokens de entrada e saída.");
  return input + output;
}
export function money(cents: number) { return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

export function licenseStatus(value: string) { return ({pending: "Aguardando ativação",trial: "Teste",active: "Ativa",suspended: "Suspensa",expired: "Expirada"} as Record<string,string>)[value] || value; }
export function generationStatus(value: string) { return ({reserved: "Em andamento",completed: "Concluída",failed: "Falhou"} as Record<string,string>)[value] || value; }
