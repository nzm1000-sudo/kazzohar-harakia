import { PRACTICAL_HALACHA_QA } from '../data/practicalHalachaQa.mjs';

const STORAGE_KEY = 'kz-halacha-rotation-v1';
const HISTORY_LIMIT = 5;

function daysBetween(fromKey, toKey) {
  if (!fromKey || !toKey) return null;
  const from = new Date(`${String(fromKey).slice(0, 10)}T00:00:00Z`);
  const to = new Date(`${String(toKey).slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return null;
  return Math.round((to - from) / 86400000);
}

// Maps an actual Hebcal holiday name (English "desc" or Hebrew title) to one of the
// semantic tags used on PRACTICAL_HALACHA_QA — never a guess, only literal name matches.
export function holidayTagFor(name) {
  const value = String(name || '');
  if (/sukkot|sukkah|hoshana|shemini atzeret|simchat torah|סוכות|הושענא|שמיני עצרת|שמחת תורה/i.test(value)) return 'sukkot';
  if (/pesach|passover|פסח/i.test(value)) return 'pesach';
  if (/shavuot|שבועות/i.test(value)) return 'shavuot';
  if (/rosh hashana|ראש השנה/i.test(value)) return 'rosh-hashanah';
  if (/yom kippur|כיפור/i.test(value)) return 'yom-kippur';
  if (/chanukah|hanukkah|חנוכה/i.test(value)) return 'chanukah';
  if (/purim|פורים/i.test(value)) return 'purim';
  return null;
}

// Decides which verified-content tag is contextually relevant today, in priority order:
// today's own special day, an imminent (~2 day) holiday, Rosh Chodesh, then the
// Wednesday-through-Friday Shabbat lead-up. Returns null on an ordinary day, meaning
// "rotate across every tag". This never invents a label — see pickDailyHalacha's
// honest fallback when the corpus has no verified item for the requested tag.
export function contextualHalachaCategory(context = {}) {
  const today = context.isYomTov || context.isCholHaMoed
    ? holidayTagFor(context.specialDay?.desc || context.specialDay?.hebrew || context.specialDay?.title)
    : null;
  if (today) return today;
  if (context.isRoshChodesh) return 'rosh-chodesh';
  const days = daysBetween(context.key, context.upcomingHoliday?.date);
  if (days !== null && days >= 0 && days <= 2) {
    const upcoming = holidayTagFor(context.upcomingHoliday?.desc || context.upcomingHoliday?.hebrew || context.upcomingHoliday?.title);
    if (upcoming) return upcoming;
  }
  if (context.isAseretYemeiTeshuvah) return 'aseret-yemei-teshuvah';
  if ([3, 4, 5].includes(context.weekday)) return 'shabbat';
  return null;
}

function hashString(value) {
  let hash = 0;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  return hash;
}

function readHistory(storage) {
  try {
    const value = JSON.parse(storage?.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeHistory(storage, history) {
  try { storage?.setItem(STORAGE_KEY, JSON.stringify(history.slice(-HISTORY_LIMIT))); } catch { /* storage unavailable */ }
}

// Picks a verified practical halacha for today: contextually tag-filtered when relevant,
// deterministically seeded by the Jewish day key, and rotated away from recently shown
// entries. If the requested tag has no verified content in the corpus, this honestly
// falls back to the general rotation instead of mislabeling unrelated content.
export function pickDailyHalacha(context = {}, { storage = globalThis.localStorage, pool = PRACTICAL_HALACHA_QA } = {}) {
  const published = pool.filter(item => item.answerStatus === 'published');
  const requestedTag = contextualHalachaCategory(context);
  const tagged = requestedTag ? published.filter(item => (item.tags || []).includes(requestedTag)) : [];
  const matchedTag = tagged.length ? requestedTag : null;
  const source = tagged.length ? tagged : published;
  if (!source.length) return null;
  const seed = hashString(context.key || context.civil || '');
  const history = readHistory(storage);
  let index = seed % source.length;
  for (let attempt = 0; attempt < source.length && history.includes(source[index].id); attempt += 1) {
    index = (index + 1) % source.length;
  }
  const picked = source[index];
  writeHistory(storage, [...history, picked.id]);
  return { ...picked, contextTag: matchedTag, requestedTag, fallback: Boolean(requestedTag) && !matchedTag };
}
