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
