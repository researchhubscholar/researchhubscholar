-- ============================================================
-- RLS — Autenticação (Passo 1 da Camada 3)
-- ============================================================
-- Rode depois de 3_rls.sql. Este arquivo dá às pessoas autenticadas
-- permissão de gerenciar SÓ os próprios dados — nunca os de outra
-- pessoa. Continua tudo de leitura pública (definido em 3_rls.sql).
-- ============================================================

alter table users enable row level security;
alter table students enable row level security;

-- Qualquer pessoa autenticada pode criar seu próprio registro em `users`
-- no momento do cadastro (auth_user_id precisa bater com o usuário logado).
create policy "Criar próprio registro" on users
  for insert
  with check (auth_user_id = auth.uid());

-- Cada pessoa só lê e edita o próprio registro em `users`.
create policy "Ler próprio registro" on users
  for select
  using (auth_user_id = auth.uid());

create policy "Editar próprio registro" on users
  for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Idem para `students`.
create policy "Criar próprio perfil de aluno" on students
  for insert
  with check (
    user_id = (select id from users where auth_user_id = auth.uid())
  );

create policy "Ler próprio perfil de aluno" on students
  for select
  using (
    user_id = (select id from users where auth_user_id = auth.uid())
  );

create policy "Editar próprio perfil de aluno" on students
  for update
  using (
    user_id = (select id from users where auth_user_id = auth.uid())
  );

-- Professor: pode reivindicar (claim) um perfil ainda não vinculado
-- (user_id is null) e, depois de vinculado, só pode editar o próprio.
-- A leitura pública de `professors` já existe em 3_rls.sql — isso aqui
-- só adiciona permissão de ESCRITA restrita ao dono do perfil.
create policy "Reivindicar ou editar próprio perfil de professor" on professors
  for update
  using (
    user_id is null
    or user_id = (select id from users where auth_user_id = auth.uid())
  )
  with check (
    user_id = (select id from users where auth_user_id = auth.uid())
  );
