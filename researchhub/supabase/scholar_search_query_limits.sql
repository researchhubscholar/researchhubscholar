-- Estratégias PubMed completas, inclusive as produzidas por IA.
-- Reexecutável; não remove estratégias ou histórico existentes.
begin;
alter table public.scholar_saved_searches drop constraint if exists scholar_saved_searches_query_check;
alter table public.scholar_saved_searches add constraint scholar_saved_searches_query_check check(length(trim(query)) between 3 and 10000);
commit;
