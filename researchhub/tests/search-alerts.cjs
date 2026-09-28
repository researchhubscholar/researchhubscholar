const fs = require("node:fs");
const assert = require("node:assert/strict");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);

const { buildAlertPubmedTerm, unseenArticles, nextSeenKeys } = require("../lib/literature/search-alerts.ts");
const base = { query: "sleep quality residents", period: "5", study_type: "trial" };
const term = buildAlertPubmedTerm(base, new Date("2026-09-24T12:00:00Z"));
assert.match(term, /clinical trial\[Publication Type\]/);
assert.match(term, /2022\/01\/01/);
assert.match(term, /2026\/09\/24/);
assert.equal(buildAlertPubmedTerm({ ...base, period: "all", study_type: "all" }), "(sleep quality residents)");

const pubmed = { pmid: "123", doi: "10.1/a", title: "A", authors: [], journal: "J", pubdate: "2026", year: 2026, publicationTypes: [], abstract: null, pubmedUrl: "https://pubmed.ncbi.nlm.nih.gov/123/", doiUrl: "https://doi.org/10.1/a", source: "PubMed" };
const crossref = { ...pubmed, pmid: null, doi: "10.1/b", title: "B", source: "Crossref" };
assert.deepEqual(unseenArticles([pubmed, crossref], ["123"]).map((item) => item.title), ["B"]);
assert.deepEqual(nextSeenKeys([pubmed, crossref], ["old"]), ["123", "doi:10.1/b", "old"]);
assert.equal(nextSeenKeys([pubmed, crossref], ["old"], 2).length, 2);
console.log("search alert baseline, PubMed filters and unseen-reference comparison passed");
