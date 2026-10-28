const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),ts=require('typescript');
const compile=f=>ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
require.extensions['.ts']=(m,f)=>m._compile(compile(f),f);const selection=require('../lib/projects/selection.ts'),jsx=(type,props)=>({type,props});
(async()=>{
 for(const page of ['resultados','manuscrito','documentos','orientacao'])for(const requested of [undefined,'','deleted','foreign']){
  const reads=[];const db={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from(table){reads.push(table);const q={select(){return q;},eq(){return q;},order(){return q;},in(){return q;},maybeSingle(){return q;},then(resolve,reject){return Promise.resolve({data:table==='research_projects'?[{id:'owned',owner_id:'owner',title:'Outro trabalho'}]:table==='profiles'?{}:[],error:null}).then(resolve,reject);}};return q;}};
  const deps={'@/lib/projects/selection':selection,'@/components/projects/project-choice':{default:'project-choice'},'@/lib/supabase/server':{supabaseServer:async()=>db},'next/link':{default:'link'},'next/navigation':{redirect(){throw Error('Unexpected redirect');}},'react/jsx-runtime':{jsx,jsxs:jsx},'@/components/results/editor':{default:'results-editor'},'@/components/manuscript/manuscript-editor':{default:'manuscript-editor'},'@/components/documents/document-center':{default:'document-center'},'@/lib/literature/library-store':{},'@/components/advising/advising-workspace':{default:'advising-workspace'}};
  const mod={exports:{}};vm.runInNewContext(compile(`app/${page}/page.tsx`),{module:mod,exports:mod.exports,require:n=>{assert(n in deps,n);return deps[n];}});
  const output=await mod.exports.default({searchParams:Promise.resolve({projeto:requested})});assert.equal(output.type,'project-choice',page);
  assert(!reads.some(t=>['scholar_project_results','scholar_manuscripts','scholar_manuscript_sections','scholar_project_comments'].includes(t)),page+' must not read another project');
 }console.log('PASS: actual module pages reject absent/empty/deleted/foreign projects before reading scientific content.');
})().catch(e=>{console.error(e);process.exit(1)});
