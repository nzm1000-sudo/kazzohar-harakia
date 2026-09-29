// השעון היהודי — the anchors an alarm can follow. Every anchor is a time the app ALREADY computes and shows elsewhere;
// nothing here defines a new halachic time. The daily zmanim are the keys of computeZmanim() (services/zmanimLocal.mjs,
// the same values TodayPage and the זמנים screen show), named as in ZMANIM (services.mjs). The Shabbat / Yom Tov
// anchors are the candle-lighting and havdalah events of @hebcal/core with the app's own settings (candle minutes,
// 8.5° nightfall — the same parameters services.mjs sends to Hebcal for the calendar). Fasts come from fastTimes.mjs,
// the Omer from @hebcal/core's Omer count, and Chanukah from the app's one verified lighting rule
// (data/halachaRules.mjs · 'chanukah-candles': כרבע שעה אחר השקיעה, ילקוט יוסף סימן תרעב).
import { ZMANIM } from '../../services.mjs';
import { HALACHA_RULES } from '../../data/halachaRules.mjs';

const zmanName = key => ZMANIM.find(([candidate]) => candidate === key)?.[1] || key;
const zmanMethod = key => ZMANIM.find(([candidate]) => candidate === key)?.[2] || '';

// The Chanukah rule exactly as the halacha engine holds it (minutes after which zman).
export const CHANUKAH_RULE = (() => {
  const rule = (HALACHA_RULES || []).find(item => item.id === 'chanukah-candles');
  return rule ? Object.freeze({ zman: rule.zman, minutes: rule.minutes, evidence: rule.evidence, entryId: rule.entryId }) : null;
})();

// kind: 'daily' — every day (the recurrence chooses the days) · 'event' — only on the days the calendar has it.
const daily = (id, short, extra = {}) => ({ id, kind: 'daily', zman: id, label: zmanName(id), short, method: zmanMethod(id), ...extra });
const event = (id, label, short, extra) => ({ id, kind: 'event', label, short, ...extra });

export const ANCHORS = Object.freeze({
  alotHaShachar: daily('alotHaShachar', 'עלות השחר'),
  misheyakir: daily('misheyakir', 'משיכיר', { label: 'זמן טלית ותפילין (משיכיר)', tile: 'טלית ותפילין' }),
  sunrise: daily('sunrise', 'הנץ'),
  sofZmanShma: daily('sofZmanShma', 'סוף זמן קריאת שמע'),
  sofZmanShmaMGA: daily('sofZmanShmaMGA', 'סוף זמן ק״ש (מג״א)', { label: 'סוף זמן קריאת שמע · מגן אברהם', tile: 'סוף ק״ש · מג״א' }),
  sofZmanTfilla: daily('sofZmanTfilla', 'סוף זמן תפילה'),
  chatzot: daily('chatzot', 'חצות היום'),
  minchaGedola: daily('minchaGedola', 'מנחה גדולה'),
  minchaKetana: daily('minchaKetana', 'מנחה קטנה'),
  plagHaMincha: daily('plagHaMincha', 'פלג המנחה'),
  sunset: daily('sunset', 'השקיעה'),
  tzeit85deg: daily('tzeit85deg', 'צאת הכוכבים'),
  tzeit72min: daily('tzeit72min', 'רבנו תם', { label: 'רבנו תם' }),
  'candles-shabbat': event('candles-shabbat', 'הדלקת נרות שבת', 'הדלקת הנרות', { method: 'לפי דקות ההדלקה שבהגדרות, לפני השקיעה', recurrence: 'בכל ערב שבת' }),
  'candles-yomtov': event('candles-yomtov', 'הדלקת נרות יום טוב', 'הדלקת הנרות', { method: 'לפי לוח החגים והמיקום', recurrence: 'בכל ערב חג' }),
  'havdalah-shabbat': event('havdalah-shabbat', 'צאת שבת', 'צאת השבת', { method: 'צאת הכוכבים (8.5°)', recurrence: 'בכל מוצאי שבת' }),
  'havdalah-yomtov': event('havdalah-yomtov', 'צאת חג', 'צאת החג', { method: 'צאת הכוכבים (8.5°)', recurrence: 'בכל מוצאי חג' }),
  'rt-shabbat': event('rt-shabbat', 'צאת שבת · רבנו תם', 'רבנו תם', { method: '72 דקות אחרי השקיעה', recurrence: 'בכל מוצאי שבת' }),
  'fast-start': event('fast-start', 'תחילת הצום', 'תחילת הצום', { method: 'לפי סוג הצום: עלות השחר, או השקיעה בערב ט׳ באב, או הדלקת הנרות בערב יום הכיפורים', recurrence: 'בימי הצומות בלבד' }),
  'fast-end': event('fast-end', 'סיום הצום', 'סוף הצום', { method: 'צאת הכוכבים (8.5°)', recurrence: 'בימי הצומות בלבד' }),
  omer: event('omer', 'ספירת העומר', 'צאת הכוכבים', { method: 'בלילות ספירת העומר, מצאת הכוכבים', recurrence: 'בלילות ספירת העומר בלבד' }),
  ...(CHANUKAH_RULE ? { chanukah: event('chanukah', 'הדלקת נרות חנוכה', 'זמן ההדלקה', { method: `${CHANUKAH_RULE.evidence} (ילקוט יוסף)`, recurrence: 'בלילות חנוכה, בימי החול' }) } : {}),
});

export const ANCHOR_GROUPS = Object.freeze([
  { id: 'morning', title: 'בוקר', anchors: ['alotHaShachar', 'misheyakir', 'sunrise', 'sofZmanShma', 'sofZmanShmaMGA', 'sofZmanTfilla'] },
  { id: 'day', title: 'צהריים ואחר הצהריים', anchors: ['chatzot', 'minchaGedola', 'minchaKetana', 'plagHaMincha'] },
  { id: 'evening', title: 'ערב', anchors: ['sunset', 'tzeit85deg', 'tzeit72min'] },
  { id: 'shabbat', title: 'שבת וחג', anchors: ['candles-shabbat', 'havdalah-shabbat', 'rt-shabbat', 'candles-yomtov', 'havdalah-yomtov'] },
  { id: 'fasts', title: 'צומות', anchors: ['fast-start', 'fast-end'] },
  { id: 'seasons', title: 'זמנים בשנה', anchors: ['omer', ...(CHANUKAH_RULE ? ['chanukah'] : [])] },
].map(group => ({ ...group, anchors: group.anchors.filter(id => ANCHORS[id]) })));

export const isAnchor = id => Object.prototype.hasOwnProperty.call(ANCHORS, id);
export const anchorOf = id => (isAnchor(id) ? ANCHORS[id] : null);
