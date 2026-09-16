-- ============================================================
-- P0 — Suspensão real de conta
-- ============================================================
-- Rode depois de 18_user_management.sql.
--
-- A proteção possui duas camadas:
-- 1) policies RESTRICTIVE bloqueiam escritas mesmo quando outra policy
--    permissiva autoriza a operação;
-- 2) o middleware direciona a pessoa para /conta-suspensa.
--
-- O status "pending" mantém o comportamento já existente. Somente
-- "suspended" bloqueia a conta nesta migration.

create or replace function public.is_active_user()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select case
    when (select auth.uid()) is null then false
    else coalesce(
      (
        select u.status <> 'suspended'
        from public.users u
        where u.auth_user_id = (select auth.uid())
      ),
      -- Permite a criação inicial do perfil entre o signup e a
      -- auto-criação executada por getCurrentAppUser().
      true
    )
  end;
$$;

revoke all on function public.is_active_user() from public;
grant execute on function public.is_active_user() to authenticated;

-- Impede que um usuário comum altere os próprios campos de segurança
-- (papel, status, universidade, departamento ou vínculo com Auth).
-- O admin pode gerenciar usuários, mas não criar um segundo admin.
create or replace function public.can_update_user_record(
  target_user_id uuid,
  proposed_auth_user_id uuid,
  proposed_role text,
  proposed_status text,
  proposed_university_id uuid,
  proposed_department_id uuid
)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.users current_row
    where current_row.id = target_user_id
      and current_row.auth_user_id is not distinct from proposed_auth_user_id
      and (
        (
          public.is_platform_admin()
          and (
            proposed_role <> 'admin'
            or (current_row.role = 'admin' and proposed_role = 'admin')
          )
        )
        or (
          current_row.auth_user_id = (select auth.uid())
          and proposed_role = current_row.role
          and proposed_status = current_row.status
          and proposed_university_id is not distinct from current_row.university_id
          and proposed_department_id is not distinct from current_row.department_id
        )
      )
  );
$$;

revoke all on function public.can_update_user_record(uuid, uuid, text, text, uuid, uuid) from public;
grant execute on function public.can_update_user_record(uuid, uuid, text, text, uuid, uuid) to authenticated;

-- Instituição e departamentos
drop policy if exists "Bloqueia escrita de suspenso (universities insert)" on universities;
create policy "Bloqueia escrita de suspenso (universities insert)" on universities
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (universities update)" on universities;
create policy "Bloqueia escrita de suspenso (universities update)" on universities
  as restrictive for update
  using (public.is_active_user())
  with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (departments insert)" on departments;
create policy "Bloqueia escrita de suspenso (departments insert)" on departments
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (departments update)" on departments;
create policy "Bloqueia escrita de suspenso (departments update)" on departments
  as restrictive for update
  using (public.is_active_user())
  with check (public.is_active_user());

-- Perfis e conteúdo de pesquisa
drop policy if exists "Bloqueia escrita de suspenso (professors insert)" on professors;
create policy "Bloqueia escrita de suspenso (professors insert)" on professors
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (professors update)" on professors;
create policy "Bloqueia escrita de suspenso (professors update)" on professors
  as restrictive for update
  using (public.is_active_user())
  with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (research_lines insert)" on research_lines;
create policy "Bloqueia escrita de suspenso (research_lines insert)" on research_lines
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (research_lines update)" on research_lines;
create policy "Bloqueia escrita de suspenso (research_lines update)" on research_lines
  as restrictive for update
  using (public.is_active_user())
  with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (laboratories insert)" on laboratories;
create policy "Bloqueia escrita de suspenso (laboratories insert)" on laboratories
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (laboratories update)" on laboratories;
create policy "Bloqueia escrita de suspenso (laboratories update)" on laboratories
  as restrictive for update
  using (public.is_active_user())
  with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (professor_research_lines insert)" on professor_research_lines;
create policy "Bloqueia escrita de suspenso (professor_research_lines insert)" on professor_research_lines
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (professor_laboratories insert)" on professor_laboratories;
create policy "Bloqueia escrita de suspenso (professor_laboratories insert)" on professor_laboratories
  as restrictive for insert with check (public.is_active_user());

-- Projetos e manifestações de interesse
drop policy if exists "Bloqueia escrita de suspenso (projects insert)" on projects;
create policy "Bloqueia escrita de suspenso (projects insert)" on projects
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (projects update)" on projects;
create policy "Bloqueia escrita de suspenso (projects update)" on projects
  as restrictive for update
  using (public.is_active_user())
  with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (project_members insert)" on project_members;
create policy "Bloqueia escrita de suspenso (project_members insert)" on project_members
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (project_members delete)" on project_members;
create policy "Bloqueia escrita de suspenso (project_members delete)" on project_members
  as restrictive for delete using (public.is_active_user());

-- Publicações
drop policy if exists "Bloqueia escrita de suspenso (publications insert)" on publications;
create policy "Bloqueia escrita de suspenso (publications insert)" on publications
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (publications update)" on publications;
create policy "Bloqueia escrita de suspenso (publications update)" on publications
  as restrictive for update
  using (public.is_active_user())
  with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (publication_authors insert)" on publication_authors;
create policy "Bloqueia escrita de suspenso (publication_authors insert)" on publication_authors
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (publication_projects insert)" on publication_projects;
create policy "Bloqueia escrita de suspenso (publication_projects insert)" on publication_projects
  as restrictive for insert with check (public.is_active_user());

-- Interesses do aluno e favoritos
drop policy if exists "Bloqueia escrita de suspenso (interests insert)" on interests;
create policy "Bloqueia escrita de suspenso (interests insert)" on interests
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (interests delete)" on interests;
create policy "Bloqueia escrita de suspenso (interests delete)" on interests
  as restrictive for delete using (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (saved_items insert)" on saved_items;
create policy "Bloqueia escrita de suspenso (saved_items insert)" on saved_items
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (saved_items delete)" on saved_items;
create policy "Bloqueia escrita de suspenso (saved_items delete)" on saved_items
  as restrictive for delete using (public.is_active_user());

-- Perfil de aluno
drop policy if exists "Bloqueia escrita de suspenso (students insert)" on students;
create policy "Bloqueia escrita de suspenso (students insert)" on students
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (students update)" on students;
create policy "Bloqueia escrita de suspenso (students update)" on students
  as restrictive for update
  using (public.is_active_user())
  with check (public.is_active_user());

-- Registro da aplicação. A policy SECURITY DEFINER evita recursão ao
-- validar uma atualização feita na própria tabela users.
drop policy if exists "Bloqueia escrita de suspenso (users update)" on users;
create policy "Bloqueia escrita de suspenso (users update)" on users
  as restrictive for update
  using (public.is_active_user())
  with check (
    public.is_active_user()
    and public.can_update_user_record(
      id,
      auth_user_id,
      role,
      status,
      university_id,
      department_id
    )
  );
