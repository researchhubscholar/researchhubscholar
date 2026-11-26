const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (module, file) => module._compile(
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, file);
const {sectionDraftRequirements,validateProseDraft,cleanSavedDraftSections,missingAbstractSections,markProvisionalAbstract} =
  require("../lib/ai/manuscript-section-rules.ts");
const project={research_question:"What predicts recurrence?",objective:"Identify recurrence determinants",study_type:"cohort",methods:"Planned retrospective analysis"};
const saved={introduction:"This scientific introduction has been revised and saved by the author, with sufficient context about the research question and its aims.",
  methods:"The methods section was saved by the author with details about the design, population and statistical analysis.",
  results:"Among 90 participants, 20 reported recurrence (22.2%). The author recorded these observations from the dataset, pending scientific review.",
  discussion:"The discussion interprets the recorded findings and relates them to published scientific work, while acknowledging the limitations.",
  conclusion:"The conclusion addresses the research objective based on the observed outcomes in the analysis."};
assert.deepEqual(sectionDraftRequirements("methods",project,{}),[]);
assert(sectionDraftRequirements("methods",{...project,methods:""},{}).length>0);
assert(sectionDraftRequirements("discussion",project,{results:"no data"}).length>0);
assert.equal(sectionDraftRequirements("discussion",project,saved).length,0);
assert.equal(sectionDraftRequirements("abstract",project,saved).length,0);
assert.equal(sectionDraftRequirements("abstract",project,{...saved,discussion:""}).length,0);
assert.deepEqual(missingAbstractSections({...saved,discussion:""}),["discussion"]);
const provisional=markProvisionalAbstract("Objective, methods and recorded findings.",["discussion","conclusion"],"en");
assert(provisional.startsWith("PROVISIONAL ABSTRACT"));
assert(provisional.includes("[Discussion pending]")&&provisional.includes("[Conclusion pending]"));
assert.equal(markProvisionalAbstract("Final text.",[]),"Final text.");
validateProseDraft("results","Desfecho da amostra: [A preencher].",{},project);
assert.throws(()=>validateProseDraft("results","90 participantes tiveram recorrência.",{},project),/campos a preencher/);
validateProseDraft("results","Foram avaliados 90 participantes; houve 20 recorrências (22.2%).",saved,project);
assert.throws(()=>validateProseDraft("results","Foram avaliados 95 participantes; houve 20 recorrências.",saved,project),/números/);
assert.throws(()=>validateProseDraft("conclusion","A redução foi de 32%.",saved,project),/números/);
assert.throws(()=>validateProseDraft("abstract","Sintetizamos os estudos [S1].",saved,project),/citações/);
validateProseDraft("results","A média observada foi de 37.5.",{},project,"{\"mean\":37.5}");
assert.throws(()=>validateProseDraft("results","A média observada foi de 38.5.",{},project,"{\"mean\":37.5}"),/números/);
const cleaned=cleanSavedDraftSections([{section_key:"results",content:"observações"},{"section_key":"secret",content:"private"}]);
assert.equal(cleaned.results,"observações");
assert.equal(cleaned.secret,undefined);
console.log("PASS: section gates, results skeleton and evidence-number guardrails.");
