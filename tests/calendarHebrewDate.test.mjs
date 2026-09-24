import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { createRequire, Module } from 'node:module';

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
const { hebrewMonthsOverlapLabel, gregorianMonthLabel } = calendarModule.exports;
const calendarSource = readFileSync(source, 'utf8');

test('the Hebrew subtitle shows only the overlapping Hebrew month names, not a day range', () => {
  assert.equal(hebrewMonthsOverlapLabel('2026-09-01', '2026-09-30'), 'אלול תשפ״ו · תשרי תשפ״ז');
});

test('the Hebrew subtitle collapses to one label when both boundaries share the same Hebrew month', () => {
  const label = hebrewMonthsOverlapLabel('2026-09-01', '2026-09-05');
  assert.doesNotMatch(label, /·/, 'a single overlapping Hebrew month must not be duplicated with a separator');
  assert.equal(label, 'אלול תשפ״ו');
});

test('the Hebrew subtitle never contains a Hebrew day-of-month numeral (no day-to-day range)', () => {
  const label = hebrewMonthsOverlapLabel('2026-09-01', '2026-09-30');
  assert.doesNotMatch(label, /^[\u05D0-\u05EA]{1,4}[\u05F3\u05F4]/, 'must start with a month name, not a day numeral');
  assert.doesNotMatch(label, /\d/);
});

test('the Gregorian month heading is unchanged (kept as required)', () => {
  assert.equal(gregorianMonthLabel('2026-09-24'), 'ספטמבר 2026');
});

test('the selected-date control shows a computed Hebrew date via a custom display, not a raw native date input', () => {
  assert.match(calendarSource, /calendar-date-field/);
  assert.match(calendarSource, /className="date-display" onClick=\{openDatePicker\}/);
  assert.match(calendarSource, /\{hebrewDateLabel\(selected\)\}/);
  assert.match(calendarSource, /className="date-picker-native"/, 'the real native input still exists (hidden) so the OS date picker still opens');
});

test('calendar event labels are routed through the centralized Hebrew localization formatter', () => {
  assert.match(calendarSource, /hebrewEventLabel\(e\.hebrew\|\|e\.title\)/);
});

test('the Hebrew date of a selected cell is computed purely from the civil key (hebrewDate), independent of the live halachic clock', () => {
  assert.match(calendarSource, /const hebrewDateLabel = key => \{/);
  assert.doesNotMatch(calendarSource, /hebrewDateLabel\([^)]*now[^)]*\)/i, 'hebrewDateLabel must never be derived from "now"/sunset state');
});
