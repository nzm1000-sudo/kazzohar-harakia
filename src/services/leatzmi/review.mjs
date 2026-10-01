// חזרה אליי — a quiet, local spaced-repetition store (SM-2, simplified). Nothing here is ever shown as a number.
//
// STABLE API (used by בחן אותי — src/services/quiz/*):
//   enqueueReviewItem({ kind, refId, title, payload, topic }, { storage, now }) → item
//   recordReviewResult(id, grade, { storage, now }) → item | null
// kind: 'quiz' | 'chidush' | 'favorite' | 'halacha' | 'source'. id = `${kind}:${refId}`.
// grade: 0–5 (SM-2 quality), or a word: 'remembered' (4) · 'easy' (5) · 'correct' (4) · 'slow' (3) ·
//        'again' / 'wrong' / 'forgot' (1) · 'later' (snooze, no change to the schedule's strength).
// A quiz question answered wrong or slowly is enqueued by the quiz with its payload ({ q, options, answer, category,
// note… }); enqueueing it again (wrong again) brings it back sooner.
//
// Storage: localStorage 'kz-leatzmi-review-v1' = { v: 1, items: { [id]: Item } }
// Item: { id, kind, refId, title, payload, topic, addedAt, due, interval (days), ease, reps, lapses, lastGrade,
//         lastReviewedAt, seen }
import { defaultStorage, emit, readJSON, subscribe, toIso, toMs, writeJSON } from './storage.mjs';

export const REVIEW_KEY = 'kz-leatzmi-review-v1';
export const REVIEW_EVENT = 'kz-leatzmi-review-change';
export const REVIEW_KINDS = Object.freeze(['quiz', 'chidush', 'favorite', 'halacha', 'source']);
const DAY = 24 * 60 * 60 * 1000;
const MIN_EASE = 1.3;
const START_EASE = 2.5;
const SNOOZE_DAYS = 3;
const GRADE_WORDS = { remembered: 4, correct: 4, easy: 5, slow: 3, again: 1, wrong: 1, forgot: 1 };

export const reviewId = (kind, refId) => `${kind}:${refId}`;

function load(storage) {
  const raw = readJSON(storage, REVIEW_KEY, null);
  if (!raw || typeof raw !== 'object') return { v: 1, items: {} };
  // An array (an earlier draft shape) or a bare map → the versioned shape.
  if (Array.isArray(raw)) return { v: 1, items: Object.fromEntries(raw.filter(item => item?.id).map(item => [item.id, normalize(item)])) };
  const items = raw.items && typeof raw.items === 'object' ? raw.items : {};
  return { v: 1, items: Object.fromEntries(Object.entries(items).filter(([, item]) => item && typeof item === 'object').map(([id, item]) => [id, normalize({ ...item, id })])) };
}
function save(data, storage) { writeJSON(storage, REVIEW_KEY, data); emit(REVIEW_EVENT); return data; }

function normalize(item) {
  return {
    id: String(item.id),
    kind: REVIEW_KINDS.includes(item.kind) ? item.kind : 'source',
    refId: String(item.refId ?? String(item.id).split(':').slice(1).join(':')),
    title: String(item.title || ''),
    payload: item.payload && typeof item.payload === 'object' ? item.payload : {},
    topic: item.topic ? String(item.topic) : '',
    addedAt: item.addedAt || toIso(Date.now()),
    due: Number.isFinite(item.due) ? item.due : toMs(item.due),
    interval: Number.isFinite(item.interval) ? item.interval : 0,
    ease: Number.isFinite(item.ease) ? Math.max(MIN_EASE, item.ease) : START_EASE,
    reps: Number.isInteger(item.reps) ? item.reps : 0,
    lapses: Number.isInteger(item.lapses) ? item.lapses : 0,
    lastGrade: item.lastGrade ?? null,
    lastReviewedAt: item.lastReviewedAt || null,
    seen: Number.isInteger(item.seen) ? item.seen : 0,
  };
}

export function readReviewItems(storage = defaultStorage()) { return Object.values(load(storage).items); }
export function getReviewItem(id, storage = defaultStorage()) { return load(storage).items[id] || null; }

export function enqueueReviewItem({ kind, refId, title = '', payload = {}, topic = '' } = {}, { storage = defaultStorage(), now = Date.now(), due = null } = {}) {
  if (!kind || refId === undefined || refId === null || refId === '') return null;
  const data = load(storage);
  const id = reviewId(kind, refId);
  const at = toMs(now);
  const existing = data.items[id];
  if (existing) {
    // Met again (a quiz question missed again): fresh details, and it comes back soon — never later than it was.
    const again = kind === 'quiz';
    data.items[id] = normalize({ ...existing, title: title || existing.title, payload: { ...existing.payload, ...payload }, topic: topic || existing.topic, ...(again ? { due: Math.min(existing.due, at + DAY / 2), reps: 0, interval: 0, lapses: existing.lapses + 1, ease: Math.max(MIN_EASE, existing.ease - 0.15) } : {}) });
  } else {
    data.items[id] = normalize({ id, kind, refId, title, payload, topic, addedAt: toIso(at), due: due ?? (kind === 'quiz' ? at + DAY / 2 : at) });
  }
  save(data, storage);
  return data.items[id];
}

// SM-2: quality ≥ 3 lengthens the interval (1 day, then 4, then interval × ease); below 3 starts over and returns
// within half a day. 'later' only moves the date a few days on.
export function nextSchedule(item, grade, now = Date.now()) {
  const at = toMs(now);
  if (grade === 'later') return { ...item, due: at + SNOOZE_DAYS * DAY, lastReviewedAt: toIso(at), seen: item.seen + 1 };
  const quality = typeof grade === 'number' ? Math.max(0, Math.min(5, Math.round(grade))) : GRADE_WORDS[grade] ?? 3;
  const ease = Math.max(MIN_EASE, item.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  if (quality < 3) return { ...item, ease, reps: 0, interval: 0, lapses: item.lapses + 1, due: at + DAY / 2, lastGrade: quality, lastReviewedAt: toIso(at), seen: item.seen + 1 };
  const reps = item.reps + 1;
  const interval = reps === 1 ? 1 : reps === 2 ? 4 : Math.round(Math.max(1, item.interval) * ease);
  return { ...item, ease, reps, interval, due: at + interval * DAY, lastGrade: quality, lastReviewedAt: toIso(at), seen: item.seen + 1 };
}

export function recordReviewResult(id, grade, { storage = defaultStorage(), now = Date.now() } = {}) {
  const data = load(storage);
  const item = data.items[id];
  if (!item) return null;
  data.items[id] = nextSchedule(item, grade, now);
  save(data, storage);
  return data.items[id];
}

export function removeReviewItem(id, storage = defaultStorage()) {
  const data = load(storage);
  if (!data.items[id]) return false;
  delete data.items[id];
  save(data, storage);
  return true;
}

export function dueReviewItems({ now = Date.now(), kinds = null } = {}, storage = defaultStorage()) {
  const at = toMs(now);
  return readReviewItems(storage).filter(item => item.due <= at && (!kinds || kinds.includes(item.kind))).sort((a, b) => a.due - b.due);
}

// A quiet session: about three items, the most overdue first, at most two of one kind, so a session is varied.
export function reviewSession({ now = Date.now(), size = 3 } = {}, storage = defaultStorage()) {
  const due = dueReviewItems({ now }, storage);
  const picked = [];
  const perKind = {};
  for (const item of due) {
    if (picked.length >= size) break;
    if ((perKind[item.kind] || 0) >= 2) continue;
    perKind[item.kind] = (perKind[item.kind] || 0) + 1;
    picked.push(item);
  }
  for (const item of due) { if (picked.length >= size) break; if (!picked.includes(item)) picked.push(item); }
  return picked;
}

// Topic strength for בשבילי היום (0 weak … 1 strong) from the items of a topic — never shown to the reader.
export function topicStrength(items) {
  const scored = items.filter(item => item.seen > 0 || item.lapses > 0);
  if (!scored.length) return 0.5;
  const value = scored.reduce((sum, item) => sum + Math.min(1, item.reps / 3) - Math.min(0.5, item.lapses * 0.15), 0) / scored.length;
  return Math.max(0, Math.min(1, value));
}

/**
 * Bring the user's own material in gently: at most `limit` new items per call, from favourites, the user's chidushim
 * (older than three days), halacha answers marked "למדתי", and sources returned to. Already-known items are untouched.
 * sources: { favorites: [{ key, title, kind, open }], chidushim: [{ id, title, createdAt, topic }],
 *            halacha: [{ id, title, topic }], returned: [{ id, title, reference, source, chapter }] }
 */
export function seedReviewItems(sources = {}, { storage = defaultStorage(), now = Date.now(), limit = 2 } = {}) {
  const data = load(storage);
  const at = toMs(now);
  const candidates = [
    ...(sources.chidushim || []).filter(item => item?.id && at - toMs(item.createdAt) > 3 * DAY).map(item => ({ kind: 'chidush', refId: item.id, title: item.title, topic: item.topic || item.category || '', payload: {} })),
    ...(sources.favorites || []).filter(item => item?.key && item.open).map(item => ({ kind: 'favorite', refId: item.key, title: item.title, topic: item.kind || '', payload: { open: item.open, subtitle: item.subtitle || '' } })),
    ...(sources.halacha || []).filter(item => item?.id).map(item => ({ kind: 'halacha', refId: item.id, title: item.title, topic: item.topic || 'halacha', payload: { route: `halacha/q/${encodeURIComponent(item.id)}` } })),
    ...(sources.returned || []).filter(item => item?.id && item.reference).map(item => ({ kind: 'source', refId: item.id, title: item.title, topic: item.source || '', payload: { reference: item.reference, source: item.source || '', chapter: item.chapter ?? null } })),
  ].filter(item => !data.items[reviewId(item.kind, item.refId)]);
  const added = [];
  // One of each kind in turn, so a long list of favourites never crowds out a chidush.
  const byKind = new Map();
  for (const item of candidates) { if (!byKind.has(item.kind)) byKind.set(item.kind, []); byKind.get(item.kind).push(item); }
  while (added.length < limit && [...byKind.values()].some(list => list.length)) {
    for (const list of byKind.values()) { if (added.length >= limit) break; const item = list.shift(); if (item) added.push(item); }
  }
  for (const item of added) data.items[reviewId(item.kind, item.refId)] = normalize({ id: reviewId(item.kind, item.refId), ...item, addedAt: toIso(at), due: at });
  if (added.length) save(data, storage);
  return added.length;
}

export const onReviewChange = listener => subscribe(REVIEW_EVENT, listener);
