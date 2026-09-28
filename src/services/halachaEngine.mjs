// Halacha Engine: which verified halachot matter right now, today, and next to the one being read.
// It reads the day from the app's own JewishContextEngine / dayContext output (never a second calendar), matches it
// against the contexts each entry was verified for, and only ever labels a pick with a reason that actually matched.
// No network, no model calls; the answers themselves are the published entries, unchanged.
import { publishedPracticalQuestions } from '../data/practicalHalachaQa.mjs';

// Hebcal month numbers, as JewishContextEngine reports them in hebrewDate.month.
const M = { NISAN: 1, IYYAR: 2, SIVAN: 3, TAMUZ: 4, AV: 5, ELUL: 6, TISHREI: 7, KISLEV: 9, TEVET: 10, SHVAT: 11, ADAR_I: 12, ADAR_II: 13 };

export const CONTEXT_LABELS = {
  'rosh-hashana': 'ראש השנה', 'aseret-yemei-teshuva': 'עשרת ימי תשובה', 'yom-kippur': 'יום הכיפורים', 'pre-sukkot': 'לקראת סוכות',
  sukkot: 'סוכות', 'hoshana-raba': 'הושענא רבה', 'simchat-torah': 'שמחת תורה', chanukah: 'חנוכה', 'tu-bishvat': 'ט״ו בשבט',
  adar: 'חודש אדר', purim: 'פורים', 'pesach-prep': 'לקראת פסח', pesach: 'פסח', 'chol-hamoed': 'חול המועד', omer: 'ספירת העומר',
  'lag-baomer': 'ל״ג בעומר', shavuot: 'שבועות', 'three-weeks': 'בין המצרים', 'nine-days': 'תשעת הימים', 'tisha-bav': 'תשעה באב',
  'fast-day': 'יום צום', elul: 'חודש אלול', 'yom-tov': 'יום טוב', 'erev-rosh-chodesh': 'ערב ראש חודש', 'rosh-chodesh': 'ראש חודש',
  'kiddush-levana': 'ברכת הלבנה', friday: 'לקראת שבת', shabbat: 'שבת', 'motzei-shabbat': 'מוצאי שבת', 'weekday-morning': 'בוקר של חול',
};

// How specific a context is: a festival outranks the season, the season outranks the week, the week outranks every day.
const WEIGHT = {
  'yom-kippur': 100, 'rosh-hashana': 100, pesach: 95, sukkot: 95, 'hoshana-raba': 97, 'simchat-torah': 97, shavuot: 95, 'tisha-bav': 100,
  purim: 95, chanukah: 92, 'lag-baomer': 90, 'tu-bishvat': 85, 'yom-tov': 88, 'chol-hamoed': 90, 'fast-day': 92, 'pesach-prep': 85,
  'pre-sukkot': 85, 'aseret-yemei-teshuva': 80, 'nine-days': 80, 'rosh-chodesh': 78, 'erev-rosh-chodesh': 70, omer: 72, 'three-weeks': 65,
  elul: 60, adar: 55, 'kiddush-levana': 45, friday: 62, shabbat: 70, 'motzei-shabbat': 68, 'weekday-morning': 30,
  meal: 12, home: 10, travel: 8, 'life-cycle': 6, daily: 5,
};

const inRange = (date, month, from, to) => date.month === month && date.day >= from && date.day <= to;

// The set of verified-content contexts that are true for this day and hour, derived from the day context only.
export function activeContexts(context = {}, now = new Date()) {
  const out = new Set(['daily', 'meal', 'home']);
  const date = context.hebrewDate || {};
  const isIsrael = context.isIsrael !== false;
  const weekday = Number.isInteger(context.weekday) ? context.weekday : null;
  const add = (condition, ...keys) => { if (condition) keys.forEach(key => out.add(key)); };
  if (date.month && date.day) {
    add(date.month === M.ELUL, 'elul');
    add(inRange(date, M.TISHREI, 1, 2), 'rosh-hashana');
    add(inRange(date, M.TISHREI, 1, 10), 'aseret-yemei-teshuva');
    add(inRange(date, M.TISHREI, 10, 10), 'yom-kippur');
    add(inRange(date, M.TISHREI, 11, 14), 'pre-sukkot');
    add(inRange(date, M.TISHREI, 15, 21), 'sukkot');
    add(inRange(date, M.TISHREI, 21, 21), 'hoshana-raba');
    add(inRange(date, M.TISHREI, isIsrael ? 22 : 23, isIsrael ? 22 : 23), 'simchat-torah');
    add(inRange(date, M.KISLEV, 20, 30) || inRange(date, M.TEVET, 1, 3) || context.chanukah, 'chanukah');
    add(inRange(date, M.SHVAT, 10, 15), 'tu-bishvat');
    const adar = date.month === M.ADAR_II || (date.month === M.ADAR_I && !context.hebrewDate?.leap && !isLeapYear(date.year));
    add(adar, 'adar');
    add((adar && date.day >= 11 && date.day <= 15) || context.purim, 'purim');
    add(inRange(date, M.NISAN, 1, 14), 'pesach-prep');
    add(inRange(date, M.NISAN, 15, isIsrael ? 21 : 22), 'pesach');
    add(inRange(date, M.NISAN, 16, 30) || date.month === M.IYYAR || inRange(date, M.SIVAN, 1, 5), 'omer');
    add(inRange(date, M.IYYAR, 18, 18), 'lag-baomer');
    add(inRange(date, M.SIVAN, 1, isIsrael ? 6 : 7), 'shavuot');
    add(inRange(date, M.TAMUZ, 17, 29) || inRange(date, M.AV, 1, 9), 'three-weeks');
    add(inRange(date, M.AV, 1, 9), 'nine-days');
    add(inRange(date, M.AV, 9, 10) && (date.day === 9 || context.fast), 'tisha-bav');
    add(date.day === 29 && !context.isRoshChodesh, 'erev-rosh-chodesh');
    add(date.day >= 7 && date.day <= 15, 'kiddush-levana');
  }
  add(context.isRoshChodesh, 'rosh-chodesh');
  add(context.isYomTov, 'yom-tov');
  add(context.isCholHaMoed, 'chol-hamoed');
  add(context.fast, 'fast-day');
  if (weekday !== null) {
    add(weekday === 4 || weekday === 5, 'friday');
    add(weekday === 6, 'shabbat');
    add(weekday === 0 && context.afterSunset, 'motzei-shabbat');
    add(weekday >= 0 && weekday <= 5 && !context.isYomTov && !context.afterSunset, 'weekday-morning');
  }
  return out;
}

function isLeapYear(year) { return Number.isInteger(year) && ((7 * year + 1) % 19) < 7; }

export function timeOfDayAt(now = new Date(), context = {}) {
  if (context.afterSunset) return 'night';
  const hour = now.getHours();
  return hour < 5 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
}

function hashString(value) {
  let hash = 0;
  for (const char of String(value || '')) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

// Avalanche step (murmur3 fmix32), so a new day reshuffles equal-scored entries instead of keeping their order.
function mix(value) {
  let h = value >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

// Scores one entry for this moment: its most specific active context, plus a small bonus for the right hour.
const FESTIVALS = new Set(['pesach', 'pesach-prep', 'sukkot', 'pre-sukkot', 'hoshana-raba', 'simchat-torah', 'shavuot', 'rosh-hashana', 'yom-kippur']);
const FESTIVAL_QUALIFIERS = new Set(['chol-hamoed', 'yom-tov']);

export function relevanceOf(entry, active, timeOfDay) {
  const contexts = entry.contexts || [];
  // "Chol HaMoed" or "Yom Tov" on an entry bound to one festival (Hallel of Chol HaMoed Pesach) holds only in that festival.
  const bound = contexts.some(key => FESTIVALS.has(key));
  const festivalActive = contexts.some(key => FESTIVALS.has(key) && active.has(key));
  const matched = contexts.filter(key => active.has(key) && !(bound && !festivalActive && FESTIVAL_QUALIFIERS.has(key)));
  if (!matched.length) return null;
  const best = matched.sort((a, b) => (WEIGHT[b] || 0) - (WEIGHT[a] || 0))[0];
  const score = (WEIGHT[best] || 0) + (entry.timeOfDay && entry.timeOfDay === timeOfDay ? 8 : 0) - (entry.timeOfDay && entry.timeOfDay !== timeOfDay ? 6 : 0);
  return { best, score, reason: CONTEXT_LABELS[best] || null };
}

// "הלכה רלוונטית עכשיו" + "הלכות היום": the strongest time-bound matches, rotated deterministically by the Jewish day
// key so the same day shows the same picks and the next day moves on. Only seasonal/weekly matches carry a reason.
export function halachotForNow(context = {}, { now = new Date(), pool = publishedPracticalQuestions(), count = 4 } = {}) {
  const active = activeContexts(context, now);
  const hour = timeOfDayAt(now, context);
  const seed = hashString(context.key || context.civil || '');
  const scored = pool.map(entry => ({ entry, rel: relevanceOf(entry, active, hour) })).filter(item => item.rel)
    .map(item => ({ ...item, tiebreak: mix(hashString(item.entry.id) ^ seed) }))
    .sort((a, b) => b.rel.score - a.rel.score || a.tiebreak - b.tiebreak);
  const timely = scored.filter(item => (WEIGHT[item.rel.best] || 0) >= 30);
  const everyday = scored.filter(item => (WEIGHT[item.rel.best] || 0) < 30);
  // One pick per topic first, so the day shows its range (sukkah, lulav, prayer) rather than three of one kind.
  const varied = [];
  const topics = new Set();
  for (const item of timely) if (!topics.has(item.entry.topic)) { topics.add(item.entry.topic); varied.push(item); }
  for (const item of timely) if (varied.length < count && !varied.includes(item)) varied.push(item);
  const picks = [...varied.slice(0, count), ...everyday].slice(0, count)
    .map(({ entry, rel }) => ({ entry, reason: (WEIGHT[rel.best] || 0) >= 30 ? rel.reason : null, context: rel.best }));
  return { now: picks[0] || null, today: picks.slice(1), active: [...active], timeOfDay: hour };
}

// Related halachot: the same Yalkut Yosef siman first, then the same subtopic/topic, then shared keywords.
export function relatedHalachot(entry, { pool = publishedPracticalQuestions(), limit = 4 } = {}) {
  if (!entry) return [];
  const source = entry.sources?.[0]?.localSourceId || '';
  const siman = source.split('-').slice(0, 4).join('-');
  const keywords = new Set([...(entry.searchKeywords || []), ...(entry.tags || [])].filter(Boolean));
  return pool.filter(other => other.id !== entry.id).map(other => {
    const otherSource = other.sources?.[0]?.localSourceId || '';
    let score = 0;
    if (siman && otherSource.split('-').slice(0, 4).join('-') === siman) score += 6;
    if (entry.subtopic && other.subtopic === entry.subtopic) score += 4;
    if (other.topic === entry.topic) score += 3;
    score += [...(other.searchKeywords || []), ...(other.tags || [])].filter(key => keywords.has(key)).length;
    return { other, score };
  }).filter(item => item.score >= 3).sort((a, b) => b.score - a.score || a.other.id.localeCompare(b.other.id)).slice(0, limit).map(item => item.other);
}

// "המשך קריאה": the last halachot opened, most recent first, kept on the device only.
const RECENT_KEY = 'kz-halacha-recent-v1';
const RECENT_LIMIT = 8;
const store = () => { try { return globalThis.localStorage || null; } catch { return null; } };
export function readRecentHalachot(storage = store()) {
  try { const list = JSON.parse(storage?.getItem(RECENT_KEY) || '[]'); return Array.isArray(list) ? list.filter(id => typeof id === 'string') : []; } catch { return []; }
}
export function recordHalachaOpened(id, storage = store()) {
  if (!id) return [];
  const next = [id, ...readRecentHalachot(storage).filter(other => other !== id)].slice(0, RECENT_LIMIT);
  try { storage?.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  return next;
}

export const RULE_TYPE_LABELS = { din: 'דין', minhag: 'מנהג', chumra: 'הידור / חומרא', machloket: 'יש בזה דעות' };
