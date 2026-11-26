const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (module, file) => module._compile(
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, file);
const { validateDraftEvidenceBatch, rankDraftEvidence } = require("../lib/ai/manuscript-draft-batches.ts");
const projectId = "22222222-2222-4222-8222-222222222222";
const selected = [
  {id:"a",label:"S1",title:"Prevention in Sport",abstract:"Concussion prevention interventions include rule changes and protective equipment.",fullTextExcerpt:"",evidenceLevel:"abstract",pmid:"101",doi:null},
  {id:"b",label:"S2",title:"Recovery Review",abstract:"The initial symptom burden predicts longer time to return to sport in concussion recovery.",fullTextExcerpt:"",evidenceLevel:"abstract",pmid:"102",doi:null},
  {id:"c",label:"S3",title:"Unrelated clinical note",abstract:"",fullTextExcerpt:"",evidenceLevel:"unavailable",pmid:null,doi:null}
];
const records = [
  {label:"S1",relevance:1,finding:"The published review discusses injury prevention measures, but does not establish concussion recurrence predictors.",kind:"abstract",quote:"Concussion prevention interventions include rule changes and protective equipment."},
  {label:"S2",relevance:2,finding:"The reported outcome concerns recovery time rather than the probability of recurrent concussion.",kind:"abstract",quote:"The initial symptom burden predicts longer time to return to sport in concussion recovery."},
  {label:"S3",relevance:0,finding:"",kind:"none",quote:""}
];
assert.equal(validateDraftEvidenceBatch(JSON.stringify(records), selected).length,3);
const swapped = structuredClone(records);
swapped[0].quote = records[1].quote;
assert.throws(()=>validateDraftEvidenceBatch(JSON.stringify(swapped),selected),/não corresponde/);
const skipped = records.slice(0,2);
assert.throws(()=>validateDraftEvidenceBatch(JSON.stringify(skipped),selected),/cada artigo/);
const forged = structuredClone(records);
forged[2].relevance = 3;
assert.throws(()=>validateDraftEvidenceBatch(JSON.stringify(forged),selected),/inválida|irrelevante|evidência/);
const candidates = records.map((note,i)=>({
  ...note,id:selected[i].id,title:selected[i].title,
  pmid:selected[i].pmid,doi:selected[i].doi,evidenceLevel:selected[i].evidenceLevel
}));
const ranked = rankDraftEvidence(candidates);
assert.equal(ranked.considered,3);
assert.equal(ranked.relevant,2);
assert.equal(ranked.candidates[0].id,"b");
assert.equal(ranked.candidates[0].label,"S1");
assert.throws(()=>rankDraftEvidence([...candidates,candidates[0]]),/mesmo artigo/);
console.log("PASS: each article is considered; every quoted note remains traceable and ranked without duplicates.");
