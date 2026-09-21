-- RESEARCHHUB SCHOLAR — Radar combinado PubMed + Crossref
-- Execute uma vez após scholar_productivity.sql.
begin;

alter table public.scholar_saved_searches
  drop constraint if exists scholar_saved_searches_source_check;

alter table public.scholar_saved_searches
  add constraint scholar_saved_searches_source_check
  check(source in ('pubmed','crossref','both'));

commit;
