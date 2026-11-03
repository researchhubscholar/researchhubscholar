const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
require.extensions['.ts']=(module,file)=>module._compile(compile(file),file);
const core=require('../lib/i18n/locale.ts'),catalog=require('../lib/i18n/catalog.ts');
function load(file,deps,globals={}){const module={exports:{}};vm.runInNewContext(compile(file),{module,exports:module.exports,...globals,require:name=>{if(name in deps)return deps[name];throw Error(name);}});return module.exports;}
const jsx=(type,props)=>({type,props});let savedState,context;
const react={createContext:()=>({Provider:'provider'}),useContext:()=>context,useState:value=>{if(savedState===undefined)savedState=value;return[savedState,next=>{savedState=next;}];}};
const doc={cookie:'',documentElement:{lang:'pt-BR'}},child={draft:'Minha pergunta científica original',notes:'Notas sem tradução'};
const provider=load('components/i18n/language-provider.tsx',{'react':react,'react/jsx-runtime':{jsx,jsxs:jsx},'@/lib/i18n/locale':core},{document:doc,window:{location:{protocol:'https:'}}});
let tree=provider.default({initialLocale:'pt-BR',children:child});context=tree.props.value;assert.equal(context.locale,'pt-BR');assert.equal(context.t('nav.ideas'),'Ideias');
context.setLocale('es');tree=provider.default({initialLocale:'pt-BR',children:child});context=tree.props.value;
assert.equal(context.t('nav.ideas'),'Ideas');assert.equal(doc.documentElement.lang,'es');assert.ok(doc.cookie.includes('scholar_locale=es'));assert.ok(doc.cookie.endsWith('; Secure'));assert.equal(tree.props.children,child);assert.equal(child.draft,'Minha pergunta científica original');
context.setLocale('pt-BR');tree=provider.default({initialLocale:'pt-BR',children:child});context=tree.props.value;assert.equal(context.t('nav.workspace'),'Meu espaço');assert.equal(child.notes,'Notas sem tradução');
let selected,refreshes=0;
const selector=load('components/i18n/language-selector.tsx',{'react':{startTransition:fn=>fn()},'next/navigation':{useRouter:()=>({refresh(){refreshes++;}})},'./language-provider':{useLanguage:()=>({locale:'pt-BR',setLocale:value=>selected=value,t:key=>catalog.portuguese[key]})},'@/lib/i18n/locale':core,'react/jsx-runtime':{jsx,jsxs:jsx}});
const choice=selector.default().props.children.find(node=>node?.type==='select');choice.props.onChange({target:{value:'es'}});assert.equal(selected,'es');assert.equal(refreshes,1);choice.props.onChange({target:{value:'invalid'}});assert.equal(selected,'pt-BR');assert.equal(refreshes,2);
console.log('PASS: actual provider switches/restores locale and cookie without replacing child drafts; selector refreshes server UI without navigation/reload.');
