import { civilDateKey, shiftCivilDate } from './civilDate.mjs';

export const CITIES = [
  { name: 'תל אביב', latitude: 32.0853, longitude: 34.7818, tzid: 'Asia/Jerusalem', il: true },
  { name: 'ירושלים', latitude: 31.778, longitude: 35.235, tzid: 'Asia/Jerusalem', il: true },
  { name: 'חיפה', latitude: 32.794, longitude: 34.989, tzid: 'Asia/Jerusalem', il: true },
  { name: 'באר שבע', latitude: 31.252, longitude: 34.791, tzid: 'Asia/Jerusalem', il: true },
  { name: 'צפת', latitude: 32.965, longitude: 35.498, tzid: 'Asia/Jerusalem', il: true },
  { name: 'ניו יורק', latitude: 40.713, longitude: -74.006, tzid: 'America/New_York', il: false },
  { name: 'לונדון', latitude: 51.507, longitude: -0.128, tzid: 'Europe/London', il: false },
];
export const DEFAULT_SETTINGS = { location: CITIES[0], il: true, candles: 20, night: 'tzeit85deg', dark: false, font: 20 };
const cache = new Map();
export async function getJSON(url, signal) {
  if (cache.has(url)) return cache.get(url);
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('המקור אינו זמין כרגע. נסו שוב.');
  const data = await response.json();
  if (data.error) throw new Error('המקור לא החזיר נתונים תקינים.');
  if (cache.size > 120) cache.delete(cache.keys().next().value);
  cache.set(url, data);
  return data;
}
export function calendarURL(start, end, settings) {
  const { location: l } = settings;
  const p = new URLSearchParams({ cfg: 'json', v: '1', start, end, maj: 'on', min: 'on', mod: 'on', nx: 'on', ss: 'on', s: 'on', o: 'on', d: 'on', F: 'on', c: 'on', geo: 'pos', latitude: l.latitude, longitude: l.longitude, tzid: l.tzid, b: settings.candles });
  if (settings.il) p.set('i', 'on');
  p.set('M', 'on'); // Hebcal 8.5-degree end-of-Shabbat method, explicitly labeled in UI.
  return `https://www.hebcal.com/hebcal?${p}`;
}
export async function calendar(start, end, settings, signal) {
  const data = await getJSON(calendarURL(start, end, settings), signal);
  if (!Array.isArray(data.items)) throw new Error('נתוני הלוח חסרים');
  return data.items;
}
export async function zmanim(date, settings, signal) {
  const l = settings.location;
  const p = new URLSearchParams({ cfg: 'json', date, latitude: l.latitude, longitude: l.longitude, tzid: l.tzid });
  const data = await getJSON(`https://www.hebcal.com/zmanim?${p}`, signal);
  if (data.date !== date || !data.times) throw new Error('נתוני הזמנים אינם תואמים לתאריך');
  return data.times;
}
export const onDate = (items, key) => (items || []).filter(e => e.date.slice(0, 10) === key);
export const hebrewLabel = events => {
  const d = events?.find(e => e.category === 'hebdate');
  return d?.heDateParts ? `${d.heDateParts.d} ${d.heDateParts.m} ${d.heDateParts.y}` : 'התאריך העברי אינו זמין';
};
export function timeLabel(value, tzid) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'לא ניתן לחישוב';
  return new Intl.DateTimeFormat('he-IL', { timeZone: tzid, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
}
export const ZMANIM = [
  ['alotHaShachar', 'עלות השחר', '16.1° מתחת לאופק'],
  ['misheyakir', 'משיכיר · טלית ותפילין', '11.5° מתחת לאופק'],
  ['sunrise', 'הנץ החמה', 'זריחה במישור, ללא תיקון גובה'],
  ['sofZmanShma', 'סוף זמן קריאת שמע', 'גר״א · 3 שעות זמניות מהנץ'],
  ['sofZmanShmaMGA', 'סוף זמן שמע · מגן אברהם', '72 דקות קבועות לפני הנץ ואחרי השקיעה'],
  ['sofZmanTfilla', 'סוף זמן תפילה', 'גר״א · 4 שעות זמניות מהנץ'],
  ['chatzot', 'חצות היום', 'חצות שמש'],
  ['minchaGedola', 'מנחה גדולה', '6.5 שעות זמניות'],
  ['minchaKetana', 'מנחה קטנה', '9.5 שעות זמניות'],
  ['plagHaMincha', 'פלג המנחה', '10.75 שעות זמניות'],
  ['sunset', 'שקיעת החמה', 'שקיעה במישור, ללא תיקון גובה'],
  ['tzeit85deg', 'צאת הכוכבים', '8.5° מתחת לאופק'],
  ['tzeit72min', 'רבנו תם · 72 דקות', '72 דקות קבועות אחרי השקיעה; קיימות שיטות נוספות'],
];
export function monthCells(key) {
  const first = key.slice(0, 7) + '-01';
  const weekday = new Date(first + 'T12:00:00Z').getUTCDay();
  return Array.from({ length: 42 }, (_, i) => shiftCivilDate(first, i - weekday));
}
export function monthShift(key, amount) {
  const d = new Date(key.slice(0, 7) + '-01T12:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + amount);
  return d.toISOString().slice(0, 10);
}
export function localToday(settings, now = new Date()) { return civilDateKey(now, settings.location.tzid); }
