-- Landing: limite distribuído do Radar e contato privado. Executar uma vez.
begin;
create table public.scholar_public_limits (
 visitor_hash text not null, kind text not null check(kind in ('radar','contact')),
 day date not null default (now() at time zone 'UTC')::date,
 used integer not null default 0 check(used>=0),primary key(visitor_hash,kind,day)
);
create table public.scholar_contact_requests (
 id uuid primary key default gen_random_uuid(),name text not null,email text not null,
 purpose text not null check(purpose in ('support','residency','privacy','other')),
 message text not null,created_at timestamptz not null default now()
);
alter table public.scholar_public_limits enable row level security;
alter table public.scholar_contact_requests enable row level security;
revoke all on public.scholar_public_limits,public.scholar_contact_requests from anon,authenticated;
create or replace function public.scholar_public_quota(p_key text,p_kind text) returns integer
language plpgsql security definer set search_path=public as $$
declare count_now integer; maximum integer;
begin
 if p_key is null or p_key !~ '^[a-f0-9]{64}$' or p_kind is null or p_kind not in ('radar','contact') then raise exception 'Solicitação inválida'; end if;
 maximum:=case when p_kind='radar' then 3 else 5 end;
 delete from public.scholar_public_limits where day<(now() at time zone 'UTC')::date-2;
 insert into public.scholar_public_limits(visitor_hash,kind,used) values(p_key,p_kind,0) on conflict do nothing;
 select used into count_now from public.scholar_public_limits where visitor_hash=p_key and kind=p_kind and day=(now() at time zone 'UTC')::date for update;
 if count_now>=maximum then return -1; end if;
 update public.scholar_public_limits set used=used+1 where visitor_hash=p_key and kind=p_kind and day=(now() at time zone 'UTC')::date;
 return maximum-count_now-1;
end $$;
-- Public quotas are basic traffic control, not authentication or abuse-proof identity.
-- Do not expose cache writes or private lead reads to anonymous clients.
create or replace function public.scholar_contact_submit(p_key text,p_name text,p_email text,p_purpose text,p_message text) returns uuid
language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if p_name is null or length(trim(p_name)) not between 2 and 150 or p_email is null or length(p_email)>320 or p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or p_message is null or length(trim(p_message)) not between 10 and 3000 or p_purpose is null or p_purpose not in ('support','residency','privacy','other') then raise exception 'Confira os campos'; end if;
 if public.scholar_public_quota(p_key,'contact')<0 then raise exception 'Limite de solicitações atingido'; end if;
 insert into public.scholar_contact_requests(name,email,purpose,message) values(trim(p_name),lower(trim(p_email)),p_purpose,trim(p_message)) returning id into result;
 return result;
end $$;
revoke all on function public.scholar_public_quota(text,text),public.scholar_contact_submit(text,text,text,text,text) from public;
grant execute on function public.scholar_public_quota(text,text),public.scholar_contact_submit(text,text,text,text,text) to anon,authenticated;
commit;
