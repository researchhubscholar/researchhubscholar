const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),ts=require('typescript');
const compile=f=>ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
require.extensions['.ts']=(m,f)=>m._compile(compile(f),f);
const excerpts=require('../lib/ai/guide-excerpt.ts'),actions=require('../lib/ai/radar-action.ts'),assist=require('../lib/ai/assist.ts');
assert.equal(excerpts.replaceExcerpt('antes trecho depois','antes trecho depois',6,12,'revisado'),'antes revisado depois');
for(const args of [['mudou','original',0,3,'novo'],['abc','abc',2,1,'novo'],['abc','abc',0,8,'novo'],['abc','abc',0,2,'']])assert.throws(()=>excerpts.replaceExcerpt(...args));
for(const patch of [{text:'a'.repeat(3001)},{text:'CPF 12345678900'},{intent:'anything'},{label:''}])assert.throws(()=>excerpts.validateExcerpt({text:'Um trecho de método',label:'Métodos',intent:'improve',...patch}));
assert.deepEqual(Object.keys(excerpts.validateExcerpt({text:'Método escolhido',label:'Métodos',intent:'improve',fullDocument:'DO NOT SEND'})),['text','label','intent']);
const out={...assist.simulatedOutput('guide'),recommendations:[{...assist.simulatedOutput('guide').recommendations[0],targetField:'guide_excerpt',content:'Texto revisado'}]};
assert.equal(actions.safeGuideActions(out).recommendations[0].targetField,'');assert.equal(actions.safeGuideActions(out,false,true).recommendations[0].targetField,'guide_excerpt');
const state=[],effects=[];let cursor=0;const react={useState(v){const i=cursor++;if(!(i in state))state[i]=v;return[state[i],n=>state[i]=typeof n==='function'?n(state[i]):n];},useRef(v){const i=cursor++;return state[i]||={current:v};},useEffect(fn,deps){const i=cursor++,prev=state[i];if(!prev||deps.some((v,j)=>v!==prev.deps[j]))effects.push(()=>{prev?.cleanup?.();state[i]={deps,cleanup:fn()};});}};
const listeners=new Map(),events=[];class CustomEvent{constructor(type,{detail}){this.type=type;this.detail=detail;}}
const window={addEventListener:(type,cb)=>listeners.set(type,cb),removeEventListener:type=>listeners.delete(type),dispatchEvent:event=>{events.push(event);listeners.get(event.type)?.(event);}};
const jsx=(type,props)=>({type,props}),moduleFixture={exports:{}};
vm.runInNewContext(compile('components/ai/excerpt-help.tsx'),{module:moduleFixture,exports:moduleFixture.exports,window,CustomEvent,crypto,require:n=>{if(n==='react')return react;if(n==='react/jsx-runtime')return{jsx,jsxs:jsx};if(n==='@/lib/ai/guide-excerpt')return excerpts;throw Error(n);}});
let value='antes trecho depois',applies=0,disabled=false;const Component=moduleFixture.exports.default;
const render=()=>{cursor=0;const tree=Component({children:{type:'textarea',props:{}},value,label:'Métodos',projectId:'11111111-1111-4111-8111-111111111111',area:'protocolo',disabled,onApply:async(original,next)=>{assert.equal(original,value);value=next;applies++;return true;}});while(effects.length)effects.shift()();return tree;};
const nodes=t=>!t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(nodes):[t,...nodes(t.props?.children)],text=t=>typeof t==='string'?t:!t?'':Array.isArray(t)?t.map(text).join(''):text(t.props?.children);
const select=()=>render().props.onSelectCapture({target:{tagName:'TEXTAREA',value,selectionStart:6,selectionEnd:12}});
const prepare=()=>nodes(render()).find(n=>n.type==='button'&&text(n)==='Pedir ajuda ao assistente').props.onClick();
(async()=>{
 render();select();nodes(render()).find(n=>n.type==='select').props.onChange({target:{value:'improve'}});prepare();assert.equal(events.length,1);let req=events[0].detail;assert.equal(req.text,'trecho');assert.equal(req.intent,'improve');assert.equal(applies,0,'preparing never edits or calls AI');
 window.dispatchEvent(new CustomEvent('scholar-guide-apply-excerpt',{detail:{token:'foreign',text:'bad'}}));assert.equal(applies,0);
 window.dispatchEvent(new CustomEvent('scholar-guide-apply-excerpt',{detail:{token:req.token,text:'revisado'}}));window.dispatchEvent(new CustomEvent('scholar-guide-apply-excerpt',{detail:{token:req.token,text:'duplicado'}}));await new Promise(r=>setImmediate(r));assert.equal(applies,1);assert.equal(value,'antes revisado depois');
 select();prepare();req=events.at(-1).detail;value+=' editado';render();window.dispatchEvent(new CustomEvent('scholar-guide-apply-excerpt',{detail:{token:req.token,text:'overwrite'}}));await new Promise(r=>setImmediate(r));assert.equal(applies,1);assert(text(render()).includes('O texto mudou'));
 console.log('PASS: excerpt validation, bounded payload, replacement actions, actual selection handoff, owner token correlation, duplicate apply lock and stale-edit protection.');
})().catch(e=>{console.error(e);process.exit(1);});
