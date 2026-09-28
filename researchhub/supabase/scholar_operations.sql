-- RESEARCHHUB SCHOLAR — monitoramento e operação
-- Executar uma única vez após scholar_account_support.sql.
begin;

create table public.scholar_platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'support' check(role in ('owner','support','analyst')),
  created_at timestamptz not null default now()
);

create table public.scholar_product_events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check(event_name in ('page_view','action')),
  module text not null check(module in ('dashboard','radar','ideas','library','project','advising','documents','license','residency','account','operation','other')),
  route text not null check(length(route) between 1 and 160),
  created_at timestamptz not null default now()
);

create table public.scholar_error_events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  module text not null check(module in ('dashboard','radar','ideas','library','project','advising','documents','license','residency','account','operation','other')),
  route text not null check(length(route) between 1 and 160),
  error_code text not null check(length(error_code) between 2 and 80),
  message text not null check(length(message) between 2 and 500),
  status text not null default 'open' check(status in ('open','resolved')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index scholar_product_events_activity_idx
  on public.scholar_product_events(created_at desc,module,event_name);
create index scholar_product_events_owner_idx
  on public.scholar_product_events(owner_user_id,created_at desc);
create index scholar_error_events_status_idx
  on public.scholar_error_events(status,last_seen_at desc);

alter table public.scholar_platform_admins enable row level security;
alter table public.scholar_product_events enable row level security;
alter table public.scholar_error_events enable row level security;

create policy "Scholar reads own platform role"
  on public.scholar_platform_admins for select to authenticated
  using(user_id=auth.uid());
create policy "Scholar exports own product events"
  on public.scholar_product_events for select to authenticated
  using(owner_user_id=auth.uid());
create policy "Scholar exports own error events"
  on public.scholar_error_events for select to authenticated
  using(owner_user_id=auth.uid());

revoke all on public.scholar_platform_admins,public.scholar_product_events,public.scholar_error_events from anon,authenticated;
grant select on public.scholar_platform_admins,public.scholar_product_events,public.scholar_error_events to authenticated;
grant all on public.scholar_platform_admins,public.scholar_product_events,public.scholar_error_events to service_role;

create or replace function public.scholar_is_platform_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.scholar_platform_admins where user_id=auth.uid())
$$;

create or replace function public.scholar_bootstrap_platform_admin(p_email text,p_role text default 'owner') returns uuid
language plpgsql security definer set search_path=public as $$
declare target uuid;
begin
  if p_role not in ('owner','support','analyst') then raise exception 'Perfil administrativo inválido'; end if;
  select id into target from auth.users where lower(email)=lower(trim(p_email)) limit 1;
  if target is null then raise exception 'Usuário não encontrado'; end if;
  insert into public.scholar_platform_admins(user_id,role) values(target,p_role)
    on conflict(user_id) do update set role=excluded.role;
  return target;
end $$;

create or replace function public.scholar_record_product_event(
  p_event_name text,p_module text,p_route text
) returns uuid
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); result uuid;
begin
  if uid is null then raise exception 'Sessão necessária'; end if;
  if p_event_name not in ('page_view','action')
    or p_module not in ('dashboard','radar','ideas','library','project','advising','documents','license','residency','account','operation','other')
    or p_route is null or length(p_route) not between 1 and 160 or p_route !~ '^/[a-z0-9_/-]*$'
  then raise exception 'Evento inválido'; end if;
  if (select count(*) from public.scholar_product_events where owner_user_id=uid and created_at>now()-interval '1 minute')>=60
    then return null; end if;
  insert into public.scholar_product_events(owner_user_id,event_name,module,route)
    values(uid,p_event_name,p_module,p_route) returning id into result;
  return result;
end $$;

create or replace function public.scholar_record_error_event(
  p_module text,p_route text,p_error_code text,p_message text
) returns uuid
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); result uuid;
begin
  if uid is null then raise exception 'Sessão necessária'; end if;
  if p_module not in ('dashboard','radar','ideas','library','project','advising','documents','license','residency','account','operation','other')
    or p_route is null or length(p_route) not between 1 and 160 or p_route !~ '^/[a-z0-9_/-]*$'
    or length(trim(coalesce(p_error_code,''))) not between 2 and 80
    or length(trim(coalesce(p_message,''))) not between 2 and 500
  then raise exception 'Erro inválido'; end if;
  if (select count(*) from public.scholar_error_events where owner_user_id=uid and last_seen_at>now()-interval '1 minute')>=20
    then return null; end if;
  insert into public.scholar_error_events(owner_user_id,module,route,error_code,message)
    values(uid,p_module,p_route,trim(p_error_code),trim(p_message)) returning id into result;
  return result;
end $$;

create or replace function public.scholar_require_platform_admin() returns void
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.scholar_is_platform_admin() then raise exception 'Acesso restrito'; end if;
end $$;

create or replace function public.scholar_operation_summary() returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
  perform public.scholar_require_platform_admin();
  return jsonb_build_object(
    'users',(select count(*) from public.profiles),
    'active7d',(select count(distinct owner_user_id) from public.scholar_product_events where created_at>=now()-interval '7 days'),
    'events7d',(select count(*) from public.scholar_product_events where created_at>=now()-interval '7 days'),
    'openErrors',(select count(*) from public.scholar_error_events where status='open'),
    'openSupport',(select count(*) from public.scholar_support_requests where status in ('open','in_progress')),
    'pendingDeletions',(select count(*) from public.scholar_account_requests where status='pending')
  );
end $$;

create or replace function public.scholar_operation_activity(p_days integer default 14)
returns table(activity_day date,module text,event_name text,total bigint)
language plpgsql stable security definer set search_path=public as $$
begin
  perform public.scholar_require_platform_admin();
  if p_days not between 1 and 90 then raise exception 'Período inválido'; end if;
  return query select (e.created_at at time zone 'UTC')::date,e.module,e.event_name,count(*)
    from public.scholar_product_events e
    where e.created_at>=now()-make_interval(days=>p_days)
    group by 1,2,3 order by 1 desc,2,3;
end $$;

create or replace function public.scholar_operation_support()
returns table(id uuid,user_name text,user_email text,category text,subject text,status text,updated_at timestamptz,last_message text)
language plpgsql stable security definer set search_path=public as $$
begin
  perform public.scholar_require_platform_admin();
  return query select r.id,p.name,p.email,r.category,r.subject,r.status,r.updated_at,
    (select m.message from public.scholar_support_messages m where m.request_id=r.id order by m.created_at desc limit 1)
    from public.scholar_support_requests r left join public.profiles p on p.id=r.owner_id
    order by r.updated_at desc limit 100;
end $$;

create or replace function public.scholar_operation_errors()
returns table(id uuid,user_email text,module text,route text,error_code text,message text,status text,last_seen_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
  perform public.scholar_require_platform_admin();
  return query select e.id,p.email,e.module,e.route,e.error_code,e.message,e.status,e.last_seen_at
    from public.scholar_error_events e left join public.profiles p on p.id=e.owner_user_id
    order by (e.status='open') desc,e.last_seen_at desc limit 100;
end $$;

create or replace function public.scholar_operation_deletions()
returns table(id uuid,user_name text,user_email text,requested_at timestamptz,scheduled_for timestamptz,status text)
language plpgsql stable security definer set search_path=public as $$
begin
  perform public.scholar_require_platform_admin();
  return query select a.id,p.name,p.email,a.requested_at,a.scheduled_for,a.status
    from public.scholar_account_requests a left join public.profiles p on p.id=a.owner_id
    where a.status='pending' order by a.scheduled_for;
end $$;

create or replace function public.scholar_admin_reply_support(
  p_request_id uuid,p_message text,p_status text default 'in_progress'
) returns uuid
language plpgsql security definer set search_path=public as $$
declare target uuid; result uuid;
begin
  perform public.scholar_require_platform_admin();
  if p_status not in ('open','in_progress','resolved','closed')
    or length(trim(coalesce(p_message,''))) not between 2 and 4000
  then raise exception 'Resposta inválida'; end if;
  select owner_id into target from public.scholar_support_requests where id=p_request_id;
  if target is null then raise exception 'Chamado não encontrado'; end if;
  insert into public.scholar_support_messages(request_id,owner_id,sender_type,message)
    values(p_request_id,target,'team',trim(p_message)) returning id into result;
  update public.scholar_support_requests set status=p_status,updated_at=now() where id=p_request_id;
  return result;
end $$;

create or replace function public.scholar_admin_set_support_status(p_request_id uuid,p_status text) returns boolean
language plpgsql security definer set search_path=public as $$
begin
  perform public.scholar_require_platform_admin();
  if p_status not in ('open','in_progress','resolved','closed') then raise exception 'Status inválido'; end if;
  update public.scholar_support_requests set status=p_status,updated_at=now() where id=p_request_id;
  return found;
end $$;

create or replace function public.scholar_admin_resolve_error(p_error_id uuid) returns boolean
language plpgsql security definer set search_path=public as $$
begin
  perform public.scholar_require_platform_admin();
  update public.scholar_error_events set status='resolved',resolved_at=now() where id=p_error_id and status='open';
  return found;
end $$;

revoke all on function public.scholar_is_platform_admin(),
  public.scholar_bootstrap_platform_admin(text,text),
  public.scholar_record_product_event(text,text,text),
  public.scholar_record_error_event(text,text,text,text),
  public.scholar_require_platform_admin(),
  public.scholar_operation_summary(),
  public.scholar_operation_activity(integer),
  public.scholar_operation_support(),
  public.scholar_operation_errors(),
  public.scholar_operation_deletions(),
  public.scholar_admin_reply_support(uuid,text,text),
  public.scholar_admin_set_support_status(uuid,text),
  public.scholar_admin_resolve_error(uuid) from public;

grant execute on function public.scholar_is_platform_admin(),
  public.scholar_record_product_event(text,text,text),
  public.scholar_record_error_event(text,text,text,text),
  public.scholar_operation_summary(),
  public.scholar_operation_activity(integer),
  public.scholar_operation_support(),
  public.scholar_operation_errors(),
  public.scholar_operation_deletions(),
  public.scholar_admin_reply_support(uuid,text,text),
  public.scholar_admin_set_support_status(uuid,text),
  public.scholar_admin_resolve_error(uuid) to authenticated;
grant execute on function public.scholar_bootstrap_platform_admin(text,text) to service_role;
commit;
