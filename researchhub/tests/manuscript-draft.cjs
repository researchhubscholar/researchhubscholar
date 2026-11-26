const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (module, file) => module._compile(
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, file);
const { prepareManuscriptDraftSources } = require("../lib/literature/manuscript-draft-sources.ts");
const owner = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const articleId = "33333333-3333-4333-8333-333333333333";
const article = {
  id: articleId, project_id: projectId, owner_id: owner, title: "Evidence trial",
  doi: "10.1234/example", pmid: "12345678",
  abstract: "Published abstract with enough information to support a qualified draft."
};
function database({ linked = true, abstract = article.abstract } = {}) {
  const a = {...article, project_id: linked ? projectId : null, abstract};
  return { from(table) {
    const query = {
      select() { return query; }, eq() { return query; },
      in() { return Promise.resolve({ data: table === "library_articles" ? [a] : [], error: null }); },
      maybeSingle() { return Promise.resolve({ data: {id: projectId, owner_id: owner}, error: null }); }
    };
    return query;
  }};
}
function metadata(license = "CC BY 4.0", open = true) {
  return { ok: true, json: async () => ({
    resultList: { result: [{ isOpenAccess: open ? "Y" : "N", license, pmcid: "PMC7654321" }] }
  }) };
}
function articleXml() {
  return { ok: true, headers: {get() {return "250";}}, text: async () =>
    "<article><body><sec><title>Introduction</title><p>" +
    "An independently published article provides important information about the intervention and its scope, while additional methodological analysis is required before drawing conclusions. " +
    "The manuscript should preserve the boundaries of the original evidence." +
    "</p></sec></body></article>" };
}
(async () => {
  const priorFetch = global.fetch;
  try {
    let calls = [];
    global.fetch = async url => { calls.push(String(url)); return String(url).includes("fullTextXML") ? articleXml() : metadata(); };
    const sources = await prepareManuscriptDraftSources(database(), owner, projectId, [articleId]);
    assert.equal(sources.length, 1);
    assert.equal(sources[0].label, "S1");
    assert.equal(sources[0].evidenceLevel, "licensed_full_text");
    assert(sources[0].fullTextExcerpt.includes("independently published"));
    assert.equal(calls.length, 2);

    calls = [];
    global.fetch = async url => { calls.push(String(url)); return metadata("All Rights Reserved"); };
    const abstracts = await prepareManuscriptDraftSources(database(), owner, projectId, [articleId]);
    assert.equal(abstracts[0].evidenceLevel, "abstract");
    assert.equal(abstracts[0].fullTextExcerpt, "");
    assert.equal(calls.length, 1, "no full text should be downloaded without a compatible licence");

    await assert.rejects(prepareManuscriptDraftSources(database({linked:false}),owner,projectId,[articleId]),/não pertencem/);
    const unavailable = await prepareManuscriptDraftSources(database({abstract:null}),owner,projectId,[articleId]);
    assert.equal(unavailable[0].evidenceLevel, "unavailable", "do not silently exclude selected sources without content");
    await assert.rejects(prepareManuscriptDraftSources(database(),owner,projectId,[articleId,articleId]),/diferentes/);
    console.log("PASS: manuscript draft sources preserve ownership, verify license, and safely fall back to abstracts.");
  } finally { global.fetch = priorFetch; }
})().catch(error => {console.error(error);process.exitCode = 1;});
