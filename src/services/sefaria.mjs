// Sefaria REST data layer — single place for all Sefaria access.
// Public keyless API; texts are fetched with attribution and never fabricated.
const BASE = 'https://www.sefaria.org/api';
const cache = new Map();

async function request(path, options = {}) {
  const url = `${BASE}${path}`;
  if (cache.has(url)) return cache.get(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (response.status === 404) throw new Error('המקור לא נמצא בספריית ספריא');
    if (!response.ok) throw new Error('ספריא אינה זמינה כרגע');
    const data = await response.json();
    if (data.error) throw new Error('ספריא החזירה שגיאה; נסו שוב');
    if (cache.size > 80) cache.delete(cache.keys().next().value);
    cache.set(url, data);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export const sefariaLink = (ref = '') =>
  `https://www.sefaria.org/${encodeURIComponent(ref)}?lang=he`;

// Normalizes a Sefaria text response (single ref or ranged) into our model.
export function normalizeText(data) {
  if (!data || typeof data !== 'object') return null;
  const raw = data.he ?? data.text;
  const verses = (Array.isArray(raw) ? raw : raw ? [raw] : [])
    .map(item => (typeof item === 'string' ? item : Array.isArray(item) ? item.join(' ') : ''))
    .map(text => text.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!verses.length) return null;
  return {
    ref: data.ref,
    hebrew: verses,
    version: data.heVersionTitle || null,
    license: data.heLicense || null,
    sourceUrl: data.heVersionSource || `https://www.sefaria.org/${encodeURIComponent(data.ref || '')}?lang=he`,
  };
}

export async function getText(ref) {
  const data = await request(`/texts/${encodeURIComponent(ref)}?context=0&commentary=0`);
  const normalized = normalizeText(data);
  if (!normalized) throw new Error('הטקסט ריק או בלתי זמין');
  return normalized;
}

// Free-text search via POST search-wrapper. Note: this endpoint returns the
// canonical reference in `_id` (no `_source` object), e.g.
// "Mishnat Eretz Yisrael on Mishnah Berakhot 6:8:10 (…)".
export async function search(query, size = 6) {
  const data = await request('/search-wrapper', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, size, type: 'text' }),
  });
  const hits = data?.hits?.hits ?? [];
  return hits.map(hit => {
    // `_id` is the single source of truth (the API omits `_source`).
    // Shapes seen: "Book on Ref (edition…)" and possibly "Ref (edition…)".
    const id = typeof hit._id === 'string' ? hit._id : '';
    const onMatch = id.match(/ on (.+?) \(/);
    let ref = onMatch ? onMatch[1] : id.replace(/\s*\([^)]*\)\s*$/, '');
    let title = onMatch ? id.split(' on ')[0] : ref.split(/\s+\d/)[0] || ref;
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
