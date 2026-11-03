const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const compile=(file,interop=false)=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:interop,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
require.extensions['.ts']=(m,f)=>m._compile(compile(f,true),f);
const {localizeInterfaceCopy}=require('../lib/i18n/interface-copy.ts');
let locale='pt-BR',cursor=0;const state=[],effects=[];
const react={useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return[state[i],v=>state[i]=typeof v==='function'?v(state[i]):v];},useRef(initial){const i=cursor++;return state[i]||={current:initial};},useMemo:f=>f(),useCallback:f=>f,useEffect(fn,deps){const i=cursor++,old=state[i];if(!old||deps.some((v,j)=>v!==old.deps[j]))effects.push(()=>{old?.cleanup?.();state[i]={deps,cleanup:fn()};});}};
const authored={},jsx=(type,props)=>type===authored?localizeInterfaceCopy(locale,props.text):{type,props};
const dependencies={
 "@/lib/i18n/format":require("../lib/i18n/format.ts"),
 "@/components/i18n/language-provider":{useLanguage:()=>({locale})},
 react,'react/jsx-runtime':{jsx,jsxs:jsx},'react-dom':{createPortal:tree=>tree},'next/link':{default:'link'},
 '@/components/i18n/use-interface-copy':{useInterfaceCopy:()=>s=>localizeInterfaceCopy(locale,s)},
 '@/components/i18n/authored-text':{default:authored},'@/lib/i18n/interface-copy':{dialogCopy:s=>localizeInterfaceCopy(locale,s)},
 '@/components/projects/task-plan':{default:'task-plan'},'./idea-proposal':{default:'idea-proposal'},'./workflow-help':{default:'workflow-help'},
 '@/lib/ai/client-request':{...require('../lib/ai/client-request.ts'),postAI:()=>{throw Error('Opening/switching language must not call AI');}},
};
const moduleFixture={exports:{}};
vm.runInNewContext(compile('components/ai/project-guide.tsx'),{module:moduleFixture,exports:moduleFixture.exports,Request,Response,AbortController,document:{body:{}},fetch:async()=>({ok:true,json:async()=>({turns:[]})}),require:name=>{if(name in dependencies)return dependencies[name];if(name.startsWith('@/lib/ai/'))return require('../lib/ai/'+name.split('/').pop()+'.ts');throw Error(name);}});
const nodes=t=>!t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(nodes):[t,...nodes(t.props?.children)];
const render=()=>{cursor=0;const tree=moduleFixture.exports.default({projectId:null,title:'Projeto original sem tradução',workspace:require('../lib/results/data.ts').emptyResults,stage:0,question:'',dirty:false,disabled:false,source:'clinical',area:'ideias',onNavigate:()=>false,onQuestion:()=>false});while(effects.length)effects.shift()();return nodes(tree);};
(async()=>{
 render();render().find(n=>n.type==='button'&&n.props['aria-label']==='Abrir assistente').props.onClick();render();await new Promise(r=>setImmediate(r));
 let tree=render();tree.find(n=>n.type==='textarea').props.onChange({target:{value:'Minha pergunta original ñ <script>'}});
 locale='es';tree=render();
 assert(tree.some(n=>n.type==='button'&&n.props['aria-label']==='Cerrar asistente'));
 const field=tree.find(n=>n.type==='textarea');assert.equal(field.props.value,'Minha pergunta original ñ <script>');assert.equal(field.props.placeholder,'Pregunta sobre investigación o ResearchHub…');
 assert(JSON.stringify(tree).includes('Projeto original sem tradução'));
 tree.find(n=>n.type==='button'&&n.props.className==='project-guide-starter').props.onClick();
 assert.match(render().find(n=>n.type==='textarea').props.value,/Ayúdame|Cómo puedo/);
 locale='pt-BR';assert.match(render().find(n=>n.type==='textarea').props.value,/Ayúdame|Cómo puedo/,'switching interface preserves the prepared draft');
 console.log('PASS: actual assistant controls and starters switch to Spanish without losing drafts, changing project titles, or triggering AI.');
})().catch(error=>{console.error(error);process.exitCode=1;});
