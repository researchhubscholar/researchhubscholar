const assert=require("node:assert/strict");
const fs=require("node:fs"),ts=require("typescript");
require.extensions[".ts"]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText,file);
const {buildManuscriptAuditSource,auditSourceHasMaterial,assertManuscriptAuditPrivacy,
  manuscriptAuditResponseSchema,validateManuscriptAuditContent,manuscriptAuditPreparation,
  reviewManuscriptAuditContent,auditSectionExcerpt}=
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
assert.throws(()=>buildManuscriptAuditSource(project,[
 {section_key:"results",content:"The participant with identifier 123.456.789-09 was assessed."}
]),/dados pessoais/);
const partial=reviewManuscriptAuditContent(JSON.stringify({
  overview:"O manuscrito necessita de revisão em pontos específicos com suporte verificável.",
  findings:[finding,changed,finding]
}),source);
assert.equal(partial.audit.findings.length,1);
assert.equal(partial.rejected,2);
assert.equal(partial.received,3);
const invalidOnly=reviewManuscriptAuditContent(JSON.stringify({
  overview:"Os apontamentos não puderam ser validados com os trechos registrados.",
  findings:[changed]
}),source);
assert.equal(invalidOnly.audit.findings.length,0);
assert.equal(invalidOnly.rejected,1);
const textLong="INTRO:"+("A".repeat(900))+" CENTRAL:"+("B".repeat(1100))+" FINAL:"+("C".repeat(900));
const sampled=auditSectionExcerpt(textLong);
assert(sampled.length<=1700);
assert(sampled.includes("INTRO:") && sampled.includes("CCCCCCCCCCCCCCCC"));
assert(sampled.includes("CENTRAL:")||sampled.includes("BBBBBBBBBBBB"));
const focusRows=[
 {section_key:"results",content:"RESULTS:"+("R".repeat(5000))},
 {section_key:"discussion",content:"DISCUSSION:"+("D".repeat(1600))}
];
const focused=buildManuscriptAuditSource(project,focusRows,"results");
assert.equal(focused.focus,"results");
assert(focused.sections.results.length<=4000);
assert(focused.sections.results.length>1700);
assert(focused.sections.discussion.length<=700);
assert(focused.truncatedSections.includes("results"));
assert(focused.truncatedSections.includes("discussion"));
assert.equal(manuscriptAuditPreparation(focused).focus,"results");
const unsafe="A".repeat(1600)+" 111.222.333-44";
assert.throws(()=>buildManuscriptAuditSource(project,[
  {section_key:"methods",content:unsafe}
]),/dados pessoais/);
console.log("PASS: grounded manuscript coherence findings; no fabricated citations, unauthorized fields or obvious personal identifiers.");
