begin;

-- Install in an isolated preview database first. New campaigns and coupons start disabled.
create table if not exists public.scholar_campaigns (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  title text not null,
  subtitle text not null,
  source text not null,
  privacy_notice_version text not null default 'campaign-v1',
  coupon_code text not null unique references public.scholar_coupon_codes(code),
  public_path text generated always as ('/convite/' || id) stored,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default false,
  check (ends_at is null or starts_at is null or starts_at < ends_at)
);

create table if not exists public.scholar_campaign_leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null references public.scholar_campaigns(id),
  full_name text not null check (length(full_name) between 3 and 120),
  email text not null check (email=lower(email) and length(email) between 6 and 254),
  phone text not null check (phone ~ '^[+]55[1-9][0-9][2-9][0-9]{7,8}$'),
  marketing_consent boolean not null,
  privacy_notice_version text not null,
  consent_recorded_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  source text not null,
  utm_source text check (length(utm_source) <= 80),
  utm_medium text check (length(utm_medium) <= 80),
  utm_campaign text check (length(utm_campaign) <= 80),
  unique (campaign_id,email),
  check (marketing_consent = (consent_recorded_at is not null))
);

create index if not exists scholar_campaign_leads_expiry_idx on public.scholar_campaign_leads(expires_at);

create table if not exists public.scholar_campaign_rate (
  campaign_id text not null references public.scholar_campaigns(id),
  bucket bigint not null,
  visitor text not null check (visitor ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind in ('lead','event')),
  hits integer not null check (hits > 0),
  primary key (campaign_id,bucket,visitor,kind)
);

create table if not exists public.scholar_campaign_counts (
  campaign_id text not null references public.scholar_campaigns(id),
  day date not null,
  event text not null check (event in ('view','signup','copy','plans')),
  total bigint not null check (total > 0),
  primary key (campaign_id,day,event)
);

alter table public.scholar_campaigns enable row level security;
alter table public.scholar_campaign_leads enable row level security;
alter table public.scholar_campaign_rate enable row level security;
alter table public.scholar_campaign_counts enable row level security;

revoke all on public.scholar_campaigns,public.scholar_campaign_leads,
  public.scholar_campaign_rate,public.scholar_campaign_counts from public,anon,authenticated,service_role;

insert into public.scholar_coupon_codes(code,audience,plan,percent_off,amount_off_cents,max_redemptions,active)
values ('PESQUISA100','individual',null,0,10000,null,false)
on conflict (code) do update set
  audience=excluded.audience,plan=excluded.plan,percent_off=excluded.percent_off,
  amount_off_cents=excluded.amount_off_cents,max_redemptions=excluded.max_redemptions;

insert into public.scholar_campaigns(id,name,title,subtitle,source,coupon_code,privacy_notice_version)
values (
  'pesquisa100','PESQUISA100',
  'Sua jornada científica começa com uma oportunidade especial.',
  'Cadastre-se e receba R$ 100 de desconto para começar a desenvolver seu trabalho científico com o ResearchHub.',
  'congresso','PESQUISA100','pesquisa100-v1'
)
on conflict (id) do nothing;

create or replace function public.scholar_campaign_offer(p_campaign text)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'title',c.title,'subtitle',c.subtitle,'discountCents',q.amount_off_cents,
    'available',c.active and (c.starts_at is null or c.starts_at<=now())
      and (c.ends_at is null or now()<c.ends_at)
      and q.amount_off_cents>0 and q.percent_off=0
      and q.active and q.valid_from<=now() and (q.valid_until is null or now()<q.valid_until)
      and (q.max_redemptions is null or q.redemptions<q.max_redemptions),
    'code',q.code
  )
  from public.scholar_campaigns c
  join public.scholar_coupon_codes q on q.code=c.coupon_code
  where c.id=p_campaign;
$$;

create or replace function public.scholar_campaign_charge(p_campaign text,p_visitor text,p_kind text)
returns boolean language sql set search_path='' as $$
  with charged as (
    insert into public.scholar_campaign_rate(campaign_id,bucket,visitor,kind,hits)
    values (p_campaign,floor(extract(epoch from now())/600)::bigint,p_visitor,p_kind,1)
    on conflict (campaign_id,bucket,visitor,kind) do update
      set hits=public.scholar_campaign_rate.hits+1
      where public.scholar_campaign_rate.hits < case when p_kind='lead' then 45 else 240 end
    returning 1
  )
  select exists(select 1 from charged);
$$;

create or replace function public.scholar_campaign_count(p_campaign text,p_event text)
returns void language sql set search_path='' as $$
  insert into public.scholar_campaign_counts(campaign_id,day,event,total)
  values (p_campaign,timezone('UTC',now())::date,p_event,1)
  on conflict (campaign_id,day,event) do update set total=public.scholar_campaign_counts.total+1;
$$;

create or replace function public.scholar_campaign_register(
  p_campaign text,p_visitor text,p_name text,p_email text,p_phone text,p_marketing boolean,
  p_utm_source text,p_utm_medium text,p_utm_campaign text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare offer jsonb;
begin
  -- Prevent an offer from being disabled between checking it and recording a lead.
  perform 1 from public.scholar_campaigns c join public.scholar_coupon_codes q
    on q.code=c.coupon_code where c.id=p_campaign for share of c,q;
  offer:=public.scholar_campaign_offer(p_campaign);
  if (offer->>'available')::boolean is distinct from true then
    return jsonb_build_object('status','inactive');
  end if;
  if not public.scholar_campaign_charge(p_campaign,p_visitor,'lead') then
    return jsonb_build_object('status','limited');
  end if;
  if p_name is null or p_email is null or p_phone is null then
    return jsonb_build_object('status','invalid');
  end if;

  insert into public.scholar_campaign_leads(
    campaign_id,full_name,email,phone,marketing_consent,privacy_notice_version,consent_recorded_at,
    expires_at,source,utm_source,utm_medium,utm_campaign
  )
  select c.id,p_name,p_email,p_phone,p_marketing,c.privacy_notice_version,
    case when p_marketing then now() end,
    now()+case when p_marketing then interval '365 days' else interval '90 days' end,
    c.source,p_utm_source,p_utm_medium,p_utm_campaign
  from public.scholar_campaigns c where c.id=p_campaign
  on conflict (campaign_id,email) do nothing;
  if found then perform public.scholar_campaign_count(p_campaign,'signup'); end if;
  return jsonb_build_object('status','ok','code',offer->>'code');
end $$;

create or replace function public.scholar_campaign_event(p_campaign text,p_visitor text,p_event text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_event in ('view','copy','plans')
    and (public.scholar_campaign_offer(p_campaign)->>'available')::boolean
    and public.scholar_campaign_charge(p_campaign,p_visitor,'event')
  then
    perform public.scholar_campaign_count(p_campaign,p_event);
  end if;
end $$;

create or replace function public.scholar_campaign_summary(p_campaign text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare views bigint; signups bigint; copies bigint; plans bigint;
  purchases bigint; revenue bigint; discount bigint;
begin
  perform public.scholar_require_platform_admin();
  select
    coalesce(sum(total) filter (where event='view'),0),
    coalesce(sum(total) filter (where event='signup'),0),
    coalesce(sum(total) filter (where event='copy'),0),
    coalesce(sum(total) filter (where event='plans'),0)
  into views,signups,copies,plans from public.scholar_campaign_counts where campaign_id=p_campaign;

  select count(*),coalesce(sum(payment.amount_cents),0),coalesce(sum(req.discount_cents),0)
    into purchases,revenue,discount
  from public.scholar_campaigns c
  join public.scholar_coupon_redemptions r on r.coupon_code=c.coupon_code
  join public.scholar_purchase_requests req on req.id=r.purchase_request_id
  join lateral (
    select amount_cents from public.scholar_payment_events
    where purchase_request_id=req.id and status='paid'
    order by created_at,id limit 1
  ) payment on true
  where c.id=p_campaign;
  return jsonb_build_object('views',views,'signups',signups,
    'signupRate',round(signups::numeric/nullif(views,0),4),'copies',copies,'planClicks',plans,
    'paidOrders',purchases,'paidRevenueCents',revenue,'paidDiscountCents',discount);
end $$;

revoke all on function public.scholar_campaign_offer(text),
  public.scholar_campaign_charge(text,text,text),public.scholar_campaign_count(text,text),
  public.scholar_campaign_register(text,text,text,text,text,boolean,text,text,text),
  public.scholar_campaign_event(text,text,text),public.scholar_campaign_summary(text)
  from public,anon,authenticated,service_role;

grant execute on function public.scholar_campaign_offer(text),
  public.scholar_campaign_register(text,text,text,text,text,boolean,text,text,text),
  public.scholar_campaign_event(text,text,text) to service_role;
grant execute on function public.scholar_campaign_summary(text) to authenticated;
commit;
