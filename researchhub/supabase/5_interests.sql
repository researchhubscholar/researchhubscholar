-- ============================================================
-- RLS — Interesses do aluno (Passo 2 da Camada 3)
-- ============================================================
-- Rode depois de 4_auth.sql.

alter table interests enable row level security;

create policy "Ler próprios interesses" on interests
  for select
  using (
    student_id = (
      select s.id from students s
      join users u on u.id = s.user_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "Adicionar próprios interesses" on interests
  for insert
  with check (
    student_id = (
      select s.id from students s
      join users u on u.id = s.user_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "Remover próprios interesses" on interests
  for delete
  using (
    student_id = (
      select s.id from students s
      join users u on u.id = s.user_id
      where u.auth_user_id = auth.uid()
    )
  );
