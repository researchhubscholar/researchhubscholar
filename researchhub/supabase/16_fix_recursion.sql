-- ============================================================
-- CORREÇÃO URGENTE — recursão infinita quebrando o login
-- ============================================================
-- Rode isso AGORA se você já rodou o 15_admin_dashboard.sql.
--
-- O que aconteceu: a policy "Admin vê todos os usuários" (criada em
-- 15_admin_dashboard.sql) consultava a tabela `users` de dentro de
-- uma policy QUE ESTÁ na própria tabela `users`. O Postgres precisa
-- reavaliar a mesma policy pra resolver essa subconsulta, entra num
-- loop, e desiste com erro de "recursão infinita" — como praticamente
-- toda página do site consulta `users` pra saber quem está logado,
-- isso quebrou o login geral, não só do admin.
--
-- A correção: mover a checagem "essa pessoa é admin?" para dentro de
-- uma função SECURITY DEFINER. Essa função roda com privilégio
-- elevado e ignora RLS na sua própria consulta interna, quebrando o
-- ciclo. É o padrão recomendado pelo próprio Supabase para esse tipo
-- de policy.

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from universities un
    join users admin_user on admin_user.id = un.owner_user_id
    where admin_user.auth_user_id = auth.uid()
  );
$$;

drop policy if exists "Admin vê todos os usuários" on users;

create policy "Admin vê todos os usuários" on users
  for select
  using (public.is_platform_admin());

-- As outras duas policies de 15_admin_dashboard.sql (projects e
-- project_members) não tinham o mesmo problema — elas ficam em
-- tabelas diferentes de onde fazem a subconsulta, então não há
-- recursão. Mas já que a função existe agora, vale usá-la ali também
-- por consistência e para evitar qualquer risco parecido no futuro.

drop policy if exists "Admin vê todos os projetos" on projects;
create policy "Admin vê todos os projetos" on projects
  for select
  using (public.is_platform_admin());

drop policy if exists "Admin vê todos os interesses" on project_members;
create policy "Admin vê todos os interesses" on project_members
  for select
  using (public.is_platform_admin());
