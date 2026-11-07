-- Etapa 1: revisões e gravações atômicas. Reexecutável; não remove dados.
-- Dependências: scholar_install, scholar_access, scholar_manuscript, scholar_results.
begin;
alter table public.research_projects add column if not exists revision integer not null default 1;
alter table public.scholar_manuscripts add column if not exists revision integer not null default 1;
alter table public.scholar_project_results add column if not exists revision integer not null default 1;
create or replace function public.scholar_bump_revision() returns trigger
language plpgsql set search_path=public as $$
begin new.revision:=old.revision+1; return new; end $$;
drop trigger if exists scholar_project_revision on public.research_projects;
create trigger scholar_project_revision before update on public.research_projects for each row execute function public.scholar_bump_revision();
drop trigger if exists scholar_manuscript_revision on public.scholar_manuscripts;
create trigger scholar_manuscript_revision before update on public.scholar_manuscripts for each row execute function public.scholar_bump_revision();
drop trigger if exists scholar_results_revision on public.scholar_project_results;
create trigger scholar_results_revision before update on public.scholar_project_results for each row execute function public.scholar_bump_revision();

-- Older clients' direct section writes invalidate newly loaded manuscripts too.
create or replace function public.scholar_section_revision() returns trigger
language plpgsql set search_path=public as $$
begin
 update public.scholar_manuscripts set updated_at=now() where id=coalesce(new.manuscript_id,old.manuscript_id);
 return coalesce(new,old);
end $$;
drop trigger if exists scholar_section_revision on public.scholar_manuscript_sections;
create trigger scholar_section_revision after insert or update or delete on public.scholar_manuscript_sections for each row execute function public.scholar_section_revision();

create or replace function public.scholar_save_protocol(p_project uuid,p_expected integer,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare r public.research_projects; incoming public.research_projects; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Sessão necessária'; end if;
 if jsonb_typeof(p_data) is distinct from 'object' or length(trim(coalesce(p_data->>'title','')))<1 then raise exception 'Protocolo inválido'; end if;
 incoming:=jsonb_populate_record(null::public.research_projects,p_data);
 if p_project is null then
  if p_expected is not null then raise exception 'Revisão inválida'; end if;
  insert into public.research_projects(owner_id,title) values(uid,incoming.title) returning * into r;
 else
  select * into r from public.research_projects where id=p_project and owner_id=uid for update;
  if not found then raise exception 'Projeto indisponível'; end if;
  if p_expected is distinct from r.revision then raise exception 'SCHOLAR_SAVE_CONFLICT'; end if;
 end if;
 update public.research_projects set title=incoming.title,theme=incoming.theme,research_question=incoming.research_question,
 objective=incoming.objective,hypothesis=incoming.hypothesis,study_type=incoming.study_type,population=incoming.population,
 inclusion_criteria=incoming.inclusion_criteria,exclusion_criteria=incoming.exclusion_criteria,primary_outcome=incoming.primary_outcome,
 variables=incoming.variables,methods=incoming.methods,analysis_plan=incoming.analysis_plan,ethics_notes=incoming.ethics_notes,
 manuscript_notes=incoming.manuscript_notes,progress=coalesce(incoming.progress,0),status=coalesce(incoming.status,'draft')
 where id=r.id and owner_id=uid returning * into r;
 return jsonb_build_object('id',r.id,'revision',r.revision);
end $$;

create or replace function public.scholar_save_results(p_project uuid,p_expected integer,p_workspace jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare r public.scholar_project_results; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Sessão necessária'; end if;
 -- Serialize absent-row creation as well as updates.
 perform 1 from public.research_projects where id=p_project and owner_id=uid for update;
 if not found then raise exception 'Projeto indisponível'; end if;
 select * into r from public.scholar_project_results where project_id=p_project and owner_id=uid for update;
 if found then
  if p_expected is distinct from r.revision then raise exception 'SCHOLAR_SAVE_CONFLICT'; end if;
  update public.scholar_project_results set workspace=p_workspace,updated_at=now() where project_id=p_project and owner_id=uid returning * into r;
 else
  if p_expected is not null then raise exception 'SCHOLAR_SAVE_CONFLICT'; end if;
  insert into public.scholar_project_results(project_id,owner_id,workspace) values(p_project,uid,p_workspace) returning * into r;
 end if;
 return jsonb_build_object('revision',r.revision);
end $$;

create or replace function public.scholar_save_manuscript(p_project uuid,p_expected integer,p_data jsonb,p_sections jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare r public.scholar_manuscripts; incoming public.scholar_manuscripts; uid uuid:=auth.uid(); item jsonb;
begin
 if uid is null then raise exception 'Sessão necessária'; end if;
 if jsonb_typeof(p_data) is distinct from 'object' or jsonb_typeof(p_sections) is distinct from 'array' or jsonb_array_length(p_sections) not between 1 and 20 then raise exception 'Manuscrito inválido'; end if;
 incoming:=jsonb_populate_record(null::public.scholar_manuscripts,p_data);
 perform 1 from public.research_projects where id=p_project and owner_id=uid for update;
 if not found then raise exception 'Projeto indisponível'; end if;
 select * into r from public.scholar_manuscripts where project_id=p_project and owner_id=uid for update;
 if found then
  if p_expected is distinct from r.revision then raise exception 'SCHOLAR_SAVE_CONFLICT'; end if;
 else
  if p_expected is not null then raise exception 'SCHOLAR_SAVE_CONFLICT'; end if;
  insert into public.scholar_manuscripts(owner_id,project_id) values(uid,p_project) returning * into r;
 end if;
 update public.scholar_manuscripts set title=coalesce(incoming.title,''),subtitle=coalesce(incoming.subtitle,''),
 authors=coalesce(incoming.authors,'[]'::jsonb),affiliations=coalesce(incoming.affiliations,'[]'::jsonb),keywords=coalesce(incoming.keywords,'{}'::text[]),
 article_type=coalesce(incoming.article_type,'original'),target_journal=coalesce(incoming.target_journal,''),citation_style=coalesce(incoming.citation_style,'vancouver'),
 citation_ids=coalesce(incoming.citation_ids,'{}'::uuid[]),language='pt-BR',status=coalesce(incoming.status,'draft') where id=r.id and owner_id=uid;
 if (select count(distinct e->>'section_key') from jsonb_array_elements(p_sections) e)<>jsonb_array_length(p_sections) then raise exception 'Seções duplicadas'; end if;
 for item in select * from jsonb_array_elements(p_sections) loop
  if jsonb_typeof(item) is distinct from 'object' or length(coalesce(item->>'section_key','')) not between 1 and 80 or length(coalesce(item->>'content',''))>100000 then raise exception 'Seção inválida'; end if;
  insert into public.scholar_manuscript_sections(manuscript_id,owner_id,section_key,heading,content,position)
  values(r.id,uid,item->>'section_key',item->>'heading',coalesce(item->>'content',''),(item->>'position')::integer)
  on conflict(manuscript_id,section_key) do update set heading=excluded.heading,content=excluded.content,position=excluded.position;
 end loop;
 select * into r from public.scholar_manuscripts where id=r.id and owner_id=uid;
 return jsonb_build_object('id',r.id,'revision',r.revision);
end $$;
revoke all on function public.scholar_save_protocol(uuid,integer,jsonb),public.scholar_save_results(uuid,integer,jsonb),public.scholar_save_manuscript(uuid,integer,jsonb,jsonb) from public,anon;
grant execute on function public.scholar_save_protocol(uuid,integer,jsonb),public.scholar_save_results(uuid,integer,jsonb),public.scholar_save_manuscript(uuid,integer,jsonb,jsonb) to authenticated;
commit;
