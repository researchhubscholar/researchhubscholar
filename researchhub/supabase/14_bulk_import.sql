-- ============================================================
-- Importação em massa de professores (item novo)
-- ============================================================
-- Rode depois de 13_publications.sql.
-- Permite que admin (qualquer departamento da própria universidade)
-- ou coordenador (só o próprio departamento) cadastrem vários
-- professores de uma vez (sem conta ainda — ficam "não reivindicados",
-- exatamente como os do seed original, prontos para o professor real
-- vincular a própria conta depois em /professores/vincular).

create policy "Admin ou coordenador importa professores em massa" on professors
  for insert
  with check (
    user_id is null
    and (
      department_id in (
        select d.id from departments d
        join universities un on un.id = d.university_id
        where un.owner_user_id = (select id from users where auth_user_id = auth.uid())
      )
      or department_id = (
        select department_id from users
        where auth_user_id = auth.uid() and role = 'coordinator'
      )
    )
  );
