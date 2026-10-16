import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const ok = (body) => ({ ok: true, json: async () => body });
const settle = () => new Promise((resolve) => setImmediate(resolve));

const pipeline = ok({
  columns: ['stage', 'count', 'refused', 'unit'],
  rows: [
    ['brief', 1938, null, 'runs'],
    ['build', 2757, null, 'runs'],
    ['rails', 75568, 603, 'verdicts'],
    ['code review', 1745, 225, 'verdicts'],
    ['ready', 2323, 109, 'verdicts'],
    ['CEO approvals', 38, null, 'approvals'],
    ['pushed', 909, null, 'deliverables'],
  ],
  caveat: 'Verdicts, not jobs.',
});

const loop = () => ({
  metric: 'loop_counts',
  title: 'Loop counts',
  unit: 'per ISO week',
  columns: ['week', 'landed', 'refusals', 'refusals_per_landed', 'first_pass', 'first_pass_share'],
  rows: [
    ['2026-W40', 20, 30, 1.5, 8, 0.4],
    ['2026-W41', 50, 52, 1.04, 21, 0.42],
    ['2026-W42', 40, 35, 0.875, 22, 0.55],
  ],
  definition: 'Per ISO week.',
  caveat: 'A trend.',
  totals: {
    all_time: { rebuilt_landed: 40, fix_tickets_filed: 1204, fix_tickets_landed: 977, language_notes: 58, drift_fixed: 12 },
    last_7_days: { rebuilt_landed: 2, fix_tickets_filed: 30, fix_tickets_landed: 21, language_notes: 3, drift_fixed: 1 },
  },
});

function home(responses) {
  const els = {};
  for (const key of ['runs', 'tokens', 'plans', 'days', 'first_day', 'pipeline', 'loop_chart']) els[key] = { textContent: '—' };
  const ctx = vm.createContext({
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    fetch: async (url) => responses[url.slice('/data/'.length, -'.json'.length)],
    document: { querySelectorAll: (sel) => [els[sel.match(/data-home="(\w+)"/)[1]]] },
  });
  for (const file of ['site-data.js', 'charts.js', 'home.js']) vm.runInContext(source(file), ctx);
  return els;
}

const labels = (svg) => [...svg.matchAll(/class="cf-label"[^>]*>([^<]*)</g)].map((m) => m[1]);

test('one return arrow per gate, labelled with its count, and no CEO stage', async () => {
  const els = home({ pipeline_counts: pipeline, loop_counts: ok(loop()) });
  await settle();
  const html = els.pipeline.innerHTML;
  assert.equal(html.match(/sent back with a reason/g).length, 3);
  for (const n of ['603', '225', '109']) assert.equal(html.match(new RegExp('>' + n + ' sent back with a reason<', 'g')).length, 1);
  assert.doesNotMatch(html, /CEO/);
  assert.match(html, />READY<.*>PUSHED</);
});

test('the self-fix box shows the all-time fix tickets filed, landed and language notes', async () => {
  const els = home({ pipeline_counts: pipeline, loop_counts: ok(loop()) });
  await settle();
  const html = els.pipeline.innerHTML;
  assert.match(html, />THE MACHINE FIXES ITSELF</);
  assert.match(html, />1,204<\/text>[^]*>fix tickets filed</);
  assert.match(html, />977<\/text>[^]*>fix tickets landed</);
  assert.match(html, />58<\/text>[^]*>language notes</);
});

test('loop_chart holds two column charts with a label on every week', async () => {
  const els = home({ pipeline_counts: pipeline, loop_counts: ok(loop()) });
  await settle();
  const svgs = els.loop_chart.innerHTML.split('</svg>').slice(0, -1);
  assert.equal(svgs.length, 2);
  assert.deepEqual(labels(svgs[0]), ['1.5', '1', '0.9']);
  assert.deepEqual(labels(svgs[1]), ['40', '42', '55']);
  for (const svg of svgs) assert.match(svg, /class="cf-axis"[^>]*>ISO week</);
  assert.match(svgs[0], /class="cf-axis"[^>]*>Refusals per landed job</);
  assert.match(svgs[1], /class="cf-axis"[^>]*>First-pass share \(%\)</);
});

test('a missing loop_counts leaves the charts and totals at a dash and still draws the loop', async () => {
  const els = home({ pipeline_counts: pipeline });
  await settle();
  assert.equal(els.loop_chart.textContent, '—');
  assert.equal(els.loop_chart.innerHTML, undefined);
  assert.equal(els.pipeline.innerHTML.match(/>—</g).length, 3);
  assert.equal(els.pipeline.innerHTML.match(/sent back with a reason/g).length, 3);
  assert.match(els.pipeline.innerHTML, />PUSHED</);
});

test('a missing refusals_per_landed column dashes that chart only', async () => {
  const body = loop();
  const i = body.columns.indexOf('refusals_per_landed');
  body.columns.splice(i, 1);
  for (const r of body.rows) r.splice(i, 1);
  const els = home({ pipeline_counts: pipeline, loop_counts: ok(body) });
  await settle();
  assert.match(els.loop_chart.innerHTML, /^<p>—<\/p><svg/);
  assert.deepEqual(labels(els.loop_chart.innerHTML), ['40', '42', '55']);
  assert.equal(els.pipeline.innerHTML.match(/sent back with a reason/g).length, 3);
});

test('a missing totals.all_time key dashes that value only', async () => {
  const body = loop();
  delete body.totals.all_time.fix_tickets_landed;
  const els = home({ pipeline_counts: pipeline, loop_counts: ok(body) });
  await settle();
  const html = els.pipeline.innerHTML;
  assert.match(html, />—<\/text>[^]*>fix tickets landed</);
  assert.equal(html.match(/>—</g).length, 1);
  assert.match(html, />1,204</);
  assert.equal(html.match(/sent back with a reason/g).length, 3);
});
