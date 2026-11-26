const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (module, file) => module._compile(
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, file);
const {loadDraftComposition} = require("../lib/ai/manuscript-draft-aggregate.ts");
const uid = "11111111-1111-4111-8111-111111111111";
const pid = "22222222-2222-4222-8222-222222222222";
const opA = "33333333-3333-4333-8333-333333333333";
const opB = "44444444-4444-4444-8444-444444444444";
const project = {id:pid,owner_id:uid,study_type:"systematic review",population:"adult athletes",objective:"Risk of repeat concussion"};
const src=(n,label,title,abstract)=>({
  id:"00000000-0000-4000-8000-"+String(n).padStart(12,"0"),label,title,pmid:String(n),doi:null,abstract,
  fullTextExcerpt:"",evidenceLevel:"abstract",license:null,pmcid:null
});
const first=src(1,"S1","Prevention review","Protection and rule changes were investigated for initial concussion prevention.");
const second=src(2,"S1","Recurrence cohort","A previous concussion was associated with subsequent injury in the observed athlete cohort.");
const one={label:"S1",relevance:1,finding:"The selected publication addresses first-concussion prevention, not longitudinal recurrence.",kind:"abstract",quote:"Protection and rule changes were investigated for initial concussion prevention."};
const two={label:"S1",relevance:3,finding:"The cohort observed associations between previous concussion and subsequent injury.",kind:"abstract",quote:"A previous concussion was associated with subsequent injury in the observed athlete cohort."};
const row=(operation,sources,notes)=>({
  usage_id:operation,user_id:uid,prompt_version:"writing.draft-beta.v3-batch-sources",
  input_snapshot:{context:{project,task:"evidence_batch",sources}},
  output_snapshot:{recommendations:[{targetField:"introduction",content:JSON.stringify(notes)}]}
});
const records=[row(opA,[first],[one]),row(opB,[second],[two])];
const client={from(table){
  assert.equal(table,"scholar_generation_artifacts");
  const x={select(){return x},eq(){return x},in(_,ids){
    return Promise.resolve({data:records.filter(row=>ids.includes(row.usage_id)),error:null});
  }};
  return x;
}};
(async()=>{
  const res=await loadDraftComposition(client,uid,pid,[opA,opB],project);
  assert.equal(res.considered,2);
  assert.equal(res.relevant,2);
  assert.equal(res.sources[0].title,"Recurrence cohort");
  assert.equal(res.sources[0].label,"S1");
  assert.equal(res.sources[0].abstract,two.quote);
  await assert.rejects(loadDraftComposition(client,uid,pid,[opA,opB],{...project,population:"professional fighters"}),/projeto mudou/);
  await assert.rejects(loadDraftComposition(client,uid,pid,[opA,opA],project),/histórico/);
  await assert.rejects(loadDraftComposition(client,uid,pid,[opA,
    "55555555-5555-4555-8555-555555555555"],project),/não foi encontrada/);
  console.log("PASS: all evidence batches remain account/project bound; protocol changes invalidate stale analyses.");
})().catch(e=>{console.error(e);process.exitCode=1});
