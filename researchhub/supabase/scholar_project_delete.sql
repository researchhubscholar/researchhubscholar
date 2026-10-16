-- Exclusão transacional: preserva artigos e matriz pessoal.
begin;
create or replace function public.scholar_delete_project(p_project_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sessão necessária'; end if;
  perform 1 from public.research_projects
    where id = p_project_id and owner_id = auth.uid() for update;
  if not found then raise exception 'Projeto não encontrado ou sem permissão'; end if;
  update public.library_articles set project_id = null
    where project_id = p_project_id and owner_id = auth.uid();
  update public.evidence_matrix set project_id = null
    where project_id = p_project_id and owner_id = auth.uid();
  delete from public.research_projects where id = p_project_id and owner_id = auth.uid();
end;
$$;
revoke all on function public.scholar_delete_project(uuid) from public, anon;
grant execute on function public.scholar_delete_project(uuid) to authenticated;
commit;
