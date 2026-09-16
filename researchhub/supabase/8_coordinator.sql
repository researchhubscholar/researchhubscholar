-- ============================================================
-- Coordenador — Workflow de aprovação (Tier 1, item 4)
-- ============================================================
-- Rode depois de 7_professor_selfcreate.sql.
--
-- Adiciona a coluna que falta para um Coordenador existir de verdade
-- (qual departamento ele coordena) e a permissão para ele aprovar ou
-- rejeitar projetos daquele departamento — sem isso, "coordinator" era
-- só um valor aceito na coluna `role`, mas sem nenhum efeito prático.

alter table users add column if not exists department_id uuid references departments(id) on delete set null;

-- Coordenador só edita (aprova/rejeita) projetos cujo professor
-- responsável pertence ao departamento que ele coordena. Isso convive
-- com a policy "Professor edita projeto próprio" já existente — no
-- Postgres, políticas do mesmo comando são combinadas com OR.
create policy "Coordenador aprova projetos do departamento" on projects
  for update
  using (
    lead_professor_id in (
      select p.id from professors p
      where p.department_id = (
        select u.department_id from users u
        where u.auth_user_id = auth.uid() and u.role = 'coordinator'
      )
    )
  )
  with check (
    lead_professor_id in (
      select p.id from professors p
      where p.department_id = (
        select u.department_id from users u
        where u.auth_user_id = auth.uid() and u.role = 'coordinator'
      )
    )
  );

-- ------------------------------------------------------------
-- Visibilidade por status
-- ------------------------------------------------------------
-- Até aqui, a policy "Leitura pública" (de 3_rls.sql) deixava
-- QUALQUER projeto visível para todo mundo, inclusive Rascunho e Em
-- revisão — ou seja, um link direto vazava um projeto ainda não
-- aprovado. Substituímos por uma policy que só libera publicamente
-- projetos já aprovados; o próprio professor sempre vê os seus, e o
-- coordenador sempre vê os do departamento que ele coordena (precisa
-- disso para poder revisar).

drop policy if exists "Leitura pública" on projects;

create policy "Leitura de projetos conforme status" on projects
  for select
  using (
    status not in ('draft', 'in_review')
    or lead_professor_id = (
      select p.id from professors p
      join users u on u.id = p.user_id
      where u.auth_user_id = auth.uid()
    )
    or lead_professor_id in (
      select p.id from professors p
      where p.department_id = (
        select u.department_id from users u
        where u.auth_user_id = auth.uid() and u.role = 'coordinator'
      )
    )
  );
