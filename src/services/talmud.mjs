// Talmud service: catalog, daf parsing, per-amud loading with Steinsaltz + linked commentaries.
import catalog from '../data/talmudCatalog.mjs';
import { sanitizeHebrewHtml } from '../hebrewHtml.mjs';

const BASE = 'https://www.sefaria.org/api';
const cache = new Map();
const inflight = new Map();

async function getJSON(path) {
  if (cache.has(path)) return cache.get(path);
  if (inflight.has(path)) return inflight.get(path);
  const p = (async () => {
    let attempt = 0;
    for (;;) {
      const res = await fetch(BASE + path);
      if (res.status === 429 && attempt < 2) { attempt++; await new Promise(r => setTimeout(r, 900 * attempt)); continue; }
      if (!res.ok) throw new Error(res.status === 404 ? 'הדף לא נמצא במקור' : 'המקור אינו זמין כרגע');
      const data = await res.json();
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
export function numberToHebrew(n) {
  const parts = [[400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק'], [90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'], [50, 'נ'], [40, 'מ'], [30, 'ל'], [20, 'כ'], [10, 'י'], [9, 'ט'], [8, 'ח'], [7, 'ז'], [6, 'ו'], [5, 'ה'], [4, 'ד'], [3, 'ג'], [2, 'ב'], [1, 'א']];
  if (n === 15) return 'טו'; if (n === 16) return 'טז';
  let out = ''; for (const [v, l] of parts) while (n >= v) { out += l; n -= v; }
  return out;
}
// Adds geresh (ב׳) or gershayim (ס״ד) as customary for daf numbers.
export function hebrewNumeral(n) {
  const letters = numberToHebrew(n);
  return letters.length === 1 ? `${letters}׳` : `${letters.slice(0, -1)}״${letters.slice(-1)}`;
}

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
    segments: gemara.map((html, i) => ({
      n: i + 1, ref: `${ref}:${i + 1}`, gemara: html,
      steinsaltz: aligned ? steinsaltz[i] : null,
      commentaries: byAnchor.get(i + 1) || [],
    })),
    steinsaltzAligned: aligned,
    unalignedSteinsaltz: aligned ? [] : steinsaltz,
    prev: neighborAmud(tractate, amud, -1), next: neighborAmud(tractate, amud, 1),
  };
}

// Loads the full text of a commentary ref (e.g. Rashi on Berakhot 2a:1:1) as sanitized HTML paragraphs.
export async function loadCommentary(ref, signal) {
  const d = await getJSON(`/texts/${encodeURIComponent(ref)}?context=0&commentary=0`, signal);
  return { ref: d.ref, heRef: d.heRef, html: toArray(d.he).map(sanitizeHebrewHtml), version: d.heVersionTitle, license: d.heLicense };
}

// Parses a Daf Yomi ref like "Berakhot 2" or "Shekalim 5" into a reader target; Yerushalmi Shekalim is flagged.
export function dafYomiTarget(ref) {
  const m = /^(.+?)\s+(\d+)([ab])?$/.exec(String(ref || '').trim());
  if (!m) return null;
  const tractate = findTractate(m[1]);
  if (!tractate) return { unsupported: true, title: m[1], note: /shekalim/i.test(m[1]) ? 'מסכת שקלים במחזור הדף היומי היא מן התלמוד הירושלמי ואינה כלולה בקורא הבבלי.' : 'המסכת אינה בקטלוג הבבלי הזמין.' };
  return { tractate, amud: `${m[2]}${m[3] || 'a'}` };
}
