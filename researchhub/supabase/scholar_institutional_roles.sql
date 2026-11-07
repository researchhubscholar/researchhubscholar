-- Execute após scholar_access.sql. Reexecutável, sem remoção de dados.
begin;
alter table public.scholar_memberships drop constraint if exists scholar_memberships_role_check;
alter table public.scholar_memberships add constraint scholar_memberships_role_check check(role in ('director','coordinator','advisor','resident'));
create or replace function public.scholar_can_coordinate(p_org uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.scholar_memberships where organization_id=p_org and user_id=auth.uid() and active and role in ('director','coordinator'));
$$;
revoke all on function public.scholar_can_coordinate(uuid) from public;
grant execute on function public.scholar_can_coordinate(uuid) to authenticated;
create table if not exists public.scholar_institutional_audit (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.scholar_organizations(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null, action text not null, entity text not null,
 entity_id text not null, details jsonb not null default '{}', created_at timestamptz not null default now()
);
alter table public.scholar_institutional_audit enable row level security;
drop policy if exists "Scholar coordinate audit" on public.scholar_institutional_audit;
create policy "Scholar coordinate audit" on public.scholar_institutional_audit for select to authenticated using(public.scholar_can_coordinate(organization_id));
revoke all on public.scholar_institutional_audit from anon,authenticated;
grant select on public.scholar_institutional_audit to authenticated;
grant all on public.scholar_institutional_audit to service_role;
create or replace function public.scholar_audit_institution() returns trigger
language plpgsql security definer set search_path=public as $$
declare row_data jsonb; previous jsonb; org uuid; entity_key text; safe jsonb;
begin
 row_data:=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 previous:=case when TG_OP='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
 org:=nullif(row_data->>'organization_id','')::uuid;
 if TG_TABLE_NAME='scholar_wallets' then select organization_id into org from public.scholar_licenses where id=(row_data->>'license_id')::uuid;
  -- Only allocation changes, not every token settlement.
  if TG_OP='UPDATE' and row_data->>'allowance'=previous->>'allowance' then return new; end if;
 end if;
 if org is null then return coalesce(new,old); end if;
 entity_key:=coalesce(row_data->>'id',row_data->>'user_id',row_data->>'project_id','');
 safe:=jsonb_build_object('user_id',row_data->>'user_id','role',row_data->>'role','active',row_data->>'active','cohort_id',row_data->>'cohort_id','allowance',row_data->>'allowance','previous_role',previous->>'role','previous_allowance',previous->>'allowance');
 insert into public.scholar_institutional_audit(organization_id,actor_id,action,entity,entity_id,details) values(org,auth.uid(),TG_OP,TG_TABLE_NAME,entity_key,safe);
 return coalesce(new,old);
end $$;
revoke all on function public.scholar_audit_institution() from public;
do $$ declare t text; begin foreach t in array array['scholar_memberships','scholar_cohorts','scholar_invites','scholar_wallets','scholar_project_shares'] loop
 execute format('drop trigger if exists scholar_institution_audit on public.%I',t);
 execute format('create trigger scholar_institution_audit after insert or update or delete on public.%I for each row execute function public.scholar_audit_institution()',t);
end loop; end $$;
create or replace function public.scholar_set_staff_role(p_org uuid,p_user uuid,p_role text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not public.scholar_is_director(p_org) then raise exception 'Apenas o diretor altera perfis'; end if;
 if p_role not in ('coordinator','advisor','resident') then raise exception 'Perfil inválido'; end if;
 perform 1 from public.scholar_licenses where organization_id=p_org for update;
 if p_role='resident' and not exists(select 1 from public.scholar_memberships where organization_id=p_org and user_id=p_user and role='resident') and (select count(*) from public.scholar_memberships where organization_id=p_org and active and role='resident') >= (select seats from public.scholar_licenses where organization_id=p_org) then raise exception 'Todas as vagas estão ocupadas'; end if;
 update public.scholar_memberships set role=p_role where organization_id=p_org and user_id=p_user and active and role<>'director';
 if not found then raise exception 'Membro ativo indisponível'; end if;
end $$;
revoke all on function public.scholar_set_staff_role(uuid,uuid,text) from public;
grant execute on function public.scholar_set_staff_role(uuid,uuid,text) to authenticated;

create or replace function public.scholar_create_cohort(p_org uuid,p_name text) returns uuid
language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if not public.scholar_can_coordinate(p_org) then raise exception 'Acesso restrito à coordenação'; end if;
 insert into public.scholar_cohorts(organization_id,name) values(p_org,trim(p_name)) returning id into result; return result;
end $$;

create or replace function public.scholar_create_invite(p_org uuid,p_cohort uuid default null,p_email text default null,p_uses integer default 1) returns text
language plpgsql security definer set search_path=public,extensions as $$
declare code text; lic public.scholar_licenses;
begin
 if not public.scholar_can_coordinate(p_org) then raise exception 'Acesso restrito à coordenação'; end if;
 select * into lic from public.scholar_licenses where organization_id=p_org for update;
 if lic.id is null or lic.status not in ('active','trial') or now() not between lic.starts_at and lic.ends_at then raise exception 'Licença institucional indisponível'; end if;
 if p_uses < 1 or p_uses > lic.seats then raise exception 'Quantidade inválida'; end if;
 if nullif(trim(p_email),'') is not null and p_uses <> 1 then raise exception 'Convite por e-mail deve ter uma utilização'; end if;
 code := encode(gen_random_bytes(16),'hex');
 insert into public.scholar_invites(organization_id,cohort_id,code_hash,email,max_uses,expires_at)
 values(p_org,p_cohort,encode(digest(code,'sha256'),'hex'),lower(nullif(trim(p_email),'')),p_uses,least(now()+interval '7 days',lic.ends_at));
 return code;
end $$;

create or replace function public.scholar_revoke_invite(p_invite uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 update public.scholar_invites set revoked=true where id=p_invite and public.scholar_can_coordinate(organization_id);
 if not found then raise exception 'Convite indisponível'; end if;
end $$;

create or replace function public.scholar_manage_member(p_org uuid,p_user uuid,p_active boolean,p_cohort uuid default null) returns void
language plpgsql security definer set search_path=public as $$
declare lic public.scholar_licenses;
begin
 if not public.scholar_can_coordinate(p_org) then raise exception 'Acesso restrito à coordenação'; end if;
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
 if not public.scholar_can_coordinate(p_org) then raise exception 'Acesso restrito à coordenação'; end if;
 return query select m.user_id,p.name,account.email::text,m.active,m.cohort_id,w.allowance,w.used,w.reserved,w.id
 from public.scholar_memberships m join auth.users account on account.id=m.user_id left join public.profiles p on p.id=m.user_id
 left join public.scholar_licenses l on l.organization_id=m.organization_id
 left join public.scholar_wallets w on w.license_id=l.id and w.user_id=m.user_id
 where m.organization_id=p_org and m.role='resident' order by m.created_at;
end $$;

drop policy if exists "Scholar membership visibility" on public.scholar_memberships;
create policy "Scholar membership visibility" on public.scholar_memberships for select to authenticated using(user_id=auth.uid() or public.scholar_can_coordinate(organization_id));

drop policy if exists "Scholar invite directors" on public.scholar_invites;
create policy "Scholar invite directors" on public.scholar_invites for select to authenticated using(public.scholar_can_coordinate(organization_id));

drop policy if exists "Scholar share visibility" on public.scholar_project_shares;
create policy "Scholar share visibility" on public.scholar_project_shares for select to authenticated using(public.scholar_can_coordinate(organization_id) or public.scholar_owns_project(project_id));

drop policy if exists "Scholar director reads shared projects" on public.research_projects;
create policy "Scholar director reads shared projects" on public.research_projects for select to authenticated using(exists(select 1 from public.scholar_project_shares s where s.project_id=id and public.scholar_can_coordinate(s.organization_id)));

commit;
