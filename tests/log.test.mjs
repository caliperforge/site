import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const page = source('blog/index.html');
const between = (html, open) => { const a = html.indexOf(open); return html.slice(a, html.indexOf('</section>', a)); };
const daily = between(page, '<section class="log-daily"');
const arcs = between(page, '<section class="log-arcs"');
const archive = between(page, '<section class="log-archive"');
const exists = (href) => existsSync(new URL('../blog/' + href.replace(/^\/blog\//, '').replace(/(\.html)?$/, '.html'), import.meta.url));
const card = /<article class="cf-blog-card">\s*<p class="dateline">(\d{1,2} \w+ \d{4})<\/p>\s*<h2><a href="([^"]+)">([^<]+)<\/a><\/h2>\s*<p class="summary">([^<]+)<\/p>\s*<\/article>/g;

test('daily cards', () => {
  const cards = [...daily.matchAll(card)];
  assert.equal(cards.length, (daily.match(/<article/g) || []).length);
  assert.ok(cards.length >= 8);
  for (const [, date, href, title] of cards) {
    assert.ok(exists(href), href);
    assert.doesNotMatch(title, /^Learnings for/);
    assert.ok(Date.parse(date), date);
  }
  const dates = cards.map((c) => Date.parse(c[1]));
  assert.deepEqual([...dates].sort((a, b) => b - a), dates);
});

test('publisher anchors', () => {
  assert.ok(page.indexOf('<article class="cf-blog-card">') > page.indexOf('<section class="log-daily"'));
  assert.ok(page.indexOf('<article class="cf-blog-card">') < page.indexOf('<section class="log-archive"'));
  assert.ok(!archive.includes('cf-blog-card'));
  assert.ok(!arcs.includes('cf-blog-card'));
  assert.match(arcs, /<article class="cf-arc-card">/);
});

test('archive', () => {
  const links = [...archive.matchAll(/<li><a href="([^"]+)">[^<]+<\/a><span>([^<]+)<\/span><\/li>/g)];
  const posts = readdirSync(new URL('../blog/', import.meta.url)).filter((f) => /^\d\d_.*\.html$/.test(f));
  const linked = new Set([...page.matchAll(/href="(?:\/blog\/)?(\d\d_[^".]+)/g)].map((m) => m[1]));
  for (const f of posts) assert.ok(linked.has(f.replace('.html', '')), f);
  for (const [, href, date] of links) { assert.ok(exists(href), href); assert.ok(Date.parse(date), date); }
});

test('site shell', () => {
  assert.match(page, /<a href="\/blog\/" aria-current="page">Log<\/a>/);
  assert.match(page, /<link rel="stylesheet" href="\/site.css">/);
  assert.doesNotMatch(page, /\/output"|Start an engagement/);
});
