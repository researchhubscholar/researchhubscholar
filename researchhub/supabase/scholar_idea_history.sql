-- Executar uma vez no SQL Editor do Supabase exclusivo do Scholar.
-- Não altera os projetos nem as tabelas de biblioteca existentes.
begin;
create table if not exists public.idea_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  series_id uuid not null,
  context jsonb not null check (jsonb_typeof(context) = 'object'),
  proposal jsonb not null check (jsonb_typeof(proposal) = 'object'),
  evidence_signature text not null default '',
  reason text not null default '' check (length(reason) <= 1000),
  created_at timestamptz not null default now(),
  check (octet_length(context::text) <= 20000),
  check (octet_length(proposal::text) <= 150000),
  check (octet_length(evidence_signature) <= 250000)
);
create index if not exists idea_versions_owner_created on public.idea_versions(owner_id, created_at desc, id desc);
alter table public.idea_versions enable row level security;
drop policy if exists "Read own idea versions" on public.idea_versions;
create policy "Read own idea versions" on public.idea_versions for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "Create own idea versions" on public.idea_versions;
create policy "Create own idea versions" on public.idea_versions for insert to authenticated with check (owner_id = (select auth.uid()));
-- Histórico imutável: cada ajuste cria outra linha, sem sobrescrever versões anteriores.
revoke update, delete on public.idea_versions from authenticated;
grant select, insert on public.idea_versions to authenticated;
revoke all on public.idea_versions from anon;
commit;
