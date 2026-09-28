// Zmanim computed on the device (services/zmanimLocal.mjs) against captured answers of the Hebcal zmanim API for four
// cities and fourteen dates (ordinary Shabbat, Yom Kippur, fasts, Tisha B'Av, DST changes), and — for sunrise and
// sunset — an independent solar service. Allowed differences: ≤ 1 minute against Hebcal (both round to the minute);
// ≤ 3 minutes against sunrise-sunset.org (a different refraction model). Rabbenu Tam is exactly sunset + 72.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeZmanim, rabbenuTamAfterSunset, civilKeyAt, RABBENU_TAM_METHOD, RABBENU_TAM_MINUTES } from '../src/services/zmanimLocal.mjs';
import { zmanim, ZMANIM, getRequestDiagnostics } from '../src/services.mjs';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/hebcalZmanim.json', import.meta.url), 'utf8'));
const minutes = (a, b) => Math.abs(new Date(a) - new Date(b)) / 60000;

test('every zman agrees with the Hebcal API to the minute, in Jerusalem, Netivot, New York and London, across DST changes', () => {
  assert.equal(fixture.samples.length, 56);
  let compared = 0;
  for (const sample of fixture.samples) {
    const local = computeZmanim(sample.date, { latitude: sample.latitude, longitude: sample.longitude, tzid: sample.tzid });
    for (const [key, value] of Object.entries(sample.times)) {
      if (!(key in local)) continue;
      // Midsummer London: the sun never reaches 16.1° below the horizon, and the API answers null — so does the device.
      if (value === null) { assert.equal(local[key], null, `${sample.city} ${sample.date} ${key} should be null`); continue; }
      assert.ok(local[key], `${sample.city} ${sample.date} ${key} missing`);
      assert.ok(minutes(value, local[key]) <= 1, `${sample.city} ${sample.date} ${key}: api ${value} local ${local[key]}`);
      compared += 1;
    }
  }
  assert.ok(compared > 1400, `compared ${compared} values`);
});

test('sunrise and sunset agree with an independent solar service within three minutes', () => {
  for (const sample of fixture.samples.filter(item => item.independent)) {
    const local = computeZmanim(sample.date, { latitude: sample.latitude, longitude: sample.longitude, tzid: sample.tzid });
    assert.ok(minutes(sample.independent.sunset, local.sunset) <= 3, `${sample.city} ${sample.date} sunset`);
    assert.ok(minutes(sample.independent.sunrise, local.sunrise) <= 3, `${sample.city} ${sample.date} sunrise`);
  }
});

test('Rabbenu Tam is one documented method: a fixed 72 minutes after sea-level sunset', () => {
  assert.equal(RABBENU_TAM_MINUTES, 72);
  assert.equal(RABBENU_TAM_METHOD.id, 'sunset-plus-72');
  for (const sample of fixture.samples) {
    const location = { latitude: sample.latitude, longitude: sample.longitude, tzid: sample.tzid };
    const local = computeZmanim(sample.date, location);
    assert.equal(minutes(local.sunset, local.tzeit72min), 72, `${sample.city} ${sample.date}`);
    assert.equal(rabbenuTamAfterSunset(sample.date, location).toISOString(), local.tzeit72min);
  }
  assert.ok(ZMANIM.some(([key, label]) => key === 'tzeit72min' && /רבנו תם/.test(label)));
});

test('the app\'s zmanim come from the device — no network, and an honest error without a location', async () => {
  const times = await zmanim('2026-11-06', { location: { latitude: 31.778, longitude: 35.235, tzid: 'Asia/Jerusalem' } });
  assert.ok(times.sunset && times.tzeit85deg && times.alotHaShachar);
  assert.equal(getRequestDiagnostics().zmanim.source, 'local');
  await assert.rejects(zmanim('2026-11-06', { location: { name: 'x' } }), /נדרש מיקום לחישוב הזמן/);
  assert.equal(computeZmanim('2026-11-06', null), null);
  assert.equal(civilKeyAt('2026-11-06T23:30:00Z', 'Asia/Jerusalem'), '2026-11-07');
  assert.equal(civilKeyAt('2026-11-06T23:30:00Z', 'America/New_York'), '2026-11-06');
});
