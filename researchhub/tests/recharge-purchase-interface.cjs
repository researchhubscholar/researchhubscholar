const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const fixture=require('./i18n-test-support.cjs');
const purchase='11111111-1111-4111-8111-111111111111',license='22222222-2222-4222-8222-222222222222';
const nodes=t=>!t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(nodes):[t,...nodes(t.props?.children)];
const tick=()=>new Promise(r=>setImmediate(r));
function harness(order){
 const effects=[],redirects=[],rpc=[],http=[],filters=[];
 const state={0:'buyer',8:[{id:license,plan:'essential',status:'active'}],9:true,10:license,12:false,15:{grossAmountCents:59900,discountCents:0,totalAmountCents:59900,tokenAllowance:3000000},16:false,18:{totalAmountCents:7900,tokenAllowance:1000000}};
 let cursor=0;
 const react={useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v}]},useMemo:f=>f(),useEffect:f=>effects.push(f)};
 const client={auth:{getUser:async()=>({data:{user:{id:'buyer'}}})},rpc:async(name,args)=>{rpc.push({name,args});return {data:purchase,error:null}},from(table){const q={select(){return q},eq(k,v){filters.push([k,v]);return q},maybeSingle:async()=>({data:order,error:null})};return q}};
 const code=ts.transpileModule(fs.readFileSync('app/contratacao/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const box={exports:{},URL,Date,console,window:{location:{href:'https://researchhub.com.br/contratacao?pedido='+purchase+'&pagamento=retorno',assign:u=>redirects.push(u)}},setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},fetch:async(url,init)=>{http.push({url,body:JSON.parse(init.body)});return Response.json({url:'https://asaas.com/checkoutSession/show?id=checkout-valid'})},require(name){
  if(name==='react')return react;if(name==='react/jsx-runtime')return {jsx:fixture.jsx,jsxs:fixture.jsx};if(name==='next/link')return {default:'Link'};
  if(name==='@/lib/supabase/browser')return {supabaseBrowser:()=>client};
  if(name==='@/lib/access/commerce')return require('../lib/access/commerce.ts');if(name==='@/lib/access/plans')return require('../lib/access/plans.ts');
  if(name==='@/lib/i18n/public-design-copy')return require('../lib/i18n/public-design-copy.ts');if(name==='@/lib/i18n/advisor-copy')return require('../lib/i18n/advisor-copy.ts');
  const d=fixture.dependency(name);if(d)return d;throw Error(name);
 }};
 vm.runInNewContext(code,box);
 const render=()=>{cursor=0;return box.exports.default()};
 return {render,effects,redirects,rpc,http,filters};
}
(async()=>{
 const h=harness({status:'payment_pending',fulfilled_license_id:null,kind:'recharge'});
 const button=nodes(h.render()).find(n=>n.type==='button'&&JSON.stringify(n.props.children).includes('Comprar tokens extras'));
 assert(button);assert.equal(button.props.disabled,false);await button.props.onClick();
 assert.equal(h.rpc.length,1);assert.equal(h.rpc[0].name,'scholar_create_purchase_request');assert.equal(h.rpc[0].args.p_kind,'recharge');assert.equal(h.rpc[0].args.p_target_license,license);assert.equal(h.rpc[0].args.p_quantity,1);
 assert.equal(h.http.length,1);assert.equal(h.http[0].url,'/api/asaas/checkout');assert.equal(h.http[0].body.requestId,purchase);assert.match(h.redirects[0],/^https:\/\/asaas\.com\//);
 for(const [order,expected] of [[{status:'payment_pending',fulfilled_license_id:null,kind:'recharge'},null],[{status:'activated',fulfilled_license_id:null,kind:'recharge'},null],[{status:'activated',fulfilled_license_id:license,kind:'recharge'},'/licenca'],[{status:'activated',fulfilled_license_id:license,kind:'individual'},'/dashboard']]){
  const r=harness(order);r.render();const cleanup=r.effects[1]();await tick();await tick();
  assert.deepEqual(r.redirects,expected?[expected]:[]);
  assert(r.filters.some(([k,v])=>k==='requester_id'&&v==='buyer'));cleanup();
 }
 console.log('PASS: the real purchase page sends recharge orders to Asaas and returns only after server-confirmed fulfillment.');
})().catch(e=>{console.error(e);process.exitCode=1});
