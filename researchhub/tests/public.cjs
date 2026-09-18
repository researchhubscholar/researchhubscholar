const {PGlite}=require('@electric-sql/pglite');
const fs=require('fs');const assert=require('node:assert/strict');
(async()=>{const db=new PGlite();await db.exec('create role anon; create role authenticated;');await db.exec(fs.readFileSync('supabase/scholar_public.sql','utf8'));await db.exec('set role anon');const key='a'.repeat(64);for(const expected of [2,1,0,-1]){const r=await db.query("select scholar_public_quota($1,'radar') remaining",[key]);assert.equal(r.rows[0].remaining,expected);}
await assert.rejects(db.query('select * from scholar_contact_requests'),/permission denied/);await assert.rejects(db.query('select * from scholar_public_limits'),/permission denied/);
for(let i=0;i<5;i++){const r=await db.query("select scholar_contact_submit($1,'Teste','teste@example.org','support','Mensagem de teste válida') id",[key]);assert.ok(r.rows[0].id);}
await assert.rejects(db.query("select scholar_contact_submit($1,'Teste','teste@example.org','support','Mensagem de teste válida')",[key]),/Limite/);
await assert.rejects(db.query("select scholar_contact_submit($1,'Teste','invalido','support','Mensagem de teste válida')",['b'.repeat(64)]),/Confira/);
await db.exec('reset role');assert.equal((await db.query('select count(*)::int count from scholar_contact_requests')).rows[0].count,5);await db.close();console.log('Public SQL: quota, limits, validation and private contact storage passed');})().catch(e=>{console.error(e);process.exitCode=1});
