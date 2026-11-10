-- ResearchHub: orientadores gratuitos convidados; benefício do plano do autor.
-- Pré-requisitos: scholar_access.sql e scholar_advising.sql. Reexecutável.
begin;
create schema if not exists scholar_private;
revoke all on schema scholar_private from public, anon, authenticated;

-- Executada apenas pelos RPCs SECURITY DEFINER abaixo; não expõe licenças.
create or replace function scholar_private.advisor_limit(p_owner uuid) returns integer
language sql stable set search_path=public,pg_temp as $$
 select coalesce(max(case l.plan when 'premium' then 3 when 'plus' then 1 else 0 end),0)
 from public.scholar_licenses l
 where l.status in ('active','trial') and l.starts_at<=now() and l.ends_at>now()
 and (l.owner_id=p_owner or exists(select 1 from public.scholar_memberships m
   where m.organization_id=l.organization_id and m.user_id=p_owner and m.active));
$$;
revoke all on function scholar_private.advisor_limit(uuid) from public,anon,authenticated;

-- Sem apagar vínculos: expiração suspende acesso; redução mantém as primeiras
-- vagas por data de aceite. O autor pode retirar um vínculo para liberar a vaga.
create or replace function public.scholar_is_project_advisor(p_project uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and exists (
   select 1 from (
     select c.user_id,row_number() over(order by c.added_at,c.user_id) as position
     from public.scholar_project_collaborators c
     where c.project_id=p_project and c.active and c.role='advisor'
   ) a join public.research_projects p on p.id=p_project
   where a.user_id=auth.uid() and a.position<=scholar_private.advisor_limit(p.owner_id)
 );
$$;

create or replace function public.scholar_advisor_capacity(p_project uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare cap integer; members integer; reserved integer;
begin
 if not public.scholar_owns_project(p_project) then raise exception 'Projeto indisponível'; end if;
 cap:=scholar_private.advisor_limit(auth.uid());
 select count(*) into members from public.scholar_project_collaborators where project_id=p_project and active and role='advisor';
 select count(*) into reserved from public.scholar_advisor_invites where project_id=p_project and not revoked and redeemed_at is null and expires_at>now();
 return jsonb_build_object('limit',cap,'active',members,'pending',reserved,'available',greatest(0,cap-members-reserved));
end $$;

create or replace function public.scholar_create_advisor_invite(p_project uuid,p_email text default null) returns text
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare code text; normalized text; capacity jsonb;
begin
 if not public.scholar_owns_project(p_project) then raise exception 'Projeto indisponível'; end if;
 -- Um único bloqueio por projeto serializa criação, aceite e cancelamento.
 perform 1 from public.research_projects where id=p_project for update;
 capacity:=public.scholar_advisor_capacity(p_project);
 if (capacity->>'limit')::integer=0 then raise exception 'SCHOLAR_ADVISOR_PLAN_REQUIRED'; end if;
 if (capacity->>'available')::integer=0 then raise exception 'SCHOLAR_ADVISOR_LIMIT_REACHED'; end if;
 normalized:=lower(nullif(trim(p_email),''));
 if normalized is not null and (length(normalized)<3 or length(normalized)>320 or position('@' in normalized)<2) then raise exception 'E-mail inválido'; end if;
 code:=encode(gen_random_bytes(16),'hex');
 insert into public.scholar_advisor_invites(project_id,created_by,code_hash,email,expires_at)
 values(p_project,auth.uid(),encode(digest(lower(code),'sha256'),'hex'),normalized,now()+interval '14 days');
 return code;
end $$;

create or replace function public.scholar_redeem_advisor_invite(p_code text) returns uuid
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare inv public.scholar_advisor_invites; who uuid:=auth.uid(); account_email text; cap integer; members integer; owner uuid;
begin
 if who is null then raise exception 'Entre na sua conta'; end if;
 select * into inv from public.scholar_advisor_invites where code_hash=encode(digest(lower(trim(p_code)),'sha256'),'hex');
 if inv.id is null then raise exception 'Convite inválido, expirado ou utilizado'; end if;
 select owner_id into owner from public.research_projects where id=inv.project_id for update;
 select * into inv from public.scholar_advisor_invites where id=inv.id for update;
 if inv.revoked or inv.redeemed_at is not null or inv.expires_at<=now() then raise exception 'Convite inválido, expirado ou utilizado'; end if;
 if owner=who then raise exception 'O proprietário não pode ser o próprio orientador'; end if;
 select lower(email) into account_email from auth.users where id=who and email_confirmed_at is not null;
 if account_email is null or (inv.email is not null and inv.email<>account_email) then raise exception 'Confirme o e-mail autorizado para este convite'; end if;
 cap:=scholar_private.advisor_limit(owner);
 if cap=0 then raise exception 'SCHOLAR_ADVISOR_PLAN_REQUIRED'; end if;
 if exists(select 1 from public.scholar_project_collaborators where project_id=inv.project_id and user_id=who and active) then raise exception 'SCHOLAR_ADVISOR_ALREADY_JOINED'; end if;
 select count(*) into members from public.scholar_project_collaborators where project_id=inv.project_id and active and role='advisor';
 if members>=cap then raise exception 'SCHOLAR_ADVISOR_LIMIT_REACHED'; end if;
 insert into public.scholar_project_collaborators(project_id,user_id,role,active) values(inv.project_id,who,'advisor',true)
 on conflict(project_id,user_id) do update set active=true,added_at=now();
 update public.scholar_advisor_invites set redeemed_by=who,redeemed_at=now() where id=inv.id;
 return inv.project_id;
end $$;

create or replace function public.scholar_revoke_advisor_invite(p_project uuid,p_invite uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.scholar_owns_project(p_project) then raise exception 'Projeto indisponível'; end if;
 perform 1 from public.research_projects where id=p_project for update;
 update public.scholar_advisor_invites set revoked=true where id=p_invite and project_id=p_project and redeemed_at is null and not revoked;
 if not found then raise exception 'Convite indisponível'; end if;
end $$;

create or replace function public.scholar_revoke_advisor(p_project uuid,p_user uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.scholar_owns_project(p_project) then raise exception 'Projeto indisponível'; end if;
 perform 1 from public.research_projects where id=p_project for update;
 update public.scholar_project_collaborators set active=false where project_id=p_project and user_id=p_user and role='advisor';
 if not found then raise exception 'Orientador não encontrado'; end if;
end $$;

-- O convidado comenta; atas e decisões continuam sob responsabilidade do autor.
drop policy if exists "Scholar advising meetings create" on public.scholar_advisor_meetings;
create policy "Scholar advising meetings create" on public.scholar_advisor_meetings for insert to authenticated
 with check(created_by=auth.uid() and public.scholar_owns_project(project_id));
drop policy if exists "Scholar advising meetings edit own" on public.scholar_advisor_meetings;
create policy "Scholar advising meetings edit own" on public.scholar_advisor_meetings for update to authenticated
 using(created_by=auth.uid() and public.scholar_owns_project(project_id))
 with check(created_by=auth.uid() and public.scholar_owns_project(project_id));

revoke all on function public.scholar_is_project_advisor(uuid),public.scholar_advisor_capacity(uuid),public.scholar_create_advisor_invite(uuid,text),public.scholar_redeem_advisor_invite(text),public.scholar_revoke_advisor_invite(uuid,uuid),public.scholar_revoke_advisor(uuid,uuid) from public,anon;
grant execute on function public.scholar_is_project_advisor(uuid),public.scholar_advisor_capacity(uuid),public.scholar_create_advisor_invite(uuid,text),public.scholar_redeem_advisor_invite(text),public.scholar_revoke_advisor_invite(uuid,uuid),public.scholar_revoke_advisor(uuid,uuid) to authenticated;
commit;
