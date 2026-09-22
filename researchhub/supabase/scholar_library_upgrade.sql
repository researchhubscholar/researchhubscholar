-- RESEARCHHUB SCHOLAR — organização avançada da Biblioteca
-- Execute uma vez após scholar_productivity.sql.
begin;

alter table public.library_articles
  add column if not exists folder text,
  add column if not exists study_design text not null default 'auto';

alter table public.library_articles
  drop constraint if exists library_articles_study_design_check;

alter table public.library_articles
  add constraint library_articles_study_design_check check(study_design in (
    'auto','systematic-review','clinical-trial','cohort','case-control',
    'cross-sectional','qualitative','case-report','other'
  ));

create table if not exists public.library_article_projects (
  owner_id uuid not null references auth.users(id) on delete cascade,
  article_id uuid not null references public.library_articles(id) on delete cascade,
  project_id uuid not null references public.research_projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(owner_id,article_id,project_id)
);

insert into public.library_article_projects(owner_id,article_id,project_id)
select owner_id,id,project_id from public.library_articles where project_id is not null
on conflict do nothing;

alter table public.library_article_projects enable row level security;

drop policy if exists "Scholar owns article project links" on public.library_article_projects;
create policy "Scholar owns article project links" on public.library_article_projects
  for all to authenticated
  using(owner_id=auth.uid() and exists(
    select 1 from public.library_articles a where a.id=article_id and a.owner_id=auth.uid()
  ) and exists(
    select 1 from public.research_projects p where p.id=project_id and p.owner_id=auth.uid()
  ))
  with check(owner_id=auth.uid() and exists(
    select 1 from public.library_articles a where a.id=article_id and a.owner_id=auth.uid()
  ) and exists(
    select 1 from public.research_projects p where p.id=project_id and p.owner_id=auth.uid()
  ));

grant select,insert,delete on public.library_article_projects to authenticated;
commit;
