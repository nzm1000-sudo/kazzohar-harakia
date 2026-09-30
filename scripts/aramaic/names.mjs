// Proper names for the token classifier (PROPER_NAME) — from two open sources, independent of the resolver:
//   · the Open Scriptures Hebrew Bible (CC BY 4.0): every segment tagged Np (a proper noun) in the Tanakh — the names
//     Onkelos and the Biblical Aramaic chapters repeat (משה, פרעה, יעקב, מצרים …)
//   · Jastrow (1903, public domain): every entry marked "pr. n." (a name of a person or place)
// A name that is also an ordinary word of either dictionary (אבא "father", אדם "man") is left out, and so is a form the
// Tanakh uses as a proper noun in less than half of its occurrences (בה, הגוים): such a word is classified by its
// language like any other. The divine name as the Targum and the siddur print it (יי) is a name.
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { ROOT } from './corpora.mjs';
import { normalizeLookupToken } from '../../src/services/wordLookup/normalize.mjs';

const lines = path => (existsSync(join(ROOT, path)) ? gunzipSync(readFileSync(join(ROOT, path))).toString('utf8').split('\n').filter(Boolean) : []);
const clean = word => normalizeLookupToken(String(word).replace(/[²³⁴⁵⁶⁷⁸⁹¹⁰*]/g, '').replace(/\s+(I{1,3}|IV|V|VI)$/, '').trim());

export function loadNames() {
  const names = new Set(['יי', 'ייי', 'יהוה']);
  const lexical = new Set();
  const np = new Map();
  const all = new Map();
  for (const row of lines('sources/morphhb/raw/words.tsv.gz')) {
    const [, surface, , morph] = row.split('\t');
    const segments = surface.split('/');
    const codes = morph.replace(/^[HA]/, '').split('/');
    segments.forEach((segment, i) => { const key = clean(segment); if (!key || key.length < 2) return; all.set(key, (all.get(key) || 0) + 1); if (codes[i] === 'Np') np.set(key, (np.get(key) || 0) + 1); });
    // The whole word (prefixes included) too: הגוים as a word is mostly "the nations".
    const whole = clean(segments.join('')); if (whole && segments.length > 1) all.set(whole, (all.get(whole) || 0) + 1);
  }
  const strong = new Set(); // a Tanakh name in 90% of ten or more occurrences (פרעה, מצרים) survives a dictionary homograph
  for (const [key, n] of np) { if (n * 2 >= (all.get(key) || 0)) names.add(key); else lexical.add(key); if (n >= 10 && n >= 0.9 * (all.get(key) || 0)) strong.add(key); }
  for (const [key, n] of all) if (!np.has(key) && n >= 3) lexical.add(key);
  // The Hebrew names of the books of the Tanakh (the Zohar and the commentaries cite them in parentheses).
  names.books = new Set(BOOK_NAMES.map(book => normalizeLookupToken(book)));
  const sages = new Set();
  for (const line of lines('sources/jastrow/raw/entries.jsonl.gz')) {
    const entry = JSON.parse(line);
    const html = entry.text.join(' ');
    const lead = html.match(/^(\s*<strong[^>]*>.*?<\/strong>\s*,?\s*)+/);
    const heads = lead ? [...lead[0].matchAll(/<strong[^>]*>(.*?)<\/strong>/g)].map(m => clean(m[1].replace(/<[^>]*>/g, ''))) : [clean(entry.ref.replace(/^Jastrow, /, ''))];
    const after = html.slice(lead ? lead[0].length : 0).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const head = after.slice(0, 60);
    const firstItalic = (html.match(/<i>(.*?)<\/i>/) || [])[1] || '';
    // A name: "pr. n.", or an entry with no part of speech whose first gloss is a capitalised English name (Samuel).
    const marked = /^,?\s*(\(b\. h\.\)\s*)?(\([^)]*\)\s*)?pr\. n\./.test(head) || /^,?\s*\(b\. h\.\)\s*$/.test(head.slice(0, 8)) && /^[A-Z]/.test(firstItalic);
    const lexicalEntry = /^,?\s*(ch\.|m\.|f\.|adj\.|adv\.|v\.|prep\.|conj\.|pron\.|interj\.|\(b\. h\.\)\s*(m|f|adj|v)\.)/.test(head) || /<strong>(Pa|Af|Pi|Hif|Nif|Ithpe|Ithpa)\.<\/strong>/.test(html);
    const isName = marked;
    for (const key of heads) if (key && key.length >= 2) (isName ? names : lexicalEntry ? lexical : null)?.add(key);
    if (isName && /\b(Amora|Tanna|Amoraim|Tannaim)\b/.test(after.slice(0, 240))) for (const key of heads) if (key && key.length >= 2) sages.add(key);
  }
  // Krupnik & Silbermann: "שם אמורא / תנא / חכם".
  for (const line of lines('sources/talmud-dictionary/raw/entries.jsonl.gz')) {
    const entry = JSON.parse(line);
    const html = entry.he.join(' ');
    if (!/<\/big><\/big>[^<]*(?:<small>[^<]*<\/small>)?\s*(?:<br>)?\s*(?:1\)\s*)?(שם (אמורא|תנא|חכם)|האמורא|התנא)/.test(html)) continue;
    for (const m of html.matchAll(/<big><big>(.*?)<\/big><\/big>/g)) { const key = clean(m[1].replace(/<[^>]*>/g, '').replace(/\[.*?\]/g, '')); if (key && key.length >= 2) sages.add(key); }
  }
  for (const key of lexical) if (!strong.has(key)) names.delete(key);
  names.lexical = lexical;
  // A sage whose letters are also an ordinary word of the dictionaries (לא, מנא "whence", ריש "head") is not a name
  // by default — except the reviewed few that the Gemara uses almost only as the sage's name.
  for (const key of [...sages]) if (lexical.has(key) && !SAGE_DOMINANT.includes(key)) sages.delete(key);
  for (const key of SAGE_DOMINANT) sages.add(key);
  names.sages = sages;
  return names;
}

// Reviewed: letters that are also a word, but that the Bavli uses (nearly) only as a sage's name — רבא and רבה (Rava,
// Rabbah; "great" is רבה/רבא only in fixed phrases the Gemara rarely has), עולא (Ulla; "infant" is Hebrew עולל),
// רבינא (Ravina), שמואל, אביי, אמימר (always the Amora).
export const SAGE_DOMINANT = Object.freeze(['רבא', 'רבה', 'עולא', 'רבינא', 'שמואל', 'אביי', 'אמימר']);
const BOOK_NAMES = ['בראשית', 'שמות', 'ויקרא', 'במדבר', 'דברים', 'יהושע', 'שופטים', 'שמואל', 'מלכים', 'ישעיה', 'ישעיהו', 'ירמיה', 'ירמיהו', 'יחזקאל', 'הושע', 'יואל', 'עמוס', 'עובדיה', 'יונה', 'מיכה', 'נחום', 'חבקוק', 'צפניה', 'חגי', 'זכריה', 'מלאכי', 'תהלים', 'תהילים', 'משלי', 'איוב', 'שיר', 'רות', 'איכה', 'קהלת', 'אסתר', 'דניאל', 'עזרא', 'נחמיה', 'הימים'];
const NAME_PREFIXES = ['ו', 'ד', 'ל', 'ב', 'כ', 'מ', 'וד', 'ול', 'וב', 'ומ', 'דל', 'דב', 'דמ', 'וכ', 'מד', 'כד'];
// A name, or a prefix on a name of three letters or more.
export const isBookName = (key, names) => names.books.has(key) || NAME_PREFIXES.some(prefix => key.startsWith(prefix) && names.books.has(key.slice(prefix.length)));
export const isSageForm = (key, names) => names.sages.has(key) || NAME_PREFIXES.some(prefix => key.startsWith(prefix) && key.length - prefix.length >= 3 && names.sages.has(key.slice(prefix.length)));
// A form that is itself an ordinary word (בעירא "cattle" is not ב + עירא) is not taken apart.
export const isNameForm = (key, names) => names.has(key) || (!names.lexical?.has(key) && NAME_PREFIXES.some(prefix => key.startsWith(prefix) && key.length - prefix.length >= 3 && names.has(key.slice(prefix.length))));
