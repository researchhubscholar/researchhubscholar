/**
 * Offline scientific-quality benchmark for the manuscript Beta.
 * All studies below are synthetic teaching cases, not clinical records.
 *
 * Measures: admission of traceable findings, rejection of fabricated quotes,
 * scope/staleness flags and false-positive controls for deterministic checks.
 * DOES NOT measure live LLM detection, clinical truth or scientific entailment.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs"),ts=require("typescript");
require.extensions[".ts"]=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,file);
const {buildManuscriptAuditSource,reviewManuscriptAuditContent,
  manuscriptAuditPreparation,auditSourceHasMaterial}=
  require("../lib/ai/manuscript-coherence.ts");
const {assessManuscriptReadiness}=require("../lib/ai/manuscript-readiness.ts");

const overview="Avaliação sintética de coerência com trechos rastreáveis que exigem revisão humana.";
const common={
  abstract:"This is a synthetic educational manuscript. The objective and design were planned in advance; findings are considered cautiously.",
  introduction:"The clinical question requires distinguishing the observed association from claims of causation or effectiveness.",
  limitations:"The limited evidence base and methodological constraints restrict causal interpretation and generalizability."
};
const makeRows=(parts)=>Object.entries({...common,...parts}).map(([section_key,content])=>({section_key,content}));
const cases=[
  {
    kind:"revisao_sistematica", expected:"scope",
    project:{
      research_question:"Which factors are associated with recurrence after an earlier sport-related concussion?",
      objective:"Synthesize observational studies of recurrent concussion risk in adult athletes",
      study_type:"systematic review",
      population:"Adult athletes with a previous sport-related concussion",
      methods:"Review longitudinal cohort and case-control studies"
    },
    parts:{
      methods:"We synthesized observational cohort and case-control studies about risk of a second concussion in adults with prior concussion.",
      results:"Eight observational studies were eligible. No randomized trial assessing helmet efficacy against recurrent concussion was included.",
      discussion:"The observational studies suggest potential associations but do not establish whether protective equipment prevents a subsequent concussion.",
      conclusion:"Randomized trials definitively prove that protective helmets prevent recurrent concussion in adults."
    },
    evidence:[
      ["results","No randomized trial assessing helmet efficacy against recurrent concussion was included."],
      ["conclusion","Randomized trials definitively prove that protective helmets prevent recurrent concussion in adults."]
    ],
    coherentConclusion:"The available observational evidence suggests candidate recurrence associations but cannot establish a protective causal effect."
  },
  {
    kind:"relato_de_caso",expected:"conclusion",
    project:{
      research_question:"How did symptoms evolve after stopping a suspected drug?",
      objective:"Describe the clinical course of one anonymized adult with suspected adverse drug reaction",
      study_type:"case report",
      population:"One anonymized adult",
      methods:"Descriptive report without controlled intervention"
    },
    parts:{
      methods:"One anonymized adult was observed retrospectively in an uncontrolled case report without comparator or randomization.",
      results:"The participant's rash improved after withdrawal of the suspected medication, although other supportive measures were also provided.",
      discussion:"Temporal improvement is compatible with several explanations and cannot prove that withdrawal alone caused resolution.",
      conclusion:"Discontinuation alone was proven to cure all comparable cases with this drug-related rash."
    },
    evidence:[
      ["methods","One anonymized adult was observed retrospectively in an uncontrolled case report without comparator or randomization."],
      ["conclusion","Discontinuation alone was proven to cure all comparable cases with this drug-related rash."]
    ],
    coherentConclusion:"The symptoms improved after cessation of the suspected agent, but this single report does not demonstrate causality or generalizability."
  },
  {
    kind:"estudo_original",expected:"results",
    project:{
      research_question:"What was the proportion of recurrent injury in the defined cohort?",
      objective:"Estimate the descriptive recurrence proportion",
      study_type:"retrospective cohort",
      population:"Adults with a prior documented sports injury",
      methods:"Descriptive cohort with no intervention comparison"
    },
    parts:{
      methods:"We reviewed a synthetic retrospective cohort of 120 adults with a documented prior injury, using descriptive statistics only.",
      results:"Among 120 adults in the synthetic cohort, recurrent injury was documented in 27 patients (22.5%). No comparative causal analysis was performed.",
      discussion:"The descriptive estimate is observational and should not be interpreted as an intervention effect.",
      conclusion:"The recurrence proportion was 31% and the protective intervention reduced recurrence by half."
    },
    evidence:[
      ["results","recurrent injury was documented in 27 patients (22.5%). No comparative causal analysis was performed."],
      ["conclusion","The recurrence proportion was 31% and the protective intervention reduced recurrence by half."]
    ],
    coherentConclusion:"Recurrence was documented in 27 of 120 adults (22.5%). The descriptive design does not establish intervention effectiveness."
  }
];
const metrics={
  cases:cases.length,validTraceable:0,invalidRejected:0,
  emptyControlAccepted:0,invalidFieldRejected:0,
  consistentNotFlagged:0,sourceCoverage:0,provisionalWarnings:0,
  caughtUnsupportedPercentages:0
};

for(const study of cases){
  const rows=makeRows(study.parts);
  const source=buildManuscriptAuditSource(study.project,rows);
  assert(auditSourceHasMaterial(source),study.kind);
  assert.equal(manuscriptAuditPreparation(source).truncated.length,0,study.kind);
  const evidence=study.evidence.map(([field,quote])=>({origin:"section",field,quote}));
  const finding={
    level:"critical",category:study.expected,
    title:"Incompatibilidade científica a verificar", 
    explanation:"O texto apresenta uma incompatibilidade explícita com a população, método ou resultado registrado.",
    recommendation:"Conferir os trechos e reescrever a afirmação para corresponder aos dados efetivamente documentados.",
    evidence
  };
  const report=(findings)=>JSON.stringify({overview,findings});
  const accepted=reviewManuscriptAuditContent(report([finding]),source);
  assert.equal(accepted.audit.findings.length,1,study.kind+" positive");
  assert.equal(accepted.audit.findings[0].level,"critical",study.kind+" calibrated severity");
  metrics.validTraceable++;
  const fabricated=structuredClone(finding);
  fabricated.evidence[0].quote="The randomized controlled trial had a positive result with p below 0.001.";
  const rejected=reviewManuscriptAuditContent(report([fabricated]),source);
  assert.equal(rejected.audit.findings.length,0,study.kind+" fabricated evidence");
  assert.equal(rejected.rejected,1);
  metrics.invalidRejected++;
  const swapped=structuredClone(finding);
  swapped.evidence[0].field=study.evidence[1][0];
  const wrong=reviewManuscriptAuditContent(report([swapped]),source);
  assert.equal(wrong.audit.findings.length,0,study.kind+" swapped quote origin");
  metrics.invalidFieldRejected++;
  const coherentRows=makeRows({...study.parts,conclusion:study.coherentConclusion});
  const coherentSource=buildManuscriptAuditSource(study.project,coherentRows);
  const honestEmpty=reviewManuscriptAuditContent(report([]),coherentSource);
  assert.equal(honestEmpty.audit.findings.length,0);
  assert.equal(honestEmpty.rejected,0);
  metrics.emptyControlAccepted++;
  const oldFinding=reviewManuscriptAuditContent(report([finding]),coherentSource);
  assert.equal(oldFinding.audit.findings.length,0,study.kind+" stale conclusion reference");
  metrics.consistentNotFlagged++;
  const readiness=assessManuscriptReadiness(study.project,coherentRows);
  assert(readiness.canCompare);
  metrics.sourceCoverage++;
  const partial=makeRows({...study.parts,discussion:"[A preencher] Discussion pending confirmation."});
  assert(assessManuscriptReadiness(study.project,partial).issues.some(i=>i.id==="provisional-discussion"));
  metrics.provisionalWarnings++;
  if(study.kind==="estudo_original"){
    const mismatched=assessManuscriptReadiness(study.project,rows);
    assert(mismatched.issues.some(i=>i.id==="conclusion-percentages"));
    const coherent=assessManuscriptReadiness(study.project,coherentRows);
    assert(!coherent.issues.some(i=>i.id==="conclusion-percentages"));
    metrics.caughtUnsupportedPercentages++;
  }
}
// This case intentionally illustrates the remaining scientific limitation:
// grounded quotations do not automatically prove the model's interpretation.
// Semantic truth must be assessed by a clinician/researcher.
const sampled=buildManuscriptAuditSource(cases[0].project,makeRows(cases[0].parts));
const misleading={
  level:"review",category:"reporting",title:"Alerta sem interpretação científica válida",
  explanation:"Embora os trechos sejam literais, a interpretação poderia estar incorreta sem análise especializada.",
  recommendation:"Peça revisão humana do significado e da importância clínica da afirmação.",
  evidence:[{origin:"section",field:"results",quote:cases[0].evidence[0][1]}]
};
assert.equal(reviewManuscriptAuditContent(JSON.stringify({overview,findings:[misleading]}),sampled)
  .audit.findings.length,1);
metrics.semanticTruthIndependentlyVerified=false;
assert.deepEqual({
  cases:metrics.cases,accepted:metrics.validTraceable,rejected:metrics.invalidRejected,
  swapped:metrics.invalidFieldRejected,coherent:metrics.emptyControlAccepted,
  stale:metrics.consistentNotFlagged,readiness:metrics.sourceCoverage,
  partial:metrics.provisionalWarnings,numeric:metrics.caughtUnsupportedPercentages
},{cases:3,accepted:3,rejected:3,swapped:3,coherent:3,stale:3,readiness:3,partial:3,numeric:1});
console.log("SCIENTIFIC_BETA_BENCHMARK="+JSON.stringify(metrics));
console.log("PASS: three synthetic designs and three coherent controls; source-grounding/coverage verified. Live LLM detection NOT measured.");
