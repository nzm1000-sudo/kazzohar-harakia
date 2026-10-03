// The ways in from the home-screen widgets (and the Live Activity, Siri, the Android shortcuts): every
// "kzohaar://open/…" link they use lands on a screen the app really draws — and "meat" lands on Today with the
// בשרי · חלבי sheet open, not on Today alone (owner, 2026-10-03: "הקישור מוביל למסך הראשי"). Also the widget's
// "ביטול" while the wait runs: the shared record it writes, and the app taking it in (the card cleared, its reminder
// withdrawn).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEntryUrl, openEntry, takeSharedMeat, ENTRY_ROUTES, ENTRY_SHEETS, WIDGET_PRAYERS } from '../src/services/nativeWidgets.mjs';
import { parseDeepLink } from '../src/services/reminders/deepLinks.mjs';
import { parseLeatzmiRoute } from '../src/services/leatzmi/routes.mjs';
import {
  readMeatDairy, recordMeatDairyChange, requestMeatDairySheet, takeMeatDairySheetRequest, MEAT_DAIRY_OPEN_TTL_MS, MEAT_DAIRY_KEY,
} from '../src/services/meatDairy.mjs';
import { buildWidgetSnapshot, newerMeat, meatStateAt } from '../src/services/widgetSnapshot.mjs';
import { stableId } from '../src/services/notificationEngine.mjs';
import { DEFAULT_SETTINGS } from '../src/services.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const memoryStorage = (seed = {}) => {
  const data = new Map(Object.entries(seed));
  return { getItem: key => (data.has(key) ? data.get(key) : null), setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key), data };
};

// The prayer keys a widget can put after "prayer/": the prayer of the hour and the quartet's four doors
// (services/widgetSnapshot.mjs prayerStateAt / quartetAt).
const SNAPSHOT_PRAYER_KEYS = ['shacharit', 'mincha', 'maariv', 'birkat-hamazon'];

// Every link the native side uses, read from its sources. A literal ending in "/" is a prefix completed at run time
// with a prayer key.
function nativePaths() {
  const paths = new Set();
  const add = path => { if (path.endsWith('/')) SNAPSHOT_PRAYER_KEYS.forEach(key => paths.add(path + key)); else paths.add(path); };
  for (const file of ['ios/App/KZWidgets/KZWidgets.swift', 'ios/App/KZWidgets/KZMoreWidgets.swift', 'ios/App/KZWidgets/KZHitbodedutLiveActivity.swift', 'ios/App/App/KZAppIntents.swift']) {
    const swift = read(file);
    for (const [, path] of swift.matchAll(/kzohaar:\/\/open\/([a-z/-]+)/g)) add(path);
    for (const [, path] of swift.matchAll(/kzLink\("([a-z/-]+)/g)) add(path);
    for (const [, one, other] of swift.matchAll(/kzLink\([^)]*?\? "([a-z/-]+)" : "([a-z/-]+)"/g)) { add(one); add(other); }
  }
  for (const file of ['android/app/src/main/java/com/kzohaar/app/widget/KZMoreWidgets.java', 'android/app/src/main/java/com/kzohaar/app/widget/KZWidgetProvider.java']) {
    const java = read(file);
    for (const [, args] of java.matchAll(/open\(context, ([^;]+?)\)\);/g)) for (const [, path] of args.matchAll(/(?<!\()"([a-z/-]*)"(?!\.equals)/g)) add(path);
  }
  for (const [, path] of read('android/app/src/main/res/xml/kz_shortcuts.xml').matchAll(/kzohaar:\/\/open\/([a-z/-]+)/g)) add(path);
  return [...paths].sort();
}

// A hash route NewApp draws: Today (what renders when nothing else matched), an exact mode, or a sub-route of a
// section that takes them; לעצמי's sub-routes must be ones it knows (else it falls back to its home).
const app = read('src/NewApp.jsx');
function screenExists(route) {
  if (route === 'today') return true;
  const head = route.split('/')[0];
  if (head === 'leatzmi' && route !== 'leatzmi') return parseLeatzmiRoute(route).view !== 'home' && app.includes("mode.startsWith('leatzmi/')");
  return app.includes(`mode==='${route}'`) || (route.includes('/') && app.includes(`mode.startsWith('${head}/')`));
}

test('every widget / Live Activity / Siri / shortcut link opens a screen the app really draws', () => {
  const paths = nativePaths();
  for (const expected of ['zmanim', 'today', 'ring', 'parasha', 'meat', 'sayings', 'hitbodedut', 'prayer/omer', 'prayer/shacharit', 'prayer/mincha', 'prayer/maariv', 'prayer/birkat-hamazon']) {
    assert.ok(paths.includes(expected), `the native side uses ${expected}`);
  }
  for (const path of paths) {
    const entry = parseEntryUrl(`kzohaar://open/${path}`);
    assert.ok(entry, `${path} is honoured`);
    assert.ok(screenExists(entry.route), `${path} → #${entry.route} is a real screen`);
    if (entry.prayer) assert.deepEqual(parseDeepLink(`prayer/${entry.prayer}`), { kind: 'prayer', prayer: entry.prayer }, `${path}: NewApp opens the prayer`);
  }
  // Every name the app accepts leads somewhere real, too.
  for (const [name, route] of Object.entries(ENTRY_ROUTES)) assert.ok(screenExists(route), `${name} → #${route}`);
  for (const prayer of WIDGET_PRAYERS) assert.ok(parseDeepLink(`prayer/${prayer}`), prayer);
});

test('each widget link lands on its own screen (not the main screen, unless that is the screen)', () => {
  const expected = {
    zmanim: { route: 'times', query: '' },
    today: { route: 'today', query: '' },
    ring: { route: 'mitzvot-journal/olam', query: '' },
    parasha: { route: 'parasha', query: '' },
    sayings: { route: 'leatzmi/today', query: '' },
    hitbodedut: { route: 'leatzmi/hitbodedut', query: '' },
    'prayer/omer': { route: 'siddur', query: '', prayer: 'omer' },
    'prayer/shacharit': { route: 'siddur', query: '', prayer: 'shacharit' },
    // בשרי · חלבי is a tile on Today; its sheet is the screen (the wait, its hour, איפוס).
    meat: { route: 'today', query: '', sheet: 'meat-dairy' },
  };
  for (const [path, entry] of Object.entries(expected)) assert.deepEqual(parseEntryUrl(`kzohaar://open/${path}`), entry, path);
  assert.deepEqual(Object.keys(ENTRY_SHEETS), ['meat']);
  assert.equal(parseLeatzmiRoute('leatzmi/today').view, 'today');
  assert.equal(parseLeatzmiRoute('leatzmi/hitbodedut').view, 'hitbodedut');
});

test('kzohaar://open/meat opens the בשרי · חלבי sheet — warm (Today on screen) or cold (Today not drawn yet)', async () => {
  const previous = globalThis.location;
  try {
    // Warm, from another page: the request is left for the card, and the app goes to Today.
    globalThis.location = { hash: '#times' };
    takeMeatDairySheetRequest();
    openEntry(parseEntryUrl('kzohaar://open/meat'));
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(globalThis.location.hash, '#today');
    assert.equal(takeMeatDairySheetRequest(), true, 'the card takes the request as it mounts');
    assert.equal(takeMeatDairySheetRequest(), false, 'once only');
    // Cold start: no hash yet (Today) — no extra history entry, the request waits for the card.
    globalThis.location = { hash: '' };
    openEntry(parseEntryUrl('kzohaar://open/meat'));
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(globalThis.location.hash, '');
    assert.equal(takeMeatDairySheetRequest(), true);
    // Another link never opens the sheet.
    globalThis.location = { hash: '' };
    openEntry(parseEntryUrl('kzohaar://open/today'));
    assert.equal(takeMeatDairySheetRequest(), false);
  } finally {
    globalThis.location = previous;
  }
  // A stale request (an unrelated, later visit to Today) does not open it.
  requestMeatDairySheet(1000);
  assert.equal(takeMeatDairySheetRequest(1000 + MEAT_DAIRY_OPEN_TTL_MS + 1), false);
  requestMeatDairySheet(1000);
  assert.equal(takeMeatDairySheetRequest(1000 + MEAT_DAIRY_OPEN_TTL_MS), true);
  // The card listens for the request and takes it on mount.
  const timer = read('src/components/MeatDairyTimer.jsx');
  assert.match(timer, /MEAT_DAIRY_OPEN_EVENT/);
  assert.match(timer, /takeMeatDairySheetRequest\(\)\) \{ setNow\(new Date\(\)\); setOpen\(true\); \}/);
});

test('the widget\'s "ביטול": the app takes the cancel in — the card cleared, its reminder withdrawn; an older one is ignored', () => {
  const start = Date.parse('2026-10-03T12:00:00Z');
  const reminderId = stableId('meat-dairy-wait');
  const calls = () => { const log = { scheduled: [], cancelled: [] }; return { log, schedule: item => log.scheduled.push(item), cancel: id => log.cancelled.push(id) }; };
  for (const json of [
    JSON.stringify({ hours: 6, preferred: 6, updatedAt: start + 60000 }),                    // iOS: JSONEncoder leaves out a nil startedAt
    JSON.stringify({ startedAt: null, hours: 6, preferred: 6, updatedAt: start + 60000 }),   // Android: JSONObject.NULL
  ]) {
    const storage = memoryStorage();
    recordMeatDairyChange({ wait: { startedAt: new Date(start).toISOString(), hours: 6 } }, { storage, now: start });
    const { log, schedule, cancel } = calls();
    assert.equal(takeSharedMeat(json, { storage, schedule, cancel }), null, 'adopted as a cancel');
    assert.equal(JSON.parse(storage.getItem(MEAT_DAIRY_KEY)), null, 'the card is at rest');
    assert.deepEqual(readMeatDairy(storage), { startedAt: null, hours: 6, preferred: 6, updatedAt: start + 60000 });
    assert.deepEqual(log, { scheduled: [], cancelled: [reminderId] });
  }
  // The app started again after the widget's cancel: the app's wait stands.
  const storage = memoryStorage();
  recordMeatDairyChange({ wait: { startedAt: new Date(start).toISOString(), hours: 3 } }, { storage, now: start + 120000 });
  const { log, schedule, cancel } = calls();
  assert.equal(takeSharedMeat(JSON.stringify({ hours: 3, preferred: 3, updatedAt: start + 60000 }), { storage, schedule, cancel }), undefined);
  assert.equal(readMeatDairy(storage).startedAt, start);
  assert.deepEqual(log, { scheduled: [], cancelled: [] });
  // A start from the widget, newer: adopted with the card's reminder.
  const started = takeSharedMeat(JSON.stringify({ startedAt: start + 600000, hours: 3, preferred: 3, updatedAt: start + 600000 }), { storage, schedule, cancel });
  assert.deepEqual(started, { startedAt: new Date(start + 600000).toISOString(), hours: 3 });
  assert.equal(log.scheduled.length, 1);
  assert.equal(log.scheduled[0].id, reminderId);
  assert.equal(log.scheduled[0].at.getTime(), start + 600000 + 3 * 3600000);
  // Nothing from the widget, or a broken record: nothing changes.
  assert.equal(takeSharedMeat(null, { storage, schedule, cancel }), undefined);
  assert.equal(takeSharedMeat('{broken', { storage, schedule, cancel }), undefined);
});

test('the snapshot\'s meat fields, and the widget\'s cancel record, are one shape on every side', () => {
  const start = Date.parse('2026-10-03T12:00:00Z');
  const storage = memoryStorage();
  recordMeatDairyChange({ preferred: 3 }, { storage, now: start - 1 });
  recordMeatDairyChange({ wait: { startedAt: new Date(start).toISOString(), hours: 3 } }, { storage, now: start });
  const running = buildWidgetSnapshot({ now: new Date(start + 60000), settings: DEFAULT_SETTINGS, meat: readMeatDairy(storage) }).meat;
  assert.deepEqual(Object.keys(running).sort(), ['hours', 'preferred', 'startedAt', 'updatedAt']);
  assert.deepEqual(running, { startedAt: start, hours: 3, preferred: 3, updatedAt: start });
  assert.equal(meatStateAt(running, start + 60000).phase, 'waiting');
  recordMeatDairyChange({ wait: null }, { storage, now: start + 120000 });
  const stopped = buildWidgetSnapshot({ now: new Date(start + 180000), settings: DEFAULT_SETTINGS, meat: readMeatDairy(storage) }).meat;
  assert.deepEqual(stopped, { startedAt: null, hours: 6, preferred: 3, updatedAt: start + 120000 });
  assert.equal(meatStateAt(stopped, start + 180000).phase, 'idle', 'stopped in the app → the widget at rest');
  // The widget's cancel, newer than the app's running wait, wins in the widget (KZMeat.newer / KZWidgetSnapshot.meat).
  const widgetCancel = { startedAt: null, hours: 3, preferred: 3, updatedAt: start + 60000 };
  assert.equal(meatStateAt(newerMeat(running, widgetCancel), start + 90000).phase, 'idle');

  // iOS: the record's fields; the cancel intent writes a record with no start, stamped now, withdraws the reminder
  // and reloads the widgets; its control only while the wait runs, smaller than "אכלתי בשרי", never filled.
  const shared = read('ios/App/Shared/KZWidgetSnapshot.swift');
  for (const field of ['let startedAt: Double?', 'let hours: Int', 'let preferred: Int?', 'let updatedAt: Double']) assert.ok(shared.includes(field), field);
  const swift = read('ios/App/KZWidgets/KZMoreWidgets.swift');
  const intent = swift.slice(swift.indexOf('struct KZCancelMeatIntent'), swift.indexOf('struct KZMeatView'));
  assert.match(intent, /KZMeatStore\.write\(KZMeat\(startedAt: nil,[^)]*updatedAt: KZSnapshot\.ms\(now\)\)\)/);
  assert.match(intent, /removePendingNotificationRequests\(withIdentifiers: \[KZMeatStore\.reminderIdentifier\]\)/);
  assert.match(intent, /WidgetCenter\.shared\.reloadAllTimelines\(\)/);
  const small = swift.slice(swift.indexOf('private func small(_ state: KZMeat.State'), swift.indexOf('private func button('));
  const waiting = small.slice(small.indexOf('case .waiting:'), small.indexOf('case .done:'));
  assert.match(waiting, /cancelButton\(palette\)/);
  assert.doesNotMatch(small.slice(small.indexOf('case .done:')), /cancelButton/, 'no ביטול once the wait is over or at rest');
  const cancelButton = swift.slice(swift.indexOf('private func cancelButton('), swift.indexOf('struct KZMeatWidget'));
  assert.match(cancelButton, /Button\(intent: KZCancelMeatIntent\(\)\)/);
  assert.match(cancelButton, /Text\("ביטול"\)/);
  assert.match(cancelButton, /foregroundColor\(palette\.copper\)/);
  assert.match(cancelButton, /\.kzRaised\(palette/);
  assert.doesNotMatch(cancelButton, /maxWidth: \.infinity|\.background\(|\.fill\(|weight: \.bold|weight: \.semibold/);
  assert.match(swift, /\.widgetURL\(kzLink\("meat"\)\)/);

  // Android: the same record from the broadcast; the control in the waiting state only, with its own broadcast.
  const java = read('android/app/src/main/java/com/kzohaar/app/widget/KZWidgetSnapshot.java');
  const cancelMeat = java.slice(java.indexOf('static void cancelMeat('), java.indexOf('static int meatHours('));
  assert.match(cancelMeat, /put\("startedAt", JSONObject\.NULL\)\.put\("hours", meatHours\(current\)\)\.put\("preferred", preferred\)\.put\("updatedAt", now\)/);
  assert.match(cancelMeat, new RegExp(`MEAT_REMINDER_ID = ${stableId('meat-dairy-wait')}`));
  assert.match(cancelMeat, /TimedNotificationPublisher/);
  const receiver = read('android/app/src/main/java/com/kzohaar/app/widget/KZWidgetActionReceiver.java');
  assert.match(receiver, /ACTION_MEAT_CANCEL\.equals\(action\)\) KZWidgetSnapshot\.cancelMeat\(context/);
  const more = read('android/app/src/main/java/com/kzohaar/app/widget/KZMoreWidgets.java');
  assert.match(more, /getBroadcast\(context, 7374, [^;]*ACTION_MEAT_CANCEL/);
  assert.match(more, /setOnClickPendingIntent\(R\.id\.kz_meat_cancel, cancel\)/);
  const layout = read('android/app/src/main/res/layout/kz_widget_meat.xml');
  const waitingXml = layout.slice(layout.indexOf('android:id="@+id/kz_meat_waiting"'), layout.indexOf('android:id="@+id/kz_meat_done"'));
  assert.match(waitingXml, /android:id="@\+id\/kz_meat_cancel"[^>]*android:layout_width="wrap_content"[^>]*android:background="@drawable\/kz_widget_button"[^>]*android:text="ביטול"[^>]*android:textColor="@color\/kz_widget_copper"/);
  assert.equal((layout.match(/kz_meat_cancel/g) || []).length, 1, 'one ביטול, in the waiting state');
});
