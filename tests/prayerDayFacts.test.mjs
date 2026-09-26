// Stage 3 — Prayer Day Facts test matrix. Expected values are explicit literals (never produced by
// the code under test); civil↔Hebrew dates are additionally cross-checked against ICU's Hebrew
// calendar, an implementation independent of @hebcal/core.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { computePrayerDayFacts, geoRegimeFrom, STATUS } from '../src/services/prayer/prayerDayFacts.mjs';

const JLM = { tzid: 'Asia/Jerusalem', latitude: 31.778, longitude: 35.235, source: 'manual' };
const NYC = { tzid: 'America/New_York', latitude: 40.7128, longitude: -74.006, source: 'manual' };
const IL = { location: JLM, halachicResidenceStatus: 'israel' };
const DIA = { location: NYC, halachicResidenceStatus: 'diaspora' };
// Local noon — safely inside the civil day (no sunset ambiguity).
const noon = (date, settings) => computePrayerDayFacts({ instant: `${date}T12:00:00${settings.location.tzid === 'Asia/Jerusalem' ? '+03:00' : '-04:00'}`, settings });
const at = (iso, settings) => computePrayerDayFacts({ instant: iso, settings });

const ICU = new Intl.DateTimeFormat('en-u-ca-hebrew', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });
const icuHebrew = date => { const p = Object.fromEntries(ICU.formatToParts(new Date(`${date}T12:00:00Z`)).map(x => [x.type, x.value])); return `${p.day} ${p.month} ${p.year}`; };
// Hebcal month numbers (Nisan = 1 … Tishrei = 7 … Adar I = 12, Adar II = 13).
const M = { NISAN: 1, IYAR: 2, SIVAN: 3, TAMUZ: 4, AV: 5, ELUL: 6, TISHREI: 7, CHESHVAN: 8, KISLEV: 9, TEVET: 10, SHVAT: 11, ADAR_I: 12, ADAR_II: 13 };

// [civil date, ICU Hebrew date, settings, expected facts subset, expected observance ids]
const FIXTURES = [
  // Ordinary days
  ['2026-11-03', '23 Heshvan 5787', IL, { isShabbat: false, isYomTov: false, isCholHamoed: false, isRoshChodesh: false, chanukahDay: null, fast: null, chag: null }, []],
  ['2026-11-07', '27 Heshvan 5787', IL, { isShabbat: true, isYomTov: false, isRoshChodesh: false, chag: null }, []],
  ['2026-10-12', '1 Heshvan 5787', IL, { isRoshChodesh: true, roshChodeshDayIndex: 2, isShabbat: false }, ['rosh-chodesh']],
  ['2026-11-10', '30 Heshvan 5787', IL, { isRoshChodesh: true, roshChodeshDayIndex: 1 }, ['rosh-chodesh']],
  // Rosh Hashanah / Yom Kippur / Tzom Gedaliah
  ['2026-09-12', '1 Tishri 5787', IL, { chag: 'rosh-hashanah', chagDayIndex: 1, isYomTov: true, isShabbat: true }, ['rosh-hashanah']],
  ['2026-09-13', '2 Tishri 5787', IL, { chag: 'rosh-hashanah', chagDayIndex: 2, isYomTov: true, isShabbat: false }, ['rosh-hashanah']],
  ['2026-09-21', '10 Tishri 5787', IL, { chag: 'yom-kippur', isYomTov: true, fast: 'yom-kippur' }, ['yom-kippur']],
  // Sukkot — Israel, every day
  ['2026-09-26', '15 Tishri 5787', IL, { chag: 'sukkot', chagDayIndex: 1, isYomTov: true, isCholHamoed: false, cholHamoedDayIndex: null, isShabbat: true }, ['sukkot']],
  ['2026-09-27', '16 Tishri 5787', IL, { chag: 'sukkot', chagDayIndex: 2, isYomTov: false, isCholHamoed: true, cholHamoedDayIndex: 1 }, ['sukkot']],
  ['2026-09-28', '17 Tishri 5787', IL, { chag: 'sukkot', chagDayIndex: 3, isCholHamoed: true, cholHamoedDayIndex: 2 }, ['sukkot']],
  ['2026-10-01', '20 Tishri 5787', IL, { chag: 'sukkot', chagDayIndex: 6, isCholHamoed: true, cholHamoedDayIndex: 5, isHoshanaRabbah: false }, ['sukkot']],
  ['2026-10-02', '21 Tishri 5787', IL, { chag: 'sukkot', chagDayIndex: 7, isCholHamoed: true, cholHamoedDayIndex: 6, isHoshanaRabbah: true }, ['sukkot']],
  ['2026-10-03', '22 Tishri 5787', IL, { chag: 'shemini-atzeret', isYomTov: true, isShabbat: true, isCholHamoed: false }, ['shemini-atzeret', 'simchat-torah']],
  ['2026-10-04', '23 Tishri 5787', IL, { chag: null, isYomTov: false, isCholHamoed: false }, []],
  // Sukkot — diaspora differs
  ['2026-09-27', '16 Tishri 5787', DIA, { chag: 'sukkot', chagDayIndex: 2, isYomTov: true, isCholHamoed: false, cholHamoedDayIndex: null }, ['sukkot']],
  ['2026-09-28', '17 Tishri 5787', DIA, { chag: 'sukkot', isCholHamoed: true, cholHamoedDayIndex: 1 }, ['sukkot']],
  ['2026-10-02', '21 Tishri 5787', DIA, { chag: 'sukkot', isCholHamoed: true, cholHamoedDayIndex: 5, isHoshanaRabbah: true }, ['sukkot']],
  ['2026-10-03', '22 Tishri 5787', DIA, { chag: 'shemini-atzeret', isYomTov: true }, ['shemini-atzeret']],
  ['2026-10-04', '23 Tishri 5787', DIA, { chag: 'simchat-torah', isYomTov: true }, ['simchat-torah']],
  // Pesach 5787 — Israel, every day (incl. Shabbat Chol HaMoed)
  ['2027-04-22', '15 Nisan 5787', IL, { chag: 'pesach', chagDayIndex: 1, isYomTov: true }, ['pesach']],
  ['2027-04-23', '16 Nisan 5787', IL, { chag: 'pesach', chagDayIndex: 2, isCholHamoed: true, cholHamoedDayIndex: 1, omerCalendarDay: 1 }, ['pesach']],
  ['2027-04-24', '17 Nisan 5787', IL, { chag: 'pesach', isCholHamoed: true, cholHamoedDayIndex: 2, isShabbat: true, isShabbatCholHamoed: true }, ['pesach']],
  ['2027-04-25', '18 Nisan 5787', IL, { isCholHamoed: true, cholHamoedDayIndex: 3 }, ['pesach']],
  ['2027-04-26', '19 Nisan 5787', IL, { isCholHamoed: true, cholHamoedDayIndex: 4 }, ['pesach']],
  ['2027-04-27', '20 Nisan 5787', IL, { isCholHamoed: true, cholHamoedDayIndex: 5 }, ['pesach']],
  ['2027-04-28', '21 Nisan 5787', IL, { chag: 'pesach', chagDayIndex: 7, isYomTov: true, isCholHamoed: false }, ['pesach']],
  ['2027-04-29', '22 Nisan 5787', IL, { chag: null, isYomTov: false }, []],
  // Pesach 5787 — diaspora
  ['2027-04-23', '16 Nisan 5787', DIA, { chag: 'pesach', chagDayIndex: 2, isYomTov: true, isCholHamoed: false }, ['pesach']],
  ['2027-04-24', '17 Nisan 5787', DIA, { isCholHamoed: true, cholHamoedDayIndex: 1, isShabbatCholHamoed: true }, ['pesach']],
  ['2027-04-27', '20 Nisan 5787', DIA, { isCholHamoed: true, cholHamoedDayIndex: 4 }, ['pesach']],
  ['2027-04-29', '22 Nisan 5787', DIA, { chag: 'pesach', chagDayIndex: 8, isYomTov: true }, ['pesach']],
  // Pesach 5786 (non-leap year) — Israel
  ['2026-04-03', '16 Nisan 5786', IL, { isCholHamoed: true, cholHamoedDayIndex: 1, omerCalendarDay: 1 }, ['pesach']],
  ['2026-04-08', '21 Nisan 5786', IL, { chag: 'pesach', chagDayIndex: 7, isYomTov: true }, ['pesach']],
  // Shavuot
  ['2027-06-11', '6 Sivan 5787', IL, { chag: 'shavuot', chagDayIndex: 1, isYomTov: true }, ['shavuot']],
  ['2027-06-12', '7 Sivan 5787', IL, { chag: null, isYomTov: false, isShabbat: true }, []],
  ['2027-06-12', '7 Sivan 5787', DIA, { chag: 'shavuot', chagDayIndex: 2, isYomTov: true, isShabbat: true }, ['shavuot']],
  // Chanukah 5787 (Kislev has 30 days): day 1 on Shabbat, day 4, RC + Chanukah, day 8 on Shabbat
  ['2026-12-05', '25 Kislev 5787', IL, { chanukahDay: 1, isShabbat: true, isRoshChodesh: false }, ['chanukah']],
  ['2026-12-08', '28 Kislev 5787', IL, { chanukahDay: 4 }, ['chanukah']],
  ['2026-12-10', '30 Kislev 5787', IL, { chanukahDay: 6, isRoshChodesh: true, roshChodeshDayIndex: 1 }, ['rosh-chodesh', 'chanukah']],
  ['2026-12-11', '1 Tevet 5787', IL, { chanukahDay: 7, isRoshChodesh: true, roshChodeshDayIndex: 2 }, ['rosh-chodesh', 'chanukah']],
  ['2026-12-12', '2 Tevet 5787', IL, { chanukahDay: 8, isShabbat: true, isRoshChodesh: false }, ['chanukah']],
  // Fasts
  ['2026-12-20', '10 Tevet 5787', IL, { fast: 'asara-betevet' }, ['asara-betevet']],
  ['2027-03-22', '13 Adar II 5787', IL, { fast: 'taanit-esther' }, ['taanit-esther']],
  ['2027-07-22', '17 Tamuz 5787', IL, { fast: 'shiva-asar-betammuz' }, ['shiva-asar-betammuz']],
  ['2027-08-12', '9 Av 5787', IL, { fast: 'tisha-beav', isYomTov: false }, ['tisha-beav']],
  // Purim — leap year (Adar II; Adar I 14 is Purim Katan) and a regular year
  ['2027-03-23', '14 Adar II 5787', IL, { purim: 'purim' }, ['purim']],
  ['2027-03-24', '15 Adar II 5787', IL, { purim: 'shushan-purim' }, ['shushan-purim']],
  ['2027-02-21', '14 Adar I 5787', IL, { purim: 'purim-katan' }, ['purim-katan']],
  ['2026-03-03', '14 Adar 5786', IL, { purim: 'purim' }, ['purim']],
  // Omer
  ['2027-05-25', '18 Iyar 5787', IL, { omerCalendarDay: 33 }, []],
];

test('fixture civil dates agree with an independent Hebrew calendar (ICU)', () => {
  for (const [date, hebrew] of FIXTURES) assert.equal(icuHebrew(date), hebrew, date);
});

for (const [date, hebrew, settings, expected, observanceIds] of FIXTURES) {
  test(`${date} (${hebrew}, ${settings.halachicResidenceStatus}) → canonical facts`, () => {
    const result = noon(date, settings);
    assert.equal(result.status, STATUS.RESOLVED);
    assert.equal(result.jewishDay.key, date);
    for (const [field, value] of Object.entries(expected)) assert.equal(result.facts[field], value, `${field}`);
    assert.deepEqual(result.observances.map(item => item.id).sort(), [...observanceIds].sort());
  });
}

test('Hebrew date components are exposed as numbers, not labels', () => {
  const result = noon('2027-03-23', IL);
  assert.deepEqual(result.jewishDay.hebrew, { year: 5787, month: M.ADAR_II, day: 14, isLeapYear: true });
  assert.equal(noon('2026-03-03', IL).jewishDay.hebrew.isLeapYear, false);
});

test('real sunset transition: same place, same civil date, before vs after sunset', () => {
  // Jerusalem sunset on 2026-09-27 is ≈18:29 local (15:29Z).
  const before = at('2026-09-27T18:15:00+03:00', IL);
  const after = at('2026-09-27T18:45:00+03:00', IL);
  assert.equal(before.civilDate, '2026-09-27');
  assert.equal(after.civilDate, '2026-09-27');
  assert.equal(before.dayBoundary.afterSunset, false);
  assert.equal(after.dayBoundary.afterSunset, true);
  assert.equal(before.jewishDay.hebrew.day, 16);
  assert.equal(after.jewishDay.hebrew.day, 17);
  assert.equal(before.facts.cholHamoedDayIndex, 1);
  assert.equal(after.facts.cholHamoedDayIndex, 2);
});

test('same instant, different place → different Jewish day and observance', () => {
  const instant = '2026-09-27T16:00:00Z'; // 19:00 Jerusalem (after sunset), 12:00 New York
  const jerusalem = at(instant, IL);
  const newYork = at(instant, DIA);
  assert.equal(jerusalem.jewishDay.hebrew.day, 17);
  assert.equal(newYork.jewishDay.hebrew.day, 16);
  assert.equal(jerusalem.facts.isCholHamoed, true);
  assert.equal(newYork.facts.isYomTov, true);
});

test('daylight-saving change is handled by the real time zone (no fixed offsets)', () => {
  // New York leaves DST at 02:00 on 2026-11-01: 01:30 happens twice.
  const first = at('2026-11-01T05:30:00Z', DIA); // 01:30 EDT
  const second = at('2026-11-01T06:30:00Z', DIA); // 01:30 EST
  assert.equal(first.civilDate, '2026-11-01');
  assert.equal(second.civilDate, '2026-11-01');
  assert.equal(first.jewishDay.key, second.jewishDay.key);
  assert.equal(first.dayBoundary.afterSunset, false);
});

test('app zmanim are preferred when valid for the day; stale zmanim are ignored, not reused', () => {
  const sunset = '2026-09-27T15:29:00Z';
  const withApp = computePrayerDayFacts({ instant: '2026-09-27T12:00:00+03:00', settings: IL, times: { sunset } });
  assert.equal(withApp.dayBoundary.source, 'app-zmanim');
  const stale = computePrayerDayFacts({ instant: '2026-09-27T12:00:00+03:00', settings: IL, times: { sunset: '2026-09-20T15:40:00Z' } });
  assert.equal(stale.dayBoundary.source, 'local-solar');
});

test('unknown is not false: missing coordinates → provisional day, boundary unresolved', () => {
  const result = computePrayerDayFacts({ instant: '2026-11-03T12:00:00+02:00', settings: { location: { tzid: 'Asia/Jerusalem' }, halachicResidenceStatus: 'israel' } });
  assert.equal(result.dayBoundary.status, STATUS.UNRESOLVED);
  assert.equal(result.dayBoundary.afterSunset, null);
  assert.equal(result.jewishDay.status, STATUS.PROVISIONAL);
  assert.notEqual(result.status, STATUS.RESOLVED);
  assert.ok(result.provenance.warnings.includes('jewish-day-provisional'));
});

test('polar location without a sunset → unsupported (never treated as daytime)', () => {
  const result = computePrayerDayFacts({ instant: '2026-06-21T12:00:00+02:00', settings: { location: { tzid: 'Europe/Oslo', latitude: 69.65, longitude: 18.96 }, halachicResidenceStatus: 'diaspora' } });
  assert.equal(result.dayBoundary.status, STATUS.UNSUPPORTED);
  assert.equal(result.dayBoundary.afterSunset, null);
  assert.notEqual(result.status, STATUS.RESOLVED);
});

test('missing time zone → unresolved, no facts invented', () => {
  const result = computePrayerDayFacts({ instant: '2026-11-03T10:00:00Z', settings: { location: {}, halachicResidenceStatus: 'israel' } });
  assert.equal(result.status, STATUS.UNRESOLVED);
  assert.equal(result.facts, null);
});

test('unknown Israel/diaspora: resolved where both agree, unresolved where they differ', () => {
  const unknown = { location: JLM };
  assert.equal(geoRegimeFrom({}).regime, 'unknown');
  const ordinary = noon('2026-11-03', unknown);
  assert.equal(ordinary.observanceStatus, STATUS.RESOLVED);
  const differs = noon('2026-09-27', unknown); // Chol HaMoed in Israel, Yom Tov abroad
  assert.equal(differs.observanceStatus, STATUS.UNRESOLVED);
  assert.equal(differs.facts, null);
  assert.ok(differs.provenance.warnings.includes('geo-regime-unknown-and-observances-differ'));
});

test('language independence: canonical facts carry machine ids only', () => {
  const he = noon('2026-12-10', { ...IL, uiLanguage: 'he' });
  const en = noon('2026-12-10', { ...IL, uiLanguage: 'en' });
  assert.deepEqual(he, en);
  const text = JSON.stringify({ observances: he.observances, facts: he.facts });
  assert.doesNotMatch(text, /[֐-׿]/, 'no Hebrew display text in facts');
  for (const item of he.observances) assert.match(item.id, /^[a-z-]+$/);
});

test('determinism: identical inputs → identical facts', () => {
  assert.deepEqual(noon('2027-04-24', IL), noon('2027-04-24', IL));
});

test('host time zone does not change the result', () => {
  const script = fileURLToPath(new URL('./fixtures/prayerDayFactsProbe.mjs', import.meta.url));
  const outputs = ['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'UTC'].map(TZ => spawnSync(process.execPath, [script], { env: { ...process.env, TZ }, encoding: 'utf8' }).stdout);
  assert.ok(outputs[0].length > 100, 'probe produced output');
  assert.equal(outputs[1], outputs[0]);
  assert.equal(outputs[2], outputs[0]);
});

test('invariants hold across a regular and a leap year, Israel and diaspora', () => {
  for (const settings of [IL, DIA]) {
    const perYear = {};
    for (let t = Date.UTC(2025, 8, 20); t <= Date.UTC(2027, 9, 10); t += 864e5) {
      const date = new Date(t).toISOString().slice(0, 10);
      const result = noon(date, settings);
      const f = result.facts;
      const year = result.jewishDay.hebrew.year;
      perYear[year] ||= { chanukah: [], omer: [], sukkotChm: 0, pesachChm: 0 };
      if (f.isCholHamoed) {
        assert.ok(['sukkot', 'pesach'].includes(f.cholHamoedChag), `${date} chol hamoed festival`);
        assert.ok(f.cholHamoedDayIndex >= 1, `${date} chol hamoed index`);
        perYear[year][`${f.cholHamoedChag}Chm`] += 1;
      }
      if (f.cholHamoedDayIndex !== null) assert.equal(f.isCholHamoed, true, date);
      if (f.chagDayIndex !== null) assert.ok(f.chag, date);
      if (f.isYomTov) assert.ok(f.chag, `${date} yom tov has identity`);
      assert.ok(!(f.isYomTov && f.isCholHamoed), `${date} not both yom tov and chol hamoed`);
      if (f.isShabbatCholHamoed) assert.ok(f.isShabbat && f.isCholHamoed, date);
      if (f.chanukahDay !== null) perYear[year].chanukah.push(f.chanukahDay);
      if (f.omerCalendarDay !== null) perYear[year].omer.push(f.omerCalendarDay);
    }
    const expectedChm = settings === IL ? { sukkot: 6, pesach: 5 } : { sukkot: 5, pesach: 4 };
    for (const year of [5786, 5787]) {
      assert.deepEqual(perYear[year].chanukah, [1, 2, 3, 4, 5, 6, 7, 8], `${year} Chanukah days`);
      assert.deepEqual(perYear[year].omer, Array.from({ length: 49 }, (_, i) => i + 1), `${year} Omer days`);
      assert.equal(perYear[year].pesachChm, expectedChm.pesach, `${year} Pesach chol hamoed days`);
    }
    assert.equal(perYear[5787].sukkotChm, expectedChm.sukkot, 'Sukkot 5787 chol hamoed days');
  }
});
