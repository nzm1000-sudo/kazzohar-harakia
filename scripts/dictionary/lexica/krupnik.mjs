// Parser of Krupnik & Silbermann, "A Dictionary of the Talmud, the Midrash and the Targum" (London 1927, via Sefaria):
// every entry → a structured record (build time only; nothing here is shipped as such).
//   { id, order, heads:[{pointed,key}], kind: 'word'|'root'|'phrase'|'abbreviation'|'hebrew-sense', see, name,
//     senses: [{ n, form, formKey, stem, pos, def, gloss, glossReject, evidence:{corpus:n}, quotes:[text] }] }
// The Hebrew definition of a sense is the text before its English/German translation; its short display gloss is cut
// by fixed rules (cleanGloss): markup dropped, parenthesised explanations and cross references refused, the first
// alternative "א, ב" kept when the whole is longer than four words, anything longer refused. A sense keeps the corpora
// its citations point to (Bavli, Yerushalmi, Targum, Midrash, Mishnah …) — the evidence the resolver uses to choose
// among senses per dialect, never to invent one.
import { stripTags, tidy, words, unpoint, HEBREW_ONLY, keyOf, citationCorpus } from './common.mjs';
import { isAbbreviationKey } from '../../../src/services/wordLookup/normalize.mjs';

const POS = [[/^פ[״׳]|^הפ׳|^פע׳|^נפ׳|^התפ׳|^פיעל|^פ׳|^אפ׳|^אתפ׳|^פא׳|^שפ׳|^פו׳/, 'v'], [/^[זנ][״׳]|^ז״ר|^נ״ר|^ז״ז/, 'n'], [/^תה״פ/, 'adv'], [/^ת׳/, 'adj'], [/^מ״[יחשג]|^מה״ש|^שה״מ|^מ״ג/, 'particle']];
export const posOf = mark => { for (const [re, pos] of POS) if (re.test(mark || '')) return pos; return mark ? 'other' : ''; };
const STEM = [[/^הפ׳/, 'hif'], [/^נפ׳/, 'nif'], [/^התפ׳|^נתפ׳/, 'hitp'], [/^אפ׳/, 'af'], [/^אתפ׳/, 'itp'], [/^פיע׳|^פע׳|^פַעל|^פִעל|^פיעל|^פַּעֵל|^פא׳/, 'pa'], [/^שפ׳|^שפע׳/, 'shaf'], [/^אשתפ׳/, 'ishtaf'], [/^פלפ׳/, 'pilpel'], [/^פ״[עי]/, 'qal']];
export const stemOf = mark => { for (const [re, stem] of STEM) if (re.test(mark || '')) return stem; return ''; };
export const GRAMMAR = /^(?:(?:פ״[יע]|ז׳|נ׳|ז״ר|נ״ר|ז״ז|ת׳|תה״פ|מ״ח|מ״ש|מה״ש|מ״י|מ״ג|שה״מ|הפ׳|אפ׳|אתפ׳|התפ׳|נתפ׳|נפ׳|פיע׳|פע׳|פעל׳|שפ׳|שפע׳|פא׳|פו׳|הו׳|התפע׳|אשתפ׳|פלפ׳|פַעל|פִעל|פיעל|פַּעֵל)[,\s]+)+/;
const NAME = /^(שם\s|שמות\s|שמו\s|כינוי|כנוי|תואר\s|התנא$|האמורא$|המיסד|מין\s+[^\s]+\s*$)/;

// The short display gloss of a Hebrew definition, or { reject } — fixed rules, no rewriting.
export function cleanGloss(defText) {
  let def = tidy(defText).replace(/[.:]$/, '').trim();
  const grammar = def.match(GRAMMAR);
  let pos = '';
  if (grammar) { pos = grammar[0].trim(); def = def.slice(grammar[0].length).trim(); }
  if (!def) return { reject: 'no-hebrew-definition', pos };
  if (/[״׳]/.test(def)) return { reject: 'abbreviation-or-reference-in-definition', pos };
  if (/[()[\]]/.test(def)) return { reject: 'explanation-in-parentheses', pos };
  if (/(^|\s)(עי׳|ע״ע|כנ״ל)(\s|$)|=|\d|[A-Za-z]/.test(def)) return { reject: 'cross-reference-or-mixed', pos };
  if (NAME.test(def) || /^(ב|מ)ארץ ישראל$|^בבבל$/.test(def)) return { reject: 'proper-name', pos, name: true };
  if (!HEBREW_ONLY.test(def)) return { reject: 'not-plain-hebrew', pos };
  let gloss = def;
  if (words(gloss).length > 4) {
    const first = gloss.split(/[,;]\s*/)[0].trim();
    if (words(first).length <= 4 && first !== gloss) gloss = first; else return { reject: 'too-long', pos };
  }
  gloss = gloss.replace(/[,;?]\s*$/, '').replace(/\s*[,;]\s*/g, ', ').trim();
  return { gloss: unpoint(gloss) === gloss ? gloss : gloss, pos };
}

function evidenceOf(html) {
  const evidence = {};
  const add = corpus => { evidence[corpus] = (evidence[corpus] || 0) + 1; };
  for (const m of html.matchAll(/<a [^>]*data-ref="([^"]+)"[^>]*>(.*?)<\/a>/g)) if (!/^A Dictionary of the Talmud/.test(m[1])) add(citationCorpus(m[1], stripTags(m[2])));
  // Unlinked citations: an abbreviated book and a page/chapter before a colon.
  const plain = html.replace(/<a [^>]*>.*?<\/a>/g, ' ').replace(/<span class="englishWithinHebrew"[^>]*>.*?<\/span>/g, ' ');
  for (const m of stripTags(plain).matchAll(/(?:^|[;.]\s*)([א-ת][^:;]{1,30}?(?:ע״[אבגד]|פ״[א-ת]+(?: מ״[א-ת]+)?|[א-ת]{1,3}׳ [א-ת״׳]+))\s*:/g)) add(citationCorpus('', m[1].trim()));
  return evidence;
}
function quotesOf(html) {
  const plain = tidy(stripTags(html.replace(/<span class="englishWithinHebrew"[^>]*>.*?<\/span>/g, ' ')));
  const out = [];
  for (const m of plain.matchAll(/:\s*([^;:]+?)(?=;|$|\s[א-ת]+׳\s)/g)) { const q = m[1].replace(/\.$/, '').trim(); if (q && /[א-ת]/.test(q)) out.push(q); }
  return out;
}

export function parseKrupnikEntry(entry, order) {
  const id = entry.ref.replace(/^A Dictionary of the Talmud, /, '');
  const html = entry.he.join('<br>');
  const lead = html.match(/^(\s*(<big><big>.*?<\/big><\/big>|<small>.*?<\/small>|,)\s*)+/);
  if (!lead) return { id, order, heads: [], kind: 'unparsed', senses: [] };
  const rawHeads = [...lead[0].matchAll(/<big><big>(.*?)<\/big><\/big>/g)].map(m => tidy(stripTags(m[1])));
  const leadPos = [...lead[0].matchAll(/<small>(.*?)<\/small>/g)].map(m => tidy(stripTags(m[1])))[0] || '';
  const heads = rawHeads.map(h => h.replace(/\s*\[.*?\]\s*/g, ' ').trim()).filter(Boolean).map(pointed => ({ pointed, key: keyOf(pointed.replace(/[()·–]/g, '')) }));
  const bracketHeads = rawHeads.flatMap(h => [...h.matchAll(/\[(.*?)\]/g)].map(m => m[1].trim())).map(pointed => ({ pointed, key: keyOf(pointed) }));
  let kind = 'word';
  if (rawHeads.some(h => /^\(.*\)$/.test(h))) kind = 'root';
  else if (rawHeads.some(h => /·|–/.test(h))) kind = 'hebrew-sense';
  else if (heads.some(h => words(h.pointed).length > 1)) kind = 'phrase';
  else if (heads.length && heads.every(h => isAbbreviationKey(h.key))) kind = 'abbreviation';
  const rest = html.slice(lead[0].length);
  const record = { id, order, heads, altHeads: bracketHeads, kind, leadPos, pos: posOf(leadPos), see: null, name: false, senses: [], abbreviation: null };
  const see = rest.match(/^\s*(?:\[[^\]]*\]\s*)?(?:<br>\s*)?(?:1\)\s*)?עי׳\s*<a [^>]*data-ref="A Dictionary of the Talmud, ([^"]+)"/);
  if (see) { record.see = see[1].replace(/[²³⁴⁵⁶⁷⁸⁹¹⁰]+$/, ''); return record; }
  if (kind === 'abbreviation') {
    const body = tidy(stripTags(rest)).replace(/\.$/, '');
    record.abbreviation = { body, expansions: [...new Set(body.split(/;\s*/).map(item => item.replace(/\.$/, '').trim()).filter(Boolean))] };
    return record;
  }
  // Chunks: a new chunk at <br>, at a sense number "N)", or at a bold form.
  const chunks = [];
  let cur = '';
  const parts = rest.replace(/(<br>|^)\s*(\d+\))/g, '$1 $2').split(/(<br>|(?:^|\s)\d+\)\s|<b>)/);
  for (const part of parts) {
    if (part === undefined) continue;
    if (part === '<br>' || /^\s?\d+\)\s$/.test(part) || part === '<b>') { if (cur.trim()) chunks.push(cur); cur = part === '<b>' ? '<b>' : (/\d/.test(part) ? `#${part.trim()}` : ''); continue; }
    cur += part;
  }
  if (cur.trim()) chunks.push(cur);
  let form = null;
  let formStem = '';
  let formPos = record.pos;
  let n = 0;
  for (let chunk of chunks) {
    const num = chunk.match(/^#(\d+)\)/);
    if (num) chunk = chunk.slice(num[0].length);
    const bold = chunk.match(/^\s*<b>(.*?)<\/b>\s*(?:<small>(.*?)<\/small>)?/);
    if (bold) {
      form = tidy(stripTags(bold[1])).split(/,\s*/).map(pointed => ({ pointed, key: keyOf(pointed) })).filter(f => f.key);
      const mark = tidy(stripTags(bold[2] || chunk.slice(bold[0].length).match(GRAMMAR)?.[0] || ''));
      formStem = stemOf(mark); formPos = posOf(mark) || record.pos;
      chunk = chunk.slice(bold[0].length);
    }
    const small = chunk.match(/^\s*<small>(.*?)<\/small>/);
    let pos = form ? formPos : record.pos;
    if (small) { pos = posOf(tidy(stripTags(small[1]))) || pos; chunk = chunk.slice(small[0].length); }
    const english = chunk.indexOf('<span class="englishWithinHebrew"');
    if (english < 0) continue; // a form header whose senses follow, or a continuation of citations
    const defHtml = chunk.slice(0, english);
    const after = chunk.slice(english);
    const cleaned = cleanGloss(stripTags(defHtml.replace(/<definition\s*\/>/g, ' ')));
    if (cleaned.name) record.name = true;
    const stem = form ? (formStem || stemOf(cleaned.pos)) : stemOf(cleaned.pos || record.leadPos);
    n += 1;
    record.senses.push({
      n, form: form ? form.map(f => f.pointed) : null, formKeys: form ? form.map(f => f.key) : null, stem, pos: posOf(cleaned.pos) || pos,
      def: tidy(stripTags(defHtml)), gloss: cleaned.gloss || null, glossReject: cleaned.reject || null,
      english: tidy(stripTags(after.match(/<span class="englishWithinHebrew"[^>]*>(.*?)<\/span>/)?.[1] || '')),
      evidence: evidenceOf(after), quotes: quotesOf(after.replace(/^<span class="englishWithinHebrew"[^>]*>.*?<\/span>/, '')),
    });
  }
  return record;
}

export function parseKrupnik(rawText) {
  const out = [];
  let order = 0;
  for (const line of rawText.split('\n')) if (line) out.push(parseKrupnikEntry(JSON.parse(line), order++));
  return out;
}
