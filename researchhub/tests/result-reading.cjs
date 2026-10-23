const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),ts=require('typescript');
const compile=f=>ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
require.extensions['.ts']=(m,f)=>m._compile(compile(f),f);
const read=require('../lib/results/reading.ts'),review=require('../lib/results/review.ts'),core=require('../lib/clinical/collection.ts'),data=require('../lib/results/data.ts'),summary=require('../lib/clinical/summary.ts');
const before=[10,20,30],after=[9,18,27];
const d={field:{label:'Pressão',unit:'mmHg'},before:{label:'Início'},after:{label:'Retorno'},counts:{included:5}};
const r={mean:-2,n:3,ci:[-4,0],p:.9};
let reading=read.pairedReading(d,r);assert(reading.summary.includes('diminuiu em média 2 mmHg'));assert(reading.facts.some(f=>f.value==='2 por dados incompletos'));assert(reading.facts.some(f=>f.value==='-4 a 0'));assert(!/melhorou|significativ|comprov/.test(reading.summary));
assert(read.pairedReading(d,{...r,mean:0}).summary.includes('mudança média igual a zero'));
const a={columns:['Medida','Grupo'],n:10,excluded:2,estimate:-3,effect:'Diferença de médias (B − A)',ci:[-4,-2],p:0};
reading=read.generalReading(a,'welch');assert.equal(reading.facts.find(f=>f.label==='Valor de p').value,'< 0,0001');assert(reading.facts.some(f=>f.label==='Diferença de médias (B − A)'));assert(reading.summary.includes('primeiro grupo foi menor'));
assert(read.generalReading({...a,ci:null},'chi2').facts.some(f=>f.value==='Não disponível nesta versão'));
assert(read.generalReading({...a,estimate:0},'pearson').summary.includes('igual a zero'));
assert(read.repeatedReading({field:{label:'Medida'},moments:[{label:'Início'},{label:'30 dias'},{label:'90 dias'}],counts:{included:12}},{n:10,k:3,p:.03}).caution.includes('não identifica quais momentos diferem'));
const ref=require('./adjusted-reference.json').cases[0];const c=core.createCollection({population:'Adultos',inclusion_criteria:'Incluídos'});c.period='2025';c.fields=[{...core.blankField('y','Pressão'),kind:'number',unit:'mmHg'},...ref.fields.map(f=>({...core.blankField(f.key,f.key),kind:f.kind,options:f.options}))];c.records=ref.rows.map((row,i)=>({code:'P'+i,status:'included',reason:'',values:Object.fromEntries(Object.entries(row).map(([k,v])=>[k,String(v)]))}));
const config={outcome:'y',predictors:ref.predictors,confirmed:true};const w={...summary.syncCollection(data.emptyResults,c),adjusted:config};
const snapshot=JSON.stringify(w);let reviewed=review.workspaceReadings(w);assert.equal(reviewed.length,1);assert(reviewed[0].reading.coefficients.length===ref.predictors.length);assert(!JSON.stringify(reviewed).includes('P0'));assert.equal(JSON.stringify(w),snapshot,'reading never mutates data or configuration');
reviewed=review.workspaceReadings({...w,adjusted:{...config,confirmed:false}});assert(!reviewed[0].reading);assert(reviewed[0].pending.includes('Confirme'));
const constant=JSON.parse(JSON.stringify(w));constant.collection.records.forEach(record=>record.values[ref.predictors[0].key]='1');reviewed=review.workspaceReadings(constant);assert(!reviewed[0].reading);assert(reviewed[0].pending.includes('constante'));
assert.deepEqual(review.workspaceReadings(data.emptyResults),[]);
// Render the actual presentation components: glossary, accessible definition lists,
// practical review guidance and no automatic confirmation or threshold verdict.
const jsx=(type,props)=>({type,props}),ui={exports:{}};vm.runInNewContext(compile('components/results/result-reading.tsx'),{module:ui,exports:ui.exports,require(name){if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};throw Error(name);}});
const nodes=t=>!t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(nodes):[t,...nodes(t.props?.children)];const text=t=>typeof t==='string'||typeof t==='number'?String(t):!t?'':Array.isArray(t)?t.map(text).join(''):text(t.props?.children);
const tree=ui.exports.ResultReading({reading});assert(nodes(tree).some(n=>n.type==='dl'));assert(nodes(tree).some(n=>n.type==='details'&&!n.props.open));assert(text(tree).includes('não mede importância clínica'));assert(text(tree).includes('Não é a probabilidade de a hipótese ser verdadeira'));
for(const kind of ['welch','pearson','chi2','paired','repeated','adjusted']){const guide=ui.exports.ReviewGuide({kind});assert(text(guide).includes('mantenha a confirmação desmarcada'));assert(!nodes(guide).some(n=>n.type==='input'||n.props?.onClick));}
const helper=require('../lib/ai/workflow-help.ts');const help=helper.workflowHelp(w);assert(help.draft.includes('Pressão'));assert(!help.draft.includes('P0'));assert.equal(JSON.stringify(w),snapshot);assert.equal(helper.workflowHelp({...w,adjusted:{...config,confirmed:false}}).draft,'');assert.equal(helper.workflowHelp(constant).draft,'');assert.equal(helper.workflowHelp(data.emptyResults).paths.find(p=>p.id==='paired').available,false);
const pending=JSON.parse(JSON.stringify(w));pending.collection.records[0].status='pending';pending.collection.records[1].values.y='';const checked=helper.workflowHelp(pending);assert.equal(checked.checks[0].count,1);assert(checked.missing.some(f=>f.label==='Pressão'&&f.count===1));
console.log('PASS: plain-language effect direction, zero and missingness, group order, p display, unavailable intervals, no causal/threshold verdicts, guarded review of current analyses, no identifiers/mutation and actual glossary/help rendering.');
