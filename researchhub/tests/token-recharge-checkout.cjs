const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const orderId='11111111-1111-4111-8111-111111111111',licenseId='22222222-2222-4222-8222-222222222222';
const checkoutId='33333333-3333-4333-8333-333333333333';
function load(file,deps){const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const box={exports:{},require:n=>n==='server-only'?{}:n in deps?deps[n]:require(n),process,Request,Response,URL,AbortSignal,fetch:(...args)=>global.fetch(...args),console:{error(){}}};vm.runInNewContext(code,box);return box.exports;}
const payments=load('lib/payments/asaas.ts',{});
const original={...process.env};
async function scenario(options={}){
 const row={id:orderId,requester_id:'buyer',kind:'recharge',plan:null,status:'requested',billing_schedule:'annual',total_amount_cents:7900,provider_checkout_id:null,coupon_code:null,gross_amount_cents:7900,discount_cents:0,target_license_id:licenseId,token_allowance:1000000,...options.order};
 const filters=[],calls=[];let linked=false;
 const license={id:licenseId,status:'active',starts_at:'2000-01-01',ends_at:'2100-01-01',...options.license};
 const admin={from(table){let updating=false;const chain={select(){return chain},eq(k,v){filters.push([table,k,v]);return chain},in(){return chain},is(){return chain},update(){updating=true;return chain},async maybeSingle(){if(table==='scholar_commerce_settings')return {data:{payments_enabled:options.payments!==false,ai_enabled:options.ai!==false},error:null};if(updating){linked=true;return {data:{id:orderId},error:null}}return {data:options.foreign?null:row,error:null}}};return chain}};
 const session={auth:{getUser:async()=>({data:{user:options.signedOut?null:{id:'buyer'}},error:null})},from(){const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:options.invisibleLicense?null:license,error:null})};return q}};
 const handler=load('app/api/asaas/checkout/route.ts',{
  'next/server':{NextResponse:{json:(b,o)=>Response.json(b,o)}},'@/lib/supabase/admin':{supabaseAdmin:()=>admin},'@/lib/supabase/server':{supabaseServer:async()=>session},'@/lib/payments/asaas':payments,'@/lib/ai/config':{scholarAIReady:options.ready!==false}
 });
 const saved=global.fetch;
 global.fetch=async(url,init)=>{calls.push({url,init,body:JSON.parse(init.body)});return Response.json({id:checkoutId})};
 try{const response=await handler.POST(new Request('https://local.test/api/asaas/checkout',{method:'POST',body:JSON.stringify({requestId:orderId,total_amount_cents:1,token_allowance:999999999})}));return {status:response.status,body:await response.json(),calls,filters,linked}}
 finally{global.fetch=saved}
}
(async()=>{
 process.env.ASAAS_API_KEY='test-only';process.env.ASAAS_ENVIRONMENT='production';process.env.NEXT_PUBLIC_SITE_URL='https://researchhub.com.br';process.env.RESEARCHHUB_ASAAS_CHECKOUT_READY='true';
 const ok=await scenario();assert.equal(ok.status,200);assert.equal(ok.calls.length,1);assert.equal(ok.linked,true);
 assert(ok.filters.some(([t,k,v])=>t==='scholar_purchase_requests'&&k==='requester_id'&&v==='buyer'));
 assert.equal(ok.calls[0].body.items[0].value,79);assert.match(ok.calls[0].body.items[0].description,/1\.000\.000 tokens/);
 assert.deepEqual(ok.calls[0].body.billingTypes,['PIX','CREDIT_CARD']);assert.deepEqual(ok.calls[0].body.chargeTypes,['DETACHED']);
 assert.equal(ok.calls[0].body.externalReference,orderId);
 assert.equal(ok.calls[0].body.callback.successUrl,`https://researchhub.com.br/contratacao?pedido=${orderId}&pagamento=retorno`);
 assert.match(ok.body.url,/asaas\.com/);
 for(const [options,status] of [[{signedOut:true},401],[{foreign:true},409],[{invisibleLicense:true},409],[{license:{status:'expired'}},409],[{license:{ends_at:'2001-01-01'}},409],[{ready:false},503],[{payments:false},503],[{ai:false},503],[{order:{kind:'institutional'}},422],[{order:{target_license_id:null}},422],[{order:{token_allowance:0}},422],[{order:{billing_schedule:'12x'}},422]]){
  const r=await scenario(options);assert.equal(r.status,status,JSON.stringify(options));assert.equal(r.calls.length,0,'No charge before authorization/readiness checks');assert.equal(r.linked,false);
 }
 const repeat=await scenario({order:{provider_checkout_id:checkoutId}});assert.equal(repeat.status,200);assert.equal(repeat.calls.length,0);
 process.env.RESEARCHHUB_ASAAS_CHECKOUT_READY='false';const gated=await scenario();assert.equal(gated.status,503);assert.equal(gated.calls.length,0);
 console.log('PASS: recharge checkout uses the owned server quote, validates active license and AI readiness, supports Pix/card and never grants tokens from a browser callback.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{for(const key of ['ASAAS_API_KEY','ASAAS_ENVIRONMENT','NEXT_PUBLIC_SITE_URL','RESEARCHHUB_ASAAS_CHECKOUT_READY']){if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key]}});
