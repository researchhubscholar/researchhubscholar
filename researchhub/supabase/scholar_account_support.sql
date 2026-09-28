-- RESEARCHHUB SCHOLAR — conta, privacidade e suporte
-- Executar uma única vez após scholar_install.sql.
begin;

create table public.scholar_support_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  category text not null check(category in ('technical','billing','privacy','suggestion','other')),
  subject text not null check(length(trim(subject)) between 3 and 160),
  status text not null default 'open' check(status in ('open','in_progress','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scholar_support_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.scholar_support_requests(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  sender_type text not null check(sender_type in ('user','team')),
  message text not null check(length(trim(message)) between 2 and 4000),
  created_at timestamptz not null default now()
);

create table public.scholar_account_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check(request_type='deletion'),
  status text not null default 'pending' check(status in ('pending','cancelled','completed')),
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null default (now()+interval '7 days'),
  cancelled_at timestamptz,
  completed_at timestamptz
);

create unique index scholar_account_requests_pending_idx
  on public.scholar_account_requests(owner_id,request_type) where status='pending';
create index scholar_support_requests_owner_idx
  on public.scholar_support_requests(owner_id,created_at desc);
create index scholar_support_messages_request_idx
  on public.scholar_support_messages(request_id,created_at);

alter table public.scholar_support_requests enable row level security;
alter table public.scholar_support_messages enable row level security;
alter table public.scholar_account_requests enable row level security;

create policy "Scholar reads own support requests"
  on public.scholar_support_requests for select to authenticated
  using(owner_id=auth.uid());
create policy "Scholar reads own support messages"
  on public.scholar_support_messages for select to authenticated
  using(owner_id=auth.uid() and exists(
    select 1 from public.scholar_support_requests r
    where r.id=request_id and r.owner_id=auth.uid()
  ));
create policy "Scholar reads own account requests"
  on public.scholar_account_requests for select to authenticated
  using(owner_id=auth.uid());

create trigger scholar_support_requests_updated before update on public.scholar_support_requests
  for each row execute procedure public.set_updated_at();

create or replace function public.scholar_create_support_request(
  p_category text,p_subject text,p_message text
) returns uuid
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); result uuid;
begin
  if uid is null then raise exception 'Sessão necessária'; end if;
  if p_category not in ('technical','billing','privacy','suggestion','other')
    or length(trim(coalesce(p_subject,''))) not between 3 and 160
    or length(trim(coalesce(p_message,''))) not between 10 and 4000
  then raise exception 'Confira os campos do chamado'; end if;
  insert into public.scholar_support_requests(owner_id,category,subject)
    values(uid,p_category,trim(p_subject)) returning id into result;
  insert into public.scholar_support_messages(request_id,owner_id,sender_type,message)
    values(result,uid,'user',trim(p_message));
  return result;
end $$;

create or replace function public.scholar_add_support_message(
  p_request_id uuid,p_message text
) returns uuid
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); result uuid;
begin
  if uid is null or not exists(
    select 1 from public.scholar_support_requests
    where id=p_request_id and owner_id=uid and status not in ('closed')
  ) then raise exception 'Solicitação indisponível'; end if;
  if length(trim(coalesce(p_message,''))) not between 2 and 4000
    then raise exception 'Mensagem inválida'; end if;
  insert into public.scholar_support_messages(request_id,owner_id,sender_type,message)
    values(p_request_id,uid,'user',trim(p_message)) returning id into result;
  update public.scholar_support_requests set updated_at=now() where id=p_request_id;
  return result;
end $$;

create or replace function public.scholar_request_account_deletion() returns uuid
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); result uuid;
begin
  if uid is null then raise exception 'Sessão necessária'; end if;
  select id into result from public.scholar_account_requests
    where owner_id=uid and request_type='deletion' and status='pending' limit 1;
  if result is not null then return result; end if;
  insert into public.scholar_account_requests(owner_id,request_type)
    values(uid,'deletion') returning id into result;
  return result;
end $$;

create or replace function public.scholar_cancel_account_deletion(p_request_id uuid) returns boolean
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'Sessão necessária'; end if;
  update public.scholar_account_requests
    set status='cancelled',cancelled_at=now()
    where id=p_request_id and owner_id=uid and request_type='deletion' and status='pending';
  return found;
end $$;

revoke all on public.scholar_support_requests,public.scholar_support_messages,public.scholar_account_requests from anon,authenticated;
grant select on public.scholar_support_requests,public.scholar_support_messages,public.scholar_account_requests to authenticated;
grant all on public.scholar_support_requests,public.scholar_support_messages,public.scholar_account_requests to service_role;

revoke all on function public.scholar_create_support_request(text,text,text),
  public.scholar_add_support_message(uuid,text),
  public.scholar_request_account_deletion(),
  public.scholar_cancel_account_deletion(uuid) from public;
grant execute on function public.scholar_create_support_request(text,text,text),
  public.scholar_add_support_message(uuid,text),
  public.scholar_request_account_deletion(),
  public.scholar_cancel_account_deletion(uuid) to authenticated;
commit;
