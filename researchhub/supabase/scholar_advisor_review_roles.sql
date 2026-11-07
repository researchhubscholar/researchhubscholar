-- ResearchHub: convidados comentam, autores encerram pendências.
-- Aplicar após scholar_manuscript_review.sql e scholar_advisor_plan_limits.sql.
begin;

drop policy if exists "Scholar manuscript comments create" on public.scholar_manuscript_comments;
create policy "Scholar manuscript comments create" on public.scholar_manuscript_comments for insert to authenticated
with check (
  author_id = (select auth.uid())
  and public.scholar_is_project_advisor(project_id)
  and exists (
    select 1 from public.scholar_manuscripts m
    where m.id = scholar_manuscript_comments.manuscript_id
      and m.project_id = scholar_manuscript_comments.project_id
  )
);

drop policy if exists "Scholar manuscript replies create" on public.scholar_manuscript_comment_replies;
create policy "Scholar manuscript replies create" on public.scholar_manuscript_comment_replies for insert to authenticated
with check (
  author_id = (select auth.uid())
  and exists (
    select 1 from public.scholar_manuscript_comments c
    where c.id = scholar_manuscript_comment_replies.comment_id
      and c.author_id <> (select auth.uid())
      and public.scholar_can_access_advising(c.project_id)
  )
);

create or replace function public.scholar_resolve_manuscript_comment(p_comment uuid,p_resolved boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.scholar_manuscript_comments c
    set status=case when p_resolved then 'resolved' else 'open' end,
        resolved_at=case when p_resolved then now() else null end,
        resolved_by=case when p_resolved then auth.uid() else null end
  where c.id=p_comment and public.scholar_owns_project(c.project_id);
  if not found then raise exception 'Comentário indisponível'; end if;
end $$;

create or replace function public.scholar_resolve_project_comment(p_comment uuid,p_resolved boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.scholar_project_comments c
    set status=case when p_resolved then 'resolved' else 'open' end,
        resolved_at=case when p_resolved then now() else null end,
        resolved_by=case when p_resolved then auth.uid() else null end
  where c.id=p_comment and public.scholar_owns_project(c.project_id);
  if not found then raise exception 'Comentário indisponível'; end if;
end $$;

revoke all on function public.scholar_resolve_manuscript_comment(uuid,boolean),public.scholar_resolve_project_comment(uuid,boolean) from public,anon;
grant execute on function public.scholar_resolve_manuscript_comment(uuid,boolean),public.scholar_resolve_project_comment(uuid,boolean) to authenticated;
commit;
