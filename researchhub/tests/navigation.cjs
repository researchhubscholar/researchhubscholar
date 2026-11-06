const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const navigationPath = path.join(__dirname, "..", "components", "session-navigation.tsx");
const source = fs.readFileSync(navigationPath, "utf8");
const middlewarePath = path.join(__dirname, "..", "middleware.ts");
const middleware = fs.readFileSync(middlewarePath, "utf8");

const publicPages = [
  "/",
  "/cadastro",
  "/cancelamento",
  "/como-funciona",
  "/contato",
  "/esqueci-senha",
  "/login",
  "/para-residencias",
  "/planos",
  "/privacidade",
  "/radar-demo",
  "/redefinir-senha",
  "/termos",
];

const privatePages = [
  "/dashboard",
  "/conta",
  "/contratacao",
  "/descobrir",
  "/ideias",
  "/biblioteca",
  "/meu-trabalho",
  "/documentos",
  "/licenca",
  "/orientacao",
  "/operacao",
  "/residencia",
  "/residencia/projeto",
  "/scholar/onboarding",
];

for (const route of [...publicPages, ...privatePages]) {
  const relative = route === "/" ? "app/page.tsx" : `app${route}/page.tsx`;
  assert.ok(
    fs.existsSync(path.join(__dirname, "..", relative)),
    `A página ativa ${route} não pode ser removida sem atualizar o contrato do produto.`,
  );
}

for (const route of privatePages) {
  const protectedPrefix = route === "/residencia/projeto" ? "/residencia" : route;
  assert.match(
    middleware,
    new RegExp(`"${protectedPrefix.replaceAll("/", "\\/")}"`),
    `A rota privada ${route} precisa continuar protegida no middleware.`,
  );
}

const requiredPrivateLinks = [
  ["/dashboard", "Meu espaço"],
  ["/descobrir", "Radar"],
  ["/ideias", "Ideias"],
  ["/biblioteca", "Biblioteca"],
  ["/meu-trabalho", "Meu projeto"],
  ["/orientacao", "Orientação"],
  ["/conta", "Conta"],
];

for (const [href, label] of requiredPrivateLinks) {
  assert.match(source, new RegExp(`\\["${href}", "${label}"\\]`));
}

assert.match(source, /\["\/operacao", "Operação"\]/);

assert.doesNotMatch(
  source,
  /links\.slice\(/,
  "A navegação não pode truncar os módulos disponíveis.",
);

console.log("product route and navigation contract passed");

const ts=require('typescript');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,filename);
const {returnNavigation}=require('../lib/navigation/return-link.ts');
for(const route of [...privatePages,'/resultados','/manuscrito','/geracoes/exemplo','/operacao/qualidade']) {
 if(route==='/dashboard') assert.equal(returnNavigation(route),null);
 else assert.deepEqual(returnNavigation(route),{href:'/dashboard',label:'Voltar ao meu espaço'});
}
for(const route of publicPages.filter(p=>p!=='/')) assert.equal(returnNavigation(route).href,'/');
assert.equal(returnNavigation('/'),null);
assert.equal(returnNavigation('/conta/').href,'/dashboard');
console.log('PASS: internal return links stay in workspace, nested routes included; public return links keep homepage.');

// Exercise the actual component while moving between public and workspace routes.
const vm=require('node:vm');
let locale='pt-BR';
const {translate}=require('../lib/i18n/locale.ts');
let pathname='/',session={authenticated:true,displayName:'Admin',isAdmin:true};
const moduleFixture={exports:{}};
const jsx=(type,props)=>({type,props});
const dependency=name=>{
 if(name==='@/lib/access/advisor-mode')return {};
 if(name==='react')return {useEffect(){},useState:()=>[session,()=>{}]};
 if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
 if(name==='next/navigation')return {usePathname:()=>pathname};
 if(name==='next/link')return {default:'link'};
 if(name==='@/components/i18n/language-provider')return {useLanguage:()=>({locale,t:key=>translate(locale,key)})};
 if(name==='@/components/i18n/language-selector')return {default:'language-selector'};
 if(name==='@/components/LogoutButton')return {default:'logout'};
 if(name==='@/lib/supabase/browser')return {supabaseBrowser:()=>{throw Error('No auth call during render');}};
 throw Error(name);
};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module:moduleFixture,exports:moduleFixture.exports,require:dependency});
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
const render=()=>nodes(moduleFixture.exports.default());
for(locale of ['pt-BR','es']){
pathname='/';session={authenticated:true,displayName:'Admin',isAdmin:true};
let rendered=render();assert.deepEqual(rendered.filter(n=>n.type==='link').map(n=>n.props.href),['/dashboard']);
assert(!rendered.some(n=>n.props?.className==='mobile-nav'));
assert(!rendered.some(n=>n.props?.['data-workspace']==='true'));
assert(rendered.some(n=>n.type==='link'&&n.props.children===(locale==='es'?'Mi espacio':'Meu espaço')));
pathname='/biblioteca';rendered=render();assert(rendered.some(n=>n.props?.['data-workspace']==='true'));assert(rendered.some(n=>n.props?.href==='/operacao'));
const workspaceLinks=rendered.filter(n=>n.type==='link').map(n=>n.props.href);
assert(workspaceLinks.indexOf('/ideias')<workspaceLinks.indexOf('/descobrir'));
assert(rendered.some(n=>n.type==='link'&&n.props.children===(locale==='es'?'Ideas':'Ideias')));
pathname='/';rendered=render();assert.deepEqual(rendered.filter(n=>n.type==='link').map(n=>n.props.href),['/dashboard'],'return from workspace cannot leak private modules into landing');
pathname='/planos';rendered=render();assert(!rendered.some(n=>n.props?.href==='/operacao'));assert(rendered.some(n=>n.props?.href==='/dashboard'));
session={authenticated:true,displayName:'Advisor',isAdmin:false,advisorOnly:true};pathname='/orientacao';rendered=render();assert.deepEqual([...new Set(rendered.filter(n=>n.type==='link').map(n=>n.props.href))],['/orientacao','/conta']);
session={authenticated:false,displayName:null,isAdmin:false};pathname='/';rendered=render();assert(rendered.some(n=>n.props?.href==='/como-funciona'));assert(rendered.some(n=>n.props?.href==='/login'));assert(!rendered.some(n=>n.props?.href==='/biblioteca'));
console.log(locale+' PASS: logged-in landing shows only workspace entry; public pages never render private/admin tabs, including after client navigation.');

}
