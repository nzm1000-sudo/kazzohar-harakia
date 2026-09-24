// Talmud service: catalog, daf parsing, per-amud loading with Steinsaltz + linked commentaries.
import catalog from '../data/talmudCatalog.mjs';
import { hebrewLetters, hebrewNumeral as sharedHebrewNumeral } from './hebrewNumerals.mjs';
import { requestJsonResponse } from './requestJson.mjs';
import { sanitizeHebrewHtml } from '../hebrewHtml.mjs';
import { canCacheContent, listContentCache, pinContent, unpinContent, withContentCache } from './contentCache.mjs';

const BASE = 'https://www.sefaria.org/api';
const cache = new Map();
const inflight = new Map();

async function getJSON(path, signal) {
  if (cache.has(path)) return cache.get(path);
  if (inflight.has(path)) return inflight.get(path);
  const p = (async () => {
    let attempt = 0;
    for (;;) {
      // Shared requests must outlive one React effect cleanup; callers still ignore stale results after cleanup.
      let packet;
      try { packet = await requestJsonResponse(BASE + path, { timeoutMs: 15000 }); }
      catch (error) {
        if (error.name === 'TimeoutError') throw new Error('המקור לא הגיב בזמן. נסו שוב.');
        throw error;
      }
      const { response: res, data } = packet;
      if (res.status === 429 && attempt < 2) { attempt++; await new Promise(r => setTimeout(r, 900 * attempt)); continue; }
      if (!res.ok) throw new Error(res.status === 404 ? 'הדף לא נמצא במקור' : 'המקור אינו זמין כרגע');
      if (data.error) throw new Error(data.error);
      if (cache.size > 200) cache.delete(cache.keys().next().value);
      cache.set(path, data);
      return data;
    }
  })();
  inflight.set(path, p);
  try { return await p; } finally { inflight.delete(path); }
}

export const TRACTATES = catalog.tractates.filter(t => t.steinsaltz);
// Bavli tractates (six sedarim) that lack a Steinsaltz index on Sefaria; minor tractates and commentaries are not tractates and are excluded.
export const TRACTATES_WITHOUT_STEINSALTZ = catalog.tractates.filter(t => !t.steinsaltz && /^Seder /.test(t.seder));
export const SEDARIM = [...new Set(TRACTATES.map(t => t.seder))];
export const SEDER_HE = { 'Seder Zeraim': 'זרעים', 'Seder Moed': 'מועד', 'Seder Nashim': 'נשים', 'Seder Nezikin': 'נזיקין', 'Seder Kodashim': 'קדשים', 'Seder Tahorot': 'טהרות' };

const HE_LETTERS = { א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9, י: 10, כ: 20, ל: 30, מ: 40, נ: 50, ס: 60, ע: 70, פ: 80, צ: 90, ק: 100, ר: 200, ש: 300, ת: 400 };
export function hebrewToNumber(s) {
  const clean = String(s).replace(/[״"׳']/g, '');
  if (/^\d+$/.test(clean)) return Number(clean);
  let n = 0; for (const ch of clean) { if (!(ch in HE_LETTERS)) return NaN; n += HE_LETTERS[ch]; }
  return n || NaN;
}
export function numberToHebrew(n) { return hebrewLetters(n); }
export function hebrewNumeral(n) { return sharedHebrewNumeral(n); }

export function amudToIndex(amud) { const m = /^(\d+)([ab])$/.exec(amud); return m ? (Number(m[1]) - 1) * 2 + (m[2] === 'b' ? 1 : 0) : -1; }
export function indexToAmud(i) { return `${Math.floor(i / 2) + 1}${i % 2 === 0 ? 'a' : 'b'}`; }
export function amudLabel(amud) { const m = /^(\d+)([ab])$/.exec(amud); return m ? `${hebrewNumeral(Number(m[1]))} ע״${m[2] === 'a' ? 'א' : 'ב'}` : amud; }

export function findTractate(name) {
  const n = String(name || '').trim().toLowerCase().replace(/^מסכת\s+/, '');
  return TRACTATES.find(t => t.title.toLowerCase() === n || t.heTitle === n || t.heTitle.replace(/\s/g, '') === n.replace(/\s/g, ''));
}

// Accepts "ברכות ב", "ברכות ב ע״א", "ברכות 2a", "שבת לא ב", "בבא מציעא נט".
export function parseDafInput(input) {
  const text = String(input || '').trim().replace(/\s+/g, ' ');
  const m = /^(.+?)\s+([\u05d0-\u05ea״"׳']+|\d+)\s*(?:(?:ע[״"']?([אב]))|([ab])|([אב]))?\s*$/.exec(text);
  if (!m) return { error: 'לא הבנתי את הקלט. דוגמה: "ברכות ב ע״א"' };
  const tractate = findTractate(m[1]);
  if (!tractate) return { error: `מסכת "${m[1]}" לא נמצאה בקטלוג הזמין` };
  const raw = m[2];
  let daf, side;
  if (/^\d+[ab]$/.test(raw)) { daf = Number(raw.slice(0, -1)); side = raw.slice(-1); }
  else { daf = hebrewToNumber(raw); side = m[3] === 'א' || m[4] === 'a' || m[5] === 'א' ? 'a' : m[3] === 'ב' || m[4] === 'b' || m[5] === 'ב' ? 'b' : null; }
  if (!Number.isFinite(daf)) return { error: 'מספר הדף אינו תקין' };
  if (!side) return { tractate, daf, needsSide: true };
  return { tractate, amud: `${daf}${side}`, ...validateAmud(tractate, `${daf}${side}`) };
}
export function validateAmud(tractate, amud) {
  const i = amudToIndex(amud);
  if (i < 0 || !tractate.segmentsPerAmud[i]) return { error: `${tractate.heTitle} ${amudLabel(amud)} אינו קיים במקור` };
  return {};
}
export function neighborAmud(tractate, amud, dir) {
  let i = amudToIndex(amud) + dir;
  while (i >= 0 && i < tractate.segmentsPerAmud.length) { if (tractate.segmentsPerAmud[i] > 0) return indexToAmud(i); i += dir; }
  return null;
}
export function nextTractate(tractate) { const i = TRACTATES.findIndex(t => t.title === tractate.title); return TRACTATES[i + 1] || null; }

const VILNA_SCANS = {
  'Berakhot:2a': {
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Berakhot2a.jpg?width=1600',
    source: 'https://commons.wikimedia.org/wiki/File:Berakhot2a.jpg',
  },
  'Berakhot:2b': {
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Berakhot2B.jpg?width=1600',
    source: 'https://commons.wikimedia.org/wiki/File:Berakhot2B.jpg',
  },
  'Sanhedrin:13b': {
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Sanhedrin13b.jpg?width=1600',
    source: 'https://commons.wikimedia.org/wiki/File:Sanhedrin13b.jpg',
  },
  'Sanhedrin:14a': {
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Sanhedrin14a.jpg?width=1600',
    source: 'https://commons.wikimedia.org/wiki/File:Sanhedrin14a.jpg',
  },
};

export function getVilnaScan(tractate, amud) {
  return VILNA_SCANS[`${tractate.title}:${amud}`] || null;
}

function isRommVilna(record) {
  const identity = [record.manuscript_slug, record.manuscript?.slug, record.manuscript?.title, record.manuscript?.he_title].filter(Boolean).join(' ').toLowerCase();
  return identity.includes('romm vilna') || identity.includes('romm-vilna') || identity.includes('vilna romm') || identity.includes('דפוס וילנא');
}

function exactManuscriptRecord(records, ref) {
  const candidates = (Array.isArray(records) ? records : []).filter(record => isRommVilna(record));
  return candidates.find(record => record.page_id === ref)
    || candidates.find(record => record.anchorRef === ref)
    || candidates.find(record => Array.isArray(record.anchorRefExpanded) && record.anchorRefExpanded.includes(ref))
    || null;
}

export async function loadVilnaScan(tractate, amud, signal) {
  const ref = `${tractate.title} ${amud}`;
  const fallback = getVilnaScan(tractate, amud);
  if (navigator.onLine === false) throw new Error('אין חיבור לאינטרנט וסריקת דפוס וילנא הזו עדיין לא נשמרה במכשיר');
  try {
    const records = await getJSON(`/manuscripts/${encodeURIComponent(ref)}`, signal);
    const record = exactManuscriptRecord(records, ref);
    if (!record?.image_url) return { primary: null, fallback, ref };
    return {
      primary: {
        image: record.image_url,
        thumbnail: record.thumbnail_url || record.image_url,
        ref: record.page_id || record.anchorRef,
        anchorRef: record.anchorRef,
        title: record.manuscript?.title || record.manuscript_slug,
        heTitle: record.manuscript?.he_title || '',
        source: record.manuscript?.source || '',
        provider: 'Sefaria Manuscripts API',
        license: record.manuscript?.description || record.manuscript?.he_description || '',
      },
      fallback,
      ref,
    };
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    if (fallback) return { primary: null, fallback, ref, error: error.message };
    throw new Error('צורת הדף לא נטענה מספריא');
  }
}

const toArray = he => (Array.isArray(he) ? he : he ? [he] : []).map(x => Array.isArray(x) ? x.join(' ') : String(x));

const COMMENTARY_EXCLUDED = new Set(['ביאור שטיינזלץ', 'Steinsaltz']);

function linkedSegments(anchorRef, ref) {
  const escaped = ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const refs = [...String(anchorRef || '').matchAll(new RegExp(`${escaped}:(\\d+)`, 'g'))].map(m => Number(m[1]));
  if (refs.length < 2) return refs;
  const start = Math.min(...refs);
  const end = Math.max(...refs);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function commentatorName(link) {
  return String(link.collectiveTitle?.he || link.index_title || '').replace('רש״י', 'רש"י').trim();
}

// Loads one amud: base Gemara, Steinsaltz Hebrew commentary, and every linked commentary by anchor.
export async function loadAmud(tractate, amud, signal) {
  return withContentCache('talmud', `${tractate.title}|${amud}`, async () => {
  const ref = `${tractate.title} ${amud}`;
  const [base, stein, links] = await Promise.all([
    getJSON(`/texts/${encodeURIComponent(ref)}?context=0&commentary=0`, signal),
    getJSON(`/texts/${encodeURIComponent(`${tractate.steinsaltz.index} ${amud}`)}?context=0&commentary=0`, signal).catch(() => null),
    getJSON(`/links/${encodeURIComponent(ref)}?with_text=0`, signal).catch(() => []),
  ]);
  if (base.ref !== ref && base.sectionRef !== ref) console.warn('ref mismatch', ref, base.ref);
  const gemara = toArray(base.he).map(sanitizeHebrewHtml);
  const steinsaltz = stein ? toArray(stein.he).map(sanitizeHebrewHtml) : [];
  // Only trust segment alignment when both arrays have identical length; otherwise expose by-anchor links only.
  const aligned = steinsaltz.length === gemara.length;
  const byAnchor = new Map();
  for (const l of Array.isArray(links) ? links : []) {
    if (l.category !== 'Commentary') continue;
    const who = commentatorName(l);
    if (!who || COMMENTARY_EXCLUDED.has(who)) continue;
    for (const seg of linkedSegments(l.anchorRef, ref)) {
      if (!byAnchor.has(seg)) byAnchor.set(seg, []);
      byAnchor.get(seg).push({ ref: l.ref, commentator: who, anchorRef: l.anchorRef, source: l.source });
    }
  }
  return {
    ref, tractate, amud,
    baseVersion: { title: base.heVersionTitle, license: base.heLicense },
    steinsaltzVersion: stein ? { title: stein.heVersionTitle, license: stein.heLicense } : null,
    licenses: [base.heLicense, stein?.heLicense].filter(Boolean),
    segments: gemara.map((html, i) => ({
      n: i + 1, ref: `${ref}:${i + 1}`, gemara: html,
      steinsaltz: aligned ? steinsaltz[i] : null,
      commentaries: byAnchor.get(i + 1) || [],
    })),
    steinsaltzAligned: aligned,
    unalignedSteinsaltz: aligned ? [] : steinsaltz,
    prev: neighborAmud(tractate, amud, -1), next: neighborAmud(tractate, amud, 1),
  };
  });
}

// Loads the full text of a commentary ref (e.g. Rashi on Berakhot 2a:1:1) as sanitized HTML paragraphs.
export async function loadCommentary(ref, signal) {
  return withContentCache('commentary', ref, async () => {
    const d = await getJSON(`/texts/${encodeURIComponent(ref)}?context=0&commentary=0`, signal);
    return { ref: d.ref, heRef: d.heRef, html: toArray(d.he).map(sanitizeHebrewHtml), version: d.heVersionTitle, license: d.heLicense, source: d.heVersionSource || null };
  }).catch(error => {
    // Offline: commentaries travel inside the pinned daf package rather than as separate pinned entries.
    const packaged = listContentCache().find(entry => entry.type === 'talmud' && entry.pinned && entry.data?.commentaryCache?.some(item => item.ref === ref));
    const hit = packaged?.data?.commentaryCache?.find(item => item.ref === ref);
    if (hit) return hit;
    throw error;
  });
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) { const current = index++; results[current] = await worker(items[current]); }
  }));
  return results;
}

export async function pinTalmudDaf(tractate, amud, data) {
  const refs = [...new Set(data.segments.flatMap(segment => segment.commentaries.map(commentary => commentary.ref)))];
  // Sefaria rate-limits bursts; a small pool keeps a 100-commentary daf pinnable.
  const commentaries = await mapWithConcurrency(refs, 4, ref => loadCommentary(ref));
  if (!commentaries.every(canCacheContent)) throw new Error('אחד המפרשים בדף אינו מאושר לשמירה ללא אינטרנט');
  const packageData = { ...data, commentaryCache: commentaries };
  if (!pinContent('talmud', `${tractate.title}|${amud}`, packageData)) throw new Error('לא ניתן לשמור את הדף; אחסון התוכן המוצמד מלא');
  return true;
}

export function unpinTalmudDaf(tractate, amud) {
  return unpinContent('talmud', `${tractate.title}|${amud}`);
}

// Parses a Daf Yomi ref like "Berakhot 2" or "Shekalim 5" into a reader target; Yerushalmi Shekalim is flagged.
export function dafYomiTarget(ref) {
  const m = /^(.+?)\s+(\d+)([ab])?$/.exec(String(ref || '').trim());
  if (!m) return null;
  const tractate = findTractate(m[1]);
  if (!tractate) return { unsupported: true, title: m[1], note: /shekalim/i.test(m[1]) ? 'מסכת שקלים במחזור הדף היומי היא מן התלמוד הירושלמי ואינה כלולה בקורא הבבלי.' : 'המסכת אינה בקטלוג הבבלי הזמין.' };
  return { tractate, amud: `${m[2]}${m[3] || 'a'}` };
}
