-- ============================================================
-- RESEARCHHUB — INSTALADOR COMPLETO
-- ============================================================
-- Rode este arquivo INTEIRO, uma única vez, num projeto Supabase
-- novo e vazio, para provisionar uma universidade nova.
--
-- Depois de rodar, acesse o site (com as env vars apontando pra
-- esse projeto Supabase), crie uma conta, e vá em /configuracao
-- para cadastrar a universidade e virar administrador — não
-- precisa editar nada aqui, nem mexer em seed.sql.
--
-- (seed.sql NÃO está incluído aqui de propósito — ele contém dados
-- fictícios de exemplo, só para desenvolvimento local. Uma
-- universidade real começa vazia e se popula pelo próprio site.)
-- ============================================================


-- ============================================================
-- Origem: 1_schema.sql
-- ============================================================
-- ============================================================
-- RESEARCHHUB — SCHEMA v1 (MVP Camada 1 + fundação completa)
-- ============================================================
-- Filosofia: o relacionamento entre entidades é mais importante
-- que as entidades. Toda tabela de ligação existe para permitir
-- que o grafo de conhecimento emerja das relações no Postgres.
--
-- Este schema já contém TODAS as tabelas do modelo de dados
-- (para não precisar remodelar depois), mas o MVP inicial (Camada 1)
-- só vai USAR na aplicação: universities, departments, laboratories,
-- research_lines, professors, projects.
-- As demais (publications, opportunities, students, interests,
-- saved_items, announcements, documents, tags) ficam prontas
-- no banco, mas sem UI ainda.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- NÍVEL INSTITUCIONAL
-- ------------------------------------------------------------

create table universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  logo_url text,
  website text,
  city text,
  state text,
  country text default 'BR',
  created_at timestamptz not null default now()
);

create table campuses (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  name text not null,
  city text,
  address text
);

create table departments (
  id uuid primary key default gen_random_uuid(),
  campus_id uuid references campuses(id) on delete set null,
  university_id uuid not null references universities(id) on delete cascade,
  name text not null,
  description text,
  head_professor_id uuid, -- FK adicionada depois (professors ainda não existe)
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- ESTRUTURAS DE PESQUISA
-- ------------------------------------------------------------

create table laboratories (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id) on delete cascade,
  name text not null,
  description text,
  website text,
  location text,
  email text,
  logo_url text,
  created_at timestamptz not null default now()
);

create table research_lines (
  id uuid primary key default gen_random_uuid(),
  laboratory_id uuid references laboratories(id) on delete set null,
  department_id uuid not null references departments(id) on delete cascade,
  name text not null,
  description text,
  keywords text[] default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- PESSOAS
-- ------------------------------------------------------------

create table users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid, -- referência ao Supabase Auth (auth.users)
  email text not null unique,
  name text not null,
  photo_url text,
  role text not null default 'student' check (role in ('student','professor','coordinator','admin','super_admin')),
  status text not null default 'active' check (status in ('active','pending','suspended')),
  university_id uuid references universities(id) on delete set null,
  created_at timestamptz not null default now()
);

create table professors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  department_id uuid not null references departments(id) on delete cascade,
  name text not null,
  photo_url text,
  email text,
  lattes_url text,
  orcid text,
  specialty text,
  bio text,
  accepting_students boolean not null default false,
  office text,
  phone text,
  created_at timestamptz not null default now()
);

alter table departments
  add constraint fk_department_head_professor
  foreign key (head_professor_id) references professors(id) on delete set null;

create table students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  registration text,
  course text,
  semester int,
  year int,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- TABELAS DE LIGAÇÃO — professor ⇄ linha / laboratório
-- ------------------------------------------------------------

create table professor_research_lines (
  professor_id uuid not null references professors(id) on delete cascade,
  research_line_id uuid not null references research_lines(id) on delete cascade,
  primary key (professor_id, research_line_id)
);

create table professor_laboratories (
  professor_id uuid not null references professors(id) on delete cascade,
  laboratory_id uuid not null references laboratories(id) on delete cascade,
  role text,
  primary key (professor_id, laboratory_id)
);

create table laboratory_research_lines (
  laboratory_id uuid not null references laboratories(id) on delete cascade,
  research_line_id uuid not null references research_lines(id) on delete cascade,
  primary key (laboratory_id, research_line_id)
);

-- ------------------------------------------------------------
-- PROJETOS
-- ------------------------------------------------------------

create table projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  research_line_id uuid references research_lines(id) on delete set null,
  laboratory_id uuid references laboratories(id) on delete set null,
  lead_professor_id uuid references professors(id) on delete set null,
  status text not null default 'draft' check (
    status in ('draft','in_review','published','recruiting','ongoing','completed','archived')
  ),
  funding text,
  accepting_students boolean not null default false,
  scholarship_available boolean not null default false,
  keywords text[] default '{}',
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

create table project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('professor','aluno','mestrando','doutorando','pesquisador')),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- PRODUÇÃO CIENTÍFICA
-- ------------------------------------------------------------

create table publications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  year int,
  journal text,
  doi text,
  abstract text,
  keywords text[] default '{}',
  publication_type text,
  pdf_url text,
  created_at timestamptz not null default now()
);

create table publication_authors (
  publication_id uuid not null references publications(id) on delete cascade,
  professor_id uuid references professors(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  author_order int,
  primary key (publication_id, professor_id, student_id)
);

create table publication_projects (
  publication_id uuid not null references publications(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  primary key (publication_id, project_id)
);

-- ------------------------------------------------------------
-- OPORTUNIDADES
-- ------------------------------------------------------------

create table opportunities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  description text,
  type text check (type in ('ic','monitoria','mestrado','doutorado','voluntario')),
  paid boolean default false,
  scholarship boolean default false,
  vacancies int default 1,
  requirements text,
  deadline date,
  status text default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- INTERESSES, FAVORITOS, ANÚNCIOS, DOCUMENTOS, TAGS
-- ------------------------------------------------------------

create table interests (
  student_id uuid not null references students(id) on delete cascade,
  research_line_id uuid not null references research_lines(id) on delete cascade,
  primary key (student_id, research_line_id)
);

create table saved_items (
  user_id uuid not null references users(id) on delete cascade,
  entity_type text not null check (entity_type in ('professor','project','laboratory','research_line')),
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, entity_type, entity_id)
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  title text not null,
  description text,
  category text,
  published_at timestamptz default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  url text not null,
  type text
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table entity_tags (
  entity_type text not null,
  entity_id uuid not null,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (entity_type, entity_id, tag_id)
);

-- Nota: índices de full-text search (to_tsvector) foram removidos desta
-- versão. O app usa `ilike` para busca simples, que não precisa deles.
-- Se a busca crescer e precisar de full-text de verdade, isso entra como
-- uma melhoria separada (com a sintaxe correta para evitar o erro
-- "functions in index expression must be marked IMMUTABLE").


-- ============================================================
-- Origem: 3_rls.sql
-- ============================================================
-- ============================================================
-- RLS — trava a anon key para SOMENTE LEITURA
-- ============================================================
-- Rode isso ANTES de divulgar a URL pública (Vercel) para alunos.
-- Sem isso, a anon key (que fica exposta no navegador) consegue
-- inserir/editar/apagar direto na API do Supabase.
--
-- Depois de rodar: você continua editando dados normalmente pelo
-- SQL Editor (que roda como admin e ignora RLS). O app só precisa
-- de leitura, então nada quebra.
-- ============================================================

alter table universities enable row level security;
alter table campuses enable row level security;
alter table departments enable row level security;
alter table laboratories enable row level security;
alter table research_lines enable row level security;
alter table professors enable row level security;
alter table projects enable row level security;
alter table professor_research_lines enable row level security;
alter table professor_laboratories enable row level security;
alter table laboratory_research_lines enable row level security;

-- Tabelas que o app ainda não usa na UI, mas já protege por padrão
alter table users enable row level security;
alter table students enable row level security;
alter table project_members enable row level security;
alter table publications enable row level security;
alter table publication_authors enable row level security;
alter table publication_projects enable row level security;
alter table opportunities enable row level security;
alter table interests enable row level security;
alter table saved_items enable row level security;
alter table announcements enable row level security;
alter table documents enable row level security;
alter table tags enable row level security;
alter table entity_tags enable row level security;

-- Leitura pública apenas nas tabelas que o app de fato consulta
create policy "Leitura pública" on universities for select using (true);
create policy "Leitura pública" on campuses for select using (true);
create policy "Leitura pública" on departments for select using (true);
create policy "Leitura pública" on laboratories for select using (true);
create policy "Leitura pública" on research_lines for select using (true);
create policy "Leitura pública" on professors for select using (true);
create policy "Leitura pública" on projects for select using (true);
create policy "Leitura pública" on professor_research_lines for select using (true);
create policy "Leitura pública" on professor_laboratories for select using (true);
create policy "Leitura pública" on laboratory_research_lines for select using (true);

-- As demais ficam com RLS ligado e SEM policy — ou seja, bloqueadas
-- por completo via anon key, até que tenham UI própria e regras
-- de acesso pensadas (isso é Camada 3, mais adiante no roadmap).


-- ============================================================
-- Origem: 4_auth.sql
-- ============================================================
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


-- ============================================================
-- Origem: 5_interests.sql
-- ============================================================
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


-- ============================================================
-- Origem: 6_projects.sql
-- ============================================================
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


-- ============================================================
-- Origem: 7_professor_selfcreate.sql
-- ============================================================
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


-- ============================================================
-- Origem: 8_coordinator.sql
-- ============================================================
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


-- ============================================================
-- Origem: 9_research_content.sql
-- ============================================================
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


-- ============================================================
-- Origem: 10_edit_content.sql
-- ============================================================
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


-- ============================================================
-- Origem: 11_saved_items.sql
-- ============================================================
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


-- ============================================================
-- Origem: 12_admin.sql
-- ============================================================
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


-- ============================================================
-- Origem: 13_publications.sql
-- ============================================================
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


-- ============================================================
-- Origem: 14_bulk_import.sql
-- ============================================================
-- ============================================================
-- Importação em massa de professores (item novo)
-- ============================================================
-- Rode depois de 13_publications.sql.
-- Permite que admin (qualquer departamento da própria universidade)
-- ou coordenador (só o próprio departamento) cadastrem vários
-- professores de uma vez (sem conta ainda — ficam "não reivindicados",
-- exatamente como os do seed original, prontos para o professor real
-- vincular a própria conta depois em /professores/vincular).

create policy "Admin ou coordenador importa professores em massa" on professors
  for insert
  with check (
    user_id is null
    and (
      department_id in (
        select d.id from departments d
        join universities un on un.id = d.university_id
        where un.owner_user_id = (select id from users where auth_user_id = auth.uid())
      )
      or department_id = (
        select department_id from users
        where auth_user_id = auth.uid() and role = 'coordinator'
      )
    )
  );


-- ============================================================
-- Origem: 15_admin_dashboard.sql
-- ============================================================
-- ============================================================
-- Painel completo do Admin (item novo)
-- ============================================================
-- Rode depois de 14_bulk_import.sql.
--
-- O admin precisa enxergar tudo (projetos em qualquer status,
-- interesses manifestados, contagem de alunos/coordenadores) para o
-- painel institucional fazer sentido. As policies de leitura
-- existentes são propositalmente restritas (dono vê o próprio,
-- coordenador vê o departamento) — aqui adicionamos, sem remover
-- nada, uma visão ampla só para quem é dono da universidade.
--
-- Como cada instância representa UMA universidade só (modelo "um
-- ResearchHub por universidade"), "toda a universidade" aqui
-- equivale a "toda a instância".
--
-- IMPORTANTE: a checagem "essa pessoa é admin?" fica numa função
-- SECURITY DEFINER (não numa subconsulta direta na policy). Isso
-- evita recursão infinita: a policy de SELECT em `users` não pode
-- consultar `users` de novo dentro de si mesma, ou o Postgres entra
-- em loop tentando reavaliar a própria policy.

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from universities un
    join users admin_user on admin_user.id = un.owner_user_id
    where admin_user.auth_user_id = auth.uid()
  );
$$;

create policy "Admin vê todos os projetos" on projects
  for select
  using (public.is_platform_admin());

create policy "Admin vê todos os interesses" on project_members
  for select
  using (public.is_platform_admin());

create policy "Admin vê todos os usuários" on users
  for select
  using (public.is_platform_admin());


-- ============================================================
-- Origem: 16_fix_recursion.sql
-- ============================================================
-- (já embutido no 15_admin_dashboard.sql acima com a versão corrigida,
--  incluído aqui só por completude do histórico — não precisa rodar de novo
--  se estiver instalando do zero com este arquivo.)

-- ============================================================
-- Origem: 17_coordinator_dashboard.sql
-- ============================================================
-- ============================================================
-- Painel completo do Coordenador (item novo)
-- ============================================================
-- Rode depois de 16_fix_recursion.sql.
--
-- A policy de project_members existente (6_projects.sql) só permitia
-- que o PRÓPRIO professor dono do projeto visse os interessados. O
-- coordenador do departamento também precisa ver isso para o painel
-- fazer sentido — sem isso, a consulta simplesmente volta vazia
-- (bloqueada pelo RLS, sem erro nenhum, só sem dado).

create policy "Coordenador vê interesses do departamento" on project_members
  for select
  using (
    project_id in (
      select pr.id from projects pr
      join professors p on p.id = pr.lead_professor_id
      where p.department_id = (
        select department_id from users
        where auth_user_id = auth.uid() and role = 'coordinator'
      )
    )
  );


-- ============================================================
-- Origem: 18_user_management.sql
-- ============================================================
-- ============================================================
-- Admin gerencia usuários (item novo)
-- ============================================================
-- Rode depois de 17_coordinator_dashboard.sql.
--
-- Até agora, trocar o papel de alguém (promover a coordenador,
-- rebaixar, suspender uma conta) só era possível mexendo direto no
-- SQL Editor. Isso dá ao admin uma forma de fazer isso pela interface.
--
-- Restrição de propósito: essa policy NUNCA permite promover alguém a
-- 'admin' — isso preserva a regra de "um admin só por instância",
-- criada como bootstrap único em 12_admin.sql. Só quem passou pelo
-- /configuracao original é admin; não existe caminho para criar um
-- segundo depois disso.

create policy "Admin gerencia usuários" on users
  for update
  using (public.is_platform_admin())
  with check (public.is_platform_admin() and role <> 'admin');


-- ============================================================
-- Origem: 19_suspend_enforcement.sql
-- ============================================================
-- ============================================================
-- P0 — Suspensão real de conta
-- ============================================================
-- Rode depois de 18_user_management.sql.
--
-- A proteção possui duas camadas:
-- 1) policies RESTRICTIVE bloqueiam escritas mesmo quando outra policy
--    permissiva autoriza a operação;
-- 2) o middleware direciona a pessoa para /conta-suspensa.
--
-- O status "pending" mantém o comportamento já existente. Somente
-- "suspended" bloqueia a conta nesta migration.

create or replace function public.is_active_user()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select case
    when (select auth.uid()) is null then false
    else coalesce(
      (
        select u.status <> 'suspended'
        from public.users u
        where u.auth_user_id = (select auth.uid())
      ),
      -- Permite a criação inicial do perfil entre o signup e a
      -- auto-criação executada por getCurrentAppUser().
      true
    )
  end;
$$;

revoke all on function public.is_active_user() from public;
grant execute on function public.is_active_user() to authenticated;

-- Impede que um usuário comum altere os próprios campos de segurança
-- (papel, status, universidade, departamento ou vínculo com Auth).
-- O admin pode gerenciar usuários, mas não criar um segundo admin.
create or replace function public.can_update_user_record(
  target_user_id uuid,
  proposed_auth_user_id uuid,
  proposed_role text,
  proposed_status text,
  proposed_university_id uuid,
  proposed_department_id uuid
)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.users current_row
    where current_row.id = target_user_id
      and current_row.auth_user_id is not distinct from proposed_auth_user_id
      and (
        (
          public.is_platform_admin()
          and (
            proposed_role <> 'admin'
            or (current_row.role = 'admin' and proposed_role = 'admin')
          )
        )
        or (
          current_row.auth_user_id = (select auth.uid())
          and proposed_role = current_row.role
          and proposed_status = current_row.status
          and proposed_university_id is not distinct from current_row.university_id
          and proposed_department_id is not distinct from current_row.department_id
        )
      )
  );
$$;

revoke all on function public.can_update_user_record(uuid, uuid, text, text, uuid, uuid) from public;
grant execute on function public.can_update_user_record(uuid, uuid, text, text, uuid, uuid) to authenticated;

-- Instituição e departamentos
drop policy if exists "Bloqueia escrita de suspenso (universities insert)" on universities;
create policy "Bloqueia escrita de suspenso (universities insert)" on universities
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (universities update)" on universities;
create policy "Bloqueia escrita de suspenso (universities update)" on universities
  as restrictive for update
  using (public.is_active_user())
  with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (departments insert)" on departments;
create policy "Bloqueia escrita de suspenso (departments insert)" on departments
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (departments update)" on departments;
create policy "Bloqueia escrita de suspenso (departments update)" on departments
  as restrictive for update
  using (public.is_active_user())
  with check (public.is_active_user());

-- Perfis e conteúdo de pesquisa
drop policy if exists "Bloqueia escrita de suspenso (professors insert)" on professors;
create policy "Bloqueia escrita de suspenso (professors insert)" on professors
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (professors update)" on professors;
create policy "Bloqueia escrita de suspenso (professors update)" on professors
  as restrictive for update
  using (public.is_active_user())
  with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (research_lines insert)" on research_lines;
create policy "Bloqueia escrita de suspenso (research_lines insert)" on research_lines
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (research_lines update)" on research_lines;
create policy "Bloqueia escrita de suspenso (research_lines update)" on research_lines
  as restrictive for update
  using (public.is_active_user())
  with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (laboratories insert)" on laboratories;
create policy "Bloqueia escrita de suspenso (laboratories insert)" on laboratories
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (laboratories update)" on laboratories;
create policy "Bloqueia escrita de suspenso (laboratories update)" on laboratories
  as restrictive for update
  using (public.is_active_user())
  with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (professor_research_lines insert)" on professor_research_lines;
create policy "Bloqueia escrita de suspenso (professor_research_lines insert)" on professor_research_lines
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (professor_laboratories insert)" on professor_laboratories;
create policy "Bloqueia escrita de suspenso (professor_laboratories insert)" on professor_laboratories
  as restrictive for insert with check (public.is_active_user());

-- Projetos e manifestações de interesse
drop policy if exists "Bloqueia escrita de suspenso (projects insert)" on projects;
create policy "Bloqueia escrita de suspenso (projects insert)" on projects
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (projects update)" on projects;
create policy "Bloqueia escrita de suspenso (projects update)" on projects
  as restrictive for update
  using (public.is_active_user())
  with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (project_members insert)" on project_members;
create policy "Bloqueia escrita de suspenso (project_members insert)" on project_members
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (project_members delete)" on project_members;
create policy "Bloqueia escrita de suspenso (project_members delete)" on project_members
  as restrictive for delete using (public.is_active_user());

-- Publicações
drop policy if exists "Bloqueia escrita de suspenso (publications insert)" on publications;
create policy "Bloqueia escrita de suspenso (publications insert)" on publications
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (publications update)" on publications;
create policy "Bloqueia escrita de suspenso (publications update)" on publications
  as restrictive for update
  using (public.is_active_user())
  with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (publication_authors insert)" on publication_authors;
create policy "Bloqueia escrita de suspenso (publication_authors insert)" on publication_authors
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (publication_projects insert)" on publication_projects;
create policy "Bloqueia escrita de suspenso (publication_projects insert)" on publication_projects
  as restrictive for insert with check (public.is_active_user());

-- Interesses do aluno e favoritos
drop policy if exists "Bloqueia escrita de suspenso (interests insert)" on interests;
create policy "Bloqueia escrita de suspenso (interests insert)" on interests
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (interests delete)" on interests;
create policy "Bloqueia escrita de suspenso (interests delete)" on interests
  as restrictive for delete using (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (saved_items insert)" on saved_items;
create policy "Bloqueia escrita de suspenso (saved_items insert)" on saved_items
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (saved_items delete)" on saved_items;
create policy "Bloqueia escrita de suspenso (saved_items delete)" on saved_items
  as restrictive for delete using (public.is_active_user());

-- Perfil de aluno
drop policy if exists "Bloqueia escrita de suspenso (students insert)" on students;
create policy "Bloqueia escrita de suspenso (students insert)" on students
  as restrictive for insert with check (public.is_active_user());

drop policy if exists "Bloqueia escrita de suspenso (students update)" on students;
create policy "Bloqueia escrita de suspenso (students update)" on students
  as restrictive for update
  using (public.is_active_user())
  with check (public.is_active_user());

-- Registro da aplicação. A policy SECURITY DEFINER evita recursão ao
-- validar uma atualização feita na própria tabela users.
drop policy if exists "Bloqueia escrita de suspenso (users update)" on users;
create policy "Bloqueia escrita de suspenso (users update)" on users
  as restrictive for update
  using (public.is_active_user())
  with check (
    public.is_active_user()
    and public.can_update_user_record(
      id,
      auth_user_id,
      role,
      status,
      university_id,
      department_id
    )
  );
