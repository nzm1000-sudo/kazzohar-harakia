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
