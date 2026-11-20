const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
function compiled(file, imports={}) {
 const src=fs.readFileSync(file,'utf8');
 const code=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const box={exports:{},require:name=>name in imports?imports[name]:require(name),process,Buffer,Request,Response,Headers,crypto,console:{log(){},info(){},warn(){},error(){}}};
 vm.runInNewContext(code,box,{filename:file}); return box.exports;
}
const parsed=compiled('lib/access/asaas-webhook.ts');
const {hasWorkspaceLicense}=compiled('lib/access/workspace-license.ts');
const {walletsForOperation}=compiled('lib/ai/wallet-selection.ts');
const originalWebhookToken=process.env.ASAAS_WEBHOOK_TOKEN;
const secret='isolated-audit-secret-'.repeat(3);
const outputs=[];let db,uid,oid,checkout;
const admin={
 from(table) {
  let conditions=[],mutation=null;
  const b={select(){return b},update(data){mutation=data;return b},eq(k,v){conditions.push([k,v]);return b},
   async maybeSingle(){let where=conditions.map(([k],i)=>`${k}=$${i+1}`).join(' and ');const r=await db.query(`select * from public.${table} where ${where}`,conditions.map(([,v])=>v));return {data:r.rows[0]??null,error:null}},
   then(resolve,reject){if(!mutation)return Promise.resolve({data:[],error:null}).then(resolve,reject);const entries=Object.entries(mutation),values=entries.map(([,v])=>v).concat(conditions.map(([,v])=>v));const set=entries.map(([k],i)=>`${k}=$${i+1}`).join(','),where=conditions.map(([k],i)=>`${k}=$${entries.length+i+1}`).join(' and ');return db.query(`update public.${table} set ${set} where ${where}`,values).then(()=>({data:null,error:null}),e=>({data:null,error:{code:e.code}})).then(resolve,reject)}
  };return b;
 },
 async rpc(name,args){try{const r=await db.query(`select public.${name}($1,$2,$3,$4) as value`,[args.p_request,args.p_provider_event,args.p_provider_payment,args.p_provider_subscription]);return {data:r.rows[0].value,error:null}}catch(e){return {data:null,error:{code:e.code,message:e.message}}}}
};
const handler=compiled('app/api/webhooks/asaas/route.ts',{'next/server':{NextResponse:{json:(v,o)=>Response.json(v,o)}},'@/lib/supabase/admin':{supabaseAdmin:()=>admin},'@/lib/access/asaas-webhook':parsed}).POST;
async function send(payload,token=secret){const response=await handler(new Request('https://isolated.test/api/webhooks/asaas',{method:'POST',headers:{'asaas-access-token':token,'content-type':'application/json'},body:JSON.stringify(payload)}));return {status:response.status,body:await response.json()}}
function event(id='evt_isolated_payment_01',extra={}){return {id,event:'CHECKOUT_PAID',checkout:{id:checkout,status:'PAID',externalReference:oid,items:[{quantity:1,value:599}]},...extra}}
async function count(table){return Number((await db.query(`select count(*) as n from ${table}`)).rows[0].n)}
async function seedOrder(user=uid){const id=crypto.randomUUID(),ch='ch_isolated_'+crypto.randomUUID();await db.query(`insert into scholar_purchase_requests(id,requester_id,kind,plan,unit_amount_cents,gross_amount_cents,total_amount_cents,token_allowance,status,provider_checkout_id) values($1,$2,'individual','essential',59900,59900,59900,3000000,'payment_pending',$3)`,[id,user,ch]);return [id,ch]}
(async()=>{
 process.env.ASAAS_WEBHOOK_TOKEN=secret;
 db=new PGlite();
 await db.exec('create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); create table public.research_projects(id uuid primary key,owner_id uuid);');
 const access=fs.readFileSync('supabase/scholar_access.sql','utf8').split('-- SECURITY DEFINER')[0].replace('begin;','');
 const commerce=fs.readFileSync('supabase/scholar_commerce.sql','utf8').split('alter table public.scholar_commerce_settings enable')[0].replace('begin;','');
 await db.exec(access);await db.exec(commerce);
 const fn=fs.readFileSync('supabase/scholar_commerce.sql','utf8').match(/create or replace function public\.scholar_fulfill_paid_request\([\s\S]*?end \$\$;/)[0];
 // Exercise the migration against the previous function as well as its already-fixed state.
 await db.exec(fn.replaceAll('paid_license_id','license_id'));
 const migration=fs.readFileSync('supabase/scholar_paid_license_renewal_20261120.sql','utf8');
 await db.exec(migration); await db.exec(migration);
 uid=crypto.randomUUID();await db.query('insert into auth.users values($1)',[uid]);[oid,checkout]=await seedOrder();
 assert.equal(hasWorkspaceLicense(uid,[],[]),false);assert.equal(await count('scholar_wallets'),0);
 outputs.push('PASS fresh account without license has no workspace entitlement or wallet');
 assert.equal((await send(event(),'incorrect')).status,401);
 assert.equal((await send(event(undefined,{event:'CHECKOUT_CREATED'}))).body.ignored,true);
 assert.equal((await send(event(undefined,{checkout:{...event().checkout,status:'ACTIVE'}}))).status,422);
 assert.equal(await count('scholar_licenses'),0);
 outputs.push('PASS invalid token, checkout creation and unpaid status cannot grant access');
 assert.equal((await send(event(undefined,{checkout:{...event().checkout,items:[{quantity:1,value:1}]}}))).status,409);
 assert.equal((await send(event(undefined,{checkout:{...event().checkout,externalReference:crypto.randomUUID()}}))).status,409);
 assert.equal((await send(event(undefined,{checkout:{...event().checkout,id:'ch_missing_checkout'}}))).status,503);
 assert.equal(await count('scholar_licenses'),0);
 outputs.push('PASS wrong amount, wrong reference and unknown checkout cannot activate');
 assert.equal((await send(event())).status,503);assert.equal(await count('scholar_licenses'),0);
 outputs.push('PASS payments_enabled=false prevents fulfillment');
 await db.exec('update scholar_commerce_settings set payments_enabled=true,ai_enabled=true where id=true');
 const paid=await send(event());assert.equal(paid.status,200);assert.equal(paid.body.activated,true);
 let lic=(await db.query('select * from scholar_licenses where owner_id=$1',[uid])).rows[0];
 let wallet=(await db.query('select * from scholar_wallets where user_id=$1',[uid])).rows[0];
 assert.equal(lic.status,'active');assert.equal(lic.mode,'live');assert.equal(lic.plan,'essential');
 assert.equal(Number(wallet.allowance),3000000);assert.equal(Number(wallet.used),0);assert.equal(Number(wallet.reserved),0);
 assert.equal(hasWorkspaceLicense(uid,[{...lic,starts_at:String(lic.starts_at),ends_at:String(lic.ends_at)}],[]),true);
 const eligible=walletsForOperation([{wallet,license:{...lic,starts_at:String(lic.starts_at),ends_at:String(lic.ends_at)}}],null,10000);
 assert.equal(eligible.length,1);
 assert.equal(new Date(lic.ends_at).getUTCFullYear(),new Date(lic.starts_at).getUTCFullYear()+1);
 outputs.push('PASS confirmed payment creates active live annual license, correct wallet and AI admission eligibility');
 const repeat=await send(event());assert.equal(repeat.status,200);assert.equal(repeat.body.alreadyActivated,true);
 const other=await send(event('evt_isolated_payment_02'));assert.equal(other.body.alreadyActivated,true);
 assert.equal(await count('scholar_licenses'),1);assert.equal(await count('scholar_wallets'),1);assert.equal(await count('scholar_payment_events'),1);
 assert.equal(Number((await db.query('select allowance from scholar_wallets')).rows[0].allowance),3000000);
 outputs.push('PASS webhook retry and second paid notification do not duplicate license or tokens');
 const otherUser=crypto.randomUUID();await db.query('insert into auth.users values($1)',[otherUser]);
 [oid,checkout]=await seedOrder(otherUser);assert.equal((await send(event('evt_separate_account'))).body.activated,true);
 await db.query('update scholar_wallets set used=1200,reserved=2000 where user_id=$1',[uid]);
 const oldEnd=new Date(lic.ends_at);
 [oid,checkout]=await seedOrder();
 const renewal=await send(event('evt_isolated_renewal_01'));
 assert.equal(renewal.status,200);assert.equal(renewal.body.activated,true);
 const renewed=(await db.query('select * from scholar_licenses where owner_id=$1',[uid])).rows[0];
 const renewedWallet=(await db.query('select * from scholar_wallets where user_id=$1',[uid])).rows[0];
 assert.equal(renewed.id,lic.id);assert.equal(new Date(renewed.ends_at).getUTCFullYear(),oldEnd.getUTCFullYear()+1);
 assert.equal(Number(renewed.token_allowance),6000000);assert.equal(Number(renewedWallet.allowance),6000000);
 assert.equal(Number(renewedWallet.used),1200);assert.equal(Number(renewedWallet.reserved),2000);
 assert.equal(Number((await db.query('select allowance from scholar_wallets where user_id=$1',[otherUser])).rows[0].allowance),3000000);
 assert.equal((await send(event('evt_isolated_renewal_01'))).body.alreadyActivated,true);
 assert.equal(Number((await db.query('select allowance from scholar_wallets where user_id=$1',[uid])).rows[0].allowance),6000000);
 outputs.push('PASS renewal extends the existing license once, preserves used and reserved tokens and leaves other accounts untouched');
 for(const [plan,price,tokens] of [['plus',79900,6000000],['premium',99900,12000000]]){
  const planUser=crypto.randomUUID();await db.query('insert into auth.users values($1)',[planUser]);
  [oid,checkout]=await seedOrder(planUser);
  await db.query('update scholar_purchase_requests set plan=$1,unit_amount_cents=$2,gross_amount_cents=$2,total_amount_cents=$2,token_allowance=$3 where id=$4',[plan,price,tokens,oid]);
  const payload=event('evt_plan_'+plan);payload.checkout.items=[{quantity:1,value:price/100}];
  assert.equal((await send(payload)).body.activated,true);
  const granted=(await db.query('select l.plan,l.mode,w.allowance from scholar_licenses l join scholar_wallets w on w.license_id=l.id where l.owner_id=$1',[planUser])).rows[0];
  assert.equal(granted.plan,plan);assert.equal(granted.mode,'live');assert.equal(Number(granted.allowance),tokens);
  outputs.push('PASS '+plan+' purchase grants its own plan and token allowance');
 }
 const user2=crypto.randomUUID();await db.query('insert into auth.users values($1)',[user2]);[oid,checkout]=await seedOrder(user2);
 await db.exec('update scholar_commerce_settings set ai_enabled=false where id=true');
 const sim=await send(event('evt_isolated_no_live_flag'));assert.equal(sim.body.activated,true);
 const simLic=(await db.query('select mode from scholar_licenses where owner_id=$1',[user2])).rows[0];assert.equal(simLic.mode,'simulation');
 outputs.push('PASS reproduced configuration risk: payment with ai_enabled=false creates simulation license');
 await db.exec(fn.replace('declare req','-- unexpected independent change\ndeclare req'));
 await assert.rejects(db.exec(migration),/difere da versão revisada/);await db.exec('rollback');
 outputs.push('PASS migration rejects unexpected database definitions instead of overwriting them');
 console.log(outputs.join('\n'));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(db)await db.close();if(originalWebhookToken===undefined)delete process.env.ASAAS_WEBHOOK_TOKEN;else process.env.ASAAS_WEBHOOK_TOKEN=originalWebhookToken});
