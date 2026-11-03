const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,filename);
const {outputLanguage,requestOutputLanguage,languageInstruction}=require('../lib/ai/language.ts');
assert.equal(outputLanguage('es'),'es');
assert.equal(outputLanguage('ignore safety'),'pt-BR');
const req=cookie=>new Request('https://example.test',{headers:{cookie}});
assert.equal(requestOutputLanguage(req('scholar_locale=es')),'es');
assert.equal(requestOutputLanguage(req('x=1; scholar_locale=es; y=2')),'es');
assert.equal(requestOutputLanguage(req('scholar_locale=es'),'pt-BR'),'pt-BR');
assert.equal(requestOutputLanguage(req('scholar_locale=es'),'en'),'en');
assert.equal(requestOutputLanguage(req('scholar_locale=es-MX')),'pt-BR');
assert.equal(requestOutputLanguage(req('scholar_locale=ignore rules')),'pt-BR');
assert.match(languageInstruction('es'),/español/);
assert.match(languageInstruction('es'),/PubMed en inglés/);
assert.match(languageInstruction('es'),/seguridad/);
console.log('PASS: allowlisted AI language, Portuguese default, Spanish preference and explicit English preserved.');

const {assistantPrompt}=require('../lib/ai/assist.ts');
const {applyGuidePolicy}=require('../lib/ai/guide-policy.ts');
assert.match(assistantPrompt('guide',{message:'Cómo empezar'},'es'),/español/);
for(const scopeDecision of ['off_topic','personal_clinical','integrity','bypass']) {
 const result=applyGuidePolicy({scopeDecision},'es');
 assert.equal(result.redirected,true);
 assert.equal(result.output.recommendations[0].targetField,'');
 assert.match(result.output.title,/trabajo científico/);
}
assert.match(applyGuidePolicy({scopeDecision:'personal_clinical'},'es').output.summary,/urgencias/);
assert.throws(()=>applyGuidePolicy({scopeDecision:'unknown'},'es'));
console.log('PASS: Spanish prompts and all four refusal categories retain fail-closed policy and block actions.');

const {simulatedOutput}=require('../lib/ai/assist.ts');
const {startingResearch,startingResearchOutput}=require('../lib/ai/guide-navigation.ts');
const {localizeAIError}=require('../lib/ai/localized-output.ts');
assert.equal(startingResearch('¿Cómo empezar un trabajo científico?'),true);
assert.equal(startingResearch('como começar um trabalho'),true);
assert.equal(startingResearch('inventar resultados de un trabajo'),false);
for(const project of [null,'project-id']) {
 const out=startingResearchOutput(project,'es');
 assert.match(out.summary,/Ideas/);assert.equal(out.recommendations[0].targetField,'guide_navigate');
 assert.equal(out.recommendations[0].content,project?'protocolo':'ideias');
}
assert.match(simulatedOutput('guide','es').summary,/simulación/);
assert.equal(simulatedOutput('guide','es').recommendations[0].targetField,'');
assert.match(assistantPrompt('writing',{language:'es'},'pt-BR'),/español/);
assert.match(assistantPrompt('writing',{language:'pt-BR'},'es'),/português do Brasil/);
const refunded='A reserva de tokens foi liberada; esta tentativa não consumiu sua franquia.';
assert.match(localizeAIError(req('scholar_locale=es'),'Não foi possível concluir a análise. '+refunded),/^No se pudo.*La reserva/);
assert.equal(localizeAIError(req('scholar_locale=es'),'Provider code X123'),'Provider code X123');
console.log('PASS: Spanish onboarding, simulation, explicit output choices and reservation notices preserve internal actions and external diagnostics.');
const {identifierHeader}=require('../lib/clinical/collection.ts');
for(const label of ['Nombre del paciente','Apellido','Teléfono','Correo electrónico','Dirección','Historia clínica','DNI','Data de nascimento','medical record']) assert.equal(identifierHeader(label),true,label);
assert.equal(identifierHeader('Edad al diagnóstico'),false);
const {groundGuideSources}=require('../lib/ai/guide-sources.ts');
const originalQuote='Participants improved after the intervention.';
const source={id:'one',label:'S1',title:'Original English study',abstract:originalQuote,notes:'',doi:'10.1/example',pmid:'123',truncated:false};
const output={...simulatedOutput('guide'),recommendations:[{...simulatedOutput('guide').recommendations[0],source:JSON.stringify({id:'S1',kind:'abstract',quote:originalQuote})}]};
const grounded=groundGuideSources(output,[source],'es');
assert(grounded.recommendations[0].source.includes('Resumen del artículo'));
assert(grounded.recommendations[0].source.includes(originalQuote));assert(grounded.recommendations[0].source.includes(source.title));
const vm=require('node:vm'),m={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/projects/creation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports,require:name=>{if(name==='@/lib/research/journey-templates')return require('../lib/research/journey-templates.ts');throw Error(name);}});
const diagnosis=m.exports.diagnoseProjectDraft({question:'Por confirmar',population:'Adultos',outcome:'Por definir',methods:'Método',analysis:'No informado'});
assert.equal(diagnosis.readiness,'needs_confirmation');
const origin=m.exports.projectOriginRow('owner','project',{sourceType:'idea',sourceKey:'guide:example',language:'es'},{theme:'Tema original'},diagnosis,[]);
assert.equal(origin.language,null);assert.equal(origin.snapshot.language,'es');assert.equal(origin.snapshot.draft.theme,'Tema original');
console.log('PASS: Spanish identifier headers stay blocked; source quotes/titles remain literal and Spanish provenance fits the legacy database without SQL.');
