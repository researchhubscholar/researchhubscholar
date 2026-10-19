const fs = require('node:fs'), assert = require('node:assert/strict'), vm = require('node:vm'), ts = require('typescript');
const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
require.extensions['.ts'] = (module, file) => module._compile(compile(file), file);
const core = require('../lib/clinical/collection.ts'), summary = require('../lib/clinical/summary.ts'), data = require('../lib/results/data.ts');
const word = require('../lib/results/word.ts');
const tick = () => new Promise(resolve => setImmediate(resolve));
const jsx = (type, props) => ({ type, props });
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const visibleText = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree) : !tree ? '' : Array.isArray(tree) ? tree.map(visibleText).join('') : visibleText(tree.props?.children);
function hooks() {
 const state = [], effects = []; let cursor = 0;
 return { react: {
  useState(initial) { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
  useRef(initial) { const i = cursor++; return state[i] ||= { current: initial }; },
  useMemo: fn => fn(),
  useEffect(effect, deps) { const i = cursor++, old = state[i]; if (!old || deps.some((value, j) => value !== old.deps[j])) effects.push(() => { old?.cleanup?.(); state[i] = { deps, cleanup: effect() }; }); },
 }, render(component) { cursor = 0; const tree = component(); while (effects.length) effects.shift()(); return tree; } };
}
function load(file, react, dependencies, globals = {}) {
 const module = { exports: {} };
 vm.runInNewContext(compile(file), { module, exports: module.exports, crypto: require('node:crypto').webcrypto, AbortController, Date, Error, TextEncoder, window: { confirm: () => true, addEventListener() {}, removeEventListener() {} }, ...globals, require(name) {
  if (name === 'react') return react;
  if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
  if (name in dependencies) return dependencies[name]; throw Error(name);
 } }); return module.exports.default;
}
const protocol = { population: 'Adultos atendidos no serviço', inclusion_criteria: 'Atendimento no período definido', research_question: 'Qual o perfil dos participantes?', variables: 'Idade e condição registrada' };
function harness(initial = null) {
 const parentHooks = hooks(), panelHooks = hooks(), downloads = [], requests = []; let persisted = initial, fail = false;
 const exporter = { workbook: sheets => ({ sheets }), wordDocument: blocks => ({ blocks }), downloadBinary: (file, filename) => downloads.push({ file, filename }) };
 const Panel = load('components/clinical/collection-panel.tsx', panelHooks.react, {
  '@/lib/results/data': data, '@/lib/clinical/collection': core, '@/lib/clinical/summary': summary, '@/lib/results/word': word,
  '@/lib/exports/scientific': { download: (text, mime, filename) => downloads.push({ text, mime, filename }) }, '@/lib/exports/ooxml': exporter,
  '@/components/ai/assistant-panel': { default: 'assistant' },
 });
 const Editor = load('components/results/editor.tsx', parentHooks.react, {
  '@/components/clinical/collection-panel': { default: Panel }, '@/components/clinical/comparison-panel': { default: 'comparison' }, '@/components/clinical/followup-panel': { default: 'followup' }, '@/components/clinical/paired-panel': { default: 'paired' }, '@/lib/clinical/summary': summary,
  './inference-panel': { default: 'inference' }, 'next/link': { default: 'link' }, '@/lib/results/data': data,
  '@/lib/results/figure': {}, '@/lib/exports/ooxml': exporter, '@/lib/exports/scientific': {}, '@/lib/results/word': word,
 }, { fetch: async (url, options) => { requests.push({ url, options }); if (options?.method === 'PUT') { if (fail) return { ok: false, json: async () => ({ error: 'Falha de gravação' }) }; persisted = JSON.parse(options.body).workspace; assert(data.validWorkspace(persisted)); return { ok: true, json: async () => ({ ok: true }) }; } return { ok: true, json: async () => ({ workspace: persisted }) }; } });
 const renderParent = () => parentHooks.render(() => Editor({ projectId: 'project-a', title: 'Estudo de perfil', protocol }));
 const props = () => nodes(renderParent()).find(node => node.type === Panel).props;
 const render = () => panelHooks.render(() => Panel(props()));
 const all = () => nodes(render());
 const button = label => all().find(node => node.type === 'button' && visibleText(node) === label);
 const field = label => { const node = all().find(node => node.type === 'label' && visibleText(node).startsWith(label)); assert(node, label); const input = nodes(node).find(node => ['input', 'textarea', 'select'].includes(node.type)); return input; };
 return { render, renderParent, all, button, field, downloads, requests, workspace: () => props().workspace, fail: value => { fail = value; }, persisted: () => persisted,
  save: () => nodes(renderParent()).find(node => node.type === 'button' && visibleText(node) === 'Salvar resultados').props.onClick() };
}
(async () => {
 const h = harness(); h.renderParent(); await tick();
 h.button('Preparar ficha de coleta').props.onClick();
 assert.equal(h.workspace().collection.population, protocol.population);
 assert.equal(h.button('Adicionar participante').props.disabled, true, 'a draft schema cannot collect records');
 h.field('Período dos registros').props.onChange({ target: { value: 'Ano de 2025' } });
 let ai = h.all().find(node => node.type === 'assistant'); assert.equal(ai.props.feature, 'collection');
 ai.props.onApply({ label: 'Idade', targetField: 'number', content: 'Idade em anos no atendimento definido pelo protocolo' });
 assert.equal(h.workspace().collection.fields.length, 1);
 h.field('Unidade').props.onChange({ target: { value: 'anos' } });
 h.field('Mínimo permitido').props.onChange({ target: { value: '0' } }); h.field('Máximo permitido').props.onChange({ target: { value: '120' } });
 h.button('Concluir revisão da ficha').props.onClick(); assert.equal(h.button('Adicionar participante').props.disabled, false, 'a completed schema must allow the first participant');
 h.button('Adicionar participante').props.onClick();
 h.field('Código de pesquisa').props.onChange({ target: { value: 'P001' } }); h.field('Idade').props.onChange({ target: { value: '40' } }); h.field('Situação').props.onChange({ target: { value: 'included' } });
 h.all().find(node => node.props?.['aria-label'] === 'Ficha do participante').props.onSubmit({ preventDefault() {} });
 assert.equal(h.workspace().dataset.rows[0][0], '40'); assert.equal(h.workspace().collection.records[0].status, 'included');
 h.all().find(node => node.props?.['aria-label'] === 'Conferir P001').props.onClick(); h.field('Idade').props.onChange({ target: { value: '400' } });
 h.all().find(node => node.props?.['aria-label'] === 'Ficha do participante').props.onSubmit({ preventDefault() {} });
 assert.equal(h.workspace().dataset.rows[0][0], '40', 'invalid edits must not change analysis data'); assert(visibleText(h.render()).includes('limites definidos'));
 h.field('Situação').props.onChange({ target: { value: 'excluded' } }); h.field('Motivo da exclusão').props.onChange({ target: { value: core.exclusionReasons[0] } });
 h.all().find(node => node.props?.['aria-label'] === 'Ficha do participante').props.onSubmit({ preventDefault() {} });
 assert.equal(h.workspace().dataset.rows.length, 0); assert.equal(h.workspace().collection.records.length, 1);
 const csv = h.all().find(node => node.type === 'input' && node.props.type === 'file');
 await csv.props.onChange({ target: { files: [{ size: 70, text: async () => 'codigo_pesquisa;Idade\nP002;60\nP003;70' }], value: 'file.csv' } }); await tick();
 h.button('Importar como pendentes').props.onClick(); assert.equal(h.workspace().collection.records.length, 3); assert.equal(h.workspace().dataset.rows.length, 0);
 h.button('Conferir e incluir registros válidos').props.onClick(); assert.equal(h.workspace().dataset.rows.length, 2); assert.deepEqual(h.workspace().dataset.rows.map(row => row[0]), ['60', '70']);
 assert(!JSON.stringify(h.workspace().dataset).includes('400'));
 h.button('Exportar perfil · Word').props.onClick(); assert(h.downloads.at(-1).file.blocks.some(block => block.text === 'Tabela 1  Perfil dos participantes incluídos'));
 h.button('Exportar ficha, coleta e Tabela 1 · Excel').props.onClick(); assert.equal(h.downloads.at(-1).file.sheets.find(sheet => sheet.name === 'Coleta').rows.length, 4);
 h.button('Baixar modelo CSV vazio').props.onClick(); assert(h.downloads.at(-1).text.includes('codigo_pesquisa')); assert(!h.downloads.at(-1).text.includes('P002'));
 h.fail(true); await h.save(); assert(visibleText(h.renderParent()).includes('Falha de gravação')); assert(visibleText(h.renderParent()).includes('Alterações ainda não salvas'));
 h.fail(false); await h.save(); assert(visibleText(h.renderParent()).includes('Pronto para editar')); assert.equal(h.persisted().collection.records.length, 3);
 const payload = JSON.parse(h.requests.filter(request => request.options?.method === 'PUT').at(-1).options.body); assert.equal(payload.project, 'project-a'); assert.equal(payload.workspace.dataset.rows.length, 2);
 const restored = harness(h.persisted()); restored.renderParent(); await tick(); assert.equal(restored.workspace().collection.records.length, 3);
 restored.button('Revisar ficha e critérios').props.onClick(); assert.equal(restored.workspace().collection.records.filter(row => row.status === 'included').length, 0); assert.equal(restored.workspace().dataset.rows.length, 0);
 ai = restored.all().find(node => node.type === 'assistant'); const context = JSON.stringify(ai.props.context); assert(!context.includes('P002')); assert(!context.includes('P001')); assert(!context.includes('400'));
 const blocked = harness({ invalid: 'DATA_MUST_NOT_BE_OVERWRITTEN' }); blocked.renderParent(); await tick(); assert(visibleText(blocked.renderParent()).includes('edição foi bloqueada')); assert(nodes(blocked.renderParent()).find(node => node.type === 'fieldset').props.disabled);
 const privacy = harness(h.persisted()); privacy.renderParent(); await tick(); const file = privacy.all().find(node => node.type === 'input' && node.props.type === 'file'); file.props.onChange({ target: { files: [{ size: 35, text: async () => 'nome;idade\nPessoa;30' }], value: '' } }); await tick(); assert(visibleText(privacy.render()).includes('identificação pessoal'), visibleText(privacy.render()).slice(0,1800)); assert.equal(privacy.workspace().collection.records.length, 3);
 console.log('PASS: actual clinical UI prepares a protocol-linked schema, applies AI variable definitions without patient data, collects/edits/excludes records, maps pending imports, generates the included dataset, exports native files, persists/reloads, recovers failed saves and blocks incompatible stored workspaces.');
})().catch(error => { console.error(error); process.exitCode = 1; });
