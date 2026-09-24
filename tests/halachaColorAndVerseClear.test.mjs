import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const halachaSource = readFileSync(fileURLToPath(new URL('../src/pages/HalachaLibrary.jsx', import.meta.url)), 'utf8');
const cssSource = readFileSync(fileURLToPath(new URL('../src/styles/base.css', import.meta.url)), 'utf8');
const personalToolsSource = readFileSync(fileURLToPath(new URL('../src/pages/PersonalTools.jsx', import.meta.url)), 'utf8');

test('halacha topic cards use a palette-derived tone class, not a hard-coded color', () => {
  assert.match(halachaSource, /topic-card tone-\$\{index % 6\}/);
  for (let tone = 0; tone < 6; tone += 1) {
    assert.match(cssSource, new RegExp(`\\.topic-card\\.tone-${tone}\\{--tone-shift:`));
  }
  assert.doesNotMatch(cssSource, /\.topic-card\s*\{[^}]*#[0-9a-fA-F]{3,6}/, 'the tone system must not hard-code hex colors');
});

test('halacha topic bubbles use a compact rounded-rectangle shape, not an oval pill', () => {
  assert.match(cssSource, /\.topic-card button\{padding:6px 11px;border:1px solid var\(--line\);border-radius:8px/);
});

test('a daily contextual halacha card is rendered from the verified pool only', () => {
  assert.match(halachaSource, /pickDailyHalacha\(context \|\| \{\}\)/);
  assert.match(halachaSource, /halacha-daily-card/);
});

test('civil-number and index-number badges are fixed-size circles that cannot stretch into an oval', () => {
  assert.match(cssSource, /\.civil-number\{[^}]*width:28px;min-width:28px;height:28px/);
  assert.match(cssSource, /\.index-number\{[^}]*width:30px;min-width:30px;height:30px/);
});

test('My Verse has a visible clear control on the name field, only shown when it has content', () => {
  assert.match(personalToolsSource, /verse-name-clear/);
  assert.match(personalToolsSource, /\{name && <button type="button" className="verse-name-clear"/);
  assert.match(personalToolsSource, /setName\(''\); setResults\(\[\]\);/);
});
