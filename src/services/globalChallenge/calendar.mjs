// האתגר העולמי — which civil days have a challenge. Shared by the app and the server (server/challenge-worker imports
// this very file), so both close exactly the same days. Pure: a civil date key ('2026-10-04') in, an answer out.
//
// No challenge on:
//   • Shabbat (the civil Saturday);
//   • Yom Tov, by the user's regime (the app's "מעמד הלכתי" / יום טוב שני setting, services/diasporaMode.mjs):
//       Eretz Yisrael — 15 and 21 Nisan, 6 Sivan, 1–2 and 10 Tishrei, 15 and 22 Tishrei;
//       the diaspora adds the second days — 16 and 22 Nisan, 7 Sivan, 16 and 23 Tishrei;
//     (these are exactly @hebcal/core's CHAG days — tests/globalChallengeCalendar.test.mjs checks every day of several
//     years against it, for both regimes);
//   • Tisha B'Av (9 Av, or 10 Av when the fast is deferred from Shabbat) — a trivia game of Torah topics is not for that
//     day; an owner's decision to keep or drop (CLOSED_FASTS below).
// A day before a closed day closes at candle lighting (the app, services/globalChallenge/status.mjs); the server cannot
// know the user's place and accepts that day's challenge in full.
import { HDate } from '@hebcal/core';

const NISAN = 1, SIVAN = 3, AV = 5, TISHREI = 7;
const YOM_TOV_IL = [[NISAN, 15], [NISAN, 21], [SIVAN, 6], [TISHREI, 1], [TISHREI, 2], [TISHREI, 10], [TISHREI, 15], [TISHREI, 22]];
const YOM_TOV_DIASPORA_EXTRA = [[NISAN, 16], [NISAN, 22], [SIVAN, 7], [TISHREI, 16], [TISHREI, 23]];
export const CLOSED_FASTS = Object.freeze(['tisha-bav']);

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
export const isDateKey = key => {
  const m = DATE_KEY.exec(String(key || ''));
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
};
const parts = key => DATE_KEY.exec(key).slice(1).map(Number);
// The weekday of a civil date (0 Sunday … 6 Saturday), independent of the device's time zone.
export const weekdayOf = key => { const [y, m, d] = parts(key); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
export const keyOfUTC = date => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
export const shiftDateKey = (key, days) => { const [y, m, d] = parts(key); return keyOfUTC(new Date(Date.UTC(y, m - 1, d + days))); };
// The Hebrew date of a civil day (its daytime): local midnight of that day, whatever the device's zone.
export const hebrewOf = key => { const [y, m, d] = parts(key); return new HDate(new Date(y, m - 1, d)); };

const has = (list, month, day) => list.some(([mm, dd]) => mm === month && dd === day);

// Why a day has no challenge: 'shabbat' · 'yomtov' · 'tisha-bav', or null when it has one. `il`: the Israel regime.
export function closedReason(key, { il = true } = {}) {
  if (!isDateKey(key)) return 'invalid';
  if (weekdayOf(key) === 6) return 'shabbat';
  const h = hebrewOf(key);
  const month = h.getMonth();
  const day = h.getDate();
  if (has(YOM_TOV_IL, month, day) || (!il && has(YOM_TOV_DIASPORA_EXTRA, month, day))) return 'yomtov';
  if (CLOSED_FASTS.includes('tisha-bav') && month === AV) {
    // 9 Av; when 9 Av is Shabbat the fast is on Sunday, 10 Av.
    if (day === 9) return 'tisha-bav';
    if (day === 10 && weekdayOf(shiftDateKey(key, -1)) === 6) return 'tisha-bav';
  }
  return null;
}
export const isOpenDay = (key, options) => closedReason(key, options) === null;

// The leaderboard's week: Sunday to Friday, named by its Sunday. Saturday belongs to the week it ends until Shabbat is
// out (motzaei Shabbat), and then to the new week (`shabbatOver`).
export const weekKeyOf = key => shiftDateKey(key, -weekdayOf(key));
export function boardWeekAt(key, { shabbatOver = false } = {}) {
  if (weekdayOf(key) === 6 && shabbatOver) return shiftDateKey(key, 1);
  return weekKeyOf(key);
}
export const weekDays = week => Array.from({ length: 6 }, (_, i) => shiftDateKey(week, i));
export const isWeekKey = key => isDateKey(key) && weekdayOf(key) === 0;
