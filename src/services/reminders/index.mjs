// תזכורות — the one entry point for the UI and the app shell: reconcile the OS's pending notifications with the saved
// reminders (launch, return to the app, a change of location / zmanim settings, every edit), and open the right screen
// when a notification is tapped. Local notifications only (@capacitor/local-notifications); nothing leaves the device.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { alarmContext, contextSignature } from '../jewishAlarm/engine.mjs';
import { platformAdapter } from '../jewishAlarm/platform.mjs';
import { stableId } from '../notificationEngine.mjs';
import { applySchedule, notificationPermissionState, requestNotificationPermission } from '../notifications.mjs';
import { loadMemorials } from '../memorialStore.mjs';
import { remindersBudget } from '../notificationBudget.mjs';
import { planReminders } from './plan.mjs';
import { loadReminders, updateReminders } from './store.mjs';
import { parseDeepLink } from './deepLinks.mjs';

export * from './store.mjs';
export * from './smart.mjs';
export * from './hebrewDates.mjs';
export { planReminders, eventReminders, smartReminders, beforeRest, leadWord } from './plan.mjs';
export { parseDeepLink, PRAYER_TARGETS, REMINDER_TAP_EVENT } from './deepLinks.mjs';

const platformOf = () => { try { return Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web'; } catch { return 'web'; } };
const anyEnabled = state => Object.values(state.smart).some(item => item?.enabled) || state.events.some(entry => entry.enabled !== false && (entry.eve?.enabled || entry.day?.enabled));

let chain = Promise.resolve();

/** Bring the pending notifications in line with the reminders. `ask`: may request permission (explicit user action only). */
export function syncReminders(settings, { ask = false, now = new Date() } = {}) {
  const run = async () => {
    const state = loadReminders();
    const platform = platformOf();
    const ctx = alarmContext(settings);
    let alarmEngine = null;
    try { alarmEngine = (await platformAdapter()).engine; } catch { /* no bridge */ }
    const budget = remindersBudget(platform, alarmEngine);
    const wants = anyEnabled(state);
    const plan = planReminders(state, ctx, { now, budget, memorials: loadMemorials() }).map(item => ({ ...item, id: stableId(item.key) }));
    let permission = platform === 'web' ? 'unsupported' : await notificationPermissionState();
    if (platform !== 'web' && wants && ask && permission !== 'granted' && permission !== 'denied') permission = await requestNotificationPermission();
    let schedule = state.schedule;
    let error = null;
    if (platform === 'web') schedule = {};
    else if (permission === 'granted' || !wants) {
      const result = await applySchedule(state.schedule, permission === 'granted' ? plan : []);
      if (result.applied) schedule = result.scheduled; else error = 'bridge';
    }
    const last = Object.values(schedule).map(item => item.at).sort().at(-1) || null;
    return updateReminders(current => ({ ...current, schedule, permission, platform, budget, error, horizonEnd: last, lastReconciledAt: new Date(now).toISOString(), contextSignature: ctx.valid ? contextSignature(ctx) : current.contextSignature }));
  };
  chain = chain.then(run, run);
  return chain;
}

// The target of a tapped notification: a reminder's own route, or (for a נר זיכרון reminder) its memorial.
export function targetOfNotification(notification) {
  const extra = notification?.extra || {};
  if (extra.route) return parseDeepLink(extra.route);
  const memorial = /^memorial:([^:]+):/.exec(String(extra.key || ''));
  if (extra.category === 'memorial' && memorial) return parseDeepLink(`personal-tools/memorial/${encodeURIComponent(memorial[1])}`);
  return null;
}

/** Listen for taps on the app's notifications; `open(target)` receives { kind: 'prayer', prayer } or { kind: 'route', route }. */
export function onReminderTap(open) {
  if (platformOf() === 'web') return () => {};
  let handle = null;
  let removed = false;
  try {
    LocalNotifications.addListener('localNotificationActionPerformed', event => {
      const target = targetOfNotification(event?.notification);
      if (target) open(target);
    }).then(result => { handle = result; if (removed) result.remove(); }).catch(() => {});
  } catch { /* no plugin in this build */ }
  return () => { removed = true; handle?.remove?.(); };
}
