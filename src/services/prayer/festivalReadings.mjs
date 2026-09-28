// Torah readings on weekday festival days, exactly as the edition's own continuation lists them
// ("קריאת התורה לסוכות", סידור מהדורת מרדכי שליח ציבור, ויקיטקסט), and SA OC 663:1:
// in Eretz Yisrael every aliyah reads that day's offering only; abroad the day of doubt is read.
// Refs use the local Tanakh book ids. Labels are the aliyot in order.
const NUM = 'Numbers';
const range = (from, to) => `${NUM} 29:${from}-29:${to}`;
// The offering of each Sukkot day (day 2 … day 7): Numbers 29.
const SUKKOT_DAY = { 2: range(17, 19), 3: range(20, 22), 4: range(23, 25), 5: range(26, 28), 6: range(29, 31), 7: range(32, 34) };
const WEEKDAY_ALIYOT = ['כהן', 'לוי', 'ישראל', 'רביעי'];

// dayOfSukkot: 1–7 (15–21 Tishrei). Chol HaMoed: Israel 2–7, diaspora 3–7 (day 2 is Yom Tov).
export function cholHamoedSukkotReading(dayOfSukkot, { israel = true } = {}) {
  if (israel) {
    const ref = SUKKOT_DAY[dayOfSukkot];
    return ref ? WEEKDAY_ALIYOT.map(label => ({ label, ref })) : null;
  }
  const d = dayOfSukkot;
  if (d < 3 || d > 7) return null;
  // "ביום שלישי … לחוץ לארץ: במדבר כט:יז-יט, כ-כב, כ-כב, יז-כב" and so on for each day.
  const previous = SUKKOT_DAY[d - 1];
  const today = SUKKOT_DAY[d];
  const first = previous.split('-')[0];
  const last = today.split('-')[1];
  return [
    { label: 'כהן', ref: previous },
    { label: 'לוי', ref: today },
    { label: 'ישראל', ref: today },
    { label: 'רביעי', ref: `${first}-${last}` },
  ];
}

export const READINGS_SOURCE = 'סידור מהדורת מרדכי שליח ציבור (ויקיטקסט), קריאת התורה לסוכות; שו״ע או״ח תרסג, א';

// The calendar's Torah reading (from Hebcal) follows another custom on Chol HaMoed Sukkot: "Numbers 29:20-28, 29:20-25"
// on the third day in Eretz Yisrael (three days' offerings, then the day again). Per SA OC 663:1 and the edition above,
// in Eretz Yisrael every aliyah reads that day's offering only; abroad, the day of doubt. Replace it with that reading,
// wherever the calendar is shown. A Shabbat of Chol HaMoed (its own reading, from Exodus) is left as it is.
const SUKKOT_DAY_TITLE = /^Sukkot (II|III|IV|V|VI|VII)\b/;
const ROMAN = { II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7 };
export function correctCalendarLeyning(item, { israel = true } = {}) {
  const match = item?.title?.match(SUKKOT_DAY_TITLE);
  if (!match || !item.leyning?.torah || /Exodus/.test(item.leyning.torah)) return item;
  const reading = cholHamoedSukkotReading(ROMAN[match[1]], { israel });
  if (!reading) return item;
  // Hebcal's own format ("Numbers 29:20-22, 29:17-22"): the book once, same-chapter ranges shortened.
  const torah = `${NUM} ${[...new Set(reading.map(aliyah => aliyah.ref))].map(ref => ref.replace(`${NUM} `, '').replace(/^(\d+):(\d+)-\1:(\d+)$/, '$1:$2-$3')).join(', ')}`;
  return { ...item, leyning: { ...item.leyning, torah, aliyot: reading, source: READINGS_SOURCE } };
}
export const correctCalendarLeynings = (items, options) => (Array.isArray(items) ? items.map(item => correctCalendarLeyning(item, options)) : items);
