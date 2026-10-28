const fs=require('node:fs'),assert=require('node:assert/strict'),{PGlite}=require('@electric-sql/pglite');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
(async()=>{
 const db=new PGlite();await db.exec(`create role authenticated;create role anon;create role service_role;create schema auth;create schema extensions;create schema storage;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.user',true),'')::uuid$$;
 create function auth.role() returns text language sql as $$select 'authenticated'::text$$;
 grant usage on schema auth to authenticated,anon,service_role;grant execute on all functions in schema auth to authenticated,anon,service_role;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz default now(),raw_user_meta_data jsonb default '{}');
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);
 create table storage.objects(id uuid primary key,owner_id text,owner uuid);
 create function gen_random_bytes(n integer) returns bytea language sql as $$select decode(md5(random()::text),'hex')$$;
 create function digest(v text,a text) returns bytea language sql as $$select decode(md5(v),'hex')$$;`);
 const manifest=JSON.parse(fs.readFileSync('supabase/migrations-manifest.json','utf8'));
 for(const f of manifest.files.filter(f=>f.kind==='schema'))await db.exec(fs.readFileSync('supabase/'+f.file,'utf8').replace('create extension if not exists "pgcrypto";',''));
 await db.exec(fs.readFileSync('supabase/scholar_account_deletion.sql','utf8'));
 const A=id(1),U=id(2),V=id(3),S=id(4),P=id(10),Q=id(11),O=id(12),M=id(13);
 for(const [u,email] of [[A,'owner@test'],[U,'target@test'],[V,'other@test'],[S,'support@test']])await db.query('insert into auth.users(id,email) values($1,$2)',[u,email]);
 await db.query("insert into scholar_platform_admins(user_id,role) values($1,'owner'),($2,'support')",[A,S]);
 const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
 const as=async(user,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('test.user',$1,false)",[user]);await db.exec('set role '+role);};
 await db.exec('grant select,insert,update,delete on research_projects,library_articles,evidence_matrix to authenticated;');
 await as(U);const R=await scalar('select scholar_request_account_deletion()');
 await assert.rejects(db.query('select scholar_deletion_claim($1,$2,$3)',[A,R,'target@test']),/permission denied/);
 await as(A,'service_role');await assert.rejects(db.query('select scholar_deletion_claim($1,$2,$3)',[S,R,'target@test']),/OWNER_REQUIRED/);
 await assert.rejects(db.query('select scholar_deletion_claim($1,$2,$3)',[A,R,'target@test']),/TOO_EARLY/);
 await db.exec('reset role');await db.query("update scholar_account_requests set requested_at=now()-interval '8 days',scheduled_for=now()-interval '1 day' where id=$1",[R]);await as(A,'service_role');
 await assert.rejects(db.query('select scholar_deletion_claim($1,$2,$3)',[A,R,'wrong@test']),/CONFIRMATION_REQUIRED/);
 await db.exec('reset role');await db.query("insert into scholar_organizations(id,name) values($1,'Org')",[O]);await db.query("insert into scholar_memberships(organization_id,user_id,role) values($1,$2,'director')",[O,U]);await as(A,'service_role');await assert.rejects(db.query('select scholar_deletion_claim($1,$2,$3)',[A,R,'target@test']),/BLOCKED/);
 await db.exec('reset role');await db.query("insert into scholar_memberships(organization_id,user_id,role) values($1,$2,'director')",[O,V]);
 // Both legacy and current Storage ownership are checked. Metadata is never deleted by this flow.
 for(const column of ['owner','owner_id']){await db.query(`insert into storage.objects(id,${column}) values($1,$2)`,[id(100),U]);await as(A,'service_role');await assert.rejects(db.query('select scholar_deletion_claim($1,$2,$3)',[A,R,'target@test']),/BLOCKED/);await db.exec('reset role');await db.query('delete from storage.objects where id=$1',[id(100)]);}
 // In-flight generations must settle before deleting their account.
 await db.query("insert into scholar_licenses(id,owner_id,plan,ends_at,token_allowance) values($1,$2,'essential',now()+interval '1 year',10000)",[id(110),U]);await db.query('insert into scholar_wallets(id,license_id,user_id,allowance) values($1,$2,$3,10000)',[id(111),id(110),U]);await db.query("insert into scholar_usage(id,wallet_id,user_id,feature,model,mode,reserved_tokens) values($1,$2,$3,'protocol','test','simulation',10000)",[id(112),id(111),U]);await as(A,'service_role');await assert.rejects(db.query('select scholar_deletion_claim($1,$2,$3)',[A,R,'target@test']),/BLOCKED/);await db.exec('reset role');await db.query("update scholar_usage set status='failed' where id=$1",[id(112)]);
 await db.query('insert into research_projects(id,owner_id,title) values($1,$2,$3),($4,$5,$6)',[P,U,'PRIVATE TARGET',Q,V,'KEEP OTHER']);
 await db.query("insert into library_articles(id,owner_id,project_id,title,pmid) values($1,$2,$3,'PRIVATE ARTICLE','123'),($4,$5,$6,'KEEP ARTICLE','456')",[id(20),U,P,id(21),V,Q]);
 await db.query("insert into evidence_matrix(owner_id,project_id,article_id,notes) values($1,$2,$3,'PRIVATE NOTES')",[U,P,id(20)]);
 await db.query("insert into scholar_manuscripts(id,project_id,owner_id,title) values($1,$2,$3,'PRIVATE MANUSCRIPT')",[M,P,U]);await db.query("insert into scholar_manuscript_sections(manuscript_id,owner_id,section_key,heading,content) values($1,$2,'methods','Métodos','PRIVATE TEXT')",[M,U]);await db.query("insert into scholar_manuscript_versions(manuscript_id,owner_id,label,snapshot) values($1,$2,'Versão','{}')",[M,U]);
 await db.query("insert into scholar_project_results(project_id,owner_id,workspace) values($1,$2,'{}')",[P,U]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[id(22),U]);
 await as(A,'service_role');const claimed=await scalar('select scholar_deletion_claim($1,$2,$3)',[A,R,'TARGET@test']);assert.equal(claimed.userId,U);
 await assert.rejects(db.query('select scholar_deletion_claim($1,$2,$3)',[A,R,'target@test']),/BUSY/);
 await as(U);assert.equal(await scalar('select scholar_cancel_account_deletion($1)',[R]),false);assert.equal((await db.query('select * from scholar_account_deletion_runs')).rows.length,1);assert.equal(await scalar('select scholar_request_account_deletion()'),R);
 await as(V);assert.equal((await db.query('select * from scholar_account_deletion_runs')).rows.length,0);
 await as(A,'service_role');assert.equal((await scalar("select scholar_deletion_finish($1,$2,'uncertain')",[A,R])).state,'processing');assert.equal((await scalar("select scholar_deletion_finish($1,$2,'check')",[A,R])).state,'processing');
 assert.equal((await scalar("select scholar_deletion_finish($1,$2,'rejected')",[A,R])).state,'failed');await as(U);assert.equal(await scalar('select scholar_cancel_account_deletion($1)',[R]),true);await as(A,'service_role');await assert.rejects(db.query('select scholar_deletion_claim($1,$2,$3)',[A,R,'target@test']),/NOT_PENDING/);
 await as(U);const R2=await scalar('select scholar_request_account_deletion()');await db.exec('reset role');await db.query("update scholar_account_requests set requested_at=now()-interval '8 days',scheduled_for=now()-interval '1 day' where id=$1",[R2]);await as(A,'service_role');await scalar('select scholar_deletion_claim($1,$2,$3)',[A,R2,'target@test']);
 // Guard also rechecks institutional changes after admission, in the actual deletion transaction.
 await db.exec('reset role');await db.query("update scholar_memberships set active=false where user_id=$1",[V]);await assert.rejects(db.query('delete from auth.users where id=$1',[U]),/GUARD_BLOCKED/);assert.equal(await scalar('select count(*)::int from auth.users where id=$1',[U]),1);await db.query("update scholar_memberships set active=true where user_id=$1",[V]);
 await db.query('delete from auth.users where id=$1',[U]); // Synthetic substitute for the Auth API transaction, never a real user.
 for(const [table,column] of [['profiles','id'],['research_projects','owner_id'],['library_articles','owner_id'],['evidence_matrix','owner_id'],['scholar_manuscripts','owner_id'],['scholar_manuscript_sections','owner_id'],['scholar_manuscript_versions','owner_id'],['scholar_project_results','owner_id'],['auth.sessions','user_id']])assert.equal(await scalar(`select count(*)::int from ${table} where ${column}=$1`,[U]),0,table);
 assert.equal(await scalar('select title from research_projects where id=$1',[Q]),'KEEP OTHER');assert.equal(await scalar('select title from library_articles where id=$1',[id(21)]),'KEEP ARTICLE');
 await as(A,'service_role');const done=await scalar("select scholar_deletion_finish($1,$2,'check')",[A,R2]);assert.equal(done.state,'completed');assert.equal((await scalar('select scholar_deletion_claim($1,$2,$3)',[A,R2,'target@test'])).state,'completed');
 const report=await scalar('select scholar_deletion_review($1)',[A]);assert(report.checks.every(c=>c.tablePresent&&c.rlsEnabled&&c.functionPresent));assert(!JSON.stringify(report.runs).includes('PRIVATE'));assert(!JSON.stringify(report.runs).includes('target@test'));
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select scholar_deletion_review($1)',[A]),/permission denied/);await db.close();console.log('PASS: full migration install/rerun, private RPCs, seven-day/email/owner/director/Storage guards, cancel/claim fencing, uncertain recovery, deletion-time rechecks, cascading synthetic account deletion, third-party preservation and durable minimal receipts.');
})().catch(e=>{console.error(e);process.exit(1)});
