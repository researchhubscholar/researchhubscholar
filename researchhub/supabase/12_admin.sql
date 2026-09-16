-- ============================================================
-- Configuração inicial + papel Admin (modelo: 1 ResearchHub por universidade)
-- ============================================================
-- Rode depois de 11_saved_items.sql.
--
-- Decisão de produto: em vez de multiuniversidade compartilhada num
-- banco só, cada universidade tem sua própria instância/banco Supabase.
-- Isso significa que "criar uma universidade" só deve poder acontecer
-- UMA VEZ por instância — é o "instalador" rodando pela primeira vez.

alter table universities add column if not exists owner_user_id uuid references users(id) on delete set null;

-- Só permite criar universidade se AINDA NÃO existir nenhuma nessa
-- instância (bootstrap único). Depois da primeira, ninguém mais
-- consegue criar outra — por design, não por falta de permissão.
create policy "Criar universidade (somente no setup inicial)" on universities
  for insert
  with check (
    (select count(*) from universities) = 0
    and owner_user_id = (select id from users where auth_user_id = auth.uid())
  );

-- O dono (quem fez o setup inicial) pode editar os dados da universidade.
create policy "Dono edita a universidade" on universities
  for update
  using (owner_user_id = (select id from users where auth_user_id = auth.uid()))
  with check (owner_user_id = (select id from users where auth_user_id = auth.uid()));

-- ------------------------------------------------------------
-- Fechando uma brecha: antes, QUALQUER pessoa logada podia trocar o
-- próprio `role` para 'admin' direto pelo navegador (a policy antiga
-- de "editar próprio registro" não restringia valores). Substituímos
-- por uma versão que só permite virar 'admin' se a pessoa for
-- realmente dona de uma universidade (ou seja, passou pelo setup).
-- ------------------------------------------------------------

drop policy if exists "Editar próprio registro" on users;

create policy "Editar próprio registro" on users
  for update
  using (auth_user_id = auth.uid())
  with check (
    auth_user_id = auth.uid()
    and (
      role <> 'admin'
      or exists (select 1 from universities un where un.owner_user_id = users.id)
    )
  );

-- ------------------------------------------------------------
-- Admin cria e edita departamentos da própria universidade.
-- ------------------------------------------------------------

create policy "Admin cria departamento" on departments
  for insert
  with check (
    university_id = (
      select un.id from universities un
      where un.owner_user_id = (select id from users where auth_user_id = auth.uid())
    )
  );

create policy "Admin edita departamento" on departments
  for update
  using (
    university_id = (
      select un.id from universities un
      where un.owner_user_id = (select id from users where auth_user_id = auth.uid())
    )
  )
  with check (
    university_id = (
      select un.id from universities un
      where un.owner_user_id = (select id from users where auth_user_id = auth.uid())
    )
  );
