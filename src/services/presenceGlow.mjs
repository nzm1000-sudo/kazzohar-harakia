// Presence Glow — a quiet, non-numeric sense of consistency, drawn in the app's own emblem
// ("והמשכילים יזהירו כזוהר הרקיע"). Pure: journal events in, a visual state out.
//
// Per day d:  a_d = 1 if the day has any journal event (any type, any number), else 0
//             p_d = λ·p_(d−1) + (1−λ)·a_d        λ = 0.8 (half-life ≈ 3 days)
// Shabbat and Yom Tov without activity are neutral (p unchanged): the app is not meant to be
// used then, so they never dim the glow. Today only counts once it has activity, so opening
// the app in the morning never shows a "penalty".
// Nothing here is shown as a number; the UI receives only a state and whether today is lit.
import { HDate, HebrewCalendar, flags } from '@hebcal/core';

export const PRESENCE_LAMBDA = 0.8;
export const PRESENCE_WINDOW_DAYS = 60;
export const PRESENCE_THRESHOLDS = { glowing: 0.2, bright: 0.65 };
export const PRESENCE_STATE = { DIM: 'dim', GLOWING: 'glowing', BRIGHT: 'bright' };
const EPSILON = 1e-9;

const dayMs = 24 * 60 * 60 * 1000;
const toUtcNoon = key => new Date(`${key}T12:00:00Z`);
const keyOf = date => date.toISOString().slice(0, 10);
export const shiftDay = (key, delta) => keyOf(new Date(toUtcNoon(key).getTime() + delta * dayMs));

// Shabbat or a festival day on which work is forbidden (second day abroad included).
export function isRestDay(key, { il = true } = {}) {
  const date = toUtcNoon(key);
  if (date.getUTCDay() === 6) return true;
  const holidays = HebrewCalendar.getHolidaysOnDate(new HDate(date), il) || [];
  return holidays.some(event => (event.getFlags() & flags.CHAG) !== 0);
}

export function stateForLevel(level) {
  if (level >= PRESENCE_THRESHOLDS.bright - EPSILON) return PRESENCE_STATE.BRIGHT;
  if (level >= PRESENCE_THRESHOLDS.glowing - EPSILON) return PRESENCE_STATE.GLOWING;
  return PRESENCE_STATE.DIM;
}

// events: journal events ({ jewishDate: 'YYYY-MM-DD', ... }); today: 'YYYY-MM-DD'.
// Returns { state, litToday } — never a count.
export function computePresence(events, today, { il = true, lambda = PRESENCE_LAMBDA, windowDays = PRESENCE_WINDOW_DAYS } = {}) {
  const activeDays = new Set((events || []).map(event => event?.jewishDate).filter(key => typeof key === 'string'));
  const litToday = activeDays.has(today);
  let level = 0;
  for (let offset = windowDays; offset >= 0; offset -= 1) {
    const day = shiftDay(today, -offset);
    const active = activeDays.has(day);
    if (offset === 0 && !active) break; // today not lit yet: keep yesterday's light
    if (!active && isRestDay(day, { il })) continue; // Shabbat / Yom Tov never dim the glow
    level = lambda * level + (1 - lambda) * (active ? 1 : 0);
  }
  return { state: stateForLevel(level), litToday };
}

// Convenience used by tests and the UI: the state alone.
export const computePresenceLevel = (events, today, options) => computePresence(events, today, options).state;
