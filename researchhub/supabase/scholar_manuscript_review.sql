-- ResearchHub Scholar — revisão colaborativa do manuscrito
-- Execute após scholar_advising.sql e scholar_manuscript.sql.

begin;

create table if not exists public.scholar_manuscript_comments (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.scholar_manuscripts(id) on delete cascade,
  project_id uuid not null references public.research_projects(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  section_key text not null check(section_key in ('abstract','introduction','methods','results','discussion','limitations','conclusion','references')),
  body text not null check(length(trim(body)) between 2 and 4000),
  quoted_text text check(quoted_text is null or length(quoted_text) <= 2000),
  status text not null default 'open' check(status in ('open','resolved')),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.scholar_manuscript_comment_replies (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.scholar_manuscript_comments(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check(length(trim(body)) between 2 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists scholar_manuscript_comments_section_idx
  on public.scholar_manuscript_comments(manuscript_id, section_key, created_at desc);
create index if not exists scholar_manuscript_comments_project_idx
  on public.scholar_manuscript_comments(project_id, status, created_at desc);
create index if not exists scholar_manuscript_comment_replies_idx
  on public.scholar_manuscript_comment_replies(comment_id, created_at);

alter table public.scholar_manuscript_comments enable row level security;
alter table public.scholar_manuscript_comment_replies enable row level security;

-- O autor continua sendo o único usuário que altera o texto. O orientador ativo
-- ganha apenas leitura do manuscrito e de suas versões.
drop policy if exists "Scholar reads own manuscripts" on public.scholar_manuscripts;
drop policy if exists "Scholar reads accessible manuscripts" on public.scholar_manuscripts;
create policy "Scholar reads accessible manuscripts" on public.scholar_manuscripts for select to authenticated
using (owner_id = (select auth.uid()) or public.scholar_is_project_advisor(project_id));

drop policy if exists "Scholar reads own manuscript sections" on public.scholar_manuscript_sections;
drop policy if exists "Scholar reads accessible manuscript sections" on public.scholar_manuscript_sections;
create policy "Scholar reads accessible manuscript sections" on public.scholar_manuscript_sections for select to authenticated
using (exists (
  select 1 from public.scholar_manuscripts m
  where m.id = manuscript_id
    and (m.owner_id = (select auth.uid()) or public.scholar_is_project_advisor(m.project_id))
));

drop policy if exists "Scholar reads own manuscript versions" on public.scholar_manuscript_versions;
drop policy if exists "Scholar reads accessible manuscript versions" on public.scholar_manuscript_versions;
create policy "Scholar reads accessible manuscript versions" on public.scholar_manuscript_versions for select to authenticated
using (exists (
  select 1 from public.scholar_manuscripts m
  where m.id = manuscript_id
    and (m.owner_id = (select auth.uid()) or public.scholar_is_project_advisor(m.project_id))
));

drop policy if exists "Scholar manuscript comments read" on public.scholar_manuscript_comments;
create policy "Scholar manuscript comments read" on public.scholar_manuscript_comments for select to authenticated
using (public.scholar_can_access_advising(project_id));

drop policy if exists "Scholar manuscript comments create" on public.scholar_manuscript_comments;
create policy "Scholar manuscript comments create" on public.scholar_manuscript_comments for insert to authenticated
with check (
  author_id = (select auth.uid())
  and public.scholar_can_access_advising(project_id)
  and exists (
    select 1 from public.scholar_manuscripts m
    where m.id = manuscript_id and m.project_id = project_id
  )
);

drop policy if exists "Scholar manuscript replies read" on public.scholar_manuscript_comment_replies;
create policy "Scholar manuscript replies read" on public.scholar_manuscript_comment_replies for select to authenticated
using (exists (
  select 1 from public.scholar_manuscript_comments c
  where c.id = comment_id and public.scholar_can_access_advising(c.project_id)
));

drop policy if exists "Scholar manuscript replies create" on public.scholar_manuscript_comment_replies;
create policy "Scholar manuscript replies create" on public.scholar_manuscript_comment_replies for insert to authenticated
with check (
  author_id = (select auth.uid())
  and exists (
    select 1 from public.scholar_manuscript_comments c
    where c.id = comment_id and public.scholar_can_access_advising(c.project_id)
  )
);

create or replace function public.scholar_resolve_manuscript_comment(p_comment uuid, p_resolved boolean)
returns void language plpgsql security definer set search_path=public as $$
declare target public.scholar_manuscript_comments;
begin
  select * into target from public.scholar_manuscript_comments where id=p_comment;
  if target.id is null or not public.scholar_can_access_advising(target.project_id) then
    raise exception 'Comentário indisponível';
  end if;
  update public.scholar_manuscript_comments
  set status=case when p_resolved then 'resolved' else 'open' end,
      resolved_at=case when p_resolved then now() else null end,
      resolved_by=case when p_resolved then auth.uid() else null end
  where id=p_comment;
end $$;

revoke all on public.scholar_manuscript_comments, public.scholar_manuscript_comment_replies from anon,authenticated;
grant select,insert on public.scholar_manuscript_comments, public.scholar_manuscript_comment_replies to authenticated;
grant execute on function public.scholar_resolve_manuscript_comment(uuid,boolean) to authenticated;

commit;
