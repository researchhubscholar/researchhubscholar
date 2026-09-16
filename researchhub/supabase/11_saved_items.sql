-- ============================================================
-- Favoritos (Tier 2, item 6)
-- ============================================================
-- Rode depois de 10_edit_content.sql.
-- A tabela `saved_items` já existia desde o schema original mas
-- nunca tinha sido usada. Permite salvar professor, projeto,
-- laboratório ou linha de pesquisa com um clique.

alter table saved_items enable row level security;

create policy "Ver próprios favoritos" on saved_items
  for select
  using (
    user_id = (select id from users where auth_user_id = auth.uid())
  );

create policy "Adicionar favorito" on saved_items
  for insert
  with check (
    user_id = (select id from users where auth_user_id = auth.uid())
  );

create policy "Remover favorito" on saved_items
  for delete
  using (
    user_id = (select id from users where auth_user_id = auth.uid())
  );
