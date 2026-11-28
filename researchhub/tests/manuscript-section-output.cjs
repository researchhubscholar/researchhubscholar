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

const { manuscriptNativeOutputSchema, normalizeManuscriptNativeOutput, usesManuscriptNativeOutput } =
  require("../lib/ai/manuscript-native-output.ts");
const { verifyDraftCitationAnchors } = require("../lib/ai/manuscript-draft-citations.ts");
const manifest = { anchors: [{ id: "S1", kind: "abstract", quote: "Follow-up data were available." }] };
const schemas = [
  ["draft_compose", "source", "object", manifest],
  ["evidence_batch", "content", "array", [{ label: "S1", relevance: 0, finding: "", kind: "none", quote: "" }]],
  ["coherence_review", "content", "object", { overview: "Review the saved protocol.", findings: [] }],
];
for (const [task, field, type, value] of schemas) {
  const schema = manuscriptNativeOutputSchema(manuscriptSectionOutputSchema(base, "discussion"), task);
  assert.equal(schema.properties.recommendations.items.properties[field].type, type);
  assert.deepEqual(schema.properties.recommendations.items.properties.targetField.enum, ["discussion"]);
  const output = normalizeManuscriptNativeOutput({ recommendations: [{ ...item("discussion"), [field]: value }] }, task);
  assert.deepEqual(JSON.parse(output.recommendations[0][field]), value);
}
const draft = normalizeManuscriptNativeOutput({ recommendations: [{ ...item("discussion"), source: manifest }] }, "draft_compose");
assert.doesNotThrow(() => verifyDraftCitationAnchors("Follow-up was reported [S1].", draft.recommendations[0].source, [
  { label: "S1", abstract: "Follow-up data were available.", fullTextExcerpt: "" },
]));
assert.throws(() => verifyDraftCitationAnchors("Follow-up was reported [S1].", draft.recommendations[0].source, [
  { label: "S1", abstract: "No follow-up was reported.", fullTextExcerpt: "" },
]), /não consta da fonte/);
assert.equal(usesManuscriptNativeOutput("section_draft"), true);
assert.equal(usesManuscriptNativeOutput("revise"), false);
assert.strictEqual(manuscriptNativeOutputSchema(base, "revise"), base);
console.log("PASS: native manuscript schemas preserve target fields and citation checks.");
