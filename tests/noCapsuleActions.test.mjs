import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const css = read('../src/styles/base.css');
// Capsules are reserved for segmented controls, toggles, filter/status chips and non-button graphics.
const ALLOWED_PILLS = new Set(['.personal-switch button', '.shell-nav button', '.head-search input', '.theme-trigger', '.seg', '.badge', '.prayer-target-marker', '.prep-progress progress', '.prep-task-assignee']);

test('buttons never fall back to the native WebKit capsule', () => {
  assert.match(css, /^button\{cursor:pointer;-webkit-appearance:none;appearance:none\}$/m);
});

test('only segmented controls, toggles and chips use a capsule radius', () => {
  const pills = [...css.matchAll(/([^{}]+)\{[^{}]*border-radius:(?:999|9999|99)px[^{}]*\}/g)].map(match => match[1].trim());
  assert.deepEqual(pills.filter(selector => !ALLOWED_PILLS.has(selector)), []);
  assert.match(css, /button\.ghost\{[^}]*border-radius:var\(--radius-sm\)/);
});

test('inline prayer notice actions are text links, not ovals', () => {
  const reader = read('../src/components/ComposedPrayerReader.jsx');
  assert.match(reader, /<button type="button" className="link" onClick=\{\(\) => renew\(\{\}\)\}>פתיחה מחדש להיום<\/button>/);
  assert.match(reader, /<button type="button" className="link" onClick=\{onReopen\}>/);
  assert.match(css, /\.composed-notice button\.link\{display:inline;[^}]*border:0;background:none;/);
  const tehillim = read('../src/Tehillim.jsx');
  assert.match(tehillim, /const btn = \(T, on\) => \(\{ minHeight: 40, padding: '6px 12px', borderRadius: 'var\(--radius-sm\)'/);
  assert.match(tehillim, /aria-label="מועדפים" style=\{chip\(/, 'the favorite toggle keeps its capsule');
});
