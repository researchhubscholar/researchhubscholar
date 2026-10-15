require("typescript");
const fs = require("fs");
const vm = require("vm");
function load(file, names) {
  let source = fs.readFileSync(file, "utf8")
    .replace(/export type[\s\S]*?};\n/g, "")
    .replace(/export function /g, "function ")
    .replace(/: [A-Za-z][A-Za-z0-9<>, \[\]\|?]*/g, "")
    .replace(/ as const/g, "");
  source += `\nmodule.exports={${names.join(",")}}`;
  const sandbox = { module: { exports: {} }, exports: {}, Date };
  vm.runInNewContext(source, sandbox);
  return sandbox.module.exports;
}
const journeySource = fs.readFileSync("lib/research/journey-templates.ts", "utf8");
if (!journeySource.includes('label: "Busca e seleção"') || !journeySource.includes('label: "Documentação do caso"')) throw new Error("Templates específicos ausentes");
const diagnosisSource = fs.readFileSync("lib/research/profile-diagnosis.ts", "utf8");
if (!diagnosisSource.includes("buildProfileDiagnosis") || !diagnosisSource.includes("project_deadline")) throw new Error("Diagnóstico de perfil ausente");
const creationSource = fs.readFileSync("lib/projects/creation.ts", "utf8");
if (!creationSource.includes("diagnoseProjectDraft") || !creationSource.includes("initialProjectMilestones") || !creationSource.includes("projectOriginRow")) throw new Error("Criação rastreável do projeto ausente");
console.log("journey/profile contracts ok");

const assert = require("node:assert/strict");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { projectNextStep, registeredSteps } = require("../lib/research/project-next-step.ts");
const complete = {theme:"Sono na residência",question:"Qual a frequência?",objective:"Estimar frequência",population:"Residentes",outcome:"Qualidade do sono",studyType:"Observacional transversal",inclusion:"Adultos",exclusion:"Dados incompletos",variables:"Escore validado",methods:"Questionário",analysis:"Descrição",ethics:"Submeter ao CEP"};
const activity={references:3,searches:1,manuscriptStarted:false};
const done=(...keys)=>keys.map(key=>({key,status:"done",note:"",dueDate:""}));
assert.equal(projectNextStep({},activity,[]).anchor,"pergunta");
assert.equal(projectNextStep({...complete,objective:"A definir"},activity,[]).anchor,"objetivos");
assert.equal(projectNextStep(complete,{...activity,references:0},[]).destination,"radar");
assert.equal(projectNextStep(complete,{...activity,references:null},[]).destination,"radar");
// A populated ethics field is never treated as approval, and a plan is not completed analysis.
assert.equal(projectNextStep(complete,activity,[]).milestone,"ethics");
assert.equal(projectNextStep(complete,activity,done("ethics")).milestone,"collection");
assert.equal(projectNextStep(complete,activity,done("ethics","collection")).milestone,"analysis");
assert.equal(projectNextStep(complete,activity,done("ethics","collection","analysis")).destination,"manuscript");
assert.equal(projectNextStep(complete,{...activity,manuscriptStarted:true},done("ethics","collection","analysis")).milestone,"submission");
assert.equal(projectNextStep(complete,{...activity,manuscriptStarted:true},done("ethics","collection","analysis","submission")).destination,"documents");
const blocked=[{key:"design",status:"blocked",note:"Validar critérios com orientador",dueDate:"2026-11-01"}];const snapshot=JSON.stringify(blocked);
assert.equal(projectNextStep(complete,activity,blocked).description,blocked[0].note);assert.equal(JSON.stringify(blocked),snapshot);
const signals=registeredSteps(complete,activity);assert.equal(signals.theme,true);assert.equal(signals.design,true);assert.equal(signals.writing,false);assert(!("ethics" in signals));assert.equal(registeredSteps(complete,{references:null,searches:null,manuscriptStarted:null}).literature,null);
console.log("PASS: contextual next step, recorded fields, unknown data, explicit ethics/collection/analysis/submission and non-mutating saved milestones.");
