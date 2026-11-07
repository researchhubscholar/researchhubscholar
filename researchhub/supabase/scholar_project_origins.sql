-- RESEARCHHUB SCHOLAR — origem rastreável dos projetos
-- Executar uma vez após scholar_install.sql, scholar_access.sql e scholar_productivity.sql.
begin;

create table if not exists public.scholar_project_origins (
  project_id uuid primary key references public.research_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check(source_type in ('idea')),
  source_key text not null check(length(source_key) between 8 and 200),
  idea_version_id uuid references public.idea_versions(id) on delete set null,
  idea_series_id uuid,
  generation_id uuid references public.scholar_usage(id) on delete set null,
  language text check(language is null or language in ('pt-BR','en')),
  snapshot jsonb not null default '{}'::jsonb check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=200000),
  created_at timestamptz not null default now(),
  unique(owner_id, source_key)
);

create index if not exists scholar_project_origins_owner_idx
  on public.scholar_project_origins(owner_id, created_at desc);

alter table public.scholar_project_origins enable row level security;

drop policy if exists "Scholar owns project origins" on public.scholar_project_origins;
create policy "Scholar owns project origins" on public.scholar_project_origins for all to authenticated
  using(owner_id=(select auth.uid()) and public.scholar_owns_project(project_id))
  with check(
    owner_id=(select auth.uid())
    and public.scholar_owns_project(project_id)
    and (idea_version_id is null or exists(select 1 from public.idea_versions v where v.id=idea_version_id and v.owner_id=(select auth.uid())))
    and (generation_id is null or exists(select 1 from public.scholar_usage u where u.id=generation_id and u.user_id=(select auth.uid())))
  );

revoke all on public.scholar_project_origins from anon;
grant select,insert,update,delete on public.scholar_project_origins to authenticated;
commit;
