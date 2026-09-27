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

test('component: fixed colours — gold ribbon, day mint dot, night logo-blue dot; never theme variables', () => {
  const day = render({ todayProgress: 1 / 3, dayOrNight: 'day' });
  const night = render({ todayProgress: 1 / 3, dayOrNight: 'night' });
  assert.match(day, /stop-color="#e0b955"/);
  assert.match(day, /stop-color="#ffd98a"/);
  assert.match(day, /fill="#b8ffe0"/);
  assert.match(day, /rgba\(90,255,190,0\.9\)/);
  // Night: the blue of the logo's sphere — core and halo the rim #3D79B7 (visible on light pages too), glow the mid #99C5EC.
  assert.match(night, /fill="#3D79B7"/);
  assert.match(night, /stop-color="rgba\(61,121,183,0\.9\)"/);
  assert.match(night, /stop-color="rgba\(61,121,183,0\.4\)" stop-opacity="0"/);
  assert.match(night, /rgba\(153,197,236,0\.9\)/);
  assert.match(night, /class="ring-aura"[^>]*stroke="#99C5EC"/, 'the aura is the same blue family');
  assert.doesNotMatch(night, /150,130,255|110,70,255|#c9c2ff|#b8a8ff/, 'no violet or lavender left at night');
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
  assert.equal(html.replace(/<[^>]+>/g, '').trim(), '', 'no visible text inside the ring (no numbers, ever)');
  assert.match(html, /aria-hidden="true"/);
});

