begin;

alter table public.research_projects
  add column if not exists review_mode text
    check (review_mode in ('narrative', 'systematic', 'scoping'));

do $migration$
declare
  definition text;
  previous_assignment constant text := 'study_type=incoming.study_type,population=incoming.population,';
  next_assignment constant text := 'study_type=incoming.study_type,review_mode=case when p_data ? ''review_mode'' then incoming.review_mode else r.review_mode end,population=incoming.population,';
begin
  definition := pg_get_functiondef(to_regprocedure('public.scholar_save_protocol(uuid,integer,jsonb)'));
  if position(next_assignment in definition) > 0 then
    return;
  end if;
  if definition is null or position(previous_assignment in definition) = 0 then
    raise exception 'A função scholar_save_protocol precisa ser revisada antes desta migração.';
  end if;
  execute replace(definition, previous_assignment, next_assignment);
end
$migration$;

notify pgrst, 'reload schema';
commit;
