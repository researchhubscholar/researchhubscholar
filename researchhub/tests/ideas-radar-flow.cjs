const fs = require('node:fs'), assert = require('node:assert/strict'), vm = require('node:vm'), ts = require('typescript');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText, file);
const generation = require('../lib/ideas/generate.ts'), radar = require('../lib/ideas/radar.ts');
const limits = require('../lib/literature/search-limits.ts');
const translation = require('../lib/ideas/translation.ts');
const strategy = require('../lib/literature/query-strategy.ts');
const suggestions = require('../lib/literature/suggestion-query.ts');
const tick = () => new Promise(resolve => setImmediate(resolve));
let presentation;
const jsx = (type, props) => presentation.jsx(type, props);
const copy = source => presentation.copy(source);
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const deferred = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; };
function hooks() {
 const state = [], effects = []; let cursor = 0;
 return { react: {
  useState(initial) { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
  useRef(initial) { const i = cursor++; return state[i] ||= { current: initial }; },
  useMemo: calculate => calculate(),
  useEffect(effect, deps) { const i = cursor++, old = state[i]; if (!old || !deps || deps.some((value, index) => value !== old.deps[index])) effects.push(() => { old?.cleanup?.(); state[i] = { deps, cleanup: effect() }; }); },
 }, render(component, offset = 0) { cursor = offset; const tree = component(); while (effects.length) effects.shift()(); return tree; } };
}
function ideasHarness(url = "https://local/ideias") {
 const h = hooks(), writes = [], destinations = [], events = [], pending = [];
 const translations = [], generations = [];
 const library = { userId: 'owner-a', loading: false, articles: [], notes: {}, projects: [] };
 let authOwner = 'owner-a';
 const client = { auth: { getUser: async () => ({ data: { user: { id: authOwner } }, error: null }) }, from(table) {
  return { select() { return { eq() { return { maybeSingle: async () => ({ data: null }) }; } }; }, insert(payload) { assert.equal(table, 'idea_versions'); writes.push(payload); events.push('insert'); const work = deferred(); pending.push(work); return work.promise; } };
 } };
 const module = { exports: {} };
 vm.runInNewContext(compile(fs.readFileSync('app/ideias/page.tsx', 'utf8')), { module, exports: module.exports, URL, URLSearchParams, crypto: require('node:crypto').webcrypto, fetch: async () => ({ ok: true, json: async () => ({ enabled: true }) }), window: { location: { href: url }, history: { replaceState() {} }, confirm: () => true, setTimeout() {} }, require(name) { const localized = presentation.dependency(name); if(localized) return localized;
  if (name === 'react') return h.react;
  if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
  if (name === 'next/navigation') return { useRouter: () => ({ push: href => { events.push('navigate'); destinations.push(href); } }) };
  if (name === '@/lib/ideas/generate') return generation;
  if (name === '@/lib/ideas/radar') return radar;
  if (name === '@/lib/research/study-format') return {studyFormatText: value => value};
  if (name === '@/lib/literature/search-limits') return limits;
  if (name === '@/lib/ideas/history') return { historyError: () => 'Falha no salvamento.' };
  if (name === '@/lib/literature/use-library') return { useLibrary: () => library };
  if (name === '@/lib/supabase/browser') return { supabaseBrowser: () => client };
  if (name === '@/lib/ideas/translation') return translation;
  if (name === '@/lib/ai/client-request') return { postAI: async (path, body) => {
   if (path === '/api/ai/ideas') {
    generations.push(body.context);
    const [proposal] = body.ideas;
    return { data: { ideas: [1, 2, 3].map(id => ({ ...proposal, id: String(id) })) } };
   }
   assert.equal(path, '/api/ai/assist'); assert.equal(body.feature, 'idea_translation');
   translations.push(body);
   return { data: { mode: 'live', output: { recommendations: [{ content: JSON.stringify({ ...body.context.proposal, title: 'Translated title' }) }] } } };
  } };
  if (name === '@/lib/ideas/transfer') return { transferKey: () => '' };
  if (name.startsWith('@/components/') || name === 'next/link') return { default: name };
  throw Error(name);
 } });
 const render = () => h.render(() => module.exports.default());
 const all = () => nodes(render());
 const idea = { ...generation.generate(generation.initial, [])[0], radar: '(burnout OR occupational stress) AND (nurses OR physicians)' };
 const row = { id: 'version-a', series_id: 'series-a', context: { ...generation.initial }, proposal: idea, evidence_signature: generation.referenceSignature([]), reason: 'Teste' };
 return { renderCard: card => h.render(() => card.type(card.props), 300), library, translations, generations, writes, destinations, events, pending, render, all, row, setAuth: owner => { authOwner = owner; }, restore() { all().find(n => n.type === '@/components/ideas/history').props.restore(row); }, card: () => all().find(n => typeof n.type === 'function' && n.type.name === 'IdeaCard') };
}
function radarHarness(query='tema=burnout&origem=ideias') {
 const h = hooks(), requests = [], aiRequests = [];
 const module = { exports: {} };
 const source = fs.readFileSync('app/descobrir/page.tsx', 'utf8').replace('function DiscoverContent()', 'export function DiscoverContent()');
 vm.runInNewContext(compile(source), { module, exports: module.exports, AbortSignal, URLSearchParams, sessionStorage: {getItem: () => "hypertension AND exercise", removeItem() {}}, window: { scrollTo() {} }, fetch(path, options) { const work = deferred(); requests.push({ path, options, ...work }); return work.promise; }, require(name) { const localized = presentation.dependency(name); if(localized) return localized;
  if (name === 'react') return h.react;
  if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
  if (name === 'next/navigation') return { useSearchParams: () => new URLSearchParams(query) };
  if (name === '@/lib/telemetry/journey') return { trackRadarAttempt: () => () => {} };
  if (name === '@/lib/literature/search-limits') return limits;
  if (name === '@/lib/literature/use-library') return { useLibrary: () => ({ userId: null, articles: [], projects: [] }) };
  if (name === '@/lib/literature/use-open-access') return { useOpenAccess: () => ({ results: {}, loading: new Set() }) };
  if (name === '@/lib/supabase/browser') return { supabaseBrowser: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) };
  if (name === '@/lib/literature/query-strategy') return strategy;
  if (name === '@/components/radar/search-insights') return { useSearchTerms: () => [], SearchDeepening: 'SearchDeepening' };
  if (name === '@/lib/literature/suggestion-query') return suggestions;
  if (name === '@/lib/ai/client-request') return { postAI(path, body) {
   const work = deferred(); aiRequests.push({ path, body, ...work }); return work.promise;
  } };
  if (name === '@/lib/literature/types' || name === '@/lib/literature/result-export') return {};
  if (name.startsWith('@/components/') || name === 'next/link') return { default: name };
  throw Error(name);
 } });
 const render = () => h.render(() => module.exports.DiscoverContent());
 const all = () => nodes(render());
 return { requests, aiRequests, render, all, dialog: () => all().find(n => n.type === '@/components/ai/loading-dialog'), assistant: () => all().find(n => n.type === '@/components/ai/assistant-panel'), search: (mode = 'manual') => all().find(n => n.type === 'form' && n.props.className.includes('radar-search-panel')).props.onSubmit({ preventDefault() {}, nativeEvent: { submitter: { getAttribute: () => mode } } }) };
}
(async () => {
 for(const locale of ['pt-BR','es']) {
 presentation=require('./i18n-test-support.cjs').forLocale(locale);
 const generated = ideasHarness(); generated.render(); await tick();
 const generationForm = () => generated.all().find(n => n.type === 'form' && n.props.className.includes('ideas-main-form'));
 for (const field of nodes(generationForm()).filter(n => n.type?.name === 'Text' && n.props.required)) field.props.change('Cardiologia ambulatorial');
 const generate = async () => { generationForm().props.onSubmit({ preventDefault() {} }); await tick(); };
 const cards = () => generated.all().filter(n => n.type?.name === 'IdeaCard');
 const expanded = () => cards().map(n => n.props.expanded);
 const toggle = index => {
  const card = cards()[index];
  nodes(card.type(card.props)).find(n => n.type === 'button' && n.props.className === 'idea-proposal-heading').props.onClick();
 };
 await generate();
 assert.deepEqual(expanded(), [false, false, false]);
 toggle(0); toggle(1);
 assert.deepEqual(expanded(), [true, true, false]);
 toggle(0);
 assert.deepEqual(expanded(), [false, true, false]);
 await generate();
 assert.deepEqual(expanded(), [false, false, false]);

 const h = ideasHarness(); h.render(); await tick(); h.restore();
 const action = h.card().props.onRadar;
 action(); action(); await tick();
 assert.equal(h.writes.length, 1, 'double clicks must not save two versions');
 assert.equal(h.destinations.length, 0, 'navigation must wait for the database');
 assert.equal(h.writes[0].owner_id, 'owner-a'); assert.equal(h.writes[0].series_id, 'series-a');
 assert.equal(h.writes[0].proposal, h.row.proposal); assert.equal(h.writes[0].context, h.row.context);
 assert.match(h.writes[0].reason, /automático/);
 const card = h.card(); const busyButton = nodes(card.type(card.props)).find(n => n.type === 'button' && n.props.onClick === card.props.onRadar);
 assert(busyButton.props.disabled);
 h.pending[0].resolve({ error: null }); await tick();
 assert.deepEqual(h.events, ['insert', 'navigate']);
 const target = new URL(h.destinations[0], 'https://local'); assert.equal(target.pathname, '/descobrir'); assert.equal(target.searchParams.get('tema'), h.row.proposal.radar);
 h.card().props.onChange('title', 'Proposta editada'); h.card().props.onRadar(); await tick();
 assert.equal(h.writes[1].proposal.title, 'Proposta editada', 'automatic saves must contain edits');
 h.pending[1].resolve({ error: { code: 'UNAVAILABLE' } }); await tick();
 assert.equal(h.destinations.length, 1); assert(JSON.stringify(h.render()).includes(copy('A proposta não foi salva e o Radar não foi aberto. Falha no salvamento.')));
 h.card().props.onRadar(); await tick(); h.pending[2].resolve({ error: null }); await tick(); assert.equal(h.destinations.length, 2, 'retry must recover after a save failure');
 const changed = ideasHarness(); changed.render(); await tick(); changed.restore(); changed.setAuth('owner-b'); changed.card().props.onRadar(); await tick(); assert.equal(changed.writes.length, 0); assert.equal(changed.destinations.length, 0);
 const stale = ideasHarness(); stale.render(); await tick(); stale.restore(); stale.all().find(n => typeof n.type === 'function' && n.props.label === copy('Sua especialidade ou área')).props.change('Outra área'); stale.card().props.onRadar(); await tick(); assert.equal(stale.writes.length, 0);
 const account = ideasHarness(); account.render(); await tick(); account.restore(); account.card().props.onRadar(); await tick(); account.library.userId = 'owner-b'; account.render(); account.pending[0].resolve({ error: null }); await tick(); assert.equal(account.destinations.length, 0, 'account switches must prevent stale navigation');

 const auto=radarHarness('origem=ideias&busca=test'); auto.render(); auto.render(); assert.equal(auto.requests.length,1); assert.equal(JSON.parse(auto.requests[0].options.body).topic,'hypertension AND exercise'); auto.requests[0].resolve({ok:false,status:500,json:async()=>({error:'Teste'})}); await tick();
 const handoff=radarHarness('tema=hypertension+AND+exercise&origem=assistente');handoff.render();assert.equal(handoff.requests.length,0,'assistant handoff must not auto-search');assert.equal(handoff.all().find(n=>n.props?.['aria-label']===copy('Tema da busca')).props.value,'hypertension AND exercise');assert(handoff.all().some(n=>n.type==='select'&&n.props.value==='all'));assert.equal(handoff.all().find(n=>n.props?.['aria-label']===copy('Idioma da busca')).props.value,'en');
 const translated = ideasHarness(); translated.render(); await tick(); translated.restore();
 const original = translated.card().props.idea;
 const translationPromise = translated.card().props.onTranslate('en'); await tick();
 assert.equal(translated.translations[0].context.proposal.radar, undefined);
 assert.equal(translated.writes[0].proposal.title, original.title);
 assert.equal(translated.writes[0].proposal.radar, original.radar);
 assert.equal(translated.writes[0].proposal.references, original.references);
 assert.equal(translated.writes[0].proposal.translations.en.title, 'Translated title');
 translated.pending[0].resolve({ error: null }); assert.equal(await translationPromise, true);
 assert.equal(translated.card().props.idea.translations.en.title, 'Translated title');
 translated.card().props.onChange('title', 'Edited');
 assert.equal(translated.card().props.idea.translations, undefined);

 const display = ideasHarness(); display.render(); await tick(); display.restore();
 const translatedCard = display.card();
 translatedCard.props.idea.translations = { en: { title: 'Translated title' } };
 const cardNodes = () => nodes(display.renderCard(translatedCard));
 cardNodes().find(n => n.type === 'select' && /-language$/.test(n.props.id || '')).props.onChange({ target: { value: 'en' } });
 await tick();
 const translatedNodes = cardNodes();
 assert(translatedNodes.some(n => n.props.children === 'Translated title'));
 for (const onClick of [translatedCard.props.onRefine, translatedCard.props.onRadar, translatedCard.props.onTransfer]) {
  assert(translatedNodes.some(n => n.type === 'button' && n.props.onClick === onClick), 'main actions stay visible after translation');
 }

 const natural = radarHarness('tema=cancer+coloretal'); const naturalSearch = natural.search('');
 assert.equal(natural.aiRequests.length, 1); assert.equal(natural.requests.length, 0);
 assert.equal(natural.aiRequests[0].body.context.searchGoal, 'exploratory_broad');
 natural.aiRequests[0].resolve({ data: { mode: 'live', output: { recommendations: [
  { targetField: 'pubmedQuery', confidence: 'media', content: '("Colorectal Neoplasms"[MeSH Terms] OR colorectal cancer OR colorectal carcinoma)' },
  { targetField: 'synonyms', confidence: 'alta', content: 'colon cancer' },
 ] } } }); await tick();
 const refined = JSON.parse(natural.requests[0].options.body);
 assert.match(refined.topic, /colorectal carcinoma/);
 assert.equal(refined.period, '5');
 natural.requests[0].resolve({ ok: false, status: 502, json: async () => ({ error: 'Fonte indisponível' }) }); await naturalSearch;
 assert.equal(natural.requests.length, 1, 'failed refined search must not silently run the raw query');

 const unavailable = radarHarness('tema=cancer+coloretal'); const failedRefinement = unavailable.search('');
 unavailable.aiRequests[0].reject(new Error('IA indisponível')); await failedRefinement;
 assert.equal(unavailable.requests.length, 0);
 assert(JSON.stringify(unavailable.render()).includes(locale === 'es' ? 'No se pudo refinar' : 'Não foi possível refinar'));

 const exact = radarHarness('tema=hypertension+AND+exercise');
 const exactSearch = exact.search('');
 assert.equal(exact.aiRequests.length, 0);
 assert.equal(JSON.parse(exact.requests[0].options.body).topic, 'hypertension AND exercise');
 exact.requests[0].resolve({ ok: false, status: 502, json: async () => ({ error: 'Fonte indisponível' }) }); await exactSearch;

 const r = radarHarness(); assert.equal(r.dialog().props.open, false); assert.equal(r.assistant(), undefined);
 const search = r.search(); assert.equal(r.dialog().props.open, true); assert.equal(r.aiRequests.length, 0); assert(!r.dialog().props.statusText.includes('modelo'));
 assert(r.requests[0].options.signal instanceof AbortSignal);
 r.requests[0].resolve({ ok: false, status: 500, json: async () => ({ error: 'Fonte indisponível' }) }); await search; assert.equal(r.dialog().props.open, false); assert(JSON.stringify(r.render()).includes('Fonte indisponível'));
 const retry = r.search(); r.requests[1].resolve({ ok: false, status: 422, json: async () => ({ code: 'TERMINOLOGY_REVIEW_REQUIRED', strategy: { unresolvedTerms: ['microplasticos'], concepts: [] } }) }); await retry;
 assert.equal(r.dialog().props.open, false); assert(r.all().some(n => n.props?.['aria-label'] === copy('Revisão de conceitos da busca')));
 const timeout = r.search(); r.requests[2].reject(new DOMException('A consulta demorou', 'TimeoutError')); await timeout; assert.equal(r.dialog().props.open, false);
 const lookup = r.all().find(n => n.type === 'form' && !n.props.className?.includes('radar-search-panel') && n.props.className?.includes('flex flex-wrap')).props.onSubmit({ preventDefault() {} });
 assert.equal(r.dialog().props.open, true); assert.equal(r.dialog().props.title, copy('Buscando o artigo'));
 r.requests[3].resolve({ ok: false, json: async () => ({ error: 'Não encontrado' }) }); await lookup; assert.equal(r.dialog().props.open, false);
 const success = r.search(); const payload = JSON.parse(r.requests[4].options.body);
 const result = { topic: payload.topic, filters: { period: payload.period, studyType: payload.studyType, mesh: '', population: '', outcome: '', operator: 'AND', language: 'auto', searchTerm: 'burnout', crossrefQuery: 'burnout', endDate: '2026-10-19' }, strategy: { interpreted: 'burnout', pubmedQuery: '(burnout)', mode: 'advanced', language: 'advanced', warnings: [], concepts: [], manualTranslations: [] }, sources: { pubmed: { total: 0, recent: 0, systematicReviews: 0, clinicalTrials: 0 }, crossref: { total: 0 } }, articles: [], timeline: [], signals: { breadth: 'scarce', trend: 'insufficient', recentRatio: 0 }, methodology: 'Teste' };
 r.requests[4].resolve({ ok: true, json: async () => result }); await success; assert.equal(r.dialog().props.open, false); r.render();
 const initialHandoff = () => r.all().find(n => n.props.href?.pathname === '/ideias' && n.props.href.query?.gerar === 'radar').props.href.query;
 const visibleQuery = () => r.all().find(n => n.type === 'details' && /Consulta (usada|utilizada)/.test(n.props['aria-label'] || ''));
 assert(JSON.stringify(visibleQuery()).includes('burnout'));
 assert.equal(initialHandoff().recorte, undefined);
 const deepening = () => r.all().find(n => n.type === 'SearchDeepening').props;
 const firstCut = 'Residentes de primeiro ano';
 const refinedQuery = '(burnout) AND "first year residents"[Title/Abstract]';
 deepening().onSearch(refinedQuery, firstCut);
 assert.equal(initialHandoff().recorte, undefined, 'pending narrowing cannot change active handoff');
 assert.equal(JSON.parse(r.requests[5].options.body).topic, refinedQuery);
 r.requests[5].resolve({ ok: true, json: async () => ({...result, topic: refinedQuery, filters: {...result.filters, searchTerm: refinedQuery}, strategy: {...result.strategy, pubmedQuery: refinedQuery}}) }); await tick();
 assert(JSON.stringify(visibleQuery()).includes('first year residents'));
 const handoffQuery = initialHandoff();
 assert.equal(handoffQuery.tema, 'burnout');
 assert.equal(handoffQuery.recorte, firstCut);
 const received = ideasHarness('https://local/ideias?' + new URLSearchParams(handoffQuery));
 received.render(); await tick(); received.render(); await tick();
 assert.equal(received.generations.length, 1);
 assert(received.generations[0].interest.includes(firstCut));
 deepening().onReset();
 assert.equal(initialHandoff().recorte, undefined);
 assert(!JSON.stringify(visibleQuery()).includes('first year residents'));
 const broaden = r.all().find(n => n.type === 'button' && JSON.stringify(n.props.children).includes(copy('Ampliar os filtros'))); broaden.props.onClick();
 const broadSearch = r.search(), broadPayload = JSON.parse(r.requests[6].options.body); assert.equal(broadPayload.period, 'all'); assert.equal(broadPayload.studyType, 'all'); assert.equal(broadPayload.topic, 'burnout');
 r.requests[6].resolve({ ok: false, json: async () => ({ error: 'Encerrar' }) }); await broadSearch;
 const page = fs.readFileSync('app/meu-trabalho/page.tsx', 'utf8'); assert.match(page, /window\.location\.assign\(id \?[^;]+: "\/ideias"/);
 for (const file of ['app/dashboard/page.tsx', 'app/documentos/page.tsx', 'app/resultados/page.tsx', 'app/manuscrito/page.tsx']) assert(!fs.readFileSync(file, 'utf8').includes('/meu-trabalho?novo=1'));
 console.log(locale+' PASS: idea autosave before Radar, edits, duplicate clicks, failure/retry, account changes, search/lookup loading dialogs, terminology/timeouts, visible AI preparation, broader filters and new-project routing.');
 }
})().catch(error => { console.error(error); process.exitCode = 1; });
