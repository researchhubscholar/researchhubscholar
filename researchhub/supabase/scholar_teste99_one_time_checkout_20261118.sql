-- ResearchHub: one-use Essencial 99% checkout test.
-- Manual execution only on the verified ResearchHub Production Supabase.
-- Does NOT activate a license, create a payment, alter users or enable other checkouts.
begin;

insert into public.scholar_coupon_codes (
  code, audience, plan, percent_off, amount_off_cents,
  max_redemptions, redemptions, valid_from, valid_until, active
)
values (
  'TESTE99', 'individual', 'essential', 99, 0,
  1, 0, now(), now() + interval '3 days', true
)
on conflict (code) do nothing;

-- Abort and roll back if TESTE99 exists but differs from the approved test.
do $$
declare c public.scholar_coupon_codes;
begin
  select * into c from public.scholar_coupon_codes where code = 'TESTE99' for update;
  if c.code is null or c.audience <> 'individual' or c.plan <> 'essential'
     or c.percent_off <> 99 or c.amount_off_cents <> 0
     or c.max_redemptions <> 1 or c.redemptions <> 0 or not c.active
     or c.valid_from > now() or c.valid_until is null or c.valid_until <= now()
  then
    raise exception 'TESTE99 ja existe com configuracao diferente ou expirou. Revise antes de continuar.';
  end if;
end $$;

commit;

select code, audience, plan, percent_off, max_redemptions,
       redemptions, valid_until, active,
       public.scholar_commerce_quote('individual', 'essential', 1, 1, 'TESTE99') ->> 'totalAmountCents'
         as total_cents_expected_599
from public.scholar_coupon_codes
where code = 'TESTE99';