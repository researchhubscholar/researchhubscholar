const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),ts=require('typescript');
const compile=f=>ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
require.extensions['.ts']=(m,f)=>m._compile(compile(f),f);
const excerpts=require('../lib/ai/guide-excerpt.ts'),actions=require('../lib/ai/radar-action.ts'),assist=require('../lib/ai/assist.ts');
assert.equal(excerpts.replaceExcerpt('antes trecho depois','antes trecho depois',6,12,'revisado'),'antes revisado depois');
for(const args of [['mudou','original',0,3,'novo'],['abc','abc',2,1,'novo'],['abc','abc',0,8,'novo'],['abc','abc',0,2,'']])assert.throws(()=>excerpts.replaceExcerpt(...args));
for(const patch of [{text:'a'.repeat(3001)},{text:'CPF 12345678900'},{intent:'anything'},{label:''}])assert.throws(()=>excerpts.validateExcerpt({text:'Um trecho de método',label:'Métodos',intent:'improve',...patch}));
assert.deepEqual(Object.keys(excerpts.validateExcerpt({text:'Método escolhido',label:'Métodos',intent:'improve',fullDocument:'DO NOT SEND'})),['text','label','intent']);
const acknowledgements=[];
const out={...assist.simulatedOutput('guide'),recommendations:[{...assist.simulatedOutput('guide').recommendations[0],targetField:'guide_excerpt',content:'Texto revisado'}]};
assert.equal(actions.safeGuideActions(out).recommendations[0].targetField,'');assert.equal(actions.safeGuideActions(out,false,true).recommendations[0].targetField,'guide_excerpt');
// A suggested PubMed query must be executable before it can be handed to Radar.
for (const query of [
  '(sleep OR insomnia) AND (medical residents OR physicians)',
  '"Burnout, Professional"[MeSH Terms] OR burnout[Title/Abstract]',
  '"War and Peace"[Title/Abstract]',
  'sleep quality',
]) assert.equal(actions.validRadarDraft(query),true,query);
for (const query of [
  'sleep AND', 'AND sleep', '(sleep OR )', '( OR sleep)',
  'sleep OR OR physicians', '(sleep', '"unclosed', 'sleep[MeSH Terms',
  '()', 'sleep AND ()', 'sleep\nOR insomnia',
]) assert.equal(actions.validRadarDraft(query),false,query);
const suggested = {...out,recommendations:[{...out.recommendations[0],targetField:'guide_radar',content:'(sleep OR )'}]};
assert.equal(actions.safeGuideActions(suggested).recommendations[0].targetField,'');
assert.equal(actions.safeGuideActions({...suggested,recommendations:[{...suggested.recommendations[0],content:'sleep AND residents'}]}).recommendations[0].targetField,'guide_radar');
// The model must not attach invented effect sizes or significance to real citations.
const {groundGuideSources,quantitativeMarkers}=require('../lib/ai/guide-sources.ts');
const source={id:'article-id',label:'S1',title:'Real abstract',pmid:'123',doi:'',abstract:'The response was 15% after treatment; p=0.03 in this sample.',notes:'',truncated:false};
const quoted={id:'S1',kind:'abstract',quote:'The response was 15% after treatment; p=0.03 in this sample.'};
const groundedBase={...out,summary:'The response was 15%.',recommendations:[{...out.recommendations[0],content:'The response was 15%, with p=0.03.',source:JSON.stringify(quoted)}]};
assert.deepEqual(quantitativeMarkers('15% e p = 0,03'),['15%','p=0.03']);
assert(groundGuideSources(groundedBase,[source]).recommendations[0].source.includes('15%'));
assert.throws(()=>groundGuideSources({...groundedBase,recommendations:[{...groundedBase.recommendations[0],content:'The effect was 90%.'}]},[source]),/resultado quantitativo/);
const scrubbed=groundGuideSources({...groundedBase,summary:'The effect was 90%.'},[source]);
assert(!scrubbed.summary.includes('90%'),'Unsupported quantitative summary must not be displayed');
const partial=groundGuideSources({...groundedBase,recommendations:[{...groundedBase.recommendations[0],content:'The effect was 90%.'}]},[source],'pt-BR',true);
assert(!JSON.stringify(partial).includes('90%'),'Partial mode must drop unsupported effect sizes');
const state=[],effects=[];let cursor=0;const react={useState(v){const i=cursor++;if(!(i in state))state[i]=v;return[state[i],n=>state[i]=typeof n==='function'?n(state[i]):n];},useRef(v){const i=cursor++;return state[i]||={current:v};},useEffect(fn,deps){const i=cursor++,prev=state[i];if(!prev||deps.some((v,j)=>v!==prev.deps[j]))effects.push(()=>{prev?.cleanup?.();state[i]={deps,cleanup:fn()};});}};
const listeners=new Map(),events=[];class CustomEvent{constructor(type,{detail}){this.type=type;this.detail=detail;}}
const window={addEventListener:(type,cb)=>listeners.set(type,cb),removeEventListener:type=>listeners.delete(type),dispatchEvent:event=>{events.push(event);listeners.get(event.type)?.(event);}};
const jsx=(type,props)=>require("./i18n-test-support.cjs").jsx(type,props),moduleFixture={exports:{}};
vm.runInNewContext(compile('components/ai/excerpt-help.tsx'),{module:moduleFixture,exports:moduleFixture.exports,window,CustomEvent,crypto,Error,require:n=>{const localized=require("./i18n-test-support.cjs").dependency(n);if(localized)return localized;if(n==='react')return react;if(n==='react/jsx-runtime')return{jsx,jsxs:jsx};if(n==='@/lib/ai/guide-excerpt')return excerpts;throw Error(n);}});
let value='antes trecho depois',applies=0,disabled=false;const Component=moduleFixture.exports.default;
const render=()=>{cursor=0;const tree=Component({children:{type:'textarea',props:{}},value,label:'Métodos',projectId:'11111111-1111-4111-8111-111111111111',area:'protocolo',disabled,onApply:async(original,next)=>{assert.equal(original,value);value=next;applies++;return true;}});while(effects.length)effects.shift()();return tree;};
const nodes=t=>!t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(nodes):[t,...nodes(t.props?.children)],text=t=>typeof t==='string'?t:!t?'':Array.isArray(t)?t.map(text).join(''):text(t.props?.children);
const select=()=>render().props.onSelectCapture({target:{tagName:'TEXTAREA',value,selectionStart:6,selectionEnd:12}});
const prepare=()=>nodes(render()).find(n=>n.type==='button'&&text(n)==='Pedir ajuda ao assistente').props.onClick();
(async()=>{
 render();select();nodes(render()).find(n=>n.type==='select').props.onChange({target:{value:'improve'}});prepare();assert.equal(events.length,1);let req=events[0].detail;assert.equal(req.text,'trecho');assert.equal(req.intent,'improve');assert.equal(applies,0,'preparing never edits or calls AI');
 window.dispatchEvent(new CustomEvent('scholar-guide-apply-excerpt',{detail:{token:'foreign',text:'bad'}}));assert.equal(applies,0);
 window.dispatchEvent(new CustomEvent('scholar-guide-apply-excerpt',{detail:{token:req.token,text:'revisado',onResult:(ok,message)=>acknowledgements.push({ok,message})}}));window.dispatchEvent(new CustomEvent('scholar-guide-apply-excerpt',{detail:{token:req.token,text:'duplicado'}}));await new Promise(r=>setImmediate(r));assert.equal(applies,1);assert.equal(value,'antes revisado depois');assert.equal(acknowledgements.at(-1).ok,true);
 select();prepare();req=events.at(-1).detail;value+=' editado';render();window.dispatchEvent(new CustomEvent('scholar-guide-apply-excerpt',{detail:{token:req.token,text:'overwrite',onResult:(ok,message)=>acknowledgements.push({ok,message})}}));await new Promise(r=>setImmediate(r));assert.equal(applies,1);assert(text(render()).includes('O texto mudou'));assert.equal(acknowledgements.at(-1).ok,false);assert.match(acknowledgements.at(-1).message,/texto mudou/);
 console.log('PASS: excerpt validation, bounded payload, replacement actions, actual selection handoff, owner token correlation, duplicate apply lock and stale-edit protection.');
})().catch(e=>{console.error(e);process.exit(1);});
