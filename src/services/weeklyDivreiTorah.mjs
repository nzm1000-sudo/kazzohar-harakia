// Which three divrei torah the Shabbat table shows this week. Pure: calendar items and the Jewish-day
// key in (sunset-aware, so Motzaei Shabbat already belongs to the new week), a focus out.
//   • From Sunday until Motzaei Shabbat: the parasha of the coming Shabbat.
//   • A festival that falls during the week — today (Chol HaMoed included) or before Shabbat, or on
//     Shabbat itself — takes its place, and the festival's divrei torah are shown instead.
import { HOLIDAY_DIVREI_TORAH, PARASHA_DIVREI_TORAH } from '../data/divreiTorah.mjs';

export const HOLIDAY_LABELS = Object.freeze({
  'rosh-hashana': 'ראש השנה',
  'yom-kippur': 'יום כיפור',
  sukkot: 'סוכות',
  'shmini-atzeret': 'שמיני עצרת ושמחת תורה',
  chanukah: 'חנוכה',
  'tu-bishvat': 'ט״ו בשבט',
  purim: 'פורים',
  pesach: 'פסח',
  'lag-baomer': 'ל״ג בעומר',
  shavuot: 'שבועות',
  'tisha-bav': 'תשעה באב',
});

// Order matters: Shemini Atzeret before Sukkot. Erev days, Pesach Sheni and Purim Katan are not the festival.
const MATCHERS = [
  [/rosh hashana|ראש השנה/i, 'rosh-hashana'],
  [/yom kippur|יום כיפור/i, 'yom-kippur'],
  [/shmini atzeret|simchat torah|שמיני עצרת|שמחת תורה/i, 'shmini-atzeret'],
  [/sukkot|סוכות/i, 'sukkot'],
  [/chanukah|hanukkah|חנוכה/i, 'chanukah'],
  [/tu bishvat|ט״ו בשבט/i, 'tu-bishvat'],
  [/purim|פורים/i, 'purim'],
  [/pesach|passover|פסח/i, 'pesach'],
  [/lag baomer|ל״ג בעומר/i, 'lag-baomer'],
  [/shavuot|שבועות/i, 'shavuot'],
  [/tish.?a b.?av|תשעה באב/i, 'tisha-bav'],
];
const NOT_THE_FESTIVAL = /\berev\b|ערב |pesach sheni|פסח שני|purim katan|פורים קטן/i;

export function holidayIdFor(item) {
  const text = `${item?.title || ''} ${item?.hebrew || ''}`;
  if (item?.category !== 'holiday' || NOT_THE_FESTIVAL.test(text)) return null;
  return MATCHERS.find(([pattern]) => pattern.test(text))?.[1] || null;
}

const weekday = key => new Date(`${key}T12:00:00Z`).getUTCDay();
const addDays = (key, days) => new Date(new Date(`${key}T12:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);
export const comingShabbatKey = todayKey => addDays(todayKey, (6 - weekday(todayKey) + 7) % 7);

const normalizeParasha = name => String(name || '').replace(/^(?:Parashat|פרשת)\s+/i, '').replace(/[׳״'"]/g, '').replace(/\s+/g, ' ').trim();
const PARASHA_LOOKUP = new Map(Object.entries(PARASHA_DIVREI_TORAH).map(([name, list]) => [normalizeParasha(name), { name, list }]));

// Combined readings ("תזריע־מצורע") use the first half.
export function parashaDivreiTorah(parashaName) {
  const key = normalizeParasha(parashaName);
  if (!key) return null;
  return PARASHA_LOOKUP.get(key) || key.split(/[־-]/).map(part => PARASHA_LOOKUP.get(normalizeParasha(part))).find(Boolean) || null;
}

export function weeklyDivreiTorah({ items = [], todayKey, parashaName = null } = {}) {
  if (todayKey) {
    const shabbatKey = comingShabbatKey(todayKey);
    const festival = (items || [])
      .map(item => ({ id: holidayIdFor(item), dateKey: item?.date?.slice?.(0, 10) }))
      .filter(entry => entry.id && entry.dateKey >= todayKey && entry.dateKey <= shabbatKey && HOLIDAY_DIVREI_TORAH[entry.id])
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))[0];
    if (festival) return { kind: 'holiday', id: festival.id, name: HOLIDAY_LABELS[festival.id], dateKey: festival.dateKey, items: HOLIDAY_DIVREI_TORAH[festival.id] };
  }
  const parasha = parashaDivreiTorah(parashaName);
  return parasha ? { kind: 'parasha', id: parasha.name, name: `פרשת ${parasha.name}`, items: parasha.list } : null;
}
