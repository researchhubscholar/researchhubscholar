const assert=require("node:assert/strict");
const fs=require("node:fs"),ts=require("typescript");
const path="components/library/evidence-handoff-review.tsx";
const source=fs.readFileSync(path,"utf8");
const transpiled=ts.transpileModule(source,{fileName:path,reportDiagnostics:true,compilerOptions:{
  jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}});
const failures=(transpiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
assert.deepEqual(failures.map(d=>ts.flattenDiagnosticMessageText(d.messageText,"\n")),[]);
assert(source.includes("prepareProjectEvidenceHandoff("),"Must call IA-09 revalidation gate.");
assert(source.includes("buildEvidenceMatrixPreview("),"Must build IA-07 citation-based review.");
assert(source.includes('action: "accept_quote"'));
assert(source.includes('action: "reject_quote"'));
assert(source.includes("destinationConfirmed: true"));
assert(source.includes('disabled={disabled || !cells.length}'));
assert(source.includes('setEntries({}); setPreview(null);'),"Must clear decisions when project/sources change.");
assert(source.includes("scientific") || source.includes("científica"));
assert(!/fetch\s*\(|\.upsert\s*\(|\.insert\s*\(|\.update\s*\(|supabaseBrowser\s*\(/.test(source),"No storage or network operation allowed in preview-only UI.");
assert(!/original_results|results_workspace|scholar_manuscript_sections/.test(source),"Original results and manuscript must remain untouched.");
assert(!/onSave|onPersist|onConfirmWrite/.test(source),"No final save action before ownership and scientific review gate.");
console.log("PASS: IA-10 JSX syntax and safe review-only control contract.");
