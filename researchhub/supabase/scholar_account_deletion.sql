-- Etapa 2. Reexecutável, sem executar exclusões ao instalar.
-- Após scholar_account_support.sql, scholar_operations.sql, scholar_access.sql,
-- scholar_manuscript.sql e scholar_results.sql. Execução somente via backend.
begin;
alter table public.scholar_account_requests drop constraint if exists scholar_account_requests_status_check;
alter table public.scholar_account_requests add constraint scholar_account_requests_status_check check(status in ('pending','processing','cancelled','completed'));
drop index if exists public.scholar_account_requests_pending_idx;
create unique index scholar_account_requests_pending_idx on public.scholar_account_requests(owner_id,request_type) where status in ('pending','processing');

-- No FK to auth/users or requests: the minimal receipt must survive cascades.
create table if not exists public.scholar_account_deletion_runs (
 request_id uuid primary key, user_id uuid not null, actor_id uuid not null,
 state text not null check(state in ('processing','failed','completed')),
 attempts integer not null default 1 check(attempts>0),
 started_at timestamptz not null default now(), finished_at timestamptz,
 error_code text check(error_code in ('AUTH_REJECTED','OUTCOME_UNCERTAIN'))
);
alter table public.scholar_account_deletion_runs enable row level security;
revoke all on public.scholar_account_deletion_runs from anon,authenticated;
grant all on public.scholar_account_deletion_runs to service_role;
grant select on public.scholar_account_deletion_runs to authenticated;
drop policy if exists "Own deletion receipt" on public.scholar_account_deletion_runs;
create policy "Own deletion receipt" on public.scholar_account_deletion_runs for select to authenticated using(user_id=auth.uid());

create or replace function public.scholar_deletion_require_owner(p_actor uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.scholar_platform_admins where user_id=p_actor and role='owner') then raise exception 'DELETION_OWNER_REQUIRED'; end if;
end $$;

create or replace function public.scholar_deletion_blockers(p_user uuid) returns text[]
language plpgsql security definer set search_path=public as $$
declare reasons text[]:='{}'; owned boolean; col text; inspected boolean:=false;
begin
 if not exists(select 1 from auth.users where id=p_user and length(trim(coalesce(email,'')))>0) then reasons:=array_append(reasons,'IDENTITY_REVIEW_REQUIRED'); end if;
 if exists(select 1 from public.scholar_platform_admins where user_id=p_user) then reasons:=array_append(reasons,'PLATFORM_STAFF'); end if;
 if exists(select 1 from public.scholar_memberships m where m.user_id=p_user and m.active and m.role='director'
  and not exists(select 1 from public.scholar_memberships other where other.organization_id=m.organization_id and other.user_id<>p_user and other.active and other.role='director')) then reasons:=array_append(reasons,'SOLE_DIRECTOR'); end if;
 if exists(select 1 from public.scholar_usage where user_id=p_user and status='reserved') then reasons:=array_append(reasons,'ACTIVE_OPERATION'); end if;
 -- Do not alter retained/restricted records as a side effect of account cleanup.
 if to_regclass('public.scholar_payment_events') is not null then
  execute 'select exists(select 1 from public.scholar_payment_events e join public.scholar_purchase_requests p on p.id=e.purchase_request_id where p.requester_id=$1)' into owned using p_user;
  if owned then reasons:=array_append(reasons,'RESTRICTED_DEPENDENCIES'); end if;
 end if;
 if to_regclass('public.scholar_coupon_redemptions') is not null then
  execute 'select exists(select 1 from public.scholar_coupon_redemptions r join public.scholar_purchase_requests p on p.id=r.purchase_request_id where r.user_id=$1 or p.requester_id=$1)' into owned using p_user;
  if owned and not ('RESTRICTED_DEPENDENCIES'=any(reasons)) then reasons:=array_append(reasons,'RESTRICTED_DEPENDENCIES'); end if;
 end if;
 if to_regclass('storage.objects') is not null then
  for col in select column_name from information_schema.columns where table_schema='storage' and table_name='objects' and column_name in ('owner_id','owner') loop
   inspected:=true;
   execute format('select exists(select 1 from storage.objects where %I::text=$1)',col) into owned using p_user::text;
   if owned then reasons:=array_append(reasons,'STORAGE_OBJECTS'); exit; end if;
  end loop;
  if not inspected then reasons:=array_append(reasons,'STORAGE_REVIEW_REQUIRED'); end if;
 end if;
 return reasons;
end $$;

create or replace function public.scholar_deletion_review(p_actor uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare requests jsonb; runs jsonb; checks jsonb:='[]'; item record; rls boolean; present boolean;
begin
 perform public.scholar_deletion_require_owner(p_actor);
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into requests from (
  select a.id,a.owner_id,u.email,a.status,a.requested_at,a.scheduled_for,
   now()>=greatest(a.scheduled_for,a.requested_at+interval '7 days') as due,
   public.scholar_deletion_blockers(a.owner_id) as blockers,
   (select count(*) from public.research_projects p where p.owner_id=a.owner_id) as projects,
   (select count(*) from public.library_articles l where l.owner_id=a.owner_id) as articles,
   (select count(*) from public.scholar_manuscripts m where m.owner_id=a.owner_id) as manuscripts,
   (select count(*) from public.scholar_project_results r where r.owner_id=a.owner_id) as result_sets
  from public.scholar_account_requests a join auth.users u on u.id=a.owner_id
  where a.status in ('pending','processing') order by a.scheduled_for,a.id limit 50
 ) t;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into runs from (
  select request_id,state,attempts,started_at,finished_at,error_code from public.scholar_account_deletion_runs order by started_at desc,request_id limit 50
 ) t;
 for item in select * from (values
  ('Protocolo','research_projects','scholar_save_protocol(uuid,integer,jsonb)'),
  ('Resultados','scholar_project_results','scholar_save_results(uuid,integer,jsonb)'),
  ('Manuscrito','scholar_manuscripts','scholar_save_manuscript(uuid,integer,jsonb,jsonb)'),
  ('Tarefas','scholar_project_tasks',null),
  ('Exclusão de conta','scholar_account_deletion_runs','scholar_deletion_claim(uuid,uuid,text)')
 ) as t(label,relation,signature) loop
  select c.relrowsecurity into rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=item.relation;
  present:=to_regclass('public.'||item.relation) is not null;
  checks:=checks||jsonb_build_array(jsonb_build_object('label',item.label,'tablePresent',present,'rlsEnabled',coalesce(rls,false),'functionPresent',item.signature is null or to_regprocedure('public.'||item.signature) is not null));
 end loop;
 return jsonb_build_object('requests',requests,'runs',runs,'checks',checks,'checkedAt',now(),'version','account-deletion.v1');
end $$;

create or replace function public.scholar_deletion_claim(p_actor uuid,p_request uuid,p_confirmation text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare req public.scholar_account_requests; run public.scholar_account_deletion_runs; email text; reasons text[];
begin
 perform public.scholar_deletion_require_owner(p_actor);
 -- Cancellation and claim serialize on this row. No work is started by installation.
 select * into req from public.scholar_account_requests where id=p_request for update;
 select * into run from public.scholar_account_deletion_runs where request_id=p_request for update;
 if found and run.state='completed' then return jsonb_build_object('state','completed','requestId',p_request); end if;
 if run.state='processing' then raise exception 'DELETION_BUSY'; end if;
 if req.id is null or req.status<>'pending' then raise exception 'DELETION_NOT_PENDING'; end if;
 if req.owner_id=p_actor then raise exception 'DELETION_SELF_BLOCKED'; end if;
 if now()<greatest(req.scheduled_for,req.requested_at+interval '7 days') then raise exception 'DELETION_TOO_EARLY'; end if;
 select u.email into email from auth.users u where u.id=req.owner_id;
 if email is null or lower(trim(email))<>lower(trim(coalesce(p_confirmation,''))) then raise exception 'DELETION_CONFIRMATION_REQUIRED'; end if;
 reasons:=public.scholar_deletion_blockers(req.owner_id);
 if cardinality(reasons)>0 then raise exception 'DELETION_BLOCKED'; end if;
 insert into public.scholar_account_deletion_runs(request_id,user_id,actor_id,state) values(p_request,req.owner_id,p_actor,'processing')
 on conflict(request_id) do update set actor_id=excluded.actor_id,state='processing',attempts=scholar_account_deletion_runs.attempts+1,started_at=now(),finished_at=null,error_code=null;
 update public.scholar_account_requests set status='processing' where id=p_request;
 return jsonb_build_object('state','processing','requestId',p_request,'userId',req.owner_id);
end $$;

create or replace function public.scholar_deletion_finish(p_actor uuid,p_request uuid,p_result text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare run public.scholar_account_deletion_runs;
begin
 perform public.scholar_deletion_require_owner(p_actor);
 if p_result not in ('check','rejected','uncertain') then raise exception 'DELETION_INVALID_RESULT'; end if;
 perform 1 from public.scholar_account_requests where id=p_request for update;
 select * into run from public.scholar_account_deletion_runs where request_id=p_request for update;
 if not found then raise exception 'DELETION_NOT_STARTED'; end if;
 if run.state='completed' then return jsonb_build_object('state','completed','requestId',p_request); end if;
 if not exists(select 1 from auth.users where id=run.user_id) then
  update public.scholar_account_deletion_runs set state='completed',finished_at=now(),error_code=null where request_id=p_request;
  -- Request normally disappears through auth.users cascade; never recreate it.
 elsif run.state='processing' and p_result='rejected' then
  update public.scholar_account_deletion_runs set state='failed',finished_at=now(),error_code='AUTH_REJECTED' where request_id=p_request;
  update public.scholar_account_requests set status='pending' where id=p_request and status='processing';
 elsif run.state='processing' and p_result='uncertain' then
  update public.scholar_account_deletion_runs set error_code='OUTCOME_UNCERTAIN' where request_id=p_request;
 end if;
 select * into run from public.scholar_account_deletion_runs where request_id=p_request;
 return jsonb_build_object('state',run.state,'requestId',p_request,'errorCode',run.error_code);
end $$;

-- Recheck guards in the actual Auth deletion transaction, after backend admission.
create or replace function public.scholar_guard_auth_deletion() returns trigger
language plpgsql security definer set search_path=public as $$
declare req public.scholar_account_requests;
begin
 if exists(select 1 from public.scholar_account_deletion_runs where user_id=old.id and state='processing') then
  select * into req from public.scholar_account_requests where owner_id=old.id and status='processing' for update;
  if req.id is null or now()<greatest(req.scheduled_for,req.requested_at+interval '7 days') or cardinality(public.scholar_deletion_blockers(old.id))>0 then raise exception 'DELETION_GUARD_BLOCKED'; end if;
 end if;
 return old;
end $$;
drop trigger if exists scholar_account_delete_guard on auth.users;
create trigger scholar_account_delete_guard before delete on auth.users for each row execute function public.scholar_guard_auth_deletion();

create or replace function public.scholar_request_account_deletion() returns uuid
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); result uuid;
begin
 if uid is null then raise exception 'Sessão necessária'; end if;
 select id into result from public.scholar_account_requests where owner_id=uid and status in ('pending','processing') limit 1;
 if result is not null then return result; end if;
 insert into public.scholar_account_requests(owner_id,request_type) values(uid,'deletion') returning id into result;
 return result;
end $$;
revoke all on function public.scholar_deletion_require_owner(uuid),public.scholar_deletion_blockers(uuid),public.scholar_deletion_review(uuid),public.scholar_deletion_claim(uuid,uuid,text),public.scholar_deletion_finish(uuid,uuid,text),public.scholar_guard_auth_deletion() from public,anon,authenticated;
grant execute on function public.scholar_deletion_review(uuid),public.scholar_deletion_claim(uuid,uuid,text),public.scholar_deletion_finish(uuid,uuid,text) to service_role;
commit;
