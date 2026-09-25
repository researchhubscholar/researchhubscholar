import { plans, policy, type PlanKey } from "./plans";

export const institutionalPlans = {
  essential: { name: "Essencial", annualSeatCents: 48000, tokensPerSeat: 3000000 },
  plus: { name: "Plus", annualSeatCents: 72000, tokensPerSeat: 6000000 },
  premium: { name: "Premium", annualSeatCents: 120000, tokensPerSeat: 12000000 },
} as const;

export type CommerceKind = "individual" | "institutional" | "recharge";
export type BillingSchedule = "annual" | "12x";

export function localQuote(kind: CommerceKind, plan: PlanKey, seats = 1, quantity = 1) {
  const safeSeats = kind === "institutional" ? Math.min(10000, Math.max(1, Math.trunc(seats))) : 1;
  const safeQuantity = Math.min(100, Math.max(1, Math.trunc(quantity)));
  if (kind === "recharge") {
    return {
      unitAmountCents: policy.rechargeCents,
      grossAmountCents: policy.rechargeCents * safeQuantity,
      tokenAllowance: policy.rechargeTokens * safeQuantity,
      seats: 1,
      quantity: safeQuantity,
    };
  }
  const item = kind === "institutional" ? institutionalPlans[plan] : plans[plan];
  const unitAmountCents = "annualSeatCents" in item ? item.annualSeatCents : item.annualCents;
  const tokensPerUnit = "tokensPerSeat" in item ? item.tokensPerSeat : item.tokens;
  return {
    unitAmountCents,
    grossAmountCents: unitAmountCents * safeSeats,
    tokenAllowance: tokensPerUnit * safeSeats,
    seats: safeSeats,
    quantity: 1,
  };
}

export function requestStatus(value: string) {
  return ({
    requested: "Solicitado",
    approved: "Aprovado",
    payment_pending: "Aguardando pagamento",
    paid: "Pago",
    activated: "Ativado",
    cancelled: "Cancelado",
    expired: "Expirado",
  } as Record<string, string>)[value] || value;
}
