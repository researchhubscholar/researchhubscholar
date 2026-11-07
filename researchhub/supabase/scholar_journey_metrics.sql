-- Indicadores limitados de tentativas no Radar. Reexecutável; não remove dados.
begin;
create table if not exists public.scholar_journey_attempts (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 flow text not null check (flow in ('radar_search')),
 status text not null check (status in ('started','completed','failed','review')),
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 check ((status='started' and finished_at is null) or (status<>'started' and finished_at is not null))
);
create index if not exists scholar_journey_attempts_summary_idx on public.scholar_journey_attempts(flow,started_at desc);
create index if not exists scholar_journey_attempts_owner_idx on public.scholar_journey_attempts(owner_id,started_at desc);
alter table public.scholar_journey_attempts enable row level security;
drop policy if exists "Scholar exports own journey attempts" on public.scholar_journey_attempts;
create policy "Scholar exports own journey attempts" on public.scholar_journey_attempts for select to authenticated using(owner_id=auth.uid());
revoke all on public.scholar_journey_attempts from anon,authenticated;
grant select on public.scholar_journey_attempts to authenticated;
create or replace function public.scholar_record_journey_attempt(p_id uuid,p_flow text,p_status text)
returns boolean language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); affected integer;
begin
 if uid is null or p_id is null or p_flow is distinct from 'radar_search' or p_status not in ('started','completed','failed','review') then raise exception 'Evento inválido'; end if;
 if p_status='started' then
  if (select count(*) from public.scholar_journey_attempts where owner_id=uid and started_at>now()-interval '1 minute')>=60 then return false; end if;
  insert into public.scholar_journey_attempts(id,owner_id,flow,status) values(p_id,uid,p_flow,'started') on conflict(id) do nothing;
 else
  update public.scholar_journey_attempts set status=p_status,finished_at=now() where id=p_id and owner_id=uid and flow=p_flow and status='started' and started_at>now()-interval '1 day';
 end if;
 get diagnostics affected=row_count; return affected=1;
end $$;
create or replace function public.scholar_journey_summary()
returns table(flow text,started bigint,completed bigint,failed bigint,review bigint,pending bigint,unresolved bigint)
language plpgsql security definer set search_path=public as $$
begin
 perform public.scholar_require_platform_admin();
 return query select a.flow,count(*),count(*) filter(where a.status='completed'),count(*) filter(where a.status='failed'),count(*) filter(where a.status='review'),count(*) filter(where a.status='started' and a.started_at>now()-interval '30 minutes'),count(*) filter(where a.status='started' and a.started_at<=now()-interval '30 minutes') from public.scholar_journey_attempts a where a.started_at>=now()-interval '7 days' group by a.flow;
end $$;
revoke all on function public.scholar_record_journey_attempt(uuid,text,text),public.scholar_journey_summary() from public,anon;
grant execute on function public.scholar_record_journey_attempt(uuid,text,text),public.scholar_journey_summary() to authenticated;
commit;
