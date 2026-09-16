-- ============================================================
-- RLS — Projetos e Interessados (Passo 3 da Camada 3)
-- ============================================================
-- Rode depois de 5_interests.sql.
-- Dá ao professor controle sobre os próprios projetos (criar, editar)
-- e transforma "manifestar interesse" num registro real, não só um
-- e-mail solto.

alter table projects enable row level security;
alter table project_members enable row level security;

-- Professor cria projetos com ele mesmo como responsável.
create policy "Professor cria projeto próprio" on projects
  for insert
  with check (
    lead_professor_id = (
      select p.id from professors p
      join users u on u.id = p.user_id
      where u.auth_user_id = auth.uid()
    )
  );

-- Professor só edita os próprios projetos (não pode transferir a
-- responsabilidade para outro professor via edição).
create policy "Professor edita projeto próprio" on projects
  for update
  using (
    lead_professor_id = (
      select p.id from professors p
      join users u on u.id = p.user_id
      where u.auth_user_id = auth.uid()
    )
  )
  with check (
    lead_professor_id = (
      select p.id from professors p
      join users u on u.id = p.user_id
      where u.auth_user_id = auth.uid()
    )
  );

-- Qualquer pessoa autenticada pode manifestar interesse em um projeto
-- (inserir a si mesma como membro/interessada).
create policy "Manifestar interesse em projeto" on project_members
  for insert
  with check (
    user_id = (select id from users where auth_user_id = auth.uid())
  );

-- Cada pessoa vê o próprio interesse; o professor responsável pelo
-- projeto vê todos os interessados naquele projeto.
create policy "Ver interesses relevantes" on project_members
  for select
  using (
    user_id = (select id from users where auth_user_id = auth.uid())
    or project_id in (
      select pr.id from projects pr
      join professors p on p.id = pr.lead_professor_id
      join users u on u.id = p.user_id
      where u.auth_user_id = auth.uid()
    )
  );

-- Aluno pode retirar o próprio interesse.
create policy "Retirar interesse" on project_members
  for delete
  using (
    user_id = (select id from users where auth_user_id = auth.uid())
  );
