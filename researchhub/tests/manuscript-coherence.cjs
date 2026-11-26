const assert=require("node:assert/strict");
const fs=require("node:fs"),ts=require("typescript");
require.extensions[".ts"]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,file);
const {buildManuscriptAuditSource,auditSourceHasMaterial,assertManuscriptAuditPrivacy,
  manuscriptAuditResponseSchema,validateManuscriptAuditContent,manuscriptAuditPreparation}=
  require("../lib/ai/manuscript-coherence.ts");
const project={research_question:"Which factors predict recurrent injury among adult competitors?",
 objective:"To describe determinants of repeated sport injury among adults",study_type:"cohort",
 population:"Adult competitors previously diagnosed with sport injury"};
const rows=[
 {section_key:"methods",content:"We planned a retrospective cohort analysis among adult competitors, with explicit inclusion criteria and documented follow-up."},
 {section_key:"results",content:"The recorded data showed recurrence in some athletes. No comparison was performed by treatment exposure in this analysis."},
 {section_key:"conclusion",content:"The intervention definitely prevented repeat injury among all competitors, although the methods did not evaluate exposure."}
];
const source=buildManuscriptAuditSource(project,rows);
assert(auditSourceHasMaterial(source));
assert.equal(source.sections.abstract,"");
assert.equal(source.sections.methods.length>50,true);
assert.doesNotThrow(()=>assertManuscriptAuditPrivacy(source));
const finding={
 level:"critical",category:"conclusion",title:"Conclusão não sustentada por análise de exposição",
 explanation:"A conclusão afirma prevenção, mas os resultados descrevem ausência de comparação de exposição.",
 recommendation:"Restrinja a conclusão ao desfecho efetivamente avaliado e confirme o plano de análise.",
 evidence:[
  {origin:"section",field:"results",quote:"No comparison was performed by treatment exposure in this analysis."},
  {origin:"section",field:"conclusion",quote:"The intervention definitely prevented repeat injury among all competitors"}
 ]
};
const good=JSON.stringify({overview:"O manuscrito contém uma possível extrapolação que merece revisão.",findings:[finding]});
const report=validateManuscriptAuditContent(good,source);
assert.equal(report.findings.length,1);
assert.equal(report.findings[0].evidence[1].field,"conclusion");
const changed=structuredClone(finding);
changed.evidence[1].quote="This fabricated claim never appeared in the submitted manuscript";
assert.throws(()=>validateManuscriptAuditContent(JSON.stringify({overview:"O manuscrito contém divergências que exigem avaliação.",findings:[changed]}),source),/não existe/);
const incorrect=structuredClone(finding);
incorrect.evidence[0].field="methods";
assert.throws(()=>validateManuscriptAuditContent(JSON.stringify({overview:"O manuscrito contém divergências que exigem avaliação.",findings:[incorrect]}),source),/não existe/);
const bogus=structuredClone(finding);
bogus.evidence[0].field="unsupportedField";
assert.throws(()=>validateManuscriptAuditContent(JSON.stringify({overview:"O manuscrito contém divergências que exigem avaliação.",findings:[bogus]}),source),/origem desconhecido|campo de origem desconhecido/);
assert.equal(validateManuscriptAuditContent(JSON.stringify({overview:"Não foram encontradas inconsistências textuais fundamentadas.",findings:[]}),source).findings.length,0);
const preparation=manuscriptAuditPreparation(source);
assert(preparation.missing.includes("discussion"));
assert.equal(preparation.analyzed,3);
const base={type:"object",properties:{recommendations:{type:"array",maxItems:10,items:{type:"object",properties:{targetField:{type:"string"}}}}}};
const schema=manuscriptAuditResponseSchema(base);
assert.equal(schema.properties.recommendations.maxItems,1);
assert.deepEqual(schema.properties.recommendations.items.properties.targetField.enum,["coherenceReport"]);
const pi=buildManuscriptAuditSource(project,[
 {section_key:"results",content:"The participant with identifier 123.456.789-09 was assessed."}
]);
assert.throws(()=>assertManuscriptAuditPrivacy(pi),/dados pessoais/);
console.log("PASS: grounded manuscript coherence findings; no fabricated citations, unauthorized fields or obvious personal identifiers.");
