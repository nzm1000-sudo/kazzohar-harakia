import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const source = fileURLToPath(new URL('../src/pages/CalendarPage.jsx', import.meta.url));
const compiled = buildSync({
  entryPoints: [source],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
  loader: { '.jsx': 'jsx' },
  jsx: 'automatic',
  define: { 'import.meta.env.BASE_URL': '"/"' },
  external: ['react', 'react/jsx-runtime'],
}).outputFiles[0].text;
const calendarModule = new Module(source);
calendarModule.filename = source;
calendarModule.paths = Module._nodeModulePaths(root);
calendarModule._compile(compiled, source);
const { gregorianMonthLabel } = calendarModule.exports;

test('the calendar month header shows only the Gregorian month name and year', () => {
  assert.equal(gregorianMonthLabel('2026-09-01'), 'ספטמבר 2026');
  assert.equal(gregorianMonthLabel('2026-09-24'), 'ספטמבר 2026');
  assert.equal(gregorianMonthLabel('2026-12-15'), 'דצמבר 2026');
});

test('the month header never includes a day-of-month digit', () => {
  const label = gregorianMonthLabel('2026-09-24');
  assert.doesNotMatch(label, /^\d/);
  assert.equal((label.match(/\d+/g) || []).length, 1);
});
