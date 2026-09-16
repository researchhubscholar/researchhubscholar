-- ============================================================
-- RESEARCHHUB SCHOLAR — INSTALADOR COMPLETO
-- Produto B2C independente do ResearchHub institucional
-- Rode uma única vez em um projeto Supabase novo e vazio.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- PERFIL DO USUÁRIO
-- A identidade principal é auth.users.id.
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  user_type text not null default 'student'
    check (user_type in ('student','resident','advisor')),
  training_stage text not null default 'student'
    check (training_stage in ('student','resident','postgraduate','other')),
  specialty text,
  institution text,
  main_goal text
    check (main_goal is null or main_goal in (
      'tcc','article','congress','scientific_initiation','case_report','residency','other'
    )),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- PROJETOS CIENTÍFICOS
-- ------------------------------------------------------------
create table public.research_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
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
  status text not null default 'draft'
    check (status in ('draft','planning','literature','methods','writing','completed')),
  progress integer not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index research_projects_owner_idx on public.research_projects(owner_id);
create index research_projects_updated_idx on public.research_projects(owner_id, updated_at desc);

-- ------------------------------------------------------------
-- BIBLIOTECA CIENTÍFICA
-- ------------------------------------------------------------
create table public.library_articles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.research_projects(id) on delete cascade,
  pmid text,
  doi text,
  title text not null,
  authors jsonb not null default '[]'::jsonb,
  journal text,
  publication_year integer,
  publication_types jsonb not null default '[]'::jsonb,
  abstract text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index library_articles_owner_pmid_unique
  on public.library_articles(owner_id, pmid)
  where pmid is not null;
create index library_articles_owner_idx on public.library_articles(owner_id);
create index library_articles_project_idx on public.library_articles(project_id);

-- ------------------------------------------------------------
-- MATRIZ DE EVIDÊNCIAS
-- Uma linha por artigo salvo.
-- ------------------------------------------------------------
create table public.evidence_matrix (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.research_projects(id) on delete cascade,
  article_id uuid not null references public.library_articles(id) on delete cascade,
  objective text,
  population text,
  method text,
  main_finding text,
  limitation text,
  notes text,
  confirmed_objective boolean not null default false,
  confirmed_population boolean not null default false,
  confirmed_method boolean not null default false,
  confirmed_main_finding boolean not null default false,
  confirmed_limitation boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, article_id)
);

create index evidence_matrix_owner_idx on public.evidence_matrix(owner_id);
create index evidence_matrix_project_idx on public.evidence_matrix(project_id);

-- ------------------------------------------------------------
-- HISTÓRICO DO RADAR CIENTÍFICO
-- ------------------------------------------------------------
create table public.search_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  query text not null,
  pubmed_total integer,
  recent_total integer,
  systematic_reviews integer,
  clinical_trials integer,
  trend text,
  breadth text,
  searched_at timestamptz not null default now()
);

create index search_history_owner_idx on public.search_history(owner_id, searched_at desc);

-- ------------------------------------------------------------
-- AUTOCRIAÇÃO DO PERFIL NO SIGNUP
-- Funciona mesmo com confirmação de e-mail ativada.
-- ------------------------------------------------------------
create or replace function public.handle_new_scholar_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_type text;
begin
  requested_type := coalesce(new.raw_user_meta_data ->> 'scholar_stage', 'student');

  insert into public.profiles (
    id,
    name,
    email,
    user_type,
    training_stage
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)),
    new.email,
    case
      when requested_type = 'resident' then 'resident'
      when requested_type = 'professor' then 'advisor'
      else 'student'
    end,
    case
      when requested_type = 'resident' then 'resident'
      else 'student'
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_scholar on auth.users;
create trigger on_auth_user_created_scholar
  after insert on auth.users
  for each row execute procedure public.handle_new_scholar_user();

-- ------------------------------------------------------------
-- UPDATED_AT AUTOMÁTICO
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger research_projects_set_updated_at
  before update on public.research_projects
  for each row execute procedure public.set_updated_at();

create trigger library_articles_set_updated_at
  before update on public.library_articles
  for each row execute procedure public.set_updated_at();

create trigger evidence_matrix_set_updated_at
  before update on public.evidence_matrix
  for each row execute procedure public.set_updated_at();

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Cada usuário acessa somente os próprios dados.
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.research_projects enable row level security;
alter table public.library_articles enable row level security;
alter table public.evidence_matrix enable row level security;
alter table public.search_history enable row level security;

create policy "Usuário lê próprio perfil"
  on public.profiles for select
  using (id = auth.uid());

create policy "Usuário cria próprio perfil"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "Usuário edita próprio perfil"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Usuário lê próprios projetos"
  on public.research_projects for select
  using (owner_id = auth.uid());

create policy "Usuário cria próprios projetos"
  on public.research_projects for insert
  with check (owner_id = auth.uid());

create policy "Usuário edita próprios projetos"
  on public.research_projects for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Usuário exclui próprios projetos"
  on public.research_projects for delete
  using (owner_id = auth.uid());

create policy "Usuário lê própria biblioteca"
  on public.library_articles for select
  using (owner_id = auth.uid());

create policy "Usuário adiciona à própria biblioteca"
  on public.library_articles for insert
  with check (owner_id = auth.uid());

create policy "Usuário edita própria biblioteca"
  on public.library_articles for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Usuário remove da própria biblioteca"
  on public.library_articles for delete
  using (owner_id = auth.uid());

create policy "Usuário lê própria matriz"
  on public.evidence_matrix for select
  using (owner_id = auth.uid());

create policy "Usuário cria própria matriz"
  on public.evidence_matrix for insert
  with check (owner_id = auth.uid());

create policy "Usuário edita própria matriz"
  on public.evidence_matrix for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Usuário remove da própria matriz"
  on public.evidence_matrix for delete
  using (owner_id = auth.uid());

create policy "Usuário lê próprio histórico"
  on public.search_history for select
  using (owner_id = auth.uid());

create policy "Usuário cria próprio histórico"
  on public.search_history for insert
  with check (owner_id = auth.uid());

create policy "Usuário apaga próprio histórico"
  on public.search_history for delete
  using (owner_id = auth.uid());

-- ============================================================
-- FIM DO INSTALADOR SCHOLAR
-- ============================================================
