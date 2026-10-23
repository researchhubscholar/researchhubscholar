const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs'), assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();
 const a='00000000-0000-0000-0000-000000000001', b='00000000-0000-0000-0000-000000000002';
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 create table research_projects(id uuid primary key,owner_id uuid);
 create table library_articles(id int primary key,owner_id uuid,project_id uuid references research_projects on delete cascade);
 create table evidence_matrix(id int primary key,owner_id uuid,project_id uuid references research_projects on delete cascade);
 create table manuscripts(id int,project_id uuid references research_projects on delete cascade);
 insert into research_projects values ('${a}','${a}'),('${b}','${b}');
 insert into library_articles values(1,'${a}','${a}'),(2,'${b}','${b}');
 insert into evidence_matrix values(1,'${a}','${a}'),(2,'${b}','${b}');
 insert into manuscripts values(1,'${a}');
 grant select,update,delete on all tables in schema public to authenticated;
 alter table research_projects enable row level security;
 create policy own on research_projects for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());`);
 const sql=fs.readFileSync('supabase/scholar_project_delete.sql','utf8');
 await db.exec(sql); await db.exec(sql);
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}';`);
 await assert.rejects(db.query(`select scholar_delete_project('${b}')`),/sem permissão/);
 await db.query(`select scholar_delete_project('${a}')`);
 await assert.rejects(db.query(`select scholar_delete_project('${a}')`),/sem permissão/);
 await db.exec('reset role');
 assert.equal((await db.query('select * from research_projects')).rows.length,1);
 for(const table of ['library_articles','evidence_matrix']) {
  const rows=(await db.query(`select * from ${table} order by id`)).rows;
  assert.equal(rows.length,2);assert.equal(rows[0].project_id,null);assert.equal(rows[1].project_id,b);
 }
 assert.equal((await db.query('select * from manuscripts')).rows.length,0);
 await db.close();console.log('PASS: owner-only atomic deletion, library preservation, dependent cascade, repeat rejection and idempotent migration.');
})().catch(e=>{console.error(e);process.exit(1)});
