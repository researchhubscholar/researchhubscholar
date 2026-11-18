const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => module._compile(
  ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
const { validateSuggestionQuery, normalizeSuggestionQuery } = require("../lib/literature/suggestion-query.ts");
const { queryPreflight } = require("../lib/literature/query-preflight.ts");
const invalid = [
  "AND diabetes", "diabetes OR", "(OR diabetes)", "(diabetes AND)",
  "diabetes AND OR hypertension", "( )", "diabetes NOT NOT hypertension",
];
for (const query of invalid) assert.throws(() => validateSuggestionQuery(query), /operadores booleanos|grupos vazios/, query);
const valid = [
  '("Hypertension"[MeSH Terms] OR blood pressure[Title/Abstract]) AND diabetes[Title/Abstract]',
  '"War AND Peace"[Title/Abstract]',
  'Health Personnel AND ("Burnout, Professional"[MeSH Terms] OR stress[Title/Abstract])',
  'heart and lung diseases', 'diabetes NOT pregnancy',
];
for (const query of valid) {
  assert.equal(validateSuggestionQuery(query), query);
  assert.equal(queryPreflight(query).terminology, "not-verified");
}
assert.equal(normalizeSuggestionQuery("Burnout, Occupational"), "(Burnout, Occupational)");
console.log("PASS: IA-01 rejects incomplete Boolean syntax without rewriting terms or claiming DeCS verification.");
