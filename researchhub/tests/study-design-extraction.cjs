const assert=require("node:assert/strict");
const fs=require("node:fs"),ts=require("typescript");
const compile=file=>ts.transpileModule(fs.readFileSync(file,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
require.extensions[".ts"]=(module,file)=>module._compile(compile(file),file);
const matrix=require("../lib/literature/matrix-template.ts");
const prov=require("../lib/literature/provenance.ts");
const claim=require("../lib/literature/claim-validation.ts");
const {extractStructuredEvidence,resolveExtractionDesign}=require("../lib/literature/structured-extraction.ts");

const trialAbstract="METHODS: A randomized trial enrolled 120 participants in an intervention and a control group. RESULTS: The primary outcome improved after 12 weeks (OR 1.5, 95% confidence interval 1.1 to 2.0; p=0.03).";
const trial=extractStructuredEvidence(trialAbstract,{title:"Sleep intervention",publicationTypes:["Randomized Controlled Trial"]});
assert.equal(trial.studyDesign,"clinical-trial");
assert.equal(trial.designSource,"publication_metadata");
for(const kind of ["sample","groups","outcome","effect","uncertainty","timepoint"])
  assert(trial.candidates.some(candidate=>candidate.kind===kind),kind);
assert.deepEqual(trial.missing,[]);
for(const candidate of trial.candidates){
 assert.equal(candidate.status,"review_required");
 assert.equal(candidate.source,"abstract");
 assert.equal(prov.verifyEvidenceAnchor(trialAbstract,candidate.provenance),true);
 assert.equal(candidate.validation.scientificInterpretationVerified,false);
 assert.equal(candidate.provenance.page,null);
}
assert.equal(trial.safeguards.hasParticipantLevelData,false);
assert.equal(trial.safeguards.numericalInterpretationVerified,false);

const observational=extractStructuredEvidence(
 "METHODS: Cross-sectional analysis of 200 participants. RESULTS: Prevalence of fatigue was measured.",
 {title:"Fatigue prevalence",studyDesign:"cross-sectional"}
);
assert.equal(observational.studyDesign,"cross-sectional");
assert.equal(observational.designSource,"user");
assert(observational.missing.includes("effect"));
assert(observational.missing.includes("uncertainty"));
assert(!observational.missing.includes("groups"));

const systematic=extractStructuredEvidence(
 "METHODS: We included 24 studies. RESULTS: Mortality estimates were summarized.",
 {publicationTypes:["Systematic Review"]}
);
assert.equal(systematic.studyDesign,"systematic-review");
assert(systematic.candidates.some(item=>item.kind==="sample"));
assert(systematic.missing.includes("uncertainty"));

const caseReport=extractStructuredEvidence(
 "A case report described one patient at baseline. No numerical estimates were available.",
 {title:"An unusual case report"}
);
assert.equal(caseReport.studyDesign,"case-report");
assert(caseReport.missing.includes("outcome"));

const unknown=extractStructuredEvidence(
 "Several notes were recorded. No article-specific information is provided.",
 {title:"Unclassified publication"}
);
assert.equal(unknown.studyDesign,"other");
assert.equal(unknown.designSource,"unknown");
assert.equal(unknown.candidates.length,0);
assert.equal(resolveExtractionDesign("x",[],"not-a-design").studyDesign,"other");

const response={NextResponse:{json:(data,options)=>new Response(JSON.stringify(data),{status:options?.status||200})}};
const mod={exports:{}};
new Function("require","module","exports","process",compile("app/api/literature/extract/route.ts"))(id=>{
 const deps={
  "next/server":response,
  "@/lib/literature/provenance":prov,
  "@/lib/literature/claim-validation":claim,
  "@/lib/literature/structured-extraction":{extractStructuredEvidence}
 };
 if(!(id in deps))throw Error("Unexpected module: "+id);
 return deps[id];
},mod,mod.exports,process);
const request=()=>new Request("https://local/api/literature/extract",{method:"POST",headers:{"Content-Type":"application/json"},
 body:JSON.stringify({title:"Sleep intervention",publicationTypes:["Randomized Controlled Trial"],abstract:trialAbstract})});
(async()=>{
 const old=process.env.SCHOLAR_AI05_STRUCTURED_EXTRACTION;
 try{
  process.env.SCHOLAR_AI05_STRUCTURED_EXTRACTION="false";
  const disabled=await mod.exports.POST(request());
  assert.equal(disabled.status,200);
  assert.equal(Object.hasOwn(await disabled.json(),"structuredEvidence"),false);
  process.env.SCHOLAR_AI05_STRUCTURED_EXTRACTION="true";
  const enabled=await mod.exports.POST(request());
  assert.equal(enabled.status,200);
  const data=await enabled.json();
  assert.equal(data.structuredEvidence.studyDesign,"clinical-trial");
  assert.equal(data.structuredEvidence.safeguards.reviewRequired,true);
  assert(data.suggestions);
  assert(data.scientificValidation);
  console.log("PASS: IA-05 study designs, missing fields, anchors, no individual data, opt-in route.");
 }finally{
  if(old===undefined)delete process.env.SCHOLAR_AI05_STRUCTURED_EXTRACTION;
  else process.env.SCHOLAR_AI05_STRUCTURED_EXTRACTION=old;
 }
})().catch(err=>{console.error(err);process.exitCode=1});
