const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, filename);

const { mergeArticles } = require('../lib/literature/types.ts');
const { resultCsv, resultRis, resultBibtex } = require('../lib/literature/result-export.ts');
const pubmed = { pmid: '123', doi: '10.1000/test', title: 'PubMed title', authors: ['A Author'], journal: 'Journal', pubdate: '2025', year: 2025, publicationTypes: ['Trial'], abstract: 'Abstract', pubmedUrl: 'https://pubmed.ncbi.nlm.nih.gov/123/', doiUrl: 'https://doi.org/10.1000/test', source: 'PubMed' };
const crossref = { ...pubmed, pmid: null, title: 'Crossref title', abstract: null, pubmedUrl: null, source: 'Crossref' };
const unique = { ...crossref, doi: '10.1000/unique', title: 'Unique article', doiUrl: 'https://doi.org/10.1000/unique' };
const merged = mergeArticles([pubmed, crossref, unique]);
assert.equal(merged.duplicateCount, 1);
assert.equal(merged.articles.length, 2);
assert.deepEqual(merged.articles[0].duplicateSources, ['PubMed', 'Crossref']);
assert.equal(merged.articles[0].abstract, 'Abstract');
assert(resultCsv(merged.articles).includes('PubMed + Crossref'));
assert(resultRis(merged.articles).includes('TY  - JOUR'));
assert(resultBibtex(merged.articles).includes('@article{'));
console.log('PASS: combined-source duplicate merge and CSV, RIS and BibTeX exports.');

const limits=require('../lib/literature/search-limits.ts');
const strategyBuilder=require('../lib/literature/query-strategy.ts');
const longStrategy='('+Array.from({length:45},(_,i)=>`"clinical pharmacological factor ${i}"[Title/Abstract]`).join(' OR ')+') AND ("Drug Discontinuation"[MeSH Terms] OR discontinuation[Title/Abstract])';
assert(longStrategy.length>1000);
const applied=limits.appliedPubmedStrategy(longStrategy);
assert.equal(applied.populationTerm,'');assert.equal(applied.outcomeTerm,'');assert.equal(applied.mesh,'');
assert.equal(strategyBuilder.buildSearchStrategy(applied).pubmedQuery,longStrategy);
assert.throws(()=>limits.appliedPubmedStrategy('x'.repeat(10001)),/caracteres/);
function loadHandler(file,dependencies){const module={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>{if(id in dependencies)return dependencies[id];throw Error('Unexpected import '+id);},module,module.exports);return module.exports;}
const serverMock={NextResponse:{json:(value,init)=>new Response(JSON.stringify(value),{status:init?.status||200,headers:{'Content-Type':'application/json'}})}};
(async()=>{
 let analyzed=null;const seen=[];
 const search=loadHandler('app/api/literature/search/route.ts',{'next/server':serverMock,'@/lib/literature/query-strategy':strategyBuilder,'@/lib/literature/search-limits':limits,'@/lib/literature/analyze':{analyzeLiterature:async(input)=>{analyzed=input;return{topic:input.topic,filters:{searchTerm:input.topic+' AND 2026[pdat]',crossrefQuery:'clinical factors'},articles:[]};}}});
 const response=await search.POST(new Request('https://local/api/literature/search',{method:'POST',body:JSON.stringify({...applied,period:'5',studyType:'systematic'})}));assert.equal(response.status,200);assert.equal(analyzed.topic,longStrategy);const result=await response.json();
 const articles=loadHandler('app/api/literature/articles/route.ts',{'next/server':serverMock,'@/lib/literature/search-limits':limits,'@/lib/literature/types':{mergeArticles},'@/lib/literature/crossref':{},'@/lib/literature/pubmed':{pubmedSearch:async(term,max,sort,offset)=>{seen.push({term,offset});return{count:60,ids:['123']};},fetchArticleDetails:async()=>[pubmed]}});
 const page=await articles.POST(new Request('https://local/api/literature/articles',{method:'POST',body:JSON.stringify({source:'pubmed',sort:'relevance',period:'5',topic:result.topic,searchTerm:result.filters.searchTerm,crossrefQuery:result.filters.crossrefQuery,offset:20})}));assert.equal(page.status,200);assert.equal((await page.json()).nextOffset,40);assert.equal(seen[0].term,result.filters.searchTerm);assert.equal(seen[0].offset,20);
 const invalid=await search.POST(new Request('https://local/api/literature/search',{method:'POST',body:JSON.stringify({topic:'x'.repeat(10001)})}));assert.equal(invalid.status,400);assert.match((await invalid.json()).error,/10000/);
 const transport=[];const native=loadHandler('lib/literature/pubmed.ts',{});
 const original=global.fetch;global.fetch=async(url,options)=>{transport.push({url,options});return new Response(JSON.stringify({esearchresult:{count:'1',idlist:['123']}}));};
 try {await native.pubmedSearch(longStrategy,20,'relevance',20);await native.pubmedSearch('sleep',20);assert.equal(transport[0].options.method,'POST');assert(!transport[0].url.includes('?'));const body=new URLSearchParams(transport[0].options.body);assert.equal(body.get('term'),longStrategy);assert.equal(body.get('retstart'),'20');assert(transport[1].url.includes('term=sleep'));}finally{global.fetch=original;}
 console.log('PASS: full AI strategy → exact PubMed query → search → pagination, explicit limits and long-query POST without truncation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
