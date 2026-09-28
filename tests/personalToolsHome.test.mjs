// Personal tools: "דף שבת" leads the list, every row is one title line and one description line (equal boxes),
// and each baby name opens "הפסוק שלי" searched for that name by the agreed rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findNameVerses, findVersesContainingName } from '../src/services/personalTools.mjs';

const page = readFileSync(new URL('../src/pages/PersonalTools.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8');

test('the tools home lists דף שבת first, in one uniform row shape', () => {
  const rows = [...page.slice(page.indexOf('function PersonalToolsHome')).matchAll(/\['(#[^']+)', '([^']+)', '([^']+)'/g)].map(match => match[2]);
  assert.deepEqual(rows, ['דף שבת', 'מועדפים וסימניות', 'המסורת שלי', 'הפרשה שלי', 'ממיר תאריכים', 'הפסוק שלי', 'שמות לתינוקות', 'מחשבון גימטריה', 'מצב נסיעה יהודי']);
  assert.match(css, /\.personal-tools-home>\.personal-tool-row strong,\.personal-tools-home>\.personal-tool-row small\{white-space:nowrap;overflow:hidden;text-overflow:ellipsis\}/);
  assert.match(page, /\\u2708\\uFE0E/, 'the plane is a text glyph like the other icons, not a colour emoji');
});

test('a baby name opens הפסוק שלי for that name, searched at once without touching the saved profile', () => {
  assert.match(page, /window\.location\.hash = `#personal-tools\/verse\/\$\{encodeURIComponent\(item\.name\)\}`;[^>]*>הפסוק שלי<\/button>/);
  assert.match(page, /<MyVerse key=\{route\} nameFromRoute=\{safeDecode\(route\.split\('\/'\)\[2\]\)\}/);
  assert.match(page, /useState\(nameFromRoute \|\| profile\.personalHebrewName \|\| ''\)/);
  assert.doesNotMatch(page, /פסוקים לשם/);
  // The rule the verse page applies: first and last letter of the name, then verses that contain the name.
  assert.ok(findNameVerses('דוד').length > 0);
  assert.ok(findVersesContainingName('דוד').length > 0);
});
