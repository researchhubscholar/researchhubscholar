-- ResearchHub: preços anuais individuais autorizados em 05/11/2026.
-- Requer scholar_commerce.sql. Reexecutável; não reexecutar o instalador antigo.
-- Não altera pedidos, licenças, franquias, pagamentos ou planos institucionais.
begin;
update public.scholar_plan_catalog
set annual_unit_cents = case plan
  when 'essential' then 59900
  when 'plus' then 79900
  when 'premium' then 99900
end
where audience = 'individual' and plan in ('essential','plus','premium');

do $$
begin
  if (select count(*) from public.scholar_plan_catalog
      where audience = 'individual' and
      ((plan = 'essential' and annual_unit_cents = 59900) or
       (plan = 'plus' and annual_unit_cents = 79900) or
       (plan = 'premium' and annual_unit_cents = 99900))) <> 3 then
    raise exception 'O catálogo individual está incompleto. Confira a instalação comercial antes de aplicar os preços.';
  end if;
end;
$$;
commit;

select plan, annual_unit_cents / 100.0 as preco_anual_reais, tokens_per_unit
from public.scholar_plan_catalog
where audience = 'individual'
order by sort_order;
