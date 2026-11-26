const assert=require("node:assert/strict");
const fs=require("node:fs"),ts=require("typescript");
require.extensions[".ts"]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,file);
const {shouldRefreshDraftEvidence}=require("../lib/ai/manuscript-draft-recovery.ts");
assert(shouldRefreshDraftEvidence(new Error("O projeto mudou ou uma análise anterior não pertence a este rascunho. Reinicie a análise.")));
assert(shouldRefreshDraftEvidence(new Error("Uma das análises não foi encontrada nesta conta.")));
for(const message of ["A franquia de IA se esgotou.","Sessão expirada.","Provedor temporariamente indisponível.","A IA não apresentou as fontes."]){
  assert.equal(shouldRefreshDraftEvidence(new Error(message)),false,"must not retry "+message);
}
console.log("PASS: automatic retry is limited to stale evidence; quota/auth/provider errors never repeat.");
