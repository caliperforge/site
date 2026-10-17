import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const CALIPER = '<link rel="stylesheet" href="/caliper.css">';
const SITE = '<link rel="stylesheet" href="/site.css">';
const posts = readdirSync(new URL('../blog/', import.meta.url)).filter((file) => /^1[1-5]_.*\.html$/.test(file));
const source = (file) => readFileSync(new URL('../blog/' + file, import.meta.url), 'utf8');
const count = (html, s) => html.split(s).length - 1;
const linked = (html) => count(html, 'href="/caliper.css"') === 1 && count(html, 'href="/site.css"') === 1
  && html.includes(CALIPER + '\n' + SITE);

test('posts 11 to 15 are the five posts checked', () => {
  assert.equal(posts.length, 5);
});

test('each of posts 11 to 15 links /site.css once, straight after its one /caliper.css link', () => {
  for (const file of posts) assert.ok(linked(source(file)), file);
});

test('a second /site.css link, or one not straight after /caliper.css, fails', () => {
  const html = source(posts[0]);
  assert.ok(!linked(html.replace('</head>', SITE + '\n</head>')));
  assert.ok(!linked(html.replace(CALIPER + '\n' + SITE, SITE + '\n' + CALIPER)));
});
