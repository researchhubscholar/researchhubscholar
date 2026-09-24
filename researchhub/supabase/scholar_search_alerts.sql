-- RESEARCHHUB SCHOLAR — alertas de novas publicações
-- Executar uma única vez após scholar_productivity.sql.
begin;

alter table public.scholar_saved_searches
  add column alert_checked_at timestamptz,
  add column alert_seen_keys text[] not null default '{}',
  add column alert_last_error text;

create table public.scholar_search_alerts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  saved_search_id uuid not null references public.scholar_saved_searches(id) on delete cascade,
  article_key text not null check(length(article_key) between 2 and 300),
  title text not null check(length(trim(title)) between 1 and 1000),
  journal text,
  published_year integer check(published_year is null or published_year between 1800 and 2200),
  source text not null check(source in ('PubMed','Crossref')),
  article_url text,
  article_snapshot jsonb not null check(jsonb_typeof(article_snapshot)='object'),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(owner_id,saved_search_id,article_key)
);

create index scholar_search_alerts_owner_idx
  on public.scholar_search_alerts(owner_id,read_at,created_at desc);
create index scholar_search_alerts_search_idx
  on public.scholar_search_alerts(saved_search_id,created_at desc);

alter table public.scholar_search_alerts enable row level security;

create policy "Scholar owns search alerts"
  on public.scholar_search_alerts for all to authenticated
  using(
    owner_id=auth.uid()
    and exists(
      select 1 from public.scholar_saved_searches s
      where s.id=saved_search_id and s.owner_id=auth.uid()
    )
  )
  with check(
    owner_id=auth.uid()
    and exists(
      select 1 from public.scholar_saved_searches s
      where s.id=saved_search_id and s.owner_id=auth.uid()
    )
  );

grant select,insert,update,delete on public.scholar_search_alerts to authenticated;
commit;
