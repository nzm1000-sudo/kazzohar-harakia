// CLAY (design/premium-claymorphism): the app-wide 3D material — a design mode set only by a VITE_CLAY build, on every
// screen and in all eight palettes; reading surfaces flat; selected = sunk + copper outline; a shadow budget; the light
// follows the sun; a haptic tap; Today's four resume tiles. See docs/design-system.md › CLAY.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire, Module } from 'node:module';
import { buildSync } from 'esbuild';
import { applyClayScope, clayPageFor, clayScopeFor, CLAY_THEMES } from '../src/services/clayExperiment.mjs';
import { CLAY_LIGHT_FIXED, sunLight } from '../src/services/claySun.mjs';
import { installClayHaptics, shouldTick } from '../src/services/clayHaptics.mjs';
import { DEFAULT_RECENTS, PLACES, RECENT_PLACES_KEY, placeKeyFor, readRecentPlaces, recentTiles, recordPlace } from '../src/services/todayResume.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const CLAY_DIR = fileURLToPath(new URL('../src/styles/clay/', import.meta.url));
const strip = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
const files = readdirSync(CLAY_DIR).filter(name => name.endsWith('.css')).sort();
const sheets = Object.fromEntries(files.map(name => [name, strip(readFileSync(CLAY_DIR + name, 'utf8'))]));
const all = Object.values(sheets).join('\n');
const rules = Object.entries(sheets).flatMap(([name, css]) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => ({ name, sel: sel.trim().replace(/\s+/g, ' '), body })));
const SCOPE = ':root[data-clay]';
// Split at top-level commas only (selectors and shadow lists nest parentheses: :is(… :not(…)), calc(…)).
const splitTop = value => { const out = []; let depth = 0; let current = ''; for (const ch of value) { if (ch === '(') depth += 1; if (ch === ')') depth -= 1; if (ch === ',' && depth === 0) { out.push(current); current = ''; } else current += ch; } out.push(current); return out.map(part => part.trim()).filter(Boolean); };
const layers = splitTop;
// The shadow tokens, resolved (a token may name another).
const TOKENS = Object.fromEntries([...all.matchAll(/(--clay-[\w-]*shadow[\w-]*|--sel-ring|--shadow):([^;}]+)/g)].map(([, name, value]) => [name, value.trim()]));
const resolve = value => layers(value).flatMap(part => { const m = /^var\((--[\w-]+)\)$/.exec(part); return m && TOKENS[m[1]] ? resolve(TOKENS[m[1]]) : [part]; });
const memory = (seed = {}) => { const map = new Map(Object.entries(seed)); return { getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)) }; };

// ---- the mode ----

test('clay is an app-wide design mode: on in a Clay build (every screen, all eight palettes), off otherwise', () => {
  assert.deepEqual(CLAY_THEMES, ['light', 'dark', 'sage', 'blue', 'plum', 'coral', 'teal', 'amber']);
  assert.equal(clayScopeFor({ enabled: true }), 'app');
  assert.equal(clayScopeFor({ enabled: false }), null, 'an ordinary build');
  assert.equal(clayScopeFor(), null);
  assert.equal(clayPageFor({ isTodayPage: true }), 'today');
  assert.equal(clayPageFor({ reader: true, mode: 'siddur' }), 'reader');
  assert.equal(clayPageFor({ mode: 'halacha/q/12' }), 'halacha');
  assert.equal(clayPageFor({ search: true, mode: 'halacha' }), 'search', 'a global query shows the search page');
  assert.equal(clayPageFor({ reader: true, search: true }), 'reader');
  const root = { dataset: {} };
  applyClayScope('app', 'today', root);
  assert.deepEqual({ ...root.dataset }, { clay: 'app', clayPage: 'today' });
  applyClayScope(null, null, root);
  assert.deepEqual({ ...root.dataset }, {});
});

test('NewApp sets the mode before paint for every screen; styles/clay/index.css loads last; ordinary builds never set the flag', () => {
  const app = read('../src/NewApp.jsx');
  assert.match(app, /const clayScope = clayScopeFor\(\{ enabled: CLAY_ON \}\);/);
  assert.match(app, /useLayoutEffect\(\(\) => \{ applyClayScope\(clayScope, clayPage\); \}, \[clayScope, clayPage\]\);/);
  const imports = [...app.matchAll(/^import '\.\/styles\/([\w/-]+)\.css';/gm)].map(([, name]) => name);
  assert.equal(imports.at(-1), 'clay/index');
  const pkg = JSON.parse(read('../package.json'));
  // Owner, 2026-10-03: the web app too (GitHub Pages, the home-screen shortcut) is Clay.
  assert.match(pkg.scripts.build, /VITE_CLAY=true/);
  // Owner, 2026-10-03: Clay is the app — the native build (iOS, Android) is always Clay; the plain web build is the fallback.
  assert.match(pkg.scripts['build:native'], /VITE_CLAY=true/);
  // The side-by-side iOS build checks the flag compiled on.
  assert.match(read('../scripts/clay/build-ios-clay.sh'), /="app"/);
});

test('the import order is defined once: tokens first, a11y last, every clay stylesheet exactly once', () => {
  const index = readFileSync(CLAY_DIR + 'index.css', 'utf8');
  const order = [...index.matchAll(/@import '\.\/([\w-]+\.css)';/g)].map(([, name]) => name);
  assert.equal(order[0], 'tokens.css');
  assert.equal(order.at(-1), 'a11y.css');
  assert.deepEqual([...order].sort(), files.filter(name => name !== 'index.css'));
  for (const area of ['siddur', 'calendar', 'tehillim', 'more', 'halacha', 'library', 'settings', 'tools', 'leatzmi', 'quiz', 'circle', 'about', 'readers']) assert.ok(order.includes(`${area}.css`), area);
});

test('every rule is scoped under :root[data-clay] (nothing leaks into an ordinary build)', () => {
  const selectors = rules.map(({ sel }) => sel.replace(/^@media[^{]*\{/, '').trim()).filter(sel => sel && !sel.startsWith('@'));
  assert.ok(selectors.length > 120);
  const unscoped = selectors.flatMap(splitTop).filter(part => !part.startsWith(SCOPE));
  assert.deepEqual(unscoped, []);
});

// ---- the material's rules ----

test('text is never embossed, nothing loops, nothing blurs; a press moves only transform, shadow and ground in 130ms', () => {
  assert.doesNotMatch(all, /text-shadow\s*:\s*(?!none)/, 'no text shadows');
  assert.doesNotMatch(all, /(^|[;{])\s*(-webkit-)?backdrop-filter\s*:\s*(?!none)/, 'no backdrop blurs');
  // Filters: none, except a named few — each with its reason (a glow that already belongs to that element's meaning).
  const FILTER_ALLOWED = [
    [/^quiz\.css$/, /\.qz-(lozenge|rung|orb)/, 'the quiz ladder\'s lozenges and rungs keep their own soft drop shadow (their 3D drawing is SVG)'],
    [/^(circle|quiz)\.css$/, /week[\w-]*(bar|chart)[^{]*(is-today|is-current|current)/, 'the week chart\'s current bar keeps its light'],
    [/^ring\.css$/, /\.olam-first-count/, 'the count of lights in the pill under the circle: a soft orange glow the owner asked for (2026-10-03)'],
    [/^circle\.css$/, /olam-step\.is-current|rank[\w-]*\.is-current/, 'the current rank\'s seal — "you are here" (Rule B\'s central exception)'],
  ];
  const filters = rules.filter(({ name, sel, body }) => /(^|;)\s*filter\s*:\s*(?!none)/.test(body) && !FILTER_ALLOWED.some(([file, pattern]) => file.test(name) && pattern.test(sel)));
  assert.deepEqual(filters.map(({ name, sel }) => `${name}: ${sel.slice(0, 90)}`), [], 'no filters (filter:none is fine)');
  for (const [, , reason] of FILTER_ALLOWED) assert.ok(reason.length > 20);
  assert.doesNotMatch(all, /animation\s*:\s*(?!none)/, 'nothing loops');
  assert.doesNotMatch(all, /will-change/, 'no layers promoted for nothing');
  for (const [, value] of all.matchAll(/transition\s*:\s*([^;}]+)/g)) {
    if (/^none/.test(value.trim())) continue;
    for (const part of layers(value)) assert.match(part, /^(transform|box-shadow|background-color) var\(--clay-dur\)/, `transition on ${part}`);
  }
  assert.match(all, /--clay-dur:130ms/);
  assert.match(sheets['a11y.css'], /@media \(prefers-reduced-motion:reduce\)\{\s*:root\[data-clay\] \*\{transition:none!important\}/);
  assert.match(sheets['a11y.css'], /\[data-a11y-motion\] \*\{transition:none!important\}/);
});

test('the shadow budget: at most five layers on a body (+1 outline hairline), two on a repeated row; one light', () => {
  const primitives = sheets['primitives.css'];
  for (const name of ['struct-shadow', 'dock-shadow', 'card-shadow', 'card-shadow-down', 'soft-shadow', 'row-shadow', 'control-shadow', 'tile-shadow', 'pressed-shadow', 'well-shadow', 'selected-shadow', 'sheet-shadow', 'float-shadow', 'plate-shadow', 'torus-shadow']) {
    assert.ok(TOKENS[`--clay-${name}`], name);
    assert.ok(resolve(TOKENS[`--clay-${name}`]).length <= 5, `${name}: ${resolve(TOKENS[`--clay-${name}`]).length} layers`);
  }
  assert.ok(resolve(TOKENS['--clay-row-shadow']).length <= 2, 'a row in a long list is cheap');
  assert.doesNotMatch(TOKENS['--clay-row-shadow'], /\) (1\d|[2-9]\d)px [^,]*var\(--clay-drop\)/, 'no wide blur on rows');
  for (const { name, sel, body } of rules) {
    for (const [, value] of body.matchAll(/box-shadow:([^;}]+)/g)) assert.ok(resolve(value).length <= 6, `${name}: ${sel.slice(0, 80)} has ${resolve(value).length} layers`);
  }
  // Long lists (index rows, prayer links) never carry the full card stack.
  for (const { sel, body } of rules.filter(({ sel }) => /\.(index-row|prayer-link)\b/.test(sel) && !/:active|data-a11y/.test(sel))) {
    for (const [, value] of body.matchAll(/box-shadow:([^;}]+)/g)) assert.match(value.trim(), /^(var\(--clay-row-shadow\)|none)$/, sel);
  }
  // One light: every offset of the bodies follows --clay-lx / --clay-ly (the sun); the card's halo goes toward it.
  assert.match(primitives, /--clay-card-shadow:calc\(var\(--clay-lx\)\*-6px\) calc\(var\(--clay-ly\)\*-6px\) 14px var\(--clay-halo\),calc\(var\(--clay-lx\)\*8px\) calc\(var\(--clay-ly\)\*10px\)/);
  assert.match(sheets['tokens.css'], /--clay-lx:1;--clay-ly:1;/, 'default: upper left');
});

test('selected = the control SINKS into the material + a thin copper outline + copper text — never a copper body', () => {
  const primitives = sheets['primitives.css'];
  assert.match(primitives, /--clay-selected-shadow:inset [^;]*var\(--clay-sink\),inset [^;]*var\(--clay-sink-hi\),inset 0 0 0 1px var\(--clay-sel-line\);/);
  assert.match(primitives, /--sel-ink:var\(--accent\);--sel-line:var\(--clay-sel-line\);--sel-ring:var\(--clay-selected-shadow\);/);
  assert.ok(resolve('var(--sel-ring)').every(part => part.startsWith('inset')), 'all inset: sunk, no glow');
  // The dock's place and the "עוד" tile you are on: sunk, outlined, copper words.
  assert.match(primitives, /:is\(\.tabbar>button,\.more-menu>button\)\.on\{color:var\(--sel-ink\);background:var\(--clay-sunk\);box-shadow:var\(--sel-ring\)\}/);
  const SELECTED = /\.(on|is-on|selected|is-selected|active|is-current|is-changed)(?![\w-])|\[aria-(checked|pressed|selected|current)="(true|page)"\]/;
  const filled = rules.filter(({ sel, body }) => SELECTED.test(sel) && !/ja-switch-thumb/.test(sel)
    && [...body.matchAll(/background(?:-color)?\s*:\s*([^;]+)/g)].some(([, value]) => !/^(transparent|none|var\(--clay-sunk\))$/.test(value.trim())));
  assert.deepEqual(filled.map(({ name, sel }) => `${name}: ${sel.slice(0, 90)}`), [], 'a chosen state keeps the sunk ground only');
  assert.doesNotMatch(all, /background(?:-color)?\s*:\s*(var\(--clay-copper\)|var\(--accent\))\s*[;}]/, 'no copper body anywhere');
  assert.doesNotMatch(all, /--clay-chosen-shadow/, 'the copper-body concept is gone');
  // The checkbox: a framed well; checked = sunk + the outline; its check is a mask in currentColor (the copper).
  assert.match(primitives, /:root\[data-clay\] input\[type=checkbox\]\{-webkit-appearance:none;appearance:none;[^}]*background:var\(--clay-well\);box-shadow:var\(--clay-field-shadow\);color:var\(--accent\)/);
  assert.match(primitives, /:root\[data-clay\] input\[type=checkbox\]:checked\{background:var\(--clay-sunk\);box-shadow:var\(--sel-ring\)\}/);
  assert.doesNotMatch(all.replace(primitives, ''), /input\[type=checkbox\]\{accent-color|rite-notes-toggle input\{/, 'no local checkbox');
  // ON / current, not chosen: an outline only (no fill, no outer shadow).
  assert.match(primitives, /:is\(\.clay-current,\.rm-time-row\.is-on,\.world-place\.is-current,\.year-index button\[aria-current="date"\]\)\{outline:1px solid var\(--clay-current-line\);outline-offset:-1px\}/);
});

// The reading surfaces — the one list (reading-surface.css). No other clay rule may raise them or give them a gradient.
const READING = ['reading-text', 'psalm-text', 'library-text', 'sr-text', 'zemer-text', 'chok-text', 'tc-article-body', 'practical-answer', 'halacha-excerpt', 'gemara', 'steinsaltz', 'commentary-item', 'shnayim-mikra-text', 'ts-verse', 'tradition-body'];
test('reading surfaces stay a flat, quiet page: no shadow, no gradient, no embossed text', () => {
  const flat = sheets['reading-surface.css'];
  for (const name of READING) assert.match(flat, new RegExp(`\\.${name}[,)]`), name);
  assert.match(flat, /\{box-shadow:none;text-shadow:none\}/);
  const raised = rules.filter(({ name, sel, body }) => name !== 'reading-surface.css'
    && splitTop(sel).some(part => READING.some(r => new RegExp(`\\.${r}(?![\\w-])[^ >+~]*$`).test(part.trim())))
    && (/box-shadow:(?!none)/.test(body) || /background[^;]*gradient/.test(body)));
  assert.deepEqual(raised.map(({ name, sel }) => `${name}: ${sel.slice(0, 90)}`), []);
});

test('round 2 primitives: framed fields everywhere, a light open state, list cards, title rows, 44px link buttons', () => {
  const primitives = sheets['primitives.css'];
  assert.match(primitives, /--clay-field-frame:inset 0 0 0 1px color-mix\(in srgb,var\(--control-border\) 62%,transparent\);/);
  assert.match(primitives, /--clay-field-shadow:var\(--clay-well-shadow\),var\(--clay-field-frame\);/);
  assert.match(sheets['a11y.css'], /\[data-a11y-contrast\]\{--clay-field-frame:inset 0 0 0 1px var\(--ink\)\}/);
  assert.match(sheets['a11y.css'], /\[data-a11y-contrast\] :is\(input:not\(\[type=range\]\)[^{]*\)\{border:1px solid var\(--ink\)!important\}/, 'no area can hide the edge');
  assert.doesNotMatch(all, /--st-field/, 'the settings area\'s local token is gone');
  // Every field well in every area is framed.
  const unframed = rules.filter(({ sel, body }) => /\binput\b|textarea|\bselect\b/.test(sel) && !/checkbox|range/.test(sel) && /background:var\(--clay-well\)/.test(body) && /box-shadow:var\(--clay-well-shadow\)/.test(body));
  assert.deepEqual(unframed.map(({ name, sel }) => `${name}: ${sel.slice(0, 80)}`), []);
  // Open accordions: the quiet recess, never the sunk bar.
  const heavy = rules.filter(({ sel, body }) => /\[open\]|\.is-open\b/.test(sel) && /background:var\(--clay-sunk\)/.test(body) && !/sel-ring/.test(body));
  assert.deepEqual(heavy.map(({ name, sel }) => `${name}: ${sel.slice(0, 80)}`), []);
  assert.match(primitives, /--clay-open-ground:color-mix\(in srgb,var\(--clay-card-b\) 55%,var\(--clay-well\)\);/);
  // One list card, one title row, 44px links.
  assert.match(primitives, /:is\(\.clay-list,\.tc-list,\.favorite-list,\.tradition-list,\.offline-pack-list\)\{border-color:transparent;border-radius:var\(--clay-r-card\);background:var\(--clay-card\);box-shadow:var\(--clay-card-shadow\);overflow:hidden\}/);
  assert.match(primitives, /\.reader-title-row\{flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center\}/);
  assert.doesNotMatch(all.replace(primitives, ''), /\.reader-title-row\{flex-direction:column/, 'no local copy');
  assert.match(primitives, /:is\(button\.link,\.event-line button,\.shnayim-save,\.source-credit>summary\)\{min-height:44px\}/);
  // התבודדות's durations: their real ground in clay (hitbodedut.css keeps its !important only outside the mode).
  assert.match(read('../src/styles/hitbodedut.css'), /:root:not\(\[data-clay\]\) \.hb-seg>button\{background:transparent!important\}/);
  assert.doesNotMatch(all, /background-image:var\(--clay-control\)!important/);
});

test('eight palettes of tokens, each complete (tokens.css); the night copper never touches text', () => {
  const tokens = sheets['tokens.css'];
  for (const theme of CLAY_THEMES.filter(theme => theme !== 'light')) assert.match(tokens, new RegExp(`:root\\[data-clay\\]\\[data-theme="${theme}"\\]\\{`), theme);
  assert.match(tokens, /:root\[data-clay\],:root\[data-clay\]\[data-theme="light"\],/);
  const night = /:root\[data-clay\]\[data-clay-sun="night"\]\{([^}]*)\}/.exec(tokens)?.[1] || '';
  assert.ok(night.length > 0);
  assert.doesNotMatch(night, /--(text|text-muted|accent|link|focus|ink)\s*:/, 'text colours stay the day\'s');
});

// ---- light follows the sun ----

test('the light follows the sun: east in the morning, overhead at noon, west by evening; still at night, under reduced motion or without zmanim', () => {
  const times = { sunrise: '2026-10-02T03:40:00Z', sunset: '2026-10-02T15:20:00Z' };
  const morning = sunLight(new Date('2026-10-02T04:10:00Z'), times);
  const noon = sunLight(new Date('2026-10-02T09:30:00Z'), times);
  const evening = sunLight(new Date('2026-10-02T15:00:00Z'), times);
  assert.ok(morning.lx < 0 && morning.phase === 'morning', 'from the east (right)');
  assert.ok(Math.abs(noon.lx - 0.25) < 0.05 && noon.ly < 0.85, 'nearly overhead: shorter shadows');
  assert.ok(evening.lx > 0.9 && evening.phase === 'evening', 'from the west (left)');
  assert.ok([morning, noon, evening].every(({ lx, ly }) => lx >= -0.5 && lx <= 1 && ly >= 0.8 && ly <= 1), 'subtle');
  assert.deepEqual(sunLight(new Date('2026-10-02T20:00:00Z'), times), { lx: 1, ly: 1, phase: 'night' });
  assert.equal(sunLight(new Date('2026-10-02T09:30:00Z'), times, { reducedMotion: true }), CLAY_LIGHT_FIXED);
  assert.equal(sunLight(new Date(), null), CLAY_LIGHT_FIXED);
  assert.match(read('../src/NewApp.jsx'), /setInterval\(update, CLAY_SUN_INTERVAL_MS\)/, 'at most every few minutes');
  assert.match(read('../src/services/claySun.mjs'), /CLAY_SUN_INTERVAL_MS = 5 \* 60 \* 1000/);
});

// ---- haptics ----

test('a light haptic tap on the main clay presses, through the app\'s own bridge, never twice in 80ms, never when disabled', () => {
  const el = (selector, extra = {}) => ({ closest: query => (query.split(',').includes(selector) ? { ...extra, closest: () => null, getAttribute: () => null } : null) });
  assert.ok(shouldTick(el('.tabbar>button')));
  assert.equal(shouldTick(el('.something-else')), null);
  assert.equal(shouldTick(el('.personal-primary', { disabled: true })), null);
  let handler = null; let ticks = 0; let clock = 0;
  const doc = { addEventListener: (type, fn) => { if (type === 'click') handler = fn; }, removeEventListener: () => {} };
  installClayHaptics({ doc, tick: () => { ticks += 1; }, now: () => clock });
  handler({ target: el('.tabbar>button') }); clock += 30;
  handler({ target: el('.tabbar>button') }); clock += 100;
  handler({ target: el('.seg>button') });
  assert.equal(ticks, 2);
  assert.match(read('../src/services/clayHaptics.mjs'), /hapticsAllowed\(\)/, 'נגישות › משוב מישושי is respected');
});

// ---- Today: "להמשיך מהיכן שהפסקת" — four tiles, 2×2 ----

test('recent tiles: a new user sees סידור and שעשועון טריוויה; after opening X then Y the left column is Y then X', () => {
  assert.deepEqual(recentTiles({}).map(tile => tile.placeKey), [...DEFAULT_RECENTS]);
  const store = memory();
  recordPlace('halacha/q/12', { store, now: new Date('2026-10-02T10:00:00Z') });
  recordPlace('tehillim', { store, now: new Date('2026-10-02T10:05:00Z') });
  assert.deepEqual(recentTiles({ places: readRecentPlaces(store) }).map(tile => tile.placeKey), ['tehillim', 'halacha']);
  recordPlace('halacha', { store, now: new Date('2026-10-02T10:09:00Z') });
  assert.deepEqual(recentTiles({ places: readRecentPlaces(store) }).map(tile => tile.placeKey), ['halacha', 'tehillim'], 'the same place again moves up, once');
  // One opened place: it and the first default; a learning reading counts by when it was opened.
  const one = memory(); recordPlace('calendar', { store: one, now: new Date('2026-10-02T09:00:00Z') });
  assert.deepEqual(recentTiles({ places: readRecentPlaces(one) }).map(tile => tile.placeKey), ['calendar', 'siddur']);
  const learning = [{ id: 'gen', reference: 'Genesis 1', title: 'בראשית א׳', lastOpenedAt: '2026-10-02T09:30:00Z' }];
  assert.deepEqual(recentTiles({ learning, places: readRecentPlaces(one) }).map(tile => tile.key), ['learning:gen', 'place:calendar']);
  // Never a fixed tile, never Today: the compass and the meat–dairy timer are not places; today is not recorded.
  assert.equal(placeKeyFor('today'), null);
  assert.equal(placeKeyFor('siddur-compass'), null);
  assert.equal(placeKeyFor('leatzmi/quiz/play'), 'leatzmi/quiz');
  assert.ok(!Object.keys(PLACES).some(key => /compass|meat|dairy/.test(key)));
  assert.equal(RECENT_PLACES_KEY, 'kz-recent-places-v1');
});

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
let TodayPage = null;
function renderToday(props) {
  if (!TodayPage) {
    const source = fileURLToPath(new URL('../src/pages/TodayPage.jsx', import.meta.url));
    const compiled = buildSync({ entryPoints: [source], bundle: true, platform: 'node', format: 'cjs', write: false, loader: { '.jsx': 'jsx' }, jsx: 'automatic', define: { 'import.meta.env.BASE_URL': '"/"' }, external: ['react', 'react/jsx-runtime', 'react-dom/server'] }).outputFiles[0].text;
    const mod = new Module(source); mod.filename = source; mod.paths = Module._nodeModulePaths(root); mod._compile(compiled, source);
    TodayPage = mod.exports.default;
  }
  const React = require('react'); const { renderToStaticMarkup } = require('react-dom/server');
  return renderToStaticMarkup(React.createElement(TodayPage, {
    now: new Date('2026-09-24T08:00:00Z'), tz: 'Asia/Jerusalem', hebrew: 'ה׳ בתשרי תשפ״ז', events: [],
    solar: { data: { sunrise: '2026-09-24T03:30:00Z', sunset: '2026-09-24T15:30:00Z' }, loading: false, error: null },
    locationName: 'ירושלים', afterSunset: false, onNav: () => {}, context: {}, settings: { location: { name: 'ירושלים', tzid: 'Asia/Jerusalem' } },
    setSettings: () => {}, resume: [], onResume: () => {}, onOpenPrayer: () => {}, ...props,
  }));
}

test('Today (clay): always four equal tiles — smart prayer and בשרי·חלבי fixed on the right, the two recents on the left', () => {
  const order = html => [...html.matchAll(/<button[^>]*class="(learning-resume-item[^"]*)"([^>]*)>/g)].map(([, cls, rest]) => (cls.includes('smart-prayer') ? 'smart' : cls.includes('meat-dairy') ? 'meat' : /data-place="([^"]+)"/.exec(rest)?.[1] || 'learning'));
  // A new user: the defaults.
  const fresh = renderToday({ clay: true, recent: recentTiles({}) });
  assert.match(fresh, /class="learning-resume is-clay-four"/);
  assert.deepEqual(order(fresh), ['smart', 'siddur', 'meat', 'leatzmi/quiz'], 'DOM order = RTL 2×2: right column fixed, left column recent');
  // After opening X (halacha) then Y (tehillim): Y on top, X below; the fixed tiles never move.
  const store = memory();
  recordPlace('halacha', { store, now: new Date('2026-09-24T07:00:00Z') });
  recordPlace('tehillim', { store, now: new Date('2026-09-24T07:30:00Z') });
  assert.deepEqual(order(renderToday({ clay: true, recent: recentTiles({ places: readRecentPlaces(store) }) })), ['smart', 'tehillim', 'meat', 'halacha']);
  // Every recent tile names itself whole (a long title is cut only visually).
  assert.match(fresh, /aria-label="להתחיל מכאן: סידור, תפילות לפי השעה"/);
  // The ordinary build keeps its own section.
  assert.doesNotMatch(renderToday({}), /is-clay-four/);
  // Equal tiles: one size for all four, centred.
  assert.match(sheets['today.css'], /\.learning-resume-grid\.is-four\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);grid-auto-rows:minmax\(100px,auto\);/);
  // Perfectly symmetric (round 2): no copper rim on one tile only; the same corner icon tile on all four.
  assert.match(sheets['today.css'], /\.learning-resume-grid\.is-four \.smart-prayer-card\{border:0;box-shadow:var\(--clay-card-shadow\)\}/);
  assert.doesNotMatch(sheets['today.css'], /meat-dairy-card\.is-waiting\{box-shadow/);
  assert.equal((fresh.match(/class="resume-icon"/g) || []).length, 2, 'the two recent tiles carry their place\'s icon');
  assert.match(sheets['today.css'], /\.resume-icon\{position:absolute;top:6px;left:50%;display:grid;place-items:center;width:44px;height:44px;margin-left:-22px/);
  assert.match(sheets['today.css'], /\.smart-prayer-compass\{inset-block-start:6px;inset-inline:auto;left:50%;margin-left:-22px\}/, 'the compass in the same place');
  assert.match(sheets['today.css'], /\.meat-dairy-card::before\{content:"";position:absolute;top:13px;left:50%;width:30px;height:30px;margin-left:-15px/);
  assert.match(sheets['today.css'], /\.learning-resume-grid\.is-four :is\(\.learning-resume-item\)\{display:flex;flex-direction:column;align-items:center;justify-content:center;[^}]*height:100%;min-height:100px;[^}]*text-align:center\}/);
});

test('Today (clay): the columns around the circle mirror each other — four lines each, no "·"; no quotes; no empty ללא מעגלים; no green dot', () => {
  const today = read('../src/pages/TodayPage.jsx');
  assert.match(today, /extra: window\.name \? startName : 'הדלקת נרות'/);
  assert.match(today, /extra: rabbenuTam \? `רבנו תם \$\{time\(rabbenuTam\)\}` : 'צאת הכוכבים'/);
  assert.match(sheets['today.css'], /\.spiritual-side\{align-self:center;grid-template-rows:repeat\(4,auto\)/);
  assert.match(sheets['today.css'], /:is\(\.spiritual-side-kicker,\.spiritual-side-note,\.spiritual-side-extra\)\{[^}]*white-space:nowrap/);
  assert.match(today, /\{clay && !completion\.shownLifetime\s*\? <OlamFirstLine /);
  const ring = read('../src/components/SpiritualRing.jsx');
  const clayDot = /const CLAY_DOT = \{([\s\S]*?)\n\};/.exec(ring)[1];
  assert.doesNotMatch(clayDot, /#b8ffe0|90,\s*255,\s*190|100,\s*255,\s*190|40,\s*200,\s*150/i, 'no green');
  assert.match(clayDot, /138,\s*180,\s*244/, 'the logo blue by night');
});

test('the moulded icon set: every main category drawn, decorative inside a named button', () => {
  const icons = read('../src/components/ui/ClayIcon.jsx');
  for (const name of ['today', 'calendar', 'tehillim', 'siddur', 'times', 'settings', 'halacha', 'books', 'talmud', 'leatzmi', "'mitzvot-journal'", 'more']) assert.match(icons, new RegExp(`\\n  ${name}: \\[`), name);
  assert.match(icons, /aria-hidden="true" focusable="false"/);
  const shell = read('../src/components/Shell.jsx');
  assert.match(shell, /<PlaceIcon id=\{id\} \/>\{CLAY \? <span className="tab-label">\{label\}<\/span> : label\}/, 'the dock keeps its words');
  assert.match(shell, /\['settings', 'הגדרות'\]/, 'the עוד grid: twelve tiles, 3×4');
});
