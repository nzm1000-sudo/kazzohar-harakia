// CLAY round 3 — the spiritual circle (owner, 2026-10-02): the halo back on the plate; ONE royal-blue progress colour
// everywhere the circle's progress is shown (the ring, the first-circle pill, the native widgets); the count inside the
// circle page's sunken centre at every count and text size; the pill exactly centred; the rank's name in the dynamic
// gold circle, its way-ahead line said once; the rank-up ceremony (once per rank) and the page's entry fill — both
// still under reduced motion.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Module, createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { PROGRESS, PROGRESS_RIBBON } from '../src/services/progressColor.mjs';
import { CEREMONY_KEY, claimCeremony, readCeremony, rankFor, remainingTo, RANKS } from '../src/services/spiritualCircle.mjs';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const strip = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
const ring = strip(read('../src/styles/clay/ring.css'));
const circle = strip(read('../src/styles/clay/circle.css'));
const tokens = strip(read('../src/styles/clay/tokens.css'));
const base = read('../src/styles/base.css');
const memory = (seed = {}) => { const map = new Map(Object.entries(seed)); return { getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), map }; };

// A component compiled as the CLAY build compiles it (VITE_CLAY=true), or as an ordinary build.
const root = fileURLToPath(new URL('../', import.meta.url));
function loadJsx(relativePath, clay = true) {
  const source = fileURLToPath(new URL(`../src/${relativePath}`, import.meta.url));
  const env = { BASE_URL: '/', DEV: false, ...(clay ? { VITE_CLAY: 'true' } : {}) };
  const compiled = buildSync({ entryPoints: [source], bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent', loader: { '.jsx': 'jsx', '.css': 'empty' }, jsx: 'automatic', define: { 'import.meta.env': JSON.stringify(env) }, external: ['react', 'react/jsx-runtime', 'react-dom/server'] }).outputFiles[0].text;
  const loaded = new Module(source); loaded.filename = source; loaded.paths = Module._nodeModulePaths(root); loaded._compile(compiled, source);
  return loaded.exports;
}
const store = memory();
globalThis.localStorage ??= { getItem: store.getItem, setItem: store.setItem, removeItem: key => store.map.delete(key) };
globalThis.window ??= globalThis;
globalThis.history ??= { state: null, back() {}, replaceState() {}, pushState() {} };
const visible = html => html.replace(/ aria-label="[^"]*"/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// ---- WCAG helpers ----
const rgb = hex => { const h = hex.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const channel = v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = hex => { const [r, g, b] = rgb(hex).map(channel); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const THEMES = ['light', 'dark', 'sage', 'blue', 'plum', 'coral', 'teal', 'amber'];
const DARK = new Set(['dark', 'amber']);
const palette = theme => {
  const selector = theme === 'light' ? ':root[data-clay],:root[data-clay][data-theme="light"],' : `:root[data-clay][data-theme="${theme}"]{`;
  const at = tokens.indexOf(selector);
  const body = tokens.slice(at + selector.length, tokens.indexOf('}', at));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+)/g)].map(([, name, value]) => [name, value.trim()]));
};

test('progress colour: ONE royal blue, the same value in the app\'s tokens, the ring, the pill and both native widgets', () => {
  assert.match(PROGRESS.light, /^#[0-9a-f]{6}$/);
  assert.match(PROGRESS.dark, /^#[0-9a-f]{6}$/);
  // royal blue: blue dominant, a clear red-green lift (not navy, not sky)
  for (const hex of Object.values(PROGRESS)) { const [r, g, b] = rgb(hex); assert.ok(b > 200 && b > g + 60 && g > r, hex); }
  assert.ok(luminance(PROGRESS.dark) > luminance(PROGRESS.light), 'the dark palettes take the lighter royal blue');
  // the clay tokens (light palettes, then כהה and זהב לילי)
  const light = /:root\[data-clay\]\{--kz-progress:(#[0-9a-f]{6});--kz-progress-from:(#[0-9a-f]{6});--kz-progress-to:(#[0-9a-f]{6});/.exec(ring);
  const dark = /:root\[data-clay\]:is\(\[data-theme="dark"\],\[data-theme="amber"\]\):not\(\.clay-light-look\):not\(\.qz-arena-light\)\{--kz-progress:(#[0-9a-f]{6});--kz-progress-from:(#[0-9a-f]{6});--kz-progress-to:(#[0-9a-f]{6});/.exec(ring);
  assert.ok(light && dark, 'both token sets in ring.css');
  assert.deepEqual(light.slice(1), [PROGRESS.light, PROGRESS_RIBBON.light.from, PROGRESS_RIBBON.light.to]);
  assert.deepEqual(dark.slice(1), [PROGRESS.dark, PROGRESS_RIBBON.dark.from, PROGRESS_RIBBON.dark.to]);
  // the ring's ribbon (CLAY) and the pill read those tokens — never a hard-coded gold for progress
  const component = read('../src/components/SpiritualRing.jsx');
  assert.match(component, /const CLAY_RIBBON = \{ from: 'var\(--kz-progress-from, #2347bd\)', to: 'var\(--kz-progress-to, #325ddb\)' \};/);
  assert.match(component, /style=\{\{ stopColor: CLAY_RIBBON\.from \}\}/);
  assert.match(ring, /\.olam-first-count\{color:var\(--kz-progress\)/);
  assert.match(ring, /\.olam-first-seal::before\{[^}]*conic-gradient\(var\(--kz-progress\) var\(--olam-first-p,0%\)/);
  // iOS (SwiftUI) and Android (the ring bitmap): the same two values
  const hex = ([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  const swift = read('../ios/App/KZWidgets/KZWidgets.swift');
  const swiftColor = name => hex(new RegExp(`static let ${name} = Color\\(red: (\\d+) / 255, green: (\\d+) / 255, blue: (\\d+) / 255\\)`).exec(swift).slice(1).map(Number));
  assert.equal(swiftColor('progressLight'), PROGRESS.light);
  assert.equal(swiftColor('progressDark'), PROGRESS.dark);
  assert.match(swift, /Circle\(\)\.trim\(from: 0, to: progress\)\s*\.stroke\(LinearGradient\(colors: \[palette\.progress\.opacity\(0\.8\), palette\.progress\]/, 'the widget ring\'s arc');
  const java = read('../android/app/src/main/java/com/kzohaar/app/widget/KZWidgetProvider.java');
  const javaColor = name => hex(new RegExp(`static final int ${name} = Color\\.rgb\\((\\d+), (\\d+), (\\d+)\\);`).exec(java).slice(1).map(Number));
  assert.equal(javaColor('PROGRESS_DAY'), PROGRESS.light);
  assert.equal(javaColor('PROGRESS_NIGHT'), PROGRESS.dark);
  assert.match(java, /paint\.setColor\(night \? PROGRESS_NIGHT : PROGRESS_DAY\);\s*paint\.setAlpha\(255\);/, 'the widget arc');
});

test('progress colour reads in every palette: the pill\'s count ≥ 4.5:1 on its control, the ribbon ≥ 3:1 on the band', () => {
  for (const theme of THEMES) {
    const t = palette(theme);
    const blue = DARK.has(theme) ? PROGRESS.dark : PROGRESS.light;
    for (const ground of ['--clay-control-a', '--clay-control-b', '--clay-down-a', '--clay-down-b']) {
      assert.ok(contrast(blue, t[ground]) >= 4.5, `${theme}: the count on ${ground} ${contrast(blue, t[ground]).toFixed(2)}`);
    }
    for (const band of ['--clay-ring-hi', '--clay-ring-mid', '--clay-ring-lo']) {
      const ribbon = DARK.has(theme) ? PROGRESS_RIBBON.dark : PROGRESS_RIBBON.light;
      for (const stop of [ribbon.from, ribbon.to]) assert.ok(contrast(stop, t[band]) >= 3, `${theme}: the ribbon ${stop} on ${band} ${contrast(stop, t[band]).toFixed(2)}`);
    }
  }
});

test('the halo is back on the plate — Today and the circle page, still, behind the plate, in the logo\'s blue', () => {
  assert.match(ring, /\.clay-ring-halo\{position:absolute;z-index:-2;[^}]*radial-gradient\(circle at 50% 50%,var\(--clay-ring-halo\)[^}]*radial-gradient\(ellipse closest-side/, 'a fine halo hugging the plate and an oval wash');
  assert.match(ring, /\.spiritual-circle-core\{[^}]*--clay-plate-r:80px;--clay-halo-w:252px;--clay-halo-h:206px\}/);
  assert.match(ring, /\.circle-week-ring\{[^}]*--clay-plate-r:98px;--clay-halo-w:300px;--clay-halo-h:244px\}/);
  assert.ok(Number(/--clay-halo-w:252px/.exec(ring) && 252) > Number(206), 'oval: wider than tall');
  assert.match(read('../src/pages/TodayPage.jsx'), /\{clay && <span className="clay-ring-halo" aria-hidden="true" \/>\}/);
  assert.match(read('../src/pages/MitzvotJournal.jsx'), /<span className="clay-ring-halo" aria-hidden="true" \/><span className="clay-ring-band" aria-hidden="true" \/>/);
  assert.match(strip(read('../src/styles/clay/today.css')), /\.spiritual-side\{position:relative;z-index:1\}/, 'the side columns stand above the halo');
});

test('the circle page\'s count stays inside the sunken centre: fixed geometry, one line, its growth capped', () => {
  const page = read('../src/pages/MitzvotJournal.jsx');
  const ringPx = Number(/const CLAY_CIRCLE_RING_PX = (\d+);/.exec(page)[1]);
  const band = /\.clay-ring-band\{[^}]*width:(\d+)px;height:(\d+)px;[^}]*border:(\d+)px solid transparent/.exec(ring);
  assert.equal(Number(band[1]), ringPx, 'the band is the ring\'s own size');
  const hole = Number(band[1]) / 2 - Number(band[3]);
  const number = Number(/\.circle-week-count strong\{font-size:calc\(([\d.]+)px \* var\(--clay-count-scale\)\)/.exec(ring)[1]);
  const label = Number(/\.circle-week-count span\{[^}]*font-size:calc\(([\d.]+)px \* var\(--clay-count-scale\)\)/.exec(ring)[1]);
  const cap = Number(/--clay-count-scale:min\(var\(--a11y-chrome-scale,1\),([\d.]+)\)/.exec(ring)[1]);
  assert.ok(cap <= 1.1, 'the count grows with the reader\'s text only a little — the centre does not grow');
  assert.match(ring, /\.circle-week-count\{[^}]*-webkit-text-size-adjust:100%;text-size-adjust:100%\}/, 'the device\'s text scaling does not enlarge it again');
  assert.match(ring, /\.circle-week-count span\{[^}]*white-space:nowrap/, 'the label on one line');
  // The block (number + gap + label, line boxes) and the widest label ("מתוך 26 אורות": 13 characters at ~0.5em, as
  // measured in the browser — qa/fit.mjs: 6.1px at every count 0–26 and every text size) fit the circle with a margin
  // at their outer corners, at the largest size.
  const gap = Number(/\.circle-week-count\{gap:(\d+)px/.exec(ring)[1]);
  const heightMax = (number * 1 + gap + label * 1.15) * cap;
  const labelWidth = 13 * 0.5 * label * cap;
  const corner = Math.hypot(labelWidth / 2, heightMax / 2);
  assert.ok(hole - corner >= 4, `margin at the label's outer corners ${(hole - corner).toFixed(1)}px (hole ${hole}px)`);
  assert.ok(hole >= 54, 'a generous centre');
});

test('the first-circle pill is exactly centred and smaller: mirrored columns, equal padding, 44px high', () => {
  const comp = read('../src/components/OlamCircles.jsx');
  assert.match(comp, /<span className="olam-first-seal"[^>]*>[\s\S]*?<span className="olam-first-text"[\s\S]*?<span className="olam-first-balance" aria-hidden="true" \/>/);
  const pill = /:root\[data-clay\] \.olam-first\{([^}]*)\}/.exec(ring)[1];
  const cols = /grid-template-columns:(\d+)px auto (\d+)px/.exec(pill);
  assert.equal(cols[1], cols[2], 'the seal\'s column and the empty one are equal');
  assert.match(pill, /padding:4px 12px;/, 'equal padding on both sides');
  assert.match(pill, /min-height:44px/);
  assert.equal(Number(/\.olam-first-balance\{width:(\d+)px/.exec(ring)[1]), Number(cols[1]));
  assert.match(ring, /\.olam-first-text\{[^}]*justify-items:center;[^}]*text-align:center/);
  const { OlamFirstLine } = loadJsx('components/OlamCircles.jsx');
  const html = renderToStaticMarkup(React.createElement(OlamFirstLine, { active: 1, goal: 26, onOpen() {} }));
  assert.match(html, /--olam-first-p:3\.8%/, 'the arc shows the progress');
  assert.match(html, /aria-label="מעגלי עולם\. האורות: 1 מתוך 26\."/);
});

test('the rank: its name in the dynamic gold circle wherever it is named (CLAY), the same for every rank', () => {
  const { OlamCard, OlamHomeLine } = loadJsx('components/OlamCircles.jsx');
  const { default: OlamPage } = loadJsx('pages/OlamPage.jsx');
  for (const { at, name } of RANKS) {
    const card = renderToStaticMarkup(React.createElement(OlamCard, { lifetime: at, onOpen() {} }));
    const home = renderToStaticMarkup(React.createElement(OlamHomeLine, { lifetime: at, onOpen() {} }));
    const page = renderToStaticMarkup(React.createElement(OlamPage, { ring: { lifetime: at }, onBack() {} }));
    for (const [where, html] of [['card', card], ['home', home], ['page', page]]) {
      assert.match(html, new RegExp(`<span class="rank-ring is-(lg|sm)( is-long)?" aria-hidden="true"><svg class="rank-ring-svg"[\\s\\S]*?<circle class="rank-ring-line" cx="50" cy="50" r="45" pathLength="1" transform="rotate\\(-90 50 50\\)"><\\/circle>[\\s\\S]*?<span class="rank-ring-name">${name}</span>`), `${where} at ${name}`);
      assert.equal(html.includes(`is-long`), name.length > 6, `${where}: a long name takes the smaller size`);
    }
    assert.match(page, new RegExp(`<span class="visually-hidden">דרגת ${name}</span>`), 'the hero still says the rank');
  }
  // an ordinary build is unchanged: no ring
  const plain = loadJsx('components/OlamCircles.jsx', false);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(plain.OlamCard, { lifetime: 7, onOpen() {} })), /rank-ring/);
  // the halo breathes like the current rank's, and is still under reduced motion (system and the app's own setting)
  assert.match(base, /\.rank-ring-halo\{animation:olam-halo 6\.5s ease-in-out infinite\}/);
  assert.match(base, /@media \(prefers-reduced-motion:reduce\)\{\.rank-ring-halo\{animation:none;opacity:\.7\}\}/);
  assert.match(base, /html\[data-a11y-motion\] \.rank-ring-halo\{animation:none;opacity:\.7\}/);
  assert.match(circle, /\.rank-ring-line\{fill:none;stroke:var\(--clay-gold\);[^}]*stroke-dasharray:1 1;stroke-dashoffset:0;/, 'closed at rest');
});

test('the rank: the way to the next rank is said once — no duplicate on the אִתְעַלִּי path', () => {
  for (const clay of [true, false]) {
    const { default: OlamPage } = loadJsx('pages/OlamPage.jsx', clay);
    for (const lifetime of [0, 3, 7, 12, 325, 999]) {
      const words = visible(renderToStaticMarkup(React.createElement(OlamPage, { ring: { lifetime }, onBack() {} })));
      const ahead = remainingTo(rankFor(lifetime));
      assert.equal(words.split(ahead).length - 1, 1, `${lifetime}: "${ahead}" once`);
    }
  }
  assert.doesNotMatch(read('../src/pages/OlamPage.jsx'), /circlesTo\(/);
});

test('the rank-up ceremony plays once per rank-up — never on a first look, a re-render, a remount or a reload', () => {
  const s = memory();
  assert.equal(readCeremony(s), null);
  assert.equal(claimCeremony(-1, s), false, 'a new user\'s first look records "no rank"');
  assert.equal(s.getItem(CEREMONY_KEY), '-1');
  assert.equal(claimCeremony(0, s), true, 'מלכות reached: the ceremony plays');
  assert.equal(claimCeremony(0, s), false, 're-render');
  assert.equal(claimCeremony(0, memory({ [CEREMONY_KEY]: s.getItem(CEREMONY_KEY) })), false, 'a reload (the same record)');
  assert.equal(claimCeremony(-1, s), false, 'never lowered');
  assert.equal(s.getItem(CEREMONY_KEY), '0');
  assert.equal(claimCeremony(3, s), true, 'a jump of ranks: one ceremony, for the rank reached');
  assert.equal(claimCeremony(2, s), false);
  // an updating user with ranks already reached: the first look records them and plays nothing
  const old = memory();
  assert.equal(claimCeremony(6, old), false);
  assert.equal(claimCeremony(6, old), false);
  assert.equal(claimCeremony(7, old), true);
  // garbage in storage is a first look, never a crash
  assert.equal(claimCeremony(2, memory({ [CEREMONY_KEY]: 'x' })), false);
  // the hook: recorded BEFORE it plays (claimCeremony first), React's double mount continues it (module memory),
  // one light haptic (the clay haptics service), nothing under reduced motion; the record's first look is seeded from
  // the circles' record, so a new user's first rank is celebrated
  const comp = read('../src/components/OlamCircles.jsx');
  assert.match(comp, /let current = ceremony && !ceremony\.done && ceremony\.index === index \? ceremony : null;\s*if \(!current && claimCeremony\(index\)\) \{\s*if \(reduceMotionNow\(\)\) return undefined;\s*current = ceremony = \{ index, start: null, done: false \};\s*nativeTick\(\);/);
  assert.match(comp, /import \{ nativeTick \} from '\.\.\/services\/clayHaptics\.mjs';/);
  assert.match(comp, /if \(clayBuildEnabled\(\) && readCeremony\(\) === null\) claimCeremony\(rankFor\(record \? record\.seen : lifetime\)\.index\);/);
  const ms = Number(/export const RANK_CEREMONY_MS = (\d+);/.exec(comp)[1]);
  assert.ok(ms >= 1200 && ms <= 2600, 'slowly');
});

test('the circle page\'s entry: the lights fill from 0 to the count in about a second, eased; still under reduced motion', async () => {
  const mod = loadJsx('components/OlamCircles.jsx');
  const { entryFillAt, CIRCLE_ENTRY_MS, useCircleEntry } = mod;
  assert.ok(CIRCLE_ENTRY_MS >= 700 && CIRCLE_ENTRY_MS <= 1300);
  assert.equal(entryFillAt(0, 14), 0);
  assert.equal(entryFillAt(CIRCLE_ENTRY_MS, 14), null, 'then the real count');
  assert.equal(entryFillAt(100, 0), null, 'nothing to fill at 0');
  const mid = entryFillAt(CIRCLE_ENTRY_MS / 2, 14);
  assert.ok(mid > 7 && mid < 14, 'eased out: past half way at half time');
  let previous = -1;
  for (let t = 0; t < CIRCLE_ENTRY_MS; t += 50) { const v = entryFillAt(t, 26); assert.ok(v >= previous && v <= 26); previous = v; }
  // the first render: 0 (to fill) normally; the real count (null) under reduced motion, or when disabled
  const Probe = ({ target, enabled }) => React.createElement('i', null, String(useCircleEntry(target, { enabled })));
  const draw = props => renderToStaticMarkup(React.createElement(Probe, props));
  const saved = globalThis.matchMedia;
  try {
    globalThis.matchMedia = () => ({ matches: false });
    assert.equal(draw({ target: 14, enabled: true }), '<i>0</i>');
    assert.equal(draw({ target: 14, enabled: false }), '<i>null</i>');
    assert.equal(draw({ target: 0, enabled: true }), '<i>null</i>');
    globalThis.matchMedia = q => ({ matches: /prefers-reduced-motion: reduce/.test(q) });
    assert.equal(draw({ target: 14, enabled: true }), '<i>null</i>', 'reduced motion: the count at once');
  } finally { globalThis.matchMedia = saved; }
  // CLAY only, and never during a completion
  assert.match(read('../src/pages/MitzvotJournal.jsx'), /useCircleEntry\(circle\.active, \{ enabled: CLAY && !completion\.phase \}\)/);
});
