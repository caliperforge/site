import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const fixture = (name) => JSON.parse(source('tests/fixtures/' + name + '.json'));
const data = (name) => JSON.parse(source('data/' + name + '.json'));
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const PANELS = ['jobs', 'sentback', 'reviews', 'tokens', 'perjob', 'mix', 'seats', 'ceo', 'timeline'];
const FROZEN = ['loop_counts', 'daily_activity', 'tokens_per_landed_job', 'ceo_touches', 'timeline'];

function load(available) {
  const plots = {};
  for (const k of PANELS) plots[k] = { innerHTML: undefined, clientWidth: 900 };
  const ctx = vm.createContext({
    addEventListener() {}, setTimeout, clearTimeout,
    fetch: async (url) => {
      const name = url.replace(/^\/data\/|\.json$/g, '');
      if (!available.includes(name)) return { ok: false, json: async () => ({}) };
      return { ok: true, json: async () => (FROZEN.includes(name) ? fixture(name) : data(name)) };
    },
    document: { querySelector: (sel) => plots[sel.match(/data-panel="(\w+)"/)[1]] },
  });
  for (const file of ['site-data.js', 'charts.js', 'research.js']) vm.runInContext(source(file), ctx);
  return plots;
}

const ALL = ['loop_counts', 'daily_activity', 'gate_verdicts', 'tokens_per_landed_job', 'token_mix', 'runs_by_seat', 'ceo_touches', 'timeline'];

test('every panel draws', async () => {
  const p = load(ALL);
  await settle();
  for (const k of PANELS) assert.ok(p[k].innerHTML, k);
});

test('weekly panels mark partial weeks', async () => {
  const p = load(ALL);
  await settle();
  for (const k of ['jobs', 'sentback', 'tokens', 'perjob', 'ceo']) {
    assert.match(p[k].innerHTML, /data-partial="\d"/, k);
    assert.match(p[k].innerHTML, />Week starting Monday</, k);
  }
});

test('plain labels', async () => {
  const p = load(ALL);
  await settle();
  const all = PANELS.map((k) => p[k].innerHTML).join('');
  for (const word of ['pre_review', 'rails', 'needs_ceo', '_specialist', 'cache_read', 'pr_path', '>v1<', '>v2<']) assert.ok(!all.includes(word), word);
  assert.match(p.reviews.innerHTML, /<td>Automatic checks<\/td>/);
  assert.match(p.seats.innerHTML, />TypeScript builder</);
  assert.match(p.mix.innerHTML, />Re-read from cache</);
  assert.match(p.timeline.innerHTML, /<b>Current version<\/b>/);
});

test('no dollars', async () => {
  const p = load(ALL);
  await settle();
  assert.ok(!PANELS.some((k) => /\$/.test(p[k].innerHTML)));
});

test('missing file leaves its panel empty', async () => {
  const p = load(ALL.filter((n) => n !== 'gate_verdicts'));
  await settle();
  assert.equal(p.reviews.innerHTML, undefined);
  assert.ok(p.jobs.innerHTML);
});
