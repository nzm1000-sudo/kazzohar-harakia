import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('../src/styles/base.css', import.meta.url)), 'utf8');
// Fixed-geometry graphics (calendar grid numerals, compass dial labels, brand line) keep their own sizes.
const FIXED = /compass-cardinals|prayer-compass-dial|prayer-target-marker|compass-mark|brand-name small|hebrew-cell|calendar-cell small|civil-number|^\s*\.weekday\s*$/;

test('global small-text tokens exist, honour a 15/16px floor and follow iOS Dynamic Type', () => {
  assert.match(css, /:root\{--font-ui-caption:max\(15px,\.88rem\);--font-ui-meta:max\(16px,\.94rem\);--font-ui-small:max\(16px,\.94rem\)\}/);
  assert.match(css, /@supports \(font:-apple-system-body\)\{html\{font:-apple-system-body\}\}/);
});

test('no UI rule sets text below 15px except fixed-geometry graphics', () => {
  const offenders = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selector, body]) => [...body.matchAll(/font-size:\s*([0-9.]+)px/g)].some(([, size]) => Number(size) < 15) && !FIXED.test(selector.trim()))
    .map(([, selector]) => selector.trim());
  assert.deepEqual(offenders, []);
  for (const file of ['../src/Tehillim.jsx', '../src/pages/ZmanimPage.jsx', '../src/NewApp.jsx']) {
    assert.doesNotMatch(readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8'), /fontSize: 1[0-4]\b/, file);
  }
});

test('zmanim names read at 17px beside 19px times, with captions on the token', () => {
  assert.match(css, /\.zman-row>div\{font-size:17px;line-height:1\.35\}/);
  assert.match(css, /\.zman-row small\{[^}]*font-size:var\(--font-ui-caption\)/);
  assert.match(css, /\.timeline-line\{[^}]*font-size:17px\}/);
  assert.match(css, /^small\{font-size:var\(--font-ui-caption\)\}$/m);
});
