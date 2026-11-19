-- Provider health telemetry: aggregate operational data only (no user IDs, search terms, checkout IDs or payloads).
begin;
create table if not exists public.scholar_provider_health_events (
  id bigint generated always as identity primary key,
  service text not null check(service in ('decs','asaas')),
  outcome text not null check(outcome in ('success','http_error','network_error','timeout','parse_error','unmatched','invalid_payload','unlinked_checkout','amount_mismatch','duplicate','ineligible','processing_failed','ignored')),
  status_code integer check(status_code between 100 and 599),
  duration_ms integer check(duration_ms between 0 and 300000),
  created_at timestamptz not null default now()
);
create index if not exists scholar_provider_health_recent_idx on public.scholar_provider_health_events(service,created_at desc);
alter table public.scholar_provider_health_events enable row level security;
revoke all on public.scholar_provider_health_events from public,anon,authenticated;
grant select,insert on public.scholar_provider_health_events to service_role;
commit;
