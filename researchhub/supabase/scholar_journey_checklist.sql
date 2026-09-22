-- RESEARCHHUB SCHOLAR — checklists interativos da jornada
-- Execute uma vez após scholar_productivity.sql.
begin;

alter table public.scholar_project_milestones
  add column if not exists checklist_state jsonb not null default '{}'::jsonb;

alter table public.scholar_project_milestones
  drop constraint if exists scholar_project_milestones_checklist_state_check;

alter table public.scholar_project_milestones
  add constraint scholar_project_milestones_checklist_state_check
  check(jsonb_typeof(checklist_state) = 'object');

commit;
