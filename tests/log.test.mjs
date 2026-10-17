import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const page = source('blog/index.html');
const css = source('blog/log.css');
const ARTICLE = '<article class="cf-blog-card">';
const shape = /<article class="cf-blog-card">\s*<h2><a href="([^"]+)">[^<]+<\/a><\/h2>\s*<p class="dateline">(\d{4}-\d{2}-\d{2})<\/p>\s*<p>[^]*?<\/p>\s*<\/article>/g;
const daily = (html) => html.match(/<section class="log-daily" aria-label="Daily entries">([^]*?)<\/section>/)[1];
const cards = (html) => [...daily(html).matchAll(shape)].map(([, href, date]) => ({ href, date }));
const count = (html, s) => html.split(s).length - 1;
const posts = readdirSync(new URL('../blog/', import.meta.url)).filter((f) => /^\d\d_.*\.html$/.test(f));

function firstCardLeadsDaily(html) {
  const at = html.indexOf(ARTICLE);
  const open = html.indexOf('<section class="log-daily"');
  return html.indexOf('cf-blog-card') === at + '<article class="'.length
    && at > html.indexOf('<section class="log-arcs"') && at > open && at < html.indexOf('</section>', open);
}

test(`the daily list holds posts 01 to ${posts.length} once each, newest dateline first, each linking an existing post`, () => {
  const list = cards(page);
  assert.equal(count(page, ARTICLE), posts.length);
  assert.equal(list.length, posts.length);
  const numbers = list.map(({ href }) => href.match(/(\d\d)_/)[1]).sort();
  assert.deepEqual(numbers, Array.from({ length: posts.length }, (_, i) => String(i + 1).padStart(2, '0')));
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
  const href = String(posts.length + 1).padStart(2, '0') + '_fixture.html';
  const fixture = `<article class="cf-blog-card"><h2><a href="${href}">Fixture</a></h2><p class="dateline">2026-10-16</p><p></p></article>`;
  const html = page.replace(ARTICLE, fixture + ARTICLE);
  assert.ok(daily(html).trimStart().startsWith(fixture));
  assert.equal(count(daily(html), ARTICLE), posts.length + 1);
  assert.equal(cards(html).length, posts.length + 1);
  assert.equal(cards(html)[0].href, href);
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

test('posts 16 to 20 link /site.css once, after caliper.css and before any inline style', () => {
  const SITE = '<link rel="stylesheet" href="/site.css">';
  const posts = ['16_the-gate-that-caught-the-secret-scan-gap', '17_multi-seed-reachability-hardening', '18_uniswap-v4-hook-census', '19_the-clean-zero-gate', '20_nine-gates-zero-facts'];
  for (const name of posts) {
    const post = source(`blog/${name}.html`);
    assert.equal(count(post, '/site.css'), 1, name);
    assert.ok(!post.includes('<style') || post.indexOf(SITE) < post.indexOf('<style'), name);
    if (name.startsWith('20_')) {
      assert.equal(post.indexOf('<style'), post.indexOf(SITE + '\n<style>') + SITE.length + 1, name);
      assert.doesNotMatch(post, /caliper\.css/, name);
    } else {
      assert.ok(post.includes('<link rel="stylesheet" href="/caliper.css">\n' + SITE), name);
    }
  }
});

test('every post links /site.css once, and a post without it fails', () => {
  const SITE = '<link rel="stylesheet" href="/site.css">';
  const linked = (html) => count(html, SITE) === 1;
  for (const f of posts) assert.ok(linked(source('blog/' + f)), f);
  assert.ok(!linked(source('blog/' + posts[0]).replace(SITE, '')));
});
