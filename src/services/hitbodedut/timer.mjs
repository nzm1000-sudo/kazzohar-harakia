// התבודדות — the session timer. Pure and wall-clock based: the state holds instants (epoch ms), never a ticking
// counter, so it stays right across a locked screen, a suspended WebView, a reload, and the pause / resume / end that
// arrive from the Lock Screen (Live Activity buttons, the Now Playing controls) with the instant they happened.
//
// state: { id, durationMs, startedAt, endsAt, pausedAt, pausedTotalMs, endedAt, endReason }
//   running  → endsAt is the instant the time is up, pausedAt null
//   paused   → pausedAt set; the remaining time is frozen at endsAt − pausedAt
//   ended    → endedAt set (endReason: 'completed' | 'ended')

export const PRESET_MINUTES = Object.freeze([15, 30, 60]);
export const CUSTOM_MIN_MINUTES = 1;
export const CUSTOM_MAX_MINUTES = 180;
export const CUSTOM_STEP_MINUTES = 5;
const MINUTE = 60_000;

// A custom duration in whole minutes, within 1–180 (anything else → the nearest bound; nonsense → the default 20).
export function clampMinutes(value, fallback = 20) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(CUSTOM_MAX_MINUTES, Math.max(CUSTOM_MIN_MINUTES, number));
}

// The stepper of the custom value: 1 → 5 → 10 …, back down 10 → 5 → 1.
export function stepMinutes(value, direction) {
  const current = clampMinutes(value);
  if (direction > 0) return clampMinutes(current < CUSTOM_STEP_MINUTES ? CUSTOM_STEP_MINUTES : Math.floor(current / CUSTOM_STEP_MINUTES) * CUSTOM_STEP_MINUTES + CUSTOM_STEP_MINUTES);
  if (current <= CUSTOM_STEP_MINUTES) return CUSTOM_MIN_MINUTES;
  return clampMinutes(Math.ceil(current / CUSTOM_STEP_MINUTES) * CUSTOM_STEP_MINUTES - CUSTOM_STEP_MINUTES);
}

const instant = now => (now instanceof Date ? now.getTime() : Number(now));

export function startTimer(minutes, now = Date.now(), id = null) {
  const at = instant(now);
  const durationMs = clampMinutes(minutes) * MINUTE;
  return { id: id || `h-${at}`, durationMs, startedAt: at, endsAt: at + durationMs, pausedAt: null, pausedTotalMs: 0, endedAt: null, endReason: null };
}

export const isEnded = state => Boolean(state?.endedAt);
export const isPaused = state => Boolean(state && !state.endedAt && state.pausedAt);
export const isRunning = state => Boolean(state && !state.endedAt && !state.pausedAt);

export function remainingMs(state, now = Date.now()) {
  if (!state) return 0;
  if (state.endedAt) return Math.max(0, state.endsAt - Math.min(state.endedAt, state.pausedAt || state.endedAt));
  const reference = state.pausedAt || instant(now);
  return Math.max(0, state.endsAt - reference);
}

export function elapsedMs(state, now = Date.now()) {
  if (!state) return 0;
  return Math.max(0, state.durationMs - remainingMs(state, now));
}

// The share of the time already passed, 0–1 (for the quiet ring).
export function progress(state, now = Date.now()) {
  if (!state || !state.durationMs) return 0;
  return Math.min(1, elapsedMs(state, now) / state.durationMs);
}

export function isTimeUp(state, now = Date.now()) {
  return Boolean(state && !state.endedAt && !state.pausedAt && instant(now) >= state.endsAt);
}

export function pauseTimer(state, now = Date.now()) {
  if (!isRunning(state)) return state;
  const at = Math.min(instant(now), state.endsAt);
  return { ...state, pausedAt: at };
}

export function resumeTimer(state, now = Date.now()) {
  if (!isPaused(state)) return state;
  const at = Math.max(instant(now), state.pausedAt);
  const pausedFor = at - state.pausedAt;
  return { ...state, endsAt: state.endsAt + pausedFor, pausedAt: null, pausedTotalMs: state.pausedTotalMs + pausedFor };
}

// Ends the session: 'completed' when the time ran out, 'ended' when the person chose to end it.
export function endTimer(state, now = Date.now(), reason = null) {
  if (!state || state.endedAt) return state;
  const at = instant(now);
  const completed = !state.pausedAt && at >= state.endsAt;
  return { ...state, endedAt: completed ? state.endsAt : at, endReason: reason || (completed ? 'completed' : 'ended') };
}

// "18:42" / "1:02:05" — the remaining time as a clock (rounded up, so it never shows 0:00 before the end).
export function formatClock(ms) {
  const total = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const two = value => String(value).padStart(2, '0');
  return hours ? `${hours}:${two(minutes)}:${two(seconds)}` : `${minutes}:${two(seconds)}`;
}

// "רבע שעה", "חצי שעה", "שעה", "45 דקות", "דקה אחת" — the duration in words, for VoiceOver and the summary.
export function minutesInWords(minutes) {
  const value = clampMinutes(minutes);
  if (value === 15) return 'רבע שעה';
  if (value === 30) return 'חצי שעה';
  if (value === 60) return 'שעה';
  if (value === 120) return 'שעתיים';
  if (value === 1) return 'דקה אחת';
  return `${value} דקות`;
}

// The remaining time in words for a screen reader: "נותרו 18 דקות", "נותרה דקה אחת", "נותרו פחות מדקה".
export function remainingInWords(ms) {
  const minutes = Math.ceil(Math.max(0, ms) / MINUTE);
  if (ms <= 0) return 'הזמן הסתיים';
  if (ms < MINUTE) return 'נותרה פחות מדקה';
  if (minutes === 1) return 'נותרה דקה אחת';
  return `נותרו ${minutes} דקות`;
}
