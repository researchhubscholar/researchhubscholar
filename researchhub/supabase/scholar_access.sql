-- SCHOLAR: licenças pessoais e institucionais, convites e consumo.
-- Executar no SQL Editor do Supabase exclusivo do Scholar. Sem cobrança ou IA.
begin;
create table if not exists public.scholar_organizations (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 200), created_at timestamptz not null default now()
);
create table if not exists public.scholar_cohorts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.scholar_organizations on delete cascade,
 name text not null check(length(name) between 2 and 200), unique(id,organization_id)
);
create table if not exists public.scholar_memberships (
 organization_id uuid not null references public.scholar_organizations on delete cascade,
 user_id uuid not null references auth.users on delete cascade,
 role text not null check(role in ('director','resident')), cohort_id uuid,
 active boolean not null default true, created_at timestamptz not null default now(), primary key(organization_id,user_id),
 foreign key(cohort_id,organization_id) references public.scholar_cohorts(id,organization_id)
);
create table if not exists public.scholar_licenses (
 id uuid primary key default gen_random_uuid(), owner_id uuid references auth.users on delete cascade,
 organization_id uuid references public.scholar_organizations on delete cascade,
 plan text not null check(plan in ('essential','plus','premium')),
 status text not null default 'pending' check(status in ('pending','trial','active','suspended','expired')),
 mode text not null default 'simulation' check(mode in ('simulation','live')),
 starts_at timestamptz not null default now(), ends_at timestamptz not null,
 seats integer not null default 1 check(seats between 1 and 10000), token_allowance bigint not null check(token_allowance >= 0),
 check((owner_id is null) <> (organization_id is null)), check(ends_at > starts_at)
);
create unique index if not exists scholar_personal_license_unique on public.scholar_licenses(owner_id) where owner_id is not null;
create unique index if not exists scholar_org_license_unique on public.scholar_licenses(organization_id) where organization_id is not null;
create table if not exists public.scholar_wallets (
 id uuid primary key default gen_random_uuid(), license_id uuid not null references public.scholar_licenses on delete cascade,
 user_id uuid not null references auth.users on delete cascade,
 allowance bigint not null check(allowance >= 0), used bigint not null default 0 check(used >= 0),
 reserved bigint not null default 0 check(reserved >= 0), check(used + reserved <= allowance), unique(license_id,user_id)
);
create table if not exists public.scholar_invites (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.scholar_organizations on delete cascade,
 cohort_id uuid, code_hash text not null unique, email text,
 max_uses integer not null check(max_uses between 1 and 10000), uses integer not null default 0 check(uses >= 0 and uses <= max_uses),
 expires_at timestamptz not null, revoked boolean not null default false,
 foreign key(cohort_id,organization_id) references public.scholar_cohorts(id,organization_id)
);
create table if not exists public.scholar_usage (
 id uuid primary key, wallet_id uuid not null references public.scholar_wallets on delete cascade,
 user_id uuid not null references auth.users on delete cascade,
 project_id uuid references public.research_projects on delete set null,
 feature text not null check(feature in ('ideas','reading','matrix','refinement','protocol','writing')),
 model text not null check(length(model) between 1 and 100), mode text not null check(mode in ('simulation','live')),
 status text not null default 'reserved' check(status in ('reserved','completed','failed')),
 reserved_tokens integer not null check(reserved_tokens between 1 and 10000),
 input_tokens integer not null default 0 check(input_tokens >= 0), output_tokens integer not null default 0 check(output_tokens >= 0),
 cost_usd numeric(14,8) not null default 0 check(cost_usd >= 0), provider_request_id text,
 created_at timestamptz not null default now(), finished_at timestamptz,
 check(input_tokens + output_tokens <= reserved_tokens)
);
create index if not exists scholar_usage_user_date on public.scholar_usage(user_id,created_at desc);
create table if not exists public.scholar_project_shares (
 project_id uuid not null references public.research_projects on delete cascade,
 organization_id uuid not null references public.scholar_organizations on delete cascade,
 created_at timestamptz not null default now(), primary key(project_id,organization_id)
);

-- SECURITY DEFINER helpers avoid recursive membership RLS. No direct table writes
-- are granted to end users; seat and budget changes go through locked RPCs.
create or replace function public.scholar_is_director(p_org uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.scholar_memberships where organization_id=p_org and user_id=auth.uid() and active and role='director');
$$;
create or replace function public.scholar_is_member(p_org uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.scholar_memberships where organization_id=p_org and user_id=auth.uid() and active);
$$;
create or replace function public.scholar_owns_wallet(p_wallet uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.scholar_wallets w join public.scholar_licenses l on l.id=w.license_id where w.id=p_wallet and (w.user_id=auth.uid() or public.scholar_is_director(l.organization_id)));
$$;

alter table public.scholar_organizations enable row level security;
alter table public.scholar_cohorts enable row level security;
alter table public.scholar_memberships enable row level security;
alter table public.scholar_licenses enable row level security;
alter table public.scholar_wallets enable row level security;
alter table public.scholar_invites enable row level security;
alter table public.scholar_usage enable row level security;
alter table public.scholar_project_shares enable row level security;
create policy "Scholar organization members" on public.scholar_organizations for select to authenticated using(public.scholar_is_member(id));
create policy "Scholar cohort members" on public.scholar_cohorts for select to authenticated using(public.scholar_is_member(organization_id));
create policy "Scholar membership visibility" on public.scholar_memberships for select to authenticated using(user_id=auth.uid() or public.scholar_is_director(organization_id));
create policy "Scholar license visibility" on public.scholar_licenses for select to authenticated using(owner_id=auth.uid() or public.scholar_is_member(organization_id));
create policy "Scholar wallet visibility" on public.scholar_wallets for select to authenticated using(public.scholar_owns_wallet(id));
create policy "Scholar invite directors" on public.scholar_invites for select to authenticated using(public.scholar_is_director(organization_id));
create policy "Scholar usage visibility" on public.scholar_usage for select to authenticated using(user_id=auth.uid() or public.scholar_owns_wallet(wallet_id));
create policy "Scholar share visibility" on public.scholar_project_shares for select to authenticated using(public.scholar_is_director(organization_id) or exists(select 1 from public.research_projects p where p.id=project_id and p.owner_id=auth.uid()));
-- Sharing grants read-only project access, never access to profiles, libraries or ideas.
create policy "Scholar director reads shared projects" on public.research_projects for select to authenticated using(exists(select 1 from public.scholar_project_shares s where s.project_id=id and public.scholar_is_director(s.organization_id)));
-- Keep project and share policy recursion out of the owner check.
create or replace function public.scholar_project_owner(p_project uuid) returns uuid
language sql stable security definer set search_path=public as $$ select owner_id from public.research_projects where id=p_project; $$;
create or replace function public.scholar_owns_project(p_project uuid) returns boolean
language sql stable security definer set search_path=public as $$ select exists(select 1 from public.research_projects where id=p_project and owner_id=auth.uid()); $$;
drop policy "Scholar share visibility" on public.scholar_project_shares;
create policy "Scholar share visibility" on public.scholar_project_shares for select to authenticated using(public.scholar_is_director(organization_id) or public.scholar_owns_project(project_id));

create or replace function public.scholar_create_cohort(p_org uuid,p_name text) returns uuid
language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if not public.scholar_is_director(p_org) then raise exception 'Acesso restrito à coordenação'; end if;
 insert into public.scholar_cohorts(organization_id,name) values(p_org,trim(p_name)) returning id into result; return result;
end $$;
create or replace function public.scholar_create_invite(p_org uuid,p_cohort uuid default null,p_email text default null,p_uses integer default 1) returns text
language plpgsql security definer set search_path=public,extensions as $$
declare code text; lic public.scholar_licenses;
begin
 if not public.scholar_is_director(p_org) then raise exception 'Acesso restrito à coordenação'; end if;
 select * into lic from public.scholar_licenses where organization_id=p_org for update;
 if lic.id is null or lic.status not in ('active','trial') or now() not between lic.starts_at and lic.ends_at then raise exception 'Licença institucional indisponível'; end if;
 if p_uses < 1 or p_uses > lic.seats then raise exception 'Quantidade inválida'; end if;
 if nullif(trim(p_email),'') is not null and p_uses <> 1 then raise exception 'Convite por e-mail deve ter uma utilização'; end if;
 code := encode(gen_random_bytes(16),'hex');
 insert into public.scholar_invites(organization_id,cohort_id,code_hash,email,max_uses,expires_at)
 values(p_org,p_cohort,encode(digest(code,'sha256'),'hex'),lower(nullif(trim(p_email),'')),p_uses,least(now()+interval '7 days',lic.ends_at));
 return code;
end $$;
create or replace function public.scholar_redeem_invite(p_code text) returns uuid
language plpgsql security definer set search_path=public,extensions as $$
declare inv public.scholar_invites; lic public.scholar_licenses; who uuid:=auth.uid(); email_address text; count_members integer; allocation bigint;
begin
 if who is null then raise exception 'Entre na sua conta'; end if;
 select * into inv from public.scholar_invites where code_hash=encode(digest(lower(trim(p_code)),'sha256'),'hex') for update;
 if inv.id is null or inv.revoked or inv.expires_at <= now() then raise exception 'Convite inválido, expirado ou esgotado'; end if;
 select * into lic from public.scholar_licenses where organization_id=inv.organization_id for update;
 if lic.id is null or lic.status not in ('active','trial') or now() not between lic.starts_at and lic.ends_at then raise exception 'Licença institucional indisponível'; end if;
 select lower(email) into email_address from auth.users where id=who and email_confirmed_at is not null;
 if email_address is null or (inv.email is not null and inv.email<>email_address) then raise exception 'Confirme o e-mail autorizado para este convite'; end if;
 if exists(select 1 from public.scholar_memberships where organization_id=inv.organization_id and user_id=who and active) then return inv.organization_id; end if;
 if inv.uses>=inv.max_uses then raise exception 'Convite esgotado'; end if;
 select count(*) into count_members from public.scholar_memberships where organization_id=inv.organization_id and active and role='resident';
 if count_members>=lic.seats then raise exception 'Todas as vagas estão ocupadas'; end if;
 allocation:=least(lic.token_allowance/lic.seats,greatest(0,lic.token_allowance-coalesce((select sum(allowance) from public.scholar_wallets where license_id=lic.id),0)));
 insert into public.scholar_memberships(organization_id,user_id,role,cohort_id) values(inv.organization_id,who,'resident',inv.cohort_id)
 on conflict(organization_id,user_id) do update set active=true,cohort_id=excluded.cohort_id;
 insert into public.scholar_wallets(license_id,user_id,allowance) values(lic.id,who,allocation) on conflict(license_id,user_id) do nothing;
 update public.scholar_invites set uses=uses+1 where id=inv.id;
 return inv.organization_id;
end $$;
create or replace function public.scholar_revoke_invite(p_invite uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 update public.scholar_invites set revoked=true where id=p_invite and public.scholar_is_director(organization_id);
 if not found then raise exception 'Convite indisponível'; end if;
end $$;
create or replace function public.scholar_share_project(p_project uuid,p_org uuid,p_share boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not public.scholar_owns_project(p_project) or auth.uid() is null or not public.scholar_is_member(p_org) then raise exception 'Projeto ou programa indisponível'; end if;
 if p_share then insert into public.scholar_project_shares(project_id,organization_id) values(p_project,p_org) on conflict do nothing;
 else delete from public.scholar_project_shares where project_id=p_project and organization_id=p_org; end if;
end $$;
create or replace function public.scholar_allocate(p_wallet uuid,p_allowance bigint) returns void
language plpgsql security definer set search_path=public as $$
declare lic public.scholar_licenses; w public.scholar_wallets;
begin
 select l.* into lic from public.scholar_licenses l join public.scholar_wallets x on x.license_id=l.id where x.id=p_wallet for update of l;
 if lic.id is null or not public.scholar_is_director(lic.organization_id) then raise exception 'Acesso restrito à coordenação'; end if;
 select * into w from public.scholar_wallets where id=p_wallet for update;
 if p_allowance < w.used+w.reserved or p_allowance<0 or p_allowance+coalesce((select sum(allowance) from public.scholar_wallets where license_id=lic.id and id<>w.id),0)>lic.token_allowance then raise exception 'Franquia insuficiente ou abaixo do consumo já registrado'; end if;
 update public.scholar_wallets set allowance=p_allowance where id=w.id;
end $$;

create or replace function public.scholar_manage_member(p_org uuid,p_user uuid,p_active boolean,p_cohort uuid default null) returns void
language plpgsql security definer set search_path=public as $$
declare lic public.scholar_licenses;
begin
 if not public.scholar_is_director(p_org) then raise exception 'Acesso restrito à coordenação'; end if;
 select * into lic from public.scholar_licenses where organization_id=p_org for update;
 if lic.id is null then raise exception 'Licença institucional indisponível'; end if;
 if p_active and not exists(select 1 from public.scholar_memberships where organization_id=p_org and user_id=p_user and active) and (select count(*) from public.scholar_memberships where organization_id=p_org and active and role='resident')>=lic.seats then raise exception 'Todas as vagas estão ocupadas'; end if;
 update public.scholar_memberships set active=p_active,cohort_id=p_cohort where organization_id=p_org and user_id=p_user and role='resident';
 if not found then raise exception 'Residente indisponível'; end if;
 if not p_active then delete from public.scholar_project_shares where organization_id=p_org and public.scholar_project_owner(project_id)=p_user; end if;
end $$;
create or replace function public.scholar_roster(p_org uuid) returns table(user_id uuid,name text,email text,active boolean,cohort_id uuid,allowance bigint,used bigint,reserved bigint,wallet_id uuid)
language plpgsql security definer set search_path=public as $$
begin
 if not public.scholar_is_director(p_org) then raise exception 'Acesso restrito à coordenação'; end if;
 return query select m.user_id,p.name,account.email,m.active,m.cohort_id,w.allowance,w.used,w.reserved,w.id
 from public.scholar_memberships m join auth.users account on account.id=m.user_id left join public.profiles p on p.id=m.user_id
 left join public.scholar_licenses l on l.organization_id=m.organization_id
 left join public.scholar_wallets w on w.license_id=l.id and w.user_id=m.user_id
 where m.organization_id=p_org and m.role='resident' order by m.created_at;
end $$;

-- Backend only: reserve before the provider call; settle once after usage returns.
-- Daily limits include failed attempts; parallel requests lock the same user.
create or replace function public.scholar_reserve(p_request uuid,p_wallet uuid,p_user uuid,p_feature text,p_model text,p_tokens integer,p_project uuid default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare lic public.scholar_licenses; w public.scholar_wallets; previous public.scholar_usage;
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
 if w.allowance-w.used-w.reserved<p_tokens then raise exception 'Franquia insuficiente'; end if;
 update public.scholar_wallets set reserved=reserved+p_tokens where id=w.id;
 insert into public.scholar_usage(id,wallet_id,user_id,project_id,feature,model,mode,reserved_tokens) values(p_request,w.id,p_user,p_project,p_feature,p_model,lic.mode,p_tokens);
 return p_request;
end $$;
create or replace function public.scholar_settle(p_request uuid,p_input integer,p_output integer,p_cost numeric,p_failed boolean default false,p_provider_id text default null) returns void
language plpgsql security definer set search_path=public as $$
declare event public.scholar_usage; lic_id uuid;
begin
 select license_id into lic_id from public.scholar_wallets w join public.scholar_usage u on u.wallet_id=w.id where u.id=p_request;
 perform 1 from public.scholar_licenses where id=lic_id for update;
 perform 1 from public.scholar_wallets w join public.scholar_usage u on u.wallet_id=w.id where u.id=p_request for update of w;
 select * into event from public.scholar_usage where id=p_request for update;
 if event.id is null then raise exception 'Operação indisponível'; end if;
 if event.status<>'reserved' then return; end if;
 if p_input is null or p_output is null or p_cost is null or p_input<0 or p_output<0 or p_cost<0 or p_input::bigint+p_output>event.reserved_tokens then raise exception 'Consumo inválido ou acima da reserva'; end if;
 -- Failed generations refund user tokens, while retaining any real provider cost.
 update public.scholar_wallets set reserved=reserved-event.reserved_tokens,used=used+case when p_failed then 0 else p_input+p_output end where id=event.wallet_id;
 update public.scholar_usage set input_tokens=p_input,output_tokens=p_output,cost_usd=p_cost,status=case when p_failed then 'failed' else 'completed' end,finished_at=now(),provider_request_id=p_provider_id where id=event.id;
end $$;

-- Provisioning is reserved to SQL Editor/backend after commercial validation.
-- Defaults are simulation trials, never payment confirmation or live AI.
create or replace function public.scholar_provision(p_user uuid,p_plan text default 'essential',p_org_name text default null,p_seats integer default 1) returns uuid
language plpgsql security definer set search_path=public as $$
declare org uuid; lic uuid; tokens bigint;
begin
 tokens:=case p_plan when 'essential' then 3000000 when 'plus' then 6000000 when 'premium' then 12000000 else null end;
 if tokens is null or p_seats<1 or p_seats>10000 then raise exception 'Plano ou vagas inválidos'; end if;
 if p_org_name is not null then
  insert into public.scholar_organizations(name) values(trim(p_org_name)) returning id into org;
  insert into public.scholar_memberships(organization_id,user_id,role) values(org,p_user,'director');
 else p_seats:=1; end if;
 insert into public.scholar_licenses(owner_id,organization_id,plan,status,mode,ends_at,seats,token_allowance)
 values(case when org is null then p_user else null end,org,p_plan,'trial','simulation',now()+interval '30 days',p_seats,tokens*p_seats) returning id into lic;
 if org is null then insert into public.scholar_wallets(license_id,user_id,allowance) values(lic,p_user,tokens); end if;
 return lic;
end $$;

-- Test ledger without provider calls; executable only from SQL Editor/backend.
create or replace function public.scholar_simulate(p_request uuid,p_wallet uuid,p_user uuid,p_input integer,p_output integer,p_failed boolean default false) returns uuid
language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.scholar_wallets w join public.scholar_licenses l on l.id=w.license_id where w.id=p_wallet and l.mode='simulation') then raise exception 'Somente franquias de simulação'; end if;
 perform public.scholar_reserve(p_request,p_wallet,p_user,'ideas','simulation',10000);
 perform public.scholar_settle(p_request,p_input,p_output,0,p_failed,'simulation');
 return p_request;
end $$;

revoke all on public.scholar_organizations,public.scholar_cohorts,public.scholar_memberships,public.scholar_licenses,public.scholar_wallets,public.scholar_invites,public.scholar_usage,public.scholar_project_shares from anon,authenticated;
grant select on public.scholar_organizations,public.scholar_cohorts,public.scholar_memberships,public.scholar_licenses,public.scholar_wallets,public.scholar_invites,public.scholar_usage,public.scholar_project_shares to authenticated;
-- Recargas provisionadas somente pela administração/backend, com chave idempotente.
create table if not exists public.scholar_recharges (
 id uuid primary key, license_id uuid not null references public.scholar_licenses on delete cascade,
 tokens bigint not null check(tokens > 0), created_at timestamptz not null default now()
);
alter table public.scholar_recharges enable row level security;
revoke all on public.scholar_recharges from anon,authenticated;
grant select on public.scholar_recharges to authenticated;
create policy "Scholar recharge visibility" on public.scholar_recharges for select to authenticated using(exists(select 1 from public.scholar_licenses l where l.id=license_id and (l.owner_id=auth.uid() or public.scholar_is_director(l.organization_id))));
create or replace function public.scholar_recharge(p_event uuid,p_license uuid,p_tokens bigint) returns void
language plpgsql security definer set search_path=public as $$
declare lic public.scholar_licenses; previous public.scholar_recharges;
begin
 if p_tokens is null or p_tokens<1 then raise exception 'Recarga inválida'; end if;
 select * into lic from public.scholar_licenses where id=p_license for update;
 select * into previous from public.scholar_recharges where id=p_event;
 if previous.id is not null then
  if previous.license_id<>p_license or previous.tokens<>p_tokens then raise exception 'Identificador de recarga já utilizado'; end if; return;
 end if;
 if lic.id is null or lic.status not in ('trial','active') or now() not between lic.starts_at and lic.ends_at then raise exception 'Licença indisponível'; end if;
 insert into public.scholar_recharges(id,license_id,tokens) values(p_event,p_license,p_tokens);
 update public.scholar_licenses set token_allowance=token_allowance+p_tokens where id=lic.id;
 if lic.owner_id is not null then update public.scholar_wallets set allowance=allowance+p_tokens where license_id=lic.id and user_id=lic.owner_id; end if;
end $$;
-- Lock down all new functions, then expose only the necessary member RPCs.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'scholar_%' loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
  if f.signature::text !~ 'scholar_(reserve|settle|provision|simulate|project_owner|recharge)\(' then execute format('grant execute on function %s to authenticated',f.signature); end if;
 end loop;
end $$;
commit;
