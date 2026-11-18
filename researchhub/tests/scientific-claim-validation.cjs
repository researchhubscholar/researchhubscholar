const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const compile = file => ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
require.extensions[".ts"] = (module, file) => module._compile(compile(file), file);

const provenance = require("../lib/literature/provenance.ts");
const validation = require("../lib/literature/claim-validation.ts");

const abstract = "RESULTS: Among 120 participants, 35% reported symptoms (95% CI 20%-40%; OR 1.5; p=0.03). The observational study found an association.";
const anchor = provenance.anchorEvidence(abstract, "Among 120 participants, 35% reported symptoms (95% CI 20%-40%; OR 1.5; p=0.03).");
assert(provenance.verifyEvidenceAnchor(abstract, anchor));
const accepted = validation.validateClaimAgainstEvidence("120 participants; 35%; OR 1.5; p=0.03", abstract, anchor);
assert.equal(accepted.status, "review_required");
assert.deepEqual(accepted.unmatchedNumbers, []);
assert.equal(accepted.scientificInterpretationVerified, false);
assert.equal(validation.claimMayBePresentedAsVerifiedResult(accepted), false);

const invented = validation.validateClaimAgainstEvidence("121 participants; 35% reported symptoms", abstract, anchor);
assert.equal(invented.status, "unsupported");
assert(invented.unmatchedNumbers.includes("121"));

const changedPercentage = validation.validateClaimAgainstEvidence("36% reported symptoms", abstract, anchor);
assert.equal(changedPercentage.status, "unsupported");
assert(changedPercentage.unmatchedNumbers.includes("36%"));

const changedOperator = validation.validateClaimAgainstEvidence("OR 1.6", abstract, anchor);
assert.equal(changedOperator.status, "unsupported");
assert(changedOperator.unmatchedNumbers.includes("1.6"));

const noNumbers = validation.validateClaimAgainstEvidence("The observational study found an association.", abstract, provenance.anchorEvidence(abstract, "The observational study found an association."));
assert.equal(noNumbers.status, "verifiable_excerpt");
assert.equal(noNumbers.scientificInterpretationVerified, false);

const metadata = validation.validateClaimAgainstEvidence("Clinical Trial", abstract, provenance.anchorEvidence(abstract, "Clinical Trial", "publication_types"));
assert.equal(metadata.status, "unsupported");
assert.equal(metadata.evidenceChecked, false);
const invalid = validation.validateClaimAgainstEvidence("120 participants", "CHANGED ABSTRACT", anchor);
assert.equal(invalid.status, "unsupported");

const moduleRef = { exports: {} };
const next = {NextResponse: {json: (payload, init) => new Response(JSON.stringify(payload), {status: init?.status || 200, headers: {"Content-Type": "application/json"}})}};
new Function("require", "module", "exports", compile("app/api/literature/extract/route.ts"))(id => {
  if (id === "next/server") return next;
  if (id === "@/lib/literature/provenance") return provenance;
  if (id === "@/lib/literature/claim-validation") return validation;
  throw Error("Unexpected import: " + id);
}, moduleRef, moduleRef.exports);
(async () => {
 const response = await moduleRef.exports.POST(new Request("https://local/api/literature/extract", {
   method:"POST", headers:{"Content-Type":"application/json"},
   body:JSON.stringify({abstract, publicationTypes:["Observational Study"]})
 }));
 assert.equal(response.status, 200);
 const body = await response.json();
 assert.equal(body.scientificValidation.statisticallyVerified, false);
 assert.equal(body.scientificValidation.requiresHumanReview, true);
 assert(body.suggestions.finding?.validation);
 assert.equal(body.suggestions.method?.provenance.verification, "metadata_only");
 assert.equal(body.suggestions.method?.validation.status, "unsupported");
 console.log("PASS: IA-04 numeric evidence, fabricated values, proportions, metadata and route response.");
})().catch(error => { console.error(error); process.exitCode = 1; });
