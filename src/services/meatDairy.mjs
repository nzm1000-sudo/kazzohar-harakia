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
