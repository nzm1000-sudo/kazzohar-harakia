// השעון היהודי — the platform scheduler, persistence, reconciliation, permission states and the words on screen.
// The native side is a fake adapter here (the real ones are Swift / Java); what is tested is everything the JavaScript
// decides: what to register, what to cancel, never a duplicate, never a silent success.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, CITIES, normalizeSettings } from '../src/services.mjs';
import { normalizeRule } from '../src/services/jewishAlarm/model.mjs';
import { planSchedule, diffNative, reconcileAlarms, occurrenceUuid, occurrenceNumber, HORIZON } from '../src/services/jewishAlarm/scheduler.mjs';
import { loadAlarmState, saveAlarmState, upsertRule, deleteRule, setRuleEnabled, parseAlarmState, STORE_KEY } from '../src/services/jewishAlarm/store.mjs';
import { offsetPhrase, offsetPhraseShort, durationBreakdown, minutesText, spokenTime, accessibilityLabel, alarmNotice, recurrenceText, dayText, titleOf, timeText } from '../src/services/jewishAlarm/format.mjs';
import { occurrencesFor } from '../src/services/jewishAlarm/occurrences.mjs';
import { alarmContext } from '../src/services/jewishAlarm/engine.mjs';

const TLV = normalizeSettings({ ...DEFAULT_SETTINGS });
const NOW = new Date('2026-10-05T12:00:00Z');
const memoryStorage = () => { const map = new Map(); return { getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key), map }; };
const sunrise = (extra = {}) => normalizeRule({ id: 'sunrise-rule', title: 'השכמה לנץ', mode: 'jewish', jewishAnchorId: 'sunrise', offsetMinutes: -25, recurrence: 'daily', ...extra });
const wake = (extra = {}) => normalizeRule({ id: 'wake-rule', mode: 'fixed', fixedTime: '07:00', recurrence: 'weekdays', ...extra });

// A fake native side: remembers registrations like AlarmKit / AlarmManager would.
function fakeAdapter({ engine = 'alarmkit', permission = 'granted', grantOnRequest = true, limit = Infinity } = {}) {
  const registered = new Map();
  const calls = { request: 0, schedule: 0, cancel: 0 };
  let state = permission;
  return {
    engine, registered, calls,
    async permission() { return state; },
    async request() { calls.request += 1; if (state === 'prompt' && grantOnRequest) state = 'granted'; else if (state === 'prompt') state = 'denied'; return state; },
    async list() { return [...registered.keys()]; },
    async schedule(entries) { calls.schedule += 1; const scheduled = []; for (const item of entries) { if (registered.size >= limit) return { scheduled, limit: true }; registered.set(item.id, item); scheduled.push(item.id); } return { scheduled }; },
    async cancel(ids) { calls.cancel += 1; for (const id of ids) registered.delete(id); },
    revoke() { state = 'denied'; },
  };
}

test('planSchedule: absolute instants, nearest first, within each platform\'s budget, never two entries for one key', () => {
  const plan = planSchedule([sunrise(), wake()], TLV, { now: NOW, engine: 'alarmkit' });
  assert.ok(plan.length > 10 && plan.length <= HORIZON.alarmkit.budget);
  assert.deepEqual(plan.map(item => item.at), [...plan.map(item => item.at)].sort());
  assert.equal(new Set(plan.map(item => item.key)).size, plan.length);
  assert.equal(new Set(plan.map(item => item.id)).size, plan.length);
  for (const item of plan) { assert.match(item.at, /Z$/); assert.ok(new Date(item.at) > NOW); assert.doesNotMatch(`${item.title} ${item.body}`, /undefined|NaN|null/); }
  // The local-notification fallback keeps within the 64-per-app iOS limit, shared with the app's other reminders.
  const many = Array.from({ length: 8 }, (_, index) => sunrise({ id: `r${index}`, offsetMinutes: -index * 5 }));
  assert.ok(planSchedule(many, TLV, { now: NOW, engine: 'notifications' }).length <= 36);
  assert.equal(planSchedule([sunrise()], TLV, { now: NOW, engine: 'none' }).length, 0);
  // Ids are stable: the same occurrence always gets the same id (a reschedule replaces, never duplicates).
  assert.equal(occurrenceUuid('a:2026-10-06'), occurrenceUuid('a:2026-10-06'));
  assert.notEqual(occurrenceUuid('a:2026-10-06'), occurrenceUuid('a:2026-10-07'));
  assert.match(occurrenceUuid('x'), /^[0-9A-F]{8}-[0-9A-F]{4}-5[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/);
  assert.ok(occurrenceNumber('x') > 0 && occurrenceNumber('x') <= 2000000000);
});

test('the notification text is short and human', () => {
  const ctx = alarmContext(TLV);
  const next = occurrencesFor(sunrise(), ctx, { now: NOW, days: 3 })[0];
  const notice = alarmNotice(sunrise(), next, 'Asia/Jerusalem');
  assert.equal(notice.title, 'השכמה לנץ');
  assert.match(notice.body, /^25 דקות לפני הנץ · הנץ היום \d\d:\d\d$/);
  const candles = normalizeRule({ id: 'c', mode: 'jewish', jewishAnchorId: 'candles-shabbat', offsetMinutes: -30 });
  const friday = occurrencesFor(candles, ctx, { now: NOW, days: 7 })[0];
  assert.match(alarmNotice(candles, friday, 'Asia/Jerusalem').body, /^הדלקת נרות שבת · בעוד 30 דקות · \d\d:\d\d$/);
  const omer = normalizeRule({ id: 'o', mode: 'jewish', jewishAnchorId: 'omer', offsetMinutes: 10, ringOnRest: true });
  const night = occurrencesFor(omer, ctx, { now: new Date('2027-04-20T00:00:00Z'), days: 5 })[0];
  assert.deepEqual(alarmNotice(omer, night, 'Asia/Jerusalem'), { title: 'ספירת העומר', body: 'הגיע זמן ספירת העומר · הלילה 1 לעומר' });
});

test('diffNative: cancels orphans and changed entries, schedules new / changed / missing ones, replaces instead of adding', () => {
  const plan = planSchedule([sunrise()], TLV, { now: NOW });
  const previous = Object.fromEntries(plan.map(item => [item.key, { id: item.id, at: item.at, title: item.title, body: item.body, sig: item.sig }]));
  assert.deepEqual(diffNative(previous, plan, plan.map(item => item.id)), { cancel: [], schedule: [] }, 'nothing to do when all is in place');
  const missing = diffNative(previous, plan, plan.slice(1).map(item => item.id));
  assert.deepEqual(missing.schedule.map(item => item.id), [plan[0].id], 'a registration that went missing is repaired');
  const orphan = diffNative(previous, plan, [...plan.map(item => item.id), 'ORPHAN']);
  assert.deepEqual(orphan.cancel, ['ORPHAN']);
  const moved = planSchedule([sunrise()], { ...TLV, location: CITIES[2] }, { now: NOW });
  const change = diffNative(previous, moved, plan.map(item => item.id));
  assert.ok(change.schedule.length > 0);
  for (const item of change.schedule) assert.ok(change.cancel.includes(item.id), 'the old registration is replaced');
});

test('reconcile: permission granted → registered; nothing duplicated on a second run; disabled → removed', async () => {
  const storage = memoryStorage();
  const adapter = fakeAdapter();
  upsertRule(sunrise(), storage);
  let state = await reconcileAlarms({ settings: TLV, adapter, now: NOW, storage });
  const count = adapter.registered.size;
  assert.ok(count > 0);
  assert.equal(state.permission, 'granted');
  assert.equal(state.rules[0].platformScheduleState, 'scheduled');
  assert.ok(state.rules[0].nextOccurrence);
  assert.equal(Object.keys(state.schedule).length, count);
  state = await reconcileAlarms({ settings: TLV, adapter, now: NOW, storage });
  assert.equal(adapter.registered.size, count, 'a second run registers nothing new');
  setRuleEnabled('sunrise-rule', false, storage);
  state = await reconcileAlarms({ settings: TLV, adapter, now: NOW, storage });
  assert.equal(adapter.registered.size, 0);
  assert.equal(state.rules[0].platformScheduleState, 'off');
  deleteRule('sunrise-rule', storage);
  assert.equal(loadAlarmState(storage).rules.length, 0);
});

test('reconcile: startup repairs a missing registration and removes an orphan left by an old install', async () => {
  const storage = memoryStorage();
  const adapter = fakeAdapter();
  upsertRule(sunrise(), storage);
  await reconcileAlarms({ settings: TLV, adapter, now: NOW, storage });
  const [first] = adapter.registered.keys();
  adapter.registered.delete(first);
  adapter.registered.set('ORPHAN-ID', { id: 'ORPHAN-ID' });
  await reconcileAlarms({ settings: TLV, adapter, now: NOW, storage });
  assert.ok(adapter.registered.has(first), 'repaired');
  assert.equal(adapter.registered.has('ORPHAN-ID'), false, 'orphan removed');
});

test('permission states: not determined asks only when allowed; denied never pretends; revoked keeps the rules', async () => {
  const storage = memoryStorage();
  upsertRule(sunrise(), storage);
  const prompt = fakeAdapter({ permission: 'prompt' });
  let state = await reconcileAlarms({ settings: TLV, adapter: prompt, now: NOW, storage });
  assert.equal(prompt.calls.request, 0, 'launch / resume never asks');
  assert.equal(state.permission, 'prompt');
  assert.equal(prompt.registered.size, 0);
  state = await reconcileAlarms({ settings: TLV, adapter: prompt, now: NOW, storage, ask: true });
  assert.equal(prompt.calls.request, 1, 'saving an alarm asks, in context');
  assert.equal(state.permission, 'granted');
  assert.ok(prompt.registered.size > 0);
  const denied = fakeAdapter({ permission: 'prompt', grantOnRequest: false });
  const storage2 = memoryStorage();
  upsertRule(sunrise(), storage2);
  state = await reconcileAlarms({ settings: TLV, adapter: denied, now: NOW, storage: storage2, ask: true });
  assert.equal(state.permission, 'denied');
  assert.equal(state.rules[0].platformScheduleState, 'denied', 'never shown as scheduled');
  assert.equal(denied.registered.size, 0);
  prompt.revoke();
  state = await reconcileAlarms({ settings: TLV, adapter: prompt, now: NOW, storage });
  assert.equal(state.permission, 'denied');
  assert.equal(state.rules.length, 1, 'the rule is kept');
  // Android: exact alarms refused is its own state, never quietly inexact.
  const android = fakeAdapter({ engine: 'android', permission: 'exact-denied', grantOnRequest: false });
  const storage3 = memoryStorage();
  upsertRule(sunrise(), storage3);
  state = await reconcileAlarms({ settings: TLV, adapter: android, now: NOW, storage: storage3 });
  assert.equal(state.permission, 'exact-denied');
  assert.equal(android.registered.size, 0);
  // Web: nothing is scheduled and it says so.
  state = await reconcileAlarms({ settings: TLV, adapter: { engine: 'none' }, now: NOW, storage: memoryStorage() });
  assert.equal(state.permission, 'unsupported');
});

test('a location change reschedules every Jewish alarm and leaves a short notice', async () => {
  const storage = memoryStorage();
  const adapter = fakeAdapter();
  upsertRule(sunrise(), storage);
  await reconcileAlarms({ settings: TLV, adapter, now: NOW, storage });
  const before = [...adapter.registered.values()].map(item => item.at).sort();
  const state = await reconcileAlarms({ settings: { ...TLV, location: CITIES[4] }, adapter, now: NOW, storage });
  const after = [...adapter.registered.values()].map(item => item.at).sort();
  assert.notDeepEqual(after, before);
  assert.equal(after.length, before.length, 'no duplicates after the move');
  assert.equal(state.notice, 'זמני השעון עודכנו לפי המיקום החדש.');
  assert.equal(state.rules[0].locationSnapshot.name, CITIES[4].name);
});

test('a platform limit trims to the nearest alarms and says so', async () => {
  const storage = memoryStorage();
  const adapter = fakeAdapter({ limit: 5 });
  upsertRule(sunrise(), storage);
  const state = await reconcileAlarms({ settings: TLV, adapter, now: NOW, storage });
  assert.equal(adapter.registered.size, 5);
  assert.equal(state.error, 'limit');
  assert.equal(Object.keys(state.schedule).length, 5, 'only what is really registered is recorded');
});

test('persistence: survives a restart (a fresh load), rejects corrupt data, keeps no duplicate rules', () => {
  const storage = memoryStorage();
  upsertRule(sunrise(), storage);
  upsertRule(wake(), storage);
  upsertRule({ ...sunrise(), offsetMinutes: -30 }, storage);
  const state = loadAlarmState(storage);
  assert.equal(state.rules.length, 2);
  assert.equal(state.rules.find(rule => rule.id === 'sunrise-rule').offsetMinutes, -30, 'an edit replaces');
  storage.setItem(STORE_KEY, '{corrupt');
  assert.deepEqual(loadAlarmState(storage).rules, []);
  assert.equal(parseAlarmState(JSON.stringify({ rules: [sunrise(), sunrise(), { mode: 'bad' }] })).rules.length, 1);
  saveAlarmState({ rules: [sunrise()], schedule: { a: { id: 'X', at: '2026-10-06T03:00:00.000Z', title: 't', body: 'b', sig: 's' } } }, storage);
  assert.equal(loadAlarmState(storage).schedule.a.id, 'X');
});

test('UI formatting: offsets, durations, days, spoken time and the VoiceOver / TalkBack label', () => {
  assert.equal(offsetPhrase(-25, 'sunrise'), '25 דקות לפני הנץ');
  assert.equal(offsetPhrase(0, 'sunrise'), 'בזמן הנץ');
  assert.equal(offsetPhrase(10, 'tzeit85deg'), '10 דקות אחרי צאת הכוכבים');
  assert.equal(offsetPhrase(-180, 'candles-shabbat'), '3 שעות לפני הדלקת הנרות');
  assert.equal(offsetPhraseShort(-25, 'sunrise'), '25 דק׳ לפני הנץ');
  assert.equal(durationBreakdown(90), 'שעה ו־30 דקות');
  assert.equal(durationBreakdown(45), '45 דקות');
  assert.equal(durationBreakdown(120), 'שעתיים');
  assert.equal(minutesText(1), 'דקה');
  assert.equal(spokenTime('05:35'), 'חמש שלושים וחמש');
  assert.equal(spokenTime('17:22'), 'שבע עשרה עשרים ושתיים');
  assert.equal(spokenTime('06:05'), 'שש וחמש דקות');
  assert.equal(dayText('2026-10-06', '2026-10-05'), 'מחר');
  assert.equal(dayText('2026-10-05', '2026-10-05'), 'היום');
  assert.equal(dayText('2026-10-08', '2026-10-05'), 'יום חמישי');
  assert.equal(recurrenceText(wake()), 'ימות השבוע (א׳–ה׳)');
  assert.equal(recurrenceText(normalizeRule({ mode: 'jewish', jewishAnchorId: 'omer', offsetMinutes: 10 })), 'בלילות ספירת העומר בלבד');
  assert.equal(titleOf(normalizeRule({ mode: 'jewish', jewishAnchorId: 'sunrise', offsetMinutes: -25 })), 'השכמה לנץ');
  const occurrence = { date: '2026-10-06', at: new Date('2026-10-06T02:35:00Z') };
  assert.equal(timeText(occurrence.at, 'Asia/Jerusalem'), '05:35');
  assert.equal(accessibilityLabel(sunrise(), occurrence, { tz: 'Asia/Jerusalem', todayKey: '2026-10-05' }), 'השעון השכמה לנץ, פעיל, מחר בחמש שלושים וחמש, עשרים וחמש דקות לפני הנץ.');
});
