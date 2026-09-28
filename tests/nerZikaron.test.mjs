// נר זיכרון — the personal yahrzeit: dates, leap years, the 30th of Cheshvan and Kislev, a full 19-year cycle, the
// Today card from sunset, reminders that reconcile, and privacy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HDate, months } from '@hebcal/core';
import { validHebrewDate, hebrewFromCivilDeath, yahrzeitsInYear, nextYahrzeit, upcomingYahrzeits, activeMemorials, sortByNext, reminderSchedule,
  adarChoiceMatters, defaultAdarRule, parseStore, serializeStore, memorialName, hebrewDayLabel } from '../src/services/memorialYahrzeit.mjs';
import { diffSchedule, scheduleRecord, stableId } from '../src/services/notificationEngine.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const rec = (day, month, year, extra = {}) => ({ id: extra.id || `r${day}-${month}-${year}`, displayName: 'משה בן אסתר', gender: 'm', dateConfidence: 'exact', hebrewDeathDate: { day, month, year }, homeDisplay: { duration: 1 }, reminder: { enabled: true, daysBefore: 1, time: '09:00' }, ...extra });
const { CHESHVAN, KISLEV, TEVET, SHVAT, ADAR_I, ADAR_II, TISHREI, NISAN } = months;
const ymd = hd => [hd.getDate(), hd.getMonth(), hd.getFullYear()];

test('basic: a Hebrew date of death → the same day every year; next in this year or the next', () => {
  assert.deepEqual(ymd(yahrzeitsInYear(rec(13, CHESHVAN, 5781), 5787)[0]), [13, CHESHVAN, 5787]);
  assert.deepEqual(yahrzeitsInYear(rec(13, CHESHVAN, 5781), 5781), [], 'no yahrzeit in the year of death');
  assert.deepEqual(ymd(nextYahrzeit(rec(13, CHESHVAN, 5781), new HDate(1, CHESHVAN, 5787))), [13, CHESHVAN, 5787], 'later this year');
  assert.deepEqual(ymd(nextYahrzeit(rec(13, CHESHVAN, 5781), new HDate(20, CHESHVAN, 5787))), [13, CHESHVAN, 5788], 'next year');
  assert.deepEqual(ymd(nextYahrzeit(rec(13, CHESHVAN, 5781), new HDate(13, CHESHVAN, 5787))), [13, CHESHVAN, 5787], 'today counts');
  assert.equal(validHebrewDate({ day: 5, month: ADAR_II, year: 5786 }), false, 'no Adar II in a common year');
  assert.equal(validHebrewDate({ day: 30, month: TEVET, year: 5786 }), false, 'Tevet has 29 days');
});

test('a civil date: before sunset → that Hebrew day, after → the next, unknown → both, nothing decided', () => {
  const before = hebrewFromCivilDeath({ day: 15, month: 10, year: 2020, sunsetRelation: 'before' });
  const after = hebrewFromCivilDeath({ day: 15, month: 10, year: 2020, sunsetRelation: 'after' });
  assert.deepEqual(before.date, { day: 27, month: TISHREI, year: 5781 });
  assert.deepEqual(after.date, { day: 28, month: TISHREI, year: 5781 });
  const unknown = hebrewFromCivilDeath({ day: 15, month: 10, year: 2020, sunsetRelation: 'unknown' });
  assert.equal(unknown.confidence, 'uncertain'); assert.equal(unknown.date, null);
  assert.deepEqual(unknown.candidates, { before: before.date, after: after.date });
  assert.equal(hebrewFromCivilDeath({ day: 31, month: 2, year: 2021, sunsetRelation: 'before' }), null, 'no 31 February');
  // an uncertain record never schedules and never shows
  const uncertain = { ...rec(1, 1, 5781), dateConfidence: 'uncertain', hebrewDeathDate: null };
  assert.deepEqual(reminderSchedule([uncertain], new HDate(1, TISHREI, 5787)), []);
  assert.deepEqual(activeMemorials([uncertain], new HDate(1, TISHREI, 5787)), []);
});

test('leap years: Adar, Adar I, Adar II, and the custom where it differs', () => {
  const plainAdar = rec(10, ADAR_I, 5785); // 5785 common: Adar
  assert.equal(adarChoiceMatters(plainAdar.hebrewDeathDate), true);
  assert.deepEqual(ymd(yahrzeitsInYear(plainAdar, 5786)[0]), [10, ADAR_I, 5786], 'common year: Adar');
  assert.deepEqual(ymd(yahrzeitsInYear(plainAdar, 5787)[0]), [10, ADAR_I, 5787], 'leap year, the Rema: Adar I');
  assert.deepEqual(ymd(yahrzeitsInYear({ ...plainAdar, adarRule: 'adar2' }, 5787)[0]), [10, ADAR_II, 5787], 'leap year, the Mechaber: Adar II');
  assert.deepEqual(yahrzeitsInYear({ ...plainAdar, adarRule: 'both' }, 5787).map(ymd), [[10, ADAR_I, 5787], [10, ADAR_II, 5787]]);
  assert.equal(defaultAdarRule('edot'), 'adar2'); assert.equal(defaultAdarRule('ashkenaz'), 'adar1');
  const adar2 = rec(10, ADAR_II, 5784); // death in Adar II of a leap year
  assert.deepEqual(ymd(yahrzeitsInYear(adar2, 5786)[0]), [10, ADAR_I, 5786], 'common year: Adar');
  assert.deepEqual(ymd(yahrzeitsInYear(adar2, 5787)[0]), [10, ADAR_II, 5787], 'leap year: Adar II');
  const adar1 = rec(10, ADAR_I, 5784); // death in Adar I of a leap year
  assert.equal(adarChoiceMatters(adar1.hebrewDeathDate), false);
  assert.deepEqual(ymd(yahrzeitsInYear(adar1, 5787)[0]), [10, ADAR_I, 5787]);
  assert.deepEqual(ymd(yahrzeitsInYear(rec(30, ADAR_I, 5784), 5786)[0]), [30, SHVAT, 5786], '30 Adar I in a common year → 30 Shevat');
});

test('30 Cheshvan and 30 Kislev follow the first anniversary; never an impossible date', () => {
  const years = y => new HDate(1, TISHREI, y);
  // 5785 has a long Cheshvan? whichever — the result must always exist and sit at the month's end or 1 Kislev.
  for (const [month, next] of [[CHESHVAN, KISLEV], [KISLEV, TEVET]]) {
    for (let deathYear = 5760; deathYear < 5790; deathYear++) {
      if (!validHebrewDate({ day: 30, month, year: deathYear })) continue;
      for (let y = deathYear + 1; y <= deathYear + 6; y++) {
        const [hd] = yahrzeitsInYear(rec(30, month, deathYear), y);
        assert.ok(hd && validHebrewDate({ day: hd.getDate(), month: hd.getMonth(), year: hd.getFullYear() }), `${deathYear}→${y}`);
        assert.ok((hd.getMonth() === month && hd.getDate() >= 29) || (hd.getMonth() === next && hd.getDate() === 1), `${deathYear}→${y}: ${hd}`);
      }
    }
  }
  assert.ok(years(5787));
});

test('a full 19-year cycle for representative dates: every yahrzeit exists, one per year (two only by the Adar custom)', () => {
  const samples = [[1, TISHREI], [30, CHESHVAN], [30, KISLEV], [29, KISLEV], [1, TEVET], [30, SHVAT], [14, ADAR_I], [30, ADAR_I], [14, ADAR_II], [15, NISAN], [29, months.ELUL]];
  for (const deathYear of [5760, 5763, 5776, 5779]) {
    for (const [day, month] of samples) {
      if (!validHebrewDate({ day, month, year: deathYear })) continue;
      for (const rule of ['adar1', 'adar2', 'both']) {
        for (let y = deathYear + 1; y <= deathYear + 19; y++) {
          const found = yahrzeitsInYear(rec(day, month, deathYear, { adarRule: rule }), y);
          assert.ok(found.length >= 1 && found.length <= 2, `${day}/${month}/${deathYear} in ${y}`);
          for (const hd of found) assert.ok(validHebrewDate({ day: hd.getDate(), month: hd.getMonth(), year: hd.getFullYear() }) && hd.getFullYear() === y, `${hd}`);
        }
      }
    }
  }
});

test('the Today card: from the sunset that begins the yahrzeit, one Jewish day or three, with honest wording', () => {
  const r = rec(13, CHESHVAN, 5781);
  assert.deepEqual(activeMemorials([], new HDate(13, CHESHVAN, 5787)), [], 'nothing saved → no card');
  assert.deepEqual(activeMemorials([r], new HDate(12, CHESHVAN, 5787)), [], 'the day before (before its sunset) → no card');
  assert.equal(activeMemorials([r], new HDate(13, CHESHVAN, 5787), { afterSunset: true })[0].status, 'הערב החלה האזכרה', 'the sunset begins it');
  assert.equal(activeMemorials([r], new HDate(13, CHESHVAN, 5787))[0].status, 'היום האזכרה');
  assert.deepEqual(activeMemorials([r], new HDate(14, CHESHVAN, 5787)), [], 'one-day mode: gone at the next sunset');
  const three = { ...r, homeDisplay: { duration: 3 } };
  assert.equal(activeMemorials([three], new HDate(14, CHESHVAN, 5787))[0].status, 'האזכרה הייתה אתמול');
  assert.equal(activeMemorials([three], new HDate(15, CHESHVAN, 5787))[0].status, 'האזכרה הייתה לפני יומיים');
  assert.deepEqual(activeMemorials([three], new HDate(16, CHESHVAN, 5787)), []);
  const two = activeMemorials([r, { ...rec(13, CHESHVAN, 5770), id: 'b', displayName: 'רחל בת שרה', gender: 'f' }], new HDate(13, CHESHVAN, 5787));
  assert.equal(two.length, 2, 'two on the same day — both, none hidden');
  // across the year's turn: a yahrzeit of 29 Elul shows on 29 Elul, and in three-day mode on 1–2 Tishrei of the next year
  const elul = { ...rec(29, months.ELUL, 5770), homeDisplay: { duration: 3 } };
  assert.equal(activeMemorials([elul], new HDate(1, TISHREI, 5787))[0].status, 'האזכרה הייתה אתמול');
});

test('the list is ordered by the next yahrzeit; undecided dates at the end', () => {
  const today = new HDate(1, CHESHVAN, 5787);
  const list = sortByNext([rec(1, TEVET, 5770, { id: 'tevet' }), rec(13, CHESHVAN, 5781, { id: 'cheshvan' }), { ...rec(1, 1, 5770), id: 'unsure', dateConfidence: 'uncertain', hebrewDeathDate: null }], today);
  assert.deepEqual(list.map(item => item.record.id), ['cheshvan', 'tevet', 'unsure']);
  assert.equal(list[0].inDays, 12);
});

test('reminders: the right lead and text, stable keys, edit reschedules, delete cancels, repeated launches add nothing', () => {
  const today = new HDate(1, CHESHVAN, 5787);
  const now = today.greg();
  const r = rec(13, CHESHVAN, 5781, { id: 'moshe', reminder: { enabled: true, daysBefore: 3, time: '08:30' } });
  const first = reminderSchedule([r], today, { now });
  assert.equal(first.length, 2, 'this year and next');
  const at = new Date(first[0].at);
  const civil = new HDate(13, CHESHVAN, 5787).greg();
  assert.equal(Math.round((new Date(civil.getFullYear(), civil.getMonth(), civil.getDate()) - new Date(at.getFullYear(), at.getMonth(), at.getDate())) / 86400000), 3);
  assert.equal(at.getHours(), 8); assert.equal(at.getMinutes(), 30);
  assert.equal(first[0].title, 'נר זיכרון');
  assert.match(first[0].body, /^בעוד 3 ימים אזכרת משה בן אסתר ז״ל · י״ג בחשון$/);
  assert.match(reminderSchedule([{ ...r, reminder: { enabled: true, daysBefore: 1, time: '09:00' } }], today, { now })[0].body, /^מחר אזכרת .* — מתחילה הערב בשקיעה$/);
  const withIds = list => list.map(item => ({ ...item, id: stableId(item.key) }));
  const record = scheduleRecord(withIds(first));
  assert.deepEqual(diffSchedule(record, withIds(reminderSchedule([r], today, { now }))), { toSchedule: [], toCancel: [] }, 'a relaunch changes nothing');
  const edited = diffSchedule(record, withIds(reminderSchedule([{ ...r, reminder: { ...r.reminder, daysBefore: 1 } }], today, { now })));
  assert.equal(edited.toCancel.length, 2); assert.equal(edited.toSchedule.length, 2);
  const deleted = diffSchedule(record, withIds(reminderSchedule([], today, { now })));
  assert.equal(deleted.toCancel.length, 2); assert.equal(deleted.toSchedule.length, 0);
  assert.deepEqual(reminderSchedule([{ ...r, reminder: { ...r.reminder, enabled: false } }], today, { now }), [], 'reminder off');
  const many = Array.from({ length: 60 }, (_, i) => rec(1 + (i % 28), 1 + (i % 12), 5770, { id: `m${i}` }));
  assert.ok(reminderSchedule(many, today, { now }).length <= 48, 'within the iOS limit');
});

test('storage is versioned and a corrupt value never crashes', () => {
  assert.deepEqual(parseStore('not json'), []);
  assert.deepEqual(parseStore(null), []);
  const stored = parseStore(serializeStore([{ id: 'a', displayName: 'רחל בת שרה', gender: 'f' }]));
  assert.equal(stored[0].schemaVersion, 1); assert.equal(stored[0].homeDisplay.duration, 1); assert.equal(stored[0].reminder.time, '09:00');
  assert.equal(memorialName(stored[0]), 'רחל בת שרה ע״ה');
  assert.equal(hebrewDayLabel(new HDate(13, CHESHVAN, 5787)), 'י״ג בחשון');
});

test('privacy, placement and the tool entry', () => {
  for (const file of ['../src/services/memorialYahrzeit.mjs', '../src/services/memorialStore.mjs', '../src/pages/NerZikaron.jsx', '../src/components/NerZikaronCard.jsx']) {
    assert.doesNotMatch(read(file), /fetch\(|XMLHttpRequest|https?:\/\/|console\.log/, file);
  }
  const today = read('../src/pages/TodayPage.jsx');
  assert.ok(today.indexOf('<NerHashem') < today.indexOf('<NerZikaronCard'), 'under נר ה׳ נשמת אדם');
  assert.match(read('../src/pages/PersonalTools.jsx'), /\['#personal-tools\/memorial', 'נר זיכרון', 'תזכורת חכמה לאזכרה של יקירינו', <ToolIcon\.memorial \/>\]/);
  assert.match(read('../src/NewApp.jsx'), /reconcileMemorialReminders\(\)/, 'reconciled on launch without asking');
  assert.match(read('../src/components/NerZikaronCard.jsx'), /<Candle \/>/, 'one candle');
});
