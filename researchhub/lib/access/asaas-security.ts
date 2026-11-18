import { timingSafeEqual } from "node:crypto";

export type CheckoutPayload = {
  id?: unknown;
  status?: unknown;
  externalReference?: unknown;
  items?: Array<{ value?: unknown; quantity?: unknown }>;
};

/** The Asaas webhook token is distinct from the Asaas API key. */
export function validAsaasWebhookToken(received: string | null, expected: string | undefined): boolean {
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Do not use floating-point monetary comparisons to authorize a paid license. */
export function asaasCheckoutTotalCents(checkout: CheckoutPayload): number | null {
  if (!Array.isArray(checkout.items) || !checkout.items.length) return null;
  let cents = 0;
  for (const item of checkout.items) {
    if (typeof item.value !== "number" || !Number.isFinite(item.value)
      || !Number.isInteger(item.quantity) || Number(item.quantity) < 1) return null;
    const value = Math.round(item.value * 100);
    if (Math.abs(item.value * 100 - value) > 0.001 || value < 0) return null;
    cents += value * Number(item.quantity);
  }
  return Number.isSafeInteger(cents) ? cents : null;
}

/** A browser callback or checkout creation is NOT financial proof. */
export function verifiedAsaasPaidCheckout(
  eventName: string,
  checkout: CheckoutPayload,
  requestId: string,
  checkoutId: string,
  totalCents: number,
): boolean {
  return eventName === "CHECKOUT_PAID"
    && checkout.id === checkoutId
    && checkout.status === "PAID"
    && (typeof checkout.externalReference !== "string" || checkout.externalReference === requestId)
    && asaasCheckoutTotalCents(checkout) === totalCents;
}
