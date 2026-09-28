-- RESEARCHHUB SCHOLAR — CAMADA COMERCIAL E LICENCIAMENTO
-- Requer scholar_access.sql e scholar_operations.sql.
-- Não conecta Stripe, não cobra cartões e mantém IA desligada.

begin;

create table if not exists public.scholar_commerce_settings (
  id boolean primary key default true check (id),
  payments_enabled boolean not null default false,
  ai_enabled boolean not null default false,
  access_enforcement_enabled boolean not null default false,
  recharge_cents integer not null default 7900 check (recharge_cents >= 0),
  recharge_tokens bigint not null default 1000000 check (recharge_tokens > 0),
  updated_at timestamptz not null default now()
);

insert into public.scholar_commerce_settings(id)
values (true) on conflict (id) do nothing;

create table if not exists public.scholar_plan_catalog (
  audience text not null check (audience in ('individual','institutional')),
  plan text not null check (plan in ('essential','plus','premium')),
  display_name text not null,
  annual_unit_cents integer not null check (annual_unit_cents >= 0),
  tokens_per_unit bigint not null check (tokens_per_unit >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  primary key (audience,plan)
);

insert into public.scholar_plan_catalog(audience,plan,display_name,annual_unit_cents,tokens_per_unit,sort_order) values
  ('individual','essential','Essencial',59900,3000000,10),
  ('individual','plus','Plus',89900,6000000,20),
  ('individual','premium','Premium',149900,12000000,30),
  ('institutional','essential','Essencial',48000,3000000,10),
  ('institutional','plus','Plus',72000,6000000,20),
  ('institutional','premium','Premium',120000,12000000,30)
on conflict (audience,plan) do update set
  display_name=excluded.display_name,
  annual_unit_cents=excluded.annual_unit_cents,
  tokens_per_unit=excluded.tokens_per_unit,
  sort_order=excluded.sort_order;

create table if not exists public.scholar_coupon_codes (
  code text primary key check (code=upper(code) and length(code) between 3 and 40),
  audience text check (audience is null or audience in ('individual','institutional','recharge')),
  plan text check (plan is null or plan in ('essential','plus','premium')),
  percent_off integer not null default 0 check (percent_off between 0 and 100),
  amount_off_cents integer not null default 0 check (amount_off_cents >= 0),
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redemptions integer not null default 0 check (redemptions >= 0),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (percent_off > 0 or amount_off_cents > 0),
  check (valid_until is null or valid_until > valid_from)
);

create table if not exists public.scholar_purchase_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('individual','institutional','recharge')),
  plan text check (plan is null or plan in ('essential','plus','premium')),
  billing_schedule text not null default 'annual' check (billing_schedule in ('annual','12x')),
  seats integer not null default 1 check (seats between 1 and 10000),
  quantity integer not null default 1 check (quantity between 1 and 100),
  organization_name text,
  target_license_id uuid references public.scholar_licenses(id) on delete set null,
  coupon_code text,
  unit_amount_cents integer not null check (unit_amount_cents >= 0),
  gross_amount_cents integer not null check (gross_amount_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_amount_cents integer not null check (total_amount_cents >= 0),
  token_allowance bigint not null check (token_allowance >= 0),
  status text not null default 'requested' check (status in ('requested','approved','payment_pending','paid','activated','cancelled','expired')),
  fulfilled_license_id uuid references public.scholar_licenses(id) on delete set null,
  provider_checkout_id text unique,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_cents <= gross_amount_cents),
  check (total_amount_cents = gross_amount_cents-discount_cents),
  check (
    (kind='individual' and plan is not null and seats=1 and quantity=1 and organization_name is null and target_license_id is null)
    or (kind='institutional' and plan is not null and quantity=1 and length(trim(organization_name)) between 2 and 200 and target_license_id is null)
    or (kind='recharge' and plan is null and seats=1 and organization_name is null and target_license_id is not null)
  )
);

create index if not exists scholar_purchase_requests_owner_idx
  on public.scholar_purchase_requests(requester_id,created_at desc);
create index if not exists scholar_purchase_requests_status_idx
  on public.scholar_purchase_requests(status,created_at desc);

create table if not exists public.scholar_payment_events (
  id uuid primary key default gen_random_uuid(),
  purchase_request_id uuid not null references public.scholar_purchase_requests(id) on delete restrict,
  provider text not null default 'stripe',
  provider_event_id text not null unique,
  provider_payment_id text,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'brl' check (currency='brl'),
  status text not null check (status in ('paid','refunded','failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.scholar_coupon_redemptions (
  coupon_code text not null references public.scholar_coupon_codes(code) on delete restrict,
  purchase_request_id uuid not null unique references public.scholar_purchase_requests(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (coupon_code,purchase_request_id)
);

alter table public.scholar_commerce_settings enable row level security;
alter table public.scholar_plan_catalog enable row level security;
alter table public.scholar_coupon_codes enable row level security;
alter table public.scholar_purchase_requests enable row level security;
alter table public.scholar_payment_events enable row level security;
alter table public.scholar_coupon_redemptions enable row level security;

create policy "Commerce settings are readable" on public.scholar_commerce_settings
  for select to anon,authenticated using (true);
create policy "Active plans are readable" on public.scholar_plan_catalog
  for select to anon,authenticated using (active);
create policy "Users read own purchase requests" on public.scholar_purchase_requests
  for select to authenticated using (requester_id=auth.uid());

revoke all on public.scholar_commerce_settings,public.scholar_plan_catalog,public.scholar_coupon_codes,
  public.scholar_purchase_requests,public.scholar_payment_events,public.scholar_coupon_redemptions
  from anon,authenticated;
grant select on public.scholar_commerce_settings,public.scholar_plan_catalog to anon,authenticated;
grant select on public.scholar_purchase_requests to authenticated;

create or replace function public.scholar_commerce_quote(
  p_kind text,p_plan text default null,p_seats integer default 1,
  p_quantity integer default 1,p_coupon text default null
) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare catalog public.scholar_plan_catalog; settings public.scholar_commerce_settings;
  coupon public.scholar_coupon_codes; gross integer; discount integer:=0;
  tokens bigint; normalized_code text:=upper(nullif(trim(p_coupon),''));
begin
  select * into settings from public.scholar_commerce_settings where id=true;
  if p_kind in ('individual','institutional') then
    if p_plan not in ('essential','plus','premium') then raise exception 'Plano inválido'; end if;
    if p_kind='individual' then p_seats:=1; end if;
    if p_seats not between 1 and 10000 then raise exception 'Quantidade de vagas inválida'; end if;
    select * into catalog from public.scholar_plan_catalog where audience=p_kind and plan=p_plan and active;
    if catalog.plan is null then raise exception 'Plano indisponível'; end if;
    gross:=catalog.annual_unit_cents*p_seats; tokens:=catalog.tokens_per_unit*p_seats;
    p_quantity:=1;
  elsif p_kind='recharge' then
    if p_quantity not between 1 and 100 then raise exception 'Quantidade de recargas inválida'; end if;
    gross:=settings.recharge_cents*p_quantity; tokens:=settings.recharge_tokens*p_quantity;
    p_seats:=1;p_plan:=null;
  else raise exception 'Tipo de contratação inválido'; end if;

  if normalized_code is not null then
    select * into coupon from public.scholar_coupon_codes where code=normalized_code;
    if coupon.code is null or not coupon.active or now()<coupon.valid_from
      or (coupon.valid_until is not null and now()>=coupon.valid_until)
      or (coupon.max_redemptions is not null and coupon.redemptions>=coupon.max_redemptions)
      or (coupon.audience is not null and coupon.audience<>p_kind)
      or (coupon.plan is not null and coupon.plan is distinct from p_plan)
    then raise exception 'Cupom inválido ou indisponível'; end if;
    discount:=least(gross,(gross*coupon.percent_off/100)+coupon.amount_off_cents);
  end if;

  return jsonb_build_object(
    'kind',p_kind,'plan',p_plan,'seats',p_seats,'quantity',p_quantity,
    'unitAmountCents',case when p_kind='recharge' then settings.recharge_cents else catalog.annual_unit_cents end,
    'grossAmountCents',gross,'discountCents',discount,'totalAmountCents',gross-discount,
    'installmentCents',(gross-discount+11)/12,'tokenAllowance',tokens,'couponCode',normalized_code,
    'paymentsEnabled',settings.payments_enabled,'aiEnabled',settings.ai_enabled,
    'accessEnforcementEnabled',settings.access_enforcement_enabled
  );
end $$;

create or replace function public.scholar_create_purchase_request(
  p_kind text,p_plan text default null,p_billing_schedule text default 'annual',
  p_seats integer default 1,p_quantity integer default 1,
  p_organization_name text default null,p_target_license uuid default null,p_coupon text default null
) returns uuid
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); quote jsonb; result uuid; normalized_name text:=nullif(trim(p_organization_name),'');
begin
  if uid is null then raise exception 'Entre na sua conta'; end if;
  if p_billing_schedule not in ('annual','12x') then raise exception 'Forma de pagamento inválida'; end if;
  if p_kind='institutional' and (normalized_name is null or length(normalized_name) not between 2 and 200) then raise exception 'Informe o nome do programa'; end if;
  if p_kind='recharge' and not exists(
    select 1 from public.scholar_licenses l where l.id=p_target_license
      and (l.owner_id=uid or public.scholar_is_director(l.organization_id))
  ) then raise exception 'Licença indisponível'; end if;
  quote:=public.scholar_commerce_quote(p_kind,p_plan,p_seats,p_quantity,p_coupon);
  insert into public.scholar_purchase_requests(
    requester_id,kind,plan,billing_schedule,seats,quantity,organization_name,target_license_id,coupon_code,
    unit_amount_cents,gross_amount_cents,discount_cents,total_amount_cents,token_allowance
  ) values(
    uid,p_kind,quote->>'plan',p_billing_schedule,(quote->>'seats')::integer,(quote->>'quantity')::integer,
    case when p_kind='institutional' then normalized_name else null end,
    case when p_kind='recharge' then p_target_license else null end,quote->>'couponCode',
    (quote->>'unitAmountCents')::integer,(quote->>'grossAmountCents')::integer,
    (quote->>'discountCents')::integer,(quote->>'totalAmountCents')::integer,(quote->>'tokenAllowance')::bigint
  ) returning id into result;
  return result;
end $$;

create or replace function public.scholar_cancel_purchase_request(p_request uuid) returns boolean
language plpgsql security definer set search_path=public as $$
begin
  update public.scholar_purchase_requests set status='cancelled',updated_at=now()
    where id=p_request and requester_id=auth.uid() and status in ('requested','approved','payment_pending');
  return found;
end $$;

create or replace function public.scholar_product_access_state() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare uid uuid:=auth.uid(); settings public.scholar_commerce_settings; allowed boolean:=false; reason text;
begin
  if uid is null then raise exception 'Entre na sua conta'; end if;
  select * into settings from public.scholar_commerce_settings where id=true;
  allowed:=not settings.access_enforcement_enabled or exists(
    select 1 from public.scholar_licenses l
    where l.owner_id=uid and l.status in ('active','trial') and now() between l.starts_at and l.ends_at
  ) or exists(
    select 1 from public.scholar_memberships m join public.scholar_licenses l on l.organization_id=m.organization_id
    where m.user_id=uid and m.active and l.status in ('active','trial') and now() between l.starts_at and l.ends_at
  );
  reason:=case when not settings.access_enforcement_enabled then 'beta_access' when allowed then 'active' else 'license_required' end;
  return jsonb_build_object('allowed',allowed,'reason',reason,'enforcementEnabled',settings.access_enforcement_enabled);
end $$;

create or replace function public.scholar_admin_commerce_summary() returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
  perform public.scholar_require_platform_admin();
  return jsonb_build_object(
    'requested',(select count(*) from public.scholar_purchase_requests where status='requested'),
    'paymentPending',(select count(*) from public.scholar_purchase_requests where status='payment_pending'),
    'activated',(select count(*) from public.scholar_purchase_requests where status='activated'),
    'pipelineCents',(select coalesce(sum(total_amount_cents),0) from public.scholar_purchase_requests where status in ('requested','approved','payment_pending')),
    'activeLicenses',(select count(*) from public.scholar_licenses where status in ('active','trial') and now() between starts_at and ends_at),
    'expiring30d',(select count(*) from public.scholar_licenses where status in ('active','trial') and ends_at between now() and now()+interval '30 days')
  );
end $$;

create or replace function public.scholar_admin_purchase_requests()
returns table(id uuid,user_email text,kind text,plan text,billing_schedule text,seats integer,quantity integer,
  organization_name text,total_amount_cents integer,token_allowance bigint,status text,created_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
  perform public.scholar_require_platform_admin();
  return query select r.id,u.email,r.kind,r.plan,r.billing_schedule,r.seats,r.quantity,r.organization_name,
    r.total_amount_cents,r.token_allowance,r.status,r.created_at
    from public.scholar_purchase_requests r join auth.users u on u.id=r.requester_id
    order by (r.status='requested') desc,r.created_at desc limit 200;
end $$;

create or replace function public.scholar_admin_set_purchase_status(p_request uuid,p_status text) returns boolean
language plpgsql security definer set search_path=public as $$
begin
  perform public.scholar_require_platform_admin();
  if p_status not in ('approved','payment_pending','cancelled','expired') then raise exception 'Estado inválido'; end if;
  update public.scholar_purchase_requests set status=p_status,updated_at=now()
    where id=p_request and status not in ('paid','activated');
  return found;
end $$;

create or replace function public.scholar_admin_activate_test_request(p_request uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare req public.scholar_purchase_requests; license_id uuid;
begin
  perform public.scholar_require_platform_admin();
  select * into req from public.scholar_purchase_requests where id=p_request for update;
  if req.id is null or req.status not in ('requested','approved','payment_pending') then raise exception 'Solicitação indisponível'; end if;
  if req.kind='recharge' then
    perform public.scholar_recharge(req.id,req.target_license_id,req.token_allowance);
    license_id:=req.target_license_id;
  else
    license_id:=public.scholar_provision(req.requester_id,req.plan,
      case when req.kind='institutional' then req.organization_name else null end,req.seats);
  end if;
  update public.scholar_purchase_requests set status='activated',fulfilled_license_id=license_id,updated_at=now() where id=req.id;
  return license_id;
end $$;

create or replace function public.scholar_admin_upsert_coupon(
  p_code text,p_audience text,p_plan text,p_percent_off integer,p_amount_off_cents integer,
  p_max_redemptions integer default null,p_valid_until timestamptz default null,p_active boolean default true
) returns text
language plpgsql security definer set search_path=public as $$
declare normalized text:=upper(trim(p_code));
begin
  perform public.scholar_require_platform_admin();
  insert into public.scholar_coupon_codes(code,audience,plan,percent_off,amount_off_cents,max_redemptions,valid_until,active)
  values(normalized,p_audience,p_plan,p_percent_off,p_amount_off_cents,p_max_redemptions,p_valid_until,p_active)
  on conflict(code) do update set audience=excluded.audience,plan=excluded.plan,percent_off=excluded.percent_off,
    amount_off_cents=excluded.amount_off_cents,max_redemptions=excluded.max_redemptions,
    valid_until=excluded.valid_until,active=excluded.active;
  return normalized;
end $$;

-- O futuro webhook chama esta função com service_role após verificar a assinatura Stripe.
-- Enquanto payments_enabled=false, nenhuma solicitação pode ser cumprida como paga.
create or replace function public.scholar_fulfill_paid_request(
  p_request uuid,p_provider_event text,p_provider_payment text default null,p_provider_subscription text default null
) returns uuid
language plpgsql security definer set search_path=public as $$
declare req public.scholar_purchase_requests; settings public.scholar_commerce_settings; license_id uuid;
  existing public.scholar_licenses; starts timestamptz; finish timestamptz;
begin
  select * into settings from public.scholar_commerce_settings where id=true;
  if not settings.payments_enabled then raise exception 'Pagamentos ainda não estão habilitados'; end if;
  if exists(select 1 from public.scholar_payment_events where provider_event_id=p_provider_event) then
    return (select fulfilled_license_id from public.scholar_purchase_requests where id=p_request);
  end if;
  select * into req from public.scholar_purchase_requests where id=p_request for update;
  if req.id is null or req.status not in ('approved','payment_pending') then raise exception 'Solicitação indisponível'; end if;

  if req.kind='recharge' then
    perform public.scholar_recharge(req.id,req.target_license_id,req.token_allowance);license_id:=req.target_license_id;
  elsif req.kind='individual' then
    select * into existing from public.scholar_licenses where owner_id=req.requester_id for update;
    starts:=now();finish:=case when existing.id is null or existing.ends_at<now() then now()+interval '1 year' else existing.ends_at+interval '1 year' end;
    if existing.id is null then
      insert into public.scholar_licenses(owner_id,plan,status,mode,starts_at,ends_at,seats,token_allowance)
      values(req.requester_id,req.plan,'active',case when settings.ai_enabled then 'live' else 'simulation' end,starts,finish,1,req.token_allowance)
      returning id into license_id;
      insert into public.scholar_wallets(license_id,user_id,allowance) values(license_id,req.requester_id,req.token_allowance);
    else
      license_id:=existing.id;
      update public.scholar_licenses set plan=req.plan,status='active',mode=case when settings.ai_enabled then 'live' else 'simulation' end,
        ends_at=finish,token_allowance=token_allowance+req.token_allowance where id=license_id;
      update public.scholar_wallets set allowance=allowance+req.token_allowance where license_id=license_id and user_id=req.requester_id;
    end if;
  else
    license_id:=public.scholar_provision(req.requester_id,req.plan,req.organization_name,req.seats);
    update public.scholar_licenses set status='active',mode=case when settings.ai_enabled then 'live' else 'simulation' end,
      ends_at=now()+interval '1 year' where id=license_id;
  end if;

  insert into public.scholar_payment_events(purchase_request_id,provider_event_id,provider_payment_id,amount_cents,status)
    values(req.id,p_provider_event,p_provider_payment,req.total_amount_cents,'paid');
  if req.coupon_code is not null then
    insert into public.scholar_coupon_redemptions(coupon_code,purchase_request_id,user_id)
      values(req.coupon_code,req.id,req.requester_id) on conflict do nothing;
    update public.scholar_coupon_codes set redemptions=redemptions+1 where code=req.coupon_code;
  end if;
  update public.scholar_purchase_requests set status='activated',fulfilled_license_id=license_id,
    provider_subscription_id=p_provider_subscription,updated_at=now() where id=req.id;
  return license_id;
end $$;

revoke all on function public.scholar_commerce_quote(text,text,integer,integer,text) from public;
revoke all on function public.scholar_create_purchase_request(text,text,text,integer,integer,text,uuid,text) from public;
revoke all on function public.scholar_cancel_purchase_request(uuid) from public;
revoke all on function public.scholar_product_access_state() from public;
revoke all on function public.scholar_admin_commerce_summary() from public;
revoke all on function public.scholar_admin_purchase_requests() from public;
revoke all on function public.scholar_admin_set_purchase_status(uuid,text) from public;
revoke all on function public.scholar_admin_activate_test_request(uuid) from public;
revoke all on function public.scholar_admin_upsert_coupon(text,text,text,integer,integer,integer,timestamptz,boolean) from public;
revoke all on function public.scholar_fulfill_paid_request(uuid,text,text,text) from public,anon,authenticated;

grant execute on function public.scholar_commerce_quote(text,text,integer,integer,text) to anon,authenticated;
grant execute on function public.scholar_create_purchase_request(text,text,text,integer,integer,text,uuid,text) to authenticated;
grant execute on function public.scholar_cancel_purchase_request(uuid) to authenticated;
grant execute on function public.scholar_product_access_state() to authenticated;
grant execute on function public.scholar_admin_commerce_summary() to authenticated;
grant execute on function public.scholar_admin_purchase_requests() to authenticated;
grant execute on function public.scholar_admin_set_purchase_status(uuid,text) to authenticated;
grant execute on function public.scholar_admin_activate_test_request(uuid) to authenticated;
grant execute on function public.scholar_admin_upsert_coupon(text,text,text,integer,integer,integer,timestamptz,boolean) to authenticated;
grant execute on function public.scholar_fulfill_paid_request(uuid,text,text,text) to service_role;

commit;
