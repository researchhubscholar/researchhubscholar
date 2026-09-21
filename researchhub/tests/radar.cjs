const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, filename);

const { mergeArticles } = require('../lib/literature/types.ts');
const { resultCsv, resultRis, resultBibtex } = require('../lib/literature/result-export.ts');
const pubmed = { pmid: '123', doi: '10.1000/test', title: 'PubMed title', authors: ['A Author'], journal: 'Journal', pubdate: '2025', year: 2025, publicationTypes: ['Trial'], abstract: 'Abstract', pubmedUrl: 'https://pubmed.ncbi.nlm.nih.gov/123/', doiUrl: 'https://doi.org/10.1000/test', source: 'PubMed' };
const crossref = { ...pubmed, pmid: null, title: 'Crossref title', abstract: null, pubmedUrl: null, source: 'Crossref' };
const unique = { ...crossref, doi: '10.1000/unique', title: 'Unique article', doiUrl: 'https://doi.org/10.1000/unique' };
const merged = mergeArticles([pubmed, crossref, unique]);
assert.equal(merged.duplicateCount, 1);
assert.equal(merged.articles.length, 2);
assert.deepEqual(merged.articles[0].duplicateSources, ['PubMed', 'Crossref']);
assert.equal(merged.articles[0].abstract, 'Abstract');
assert(resultCsv(merged.articles).includes('PubMed + Crossref'));
assert(resultRis(merged.articles).includes('TY  - JOUR'));
assert(resultBibtex(merged.articles).includes('@article{'));
console.log('PASS: combined-source duplicate merge and CSV, RIS and BibTeX exports.');
