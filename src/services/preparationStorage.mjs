// Versioned Phase 2 household store. Never reuses existing settings/learning keys.
export const PREPARATION_STORAGE_KEY = 'kz-preparation-v1';
export const SCHEMA_VERSION = 1;

export const NOTIFICATION_CATEGORIES = Object.freeze([
  { id: 'critical', label: 'קריטיות בלבד', description: 'כניסת שבת וחג וזמנים שאין להחמיצם', defaultOn: true },
  { id: 'prayer', label: 'תפילה ומצוות', description: 'תוספות בתפילה, הלל, ספירת העומר', defaultOn: false },
  { id: 'shabbat', label: 'שבת וחגים', description: 'תזכורות הכנה לשבת ולחג', defaultOn: false },
  { id: 'family', label: 'משפחה והכנות', description: 'משימות, קניות ואורחים', defaultOn: false },
  { id: 'learning', label: 'לימוד', description: 'תזכורות ללימוד יומי', defaultOn: false },
  { id: 'community', label: 'קהילה', description: 'מניין ואירועי קהילה', defaultOn: false },
]);

const EMPTY = Object.freeze({
  version: SCHEMA_VERSION,
  tasks: {},
  disabledDefaults: {},
  customTasks: [],
  taskReminders: {},
  household: [],
  shopping: [],
  guests: [],
  menu: {},
  notifications: {
    enabled: false,
    permissionRequested: false,
    quietMode: false,
    reminderTimes: [],
    reminderTopics: [],
    customReminderAt: null,
    categories: Object.fromEntries(NOTIFICATION_CATEGORIES.map(category => [category.id, category.defaultOn])),
  },
  scheduled: {},
});

const clone = value => JSON.parse(JSON.stringify(value));
const array = value => (Array.isArray(value) ? value : []);
const record = value => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

function defaultStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

// Unknown or newer versions fall back to defaults instead of throwing at import time.
export function migrate(raw) {
  const base = clone(EMPTY);
  if (!raw || typeof raw !== 'object') return base;
  const version = Number(raw.version);
  if (!Number.isFinite(version) || version < 1 || version > SCHEMA_VERSION) return base;
  const notifications = record(raw.notifications);
  return {
    version: SCHEMA_VERSION,
    tasks: record(raw.tasks),
    disabledDefaults: record(raw.disabledDefaults),
    customTasks: array(raw.customTasks),
    taskReminders: record(raw.taskReminders),
    household: array(raw.household),
    shopping: array(raw.shopping),
    guests: array(raw.guests),
    menu: record(raw.menu),
    notifications: {
      enabled: notifications.enabled === true,
      permissionRequested: notifications.permissionRequested === true,
      quietMode: notifications.quietMode === true,
      reminderTimes: (Array.isArray(notifications.reminderTimes)
        ? notifications.reminderTimes
        : record(notifications.categories).shabbat === true ? ['two-hours'] : [])
        .filter(value => ['morning', 'two-hours', 'one-hour', 'custom'].includes(value)),
      reminderTopics: array(notifications.reminderTopics).filter(value => ['candles', 'plata', 'electricity', 'home', 'family', 'spiritual'].includes(value)),
      customReminderAt: typeof notifications.customReminderAt === 'string' ? notifications.customReminderAt : null,
      categories: {
        ...base.notifications.categories,
        ...Object.fromEntries(Object.entries(record(notifications.categories)).map(([key, value]) => [key, value === true])),
      },
    },
    scheduled: record(raw.scheduled),
  };
}

export function loadPreparation(storage = defaultStorage()) {
  try { return migrate(JSON.parse(storage?.getItem(PREPARATION_STORAGE_KEY) || 'null')); }
  catch { return clone(EMPTY); }
}

export function savePreparation(state, storage = defaultStorage()) {
  const next = migrate(state);
  try { storage?.setItem(PREPARATION_STORAGE_KEY, JSON.stringify(next)); } catch { /* storage full or private mode */ }
  return next;
}

export function updatePreparation(updater, storage = defaultStorage()) {
  const current = loadPreparation(storage);
  const next = typeof updater === 'function' ? updater(current) : updater;
  return savePreparation(next, storage);
}

export function emptyPreparation() {
  return clone(EMPTY);
}

let counter = 0;
export function createId(prefix = 'item') {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function setTaskCompletion(state, eventKey, taskId, completed) {
  if (!eventKey || !taskId) return state;
  const forEvent = { ...record(state.tasks)[eventKey] };
  if (completed) forEvent[taskId] = true; else delete forEvent[taskId];
  return { ...state, tasks: { ...state.tasks, [eventKey]: forEvent } };
}

export function isTaskComplete(state, eventKey, taskId) {
  return record(record(state.tasks)[eventKey])[taskId] === true;
}

export function setDefaultTaskDisabled(state, taskId, disabled) {
  const disabledDefaults = { ...record(state.disabledDefaults) };
  if (disabled) disabledDefaults[taskId] = true; else delete disabledDefaults[taskId];
  return { ...state, disabledDefaults };
}

export function restoreDefaults(state) {
  return { ...state, disabledDefaults: {} };
}

export function addCustomTask(state, task) {
  const title = String(task?.title || '').trim();
  if (!title) return state;
  const entry = {
    id: createId('task'),
    title,
    assignee: task.assignee || null,
    due: task.due || null,
    scope: task.scope || 'shabbat',
    group: task.group || 'family',
    recurring: task.recurring === true,
  };
  return { ...state, customTasks: [...array(state.customTasks), entry] };
}

export function removeCustomTask(state, taskId) {
  const taskReminders = { ...record(state.taskReminders) };
  delete taskReminders[taskId];
  return { ...state, customTasks: array(state.customTasks).filter(task => task.id !== taskId), taskReminders };
}

export function renameCustomTask(state, taskId, title) {
  const value = String(title || '').trim();
  if (!value) return state;
  return { ...state, customTasks: array(state.customTasks).map(task => (task.id === taskId ? { ...task, title: value } : task)) };
}

export function setTaskReminder(state, taskId, preset, customAt = null) {
  if (!taskId) return state;
  const taskReminders = { ...record(state.taskReminders) };
  if (!preset || preset === 'none') delete taskReminders[taskId];
  else taskReminders[taskId] = { preset, customAt: customAt || null };
  return { ...state, taskReminders };
}

export function moveCustomTask(state, taskId, offset) {
  const tasks = [...array(state.customTasks)];
  const index = tasks.findIndex(task => task.id === taskId);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= tasks.length) return state;
  [tasks[index], tasks[target]] = [tasks[target], tasks[index]];
  return { ...state, customTasks: tasks };
}

export function assignTask(state, taskId, assignee) {
  return {
    ...state,
    customTasks: array(state.customTasks).map(task => (task.id === taskId ? { ...task, assignee: assignee || null } : task)),
  };
}

export function addHouseholdMember(state, name) {
  const label = String(name || '').trim();
  if (!label) return state;
  if (array(state.household).some(member => member.name === label)) return state;
  return { ...state, household: [...array(state.household), { id: createId('member'), name: label }] };
}

export function removeHouseholdMember(state, memberId) {
  return {
    ...state,
    household: array(state.household).filter(member => member.id !== memberId),
    customTasks: array(state.customTasks).map(task => (task.assignee === memberId ? { ...task, assignee: null } : task)),
  };
}

export function addShoppingItem(state, item) {
  const name = String(item?.name || '').trim();
  if (!name) return state;
  const entry = { id: createId('shop'), name, note: String(item.note || '').trim(), category: item.category || null, purchased: false };
  return { ...state, shopping: [...array(state.shopping), entry] };
}

export function toggleShoppingItem(state, itemId) {
  return {
    ...state,
    shopping: array(state.shopping).map(item => (item.id === itemId ? { ...item, purchased: !item.purchased } : item)),
  };
}

export function removeShoppingItem(state, itemId) {
  return { ...state, shopping: array(state.shopping).filter(item => item.id !== itemId) };
}

export function clearPurchased(state) {
  return { ...state, shopping: array(state.shopping).filter(item => !item.purchased) };
}

export function addGuest(state, guest) {
  const name = String(guest?.name || '').trim();
  if (!name) return state;
  const entry = { id: createId('guest'), name, meal: guest.meal || 'ליל שבת', note: String(guest.note || '').trim() };
  return { ...state, guests: [...array(state.guests), entry] };
}

export function removeGuest(state, guestId) {
  return { ...state, guests: array(state.guests).filter(guest => guest.id !== guestId) };
}

export function setMenuItems(state, sectionId, items) {
  return { ...state, menu: { ...record(state.menu), [sectionId]: array(items).map(item => String(item)) } };
}

export function addMenuItem(state, sectionId, text) {
  const value = String(text || '').trim();
  if (!value) return state;
  const current = array(record(state.menu)[sectionId]);
  return setMenuItems(state, sectionId, [...current, value]);
}

export function removeMenuItem(state, sectionId, index) {
  const current = array(record(state.menu)[sectionId]);
  return setMenuItems(state, sectionId, current.filter((_, position) => position !== index));
}

export function setNotificationsEnabled(state, enabled) {
  return { ...state, notifications: { ...state.notifications, enabled: enabled === true } };
}

export function markPermissionRequested(state) {
  return { ...state, notifications: { ...state.notifications, permissionRequested: true } };
}

export function setQuietMode(state, quiet) {
  return { ...state, notifications: { ...state.notifications, quietMode: quiet === true } };
}

export function setPreparationReminderTime(state, reminderId, selected) {
  const values = new Set(array(state.notifications?.reminderTimes));
  if (selected) values.add(reminderId); else values.delete(reminderId);
  return { ...state, notifications: { ...state.notifications, reminderTimes: [...values] } };
}

export function setPreparationReminderTopic(state, topicId, selected) {
  const values = new Set(array(state.notifications?.reminderTopics));
  if (selected) values.add(topicId); else values.delete(topicId);
  return { ...state, notifications: { ...state.notifications, reminderTopics: [...values] } };
}

export function setCustomPreparationReminder(state, customAt) {
  return { ...state, notifications: { ...state.notifications, customReminderAt: customAt || null } };
}

export function setNotificationCategory(state, categoryId, enabled) {
  if (!NOTIFICATION_CATEGORIES.some(category => category.id === categoryId)) return state;
  return {
    ...state,
    notifications: {
      ...state.notifications,
      categories: { ...state.notifications.categories, [categoryId]: enabled === true },
    },
  };
}
