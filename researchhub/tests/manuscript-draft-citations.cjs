const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (module, file) => module._compile(
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, file);
const {verifyDraftCitationAnchors} = require("../lib/ai/manuscript-draft-citations.ts");
const sources = [
  {label:"S1", abstract:"Early rest and exercise influence symptom recovery after sport-related concussion.", fullTextExcerpt:""},
  {label:"S2", abstract:"Prevention research evaluated rule changes, protective equipment and modifiable concussion risk factors.", fullTextExcerpt:""},
  {label:"S3", abstract:"Clinical recovery includes time to return to school and sport after a concussion.", fullTextExcerpt:""}
];
const valid = JSON.stringify({anchors:[
  {id:"S2",kind:"abstract",quote:"Prevention research evaluated rule changes, protective equipment"},
  {id:"S3",kind:"abstract",quote:"Clinical recovery includes time to return to school and sport"}
]});
assert.equal(verifyDraftCitationAnchors(
  "Prevention methods were investigated [S2]. Recovery was also studied [S3].", valid, sources
).length, 2);
const swapped = JSON.stringify({anchors:[
  {id:"S3",kind:"abstract",quote:"Prevention research evaluated rule changes, protective equipment"},
  {id:"S2",kind:"abstract",quote:"Clinical recovery includes time to return to school and sport"}
]});
assert.throws(()=>verifyDraftCitationAnchors(
  "Prevention methods were investigated [S3]. Recovery was also studied [S2].", swapped, sources
),/não consta/);
assert.throws(()=>verifyDraftCitationAnchors(
  "Prevention methods were investigated [S2]. Recovery was also studied [S3].",
  JSON.stringify({anchors:[{id:"S2",kind:"abstract",quote:"Prevention research evaluated rule changes, protective equipment"}]}),
  sources
),/Cada citação/);
assert.throws(()=>verifyDraftCitationAnchors(
  "Prevention [S9].", JSON.stringify({anchors:[{id:"S9",kind:"abstract",quote:"Prevention research evaluated rule changes, protective equipment"}]}),
  sources
),/não selecionado/);
assert.throws(()=>verifyDraftCitationAnchors("Unsupported [3].",valid,sources),/rastreáveis/);
console.log("PASS: literal citation anchors block swapped, missing and unknown sources.");
