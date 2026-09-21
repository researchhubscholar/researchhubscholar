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
console.log("journey/profile contracts ok");
