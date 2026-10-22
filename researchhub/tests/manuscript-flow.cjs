const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const {preserveVersion}=require('../lib/projects/preserve-version.ts');
(async()=>{
 let writes=0;
 await assert.rejects(preserveVersion({title:'Rascunho'},async()=>false,async()=>writes++),/não foi salvo/);
 assert.equal(writes,0);
 await assert.rejects(preserveVersion({},async()=>{throw new Error('Rede indisponível')},async()=>writes++),/Rede/);
 assert.equal(writes,0);
 const draft={title:'Salvo',sections:[{content:'Texto salvo'}]};
 const result=await preserveVersion(draft,async()=>{draft.title='Editado durante o envio';draft.sections[0].content='Texto ainda não salvo';return true},async captured=>{writes++;return captured});
 assert.equal(result.title,'Salvo');assert.equal(result.sections[0].content,'Texto salvo');assert.equal(writes,1);
 await assert.rejects(preserveVersion({},async()=>true,async()=>{throw new Error('Histórico indisponível')}),/Histórico/);
 const transfer=require('../lib/results/transfer.ts'),data=require('../lib/results/data.ts');
 const original='Texto já escrito com citação [1].';assert.equal(transfer.appendResults(original,'Novo resultado'),original+'\n\nNovo resultado');assert.throws(()=>transfer.appendResults(original,original),/já está/);assert.throws(()=>transfer.appendResults(original,''),/Revise/);
 const stamp=transfer.resultsStamp(data.emptyResults);assert(transfer.validTransfer({project:'A',stamp,text:'Resultados'},'A'));assert(!transfer.validTransfer({project:'B',stamp,text:'Resultados'},'A'));const changed={...data.emptyResults,notes:'Mudança'};assert.notEqual(transfer.resultsStamp(changed),stamp);assert(transfer.resultsChecklist(changed,true,stamp).some(s=>s.includes('mudaram')));assert(transfer.resultsChecklist(changed,true,stamp).some(s=>s.includes('não salvas')));assert.equal(transfer.lastResultsStamp([{snapshot:{}},{snapshot:{resultsSource:stamp}}]),stamp);
 console.log('PASS: version creation blocks failed synchronization, captures saved text before concurrent edits and propagates persistence errors.');
})().catch(e=>{console.error(e);process.exit(1)});
