import "server-only";

export type CheckoutEvent = {
  id?: unknown;
  event?: unknown;
  checkout?: {
    id?: unknown;
    status?: unknown;
    externalReference?: unknown;
    items?: Array<{ quantity?: unknown; value?: unknown }>;
  };
};

export function asaasBaseUrl(): string {
  const mode = (process.env.ASAAS_ENVIRONMENT || "").trim().toLowerCase();
  if (mode === "production") return "https://api.asaas.com/v3";
  if (mode === "sandbox") return "https://api-sandbox.asaas.com/v3";
  throw new Error("ASAAS_ENVIRONMENT deve ser production ou sandbox.");
}

export function checkoutEventAmountCents(event: CheckoutEvent): number | null {
  const items = event.checkout?.items;
  if (!Array.isArray(items) || items.length === 0) return null;
  let total = 0;
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || Number(item.quantity) < 1 || typeof item.value !== "number" || !Number.isFinite(item.value) || item.value < 0) return null;
    const cents = Math.round(item.value * 100);
    if (Math.abs(cents - item.value * 100) > 0.00001) return null;
    total += Number(item.quantity) * cents;
  }
  return total;
}

export function validPaidCheckout(event: CheckoutEvent): event is CheckoutEvent & { id: string; event: "CHECKOUT_PAID"; checkout: { id: string; status: "PAID"; items: Array<{ quantity: number; value: number }> } } {
  return typeof event.id === "string" && event.id.length > 4 &&
    event.event === "CHECKOUT_PAID" &&
    typeof event.checkout?.id === "string" && event.checkout.id.length > 4 &&
    event.checkout.status === "PAID" &&
    checkoutEventAmountCents(event) !== null;
}

export function checkoutUrl(id: string): string {
  if (!/^[a-zA-Z0-9_-]{8,150}$/.test(id)) throw new Error("Identificador de checkout inválido.");
  return "https://asaas.com/checkoutSession/show?id=" + encodeURIComponent(id);
}
