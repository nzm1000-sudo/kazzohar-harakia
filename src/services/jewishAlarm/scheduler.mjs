// השעון היהודי — the platform scheduler. The engine gives absolute instants; this turns them into native registrations
// through an adapter (iOS AlarmKit, Android AlarmManager, the local-notification fallback, or none on the web).
// No halachic math happens natively: Swift and Kotlin/Java only receive { id, at, title, body }.
//
// Schedule ahead — how far, per platform (from the platforms' documented limits, never assumed to be unlimited):
//   • iOS AlarmKit: Apple documents no fixed maximum, but AlarmManager can refuse with maximumLimitReached. We keep
//     the nearest 48 across all rules (within 14 days) and trim further if the system refuses.
//   • iOS local notifications (iOS < 26 fallback): at most 64 pending per app (UNUserNotificationCenter), shared with
//     נר זיכרון and the meat–dairy timer → the nearest 36 within 7 days.
//   • Android AlarmManager: at most 500 pending alarms per app (API 31+) → the nearest 100 within 21 days.
// The horizon is refilled on every launch, return to the app, create / edit / delete, and change of location, time
// zone, residence or candle minutes (reconcileAlarms).
import { alarmContext, contextSignature } from './engine.mjs';
import { occurrencesFor } from './occurrences.mjs';
import { alarmNotice } from './format.mjs';
import { loadAlarmState, saveAlarmState } from './store.mjs';
import { anchorOf } from './anchors.mjs';

export const HORIZON = Object.freeze({
  alarmkit: { days: 14, budget: 48 },
  notifications: { days: 7, budget: 36 },
  android: { days: 21, budget: 100 },
  none: { days: 14, budget: 0 },
});

// A stable UUID-shaped id for an occurrence key (AlarmKit wants a UUID; the same key always gives the same id, so a
// reschedule replaces instead of duplicating).
export function occurrenceUuid(key) {
  const words = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b];
  for (let index = 0; index < key.length; index += 1) {
    const code = key.charCodeAt(index);
    for (let word = 0; word < 4; word += 1) words[word] = Math.imul(words[word] ^ (code + word * 131), 0x01000193 + word * 2) >>> 0;
  }
  const hex = words.map(word => word.toString(16).padStart(8, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`.toUpperCase();
}
// A positive 31-bit integer id for the local-notification fallback and Android request codes.
export function occurrenceNumber(key) {
  let hash = 5381;
  for (let index = 0; index < key.length; index += 1) hash = ((hash << 5) + hash + key.charCodeAt(index)) | 0;
  // Keep clear of the ids the rest of the app uses (stableId): a separate range from 1.9e9 upward is not needed —
  // the key includes the rule id, so collisions are negligible; 0 is never used.
  return (Math.abs(hash) % 2000000000) + 1;
}

// Everything that should be registered now: [{ key, id, number, ruleId, at, title, body, snoozeMinutes, sound, vibration, sig }].
export function planSchedule(rules, settingsOrContext, { now = new Date(), engine = 'alarmkit' } = {}) {
  const ctx = settingsOrContext?.valid === undefined ? alarmContext(settingsOrContext) : settingsOrContext;
  const horizon = HORIZON[engine] || HORIZON.alarmkit;
  if (!ctx.valid || !horizon.budget) return [];
  const all = [];
  for (const rule of rules || []) {
    if (!rule?.enabled) continue;
    for (const occurrence of occurrencesFor(rule, ctx, { now, days: horizon.days, limit: horizon.budget })) {
      const notice = alarmNotice(rule, occurrence, ctx.tz);
      const entry = {
        key: occurrence.key, id: engine === 'notifications' ? String(occurrenceNumber(occurrence.key)) : occurrenceUuid(occurrence.key), number: occurrenceNumber(occurrence.key), ruleId: rule.id,
        at: occurrence.at.toISOString(), title: notice.title, body: notice.body,
        snoozeMinutes: rule.snoozeMinutes, sound: rule.sound, vibration: rule.vibration !== false,
      };
      all.push({ ...entry, sig: [entry.at, entry.title, entry.body, entry.snoozeMinutes, entry.sound, entry.vibration].join('|') });
    }
  }
  // Never two registrations for the same key; nearest first within the platform's budget.
  const seen = new Set();
  return all.sort((a, b) => a.at.localeCompare(b.at)).filter(item => (seen.has(item.key) ? false : (seen.add(item.key), true))).slice(0, horizon.budget);
}

// What must change natively: cancel orphans and changed entries; schedule new, changed and missing ones.
export function diffNative(previous = {}, plan = [], registered = null) {
  const planByKey = new Map(plan.map(item => [item.key, item]));
  const planIds = new Set(plan.map(item => item.id));
  const cancel = new Set();
  for (const [key, item] of Object.entries(previous)) {
    const next = planByKey.get(key);
    if (!next || next.sig !== item.sig || next.id !== item.id) cancel.add(item.id);
  }
  // Registrations the app no longer wants (an old install, a crash between steps): removed.
  if (Array.isArray(registered)) for (const id of registered) if (!planIds.has(id)) cancel.add(id);
  const registeredSet = Array.isArray(registered) ? new Set(registered) : null;
  const schedule = plan.filter(item => {
    const before = previous[item.key];
    if (!before || before.sig !== item.sig || before.id !== item.id) return true;
    return registeredSet ? !registeredSet.has(item.id) : false; // repair a registration that went missing
  });
  for (const item of schedule) cancel.add(item.id); // replace, never add a second copy
  return { cancel: [...cancel], schedule };
}

// One reconciliation at a time (launch, resume and a save can arrive together).
let chain = Promise.resolve();

/**
 * Bring the native registrations in line with the rules. `ask`: may request the OS permission (only from an explicit
 * user action: saving or enabling an alarm). Returns the saved state.
 */
export function reconcileAlarms({ settings, adapter, now = new Date(), ask = false, storage } = {}) {
  const run = async () => {
    const state = loadAlarmState(storage);
    const ctx = alarmContext(settings);
    const signature = contextSignature(ctx);
    const hasJewish = state.rules.some(rule => rule.enabled && rule.mode === 'jewish');
    const moved = Boolean(state.contextSignature && ctx.valid && state.contextSignature !== signature && hasJewish);
    const engine = adapter?.engine || 'none';
    const plan = planSchedule(state.rules, ctx, { now, engine });
    let permission = 'unsupported';
    let error = null;
    let schedule = state.schedule;
    if (engine !== 'none' && adapter) {
      try {
        permission = await adapter.permission();
        const wants = state.rules.some(rule => rule.enabled);
        if (permission !== 'granted' && ask && wants) permission = await adapter.request();
        if (permission === 'granted') {
          const registered = await adapter.list().catch(() => null);
          const { cancel, schedule: toSchedule } = diffNative(state.schedule, plan, registered);
          if (cancel.length) await adapter.cancel(cancel);
          const result = toSchedule.length ? await adapter.schedule(toSchedule) : { scheduled: [] };
          const done = new Set(result?.scheduled || []);
          const failed = new Set(toSchedule.filter(item => !done.has(item.id)).map(item => item.id));
          schedule = Object.fromEntries(plan.filter(item => !failed.has(item.id)).map(item => [item.key, { id: item.id, at: item.at, title: item.title, body: item.body, sig: item.sig }]));
          if (failed.size) error = result?.limit ? 'limit' : 'partial';
        } else if (!state.rules.some(rule => rule.enabled)) {
          schedule = {};
        }
      } catch {
        error = 'bridge';
      }
    } else {
      schedule = {};
    }
    const nextByRule = new Map();
    for (const item of plan) if (!nextByRule.has(item.ruleId)) nextByRule.set(item.ruleId, item.at);
    const scheduledKeys = new Set(Object.keys(schedule));
    const rules = state.rules.map(rule => ({
      ...rule,
      nextOccurrence: nextByRule.get(rule.id) || null,
      platformScheduleState: !rule.enabled ? 'off' : engine === 'none' ? 'unsupported' : permission !== 'granted' ? permission : plan.some(item => item.ruleId === rule.id && scheduledKeys.has(item.key)) ? 'scheduled' : plan.some(item => item.ruleId === rule.id) ? 'failed' : 'idle',
      locationSnapshot: ctx.valid ? { name: ctx.location.name, latitude: ctx.location.latitude, longitude: ctx.location.longitude } : rule.locationSnapshot,
      timezone: ctx.valid ? ctx.tz : rule.timezone,
      calculationMethod: rule.mode === 'jewish' ? (anchorOf(rule.jewishAnchorId)?.method || null) : null,
    }));
    const last = Object.values(schedule).map(item => item.at).sort().at(-1) || null;
    return saveAlarmState({
      ...state, rules, schedule, permission, engine, error,
      contextSignature: ctx.valid ? signature : state.contextSignature,
      notice: moved ? 'זמני השעון עודכנו לפי המיקום החדש.' : state.notice,
      horizonEnd: last, lastReconciledAt: new Date(now).toISOString(),
    }, storage);
  };
  chain = chain.then(run, run);
  return chain;
}
