import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const ok = (body) => ({ ok: true, json: async () => body });
const notOk = { ok: false, json: async () => ({}) };
const settle = () => new Promise((resolve) => setImmediate(resolve));

const daily = ok({
  columns: ['day', 'runs', 'input_tokens', 'cache_read_tokens', 'cache_write_tokens', 'output_tokens', 'total_tokens'],
  rows: [
    ['2026-10-01', 3, 0, 0, 0, 0, 1500000],
    ['2026-10-02', 4, 0, 0, 0, 0, 2600000],
  ],
});
const plans = ok({
  columns: ['template', 'state', 'count'],
  rows: [['pr_path', 'queued', 5], ['pr_path', 'done', 1143]],
});
const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
const org = ok({ launch_date: twoDaysAgo });

function load(responses, files) {
  const calls = [];
  const els = {};
  for (const key of ['runs', 'tokens', 'plans', 'days', 'first_day']) els[key] = { textContent: '—' };
  const ctx = vm.createContext({
    fetch: async (url) => {
      calls.push(url);
      const r = responses[url.slice('/data/'.length, -'.json'.length)];
      if (r instanceof Error) throw r;
      return r;
    },
    document: { querySelectorAll: (sel) => [els[sel.match(/data-home="(\w+)"/)[1]]] },
  });
  for (const file of files) vm.runInContext(source(file), ctx);
  return { ctx, calls, els };
}

const home = (responses) => load(responses, ['site-data.js', 'home.js']).els;

test('fills runs, tokens, plans, days and first_day from the data files', async () => {
  const els = home({ daily_activity: daily, plan_outcomes: plans, org_stats: org });
  await settle();
  assert.equal(els.runs.textContent, '7');
  assert.equal(els.tokens.textContent, '4M');
  assert.equal(els.plans.textContent, '1,143');
  assert.equal(els.days.textContent, '3');
  assert.equal(els.first_day.textContent, '2026-10-01');
});

test('a plan_outcomes that is not ok leaves plans at a dash and fills the rest', async () => {
  const els = home({ daily_activity: daily, plan_outcomes: notOk, org_stats: org });
  await settle();
  assert.equal(els.plans.textContent, '—');
  assert.equal(els.runs.textContent, '7');
  assert.equal(els.tokens.textContent, '4M');
  assert.equal(els.days.textContent, '3');
});

test('an org_stats fetch that rejects leaves days at a dash', async () => {
  const els = home({ daily_activity: daily, plan_outcomes: plans, org_stats: new Error('offline') });
  await settle();
  assert.equal(els.days.textContent, '—');
  assert.equal(els.plans.textContent, '1,143');
});

test('no pr_path/done row leaves plans at a dash', async () => {
  const els = home({
    daily_activity: daily,
    plan_outcomes: ok({ columns: ['template', 'state', 'count'], rows: [['pr_path', 'queued', 5]] }),
    org_stats: org,
  });
  await settle();
  assert.equal(els.plans.textContent, '—');
});

test('siteData fetches a name once', async () => {
  const { ctx, calls } = load({ org_stats: org }, ['site-data.js']);
  const [a, b] = await Promise.all([ctx.siteData('org_stats'), ctx.siteData('org_stats')]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0], '/data/org_stats.json');
  assert.equal(a, b);
  assert.equal(a.launch_date, twoDaysAgo);
});

test('siteData resolves null on a non-ok response, a network error or bad JSON', async () => {
  const badJson = { ok: true, json: async () => { throw new SyntaxError('bad'); } };
  const { ctx } = load({ a: notOk, b: new Error('offline'), c: badJson }, ['site-data.js']);
  assert.equal(await ctx.siteData('a'), null);
  assert.equal(await ctx.siteData('b'), null);
  assert.equal(await ctx.siteData('c'), null);
});
