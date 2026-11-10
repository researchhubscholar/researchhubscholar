begin;
create table if not exists public.scholar_ai_evaluations (
 usage_id uuid not null references public.scholar_usage(id) on delete cascade,
 evaluator_id uuid not null references auth.users(id) on delete cascade,
 specificity integer not null check(specificity between 1 and 5), methods integer not null check(methods between 1 and 5),
 feasibility integer not null check(feasibility between 1 and 5), sources integer not null check(sources between 1 and 5), usefulness integer not null check(usefulness between 1 and 5),
 notes text not null default '' check(length(notes)<=2000), rubric_version text not null default 'scientific.v1',
 updated_at timestamptz not null default now(),primary key(usage_id,evaluator_id)
);
alter table public.scholar_ai_evaluations enable row level security;
drop policy if exists "Scholar evaluates own generation" on public.scholar_ai_evaluations;
create policy "Scholar evaluates own generation" on public.scholar_ai_evaluations for all to authenticated
 using(evaluator_id=auth.uid() and exists(select 1 from public.scholar_usage u where u.id=usage_id and u.user_id=auth.uid()))
 with check(evaluator_id=auth.uid() and exists(select 1 from public.scholar_usage u where u.id=usage_id and u.user_id=auth.uid() and u.status='completed'));
grant select,insert,update on public.scholar_ai_evaluations to authenticated;
grant select on public.scholar_ai_evaluations to service_role;
commit;
