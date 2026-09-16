-- ============================================================
-- RLS — Professor cria o próprio perfil do zero (Tier 1, item 1)
-- ============================================================
-- Rode depois de 6_projects.sql.
-- Até agora, um professor só existia se alguém (você) inseriu o
-- registro manualmente no seed, e a pessoa só podia "reivindicar" um
-- perfil já existente. Isso não escala: um professor de outro
-- departamento não tinha como aparecer.
--
-- Essa policy permite que qualquer pessoa autenticada com papel
-- "professor" (na tabela `users`) crie o próprio registro em
-- `professors` do zero, vinculado a um departamento já existente.

create policy "Professor cria próprio perfil do zero" on professors
  for insert
  with check (
    user_id = (select id from users where auth_user_id = auth.uid())
  );
