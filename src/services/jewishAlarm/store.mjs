// השעון היהודי — persistence. Everything stays on this device (localStorage): no server, no upload, no analytics.
// The native side keeps its own copy of what is registered (AlarmKit / AlarmManager survive restarts); this record
// is what the app believes it registered, so reconciliation can repair, replace and remove without duplicating.
import { normalizeRule } from './model.mjs';

export const STORE_KEY = 'kz-jewish-alarms-v1';
export const ALARM_CHANGE_EVENT = 'kz-jewish-alarms-change';

const empty = () => ({ version: 1, rules: [], schedule: {}, contextSignature: null, notice: null, permission: null, engine: null, horizonEnd: null, lastReconciledAt: null, error: null });

export function parseAlarmState(text) {
  let raw;
  try { raw = JSON.parse(text || 'null'); } catch { raw = null; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return empty();
  const rules = (Array.isArray(raw.rules) ? raw.rules : []).map(rule => normalizeRule(rule)).filter(Boolean)
    .filter((rule, index, list) => list.findIndex(other => other.id === rule.id) === index);
  const schedule = {};
  for (const [key, item] of Object.entries(raw.schedule && typeof raw.schedule === 'object' ? raw.schedule : {})) {
    if (item && typeof item === 'object' && typeof item.id === 'string' && typeof item.at === 'string') schedule[key] = { id: item.id, at: item.at, title: String(item.title || ''), body: String(item.body || ''), sig: String(item.sig || '') };
  }
  return {
    ...empty(),
    rules,
    schedule,
    contextSignature: typeof raw.contextSignature === 'string' ? raw.contextSignature : null,
    notice: typeof raw.notice === 'string' ? raw.notice : null,
    permission: typeof raw.permission === 'string' ? raw.permission : null,
    engine: typeof raw.engine === 'string' ? raw.engine : null,
    horizonEnd: typeof raw.horizonEnd === 'string' ? raw.horizonEnd : null,
    lastReconciledAt: typeof raw.lastReconciledAt === 'string' ? raw.lastReconciledAt : null,
    error: typeof raw.error === 'string' ? raw.error : null,
  };
}

const defaultStorage = () => { try { return globalThis.localStorage || null; } catch { return null; } };

export function loadAlarmState(storage = defaultStorage()) {
  try { return parseAlarmState(storage?.getItem(STORE_KEY)); } catch { return empty(); }
}

export function saveAlarmState(state, storage = defaultStorage()) {
  const next = parseAlarmState(JSON.stringify(state));
  try { storage?.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* storage full or unavailable: keep the session copy */ }
  try { globalThis.dispatchEvent?.(new CustomEvent(ALARM_CHANGE_EVENT)); } catch { /* not in a browser */ }
  return next;
}

export function updateAlarmState(change, storage = defaultStorage()) {
  const current = loadAlarmState(storage);
  return saveAlarmState(change(current) || current, storage);
}

export function upsertRule(rule, storage = defaultStorage()) {
  const clean = normalizeRule({ ...rule, updatedAt: new Date().toISOString() });
  if (!clean) return loadAlarmState(storage);
  return updateAlarmState(state => {
    const index = state.rules.findIndex(item => item.id === clean.id);
    const rules = index < 0 ? [...state.rules, clean] : state.rules.map(item => (item.id === clean.id ? { ...clean, createdAt: item.createdAt } : item));
    return { ...state, rules };
  }, storage);
}

export function deleteRule(id, storage = defaultStorage()) {
  return updateAlarmState(state => ({ ...state, rules: state.rules.filter(rule => rule.id !== id) }), storage);
}

export function setRuleEnabled(id, enabled, storage = defaultStorage()) {
  return updateAlarmState(state => ({ ...state, rules: state.rules.map(rule => (rule.id === id ? { ...rule, enabled: Boolean(enabled), updatedAt: new Date().toISOString() } : rule)) }), storage);
}

export function clearNotice(storage = defaultStorage()) {
  return updateAlarmState(state => ({ ...state, notice: null }), storage);
}
