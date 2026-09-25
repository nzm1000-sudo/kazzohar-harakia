import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const component = readFileSync(fileURLToPath(new URL('../src/components/ClearableInput.jsx', import.meta.url)), 'utf8');
const css = readFileSync(fileURLToPath(new URL('../src/styles/base.css', import.meta.url)), 'utf8');

test('shared clearable input reserves its control area and retains focus after clearing', () => {
  assert.match(component, /inputRef\.current\?\.focus\(\)/);
  assert.match(component, /hidden=\{!hasValue\}/);
  assert.match(component, /aria-label=\{clearLabel\}/);
  assert.match(css, /\.clearable-input\{[^}]*min-width:0[^}]*max-width:100%/);
  assert.match(css, /\.clearable-input>input\{[^}]*padding-inline-start:48px[^}]*font-size:max\(16px,1em\)/);
  assert.match(css, /\.clearable-input>input::-webkit-search-cancel-button\{appearance:none/);
});

test('shared input controls cannot widen their containing mobile layout', () => {
  assert.match(css, /\.clearable-input\{[^}]*width:100%/);
  assert.match(css, /\.clearable-input>input\{[^}]*width:100%[^}]*min-width:0/);
  assert.match(css, /\.search-group,.halacha-results,.siddur-index\{[^}]*min-width:0[^}]*max-width:100%/);
});

test('all editable text controls keep the iOS focus-zoom floor, including legacy forms', () => {
  assert.match(css, /\.head-search input\{[^}]*font-size:16px/);
  assert.match(css, /input:not\(\[type=checkbox\]\):not\(\[type=radio\]\):not\(\[type=range\]\),textarea,select\{font-size:max\(16px,1em\)/);
});