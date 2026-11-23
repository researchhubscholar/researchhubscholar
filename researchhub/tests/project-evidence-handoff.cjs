const assert=require("node:assert/strict"),fs=require("node:fs"),ts=require("typescript");
require.extensions[".ts"]=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {buildEvidenceMatrixPreview}=require("../lib/literature/evidence-matrix-preview.ts");
const {prepareProjectEvidenceHandoff}=require("../lib/literature/project-evidence-handoff.ts");
const source={articleId:"pmid:123",title:"Trial on sleep",pmid:"123",doi:"10.1000/sleep",
 publicationTypes:["Randomized Controlled Trial"],
 abstract:"METHODS: We enrolled 120 patients in the intervention group. RESULTS: After 12 weeks, adjusted OR 1.5 was reported."};
const sources=[source];
const row=buildEvidenceMatrixPreview(sources).rows[0];
assert(row.cells.length>0);
const cell=row.cells[0];
const review={articleId:source.articleId,cellIndex:0,expectedExcerpt:cell.excerpt,expectedMatchedText:cell.matchedText,action:"accept_quote",reviewerConfirmed:true};
const choice={articleId:source.articleId,cellIndex:0,destination:"discussion_evidence",destinationConfirmed:true};
const ready=prepareProjectEvidenceHandoff("project-a",sources,[review],[choice]);
assert.equal(ready.status,"requires_final_confirmation");
assert.equal(ready.drafts.length,1);
assert.equal(ready.drafts[0].citation.pmid,"123");
assert.equal(ready.drafts[0].classification,"published_literature");
assert.equal(ready.drafts[0].saveStatus,"preview_only");
assert.equal(ready.drafts[0].scientificInterpretationVerified,false);
assert.equal(ready.drafts[0].projectDataResult,false);
assert.equal(ready.storageMutationPerformed,false);
assert.equal(ready.manuscriptMutationPerformed,false);
assert.equal(ready.originalResultsMutationPerformed,false);
assert.equal(ready.blocked.length,0);
const missingReview=prepareProjectEvidenceHandoff("project-a",sources,[],[choice]);
assert.equal(missingReview.drafts.length,0);assert.equal(missingReview.blocked.length,1);
const rejected=prepareProjectEvidenceHandoff("project-a",sources,[{...review,action:"reject_quote"}],[choice]);
assert.equal(rejected.drafts.length,0);
const tampered=prepareProjectEvidenceHandoff("project-a",sources,[{...review,expectedExcerpt:"Fictitious evidence"}],[choice]);
assert.equal(tampered.drafts.length,0);
const alteredAbstract=prepareProjectEvidenceHandoff("project-a",[{...source,abstract:"Different abstract text here."}],[review],[choice]);
assert.equal(alteredAbstract.drafts.length,0);
const invalidDestination=prepareProjectEvidenceHandoff("project-a",sources,[review],[{...choice,destination:"original_results"}]);
assert.equal(invalidDestination.drafts.length,0);assert.equal(invalidDestination.blocked.length,1);
const unconfirmedDestination=prepareProjectEvidenceHandoff("project-a",sources,[review],[{...choice,destinationConfirmed:false}]);
assert.equal(unconfirmedDestination.drafts.length,0);
const duplicate=prepareProjectEvidenceHandoff("project-a",sources,[review],[choice,choice]);
assert.equal(duplicate.drafts.length,1);assert.equal(duplicate.blocked.length,1);
const noSelection=prepareProjectEvidenceHandoff("project-a",sources,[review],[]);
assert.equal(noSelection.drafts.length,0);
assert.throws(()=>prepareProjectEvidenceHandoff("../other",sources,[review],[choice]),/Projeto/);
assert.throws(()=>prepareProjectEvidenceHandoff("project-a",sources,[review],Array(61).fill(choice)),/60/);
console.log("PASS: IA-09 reviewed-only literature handoff, tamper resistance, forbidden original results, double confirmation and no persistence.");

const {insertReviewedEvidence}=require("../lib/projects/manuscript-evidence.ts");
const {formattedCitedReferences}=require("../lib/projects/references.ts");
const {manuscriptDocument}=require("../lib/projects/manuscript-export.ts");
const study={...source,id:source.articleId,authors:["Silva A"],publication_year:2025,journal:"Revista de Demonstração"};
const prior={...study,id:"prior",title:"Referência anterior",doi:null,pmid:"456"};
const original=[
  {section_key:"introduction",heading:"Introdução",content:"Contexto já escrito [1]."},
  {section_key:"discussion",heading:"Discussão",content:"Discussão já escrita."},
  {section_key:"references",heading:"Referências",content:""},
];
const label=(_,number)=>`[${number}]`;
const insert=(drafts,sections=original,ids=["prior"])=>insertReviewedEvidence("project-a",sections,ids,[study,prior],drafts,label);
const inserted=insert(ready.drafts);
assert.deepEqual(inserted.citationIds,["prior",study.id]);
assert.equal(inserted.sections[0].content,original[0].content);
assert.equal(inserted.sections[1].content,`Discussão já escrita.\n\n“${ready.drafts[0].quote}” [2]`);
assert.deepEqual(insert(ready.drafts,inserted.sections,inserted.citationIds),inserted);
assert.equal(insert([...ready.drafts,{...ready.drafts[0],quote:"Trecho adulterado"}]),null);
assert.equal(original[1].content,"Discussão já escrita.");
const introductory=prepareProjectEvidenceHandoff("project-a",sources,[review],[{...choice,destination:"introduction_background"}]);
assert.match(insert(introductory.drafts).sections[0].content,/Contexto já escrito \[1\]\.[\s\S]*\[2\]/);
const references=formattedCitedReferences(inserted.citationIds,[study,prior],"vancouver");
const bytes=manuscriptDocument({title:"Revisão de demonstração",subtitle:"",authors:"",affiliations:"",keywords:"",sections:inserted.sections,references},null);
const archive=new TextDecoder().decode(bytes);
const documentXml=archive.match(/<w:document\b[\s\S]*?<\/w:document>/)[0];
assert(documentXml.includes("Contexto já escrito [1]."));
assert(documentXml.includes("Discussão já escrita."));
assert(documentXml.includes(`“${ready.drafts[0].quote}” [2]`));
assert(documentXml.includes("2. Silva A. Trial on sleep."));
assert(documentXml.includes("https://doi.org/10.1000/sleep"));
console.log("PASS: reviewed matrix evidence is appended to the selected manuscript section and reaches DOCX with its matching reference.");
