// Parser of Jastrow, "A Dictionary of the Targumim, the Talmud Babli and Yerushalmi, and the Midrashic Literature"
// (London, Luzac, 1903 — Sefaria, public domain). Build time only. Jastrow's English is never shown; what the engine
// takes from him is what he states in Hebrew or in the structure of the entry:
//   heads      the headword and its spellings (pointed) → keys
//   lang       'ch' (Aramaic: "ch."), 'bh' (Biblical Hebrew: "b. h."), 'h' (Hebrew entry of a same-letters pair), '' unmarked
//   name       a proper name ("pr. n.")
//   pos        'v' (a verb: stems or "to …"), 'n' (m./f.), 'adj', 'adv', 'particle', ''
//   sameAs     "ch. same" — the Aramaic word is the Hebrew word of the entry it links to (its Hebrew equivalent)
//   hebrewEq   Hebrew equivalents he prints: "= h. X", "(= b. h. X)", and "(h. X)" after a Targum citation (the word of
//              the Hebrew verse the Targum renders)
//   stems      the verbal stems (Pa., Af., Ithpe. …) with the forms he prints for each
//   forms      inflected forms he quotes under the entry (Pl., Part., Inf., contr. … and the words of his quotations that
//              share the headword's root) — naturally occurring forms of this lemma
//   evidence   the corpora of his citations (Targum, Bavli, Yerushalmi, Midrash, Mishnah …)
import { stripTags, tidy, keyOf, citationCorpus, sharesRoot, unpoint } from './common.mjs';

export const STEM_NAMES = Object.freeze({
  'Pa.': 'pa', 'Af.': 'af', 'Ithpe.': 'itpe', 'Ithpa.': 'itpa', 'Ittaf.': 'ittaf', 'Ittafel.': 'ittaf', 'Ithpalp.': 'itpalp', 'Palp.': 'palp', 'Pilp.': 'palp', 'Ithpol.': 'itpol', 'Pol.': 'pol', 'Polel.': 'pol', 'Ishtaf.': 'ishtaf', 'Pe.': 'pe', 'Itphe.': 'itpe',
  'Pi.': 'pi', 'Hif.': 'hif', 'Nif.': 'nif', 'Hithpa.': 'hitpa', 'Nithpa.': 'nitpa', 'Hof.': 'hof', 'Pu.': 'pu', 'Hithpol.': 'hitpol', 'Hithpalp.': 'hitpalp', 'Nithpalp.': 'nitpalp',
});
// The Hebrew stem that corresponds to an Aramaic one (standard grammar; used only with a stem Jastrow himself prints in
// the Hebrew entry, never to build a form).
export const HEBREW_STEM_OF = Object.freeze({ pe: 'qal', pa: 'pi', af: 'hif', itpe: 'nif', itpa: 'hitpa', ittaf: 'hof', palp: 'pilp', itpalp: 'hitpalp', pol: 'pol', itpol: 'hitpol' });
const HEBREW_STEM_ALIAS = Object.freeze({ nitpa: 'hitpa', nitpalp: 'hitpalp' });

const rtlSpans = html => [...html.matchAll(/<span dir="rtl">(.*?)<\/span>/g)].map(m => tidy(stripTags(m[1])));
const linkTexts = html => [...html.matchAll(/<a [^>]*data-ref="Jastrow, ([^"]+)"[^>]*>(.*?)<\/a>/g)].map(m => ({ ref: m[1], text: tidy(stripTags(m[2])) }));
const isHebrewWord = text => /^[א-ת֑-ׇ׳״'"]+$/.test(text);

function evidenceOf(html) {
  const evidence = {};
  for (const m of html.matchAll(/<a class="refLink"[^>]*data-ref="([^"]+)"[^>]*>(.*?)<\/a>/g)) {
    if (/^Jastrow/.test(m[1])) continue;
    const corpus = citationCorpus(m[1], stripTags(m[2]));
    evidence[corpus] = (evidence[corpus] || 0) + 1;
  }
  return evidence;
}

// The Hebrew equivalents printed in a stretch of the entry.
function hebrewEquivalents(html) {
  const out = [];
  const word = segment => { const link = segment.match(/^\s*<a [^>]*>(.*?)<\/a>/); const span = segment.match(/^\s*<span dir="rtl">(.*?)<\/span>/); const text = tidy(stripTags((link || span || [])[1] || '')); return text; };
  for (const m of html.matchAll(/(\(\s*=\s*b\. h\.|\(\s*=\s*h\.|=\s*b\. h\.|=\s*h\.|\(h\.(?:\s*text)?)\s*/g)) {
    const text = word(html.slice(m.index + m[0].length));
    if (!text) continue;
    const kind = /^\(h\./.test(m[1]) ? 'targum-h' : /b\. h\./.test(m[1]) ? 'bh' : 'eq';
    // Only a single Hebrew word (or a two-word phrase) is an equivalent; anything longer is a gloss of its own.
    if (text.split(/\s+/).length > 2 || !/[א-ת]/.test(text)) continue;
    // The context of a Targum equivalent: the Targum citation right before it.
    const before = html.slice(Math.max(0, m.index - 220), m.index);
    const targumRef = kind === 'targum-h' ? ([...before.matchAll(/data-ref="([^"]+)"/g)].at(-1)?.[1] || '') : '';
    out.push({ word: text, key: keyOf(text.split(/\s+/)[0]), phrase: text.split(/\s+/).length > 1, kind, targumRef });
  }
  return out;
}

export function parseJastrowEntry(entry, order) {
  const ref = entry.ref.replace(/^Jastrow, /, '');
  const html = entry.text.join('<br/>');
  const lead = html.match(/^(\s*<strong dir="rtl">.*?<\/strong>\s*,?\s*)+/);
  const heads = (lead ? [...lead[0].matchAll(/<strong dir="rtl">(.*?)<\/strong>/g)].map(m => tidy(stripTags(m[1]))) : [ref])
    .map(pointed => pointed.replace(/[²³⁴⁵⁶⁷⁸⁹¹⁰*]/g, '').replace(/\s+(I{1,3}|IV|V|VI|VII)$/, '').trim())
    .filter(Boolean).map(pointed => ({ pointed, key: keyOf(pointed), abbreviated: /׳$/.test(pointed) }));
  const body = html.slice(lead ? lead[0].length : 0);
  const head = body.slice(0, 160);
  const plainHead = tidy(stripTags(head));
  const record = { id: ref, order, heads, lang: '', name: false, pos: '', sameAs: null, sameSense: null, see: null, hebrewEq: [], stems: [], forms: [], english: '', evidence: evidenceOf(html) };
  if (/^\s*,?\s*(\(b\. h\.\)\s*)?pr\. n\./.test(plainHead)) record.name = true;
  if (/^\s*,?\s*(h\.,\s*\S+\s*)?ch\.|^\s*\S*\s*ch\./.test(plainHead) || /^[^()]{0,40}\bch\./.test(plainHead)) record.lang = 'ch';
  else if (/^\s*,?\s*[mf]?\.?\s*\(b\. h\.|^\s*\(b\. h\.|^\s*(m|f|adj|adv)\.\s*\(b\. h\./.test(plainHead)) record.lang = 'bh';
  // "v. X" alone: a cross reference (see X).
  const see = body.match(/^\s*,?\s*v\.\s*<a [^>]*data-ref="Jastrow, ([^"]+)"/);
  if (see && tidy(stripTags(body)).length < 60) record.see = see[1];
  // ch. same / ch. = h. / "same" link
  const same = head.match(/<a [^>]*data-ref="Jastrow, ([^"]+)"[^>]*>(?:same|preced\.)<\/a>/);
  if (same && record.lang === 'ch') record.sameAs = same[1];
  const asSense = body.match(/^\s*ch\.\s*1\)\s*as\s*<a [^>]*data-ref="Jastrow, ([^"]+)"[^>]*>preced\.<\/a>/);
  if (asSense) record.sameAs = asSense[1];
  record.hebrewEq = hebrewEquivalents(html);
  // Part of speech.
  if (/^\s*,?\s*(\([^)]*\)\s*)?(m|f)\.(\s|,|$)|^\s*,?\s*(ch\.\s*)?(m|f)\.\s/.test(plainHead) || /^[^<]{0,30}\b(m|f)\. (pl\.)?/.test(plainHead)) record.pos = 'n';
  else if (/^[^<]{0,30}\badj\./.test(plainHead)) record.pos = 'adj';
  else if (/^[^<]{0,30}\badv\./.test(plainHead)) record.pos = 'adv';
  else if (/^[^<]{0,40}\b(prep|conj|interj|pron|part)\./.test(plainHead)) record.pos = 'particle';
  const italic = [...html.matchAll(/<i>(.*?)<\/i>/g)].map(m => tidy(stripTags(m[1]))).filter(t => t.length > 2);
  record.english = italic.slice(0, 3).join('; ');
  const stemSplit = html.split(/<strong>([A-Z][a-zA-Z]{0,9}\.)<\/strong>/);
  if (stemSplit.length > 1) record.pos = 'v';
  if (!record.pos && /^to\s/.test(italic[0] || '')) record.pos = 'v';
  // Stems: <strong>Pa.</strong> - <strong dir="rtl">FORM</strong> … (the segment until the next stem).
  for (let i = 1; i < stemSplit.length; i += 2) {
    const stem = STEM_NAMES[stemSplit[i]];
    if (!stem) continue;
    const segment = stemSplit[i + 1] || '';
    const forms = [...segment.slice(0, 400).matchAll(/<strong dir="rtl">(.*?)<\/strong>/g)].map(m => tidy(stripTags(m[1])));
    const contr = [...segment.slice(0, 300).matchAll(/contr\.\s*<a [^>]*>(.*?)<\/a>/g)].map(m => tidy(stripTags(m[1])));
    const english = (segment.match(/<i>(.*?)<\/i>/) || [])[1] || '';
    record.stems.push({ stem, forms: [...forms, ...contr].filter(isHebrewWord).map(pointed => ({ pointed, key: keyOf(pointed) })), english: tidy(stripTags(english)), evidence: evidenceOf(segment), hebrewEq: hebrewEquivalents(segment) });
  }
  // Inflected forms he names (Pl., Part., Inf., Imper., Fut., contr., constr., …) and the words of his quotations that
  // share the headword's root.
  const mainKey = heads[0]?.key || '';
  const forms = new Map();
  const addForm = (pointed, via) => {
    const text = tidy(pointed);
    if (!isHebrewWord(text)) return;
    const key = keyOf(text);
    if (!key || key.length < 2 || /[״׳]/.test(key)) return;
    if (!forms.has(key)) forms.set(key, { pointed: text, key, via });
  };
  for (const m of html.matchAll(/\b(Pl|pl|Part|Inf|Imper|Fut|contr|constr|Sing|sing|Du|du|Fem|fem|Pass|pass)\.?\s*(?:pass\.\s*)?((?:\s*(?:<a [^>]*>[^<]*<\/a>|<span dir="rtl">[^<]*<\/span>)\s*,?)+)/g)) {
    for (const t of [...m[2].matchAll(/>([^<]+)</g)].map(x => x[1])) for (const w of t.split(/[,\s]+/)) addForm(w, m[1].toLowerCase());
  }
  if (mainKey) for (const span of rtlSpans(html)) for (const w of span.split(/[\s־]+/)) {
    const key = keyOf(w);
    if (key && key.length >= 3 && !/[״׳]/.test(key) && sharesRoot(key.replace(/^(ו|ד|ל|ב|כ|מ|וד|ול|דל|וב|דב|ומ|דמ|קא|וקא|דקא)(?=...)/, ''), mainKey.replace(/[״׳]/g, ''))) addForm(w, 'quote');
  }
  for (const link of linkTexts(html)) if (isHebrewWord(link.text) && keyOf(link.text) !== mainKey && sharesRoot(keyOf(link.text), mainKey) && link.ref === entry.ref.replace(/^Jastrow, /, '')) addForm(link.text, 'link');
  record.forms = [...forms.values()];
  return record;
}

export function parseJastrow(rawText) {
  const out = [];
  let order = 0;
  for (const line of rawText.split('\n')) if (line) out.push(parseJastrowEntry(JSON.parse(line), order++));
  // Resolve "ch. same": the Hebrew word of the linked entry (its first head) is the Aramaic word's Hebrew equivalent.
  const byId = new Map(out.map(r => [r.id, r]));
  for (const r of out) {
    if (!r.sameAs) continue;
    const target = byId.get(r.sameAs) || byId.get(r.sameAs.replace(/\s+\d+$/, ''));
    if (target && target.heads[0]) r.sameAsHebrew = { pointed: target.heads[0].pointed, key: target.heads[0].key, id: target.id, stems: target.stems.map(s => ({ stem: HEBREW_STEM_ALIAS[s.stem] || s.stem, forms: s.forms })) };
  }
  return out;
}
export { unpoint };
