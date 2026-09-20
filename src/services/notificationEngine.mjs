// Pure scheduling logic. The Capacitor bridge consumes this and never re-derives times.
import { zonedTimeToInstant } from './travelPlan.mjs';

const MINUTE = 60000;

export function stableId(key) {
  let hash = 5381;
  for (let index = 0; index < key.length; index += 1) {
    hash = ((hash << 5) + hash + key.charCodeAt(index)) | 0;
  }
  // Capacitor requires a positive 32-bit integer.
  return Math.abs(hash) % 2147483647 || 1;
}

function iso(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function timeLabel(value, tz) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('he-IL', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  } catch { return ''; }
}

function entry({ key, category, at, title, body }) {
  const when = iso(at);
  if (!when || !title) return null;
  return { key, id: stableId(key), category, at: when, title, body: body || '' };
}

/**
 * Restful windows are derived from the real candle lighting and havdalah events so
 * the app never schedules its own reminders once Shabbat or Yom Tov has begun.
 */
export function restWindows(items = []) {
  const windows = [];
  const candles = items.filter(item => item.category === 'candles' && item.date).sort((a, b) => a.date.localeCompare(b.date));
  const havdalah = items.filter(item => item.category === 'havdalah' && item.date).sort((a, b) => a.date.localeCompare(b.date));
  for (const start of candles) {
    const end = havdalah.find(item => item.date > start.date);
    const startISO = iso(start.date);
    if (!startISO) continue;
    windows.push({ start: startISO, end: iso(end?.date) });
  }
  return windows;
}

export function isDuringRest(at, windows) {
  const value = iso(at);
  if (!value) return false;
  return windows.some(window => value >= window.start && (!window.end || value < window.end));
}

function reminderTime(reminder, candles, tz) {
  if (!reminder || !candles) return null;
  const candleTime = new Date(candles);
  if (reminder.preset === 'two-hours') return new Date(candleTime.getTime() - 2 * 60 * MINUTE);
  if (reminder.preset === 'one-hour') return new Date(candleTime.getTime() - 60 * MINUTE);
  if (reminder.preset === 'morning') {
    const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(candleTime);
    return zonedTimeToInstant(dateKey, '09:00', tz);
  }
  if (reminder.preset === 'custom' && reminder.customAt) {
    const [dateKey, timeText] = String(reminder.customAt).split('T');
    return zonedTimeToInstant(dateKey, timeText, tz);
  }
  return null;
}

function groupedTaskNotifications({ plan, state, pendingTasks, tz }) {
  if (!plan?.candles || !state?.notifications?.categories?.shabbat) return [];
  const groups = new Map();
  for (const task of pendingTasks || []) {
    const at = reminderTime(state.taskReminders?.[task.id], plan.candles, tz);
    if (!at) continue;
    const key = at.toISOString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(task.title);
  }
  return [...groups.entries()].map(([at, titles]) => entry({
    key: `${plan.eventKey}:tasks:${at}`,
    category: 'shabbat',
    at,
    title: 'הכנות לשבת',
    body: `נשארו לך ${titles.length} הכנות: ${titles.join(', ')}.`,
  }));
}

export function buildNotifications({ now = new Date(), tz = 'UTC', plan = null, items = [], state = null, remaining = 0, pendingTasks = [] } = {}) {
  const preferences = state?.notifications;
  if (!preferences?.enabled || preferences.quietMode) return [];
  const categories = preferences.categories || {};
  const nowISO = iso(now);
  const planned = [];

  if (plan?.candles) {
    const candleTime = new Date(plan.candles);
    const label = timeLabel(plan.candles, tz);
    const eventName = plan.kind === 'holiday' ? plan.name : 'שבת';
    if (categories.critical) {
      planned.push(entry({
        key: `${plan.eventKey}:entry-40`,
        category: 'critical',
        at: new Date(candleTime.getTime() - 40 * MINUTE),
        title: `הערב מתחיל${plan.kind === 'holiday' ? ' ' + eventName : 'ה שבת'}`,
        body: `הדלקת נרות ב־${label}.${remaining > 0 ? ` נשארו ${remaining} משימות הכנה.` : ''}`,
      }));
    }
    if (categories.shabbat) {
      const names = pendingTasks.slice(0, 3).map(task => task.title);
      planned.push(entry({
        key: `${plan.eventKey}:prep-summary`,
        category: 'shabbat',
        at: new Date(candleTime.getTime() - 2 * 60 * MINUTE),
        title: `עוד שעתיים להדלקת נרות`,
        body: remaining > 0 ? `נשארו לך ${remaining} הכנות${names.length ? `: ${names.join(', ')}` : ''}.` : `הכול מוכן. הדלקת נרות ב־${label}.`,
      }));
    }
    if (categories.family && remaining > 0) {
      planned.push(entry({
        key: `${plan.eventKey}:family`,
        category: 'family',
        at: new Date(candleTime.getTime() - 26 * 60 * MINUTE),
        title: 'משימות הכנה במשפחה',
        body: `נשארו ${remaining} משימות לקראת ${eventName}.`,
      }));
    }
  }

  planned.push(...groupedTaskNotifications({ plan, state, pendingTasks, tz }));

  if (plan?.havdalah && categories.critical) {
    planned.push(entry({
      key: `${plan.eventKey}:exit`,
      category: 'critical',
      at: plan.havdalah,
      title: `צאת ${plan.kind === 'holiday' ? plan.name : 'השבת'}`,
      body: `לפי החישוב במיקום שהוגדר, ב־${timeLabel(plan.havdalah, tz)}.`,
    }));
  }

  const windows = restWindows(items);
  const seen = new Set();
  const grouped = new Map();
  for (const item of planned.filter(Boolean)) {
    const groupKey = `${item.category}:${item.at}`;
    if (item.category !== 'shabbat' || !grouped.has(groupKey)) grouped.set(groupKey, item);
    else {
      const existing = grouped.get(groupKey);
      const bodies = [existing.body, item.body].filter(Boolean);
      grouped.set(groupKey, { ...existing, body: [...new Set(bodies)].join(' ') });
    }
  }
  return planned
    .filter(Boolean)
    .filter(item => grouped.get(`${item.category}:${item.at}`) === item || grouped.get(`${item.category}:${item.at}`)?.key === item.key)
    .map(item => grouped.get(`${item.category}:${item.at}`) || item)
    .filter(item => item.at > nowISO)
    .filter(item => !isDuringRest(item.at, windows))
    .filter(item => categories[item.category] === true)
    .filter(item => { if (seen.has(item.key)) return false; seen.add(item.key); return true; })
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** Returns only the changes required, so unchanged reminders are never re-scheduled. */
export function diffSchedule(previous = {}, next = []) {
  const nextByKey = new Map(next.map(item => [item.key, item]));
  const toSchedule = next.filter(item => {
    const existing = previous[item.key];
    return !existing || existing.at !== item.at || existing.title !== item.title || existing.body !== item.body;
  });
  const toCancel = Object.entries(previous)
    .filter(([key, item]) => {
      const replacement = nextByKey.get(key);
      if (!replacement) return true;
      return replacement.at !== item.at || replacement.title !== item.title || replacement.body !== item.body;
    })
    .map(([, item]) => item.id);
  return { toSchedule, toCancel };
}

export function scheduleRecord(notifications = []) {
  return Object.fromEntries(notifications.map(item => [item.key, { id: item.id, at: item.at, title: item.title, body: item.body }]));
}
