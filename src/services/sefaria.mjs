
// Sefaria REST data layer — single place for all Sefaria access.
// Public keyless API; texts are fetched with attribution and never fabricated.
import { normalizeHebrewText, HEBREW_POLICIES } from '../hebrewText.mjs';
import { APPROVED_HALACHA_PREFIXES, HALACHA_TOPIC_REFERENCES } from '../data/halachaLibrary.mjs';
import { withContentCache } from './contentCache.mjs';
import siddurOffline from '../data/siddurOffline.mjs';

const BASE = 'https://www.sefaria.org/api';
const cache = new Map();

async function request(path, options = {}) {
  const url = `${BASE}${path}`;
  const key = url + (options.body || '');
  if (cache.has(key)) return cache.get(key);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (response.status === 404) throw new Error('המקור לא נמצא בספריית ספריא');
    if (!response.ok) throw new Error('ספריא אינה זמינה כרגע');
    const data = await response.json();
    if (data.error) throw new Error('ספריא החזירה שגיאה; נסו שוב');
    if (cache.size > 80) cache.delete(cache.keys().next().value);
    cache.set(key, data);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export const sefariaLink = (ref = '') =>
  `https://www.sefaria.org/${encodeURIComponent(ref)}?lang=he`;

// Content-type policy from the edition's own category. Explicit policy names win; legacy
// aliases ('nikud'/'cantillation') defer to the category so a Tanakh hit opened from search
// keeps its te'amim and a Halacha section is never stripped.
const CATEGORY_POLICY = { Tanakh: 'tanakh', Liturgy: 'siddur', Talmud: 'source', Halakhah: 'source', Commentary: 'source', Midrash: 'source', Mishnah: 'source', Kabbalah: 'source', Chasidut: 'source', Musar: 'source', Responsa: 'source', 'Jewish Thought': 'source', 'Second Temple': 'source', Tosefta: 'source' };
export function policyFor(mode, data) {
  if (HEBREW_POLICIES[mode]) return mode;
  const category = data?.primary_category || data?.type || data?.categories?.[0];
  if (mode === 'plain') return 'plain';
  if (category && CATEGORY_POLICY[category]) return CATEGORY_POLICY[category];
  return mode === 'cantillation' ? 'tanakh' : 'siddur';
}

// Normalizes a Sefaria text response (single ref or ranged) into our model.
export function normalizeText(data, mode = 'nikud') {
  if (!data || typeof data !== 'object') return null;
  const policy = policyFor(mode, data);
  const raw = data.he; // Never silently substitute an English version.
  const items = (Array.isArray(raw) ? raw : raw ? [raw] : [])
    .map(item => (typeof item === 'string' ? item : Array.isArray(item) ? item.join(' ') : ''))
    .map((text, index) => ({ index, text: normalizeHebrewText(text, policy) }))
    .filter(item => item.text);
  if (!items.length) return null;
  // A single segment (e.g. "… 208:7") arrives as a string with a parent sectionRef.
  const isSegment = !Array.isArray(raw) && Boolean(data.sectionRef) && data.sectionRef !== data.ref;
  return {
    ref: data.ref,
    heRef: data.heRef || null,
    policy,
    category: data.primary_category || null,
    hebrew: items.map(item => item.text),
    indexes: items.map(item => item.index), // original positions, so segment numbers stay aligned after filtering empties
    version: data.heVersionTitle || null,
    license: data.heLicense || null,
    sectionRef: data.sectionRef || null,
    segmentNumber: isSegment && Array.isArray(data.sections) ? Number(data.sections[data.sections.length - 1]) : null,
    sourceUrl: data.heVersionSource || `https://www.sefaria.org/${encodeURIComponent(data.ref || '')}?lang=he`,
  };
}

export const getIndex = title => title === 'Siddur Edot HaMizrach'
  ? Promise.resolve({ title, schema: siddurOffline.schema })
  : request(`/v2/raw/index/${encodeURIComponent(title)}`);
export const getShape = title => request(`/shape/${encodeURIComponent(title)}`);
export const resolveReference = ref => request(`/name/${encodeURIComponent(ref)}`);
export async function learningSchedule(date, il) {
  const [year, month, day] = date.split('-');
  const data = await request(`/calendars?year=${year}&month=${month}&day=${day}&diaspora=${il ? 0 : 1}`);
  if (data.date !== date) throw new Error('סדר הלימוד אינו תואם לתאריך');
  return data.calendar_items || [];
}
export async function getText(ref, mode = 'nikud') {
  const bundled = siddurOffline.texts[ref];
  if (bundled) return { ...normalizeText(bundled, mode), bundledOffline: true };
  const cacheType = /^Siddur /i.test(ref) ? 'siddur' : 'source';
  return withContentCache(cacheType, `${ref}|${mode}`, async () => {
    const data = await request(`/texts/${encodeURIComponent(ref)}?context=0&commentary=0`);
    const normalized = normalizeText(data, mode);
    if (!normalized) throw new Error('הטקסט ריק או בלתי זמין');
    return normalized;
  });
}

// Free-text search via POST search-wrapper. Note: this endpoint returns the
// canonical reference in `_id` (no `_source` object), e.g.
// "Mishnat Eretz Yisrael on Mishnah Berakhot 6:8:10 (…)".
export async function search(query, size = 6) {
  const data = await request('/search-wrapper', {
    method: 'POST',
    body: JSON.stringify({ query, size, type: 'text', source_proj: true }),
  });
  const hits = data?.hits?.hits ?? [];
  return hits.map(hit => {
    // `_id` is the single source of truth (the API omits `_source`).
    // Shapes seen: "Book on Ref (edition…)" and possibly "Ref (edition…)".
    const id = typeof hit._id === 'string' ? hit._id : '';
    // Keep commentary names intact: 'X on Y' is a distinct work, not Y.
    let ref = hit._source?.ref || id.split(' (')[0];
    let title = hit._source?.heRef || ref;
    ref = ref.trim();
    title = title.trim();
    const exact = hit.highlight?.exact?.[0] ?? '';
    const lemma = (hit.highlight?.['naive_lemmatext'] ?? [])[0] ?? '';
    const snippet = String(exact || lemma)
      .replace(/<[^>]+>/g, '')
      .replace(/&[a-z]+;/gi, '')
      .trim();
    return { ref, title, snippet, link: sefariaLink(ref) };
  });
}

export async function searchApprovedHalacha(query, size = 20) {
  const results = await search(query, size);
  const seen = new Set();
  return results.filter(result => {
    const approved = APPROVED_HALACHA_PREFIXES.some(prefix => result.ref === prefix || result.ref.startsWith(`${prefix} `));
    if (!approved || seen.has(result.ref)) return false;
    seen.add(result.ref);
    return true;
  });
}

export async function searchApprovedHalachaMany(queries, size = 8) {
  const batches = await Promise.all((queries || []).map(query => searchApprovedHalacha(query, size)));
  const seen = new Set();
  return batches.flat().filter(result => {
    if (seen.has(result.ref)) return false;
    seen.add(result.ref);
    return true;
  });
}

export async function searchHalachaTopic(title, queries = []) {
  const remote = await searchApprovedHalachaMany(queries, 8);
  const refs = HALACHA_TOPIC_REFERENCES[title] || [];
  const staticResults = refs.map(ref => ({
    ref,
    title: ref.replace(/^Shulchan Arukh, /, 'שולחן ערוך, '),
    snippet: '',
    link: sefariaLink(ref),
  }));
  const seen = new Set();
  return [...staticResults, ...remote].filter(result => {
    if (seen.has(result.ref)) return false;
    seen.add(result.ref);
    return true;
  });
}
