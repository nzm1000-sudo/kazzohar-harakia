import { findNameVerses, normalizeName } from './personalTools.mjs';
import { PUBLISHED_BABY_NAMES, REVIEW_BABY_NAMES, BABY_NAMES_META } from '../data/babyNames.mjs';

export const BABY_NAMES_KEYS = Object.freeze({ favorites: 'kz-baby-names-favorites-v1' });

const GEMATRIA = Object.freeze({ א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9, י: 10, כ: 20, ך: 20, ל: 30, מ: 40, ם: 40, נ: 50, ן: 50, ס: 60, ע: 70, פ: 80, ף: 80, צ: 90, ץ: 90, ק: 100, ר: 200, ש: 300, ת: 400 });
const stripHebrewMarks = value => String(value || '').replace(/[\u0591-\u05C7]/g, '').replace(/[\u05BE\u05C0\u05C3\u05F3\u05F4\u200C\u200D\s-]/g, '');

export function gematriaBreakdown(name) {
  const letters = [...stripHebrewMarks(name)].filter(letter => GEMATRIA[letter]);
  return letters.map(letter => ({ letter, value: GEMATRIA[letter] }));
}

export function gematria(name) {
  const breakdown = gematriaBreakdown(name);
  if (!breakdown.length || normalizeName(name).length === 0) return null;
  const total = breakdown.reduce((sum, item) => sum + item.value, 0);
  return { total, reduced: reduceGematria(total), breakdown };
}

export function reduceGematria(value) {
  let result = Number(value);
  if (!Number.isInteger(result) || result < 1) return null;
  while (result > 9) result = [...String(result)].reduce((sum, digit) => sum + Number(digit), 0);
  return result;
}

export function getBabyName(name) {
  const normalized = normalizeName(name).toLocaleLowerCase();
  return PUBLISHED_BABY_NAMES.find(item => item.id === name || (typeof name === 'string' && (item.legacyIds || []).includes(name)) || (typeof name === 'string' && name.startsWith(`baby-name-${normalizeName(item.canonicalHebrew)}-`)) || [item.name, item.canonicalHebrew, ...(item.aliases || []), ...(item.relatedSpellings || [])]
    .some(value => normalizeName(value).toLocaleLowerCase() === normalized)) || null;
}

export function filterBabyNames({ gender = 'all', query = '', firstLetter = '', type = 'all', reduced = '', favorites = [], favoritesOnly = false } = {}) {
  const normalizedQuery = normalizeName(query).toLocaleLowerCase();
  const favoriteSet = new Set(favorites);
  return PUBLISHED_BABY_NAMES.filter(item => {
    const values = [item.name, ...(item.aliases || []), ...(item.relatedSpellings || [])]
      .map(value => normalizeName(value).toLocaleLowerCase());
    const number = gematria(item.name)?.reduced;
    const genderMatch = gender === 'all' || item.usage === gender || item.usage === 'לשניהם';
    const queryMatch = !normalizedQuery || values.some(value => value.includes(normalizedQuery));
    const letterMatch = !firstLetter || item.name.startsWith(firstLetter);
    const typeMatch = type === 'all' || item.type === type || (type === 'טבע ומקומות' && item.type === 'מקום');
    const numberMatch = !reduced || number === Number(reduced);
    const favoriteMatch = !favoritesOnly || favoriteSet.has(item.id);
    return genderMatch && queryMatch && letterMatch && typeMatch && numberMatch && favoriteMatch;
  }).sort((a, b) => a.name.localeCompare(b.name, 'he'));
}

export function loadBabyNameFavorites() {
  try {
    const value = JSON.parse(localStorage.getItem(BABY_NAMES_KEYS.favorites) || '[]');
    if (!Array.isArray(value)) return [];
    const migrated = value.map(entry => getBabyName(entry)?.id).filter(Boolean);
    const unique = [...new Set(migrated)];
    if (unique.length !== value.length || unique.some((id, index) => id !== value[index])) {
      try { localStorage.setItem(BABY_NAMES_KEYS.favorites, JSON.stringify(unique)); } catch {}
    }
    return unique;
  } catch { return []; }
}

export function saveBabyNameFavorites(favorites) {
  const value = [...new Set(favorites.map(entry => getBabyName(entry)?.id).filter(Boolean))];
  try { localStorage.setItem(BABY_NAMES_KEYS.favorites, JSON.stringify(value)); } catch {}
  return value;
}

export function versesForBabyName(name) {
  return findNameVerses(name);
}

export { BABY_NAMES_META, PUBLISHED_BABY_NAMES, REVIEW_BABY_NAMES };
