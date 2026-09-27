import { WEEKDAY_MINCHA_PACK, composeWeekdayMincha } from './weekdayMinchaComposer.mjs';
import { RULES_VERSION } from './weekdayMinchaRules.mjs';

// v2: the schema version is part of the key; every record is validated on read and dropped if
// it does not match the shape (an unversioned v1 session with a different shape once crashed Mincha).
export const SESSION_SCHEMA_VERSION = 2;
export const SESSION_STORAGE_KEY = `kz-prayer-sessions-v${SESSION_SCHEMA_VERSION}`;
const STORAGE_KEY = SESSION_STORAGE_KEY;
const REUSE_WINDOW_MS = 16 * 60 * 60 * 1000;

const defaultStorage = () => { try { return globalThis.localStorage || null; } catch { return null; } };
const isoDate = value => typeof value === 'string' && Number.isFinite(new Date(value).getTime());
export function isValidSession(session) {
  return Boolean(session && typeof session === 'object'
    && session.schemaVersion === SESSION_SCHEMA_VERSION
    && typeof session.id === 'string' && typeof session.prayer === 'string'
    && isoDate(session.createdAt) && /^\d{4}-\d{2}-\d{2}$/.test(String(session.prayerDate))
    && typeof session.packVersion === 'string' && typeof session.rulesVersion === 'string'
    && session.inputs && typeof session.inputs === 'object' && isoDate(session.inputs.instant)
    && session.inputs.settings && typeof session.inputs.settings === 'object'
    && session.inputs.preferences && typeof session.inputs.preferences === 'object'
    && Array.isArray(session.blockIds) && session.blockIds.every(id => typeof id === 'string')
    && (session.position === null || typeof session.position === 'string'));
}
const read = storage => {
  try {
    const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) || '{}') || {};
    return Object.fromEntries(Object.entries(parsed).filter(([, session]) => isValidSession(session)));
  } catch { return {}; }
};
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
    preferences: {
      setting: preferences.setting === 'individual' ? 'individual' : 'minyan',
      // Frozen with the session: the verses said at the end of the Amidah (user's own choice).
      personalVerses: (Array.isArray(preferences.personalVerses) ? preferences.personalVerses : []).slice(0, 3).map(verse => ({ id: String(verse.id || ''), text: String(verse.text || ''), reference: String(verse.reference || ''), sourceReference: String(verse.sourceReference || ''), name: String(verse.name || '') })),
    },
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
    schemaVersion: SESSION_SCHEMA_VERSION,
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
  if (!isValidSession(session)) return null;
  if (session.packVersion !== WEEKDAY_MINCHA_PACK.version || session.rulesVersion !== RULES_VERSION) return null;
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
  if (!isValidSession(session)) return false;
  const all = read(storage);
  all[session.prayer] = session;
  write(storage, all);
  return true;
}

// First section whose composed content differs from the frozen session — the transition point.
export function firstChangedSection(frozen, fresh) {
  const idsBySection = doc => new Map(doc.sections.map(section => [section.id, section.blocks.map(block => block.id).join('|')]));
  const before = idsBySection(frozen);
  const after = idsBySection(fresh);
  return frozen.sections.find(section => before.get(section.id) !== after.get(section.id))?.id || null;
}
