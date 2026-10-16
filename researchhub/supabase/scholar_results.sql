-- Resultados privados por projeto. Reexecutável; não remove dados.
begin;
create table if not exists public.scholar_project_results (
 project_id uuid primary key references public.research_projects(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 workspace jsonb not null check(jsonb_typeof(workspace)='object' and octet_length(workspace::text)<=2000000),
 updated_at timestamptz not null default now()
);
alter table public.scholar_project_results enable row level security;
drop policy if exists "Scholar own results" on public.scholar_project_results;
create policy "Scholar own results" on public.scholar_project_results for all to authenticated
 using(owner_id=auth.uid() and public.scholar_owns_project(project_id))
 with check(owner_id=auth.uid() and public.scholar_owns_project(project_id));
grant select,insert,update,delete on public.scholar_project_results to authenticated;
commit;
