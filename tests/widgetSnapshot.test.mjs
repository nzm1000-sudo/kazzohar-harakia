// The widget / Siri snapshot (services/widgetSnapshot.mjs): the next zman agrees with the app's own rule, candle
// lighting and havdalah, the parasha, the ring, a multi-day timeline whose Jewish date turns at sunset, the tzaddik of
// the day from the verified list, the Omer, and the ways into the app (services/nativeWidgets.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildWidgetSnapshot, widgetStateAt, upcomingZmanimAt, omerDayOf, omerAnswer, tzaddikimOf, timeText, SNAPSHOT_DAYS,
  prayerStateAt, quartetAt, weatherStateAt, sayingStateAt, meatStateAt, newerMeat, SAYING_SLOT_MS, SAYING_SLOTS, SAYING_MAX_LETTERS, WEATHER_DIM_MS, WEATHER_GONE_MS,
} from '../src/services/widgetSnapshot.mjs';
import { choosePrayerType } from '../src/services/smartPrayer.mjs';
import { meatDairyStatus, readMeatDairy, recordMeatDairyChange, adoptSharedMeatDairy, applySharedMeatDairy, meatDairyReminder, MEAT_DAIRY_KEY, MEAT_DAIRY_HOURS_KEY, MEAT_DAIRY_UPDATED_KEY } from '../src/services/meatDairy.mjs';
import { cachedWeather } from '../src/services/weather.mjs';
import { stableId } from '../src/services/notificationEngine.mjs';
import { parseDeepLink } from '../src/services/reminders/deepLinks.mjs';
import * as DIVREI from '../src/data/divreiChachamim.mjs';
import { computeZmanim } from '../src/services/zmanimLocal.mjs';
import { CITIES, DEFAULT_SETTINGS, getNextRelevantZman } from '../src/services.mjs';
import { shiftCivilDate, civilDateKey } from '../src/civilDate.mjs';
import { omerNightOn } from '../src/services/jewishAlarm/engine.mjs';
import { YAHRZEITS } from '../src/data/yahrzeits.mjs';
import { parseEntryUrl, ENTRY_ROUTES, WIDGET_PRAYERS } from '../src/services/nativeWidgets.mjs';

const TLV = DEFAULT_SETTINGS;
const NY = { ...DEFAULT_SETTINGS, location: CITIES.find(city => city.searchName === 'New York'), il: false, halachicResidenceStatus: 'diaspora' };
const at = iso => new Date(iso);
const snap = (iso, settings = TLV, extra = {}) => buildWidgetSnapshot({ now: at(iso), settings, ...extra });

test('the next zman is the one the app itself shows (getNextRelevantZman), at many instants over several days', () => {
  for (const settings of [TLV, NY]) {
    const tzid = settings.location.tzid;
    const start = at('2026-09-30T00:30:00Z');
    const snapshot = buildWidgetSnapshot({ now: start, settings });
    for (let hours = 0; hours < 24 * 6; hours += 1.75) {
      const instant = new Date(start.getTime() + hours * 3600000);
      const civil = civilDateKey(instant, tzid);
      const times = { ...computeZmanim(civil, settings.location), nextDay: computeZmanim(shiftCivilDate(civil, 1), settings.location) };
      const expected = getNextRelevantZman(instant, times, { showRT: false });
      const state = widgetStateAt(snapshot, instant);
      assert.equal(state.next?.key, expected?.key, `${tzid} ${instant.toISOString()}`);
      assert.equal(state.next?.at, expected?.at.getTime(), `${tzid} ${instant.toISOString()}`);
    }
  }
});

test('Rabbenu Tam joins the timeline only when the user shows it in the app', () => {
  assert.equal(snap('2026-09-30T10:00:00Z').zmanim.some(z => z.key === 'tzeit72min'), false);
  assert.equal(snap('2026-09-30T10:00:00Z', { ...TLV, showRT: true }).zmanim.some(z => z.key === 'tzeit72min'), true);
});

test('candle lighting and havdalah for the coming Shabbat (Tel Aviv, 20 minutes; 8.5°) and the per-city minutes', () => {
  const snapshot = snap('2026-09-30T10:00:00Z');
  const [shabbat] = snapshot.shabbat;
  assert.equal(shabbat.key, '2026-10-03');
  assert.equal(timeText(shabbat.candles, 'Asia/Jerusalem'), '18:04');
  assert.equal(timeText(shabbat.havdalah, 'Asia/Jerusalem'), '19:00');
  const friday = computeZmanim('2026-10-02', TLV.location);
  assert.ok(Math.abs(new Date(friday.sunset).getTime() - 20 * 60000 - shabbat.candles) <= 60000, 'sunset − 20 minutes');
  const forty = snap('2026-09-30T10:00:00Z', { ...TLV, candles: 40 }).shabbat[0];
  assert.equal(shabbat.candles - forty.candles, 20 * 60000);
  // During Shabbat (after candle lighting, before havdalah) the same Shabbat stays; after havdalah, the next one.
  assert.equal(widgetStateAt(snapshot, at('2026-10-03T10:00:00Z')).shabbat.key, '2026-10-03');
  assert.equal(widgetStateAt(snapshot, at('2026-10-03T16:30:00Z')).shabbat.key, '2026-10-10');
});

test('the reading of the week: what is read on the coming Shabbat (a festival Shabbat names it, never the next parasha), Israel and abroad', () => {
  const snapshot = snap('2026-09-30T10:00:00Z');
  // Chol HaMoed Sukkot 5787: the coming Shabbat is Shemini Atzeret — in Israel Simchat Torah, when וזאת הברכה is read.
  assert.equal(widgetStateAt(snapshot, at('2026-09-30T10:00:00Z')).day.parasha, 'פרשת וזאת הברכה');
  assert.equal(widgetStateAt(snapshot, at('2026-10-01T09:00:00Z')).day.parasha, 'פרשת וזאת הברכה');
  assert.equal(widgetStateAt(snapshot, at('2026-10-03T10:00:00Z')).day.parasha, 'פרשת וזאת הברכה', 'on the Shabbat itself');
  assert.equal(snapshot.shabbat[0].parasha, 'פרשת וזאת הברכה');
  assert.equal(snapshot.shabbat[1].parasha, 'פרשת בראשית');
  // בראשית only from Motzaei Shabbat (the sunset that opens Sunday).
  assert.equal(widgetStateAt(snapshot, at('2026-10-03T16:30:00Z')).day.parasha, 'פרשת בראשית');
  assert.equal(widgetStateAt(snapshot, at('2026-10-04T09:00:00Z')).day.parasha, 'פרשת בראשית');
  // Abroad that Shabbat is Shemini Atzeret (Simchat Torah is on Sunday): the festival, not בראשית.
  const abroad = snap('2026-10-01T14:00:00Z', NY);
  assert.equal(widgetStateAt(abroad, at('2026-10-01T14:00:00Z')).day.parasha, 'שמיני עצרת');
  assert.equal(widgetStateAt(abroad, at('2026-10-03T14:00:00Z')).day.parasha, 'שמיני עצרת', 'on the Shabbat itself');
  assert.equal(widgetStateAt(abroad, at('2026-10-04T14:00:00Z')).day.parasha, 'פרשת בראשית', 'Simchat Torah (Sunday) belongs to the week of בראשית');
  // Shabbat Chol HaMoed Pesach 5787 (24 April 2027): the festival's label all week.
  assert.equal(widgetStateAt(snap('2027-04-21T09:00:00Z'), at('2027-04-21T09:00:00Z')).day.parasha, 'שבת חול המועד פסח');
  assert.equal(widgetStateAt(snap('2026-10-11T10:00:00Z'), at('2026-10-11T10:00:00Z')).day.parasha, 'פרשת נח');
  // 2027: the second day of Shavuot is a Shabbat abroad only — Israel reads Beha'alotcha that week, the Diaspora Naso.
  const il = widgetStateAt(snap('2027-06-17T12:00:00Z'), at('2027-06-17T12:00:00Z')).day.parasha;
  const ny = widgetStateAt(snap('2027-06-17T16:00:00Z', NY), at('2027-06-17T16:00:00Z')).day.parasha;
  assert.equal(il, 'פרשת בהעלתך');
  assert.equal(ny, 'פרשת נשא');
  assert.notEqual(il, ny, 'Israel and the Diaspora read different portions that week');
});

test('the ring: the open circle of this week (N / 26), empty again at Motzaei Shabbat; lifetime keeps the high-water mark', () => {
  const events = [];
  for (let i = 0; i < 80; i += 1) events.push({ category: 'prayer', jewishDate: '2026-09-29', quantity: 1 });
  events.push({ category: 'tehillim', jewishDate: '2026-09-30', quantity: 5 });
  events.push({ category: 'prayer', jewishDate: '2026-09-20', quantity: 1 }); // last week
  const snapshot = snap('2026-09-30T10:00:00Z', TLV, { events, lifetimeBest: 7 });
  assert.equal(snapshot.ring.goal, 26);
  assert.equal(snapshot.ring.active, 7, '85 lights this week → three circles completed, 7 of the next');
  assert.equal(snapshot.ring.completedThisWeek, 3);
  assert.equal(snapshot.ring.lifetime, 7, 'the high-water record is never lowered');
  assert.equal((snapshot.ring.active / snapshot.ring.goal).toFixed(3), '0.269');
  const saturdaySunset = new Date(computeZmanim('2026-10-03', TLV.location).sunset).getTime();
  assert.equal(snapshot.ring.until, saturdaySunset, 'the week ends at the sunset that ends Shabbat');
  assert.equal(widgetStateAt(snapshot, new Date(saturdaySunset - 60000)).ring, 7);
  assert.equal(widgetStateAt(snapshot, new Date(saturdaySunset + 60000)).ring, 0);
});

test('a multi-day timeline: contiguous Jewish days that turn at sunset, zmanim for a week ahead, then stale', () => {
  const snapshot = snap('2026-09-30T10:00:00Z');
  assert.ok(snapshot.days.length >= SNAPSHOT_DAYS, `${snapshot.days.length} days`);
  for (let i = 1; i < snapshot.days.length; i += 1) assert.equal(snapshot.days[i].from, snapshot.days[i - 1].to, 'no gap, no overlap');
  for (let i = 1; i < snapshot.zmanim.length; i += 1) assert.ok(snapshot.zmanim[i].at >= snapshot.zmanim[i - 1].at, 'sorted');
  assert.ok(snapshot.zmanim.at(-1).at - snapshot.generatedAt > 7 * 86400000, 'a week of zmanim');
  const sunset = new Date(computeZmanim('2026-09-30', TLV.location).sunset).getTime();
  const before = widgetStateAt(snapshot, new Date(sunset - 60000));
  const after = widgetStateAt(snapshot, new Date(sunset + 60000));
  assert.equal(before.day.date, 'י״ט בתשרי תשפ״ז');
  assert.equal(after.day.date, 'כ׳ בתשרי תשפ״ז', 'the Jewish date turns at sunset, as in the app');
  assert.equal(before.day.dayMonth, 'י״ט בתשרי');
  assert.equal(before.day.weekday, 'יום רביעי');
  assert.equal(before.next.key, 'sunset');
  assert.equal(after.next.key, 'tzeit85deg');
  assert.equal(widgetStateAt(snapshot, new Date(snapshot.validUntil + 1)).stale, true);
  assert.ok(JSON.stringify(snapshot).length < 16000, 'compact');
});

test('the tzaddik of the day comes only from the verified list of "נר ה\' נשמת אדם"', () => {
  const snapshot = snap('2026-09-30T10:00:00Z');
  const today = widgetStateAt(snapshot, at('2026-09-30T10:00:00Z')).day;
  assert.ok(today.tzaddik.some(name => name.startsWith('הגאון מווילנא')), today.tzaddik.join(' | '));
  assert.equal(today.tzaddikCount, tzaddikimOf('2026-09-30').length);
  const known = new Set(YAHRZEITS.map(record => record.displayNameHe));
  for (const day of snapshot.days) for (const name of day.tzaddik) assert.ok([...known].some(base => name.startsWith(base)), name);
  // 28 Tishrei 5787 (9 October 2026) has no record
  const later = snap('2026-10-08T10:00:00Z');
  assert.deepEqual(widgetStateAt(later, at('2026-10-09T10:00:00Z')).day.tzaddik, [], 'a day without a record shows none — nothing invented');
});

test('the Omer day agrees with the app\'s Omer engine, and Siri\'s answer', () => {
  for (let i = 0; i < 70; i += 1) {
    const eve = shiftCivilDate('2027-04-20', i);
    assert.equal(omerDayOf(shiftCivilDate(eve, 1)), omerNightOn(eve) || 0, eve);
  }
  assert.equal(omerAnswer(snap('2027-05-05T09:00:00Z'), at('2027-05-05T09:00:00Z')), 'היום 13 לעומר · נותרו 36 ימים');
  const autumn = snap('2026-09-30T10:00:00Z');
  assert.match(omerAnswer(autumn, at('2026-09-30T10:00:00Z')), /^ספירת העומר מתחילה בעוד \d+ ימים$/);
});

test('ways into the app: only known routes, the blessings query kept', () => {
  assert.deepEqual(parseEntryUrl('kzohaar://open/brachot?q=%D7%AA%D7%A4%D7%95%D7%97'), { route: 'siddur-brachot', query: 'תפוח' });
  assert.deepEqual(parseEntryUrl('kzohaar://open/zmanim'), { route: 'times', query: '' });
  assert.equal(parseEntryUrl('kzohaar://open/unknown'), null);
  assert.equal(parseEntryUrl('https://example.com/open/zmanim'), null);
  assert.equal(parseEntryUrl('kzohaar://open/today?q=x').query, '', 'a query only for the blessings engine');
  for (const route of Object.values(ENTRY_ROUTES)) assert.match(route, /^[a-z/-]+$/);
});

test('wiring: the app publishes the snapshot and never sends it anywhere', () => {
  const app = readFileSync(new URL('../src/NewApp.jsx', import.meta.url), 'utf8');
  assert.match(app, /useWidgetSync\(settings\)/);
  const bridge = readFileSync(new URL('../src/services/nativeWidgets.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(bridge, /fetch\(|XMLHttpRequest|https?:\/\//);
  assert.match(bridge, /JOURNAL_CHANGE_EVENT/);
});

// ── The second set of widgets ──────────────────────────────────────────────────────────────────────────────────

const memoryStorage = (seed = {}) => {
  const data = new Map(Object.entries(seed));
  return { getItem: key => (data.has(key) ? data.get(key) : null), setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key), data };
};

test('התפילה הבאה: the prayer of the hour is the Siddur\'s own (choosePrayerType), with its deadlines, for days', () => {
  for (const settings of [TLV, NY]) {
    const start = at('2026-09-30T00:30:00Z');
    const snapshot = buildWidgetSnapshot({ now: start, settings });
    for (let hours = 0; hours < 24 * 6; hours += 0.75) {
      const instant = new Date(start.getTime() + hours * 3600000);
      const civil = civilDateKey(instant, settings.location.tzid);
      const state = prayerStateAt(snapshot, instant);
      assert.equal(state?.current.key, choosePrayerType(instant, computeZmanim(civil, settings.location)), `${settings.location.tzid} ${instant.toISOString()}`);
      if (state.deadline) assert.ok(state.deadline.at > instant.getTime() && state.deadline.at <= state.current.to);
      if (state.opens) assert.ok(state.opens.at > instant.getTime());
    }
    // Windows follow each other with no gap; deadlines are in order.
    for (let i = 1; i < snapshot.prayers.length; i += 1) assert.equal(snapshot.prayers[i].from, snapshot.prayers[i - 1].to);
    for (const prayer of snapshot.prayers) for (let i = 1; i < prayer.ends.length; i += 1) assert.ok(prayer.ends[i].at >= prayer.ends[i - 1].at, prayer.key);
  }
});

test('התפילה הבאה: the Amidah\'s deadline, then midday; Mincha until sunset; Arvit until midnight, then dawn', () => {
  const snapshot = snap('2026-09-30T21:00:00Z');
  const zmanim = computeZmanim('2026-10-01', TLV.location);
  const t = key => new Date(zmanim[key]).getTime();
  const morning = prayerStateAt(snapshot, new Date(t('sofZmanShma') + 60000));
  assert.equal(morning.current.key, 'shacharit');
  assert.deepEqual([morning.deadline.name, morning.deadline.at], ['סוף זמן תפילה', t('sofZmanTfilla')]);
  assert.equal(prayerStateAt(snapshot, new Date(t('sofZmanTfilla') + 60000)).deadline.name, 'חצות היום');
  const early = prayerStateAt(snapshot, new Date(t('chatzot') + 60000));
  assert.equal(early.current.key, 'mincha');
  assert.deepEqual([early.opens.name, early.opens.at], ['מנחה גדולה', t('minchaGedola')], 'not yet Mincha Gedola: when it properly begins');
  assert.equal(early.deadline.name, 'שקיעה');
  const night = prayerStateAt(snapshot, new Date(t('sunset') + 60000));
  assert.equal(night.current.key, 'maariv');
  assert.equal(night.opens.name, 'צאת הכוכבים');
  assert.equal(night.deadline.at, new Date(computeZmanim('2026-10-02', TLV.location).chatzotNight).getTime(), 'the coming midnight');
  assert.equal(night.next.key, 'shacharit');
  // Shown times: the quartet's doors.
  const doors = quartetAt(snapshot, new Date(t('sofZmanShma') + 60000), value => timeText(value, 'Asia/Jerusalem'));
  assert.deepEqual(doors.map(door => door.key), ['shacharit', 'mincha', 'maariv', 'birkat-hamazon']);
  assert.deepEqual(doors.map(door => door.now), [true, false, false, false]);
  assert.equal(doors[0].hint, `עד ${timeText(t('sofZmanTfilla'), 'Asia/Jerusalem')}`);
  assert.equal(doors[1].hint, `מ־${timeText(t('minchaGedola'), 'Asia/Jerusalem')}`);
  assert.equal(doors[2].hint, `מ־${timeText(t('tzeit85deg'), 'Asia/Jerusalem')}`);
});

test('prayer deep links: each widget door opens its prayer through the reminder\'s validated path; nothing else', () => {
  for (const prayer of WIDGET_PRAYERS) {
    assert.deepEqual(parseEntryUrl(`kzohaar://open/prayer/${prayer}`), { route: 'siddur', query: '', prayer });
    assert.deepEqual(parseDeepLink(`prayer/${prayer}`), { kind: 'prayer', prayer }, 'NewApp\'s listener accepts it');
  }
  for (const bad of ['kzohaar://open/prayer/', 'kzohaar://open/prayer/shacharit2', 'kzohaar://open/prayer/../x', 'kzohaar://open/toString', 'kzohaar://open/constructor', 'https://open/prayer/mincha']) assert.equal(parseEntryUrl(bad), null, bad);
  for (const name of ['sayings', 'meat', 'weather', 'shabbat']) assert.ok(parseEntryUrl(`kzohaar://open/${name}`)?.route, name);
  // Every link the native widgets use is one the app honours.
  const swift = readFileSync(new URL('../ios/App/KZWidgets/KZMoreWidgets.swift', import.meta.url), 'utf8');
  const java = readFileSync(new URL('../android/app/src/main/java/com/kzohaar/app/widget/KZMoreWidgets.java', import.meta.url), 'utf8');
  for (const [, path] of swift.matchAll(/kzLink\("([a-z/-]+)"\)/g)) assert.ok(parseEntryUrl(`kzohaar://open/${path}`), path);
  for (const [, path] of java.matchAll(/open\(context, "([a-z/-]+)"\)/g)) assert.ok(parseEntryUrl(`kzohaar://open/${path}`), path);
  const books = readFileSync(new URL('../src/pages/BooksPage.jsx', import.meta.url), 'utf8');
  assert.match(books, /autoOpenPrayer === 'birkat-hamazon'/, 'outside the Smart Siddur, Birkat HaMazon opens by its concept, not a prayer root');
});

test('אכלתי בשרי: the widget\'s state is the card\'s (meatDairyStatus), and the later change wins both ways', () => {
  const start = at('2026-10-01T10:00:00Z').getTime();
  for (const hours of [6, 3]) {
    const meat = { startedAt: start, hours, preferred: hours, updatedAt: start };
    for (const offset of [-1, 0, 1, hours * 60 - 1, hours * 60, hours * 60 + 1, hours * 60 + 179, hours * 60 + 180, hours * 60 + 181]) {
      const instant = start + offset * 60000;
      const card = meatDairyStatus({ startedAt: new Date(start).toISOString(), hours }, instant);
      const widget = meatStateAt(meat, instant);
      const expected = !card ? 'idle' : card.done ? 'done' : 'waiting';
      if (offset >= 0) assert.equal(widget.phase, expected, `${hours}h +${offset}m`);
      if (widget.phase !== 'idle') assert.equal(widget.end, card.end.getTime());
    }
  }
  assert.equal(meatStateAt({ startedAt: null, hours: 6, preferred: 3, updatedAt: 1 }, start).hours, 3, 'at rest: the user\'s chosen custom');

  // The card records its changes (stamped) — the snapshot carries them.
  const storage = memoryStorage();
  recordMeatDairyChange({ preferred: 3 }, { storage, now: 100 });
  recordMeatDairyChange({ wait: { startedAt: new Date(start).toISOString(), hours: 3 } }, { storage, now: 200 });
  assert.deepEqual(readMeatDairy(storage), { startedAt: start, hours: 3, preferred: 3, updatedAt: 200 });
  const snapshot = snap('2026-10-01T10:30:00Z', TLV, { meat: readMeatDairy(storage) });
  assert.deepEqual(snapshot.meat, { startedAt: start, hours: 3, preferred: 3, updatedAt: 200 });

  // The widget's button later: the app adopts it (and announces it to the card); an older widget record is ignored.
  const widgetStart = start + 3600000;
  assert.equal(adoptSharedMeatDairy(readMeatDairy(storage), { startedAt: widgetStart, hours: 3, updatedAt: 150 }), undefined);
  const adopted = adoptSharedMeatDairy(readMeatDairy(storage), { startedAt: widgetStart, hours: 3, updatedAt: 300 });
  assert.deepEqual(adopted, { startedAt: new Date(widgetStart).toISOString(), hours: 3 });
  applySharedMeatDairy(adopted, 300, storage);
  assert.deepEqual(readMeatDairy(storage), { startedAt: widgetStart, hours: 3, preferred: 3, updatedAt: 300 });
  assert.equal(JSON.parse(storage.getItem(MEAT_DAIRY_UPDATED_KEY)), 300);
  // A reset in the app after the widget's start wins in the widget too (newerMeat, as KZMeat.newer / KZWidgetSnapshot.meat).
  recordMeatDairyChange({ wait: null }, { storage, now: 400 });
  const app = buildWidgetSnapshot({ now: at('2026-10-01T12:00:00Z'), settings: TLV, meat: readMeatDairy(storage) }).meat;
  assert.equal(newerMeat(app, { startedAt: widgetStart, hours: 3, updatedAt: 300 }).startedAt, null);
  assert.equal(newerMeat(app, { startedAt: widgetStart + 1, hours: 3, updatedAt: 500 }).startedAt, widgetStart + 1);
  assert.equal(adoptSharedMeatDairy(readMeatDairy(storage), { startedAt: null, updatedAt: 600 }), null, 'a reset from the widget side clears the card');
  // An old card (before stamping) yields to any widget record.
  assert.ok(adoptSharedMeatDairy(readMeatDairy(memoryStorage({ [MEAT_DAIRY_KEY]: 'null', [MEAT_DAIRY_HOURS_KEY]: '6' })), { startedAt: widgetStart, hours: 6, updatedAt: 1 }));
  // The reminder: the card's words and id, also set by the iOS button (KZMeatStore.reminderIdentifier).
  const reminder = meatDairyReminder(start, 6);
  assert.equal(reminder.title, 'אפשר לאכול חלבי');
  assert.equal(reminder.at.getTime(), start + 6 * 3600000);
  const shared = readFileSync(new URL('../ios/App/Shared/KZWidgetSnapshot.swift', import.meta.url), 'utf8');
  assert.match(shared, new RegExp(`reminderIdentifier = "${stableId('meat-dairy-wait')}"`));
  const timer = readFileSync(new URL('../src/components/MeatDairyTimer.jsx', import.meta.url), 'utf8');
  assert.match(timer, /stableId\('meat-dairy-wait'\)/);
  assert.match(timer, /MEAT_DAIRY_SYNC_EVENT/);
});

test('דברי חכמים: a short saying every three hours, fixed by the hour, with its source; never blank past the snapshot', () => {
  const snapshot = snap('2026-10-01T09:40:00Z', TLV, { sayings: DIVREI });
  const { sayings } = snapshot;
  assert.equal(sayings.items.length, SAYING_SLOTS);
  assert.equal(sayings.period, SAYING_SLOT_MS);
  assert.equal(sayings.from % SAYING_SLOT_MS, 0);
  const known = new Map(DIVREI.SAYINGS.map(row => [row[0], row]));
  for (const item of sayings.items) {
    const row = known.get(item.id);
    assert.ok(row, item.id);
    assert.equal(item.text, row[5], 'the exact words');
    assert.equal(item.source, `${DIVREI.WORKS[row[1]].title} · ${row[4]}`);
    assert.ok(item.text.replace(/[֑-ׇ]/g, '').length <= SAYING_MAX_LETTERS);
  }
  assert.equal(new Set(sayings.items.map(item => item.id)).size, SAYING_SLOTS, 'no repeat within two days');
  const first = sayingStateAt(snapshot, sayings.from + 1);
  assert.equal(sayingStateAt(snapshot, sayings.from + SAYING_SLOT_MS - 1).id, first.id, 'the same saying through its slot');
  assert.notEqual(sayingStateAt(snapshot, sayings.from + SAYING_SLOT_MS).id, first.id, 'a new one when the slot turns');
  assert.equal(first.until, sayings.from + SAYING_SLOT_MS);
  assert.equal(sayingStateAt(snapshot, sayings.from + SAYING_SLOTS * SAYING_SLOT_MS + 1).id, first.id, 'past the carried slots: the same ones again');
  // The same hour gives the same saying whenever the snapshot was built (it does not depend on when the app opened).
  const later = snap('2026-10-01T12:10:00Z', TLV, { sayings: DIVREI });
  assert.equal(sayingStateAt(later, at('2026-10-01T13:00:00Z')).id, sayingStateAt(snapshot, at('2026-10-01T13:00:00Z')).id);
  assert.equal(snap('2026-10-01T09:40:00Z').sayings, null, 'no collection loaded: no sayings (the widget asks to open the app)');
  assert.ok(JSON.stringify(snapshot).length < 32000, `compact with the sayings: ${JSON.stringify(snapshot).length}`);
});

test('weather: the app\'s own last reading, with its time; dimmed after 3 hours, gone after 12; never fetched', () => {
  const savedAt = at('2026-10-01T09:00:00Z').getTime();
  const cache = { savedAt, weather: { temperature: 24.4, kind: 'partly', label: 'מעונן חלקית', high: 28.2, low: 19, feelsLike: 25, hours: [{ hour: 12, temperature: 24 }] } };
  const snapshot = snap('2026-10-01T09:40:00Z', TLV, { weather: cache });
  assert.deepEqual(snapshot.weather, { temp: 24, kind: 'partly', label: 'מעונן חלקית', high: 28, low: 19, at: savedAt }, 'compact: only what the widget shows');
  assert.equal(weatherStateAt(snapshot, savedAt + WEATHER_DIM_MS - 1).dim, false);
  assert.equal(weatherStateAt(snapshot, savedAt + WEATHER_DIM_MS).dim, true);
  assert.equal(weatherStateAt(snapshot, savedAt + WEATHER_GONE_MS), null);
  assert.equal(snap('2026-10-01T21:10:00Z', TLV, { weather: cache }).weather, null, 'a reading over 12 hours old is not carried');
  assert.equal(snap('2026-10-01T09:40:00Z', TLV, { weather: { savedAt, weather: { temperature: null } } }).weather, null);
  // The bridge reads the reading kept for this place only (services/weather.mjs cache), without the network.
  const storage = memoryStorage({ 'kz-weather-v1': JSON.stringify({ key: `${Math.round(TLV.location.latitude * 100) / 100},${Math.round(TLV.location.longitude * 100) / 100}`, savedAt, weather: cache.weather }) });
  assert.deepEqual(cachedWeather(TLV.location, storage), { weather: cache.weather, savedAt });
  assert.equal(cachedWeather(NY.location, storage), null, 'another place: nothing');
  const bridge = readFileSync(new URL('../src/services/nativeWidgets.mjs', import.meta.url), 'utf8');
  assert.match(bridge, /cachedWeather\(/);
  assert.doesNotMatch(bridge, /loadWeather|open-meteo/i, 'the widgets never fetch weather');
  for (const file of ['../ios/App/KZWidgets/KZMoreWidgets.swift', '../android/app/src/main/java/com/kzohaar/app/widget/KZMoreWidgets.java']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /URLSession|HttpURLConnection|https?:\/\//, file);
  }
});

test('the Shabbat widget data carries Rabbenu Tam (sunset + 72) under havdalah, and the widget opens the zmanim', async () => {
  const { buildWidgetSnapshot } = await import('../src/services/widgetSnapshot.mjs');
  const { readFileSync } = await import('node:fs');
  const snap = buildWidgetSnapshot({ now: new Date('2026-10-01T09:00:00+03:00'), settings: { location: { latitude: 32.0853, longitude: 34.7818, tzid: 'Asia/Jerusalem', name: 'תל אביב' }, candles: 20, il: true } });
  const shabbat = snap.shabbat[0];
  assert.ok(shabbat && Number.isFinite(shabbat.rabbenuTam), 'rabbenuTam present');
  assert.ok(shabbat.rabbenuTam > shabbat.havdalah, 'later than havdalah');
  const swift = readFileSync(new URL('../ios/App/KZWidgets/KZMoreWidgets.swift', import.meta.url), 'utf8');
  const view = swift.slice(swift.indexOf('struct KZShabbatView'), swift.indexOf('struct KZShabbatWidget'));
  assert.match(view, /ר״ת/); assert.match(view, /\.widgetURL\(kzLink\("zmanim"\)\)/);
});

// The medium "היום" widget (the one with the tzaddik of the day): the next three zmanim in sequence, with Shabbat's
// candle lighting and havdalah among them — never one zman, a gap, and an unrelated "כניסת שבת".
test('the next three zmanim in sequence: candle lighting and havdalah join the timeline; "צאת שבת" replaces that evening\'s צאת הכוכבים', () => {
  const words = (iso) => { const s = snap(iso); return upcomingZmanimAt(s, at(iso)).map(z => `${z.name} ${timeText(z.at, 'Asia/Jerusalem')}`); };
  // Friday before noon (13:00 in Tel Aviv): מנחה קטנה, פלג המנחה, כניסת שבת.
  const friday = words('2026-11-06T11:00:00Z');
  assert.equal(friday.length, 3);
  assert.deepEqual(friday.map(w => w.replace(/ \d\d:\d\d$/, '')), ['מנחה קטנה', 'פלג המנחה', 'כניסת שבת']);
  // Friday afternoon: כניסת שבת, שקיעה, צאת הכוכבים.
  assert.deepEqual(words('2026-11-06T14:20:00Z').map(w => w.replace(/ \d\d:\d\d$/, '')), ['כניסת שבת', 'שקיעה', 'צאת הכוכבים']);
  // Shabbat afternoon: שקיעה, צאת שבת (in place of צאת הכוכבים — the same moment, said once), חצות הלילה.
  const shabbat = words('2026-11-07T14:00:00Z').map(w => w.replace(/ \d\d:\d\d$/, ''));
  assert.deepEqual(shabbat, ['שקיעה', 'צאת שבת', 'חצות הלילה']);
  // A weekday: just the day's zmanim, in order.
  const tuesday = snap('2026-11-04T09:00:00Z');
  const list = upcomingZmanimAt(tuesday, at('2026-11-04T09:00:00Z'));
  assert.deepEqual(list.map(z => z.key), ['chatzot', 'minchaGedola', 'minchaKetana']);
  for (let i = 1; i < list.length; i += 1) assert.ok(list[i].at > list[i - 1].at, 'strictly in sequence');
  // widgetStateAt carries them for every platform's renderer.
  assert.deepEqual(widgetStateAt(tuesday, at('2026-11-04T09:00:00Z')).upcoming, list);
  assert.deepEqual(upcomingZmanimAt(null, at('2026-11-04T09:00:00Z')), []);
});

test('the medium widget draws the three zmanim as equal columns on iOS and Android (no lone zman beside a gap)', () => {
  const swift = readFileSync(new URL('../ios/App/KZWidgets/KZWidgets.swift', import.meta.url), 'utf8');
  const medium = swift.slice(swift.indexOf('struct KZMediumView'), swift.indexOf('// MARK: - Lock screen'));
  assert.match(medium, /ForEach\(Array\(state\.upcoming\.enumerated\(\)\)/);
  // Each column centres its label over its time (one vertical axis per zman), and the three share one label size.
  assert.match(medium, /\.frame\(maxWidth: \.infinity, alignment: \.center\)/);
  assert.match(medium, /alignment: \.center\)/);
  assert.match(medium, /labelSize: labelSize/);
  // The header — the date (bold), then the day and the week's reading — centred in its block, on the zmanim's axis.
  const header = medium.slice(medium.indexOf('Text(day.date)') - 400, medium.indexOf('KZGoldRule'));
  assert.match(header, /VStack\(alignment: \.center, spacing: 5\)/);
  assert.match(header, /\.multilineTextAlignment\(\.center\)\s+\.frame\(maxWidth: \.infinity, alignment: \.center\)/);
  assert.match(medium, /Text\("נר ה׳[^\n]+\n[^\n]+\n\s+\.multilineTextAlignment\(\.center\)\n\s+\.frame\(maxWidth: \.infinity, alignment: \.center\)/);
  assert.doesNotMatch(medium, /shabbatLine|Spacer\(minLength: 0\)\n\s+if let line/);
  const shared = readFileSync(new URL('../ios/App/Shared/KZWidgetSnapshot.swift', import.meta.url), 'utf8');
  assert.match(shared, /upcoming: upcoming\(after: t, count: 3\)/);
  assert.match(shared, /Zman\(key: "candles", name: "כניסת שבת", at: candles\)/);
  assert.match(shared, /Zman\(key: "havdalah", name: "צאת שבת", at: item\.havdalah\)/);
  const layout = readFileSync(new URL('../android/app/src/main/res/layout/kz_widget_medium.xml', import.meta.url), 'utf8');
  for (const i of [0, 1, 2]) {
    assert.match(layout, new RegExp(`android:id="@\\+id/kz_up_box_${i}"\\s+android:layout_width="0dp"\\s+android:layout_height="wrap_content"\\s+android:layout_weight="1"\\s+android:gravity="center_horizontal"`));
    for (const part of ['name', 'time']) assert.match(layout, new RegExp(`android:id="@\\+id/kz_up_${part}_${i}"\\s+android:layout_width="match_parent"\\s+android:gravity="center"`));
  }
  assert.doesNotMatch(layout, /kz_shabbat_box|kz_next_box/);
  for (const id of ['kz_date', 'kz_weekday', 'kz_tzaddik']) assert.match(layout, new RegExp(`android:id="@\\+id/${id}"\\s+android:layout_width="match_parent"\\s+android:gravity="center"`), id);
  const java = readFileSync(new URL('../android/app/src/main/java/com/kzohaar/app/widget/KZWidgetSnapshot.java', import.meta.url), 'utf8');
  assert.match(java, /List<JSONObject> upcoming\(long t, int count\)/);
  assert.match(java, /collect\(instants, root\.optJSONArray\("shabbat"\), "candles", t\);/, 'the widget redraws when candle lighting passes');
});

// Every widget's header (the date, the day, the reading) is centred in its block, on iOS and Android.
test('widget headers are centred: the date lines of the small, medium and זמנים widgets on iOS and Android', () => {
  const swift = readFileSync(new URL('../ios/App/KZWidgets/KZWidgets.swift', import.meta.url), 'utf8');
  const small = swift.slice(swift.indexOf('struct KZSmallView'), swift.indexOf('struct KZMediumView'));
  assert.match(small, /VStack\(alignment: \.center, spacing: 1\) \{\s+Text\(day\.dayMonth\)/);
  assert.match(small, /\.multilineTextAlignment\(\.center\)\s+\.frame\(maxWidth: \.infinity, alignment: \.center\)/);
  assert.match(small, /large: 30, alignment: \.center\)/, 'the next zman under the centred header is centred too');
  const more = readFileSync(new URL('../ios/App/KZWidgets/KZMoreWidgets.swift', import.meta.url), 'utf8');
  const zmanim = more.slice(more.indexOf('struct KZZmanimWeatherView'), more.indexOf('struct KZZmanimWeatherWidget'));
  assert.match(zmanim, /VStack\(alignment: \.center, spacing: 2\) \{\s+Text\(day\.date\)/);
  assert.doesNotMatch(zmanim, /Text\(day\.dayMonth\)[^\n]*\n\s+Spacer\(\)/, 'no date pushed to one edge');
  assert.equal((zmanim.match(/\.frame\(maxWidth: \.infinity, alignment: \.center\)/g) || []).length, 2);
  const medium = swift.slice(swift.indexOf('struct KZMediumView'), swift.indexOf('// MARK: - Lock screen'));
  assert.doesNotMatch(small + medium + zmanim, /VStack\(alignment: \.leading[^\n]*\{\s+Text\(day\.(date|dayMonth)\)/, 'no home-screen date header is leading-aligned');
  const layout = name => readFileSync(new URL(`../android/app/src/main/res/layout/${name}`, import.meta.url), 'utf8');
  const smallXml = layout('kz_widget_small.xml');
  for (const id of ['kz_day_month', 'kz_weekday', 'kz_next_name', 'kz_next_time']) assert.match(smallXml, new RegExp(`android:id="@\\+id/${id}"\\s+android:layout_width="match_parent"\\s+android:gravity="center"`), id);
  assert.match(layout('kz_widget_zmanim.xml'), /android:id="@\+id\/kz_head"[^>]*android:gravity="center"/);
  const java = readFileSync(new URL('../android/app/src/main/java/com/kzohaar/app/widget/KZMoreWidgets.java', import.meta.url), 'utf8');
  assert.match(java, /R\.id\.kz_weekday, "· " \+ day\.optString\("weekday"\)/);
});
