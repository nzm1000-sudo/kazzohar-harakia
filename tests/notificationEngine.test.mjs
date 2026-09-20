import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildNotifications, diffSchedule, isDuringRest, restWindows, scheduleRecord, stableId } from '../src/services/notificationEngine.mjs';
import {
  emptyPreparation, setNotificationCategory, setNotificationsEnabled, setPreparationReminderTime,
  setPreparationReminderTopic, setQuietMode, setTaskReminder,
} from '../src/services/preparationStorage.mjs';

const TZ = 'Asia/Jerusalem';
const now = new Date('2026-09-24T09:00:00Z');

const items = [
  { category: 'candles', date: '2026-09-25T18:12:00+03:00' },
  { category: 'havdalah', date: '2026-09-26T19:10:00+03:00' },
];

const plan = {
  kind: 'shabbat',
  eventKey: 'shabbat:2026-09-26',
  name: 'שבת',
  candles: '2026-09-25T18:12:00+03:00',
  havdalah: '2026-09-26T19:10:00+03:00',
};

function enabled(categories = ['critical']) {
  let state = setNotificationsEnabled(emptyPreparation(), true);
  for (const category of ['critical', 'prayer', 'shabbat', 'family', 'learning', 'community']) {
    state = setNotificationCategory(state, category, categories.includes(category));
  }
  return state;
}

function summaryState(times, topics) {
  let state = enabled(['shabbat']);
  for (const time of times) state = setPreparationReminderTime(state, time, true);
  for (const topic of topics) state = setPreparationReminderTopic(state, topic, true);
  return state;
}

const summaryTasks = [
  { id: 'shabbat-candles', title: 'נרות שבת', group: 'before' },
  { id: 'shabbat-plata', title: 'פלטה ומיחם', group: 'before' },
  { id: 'shabbat-electricity', title: 'שעוני שבת וחשמל', group: 'before' },
  { id: 'shabbat-table', title: 'שולחן שבת', group: 'home' },
  { id: 'shabbat-children', title: 'הכנת הילדים', group: 'family' },
  { id: 'shabbat-parasha', title: 'פרשת השבוע', group: 'spiritual' },
];

test('no notifications are produced until the user opts in', () => {
  const off = buildNotifications({ now, tz: TZ, plan, items, state: emptyPreparation() });
  assert.deepEqual(off, [], 'disabled state schedules nothing');
  assert.equal(emptyPreparation().notifications.permissionRequested, false);
});

test('quiet mode suppresses every reminder', () => {
  const state = setQuietMode(enabled(['critical', 'shabbat']), true);
  assert.deepEqual(buildNotifications({ now, tz: TZ, plan, items, state }), []);
});

test('only enabled categories are scheduled', () => {
  const criticalOnly = buildNotifications({ now, tz: TZ, plan, items, state: enabled(['critical']) });
  assert.ok(criticalOnly.length > 0);
  assert.ok(criticalOnly.every(item => item.category === 'critical'));

  const withFamily = buildNotifications({ now, tz: TZ, plan, items, state: enabled(['critical', 'family']), remaining: 3 });
  assert.ok(withFamily.some(item => item.category === 'family'));
});

test('notifications explain what changes rather than stating a bare fact', () => {
  const [first] = buildNotifications({ now, tz: TZ, plan, items, state: enabled(['critical']), remaining: 3 });
  assert.match(first.title, /שבת/);
  assert.match(first.body, /הדלקת נרות ב־\d{2}:\d{2}/);
  assert.match(first.body, /3 משימות/);
});

test('selected preparation times use the actual candle-lighting time', () => {
  const state = summaryState(['two-hours', 'one-hour'], ['candles']);
  const scheduled = buildNotifications({ now, tz: TZ, plan, items, state, pendingTasks: summaryTasks });
  assert.deepEqual(scheduled.map(item => item.at), [
    new Date(new Date(plan.candles).getTime() - 7200000).toISOString(),
    new Date(new Date(plan.candles).getTime() - 3600000).toISOString(),
  ]);

  const movedPlan = { ...plan, candles: '2026-09-25T17:42:00+03:00' };
  const moved = buildNotifications({ now, tz: TZ, plan: movedPlan, items, state, pendingTasks: summaryTasks });
  assert.equal(new Date(moved[0].at).getTime(), new Date(movedPlan.candles).getTime() - 7200000);
});

test('Friday morning and multiple selected times each produce one summary', () => {
  const state = summaryState(['morning', 'two-hours', 'one-hour'], ['candles', 'plata', 'electricity']);
  const scheduled = buildNotifications({ now, tz: TZ, plan, items, state, pendingTasks: summaryTasks });
  assert.equal(scheduled.length, 3);
  assert.ok(scheduled.some(item => item.at === '2026-09-25T06:00:00.000Z'));
  assert.ok(scheduled.every(item => /נשארו 3 הכנות/.test(item.body)));
  assert.equal(new Set(scheduled.map(item => item.at)).size, 3, 'there is no notification per task');
});

test('completed or unselected tasks are excluded from grouped summaries', () => {
  const state = summaryState(['one-hour'], ['candles', 'plata', 'home']);
  const pendingTasks = summaryTasks.filter(task => task.id !== 'shabbat-candles');
  const [scheduled] = buildNotifications({ now, tz: TZ, plan, items, state, pendingTasks });
  assert.match(scheduled.body, /פלטה ומיחם/);
  assert.match(scheduled.body, /שולחן שבת/);
  assert.doesNotMatch(scheduled.body, /נרות שבת|הכנת הילדים|פרשת השבוע/);
});

test('no unfinished-task summary is sent when selected tasks are complete', () => {
  const state = summaryState(['morning', 'two-hours', 'one-hour'], ['candles']);
  const scheduled = buildNotifications({ now, tz: TZ, plan, items, state, pendingTasks: summaryTasks.filter(task => task.id !== 'shabbat-candles') });
  assert.deepEqual(scheduled, []);
});

test('task reminders at the same time are grouped into one useful notification', () => {
  let state = enabled(['shabbat']);
  state = setTaskReminder(state, 'shabbat-plata', 'one-hour');
  state = setTaskReminder(state, 'shabbat-candles', 'one-hour');
  const pendingTasks = [
    { id: 'shabbat-plata', title: 'פלטה ומיחם' },
    { id: 'shabbat-candles', title: 'נרות שבת' },
  ];
  const scheduled = buildNotifications({ now, tz: TZ, plan, items, state, remaining: 2, pendingTasks });
  const oneHour = scheduled.filter(item => item.at === new Date(new Date(plan.candles).getTime() - 3600000).toISOString());
  assert.equal(oneHour.length, 1);
  assert.match(oneHour[0].body, /פלטה ומיחם/);
  assert.match(oneHour[0].body, /נרות שבת/);
});

test('a two-hour task reminder merges with the standard Shabbat summary', () => {
  let state = summaryState(['two-hours'], ['plata']);
  state = setTaskReminder(state, 'shabbat-plata', 'two-hours');
  const pendingTasks = [{ id: 'shabbat-plata', title: 'פלטה ומיחם', group: 'before' }];
  const scheduled = buildNotifications({ now, tz: TZ, plan, items, state, remaining: 1, pendingTasks });
  const twoHours = scheduled.filter(item => item.at === new Date(new Date(plan.candles).getTime() - 7200000).toISOString());
  assert.equal(twoHours.length, 1);
  assert.match(twoHours[0].body, /פלטה ומיחם/);
});

test('no routine reminder is scheduled between Shabbat entry and exit', () => {
  const windows = restWindows(items);
  assert.equal(windows.length, 1);
  assert.equal(isDuringRest('2026-09-25T19:00:00+03:00', windows), true);
  assert.equal(isDuringRest('2026-09-25T17:00:00+03:00', windows), false, 'a final pre-entry reminder is allowed');
  assert.equal(isDuringRest('2026-09-26T20:00:00+03:00', windows), false, 'reminders resume after exit');

  const scheduled = buildNotifications({ now, tz: TZ, plan, items, state: enabled(['critical', 'shabbat', 'family']), remaining: 2 });
  assert.ok(scheduled.every(item => !isDuringRest(item.at, windows)), 'nothing lands inside the rest window');
  assert.ok(scheduled.some(item => new Date(item.at) < new Date(plan.candles)), 'the pre-entry reminder is kept');
});

test('Yom Tov silence uses the same candle and havdalah pairing', () => {
  const yomTov = [
    { category: 'candles', date: '2026-10-02T18:00:00+03:00' },
    { category: 'havdalah', date: '2026-10-04T19:00:00+03:00' },
  ];
  const windows = restWindows(yomTov);
  assert.equal(isDuringRest('2026-10-03T12:00:00+03:00', windows), true, 'the middle day stays silent');
  assert.equal(isDuringRest('2026-10-04T20:00:00+03:00', windows), false);
});

test('past reminders are never scheduled', () => {
  const late = new Date('2026-09-25T18:00:00+03:00');
  const scheduled = buildNotifications({ now: late, tz: TZ, plan, items, state: enabled(['critical', 'shabbat']) });
  assert.ok(scheduled.every(item => item.at > late.toISOString()));
});

test('identifiers are stable and unique per reminder', () => {
  const first = buildNotifications({ now, tz: TZ, plan, items, state: enabled(['critical', 'shabbat', 'family']), remaining: 1 });
  const second = buildNotifications({ now, tz: TZ, plan, items, state: enabled(['critical', 'shabbat', 'family']), remaining: 1 });
  assert.deepEqual(first.map(item => item.id), second.map(item => item.id), 'ids are deterministic');
  assert.equal(new Set(first.map(item => item.key)).size, first.length, 'no duplicate keys');
  assert.equal(new Set(first.map(item => item.id)).size, first.length, 'no duplicate ids');
  assert.ok(first.every(item => Number.isInteger(item.id) && item.id > 0));
  assert.equal(stableId('a'), stableId('a'));
  assert.notEqual(stableId('a'), stableId('b'));
});

test('unchanged reminders are not rescheduled', () => {
  const scheduled = buildNotifications({ now, tz: TZ, plan, items, state: enabled(['critical', 'shabbat']), remaining: 2 });
  const previous = scheduleRecord(scheduled);
  const unchanged = diffSchedule(previous, scheduled);
  assert.deepEqual(unchanged.toSchedule, []);
  assert.deepEqual(unchanged.toCancel, []);
});

test('a location or calendar change reschedules affected reminders and drops stale ones', () => {
  const original = buildNotifications({ now, tz: TZ, plan, items, state: enabled(['critical']), remaining: 2 });
  const previous = scheduleRecord(original);

  const movedItems = [
    { category: 'candles', date: '2026-09-25T17:42:00+03:00' },
    { category: 'havdalah', date: '2026-09-26T18:40:00+03:00' },
  ];
  const movedPlan = { ...plan, candles: movedItems[0].date, havdalah: movedItems[1].date };
  const updated = buildNotifications({ now, tz: TZ, plan: movedPlan, items: movedItems, state: enabled(['critical']), remaining: 2 });

  const { toSchedule, toCancel } = diffSchedule(previous, updated);
  assert.ok(toSchedule.length > 0, 'the new times are scheduled');
  assert.ok(toCancel.length > 0, 'the stale times are cancelled');

  const removedAll = diffSchedule(previous, []);
  assert.deepEqual(removedAll.toSchedule, []);
  assert.equal(removedAll.toCancel.length, Object.keys(previous).length);
});
