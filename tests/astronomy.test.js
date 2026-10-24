import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = (file) => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const ok = (body) => ({ ok: true, json: async () => body });
const notOk = { ok: false, json: async () => ({}) };
const settle = () => new Promise((resolve) => setImmediate(resolve));

const fixture = JSON.parse(source('tests/fixtures/vo_conformance.json'));
const services = ['CADC', 'IRSA', 'ARI', 'MAST'];
const behaviours = [...new Set(fixture.rows.map((r) => r[3]))];

async function render(response) {
  const el = { innerHTML: '' };
  const ctx = vm.createContext({
    document: { querySelector: (s) => (s === '[data-astronomy="matrix"]' ? el : null) },
    fetch: async () => {
      if (response instanceof Error) throw response;
      return response;
    },
  });
  for (const file of ['site-data.js', 'astronomy.js']) vm.runInContext(source(file), ctx);
  await settle();
  return el.innerHTML;
}

const tables = (html) => html.split('<section class="panel">').slice(1).map((s) => ({
  title: s.match(/<h2>(.*?)<\/h2>/)[1],
  def: s.match(/<\/h2><p class="def">(.*?)<\/p>/)?.[1],
  head: [...s.matchAll(/<th>(.*?)<\/th>/g)].map((m) => m[1]),
  rows: [...s.matchAll(/<tr><td>(.*?)<\/td>(.*?)<\/tr>/g)].map((m) => ({
    client: m[1],
    cells: [...m[2].matchAll(/<td>(.*?)<\/td>/g)].map((c) => c[1]),
  })),
}));

const cellOf = (html, behaviour, client, service) =>
  tables(html)[behaviours.indexOf(behaviour)].rows.find((r) => r.client === client).cells[services.indexOf(service)];

test('each cell shows the latest outcome, with its note as title and in details only when there is one', async () => {
  const html = await render(ok(fixture));
  const pills = { pass: 'merged', fail: 'open', 'not supported': 'closed' };
  const latest = fixture.rows.filter((r) => r[0] === '2026-10-22');
  assert.deepEqual([...new Set(latest.map((r) => r[4]))], ['pass', 'fail', 'not supported']);
  for (const [, client, service, behaviour, outcome, note] of latest) {
    const cell = cellOf(html, behaviour, client, service);
    const [, state, , title, text] = cell.match(/<span class="pill pill--(\w+)"( title="([^"]*)")?>([^<]*)<\/span>/);
    assert.equal(text, outcome);
    assert.equal(state, pills[outcome]);
    assert.equal(title, note ?? undefined);
    assert.equal(cell.startsWith('<details><summary>'), note !== null);
    if (note) assert.ok(cell.includes('</summary><p>' + note + '</p></details>'));
  }
});

test('the last-run line gives the run time in Guatemala and links the raw results', async () => {
  const html = await render(ok(fixture));
  assert.ok(html.startsWith('<p class="def">Last run 22 Oct 2026, 21:10 Guatemala time · <a href="' +
    fixture.source + '">Raw results</a></p>'));
});

test('a vo_conformance file that is not ok or rejects leaves the load error and draws nothing', async () => {
  for (const r of [notOk, new Error('offline')]) {
    assert.equal(await render(r), 'Could not load the vo_conformance results');
  }
});

test('a client with no row on the latest day shows a dash and a 30-day strip marking days with no run', async () => {
  const cell = cellOf(await render(ok(fixture)), 'async_jobs', 'pyvo', 'MAST');
  assert.ok(cell.startsWith('—<svg class="strip" role="img" aria-label="Last 30 days"'));
  const days = [...cell.matchAll(/<rect [^>]*style="fill:var\(--site-(\w+)\)"><title>(.*?)<\/title>/g)].map((m) => [m[1], m[2]]);
  assert.equal(days.length, 30);
  assert.deepEqual(days[0], ['rule', '2026-09-23: no run']);
  assert.deepEqual(days.at(-2), ['merged', '2026-10-21: pass']);
  assert.deepEqual(days.at(-1), ['rule', '2026-10-22: no run']);
  assert.equal(days.filter(([fill, title]) => fill === 'rule' && title.endsWith(': no run')).length, 29);
});

test('one table per behaviour under its name and description, with clients against the four services', async () => {
  const head = ['Client', 'CADC', 'IRSA', 'ARI Heidelberg', 'MAST'];
  const html = await render(ok(fixture));
  assert.deepEqual(tables(html).map((t) => [t.title, t.def, t.head, t.rows.map((r) => r.client)]), [
    ['Async jobs', fixture.behaviours.async_jobs, head, ['astroquery', 'pyvo']],
    ['Error documents', fixture.behaviours.error_documents, head, ['astroquery', 'pyvo']],
  ]);
  const bare = await render(ok({ ...fixture, behaviours: { async_jobs: fixture.behaviours.async_jobs } }));
  assert.equal(tables(bare)[1].def, undefined);
});

test('astronomy.html is the redesign page with Astronomy current, one mount, and site-data.js deferred before astronomy.js', () => {
  const html = source('astronomy.html');
  assert.ok(html.includes('<link rel="stylesheet" href="/site.css">'));
  assert.deepEqual([...html.matchAll(/<a href="([^"]*)"[^>]*aria-current/g)].map((m) => m[1]), ['/astronomy']);
  assert.equal(html.match(/aria-current/g).length, 1);
  assert.equal(html.match(/data-astronomy="matrix"/g).length, 1);
  assert.deepEqual([...html.matchAll(/<script([^>]*)>/g)].map((m) => m[1]),
    [' src="/site-data.js" defer', ' src="/astronomy.js" defer']);
  assert.ok(html.includes('<title>Astronomy data clients, tested daily | CaliperForge</title>'));
  assert.ok(html.includes('<h1>Astronomy data clients, tested daily</h1>'));
});
