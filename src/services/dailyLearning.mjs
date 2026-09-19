const KEY = 'kz-daily-learning-v1';
const MAX_DAYS = 30;

function storageValue(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem(KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function save(value, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY, JSON.stringify(value)); } catch {}
}

export function getDailyProgress(dayKey, storage) {
  if (!dayKey) return {};
  return storageValue(storage)[dayKey] || {};
}

export function setDailyCompletion(dayKey, itemId, completed, storage) {
  if (!dayKey || !itemId) return getDailyProgress(dayKey, storage);
  const current = storageValue(storage);
  const next = { ...current, [dayKey]: { ...(current[dayKey] || {}), [itemId]: Boolean(completed) } };
  const keys = Object.keys(next).sort().slice(-MAX_DAYS);
  save(Object.fromEntries(keys.map(key => [key, next[key]])), storage);
  return next[dayKey];
}

export const dailyLearningStorageKey = KEY;