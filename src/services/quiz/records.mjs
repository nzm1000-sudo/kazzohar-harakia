// שעשועון טריוויה יהודי — the player's own records (השיאים שלי): pure reads of the local state, nothing is sent and
// nobody else is ranked. The "leaderboard" is the player against their own weeks: this week's ladder points ranked among
// the weeks kept on this device. Also the daily challenge's countdown and the combo levels of a run of right answers.
import { dayKey } from './store.mjs';

const DAY = 24 * 60 * 60 * 1000;
export const WEEKS_SHOWN = 6;
// השבוע שלי: the seven days of this week, ראשון … שבת (their letters, in order; RTL puts א׳ on the right).
export const WEEKDAY_LETTERS = Object.freeze(['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']);
export const WEEKDAY_NAMES = Object.freeze(['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']);

const toDate = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d, 12); };
// The week of a day, by its Sunday (the Jewish week: ראשון … שבת).
export function weekKey(day) {
  const d = toDate(day);
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay(), 12).getTime());
}

// השבוע שלי of one track's day log (day → points): this week ranked among the weeks kept, the last weeks, and this week
// day by day (Sunday first; today marked; the days still to come empty).
export function weekOf(log, now = Date.now()) {
  const byWeek = {};
  for (const [day, pts] of Object.entries(log || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const w = weekKey(day);
    byWeek[w] = (byWeek[w] || 0) + (Number(pts) || 0);
  }
  const current = weekKey(dayKey(now));
  const points = byWeek[current] || 0;
  const weeks = Object.keys({ ...byWeek, [current]: 0 });
  // Rank among the weeks played (this week counts even at zero); ties share the better place.
  const rank = 1 + weeks.filter(w => w !== current && (byWeek[w] || 0) > points).length;
  const bars = Array.from({ length: WEEKS_SHOWN }, (_, i) => {
    const key = weekKey(dayKey(toDate(current).getTime() - (WEEKS_SHOWN - 1 - i) * 7 * DAY));
    return { key, points: byWeek[key] || 0, current: key === current };
  });
  const today = dayKey(now);
  const sunday = toDate(current).getTime();
  const days = WEEKDAY_LETTERS.map((letter, i) => {
    const key = dayKey(sunday + i * DAY);
    return { key, letter, name: WEEKDAY_NAMES[i], points: Number(log?.[key]) || 0, today: key === today, ahead: key > today };
  });
  return { points, rank, of: weeks.length, bars, top: Math.max(1, ...bars.map(b => b.points)), days, dayTop: Math.max(1, ...days.map(d => d.points)) };
}

export function personalRecords(state, now = Date.now()) {
  const rec = state?.ladder || {};
  const daily = Object.values(rec.daily || {});
  return {
    bestLadder: Math.min(15, Number(rec.best) || 0),
    bestPoints: Number(rec.bestPoints) || 0,
    // מסלול למתחילים: its own best and its own week (from its own day log), apart — never mixed into the champion's.
    beginner: { best: Math.min(15, Number(rec.beginner?.best) || 0), bestPoints: Number(rec.beginner?.bestPoints) || 0, games: Number(rec.beginner?.games) || 0, wins: Number(rec.beginner?.wins) || 0,
      week: weekOf(rec.beginner?.log, now) },
    wins: Number(rec.wins) || 0,
    games: Number(rec.games) || 0,
    bestDaily: daily.reduce((m, d) => Math.max(m, Number(d?.banked) || 0), 0),
    dailyCount: daily.length,
    bestDays: Math.max(Number(state?.days?.best) || 0, Number(state?.days?.streak) || 0),
    bestRun: Number(state?.bestRun) || 0,
    week: weekOf(rec.log, now),
  };
}

// The daily challenge renews at the device's midnight.
export function msToNextDay(now = Date.now()) {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0).getTime() - now;
}
export function formatCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const two = n => String(n).padStart(2, '0');
  return `${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`;
}

// A run of right answers: the light of the combo meter. 0 none · 1 from 2 in a row · 2 from 5 · 3 from 10.
export const COMBO_LEVELS = [2, 5, 10];
export const comboLevel = run => COMBO_LEVELS.filter(n => run >= n).length;
// The moments worth a "level up": the safe steps and the combo thresholds, said once when reached.
export function levelUpOf({ run = 0, safe = false, won = false } = {}) {
  if (won) return null;
  if (safe) return 'מדרגת ביטחון';
  if (run === 10) return 'עשר ברצף';
  if (run === 5) return 'חמש ברצף';
  if (run === 3) return 'שלוש ברצף';
  return null;
}
