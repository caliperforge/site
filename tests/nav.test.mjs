import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const count = (html, s) => html.split(s).length - 1;
const LINK = '<a href="/astronomy">Astronomy</a>';
const LOC = '<loc>https://caliperforge.com/astronomy</loc>';
const pages = { 'index.html': '/', 'research.html': '/research', 'output.html': '/output', 'blog/index.html': '/blog/' };

function navLinksAstronomy(html, current) {
  const nav = html.match(/<nav class="site-nav"[^>]*>[^]*?<\/nav>/)[0];
  const at = nav.indexOf(LINK);
  return count(nav, LINK) === 1 && at > nav.indexOf('<a href="/output"') && at < nav.indexOf('<a href="/blog/"')
    && count(html, 'aria-current') === 1 && nav.includes(`<a href="${current}" aria-current="page">`);
}

test('each page nav links /astronomy once between Output and Log, and only its own link is current', () => {
  for (const [file, current] of Object.entries(pages)) {
    const html = source(file);
    assert.ok(navLinksAstronomy(html, current), file);
    assert.ok(!navLinksAstronomy(html.replace(LINK, ''), current), file);
    assert.ok(!navLinksAstronomy(html.replace(LINK, LINK + LINK), current), file);
    assert.ok(!navLinksAstronomy(html.replace(LINK, LINK + '<a href="/astronomy" aria-current="page">Astronomy</a>'), current), file);
    assert.ok(!navLinksAstronomy(html.replace(' aria-current="page"', ''), current), file);
  }
});

test('sitemap.xml lists /astronomy once, and a sitemap without it fails', () => {
  const sitemap = source('sitemap.xml');
  const listed = (xml) => count(xml, LOC) === 1;
  assert.ok(listed(sitemap));
  assert.ok(!listed(sitemap.replace(LOC, '')));
});
