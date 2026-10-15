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
 console.log('PASS: version creation blocks failed synchronization, captures saved text before concurrent edits and propagates persistence errors.');
})().catch(e=>{console.error(e);process.exit(1)});
