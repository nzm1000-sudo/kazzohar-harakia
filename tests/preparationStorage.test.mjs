import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  NOTIFICATION_CATEGORIES, PREPARATION_STORAGE_KEY, addCustomTask, addGuest, addHouseholdMember,
  addMenuItem, addShoppingItem, assignTask, emptyPreparation, isTaskComplete, loadPreparation,
  migrate, moveCustomTask, removeGuest, removeHouseholdMember, removeShoppingItem, renameCustomTask, restoreDefaults,
  savePreparation, setDefaultTaskDisabled, setNotificationCategory, setNotificationsEnabled,
  setQuietMode, setTaskCompletion, setTaskReminder, toggleShoppingItem,
} from '../src/services/preparationStorage.mjs';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
    raw: map,
  };
}

test('preparation storage starts empty with conservative notification defaults', () => {
  const storage = memoryStorage();
  const state = loadPreparation(storage);
  assert.equal(state.notifications.enabled, false);
  assert.equal(state.notifications.permissionRequested, false);
  assert.equal(state.notifications.categories.critical, true);
  const optedIn = NOTIFICATION_CATEGORIES.filter(category => state.notifications.categories[category.id]);
  assert.equal(optedIn.length, 1, 'only the critical category is on by default');
});

test('task completion and custom tasks persist across reloads', () => {
  const storage = memoryStorage();
  let state = loadPreparation(storage);
  state = setTaskCompletion(state, 'shabbat:2026-09-26', 'shabbat-candles', true);
  state = addCustomTask(state, { title: 'לקנות פרחים', scope: 'shabbat' });
  savePreparation(state, storage);

  const reloaded = loadPreparation(storage);
  assert.equal(isTaskComplete(reloaded, 'shabbat:2026-09-26', 'shabbat-candles'), true);
  assert.equal(reloaded.customTasks.length, 1);
  assert.equal(reloaded.customTasks[0].title, 'לקנות פרחים');
});

test('household members can be assigned to tasks and removal clears the assignment', () => {
  let state = addHouseholdMember(emptyPreparation(), 'נועה');
  const memberId = state.household[0].id;
  state = addCustomTask(state, { title: 'עריכת שולחן' });
  const taskId = state.customTasks[0].id;
  state = assignTask(state, taskId, memberId);
  assert.equal(state.customTasks[0].assignee, memberId);

  state = removeHouseholdMember(state, memberId);
  assert.equal(state.household.length, 0);
  assert.equal(state.customTasks[0].assignee, null);
});

test('custom tasks can be reordered', () => {
  let state = addCustomTask(emptyPreparation(), { title: 'ראשונה' });
  state = addCustomTask(state, { title: 'שנייה' });
  const secondId = state.customTasks[1].id;
  state = moveCustomTask(state, secondId, -1);
  assert.deepEqual(state.customTasks.map(task => task.title), ['שנייה', 'ראשונה']);
  assert.equal(moveCustomTask(state, secondId, -1).customTasks[0].title, 'שנייה', 'moving past the edge is a no-op');
});

test('personal tasks can be renamed and carry optional reminders', () => {
  let state = addCustomTask(emptyPreparation(), { title: 'משימה שלי', group: 'spiritual' });
  const taskId = state.customTasks[0].id;
  state = renameCustomTask(state, taskId, 'לימוד לשבת');
  state = setTaskReminder(state, taskId, 'one-hour');
  assert.equal(state.customTasks[0].title, 'לימוד לשבת');
  assert.equal(state.customTasks[0].group, 'spiritual');
  assert.deepEqual(state.taskReminders[taskId], { preset: 'one-hour', customAt: null });
  state = setTaskReminder(state, taskId, 'none');
  assert.equal(state.taskReminders[taskId], undefined);
});

test('default tasks can be disabled per household and restored', () => {
  let state = setDefaultTaskDisabled(emptyPreparation(), 'shabbat-plata', true);
  assert.equal(state.disabledDefaults['shabbat-plata'], true);
  state = restoreDefaults(state);
  assert.deepEqual(state.disabledDefaults, {});
});

test('shopping list persists, toggles and deletes', () => {
  const storage = memoryStorage();
  let state = addShoppingItem(loadPreparation(storage), { name: 'חלות', note: '2' });
  const itemId = state.shopping[0].id;
  state = toggleShoppingItem(state, itemId);
  savePreparation(state, storage);

  const reloaded = loadPreparation(storage);
  assert.equal(reloaded.shopping[0].purchased, true);
  assert.equal(reloaded.shopping[0].note, '2');
  assert.equal(removeShoppingItem(reloaded, itemId).shopping.length, 0);
});

test('guest list persists and never requires contacts data', () => {
  const storage = memoryStorage();
  let state = addGuest(loadPreparation(storage), { name: 'משפחת לוי', meal: 'ליל שבת', note: 'ללא גלוטן' });
  savePreparation(state, storage);
  const reloaded = loadPreparation(storage);
  assert.equal(reloaded.guests.length, 1);
  assert.equal(reloaded.guests[0].meal, 'ליל שבת');
  assert.equal(removeGuest(reloaded, reloaded.guests[0].id).guests.length, 0);
});

test('menu persists per section', () => {
  const storage = memoryStorage();
  let state = addMenuItem(loadPreparation(storage), 'friday-night', 'מרק');
  state = addMenuItem(state, 'day', 'חמין');
  savePreparation(state, storage);
  const reloaded = loadPreparation(storage);
  assert.deepEqual(reloaded.menu['friday-night'], ['מרק']);
  assert.deepEqual(reloaded.menu.day, ['חמין']);
});

test('notification preferences persist without granting permission', () => {
  const storage = memoryStorage();
  let state = setNotificationCategory(loadPreparation(storage), 'shabbat', true);
  state = setQuietMode(state, true);
  savePreparation(state, storage);
  const reloaded = loadPreparation(storage);
  assert.equal(reloaded.notifications.categories.shabbat, true);
  assert.equal(reloaded.notifications.quietMode, true);
  assert.equal(reloaded.notifications.enabled, false, 'enabling categories never enables delivery on its own');
  assert.equal(reloaded.notifications.permissionRequested, false);
});

test('migration ignores unknown versions and corrupt payloads without throwing', () => {
  assert.deepEqual(migrate(null).tasks, {});
  assert.deepEqual(migrate({ version: 99, guests: [{ name: 'x' }] }).guests, []);
  assert.deepEqual(migrate({ version: 1, guests: 'not-an-array' }).guests, []);
  assert.equal(migrate({ version: 1, notifications: { enabled: 'yes' } }).notifications.enabled, false);
});

test('version one household data remains intact while new fields default safely', () => {
  const legacy = migrate({
    version: 1,
    tasks: { 'shabbat:old': { 'shabbat-candles': true } },
    household: [{ id: 'member-1', name: 'נועה' }],
    shopping: [{ id: 'shop-1', name: 'חלות', purchased: false }],
    guests: [{ id: 'guest-1', name: 'משפחת לוי' }],
    menu: { day: ['חמין'] },
    notifications: { enabled: false, categories: { family: true } },
  });
  assert.equal(legacy.tasks['shabbat:old']['shabbat-candles'], true);
  assert.equal(legacy.household[0].name, 'נועה');
  assert.equal(legacy.shopping[0].name, 'חלות');
  assert.equal(legacy.guests[0].name, 'משפחת לוי');
  assert.deepEqual(legacy.menu.day, ['חמין']);
  assert.deepEqual(legacy.taskReminders, {});
  assert.equal(legacy.notifications.categories.family, true);
});

test('preparation storage uses its own key and does not touch existing settings', () => {
  const storage = memoryStorage();
  storage.setItem('companion-settings-v2', '{"keep":true}');
  savePreparation(setNotificationsEnabled(loadPreparation(storage), true), storage);
  assert.equal(storage.getItem('companion-settings-v2'), '{"keep":true}');
  assert.ok(storage.getItem(PREPARATION_STORAGE_KEY));
});
