import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HOLIDAY_TEMPLATES, SHABBAT_TASKS, activePreparation, daysBetween, needsEruvTavshilin,
  nextHoliday, remainingCount, tasksForWindow, templateForEvent, visibleTasks, windowFor,
} from '../src/services/preparationPlan.mjs';
import { addCustomTask, emptyPreparation, setDefaultTaskDisabled, setTaskCompletion } from '../src/services/preparationStorage.mjs';

const TZ = 'Asia/Jerusalem';

// 2026-09-23 is a Wednesday; the upcoming Shabbat is 2026-09-26.
const wednesday = new Date('2026-09-23T09:00:00Z');
const monday = new Date('2026-09-21T09:00:00Z');

const calendar = [
  { category: 'candles', date: '2026-09-25T18:12:00+03:00' },
  { category: 'havdalah', date: '2026-09-26T19:10:00+03:00' },
];

test('Shabbat preparation activates inside the three day window only', () => {
  const active = activePreparation({ now: wednesday, tz: TZ, items: calendar });
  assert.equal(active.kind, 'shabbat');
  assert.equal(active.dateKey, '2026-09-26');
  assert.equal(active.window, 3);
  assert.equal(active.candles, '2026-09-25T18:12:00+03:00');
  assert.equal(active.havdalah, '2026-09-26T19:10:00+03:00');

  const early = activePreparation({ now: monday, tz: TZ, items: [] });
  assert.equal(early.kind, 'shabbat');
  assert.equal(early.window, 7, 'five days out opens the week-ahead window');
  assert.deepEqual(early.tasks.map(task => task.id), ['shabbat-guests'], 'only week-ahead items appear early');
});

test('preparation windows escalate as the event approaches', () => {
  assert.equal(windowFor(0, false), 0);
  assert.equal(windowFor(1, false), 1);
  assert.equal(windowFor(3, false), 3);
  assert.equal(windowFor(7, false), 7);
  assert.equal(windowFor(30, true), 30);
  assert.equal(windowFor(30, false), null, 'minor events do not open a 30 day window');
  assert.equal(windowFor(45, true), null);
  assert.equal(windowFor(-1, true), null);
});

test('only window-appropriate tasks are shown', () => {
  const thirtyDays = tasksForWindow(HOLIDAY_TEMPLATES.pesach.tasks, 30);
  const dayBefore = tasksForWindow(HOLIDAY_TEMPLATES.pesach.tasks, 1);
  assert.ok(thirtyDays.every(task => task.window >= 30), 'a month out shows only high level items');
  assert.ok(thirtyDays.some(task => task.id === 'pesach-cleaning'));
  assert.ok(!thirtyDays.some(task => task.id === 'pesach-bedika'), 'time sensitive items are withheld');
  assert.ok(dayBefore.some(task => task.id === 'pesach-bedika'));
  assert.ok(dayBefore.length > thirtyDays.length);
});

test('holiday templates are matched from calendar titles', () => {
  assert.equal(templateForEvent('Pesach I', 'פסח').id, 'pesach');
  assert.equal(templateForEvent('Sukkot I', 'סוכות').id, 'sukkot');
  assert.equal(templateForEvent('Chanukah: 1 Candle', 'חנוכה').id, 'chanukah');
  assert.equal(templateForEvent('Rosh Hashana 5787', 'ראש השנה').id, 'rosh-hashana');
  assert.equal(templateForEvent('Some Random Day', ''), null);
});

test('an upcoming major festival takes priority over the weekly Shabbat', () => {
  const items = [
    ...calendar,
    { category: 'holiday', subcat: 'major', date: '2026-09-25', title: 'Sukkot I', hebrew: 'סוכות' },
  ];
  const active = activePreparation({ now: wednesday, tz: TZ, items });
  assert.equal(active.kind, 'holiday');
  assert.equal(active.templateId, 'sukkot');
  assert.equal(active.eventKey, 'holiday:sukkot:2026-09-25');
});

test('eruv tavshilin is only offered when a festival runs into Shabbat', () => {
  assert.equal(needsEruvTavshilin('2026-09-24'), true, 'Thursday festival');
  assert.equal(needsEruvTavshilin('2026-09-23'), false, 'Wednesday festival');
  const items = [{ category: 'holiday', date: '2026-09-24', title: 'Sukkot I', hebrew: 'סוכות' }];
  const active = activePreparation({ now: wednesday, tz: TZ, items });
  assert.ok(active.tasks.some(task => task.id === 'eruv-tavshilin'));
});

test('remaining count reflects completions, custom tasks and hidden defaults', () => {
  const plan = activePreparation({ now: wednesday, tz: TZ, items: calendar });
  let state = emptyPreparation();
  const total = visibleTasks(plan, state).length;
  assert.equal(remainingCount(plan, state), total);

  state = setTaskCompletion(state, plan.eventKey, 'shabbat-candles', true);
  assert.equal(remainingCount(plan, state), total - 1);

  state = setDefaultTaskDisabled(state, 'shabbat-cooking', true);
  assert.equal(remainingCount(plan, state), total - 2);

  state = addCustomTask(state, { title: 'פרחים', scope: 'shabbat' });
  assert.equal(remainingCount(plan, state), total - 1);
});

test('custom tasks are scoped to their event', () => {
  const plan = activePreparation({ now: wednesday, tz: TZ, items: calendar });
  const state = addCustomTask(emptyPreparation(), { title: 'מצות', scope: 'pesach' });
  assert.ok(!visibleTasks(plan, state).some(task => task.title === 'מצות'));
});

test('day counting and next holiday selection are deterministic', () => {
  assert.equal(daysBetween('2026-09-23', '2026-09-26'), 3);
  assert.equal(daysBetween('2026-09-26', '2026-09-23'), -3);
  const items = [
    { category: 'holiday', date: '2026-12-25', title: 'Chanukah', hebrew: 'חנוכה' },
    { category: 'holiday', date: '2026-10-02', title: 'Sukkot I', hebrew: 'סוכות' },
  ];
  assert.equal(nextHoliday(items, '2026-09-23').template.id, 'sukkot');
  assert.equal(nextHoliday(items, '2026-10-03').template.id, 'chanukah');
  assert.equal(nextHoliday([], '2026-09-23'), null);
});

test('the default Shabbat checklist covers the expected household items', () => {
  const ids = SHABBAT_TASKS.map(task => task.id);
  for (const expected of ['shabbat-candles', 'shabbat-wine', 'shabbat-challot', 'shabbat-cooking', 'shabbat-plata', 'shabbat-timers', 'shabbat-clothes', 'shabbat-minyan', 'shabbat-guests', 'shabbat-children']) {
    assert.ok(ids.includes(expected), `missing ${expected}`);
  }
});
