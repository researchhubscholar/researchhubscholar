const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => module._compile(
  ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
const { parseDecsExactResponse, resolveDecsTerms } = require("../lib/literature/decs.ts");
const { buildSearchStrategy } = require("../lib/literature/query-strategy.ts");
const record = (portuguese, english, id = "D000123", synonyms = []) => ({
  decsws_response: { record_list: { record: {
    unique_identifier_nlm: id,
    descriptor_list: [
      {descriptor: portuguese, attr: {lang:"pt"}},
      {descriptor: english, attr: {lang:"en"}},
    ],
    synonym_list: synonyms.map(synonym => ({synonym})),
  } } },
});
const payload = { objects: [record("Microplásticos", "Microplastics")] };
assert.equal(parseDecsExactResponse(payload, "microplasticos")?.english, "Microplastics");
assert.equal(parseDecsExactResponse(payload, "outra") , null);
assert.equal(parseDecsExactResponse(record("Microplásticos", "Microplastics", "D000123", ["Microplásticos"]), "microplasticos")?.descriptorId, "D000123");
assert.equal(parseDecsExactResponse({objects: [record("Microplásticos", "Microplastics", "D000123"), record("Microplásticos", "Microplastic Particles", "D000456")]}, "microplasticos"), null);
assert.equal(parseDecsExactResponse(record("Microplásticos", "Microplastics", "D000123"), "microplasticos")?.provenance, "DeCS");
assert.equal(parseDecsExactResponse(record("Microplásticos", "Microplastics", ""), "microplasticos"), null);
assert.equal(parseDecsExactResponse({objects: [record("Microplásticos", "Microplastics")]}, "arbitrario"), null);
(async () => {
  const calls=[];
  const fetchImpl = async (url) => {
    calls.push(url.toString());
    return new Response(JSON.stringify(payload), {headers: {"Content-Type":"application/json"}});
  };
  const resolved = await resolveDecsTerms(["microplasticos"], { fetchImpl });
  assert.equal(resolved.translations.microplasticos, "Microplastics");
  assert.equal(calls.length,1);
  assert.match(calls[0], /decs-api\.bvsalud\.org\/api\/thesaurus\/term\//);
  assert.equal(new URL(calls[0]).searchParams.get("lang"), "pt");
  const strategy = buildSearchStrategy({topic:"microplásticos em gestantes", translations:resolved.translations});
  assert.equal(strategy.requiresReview,false);
  assert.match(strategy.pubmedQuery, /"Microplastics"\[Title\/Abstract\]/);
  assert.match(strategy.pubmedQuery, /Pregnant Women/);
  assert.deepEqual((await resolveDecsTerms(["microplasticos"], {fetchImpl: async()=>new Response("down",{status:503})})).translations,{});
  assert.deepEqual((await resolveDecsTerms(["microplasticos"], {baseUrl:"https://example.org",fetchImpl})).translations,{});
  assert.equal(buildSearchStrategy("microplásticos em gestantes").requiresReview,true, "fallback stays blocked for manual terminology review");
  console.log("PASS: IA-02 exact DeCS mapping, ambiguity, provenance, fallback and complete Radar query.");
})().catch(error=>{console.error(error);process.exitCode=1;});
