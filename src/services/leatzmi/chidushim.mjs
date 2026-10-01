// חידושי התורה שלי — the user's own Torah thoughts. Private by default and kept on this device only; nothing leaves it
// unless the user shares one (the share sheet) or sends one to the app's collection (sharedRepository.mjs — an email
// the user sends themselves).
//
// Storage: localStorage 'kz-leatzmi-chidushim-v1' = { v: 1, items: [Chidush] }
// Chidush: { id, title, body, createdAt, updatedAt, hebrewDate, jewishDateKey, category, tags[], sources[], parasha,
//            topic (book / tractate / subject), status ('private' | 'ready' | 'submitted'), favorite, pinned,
//            followUpOf (the id of the chidush it reflects on, or null), submittedAt, revisions[{ at, title, body }] }
// Migration: nothing stored → empty; a bare array (an earlier shape) → wrapped; unknown fields kept; missing fields filled.
// The store is never wiped: a failed read returns the stored text untouched on the next successful one.
import { HDate } from '@hebcal/core';
import { hebrewNumeral } from '../hebrewNumerals.mjs';
import { defaultStorage, emit, foldHebrew, newId, readJSON, subscribe, toIso, toMs, writeJSON } from './storage.mjs';

export const CHIDUSHIM_KEY = 'kz-leatzmi-chidushim-v1';
export const CHIDUSHIM_EVENT = 'kz-leatzmi-chidushim-change';
export const STATUS = Object.freeze({ PRIVATE: 'private', READY: 'ready', SUBMITTED: 'submitted' });
export const STATUS_LABEL = Object.freeze({ private: 'פרטי', ready: 'מיועד לשיתוף', submitted: 'נשלח למאגר' });
export const CATEGORIES = Object.freeze([
  ['torah', 'תורה ופרשה'],
  ['neviim', 'נביאים וכתובים'],
  ['talmud', 'גמרא ומשנה'],
  ['halacha', 'הלכה'],
  ['tefila', 'תפילה'],
  ['moadim', 'מועדים'],
  ['machshava', 'מחשבה ומוסר'],
  ['other', 'אחר'],
]);
export const categoryLabel = id => CATEGORIES.find(([key]) => key === id)?.[1] || '';
const MAX_REVISIONS = 20;
const REVISION_GAP_MS = 10 * 60 * 1000; // autosave keeps one revision per ten minutes of editing, not one per keystroke

const MONTHS = ['', 'ניסן', 'אייר', 'סיון', 'תמוז', 'אב', 'אלול', 'תשרי', 'חשון', 'כסלו', 'טבת', 'שבט', 'אדר', 'אדר ב׳'];
// "י״ב בתשרי תשפ״ז" for a moment (civil midnight boundary; the label is a gentle note, not a halachic date).
export function hebrewDateLabel(when = new Date()) {
  try {
    const hd = new HDate(new Date(toMs(when)));
    const leap = HDate.isLeapYear(hd.getFullYear());
    const month = hd.getMonth();
    const name = month === 12 && leap ? 'אדר א׳' : MONTHS[month];
    return `${hebrewNumeral(hd.getDate())} ב${name} ${hebrewNumeral(hd.getFullYear(), { year: true })}`;
  } catch { return ''; }
}

const str = (value, max = 20000) => String(value ?? '').slice(0, max);
const list = value => (Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,،\n]/) : []).map(item => String(item).trim()).filter(Boolean);

export function normalizeChidush(item, now = Date.now()) {
  const createdAt = item.createdAt || toIso(now);
  return {
    ...item,
    id: String(item.id || newId('ch')),
    title: str(item.title, 300),
    body: str(item.body),
    createdAt,
    updatedAt: item.updatedAt || createdAt,
    hebrewDate: item.hebrewDate || hebrewDateLabel(createdAt),
    jewishDateKey: item.jewishDateKey || toIso(createdAt).slice(0, 10),
    category: CATEGORIES.some(([key]) => key === item.category) ? item.category : 'other',
    tags: list(item.tags),
    sources: list(item.sources),
    parasha: str(item.parasha, 80),
    topic: str(item.topic, 160),
    status: Object.values(STATUS).includes(item.status) ? item.status : STATUS.PRIVATE,
    favorite: Boolean(item.favorite),
    pinned: Boolean(item.pinned),
    followUpOf: item.followUpOf || null,
    submittedAt: item.submittedAt || null,
    revisions: Array.isArray(item.revisions) ? item.revisions.filter(rev => rev && typeof rev === 'object').slice(-MAX_REVISIONS) : [],
  };
}

export function loadChidushim(storage = defaultStorage()) {
  const raw = readJSON(storage, CHIDUSHIM_KEY, null);
  const items = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];
  return items.filter(item => item && typeof item === 'object').map(item => normalizeChidush(item));
}
function saveAll(items, storage) {
  writeJSON(storage, CHIDUSHIM_KEY, { v: 1, items });
  emit(CHIDUSHIM_EVENT);
  return items;
}
export const getChidush = (id, storage = defaultStorage()) => loadChidushim(storage).find(item => item.id === id) || null;

export function createChidush(fields = {}, { storage = defaultStorage(), now = Date.now() } = {}) {
  const at = toIso(now);
  const item = normalizeChidush({ ...fields, id: fields.id || newId('ch'), createdAt: at, updatedAt: at, status: fields.status || STATUS.PRIVATE, revisions: [] }, now);
  saveAll([item, ...loadChidushim(storage)], storage);
  return item;
}

// Editable fields only; the id, the dates of creation and the submission record never change here.
const EDITABLE = ['title', 'body', 'category', 'tags', 'sources', 'parasha', 'topic', 'status', 'favorite', 'pinned'];
export function updateChidush(id, changes = {}, { storage = defaultStorage(), now = Date.now() } = {}) {
  const items = loadChidushim(storage);
  const index = items.findIndex(item => item.id === id);
  if (index < 0) return null;
  const before = items[index];
  const patch = Object.fromEntries(Object.entries(changes).filter(([key]) => EDITABLE.includes(key)));
  const textChanged = ('title' in patch && patch.title !== before.title) || ('body' in patch && patch.body !== before.body);
  let revisions = before.revisions;
  if (textChanged && (before.title || before.body)) {
    // The text as it was before this stretch of editing is kept — one revision per stretch, not one per keystroke.
    const last = revisions[revisions.length - 1];
    if (!last || toMs(now) - toMs(last.savedAt || last.at) >= REVISION_GAP_MS) {
      revisions = [...revisions, { at: before.updatedAt, savedAt: toIso(now), title: before.title, body: before.body }].slice(-MAX_REVISIONS);
    }
  }
  const next = normalizeChidush({ ...before, ...patch, revisions, updatedAt: Object.keys(patch).some(key => !['favorite', 'pinned', 'status'].includes(key) && JSON.stringify(patch[key]) !== JSON.stringify(before[key])) ? toIso(now) : before.updatedAt }, now);
  items[index] = next;
  saveAll(items, storage);
  return next;
}

export function deleteChidush(id, storage = defaultStorage()) {
  const items = loadChidushim(storage);
  const next = items.filter(item => item.id !== id);
  if (next.length === items.length) return false;
  saveAll(next, storage);
  return true;
}

export const toggleChidushFavorite = (id, options) => { const item = getChidush(id, options?.storage); return item ? updateChidush(id, { favorite: !item.favorite }, options) : null; };
export const toggleChidushPinned = (id, options) => { const item = getChidush(id, options?.storage); return item ? updateChidush(id, { pinned: !item.pinned }, options) : null; };

// Marking a chidush as sent to the collection changes its status only — never its text.
export function markSubmitted(id, { storage = defaultStorage(), now = Date.now() } = {}) {
  const items = loadChidushim(storage);
  const index = items.findIndex(item => item.id === id);
  if (index < 0) return null;
  items[index] = { ...items[index], status: STATUS.SUBMITTED, submittedAt: toIso(now) };
  saveAll(items, storage);
  return items[index];
}

// "מה אני חושב על זה היום?" — a new note that points at the old one; the original stays exactly as it was.
export function createFollowUp(originalId, fields = {}, options = {}) {
  const original = getChidush(originalId, options.storage ?? defaultStorage());
  if (!original) return null;
  return createChidush({ title: fields.title ?? `מחשבה נוספת: ${original.title || 'חידוש'}`, body: fields.body ?? '', category: original.category, parasha: original.parasha, topic: original.topic, tags: original.tags, sources: original.sources, followUpOf: original.id }, options);
}
export const followUpsOf = (id, items) => items.filter(item => item.followUpOf === id);

// ---------- search, sort, filter ----------
// The index is built once per change of the list (memoised by the page), so typing only scans prepared strings.
export function buildChidushIndex(items) {
  return items.map(item => ({ id: item.id, text: foldHebrew([item.title, item.body, item.topic, item.parasha, categoryLabel(item.category), ...item.tags, ...item.sources].join(' ')) }));
}
export function searchChidushim(index, query) {
  const terms = foldHebrew(query).split(' ').filter(Boolean);
  if (!terms.length) return null;
  return new Set(index.filter(entry => terms.every(term => entry.text.includes(term))).map(entry => entry.id));
}
export const SORTS = Object.freeze([['updated', 'עדכון אחרון'], ['created', 'החדשים'], ['oldest', 'הישנים'], ['title', 'לפי כותרת']]);
export function sortChidushim(items, sort = 'updated') {
  const by = {
    updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    created: (a, b) => b.createdAt.localeCompare(a.createdAt),
    oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
    title: (a, b) => (a.title || '').localeCompare(b.title || '', 'he'),
  }[sort] || ((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  // Pinned ones stay first in every order.
  return [...items].sort((a, b) => (b.pinned - a.pinned) || by(a, b));
}
export function filterChidushim(items, { ids = null, category = '', favorite = false, status = '' } = {}) {
  return items.filter(item => (!ids || ids.has(item.id)) && (!category || item.category === category) && (!favorite || item.favorite) && (!status || item.status === status));
}

// Plain text of a chidush for sharing (the share sheet) or for the collection's email.
export function chidushPlainText(item, { attribution = '' } = {}) {
  const lines = [item.title, '', item.body.trim()];
  const where = [item.parasha && `פרשת ${item.parasha}`, item.topic, ...item.sources].filter(Boolean);
  if (where.length) lines.push('', `מקורות: ${where.join(' · ')}`);
  if (attribution) lines.push('', attribution);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export const onChidushimChange = listener => subscribe(CHIDUSHIM_EVENT, listener);
