// Stage 3 — the one ring component: geometry edge cases, one ribbon path, fixed colours, render-only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { createRequire, Module } from 'node:module';
import { ribbonPath, tipPoint, pt, MIN_VISIBLE_DEG, RING_GEOMETRY } from '../src/services/ringGeometry.mjs';

const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
function loadJsx(relativePath) {
  const source = fileURLToPath(new URL(`../src/${relativePath}`, import.meta.url));
  const compiled = buildSync({ entryPoints: [source], bundle: true, platform: 'node', format: 'cjs', write: false, loader: { '.jsx': 'jsx' }, jsx: 'automatic', external: ['react', 'react/jsx-runtime', 'react-dom/server'] }).outputFiles[0].text;
  const loaded = new Module(source); loaded.filename = source; loaded.paths = Module._nodeModulePaths(fileURLToPath(new URL('..', import.meta.url))); loaded._compile(compiled, source);
  return loaded.exports;
}
const render = props => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { default: SpiritualRing } = loadJsx('components/SpiritualRing.jsx');
  return renderToStaticMarkup(React.createElement(SpiritualRing, props));
};
const numbers = d => (d.match(/-?\d+(\.\d+)?/g) || []).map(Number);

test('geometry: empty, tiny, half, near-full, full — never NaN, never malformed', () => {
  assert.equal(ribbonPath(0), null, 'no ribbon at 0 (the track still shows)');
  for (const p of [1e-9, 0.01, 1 / 3, 0.5, 2 / 3, 0.99, 0.999999, 1, 1.5, -1, NaN, '0.5', undefined]) {
    const d = ribbonPath(p);
    if (d === null) { assert.ok(!(Number(p) > 0), `${p}`); continue; }
    assert.doesNotMatch(d, /NaN|undefined|Infinity/, `${p}`);
    assert.match(d, /^M /);
    assert.ok(numbers(d).every(Number.isFinite), `${p}`);
  }
});

test('geometry: the notch is fixed at the top; the tip moves; the tip never passes the notch', () => {
  const notch = pt(RING_GEOMETRY.notchDeg, RING_GEOMETRY.r);
  for (const p of [0.1, 1 / 3, 2 / 3, 0.99]) assert.ok(ribbonPath(p).includes(`L ${notch.x} ${notch.y} Z`), `${p}: notch vertex at ${RING_GEOMETRY.notchDeg}°`);
  assert.notDeepEqual(tipPoint(1 / 3), tipPoint(2 / 3));
  const almost = ribbonPath(0.9999);
  assert.ok(almost.includes('A 52.75 52.75 0 1 1'), 'large-arc flag set past 180°');
  const tinyStart = ribbonPath(1e-9);
  assert.ok(tinyStart.includes(`${pt(MIN_VISIBLE_DEG, RING_GEOMETRY.r + RING_GEOMETRY.halfWidth).x}`), 'a started ring shows a minimum sweep, no self-intersection with the notch');
});

test('geometry: 100% is a deliberate closed ring (two arcs per edge, one path), not a collapsed single arc', () => {
  const full = ribbonPath(1);
  assert.equal((full.match(/ A /g) || []).length + (full.startsWith('A') ? 1 : 0), 4, 'two outer + two inner arcs');
  assert.equal((full.match(/M /g) || []).length, 2, 'outer and inner contour in the same path');
  assert.doesNotMatch(full, / L /, 'no tip/notch spikes left at full');
});

test('component: exactly ONE ribbon path, the dim track always present, both sizes', () => {
  for (const size of ['small', 'large']) {
    for (const todayProgress of [0, 1 / 3, 2 / 3, 1]) {
      const html = render({ size, todayProgress, presenceLevel: 'glowing', dayOrNight: 'day' });
      assert.equal((html.match(/<path /g) || []).length, todayProgress > 0 ? 1 : 0, `${size} ${todayProgress}`);
      assert.match(html, /<circle cx="60" cy="60" r="50" fill="none" stroke="#e0b955" stroke-opacity="0.2"/, 'track');
      assert.match(html, size === 'small' ? /width="46"/ : /width="132"/);
      assert.doesNotMatch(html, /NaN/);
    }
  }
});

test('component: fixed colours — gold ribbon, day mint dot, night violet dot; never theme variables', () => {
  const day = render({ todayProgress: 1 / 3, dayOrNight: 'day' });
  const night = render({ todayProgress: 1 / 3, dayOrNight: 'night' });
  assert.match(day, /stop-color="#e0b955"/);
  assert.match(day, /stop-color="#ffd98a"/);
  assert.match(day, /fill="#b8ffe0"/);
  assert.match(day, /rgba\(90,255,190,0\.9\)/);
  assert.match(night, /fill="#c9c2ff"/);
  assert.match(night, /rgba\(150,130,255,0\.9\)/);
  assert.doesNotMatch(read('../src/components/SpiritualRing.jsx'), /var\(--/);
});

test('component: long-term level changes luminosity only, never the fill geometry', () => {
  const d = level => render({ todayProgress: 2 / 3, presenceLevel: level }).match(/<path [^>]*\bd="([^"]+)"/)[1];
  assert.equal(d('dim'), d('bright'));
  assert.notEqual(render({ todayProgress: 2 / 3, presenceLevel: 'dim' }), render({ todayProgress: 2 / 3, presenceLevel: 'bright' }));
});

test('component is render-only: no journal, storage, timers, sunset or routing; no numbers or text', () => {
  const source = read('../src/components/SpiritualRing.jsx');
  assert.doesNotMatch(source, /mitzvotJournal|localStorage|setInterval|setTimeout|sunset|zmanim|location\.hash|navRootFor|studySession/);
  const html = render({ todayProgress: 2 / 3 });
  assert.equal(html.replace(/<[^>]+>/g, '').trim(), '', 'no text unless an inscription is given (no numbers, ever)');
  assert.match(html, /aria-hidden="true"/);
});

import { inscriptionArc, inscriptionWordSpacing, visualOrderHebrew, INSCRIPTION } from '../src/services/ringGeometry.mjs';

test('inscription: exactly three quarters (270°), gap at the bottom, upright on the outside', () => {
  const arc = inscriptionArc();
  assert.equal(INSCRIPTION.sweepDeg, 270);
  assert.match(arc.d, /^M [\d.]+ [\d.]+ A 58\.5 58\.5 0 1 1 [\d.]+ [\d.]+$/, 'one large clockwise arc');
  const [x1, y1, x2, y2] = arc.d.match(/-?\d+(\.\d+)?/g).map(Number).filter((_, i) => [0, 1, 7, 8].includes(i));
  assert.equal(x1 + x2, 120, 'symmetric around the vertical axis');
  assert.equal(y1, y2);
  assert.ok(y1 > 60, 'both ends below the centre — the free quarter is at the bottom');
  assert.equal(Math.round(arc.length), Math.round((2 * Math.PI * 58.5 * 3) / 4));
});

test('inscription: right-to-left reading guaranteed in every engine (visual order, vowels stay on their letters)', () => {
  const text = 'ואהבתך לא תסור ממנו לעולמים';
  const visual = visualOrderHebrew(text);
  assert.equal(visualOrderHebrew(visual), text, 'reversing twice restores the sentence exactly');
  assert.equal(visual[0], 'ם', 'leftmost glyph is the last letter');
  assert.equal(visualOrderHebrew('שָׁלוֹם'), 'םוֹל' + 'שָׁ', 'marks travel with their base letter');
});

test('inscription: only gaps between words grow (letters stay together), filling the arc exactly', () => {
  assert.equal(inscriptionWordSpacing(260, 180, 5), 20);
  assert.equal(inscriptionWordSpacing(260, 300, 5), 0, 'never negative');
  assert.equal(inscriptionWordSpacing(260, 180, 1), 0);
});

test('inscription appears only when given (large ring on Today), never on the small ring', () => {
  const large = render({ size: 'large', todayProgress: 1 / 3, inscription: 'ואהבתך לא תסור ממנו לעולמים' });
  assert.match(large, /<textPath[^>]*start-offset="50%"|<textPath[^>]*startOffset="50%"/);
  assert.match(large, /unicode-bidi="bidi-override"/);
  assert.equal((large.match(/<path /g) || []).length, 2, 'ribbon + the (invisible) inscription arc in defs');
  const small = render({ size: 'small', todayProgress: 1 / 3 });
  assert.doesNotMatch(small, /<text/);
  assert.match(readFileSync(new URL('../src/pages/TodayPage.jsx', import.meta.url), 'utf8'), /const SPIRITUAL_INSCRIPTION = 'ואהבתך לא תסור ממנו לעולמים';/);
});
