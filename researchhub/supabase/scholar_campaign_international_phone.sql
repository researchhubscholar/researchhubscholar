begin;

alter table public.scholar_campaign_leads
  drop constraint if exists scholar_campaign_leads_phone_check,
  add constraint scholar_campaign_leads_phone_check
    check (phone ~ '^[+][1-9][0-9]{6,14}$');

commit;
