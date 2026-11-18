const fs = require("node:fs");
const assert = require("node:assert/strict");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => module._compile(
  ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename,
);

const {
  validAsaasWebhookToken, asaasCheckoutTotalCents, verifiedAsaasPaidCheckout,
} = require("../lib/access/asaas-security.ts");

const secret = "very-strong-test-webhook-token-0123456789";
assert.equal(validAsaasWebhookToken(secret, secret), true);
assert.equal(validAsaasWebhookToken(secret + "x", secret), false);
assert.equal(validAsaasWebhookToken(null, secret), false);
assert.equal(validAsaasWebhookToken(secret, undefined), false);

const checkout = {
  id: "checkout123", status: "PAID", externalReference: "request123",
  items: [{ value: 599, quantity: 1 }],
};
assert.equal(asaasCheckoutTotalCents(checkout), 59900);
assert.equal(verifiedAsaasPaidCheckout("CHECKOUT_PAID", checkout, "request123", "checkout123", 59900), true);
assert.equal(verifiedAsaasPaidCheckout("CHECKOUT_CREATED", checkout, "request123", "checkout123", 59900), false);
assert.equal(verifiedAsaasPaidCheckout("CHECKOUT_PAID", checkout, "request123", "checkout123", 59901), false);
assert.equal(verifiedAsaasPaidCheckout("CHECKOUT_PAID", checkout, "wrong", "checkout123", 59900), false);
assert.equal(verifiedAsaasPaidCheckout("CHECKOUT_PAID", checkout, "request123", "wrong", 59900), false);
assert.equal(verifiedAsaasPaidCheckout("CHECKOUT_PAID", { ...checkout, status: "ACTIVE" }, "request123", "checkout123", 59900), false);
assert.equal(asaasCheckoutTotalCents({ items: [{ value: 0.001, quantity: 1 }] }), null);
assert.equal(asaasCheckoutTotalCents({ items: [] }), null);
assert.equal(asaasCheckoutTotalCents({ items: [{ value: 599, quantity: 0 }] }), null);
assert.equal(asaasCheckoutTotalCents({ items: [{ value: 599, quantity: 1 }, { value: 1, quantity: 3 }] }), 60200);
assert.equal(verifiedAsaasPaidCheckout("CHECKOUT_PAID", { ...checkout, items: undefined }, "request123", "checkout123", 59900), false);
console.log("PASS: authenticated Asaas webhooks, checkout identity, amount, confirmed paid status and redelivery safety conditions.");
