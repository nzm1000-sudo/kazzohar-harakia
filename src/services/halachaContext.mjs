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

// Decides which verified-content category is contextually relevant today.
// Returns null on an ordinary day, meaning "rotate across every category".
export function contextualHalachaCategory(context = {}) {
  if (context.isRoshChodesh) return 'prayer';
  if (context.isYomTov || context.isCholHaMoed) return 'holidays';
  const days = daysBetween(context.key, context.upcomingHoliday?.date);
  if (days !== null && days >= 0 && days <= 2) return 'holidays';
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

// Picks a verified practical halacha for today: contextually filtered when relevant,
// deterministically seeded by the Jewish day key, and rotated away from recently
// shown entries so repeated app opens do not keep surfacing the same one.
export function pickDailyHalacha(context = {}, { storage = globalThis.localStorage, pool = PRACTICAL_HALACHA_QA } = {}) {
  const published = pool.filter(item => item.answerStatus === 'published');
  const category = contextualHalachaCategory(context);
  const filtered = category ? published.filter(item => item.category === category) : published;
  const source = filtered.length ? filtered : published;
  if (!source.length) return null;
  const seed = hashString(context.key || context.civil || '');
  const history = readHistory(storage);
  let index = seed % source.length;
  for (let attempt = 0; attempt < source.length && history.includes(source[index].id); attempt += 1) {
    index = (index + 1) % source.length;
  }
  const picked = source[index];
  writeHistory(storage, [...history, picked.id]);
  return { ...picked, contextCategory: category };
}
