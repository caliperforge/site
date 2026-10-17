import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const ok = (body) => ({ ok: true, json: async () => body });
const notOk = { ok: false, json: async () => ({}) };
const settle = () => new Promise((resolve) => setImmediate(resolve));

const prs = JSON.parse(source('data/outside_prs.json'));
const plans = JSON.parse(source('data/plan_outcomes.json'));

function output(responses, narrow = false) {
  const els = {};
  for (const key of ['grid', 'classes', 'shipped']) els[key] = { textContent: '—' };
  const ctx = vm.createContext({
    matchMedia: () => ({ matches: narrow, addEventListener() {} }),
    fetch: async (url) => {
      const r = responses[url.slice('/data/'.length, -'.json'.length)];
      if (r instanceof Error) throw r;
      return r;
    },
    document: { querySelectorAll: (sel) => [els[sel.match(/data-output="(\w+)"/)[1]]] },
  });
  for (const file of ['site-data.js', 'output.js']) vm.runInContext(source(file), ctx);
  return els;
}

test('draws one dot per pull request plus one legend dot per state, with counts', async () => {
  const els = output({ outside_prs: ok(prs) });
  await settle();
  const html = els.grid.innerHTML;
  assert.equal(html.match(/<circle/g).length, 26 + 4);
  assert.match(html, /aria-label="26 pull requests by state"/);
  assert.match(html, />3 merged upstream</);
  assert.match(html, />11 open, approved by a maintainer</);
  assert.match(html, />8 open, not yet approved</);
  assert.match(html, />4 closed</);
});

test('lists merged and approved counts for each class', async () => {
  const els = output({ outside_prs: ok(prs) });
  await settle();
  assert.match(els.classes.innerHTML, /<li>payments SDK: 0 merged, 11 approved<\/li>/);
  assert.match(els.classes.innerHTML, /<li>other: 3 merged, 0 approved<\/li>/);
});

test('an unseen class gets its own line, and no class is written in output.js', async () => {
  const els = output({ outside_prs: ok({ ...prs, rows: [...prs.rows, ['open', 'wallets', '2026-10']] }) });
  await settle();
  assert.match(els.classes.innerHTML, /<li>wallets: 0 merged, 0 approved<\/li>/);
  assert.doesNotMatch(source('output.js'), /payments SDK|other|wallets/);
});

test('columns in another order give the same grid and classes', async () => {
  const same = output({ outside_prs: ok(prs) });
  const moved = output({
    outside_prs: ok({ ...prs, columns: ['month', 'class', 'state'], rows: prs.rows.map(([s, c, m]) => [m, c, s]) }),
  });
  await settle();
  assert.equal(moved.grid.innerHTML, same.grid.innerHTML);
  assert.equal(moved.classes.innerHTML, same.classes.innerHTML);
});

test('an outside_prs that is not ok or rejects leaves grid and classes at a dash', async () => {
  for (const r of [notOk, new Error('offline')]) {
    const els = output({ outside_prs: r });
    await settle();
    for (const key of ['grid', 'classes']) {
      assert.equal(els[key].textContent, '—');
      assert.equal(els[key].innerHTML, undefined);
    }
  }
});

test('lists one line per done plan template, and a dash when plan_outcomes is not ok', async () => {
  const els = output({ plan_outcomes: ok(plans) });
  const missing = output({ plan_outcomes: notOk });
  await settle();
  assert.equal(els.shipped.innerHTML,
    '<ul><li>20 comms plans done</li><li>1,271 pr_path plans done</li><li>3 research plans done</li></ul>');
  assert.equal(missing.shipped.textContent, '—');
  assert.equal(missing.shipped.innerHTML, undefined);
});

test('wraps to 10 dots per line at phone width and 20 otherwise', async () => {
  const wide = output({ outside_prs: ok(prs) }, false);
  const narrow = output({ outside_prs: ok(prs) }, true);
  await settle();
  assert.match(wide.grid.innerHTML, /viewBox="0 0 600 /);
  assert.match(narrow.grid.innerHTML, /viewBox="0 0 300 /);
});

test('the figcaption holds the caveat as the file gives it', async () => {
  const els = output({ outside_prs: ok(prs) });
  await settle();
  assert.ok(els.grid.innerHTML.endsWith('<figcaption>' + prs.caveat + '</figcaption>'));
});
