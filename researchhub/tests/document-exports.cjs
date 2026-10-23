const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm'),ts=require('typescript');
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
require.extensions['.ts']=(module,filename)=>module._compile(compile(filename),filename);
// Use Next's installed HTML parser for a real tree rather than matching HTML strings.
const {parse,HTMLElement}=require('next/dist/compiled/node-html-parser');
Object.defineProperty(HTMLElement.prototype,'nodeName',{get(){return this.tagName;}});
Object.defineProperty(HTMLElement.prototype,'parentElement',{get(){return this.parentNode?.nodeType===1?this.parentNode:null;}});
Object.defineProperty(HTMLElement.prototype,'children',{get(){return this.childNodes.filter(node=>node.nodeType===1);}});
global.DOMParser=class{parseFromString(html){return{body:parse(html).querySelector('body')};}};
const scientific=require('../lib/exports/scientific.ts'),ooxml=require('../lib/exports/ooxml.ts');
const {parseCsv}=require('../lib/results/data.ts');
const article={id:'a',title:'Referência fictícia com vírgula, ponto e vírgula; e "aspas"',authors:['Autoria A','Autoria B','Autoria C','Autoria D'],year:2025,journal:'Periódico fictício',pmid:'123',doi:'10.1/teste',readingStatus:'reviewed',tags:['teste'],abstract:'',projectId:'project',favorite:true,exclusionReason:'',fullTextUrl:'',publicationTypes:[],pubdate:'2025',pubmedUrl:null,doiUrl:null,source:'PubMed',savedAt:''};
const note='Primeira linha, com "aspas";\nSegunda linha preservada';
const data={project:{id:'project',title:'Validação técnica dos documentos de projeto',theme:'Demonstração com dados fictícios',question:'Como conferir os arquivos gerados?',objective:'Verificar integridade dos registros',hypothesis:'',studyType:'Teste técnico',population:'Registros fictícios',inclusion:'Somente dados de demonstração',exclusion:'Dados reais',outcome:'Arquivo completo',variables:'Conteúdo exportado',methods:'Etapa um\nEtapa dois',analysis:'Conferência técnica',ethics:'Sem participantes ou dados reais',manuscript:'Revisão técnica',status:'planning',progress:0,updatedAt:'2026-10-16T12:00:00Z'},profile:{name:'Equipe de teste',institution:'Ambiente de demonstração',specialty:'Validação de software',trainingStage:''},articles:[article],notes:{a:{generalNotes:note,method:'Método\nem duas linhas',sampleSize:'0'}},milestones:[{key:'analysis',label:'Análise',status:'blocked',note:'Conferir dados\nRevisar com orientador',dueDate:'2026-10-20'}],generatedAt:'16/10/2026'};
const text=blocks=>blocks.filter(b=>'text'in b).map(b=>b.text).join('\n');
const summary=scientific.buildProjectSummary(data),summaryBlocks=ooxml.htmlWordBlocks(summary);
assert(text(summaryBlocks).includes('Campos ainda a definir: Hipótese ou pressuposto'));
assert(text(summaryBlocks).includes('Documento gerado a partir dos registros do usuário.'));
assert(summaryBlocks[0].style==='title');
assert(text(summaryBlocks).includes('Equipe de teste · Ambiente de demonstração\nGerado em 16/10/2026'));
assert(text(summaryBlocks).includes('Método previsto: Etapa um\nEtapa dois'));
const zero=text(ooxml.htmlWordBlocks(scientific.buildProjectSummary({...data,articles:[],notes:{}})));
assert(zero.includes('Referências vinculadas: 0'));assert(zero.includes('Artigos avaliados: 0'));
assert(text(ooxml.htmlWordBlocks(scientific.buildProjectSummary({...data,milestones:[{...data.milestones[0],status:'done'}]}))).includes('Não há etapas pendentes registradas.'));
const protocolBlocks=ooxml.htmlWordBlocks(scientific.buildStructuredProtocol(data));
assert(text(protocolBlocks).includes('Procedimentos e coleta: Etapa um\nEtapa dois'));
assert(text(protocolBlocks).includes('1. Autoria A; Autoria B; Autoria C; Autoria D.'));
const full={...data,milestones:[],articles:Array.from({length:14},(_,i)=>({...article,id:'ref'+i,title:'Referência selecionada '+i})),project:{...data.project,hypothesis:'Hipótese de demonstração'}};
const advisorBlocks=ooxml.htmlWordBlocks(scientific.buildAdvisorReport(full));
assert(text(advisorBlocks).includes('Referência selecionada 13'));
assert(text(advisorBlocks).includes('Os campos principais estão preenchidos.'));
const warningText=text(ooxml.htmlWordBlocks('<html><body><div class="box"><p>Aviso <strong>importante</strong><br>Continuação</p></div></body></html>'));
assert.equal(warningText,'Aviso importante\nContinuação','nested paragraphs must not duplicate a warning');
const advisorXml=new TextDecoder().decode(ooxml.htmlWord(scientific.buildAdvisorReport(data)));
assert(advisorXml.includes('Conferir dados</w:t><w:br/><w:t xml:space="preserve">Revisar com orientador'));
const matrix=scientific.buildProjectMatrixRows(data),noteIndex=matrix[0].indexOf('Notas gerais');
assert.equal(matrix[1][noteIndex],note);assert.equal(matrix[1][15],'0');
const csv=parseCsv(scientific.buildProjectMatrixCsv(data));assert.equal(csv.rows[0][noteIndex],note);
assert.equal(scientific.buildProjectMatrixRows({...data,articles:Array.from({length:5001},()=>article)}).length,5002);

const jsx=(type,props)=>({type,props}),nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
function load(file,deps,globals={}){const module={exports:{}};vm.runInNewContext(compile(file),{module,exports:module.exports,...globals,require(name){assert(name in deps,name);return deps[name];}});return module.exports;}
function buttons(){
  const downloads=[],state=[];let cursor=0;
  const react={useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],value=>{state[i]=value;}];},useRef(initial){const i=cursor++;if(!(i in state))state[i]={current:initial};return state[i];}};
  const component=load('components/documents/document-center.tsx',{react,'react/jsx-runtime':{jsx,jsxs:jsx},'@/lib/exports/ooxml':{...ooxml,downloadBinary:(bytes,filename,mime)=>downloads.push({bytes,filename,mime})},'@/lib/results/data':require('../lib/results/data.ts'),'@/lib/results/figure':{},'@/components/ai/assistant-panel':{},'@/lib/exports/scientific':scientific}).default;
  const render=()=>{cursor=0;return component({data});};
  return{downloads,button(title){const card=nodes(render()).find(node=>node.type==='article'&&nodes(node).some(child=>child.type==='h2'&&child.props.children===title));return nodes(card).find(node=>node.type==='button');}};
}
(async()=>{
 const ui=buttons();
 for(const title of ['Protocolo estruturado','Resumo executivo','Relatório para o orientador','Matriz de evidências'])await ui.button(title).props.onClick();
 assert.equal(ui.downloads.length,4);
 const [protocol,summary,advisor,matrixFile]=ui.downloads.map(file=>new TextDecoder().decode(file.bytes));
 assert(protocol.includes('Etapa um'));assert(summary.includes('Campos ainda a definir'));assert(advisor.includes('Definir ou validar: hipótese'));assert(matrixFile.includes('Primeira linha, com &quot;aspas&quot;;\nSegunda linha preservada'));
 for(const failure of [null,'research_projects','profiles','library_articles','library_article_projects','evidence_matrix','scholar_project_milestones']){
  const queries=[];const DocumentCenter=()=>null;
  const db={auth:{getUser:async()=>({data:{user:{id:'owner',email:'test@example.test'}}})},from(table){const q={table,filters:[]};queries.push(q);const chain={select(){return chain;},eq(...args){q.filters.push(args);return chain;},order(){return chain;},maybeSingle(){return chain;},then(resolve,reject){const values={research_projects:[{id:'project',title:data.project.title,updated_at:data.project.updatedAt}],profiles:data.profile,library_articles:[article],library_article_projects:[],evidence_matrix:[],scholar_project_milestones:[]};return Promise.resolve({data:values[table],error:failure===table?{code:'UNAVAILABLE'}:null}).then(resolve,reject);}};return chain;}};
  const page=load('app/documentos/page.tsx',{'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':{default:()=>null},'next/navigation':{redirect(){throw Error('redirect');}},'@/components/documents/document-center':{default:DocumentCenter},'@/lib/literature/library-store':{fromArticleRow:row=>row},'@/lib/supabase/server':{supabaseServer:async()=>db}}).default;
  const tree=await page({searchParams:Promise.resolve({projeto:'project'})});
  assert.equal(nodes(tree).some(node=>node.type===DocumentCenter),!failure,'a read error must block incomplete exports: '+failure);
  for(const q of queries)assert(q.filters.some(([key,value])=>value==='owner'&&(key==='owner_id'||q.table==='profiles'&&key==='id')));
 }
 if(process.env.SCHOLAR_DOCUMENTS_QA_DIR){fs.mkdirSync(process.env.SCHOLAR_DOCUMENTS_QA_DIR,{recursive:true});for(const file of ui.downloads)fs.writeFileSync(path.join(process.env.SCHOLAR_DOCUMENTS_QA_DIR,file.filename),file.bytes);}
 console.log('PASS: real project export buttons preserve warnings, zero counts, line breaks, authors, complete selected references and matrix cells; incomplete data loads block exports.');
})().catch(error=>{console.error(error);process.exitCode=1;});
