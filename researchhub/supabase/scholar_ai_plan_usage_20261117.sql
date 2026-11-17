-- ResearchHub: commercial AI token allowance policy (Essencial 20/day; Plus and Premium no daily generation cap).
-- Run ONLY after reviewing in an isolated DB. Preview and production currently share the same Supabase.
-- Does not modify license status, purchased token balances, existing usage, or grant unlimited tokens.
-- Existing daily USD settings remain accounting thresholds, not customer gating.
-- Keep this migration LAST: older scholar_ai_budgets.sql / scholar_test_account_unlimited.sql redefine scholar_reserve.
begin;

-- Explicit emergency switch is OFF by default; no customer-level dollar cap.
create table if not exists public.scholar_ai_emergency_controls (
  id boolean primary key default true check(id),
  enabled boolean not null default false,
  hard_limit_usd numeric not null default 100 check(hard_limit_usd>0)
);
insert into public.scholar_ai_emergency_controls(id,enabled,hard_limit_usd)
values(true,false,100) on conflict(id) do nothing;
alter table public.scholar_ai_emergency_controls enable row level security;
revoke all on public.scholar_ai_emergency_controls from anon,authenticated;
grant select,insert,update on public.scholar_ai_emergency_controls to service_role;

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
 -- Commercial usage policy: Essential has 20 completed generations per UTC day.
 -- Failed generations do not consume a generation; Plus/Premium have no daily generation cap.
 if lic.plan='essential' and (
   select count(*) from public.scholar_usage u
   join public.scholar_wallets sw on sw.id=u.wallet_id
   where sw.license_id=lic.id and u.user_id=p_user and u.status='completed'
     and u.created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'
 )>=20 then raise exception 'Limite de 20 gerações diárias do plano Essencial atingido'; end if;
 -- Protect against repeated failing calls without penalizing ordinary successful research.
 if (select count(*) from public.scholar_usage
   where user_id=p_user and status='failed' and created_at>=now()-interval '5 minutes'
 )>=12 then raise exception 'Muitas falhas recentes de IA; aguarde alguns minutos'; end if;
 if not w.unlimited and w.allowance-w.used-w.reserved<p_tokens then raise exception 'Franquia insuficiente'; end if;
 if lic.mode='live' and exists(select 1 from public.scholar_ai_budget_settings where id=true and enabled) then
  -- Envelope accounting is not a customer-facing daily US$ cap.
  -- This lock also serializes any optional platform-wide emergency cutoff.
  perform pg_advisory_xact_lock(hashtextextended('scholar-ai-financial-admission',0));
  select * into budget from public.scholar_ai_budget_settings where id=true;
  if budget.id is null or not budget.enabled then raise exception 'Limite financeiro de IA ainda não configurado'; end if;
  day_start:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  select coalesce(sum(reserved_usd),0) into global_reserved from public.scholar_ai_budget_admissions where created_at>=day_start;
  select coalesce(sum(reserved_usd),0) into license_reserved from public.scholar_ai_budget_admissions where created_at>=day_start and license_id=lic.id;
  -- Financial amounts above are retained for monitoring, not to deny paid token access.
  -- Explicit emergency stop is a platform-operations safety control, disabled by default.
  if exists (
    select 1 from public.scholar_ai_emergency_controls ec
    where ec.id=true and ec.enabled
      and global_reserved+budget.operation_envelope_usd > ec.hard_limit_usd
  ) then raise exception 'Proteção financeira emergencial da plataforma ativada'; end if;
 end if;
 update public.scholar_wallets set reserved=reserved+p_tokens where id=w.id;
 insert into public.scholar_usage(id,wallet_id,user_id,project_id,feature,model,mode,reserved_tokens) values(p_request,w.id,p_user,p_project,p_feature,p_model,lic.mode,p_tokens);
 if lic.mode='live' and exists(select 1 from public.scholar_ai_budget_settings where id=true and enabled) then
  insert into public.scholar_ai_budget_admissions(usage_id,license_id,reserved_usd) values(p_request,lic.id,budget.operation_envelope_usd);
 end if;
 return p_request;
end $$;

commit;

-- Read-only verification; ensure both the plan condition and emergency switch are present.
select
  (select enabled from public.scholar_ai_emergency_controls where id=true) as emergency_stop_enabled,
  (select hard_limit_usd from public.scholar_ai_emergency_controls where id=true) as emergency_hard_limit_usd,
  pg_get_functiondef('public.scholar_reserve(uuid,uuid,uuid,text,text,integer,uuid)'::regprocedure)
    like '%Limite de 20 gerações diárias do plano Essencial%' as essential_limit_installed;
