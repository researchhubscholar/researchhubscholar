-- ============================================================
-- 20_scholar.sql — ResearchHub Scholar B2C
-- Perfil acadêmico + projetos científicos persistentes
-- Rode depois de 19_suspend_enforcement.sql
-- ============================================================

create table if not exists scholar_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  training_stage text not null default 'student' check (training_stage in ('student','resident','postgraduate','other')),
  specialty text,
  main_goal text check (main_goal is null or main_goal in ('tcc','article','congress','scientific_initiation','case_report','residency','other')),
  institution text,
  updated_at timestamptz not null default now()
);

create table if not exists scholar_projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references users(id) on delete cascade,
  title text,
  theme text,
  research_question text,
  objective text,
  hypothesis text,
  study_type text,
  population text,
  inclusion_criteria text,
  exclusion_criteria text,
  primary_outcome text,
  variables text,
  methods text,
  analysis_plan text,
  ethics_notes text,
  manuscript_notes text,
  status text not null default 'draft' check (status in ('draft','planning','literature','methods','writing','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists scholar_library (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references users(id) on delete cascade,
  project_id uuid references scholar_projects(id) on delete cascade,
  pmid text,
  doi text,
  title text not null,
  authors jsonb not null default '[]'::jsonb,
  journal text,
  publication_year int,
  publication_types jsonb not null default '[]'::jsonb,
  abstract text,
  source_url text,
  objective_note text,
  population_note text,
  method_note text,
  finding_note text,
  limitation_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id, pmid)
);

alter table scholar_profiles enable row level security;
alter table scholar_projects enable row level security;
alter table scholar_library enable row level security;

-- Perfil Scholar: apenas o próprio usuário.
create policy "Scholar lê próprio perfil" on scholar_profiles
  for select using (
    user_id = (select id from users where auth_user_id = auth.uid())
  );
create policy "Scholar cria próprio perfil" on scholar_profiles
  for insert with check (
    user_id = (select id from users where auth_user_id = auth.uid())
  );
create policy "Scholar edita próprio perfil" on scholar_profiles
  for update using (
    user_id = (select id from users where auth_user_id = auth.uid())
  ) with check (
    user_id = (select id from users where auth_user_id = auth.uid())
  );

-- Projetos: privados por padrão.
create policy "Scholar vê próprios projetos" on scholar_projects
  for select using (
    owner_user_id = (select id from users where auth_user_id = auth.uid())
  );
create policy "Scholar cria próprio projeto" on scholar_projects
  for insert with check (
    owner_user_id = (select id from users where auth_user_id = auth.uid())
  );
create policy "Scholar edita próprio projeto" on scholar_projects
  for update using (
    owner_user_id = (select id from users where auth_user_id = auth.uid())
  ) with check (
    owner_user_id = (select id from users where auth_user_id = auth.uid())
  );
create policy "Scholar exclui próprio projeto" on scholar_projects
  for delete using (
    owner_user_id = (select id from users where auth_user_id = auth.uid())
  );

-- Biblioteca: privada por usuário.
create policy "Scholar vê própria biblioteca" on scholar_library
  for select using (
    owner_user_id = (select id from users where auth_user_id = auth.uid())
  );
create policy "Scholar adiciona à própria biblioteca" on scholar_library
  for insert with check (
    owner_user_id = (select id from users where auth_user_id = auth.uid())
  );
create policy "Scholar edita própria biblioteca" on scholar_library
  for update using (
    owner_user_id = (select id from users where auth_user_id = auth.uid())
  ) with check (
    owner_user_id = (select id from users where auth_user_id = auth.uid())
  );
create policy "Scholar remove da própria biblioteca" on scholar_library
  for delete using (
    owner_user_id = (select id from users where auth_user_id = auth.uid())
  );

-- Suspensão também se aplica às novas tabelas.
create policy "Bloqueia escrita de suspenso (scholar_profiles insert)" on scholar_profiles
  as restrictive for insert with check (public.is_active_user());
create policy "Bloqueia escrita de suspenso (scholar_profiles update)" on scholar_profiles
  as restrictive for update using (public.is_active_user());
create policy "Bloqueia escrita de suspenso (scholar_projects insert)" on scholar_projects
  as restrictive for insert with check (public.is_active_user());
create policy "Bloqueia escrita de suspenso (scholar_projects update)" on scholar_projects
  as restrictive for update using (public.is_active_user());
create policy "Bloqueia escrita de suspenso (scholar_projects delete)" on scholar_projects
  as restrictive for delete using (public.is_active_user());
create policy "Bloqueia escrita de suspenso (scholar_library insert)" on scholar_library
  as restrictive for insert with check (public.is_active_user());
create policy "Bloqueia escrita de suspenso (scholar_library update)" on scholar_library
  as restrictive for update using (public.is_active_user());
create policy "Bloqueia escrita de suspenso (scholar_library delete)" on scholar_library
  as restrictive for delete using (public.is_active_user());
