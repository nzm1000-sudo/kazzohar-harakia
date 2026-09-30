// Abbreviation (ראשי תיבות) extractors of the open-sources pass — build time only, deterministic, from cleared
// public-domain sources:
//   extractJastrowAbbreviations(raw)     Jastrow 1903 (Sefaria, public domain): every "PHRASE (abbr. X)" /
//                                        "(abbrev. X, Y)" / "(abbr. X = Y)" he prints, and a headword followed by its
//                                        own "(abbrev. X׳)". The headword's own letter-plus-geresh inside the phrase
//                                        (א׳ העולם under אוּמָּה) is the headword. Jastrow's English is never taken.
//   parseBenYehudaAbbreviations(raw)     ספר ראשי תיבות (Project Ben-Yehuda 37578; the work of Meir Halperin,
//                                        הנוטריקון, הסימנים והכינויים, Vilna 1912, reissued Sighet 1926): "KEY exp1,
//                                        exp2, …." paragraphs, every reading kept, none ranked.
// Every candidate is checked against its letters (initialsFit): the abbreviation must spell the beginnings of the
// expansion's words, in order — a check of the source's own consistency, never a guess of a meaning.
import { normalizeLookupToken, isAbbreviationKey } from '../../../src/services/wordLookup/normalize.mjs';
import { stripTags, tidy, unpoint } from './common.mjs';

const keyOf = w => normalizeLookupToken(w);
export const lettersOf = key => String(key).replace(/[״׳]/g, '');
const FUNCTION_WORDS = new Set(['של', 'את', 'על', 'אל', 'עם', 'מן', 'דף', 'עמוד']);

// Does the abbreviation spell the beginnings of the expansion's words in order? 'strict': every word gives one or more
// leading letters; 'skip': one short function word gives none; 'truncation': a word cut off with a geresh (אפי׳ אפילו);
// null: the letters do not fit.
export function initialsFit(abbrKey, expansion) {
  const letters = lettersOf(abbrKey);
  const ws = String(expansion).split(/\s+/).filter(Boolean).map(w => lettersOf(keyOf(w))).filter(Boolean);
  if (!letters || !ws.length) return null;
  if (ws.length === 1) return ws[0].startsWith(letters) && ws[0] !== letters ? 'truncation' : null;
  const fit = (i, j, skipped) => {
    if (j === ws.length) return i === letters.length ? (skipped ? 'skip' : 'strict') : null;
    const w = ws[j];
    for (let n = Math.min(w.length, letters.length - i); n >= 1; n -= 1) {
      if (w.slice(0, n) !== letters.slice(i, i + n)) continue;
      const r = fit(i + n, j + 1, skipped);
      if (r) return r;
    }
    if (!skipped && FUNCTION_WORDS.has(w)) return fit(i, j + 1, true);
    return null;
  };
  return fit(0, 0, false);
}

// ---------- Jastrow ----------
// The entry's text with Hebrew spans marked «…» (links and rtl spans), tags removed.
const marked = html => String(html).replace(/<a [^>]*>/g, '«').replace(/<\/a>/g, '»').replace(/<span dir="rtl">/g, '«').replace(/<\/span>/g, '»').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
const PREFIXES = ['וד', 'ול', 'וב', 'וה', 'ומ', 'וכ', 'דל', 'דב', 'דה', 'ו', 'ד', 'ל', 'ב', 'ה', 'מ', 'כ', 'ש'];

// The headword's own letter-plus-geresh inside a phrase (א׳ הראשון, עם הָאָ׳, דא׳) → the headword (unpointed, with its
// prefix). Returns null when the phrase keeps another abbreviation (וכ׳ …).
function expandHeadword(phrase, head) {
  const headPlain = unpoint(head).replace(/[׳״'"]/g, '');
  const out = [];
  let substituted = false;
  for (const raw of unpoint(phrase).split(/\s+/).filter(Boolean)) {
    const w = raw.replace(/[.,;:()]/g, '');
    if (!w) continue;
    if (/[׳']$/.test(w)) {
      const stem = w.replace(/[׳']$/, '');
      if (headPlain.startsWith(stem)) { out.push(headPlain); substituted = true; continue; }
      const p = PREFIXES.find(x => stem.startsWith(x) && stem.length > x.length && headPlain.startsWith(stem.slice(x.length)));
      if (p) { out.push(p + headPlain); substituted = true; continue; }
      return null;
    }
    if (/["״]/.test(w)) return null;
    out.push(w);
  }
  // (A substituted headword is the dictionary form: the phrase may inflect it — א׳ העולם is אומות העולם — so such a
  // reading is marked and needs another source's agreement.)
  return { text: out.join(' '), substituted };
}

export function extractJastrowAbbreviations(rawText) {
  const out = [];
  for (const line of String(rawText).split('\n')) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line);
    const ref = entry.ref.replace(/^Jastrow, /, '');
    const html = entry.text.join(' ');
    const lead = html.match(/^\s*<strong dir="rtl">(.*?)<\/strong>/);
    const head = tidy(stripTags(lead ? lead[1] : ref)).replace(/[²³⁴⁵⁶⁷⁸⁹¹⁰*]/g, '').replace(/\s+(I{1,3}|IV|V|VI|VII)$/, '').trim();
    const text = marked(html);
    const push = (abbr, expansion, rawPattern, substituted = false) => {
      const key = keyOf(abbr);
      if (!key || !isAbbreviationKey(key) || !expansion) return;
      const display = tidy(unpoint(expansion)).replace(/[.,;:]+$/, '');
      if (!display || /[׳״'"]/.test(display) || !/^[א-ת ]+$/.test(display)) return;
      out.push({ key, expansion: display, sourceEntry: ref, rawPattern: tidy(rawPattern).slice(0, 160), fit: initialsFit(key, display), substituted });
    };
    // 1. "«PHRASE» (abbr. «X», «Y») …" and "(abbr. «X» = «Y»)".
    for (const m of text.matchAll(/«([^«»]+)»\s*\((?:abbr|abbrev)\.\s*((?:«[^«»]+»\s*,?\s*)+)(?:=\s*«([^«»]+)»)?/g)) {
      const phrase = expandHeadword(m[1], head);
      const alt = m[3] ? expandHeadword(m[3], head) : null;
      for (const a of [...m[2].matchAll(/«([^«»]+)»/g)].map(x => unpoint(x[1]).trim())) {
        const candidates = [phrase, alt].filter(Boolean);
        const best = candidates.find(c => initialsFit(keyOf(a), c.text)) || candidates[0];
        if (best) push(a, best.text, m[0], best.substituted);
      }
    }
    // 2. A headword with its own abbreviation right after it: "אֲפִילּוּ (abbrev. «אפי׳»)".
    const own = text.match(/^\s*[^«(]{1,40}?\s*\((?:abbr|abbrev)\.\s*«([^«»]+)»\)/);
    if (own && !/\bof\b/.test(own[0])) push(unpoint(own[1]), unpoint(head), own[0]);
  }
  // One row per (key, expansion); the first entry that prints it.
  const seen = new Set();
  return out.filter(r => { const k = `${r.key}\t${r.expansion}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

// ---------- Project Ben-Yehuda: ספר ראשי תיבות (Halperin / Stern) ----------
// The dictionary proper runs from the first "א״א" paragraph to the volunteers' notes (הערת פב״י) at the end.
export function parseBenYehudaAbbreviations(rawText) {
  const text = String(rawText).replace(/\r/g, '');
  const start = text.search(/^א"א /m);
  const endNote = text.search(/^.*הערת\s+פב"י.*↩/m);
  const body = text.slice(start, endNote > start ? endNote : undefined);
  const byKey = new Map();
  for (const para of body.split(/\n\s*\n/)) {
    const flat = para.replace(/\s*\n\s*/g, ' ').replace(/&nbsp;/g, ' ').trim();
    if (!flat) continue;
    const m = flat.match(/^(\S+?)\d*\s+(.+)$/);
    if (!m) continue;
    const key = keyOf(m[1]);
    if (!key || !isAbbreviationKey(key)) continue;
    const rest = m[2].replace(/(?<=[א-ת])\d+/g, '').replace(/\s\d+\s/g, ' ').replace(/\.\s*$/, '');
    const items = rest.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
    const exps = [];
    for (let i = 0; i < items.length; i += 1) {
      const continued = /^[־-]/.test(items[i]);
      let item = unpoint(items[i].replace(/^[־-]/, '')).replace(/\s*\([^)]*\)\s*/g, ' ').replace(/[.;:]+$/, '').trim();
      let rawItem = items[i];
      // "־X": the previous reading with its last word replaced (אחד בתורה, ־בנביאים → אחד בנביאים).
      if (continued && exps.length) { const prev = exps[exps.length - 1].expansion.split(' '); item = [...prev.slice(0, -1), item].join(' '); rawItem = `${exps[exps.length - 1].expansion} / ${items[i]}`; }
      if (!item || !/^[א-ת'" ]+$/.test(item)) continue;
      exps.push({ expansion: item, rawItem });
    }
    if (!byKey.has(key)) byKey.set(key, { key, raw: m[1], readings: [] });
    const rec = byKey.get(key);
    for (const e of exps) if (!rec.readings.some(r => r.expansion === e.expansion)) rec.readings.push(e);
  }
  const out = [];
  for (const rec of byKey.values()) for (const r of rec.readings) out.push({ key: rec.key, expansion: r.expansion, readings: rec.readings.length, rawPattern: `${rec.raw} ${r.rawItem}`.slice(0, 160), fit: /["'׳״]/.test(r.expansion) ? initialsFit(rec.key, r.expansion.replace(/\S+["'׳״]\S*/g, w => w)) : initialsFit(rec.key, r.expansion) });
  return out;
}
