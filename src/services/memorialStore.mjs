// "נר זיכרון" — the private records on the device and the native reminders that follow them. The names never leave
// the device: localStorage only, no network, no logging. Reminders go through the app's one notification bridge
// (services/notifications.mjs): reconciled against what was scheduled before, so an edit reschedules, a delete
// cancels, and repeated launches never duplicate.
import { HDate } from '@hebcal/core';
import { parseStore, serializeStore, reminderSchedule, STORAGE_KEY, SCHEDULE_KEY } from './memorialYahrzeit.mjs';
import { stableId } from './notificationEngine.mjs';
import { applySchedule, notificationPermissionState, requestNotificationPermission } from './notifications.mjs';
import { Capacitor } from '@capacitor/core';
import { memorialBudget } from './notificationBudget.mjs';

export const MEMORIAL_CHANGE_EVENT = 'kz-memorials-changed';

export function loadMemorials() {
  try { return parseStore(localStorage.getItem(STORAGE_KEY)); } catch { return []; }
}

export function saveMemorials(memorials) {
  try { localStorage.setItem(STORAGE_KEY, serializeStore(memorials)); } catch { /* storage full or blocked */ }
  try { window.dispatchEvent(new Event(MEMORIAL_CHANGE_EVENT)); } catch { /* not in a browser */ }
}

const loadScheduled = () => { try { return JSON.parse(localStorage.getItem(SCHEDULE_KEY) || '{}') || {}; } catch { return {}; } };
const saveScheduled = value => { try { localStorage.setItem(SCHEDULE_KEY, JSON.stringify(value)); } catch { /* ignore */ } };

export const newMemorialId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// Bring the native pending reminders in line with the records. `ask`: may request permission (only from an explicit
// user action — saving a memorial with a reminder); on launch / resume it never asks.
export async function reconcileMemorialReminders({ ask = false, now = new Date() } = {}) {
  const memorials = loadMemorials();
  // Within its share of the platform's pending limit (services/notificationBudget.mjs), the soonest first.
  let platform = 'web';
  try { platform = Capacitor.getPlatform(); } catch { /* not native */ }
  const wanted = reminderSchedule(memorials, new HDate(now), { now, limit: memorialBudget(platform) }).map(item => ({ ...item, id: stableId(item.key) }));
  let permission = await notificationPermissionState();
  if (wanted.length && ask && permission !== 'granted' && permission !== 'denied' && permission !== 'unsupported') permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    // Nothing can be scheduled: keep the records, cancel nothing that the system does not hold anyway.
    return { permission, scheduled: 0, wanted: wanted.length };
  }
  const result = await applySchedule(loadScheduled(), wanted);
  if (result.applied) saveScheduled(result.scheduled);
  return { permission, scheduled: result.applied ? wanted.length : 0, wanted: wanted.length };
}
