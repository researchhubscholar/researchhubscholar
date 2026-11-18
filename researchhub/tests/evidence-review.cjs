const assert = require("node:assert/strict");
const fs = require("node:fs"), ts = require("typescript");
require.extensions[".ts"] = (mod,file) => mod._compile(ts.transpileModule(fs.readFileSync(file,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,file);
const { buildEvidenceMatrixPreview } = require("../lib/literature/evidence-matrix-preview.ts");
const { verifyEvidenceAnchor } = require("../lib/literature/provenance.ts");
const { reviewEvidence } = require("../lib/literature/evidence-review.ts");

const sources = [
 {articleId:"pmid:123",title:"Randomized controlled trial",pmid:"123",
  publicationTypes:["Randomized Controlled Trial"],
  abstract:"METHODS: We enrolled 120 patients in the treatment group. RESULTS: At 12 weeks, adjusted OR 1.5 was observed."},
 {articleId:"doi:abc",title:"Observational cohort",doi:"10.1234/example",
  publicationTypes:["Cohort Studies"],
  abstract:"RESULTS: 250 participants were followed up. Missing data were reported."},
];
const matrix=buildEvidenceMatrixPreview(sources);
const cell=matrix.rows[0].cells[0];
assert(cell,"An extractable cell must exist");
const decision={articleId:sources[0].articleId,cellIndex:0,expectedExcerpt:cell.excerpt,
 expectedMatchedText:cell.matchedText,action:"accept_quote",reviewerConfirmed:true};
const reviewed=reviewEvidence(sources,[decision]);
assert.equal(reviewed.status,"review_only");
assert.equal(reviewed.accepted.length,1);
assert.equal(reviewed.rejected,0);
assert.equal(reviewed.persistencePerformed,false);
assert.equal(reviewed.exportAllowedWithoutFurtherReview,false);
assert.equal(reviewed.accepted[0].interpretationVerified,false);
assert.equal(reviewed.accepted[0].approvedForManuscript,false);
assert(verifyEvidenceAnchor(sources[0].abstract,reviewed.accepted[0].provenance));
const total=matrix.rows.reduce((n,row)=>n+row.cells.length,0);
assert.equal(reviewed.pending,total-1);
const unconfirmed=reviewEvidence(sources,[{...decision,reviewerConfirmed:false}]);
assert.equal(unconfirmed.accepted.length,0);
assert.equal(unconfirmed.blocked.length,1);
assert.equal(unconfirmed.pending,total);
const tampered=reviewEvidence(sources,[{...decision,expectedMatchedText:"OR 3.8"}]);
assert.equal(tampered.accepted.length,0);
assert.equal(tampered.blocked.length,1);
const stale=reviewEvidence([{...sources[0],abstract:"Different published abstract."},sources[1]],[decision]);
assert.equal(stale.accepted.length,0);
assert.equal(stale.blocked.length,1);
const duplicate=reviewEvidence(sources,[decision,decision]);
assert.equal(duplicate.accepted.length,1);
assert.equal(duplicate.blocked.length,1);
const rejection=reviewEvidence(sources,[{...decision,action:"reject_quote"}]);
assert.equal(rejection.rejected,1);
assert.equal(rejection.accepted.length,0);
const invalid=reviewEvidence(sources,[{...decision,cellIndex:300}]);
assert.equal(invalid.blocked.length,1);
const other=reviewEvidence(sources,[{...decision,articleId:"pmid:unknown"}]);
assert.equal(other.accepted.length,0);
assert.equal(other.blocked.length,1);
assert.deepEqual(reviewEvidence(sources,[]).accepted,[]);
assert.throws(()=>reviewEvidence(sources,Array.from({length:121},()=>decision)),/120/);
console.log("PASS: IA-08 opt-in explicit review, stale source, tampered content, duplicate, reject and no persistence.");
