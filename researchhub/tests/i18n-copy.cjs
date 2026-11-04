const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {localizeInterfaceCopy,dialogCopy}=require('../lib/i18n/interface-copy.ts');
const templates=require('../lib/i18n/message-templates.json');
assert.equal(localizeInterfaceCopy('es','Salvar projeto'),'Guardar proyecto');
assert.equal(localizeInterfaceCopy('es','Valor numérico inválido em Peso (kg).'),'Valor numérico inválido en Peso (kg).');
assert.equal(localizeInterfaceCopy('es','2 artigos aguardam leitura ou avaliação na biblioteca.'),'2 artículos pendientes de lectura o evaluación en la biblioteca.');
assert.equal(localizeInterfaceCopy('es','1 artigo aguarda leitura ou avaliação na biblioteca.'),'1 artículo pendiente de lectura o evaluación en la biblioteca.');
const raw='Minha pergunta científica livre sobre População: <script>{0}$&';
assert.equal(localizeInterfaceCopy('es',raw),raw);assert.equal(localizeInterfaceCopy('pt-BR','Salvar projeto'),'Salvar projeto');
const articleTitle='População e desfechos {0}$&';
assert.equal(localizeInterfaceCopy('es',`Projeto do artigo ${articleTitle}`),`Proyecto del artículo ${articleTitle}`);
const {matrixGuidance}=require('../lib/literature/matrix-template.ts');
for(const design of ['systematic-review','clinical-trial','cohort','case-control','cross-sectional','qualitative','case-report','other']){
 const guidance=matrixGuidance(design);
 assert.notEqual(localizeInterfaceCopy('es',guidance),guidance,design);
}
const injected='Peso <script>{0}$&';assert.equal(localizeInterfaceCopy('es',`Valor numérico inválido em ${injected}.`),`Valor numérico inválido en ${injected}.`);
for(const [source,target] of Object.entries(templates)){const allowed=new Set(source.match(/\{\d+\}/g)||[]);for(const token of target.match(/\{\d+\}/g)||[])assert.ok(allowed.has(token),`Unexpected variable ${token}`);}
global.document={documentElement:{lang:'es'}};assert.equal(dialogCopy('Remover este artigo e suas anotações da sua conta?'),'¿Eliminar este artículo y sus notas de tu cuenta?');document.documentElement.lang='pt-BR';assert.equal(dialogCopy('Remover este artigo e suas anotações da sua conta?'),'Remover este artigo e suas anotações da sua conta?');delete global.document;
console.log('PASS: Spanish authored notices/dialogs, singular/plural, unchanged unknown/research text and literal interpolation of user values.');
