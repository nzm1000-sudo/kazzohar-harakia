// A page left open must turn its date at the location's midnight, not up to half an hour later.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const source = fileURLToPath(new URL('../src/NewApp.jsx', import.meta.url));
const text = readFileSync(source, 'utf8');
// Compile only the pure helper, without the app's component tree and its browser-only imports.
const helper = text.slice(text.indexOf('export function msUntilLocalMidnight'), text.indexOf('export default function NewApp'));
const compiled = buildSync({ stdin: { contents: helper, loader: 'js' }, format: 'cjs', write: false }).outputFiles[0].text;
const mod = new Module('midnight'); mod.paths = Module._nodeModulePaths(root); mod._compile(compiled, 'midnight.js');
const { msUntilLocalMidnight } = mod.exports;

test('milliseconds until the next midnight in the location time zone', () => {
  // 23:59:40 Israel time (UTC+3 in October) → 20 s left.
  assert.equal(msUntilLocalMidnight(new Date(Date.UTC(2026, 9, 6, 20, 59, 40)), 'Asia/Jerusalem'), 20000);
  // Exactly midnight → a full day.
  assert.equal(msUntilLocalMidnight(new Date(Date.UTC(2026, 9, 6, 21, 0, 0)), 'Asia/Jerusalem'), 24 * 3600 * 1000);
  // Another zone: 23:30 in New York (UTC−4) → 30 min.
  assert.equal(msUntilLocalMidnight(new Date(Date.UTC(2026, 9, 7, 3, 30, 0)), 'America/New_York'), 30 * 60 * 1000);
  // An unknown zone falls back to the device zone instead of throwing.
  const fallback = msUntilLocalMidnight(new Date(), 'Not/AZone');
  assert.ok(fallback > 0 && fallback <= 24 * 3600 * 1000);
});

test('the app refreshes at midnight as well as at zmanim boundaries', () => {
  assert.match(text, /msUntilLocalMidnight\(now, settings\.location\.tzid\)/);
  assert.match(text, /Math\.min\(nextBoundary \? nextBoundary\.getTime\(\) - now\.getTime\(\) \+ 1000 : Infinity, untilMidnight \+ 1000, 30 \* 60 \* 1000\)/);
});
