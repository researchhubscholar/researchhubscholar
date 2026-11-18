// Isolated webhook integration test: no Asaas requests and no production database writes.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const ts = require("typescript");
const token = "researchhub-asaas-test-token-0123456789";
process.env.ASAAS_WEBHOOK_TOKEN = token;

const source = fs.readFileSync("app/api/payments/asaas/webhook/route.ts", "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
let purchase, rpcCount = 0, updateCount = 0, dbReads = 0, failRpc = false;
const admin = {
  from(name) {
    assert.equal(name, "scholar_purchase_requests");
    return {
      select() { return this; },
      eq() { return this; },
      update() { updateCount += 1; return this; },
      async maybeSingle() { dbReads += 1; return { data: purchase, error: null }; },
    };
  },
  async rpc(name, args) {
    assert.equal(name, "scholar_fulfill_paid_request");
    assert.equal(args.p_request, "purchase-001");
    assert.equal(args.p_provider_event, "evt-001");
    rpcCount += 1;
    return { error: failRpc ? { code: "P0001" } : null };
  },
};
const moduleMock = { exports: {} };
const mockRequire = name => {
  if (name === "next/server") return { NextResponse: { json: (obj, opts) => Response.json(obj, opts) } };
  if (name === "@/lib/supabase/admin") return { supabaseAdmin: () => admin };
  return require(name);
};
new Function("require", "module", "exports", js)(mockRequire, moduleMock, moduleMock.exports);
const { POST } = moduleMock.exports;
function request(body, auth = token) {
  return new Request("https://example.org/api/payments/asaas/webhook", {
    method: "POST", headers: { "Content-Type": "application/json", ...(auth ? { "asaas-access-token": auth } : {}) },
    body: JSON.stringify(body),
  });
}
function event(name = "CHECKOUT_PAID", status = "PAID") {
  return { id: "evt-001", event: name, checkout: { id: "checkout-001", externalReference: "purchase-001", status } };
}
(async () => {
  purchase = { id: "purchase-001", status: "payment_pending", provider_checkout_id: "checkout-001" };
  assert.equal((await POST(request(event(), "wrong-token"))).status, 401);
  assert.equal((await POST(request(event(), null))).status, 401);
  assert.equal(dbReads, 0);
  const badStatus = await POST(request(event("CHECKOUT_PAID", "ACTIVE")));
  assert.equal(badStatus.status, 409);
  assert.equal(rpcCount, 0);
  purchase = { ...purchase, provider_checkout_id: "another-checkout" };
  assert.equal((await POST(request(event()))).status, 409);
  assert.equal(rpcCount, 0);
  purchase = { ...purchase, provider_checkout_id: "checkout-001" };
  assert.equal((await POST(request(event("CHECKOUT_CREATED", "ACTIVE")))).status, 200);
  assert.equal(rpcCount, 0);
  failRpc = true;
  assert.equal((await POST(request(event()))).status, 503);
  assert.equal(rpcCount, 1);
  failRpc = false;
  assert.equal((await POST(request(event()))).status, 200);
  assert.equal(rpcCount, 2);
  purchase = { ...purchase, status: "activated" };
  assert.equal((await POST(request(event()))).status, 200);
  assert.equal(rpcCount, 2, "replayed paid webhook must not grant a second license");
  assert.equal((await POST(request(event("CHECKOUT_EXPIRED", "EXPIRED")))).status, 200);
  assert.equal(updateCount, 0, "late expiry must not revoke paid license");
  purchase = { ...purchase, status: "payment_pending" };
  assert.equal((await POST(request(event("CHECKOUT_CANCELED", "CANCELED")))).status, 200);
  assert.equal(updateCount, 1);
  console.log("PASS: unauthenticated and unmatched Asaas events rejected, paid fulfillment once, retries safe, late cancellation ignored.");
})().catch(error => { console.error(error); process.exitCode = 1; });
