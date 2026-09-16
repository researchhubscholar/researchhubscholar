-- ============================================================
-- Professor cria linhas de pesquisa e laboratórios (Tier 2, item 5)
-- ============================================================
-- Rode depois de 8_coordinator.sql.
-- Até aqui, um professor só podia usar linhas de pesquisa e
-- laboratórios que já existiam no seed. Isso trava qualquer
-- departamento novo (ou área nova dentro do mesmo departamento).

-- Professor cria uma linha de pesquisa no próprio departamento.
create policy "Professor cria linha de pesquisa no próprio departamento" on research_lines
  for insert
  with check (
    department_id = (
      select p.department_id from professors p
      join users u on u.id = p.user_id
      where u.auth_user_id = auth.uid()
    )
  );

-- Professor cria um laboratório no próprio departamento.
create policy "Professor cria laboratório no próprio departamento" on laboratories
  for insert
  with check (
    department_id = (
      select p.department_id from professors p
      join users u on u.id = p.user_id
      where u.auth_user_id = auth.uid()
    )
  );

-- Professor se vincula a linhas/laboratórios que acabou de criar
-- (ou a outros já existentes do próprio departamento).
create policy "Professor se vincula a linha de pesquisa" on professor_research_lines
  for insert
  with check (
    professor_id = (
      select p.id from professors p
      join users u on u.id = p.user_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "Professor se vincula a laboratório" on professor_laboratories
  for insert
  with check (
    professor_id = (
      select p.id from professors p
      join users u on u.id = p.user_id
      where u.auth_user_id = auth.uid()
    )
  );
