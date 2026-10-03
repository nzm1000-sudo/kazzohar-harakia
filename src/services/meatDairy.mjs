// The wait between meat and dairy. Pure timing only — which custom to keep is the user's own choice.
// Six hours is the default (SA YD 89:1); three hours is offered for those whose custom it is.
const HOUR = 3600000;
export const MEAT_DAIRY_HOURS = Object.freeze([6, 3]);
export const MEAT_DAIRY_DEFAULT_HOURS = 6;
// A finished wait stays on the card a little while ("אפשר חלבי"), then the card returns to rest.
export const MEAT_DAIRY_LINGER_MS = 3 * HOUR;

// "I ate at 14:00": the most recent 14:00 that is not in the future (after midnight, 23:00 is yesterday's).
export function mealInstant(now, hour, minute) {
  const at = new Date(now);
  at.setHours(hour, minute, 0, 0);
  if (at.getTime() > new Date(now).getTime()) at.setDate(at.getDate() - 1);
  return at;
}

export function meatDairyStatus(state, now) {
  if (!state?.startedAt) return null;
  const start = new Date(state.startedAt).getTime();
  const hours = MEAT_DAIRY_HOURS.includes(state.hours) ? state.hours : MEAT_DAIRY_DEFAULT_HOURS;
  if (!Number.isFinite(start)) return null;
  const end = start + hours * HOUR;
  const at = new Date(now).getTime();
  if (at > end + MEAT_DAIRY_LINGER_MS) return null;
  const remaining = Math.max(0, end - at);
  return { start: new Date(start), end: new Date(end), hours, remaining, done: remaining === 0, progress: Math.min(1, Math.max(0, (at - start) / (hours * HOUR))) };
}

// 4:05 — hours and minutes left, rounded up so "0:00" only shows when the wait is really over.
export function formatRemaining(ms) {
  const minutes = Math.ceil(Math.max(0, ms) / 60000);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

export const clockLabel = date => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

// ── Shared with the widgets (services/nativeWidgets.mjs) ───────────────────────────────────────────────────────────
// The card keeps its state in localStorage ('meat-dairy-v1', 'meat-dairy-hours'); a change made in the app is stamped
// ('meat-dairy-updated') and announced, so the widgets redraw; a wait started from the widget's own "אכלתי בשרי" button
// comes back through the native shared store and is announced to the card. Whichever was changed last wins — the
// same for the widget's "ביטול" (a record with no startedAt), which clears the card and its reminder.
export const MEAT_DAIRY_KEY = 'meat-dairy-v1';
export const MEAT_DAIRY_HOURS_KEY = 'meat-dairy-hours';
export const MEAT_DAIRY_UPDATED_KEY = 'meat-dairy-updated';
export const MEAT_DAIRY_CHANGE_EVENT = 'kz-meat-dairy-change'; // the app changed it → the widgets
export const MEAT_DAIRY_SYNC_EVENT = 'kz-meat-dairy-sync';     // the widget changed it → the card

const readJson = (storage, key, fallback) => { try { const raw = storage?.getItem(key); return raw == null ? fallback : JSON.parse(raw); } catch { return fallback; } };
const writeJson = (storage, key, value) => { try { storage?.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: the card still shows it */ } };
const announce = (name, detail) => { try { globalThis.dispatchEvent?.(new CustomEvent(name, { detail })); } catch { /* no window (tests) */ } };

/** The app's state as the widgets carry it: { startedAt (ms) | null, hours, preferred, updatedAt }. */
export function readMeatDairy(storage = globalThis.localStorage) {
  const wait = readJson(storage, MEAT_DAIRY_KEY, null);
  const preferred = readJson(storage, MEAT_DAIRY_HOURS_KEY, MEAT_DAIRY_DEFAULT_HOURS);
  const startedAt = wait?.startedAt ? new Date(wait.startedAt).getTime() : null;
  return {
    startedAt: Number.isFinite(startedAt) ? startedAt : null,
    hours: MEAT_DAIRY_HOURS.includes(wait?.hours) ? wait.hours : MEAT_DAIRY_DEFAULT_HOURS,
    preferred: MEAT_DAIRY_HOURS.includes(preferred) ? preferred : MEAT_DAIRY_DEFAULT_HOURS,
    updatedAt: Number(readJson(storage, MEAT_DAIRY_UPDATED_KEY, 0)) || 0,
  };
}

/** The card changed the wait (or the preferred hours): stamp it and tell the widgets. */
export function recordMeatDairyChange({ wait, preferred } = {}, { storage = globalThis.localStorage, now = Date.now() } = {}) {
  if (wait !== undefined) writeJson(storage, MEAT_DAIRY_KEY, wait);
  if (preferred !== undefined) writeJson(storage, MEAT_DAIRY_HOURS_KEY, preferred);
  writeJson(storage, MEAT_DAIRY_UPDATED_KEY, now);
  announce(MEAT_DAIRY_CHANGE_EVENT, null);
}

/**
 * The native shared store's record ({ startedAt, hours, updatedAt }, written by the widget's button) against the app's:
 * the shared one is taken only when it was changed later. Returns the card's wait to adopt, or undefined to keep.
 */
export function adoptSharedMeatDairy(local, shared) {
  const at = Number(shared?.updatedAt) || 0;
  if (!shared || at <= (Number(local?.updatedAt) || 0)) return undefined;
  const start = Number(shared.startedAt);
  if (!shared.startedAt || !Number.isFinite(start)) return null;
  return { startedAt: new Date(start).toISOString(), hours: MEAT_DAIRY_HOURS.includes(shared.hours) ? shared.hours : MEAT_DAIRY_DEFAULT_HOURS };
}

/** Adopt it: the card's storage, its stamp, and a word to the card if it is on screen. */
export function applySharedMeatDairy(wait, updatedAt, storage = globalThis.localStorage) {
  writeJson(storage, MEAT_DAIRY_KEY, wait);
  writeJson(storage, MEAT_DAIRY_UPDATED_KEY, updatedAt);
  announce(MEAT_DAIRY_SYNC_EVENT, { wait });
}

// ── The way in from the widget (kzohaar://open/meat): Today, with the בשרי · חלבי sheet open ─────────────────────
// The card is a tile on Today and its sheet is where the wait is changed or stopped. A tap on the widget leaves a
// request here (services/nativeWidgets.mjs → openEntry) and announces it; the card opens its sheet on the word, or, on
// a cold start when Today is not drawn yet, takes the request when it mounts. A request is good for a short while only,
// so a later, unrelated visit to Today never opens the sheet by itself.
export const MEAT_DAIRY_OPEN_EVENT = 'kz-meat-dairy-open';
export const MEAT_DAIRY_OPEN_TTL_MS = 20000;
let openRequest = 0;
export function requestMeatDairySheet(now = Date.now()) {
  openRequest = now;
  announce(MEAT_DAIRY_OPEN_EVENT, null);
}
/** True once for a fresh request (then it is spent). */
export function takeMeatDairySheetRequest(now = Date.now()) {
  const at = openRequest;
  openRequest = 0;
  return at > 0 && now - at >= 0 && now - at <= MEAT_DAIRY_OPEN_TTL_MS;
}

/** The reminder at the end of the wait (the same words the card schedules). */
export const meatDairyReminder = (startedAt, hours) => ({
  title: 'אפשר לאכול חלבי',
  body: `עברו ${hours} שעות מהארוחה הבשרית (${clockLabel(new Date(startedAt))}).`,
  at: new Date(new Date(startedAt).getTime() + hours * HOUR),
});
