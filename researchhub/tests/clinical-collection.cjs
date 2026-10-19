const fs = require('node:fs'), assert = require('node:assert/strict'), vm = require('node:vm'), ts = require('typescript');
const compile = (source, jsx = false) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: jsx ? ts.JsxEmit.ReactJSX : undefined } }).outputText;
require.extensions['.ts'] = (module, file) => module._compile(compile(fs.readFileSync(file, 'utf8')), file);
const collection = require('../lib/clinical/collection.ts'), summary = require('../lib/clinical/summary.ts');
const data = require('../lib/results/data.ts'), ai = require('../lib/ai/assist.ts');
const { resultsWordBlocks } = require('../lib/results/word.ts');
const { manuscriptWordBlocks } = require('../lib/projects/manuscript-export.ts');
const { workbook } = require('../lib/exports/ooxml.ts');
const clone = value => JSON.parse(JSON.stringify(value));
const protocol = { research_question: 'Qual o perfil dos participantes do serviço?', population: 'Adultos do serviço', inclusion_criteria: 'Atendimento no período definido', exclusion_criteria: 'Fora do período', variables: 'Idade; condição registrada', primary_outcome: 'Perfil clínico', methods: 'Revisão de registros sem identificação pessoal' };
function fixture() {
 const c = collection.createCollection(protocol); c.period = '2025';
 c.fields = [
  { ...collection.blankField('v_age', 'Idade'), kind: 'number', unit: 'anos', minimum: 0, maximum: 100 },
  { ...collection.blankField('v_group', 'Grupo'), kind: 'category', options: ['0', '1'] },
  { ...collection.blankField('v_date', 'Data do evento'), kind: 'date' },
 ];
 c.records = [
  { code: 'P001', status: 'included', reason: '', values: { v_age: '40', v_group: '1', v_date: '2025-01-01' } },
  { code: 'P002', status: 'included', reason: '', values: { v_age: '60', v_group: '0', v_date: '2025-12-31' } },
  { code: 'P003', status: 'included', reason: '', values: { v_age: '', v_group: '', v_date: '' } },
  { code: 'P004', status: 'excluded', reason: collection.exclusionReasons[0], values: { v_age: '99', v_group: '1', v_date: '' } },
  { code: 'P005', status: 'pending', reason: '', values: { v_age: '120', v_group: 'desconhecido', v_date: '2025-02-30' } },
 ];
 return c;
}
const c = fixture(); assert(collection.validCollection(c));
const w = summary.syncCollection(data.emptyResults, c); assert(data.validWorkspace(w));
assert.deepEqual(summary.selectionCounts(c), { total: 5, included: 3, excluded: 1, pending: 1 });
assert.deepEqual(w.dataset.columns, ['Idade', 'Grupo', 'Data do evento']); assert.equal(w.dataset.rows.length, 3);
assert(!w.dataset.columns.includes('codigo_pesquisa')); assert(!JSON.stringify(w.dataset).includes('99'));
const rows = summary.profileRows(c);
assert.match(rows.find(r => r[0] === 'Idade (anos)')[1], /Média 50; DP 14,14; mediana 50/);
assert.deepEqual(rows.find(r => r[0] === 'Idade (anos)').slice(2), [2, 1]);
assert.equal(rows.find(r => r[0] === '  0')[1], '1 (50%)'); assert.equal(rows.find(r => r[0] === '  1')[1], '1 (50%)');
assert.equal(rows.find(r => r[0] === 'Data do evento')[2], 2);
assert(collection.recordIssues(c, c.records[4]).some(v => /limites/.test(v)));
assert(collection.recordIssues(c, c.records[4]).some(v => /categoria/.test(v)));
assert(collection.recordIssues(c, c.records[4]).some(v => /data válida/.test(v)));
assert.throws(() => collection.putRecord(c, { ...c.records[4], status: 'included' }, 'P005'), /confira|escolha|válida/);
assert.throws(() => collection.putRecord(c, { ...c.records[0], code: 'p001' }), /repetido/);
assert.throws(() => collection.putRecord(c, { ...c.records[4], code: '123456' }), /código/);
const zero = collection.putRecord(c, { code: 'P006', status: 'included', reason: '', values: { v_age: '0', v_group: '0' } });
assert.equal(zero.records.at(-1).values.v_age, '0'); assert.equal(zero.history.at(-1).code, 'P006'); assert(collection.validCollection(zero));
const required = clone(c); required.fields[0].required = true; assert(!collection.validCollection(required));
assert.throws(() => collection.putRecord(required, { code: 'P006', status: 'included', reason: '', values: {} }), /ausente/);
assert.throws(() => collection.putRecord(c, { code: 'P006', status: 'excluded', reason: '', values: {} }), /motivo/);
assert.throws(() => collection.putRecord(c, { code: 'P006', status: 'pending', reason: '', values: { v_group: 'person@example.com' } }), /identificador/);
for (const mutate of [x => { x.records.push(x.records[0]); }, x => { x.fields[0].label = 'CPF'; }, x => { x.fields[0].key = 'constructor'; }, x => { x.records[0].values.v_age = 'abc'; }, x => { x.records[0].values.v_extra = '1'; }, x => { x.records[0].code = undefined; }, x => { x.records[0].values = null; }, x => { x.fields[1].options = ['Sim', 'sim']; }, x => { x.history = [{ at: 'not a date', action: '', code: '' }]; }]) {
 const bad = clone(c); mutate(bad); assert.equal(collection.validCollection(bad), false); assert.equal(data.validWorkspace({ ...w, collection: bad }), false);
}
assert.equal(data.validWorkspace({ ...w, dataset: { ...w.dataset, rows: [...w.dataset.rows, ['900', '0', '']] } }), false, 'saved analysis cannot include excluded or pending rows');
assert.equal(data.validWorkspace({ ...w, collection: null }), false);
assert.equal(data.validWorkspace(data.emptyResults), true, 'legacy result workspaces remain compatible');
const analyzed = { ...w, analysis: { kind: 'pearson', x: 'Idade', y: 'Grupo', independent: true } };
assert(summary.syncCollection(analyzed, { ...c, period: '2025, confirmado' }).analysis);
assert.equal(summary.syncCollection(analyzed, collection.putRecord(c, { ...c.records[0], values: { ...c.records[0].values, v_age: '41' } }, 'P001')).analysis, undefined);
const empty = { ...c, records: [] }; assert(summary.profileRows(empty).some(row => row[1] === 'Sem dados'));
assert(!JSON.stringify(summary.profileRows(empty)).includes('NaN')); assert(!JSON.stringify(summary.profileRows(empty)).includes('Infinity'));
const limit = { ...empty, history: Array.from({ length: 100 }, () => ({ at: new Date().toISOString(), action: 'Teste', code: '' })) }; assert.equal(collection.addHistory(limit, 'Nova ação').history.length, 100);

const imported = data.parseCsv('codigo_pesquisa;Idade;Grupo;Data do evento\nP010;0;0;2025-01-01\nP011;N/A;1;\nP012;Não registrado;nao informado;');
const preview = collection.importRecords(empty, imported, 0, { v_age: 1, v_group: 2, v_date: 3 });
assert(preview.records.every(row => row.status === 'pending')); assert.equal(preview.records[0].values.v_age, '0'); assert.equal(preview.records[0].values.v_group, '0'); assert.equal(preview.records[1].values.v_age, ''); assert.equal(preview.records[2].values.v_group, '');
assert(collection.validCollection(preview)); assert.equal(collection.collectionDataset(preview).rows.length, 0);
assert.throws(() => collection.importRecords(empty, imported, 0, { v_age: 1, v_group: 1 }), /somente um/);
assert.throws(() => collection.importRecords(empty, imported, -1, {}), /coluna/);
assert.throws(() => collection.importRecords(c, data.parseCsv('codigo_pesquisa;Idade\nP001;30'), 0, { v_age: 1 }), /repetido/);
for (const csv of ['nome;Idade\nPessoa;30', 'codigo_pesquisa;CPF\nP001;111.222.333-44', 'codigo_pesquisa;contato\nP001;pessoa@example.com', 'codigo_pesquisa;numero_prontuario\nP001;124']) assert.throws(() => collection.assertImportPrivacy(data.parseCsv(csv)), /identifica/);
const invalidDate = collection.importRecords(empty, data.parseCsv('codigo_pesquisa;Data do evento\nP020;2025-02-30'), 0, { v_date: 1 }); assert(collection.validCollection(invalidDate)); assert(collection.recordIssues(invalidDate, invalidDate.records[0]).length);
const yesNo = clone(empty); yesNo.fields[1].options = ['Sim', 'Não']; const no = collection.importRecords(yesNo, data.parseCsv('codigo_pesquisa;Grupo\nP021;nao'), 0, { v_group: 1 }); assert.equal(no.records[0].values.v_group, 'Não');

const blocks = resultsWordBlocks(w); assert(blocks.some(block => block.text === 'Tabela 1  Perfil dos participantes incluídos'));
assert.deepEqual(blocks.find(block => block.table)?.table, rows);
assert(!JSON.stringify(blocks).includes('P001'), 'Word includes aggregates, not participant codes or individual rows');
const manuscript = manuscriptWordBlocks({ title: 'Estudo', subtitle: '', authors: '', affiliations: '', keywords: '', references: [], sections: [{ section_key: 'results', heading: 'Resultados', content: '' }] }, w);
assert(manuscript.some(block => block.text === 'Tabela 1  Perfil dos participantes incluídos'));
const sheets = summary.collectionWorkbook(c); assert(sheets.some(sheet => sheet.name === 'Coleta' && sheet.rows.length === 6));
assert.throws(() => collection.assertAnalysisKinds({Idade:'number',Grupo:'category'}, {kind:'pearson',x:'Idade',y:'Grupo',independent:true}), /tipos definidos/);
assert.doesNotThrow(() => collection.assertAnalysisKinds({Idade:'number',Grupo:'category'}, {kind:'welch',x:'Idade',y:'Grupo',independent:true}));
const badAnalysis = resultsWordBlocks({...w,analysis:{kind:'pearson',x:'Idade',y:'Grupo',independent:true}});
assert(badAnalysis.some(block => block.text?.includes('Análise estatística não incluída')));
assert.equal(summary.syncCollection({...w,figure:{...w.figure,column:'Grupo',kind:'histogram'}},c).figure.kind,'bar');
const bytes = workbook(sheets); assert.equal(new DataView(bytes.buffer).getUint32(0, true), 0x04034b50);
const request = ai.validateAssistRequest({ feature: 'collection', context: { protocol: { ...protocol, records: [{ secret: 'PATIENT_SECRET' }] }, fields: [{ label: 'Idade', kind: 'number', definition: 'anos', values: ['PATIENT_SECRET'] }], records: c.records, dataset: { secret: 'PATIENT_SECRET' } } });
assert.equal(ai.ledgerFeature.collection, 'protocol'); assert(!JSON.stringify(request.context).includes('PATIENT_SECRET')); assert(!JSON.stringify(request.context).includes('P001'));
assert(ai.assistantPrompt('collection', request.context).includes('Não solicite nem invente dados de pacientes'));
assert.equal(ai.simulatedOutput('collection').recommendations[0].targetField, '');

function handler(dependencies) { const module = { exports: {} }; vm.runInNewContext(compile(fs.readFileSync('app/api/results/route.ts', 'utf8')), { module, exports: module.exports, require: name => dependencies[name], Response, TextEncoder }); return module.exports; }
(async () => {
 const stored = new Map(), queries = []; let owner = 'owner-a';
 const db = { auth: { getUser: async () => ({ data: { user: owner ? { id: owner } : null } }) }, from(table) {
  const filters = {}; const chain = { select() { return chain; }, eq(key, value) { filters[key] = value; return chain; }, async maybeSingle() {
   queries.push({ table, ...filters });
   if (table === 'research_projects') return { data: filters.owner_id === 'owner-a' && filters.id === 'project-a' ? { id: 'project-a' } : null };
   const row = stored.get(filters.project_id); return { data: row?.owner_id === filters.owner_id ? row : null };
  }, async upsert(row) { stored.set(row.project_id, row); return { error: null }; } }; return chain;
 } };
 const api = handler({ 'next/server': { NextResponse: { json: (body, init) => new Response(JSON.stringify(body), { status: init?.status || 200 }) } }, '@/lib/supabase/server': { supabaseServer: async () => db }, '@/lib/results/data': data });
 const put = workspace => api.PUT({ text: async () => JSON.stringify({ project: 'project-a', workspace }) });
 assert.equal((await put(w)).status, 200);
 const response = await api.GET({ nextUrl: new URL('https://local/api/results?project=project-a') }); assert.deepEqual((await response.json()).workspace, clone(w));
 assert(queries.some(query => query.table === 'research_projects' && query.owner_id === 'owner-a'));
 owner = 'owner-b'; assert.equal((await put(w)).status, 404); assert.equal((await (await api.GET({ nextUrl: new URL('https://local/api/results?project=project-a') })).json()).workspace, null);
 owner = null; assert.equal((await put(w)).status, 401);
 owner = 'owner-a'; assert.equal((await api.PUT({ text: async () => 'null' })).status, 400);
 assert.equal((await api.PUT({ text: async () => JSON.stringify({ padding: 'á'.repeat(800000) }) })).status, 413, 'body limits count UTF-8 bytes');
 assert.equal((await put({ ...w, dataset: { columns: ['Idade'], rows: [['999']] } })).status, 400);
 console.log('PASS: clinical collection, selection, missing/zero/category/date handling, duplicate/identifier rejection, pending imports, typed Table 1 denominators, stale-analysis invalidation, private persistence, AI data minimization and native manuscript/Excel exports.');
 if (process.env.CLINICAL_QA_FIXTURE) fs.writeFileSync(process.env.CLINICAL_QA_FIXTURE, JSON.stringify({ workspace: w, protocol }));
})().catch(error => { console.error(error); process.exitCode = 1; });
