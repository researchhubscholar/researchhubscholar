-- ResearchHub Scholar — editor de manuscrito científico
-- Execute uma vez no SQL Editor do Supabase Scholar.

create table if not exists public.scholar_manuscripts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.research_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  subtitle text not null default '',
  authors jsonb not null default '[]'::jsonb,
  affiliations jsonb not null default '[]'::jsonb,
  keywords text[] not null default '{}'::text[],
  article_type text not null default 'original',
  target_journal text not null default '',
  citation_style text not null default 'vancouver' check (citation_style in ('vancouver','abnt')),
  citation_ids uuid[] not null default '{}'::uuid[],
  language text not null default 'pt-BR',
  status text not null default 'draft' check (status in ('draft','review','ready','submitted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Atualização segura para bancos que já executaram a primeira versão deste arquivo.
alter table public.scholar_manuscripts add column if not exists authors jsonb not null default '[]'::jsonb;
alter table public.scholar_manuscripts add column if not exists affiliations jsonb not null default '[]'::jsonb;
alter table public.scholar_manuscripts add column if not exists keywords text[] not null default '{}'::text[];
alter table public.scholar_manuscripts add column if not exists citation_style text not null default 'vancouver';
alter table public.scholar_manuscripts add column if not exists citation_ids uuid[] not null default '{}'::uuid[];

do $$ begin
  alter table public.scholar_manuscripts add constraint scholar_manuscripts_citation_style_check check (citation_style in ('vancouver','abnt'));
exception when duplicate_object then null;
end $$;

create table if not exists public.scholar_manuscript_sections (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.scholar_manuscripts(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  section_key text not null,
  heading text not null,
  content text not null default '',
  position integer not null default 0,
  updated_at timestamptz not null default now(),
  unique(manuscript_id, section_key)
);

create table if not exists public.scholar_manuscript_versions (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.scholar_manuscripts(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists scholar_manuscripts_owner_idx on public.scholar_manuscripts(owner_id, updated_at desc);
create index if not exists scholar_manuscript_sections_idx on public.scholar_manuscript_sections(manuscript_id, position);
create index if not exists scholar_manuscript_versions_idx on public.scholar_manuscript_versions(manuscript_id, created_at desc);

create or replace function public.scholar_touch_manuscript_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists scholar_manuscripts_touch on public.scholar_manuscripts;
create trigger scholar_manuscripts_touch before update on public.scholar_manuscripts
for each row execute function public.scholar_touch_manuscript_updated_at();

drop trigger if exists scholar_manuscript_sections_touch on public.scholar_manuscript_sections;
create trigger scholar_manuscript_sections_touch before update on public.scholar_manuscript_sections
for each row execute function public.scholar_touch_manuscript_updated_at();

alter table public.scholar_manuscripts enable row level security;
alter table public.scholar_manuscript_sections enable row level security;
alter table public.scholar_manuscript_versions enable row level security;

drop policy if exists "Scholar reads own manuscripts" on public.scholar_manuscripts;
create policy "Scholar reads own manuscripts" on public.scholar_manuscripts for select to authenticated
using (owner_id = (select auth.uid()));
drop policy if exists "Scholar creates own manuscripts" on public.scholar_manuscripts;
create policy "Scholar creates own manuscripts" on public.scholar_manuscripts for insert to authenticated
with check (owner_id = (select auth.uid()) and exists (
  select 1 from public.research_projects p where p.id = project_id and p.owner_id = (select auth.uid())
));
drop policy if exists "Scholar updates own manuscripts" on public.scholar_manuscripts;
create policy "Scholar updates own manuscripts" on public.scholar_manuscripts for update to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "Scholar deletes own manuscripts" on public.scholar_manuscripts;
create policy "Scholar deletes own manuscripts" on public.scholar_manuscripts for delete to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists "Scholar reads own manuscript sections" on public.scholar_manuscript_sections;
create policy "Scholar reads own manuscript sections" on public.scholar_manuscript_sections for select to authenticated
using (owner_id = (select auth.uid()));
drop policy if exists "Scholar creates own manuscript sections" on public.scholar_manuscript_sections;
create policy "Scholar creates own manuscript sections" on public.scholar_manuscript_sections for insert to authenticated
with check (owner_id = (select auth.uid()) and exists (
  select 1 from public.scholar_manuscripts m where m.id = manuscript_id and m.owner_id = (select auth.uid())
));
drop policy if exists "Scholar updates own manuscript sections" on public.scholar_manuscript_sections;
create policy "Scholar updates own manuscript sections" on public.scholar_manuscript_sections for update to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists "Scholar reads own manuscript versions" on public.scholar_manuscript_versions;
create policy "Scholar reads own manuscript versions" on public.scholar_manuscript_versions for select to authenticated
using (owner_id = (select auth.uid()));
drop policy if exists "Scholar creates own manuscript versions" on public.scholar_manuscript_versions;
create policy "Scholar creates own manuscript versions" on public.scholar_manuscript_versions for insert to authenticated
with check (owner_id = (select auth.uid()) and exists (
  select 1 from public.scholar_manuscripts m where m.id = manuscript_id and m.owner_id = (select auth.uid())
));

revoke all on public.scholar_manuscripts, public.scholar_manuscript_sections, public.scholar_manuscript_versions from anon;
grant select, insert, update, delete on public.scholar_manuscripts to authenticated;
grant select, insert, update on public.scholar_manuscript_sections to authenticated;
grant select, insert on public.scholar_manuscript_versions to authenticated;

