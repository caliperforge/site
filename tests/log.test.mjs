import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const page = source('blog/index.html');
const css = source('blog/log.css');
const ARTICLE = '<article class="cf-blog-card">';
const shape = /<article class="cf-blog-card">\s*<h2><a href="([^"]+)">[^<]+<\/a><\/h2>\s*<p class="dateline">(\d{4}-\d{2}-\d{2})<\/p>\s*<p>[^]*?<\/p>\s*<\/article>/g;
const daily = (html) => html.match(/<section class="log-daily" aria-label="Daily entries">([^]*?)<\/section>/)[1];
const cards = (html) => [...daily(html).matchAll(shape)].map(([, href, date]) => ({ href, date }));
const count = (html, s) => html.split(s).length - 1;

function firstCardLeadsDaily(html) {
  const at = html.indexOf(ARTICLE);
  const open = html.indexOf('<section class="log-daily"');
  return html.indexOf('cf-blog-card') === at + '<article class="'.length
    && at > html.indexOf('<section class="log-arcs"') && at > open && at < html.indexOf('</section>', open);
}

test('the daily list holds posts 01 to 28 once each, newest dateline first, each linking an existing post', () => {
  const list = cards(page);
  assert.equal(count(page, ARTICLE), 28);
  assert.equal(list.length, 28);
  const numbers = list.map(({ href }) => href.match(/(\d\d)_/)[1]).sort();
  assert.deepEqual(numbers, Array.from({ length: 28 }, (_, i) => String(i + 1).padStart(2, '0')));
  for (let i = 1; i < list.length; i++) assert.ok(list[i].date <= list[i - 1].date, list[i].href);
  for (const { href } of list) {
    const file = href.replace(/^\/blog\//, '').replace(/(\.html)?$/, '.html');
    assert.ok(existsSync(new URL('../blog/' + file, import.meta.url)), href);
  }
});

test('the first cf-blog-card on the page is the first card in the daily list', () => {
  assert.ok(firstCardLeadsDaily(page));
  assert.ok(!firstCardLeadsDaily(page.replace('<main class="site-wrap log">', '<main class="site-wrap log cf-blog-cards">')));
  assert.deepEqual([...new Set(page.match(/<\w+ class="[^"]*cf-blog-card[^"]*"/g))], ['<article class="cf-blog-card"']);
});

test('a card inserted before the first cf-blog-card leads the daily list in the same shape', () => {
  const fixture = '<article class="cf-blog-card"><h2><a href="29_fixture.html">Fixture</a></h2><p class="dateline">2026-10-16</p><p></p></article>';
  const html = page.replace(ARTICLE, fixture + ARTICLE);
  assert.ok(daily(html).trimStart().startsWith(fixture));
  assert.equal(count(daily(html), ARTICLE), 29);
  assert.equal(cards(html).length, 29);
  assert.equal(cards(html)[0].href, '29_fixture.html');
});

test('the weekly arcs block is empty and hidden while empty', () => {
  assert.match(page, /<section class="log-arcs" aria-label="Weekly arcs"><\/section>/);
  assert.match(css, /\.log-arcs:empty \{ display: none; \}/);
});

test('the page is on the site shell with Log current and no address', () => {
  assert.match(page, /<link rel="stylesheet" href="\/site\.css">\n<link rel="stylesheet" href="\/blog\/log\.css">/);
  assert.doesNotMatch(page, /caliper\.css/);
  assert.match(page, /<a href="\/blog\/" aria-current="page">Log<\/a>/);
  assert.equal(count(page, 'aria-current'), 1);
  assert.match(page, /<footer class="site-footer">/);
  assert.doesNotMatch(page, /mailto:|@/);
});
