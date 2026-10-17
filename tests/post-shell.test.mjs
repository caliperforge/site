import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const site = source('site.css');
const rules = (css) => [...css.replace(/\/\*[^]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)];
const classes = (selector) => selector.match(/(?<=\.)[\w-]+/g) ?? [];
const PAINT = /var\(--(navy|cream|gold)|rgba\((255, 255, 255|200, 168, 107)/;
const painted = new Set(rules(source('caliper.css')).filter(([, , body]) => PAINT.test(body)).flatMap(([, selector]) => classes(selector)));
const used = (html) => new Set([...html.matchAll(/class="([^"]*)"/g)].flatMap(([, list]) => list.split(/\s+/)));

function unstyled(html, css) {
  const named = new Set(rules(css).flatMap(([, selector]) => classes(selector)));
  return [...used(html)].filter((c) => painted.has(c) && !named.has(c) && !named.has(c.split('__')[0]));
}

const post29 = source('blog/29_learnings-for-2026-10-15.html');
const fixture = post29.replace(/<h1>[^]*<\/article>/, '<h1>Fixture</h1>\n<p class="dateline">Work completed 2026-10-16.</p>\n<h2>Fixture</h2>\n<p>Fixture.</p>\n</article>');
const posts = readdirSync(new URL('../blog/', import.meta.url))
  .filter((f) => /^\d\d_.*\.html$/.test(f))
  .map((f) => [f, source('blog/' + f)])
  .filter(([, html]) => html.includes('/caliper.css'));

test('every class caliper.css paints navy, cream or gold on a post or the fixture is restyled in site.css', () => {
  assert.notEqual(fixture, post29);
  for (const [name, html] of [...posts, ['fixture', fixture]]) assert.deepEqual(unstyled(html, site), [], name);
});

test('site.css without the navy band rule, or a fixture with an unnamed navy band, fails', () => {
  assert.deepEqual(unstyled(fixture, site.replace(/^\.cf-band--navy,[^\n]*\n/m, '')), ['cf-band--navy']);
  assert.deepEqual(unstyled(fixture.replace('class="cf-band--navy', 'class="cf-band--navy-2'), site), ['cf-band--navy-2']);
});

test('post 20 paints no navy surface and its tokens resolve to the shell', () => {
  const style = source('blog/20_nine-gates-zero-facts.html').match(/<style>([^]*?)<\/style>/)[1];
  assert.doesNotMatch(style, /background:var\(--ink/);
  assert.doesNotMatch(style, /rgba\(244,239,228/);
  assert.match(style.match(/:root\{([^}]*)\}/)[1], /^(\s*--[\w-]+:var\(--site-\w+\);)+\s*$/);
});
