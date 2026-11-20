-- ResearchHub: paid activation for accounts with an existing license.
-- Apply in the ResearchHub Supabase SQL Editor after schema inspection.
-- Keeps paid licenses in live mode and ensures a wallet exists on renewal.
-- Only replaces fulfillment. Does not enable payments or change prices.
begin;

-- Refuse to overwrite a function that was changed independently in this database.
do $preflight$
declare current_body text;
begin
  select prosrc into current_body from pg_proc
  where oid=to_regprocedure('public.scholar_fulfill_paid_request(uuid,text,text,text)');
  if current_body is null then
    raise exception 'Instale e confira o esquema comercial antes de aplicar esta correção.';
  end if;
  if md5(current_body) not in ('fccbfa0ecac275adede6004abd980543','70110925ea8cd1ff1d581f9387400589','c146c3ed12f3b50af81b59d552e31bfc') then
    raise exception 'A função instalada difere da versão revisada. Nenhuma alteração aplicada. Confira a definição atual antes de prosseguir.';
  end if;
end $preflight$;

create or replace function public.scholar_fulfill_paid_request(
  p_request uuid,p_provider_event text,p_provider_payment text default null,p_provider_subscription text default null
) returns uuid
language plpgsql security definer set search_path=public as $$
declare req public.scholar_purchase_requests; settings public.scholar_commerce_settings; paid_license_id uuid;
  existing public.scholar_licenses; starts timestamptz; finish timestamptz;
begin
  select * into settings from public.scholar_commerce_settings where id=true;
  if not settings.payments_enabled then raise exception 'Pagamentos ainda não estão habilitados'; end if;
  if exists(select 1 from public.scholar_payment_events where provider_event_id=p_provider_event and purchase_request_id<>p_request) then
    raise exception 'Identificador de pagamento já vinculado a outra compra';
  end if;
  if exists(select 1 from public.scholar_payment_events where provider_event_id=p_provider_event) then
    return (select fulfilled_license_id from public.scholar_purchase_requests where id=p_request);
  end if;
  select * into req from public.scholar_purchase_requests where id=p_request for update;
  if req.status='activated' and req.fulfilled_license_id is not null then return req.fulfilled_license_id; end if;
  if req.id is null or req.status not in ('approved','payment_pending') then raise exception 'Solicitação indisponível'; end if;

  if req.kind='recharge' then
    perform public.scholar_recharge(req.id,req.target_license_id,req.token_allowance);paid_license_id:=req.target_license_id;
  elsif req.kind='individual' then
    select * into existing from public.scholar_licenses where owner_id=req.requester_id for update;
    starts:=now();finish:=case when existing.id is null or existing.ends_at<now() then now()+interval '1 year' else existing.ends_at+interval '1 year' end;
    if existing.id is null then
      insert into public.scholar_licenses(owner_id,plan,status,mode,starts_at,ends_at,seats,token_allowance)
      values(req.requester_id,req.plan,'active','live',starts,finish,1,req.token_allowance)
      returning id into paid_license_id;
      insert into public.scholar_wallets(license_id,user_id,allowance) values(paid_license_id,req.requester_id,req.token_allowance);
    else
      paid_license_id:=existing.id;
      update public.scholar_licenses set plan=req.plan,status='active',mode='live',
        ends_at=finish,token_allowance=token_allowance+req.token_allowance where id=paid_license_id;
      insert into public.scholar_wallets(license_id,user_id,allowance)
        values(paid_license_id,req.requester_id,req.token_allowance)
        on conflict(license_id,user_id) do update
        set allowance=scholar_wallets.allowance+excluded.allowance;
    end if;
  else
    paid_license_id:=public.scholar_provision(req.requester_id,req.plan,req.organization_name,req.seats);
    update public.scholar_licenses set status='active',mode='live',
      ends_at=now()+interval '1 year' where id=paid_license_id;
  end if;

  insert into public.scholar_payment_events(purchase_request_id,provider_event_id,provider_payment_id,amount_cents,status)
    values(req.id,p_provider_event,p_provider_payment,req.total_amount_cents,'paid');
  if req.coupon_code is not null then
    insert into public.scholar_coupon_redemptions(coupon_code,purchase_request_id,user_id)
      values(req.coupon_code,req.id,req.requester_id) on conflict do nothing;
    update public.scholar_coupon_codes set redemptions=redemptions+1 where code=req.coupon_code;
  end if;
  update public.scholar_purchase_requests set status='activated',fulfilled_license_id=paid_license_id,
    provider_subscription_id=p_provider_subscription,updated_at=now() where id=req.id;
  return paid_license_id;
end $$;

revoke all on function public.scholar_fulfill_paid_request(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.scholar_fulfill_paid_request(uuid,text,text,text) to service_role;

commit;
