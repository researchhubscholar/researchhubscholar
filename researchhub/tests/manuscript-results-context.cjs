const assert=require("node:assert/strict");
const fs=require("node:fs");
const ts=require("typescript");
require.extensions[".ts"]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,file);
const {summarizeResearchResults,resultsContextFacts,loadScientificResultsContext,
  resultsContextHasEvidence,resultStudyCategory}=require("../lib/ai/manuscript-results-context.ts");
const workspace={
  dataset:{columns:["patient_id","age","risk_score"],rows:[
    ["SECRET-A","20","3"],["SECRET-B","40","4"],["SECRET-C","60","5"]
  ]},
  figure:{column:"age",title:"Age",caption:"",kind:"histogram"},
  flow:[{label:"Identified",count:9},{label:"Included",count:2}],
  notes:"PRIVATE PATIENT NOTE",reviewScreening:[
    {articleId:"11111111-1111-4111-8111-111111111111",status:"included",reason:""},
    {articleId:"22222222-2222-4222-8222-222222222222",status:"excluded",reason:"Population"}
  ]
};
const result=summarizeResearchResults(workspace,"original cohort");
assert.equal(result.status,"available");
assert.equal(result.datasetRows,3);
assert(result.summaries.some(x=>x.column==="age"&&x.mean===40));
assert(!result.summaries.some(x=>x.column==="patient_id"));
assert.equal(result.screening.included,1);
assert(!JSON.stringify(result).includes("SECRET"));
assert(!JSON.stringify(result).includes("PRIVATE PATIENT"));
assert.equal(resultStudyCategory("revisão sistemática"),"review");
assert.equal(resultStudyCategory("case report"),"case");
assert(resultsContextHasEvidence(result));
const facts=resultsContextFacts(result);
assert(facts.includes("40"));
assert(!facts.includes("PRIVATE"));
const user="33333333-3333-4333-8333-333333333333",project="44444444-4444-4444-8444-444444444444";
const database={from(table){
  const q={select(){return q;},eq(){return q;},in(){return Promise.resolve({
    data:table==="library_articles"?[{id:"11111111-1111-4111-8111-111111111111",title:"A published trial",
    pmid:"123",doi:null,publication_year:2024}]:[{article_id:"11111111-1111-4111-8111-111111111111",
    main_finding:"The investigators reported a descriptive result.",limitation:"Single center",sample_size:"84"}],
    error:null
  });},maybeSingle(){return Promise.resolve({data:{workspace},error:null});}};
  return q;
}};
(async()=>{
  const result=await loadScientificResultsContext(database,user,project,"systematic review");
  assert.equal(result.includedStudies.length,1);
  assert.equal(result.includedStudies[0].sampleSize,"84");
  assert.equal(result.includedStudies[0].title,"A published trial");
  assert(!JSON.stringify(result).includes("SECRET"));
  const unavailable={from(){const q={select(){return q;},eq(){return q;},maybeSingle(){
    return Promise.resolve({data:null,error:{message:"temporarily unavailable"}});
  }};return q;}};
  const safe=await loadScientificResultsContext(unavailable,user,project,"cohort");
  assert.equal(safe.status,"none");
  assert(safe.warnings.some(t=>t.includes("não pôde ser consultado")));
  console.log("PASS: Result summaries omit row-level identifiers, use curated screening, and fail safely.");
})().catch(e=>{console.error(e);process.exitCode=1});
