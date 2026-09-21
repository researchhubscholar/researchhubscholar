-- RESEARCHHUB SCHOLAR — produtividade científica e preparação para IA
-- Executar uma única vez após scholar_install.sql e scholar_access.sql.
begin;

create table public.scholar_saved_searches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.research_projects(id) on delete set null,
  name text not null check(length(trim(name)) between 2 and 120),
  query text not null check(length(trim(query)) between 3 and 500),
  period text not null default '5' check(period in ('all','3','5','10')),
  study_type text not null default 'all' check(study_type in ('all','systematic','trial','observational','review','case')),
  source text not null default 'pubmed' check(source in ('pubmed','crossref','both')),
  sort text not null default 'recent' check(sort in ('recent','relevance')),
  alerts_enabled boolean not null default false,
  last_run_at timestamptz,
  last_result_count integer check(last_result_count is null or last_result_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id,name)
);
create index scholar_saved_searches_owner_idx on public.scholar_saved_searches(owner_id,updated_at desc);

create table public.scholar_project_milestones (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.research_projects(id) on delete cascade,
  milestone_key text not null check(milestone_key in ('theme','question','literature','design','ethics','collection','analysis','writing','submission')),
  status text not null default 'pending' check(status in ('pending','current','done','blocked')),
  note text check(note is null or length(note) <= 2000),
  due_date date,
  position integer not null check(position between 1 and 20),
  updated_at timestamptz not null default now(),
  unique(owner_id,project_id,milestone_key)
);
create index scholar_project_milestones_project_idx on public.scholar_project_milestones(owner_id,project_id,position);

alter table public.library_articles
  add column reading_status text not null default 'unread' check(reading_status in ('unread','reading','reviewed','excluded')),
  add column favorite boolean not null default false,
  add column tags text[] not null default '{}',
  add column exclusion_reason text,
  add column full_text_url text;

alter table public.evidence_matrix
  add column sample_size text,
  add column intervention text,
  add column comparator text,
  add column outcomes text,
  add column evidence_level text,
  add column risk_of_bias text;

create table public.scholar_generation_reviews (
  usage_id uuid primary key references public.scholar_usage(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating text not null check(rating in ('useful','partial','not_useful')),
  feedback text check(feedback is null or length(feedback) <= 2000),
  output_edited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Proveniência de cada geração futura. Só o backend gravará os snapshots.
create table public.scholar_generation_artifacts (
  usage_id uuid primary key references public.scholar_usage(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt_version text not null,
  input_snapshot jsonb not null default '{}'::jsonb,
  output_snapshot jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.scholar_saved_searches enable row level security;
alter table public.scholar_project_milestones enable row level security;
alter table public.scholar_generation_reviews enable row level security;
alter table public.scholar_generation_artifacts enable row level security;

create policy "Scholar owns saved searches" on public.scholar_saved_searches for all to authenticated
  using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy "Scholar owns milestones" on public.scholar_project_milestones for all to authenticated
  using(owner_id=auth.uid() and public.scholar_owns_project(project_id))
  with check(owner_id=auth.uid() and public.scholar_owns_project(project_id));
create policy "Scholar owns generation reviews" on public.scholar_generation_reviews for all to authenticated
  using(user_id=auth.uid() and exists(select 1 from public.scholar_usage u where u.id=usage_id and u.user_id=auth.uid()))
  with check(user_id=auth.uid() and exists(select 1 from public.scholar_usage u where u.id=usage_id and u.user_id=auth.uid()));
create policy "Scholar owns generation artifacts" on public.scholar_generation_artifacts for select to authenticated
  using(user_id=auth.uid() and exists(select 1 from public.scholar_usage u where u.id=usage_id and u.user_id=auth.uid()));

create trigger scholar_saved_searches_updated before update on public.scholar_saved_searches
  for each row execute procedure public.set_updated_at();
create trigger scholar_project_milestones_updated before update on public.scholar_project_milestones
  for each row execute procedure public.set_updated_at();
create trigger scholar_generation_reviews_updated before update on public.scholar_generation_reviews
  for each row execute procedure public.set_updated_at();
create trigger scholar_generation_artifacts_updated before update on public.scholar_generation_artifacts
  for each row execute procedure public.set_updated_at();

grant select,insert,update,delete on public.scholar_saved_searches to authenticated;
grant select,insert,update,delete on public.scholar_project_milestones to authenticated;
grant select,insert,update,delete on public.scholar_generation_reviews to authenticated;
grant select on public.scholar_generation_artifacts to authenticated;
commit;
