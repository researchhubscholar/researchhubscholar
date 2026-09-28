const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, filename);
const { resolveOpenAccess } = require('../lib/literature/open-access.ts');
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

(async () => {
  const scielo = await resolveOpenAccess({ doi: '10.1000/scielo', pmid: '123' }, async url => {
    if (url.includes('unpaywall')) return response({ is_oa: true, best_oa_location: { url_for_pdf: 'https://www.scielo.br/j/test/a/file.pdf', url: 'https://www.scielo.br/j/test/', host_type: 'publisher', license: 'cc-by', version: 'publishedVersion' } });
    return response({}, 503);
  });
  assert.equal(scielo.status, 'open'); assert.equal(scielo.source, 'SciELO'); assert.equal(scielo.isPdf, true);

  const europe = await resolveOpenAccess({ doi: null, pmid: '456' }, async url => {
    assert(url.includes('europepmc'));
    return response({ resultList: { result: [{ pmcid: 'PMC456', isOpenAccess: 'Y', inEPMC: 'Y', fullTextUrlList: { fullTextUrl: [] } }] } });
  });
  assert.equal(europe.status, 'open'); assert.equal(europe.source, 'Europe PMC'); assert(europe.url.includes('PMC456'));

  const unavailable = await resolveOpenAccess({ doi: '10.1000/closed', pmid: null }, async url => url.includes('unpaywall') ? response({}, 404) : response({ resultList: { result: [] } }));
  assert.equal(unavailable.status, 'unavailable');
  const unknown = await resolveOpenAccess({ doi: '10.1000/error', pmid: null }, async () => response({}, 503));
  assert.equal(unknown.status, 'unknown');
  console.log('PASS: legal open-access resolver prefers SciELO, supports Europe PMC and distinguishes unavailable from provider failure.');
})().catch(error => { console.error(error); process.exitCode = 1; });
