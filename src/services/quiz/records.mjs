// שעשועון טריוויה יהודי — the player's own records (השיאים שלי): pure reads of the local state, nothing is sent and
// nobody else is ranked. The "leaderboard" is the player against their own weeks: this week's ladder points ranked among
// the weeks kept on this device. Also the daily challenge's countdown and the combo levels of a run of right answers.
import { dayKey } from './store.mjs';

const DAY = 24 * 60 * 60 * 1000;
export const WEEKS_SHOWN = 6;

const toDate = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d, 12); };
// The week of a day, by its Sunday (the Jewish week: ראשון … שבת).
export function weekKey(day) {
  const d = toDate(day);
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay(), 12).getTime());
}

export function personalRecords(state, now = Date.now()) {
  const rec = state?.ladder || {};
  const daily = Object.values(rec.daily || {});
  const byWeek = {};
  for (const [day, pts] of Object.entries(rec.log || {})) {
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
  return {
    bestLadder: Math.min(15, Number(rec.best) || 0),
    bestPoints: Number(rec.bestPoints) || 0,
    wins: Number(rec.wins) || 0,
    games: Number(rec.games) || 0,
    bestDaily: daily.reduce((m, d) => Math.max(m, Number(d?.banked) || 0), 0),
    dailyCount: daily.length,
    bestDays: Math.max(Number(state?.days?.best) || 0, Number(state?.days?.streak) || 0),
    bestRun: Number(state?.bestRun) || 0,
    week: { points, rank, of: weeks.length, bars, top: Math.max(1, ...bars.map(b => b.points)) },
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
