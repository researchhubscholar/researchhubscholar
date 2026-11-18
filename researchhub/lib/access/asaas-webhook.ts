import { timingSafeEqual } from "node:crypto";

/** Only a checkout completion event, never a browser redirect, can license a buyer. */
export type CheckoutPaid = {
  eventId: string;
  checkoutId: string;
  externalReference: string | null;
  chargedCents: number;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function authorizedWebhookToken(received: string | null, expected: string | undefined) {
  if (!expected || !received || expected.length < 32) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parsePaidCheckout(payload: unknown): CheckoutPaid | null {
  if (!isObject(payload) || payload.event !== "CHECKOUT_PAID") return null;
  if (typeof payload.id !== "string" || payload.id.length < 8 || payload.id.length > 220) {
    throw new Error("Identificador de evento Asaas inválido");
  }
  const checkout = payload.checkout;
  if (!isObject(checkout) || typeof checkout.id !== "string" || checkout.id.length < 8 ||
      checkout.id.length > 200 || checkout.status !== "PAID") {
    throw new Error("Checkout sem confirmação financeira válida");
  }
  if (!Array.isArray(checkout.items) || checkout.items.length < 1 || checkout.items.length > 50) {
    throw new Error("Checkout pago sem itens verificáveis");
  }
  let chargedCents = 0;
  for (const raw of checkout.items) {
    if (!isObject(raw) || typeof raw.value !== "number" ||
        !Number.isFinite(raw.value) || raw.value < 0 ||
        typeof raw.quantity !== "number" || !Number.isSafeInteger(raw.quantity) ||
        raw.quantity < 1 || raw.quantity > 10000) {
      throw new Error("Valor ou quantidade inválidos no checkout");
    }
    const valueCents = Math.round(raw.value * 100);
    if (Math.abs(valueCents / 100 - raw.value) > 0.000001) {
      throw new Error("Valor monetário não possui precisão de centavos");
    }
    chargedCents += valueCents * raw.quantity;
    if (!Number.isSafeInteger(chargedCents)) throw new Error("Valor de checkout fora do intervalo");
  }
  return {
    eventId: payload.id,
    checkoutId: checkout.id,
    externalReference: typeof checkout.externalReference === "string" ? checkout.externalReference : null,
    chargedCents,
  };
}
