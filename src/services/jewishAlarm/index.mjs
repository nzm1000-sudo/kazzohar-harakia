// השעון היהודי — the one entry point for the UI and the app shell.
import { platformAdapter } from './platform.mjs';
import { reconcileAlarms } from './scheduler.mjs';

export { ANCHORS, ANCHOR_GROUPS, anchorOf, CHANUKAH_RULE } from './anchors.mjs';
export { alarmContext, resolveJewishAlarm, zonedInstant, civilKeyOf, wallTimeText, ERRORS } from './engine.mjs';
export { blankRule, normalizeRule, draftProblem, findDuplicate, isEventRule, QUICK_OFFSETS, SNOOZES, SOUNDS, WORK_WEEK, ALL_DAYS } from './model.mjs';
export { occurrencesFor, nextOccurrence, getNextAlarm, previewDays, livePreview } from './occurrences.mjs';
export { loadAlarmState, saveAlarmState, upsertRule, deleteRule, setRuleEnabled, clearNotice, ALARM_CHANGE_EVENT, STORE_KEY } from './store.mjs';
export * from './format.mjs';
export { platformAdapter };

// Reconcile the native registrations with the rules. `ask` only from an explicit user action (save / enable).
export async function syncJewishAlarms(settings, { ask = false } = {}) {
  const adapter = await platformAdapter();
  return reconcileAlarms({ settings, adapter, ask });
}
