const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => module._compile(
  ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  filename,
);

const { buildSearchStrategy } = require("../lib/literature/query-strategy.ts");

const sleep = buildSearchStrategy("Qual a relação entre qualidade do sono e burnout em residentes de medicina?");
assert.equal(sleep.mode, "interpreted");
assert.equal(sleep.language, "pt");
assert.deepEqual(sleep.concepts, ["medical residents", "sleep quality", "burnout"]);
assert.match(sleep.pubmedQuery, /"sleep quality"\[Title\/Abstract\]/);
assert.match(sleep.pubmedQuery, /"Internship and Residency"\[MeSH Terms\]/);
assert.doesNotMatch(sleep.pubmedQuery, /\bqual\b|relacao/);
assert.equal(sleep.crossrefQuery, "medical residents sleep quality burnout");

const adherence = buildSearchStrategy("adesão ao tratamento da hipertensão");
assert.deepEqual(adherence.concepts, ["medication adherence", "hypertension"]);
assert.match(adherence.pubmedQuery, /Medication Adherence/);

const breastCancer = buildSearchStrategy("câncer de mama em mulheres jovens");
assert.deepEqual(breastCancer.concepts, ["breast cancer", "women", "young adults"]);
assert.equal(breastCancer.warnings.length, 0);

const structured = buildSearchStrategy({
  topic: "burnout",
  population: "estudantes de medicina",
  outcome: "qualidade do sono",
  mesh: "Education, Medical",
  operator: "AND",
});
assert.match(structured.pubmedQuery, /Education, Medical/);
assert.match(structured.pubmedQuery, /Students, Medical/);
assert.match(structured.pubmedQuery, /sleep quality/);

const advanced = buildSearchStrategy('(semaglutide[Title/Abstract]) AND depression[MeSH Terms]');
assert.equal(advanced.mode, "advanced");
assert.equal(advanced.language, "advanced");
assert.equal(advanced.pubmedQuery, '(semaglutide[Title/Abstract]) AND depression[MeSH Terms]');

const english = buildSearchStrategy({
  topic: "What is the relationship between sleep quality and burnout among medical residents?",
  language: "en",
});
assert.equal(english.language, "en");
assert.deepEqual(english.concepts, ["medical residents", "sleep quality", "burnout"]);
assert.doesNotMatch(english.pubmedQuery, /relationship|between|among/);
assert.equal(english.warnings.length, 0);

const substanceUseResidents = buildSearchStrategy("abuso drogas residentes");
assert.equal(substanceUseResidents.language, "pt");
assert(substanceUseResidents.concepts.includes("substance use"));
assert(substanceUseResidents.concepts.includes("medical residents"));
assert.match(substanceUseResidents.pubmedQuery, /"Substance-Related Disorders"\[MeSH Terms\]/);
assert.match(substanceUseResidents.pubmedQuery, /"Internship and Residency"\[MeSH Terms\]/);
assert.equal(substanceUseResidents.warnings.length, 0);

const needsReview = buildSearchStrategy("microplásticos em gestantes");
assert.equal(needsReview.requiresReview, true);
assert.deepEqual(needsReview.unresolvedTerms, ["microplasticos"]);
assert.deepEqual(needsReview.concepts, ["pregnant women"]);
assert.doesNotMatch(needsReview.pubmedQuery, /microplasticos/);

const confirmed = buildSearchStrategy({
  topic: "microplásticos em gestantes",
  language: "pt",
  translations: { microplasticos: "microplastics" },
});
assert.equal(confirmed.requiresReview, false);
assert.deepEqual(confirmed.unresolvedTerms, []);
assert(confirmed.concepts.includes("microplastics"));
assert.match(confirmed.pubmedQuery, /"microplastics"\[Title\/Abstract\]/);
assert.deepEqual(confirmed.manualTranslations, [{ source: "microplasticos", target: "microplastics" }]);

console.log("Radar query strategy: Portuguese concepts, MeSH expansion, structured fields and advanced syntax passed");
