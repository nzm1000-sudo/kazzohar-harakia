import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('compass dial is sized to fit fully on the first screen, above the tab bar', () => {
  const page = read('../src/pages/PrayerCompass.jsx');
  assert.match(page, /window\.innerHeight - tabbarHeight - topOnPage - 16/);
  assert.match(page, /setProperty\('--compass-size'/);
  assert.match(page, /addEventListener\('resize', fit\)/);
});

test('marker and ticks scale with the dial so the geometry stays concentric', () => {
  const css = read('../src/styles/base.css');
  assert.match(css, /\.prayer-compass-visual\{width:var\(--compass-size/);
  assert.match(css, /translateY\(calc\(var\(--compass-size,330px\) \* -0\.44\)\)/);
  assert.match(css, /\.compass-tick::after\{height:calc\(var\(--compass-size,330px\) \* \.27\)\}/);
});
