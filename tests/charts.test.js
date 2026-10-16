import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ctx = {};
vm.runInNewContext(fs.readFileSync(new URL('../charts.js', import.meta.url), 'utf8'), ctx);
const { CFChart } = ctx;

const metric = {
  metric: 'fixture',
  title: 'Fixture tokens',
  columns: ['day', 'kind', 'tokens'],
  rows: [['2026-09-23', 'idle', 0], ['2026-09-24', 'busy', 1234567], ['2026-09-25', 'busy', 340123]]
};
const opts = { label: ['day', 'kind'], value: 'tokens', labelTitle: 'Day and kind', valueTitle: 'Tokens', width: 600 };

const count = (svg, cls) => svg.split('class="' + cls + '"').length - 1;

test('every row gets one data label, under a title, two axis titles and labelled gridlines', () => {
  for (const kind of ['bar', 'column']) {
    const svg = CFChart.render(metric, { ...opts, kind });
    const labels = [...svg.matchAll(/class="cf-label"[^>]*>([^<]*)</g)].map((m) => m[1]);
    assert.deepEqual(labels, ['0', '1.2M', '340K']);
    assert.match(svg, /class="cf-title"[^>]*>Fixture tokens</);
    assert.match(svg, /class="cf-axis"[^>]*>Day and kind</);
    assert.match(svg, /class="cf-axis"[^>]*>Tokens</);
    assert.ok(count(svg, 'cf-grid') > 1);
    assert.equal(count(svg, 'cf-tick'), count(svg, 'cf-grid'));
  }
});

test('a narrow width draws at 1:1 and keeps a label on every row', () => {
  const long = { ...metric, rows: [...metric.rows, ...metric.rows, ...metric.rows, ...metric.rows] };
  const svg = CFChart.render(long, { ...opts, kind: 'column', width: 200 });
  assert.match(svg, /^<svg width="200" height="(\d+)" viewBox="0 0 200 \1"/);
  assert.equal(count(svg, 'cf-label'), long.rows.length);
  assert.doesNotMatch(svg, /rotate\(-45/);
  assert.doesNotMatch(svg, /width="-/);
  const ticks = [...svg.matchAll(/class="cf-tick" x="([\d.]+)"[^>]*>([^<]*)</g)];
  ticks.slice(1).forEach((m, i) => assert.ok(m[1] - ticks[i][1] >= 7 * Math.max(m[2].length, ticks[i][2].length)));
  assert.doesNotMatch(CFChart.render(metric, { ...opts, kind: 'column', width: 160 }), /rotate\(-45/);
});

test('format picks the unit after rounding', () => {
  assert.equal(CFChart.format(1234567), '1.2M');
  assert.equal(CFChart.format(340123), '340K');
  assert.equal(CFChart.format(2113485301), '2.1B');
  assert.equal(CFChart.format(999999), '1.0M');
  assert.equal(CFChart.format(1143), '1,143');
});

test('an unknown column throws', () => {
  assert.throws(() => CFChart.render(metric, { ...opts, kind: 'bar', value: 'nope' }), { message: 'fixture: no column nope' });
  assert.throws(() => CFChart.render(metric, { ...opts, kind: 'bar', label: ['nope'] }), { message: 'fixture: no column nope' });
});
