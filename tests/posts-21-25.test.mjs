import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const posts = readdirSync(new URL('../blog/', import.meta.url)).filter((f) => /^2[1-5]_.*\.html$/.test(f));
const CALIPER = '<link rel="stylesheet" href="/caliper.css">';
const SITE = '<link rel="stylesheet" href="/site.css">';
const count = (html, s) => html.split(s).length - 1;
const linked = (html) => /<link rel="stylesheet" href="\/caliper\.css">\n<link rel="stylesheet" href="\/site\.css">/.test(html)
  && count(html, '/caliper.css') === 1 && count(html, '/site.css') === 1;

test('posts 21 to 25 link /site.css on the line after /caliper.css, each once', () => {
  assert.equal(posts.length, 5);
  for (const file of posts) assert.ok(linked(source('blog/' + file)), file);
});

test('a post with /site.css missing, first, or not on the next line fails', () => {
  const html = source('blog/' + posts[0]);
  assert.ok(!linked(html.replace(SITE + '\n', '')));
  assert.ok(!linked(html.replace(CALIPER + '\n' + SITE, SITE + '\n' + CALIPER)));
  assert.ok(!linked(html.replace(CALIPER + '\n' + SITE, CALIPER + '\n\n' + SITE)));
});
