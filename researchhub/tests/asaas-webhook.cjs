const fs = require("node:fs");
const assert = require("node:assert/strict");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) =>
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
const { authorizedWebhookToken, parsePaidCheckout } = require("../lib/access/asaas-webhook.ts");

const secret = "as".repeat(24);
assert.equal(authorizedWebhookToken(secret, secret), true);
assert.equal(authorizedWebhookToken("wrong", secret), false);
assert.equal(authorizedWebhookToken(secret + "X", secret), false);
assert.equal(authorizedWebhookToken(secret, "short"), false);
assert.equal(authorizedWebhookToken(null, secret), false);
const payload = {
  id: "evt_1111111111",
  event: "CHECKOUT_PAID",
  checkout: {
    id: "ch_2222222222",
    status: "PAID",
    externalReference: "11111111-1111-4111-8111-111111111111",
    items: [{ name: "Essencial", quantity: 1, value: 599.00 }],
  },
};
assert.deepEqual(parsePaidCheckout(payload), {
  eventId: payload.id,
  checkoutId: payload.checkout.id,
  externalReference: payload.checkout.externalReference,
  chargedCents: 59900,
});
assert.equal(parsePaidCheckout({ ...payload, event: "CHECKOUT_CREATED" }), null);
assert.throws(() => parsePaidCheckout({ ...payload, checkout: { ...payload.checkout, status: "ACTIVE" } }), /sem confirmação/);
assert.throws(() => parsePaidCheckout({ ...payload, checkout: { ...payload.checkout, items: [] } }), /sem itens/);
assert.throws(() => parsePaidCheckout({ ...payload, checkout: { ...payload.checkout, items: [{ quantity: 1, value: 2.321 }] } }), /centavos/);
assert.equal(parsePaidCheckout({ ...payload, checkout: { ...payload.checkout,
  items: [{ quantity: 3, value: 12.33 }, { quantity: 2, value: 1.01 }] } }).chargedCents, 3901);

const legacyRoute = fs.readFileSync("app/api/webhooks/asaas/route.ts", "utf8");
assert.match(legacyRoute, /export \{ POST, runtime, dynamic \} from "\.\.\/\.\.\/asaas\/webhook\/route"/);
const route = fs.readFileSync("app/api/asaas/webhook/route.ts", "utf8");
for (const required of ["asaas-access-token", "provider_checkout_id", "total_amount_cents", "scholar_fulfill_paid_request", "payment_pending", "alreadyActivated"]) {
  assert(route.includes(required), required + " must be checked by the canonical handler");
}
assert(!route.includes("ASAAS_API_KEY"), "Webhook must not authenticate with the API credential");
console.log("PASS: both webhook paths share authenticated handler; payment validation, amount matching, duplicate safeguards and licensing RPC.");
