const assert = require('node:assert/strict');
const fs = require('node:fs');

const page = fs.readFileSync('app/ideias/page.tsx', 'utf8');
const generation = fs.readFileSync('app/api/ai/ideas/route.ts', 'utf8');
const refinement = fs.readFileSync('app/api/ai/refine-idea/route.ts', 'utf8');
const project = fs.readFileSync('app/meu-trabalho/page.tsx', 'utf8');
const history = fs.readFileSync('components/ideas/history.tsx', 'utf8');

assert.match(page, /fetch\("\/api\/ai\/ideas"/);
assert.match(page, /fetch\("\/api\/ai\/refine-idea"/);
assert.match(page, /Código da operação/);
assert.match(page, /from\("idea_versions"\)\.insert/);
assert.match(page, /sessionStorage\.setItem\(transferKey/);
assert.match(page, /router\.push\(`\/meu-trabalho\?origem=ideias&proposta=/);
assert.match(page, /router\.push\(`\/descobrir\?\$\{new URLSearchParams/);
assert.match(project, /readIdeaTransfer/);
assert.match(history, /Expandir proposta completa/);
assert.match(history, /Transformar em projeto/);
assert.match(page, /createProject=\{row => transfer\(row\.proposal, true\)\}/);

assert.match(generation, /promptForJson/);
assert.match(generation, /parseValidatedJson/);
assert.match(refinement, /Output\.object/);
assert.match(refinement, /jsonSchema<IdeaRefinementDraft>/);
assert.match(refinement, /articles\.slice\(0, 5\)/);
assert.match(refinement, /outputBudget/);
assert.match(refinement, /completeIdeaRefinement/);
assert.match(generation, /completeAIIdeasDraft/);
assert.match(generation, /aiIdeasDraftJsonSchema/);

console.log('PASS: ideas generation, refinement, history save, project transfer and Radar handoff remain connected.');
