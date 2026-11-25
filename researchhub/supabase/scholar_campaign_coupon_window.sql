begin;
-- Existing leads retain their original coupon terms. expires_at remains the contact retention deadline.
alter table public.scholar_campaign_leads add column if not exists coupon_valid_until timestamptz;
create or replace function public.scholar_stamp_campaign_coupon() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.campaign_id='pesquisa100' then
    new.coupon_valid_until:=new.created_at + interval '48 hours';
  end if;
  return new;
end $$;
drop trigger if exists stamp_campaign_coupon on public.scholar_campaign_leads;
create trigger stamp_campaign_coupon before insert on public.scholar_campaign_leads
for each row execute function public.scholar_stamp_campaign_coupon();

create or replace function public.scholar_campaign_claim(
  p_campaign text,p_visitor text,p_name text,p_email text,p_phone text,p_marketing boolean,
  p_utm_source text,p_utm_medium text,p_utm_campaign text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; deadline timestamptz;
begin
  p_email:=lower(trim(p_email));
  result:=public.scholar_campaign_register(p_campaign,p_visitor,p_name,p_email,p_phone,p_marketing,
    p_utm_source,p_utm_medium,p_utm_campaign);
  if result->>'status'='ok' then
    select coupon_valid_until into strict deadline from public.scholar_campaign_leads
      where campaign_id=p_campaign and email=p_email;
    if deadline<=now() then return jsonb_build_object('status','expired'); end if;
    result:=result || jsonb_build_object('validUntil',deadline);
  end if;
  return result;
end $$;
revoke all on function public.scholar_campaign_claim(text,text,text,text,text,boolean,text,text,text) from public,anon,authenticated;
grant execute on function public.scholar_campaign_claim(text,text,text,text,text,boolean,text,text,text) to service_role;

create or replace function public.scholar_can_use_campaign_coupon() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from auth.users u join public.scholar_campaign_leads l
    on l.email=lower(trim(u.email)) and l.campaign_id='pesquisa100'
    where u.id=auth.uid() and u.email_confirmed_at is not null
    and (l.coupon_valid_until is null or now()<l.coupon_valid_until));
$$;
revoke all on function public.scholar_can_use_campaign_coupon() from public,anon;
grant execute on function public.scholar_can_use_campaign_coupon() to authenticated;
commit;
