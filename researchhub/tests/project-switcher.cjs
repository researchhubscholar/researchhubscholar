const fs = require('node:fs'), assert = require('node:assert/strict'), vm = require('node:vm'), ts = require('typescript');
const tick = () => new Promise(resolve => setImmediate(resolve));
const source = ts.transpileModule(fs.readFileSync('components/projects/project-switcher.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function harness() {
  const state = [], pending = [], queries = [], selected = [];
  let cursor = 0, saves = 0;
  const props = { ownerId: 'owner-a', projectId: 'a', title: 'Projeto atual', busy: false, dirty: false, onSelect: id => selected.push(id), onSave: () => { saves++; } };
  const react = {
    useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }]; },
    useEffect(effect, deps) { const index = cursor++, old = state[index]; if (!old || deps.some((value, i) => value !== old.deps[i])) pending.push(() => { old?.cleanup?.(); state[index] = { deps, cleanup: effect() }; }); },
  };
  const client = { from(table) { assert.equal(table, 'research_projects'); return { select(fields) { assert.equal(fields, 'id,title,theme'); return { eq(column, ownerId) { assert.equal(column, 'owner_id'); return { order(column, options) { assert.equal(column, 'updated_at'); assert.equal(options.ascending, false); return new Promise(resolve => queries.push({ ownerId, resolve })); } }; } }; } }; } };
  const module = { exports: {} }, jsx = (type, props) => ({ type, props });
  vm.runInNewContext(source, { module, exports: module.exports, require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '@/lib/supabase/browser') return { supabaseBrowser: () => client };
    throw Error(name);
  } });
  const render = () => { cursor = 0; const tree = module.exports.default(props); while (pending.length) pending.shift()(); return tree; };
  const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
  return { props, queries, selected, render, nodes, select: () => nodes(render()).find(node => node.type === 'select'), saves: () => saves };
}
(async () => {
  const h = harness();
  assert(h.select().props.disabled); assert.equal(h.queries[0].ownerId, 'owner-a');
  h.queries[0].resolve({ data: [{ id: 'a', title: 'Projeto antigo' }, { id: 'b', title: 'Outro projeto salvo' }], error: null });
  await tick();
  const select = h.select(); assert.equal(select.props.disabled, false); assert.equal(select.props.value, 'a');
  select.props.onChange({ target: { value: 'b' } }); assert.deepEqual(h.selected, ['b']);
  select.props.onChange({ target: { value: 'foreign' } }); select.props.onChange({ target: { value: 'a' } }); assert.deepEqual(h.selected, ['b']);
  h.props.busy = true; h.select().props.onChange({ target: { value: 'b' } });
  h.nodes(h.render()).find(node => node.type === 'button' && String(node.props.children).includes('Novo projeto')).props.onClick();
  assert.deepEqual(h.selected, ['b'], 'Saving must block both switching and starting a new project');
  h.props.busy = false; h.props.dirty = true;
  h.nodes(h.render()).find(node => node.type === 'button' && node.props.children === 'Salvar antes de trocar').props.onClick(); assert.equal(h.saves(), 1);
  h.nodes(h.render()).find(node => node.type === 'button' && String(node.props.children).includes('Novo projeto')).props.onClick(); assert.deepEqual(h.selected, ['b', null]);
  assert(JSON.stringify(h.render()).includes('Há alterações não salvas'));

  const race = harness(); race.render();
  race.props.ownerId = 'owner-b'; race.props.projectId = null; race.props.title = ''; race.render();
  race.queries[0].resolve({ data: [{ id: 'private-a', title: 'PRIVATE OWNER A' }], error: null }); await tick();
  assert(!JSON.stringify(race.render()).includes('PRIVATE OWNER A'));
  assert(race.select().props.disabled);
  race.queries[1].resolve({ data: [{ id: 'private-b', title: 'Projeto B' }], error: null }); await tick();
  assert(JSON.stringify(race.render()).includes('Projeto B')); assert(!JSON.stringify(race.render()).includes('PRIVATE OWNER A'));
  race.props.ownerId = null; assert.equal(race.render(), null);

  const failure = harness(); failure.render(); failure.queries[0].resolve({ data: null, error: { code: 'UNAVAILABLE' } }); await tick();
  assert(failure.select().props.disabled); assert(JSON.stringify(failure.render()).includes('Não foi possível carregar'));
  failure.nodes(failure.render()).find(node => node.type === 'button' && node.props.children === 'Tentar novamente').props.onClick(); failure.render();
  assert.equal(failure.queries.length, 2);
  failure.queries[1].resolve({ data: [], error: null }); await tick();
  assert(JSON.stringify(failure.render()).includes('Você ainda não tem projetos salvos'));
  console.log('PASS: owned-project selection, save-before-switch action, busy guards, new drafts, retry/empty states and discarded stale account responses.');
})().catch(error => { console.error(error); process.exitCode = 1; });
