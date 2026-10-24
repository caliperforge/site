import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = (file) => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const ok = (body) => ({ ok: true, json: async () => body });
const notOk = { ok: false, json: async () => ({}) };
const settle = () => new Promise((resolve) => setImmediate(resolve));

const data = JSON.parse(source('data/rubin_names.json'));
const page = source('blog/37_rubin-names.html');
const spans = [...page.matchAll(/<span data-rubin="(\w+)">([^<]*)<\/span>/g)].map((m) => ({ key: m[1], text: m[2] }));
const column = (name) => data.rows.map((r) => r[data.columns.indexOf(name)]);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

const api = 'https://api.lsst.fink-portal.org/api/v1/';
const tagByNight = api + 'tags?tag=in_tns&n=200000&startdate=2026-06-14&stopdate=2026-07-15&columns=r%3AdiaObjectId%2Cr%3AmidpointMjdTai';
const calls = new Set(['statistics?date=202606', 'statistics?date=202607', 'statistics?date=202609', 'statistics?date=202610',
  'statistics?date=&columns=f%3Anight%2Cf%3Aalerts',
  'tags?tag=in_tns&n=200000&startdate=2026-06-15&stopdate=2026-07-15&columns=r%3AdiaObjectId%2Cr%3AmidpointMjdTai%2Cf%3Axm_tns_fullname%2Cf%3Axm_tns_type',
].map((c) => api + c));

async function render(response, { width = 760, start = (s) => s.text } = {}) {
  const mount = { innerHTML: '', clientWidth: width };
  const els = spans.map((s) => ({ key: s.key, textContent: start(s), getAttribute: () => s.key }));
  const ctx = vm.createContext({
    document: {
      querySelector: (s) => (s === '[data-rubin-chart]' ? mount : null),
      querySelectorAll: (s) => (s === '[data-rubin]' ? els : []),
    },
    fetch: async () => {
      if (response instanceof Error) throw response;
      return response;
    },
  });
  for (const file of ['site-data.js', 'charts.js', 'rubin-names.js']) vm.runInContext(source(file), ctx);
  await settle();
  return { chart: mount.innerHTML, text: (key) => els.find((e) => e.key === key).textContent, els };
}

test('per-night in_tns counts sum to the statistics and tag totals', () => {
  assert.equal(data.rows.length, data.totals.nights_with_data.value);
  assert.equal(sum(column('in_tns_stats')), data.totals.in_tns_alerts.value);
  assert.equal(sum(column('in_tns_tag_utc')), data.totals.in_tns_tag_rows.value);
});

test('every total and row cites a call from plan 1614 and a source number', () => {
  for (const [key, t] of Object.entries(data.totals)) {
    assert.ok(t.calls.length > 0, key);
    for (const c of t.calls) assert.ok(calls.has(c), key + ' ' + c);
    assert.equal(t.source, 1, key);
  }
  for (const r of data.rows) {
    const [night, , , stats, tag, src] = r;
    assert.equal(stats, api + 'statistics?date=' + night.slice(0, 6), night);
    assert.equal(tag, tagByNight, night);
    assert.equal(src, 8, night);
  }
});

test('every data-rubin span renders to its static text', async () => {
  assert.equal(spans.length, page.split('data-rubin="').length - 1);
  const { els } = await render(ok(data), { start: () => '' });
  els.forEach((el, i) => assert.equal(el.textContent, spans[i].text, el.key));
});

test('the headline reads 1 in 1,248 and 0.080%, and the ratio follows named_objects', async () => {
  const { text } = await render(ok(data));
  assert.equal(text('ratio'), '1 in 1,248');
  assert.equal(text('share'), '0.080%');
  const fewer = { ...data, totals: { ...data.totals, named_objects: { ...data.totals.named_objects, value: 2929 } } };
  assert.equal((await render(ok(fewer))).text('ratio'), '1 in 1,000');
});

test('the chart has one bar per night labelled with its statistics count, as columns or as bars', async () => {
  const labels = column('in_tns_stats').map((n) => n.toLocaleString('en-US'));
  for (const width of [760, 340]) {
    const { chart } = await render(ok(data), { width });
    assert.equal(chart.match(/class="cf-bar"/g).length, 16, width);
    assert.deepEqual([...chart.matchAll(/<text class="cf-label"[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]), labels, width);
  }
});

test('a rubin_names file that is not ok or rejects leaves the load error, the static text and no chart', async () => {
  for (const r of [notOk, new Error('offline')]) {
    const { chart, els } = await render(r);
    assert.equal(chart, 'Could not load the rubin_names data');
    assert.ok(!chart.includes('<svg'));
    els.forEach((el, i) => assert.equal(el.textContent, spans[i].text, el.key));
  }
});
