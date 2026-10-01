// שעשועון טריוויה יהודי — the question's clock and the beat after an answer. Pure (timers injected or global), so the
// tests drive them with fake timers.
//
// The clock ("שעון", 30 seconds, off by default): one per question in the ladder, the challenge and free practice. It
// counts down whole seconds while the question waits for an answer (it holds during the ladder's held breath and after
// the verdict); in the last URGENT_SECONDS it turns red (and blinks, only with motion). At 0 the question counts as not
// answered — a miss, per the game's rules — and nothing is revealed.
//
// After an answer — "הסבר קצר" (on by default): the question's short explanation is shown and stays until the player
// taps "לשאלה הבאה". It is shown after a right answer; after a miss only when "להציג את התשובה הנכונה?" is on, since the
// explanation tells the answer. With no explanation to show, the game moves on by itself after the verdict's beat.
import { TIMER_SECONDS } from './catalog.mjs';

export { TIMER_SECONDS };
export const URGENT_SECONDS = 10;
export const AUTO_ADVANCE_MS = 1500;

export const clockUrgent = remaining => remaining > 0 && remaining <= URGENT_SECONDS;

// Counts down from `from` (whole seconds): onTick(left) each second, onTimeout() once at 0. Returns stop().
export function startCountdown({ from = TIMER_SECONDS, onTick, onTimeout, timers = globalThis } = {}) {
  let left = Math.max(0, Math.floor(from));
  if (left <= 0) return () => {};
  let handle = timers.setInterval(() => {
    if (handle === null) return; // stopped (a late tick after clearing never counts or times out again)
    left = Math.max(0, left - 1);
    onTick?.(left);
    if (left === 0) { timers.clearInterval(handle); handle = null; onTimeout?.(); }
  }, 1000);
  return () => { if (handle !== null) timers.clearInterval(handle); handle = null; };
}

// The explanation that may be shown after an answer, or null. Never after a miss unless the answer may be revealed.
export function explanationFor({ note, correct, explain = true, reveal = false } = {}) {
  const text = typeof note === 'string' ? note.trim() : '';
  if (!explain || !text) return null;
  return correct || reveal ? text : null;
}

// After the verdict: with an explanation on screen, wait for the tap; without, move on after the beat. Returns cancel().
export function scheduleAdvance({ wait = false, onAdvance, ms = AUTO_ADVANCE_MS, timers = globalThis } = {}) {
  if (wait) return () => {};
  let handle = timers.setTimeout(() => { handle = null; onAdvance?.(); }, ms);
  return () => { if (handle !== null) timers.clearTimeout(handle); handle = null; };
}
