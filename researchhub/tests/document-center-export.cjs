const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), vm = require('node:vm'), ts = require('typescript');
const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
require.extensions['.ts'] = (module, filename) => module._compile(compile(filename), filename);
const { loadManuscriptExport } = require('../lib/projects/load-manuscript-export.ts');
const { formattedCitedReferences } = require('../lib/projects/references.ts');
const { manuscriptDocument, manuscriptWordBlocks } = require('../lib/projects/manuscript-export.ts');
const { emptyResults, parseCsv } = require('../lib/results/data.ts');
const workspace = { ...emptyResults, dataset: parseCsv('grupo;idade\n'+Array.from({length:40},(_,i)=>`${i<20?'A':'B'};${35+(i*7)%36}`).join('\n')), figure: { column:'grupo', title:'Distribuição dos dados fictícios', caption:'Registros fictícios para teste do download', kind:'bar' }, analysis:{kind:'welch',x:'idade',y:'grupo',independent:true}, flow:[{label:'Identificados',count:60},{label:'Incluídos',count:40}], notes:'Dados fictícios para validação técnica. Não representam resultados científicos reais.' };
const sources = [
  {id:'first',title:'Primeiro registro bibliográfico de teste',authors:['Autor A'],journal:'Periódico A',publication_year:2024,doi:'10.1/first',pmid:null},
  {id:'second',title:'Segundo registro bibliográfico de teste',authors:['Autor B'],journal:'Periódico B',publication_year:2025,doi:'10.1/second',pmid:null},
  {id:'uncited',title:'NAO CITADO NAO EXPORTAR',authors:[],journal:null,publication_year:null,doi:null,pmid:null},
];
const manuscript = {id:'manuscript',title:'Validação da exportação pela central de documentos',subtitle:'Demonstração com dados fictícios',authors:['Ana Teste','Bruno Teste'],affiliations:['Instituição fictícia de teste'],keywords:['exportação','teste'],citation_ids:['second','first'],citation_style:'vancouver'};
const sections = [
  {section_key:'introduction',heading:'Introdução',content:'Texto fictício com citações preservadas na ordem escolhida [1] e [2].'},
  {section_key:'results',heading:'Resultados',content:'Os resultados abaixo foram calculados com dados fictícios para validar o exportador.'},
  {section_key:'references',heading:'Referências',content:'Referência digitada manualmente'},
];
function fixture(scenario='ok') {
  const queries=[],requests=[];
  const client = {auth:{getUser:async()=>({data:{user:scenario==='auth'?null:{id:'owner'}},error:null})},from(table){
    const query={table,filters:[]};queries.push(query);
    const chain={select(fields){query.fields=fields;return chain;},eq(...args){query.filters.push(args);return chain;},in(key,values){query.ids=values;query.idField=key;return chain;},order(key){query.order=key;return chain;},maybeSingle(){return chain;},then(resolve,reject){
      const data=table==='scholar_manuscripts'?(scenario==='missing'||scenario==='foreign'?null:{...manuscript,citation_ids:scenario==='manual'?[]:manuscript.citation_ids,citation_style:scenario==='abnt'?'abnt':'vancouver'}):table==='scholar_manuscript_sections'?sections:sources.filter(article=>query.ids.includes(article.id)&&!(scenario==='missingref'&&article.id==='second'));
      const failed={manuscript_error:'scholar_manuscripts',sections_error:'scholar_manuscript_sections',articles_error:'library_articles'}[scenario]===table;
      return Promise.resolve({data,error:failed?{code:'UNAVAILABLE'}:null}).then(resolve,reject);
    }};return chain;
  }};
  const fetcher=async(url,options)=>{requests.push({url,options});if(scenario==='network')throw Error('Network unavailable');return {ok:scenario!=='results_error',json:async()=>{if(scenario==='badjson')throw Error('Bad JSON');return scenario==='missing_workspace'?{}:{workspace:scenario==='noresults'?null:scenario==='badworkspace'?{}:workspace};}};};
  return {client,fetcher,queries,requests};
}
const nodes = tree => !tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
function component(f, png) {
  const state=[],downloads=[];let cursor=0;
  const react={useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],value=>{state[i]=value;}];},useRef(initial){const i=cursor++;if(!(i in state))state[i]={current:initial};return state[i];}};
  const deps={
    react,'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
    '@/lib/exports/ooxml':{...require('../lib/exports/ooxml.ts'),downloadBinary:(bytes,filename,mime)=>downloads.push({bytes,filename,mime})},
    '@/lib/results/data':require('../lib/results/data.ts'),
    '@/lib/results/figure':{...require('../lib/results/figure.ts'),figurePng:async()=>({bytes:png||Uint8Array.from([1,2,3]),width:900,height:260})},
    '@/components/ai/assistant-panel':{default:()=>null},'@/lib/exports/scientific':require('../lib/exports/scientific.ts'),
    '@/lib/supabase/browser':{supabaseBrowser:()=>f.client},
    '@/lib/projects/load-manuscript-export':{loadManuscriptExport:(db,id)=>loadManuscriptExport(db,id,f.fetcher)},
    '@/lib/projects/manuscript-export':{manuscriptDocument},
  };
  const module={exports:{}};vm.runInNewContext(compile('components/documents/document-center.tsx'),{module,exports:module.exports,require(name){assert(name in deps,name);return deps[name];}});
  const data={project:{id:'project',title:'Título do protocolo',progress:20},profile:{name:'PERFIL NAO E AUTOR',institution:'PERFIL NAO E AFILIACAO'},articles:sources,notes:{},milestones:[]};
  const render=()=>{cursor=0;return module.exports.default({data});};
  const button=()=>{const card=nodes(render()).find(node=>node.type==='article'&&nodes(node).some(child=>child.type==='h2'&&child.props.children==='Manuscrito com resultados'));return nodes(card).find(node=>node.type==='button');};
  return {button,downloads,render};
}
(async()=>{
  const f=fixture(),loaded=await loadManuscriptExport(f.client,'project',f.fetcher);
  assert.equal(loaded.input.authors,'Ana Teste\nBruno Teste');assert.equal(loaded.input.affiliations,'Instituição fictícia de teste');
  assert(loaded.input.references[0].startsWith('1. Autor B'));assert(loaded.input.references[1].startsWith('2. Autor A'));
  assert.equal(loaded.input.subtitle,manuscript.subtitle);assert.equal(loaded.input.sections[0].content,sections[0].content);
  assert.equal(f.requests[0].url,'/api/results?project=project');assert.equal(f.requests[0].options.cache,'no-store');assert(f.requests[0].options.signal instanceof AbortSignal);
  for(const query of f.queries)assert(query.filters.some(([key,value])=>key==='owner_id'&&value==='owner'));
  assert.equal(f.queries.find(q=>q.table==='scholar_manuscript_sections').order,'position');
  const cited=f.queries.find(q=>q.table==='library_articles');assert.deepEqual(cited.ids,['second','first']);
  assert.throws(()=>formattedCitedReferences(['second','first'],[sources[0]],'vancouver'),/posição 1/);
  for(const [scenario,message] of Object.entries({auth:/Entre novamente/,missing:/Salve um artigo/,foreign:/Salve um artigo/,manuscript_error:/manuscrito salvo/,sections_error:/seções salvas/,articles_error:/referências citadas/,missingref:/posição 1/,results_error:/resultados salvos/,badworkspace:/Confira os resultados/,missing_workspace:/Confira os resultados/,badjson:/Bad JSON/,network:/Network/})){
    const fail=fixture(scenario);await assert.rejects(loadManuscriptExport(fail.client,'project',fail.fetcher),message);
    if(['auth','missing','foreign','manuscript_error'].includes(scenario))assert.equal(fail.requests.length,0);
  }
  const manual=fixture('manual'),manualExport=await loadManuscriptExport(manual.client,'project',manual.fetcher);
  assert(!manual.queries.some(q=>q.table==='library_articles'));
  assert(manuscriptWordBlocks(manualExport.input,null).some(block=>block.text==='Referência digitada manualmente'));
  const abnt=fixture('abnt');assert((await loadManuscriptExport(abnt.client,'project',abnt.fetcher)).input.references[0].startsWith('AUTOR B.'));
  const none=fixture('noresults');assert.equal((await loadManuscriptExport(none.client,'project',none.fetcher)).results,null);

  // Invoke the actual card button, including its dynamic imports and generated download.
  const png=process.env.SCHOLAR_EXPORT_QA_PNG?fs.readFileSync(process.env.SCHOLAR_EXPORT_QA_PNG):null;
  const ui=component(fixture(),png),button=ui.button();
  await Promise.all([button.props.onClick(),button.props.onClick()]);
  assert.equal(ui.downloads.length,1,'repeated clicks during preparation must generate one download');
  const download=ui.downloads[0],xml=new TextDecoder().decode(download.bytes);
  assert(download.filename.endsWith('-manuscrito.docx'));assert.equal(download.mime,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  for(const text of [manuscript.title,manuscript.subtitle,'Ana Teste','Bruno Teste','Instituição fictícia de teste','Análise estatística','Fonte: dados salvos pelo pesquisador','Fluxo de seleção'])assert(xml.includes(text),text);
  assert(!xml.includes('PERFIL NAO'));assert(!xml.includes('NAO CITADO'));assert(xml.includes('word/media/image1.png'));
  assert(xml.indexOf('1. Autor B')<xml.indexOf('2. Autor A'));
  assert.equal(nodes(ui.render()).filter(node=>node.props?.role==='status').length,1);
  for(const scenario of ['missingref','badworkspace','results_error','network']){
    const bad=component(fixture(scenario));await bad.button().props.onClick();assert.equal(bad.downloads.length,0);assert(nodes(bad.render()).some(node=>node.props?.role==='alert'));assert(!nodes(bad.render()).some(node=>node.props?.role==='status'));
  }
  if(process.env.SCHOLAR_EXPORT_QA_DIR&&png){fs.mkdirSync(process.env.SCHOLAR_EXPORT_QA_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.SCHOLAR_EXPORT_QA_DIR,'figure.svg'),require('../lib/results/figure.ts').figureSvg(workspace));fs.writeFileSync(path.join(process.env.SCHOLAR_EXPORT_QA_DIR,'central-documentos.docx'),download.bytes);}
  console.log('PASS: actual document-center button exports saved authors, citation order, tables, figure and analysis; owner-scoped reads, missing sources, invalid results, errors and repeated clicks are handled.');
})().catch(error=>{console.error(error);process.exitCode=1;});
