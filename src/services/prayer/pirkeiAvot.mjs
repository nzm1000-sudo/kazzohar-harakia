// Which chapter(s) of Pirkei Avot are read at Shabbat Mincha: every Shabbat of the summer, from the Shabbat after Pesach
// to the Shabbat before Rosh Hashana, one chapter a week in order, the cycle repeating; the fourth round doubles
// chapters so that the tractate ends on the last Shabbat before Rosh Hashana (3–4, then 5–6). Not read on a Shabbat
// that is the eighth day of Pesach or the second day of Shavuot (diaspora), nor on Erev Tisha B'Av or Tisha B'Av; those
// weeks are not counted. This is the common luach schedule, as computed by Hebcal (@hebcal/learning, pirkeiAvotBase.ts,
// "pirkeiAvotSummer"), re-implemented here on @hebcal/core so the app needs no further package. Customs of the last
// weeks differ between communities; the full edition always shows all six chapters.
import { HDate, months } from '@hebcal/core';

// hebrewDate: { day, month, year } (month numbered as in @hebcal/core: Nisan = 1). Returns [n] or [n, m], or null.
export function pirkeiAvotChapters(hebrewDate, israel) {
  const { day, month, year } = hebrewDate || {};
  if (!day || !month || !year) return null;
  const hd = new HDate(Number(day), Number(month), Number(year));
  if (hd.getDay() !== 6) return null;
  const pesach7 = new HDate(21, months.NISAN, hd.getFullYear());
  if (hd.abs() <= pesach7.abs()) return null;
  const first = pesach7.after(6);
  let weekDiff = Math.ceil(hd.deltaDays(first) / 7);
  const skipped = israel ? [] : [pesach7.next(), new HDate(7, months.SIVAN, hd.getFullYear())];
  const av8 = new HDate(8, months.AV, hd.getFullYear());
  skipped.push(av8, av8.next());
  for (const other of skipped) {
    if (other.isSameDate(hd)) return null;
    if (other.deltaDays(hd) <= 0 && other.getDay() === 6) weekDiff -= 1;
  }
  if (weekDiff < 0) return null;
  if (weekDiff < 18) return [(weekDiff % 6) + 1];
  const last = new HDate(1, months.TISHREI, hd.getFullYear() + 1).before(6);
  const weeksRemain = Math.ceil(last.deltaDays(hd) / 7);
  switch (weeksRemain) {
    case 0: return [5, 6];
    case 1: return [3, 4];
    case 2: return weekDiff % 6 === 1 ? [2] : [1, 2];
    case 3: return [1];
    default: return null;
  }
}
