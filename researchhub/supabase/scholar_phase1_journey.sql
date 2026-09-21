-- RESEARCHHUB SCHOLAR — Fase 1: diagnóstico e jornada personalizada
-- Executar após scholar_install.sql e scholar_productivity.sql.
-- Migration incremental: não remove nem substitui dados existentes.
begin;

alter table public.profiles
  add column if not exists research_experience text,
  add column if not exists weekly_availability text,
  add column if not exists project_deadline date,
  add column if not exists advisor_access text,
  add column if not exists data_access text,
  add column if not exists current_research_stage text,
  add column if not exists main_difficulty text,
  add column if not exists onboarding_version integer not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_research_experience_check') then
    alter table public.profiles add constraint profiles_research_experience_check
      check (research_experience is null or research_experience in ('none','one','some','experienced'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_weekly_availability_check') then
    alter table public.profiles add constraint profiles_weekly_availability_check
      check (weekly_availability is null or weekly_availability in ('under_2h','2_to_4h','5_to_8h','over_8h'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_advisor_access_check') then
    alter table public.profiles add constraint profiles_advisor_access_check
      check (advisor_access is null or advisor_access in ('none','searching','informal','defined'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_data_access_check') then
    alter table public.profiles add constraint profiles_data_access_check
      check (data_access is null or data_access in ('unknown','none','possible','available','collecting'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_current_research_stage_check') then
    alter table public.profiles add constraint profiles_current_research_stage_check
      check (current_research_stage is null or current_research_stage in ('idea','question','literature','methods','collection','analysis','writing','submission'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_main_difficulty_check') then
    alter table public.profiles add constraint profiles_main_difficulty_check
      check (main_difficulty is null or main_difficulty in ('topic','question','advisor','literature','methodology','statistics','writing','organization','submission'));
  end if;
end $$;

update public.profiles
set onboarding_version = 1
where onboarding_version is null;

comment on column public.profiles.research_experience is 'Experiência prévia autodeclarada em produção científica.';
comment on column public.profiles.project_deadline is 'Prazo principal informado pelo usuário; não representa prazo institucional oficial.';
comment on column public.profiles.onboarding_version is 'Versão do diagnóstico concluído pelo usuário.';

commit;
