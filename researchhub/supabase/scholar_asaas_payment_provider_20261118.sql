-- ResearchHub / Asaas payment provenance.
-- REVIEW IN ISOLATED DB BEFORE RUNNING: Preview and Production share Supabase.
-- The existing scholar_fulfill_paid_request procedure inserts payment events without
-- specifying 'provider', and the legacy default is 'stripe'.
-- Because ResearchHub is now using Asaas checkout, update the DEFAULT for FUTURE rows.
-- No historical records, wallet balances, licenses, or purchase statuses are changed.
begin;
alter table public.scholar_payment_events
  alter column provider set default 'asaas';
commit;

select column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'scholar_payment_events'
  and column_name = 'provider';
