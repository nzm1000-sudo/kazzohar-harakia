import { WEEKDAY_MINCHA_PACK, composeWeekdayMincha } from './weekdayMinchaComposer.mjs';
import { RULES_VERSION } from './weekdayMinchaRules.mjs';

const STORAGE_KEY = 'kz-prayer-sessions-v1';
const REUSE_WINDOW_MS = 16 * 60 * 60 * 1000;

const defaultStorage = () => { try { return globalThis.localStorage || null; } catch { return null; } };
const read = storage => { try { return JSON.parse(storage?.getItem(STORAGE_KEY) || '{}') || {}; } catch { return {}; } };
const write = (storage, value) => { try { storage?.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* storage full or private mode */ } };

// Only what changes the composed text is frozen; nothing else about the user is stored.
export function sessionInputs({ now = new Date(), settings = {}, times = null, preferences = {}, answers = {} } = {}) {
  const location = settings.location || {};
  return {
    instant: new Date(now).toISOString(),
    settings: {
      il: settings.il,
      halachicResidenceStatus: settings.halachicResidenceStatus,
      nusach: settings.nusach,
      location: { name: location.name, tzid: location.tzid, latitude: location.latitude, longitude: location.longitude, source: location.source },
    },
    times: times ? { sunrise: times.sunrise || null, sunset: times.sunset || null } : null,
    preferences: { setting: preferences.setting === 'individual' ? 'individual' : 'minyan' },
    answers: { ...answers },
  };
}

const composeFrom = inputs => composeWeekdayMincha({ now: new Date(inputs.instant), settings: inputs.settings, times: inputs.times, preferences: inputs.preferences, answers: inputs.answers });

let sequence = 0;
export function createPrayerSession(inputs) {
  const composed = composeFrom(inputs);
  sequence += 1;
  return {
    // Unique per opening: two openings at the same instant with different choices are different sessions.
    id: `${WEEKDAY_MINCHA_PACK.id}:${inputs.instant}:${inputs.preferences.setting}:${JSON.stringify(inputs.answers)}:${sequence}`,
    prayer: WEEKDAY_MINCHA_PACK.id,
    createdAt: inputs.instant,
    prayerDate: composed.time.prayerDate,
    packVersion: WEEKDAY_MINCHA_PACK.version,
    rulesVersion: RULES_VERSION,
    inputs,
    blockIds: composed.document.sections.flatMap(section => section.blocks.map(block => block.id)),
    position: null,
  };
}

// Rebuilds the frozen document. Null means the content or rules changed since it was opened.
export function documentForSession(session) {
  if (!session || session.packVersion !== WEEKDAY_MINCHA_PACK.version || session.rulesVersion !== RULES_VERSION) return null;
  if (!session.inputs) return null;
  const composed = composeFrom(session.inputs);
  const ids = composed.document.sections.flatMap(section => section.blocks.map(block => block.id));
  return ids.length === session.blockIds.length && ids.every((id, index) => id === session.blockIds[index]) ? composed : null;
}

// Continue an open prayer only if it belongs to the same prayer date and is recent.
export function loadOpenSession({ prayerDate, now = new Date(), storage = defaultStorage() } = {}) {
  const session = read(storage)[WEEKDAY_MINCHA_PACK.id];
  if (!session || session.prayerDate !== prayerDate) return null;
  const age = new Date(now) - new Date(session.createdAt);
  if (!(age >= 0 && age < REUSE_WINDOW_MS)) return null;
  return documentForSession(session) ? session : null;
}

export function saveSession(session, storage = defaultStorage()) {
  const all = read(storage);
  all[session.prayer] = session;
  write(storage, all);
}

// First section whose composed content differs from the frozen session — the transition point.
export function firstChangedSection(frozen, fresh) {
  const idsBySection = doc => new Map(doc.sections.map(section => [section.id, section.blocks.map(block => block.id).join('|')]));
  const before = idsBySection(frozen);
  const after = idsBySection(fresh);
  return frozen.sections.find(section => before.get(section.id) !== after.get(section.id))?.id || null;
}
