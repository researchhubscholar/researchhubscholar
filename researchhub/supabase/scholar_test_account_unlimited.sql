-- Franquia ilimitada somente para a conta pessoal de teste/gestão indicada abaixo.
-- Executar no SQL Editor após scholar_access.sql e scholar_productivity.sql.
-- Preserva consumo, reservas, modo da IA, limite por operação e controles financeiros.
begin;
alter table public.scholar_wallets add column if not exists unlimited boolean not null default false;
do $$declare c record;begin
 for c in select conname from pg_constraint where conrelid='public.scholar_wallets'::regclass and contype='c'
 and pg_get_constraintdef(oid) like '%used%' and pg_get_constraintdef(oid) like '%reserved%' and pg_get_constraintdef(oid) like '%allowance%'
 loop execute format('alter table public.scholar_wallets drop constraint %I',c.conname);end loop;
end $$;
alter table public.scholar_wallets add constraint scholar_wallet_balance_limit check(unlimited or used+reserved<=allowance);
-- Incremental migration: run after scholar_access.sql. No existing data is removed.
-- USD admission envelopes, not a provider invoice or exact spend guarantee.
-- Includes failed operations; envelopes are never released on retries/failures.
-- Configure tariffs and an envelope covering all possible model attempts before enabling.
create table if not exists public.scholar_ai_budget_settings (
 id boolean primary key default true check(id),
 enabled boolean not null default false,
 global_daily_usd numeric not null default 2 check(global_daily_usd>0),
 license_daily_usd numeric not null default 1 check(license_daily_usd>0),
 operation_envelope_usd numeric not null default 0.25 check(operation_envelope_usd>0),
 check(operation_envelope_usd<=license_daily_usd and license_daily_usd<=global_daily_usd)
);
insert into public.scholar_ai_budget_settings(id) values(true) on conflict do nothing;
create table if not exists public.scholar_ai_budget_admissions (
 usage_id uuid primary key references public.scholar_usage(id),
 license_id uuid not null references public.scholar_licenses(id),
 reserved_usd numeric not null check(reserved_usd>0),
 created_at timestamptz not null default now()
);
create index if not exists scholar_ai_budget_day_idx on public.scholar_ai_budget_admissions(created_at,license_id);
alter table public.scholar_ai_budget_settings enable row level security;
alter table public.scholar_ai_budget_admissions enable row level security;
revoke all on public.scholar_ai_budget_settings,public.scholar_ai_budget_admissions from anon,authenticated;
grant select,insert,update on public.scholar_ai_budget_settings to service_role;
grant select,insert on public.scholar_ai_budget_admissions to service_role;

create or replace function public.scholar_reserve(p_request uuid,p_wallet uuid,p_user uuid,p_feature text,p_model text,p_tokens integer,p_project uuid default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare lic public.scholar_licenses; w public.scholar_wallets; previous public.scholar_usage; budget public.scholar_ai_budget_settings; day_start timestamptz; global_reserved numeric; license_reserved numeric;
begin
 if p_tokens is null or p_tokens<1 or p_tokens>10000 then raise exception 'Limite de 10.000 tokens por operação'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select * into previous from public.scholar_usage where id=p_request;
 if previous.id is not null then
  if previous.user_id<>p_user or previous.wallet_id<>p_wallet or previous.feature<>p_feature or previous.model<>p_model or previous.reserved_tokens<>p_tokens or previous.project_id is distinct from p_project then raise exception 'Identificador de operação já utilizado'; end if;
  return previous.id;
 end if;
 select l.* into lic from public.scholar_licenses l join public.scholar_wallets x on x.license_id=l.id where x.id=p_wallet for update of l;
 select * into w from public.scholar_wallets where id=p_wallet for update;
 if w.id is null or w.user_id<>p_user or lic.status not in ('active','trial') or now() not between lic.starts_at and lic.ends_at then raise exception 'Franquia indisponível'; end if;
 if lic.organization_id is not null and not exists(select 1 from public.scholar_memberships where organization_id=lic.organization_id and user_id=p_user and active) then raise exception 'Vínculo institucional indisponível'; end if;
 if p_project is not null and public.scholar_project_owner(p_project) is distinct from p_user then raise exception 'Projeto indisponível'; end if;
 if exists(select 1 from public.scholar_usage where user_id=p_user and status='reserved') then raise exception 'Já existe uma operação em andamento'; end if;
 if (select count(*) from public.scholar_usage where user_id=p_user and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=20 then raise exception 'Limite diário atingido'; end if;
 if not w.unlimited and w.allowance-w.used-w.reserved<p_tokens then raise exception 'Franquia insuficiente'; end if;
 if lic.mode='live' and exists(select 1 from public.scholar_ai_budget_settings where id=true and enabled) then
  -- A single lock serializes financial admission across all users/licenses.
  perform pg_advisory_xact_lock(hashtextextended('scholar-ai-financial-admission',0));
  select * into budget from public.scholar_ai_budget_settings where id=true;
  if budget.id is null or not budget.enabled then raise exception 'Limite financeiro de IA ainda não configurado'; end if;
  day_start:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  select coalesce(sum(reserved_usd),0) into global_reserved from public.scholar_ai_budget_admissions where created_at>=day_start;
  select coalesce(sum(reserved_usd),0) into license_reserved from public.scholar_ai_budget_admissions where created_at>=day_start and license_id=lic.id;
  if global_reserved+budget.operation_envelope_usd>budget.global_daily_usd then raise exception 'Limite financeiro diário da plataforma atingido'; end if;
  if license_reserved+budget.operation_envelope_usd>budget.license_daily_usd then raise exception 'Limite financeiro diário desta licença atingido'; end if;
 end if;
 update public.scholar_wallets set reserved=reserved+p_tokens where id=w.id;
 insert into public.scholar_usage(id,wallet_id,user_id,project_id,feature,model,mode,reserved_tokens) values(p_request,w.id,p_user,p_project,p_feature,p_model,lic.mode,p_tokens);
 if lic.mode='live' and exists(select 1 from public.scholar_ai_budget_settings where id=true and enabled) then
  insert into public.scholar_ai_budget_admissions(usage_id,license_id,reserved_usd) values(p_request,lic.id,budget.operation_envelope_usd);
 end if;
 return p_request;
end $$;

do $$declare who uuid;lic uuid;begin
 select id into who from auth.users where lower(email)='anthonny1414@gmail.com';
 if who is null then raise exception 'Conta anthonny1414@gmail.com não encontrada. Nenhuma alteração aplicada.';end if;
 select id into lic from public.scholar_licenses where owner_id=who and organization_id is null;
 if lic is null or not exists(select 1 from public.scholar_wallets where user_id=who and license_id=lic) then raise exception 'Franquia individual não encontrada. Nenhuma alteração aplicada.';end if;
 update public.scholar_licenses set status='active',starts_at=least(starts_at,now()),ends_at=greatest(ends_at,'2099-12-31T23:59:59Z'::timestamptz) where id=lic;
 update public.scholar_wallets set unlimited=true where user_id=who and license_id=lic;
end $$;
commit;
select u.email,w.unlimited,w.used,w.reserved,l.status,l.ends_at from public.scholar_wallets w join auth.users u on u.id=w.user_id join public.scholar_licenses l on l.id=w.license_id where lower(u.email)='anthonny1414@gmail.com' and l.organization_id is null;
