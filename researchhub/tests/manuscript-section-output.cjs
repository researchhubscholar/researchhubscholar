const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (module, file) => module._compile(
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, file);
const { manuscriptSectionOutputSchema, verifyManuscriptSectionOutput } =
  require("../lib/ai/manuscript-section-output.ts");
const sections = ["introduction","methods","results","discussion","limitations","conclusion","abstract"];
const item=(targetField)=>({targetField,label:"Draft",content:"Suggested text to be reviewed.",rationale:"Based on saved context",
  source:"Saved protocol",confidence:"alta"});
for(const section of sections){
  const schema=manuscriptSectionOutputSchema(section);
  assert.equal(schema.properties.recommendations.minItems,1);
  assert.equal(schema.properties.recommendations.maxItems,1);
  assert.deepEqual(schema.properties.recommendations.items.properties.targetField.enum,[section]);
  assert.doesNotThrow(()=>verifyManuscriptSectionOutput({recommendations:[item(section)]},section));
  if(section!=="introduction")assert.throws(()=>verifyManuscriptSectionOutput({recommendations:[item("introduction")]},section),/não identificou corretamente/);
  assert.throws(()=>verifyManuscriptSectionOutput({recommendations:[item(section),item(section)]},section),
    /não identificou corretamente/);
}
console.log("PASS: all manuscript section schemas require exactly one correctly targeted recommendation.");
