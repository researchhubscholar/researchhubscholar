// Repository tests use a small in-memory PostgREST adapter, without real accounts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, filename);
const { LibraryStore, mergeImportedNote } = require('../lib/literature/library-store.ts');

const tables = { library_articles: [], evidence_matrix: [], research_projects: [
  { id: 'project-a', owner_id: 'owner-a', title: 'A' }, { id: 'project-b', owner_id: 'owner-b', title: 'B' }
] };
let sequence = 0;
let fail = null;
class Query {
  constructor(table) { this.table = table; this.filters = []; this.operation = 'select'; }
  select() { return this; }
  eq(field, value) { this.filters.push(row => row[field] === value); return this; }
  order() { return this; }
  range(first, last) { this.bounds = [first, last]; return this; }
  maybeSingle() { this.singleRow = true; return this; }
  single() { this.singleRow = true; return this; }
  insert(value) { this.operation = 'insert'; this.value = value; return this; }
  upsert(value) { this.operation = 'upsert'; this.value = value; return this; }
  update(value) { this.operation = 'update'; this.value = value; return this; }
  delete() { this.operation = 'delete'; return this; }
  then(resolve, reject) { return Promise.resolve().then(() => this.execute()).then(resolve, reject); }
  execute() {
    if (fail === this.table) return { data: null, error: { code: 'network' } };
    const table = tables[this.table];
    let rows = table.filter(row => this.filters.every(filter => filter(row)));
    if (this.operation === 'insert' || this.operation === 'upsert') {
      let existing = this.operation === 'upsert' && table.find(row => row.owner_id === this.value.owner_id && row.article_id === this.value.article_id);
      if (this.operation === 'insert' && table.some(row => (this.value.id && row.id === this.value.id) || (this.value.pmid && row.owner_id === this.value.owner_id && row.pmid === this.value.pmid))) return { data: null, error: { code: '23505' } };
      if (existing) Object.assign(existing, this.value);
      else { existing = { id: `row-${++sequence}`, created_at: new Date().toISOString(), ...this.value }; table.push(existing); }
      rows = [existing];
    }
    if (this.operation === 'update') rows.forEach(row => Object.assign(row, this.value));
    if (this.operation === 'delete') {
      tables[this.table] = table.filter(row => !rows.includes(row));
      if (this.table === 'library_articles') tables.evidence_matrix = tables.evidence_matrix.filter(note => !rows.some(article => article.id === note.article_id));
      rows = [];
    }
    if (this.bounds) rows = rows.slice(this.bounds[0], this.bounds[1] + 1);
    const data = JSON.parse(JSON.stringify(this.singleRow ? rows[0] || null : rows));
    return { data, error: null };
  }
}
const db = { from: table => new Query(table) };
const fixture = { pmid: '123', doi: '10.1234/SLEEP', title: 'Sleep in residents', authors: ['A'], journal: 'Journal', pubdate: '2025', year: 2025, publicationTypes: ['Trial'], abstract: 'Summary', pubmedUrl: 'https://pubmed.ncbi.nlm.nih.gov/123/', doiUrl: 'https://doi.org/10.1234/SLEEP' };
(async () => {
  const a = new LibraryStore(db, 'owner-a');
  const b = new LibraryStore(db, 'owner-b');
  const article = await a.saveArticle(fixture, 'project-a');
  await a.saveNote(article.id, { objective: 'My objective', finding: 'Finding' });
  const recovered = await new LibraryStore(db, 'owner-a').load();
  assert.equal(recovered.articles[0].id, article.id);
  assert.equal(recovered.articles[0].projectId, 'project-a');
  assert.equal(recovered.notes[article.id].objective, 'My objective');
  assert.equal(tables.evidence_matrix[0].confirmed_main_finding, true);
  assert.equal(tables.evidence_matrix[0].confirmed_method, false);
  assert.equal((await b.load()).articles.length, 0);
  await assert.rejects(() => b.saveNote(article.id, { objective: 'Wrong owner' }));
  await assert.rejects(() => a.assignProject(article.id, 'project-b'));
  assert.equal((await a.load()).articles[0].projectId, 'project-a');
  const duplicate = await a.saveArticle({ ...fixture, pmid: null, doi: '10.1234/sleep' }, null);
  assert.equal(duplicate.id, article.id); assert.equal(tables.library_articles.length, 1);
  assert.equal(duplicate.projectId, 'project-a');
  await a.saveNote(article.id, { objective: '', method: 'Revised method' });
  assert.equal(tables.evidence_matrix.length, 1);
  assert.equal((await a.load()).notes[article.id].objective, '');
  const crossref = await a.saveArticle({ ...fixture, pmid: null, doi: '10.1234/other', pubmedUrl: null }, null);
  await a.saveNote(crossref.id, { objective: 'Crossref objective' });
  assert.equal((await a.load()).notes[crossref.id].objective, 'Crossref objective');
  assert.deepEqual(mergeImportedNote({ objective: 'Cloud', method: '' }, { objective: 'Legacy', method: 'Recovered' }), { objective: 'Cloud', method: 'Recovered' });
  await a.assignProject(crossref.id, 'project-a');
  assert.equal(tables.evidence_matrix.find(row => row.article_id === crossref.id).project_id, 'project-a');
  fail = 'evidence_matrix';
  await assert.rejects(() => a.saveNote(article.id, { objective: 'Not saved' }));
  fail = null;
  assert.equal((await a.load()).notes[article.id].method, 'Revised method');
  await b.remove(article.id); assert.equal((await a.load()).articles.length, 2);
  await a.remove(article.id);
  assert.equal((await a.load()).articles.length, 1); assert.equal((await a.load()).notes[article.id], undefined);
  tables.research_projects.push({ id: 'project-a2', owner_id: 'owner-a', title: 'Second project' });
  const unused = await a.saveArticle({ ...fixture, pmid: null, doi: '10.1234/unassigned' }, null);
  await a.saveNote(unused.id, { objective: 'Preserved while linking' });
  let linked = await a.attachUnassigned([crossref.id, unused.id, 'foreign-or-missing'], 'project-a2');
  assert.deepEqual(linked, { attached: 1, retained: 1, missing: 1 });
  assert.equal((await a.load()).articles.find(row => row.id === crossref.id).projectId, 'project-a');
  assert.equal((await a.load()).notes[unused.id].objective, 'Preserved while linking');
  linked = await a.attachUnassigned([unused.id], 'project-a2');
  assert.equal(linked.attached, 1);
  await assert.rejects(() => b.attachUnassigned([unused.id], 'project-a2'));
  const concurrentArticle = { ...fixture, pmid: null, doi: '10.1234/concurrent' };
  const [first, second] = await Promise.all([a.saveArticle(concurrentArticle, null), a.saveArticle(concurrentArticle, null)]);
  assert.equal(first.id, second.id);
  assert.equal(tables.library_articles.filter(row => row.doi === concurrentArticle.doi).length, 1);
  console.log('PASS: persistent reload, owner filtering, project ownership, PMID/DOI duplicates, note upserts, Crossref notes, import merge, failed writes, cascading removal and concurrent DOI saves and non-destructive reference linking.');
})().catch(error => { console.error(error); process.exitCode = 1; });
