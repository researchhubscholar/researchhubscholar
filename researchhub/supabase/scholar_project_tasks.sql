-- Executar no SQL Editor após scholar_productivity.sql. Reexecutável.
begin;
create table if not exists public.scholar_project_tasks (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 project_id uuid not null references public.research_projects(id) on delete cascade,
 title text not null check(length(trim(title)) between 2 and 160),
 detail text not null default '' check(length(detail)<=2000),
 status text not null default 'open' check(status in ('open','done')),
 due_date date,
 source_usage_id uuid references public.scholar_usage(id) on delete set null,
 source_index integer check(source_index between 0 and 9),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(source_usage_id is null or source_index is not null)
);
create unique index if not exists scholar_project_tasks_source on public.scholar_project_tasks(project_id,source_usage_id,source_index) where source_usage_id is not null;
create index if not exists scholar_project_tasks_list on public.scholar_project_tasks(owner_id,project_id,created_at);
alter table public.scholar_project_tasks enable row level security;
drop policy if exists "Own project tasks" on public.scholar_project_tasks;
create policy "Own project tasks" on public.scholar_project_tasks for all to authenticated
 using(owner_id=auth.uid() and public.scholar_owns_project(project_id))
 with check(owner_id=auth.uid() and public.scholar_owns_project(project_id) and (source_usage_id is null or exists(
 select 1 from public.scholar_usage u join public.scholar_generation_artifacts a on a.usage_id=u.id
 where u.id=source_usage_id and u.user_id=auth.uid() and u.project_id=scholar_project_tasks.project_id and u.status='completed'
 and a.user_id=auth.uid() and a.input_snapshot->>'feature'='guide')));
create or replace function public.scholar_limit_project_tasks() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='UPDATE' then
  if new.project_id is distinct from old.project_id or new.owner_id is distinct from old.owner_id or (new.source_usage_id is not null and new.source_usage_id is distinct from old.source_usage_id) or new.source_index is distinct from old.source_index then
   raise exception 'Projeto e origem da tarefa não podem ser alterados.';
  end if;
  return new;
 end if;
 perform 1 from public.research_projects where id=new.project_id for update;
 if (select count(*) from public.scholar_project_tasks where project_id=new.project_id and id<>new.id)>=100 then
 raise exception 'Limite de 100 tarefas por projeto. Remova tarefas antigas antes de adicionar.';
 end if;
 return new;
end;$$;
drop trigger if exists scholar_project_tasks_limit on public.scholar_project_tasks;
create trigger scholar_project_tasks_limit before insert or update on public.scholar_project_tasks for each row execute function public.scholar_limit_project_tasks();
drop trigger if exists scholar_project_tasks_updated on public.scholar_project_tasks;
create trigger scholar_project_tasks_updated before update on public.scholar_project_tasks for each row execute function public.set_updated_at();
grant select,insert,update,delete on public.scholar_project_tasks to authenticated;
commit;
