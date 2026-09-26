import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_SETTINGS, isValidTimeZone, normalizeSettings } from '../src/services.mjs';

test('browser bundle never calls CommonJS require (crashed every source reader on device)', () => {
  const source = readFileSync(new URL('../src/hooks.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\brequire\(/);
});

test('corrupted or partial stored settings fall back to a usable location', () => {
  for (const saved of [null, [], 'x', {}, { location: null }, { location: { tzid: 'Not/AZone', latitude: 1, longitude: 2 } }, { location: { tzid: 'Asia/Jerusalem' } }]) {
    const settings = normalizeSettings(saved);
    assert.equal(settings.location, DEFAULT_SETTINGS.location);
    assert.ok(isValidTimeZone(settings.location.tzid));
  }
});

test('valid stored settings are kept as-is', () => {
  const location = { name: 'לונדון', latitude: 51.5, longitude: -0.12, tzid: 'Europe/London', il: false };
  const settings = normalizeSettings({ location, candles: 40 });
  assert.equal(settings.location, location);
  assert.equal(settings.candles, 40);
  assert.equal(settings.nusach, DEFAULT_SETTINGS.nusach);
});
