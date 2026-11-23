const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const compile = file => ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
require.extensions[".ts"] = (module, file) => module._compile(compile(file), file);
const provenance = require("../lib/literature/provenance.ts");
const claimValidation = require("../lib/literature/claim-validation.ts");
const structured = require("../lib/literature/structured-extraction.ts");
const { extractDeepResultsEvidence } = require("../lib/literature/deep-results-evidence.ts");
const abstract = "METHODS: We enrolled 120 patients in the intervention group and 110 patients in the control group. RESULTS: At 12 weeks, adjusted OR 1.5 was reported; 10 patients were lost to follow-up, and blood pressure was 130 mmHg.";
const evidence = extractDeepResultsEvidence(abstract);
for (const kind of ["denominator", "group", "timepoint", "effect_adjustment", "effect_estimate", "missingness", "unit"]) {
 assert(evidence.fragments.some(item=>item.kind === kind), kind);
}
assert(evidence.fragments.some(item => item.kind === "denominator" && item.raw.includes("120 patients")));
assert(evidence.fragments.some(item => item.kind === "unit" && item.raw.includes("130 mmHg")));
assert(evidence.fragments.some(item => item.kind === "effect_estimate" && item.raw.includes("OR 1.5")));
for (const fragment of evidence.fragments) {
 assert(provenance.verifyEvidenceAnchor(abstract, fragment.provenance));
 assert.equal(fragment.associationStatus, "unresolved");
 assert.equal(fragment.reviewRequired, true);
 assert.equal(fragment.provenance.page, null);
 assert.equal(fragment.source, "published_abstract");
}
assert.equal(evidence.limitations.originalResearchDataImported, false);
assert.equal(evidence.limitations.denominatorsLinkedToOutcomes, false);
assert.equal(evidence.limitations.effectsStatisticallyVerified, false);
const absent = extractDeepResultsEvidence("This paper describes a methodological approach without reporting any quantitative observations.");
assert.equal(absent.fragments.length, 0);
assert(absent.notIdentifiedInAbstract.includes("denominator"));
assert(absent.notIdentifiedInAbstract.includes("effect_estimate"));
const moduleRef = {exports:{}};
const next = {NextResponse:{json:(body,init)=>new Response(JSON.stringify(body),{status:init?.status||200})}};
new Function("require","module","exports","process",compile("app/api/literature/extract/route.ts"))(id=>{
 const deps={
  "next/server":next,
  "@/lib/literature/provenance":provenance,
  "@/lib/literature/claim-validation":claimValidation,
  "@/lib/literature/structured-extraction":structured,
  "@/lib/literature/deep-results-evidence":{extractDeepResultsEvidence},
 };
 if(!(id in deps)) throw Error("Unexpected dependency "+id);
 return deps[id];
},moduleRef,moduleRef.exports,process);
const request=()=>new Request("https://local/api/literature/extract",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({abstract,publicationTypes:["Clinical Trial"]})});
(async()=>{
 const previous=process.env.SCHOLAR_AI06_DEEP_RESULTS;
 try {
  process.env.SCHOLAR_AI06_DEEP_RESULTS="false";
  const off=await moduleRef.exports.POST(request());
  assert.equal(off.status,200);
  assert.equal(Object.hasOwn(await off.json(),"deepResultsEvidence"),false);
  process.env.SCHOLAR_AI06_DEEP_RESULTS="true";
  const on=await moduleRef.exports.POST(request());
  assert.equal(on.status,200);
  const result=await on.json();
  assert(result.deepResultsEvidence.fragments.length > 0);
  assert.equal(result.deepResultsEvidence.limitations.individualPatientDataAvailable,false);
  assert.equal(result.scientificValidation.statisticallyVerified,false);
  console.log("PASS: IA-06 fragments, provenance, no inferred denominators, missingness and opt-in integration.");
 } finally {
  if(previous===undefined) delete process.env.SCHOLAR_AI06_DEEP_RESULTS;
  else process.env.SCHOLAR_AI06_DEEP_RESULTS=previous;
 }
})().catch(err=>{console.error(err);process.exitCode=1});

// Two adjacent outcomes in the SPRINT follow-up report (PMID 34010531).
const sprint = "RESULTS: Primary outcome, 1.77% per year vs. 2.40% per year; hazard ratio, 0.73; 95% confidence interval [CI], 0.63 to 0.86; all-cause mortality, 1.06% per year vs. 1.41% per year; hazard ratio, 0.75; 95% CI, 0.61 to 0.92.";
const sprintFragments = extractDeepResultsEvidence(sprint).fragments;
const reported = kind => sprintFragments.filter(fragment => fragment.kind === kind).map(fragment => fragment.raw);
assert.deepEqual(reported("rate"), ["1.77% per year", "2.40% per year", "1.06% per year", "1.41% per year"]);
assert.deepEqual(reported("effect_estimate"), ["hazard ratio, 0.73", "hazard ratio, 0.75"]);
assert.deepEqual(reported("confidence_interval"), ["95% confidence interval [CI], 0.63 to 0.86", "95% CI, 0.61 to 0.92"]);
for (const fragment of sprintFragments) {
  assert(provenance.verifyEvidenceAnchor(sprint, fragment.provenance));
  assert.equal(fragment.associationStatus, "unresolved");
}
const { buildEvidenceMatrixPreview } = require("../lib/literature/evidence-matrix-preview.ts");
const [sprintRow] = buildEvidenceMatrixPreview([{ articleId: "34010531", title: "SPRINT final report", abstract: sprint }]).rows;
assert.equal(sprintRow.cells.filter(cell => cell.kind === "confidence_interval").length, 2);
assert(sprintRow.cells.every(cell => cell.status === "pending_human_review"));
assert(!sprintRow.missing.includes("rate"));
console.log("PASS: SPRINT rates, effect estimates and confidence intervals reach matrix review with verified sources.");

const groupedCounts = "The search identified 8,480 studies. We reviewed 2.500 participants, n = 1,200, and 66 of 8,480 studies. Another registry enrolled 12 345 patients. The mean was 3.14 patients per unit.";
const [groupedRow] = buildEvidenceMatrixPreview([{ articleId: "39328321", title: "Grouped counts", abstract: groupedCounts }]).rows;
assert.deepEqual(
 groupedRow.cells.filter(cell => cell.kind === "denominator").map(cell => cell.matchedText),
 ["8,480 studies", "2.500 participants", "n = 1,200", "66 of 8,480", "12 345 patients"],
);
