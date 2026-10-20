import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const fixture = (name) => JSON.parse(source('tests/fixtures/' + name + '.json'));
const ok = (body) => ({ ok: true, json: async () => body, text: async () => '' });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const KEYS = ['tally', 'fields', 'prs', 'outside', 'days', 'jobs', 'per_job', 'first_pass', 'first_pass_week', 'chart', 'data_start', 'loop', 'latest'];

function load(names, { narrow = false } = {}) {
  const els = {};
  for (const k of KEYS) els[k] = { textContent: '—', innerHTML: undefined, clientWidth: 900, addEventListener() {} };
  const ctx = vm.createContext({
    matchMedia: () => ({ matches: narrow, addEventListener() {} }),
    addEventListener() {},
    setTimeout, clearTimeout,
    DOMParser: class { parseFromString() { return { querySelectorAll: () => [] }; } },
    fetch: async (url) => {
      const name = url.replace(/^\/data\/|\.json$/g, '');
      if (!names.includes(name)) return { ok: false, json: async () => ({}), text: async () => '' };
      return ok(fixture(name));
    },
    document: { querySelectorAll: (sel) => { const k = sel.match(/data-home="(\w+)"/); return k && els[k[1]] ? [els[k[1]]] : []; } },
  });
  for (const file of ['site-data.js', 'charts.js', 'prs.js', 'home.js']) vm.runInContext(source(file), ctx);
  return els;
}

const ALL = ['outside_pr_list', 'org_stats', 'loop_counts', 'daily_activity', 'pipeline_counts'];

test('stats', async () => {
  const els = load(ALL);
  await settle();
  assert.equal(els.jobs.textContent, '1,380');
  assert.equal(els.per_job.textContent, '1.38');
  assert.equal(els.first_pass.textContent, '45%');
  assert.equal(els.first_pass_week.textContent, '53%');
  assert.equal(els.outside.textContent, '22');
  assert.match(els.days.textContent, /^\d+$/);
});

test('missing data leaves dashes', async () => {
  const els = load([]);
  await settle();
  for (const k of ['jobs', 'per_job', 'first_pass', 'outside', 'days']) assert.equal(els[k].textContent, '—', k);
  assert.equal(els.prs.innerHTML, undefined);
  assert.equal(els.loop.innerHTML, undefined);
});

test('tally', async () => {
  const els = load(ALL);
  await settle();
  const cells = [...els.tally.innerHTML.matchAll(/<b>(\d+)<\/b><span>(?:<i[^>]*><\/i>)?([^<]+)/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(cells, [['22', 'pull requests to 3 projects'], ['3', 'merged'], ['11', 'approved'], ['5', 'open'], ['3', 'closed without merging']]);
});

test('pr table collapses long groups', async () => {
  const els = load(ALL);
  await settle();
  const html = els.prs.innerHTML;
  assert.equal(html.match(/<tbody/g).length, 3);
  assert.equal(html.match(/<tr class="pr"/g).length, 22);
  assert.equal(html.match(/<tr class="pr" hidden/g).length, 10 + 3);
  assert.match(html, /Show 10 more from pay-kit/);
  assert.match(html, /Show 3 more from surfpool/);
  assert.match(html, /href="https:\/\/github.com\/samtools\/hts-specs\/pull\/874"/);
});

test('weekly chart marks partial weeks', async () => {
  const els = load(ALL);
  await settle();
  const svg = els.chart.innerHTML;
  assert.equal(svg.match(/class="cf-bar"/g).length, 6);
  assert.deepEqual([...svg.matchAll(/data-partial="(\d)"/g)].map((m) => m[1]), ['3', '2']);
  assert.match(svg, /partial: 3 of 7 days/);
  assert.match(svg, />Jobs finished</);
  assert.match(svg, />Week starting Monday</);
  assert.deepEqual([...svg.matchAll(/class="cf-label"[^>]*>([^<]+)/g)].map((m) => m[1]), ['17', '322', '409', '256', '349', '27']);
});

test('loop diagram', async () => {
  for (const narrow of [false, true]) {
    const els = load(ALL, { narrow });
    await settle();
    const svg = els.loop.innerHTML;
    assert.equal(svg.match(/class="back"/g).length, 4, 'one return per gate');
    for (const n of ['692', '278', '96', '109']) assert.match(svg, new RegExp('>' + n + ' sent back'));
    assert.match(svg, /<tspan class="n">113<\/tspan> filed, <tspan class="n">102<\/tspan> landed/);
    assert.doesNotMatch(svg, /CEO/);
  }
});
