// iPad and other touch tablets: the desktop top nav overflowed at 13″ portrait and every landscape width, hiding items.
// Touch tablets share the phone's bottom tab bar and "עוד" sheet instead, and the day pages keep a readable measure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('../src/styles/base.css');

const block = (() => {
  const start = css.indexOf('@media (pointer:coarse) and (min-width:861px){');
  assert.ok(start >= 0, 'the touch-tablet block exists');
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(start, i + 1);
  }
  throw new Error('unterminated block');
})();

test('touch tablets get the tab bar and sheet, not the overflowing top nav', () => {
  assert.match(block, /\.shell-nav\{display:none\}/);
  assert.match(block, /\.tabbar\{display:flex;position:fixed/);
  assert.match(block, /\.more-menu\{position:relative;display:flex\}/);
  assert.match(block, /\.sheet\{position:fixed/);
  assert.match(block, /\.brand-name small\{display:none\}/, 'the brand subtitle no longer wraps beside the search');
  assert.match(block, /min-height:48px/, 'tab buttons keep the touch-target height');
});

test('the tablet block leaves mouse desktops and phones alone', () => {
  assert.ok(block.startsWith('@media (pointer:coarse) and (min-width:861px)'), 'coarse pointer and wider than the phone breakpoint only');
  assert.match(css, /@media \(max-width:860px\)\{[\s\S]*?\.shell-nav\{display:none\}/, 'the phone rules are unchanged');
});

test('Today, calendar and times keep a readable width on tablets', () => {
  assert.match(block, /\.today,\.calendar-page,\.zmanim-page\{max-width:820px;margin-inline:auto;width:100%\}/);
  assert.match(read('../src/pages/ZmanimPage.jsx'), /<div className="zmanim-page">/);
});
