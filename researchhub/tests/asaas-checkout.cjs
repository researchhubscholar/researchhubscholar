const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const Module = require("node:module");
const path = require("node:path");

const file = path.resolve(__dirname, "../lib/payments/asaas.ts");
const source = fs.readFileSync(file, "utf8").replace('import "server-only";', "");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const loaded = new Module(file, module);
loaded.filename = file;
loaded.paths = module.paths;
loaded._compile(compiled, file);
const { validPaidCheckout, checkoutEventAmountCents, checkoutUrl, asaasBaseUrl } = loaded.exports;

const valid = { id: "evt_checkout_paid_123", event: "CHECKOUT_PAID", checkout: {
  id: "ch_1234567890", status: "PAID", items: [{ quantity: 1, value: 799 }, { quantity: 2, value: 1.25 }],
} };
assert.equal(validPaidCheckout(valid), true);
assert.equal(checkoutEventAmountCents(valid), 80150);
assert.equal(validPaidCheckout({ ...valid, checkout: { ...valid.checkout, status: "ACTIVE" } }), false);
assert.equal(validPaidCheckout({ ...valid, event: "CHECKOUT_CREATED" }), false);
assert.equal(validPaidCheckout({ ...valid, checkout: { ...valid.checkout, items: [] } }), false);
assert.equal(checkoutEventAmountCents({ ...valid, checkout: { ...valid.checkout, items: [{ quantity: 1, value: 1.001 }] } }), null);
assert.equal(checkoutUrl("12345678-1234"), "https://asaas.com/checkoutSession/show?id=12345678-1234");
assert.throws(() => checkoutUrl("javascript:alert(1)"));
process.env.ASAAS_ENVIRONMENT = "sandbox";
assert.equal(asaasBaseUrl(), "https://api-sandbox.asaas.com/v3");
process.env.ASAAS_ENVIRONMENT = "production";
assert.equal(asaasBaseUrl(), "https://api.asaas.com/v3");
delete process.env.ASAAS_ENVIRONMENT;
assert.throws(() => asaasBaseUrl());

const webhook = fs.readFileSync(path.resolve(__dirname, "../app/api/asaas/webhook/route.ts"), "utf8");
assert.match(webhook, /asaas-access-token/);
assert.match(webhook, /timingSafeEqual/);
assert.match(webhook, /provider_checkout_id/);
assert.match(webhook, /total_amount_cents/);
assert.match(webhook, /scholar_fulfill_paid_request/);
assert.match(webhook, /provider_event_id/);
assert.doesNotMatch(webhook, /event\s*===\s*["']CHECKOUT_CREATED["']\s*\)\s*await/);
console.log("PASS: Asaas payment verification, price consistency, checkout links, environment routing and fulfillment gates.");

const checkoutRoute = fs.readFileSync(path.resolve(__dirname, "../app/api/asaas/checkout/route.ts"), "utf8");
assert.match(checkoutRoute, /!generalCheckoutEnabled/);
assert.match(checkoutRoute, /purchase\.coupon_code === "TESTE99"/);
assert.match(checkoutRoute, /purchase\.plan === "essential"/);
assert.match(checkoutRoute, /purchase\.total_amount_cents === 599/);
assert.match(checkoutRoute, /testCoupon\.max_redemptions !== 1/);
assert.match(checkoutRoute, /pendingTest\?\.length/);
assert.match(checkoutRoute, /"payment_pending"/);
assert.match(checkoutRoute, /"access_token": apiKey/);
console.log("PASS: gated production checkout requires valid one-use Essencial TESTE99; other purchases remain disabled.");

const legacyWebhook = fs.readFileSync(path.resolve(__dirname, "../app/api/webhooks/asaas/route.ts"), "utf8");
const cancelSql = fs.readFileSync(path.resolve(__dirname, "../supabase/scholar_cancel_checkout_guard_20261118.sql"), "utf8");
const checkoutUi = fs.readFileSync(path.resolve(__dirname, "../app/contratacao/page.tsx"), "utf8");
assert.match(legacyWebhook, /export \{ POST, runtime, dynamic \} from "\.\.\/\.\.\/asaas\/webhook\/route"/);
assert.match(webhook, /checkout\.externalReference !== purchase\.id/);
assert.match(webhook, /status: 503/);
assert.match(webhook, /Pagamento confirmado requer conciliação da compra/);
assert.match(cancelSql, /provider_checkout_id IS NULL/);
assert.match(cancelSql, /status IN \('requested','approved'\)/);
assert.doesNotMatch(cancelSql, /status IN \('requested','approved','payment_pending'\)/);
assert.match(checkoutUi, /pending\.status === "payment_pending"/);
assert.match(checkoutUi, /wasCancelled !== true/);
assert.doesNotMatch(checkoutUi, /\["requested", "approved", "payment_pending"\]\.includes\(item\.status\)/);
console.log("PASS: webhook routes converge; linked checkouts cannot be cancelled; late payments remain reconcilable.");
