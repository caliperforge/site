import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const POSTS = [
  'blog/01_caliperforge-origins.html',
  'blog/02_cf-invariants-anchor-on-crucible.html',
  'blog/03_cairo-references-expansion-and-chimera-template-pack.html',
  'blog/04_cf-invariants-jito-first-real-protocol-harnessed.html',
  'blog/05_jito-tippayment-and-ai-invariant-suggester-live.html',
  'blog/06_cf-invariants-sepolia-suite-expansion-6-to-12-and-ci-green.html',
  'blog/07_exploit-invariant-atlas.html',
  'blog/08_planted-twin-methodology.html',
  'blog/09_authentication-is-not-authorization.html',
  'blog/10_cross-layer-conservation-aztec.html',
];

for (const file of POSTS) {
  test(`${file} links /site.css once, on the line after /caliper.css`, () => {
    const page = source(file);
    assert.match(page, /<link rel="stylesheet" href="\/caliper\.css">\n<link rel="stylesheet" href="\/site\.css">/);
    assert.equal(page.split('/site.css').length - 1, 1);
    assert.equal(page.split('/caliper.css').length - 1, 1);
  });
}
