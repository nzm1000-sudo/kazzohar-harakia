// מצב מסע: the offline world city list (GeoNames CC BY 4.0, Hebrew names from Wikidata CC0), world zmanim against the
// Hebcal API (captured 2026-09-30), מצב חו״ל (Eretz Yisrael or not, and the second day of Yom Tov by Maran's rule),
// and the prayer compass's target by where one stands (the Kotel marked in Jerusalem).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WORLD_CITIES, WORLD_CITIES_SOURCE } from '../src/data/worldCities.mjs';
import { offsetLabel, parseCity, placeNow, searchCities } from '../src/services/worldTimes.mjs';
import { computeZmanim } from '../src/services/zmanimLocal.mjs';
import { DIASPORA_SOURCES, YOM_TOV_RULES, applyYomTovRule, diasporaStatus, isInEretzYisrael } from '../src/services/diasporaMode.mjs';
import { JERUSALEM_TARGET, KODESH_HAKODASHIM, KOTEL, distanceKm, initialBearing, prayerTarget } from '../src/services/prayerCompass.mjs';

const cities = WORLD_CITIES.map(parseCity);
const minutes = (a, b) => Math.abs(new Date(a) - new Date(b)) / 60000;

test('the city list is open data with its attribution, of a meaningful size, and every row is usable', () => {
  assert.equal(WORLD_CITIES_SOURCE.license, 'CC BY 4.0');
  assert.equal(WORLD_CITIES_SOURCE.name, 'GeoNames');
  assert.equal(WORLD_CITIES_SOURCE.count, WORLD_CITIES.length);
  assert.ok(WORLD_CITIES.length > 1500 && WORLD_CITIES.length < 4000);
  for (const city of cities) {
    assert.ok(Number.isFinite(city.latitude) && Math.abs(city.latitude) <= 90, city.id);
    assert.ok(Number.isFinite(city.longitude) && Math.abs(city.longitude) <= 180, city.id);
    assert.doesNotThrow(() => new Intl.DateTimeFormat('en', { timeZone: city.tzid }), city.id);
  }
  const provenance = JSON.parse(readFileSync(new URL('../sources/geo/provenance.json', import.meta.url), 'utf8'));
  assert.equal(provenance.sources[0].license, 'CC BY 4.0');
  assert.match(readFileSync(new URL('../src/pages/WorldTimes.jsx', import.meta.url), 'utf8'), /GeoNames<\/a> \(CC BY 4\.0\)/);
});

test('search finds a city by its Hebrew or English name, largest first', () => {
  assert.equal(searchCities(cities, 'לונדון')[0].searchName, 'London');
  assert.equal(searchCities(cities, 'ירושלים')[0].tzid, 'Asia/Jerusalem');
  assert.equal(searchCities(cities, 'new york')[0].name, 'ניו יורק');
  assert.equal(searchCities(cities, 'melb')[0].searchName, 'Melbourne');
  assert.ok(searchCities(cities, 'אומן').some(city => city.countryCode === 'ua'));
  assert.deepEqual(searchCities(cities, 'x'), []);
});

test('world zmanim agree with the Hebcal API to the minute (five continents, two dates)', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/hebcalWorldZmanim.json', import.meta.url), 'utf8'));
  let compared = 0;
  for (const sample of fixture.samples) {
    const local = computeZmanim(sample.date, sample);
    for (const [key, value] of Object.entries(sample.times)) {
      if (value === null) continue;
      assert.ok(minutes(value, local[key]) <= 1, `${sample.city} ${sample.date} ${key}: ${value} vs ${local[key]}`);
      compared += 1;
    }
  }
  assert.ok(compared >= 80, `compared ${compared}`);
});

test('a place now: local time, Hebrew date (אור ל… after sunset), the offset from here', () => {
  const london = cities.find(city => city.searchName === 'London' && city.countryCode === 'gb');
  const noon = placeNow(london, new Date('2026-10-15T11:00:00Z'));
  assert.equal(noon.time, '12:00');
  assert.equal(noon.afterSunset, false);
  assert.match(noon.hebrew, /תשרי|חשון|חשוון/);
  assert.equal(noon.eretzYisrael, false);
  const evening = placeNow(london, new Date('2026-10-15T19:00:00Z'));
  assert.equal(evening.afterSunset, true);
  assert.match(evening.hebrew, /^אור ל/);
  assert.equal(offsetLabel('Europe/London', 'Asia/Jerusalem', new Date('2026-10-15T11:00:00Z')), '−2 שעות מכאן');
  assert.equal(offsetLabel('Asia/Kolkata', 'Asia/Jerusalem', new Date('2026-10-15T11:00:00Z')), '+2:30 שעות מכאן');
});

test('Eretz Yisrael or not: by the country when known, else by the coordinates (Eilat, Golan and Judea inside)', () => {
  assert.equal(isInEretzYisrael({ countryCode: 'il' }), true);
  assert.equal(isInEretzYisrael({ countryCode: 'ps' }), true);
  assert.equal(isInEretzYisrael({ countryCode: 'us', il: true }), false);
  const at = (latitude, longitude) => isInEretzYisrael({ latitude, longitude });
  assert.equal(at(31.778, 35.235), true, 'Jerusalem');
  assert.equal(at(29.557, 34.952), true, 'Eilat');
  assert.equal(at(33.0, 35.75), true, 'Golan');
  assert.equal(at(31.53, 35.1), true, 'Hebron');
  assert.equal(at(31.95, 35.93), false, 'Amman');
  assert.equal(at(33.89, 35.5), false, 'Beirut');
  assert.equal(at(30.04, 31.24), false, 'Cairo');
  assert.equal(at(51.5, -0.12), false, 'London');
  assert.equal(isInEretzYisrael(null), null);
});

test('מצב חו״ל by Maran: an Israeli abroad keeps one day (the calendar is unchanged), a visitor from abroad keeps two', () => {
  const london = { name: 'לונדון', latitude: 51.5, longitude: -0.12, tzid: 'Europe/London', countryCode: 'gb' };
  const jerusalem = { name: 'ירושלים', latitude: 31.77, longitude: 35.21, tzid: 'Asia/Jerusalem', countryCode: 'il' };
  const israeli = diasporaStatus({ halachicResidenceStatus: 'israel', location: london });
  assert.equal(israeli.abroad, true);
  assert.equal(israeli.regime, 'israel');
  assert.match(israeli.headline, /מצב חו״ל/);
  assert.match(israeli.detail, /יום טוב אחד/);
  assert.match(israeli.detail, /תפילת חול/);
  const settings = { halachicResidenceStatus: 'israel', location: london };
  assert.equal(applyYomTovRule(settings), settings, 'the default rule changes nothing in the calendar');
  const visitor = diasporaStatus({ halachicResidenceStatus: 'diaspora', location: jerusalem });
  assert.equal(visitor.regime, 'diaspora');
  assert.match(visitor.detail, /שני ימים טובים/);
  assert.ok(DIASPORA_SOURCES.some(source => /תצו, ג/.test(source.label)));
  assert.ok(DIASPORA_SOURCES.some(source => /HalachaID=603/.test(source.url || '')));
});

test('the override "לפי המיקום" makes the calendar follow the place, and keeps the user\'s own choice', () => {
  const london = { latitude: 51.5, longitude: -0.12, tzid: 'Europe/London', countryCode: 'gb' };
  const applied = applyYomTovRule({ halachicResidenceStatus: 'israel', il: true, yomTovRule: YOM_TOV_RULES.LOCATION, location: london });
  assert.equal(applied.halachicResidenceStatus, 'diaspora');
  assert.equal(applied.il, false);
  assert.equal(applied.residenceChoice, 'israel');
  assert.equal(diasporaStatus(applied).residence, 'israel', 'the choice survives a round trip');
  const home = applyYomTovRule({ halachicResidenceStatus: 'diaspora', yomTovRule: YOM_TOV_RULES.LOCATION, location: { latitude: 32.08, longitude: 34.78, tzid: 'Asia/Jerusalem', il: true } });
  assert.equal(home.halachicResidenceStatus, 'israel');
});

test('the compass target by where one stands: the Holy of Holies at the Kotel, the Mikdash in Jerusalem with the Kotel marked, Jerusalem elsewhere', () => {
  assert.ok(distanceKm(KOTEL, KODESH_HAKODASHIM) < 0.25, 'the Kotel is beside the Temple Mount');
  assert.ok(distanceKm(KODESH_HAKODASHIM, JERUSALEM_TARGET) < 0.1);
  const plaza = prayerTarget({ latitude: 31.7762, longitude: 35.234 });
  assert.equal(plaza.tier, 'mikdash');
  assert.equal(plaza.label, 'קודש הקודשים');
  assert.equal(plaza.landmark, KOTEL);
  const city = prayerTarget({ latitude: 31.7683, longitude: 35.2137 });
  assert.equal(city.tier, 'jerusalem');
  assert.equal(city.target, KODESH_HAKODASHIM);
  const telAviv = prayerTarget({ latitude: 32.0853, longitude: 34.7818 }, { inEretzYisrael: true });
  assert.equal(telAviv.tier, 'israel');
  assert.equal(telAviv.landmark, null);
  const newYork = prayerTarget({ latitude: 40.713, longitude: -74.006 }, { inEretzYisrael: false });
  assert.equal(newYork.tier, 'abroad');
  assert.equal(Math.round(initialBearing({ latitude: 40.713, longitude: -74.006 }, newYork.target)), 54);
  const compass = readFileSync(new URL('../src/pages/PrayerCompass.jsx', import.meta.url), 'utf8');
  assert.match(compass, /prayerTarget\(settings\.location/);
  assert.match(compass, /prayer-landmark-dot/);
});
