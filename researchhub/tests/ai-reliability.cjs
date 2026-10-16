const fs = require('node:fs'), assert = require('node:assert/strict'), vm = require('node:vm'), ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const transport = require('../lib/ai/client-request.ts');
const assist = require('../lib/ai/assist.ts');
const { groundRefinementSources } = require('../lib/ai/refine-idea.ts');
const operationId = '11111111-1111-4111-8111-111111111111';
const output = { ...assist.simulatedOutput('writing'), recommendations: [{ label: 'Revisão', content: 'Texto revisado', rationale: 'Clareza', targetField: 'methods', confidence: 'alta', source: 'Protocolo' }] };
const usage = { inputTokens: 1200, outputTokens: 700, costUsd: 0.001 };
const response = body => new Response(JSON.stringify(body), { status: 200 });
const realFetch = global.fetch;
const tick = () => new Promise(resolve => setImmediate(resolve));

// Exercise the actual section component, including its event handlers and payload.
function sectionHarness(content, panel = false) {
  const state = []; let cursor = 0;
  const react = {
    useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return state[index] ||= { current: initial }; },
  };
  const module = { exports: {} }, jsx = (type, props) => ({ type, props });
  const source = ts.transpileModule(fs.readFileSync(panel ? 'components/ai/assistant-panel.tsx' : 'components/manuscript/section-assistant.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === '@/lib/ai/client-request') return transport;
    if (name === '@/lib/ai/assist') return assist;
    if (name === 'next/link' || name === '@/components/ai/loading-dialog') return { default: name };
    throw Error(name);
  } });
  const props = panel ? { feature: 'protocol', title: 'Revisar projeto', description: 'Revisão', context: { theme: 'Sono' } } : { sectionKey: 'methods', heading: 'Métodos', content, projectId: operationId, project: {}, sources: [], apply: async () => true };
  const render = () => { cursor = 0; return module.exports.default(props); };
  const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
  const button = label => nodes(render()).find(node => node.type === 'button' && JSON.stringify(node.props.children).includes(label));
  if (!panel) button('Trabalhar').props.onClick();
  return { render, nodes, run: () => button(panel ? 'Analisar com IA' : 'Gerar sugestão').props.onClick() };
}

(async () => {
  try {
    let calls = 0, request;
    global.fetch = async (path, options) => { calls++; request = { path, options }; return response({ output, operationId, usage }); };
    const result = await transport.postAI('/api/ai/assist', { feature: 'protocol', context: { theme: 'Sono' } });
    assert.equal(calls, 1); assert.equal(request.path, '/api/ai/assist'); assert.equal(request.options.method, 'POST');
    assert(request.options.signal instanceof AbortSignal); assert.equal(JSON.parse(request.options.body).feature, 'protocol');
    assert.equal(result.data.operationId, operationId); assert(result.elapsedMs >= 0);
    assert.deepEqual(transport.readAIUsage(result.data.usage), usage);
    for (const invalid of [undefined, {}, { ...usage, outputTokens: -1 }, { ...usage, inputTokens: 1.5 }, { ...usage, costUsd: Infinity }]) assert.equal(transport.readAIUsage(invalid), null);
    assert.deepEqual(transport.readAIUsage({ inputTokens: 0, outputTokens: 0, costUsd: 0 }), { inputTokens: 0, outputTokens: 0, costUsd: 0 });

    for (const status of [401, 429, 500, 504]) {
      calls = 0; global.fetch = async () => { calls++; return new Response(JSON.stringify({ error: 'Mensagem controlada', operationId }), { status }); };
      await assert.rejects(transport.postAI('/api/ai/assist', {}), error => error instanceof transport.AIRequestError && error.operationId === operationId && error.status === status && error.message === 'Mensagem controlada');
      assert.equal(calls, 1, 'Failures must not trigger another charged request');
    }
    for (const raw of ['<html>Gateway timeout</html>', '{"output":', 'null', '[]', '42']) {
      global.fetch = async () => new Response(raw, { status: 504 });
      await assert.rejects(transport.postAI('/api/ai/ideas', {}), error => /Minha licença/.test(error.message) && !/devolvida|não será consumida/.test(error.message));
    }
    for (const failure of [new TypeError('network'), new DOMException('timeout', 'TimeoutError'), new DOMException('aborted', 'AbortError')]) {
      calls = 0; global.fetch = async () => { calls++; throw failure; };
      await assert.rejects(transport.postAI('/api/ai/refine-idea', {}), /pode continuar no servidor/); assert.equal(calls, 1);
    }

    const original = 'Métodos reais '.repeat(850).padEnd(12000, 'x');
    calls = 0; global.fetch = async (_path, options) => { calls++; request = JSON.parse(options.body); return response({ output, operationId, usage, mode: 'live' }); };
    const section = sectionHarness(original); section.run(); await tick(); await tick();
    assert.equal(calls, 1); assert.equal(request.context.original, original); assert.equal(request.context.original.length, 12000);
    assert(JSON.stringify(section.render()).includes('1.900 tokens'));
    const tooLong = sectionHarness(original + 'TAIL_MUST_NOT_BE_LOST'); tooLong.run(); await tick();
    assert.equal(calls, 1, 'Oversized sections must be blocked before sending a request');
    assert(JSON.stringify(tooLong.render()).includes('Nenhuma solicitação foi enviada'));
    global.fetch = async () => new Response(JSON.stringify({ error: 'Falha', operationId }), { status: 504 });
    const failed = sectionHarness('Método existente'); failed.run(); await tick(); await tick();
    assert(JSON.stringify(failed.render()).includes(`/geracoes/${operationId}`));

    const panel = sectionHarness('', true); panel.run(); await tick(); await tick();
    assert(JSON.stringify(panel.render()).includes(`/geracoes/${operationId}`));
    global.fetch = async () => response({ output: { title: 'Incomplete' } });
    panel.run(); await tick(); await tick();
    assert(!JSON.stringify(panel.render()).includes(`/geracoes/${operationId}`), 'A new failed request cannot point to the previous operation');
    assert(JSON.stringify(panel.render()).includes('análise válida'));
    global.fetch = async () => response({ output, operationId, mode: 'live' });
    panel.run(); await tick(); await tick();
    assert(JSON.stringify(panel.render()).includes('indisponível; consulte o registro'), 'Missing provider usage cannot be displayed as zero');

    const { operationDurationSeconds } = require('../lib/ai/evaluation/rubric.ts');
    assert.equal(operationDurationSeconds('2026-10-16T12:00:00Z', '2026-10-16T12:00:12.5Z'), 12.5);
    assert.equal(operationDurationSeconds('invalid', 'invalid'), null);
    assert.equal(operationDurationSeconds('2026-10-16T12:00:00Z', null), null);
    assert.equal(operationDurationSeconds('2026-10-16T12:00:12Z', '2026-10-16T12:00:00Z'), null);

    const input = { sources: [{ pmid: '123', title: 'Título inventado pelo modelo', contribution: 'Contribuição' }] };
    const grounded = groundRefinementSources(input, [{ pmid: '123', title: 'Título real do PubMed' }]);
    assert.equal(grounded.sources[0].title, 'Título real do PubMed'); assert.equal(input.sources[0].title, 'Título inventado pelo modelo');
    assert.throws(() => groundRefinementSources(input, [{ pmid: '999', title: 'Outro estudo' }]), /não estava entre os artigos/);
    assert.throws(() => groundRefinementSources({ sources: [{ ...input.sources[0], pmid: '' }] }, []), /não estava entre os artigos/);
    assert.throws(() => assist.validateAssistRequest({ feature: 'writing', context: { sectionKey: 'methods', task: 'revise', original: original + 'x', sources: [] } }), /excede/);
    console.log('PASS: single AI requests, incomplete responses, timeout/network errors, operation tracking, honest consumption, full-section preservation and grounded PubMed sources.');
  } finally { global.fetch = realFetch; }
})().catch(error => { console.error(error); process.exitCode = 1; });
