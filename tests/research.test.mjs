import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const ok = (body) => ({ ok: true, json: async () => body });
const notOk = { ok: false, json: async () => ({}) };
const settle = () => new Promise((resolve) => setImmediate(resolve));

const timeline = JSON.parse(source('tests/fixtures/timeline.json'));
const touches = JSON.parse(source('tests/fixtures/ceo_touches.json'));
const perJob = JSON.parse(source('tests/fixtures/tokens_per_landed_job.json'));

class El {
  constructor(tag, props = {}) {
    this.tag = tag;
    this.className = '';
    this.nodes = [];
    Object.assign(this, props);
  }
  set innerHTML(html) { this.nodes = [{ html }]; }
  set textContent(text) { this.nodes = text === '' ? [] : [String(text)]; }
  get textContent() {
    return this.nodes.map((n) => (typeof n === 'string' ? n : n.html ?? n.textContent)).join('');
  }
  append(...nodes) { this.nodes.push(...nodes); }
  get outerHTML() {
    const inner = this.nodes.map((n) => (typeof n === 'string' ? n : n.html ?? n.outerHTML)).join('');
    return '<' + this.tag + (this.className ? ' class="' + this.className + '"' : '') + '>' + inner + '</' + this.tag + '>';
  }
}

function research(responses) {
  const sections = {};
  for (const key of Object.keys(responses)) sections[key] = new El('section', { dataset: { metric: key }, clientWidth: 656 });
  const ctx = vm.createContext({
    document: { querySelectorAll: () => Object.values(sections), createElement: (tag) => new El(tag) },
    fetch: async (url) => {
      const r = responses[url.slice('/data/'.length, -'.json'.length)];
      if (r instanceof Error) throw r;
      return r;
    },
    getComputedStyle: () => ({ paddingLeft: '28px', paddingRight: '28px' }),
    ResizeObserver: class { constructor(cb) { this.cb = cb; } observe() { this.cb(); } },
  });
  for (const file of ['charts.js', 'research.js']) vm.runInContext(source(file), ctx);
  return sections;
}

test('the timeline lists one item per row in file order under its title, flagging v1 rows only', async () => {
  const { timeline: section } = research({ timeline: ok(timeline) });
  await settle();
  assert.equal(section.nodes[0].outerHTML, '<h4>The path, by version</h4>');
  const items = section.nodes[1].nodes;
  assert.equal(section.nodes[1].className, 'cf-timeline');
  assert.deepEqual(items.map((li) => [li.nodes[0].textContent, li.nodes[1].nodes[1].textContent]),
    timeline.rows.map((r) => [r[0], r[2]]));
  items.forEach((li, i) => {
    assert.equal(li.outerHTML.includes('<span class="cf-flag">earlier measurement</span>'), timeline.rows[i][1] === 'v1');
  });
});

test('timeline dates are YYYY-MM-DD, never descend, and hold the ruled v2 milestones', () => {
  const dates = timeline.rows.map((r) => r[0]);
  for (const d of dates) assert.match(d, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(dates, [...dates].sort());
  assert.deepEqual(timeline.rows.filter((r) => r[1] === 'v2').map((r) => r[0]),
    ['2026-09-15', '2026-09-17', '2026-09-24', '2026-09-24', '2026-10-14']);
});

test('tokens per landed job compares the first and last week after the chart', async () => {
  const rows = (first, last) => [perJob.rows[0].with(2, first), ...perJob.rows.slice(1, -1), perJob.rows.at(-1).with(2, last)];
  const fall = research({ tokens_per_landed_job: ok({ ...perJob, rows: rows(8e6, 2e6) }) });
  const rise = research({ tokens_per_landed_job: ok({ ...perJob, rows: rows(2e6, 3e6) }) });
  await settle();
  const nodes = fall.tokens_per_landed_job.nodes;
  assert.deepEqual(nodes.slice(1).map((n) => n.className), ['cf-compare', 'cf-def', 'cf-caveat']);
  assert.equal(nodes[1].textContent,
    'First week (2026-09-14): 8.0M tokens per landed job. Current week (2026-10-12): 2.0M. −75%');
  assert.match(rise.tokens_per_landed_job.nodes[1].textContent, /: 3\.0M\. \+50%$/);
});

test('human touches draws one labelled column per day', async () => {
  const { ceo_touches: section } = research({ ceo_touches: ok(touches) });
  await settle();
  const svg = section.nodes[0].html;
  assert.equal(touches.rows.length, 23);
  assert.equal(svg.match(/class="cf-label"/g).length, 23);
  assert.match(svg, /aria-label="Human touches"/);
});

test('a timeline or ceo_touches that is not ok or rejects leaves the load error and draws nothing', async () => {
  for (const key of ['timeline', 'ceo_touches']) {
    for (const r of [notOk, new Error('offline')]) {
      const sections = research({ [key]: r });
      await settle();
      assert.deepEqual(sections[key].nodes, ['Could not load data/' + key + '.json']);
    }
  }
});

test('research.js writes no date or label of its own', () => {
  assert.doesNotMatch(source('research.js'), /2026-|earlier measurement/);
});

test('research.html places timeline after token_mix and ceo_touches after tokens_per_landed_job', () => {
  assert.deepEqual([...source('research.html').matchAll(/data-metric="(\w+)"/g)].map((m) => m[1]), [
    'gate_verdicts', 'plan_outcomes', 'daily_activity', 'runs_by_seat', 'token_mix',
    'timeline', 'tokens_per_landed_job', 'ceo_touches',
  ]);
});
