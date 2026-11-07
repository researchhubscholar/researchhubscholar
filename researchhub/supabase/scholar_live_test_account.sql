-- RESEARCHHUB SCHOLAR — ATIVAÇÃO CONTROLADA DE UMA CONTA DE TESTE
-- Execute somente no SQL Editor do Supabase Scholar.
-- Antes de executar, substitua o e-mail abaixo pelo e-mail usado no login.
-- A operação é idempotente e não ativa IA para outras contas.

begin;

do $$
declare
  test_email text := 'SUBSTITUA_PELO_EMAIL_DA_CONTA';
  test_user uuid;
  test_license uuid;
  test_token_limit bigint := 200000;
  committed_tokens bigint := 0;
begin
  if test_email = 'SUBSTITUA_PELO_EMAIL_DA_CONTA' then
    raise exception 'Substitua test_email pelo e-mail da conta de teste antes de executar.';
  end if;

  select id into test_user
  from auth.users
  where lower(email) = lower(trim(test_email))
  limit 1;

  if test_user is null then
    raise exception 'Conta não encontrada para o e-mail informado.';
  end if;

  select id into test_license
  from public.scholar_licenses
  where owner_id = test_user
  limit 1;

  if test_license is null then
    test_license := public.scholar_provision(test_user, 'essential', null, 1);
  end if;

  select coalesce(max(used + reserved), 0) into committed_tokens
  from public.scholar_wallets
  where license_id = test_license and user_id = test_user;

  if committed_tokens > test_token_limit then
    raise exception 'O consumo já registrado ultrapassa a franquia de teste de 200.000 tokens.';
  end if;

  update public.scholar_licenses
  set status = 'trial',
      mode = 'live',
      starts_at = least(starts_at, now()),
      ends_at = greatest(ends_at, now() + interval '30 days'),
      token_allowance = test_token_limit
  where id = test_license and owner_id = test_user;

  insert into public.scholar_wallets (license_id, user_id, allowance)
  values (test_license, test_user, test_token_limit)
  on conflict (license_id, user_id) do update
  set allowance = excluded.allowance;
end $$;

commit;

-- Confirmação: deve retornar exatamente uma linha em modo live.
select
  u.email,
  l.status,
  l.mode,
  l.ends_at,
  w.allowance,
  w.used,
  w.reserved
from auth.users u
join public.scholar_licenses l on l.owner_id = u.id
join public.scholar_wallets w on w.license_id = l.id and w.user_id = u.id
where lower(u.email) = lower('SUBSTITUA_PELO_EMAIL_DA_CONTA');

-- REVERSÃO OPCIONAL (não execute junto com a ativação):
-- update public.scholar_licenses
-- set mode = 'simulation'
-- where owner_id = (
--   select id from auth.users
--   where lower(email) = lower('SUBSTITUA_PELO_EMAIL_DA_CONTA')
-- );
