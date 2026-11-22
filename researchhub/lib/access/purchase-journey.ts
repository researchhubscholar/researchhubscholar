import { plans, type PlanKey } from "./plans";

type Query = Record<string, string | string[] | undefined>;
type PurchaseArea = "conta" | "institucional";
type PurchaseReturn = "retorno" | "cancelado" | "expirado";

export type PurchaseIntent = {
  plan?: PlanKey;
  coupon?: string;
  orderId?: string;
  paymentReturn?: PurchaseReturn;
  area?: PurchaseArea;
};

export const purchaseOrderId = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

export function purchaseCoupon(value: unknown) {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^[A-Z0-9_-]{1,40}$/.test(code) ? code : undefined;
}

export function readPurchaseIntent(query: URLSearchParams | Query): PurchaseIntent {
  const get = (key: string) => query instanceof URLSearchParams ? query.get(key) : query[key];
  const plan = get("plano");
  const order = get("pedido");
  const payment = get("pagamento");
  const area = get("area");
  const orderId = typeof order === "string" && purchaseOrderId.test(order) ? order : undefined;
  return {
    plan: typeof plan === "string" && Object.hasOwn(plans, plan) ? plan as PlanKey : undefined,
    coupon: purchaseCoupon(get("cupom")),
    orderId,
    paymentReturn: orderId && (payment === "retorno" || payment === "cancelado" || payment === "expirado")
      ? payment : undefined,
    area: area === "conta" || area === "institucional" ? area : undefined,
  };
}

type PurchasePath = "/planos" | "/contratacao" | "/login" | "/cadastro";

export function purchaseHref(path: PurchasePath, intent?: PurchaseIntent, confirmed = false) {
  const params = new URLSearchParams();
  if (confirmed) params.set("confirmed", "1");
  if (intent) {
    if (path === "/login" || path === "/cadastro") params.set("compra", "1");
    if (intent.plan) params.set("plano", intent.plan);
    if (intent.coupon) params.set("cupom", intent.coupon);
    if (intent.orderId) params.set("pedido", intent.orderId);
    if (intent.paymentReturn) params.set("pagamento", intent.paymentReturn);
    if (intent.area) params.set("area", intent.area);
  }
  return params.size ? path + "?" + params.toString() : path;
}

export function readPurchaseAuthIntent(params: URLSearchParams) {
  return params.get("compra") === "1" ? readPurchaseIntent(params) : undefined;
}

