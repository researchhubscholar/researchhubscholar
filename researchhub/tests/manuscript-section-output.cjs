const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (module, file) => module._compile(
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, file);
const { manuscriptSectionOutputSchema, manuscriptWritingSectionSchema, verifyManuscriptSectionOutput } =
  require("../lib/ai/manuscript-section-output.ts");
const sections = ["introduction","methods","results","discussion","limitations","conclusion","abstract"];
const item=(targetField)=>({targetField,label:"Draft",content:"Suggested text to be reviewed.",rationale:"Based on saved context",
  source:"Saved protocol",confidence:"alta"});
for(const section of sections){
  const fixture={type:"object",properties:{recommendations:{type:"array",minItems:1,maxItems:10,items:{type:"object",properties:{targetField:{type:"string"}}}}}};
  const schema=manuscriptSectionOutputSchema(fixture,section);
  assert.equal(schema.properties.recommendations.minItems,1);
  assert.equal(schema.properties.recommendations.maxItems,1);
  assert.deepEqual(schema.properties.recommendations.items.properties.targetField.enum,[section]);
  for(const task of ["structure","revise","improve","section_draft","evidence_batch","draft_compose"]){
    const selected=manuscriptWritingSectionSchema(fixture,"writing",{sectionKey:section,task});
    assert.deepEqual(selected.properties.recommendations.items.properties.targetField.enum,[section]);
    assert.equal(selected.properties.recommendations.maxItems,1);
  }
  assert.doesNotThrow(()=>verifyManuscriptSectionOutput({recommendations:[item(section)]},section));
  if(section!=="introduction")assert.throws(()=>verifyManuscriptSectionOutput({recommendations:[item("introduction")]},section),/não identificou corretamente/);
  assert.throws(()=>verifyManuscriptSectionOutput({recommendations:[item(section),item(section)]},section),
    /não identificou corretamente/);
}
const base={type:"object",properties:{recommendations:{type:"array",items:{type:"object",properties:{targetField:{type:"string"}}}}}};
assert.strictEqual(manuscriptWritingSectionSchema(base,"radar",{sectionKey:"methods"}),base);
assert.strictEqual(manuscriptWritingSectionSchema(base,"writing",{sectionKey:"references"}),base);
console.log("PASS: seven sections and six writing actions require exactly one correctly targeted recommendation.");
