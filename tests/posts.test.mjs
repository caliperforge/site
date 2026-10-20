import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const posts = readdirSync(new URL('../blog/', import.meta.url)).filter((f) => /^\d\d_.*\.html$/.test(f));
const read = (f) => readFileSync(new URL('../blog/' + f, import.meta.url), 'utf8');
const count = (html, s) => html.split(s).length - 1;

test('site shell', () => {
  for (const f of posts) {
    const html = read(f);
    assert.equal(count(html, 'href="/site.css"'), 1, f);
    assert.match(html, /<a (href="\/blog\/" aria-current="page"|aria-current="page" href="\/blog\/")>Log<\/a>/, f);
    assert.match(html, /<a href="\/work">Work<\/a>/, f);
    assert.doesNotMatch(html, /caliper\.css|cf-opstrip|Start an engagement|href="\/what-we-caught"/, f);
  }
});

test('one headline', () => {
  for (const f of posts) assert.equal(count(read(f), '<h1'), 1, f);
});

test('dated', () => {
  for (const f of posts.filter((f) => !f.startsWith('20_'))) {
    const m = read(f).match(/The log<\/a> · (\d{1,2} \w+ \d{4})<\/p>/);
    assert.ok(m && Date.parse(m[1]), f);
  }
});

test('daily notes in plain form', () => {
  for (const f of posts.filter((f) => +f.slice(0, 2) >= 24)) {
    const html = read(f);
    assert.doesNotMatch(html, /\[(refusal|landed):\d+\]/, f);
    assert.doesNotMatch(html, /<h1>Learnings for/, f);
    assert.match(html, /<p class="post-lede">[^<]+<\/p>/, f);
  }
});
