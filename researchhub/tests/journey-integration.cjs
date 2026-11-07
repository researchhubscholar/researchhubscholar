const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');

(async () => {
  const db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create role service_role; create schema auth; create schema extensions;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.user',true),'')::uuid$$;
    create function auth.role() returns text language sql as $$select 'authenticated'::text$$;
    grant usage on schema auth to authenticated,anon; grant execute on all functions in schema auth to authenticated,anon;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz default now(),raw_user_meta_data jsonb default '{}');
    create function gen_random_bytes(n integer) returns bytea language sql as $$select decode(md5(random()::text),'hex')$$;
    create function digest(v text,a text) returns bytea language sql as $$select decode(md5(v),'hex')$$;`);
  for (const file of ['scholar_install.sql','scholar_access.sql','scholar_project_origins.sql','scholar_manuscript.sql','scholar_results.sql','scholar_safe_saves.sql']) {
    await db.exec(fs.readFileSync('supabase/' + file, 'utf8').replace('create extension if not exists "pgcrypto";', ''));
  }
  // The base installer relies on Supabase platform grants for these tables.
  await db.exec('grant select,insert,update,delete on research_projects,library_articles,evidence_matrix to authenticated');
  const a='11111111-1111-4111-8111-111111111111', b='22222222-2222-4222-8222-222222222222';
  await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)',[a,'a@test.local',b,'b@test.local']);
  const as = async user => { await db.exec('reset role'); await db.query("select set_config('test.user',$1,false)",[user]); await db.exec('set role authenticated'); };
  const scalar = async (sql,args=[]) => Object.values((await db.query(sql,args)).rows[0])[0];
  await as(a);
  const idea=await scalar("insert into idea_versions(owner_id,series_id,context,proposal) values($1,gen_random_uuid(),'{}','{\"title\":\"Ideia A\"}') returning id",[a]);
  const p=await scalar("select scholar_save_protocol(null,null,'{\"title\":\"Projeto A\",\"theme\":\"Sono\"}'::jsonb)");
  await db.query("insert into scholar_project_origins(project_id,owner_id,source_type,source_key,idea_version_id,snapshot) values($1,$2,'idea','idea:test-a',$3,'{\"title\":\"Ideia A\"}')",[p.id,a,idea]);
  const article=await scalar("insert into library_articles(owner_id,project_id,title,authors,publication_types) values($1,$2,'Artigo A','[]','[]') returning id",[a,p.id]);
  await db.query("insert into evidence_matrix(owner_id,project_id,article_id,notes) values($1,$2,$3,'Evidência A')",[a,p.id,article]);
  await scalar("select scholar_save_results($1,null,'{\"notes\":\"Resultado A\"}'::jsonb)",[p.id]);
  const manuscript=await scalar("select scholar_save_manuscript($1,null,'{\"title\":\"Manuscrito A\"}'::jsonb,'[{\"section_key\":\"methods\",\"heading\":\"Métodos\",\"content\":\"Método A\",\"position\":1}]'::jsonb)",[p.id]);
  await as(b);
  const q=await scalar("select scholar_save_protocol(null,null,'{\"title\":\"Projeto B\"}'::jsonb)");
  await scalar("select scholar_save_results($1,null,'{\"notes\":\"Resultado B\"}'::jsonb)",[q.id]);
  for (const [table,column,id] of [['idea_versions','id',idea],['research_projects','id',p.id],['scholar_project_origins','project_id',p.id],['library_articles','id',article],['evidence_matrix','project_id',p.id],['scholar_project_results','project_id',p.id],['scholar_manuscripts','id',manuscript.id],['scholar_manuscript_sections','manuscript_id',manuscript.id]]) {
    assert.equal(await scalar(`select count(*)::int from ${table} where ${column}=$1`,[id]),0,`${table}: outra conta não deve ler`);
  }
  await assert.rejects(db.query("select scholar_save_results($1,null,'{}'::jsonb)",[p.id]),/Projeto indisponível/);
  await as(a);
  assert.equal(await scalar('select idea_version_id from scholar_project_origins where project_id=$1',[p.id]),idea);
  assert.equal(await scalar('select notes from evidence_matrix where project_id=$1',[p.id]),'Evidência A');
  assert.equal(await scalar("select workspace->>'notes' from scholar_project_results where project_id=$1",[p.id]),'Resultado A');
  assert.equal(await scalar('select content from scholar_manuscript_sections where manuscript_id=$1',[manuscript.id]),'Método A');
  assert.equal(await scalar('select count(*)::int from research_projects where id=$1',[q.id]),0);
  await db.close();
  console.log('PASS: synthetic idea → project origin → library/matrix → results → manuscript persists and remains isolated between accounts.');
})().catch(error => { console.error(error); process.exitCode = 1; });
