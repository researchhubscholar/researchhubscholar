const assert = require('node:assert/strict');
const fs = require('node:fs');

const page = fs.readFileSync('app/ideias/page.tsx', 'utf8');
const generation = fs.readFileSync('app/api/ai/ideas/route.ts', 'utf8');
const refinement = fs.readFileSync('app/api/ai/refine-idea/route.ts', 'utf8');
const project = fs.readFileSync('app/meu-trabalho/page.tsx', 'utf8');

assert.match(page, /fetch\("\/api\/ai\/ideas"/);
assert.match(page, /fetch\("\/api\/ai\/refine-idea"/);
assert.match(page, /from\("idea_versions"\)\.insert/);
assert.match(page, /sessionStorage\.setItem\(transferKey/);
assert.match(page, /router\.push\(`\/meu-trabalho\?origem=ideias&proposta=/);
assert.match(page, /router\.push\(`\/descobrir\?\$\{new URLSearchParams/);
assert.match(project, /readIdeaTransfer/);

for (const route of [generation, refinement]) {
  assert.match(route, /promptForJson/);
  assert.match(route, /parseValidatedJson/);
  assert.doesNotMatch(route, /Output\.object/);
}
assert.match(refinement, /articles\.slice\(0, 6\)/);
assert.match(refinement, /outputBudget/);

console.log('PASS: ideas generation, refinement, history save, project transfer and Radar handoff remain connected.');
