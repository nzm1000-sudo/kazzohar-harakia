// תזכורות — Hebrew-date recurrence (with the halachic edge cases and their sources), the Omer count text, never on
// Shabbat or Yom Tov, the deep-link targets, and the rolling scheduling cap. Pure logic only (no native bridge).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HDate, months } from '@hebcal/core';
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/services.mjs';
import { alarmContext, restWindowAt, civilKeyOf, weekdayOf } from '../src/services/jewishAlarm/engine.mjs';
import { occurrencesInYear, upcomingOccurrences, hebrewFromCivil, dateNotes, firstYearStillAhead } from '../src/services/reminders/hebrewDates.mjs';
import { normalizeSmart, smartOn, omerWeeksText, omerNoticeBody } from '../src/services/reminders/smart.mjs';
import { planReminders, eventReminders, smartReminders, leadWord } from '../src/services/reminders/plan.mjs';
import { normalizeEvent, eventProblem, parseRemindersState } from '../src/services/reminders/store.mjs';
import { parseDeepLink } from '../src/services/reminders/deepLinks.mjs';
import { defaultAdarRule } from '../src/services/memorialYahrzeit.mjs';
import { NOTIFICATION_BUDGET, IOS_PENDING_LIMIT, remindersBudget } from '../src/services/notificationBudget.mjs';
import { HORIZON } from '../src/services/jewishAlarm/scheduler.mjs';

const { TISHREI, CHESHVAN, KISLEV, TEVET, SHVAT, ADAR_I, ADAR_II, NISAN, AV } = months;
const ctx = alarmContext(normalizeSettings({ ...DEFAULT_SETTINGS }));
const ymd = hd => [hd.getDate(), hd.getMonth(), hd.getFullYear()];
const ev = (type, day, month, year, extra = {}) => normalizeEvent({ id: `t-${type}-${day}-${month}-${year}`, type, name: 'פלוני', inputType: 'hebrew', hebrew: { day, month, year }, ...extra });
const inYear = (entry, y) => occurrencesInYear(entry, y).map(ymd);

// ── Yahrzeit ─────────────────────────────────────────────────────────────────────────────────────────────────────
test('yahrzeit, Adar of a common year in a leap year: Mechaber Adar II (default by Maran), Rema Adar I, or both — OC 568:7', () => {
  const base = { day: 10, month: ADAR_I, year: 5783 }; // 5783 is a common year
  assert.equal(HDate.isLeapYear(5783), false); assert.equal(HDate.isLeapYear(5787), true);
  assert.deepEqual(inYear(ev('yahrzeit', 10, ADAR_I, 5783, { adarRule: 'adar2' }), 5787), [[10, ADAR_II, 5787]], 'Maran: Adar II');
  assert.deepEqual(inYear(ev('yahrzeit', 10, ADAR_I, 5783, { adarRule: 'adar1' }), 5787), [[10, ADAR_I, 5787]], 'Rema: Adar I');
  assert.deepEqual(inYear(ev('yahrzeit', 10, ADAR_I, 5783, { adarRule: 'both' }), 5787), [[10, ADAR_I, 5787], [10, ADAR_II, 5787]]);
  assert.deepEqual(inYear(ev('yahrzeit', 10, ADAR_I, 5783, { adarRule: 'adar2' }), 5788), [[10, ADAR_I, 5788]], 'a common year: Adar');
  assert.ok(base);
  // The default custom: Maran for Edot HaMizrach (the app's rite id) and an unset rite; the Rema for the Ashkenazi rites.
  assert.equal(defaultAdarRule('edot-hamizrach'), 'adar2');
  assert.equal(defaultAdarRule(undefined), 'adar2');
  assert.equal(defaultAdarRule('edot'), 'adar2');
  for (const rite of ['ashkenaz', 'sefard', 'chabad']) assert.equal(defaultAdarRule(rite), 'adar1');
});

test('yahrzeit, death in Adar I / Adar II of a leap year: that Adar in leap years, Adar in common years', () => {
  assert.deepEqual(inYear(ev('yahrzeit', 5, ADAR_II, 5784), 5785), [[5, ADAR_I, 5785]], 'Adar II → Adar of a common year');
  assert.deepEqual(inYear(ev('yahrzeit', 5, ADAR_II, 5784), 5787), [[5, ADAR_II, 5787]]);
  assert.deepEqual(inYear(ev('yahrzeit', 5, ADAR_I, 5784), 5787), [[5, ADAR_I, 5787]], 'Adar I → Adar I in a leap year');
  assert.deepEqual(inYear(ev('yahrzeit', 30, ADAR_I, 5784), 5785), [[30, SHVAT, 5785]], '30 Adar I in a common year → 30 Shevat');
});

test('yahrzeit on 30 Cheshvan / 30 Kislev: follows the first anniversary (Magen Avraham 568:20, MB 568:42)', () => {
  // Find real years: a death on 30 Cheshvan where the next year has / lacks a 30 Cheshvan.
  const long = y => HDate.daysInMonth(CHESHVAN, y) === 30;
  const shortKislev = y => HDate.daysInMonth(KISLEV, y) === 29;
  const years = Array.from({ length: 60 }, (_, index) => 5760 + index);
  const deathWithLongNext = years.find(y => long(y) && long(y + 1));
  const deathWithShortNext = years.find(y => long(y) && !long(y + 1));
  const laterShort = y0 => years.find(y => y > y0 + 1 && !long(y));
  // First year had 30 Cheshvan → in a short year, 1 Kislev.
  assert.deepEqual(inYear(ev('yahrzeit', 30, CHESHVAN, deathWithLongNext), laterShort(deathWithLongNext)), [[1, KISLEV, laterShort(deathWithLongNext)]]);
  // First year had no 30 Cheshvan → the last day of Cheshvan ("ביום אחרון לחודש זה"): the 29th in a short year,
  // the 30th in a long one — the day before 1 Kislev, never Rosh Chodesh Kislev itself.
  const laterLong = years.find(y => y > deathWithShortNext + 1 && long(y));
  const laterShortToo = years.find(y => y > deathWithShortNext + 1 && !long(y));
  assert.deepEqual(inYear(ev('yahrzeit', 30, CHESHVAN, deathWithShortNext), laterLong), [[30, CHESHVAN, laterLong]]);
  assert.deepEqual(inYear(ev('yahrzeit', 30, CHESHVAN, deathWithShortNext), laterShortToo), [[29, CHESHVAN, laterShortToo]]);
  // The same for Kislev / Tevet.
  const kislevDeath = years.find(y => !shortKislev(y) && !shortKislev(y + 1));
  const shortLater = years.find(y => y > kislevDeath + 1 && shortKislev(y));
  assert.deepEqual(inYear(ev('yahrzeit', 30, KISLEV, kislevDeath), shortLater), [[1, TEVET, shortLater]]);
  assert.ok(dateNotes(ev('yahrzeit', 30, CHESHVAN, deathWithLongNext)).some(note => note.id === 'day-30'), 'the rule is explained, not silent');
});

test('yahrzeit first year: the day of death by default (OC 568:8, Shach YD 402:9, Yalkut Yosef); burial day only as an explicit option (3+ days)', () => {
  const death = { day: 1, month: TISHREI, year: 5786 };
  const plain = ev('yahrzeit', death.day, death.month, death.year, { burialDelayDays: 4 });
  assert.equal(plain.firstYear, 'death');
  assert.deepEqual(inYear(plain, 5787), [[1, TISHREI, 5787]]);
  const burial = ev('yahrzeit', death.day, death.month, death.year, { burialDelayDays: 4, firstYear: 'burial' });
  assert.deepEqual(inYear(burial, 5787), [[5, TISHREI, 5787]], 'first year on the burial date');
  assert.deepEqual(inYear(burial, 5788), [[1, TISHREI, 5788]], 'from the second year: the day of death');
  // Fewer than three days: the option cannot be stored.
  assert.equal(ev('yahrzeit', 1, TISHREI, 5786, { burialDelayDays: 2, firstYear: 'burial' }).firstYear, 'death');
  // The option is shown only while the first yahrzeit is still ahead.
  assert.equal(firstYearStillAhead(plain, new HDate(20, AV, 5786)), true);
  assert.equal(firstYearStillAhead(plain, new HDate(20, AV, 5788)), false);
});

// ── Birthday / anniversary ───────────────────────────────────────────────────────────────────────────────────────
test('birthday: Adar of a common year → Adar II in a leap year (Rema OC 55:10); Adar I 1–29 → Adar in a common year (SA 55:10)', () => {
  assert.deepEqual(inYear(ev('birthday', 7, ADAR_I, 5783), 5787), [[7, ADAR_II, 5787]]);
  assert.deepEqual(inYear(ev('birthday', 29, ADAR_I, 5784), 5785), [[29, ADAR_I, 5785]], 'Adar I of a leap year → Adar (the common year\'s Adar is month 12)');
  assert.deepEqual(inYear(ev('birthday', 29, ADAR_I, 5784), 5787), [[29, ADAR_I, 5787]], '→ Adar I in a leap year');
  assert.deepEqual(inYear(ev('birthday', 30, ADAR_I, 5784), 5785), [[1, NISAN, 5785]], '30 Adar I in a common year → 1 Nisan');
  assert.deepEqual(inYear(ev('birthday', 5, ADAR_II, 5784), 5787), [[5, ADAR_II, 5787]]);
});

test('birthday / anniversary on 30 Cheshvan or Kislev: the 1st of the next month when the day is missing (MB 55:45)', () => {
  const years = Array.from({ length: 40 }, (_, index) => 5760 + index);
  const born = years.find(y => HDate.daysInMonth(CHESHVAN, y) === 30);
  const short = years.find(y => y > born && HDate.daysInMonth(CHESHVAN, y) === 29);
  assert.deepEqual(inYear(ev('anniversary', 30, CHESHVAN, born), short), [[1, KISLEV, short]]);
  const bornK = years.find(y => HDate.daysInMonth(KISLEV, y) === 30);
  const shortK = years.find(y => y > bornK && HDate.daysInMonth(KISLEV, y) === 29);
  assert.deepEqual(inYear(ev('birthday', 30, KISLEV, bornK), shortK), [[1, TEVET, shortK]]);
});

test('a civil date turns into the Hebrew date, the next day after sunset; upcoming dates are in order, years counted', () => {
  assert.deepEqual(hebrewFromCivil({ day: 18, month: 8, year: 2027 }), { day: 15, month: AV, year: 5787 });
  assert.deepEqual(hebrewFromCivil({ day: 18, month: 8, year: 2027, afterSunset: true }), { day: 16, month: AV, year: 5787 });
  assert.equal(hebrewFromCivil({ day: 31, month: 2, year: 2027 }), null);
  const list = upcomingOccurrences(ev('birthday', 15, AV, 5745), new HDate(new Date(2026, 8, 30)), 3);
  assert.deepEqual(list.map(item => ymd(item.hd)), [[15, AV, 5787], [15, AV, 5788], [15, AV, 5789]]);
  assert.deepEqual(list.map(item => item.years), [42, 43, 44]);
});

// ── Never on Shabbat or Yom Tov ──────────────────────────────────────────────────────────────────────────────────
test('Hebrew-date reminders never fall on Shabbat / Yom Tov: moved to an hour before candle lighting, and say so', () => {
  // A birthday whose day-of reminder (08:00) falls on Shabbat 4.3.2028 (6 Adar 5788) moves to Friday before candles.
  const entry = normalizeEvent({ id: 'b', type: 'birthday', name: 'דוד', inputType: 'hebrew', hebrew: { day: 8, month: ADAR_I, year: 5745 }, eve: { enabled: true, time: '16:00' }, day: { enabled: true, time: '08:00' } });
  for (const year of [2026, 2027, 2028, 2029]) {
    for (const item of eventReminders(entry, ctx, { now: new Date(`${year}-01-01T00:00:00Z`), count: 2 })) {
      assert.equal(restWindowAt(item.at, ctx), null, `${item.key} is outside Shabbat / Yom Tov`);
      if (item.moved) assert.match(item.body, /הוקדם לפני (שבת|החג|שבת והחג)/);
    }
  }
  // Across many events and a whole year: nothing inside a rest window.
  const events = Array.from({ length: 30 }, (_, index) => normalizeEvent({ id: `e${index}`, type: ['birthday', 'anniversary', 'yahrzeit'][index % 3], name: 'x', inputType: 'hebrew', hebrew: { day: 1 + index, month: 1 + (index % 12), year: 5750 }, eve: { enabled: true, time: '18:30' }, day: { enabled: true, time: '10:00' } })).filter(Boolean);
  assert.ok(events.length >= 25);
  const plan = planReminders({ smart: normalizeSmart(null), events }, ctx, { now: new Date('2026-10-01T00:00:00Z'), budget: 200 });
  assert.ok(plan.length > 40);
  for (const item of plan) assert.equal(restWindowAt(new Date(item.at), ctx), null, item.key);
});

test('smart reminders: never on Shabbat / Yom Tov over a whole year; the Omer waits for the end of Shabbat on Motzaei Shabbat', () => {
  const smart = normalizeSmart({ omer: { enabled: true }, shma: { enabled: true }, mincha: { enabled: true, minutesBefore: 15 }, candles: { enabled: true } });
  const all = smartReminders(smart, ctx, { now: new Date('2026-10-01T00:00:00Z'), days: 380 });
  assert.ok(all.length > 600, `all: ${all.length}`);
  for (const item of all) assert.equal(restWindowAt(item.at, ctx), null, `${item.key} ${item.at.toISOString()}`);
  const omer = all.filter(item => item.kind === 'omer');
  // 49 nights less the Friday nights and the Yom Tov nights (7th of Pesach, Shavuot eve is after the Omer).
  assert.ok(omer.length >= 40 && omer.length < 49, `omer nights: ${omer.length}`);
  for (const item of omer) assert.notEqual(weekdayOf(item.date), 5, 'never Friday night');
  const motzaei = omer.find(item => weekdayOf(item.date) === 6);
  assert.ok(motzaei, 'Motzaei Shabbat has its count');
  assert.ok(motzaei.at.getTime() >= motzaei.anchorTime.getTime());
  // Candle lighting: Friday and Yom Tov eves, never a second festival night.
  const candles = all.filter(item => item.kind === 'candles');
  assert.ok(candles.length >= 52);
  assert.ok(!all.some(item => item.kind === 'shma' && weekdayOf(civilKeyOf(item.at.getTime(), ctx.tz)) === 6), 'no Shema reminder on Shabbat morning');
});

test('smart reminders: the Omer text by date; Shema by the chosen opinion; each opens its screen', () => {
  assert.equal(omerWeeksText(1), 'יום אחד');
  assert.equal(omerWeeksText(7), 'שבוע אחד');
  assert.equal(omerWeeksText(12), 'שבוע אחד וחמישה ימים');
  assert.equal(omerWeeksText(33), 'ארבעה שבועות וחמישה ימים');
  assert.equal(omerWeeksText(49), 'שבעה שבועות');
  assert.equal(omerNoticeBody(3), 'הלילה סופרים 3 לעומר');
  assert.equal(omerNoticeBody(12), 'הלילה סופרים 12 לעומר · שבוע אחד וחמישה ימים');
  // By date: 22.4.2027 evening is the first night (16 Nisan 5787); 3.5.2027 evening is the 12th.
  assert.equal(smartOn('omer', { enabled: true, offsetMinutes: 0 }, '2027-04-22', ctx).body, 'הלילה סופרים 1 לעומר');
  assert.equal(smartOn('omer', { enabled: true, offsetMinutes: 0 }, '2027-05-03', ctx).body, omerNoticeBody(12));
  assert.equal(smartOn('omer', { enabled: true, offsetMinutes: 0 }, '2027-04-21', ctx), null, 'the Seder night is not an Omer night');
  assert.equal(smartOn('omer', { enabled: true, offsetMinutes: 0 }, '2027-04-23', ctx), null, 'Friday night: none');
  const mga = smartOn('shma', { enabled: true, minutesBefore: 30, opinion: 'mga' }, '2026-10-05', ctx);
  const gra = smartOn('shma', { enabled: true, minutesBefore: 30, opinion: 'gra' }, '2026-10-05', ctx);
  assert.ok(mga.anchorTime < gra.anchorTime, 'the Magen Avraham is earlier');
  assert.equal(gra.anchorTime.getTime() - gra.at.getTime(), 30 * 60000);
  assert.equal(mga.route, 'prayer/shacharit');
  assert.equal(smartOn('mincha', { enabled: true, minutesBefore: 30 }, '2026-10-05', ctx).route, 'prayer/mincha');
  assert.equal(smartOn('candles', { enabled: true, minutesBefore: 30, yomTov: true }, '2026-10-09', ctx).route, 'prayer/candles');
  assert.equal(smartOn('omer', { enabled: true, offsetMinutes: 0 }, '2027-04-22', ctx).route, 'prayer/omer');
});

// ── Deep links ───────────────────────────────────────────────────────────────────────────────────────────────────
test('deep-link targets: only known prayers and the app\'s own routes; anything else opens nothing', () => {
  assert.deepEqual(parseDeepLink('prayer/omer'), { kind: 'prayer', prayer: 'omer' });
  assert.deepEqual(parseDeepLink('prayer/candles'), { kind: 'prayer', prayer: 'candles' });
  assert.deepEqual(parseDeepLink('#prayer/shacharit'), { kind: 'prayer', prayer: 'shacharit' });
  assert.deepEqual(parseDeepLink('personal-tools/memorial/m1'), { kind: 'route', route: 'personal-tools/memorial/m1' });
  assert.deepEqual(parseDeepLink('jewish-alarm/reminders/e/ev-1'), { kind: 'route', route: 'jewish-alarm/reminders/e/ev-1' });
  for (const bad of ['', 'prayer/unknown', 'https://example.com', 'javascript:alert(1)', 'jewish-alarm/../x', 'settings', null]) assert.equal(parseDeepLink(bad), null, String(bad));
  const linked = normalizeEvent({ id: 'y1', type: 'yahrzeit', memorialId: 'm1', name: 'x', inputType: 'hebrew', hebrew: { day: 3, month: 8, year: 5770 } });
  const [first] = eventReminders(linked, ctx, { now: new Date('2026-09-30T00:00:00Z') });
  assert.equal(first.route, 'personal-tools/memorial/m1', 'a linked yahrzeit opens its memorial');
  const own = normalizeEvent({ id: 'b1', type: 'birthday', name: 'x', inputType: 'hebrew', hebrew: { day: 3, month: 8, year: 5770 } });
  assert.equal(eventReminders(own, ctx, { now: new Date('2026-09-30T00:00:00Z') })[0].route, 'jewish-alarm/reminders/e/b1');
  // The app shell hands prayer targets to the Siddur, which opens the Omer and the candle lighting too.
  assert.match(readFileSync(new URL('../src/NewApp.jsx', import.meta.url), 'utf8'), /onReminderTap\(/);
  assert.match(readFileSync(new URL('../src/pages/BooksPage.jsx', import.meta.url), 'utf8'), /autoOpenPrayer === 'omer'/);
});

// ── Rolling cap ──────────────────────────────────────────────────────────────────────────────────────────────────
test('rolling scheduling: never above the budget, nearest first, one reminder of each Hebrew date reserved', () => {
  const smart = normalizeSmart({ omer: { enabled: true }, shma: { enabled: true }, mincha: { enabled: true }, candles: { enabled: true } });
  const events = [normalizeEvent({ id: 'far', type: 'birthday', name: 'רחוק', inputType: 'hebrew', hebrew: { day: 15, month: AV, year: 5745 } })];
  const now = new Date('2026-10-05T12:00:00Z');
  for (const budget of [1, 6, 18, 42, 60]) {
    const plan = planReminders({ smart, events }, ctx, { now, budget });
    assert.ok(plan.length <= budget, `budget ${budget}`);
    assert.deepEqual([...plan].sort((a, b) => a.at.localeCompare(b.at)), plan, 'sorted');
    assert.equal(new Set(plan.map(item => item.key)).size, plan.length, 'no duplicates');
    assert.ok(plan.every(item => item.at > now.toISOString()));
    if (budget >= 3) assert.ok(plan.some(item => item.key.startsWith('rem:ev:far:')), 'the yearly date is not crowded out');
  }
  assert.deepEqual(planReminders({ smart, events }, ctx, { now, budget: 0 }), []);
  // The shared iOS table adds up to the system limit of 64, and the features use their shares.
  const ios = NOTIFICATION_BUDGET.ios;
  assert.equal(ios.alarmFallback + ios.memorial + ios.reminders + ios.other, IOS_PENDING_LIMIT);
  assert.equal(HORIZON.notifications.budget, ios.alarmFallback);
  assert.equal(remindersBudget('ios', 'notifications'), 18);
  assert.equal(remindersBudget('ios', 'alarmkit'), 42, 'with AlarmKit the fallback share goes to the reminders');
  assert.equal(remindersBudget('web', null), 0);
});

// ── Store ────────────────────────────────────────────────────────────────────────────────────────────────────────
test('the store: corrupt data is safe; drafts are checked in plain Hebrew; words read right', () => {
  assert.deepEqual(parseRemindersState('{nonsense').events, []);
  assert.equal(parseRemindersState(JSON.stringify({ events: [{ type: 'nope' }, { type: 'birthday', name: '' }] })).events.length, 0);
  assert.match(eventProblem({ type: 'birthday', name: '', inputType: 'hebrew', hebrew: { day: 1, month: 7, year: 5780 }, eve: { enabled: true } }), /שם/);
  assert.match(eventProblem({ type: 'birthday', name: 'x', inputType: 'hebrew', hebrew: { day: 1, month: 7, year: 5780 }, eve: { enabled: false }, day: { enabled: false } }), /מתי להזכיר/);
  assert.equal(eventProblem({ type: 'birthday', name: 'x', inputType: 'hebrew', hebrew: { day: 30, month: ADAR_II, year: 5783 }, eve: { enabled: true } }), 'התאריך העברי אינו קיים בשנה זו.');
  assert.equal(leadWord('2026-10-05', '2026-10-06'), 'מחר');
  assert.equal(leadWord('2026-10-05', '2026-10-05'), 'היום');
  assert.equal(leadWord('2026-10-02', '2026-10-05'), 'ביום שני');
});
