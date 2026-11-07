const fs=require("node:fs");
const assert=require("node:assert/strict");
const ts=require("typescript");
require.extensions[".ts"]=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const {localQuote}=require("../lib/access/commerce.ts");
assert.deepEqual(localQuote("individual","essential"),{unitAmountCents:59900,grossAmountCents:59900,tokenAllowance:3000000,seats:1,quantity:1});
assert.equal(localQuote("institutional","plus",30).grossAmountCents,2160000);
assert.equal(localQuote("institutional","plus",30).tokenAllowance,180000000);
assert.equal(localQuote("recharge","essential",1,2).grossAmountCents,15800);
assert.equal(localQuote("recharge","essential",1,2).tokenAllowance,2000000);
console.log("PASS: commercial quotes preserve annual licensing, flexible seats and optional recharge packs.");

assert.equal(localQuote("individual","plus").grossAmountCents,79900);
assert.equal(localQuote("individual","premium").grossAmountCents,99900);
(async()=>{
 const {PGlite}=require('@electric-sql/pglite');const db=new PGlite();
 try{
 await db.exec(`create table public.scholar_plan_catalog(audience text,plan text,annual_unit_cents integer,tokens_per_unit bigint,sort_order integer,active boolean);
 insert into public.scholar_plan_catalog values ('individual','essential',59900,3000000,10,true),('individual','plus',89900,6000000,20,true),('individual','premium',149900,12000000,30,false),('institutional','plus',72000,6000000,20,true);
 create table public.scholar_purchase_requests(total_amount_cents integer);insert into public.scholar_purchase_requests values (149900);`);
 const sql=fs.readFileSync('supabase/scholar_individual_prices_20261105.sql','utf8');
 await db.exec(sql);await db.exec(sql);
 const {rows}=await db.query('select * from public.scholar_plan_catalog order by audience,sort_order');
 assert.deepEqual(rows.filter(r=>r.audience==='individual').map(r=>r.annual_unit_cents),[59900,79900,99900]);
 assert.deepEqual(rows.filter(r=>r.audience==='individual').map(r=>Number(r.tokens_per_unit)),[3000000,6000000,12000000]);
 assert.equal(rows.find(r=>r.audience==='institutional').annual_unit_cents,72000);
 assert.equal(rows.find(r=>r.plan==='premium').active,false);
 assert.equal((await db.query('select total_amount_cents from public.scholar_purchase_requests')).rows[0].total_amount_cents,149900);
 console.log('PASS: individual prices update idempotently while preserving quotas, availability, institutional prices and historical orders.');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
