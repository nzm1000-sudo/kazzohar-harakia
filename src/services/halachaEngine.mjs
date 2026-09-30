// Halacha Engine: which verified halachot matter right now, today, and next to the one being read.
// It reads the day from the app's own JewishContextEngine / dayContext output (never a second calendar), matches it
// against the contexts each entry was verified for, and only ever labels a pick with a reason that actually matched.
// No network, no model calls; the answers themselves are the published entries, unchanged.
import { publishedPracticalQuestions, PRACTICAL_HALACHA_QA_INDEX } from '../data/practicalHalachaQa.mjs';
import { CONTEXT_GUIDES } from '../data/halachaContextGuides.mjs';
import { HALACHA_FLOWS } from '../data/halachaFlows.mjs';

// Hebcal month numbers, as JewishContextEngine reports them in hebrewDate.month.
const M = { NISAN: 1, IYYAR: 2, SIVAN: 3, TAMUZ: 4, AV: 5, ELUL: 6, TISHREI: 7, KISLEV: 9, TEVET: 10, SHVAT: 11, ADAR_I: 12, ADAR_II: 13 };

export const CONTEXT_LABELS = {
  'rosh-hashana': 'ראש השנה', 'aseret-yemei-teshuva': 'עשרת ימי תשובה', 'yom-kippur': 'יום הכיפורים', 'pre-sukkot': 'לקראת סוכות',
  sukkot: 'סוכות', 'hoshana-raba': 'הושענא רבה', 'simchat-torah': 'שמחת תורה', chanukah: 'חנוכה', 'tu-bishvat': 'ט״ו בשבט',
  adar: 'חודש אדר', purim: 'פורים', 'pesach-prep': 'לקראת פסח', pesach: 'פסח', 'chol-hamoed': 'חול המועד', omer: 'ספירת העומר',
  'lag-baomer': 'ל״ג בעומר', 'seder-night': 'ליל הסדר', 'sukkot-first-night': 'ליל סוכות', shavuot: 'שבועות', 'three-weeks': 'בין המצרים', 'nine-days': 'תשעת הימים', 'tisha-bav': 'תשעה באב',
  'fast-day': 'יום צום', elul: 'חודש אלול', 'yom-tov': 'יום טוב', 'erev-rosh-chodesh': 'ערב ראש חודש', 'rosh-chodesh': 'ראש חודש',
  'kiddush-levana': 'ברכת הלבנה', friday: 'לקראת שבת', shabbat: 'שבת', 'motzei-shabbat': 'מוצאי שבת', 'weekday-morning': 'בוקר של חול',
};

// How specific a context is: a festival outranks the season, the season outranks the week, the week outranks every day.
const WEIGHT = {
  'yom-kippur': 100, 'rosh-hashana': 100, pesach: 95, sukkot: 95, 'hoshana-raba': 97, 'simchat-torah': 97, shavuot: 95, 'tisha-bav': 100,
  purim: 95, chanukah: 92, 'seder-night': 98, 'sukkot-first-night': 96, 'lag-baomer': 90, 'tu-bishvat': 85, 'yom-tov': 88, 'chol-hamoed': 90, 'fast-day': 92, 'pesach-prep': 85,
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
    add(inRange(date, M.TISHREI, 14, isIsrael ? 15 : 16), 'sukkot-first-night');
    add(inRange(date, M.TISHREI, 21, 21), 'hoshana-raba');
    add(inRange(date, M.TISHREI, isIsrael ? 22 : 23, isIsrael ? 22 : 23), 'simchat-torah');
    add(inRange(date, M.KISLEV, 20, 30) || inRange(date, M.TEVET, 1, 3) || context.chanukah, 'chanukah');
    add(inRange(date, M.SHVAT, 10, 15), 'tu-bishvat');
    const adar = date.month === M.ADAR_II || (date.month === M.ADAR_I && !context.hebrewDate?.leap && !isLeapYear(date.year));
    add(adar, 'adar');
    add((adar && date.day >= 11 && date.day <= 15) || context.purim, 'purim');
    add(inRange(date, M.NISAN, 1, 14), 'pesach-prep');
    add(inRange(date, M.NISAN, 15, isIsrael ? 21 : 22), 'pesach');
    add(inRange(date, M.NISAN, 14, isIsrael ? 15 : 16), 'seder-night');
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
const EVERYDAY = new Set(['daily', 'meal', 'home', 'travel', 'life-cycle']);

export function relevanceOf(entry, active, timeOfDay) {
  const contexts = entry.contexts || [];
  // "Chol HaMoed" or "Yom Tov" on an entry bound to one festival (Hallel of Chol HaMoed Pesach) holds only in that festival.
  const bound = contexts.some(key => FESTIVALS.has(key));
  const festivalActive = contexts.some(key => FESTIVALS.has(key) && active.has(key));
  // An entry tied to a day or season (a festival, Shabbat, a fast, weekday mornings…) is relevant only then, even if it
  // also carries an everyday tag such as "meal" or "daily".
  const timeBound = contexts.filter(key => !EVERYDAY.has(key));
  if (timeBound.length && !timeBound.some(key => active.has(key))) return null;
  const matched = contexts.filter(key => active.has(key) && !(bound && !festivalActive && FESTIVAL_QUALIFIERS.has(key)));
  if (!matched.length) return null;
  const best = matched.sort((a, b) => (WEIGHT[b] || 0) - (WEIGHT[a] || 0))[0];
  const score = (WEIGHT[best] || 0) + (entry.timeOfDay && entry.timeOfDay === timeOfDay ? 8 : 0) - (entry.timeOfDay && entry.timeOfDay !== timeOfDay ? 6 : 0);
  return { best, score, reason: CONTEXT_LABELS[best] || null };
}

// "הלכה רלוונטית עכשיו" + "הלכות היום": the strongest time-bound matches, rotated deterministically by the Jewish day
// key so the same day shows the same picks and the next day moves on. Only seasonal/weekly matches carry a reason.
// A high-stakes book halacha (חולה, יולדת, תרופות) is never a "halacha for now": it is found when asked, not pushed.
export function halachotForNow(context = {}, { now = new Date(), pool = publishedPracticalQuestions().filter(entry => !entry.highStakes), count = 4 } = {}) {
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

// Related halachot, with the reason each is related. Strongest first: the same source section, the same siman, the
// same guided flow, the same subtopic, the same topic, shared keywords. Season-aware: an entry bound to a festival or a
// time of year is offered only for an entry of that same season, or when that season is happening now — so Chol
// HaMoed Pesach Hallel is never suggested from a Chol HaMoed Sukkot page.
const SEASONAL = new Set(Object.keys(WEIGHT).filter(key => !EVERYDAY.has(key) && !['weekday-morning', 'friday', 'shabbat', 'motzei-shabbat'].includes(key)));
const seasonal = entry => (entry.contexts || []).filter(key => SEASONAL.has(key) && !FESTIVAL_QUALIFIERS.has(key));
let flowMembership = null;
const membership = () => flowMembership ||= HALACHA_FLOWS.reduce((map, flow) => {
  for (const outcome of Object.values(flow.outcomes)) for (const id of outcome.entryIds || []) map.set(id, [...new Set([...(map.get(id) || []), flow.id])]);
  return map;
}, new Map());

export function relatedWithReasons(entry, { pool = publishedPracticalQuestions(), limit = 4, context = null, now = new Date() } = {}) {
  if (!entry) return [];
  const source = entry.sources?.[0]?.localSourceId || '';
  const siman = source.split('-').slice(0, 4).join('-');
  const keywords = new Set([...(entry.searchKeywords || []), ...(entry.tags || [])].filter(Boolean));
  const own = new Set(seasonal(entry));
  const active = context ? activeContexts(context, now) : new Set();
  const flows = id => membership().get(id) || [];
  const myFlows = new Set(flows(entry.id));
  return pool.filter(other => other.id !== entry.id).map(other => {
    const theirs = seasonal(other);
    if (theirs.length && !theirs.some(key => own.has(key) || active.has(key))) return null;
    const otherSource = other.sources?.[0]?.localSourceId || '';
    const candidates = [];
    // A neighbouring case named by the entry itself (a condition that changes the answer) comes first.
    if ((entry.relatedQuestionIds || []).includes(other.id) || (other.relatedQuestionIds || []).includes(entry.id)) candidates.push([12, 'מקרה קרוב – פרט אחד משנה את הדין']);
    if (source && otherSource === source) candidates.push([10, 'מאותו סעיף במקור']);
    else if (siman && otherSource.split('-').slice(0, 4).join('-') === siman) candidates.push([6, 'מאותו סימן במקור']);
    if (flows(other.id).some(id => myFlows.has(id))) candidates.push([5, 'באותו בירור']);
    if (entry.subtopic && other.subtopic === entry.subtopic) candidates.push([4, 'באותו עניין']);
    if (other.topic === entry.topic) candidates.push([3, 'באותו נושא']);
    const shared = [...(other.searchKeywords || []), ...(other.tags || [])].filter(key => keywords.has(key)).length;
    const score = candidates.reduce((sum, [points]) => sum + points, 0) + shared;
    const reason = candidates.sort((a, b) => b[0] - a[0])[0]?.[1] || (shared ? 'מושגים משותפים' : null);
    return score >= 3 ? { entry: other, reason, score } : null;
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id)).slice(0, limit);
}

export function relatedHalachot(entry, options = {}) {
  return relatedWithReasons(entry, options).map(item => item.entry);
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

// "מה חשוב לדעת עכשיו": the first curated guide whose context is active today, with its entries resolved.
export function guideForNow(context = {}, now = new Date()) {
  const active = activeContexts(context, now);
  const guide = CONTEXT_GUIDES.find(item => active.has(item.context) && (!item.weekdays || item.weekdays.includes(context.weekday)));
  if (!guide) return null;
  return { ...guide, steps: guide.steps.map(step => ({ ...step, entries: step.entryIds.map(id => PRACTICAL_HALACHA_QA_INDEX[id]).filter(Boolean) })) };
}

// "הלכה לשעה זו" on the Today screen: six halachot a day, one per four-hour slot (00–04, 04–08 … 20–24). Each slot
// takes the strongest match for today's calendar at that time of day, never repeating an earlier slot of the same day;
// the choice is fixed for the whole slot (seeded by the Jewish day key and the slot). Sensitive or personal topics
// and long answers are left out: this is a gentle line on the home screen, not the place for them.
const SLOT_TIME = ['night', 'morning', 'morning', 'afternoon', 'evening', 'night'];
const SLOT_HOURS = 4;
export const halachaSlotOf = (now = new Date()) => Math.floor(now.getHours() / SLOT_HOURS);

export function halachaForSlot(context = {}, now = new Date(), { pool = publishedPracticalQuestions() } = {}) {
  const slot = halachaSlotOf(now);
  const seed = hashString(context.key || context.civil || now.toDateString());
  // The line shows the ruling alone, so an answer that leans on its question ("כן. …") is not used here.
  const eligible = pool.filter(entry => entry.category !== 'purity' && entry.sensitivity !== 'sensitive' && !entry.personal && entry.shortAnswer && entry.shortAnswer.length <= 200 && !/^(כן|לא|לא\s+צריך)[.,]/.test(entry.shortAnswer.trim()));
  const picked = [];
  for (let current = 0; current <= slot; current++) {
    const at = new Date(now);
    at.setHours(current * SLOT_HOURS + 2, 0, 0, 0);
    const active = activeContexts(context, at);
    if (SLOT_TIME[current] !== 'morning') active.delete('weekday-morning');
    const best = eligible
      .filter(entry => !picked.some(item => item.entry.id === entry.id))
      .map(entry => ({ entry, rel: relevanceOf(entry, active, SLOT_TIME[current]) }))
      .filter(item => item.rel)
      .map(item => ({ ...item, tiebreak: mix(hashString(item.entry.id) ^ seed ^ Math.imul(current + 1, 2654435761)) }))
      .sort((a, b) => b.rel.score - a.rel.score || a.tiebreak - b.tiebreak)[0];
    if (!best) break;
    picked.push({ entry: best.entry, reason: (WEIGHT[best.rel.best] || 0) >= 30 ? best.rel.reason : null, slot: current });
  }
  return picked[slot] || picked[picked.length - 1] || null;
}

// An entry bound only to a season that is not now (no everyday tag): in search results it yields to a timeless or
// in-season answer unless the question names that season.
export function outOfSeason(entry, active) {
  const contexts = entry.contexts || [];
  // "daily" (and travel / life-cycle) make an entry timeless; "home" and "meal" only say where it applies.
  if (!contexts.length || contexts.some(key => ['daily', 'travel', 'life-cycle'].includes(key))) return false;
  const keys = seasonal(entry);
  return keys.length > 0 && !keys.some(key => active.has(key));
}
