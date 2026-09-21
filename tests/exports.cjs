const fs=require('node:fs');const assert=require('node:assert/strict');const ts=require('typescript');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const {buildCsv,buildRis,buildBibtex,buildProtocolDoc}=require('../lib/exports/scientific.ts');
const article={id:'a1',title:'Title, with comma',authors:['Ana Silva','Beto Lima'],year:2025,journal:'Journal',pmid:'123',doi:'10.1/test',readingStatus:'reviewed',tags:['prioritário'],abstract:'Resumo',projectId:null,favorite:true,exclusionReason:'',fullTextUrl:'',publicationTypes:[],pubdate:'2025',pubmedUrl:null,doiUrl:null,source:'PubMed',savedAt:''};
const notes={a1:{objective:'Avaliar resultado',sampleSize:'120',riskOfBias:'Baixo'}};
assert(buildCsv([article],notes).includes('"Title, with comma"'));assert(buildCsv([article],notes).includes('"120"'));
assert(buildRis([article]).includes('AN  - PMID:123'));assert(buildBibtex([article]).includes('@article{scholar2025_1'));
assert(buildProtocolDoc('<Projeto>',[]).includes('&lt;Projeto&gt;'));
console.log('PASS: CSV/Excel, RIS, BibTeX and Word-compatible protocol exports.');
