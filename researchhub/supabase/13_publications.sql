-- ============================================================
-- Publicações científicas (item novo)
-- ============================================================
-- Rode depois de 12_admin.sql.
-- As tabelas já existiam desde o schema original mas nunca tinham
-- sido usadas: publications, publication_authors, publication_projects.

alter table publications enable row level security;
alter table publication_authors enable row level security;
alter table publication_projects enable row level security;

-- Metadados de publicação são de leitura pública, como todo o resto.
create policy "Leitura pública de publicações" on publications
  for select using (true);

create policy "Leitura pública de autoria" on publication_authors
  for select using (true);

create policy "Leitura pública de publicação-projeto" on publication_projects
  for select using (true);

-- Qualquer professor autenticado pode cadastrar uma publicação nova.
create policy "Professor cria publicação" on publications
  for insert
  with check (
    exists (
      select 1 from professors p
      join users u on u.id = p.user_id
      where u.auth_user_id = auth.uid()
    )
  );

-- Um autor da publicação pode editá-la (corrigir DOI, resumo, etc).
create policy "Autor edita publicação" on publications
  for update
  using (
    id in (
      select pa.publication_id from publication_authors pa
      join professors p on p.id = pa.professor_id
      join users u on u.id = p.user_id
      where u.auth_user_id = auth.uid()
    )
  )
  with check (
    id in (
      select pa.publication_id from publication_authors pa
      join professors p on p.id = pa.professor_id
      join users u on u.id = p.user_id
      where u.auth_user_id = auth.uid()
    )
  );

-- Professor se vincula como autor da publicação que acabou de criar.
create policy "Professor se vincula como autor" on publication_authors
  for insert
  with check (
    professor_id = (
      select p.id from professors p
      join users u on u.id = p.user_id
      where u.auth_user_id = auth.uid()
    )
  );

-- Autor vincula a publicação a um projeto que ele mesmo lidera.
create policy "Autor vincula publicação a projeto próprio" on publication_projects
  for insert
  with check (
    publication_id in (
      select pa.publication_id from publication_authors pa
      join professors p on p.id = pa.professor_id
      join users u on u.id = p.user_id
      where u.auth_user_id = auth.uid()
    )
    and project_id in (
      select pr.id from projects pr
      join professors p on p.id = pr.lead_professor_id
      join users u on u.id = p.user_id
      where u.auth_user_id = auth.uid()
    )
  );
