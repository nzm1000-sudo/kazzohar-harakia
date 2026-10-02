// The Clay experiment (Phase 1) stays a scoped prototype: Today only, light and dark only, a VITE_CLAY build only,
// and a material that never touches the letters or runs costly effects. See src/services/clayExperiment.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clayScopeFor, applyClayScope, CLAY_THEMES } from '../src/services/clayExperiment.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('../src/styles/clay.css').replace(/\/\*[\s\S]*?\*\//g, '');
const SCOPE = ':root[data-clay="today"]';

test('clay is on only for Today, in light or dark, in a Clay build', () => {
  assert.deepEqual(CLAY_THEMES, ['light', 'dark']);
  assert.equal(clayScopeFor({ enabled: true, isTodayPage: true, theme: 'light' }), 'today');
  assert.equal(clayScopeFor({ enabled: true, isTodayPage: true, theme: 'dark' }), 'today');
  for (const theme of ['sage', 'blue', 'plum', 'coral', 'teal', 'amber']) assert.equal(clayScopeFor({ enabled: true, isTodayPage: true, theme }), null, theme);
  assert.equal(clayScopeFor({ enabled: true, isTodayPage: false, theme: 'light' }), null, 'another page');
  assert.equal(clayScopeFor({ enabled: false, isTodayPage: true, theme: 'light' }), null, 'an ordinary build');
  assert.equal(clayScopeFor(), null);
});

test('the attribute is set and cleared on the root', () => {
  const root = { dataset: {} };
  applyClayScope('today', root);
  assert.equal(root.dataset.clay, 'today');
  applyClayScope(null, root);
  assert.equal('clay' in root.dataset, false);
});

test('every rule of clay.css is scoped under :root[data-clay="today"] (nothing leaks to other screens)', () => {
  const selectors = [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].map(([, sel]) => sel.trim()).filter(sel => !sel.startsWith('@'));
  assert.ok(selectors.length > 20);
  const unscoped = selectors.flatMap(sel => sel.split(/,(?![^(]*\))/)).map(part => part.trim()).filter(part => !part.startsWith(SCOPE));
  assert.deepEqual(unscoped, []);
});

test('the material is light to draw and never touches the letters', () => {
  assert.doesNotMatch(css, /text-shadow|backdrop-filter|-webkit-backdrop-filter|(^|[;{])\s*filter\s*:/, 'no text shadows, backdrop blurs or filters');
  assert.doesNotMatch(css, /animation\s*:\s*(?!none)/, 'nothing loops');
  for (const [, value] of css.matchAll(/transition\s*:\s*([^;}]+)/g)) {
    if (/^none/.test(value.trim())) continue;
    for (const part of value.split(/,(?![^(]*\))/)) assert.match(part.trim(), /^(transform|box-shadow|background-color) /, `transition on ${part.trim()}`);
  }
  assert.match(css, /--clay-dur:130ms/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(css, /\[data-a11y-motion\] \*\{transition:none!important\}/);
});

test('a scale of depths, not one shadow everywhere', () => {
  // One primitive per depth, defined once; components take their look from them, never a stack of their own.
  for (const primitive of ['struct-shadow', 'card-shadow', 'card-shadow-down', 'control-shadow', 'tile-shadow', 'pressed-shadow', 'well-shadow', 'chosen-shadow']) assert.match(css, new RegExp(`--clay-${primitive}:`), primitive);
  const stacks = [...css.matchAll(/box-shadow:([^;}]+)/g)].map(([, value]) => value.trim()).filter(value => !/^var\(--clay-[\w-]+\)$/.test(value));
  assert.ok(stacks.length <= 3, `hand-made shadow stacks: ${stacks.join(' | ')}`);
  // One light, from the upper left: the lit halo goes up-left, the shadow down-right.
  assert.match(css, /--clay-card-shadow:-6px -6px 14px var\(--clay-halo\),8px 10px/);
  assert.match(css, /:root\[data-clay="today"\]\[data-theme="dark"\]\{/, 'dark has its own material');
  assert.match(css, /\[data-a11y-contrast\] :is\([^)]*\)\{border:1px solid var\(--line-strong\)\}/, 'high contrast keeps full edges');
});

test('NewApp applies the scope before paint, from the build flag, the page and the theme; clay.css loads last', () => {
  const app = read('../src/NewApp.jsx');
  assert.match(app, /const clayScope = clayScopeFor\(\{ enabled: clayBuildEnabled\(\), isTodayPage, theme \}\);/);
  assert.match(app, /useLayoutEffect\(\(\) => \{ applyClayScope\(clayScope\); \}, \[clayScope\]\);/);
  const imports = [...app.matchAll(/^import '\.\/styles\/([\w-]+)\.css';/gm)].map(([, name]) => name);
  assert.equal(imports.at(-1), 'clay');
  // The ordinary builds (web / GitHub Pages and the production native app) never set the flag.
  const pkg = JSON.parse(read('../package.json'));
  assert.doesNotMatch(pkg.scripts.build, /VITE_CLAY/);
  assert.doesNotMatch(pkg.scripts['build:native'], /VITE_CLAY/);
});
