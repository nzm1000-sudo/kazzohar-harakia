// האתגר העולמי — today's challenge on this device, and the words of a result. Pure (the clock and the place come in).
//
// The challenge's day is the civil date where the user is (the app's place and time zone). No challenge on Shabbat, Yom
// Tov (by the user's regime) or Tisha B'Av (calendar.mjs). The day before Shabbat or Yom Tov closes at candle lighting:
// the day's sunset at the app's place less the app's own candle-lighting minutes (settings.candles, as the calendar
// shows them — the app's existing rule, nothing new); the eve of Tisha B'Av closes at sunset, when the fast begins.
import { closedReason, shiftDateKey, boardWeekAt, weekdayOf } from './calendar.mjs';
import { computeZmanim, civilKeyAt } from '../zmanimLocal.mjs';
import { GLOBAL_SIZE, shareBelow } from './scoring.mjs';

export const ilOf = settings => (settings?.halachicResidenceStatus || (settings?.il === false ? 'diaspora' : 'israel')) === 'israel';
const MINUTE = 60 * 1000;

export function dateKeyAt(now, tzid) {
  try { return civilKeyAt(now, tzid || 'Asia/Jerusalem'); } catch { const d = new Date(now); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
}

// When the day's challenge closes early (ms), or null.
export function closesAtFor(date, { il = true, location = null, candles = 20 } = {}) {
  const tomorrow = closedReason(shiftDateKey(date, 1), { il });
  if (!tomorrow || !location) return null;
  const sunset = computeZmanim(date, location)?.sunset;
  if (!sunset) return null;
  const at = new Date(sunset).getTime();
  if (tomorrow === 'tisha-bav') return at;
  return at - (Number.isFinite(Number(candles)) ? Number(candles) : 20) * MINUTE;
}

// { date, open, reason, closesAt, week } — reason when closed: 'shabbat' · 'yomtov' · 'tisha-bav' · 'evening' (after
// candle lighting on the eve). `shabbatOver`: Shabbat is out (Saturday night) — the leaderboard has turned to the new week.
export function challengeToday({ now = Date.now(), settings = null } = {}) {
  const tzid = settings?.location?.tzid || 'Asia/Jerusalem';
  const il = ilOf(settings);
  const date = dateKeyAt(now, tzid);
  const reason = closedReason(date, { il });
  const location = settings?.location ? { ...settings.location, il } : null;
  const closesAt = reason ? null : closesAtFor(date, { il, location, candles: settings?.candles });
  const evening = closesAt !== null && now >= closesAt;
  // Saturday after nightfall (the app's own nightfall, tzeit 8.5°): the new week.
  let shabbatOver = false;
  if (weekdayOf(date) === 6 && location) {
    const tzeit = computeZmanim(date, location)?.tzeit85deg;
    shabbatOver = Boolean(tzeit) && now >= new Date(tzeit).getTime();
  }
  return { date, il, open: !reason && !evening, reason: reason || (evening ? 'evening' : null), closesAt, week: boardWeekAt(date, { shabbatOver }) };
}

export const CLOSED_TEXT = Object.freeze({
  shabbat: 'אין אתגר בשבת. נתראה במוצאי שבת',
  yomtov: 'אין אתגר ביום טוב. נתראה במוצאי החג',
  'tisha-bav': 'אין אתגר בתשעה באב',
  evening: 'האתגר של היום נסגר בהדלקת הנרות',
});

const nf = new Intl.NumberFormat('he-IL');
// "ענית נכון על 4 מתוך 5" (and the comparison when there are global numbers: "— יותר מ-72% מהעונים היום").
// resultParts: the same two parts, for a screen that sets them on two lines.
export function resultParts(correct, stats = null) {
  const head = correct === 0 ? 'הפעם לא היו תשובות נכונות' : correct === 1 ? `ענית נכון על שאלה אחת מתוך ${GLOBAL_SIZE}` : `ענית נכון על ${nf.format(correct)} מתוך ${GLOBAL_SIZE}`;
  if (!stats || !(stats.n > 1)) return { head, compare: '' };
  const below = shareBelow(stats, correct);
  return { head, compare: below >= 1 ? `יותר מ-${below}% מהעונים היום` : '' };
}
export function resultLine(correct, stats = null) {
  const { head, compare } = resultParts(correct, stats);
  return compare ? `${head} — ${compare}` : head;
}
export function countLine(n) {
  if (!(n > 0)) return '';
  if (n === 1) return 'היום ענה לומד אחד';
  return `היום ענו ${nf.format(n)} לומדים`;
}
