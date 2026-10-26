const fs = require('node:fs'), assert = require('node:assert/strict'), vm = require('node:vm'), ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
require.extensions['.ts'] = (module, filename) => module._compile(compile(filename), filename);
const compile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function load(path, deps) {
  const module = { exports: {} };
  vm.runInNewContext(compile(path), { module, exports: module.exports, console: { error() {} }, process, crypto, AbortSignal, Request, Response, require(name) { if (name === 'server-only') return {}; if (name in deps) return deps[name]; throw Error(name); } });
  return module.exports;
}

(async () => {
  // Supabase errors returned as objects must be handled as carefully as rejections.
  for (const scenario of [
    { status: 'failed', expected: 'refunded' },
    { status: 'completed', expected: 'completed' },
    { status: 'reserved', expected: 'pending' },
    { status: null, expected: 'pending' },
    { status: 'failed', rpcError: true, expected: 'refunded' },
    { status: 'failed', rpcThrows: true, expected: 'refunded' },
    { status: 'failed', readError: true, expected: 'pending' },
    { status: 'failed', readThrows: true, expected: 'pending' },
    { status: 'failed', artifactError: true, expected: 'refunded' },
    { status: 'failed', artifactThrows: true, expected: 'refunded' },
  ]) {
    const calls = [];
    const admin = {
      async rpc(name, payload) { calls.push({ name, payload }); if (scenario.rpcThrows) throw Error(); return { error: scenario.rpcError ? { code: 'DB_ERROR' } : null }; },
      from(table) { return {
        select() { return { eq() { return { async maybeSingle() { if (scenario.readThrows) throw Error(); return { data: scenario.status ? { status: scenario.status } : null, error: scenario.readError ? {} : null }; } }; } }; },
        update(values) { calls.push({ table, values }); return { async eq() { if (scenario.artifactThrows) throw Error(); return { error: scenario.artifactError ? {} : null }; } }; },
      }; },
    };
    const lifecycle = load('lib/ai/failed-reservation.ts', { '@/lib/supabase/admin': { supabaseAdmin: () => admin }, '@/lib/ai/config': { scholarAI: { reservedTokens: 10000 }, estimatedCost: (i,o) => (i+o)/100000 } });
    const metering = lifecycle.providerMetering({ usage: { inputTokens: 1000, outputTokens: 500 }, response: { id: 'provider-fixture' } });
    assert.equal(metering.costUsd, 0.015);
    assert.equal(lifecycle.providerMetering({ usage: { inputTokens: -1, outputTokens: 3 } }), null);
    assert.equal(lifecycle.providerMetering({ usage: {} }), null);
    assert.equal(lifecycle.providerMetering({ usage: { inputTokens: 5000, outputTokens: 6000 } }), null);
    const result = await lifecycle.settleFailedReservation('operation', 'GENERATION_FAILED', metering);
    assert.equal(result, scenario.expected);
    assert.equal(calls[0].name, 'scholar_settle'); assert.equal(calls[0].payload.p_failed, true); assert.equal(calls[0].payload.p_cost, 0.015); assert.equal(calls[0].payload.p_input, 1000); assert.equal(calls[0].payload.p_provider_id, 'provider-fixture');
    assert.equal(calls.filter(call => call.table).length, scenario.expected === 'refunded' ? 1 : 0);
    const notice = lifecycle.reservationNotice(result);
    assert.equal(notice.includes('foi liberada'), result === 'refunded');
    if (result === 'completed') assert(notice.includes('já foi concluída'));
  }
  for (const [envelope, expected] of [[0.001, 'não cobre'], ['NaN', 'válido'], [null, 'válido'], [Infinity, 'válido'], [0.002, null]]) {
    const guard = load('lib/ai/financial-guard.ts', {
      '@/lib/supabase/admin': { supabaseAdmin: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { enabled: true, operation_envelope_usd: envelope }, error: null }) }) }) }) }) },
      '@/lib/ai/config': { scholarAI: { inputUsdPerToken: 0.00000003, outputUsdPerToken: 0.00000013, reservedTokens: 10000 }, scholarAIModels: [{}] },
    });
    if (expected) await assert.rejects(guard.verifyFinancialEnvelope('live'), new RegExp(expected));
    else await guard.verifyFinancialEnvelope('live');
    await guard.verifyFinancialEnvelope('simulation');
  }

  // Invoke the real HTTP handler with an invalid model response and returned DB errors.
  const config = { scholarAIReady: true, scholarAI: { model: 'fixture', reasoning: 'none', reservedTokens: 10000, maxAssistOutputTokens: 4000 }, scholarAIModels: [{ model: {}, id: 'fixture' }], estimatedCost: (i,o) => (i+o)/100000, providerErrorText: error => error?.message || '', retryWithFallback: () => false };
  for (const ledgerStatus of ['failed', 'completed', 'reserved']) {
    const rpcCalls = [];
    const admin = {
      async rpc(name, payload) { rpcCalls.push({ name, payload }); return { error: name === 'scholar_settle' && ledgerStatus === 'reserved' ? { code: 'DB_ERROR' } : null }; },
      from(table) {
        const chain = {
          select() { return chain; }, eq() { return chain; }, lt() { return chain; }, insert() { return chain; }, update() { return chain; },
          async maybeSingle() { return { data: { status: ledgerStatus }, error: null }; },
          then(resolve, reject) { const data = table === 'scholar_wallets' ? [{ id: 'wallet', license_id: 'license', allowance: 3000000, used: 0, reserved: 0 }] : table === 'scholar_licenses' ? [{ id: 'license', mode: 'live', status: 'active', starts_at: '2000-01-01', ends_at: '2100-01-01' }] : []; return Promise.resolve({ data, error: null }).then(resolve, reject); },
          in() { return chain; },
        };
        return chain;
      },
    };
    const lifecycle = load('lib/ai/failed-reservation.ts', { '@/lib/supabase/admin': { supabaseAdmin: () => admin }, '@/lib/ai/config': config });
    const handler = load('app/api/ai/assist/route.ts', {
      '@/lib/ai/failed-reservation': lifecycle,
      '@/lib/ai/financial-guard': { verifyFinancialEnvelope: async () => {} },
      '@/lib/ai/wallet-selection': { requestedWallet: () => null, chooseWallet: rows => rows[0] },
      'next/server': { NextResponse: { json: (body, options) => new Response(JSON.stringify(body), options) } },
      ai: { generateText: async () => ({ output: {}, usage: { inputTokens: 1000, outputTokens: 500 }, response: { id: 'provider-fixture' } }), jsonSchema: value => value, Output: { object: value => value } },
      '@/lib/ai/config': config,
      '@/lib/ai/guide-excerpt':require('../lib/ai/guide-excerpt.ts'),'@/lib/ai/guide-navigation':require('../lib/ai/guide-navigation.ts'),'@/lib/ai/guide-policy':require('../lib/ai/guide-policy.ts'),'@/lib/ai/guide-sources':require('../lib/ai/guide-sources.ts'),'@/lib/ai/radar-action':require('../lib/ai/radar-action.ts'),'@/lib/ai/assist': require('../lib/ai/assist.ts'), '@/lib/ai/guide-server': {prepareGuideContext:async()=>{throw Error('guide not used');}},
      '@/lib/ai/structured-output': require('../lib/ai/structured-output.ts'),
      '@/lib/supabase/admin': { supabaseAdmin: () => admin },
      '@/lib/supabase/server': { supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'fixture-user' } } }) } }) },
    });
    const res = await handler.POST(new Request('https://fixture.local/api/ai/assist', { method: 'POST', body: JSON.stringify({ feature: 'protocol', context: { theme: 'Projeto de demonstração' } }) }));
    const body = await res.json();
    assert.equal(body.reservation, ledgerStatus === 'failed' ? 'refunded' : ledgerStatus === 'completed' ? 'completed' : 'pending');
    assert.equal(res.status, ledgerStatus === 'reserved' ? 503 : 400);
    assert.equal(body.error.includes('foi liberada'), ledgerStatus === 'failed');
    if (ledgerStatus === 'completed') assert(!body.error.includes('Tente novamente'));
    const settlement = rpcCalls.find(call => call.name === 'scholar_settle');
    assert.equal(settlement.payload.p_cost, 0.015); assert.equal(settlement.payload.p_failed, true);
  }

  const generationId = '11111111-1111-4111-8111-111111111111';
  const jsx = (type, props) => ({ type, props });
  const generation = load('app/geracoes/[id]/page.tsx', {
    '@/components/ai/evaluation-form': { default: 'EvaluationForm' }, 'next/link': { default: 'Link' },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'next/navigation': { notFound() { throw Error('Unexpected 404'); }, redirect() { throw Error('Unexpected redirect'); } },
    '@/lib/ai/evaluation/rubric': require('../lib/ai/evaluation/rubric.ts'), '@/lib/ai/refine-idea': require('../lib/ai/refine-idea.ts'), '@/lib/access/plans': require('../lib/access/plans.ts'),
    '@/lib/supabase/server': { supabaseServer: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'fixture-user' } } }) }, from(table) { const chain = { select() { return chain; }, eq() { return chain; }, async maybeSingle() { return { data: table === 'scholar_usage' ? { id: generationId, status: 'failed', mode: 'live', input_tokens: 1000, output_tokens: 500, cost_usd: 0.015, created_at: '2026-10-16T12:00:00Z', finished_at: '2026-10-16T12:00:12Z' } : null }; } }; return chain; } }) },
  });
  const page = await generation.default({ params: Promise.resolve({ id: generationId }) });
  const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
  const charged = nodes(page).find(node => node.props?.label === 'Tokens debitados da franquia');
  assert.equal(charged.props.value, '0', 'Reported provider tokens in a failed operation are not a debit to the user');
  assert(JSON.stringify(page).includes('O conteúdo desta operação não está disponível'), 'The ledger stays accessible after an artifact insertion failure');

  const db = new PGlite();
  try {
    await db.exec(`create role authenticated;create role anon;create role service_role;create schema auth;create schema extensions;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claim.role',true),'')$$;
      create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),raw_user_meta_data jsonb default '{}');
      create function public.gen_random_bytes(n integer) returns bytea language sql as $$select decode(md5(random()::text),'hex')$$;
      create function public.digest(value text,algorithm text) returns bytea language sql as $$select decode(md5(value),'hex')$$;`);
    await db.exec(fs.readFileSync('supabase/scholar_install.sql', 'utf8').replace('create extension if not exists "pgcrypto";', ''));
    await db.exec(fs.readFileSync('supabase/scholar_access.sql', 'utf8'));
    await db.exec(fs.readFileSync('supabase/scholar_ai_budgets.sql', 'utf8'));
    const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222';
    await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)', [a, 'a@fixture.local', b, 'b@fixture.local']);
    const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
    const licA = await scalar('select scholar_provision($1)', [a]), licB = await scalar('select scholar_provision($1)', [b]);
    const walletA = await scalar('select id from scholar_wallets where license_id=$1', [licA]), walletB = await scalar('select id from scholar_wallets where license_id=$1', [licB]);
    await db.exec("update scholar_licenses set mode='live';update scholar_ai_budget_settings set enabled=true,global_daily_usd=0.75,license_daily_usd=0.5,operation_envelope_usd=0.25");
    const uuid = () => crypto.randomUUID();
    const reserve = (id, wallet = walletA, user = a) => db.query("select scholar_reserve($1,$2,$3,'ideas','fixture',10000)", [id, wallet, user]);
    const first = uuid(); await reserve(first); await reserve(first);
    assert.equal(await scalar('select reserved from scholar_wallets where id=$1', [walletA]), 10000);
    assert.equal(await scalar('select count(*)::int from scholar_ai_budget_admissions'), 1);
    await assert.rejects(reserve(uuid()), /andamento/);
    await db.query('select scholar_settle($1,1200,2000,0.01,false)', [first]);
    await db.query('select scholar_settle($1,0,0,0,true)', [first]);
    assert.equal(await scalar('select used from scholar_wallets where id=$1', [walletA]), 3200);
    const second = uuid(); await reserve(second); await db.query('select scholar_settle($1,400,200,0.02,true)', [second]);
    assert.equal(await scalar('select used from scholar_wallets where id=$1', [walletA]), 3200);
    assert.equal(await scalar('select reserved from scholar_wallets where id=$1', [walletA]), 0);
    assert.equal(Number(await scalar('select cost_usd from scholar_usage where id=$1', [second])), 0.02);
    await assert.rejects(reserve(uuid()), /financeiro diário desta licença/);
    const third = uuid(); await reserve(third, walletB, b); await db.query('select scholar_settle($1,0,0,0,true)', [third]);
    await assert.rejects(reserve(uuid(), walletB, b), /financeiro diário da plataforma/);
    assert.equal(await scalar('select count(*)::int from scholar_usage'), 3);
    assert.equal(Number(await scalar('select sum(reserved_usd) from scholar_ai_budget_admissions')), 0.75);

    await db.exec('update scholar_ai_budget_settings set enabled=false');
    await db.query('update scholar_wallets set allowance=10000,used=0 where id=$1', [walletA]);
    const exact = uuid(); await reserve(exact); await db.query('select scholar_settle($1,3999,6000,0,false)', [exact]);
    assert.equal(await scalar('select allowance-used-reserved from scholar_wallets where id=$1', [walletA]), 1);
    await assert.rejects(reserve(uuid()), /Franquia insuficiente/);
    const allowanceBefore = await scalar('select token_allowance from scholar_licenses where id=$1', [licA]);
    const expiry = await scalar('select ends_at::text from scholar_licenses where id=$1', [licA]);
    const recharge = uuid(); await db.query('select scholar_recharge($1,$2,1000000)', [recharge, licA]);
    await db.query('select scholar_recharge($1,$2,1000000)', [recharge, licA]);
    assert.equal(await scalar('select token_allowance from scholar_licenses where id=$1', [licA]), allowanceBefore + 1000000);
    assert.equal(await scalar('select allowance from scholar_wallets where id=$1', [walletA]), 1010000);
    assert.equal(await scalar('select used from scholar_wallets where id=$1', [walletA]), 9999);
    assert.equal(await scalar('select ends_at::text from scholar_licenses where id=$1', [licA]), expiry);
    assert.equal(await scalar('select allowance from scholar_wallets where id=$1', [walletB]), 3000000);
    await assert.rejects(db.query('select scholar_recharge($1,$2,2000000)', [recharge, licA]), /já utilizado/);

    const institution = await scalar("select scholar_provision($1,'essential','Residência de teste',2)", [b]);
    const org = await scalar('select organization_id from scholar_licenses where id=$1', [institution]);
    await db.query("insert into scholar_memberships(organization_id,user_id,role) values($1,$2,'resident')", [org, a]);
    const institutionalWallet = await scalar('insert into scholar_wallets(license_id,user_id,allowance) values($1,$2,1000000) returning id', [institution, a]);
    await db.exec("update scholar_usage set created_at=now()-interval '2 days'");
    for (let index = 0; index < 20; index++) {
      const id = uuid(); await reserve(id, index % 2 ? walletA : institutionalWallet); await db.query('select scholar_settle($1,0,1,0,false)', [id]);
    }
    await db.query('select scholar_recharge($1,$2,1000000)', [uuid(), licA]);
    await assert.rejects(reserve(uuid()), /Limite diário/);
    const institutionalBefore = await scalar('select allowance from scholar_wallets where id=$1', [institutionalWallet]);
    await db.query('select scholar_recharge($1,$2,1000000)', [uuid(), institution]);
    assert.equal(await scalar('select allowance from scholar_wallets where id=$1', [institutionalWallet]), institutionalBefore);
    await db.query("update scholar_licenses set starts_at=now()-interval '2 days',ends_at=now()-interval '1 day' where id=$1", [licB]);
    await assert.rejects(db.query('select scholar_recharge($1,$2,1000000)', [uuid(), licB]), /Licença indisponível/);
    await assert.rejects(db.query('select scholar_recharge($1,$2,-1)', [uuid(), licA]), /Recarga inválida/);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select scholar_recharge($1,$2,1000000)', [uuid(), licA]), /permission denied/);
    console.log('PASS: confirmed refunds, lost-settlement responses, financial envelopes, atomic reservation state, exact balances, cross-wallet daily limits, scoped/idempotent recharges, unchanged expiry and protected credit grants.');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
