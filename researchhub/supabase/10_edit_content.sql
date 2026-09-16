-- ============================================================
-- Editar linhas de pesquisa e laboratórios (Tier 2, item 5b)
-- ============================================================
-- Rode depois de 9_research_content.sql.
-- Completa o ciclo: criar já existia, faltava editar. Qualquer
-- professor vinculado a uma linha/laboratório (não só quem criou)
-- pode editar — reflete que essas entidades são compartilhadas entre
-- vários pesquisadores no mundo real.

create policy "Professor vinculado edita linha de pesquisa" on research_lines
  for update
  using (
    id in (
      select prl.research_line_id from professor_research_lines prl
      join professors p on p.id = prl.professor_id
      join users u on u.id = p.user_id
      where u.auth_user_id = auth.uid()
    )
  )
  with check (
    id in (
      select prl.research_line_id from professor_research_lines prl
      join professors p on p.id = prl.professor_id
      join users u on u.id = p.user_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "Professor vinculado edita laboratório" on laboratories
  for update
  using (
    id in (
      select pl.laboratory_id from professor_laboratories pl
      join professors p on p.id = pl.professor_id
      join users u on u.id = p.user_id
      where u.auth_user_id = auth.uid()
    )
  )
  with check (
    id in (
      select pl.laboratory_id from professor_laboratories pl
      join professors p on p.id = pl.professor_id
      join users u on u.id = p.user_id
      where u.auth_user_id = auth.uid()
    )
  );
