const assert = require("node:assert/strict");
const fs = require("node:fs"), ts = require("typescript");
require.extensions[".ts"] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,file);

const { buildEvidenceMatrixPreview } = require("../lib/literature/evidence-matrix-preview.ts");
const { verifyEvidenceAnchor } = require("../lib/literature/provenance.ts");
const first = {
  articleId:"pmid:100", title:"A randomized clinical trial",
  pmid:"100", doi:"10.1000/one", publicationTypes:["Randomized Controlled Trial"],
  abstract:"METHODS: We enrolled 120 patients in the intervention group. RESULTS: At 12 weeks, adjusted OR 1.5 was reported."
};
const second = {
  articleId:"doi:two", title:"A cross-sectional study",
  doi:"10.1000/two", publicationTypes:["Cross-Sectional Studies"],
  abstract:"RESULTS: 250 participants were included in the analysis. Missing data were reported."
};
const matrix = buildEvidenceMatrixPreview([first, second]);
assert.equal(matrix.rows.length,2);
assert.equal(matrix.kind,"review_only_preview");
assert.equal(matrix.rows[0].studyDesign,"clinical-trial");
assert.equal(matrix.rows[1].studyDesign,"cross-sectional");
assert.equal(matrix.rows[0].pmid,"100");
assert.equal(matrix.rows[1].doi,"10.1000/two");
assert.equal(matrix.rows[0].humanConfirmed,false);
assert(matrix.rows[0].cells.some(cell=>cell.kind==="effect_estimate" && cell.matchedText.includes("OR 1.5")));
assert(matrix.rows[1].cells.some(cell=>cell.kind==="missingness"));
assert(matrix.rows[1].missing.includes("effect_estimate"));
for(const [i,row] of matrix.rows.entries()){
 const article=[first,second][i];
 for(const cell of row.cells){
   assert(verifyEvidenceAnchor(article.abstract,cell.provenance));
   assert.equal(cell.status,"pending_human_review");
   assert.equal(cell.interpretationVerified,false);
   assert.equal(cell.provenance.page,null);
 }
}
assert.equal(matrix.limitations.noCrossArticleInference,true);
assert.equal(matrix.limitations.noPooledEstimates,true);
assert.equal(matrix.limitations.noAutomaticPersistence,true);
assert.equal(matrix.limitations.noPatientLevelData,true);
assert.throws(()=>buildEvidenceMatrixPreview([first,first]),/repita/);
assert.throws(()=>buildEvidenceMatrixPreview(Array.from({length:13},(_,i)=>({...first,articleId:"article-"+i}))),/12/);
assert.throws(()=>buildEvidenceMatrixPreview([{...first,articleId:"../secret"}]),/identificador/);
assert.deepEqual(buildEvidenceMatrixPreview([]).rows,[]);
assert.throws(()=>buildEvidenceMatrixPreview([{...first,publicationTypes:"clinical trial"}]),/tipos de publicação/);
console.log("PASS: IA-07 separate articles, missing fields, citations, duplicate defense and review-only safeguards.");
