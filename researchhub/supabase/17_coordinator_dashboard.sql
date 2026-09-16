-- ============================================================
-- Painel completo do Coordenador (item novo)
-- ============================================================
-- Rode depois de 16_fix_recursion.sql.
--
-- A policy de project_members existente (6_projects.sql) só permitia
-- que o PRÓPRIO professor dono do projeto visse os interessados. O
-- coordenador do departamento também precisa ver isso para o painel
-- fazer sentido — sem isso, a consulta simplesmente volta vazia
-- (bloqueada pelo RLS, sem erro nenhum, só sem dado).

create policy "Coordenador vê interesses do departamento" on project_members
  for select
  using (
    project_id in (
      select pr.id from projects pr
      join professors p on p.id = pr.lead_professor_id
      where p.department_id = (
        select department_id from users
        where auth_user_id = auth.uid() and role = 'coordinator'
      )
    )
  );
