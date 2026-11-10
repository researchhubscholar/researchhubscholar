const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {formatNumber,formatDate}=require('../lib/i18n/format.ts');
assert.equal(formatNumber(1234.5,'pt-BR'),'1.234,5');
assert.equal(formatNumber(1234.5,'es'),'1,234.5');
assert.equal(formatNumber(NaN,'es'),'—');
assert.equal(formatDate('2026-11-03','pt-BR'),'03/11/2026');
assert.equal(formatDate('2026-11-03','es',{timeZone:'America/Los_Angeles',month:'long'}),'noviembre');
assert.equal(formatDate('2026-11-03','pt-BR',{timeZone:'America/Los_Angeles',day:'numeric'}),'3');
for(const invalid of ['2026-02-30','invalid','03/11/2026',''])assert.equal(formatDate(invalid,'es'),'—');
const {parse,HTMLElement}=require('next/dist/compiled/node-html-parser');
Object.defineProperty(HTMLElement.prototype,'nodeName',{get(){return this.tagName;}});
Object.defineProperty(HTMLElement.prototype,'parentElement',{get(){return this.parentNode?.nodeType===1?this.parentNode:null;}});
Object.defineProperty(HTMLElement.prototype,'children',{get(){return this.childNodes.filter(node=>node.nodeType===1);}});
global.DOMParser=class{parseFromString(html){return{body:parse(html).querySelector('body')};}};
const {wordDocument,htmlWord}=require('../lib/exports/ooxml.ts');
const decode=bytes=>new TextDecoder().decode(bytes);
assert(decode(wordDocument([{text:'Texto original & título <teste>'}],'es')).includes('w:lang w:val="es-ES"'));
assert(decode(wordDocument([])).includes('w:lang w:val="pt-BR"'));
assert(!decode(wordDocument([],'es" injected="1')).includes('injected'));
assert(decode(htmlWord('<html><body><h1>Título original</h1></body></html>','es')).includes('es-ES'));
const {buildCsv}=require('../lib/exports/scientific.ts');
const article={id:'1',title:'Título original, población',authors:['Autor original'],year:2026,journal:'Revista original',readingStatus:'reviewed',tags:[],doi:'10.1/exemplo',pmid:'123'};
const csv=buildCsv([article],{'1':{generalNotes:'Notas originais'}},'es');
assert(csv.includes('"Año"'));assert(csv.includes('"Revista"'));assert(csv.includes('"Título original, población"'));assert(csv.includes('"reviewed"'));assert(csv.includes('"Notas originais"'));
const {manuscriptDocument}=require('../lib/projects/manuscript-export.ts');
const input={title:'Título original',subtitle:'',authors:'Autor',affiliations:'Instituição',keywords:'sono, sueño',sections:[{section_key:'custom',heading:'Cabeçalho editado',content:'Parágrafo original'}],references:['Referência original']};
const before=JSON.stringify(input),doc=decode(manuscriptDocument(input,null,null,'es'));
for(const value of ['Palabras clave:','Referencias','Cabeçalho editado','Parágrafo original','Referência original'])assert(doc.includes(value));
assert.equal(JSON.stringify(input),before);
console.log('PASS: localized date/number formatting, safe Word language, Spanish CSV headings and manuscript labels preserve original research content.');

const scientific=require('../lib/exports/scientific.ts');
const data={project:{title:'Situação',theme:'Tema original',question:'Pergunta original?',objective:'Objetivo original',hypothesis:'',studyType:'Coorte',population:'População original',inclusion:'',exclusion:'',outcome:'Desfecho original',variables:'',methods:'Método original',analysis:'',ethics:'',manuscript:'',status:'planning',progress:75.5,updatedAt:'2026-11-03T12:00:00Z'},profile:{name:'Nome original',institution:'Hospital original'},articles:[article],notes:{'1':{generalNotes:'Nota original'}},milestones:[{label:'Etapa personalizada',status:'blocked',note:'Pendência original',dueDate:'2026-11-04'}],generatedAt:'2026-11-03T12:00:00Z'};
const original=JSON.stringify(data);
for(const fn of ['buildStructuredProtocol','buildProjectSummary','buildAdvisorReport']) {
 const html=scientific[fn](data,'es');assert(html.includes('lang="es"'));assert(html.includes('<h1>Situação</h1>'));assert(html.includes('Pergunta original?'));assert(html.includes('Nome original'));assert(html.includes('documento de apoyo'));assert(!html.includes('${esc('));
}
assert(scientific.buildStructuredProtocol(data,'es').includes('Fundamentación y pregunta'));
assert(scientific.buildProjectSummary(data,'es').includes('75.5%'));
assert(scientific.buildAdvisorReport(data,'es').includes('Etapa personalizada'));
const matrix=scientific.buildProjectMatrixRows(data,'es');assert.equal(matrix[0][0],'Proyecto');assert.equal(matrix[0][3],'Año');assert.equal(matrix[1][0],'Situação');assert.equal(matrix[1][8],'reviewed');
assert.equal(JSON.stringify(data),original);
console.log('PASS: Spanish protocol, summary, advisor report and matrix preserve user text, notes, reference data and enum values.');

const draftSections = [
  { title: 'Tema e pergunta', fields: [{ label: 'Tema do trabalho', value: 'Original research title' }] },
  { title: 'Objetivo e hipótese', fields: [{ label: 'Hipótese ou pressuposto (quando aplicável)', value: 'Texto original em português' }] },
  { title: 'Desenho e população', fields: [] },
  { title: 'Desfechos e variáveis', fields: [{ label: 'Variáveis e formas de medir', value: '' }] },
  { title: 'Métodos, análise e ética', fields: [{ label: 'Procedimentos e coleta de dados', value: 'Original methods' }] },
  { title: 'Planejamento do manuscrito', fields: [{ label: 'Plano e notas do manuscrito', value: '' }] },
];
const draft = decode(htmlWord(scientific.buildProtocolDoc('Título original', draftSections, 'es'), 'es'));
for (const heading of ['Tema y pregunta','Objetivo e hipótesis','Diseño y población','Desenlaces y variables','Métodos, análisis y ética','Planificación del manuscrito']) assert(draft.includes(heading), heading);
for (const text of ['Tema del trabajo: Original research title','Hipótesis o supuesto (cuando corresponda): Texto original em português','Variables y formas de medición: Por definir','Procedimientos y recolección de datos: Original methods','Plan y notas del manuscrito: Por definir']) assert(draft.includes(text), text);

const oldBrief = 'PROPOSTA PARA DISCUSSÃO COM O ORIENTADOR\nOriginal research title\n\nPERGUNTA\nOriginal research question\n\nDESENHO\nCross-sectional study';
const briefSections = [{title:'Planejamento do manuscrito', fields:[{label:'Plano e notas do manuscrito',value:oldBrief}]}];
const briefDoc = decode(htmlWord(scientific.buildProtocolDoc('Original',briefSections,'es'),'es'));
for (const text of ['PROPUESTA PARA DISCUTIR CON EL TUTOR','PREGUNTA','DISEÑO','Original research question','Cross-sectional study']) assert(briefDoc.includes(text), text);
assert(!briefDoc.includes('PERGUNTA'));
assert(scientific.buildStructuredProtocol({...data,project:{...data.project,manuscript:oldBrief}},'es').includes('PROPUESTA PARA DISCUTIR CON EL TUTOR'));
assert(scientific.buildProtocolDoc('Original',briefSections,'pt-BR').includes('PERGUNTA'));
assert(scientific.buildProtocolDoc('Original',[{title:'Planejamento do manuscrito',fields:[{label:'Plano e notas do manuscrito',value:'Nota livre\n\nPERGUNTA'}]}],'es').includes('PERGUNTA'));

const guidanceBrief = oldBrief + '\n\nDECISÕES PENDENTES\n• Estime quantos participantes ou registros são acessíveis; isso ainda não é cálculo amostral.\n• Exigências informadas do curso ou serviço: Manter minha anotação em português.\n\nPLANO DE EXECUÇÃO\n1. Síntese: relacionar resultados, qualidade e limitações, redigir e revisar o manuscrito.\n2. Revisar meu texto original.';
const guidanceDoc = decode(htmlWord(scientific.buildProtocolDoc('Original',[{title:'Planejamento do manuscrito',fields:[{label:'Plano e notas do manuscrito',value:guidanceBrief}]}],'es'),'es'));
for (const phrase of ['Estima a cuántos participantes','Requisitos indicados por el curso o servicio: Manter minha anotação em português.','1. Síntesis: relacionar los resultados','2. Revisar meu texto original.']) assert(guidanceDoc.includes(phrase),phrase);
assert(!guidanceDoc.includes('isso ainda não é cálculo amostral'));
