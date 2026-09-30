// נגישות: one preference store; by default the app follows the device and looks exactly as designed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHROME_MAX_SCALE, DEFAULTS, STORE_KEY, TEXT_SIZES, applyToDocument, getPreferences, normalizePreferences, readPreferences, resetPreferences, resolvePreferences, systemTextScale, writePreferences } from '../src/services/accessibility/preferences.mjs';

const store = new Map();
globalThis.localStorage = { getItem: key => (store.has(key) ? store.get(key) : null), setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key) };

// A minimal <html> for applyToDocument.
function fakeDocument(probePx = 17) {
  const attrs = new Map();
  const style = new Map();
  const root = { setAttribute: (k, v) => attrs.set(k, v), removeAttribute: k => attrs.delete(k), style: { setProperty: (k, v) => style.set(k, v), removeProperty: k => style.delete(k) } };
  return { attrs, style, doc: { documentElement: root, getElementById: id => (id === 'kz-dynamic-type-probe' ? {} : null) }, win: (ua = 'iPhone') => ({ navigator: { userAgent: ua }, matchMedia: () => ({ matches: false }), getComputedStyle: () => ({ fontSize: `${probePx}px` }) }) };
}

test('defaults: automatic adjustment on, text follows the system, nothing forced', () => {
  assert.equal(DEFAULTS.auto, true);
  assert.equal(DEFAULTS.textSize, 'system');
  assert.deepEqual(TEXT_SIZES.map(([id]) => id), ['system', '100', '115', '130', '150', '175', '200']);
  assert.equal(DEFAULTS.focusedReading, false);
  assert.equal(DEFAULTS.haptics, true);
});

test('a damaged or old record never breaks the app', () => {
  assert.deepEqual(normalizePreferences(null), { ...DEFAULTS });
  assert.deepEqual(normalizePreferences({ textSize: '999', bold: 'yes', lineSpacing: 'wide', contrast: true }), { ...DEFAULTS, lineSpacing: 'wide', contrast: true });
  store.set(STORE_KEY, '{not json');
  assert.deepEqual(readPreferences(), { ...DEFAULTS });
});

test('persisted, and reset returns to the device settings', () => {
  writePreferences({ ...DEFAULTS, textSize: '150', bold: true });
  assert.equal(JSON.parse(store.get(STORE_KEY)).textSize, '150');
  assert.equal(getPreferences().bold, true);
  resetPreferences();
  assert.deepEqual(getPreferences(), { ...DEFAULTS });
});

test('the device asks, the app follows (while automatic adjustment is on); the reader\'s switch always wins', () => {
  const device = { reduceMotion: true, moreContrast: true, reduceTransparency: true };
  const followed = resolvePreferences(DEFAULTS, device);
  assert.equal(followed.highContrast, true);
  assert.equal(followed.reduceTransparency, true);
  assert.equal(followed.reduceMotion, true);
  const manual = resolvePreferences({ ...DEFAULTS, auto: false }, device);
  assert.equal(manual.highContrast, false, 'automatic adjustment off: the app keeps its own look');
  assert.equal(manual.reduceMotion, true, 'a request to reduce motion is always honoured');
  assert.equal(resolvePreferences({ ...DEFAULTS, auto: false, contrast: true }, {}).highContrast, true);
  assert.equal(resolvePreferences({ ...DEFAULTS, lineSpacing: 'wide' }, {}).lineFactor, 1.25);
});

test('Dynamic Type: the default size changes nothing; larger sizes scale the text (up to 200%)', () => {
  assert.equal(systemTextScale(17), 1);
  assert.equal(systemTextScale(14), 1, 'a smaller system size keeps the app\'s own sizes');
  assert.equal(systemTextScale(23), 1.35);
  assert.equal(systemTextScale(53), 2);
  assert.equal(systemTextScale('abc'), 1);
});

test('nothing is written on <html> for a reader who changed nothing (the design is untouched)', () => {
  resetPreferences();
  const page = fakeDocument(17);
  const effective = applyToDocument(page.doc, page.win());
  assert.equal(effective.textScale, 1);
  assert.equal(page.attrs.size, 0);
  assert.equal(page.style.size, 0);
});

test('text size on a phone: the text grows (text-size-adjust); the header and tab bar stop at 130%', () => {
  writePreferences({ ...DEFAULTS, textSize: '200', bold: true, contrast: true, focusedReading: true });
  const page = fakeDocument(17);
  applyToDocument(page.doc, page.win('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'));
  assert.equal(page.attrs.get('data-a11y-text'), 'adjust');
  assert.equal(page.style.get('-webkit-text-size-adjust'), '200%');
  assert.equal(page.style.get('--a11y-chrome-adjust'), `${CHROME_MAX_SCALE * 100}%`);
  for (const name of ['data-a11y-bold', 'data-a11y-contrast', 'data-a11y-focus-reading']) assert.ok(page.attrs.has(name), name);
  const desktop = fakeDocument(17);
  applyToDocument(desktop.doc, desktop.win('Mozilla/5.0 (Macintosh)'));
  assert.equal(desktop.attrs.get('data-a11y-text'), 'zoom', 'a desktop browser zooms instead');
  // System size at an accessibility size: the text follows the device.
  resetPreferences();
  const large = fakeDocument(34);
  applyToDocument(large.doc, large.win());
  assert.equal(large.style.get('-webkit-text-size-adjust'), '200%');
});

test('the stylesheet: every rule is scoped to a setting; line spacing never touches letter spacing', () => {
  const css = readFileSync(new URL('../src/styles/accessibility.css', import.meta.url), 'utf8');
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map(rule => rule.trim()).filter(rule => rule.includes('{'));
  const unscoped = rules.filter(rule => !/data-a11y|kz-dynamic-type-probe|prefers-reduced-motion|^\.a11y-|^@supports|^h1\[tabindex/.test(rule.split('{')[0].trim()) && !rule.startsWith('@media'));
  assert.deepEqual(unscoped.filter(rule => !rule.startsWith('html[')), [], 'no rule applies without a setting (besides the settings screen itself)');
  assert.doesNotMatch(css, /letter-spacing/);
  assert.doesNotMatch(css, /word-spacing/);
});

test('installed before the first paint; the settings screen is reachable from the settings', () => {
  const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
  assert.match(main, /installAccessibility\(\)[\s\S]*ReactDOM\.createRoot/);
  const zmanim = readFileSync(new URL('../src/pages/ZmanimPage.jsx', import.meta.url), 'utf8');
  assert.match(zmanim, /go\('accessibility'\)/);
  const app = readFileSync(new URL('../src/NewApp.jsx', import.meta.url), 'utf8');
  assert.match(app, /mode==='accessibility' \|\| mode\.startsWith\('accessibility\/'\)/);
});
