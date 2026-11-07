const fs = require("node:fs");
const assert = require("node:assert/strict");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);

const { buildAlertPubmedTerm, unseenArticles, nextSeenKeys } = require("../lib/literature/search-alerts.ts");
const base = { query: "sleep quality residents", period: "5", study_type: "trial" };
const term = buildAlertPubmedTerm(base, new Date("2026-09-24T12:00:00Z"));
assert.match(term, /clinical trial\[Publication Type\]/);
assert.match(term, /sleep quality/);
assert.match(term, /Title\/Abstract/);
assert.match(term, /2022\/01\/01/);
assert.match(term, /2026\/09\/24/);
assert.match(buildAlertPubmedTerm({ ...base, period: "all", study_type: "all" }), /sleep quality/);
assert.throws(() => buildAlertPubmedTerm({ ...base, query: "microplásticos em gestantes" }), /precisam de confirmação/);

const pubmed = { pmid: "123", doi: "10.1/a", title: "A", authors: [], journal: "J", pubdate: "2026", year: 2026, publicationTypes: [], abstract: null, pubmedUrl: "https://pubmed.ncbi.nlm.nih.gov/123/", doiUrl: "https://doi.org/10.1/a", source: "PubMed" };
const crossref = { ...pubmed, pmid: null, doi: "10.1/b", title: "B", source: "Crossref" };
assert.deepEqual(unseenArticles([pubmed, crossref], ["123"]).map((item) => item.title), ["B"]);
assert.deepEqual(nextSeenKeys([pubmed, crossref], ["old"]), ["123", "doi:10.1/b", "old"]);
assert.equal(nextSeenKeys([pubmed, crossref], ["old"], 2).length, 2);
console.log("search alert baseline, PubMed filters and unseen-reference comparison passed");


const vm = require("node:vm");
const { createRequire } = require("node:module");
const path = require("node:path");
function load(file, deps) {
  const filename = path.resolve(file), module = { exports: {} }, localRequire = createRequire(filename);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, process, URLSearchParams, Date, console: { error() {} }, require: name => name in deps ? deps[name] : localRequire(name) });
  return module.exports;
}
const definition = { id: "11111111-1111-4111-8111-111111111111", owner_id: "owner", name: "Monitor", ...base, source: "both", sort: "relevance", alerts_enabled: true, alert_checked_at: "2026-01-01", alert_seen_keys: ["123"] };
function database({ existing = [], insertError = false, updateError = false } = {}) {
  const state = { rows: new Set(existing), calls: [], enabled: true };
  const db = { from(table) {
    const call = { table, filters: [] }; state.calls.push(call);
    const chain = {
      upsert(rows) { call.rows = rows; return chain; }, select(fields) { call.select = fields; return chain; },
      update(values) { call.values = values; return chain; }, eq(key, value) { call.filters.push([key, value]); return chain; },
      then(resolve, reject) {
        if (call.rows) {
          const data = [];
          if (!insertError) for (const row of call.rows) if (!state.rows.has(row.article_key)) { state.rows.add(row.article_key); data.push({ id: row.article_key }); }
          return Promise.resolve({ data, error: insertError ? Error("insert failed") : null }).then(resolve, reject);
        }
        if (!updateError && call.values.alerts_enabled !== undefined) state.enabled = call.values.alerts_enabled;
        return Promise.resolve({ error: updateError ? Error("update failed") : null }).then(resolve, reject);
      },
    }; return chain;
  } };
  return { db, state };
}
function processor({ failPubmed = false, failCrossref = false, beforeDetails } = {}) {
  const calls = [];
  const service = load("lib/literature/search-alerts.ts", {
    "./pubmed": {
      pubmedSearch: async (...args) => { calls.push(args); if (failPubmed) throw Error("PubMed offline"); return { ids: ["123"] }; },
      fetchArticleDetails: async () => { beforeDetails?.(); return [pubmed]; },
    },
    "./crossref": {
      crossrefFetch: async query => { calls.push(query); if (failCrossref) throw Error("Crossref offline"); return { items: [{ DOI: "10.1/b" }] }; },
      crossrefArticle: () => crossref,
    },
  });
  return { service, calls };
}
(async () => {
  const { service, calls } = processor();
  const first = database();
  assert.equal((await service.processSavedSearchAlert(first.db, definition)).found, 1);
  assert.equal(calls[0][2], "pub date");
  assert.equal(new URLSearchParams(calls[1].slice(1)).get("sort"), "published");
  assert.equal(first.state.calls[0].select, "id");
  assert.equal(first.state.calls[1].values.alerts_enabled, undefined);
  assert(first.state.calls[1].filters.some(([key,value]) => key === "alerts_enabled" && value === true));
  assert(first.state.calls[1].filters.some(([key,value]) => key === "owner_id" && value === definition.owner_id));
  // Replaying an old snapshot, retrying after a failed final update, or an evicted seen key must not count stored rows again.
  assert.equal((await service.processSavedSearchAlert(first.db, definition)).found, 0);
  const updateFailure = database({ updateError: true });
  await assert.rejects(service.processSavedSearchAlert(updateFailure.db, definition), /update failed/);
  assert.equal((await service.processSavedSearchAlert(database({ existing: [...updateFailure.state.rows] }).db, definition)).found, 0);
  const insertFailure = database({ insertError: true });
  await assert.rejects(service.processSavedSearchAlert(insertFailure.db, definition), /insert failed/);
  assert.equal(insertFailure.state.calls.length, 1, "failed inserts must not advance the baseline");
  const paused = database();
  assert.equal((await service.processSavedSearchAlert(paused.db, { ...definition, alerts_enabled: false })).skipped, true);
  assert.equal(paused.state.calls.length, 0);
  const initialize = database(); initialize.state.enabled = false;
  assert.equal((await service.processSavedSearchAlert(initialize.db, { ...definition, alerts_enabled: false }, true)).found, 0);
  assert.equal(initialize.state.enabled, true);
  assert.equal(initialize.state.calls.length, 1, "initial activation must not notify about the baseline");
  const concurrentPause = database();
  const slow = processor({ beforeDetails: () => { concurrentPause.state.enabled = false; } });
  await slow.service.processSavedSearchAlert(concurrentPause.db, definition);
  assert.equal(concurrentPause.state.enabled, false, "an in-flight check must never reactivate a paused alert");
  for (const failure of [{ failPubmed: true }, { failCrossref: true }, { failPubmed: true, failCrossref: true }]) {
    const unavailable = database();
    await assert.rejects(processor(failure).service.processSavedSearchAlert(unavailable.db, definition), /offline/);
    assert.equal(unavailable.state.calls.length, 0, "an incomplete source collection must not change the baseline");
  }

  const json = (body, init) => new Response(JSON.stringify(body), { ...init, headers: { "Content-Type": "application/json" } });
  for (const scenario of ["unauthenticated", "missing", "paused", "initialize", "active"]) {
    const filters = []; let processed = false;
    const row = { ...definition, alerts_enabled: scenario === "active" };
    const db = { auth: { getUser: async () => ({ data: { user: scenario === "unauthenticated" ? null : { id: "owner" } } }) }, from() {
      const chain = { select() { return chain; }, eq(...args) { filters.push(args); return chain; }, single: async () => ({ data: scenario === "missing" ? null : row }) }; return chain;
    } };
    const route = load("app/api/literature/alerts/check/route.ts", {
      "next/server": { NextResponse: { json } }, "@/lib/supabase/server": { supabaseServer: async () => db },
      "@/lib/literature/search-alerts": { processSavedSearchAlert: async (_, search, initialize) => { processed = true; assert.equal(search.owner_id, "owner"); assert.equal(initialize, scenario === "initialize"); return { found: 0 }; } },
    });
    const response = await route.POST(new Request("https://test/api", { method: "POST", body: JSON.stringify({ savedSearchId: definition.id, initialize: scenario === "initialize" }) }));
    assert.equal(response.status, { unauthenticated: 401, missing: 404, paused: 409, initialize: 200, active: 200 }[scenario]);
    assert.equal(processed, ["initialize", "active"].includes(scenario));
    if (scenario !== "unauthenticated") assert(filters.some(([key,value]) => key === "owner_id" && value === "owner"));
  }

  const oldSecret = process.env.CRON_SECRET; process.env.CRON_SECRET = "fixture-secret";
  try {
    for (const recordFailure of [false, true]) {
      const orders = [], writes = []; let attempts = 0;
      const db = { from() {
        let values; const filters = [];
        const chain = {
          select() { return chain; }, eq(...args) { filters.push(args); return chain; },
          order(key) { orders.push(key); return chain; }, limit() { return chain; }, update(payload) { values = payload; return chain; },
          then(resolve,reject) {
            if (values) { writes.push({ values, filters }); return Promise.resolve({ error: recordFailure ? Error("write failed") : null }).then(resolve,reject); }
            return Promise.resolve({ data: [definition, { ...definition, id: "second" }], error: null }).then(resolve,reject);
          },
        }; return chain;
      } };
      const route = load("app/api/cron/search-alerts/route.ts", {
        "next/server": { NextResponse: { json } }, "@/lib/supabase/admin": { supabaseAdmin: () => db },
        "@/lib/literature/search-alerts": { processSavedSearchAlert: async () => { if (++attempts === 1) throw Error("source offline"); return { found: 2 }; } },
      });
      assert.equal((await route.GET(new Request("https://test/api"))).status, 401);
      const response = await route.GET(new Request("https://test/api", { headers: { authorization: "Bearer fixture-secret" } }));
      assert.equal(response.status, recordFailure ? 500 : 200);
      assert.equal(orders[0], "updated_at");
      assert(writes[0].filters.some(([key,value]) => key === "owner_id" && value === "owner"));
      if (!recordFailure) { const data = await response.json(); assert.equal(data.processed, 2); assert.equal(data.found, 2); assert.equal(data.deferred, 0); }
    }
  } finally { if (oldSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = oldSecret; }
  console.log("PASS: actual alert processing and HTTP handlers preserve consent, count only inserted rows, retain complete baselines, scope ownership and rotate failures.");
})().catch(error => { console.error(error); process.exitCode = 1; });
