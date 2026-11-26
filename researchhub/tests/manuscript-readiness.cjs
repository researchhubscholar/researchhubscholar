const assert=require("node:assert/strict");
const fs=require("node:fs"),ts=require("typescript");
require.extensions[".ts"]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,file);

const {assessManuscriptReadiness}=require("../lib/ai/manuscript-readiness.ts");
const protocol={research_question:"Does prior injury predict recurrence?",
 objective:"Evaluate recurrence determinants",study_type:"cohort"};
const rows=[
  {section_key:"introduction",content:"This research investigates recurrent injury in athletes, considering the importance of distinguishing recovery from another injury."},
  {section_key:"methods",content:"A cohort study was planned, with inclusion criteria and standardized follow-up procedures for participants."},
  {section_key:"results",content:"The observed recurrence proportion was 22,5% in the analyzed cohort. Other outcomes were not evaluated."},
  {section_key:"conclusion",content:"The recurrence was recorded in 22.5% of the cohort. Further research is needed to assess preventive strategies."}
];
const valid=assessManuscriptReadiness(protocol,rows);
assert.equal(valid.comparable,4);
assert(valid.canCompare);
assert(!valid.issues.some(i=>i.id==="conclusion-percentages"));
assert(valid.issues.some(i=>i.id==="section-discussion"));
const mismatched=assessManuscriptReadiness(protocol,rows.map(row=>row.section_key==="conclusion"
  ? {...row,content:"The recurrence was observed in 31% of all participants; results warrant confirmation and subgroup evaluation."}
  : row));
assert(mismatched.issues.some(i=>i.id==="conclusion-percentages" && i.explanation.includes("31%")));
assert(mismatched.issues.some(i=>i.section==="conclusion"));
const incomplete=assessManuscriptReadiness({study_type:"review"},[
  {section_key:"results",content:"[A preencher] Estudos incluídos pendentes de extração."},
  {section_key:"conclusion",content:"The intervention was successful and should be implemented in all health systems based on these results."}
]);
assert(incomplete.issues.some(i=>i.id==="research-question"));
assert(incomplete.issues.some(i=>i.id==="objective"));
assert(incomplete.issues.some(i=>i.id==="provisional-results"));
assert(incomplete.issues.some(i=>i.id==="short-results"));
assert(!incomplete.canCompare);
const empty=assessManuscriptReadiness(protocol,[]);
assert(!empty.canCompare);
assert.equal(empty.sections.length,7);
assert(empty.issues.some(i=>i.id==="section-results"));
console.log("PASS: zero-token readiness flags gaps and checks result percentages conservatively.");
