const assert = require('node:assert/strict');
const fs = require('node:fs');

const page = fs.readFileSync('app/ideias/page.tsx', 'utf8');
const generation = fs.readFileSync('app/api/ai/ideas/route.ts', 'utf8');
const refinement = fs.readFileSync('app/api/ai/refine-idea/route.ts', 'utf8');
const project = fs.readFileSync('app/meu-trabalho/page.tsx', 'utf8');
const history = fs.readFileSync('components/ideas/history.tsx', 'utf8');

assert.match(page, /postAI[\s\S]*?\("\/api\/ai\/ideas"/);
assert.match(page, /postAI[\s\S]*?\("\/api\/ai\/refine-idea"/);
assert.match(page, /Código da operação/);
assert.match(page, /Idioma das propostas/);
assert.match(page, /language: outputLanguage/);
assert.match(page, /Consumo real:/);
assert.match(page, /generationInFlight\.current/);
assert.match(page, /refinementInFlight\.current/);
assert.match(page, /Verificação estrutural concluída/);
assert.match(page, /scholar_generation_reviews/);
assert.match(page, /Esta resposta ajudou\?/);
assert.match(page, /from\("idea_versions"\)\.insert/);
assert.match(page, /sessionStorage\.setItem\(transferKey/);
assert.match(page, /router\.push\(`\/meu-trabalho\?origem=ideias&proposta=/);
assert.match(page, /router\.push\(`\/descobrir\?\$\{new URLSearchParams/);
assert.match(project, /readIdeaTransfer/);
assert.match(history, /Expandir proposta completa/);
assert.match(history, /Transformar em projeto/);
assert.match(page, /createProject=\{row => transfer\(row\.proposal, row\)\}/);
assert.match(page, /idea-version:\$\{savedVersion\.id\}/);
assert.match(project, /scholar_project_origins/);
assert.match(project, /initialProjectMilestones/);
assert.match(project, /const diagnosis = diagnoseProjectDraft\(draft\)/);
assert.match(project, /evitar uma duplicação/);

assert.match(generation, /promptForJson/);
assert.match(generation, /Output\.object/);
assert.match(generation, /validate\(result\.output\)/);
assert.match(refinement, /Output\.object/);
assert.match(refinement, /jsonSchema<IdeaRefinementDraft>/);
assert.match(refinement, /articles\.slice\(0, 5\)/);
assert.match(refinement, /outputBudget/);
assert.match(refinement, /completeIdeaRefinement/);
assert.match(generation, /completeAIIdeasDraft/);
assert.match(generation, /aiIdeasDraftJsonSchema/);
assert.match(generation, /automaticIdeasPrompt\(input\.context, input\.language\)/);
assert.match(generation, /qualityChecks/);
assert.match(refinement, /ideaRefinementPrompt\(input\.idea, search\.count, articleContext, input\.language\)/);

console.log('PASS: ideas generation, refinement, history save, project transfer and Radar handoff remain connected.');
