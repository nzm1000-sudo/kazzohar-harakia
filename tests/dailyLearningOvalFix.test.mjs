import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const learningSource = readFileSync(fileURLToPath(new URL('../src/pages/LearningSearch.jsx', import.meta.url)), 'utf8');
const cssSource = readFileSync(fileURLToPath(new URL('../src/styles/base.css', import.meta.url)), 'utf8');

test('the real "הלימוד היומי" (Daily Learning) list renders each entry number via .index-number as the first child of .index-row', () => {
  assert.match(learningSource, /className="index-row" key=\{e\.ref\}/);
  assert.match(learningSource, /<span className="index-number">\{String\(i\+1\)\.padStart\(2,'0'\)\}<\/span>/, 'confirms the real DOM source of the 01/02/03… badges');
});

test('the generic .index-row>span:first-child rule (flex:1, meant for text labels) does not distend a leading .index-number badge into an oval', () => {
  const genericRule = cssSource.match(/\.index-row>span:first-child\{[^}]*\}/)?.[0];
  assert.ok(genericRule, 'the generic first-child rule still exists');
  assert.match(genericRule, /flex:1/);
  const overrideRule = cssSource.match(/\.index-row>span\.index-number:first-child\{[^}]*\}/)?.[0];
  assert.ok(overrideRule, 'a higher-specificity override for the number badge must exist');
  assert.match(overrideRule, /flex:0 0 30px/);
  assert.match(overrideRule, /width:30px/);
  assert.doesNotMatch(overrideRule, /flex:1(?!\d)/);
});

test('the .index-number badge itself stays a fixed 30x30 circle regardless of one- or two-digit content', () => {
  const badgeRule = cssSource.match(/\.index-number\{[^}]*\}/)?.[0];
  assert.match(badgeRule, /width:30px/);
  assert.match(badgeRule, /min-width:30px/);
  assert.match(badgeRule, /height:30px/);
  assert.match(badgeRule, /border-radius:50%/);
});
