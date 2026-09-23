-- RESEARCHHUB SCHOLAR — união segura de duplicados da Biblioteca
-- Execute uma vez depois de scholar_productivity.sql.
begin;

create or replace function public.scholar_merge_library_duplicates(p_keep uuid, p_remove uuid[])
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_keep public.library_articles%rowtype;
  v_duplicate public.library_articles%rowtype;
  v_remove uuid;
  v_keep_doi text;
  v_keep_pmid text;
begin
  if v_user is null then raise exception 'Autenticação necessária.'; end if;
  if p_keep is null or coalesce(array_length(p_remove, 1), 0) = 0 then raise exception 'Seleção inválida.'; end if;
  if p_keep = any(p_remove) then raise exception 'O registro principal não pode ser removido.'; end if;

  select * into v_keep from public.library_articles
  where id = p_keep and owner_id = v_user for update;
  if not found then raise exception 'Registro principal não encontrado.'; end if;
  v_keep_doi := v_keep.doi;
  v_keep_pmid := v_keep.pmid;

  foreach v_remove in array p_remove loop
    select * into v_duplicate from public.library_articles
    where id = v_remove and owner_id = v_user for update;
    if not found then raise exception 'Registro duplicado não encontrado.'; end if;

    if not (
      (nullif(trim(v_keep.pmid), '') is not null and trim(v_keep.pmid) = trim(v_duplicate.pmid))
      or (nullif(trim(v_keep.doi), '') is not null and lower(regexp_replace(v_keep.doi, '^(https?://(dx\.)?doi\.org/|doi:\s*)', '', 'i')) = lower(regexp_replace(v_duplicate.doi, '^(https?://(dx\.)?doi\.org/|doi:\s*)', '', 'i')))
      or (v_keep.publication_year is not null and v_keep.publication_year = v_duplicate.publication_year and regexp_replace(lower(v_keep.title), '[^[:alnum:]]+', '', 'g') = regexp_replace(lower(v_duplicate.title), '[^[:alnum:]]+', '', 'g'))
    ) then raise exception 'Os registros não parecem representar o mesmo artigo.'; end if;

    insert into public.library_article_projects(owner_id, article_id, project_id)
    select v_user, p_keep, project_id from public.library_article_projects
    where owner_id = v_user and article_id = v_remove
    on conflict do nothing;
    if v_duplicate.project_id is not null then
      insert into public.library_article_projects(owner_id, article_id, project_id)
      values(v_user, p_keep, v_duplicate.project_id) on conflict do nothing;
    end if;

    insert into public.evidence_matrix(
      owner_id, project_id, article_id, objective, population, method, main_finding, limitation, notes,
      confirmed_objective, confirmed_population, confirmed_method, confirmed_main_finding, confirmed_limitation,
      sample_size, intervention, comparator, outcomes, evidence_level, risk_of_bias
    )
    select owner_id, coalesce(v_keep.project_id, project_id), p_keep, objective, population, method, main_finding, limitation, notes,
      confirmed_objective, confirmed_population, confirmed_method, confirmed_main_finding, confirmed_limitation,
      sample_size, intervention, comparator, outcomes, evidence_level, risk_of_bias
    from public.evidence_matrix where owner_id = v_user and article_id = v_remove
    on conflict(owner_id, article_id) do update set
      objective = coalesce(nullif(public.evidence_matrix.objective, ''), excluded.objective),
      population = coalesce(nullif(public.evidence_matrix.population, ''), excluded.population),
      method = coalesce(nullif(public.evidence_matrix.method, ''), excluded.method),
      main_finding = coalesce(nullif(public.evidence_matrix.main_finding, ''), excluded.main_finding),
      limitation = coalesce(nullif(public.evidence_matrix.limitation, ''), excluded.limitation),
      notes = case when nullif(public.evidence_matrix.notes, '') is null then excluded.notes when nullif(excluded.notes, '') is null or public.evidence_matrix.notes = excluded.notes then public.evidence_matrix.notes else public.evidence_matrix.notes || E'\n\n— Nota de registro unido —\n' || excluded.notes end,
      sample_size = coalesce(nullif(public.evidence_matrix.sample_size, ''), excluded.sample_size),
      intervention = coalesce(nullif(public.evidence_matrix.intervention, ''), excluded.intervention),
      comparator = coalesce(nullif(public.evidence_matrix.comparator, ''), excluded.comparator),
      outcomes = coalesce(nullif(public.evidence_matrix.outcomes, ''), excluded.outcomes),
      evidence_level = coalesce(nullif(public.evidence_matrix.evidence_level, ''), excluded.evidence_level),
      risk_of_bias = coalesce(nullif(public.evidence_matrix.risk_of_bias, ''), excluded.risk_of_bias),
      confirmed_objective = public.evidence_matrix.confirmed_objective or excluded.confirmed_objective,
      confirmed_population = public.evidence_matrix.confirmed_population or excluded.confirmed_population,
      confirmed_method = public.evidence_matrix.confirmed_method or excluded.confirmed_method,
      confirmed_main_finding = public.evidence_matrix.confirmed_main_finding or excluded.confirmed_main_finding,
      confirmed_limitation = public.evidence_matrix.confirmed_limitation or excluded.confirmed_limitation;

    update public.library_articles set
      project_id = coalesce(project_id, v_duplicate.project_id),
      authors = case when jsonb_array_length(authors) = 0 then v_duplicate.authors else authors end,
      journal = coalesce(nullif(journal, ''), v_duplicate.journal),
      publication_year = coalesce(publication_year, v_duplicate.publication_year),
      publication_types = case when jsonb_array_length(publication_types) = 0 then v_duplicate.publication_types else publication_types end,
      abstract = coalesce(nullif(abstract, ''), v_duplicate.abstract),
      source_url = coalesce(nullif(source_url, ''), v_duplicate.source_url),
      reading_status = case when reading_status = 'unread' then v_duplicate.reading_status else reading_status end,
      favorite = favorite or v_duplicate.favorite,
      tags = array(select distinct unnest(tags || v_duplicate.tags)),
      folder = coalesce(nullif(folder, ''), v_duplicate.folder),
      study_design = case when study_design = 'auto' then v_duplicate.study_design else study_design end,
      exclusion_reason = coalesce(nullif(exclusion_reason, ''), v_duplicate.exclusion_reason),
      full_text_url = coalesce(nullif(full_text_url, ''), v_duplicate.full_text_url)
    where id = p_keep and owner_id = v_user;

    v_keep_doi := coalesce(nullif(v_keep_doi, ''), v_duplicate.doi);
    v_keep_pmid := coalesce(nullif(v_keep_pmid, ''), v_duplicate.pmid);
    delete from public.library_articles where id = v_remove and owner_id = v_user;
    select * into v_keep from public.library_articles where id = p_keep and owner_id = v_user;
  end loop;

  update public.library_articles set doi = v_keep_doi, pmid = v_keep_pmid
  where id = p_keep and owner_id = v_user;
  return p_keep;
end;
$$;

revoke all on function public.scholar_merge_library_duplicates(uuid, uuid[]) from public, anon;
grant execute on function public.scholar_merge_library_duplicates(uuid, uuid[]) to authenticated;
commit;
