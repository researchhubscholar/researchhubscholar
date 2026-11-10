const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const core=require('../lib/clinical/collection.ts'),follow=require('../lib/clinical/followup.ts'),summary=require('../lib/clinical/summary.ts'),data=require('../lib/results/data.ts');
const paired=require('../lib/clinical/paired.ts'),repeated=require('../lib/clinical/repeated.ts'),adjusted=require('../lib/clinical/adjusted.ts'),reading=require('../lib/results/reading.ts'),inference=require('../lib/results/inference.ts'),word=require('../lib/results/word.ts'),figure=require('../lib/results/figure.ts'),{statText}=require('../lib/i18n/statistics-copy.ts');
const generalData={columns:['Campo original {0} $&','Grupo original'],rows:[['1','Coleta'],['2','Coleta'],['4','Coleta'],['3','Resumo'],['6','Resumo'],['8','Resumo']]};
const config={kind:'welch',x:generalData.columns[0],y:generalData.columns[1],independent:true};
const r=inference.analyze(generalData,config),rBefore=JSON.stringify(r);
const text=reading.generalReading(r,'welch','es');
assert(text.summary.startsWith('La diferencia media'));assert(text.summary.includes(generalData.columns[0]));assert(text.caution.includes('causa y efecto'));
assert(inference.analysisEffect(r,'es').includes('Coleta − Resumo'));assert(inference.analysisDetails(r,'es')[0].includes('Coleta:'));assert.equal(inference.analysisTable(r,'es')[1][0],'Coleta');
assert.equal(JSON.stringify(r),rBefore);
const numericCells=rows=>rows.flat().filter(v=>typeof v==='number');
assert.deepEqual(numericCells(inference.analysisRows(r,'es')),numericCells(inference.analysisRows(r,'pt-BR')));
const c=core.createCollection({population:'População original',inclusion_criteria:'Inclusão original'});c.period='2025';c.fields=[{...core.blankField('baseline','Nome original'),kind:'number'}];
const values=[[10,11,13],[20,22,19],[15,14,18],[8,12,10],[30,28,34],[25,27,26]];
c.records=values.map((row,i)=>({code:'P'+i,status:'included',reason:'',values:{baseline:String(row[0])}}));
const moments=[{key:'m0',label:'Início original',day:0},{key:'m1',label:'Retorno original',day:30},{key:'m2',label:'Revisão original',day:60}];
const plan=follow.applyFollowupPlan(undefined,[{...core.blankField('measure','Medida original {0} $&'),kind:'number',unit:'mmHg'}],moments,c);
plan.visits=values.flatMap((row,i)=>row.map((v,j)=>({code:'P'+i,momentKey:'m'+j,status:'completed',date:'2025-0'+(j+1)+'-01',reason:'',values:{measure:String(v)}})));
const pConfig={fieldKey:'measure',before:'m0',after:'m1',confirmed:true},mConfig={fieldKey:'measure',moments:['m0','m1','m2'],confirmed:true};
const inputBefore=JSON.stringify({c,plan,pConfig,mConfig});
for(const [module,builder,test,cfg,narrative,rows]of [[paired,'pairedData','pairedTest',pConfig,'pairedNarrative','pairedResultRows'],[repeated,'repeatedData','repeatedTest',mConfig,'repeatedNarrative','repeatedResultRows']]) {
 const pt=module[builder](c,plan,cfg,'pt-BR'),es=module[builder](c,plan,cfg,'es');
 assert.deepEqual(module[test](pt,cfg),module[test](es,cfg));
 const result=module[test](es,cfg),out=module[narrative](es,result,'es');assert(out.includes('participantes'));assert(out.includes('Medida original {0} $&'));assert(out.includes('causal'));
 assert.deepEqual(numericCells(module[rows](result,'es')),numericCells(module[rows](result,'pt-BR')));
}
const ref=require('./adjusted-reference.json').cases[0],reg=core.createCollection({population:'Original',inclusion_criteria:'Original'});reg.period='2025';reg.fields=[{...core.blankField('y','Desfecho original'),kind:'number'},...ref.fields.map(f=>({...core.blankField(f.key,'Original '+f.key),kind:f.kind,options:f.options}))];reg.records=ref.rows.map((row,i)=>({code:'R'+i,status:'included',reason:'',values:Object.fromEntries(Object.entries(row).map(([k,v])=>[k,String(v)]))}));
const regCfg={outcome:'y',predictors:ref.predictors,confirmed:true},regPt=adjusted.fitAdjusted(adjusted.adjustedData(reg,regCfg)),regEsData=adjusted.adjustedData(reg,regCfg,'es'),regEs=adjusted.fitAdjusted(regEsData);
for(const key of ['n','df','r2','adjustedR2','rmse','condition'])assert.equal(regPt[key],regEs[key]);
assert.deepEqual(regPt.coefficients.map(({label,...v})=>v),regEs.coefficients.map(({label,...v})=>v));assert(adjusted.adjustedNarrative(regEsData,regEs,'es').includes('Se ajustó una regresión'));
const w={...summary.syncCollection(data.emptyResults,c),followup:plan,paired:pConfig,repeated:mConfig,notes:'Notas originais',figure:{column:'Nome original',kind:'histogram',title:'Título original <script>',caption:'Legenda original'}};
const blocks=word.resultsWordBlocks(w,null,'es');assert(blocks.some(b=>b.text==='Prueba t pareada'));assert(blocks.some(b=>b.text==='Notas originais'));assert(!JSON.stringify(blocks).includes('P0'));
const svg=figure.figureSvg(w,false,'es'),svgPt=figure.figureSvg(w,false,'pt-BR');assert(svg.includes('Fuente:'));assert(svg.includes('Título original &lt;script&gt;'));assert(!svg.includes('<script>'));
const widths=s=>[...s.matchAll(/<rect[^>]*width="([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(widths(svg),widths(svgPt));
assert.equal(statText('es','Inclusão: {0}. Exclusão: {1}.','{1}$&<script>','Original'),'Inclusión: {1}$&<script>. Exclusión: Original.');
assert.equal(JSON.stringify({c,plan,pConfig,mConfig}),inputBefore);
console.log('PASS: bilingual statistics preserve calculations, confidence intervals, p-values, original variables/categories, source data and SVG geometry; only authored text and numeric presentation change.');

const review=require('../lib/results/review.ts');
const pending=review.workspaceReadings({...w,paired:{...pConfig,confirmed:false},repeated:{...mConfig,confirmed:false}},'es');
assert(pending.every(item=>!item.reading));assert(pending.every(item=>item.pending&&!item.pending.includes('Confirme')));
const {collectionWorkbook}=summary;
const sheets=collectionWorkbook(c,undefined,plan,pConfig,mConfig,undefined,'es');assert(sheets.some(sheet=>sheet.name==='Prueba pareada'));
const collectionSheet=sheets.find(sheet=>sheet.name==='Recolección');assert(collectionSheet);assert.equal(collectionSheet.rows[1][0],'P0');assert.equal(collectionSheet.rows[1][1],'included');
console.log('PASS: unconfirmed analyses stay blocked in Spanish and raw-data exports retain research IDs and canonical statuses.');
assert.equal(sheets.find(sheet=>sheet.name==='Historial reciente').rows[0][0],'Fecha');
assert.equal(collectionWorkbook(c).find(sheet=>sheet.name==='Histórico recente').rows[0][0],'Data');
// Optional disposable fixtures for independent ZIP/XML validation; never use patient data.
if(process.env.SCHOLAR_I18N_QA_DIR){
 const path=require('node:path'),{workbook,wordDocument}=require('../lib/exports/ooxml.ts');
 fs.mkdirSync(process.env.SCHOLAR_I18N_QA_DIR,{recursive:true});
 for(const locale of ['pt-BR','es']){
  const save=(name,bytes)=>fs.writeFileSync(path.join(process.env.SCHOLAR_I18N_QA_DIR,locale+'-'+name),bytes);
  save('collection.xlsx',workbook(collectionWorkbook(c,undefined,plan,pConfig,mConfig,undefined,locale)));
  save('results.docx',wordDocument(word.resultsWordBlocks(w,null,locale),locale));
  save('figure.svg',figure.figureSvg(w,false,locale));
 }
}
