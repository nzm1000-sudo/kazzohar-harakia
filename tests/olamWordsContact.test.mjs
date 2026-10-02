// The owner's fifth round: the rank path headed "אִתְעַלִּי"; "אורות עגולים" and "מעגלי עולם" without a "0" and without
// "עוד" ("5 מעגלים למלכות"), while Today keeps its line; "המעגל הרוחני" set apart among the categories; and "יצירת קשר"
// in אודות, which the accessibility report now uses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadJsx } from './helpers/jsx.mjs';
import { circlesLabel, circlesTo, olamSpoken, rankFor, remainingShort, remainingTo } from '../src/services/spiritualCircle.mjs';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const store = new Map();
globalThis.localStorage ??= { getItem: key => (store.has(key) ? store.get(key) : null), setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key) };
globalThis.window ??= globalThis;
globalThis.history ??= { state: null, back() {}, replaceState() {}, pushState() {} };
const visible = html => html.replace(/ aria-label="[^"]*"/g, '').replace(/<[^>]+>/g, ' ');

test('the words: no "0", no "עוד" — "5 מעגלים למלכות"; Today\'s helpers unchanged', () => {
  assert.deepEqual([circlesLabel(0), circlesLabel(1), circlesLabel(3)], ['מעגלים', 'מעגל אחד', '3 מעגלים']);
  assert.equal(remainingTo(rankFor(0)), '5 מעגלים למלכות');
  assert.equal(remainingTo(rankFor(325)), '75 מעגלים לחכמה');
  assert.equal(remainingTo(rankFor(4)), 'מעגל אחד למלכות');
  assert.equal(circlesTo(2, 'נצח'), '2 מעגלים לנצח');
  assert.equal(remainingShort(rankFor(3)), 'עוד 2 למלכות', 'Today\'s line keeps its words');
  assert.equal(olamSpoken(rankFor(0), 'מעגלי עולם'), 'מעגלי עולם. הושלמו 0 מעגלים. נותרו 5 מעגלים לדרגת מלכות.', 'Today\'s spoken sentence unchanged');
  assert.equal(olamSpoken(rankFor(0), 'אורות עגולים', { zeroless: true }), 'אורות עגולים. נותרו 5 מעגלים לדרגת מלכות.');
});

test('"אורות עגולים" at 0 and at 3: the label alone at zero, the way ahead without "עוד"', () => {
  const { OlamCard } = loadJsx('components/OlamCircles.jsx');
  const zero = renderToStaticMarkup(React.createElement(OlamCard, { lifetime: 0, onOpen: () => {} }));
  assert.match(zero, /<span class="olam-card-count" aria-hidden="true">מעגלים<\/span>/);
  assert.match(zero, /<span class="olam-card-next" aria-hidden="true">5 מעגלים למלכות<\/span>/);
  assert.doesNotMatch(visible(zero), /\b0\b|0 מעגלים|עוד/);
  assert.doesNotMatch(zero, /הושלמו 0/, 'nor spoken');
  const three = renderToStaticMarkup(React.createElement(OlamCard, { lifetime: 3, onOpen: () => {} }));
  assert.match(three, />3 מעגלים</); assert.match(three, />2 מעגלים למלכות</);
  assert.doesNotMatch(visible(three), /עוד/);
});

test('"מעגלי עולם": the path headed "אִתְעַלִּי", no "0" and no "עוד" in its words', () => {
  const { default: OlamPage } = loadJsx('pages/OlamPage.jsx');
  const draw = lifetime => renderToStaticMarkup(React.createElement(OlamPage, { ring: { lifetime }, onBack: () => {} }));
  const zero = draw(0);
  assert.match(zero, /<h2 id="olam-path-title" class="olam-path-title">אִתְעַלִּי<\/h2>/);
  assert.doesNotMatch(zero, /דרך הדרגות/);
  assert.match(zero, /<p class="olam-page-count">מעגלים<\/p>/);
  assert.match(zero, /<p class="olam-page-next">5 מעגלים למלכות<\/p>/);
  // Round 3 (owner): the way to the next rank is said once, in the hero — the path no longer repeats it under that rank.
  assert.doesNotMatch(zero, /<span class="olam-step-note">5 מעגלים למלכות<\/span>/, 'no duplicate of the hero\'s line on the path');
  assert.equal((visible(zero).match(/5 מעגלים למלכות/g) || []).length, 1, 'said once');
  for (const lifetime of [0, 3, 325]) {
    const words = visible(draw(lifetime));
    assert.doesNotMatch(words, /עוד/, `${lifetime}: no "עוד"`);
    assert.doesNotMatch(words, /(^|\s)0 מעגלים/, `${lifetime}: no "0 מעגלים"`);
  }
  assert.match(draw(325), /<p class="olam-page-count">325 מעגלים הושלמו<\/p>/);
  assert.match(draw(325), /<p class="olam-page-next">75 מעגלים לחכמה<\/p>/);
});

test('Today\'s seal line speaks like the rest (owner, 2026-09-30): no "0", no "עוד"; TodayPage itself unchanged', () => {
  const { OlamHomeLine } = loadJsx('components/OlamCircles.jsx');
  const home = renderToStaticMarkup(React.createElement(OlamHomeLine, { lifetime: 3, onOpen: () => {} }));
  assert.match(home, />שלושה מעגלים</);
  const zero = renderToStaticMarkup(React.createElement(OlamHomeLine, { lifetime: 0, onOpen: () => {} }));
  assert.match(zero, /class="olam-home-count is-centred">ללא מעגלים</);
  assert.doesNotMatch(home + zero, /למלכות/, 'Today (owner, 2026-10-01): no way-ahead line, for symmetry');
  assert.doesNotMatch(home + zero, /עוד|>0 מעגלים</);
  assert.doesNotMatch(zero, /הושלמו 0/, 'nothing is said of a zero count');
  const today = read('../src/pages/TodayPage.jsx');
  assert.doesNotMatch(today, /nav-circle|circlesLabel|remainingTo|CompletionButton/);
});

test('"המעגל הרוחני" set apart among the categories in every list by its name alone — in the palette\'s accent colour and bold — the owner kept it bold as the one exception to the type scale (2026-09-30, reaffirmed 2026-10-01)', () => {
  const shell = read('../src/components/Shell.jsx');
  assert.match(shell, /export const CIRCLE_ENTRY = 'mitzvot-journal';/);
  assert.match(shell, /\['mitzvot-journal','המעגל הרוחני'\]/, 'the label stays');
  assert.doesNotMatch(shell, /nav-circle-ring|nav-circle-label/, 'no ring beside the name');
  assert.equal((shell.match(/<EntryLabel id=\{id\} label=\{label\} \/>/g) || []).length, 3, 'top bar, its overflow menu, the mobile sheet');
  assert.equal((shell.match(/circleClass\(id\)/g) || []).length, 3);
  const css = read('../src/styles/base.css');
  assert.doesNotMatch(css, /nav-circle-ring|nav-circle-label/);
  const rules = css.match(/[^{}]*\.nav-circle[^{}]*\{[^}]*\}/g) || [];
  assert.equal(rules.length, 1, 'one rule for the entry');
  assert.match(rules[0], /\.more-menu \.sheet button\.nav-circle,\.shell-nav button\.nav-circle:not\(\.on\)\{color:var\(--accent\);font-weight:700\}/);
  assert.doesNotMatch(rules[0], /background|box-shadow|border/, 'no tint, frame or border');
  assert.equal((css.match(/--accent:/g) || []).length, 8, 'all eight themes define the colour the entry takes');
});

test('אודות: "יצירת קשר" — the invitation, the address and the phone, as links', () => {
  const about = read('../src/pages/AboutPage.jsx');
  assert.match(about, /<AboutSection title="יצירת קשר" className="about-contact">/);
  const { default: AboutPage } = loadJsx('pages/AboutPage.jsx');
  const html = renderToStaticMarkup(React.createElement(AboutPage, { onNav: () => {} }));
  const section = html.slice(html.indexOf('<section class="about-fold about-contact">'));
  assert.match(section, /<span>יצירת קשר<\/span>/);
  assert.match(section, /<p class="about-contact-lead">לתגובות, הארות והערות:<\/p>/);
  assert.match(section, /<a href="mailto:haravbar@gmail\.com" dir="ltr">haravbar@gmail\.com<\/a>/);
  assert.match(section, /טלפון: <a href="tel:0585006004" dir="ltr">058-500-600-4<\/a>/);
  const css = read('../src/styles/base.css');
  assert.match(css, /\.about-contact \.about-fold-body:not\(\[hidden\]\)\{display:grid;justify-items:center;[^}]*text-align:center\}/, 'centred, and still closed until opened');
});

test('only the owner\'s public address is in the app', () => {
  const walk = dir => readdirSync(dir).flatMap(name => { const full = `${dir}/${name}`; return statSync(full).isDirectory() ? (name === '.kilo' ? [] : walk(full)) : [full]; });
  const files = walk(fileURLToPath(new URL('../src', import.meta.url))).filter(file => /\.(jsx?|mjs|css)$/.test(file));
  for (const file of files) assert.doesNotMatch(readFileSync(file, 'utf8'), /nizoza369/, file);
});

test('Today\'s count in Hebrew words under 100, digits from 100 (owner, 2026-10-01)', async () => {
  const { hebrewCircles } = await import('../src/services/spiritualCircle.mjs');
  assert.deepEqual([0, 1, 2, 3, 10, 11, 12, 21, 22, 35, 99, 100, 109].map(hebrewCircles), ['ללא מעגלים', 'מעגל אחד', 'שני מעגלים', 'שלושה מעגלים', 'עשרה מעגלים', 'אחד עשר מעגלים', 'שנים עשר מעגלים', 'עשרים ואחד מעגלים', 'עשרים ושניים מעגלים', 'שלושים וחמישה מעגלים', 'תשעים ותשעה מעגלים', '100 מעגלים', '109 מעגלים']);
});
