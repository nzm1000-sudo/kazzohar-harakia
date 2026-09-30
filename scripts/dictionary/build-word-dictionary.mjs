// Builds the word dictionary of the readers (מילון בלחיצה) from its licensed sources — offline, deterministic, no model.
// Run: node scripts/dictionary/build-word-dictionary.mjs [--check]
//   reads   sources/talmud-dictionary/raw/entries.jsonl.gz   (Krupnik & Silbermann 1927, via Sefaria; public domain)
//           sources/hebrew-wiktionary/raw/pages.jsonl.gz     (Hebrew Wiktionary, pinned revisions; CC BY-SA 4.0)
//           src/data/dictionary/sources.mjs  (registry + rights gate)   src/data/dictionary/reviewed.mjs (reviewed rules)
//           src/data/tanakh.json  (to recognise common Biblical Hebrew homographs)
//   writes  src/data/dictionary/wordDictionary.mjs      (the compact index the app loads; the only shipped output)
//           sources/word-dictionary/entries.jsonl        (every production entry with its full internal record)
//           sources/word-dictionary/build-report.json    (counts, exclusions by reason, sizes)
// --check: build in memory and fail if the committed outputs differ (the tests and CI use it).
//
// The rights gate comes first: every imported source must be complete and cleared in the registry, and each raw file's
// sha256 (of its uncompressed text — never of gzip bytes, which differ between Node versions) must equal contentHash.
//
// From a source entry to a display gloss — fixed rules only (no rewriting, no model):
//   Krupnik: the Hebrew definition is the text between the part-of-speech mark and the English/German translation;
//     numbered senses are separate glosses; a form printed in bold inside an entry (a binyan) gets its own gloss;
//     "עי׳ X" (see X) makes the headword an alias of X. Left out: root entries "(אמר)", special senses of Hebrew words
//     "שָׁקַל·–", multi-word headwords, proper names (שם אמורא / תנא / מקום …), explanations in parentheses, cross
//     references inside a definition, definitions of more than four words whose first alternative is also longer.
//     A longer definition "א, ב" keeps its first alternative only when the whole is longer than four words.
//   Wiktionary: only the listed Aramaic words (their {{ארמית}} senses) and abbreviations whose senses, after dropping
//     senses labelled outside Judaism (צה"ל, מחשבים, רפואה…), leave exactly one — or a reviewed choice among them.
//   Everywhere: a gloss equal to its word is dropped; words found three or more times in the Hebrew of the Tanakh are
//     left out (a Hebrew homograph would be glossed wrongly) unless reviewed; a plene spelling of a pointed headword
//     (חיריק → י, קובוץ/חולם → ו) is an alias; abbreviations keep up to six words per expansion.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DICTIONARY_SOURCES, auditDictionarySources, importedSources } from '../../src/data/dictionary/sources.mjs';
import { CONTEXT_CHOICES, FAMILY_LIMITS, HEBREW_HOMOGRAPH_ALLOW, WIKTIONARY_ARAMAIC_ALLOW, EXCLUDED, FREQUENT_REVIEWED, GERESH_ALLOW, PREFIX_REVIEWED } from '../../src/data/dictionary/reviewed.mjs';
import { normalizeLookupToken, isAbbreviationKey, LOOKUP_NORMALIZER_VERSION } from '../../src/services/wordLookup/normalize.mjs';
import { setWordDictionary, lookupWord, resolveWordContext } from '../../src/services/wordLookup/engine.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CHECK = process.argv.includes('--check');
const sha256 = text => createHash('sha256').update(text).digest('hex');
const fail = message => { console.error(`build-word-dictionary: ${message}`); process.exit(1); };
export const BUILD_RULES_VERSION = 1;

// ---------- Rights gate ----------
const problems = auditDictionarySources();
const rawText = {};
for (const source of importedSources()) {
  const text = gunzipSync(readFileSync(join(ROOT, `${source.rawFile}.gz`))).toString('utf8');
  const hash = `sha256:${sha256(text)}`;
  if (hash !== source.contentHash) problems.push(`${source.sourceId}: raw file hash ${hash} ≠ registry ${source.contentHash}`);
  rawText[source.sourceId] = text;
}
if (problems.length) fail(`rights gate:\n  ${problems.join('\n  ')}`);

// ---------- Common Biblical Hebrew (Aramaic chapters of the Tanakh excluded) ----------
const ARAMAIC_TANAKH = { Daniel: [[2, 4, 7, 28]], Ezra: [[4, 8, 6, 18], [7, 12, 7, 26]], Jeremiah: [[10, 11, 10, 11]], Genesis: [[31, 47, 31, 47]] };
const inRange = (book, c, v) => (ARAMAIC_TANAKH[book] || []).some(([c1, v1, c2, v2]) => (c > c1 || (c === c1 && v >= v1)) && (c < c2 || (c === c2 && v <= v2)));
const tanakh = JSON.parse(readFileSync(join(ROOT, 'src/data/tanakh.json'), 'utf8'));
const hebrewFrequency = new Map();
for (const book of tanakh.books) for (const [c, v, text] of book.verses) {
  if (inRange(book.id, c, v)) continue;
  for (const word of text.split(/[\s־׀׃]+/)) { const key = normalizeLookupToken(word); if (key) hebrewFrequency.set(key, (hebrewFrequency.get(key) || 0) + 1); }
}
const HEBREW_COMMON = 1; // a form found in the Hebrew of the Tanakh is Hebrew: not glossed (unless reviewed)
// The app's own bundled Mishnah and Bavli (read to count words only): a rare word known from the Targum or the Midrash
// alone is not glossed where it is spelled like a common word of the Mishnah or the Gemara (דַּהֲכָא "scorn", Targum
// Job, would otherwise gloss the Gemara's דהכא "of here").
function corpusFrequency(dir, { field = 'text', only = null } = {}) {
  const counts = new Map();
  const titled = new Map(); // how often the word follows a title (ר׳, רבי, רב, בר…): a sage's name
  for (const file of readdirSync(join(ROOT, dir)).filter(name => name.endsWith('.json.gz') && !name.includes('.anchors.') && (!only || name.startsWith(only))).sort()) {
    const pack = JSON.parse(gunzipSync(readFileSync(join(ROOT, dir, file))).toString('utf8'));
    for (const node of pack.nodes || []) for (const unit of node.units || []) {
      let previous = '';
      for (const word of String(unit[field] || '').split(/[\s\u05BE]+/)) {
        const key = normalizeLookupToken(word);
        if (!key) continue;
        counts.set(key, (counts.get(key) || 0) + 1);
        if (TITLES.has(previous)) titled.set(key, (titled.get(key) || 0) + 1);
        previous = key;
      }
    }
  }
  return { counts, titled };
}
const TITLES = new Set(['ר׳', 'רבי', 'רב', 'בר', 'רבן', 'מר', 'דרבי', 'דרב', 'ורבי', 'ורב', 'לרבי', 'לרב', 'כרבי', 'כרב', 'מרבי', 'מרב', 'אבוה', 'ברבי', 'בריה', 'דר׳', 'ור׳', 'לר׳', 'כר׳', 'מר׳']);
const mishnahCorpus = corpusFrequency('public/library/packs/sefaria-torat-emet-357-mishnah');
const bavliCorpus = corpusFrequency('public/library/packs/wikisource-talmud-cc-by-sa');
const mishnahFrequency = mishnahCorpus.counts;
// The Mishneh Torah: rabbinic Hebrew at its widest; a word it uses twice or more is Hebrew, not glossed.
const rambamFrequency = corpusFrequency('public/library/packs/sefaria-mishneh-torah-torat-emet-363').counts;
const RAMBAM_COMMON = 2;
const bavliFrequency = bavliCorpus.counts;
// The Zohar and Onkelos (the app's own packs): their frequent words are reviewed too, and their prefix forms checked.
const zoharFrequency = corpusFrequency('public/library/packs/wikisource-zohar-cc-by-sa', { only: 'Zohar' }).counts;
const targumFrequency = corpusFrequency('public/library/packs/shnayim-mikra-sefaria-pd', { field: 'targum' }).counts;
const ZOHAR_REVIEW = 20;
const TARGUM_REVIEW = 10;
const nameShare = key => { const n = bavliFrequency.get(key) || 0; return n >= 5 ? (bavliCorpus.titled.get(key) || 0) / n : 0; };
const MISHNAH_COMMON = 1; // a word the Mishnah uses is Hebrew the reader knows: not glossed
const BAVLI_COMMON = 20;
const BAVLI_REVIEW = 20; // a word the Gemara uses this often is glossed only once reviewed (reviewed.mjs › FREQUENT_REVIEWED)
// A reviewed word that is also Biblical Hebrew: glossed everywhere but where verses are quoted most (Tanakh
// commentaries, Midrash, the generic reader).
const NOT_WHERE_VERSES_ARE = ['talmud', 'talmud-commentary', 'mishnah-commentary', 'zohar', 'kabbalah', 'targum', 'halacha', 'rambam', 'responsa', 'chassidut', 'machshava', 'mussar'];
const homographAllow = new Map(HEBREW_HOMOGRAPH_ALLOW.map(rule => [normalizeLookupToken(rule.key), rule]));

// ---------- Shared helpers ----------
const MARKS = /[֑-ְ֯-ׇֽֿׁׂׅׄ]/g;
const stripTags = html => html.replace(/<[^>]*>/g, ' ');
const tidy = text => text.replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ').trim();
const words = text => text.split(/\s+/).filter(Boolean);
const HEBREW_ONLY = /^[א-ת֑-ׇ׳״׳״'"\s,\-־?]+$/;
// Plene spellings of a pointed word (as unvocalized texts write it): hiriq before a consonant → + י; kubbutz → ו;
// holam on a consonant (not on/before a vav) → + ו.
export function pleneOf(pointed) {
  const clusters = [];
  for (const ch of pointed) { if (/[א-ת]/.test(ch)) clusters.push({ letter: ch, marks: '' }); else if (clusters.length) clusters.at(-1).marks += ch; }
  let out = '';
  clusters.forEach((cluster, i) => {
    out += cluster.letter;
    const next = clusters[i + 1]?.letter;
    if (i === clusters.length - 1) return;
    if (cluster.marks.includes('ִ') && next !== 'י') out += 'י';
    else if (cluster.marks.includes('ֻ') && next !== 'ו') out += 'ו';
    else if (cluster.marks.includes('ֹ') && cluster.letter !== 'ו' && next !== 'ו') out += 'ו';
  });
  return normalizeLookupToken(out);
}
const POS = [[/^פ[״׳]|^הפ׳|^פע׳|^נפ׳|^התפ׳|^פיעל|^פ׳/, 'v'], [/^[זנ][״׳]|^ז״ר|^נ״ר/, 'n'], [/^תה״פ/, 'adv'], [/^ת׳/, 'adj']];
const posOf = mark => { for (const [re, pos] of POS) if (re.test(mark || '')) return pos; return mark ? 'other' : ''; };
// Grammatical marks a sense may open with when they are not set apart (<small>): dropped from the gloss.
const GRAMMAR = /^(?:(?:פ״[יע]|ז׳|נ׳|ז״ר|נ״ר|ז״ז|ת׳|תה״פ|מ״ח|מ״ש|מה״ש|מ״י|מ״ג|שה״מ|הפ׳|אפ׳|אתפ׳|התפ׳|נתפ׳|נפ׳|פיע׳|פע׳|פעל׳|שפ׳|שפע׳|פא׳|פו׳|הו׳|התפע׳|אשתפ׳|פלפ׳|פַעל|פִעל|פיעל|פַּעֵל)[,\s]+)+/;
const NAME = /^(שם\s|שמות\s|שמו\s|כינוי|כנוי|תואר\s|התנא$|האמורא$|המיסד|מין\s+[^\s]+\s*$)/;

// A citation of the Bavli (a daf: "Berakhot 30b:16", "בר׳ ל׳ ע״ב") or of the Mishnah in the entry.
const TALMUD_CITATION = /data-ref="Mishnah [^"]+"|data-ref="[A-Z][A-Za-z' ]+ \d+[ab](?::[\d-]+)?"|ע״[אבגד]|(?:^|\s)פ״[א-ת]+ מ״[א-ת]+/;
const reasons = {};
const reject = (reason, sample, all = false) => { const r = (reasons[reason] ||= { count: 0, samples: [] }); r.count += 1; if ((all || r.samples.length < 8) && sample) r.samples.push(sample); };

// candidate: { key, gloss, type, pos, sourceId, sourceEntryId, aliases: [], via, confidence }
const candidates = [];
const aliasCandidates = []; // { key, target, sourceId, sourceEntryId, kind }

// ---------- Krupnik ----------
const KRUPNIK = 'krupnik-1927';
function cleanDefinition(html) {
  let text = html;
  const english = text.indexOf('<span class="englishWithinHebrew"');
  if (english >= 0) text = text.slice(0, english);
  return tidy(stripTags(text.replace(/<definition\s*\/>/g, ' ')));
}
function parseKrupnik(entry) {
  const id = entry.ref.replace(/^A Dictionary of the Talmud, /, '');
  const html = entry.he.join('<br>');
  const lead = html.match(/^(\s*(<big><big>.*?<\/big><\/big>|<small>.*?<\/small>|,)\s*)+/);
  if (!lead) return reject('unparsed', id);
  const headwords = [...lead[0].matchAll(/<big><big>(.*?)<\/big><\/big>/g)].map(m => tidy(stripTags(m[1])));
  const leadPos = [...lead[0].matchAll(/<small>(.*?)<\/small>/g)].map(m => tidy(stripTags(m[1])))[0] || '';
  let rest = html.slice(lead[0].length);
  if (headwords.some(h => /^\(.*\)$/.test(h))) return reject('root-entry', id);
  if (headwords.some(h => /·|–/.test(h))) return reject('special-sense-of-hebrew-word', id);
  const heads = headwords.filter(h => words(h).length === 1);
  if (!heads.length) return reject('multi-word-headword', id);
  const isAbbr = heads.every(h => /[״׳]/.test(h));
  // "see X": an alias of X.
  const see = rest.match(/^\s*(?:\[[^\]]*\]\s*)?(?:<br>\s*)?(?:1\)\s*)?עי׳\s*<a [^>]*data-ref="A Dictionary of the Talmud, ([^"]+)"/);
  if (see) {
    for (const h of heads) aliasCandidates.push({ key: normalizeLookupToken(h), target: normalizeLookupToken(see[1].replace(/[²³⁴⁵⁶⁷⁸⁹¹⁰]+$/, '')), sourceId: KRUPNIK, sourceEntryId: id, kind: 'see' });
    return;
  }
  if (isAbbr) {
    const body = tidy(stripTags(rest)).replace(/\.$/, '');
    if (!body || /[<>=\d]|עי׳/.test(body)) return reject('abbreviation-unclear', id);
    const expansions = [...new Set(body.split(/;\s*/).map(item => item.replace(/\.$/, '').trim()).filter(Boolean))];
    for (const h of heads) for (const gloss of expansions) {
      if (words(gloss).length > 6 || !HEBREW_ONLY.test(gloss) || /[()]/.test(gloss)) { reject('abbreviation-expansion-too-long-or-mixed', `${id}: ${gloss}`); continue; }
      candidates.push({ key: normalizeLookupToken(h), gloss, type: 'B', pos: '', sourceId: KRUPNIK, sourceEntryId: id, senses: expansions.length, via: 'headword', confidence: expansions.length === 1 ? 'high' : 'ambiguous' });
    }
    return;
  }
  // Senses: numbered "1) … 2) …" (with or without <br>), else one.
  const parts = rest.split(/(?:<br>\s*|\s|^)\d+\)\s+/).map(part => part.trim()).filter(Boolean);
  const senses = parts.length ? parts : [rest];
  const out = [];
  for (const sense of senses) {
    // A bold form inside the sense (a binyan): "<b>אַטְוֵי</b> צלה …" — the gloss belongs to that form.
    let formHeads = null;
    let body = sense.replace(/^<br>\s*/, '');
    const bold = body.match(/^\s*(?:<small>.*?<\/small>\s*)?(?:<br>\s*)?<b>(.*?)<\/b>\s*(?:<small>(.*?)<\/small>)?/);
    let pos = leadPos;
    const small = body.match(/^\s*<small>(.*?)<\/small>/);
    if (small) pos = tidy(stripTags(small[1]));
    if (bold) { formHeads = [tidy(stripTags(bold[1]))]; if (bold[2]) pos = tidy(stripTags(bold[2])); body = body.slice(bold[0].length); } else body = body.replace(/^\s*<small>.*?<\/small>/, '');
    if (!/englishWithinHebrew/.test(body)) { reject('no-translation-mark (not a definition)', id); continue; }
    let def = cleanDefinition(body).replace(/[.:]$/, '').trim();
    const grammar = def.match(GRAMMAR);
    if (grammar) { if (!small && !bold) pos = grammar[0].trim(); def = def.slice(grammar[0].length).trim(); }
    if (!def) { reject('no-hebrew-definition', id); continue; }
    if (/[״׳]/.test(def)) { reject('abbreviation-or-reference-in-definition', `${id}: ${def}`); continue; }
    if (/^\(/.test(def) || /[()]/.test(def)) { reject('explanation-in-parentheses', `${id}: ${def}`); continue; }
    if (/(^|\s)(עי׳|ע״ע|ראה|כנ״ל)(\s|$)|=|\d|[A-Za-z]/.test(def)) { reject('cross-reference-or-mixed', `${id}: ${def}`); continue; }
    if (NAME.test(def) || /^(ב|מ)ארץ ישראל$|^בבבל$/.test(def)) { reject('proper-name', `${id}: ${def}`); continue; }
    if (!HEBREW_ONLY.test(def)) { reject('not-plain-hebrew', `${id}: ${def}`); continue; }
    let gloss = def;
    if (words(gloss).length > 4) {
      const first = gloss.split(/[,;]\s*/)[0].trim();
      if (words(first).length <= 4 && first !== gloss) gloss = first; else { reject('too-long', `${id}: ${def}`); continue; }
    }
    gloss = gloss.replace(/[,;]\s*$/, '').replace(/\s*[,;]\s*/g, ', ');
    const heads2 = formHeads || heads;
    for (const h of heads2) out.push({ key: normalizeLookupToken(h), pointed: h, gloss, type: 'A', pos: posOf(pos), sourceId: KRUPNIK, sourceEntryId: id, senses: senses.length, via: formHeads ? 'form' : 'headword', confidence: senses.length === 1 ? 'high' : 'ambiguous', citesTalmud: TALMUD_CITATION.test(html) });
  }
  for (const item of out) {
    candidates.push(item);
    const plene = pleneOf(item.pointed);
    if (plene && plene !== item.key) aliasCandidates.push({ key: plene, target: item.key, sourceId: KRUPNIK, sourceEntryId: id, kind: 'plene' });
  }
}
for (const line of rawText[KRUPNIK].split('\n')) if (line) parseKrupnik(JSON.parse(line));

// ---------- Hebrew Wiktionary ----------
const WIKT = 'he-wiktionary';
const JEWISH_LABELS = /^(ארון הספרים היהודי|יהדות|ארמית|תלמוד|הלכה|קבלה|תפילה|ברכות|חסידות|תורה|מקרא|חז"ל|חזל)$/;
function cleanWiki(text) {
  return tidy(text
    .replace(/<\/?br\s*\/?>.*$/i, '') // an alternative after a line break is dropped
    .replace(/<small>.*?<\/small>/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'''|''/g, '')
    .replace(/\s+–\s+.*$/, '')).replace(/\.$/, '').replace(/'/g, '׳').replace(/"/g, '״').trim();
}
const allowAramaic = new Set(WIKTIONARY_ARAMAIC_ALLOW.map(normalizeLookupToken));
for (const line of rawText[WIKT].split('\n')) {
  if (!line) continue;
  const page = JSON.parse(line);
  const sections = page.wikitext.split(/^==(?!=)\s*(.+?)\s*==\s*$/m); // [pre, head1, body1, head2, body2…]
  const abbreviationPage = page.categories.some(c => c.includes('ראשי תיבות'));
  const bySenses = new Map();
  for (let i = 1; i < sections.length; i += 2) {
    const heading = sections[i].replace(/\{\{.*?\}\}/g, '').trim();
    const body = sections[i + 1] || '';
    const key = normalizeLookupToken(heading.replace(/"/g, '״').replace(/'/g, '׳'));
    if (!key) continue;
    const plene = (body.match(/\|\s*כתיב מלא\s*=\s*([^|}\n]+)/) || [])[1]?.trim();
    for (const raw of body.split('\n')) {
      if (!/^#(?![:*])/.test(raw)) continue;
      let text = raw.replace(/^#\s*/, '');
      if (text.includes('{{ארמית}}')) {
        const k = allowAramaic.has(key) ? key : plene && allowAramaic.has(normalizeLookupToken(plene)) ? key : null;
        if (!k) { reject('wiktionary-aramaic-not-allowlisted', `${page.title}`); continue; }
        text = text.replace(/\{\{רובד\|[^}]*\}\}|\{\{חזל\}\}|\{\{ארמית\}\}/g, '').trim();
        if (/\{\{/.test(text)) { reject('wiktionary-template', `${page.title}: ${text}`); continue; }
        const gloss = cleanWiki(text);
        if (!gloss || words(gloss).length > 4 || !HEBREW_ONLY.test(gloss) || /\d/.test(gloss)) { reject('wiktionary-aramaic-too-long-or-mixed', `${page.title}: ${gloss}`); continue; }
        candidates.push({ key, gloss, type: 'A', pos: '', sourceId: WIKT, sourceEntryId: `${page.title}@${page.revid}`, senses: 1, via: 'headword', confidence: 'high' });
        if (plene) aliasCandidates.push({ key: normalizeLookupToken(plene), target: key, sourceId: WIKT, sourceEntryId: `${page.title}@${page.revid}`, kind: 'plene' });
        continue;
      }
      if (!abbreviationPage || !isAbbreviationKey(key)) continue;
      const label = (text.match(/\{\{(?:משלב\/ר"ת|הקשר\/ר"ת|משלב|הקשר)\|([^}|]+)\}\}/) || [])[1];
      if (label && !JEWISH_LABELS.test(label.trim())) { reject('wiktionary-sense-outside-judaism', `${page.title}: ${label}`); continue; }
      text = text.replace(/\{\{(?:משלב\/ר"ת|הקשר\/ר"ת|משלב|הקשר)\|[^}]*\}\}/g, '').trim();
      if (/\{\{/.test(text)) { reject('wiktionary-template', `${page.title}: ${text}`); continue; }
      const gloss = cleanWiki(text);
      if (!gloss || words(gloss).length > 6 || !HEBREW_ONLY.test(gloss) || /\d|[()]/.test(gloss)) { reject('wiktionary-abbreviation-too-long-or-mixed', `${page.title}: ${gloss}`); continue; }
      if (!bySenses.has(key)) bySenses.set(key, []);
      bySenses.get(key).push(gloss);
    }
  }
  for (const [key, glosses] of bySenses) {
    const unique = [...new Set(glosses)];
    for (const gloss of unique) candidates.push({ key, gloss, type: 'B', pos: '', sourceId: WIKT, sourceEntryId: `${page.title}@${page.revid}`, senses: unique.length, via: 'headword', confidence: unique.length === 1 ? 'high' : 'ambiguous' });
  }
}

// ---------- Reviewed rules, filters, merge ----------
const excluded = new Map(EXCLUDED.map(rule => [normalizeLookupToken(rule.key), rule]));
const choices = new Map();
for (const rule of CONTEXT_CHOICES) { const key = normalizeLookupToken(rule.key); if (!choices.has(key)) choices.set(key, []); choices.get(key).push({ ...rule, key }); }
// A reviewed frequent word with one chosen sense is a choice for every family.
const frequentReviewed = new Map(Object.entries(FREQUENT_REVIEWED).map(([key, value]) => [normalizeLookupToken(key), value]));
for (const [key, value] of frequentReviewed) if (typeof value === 'string') { if (!choices.has(key)) choices.set(key, []); choices.get(key).push({ key, gloss: value, families: null, why: 'frequent word, reviewed' }); }
const limits = new Map(FAMILY_LIMITS.map(rule => [normalizeLookupToken(rule.key), rule]));
const byKey = new Map();
for (const item of candidates) {
  if (!item.key || item.key.replace(/[״׳]/g, '').length < (isAbbreviationKey(item.key) ? 2 : 3)) { reject('too-short', `${item.key}: ${item.gloss}`); continue; }
  if (/׳$/.test(item.key) && !/״/.test(item.key) && !GERESH_ALLOW.map(normalizeLookupToken).includes(item.key)) { reject('truncation-with-geresh', `${item.key}: ${item.gloss}`); continue; }
  if (normalizeLookupToken(item.gloss) === item.key) { reject('gloss-equals-word', `${item.sourceEntryId}: ${item.gloss}`); continue; }
  if (excluded.has(item.key)) { reject('reviewed-exclusion', item.key); continue; }
  if (!byKey.has(item.key)) byKey.set(item.key, []);
  byKey.get(item.key).push(item);
}
const priority = Object.fromEntries(importedSources().map(source => [source.sourceId, source.priority]));
const entries = []; // production entries
const index = new Map(); // key → ids
const chosenSeen = new Set();
const awaiting = [];
for (const key of [...byKey.keys()].sort()) {
  let items = byKey.get(key).sort((a, b) => priority[a.sourceId] - priority[b.sourceId] || a.sourceEntryId.localeCompare(b.sourceEntryId) || a.gloss.localeCompare(b.gloss));
  const freq = hebrewFrequency.get(key) || 0;
  const allow = homographAllow.get(key);
  let contexts = [];
  const bavli = bavliFrequency.get(key) || 0;
  const reviewed = frequentReviewed.has(key);
  if (freq >= HEBREW_COMMON && !isAbbreviationKey(key)) {
    // A reviewed Gemara word that is also Biblical Hebrew is glossed in the Aramaic texts and their commentaries only.
    if (!allow && !reviewed) { reject('biblical-hebrew-homograph', `${key} (${freq}×)`); continue; }
    contexts = allow ? allow.families : NOT_WHERE_VERSES_ARE;
  }
  if (limits.has(key)) contexts = limits.get(key).families;
  if (!isAbbreviationKey(key) && !allow && !reviewed) {
    // Hebrew the reader knows (the Mishnah's own words), a sage's name, or a rare word spelled like a common one.
    if ((mishnahFrequency.get(key) || 0) >= MISHNAH_COMMON) { items.forEach(item => reject('common-mishnaic-hebrew', `${key}: ${item.gloss}`)); continue; }
    if ((rambamFrequency.get(key) || 0) >= RAMBAM_COMMON) { items.forEach(item => reject('rabbinic-hebrew-of-the-mishneh-torah', `${key}: ${item.gloss}`)); continue; }
    if (nameShare(key) >= 0.25) { items.forEach(item => reject('sage-name-in-the-gemara', `${key}: ${item.gloss}`)); continue; }
    if (bavli >= BAVLI_COMMON) items = items.filter(item => item.sourceId !== KRUPNIK || item.citesTalmud || reject('rare-word-spelled-like-common-talmudic-word', `${key}: ${item.gloss} (${item.sourceEntryId})`));
  }
  // An abbreviation after ד־ or ו־ that is itself an abbreviation (דא״ר = ד + א״ר, not דרך ארץ רבתי; וא״ל = ו + א״ל).
  if (isAbbreviationKey(key) && /^[דו]/.test(key) && byKey.has(key.slice(1)) && !reviewed) { items.forEach(item => reject('prefixed-abbreviation-collision', `${key}: ${item.gloss}`)); continue; }
  // A word the Gemara uses often is glossed only once a reviewer has checked the gloss against its use there.
  const zohar = zoharFrequency.get(key) || 0;
  const targum = targumFrequency.get(key) || 0;
  if ((bavli >= BAVLI_REVIEW || zohar >= ZOHAR_REVIEW || targum >= TARGUM_REVIEW) && !reviewed && !allow && !choices.has(key)) { items.forEach(item => reject('frequent-word-awaiting-review', `${key} (${bavli}/${zohar}/${targum}×): ${item.gloss}`, true)); awaiting.push({ key, bavli, zohar, targum, glosses: items.map(item => item.gloss) }); continue; }
  // Source priority: the second source fills gaps only — a word the first source glosses keeps its glosses alone.
  if (items.some(item => priority[item.sourceId] === 1)) items = items.filter(item => priority[item.sourceId] === 1 || reject('secondary-source-where-primary-has-the-word', `${key}: ${item.gloss}`));
  // Wiktionary abbreviations with several senses count only through a reviewed choice.
  if (!choices.has(key)) items = items.filter(item => !(item.sourceId === WIKT && item.type === 'B' && item.senses > 1) || reject('wiktionary-ambiguous-abbreviation', `${key}: ${item.gloss}`));
  // Duplicates merged: one gloss once (the higher-priority source keeps it).
  const seen = new Set();
  items = items.filter(item => (seen.has(item.gloss) ? (reject('duplicate-gloss-merged', `${key}: ${item.gloss}`), false) : (seen.add(item.gloss), true)));
  if (!items.length) continue;
  // Reviewed choices: one of the source's own senses, for all families (the others are dropped) or preferred in some.
  const preferOf = new Map(); // item → families
  const rules = choices.get(key) || [];
  for (const rule of rules) {
    const hit = items.find(item => item.gloss === rule.gloss);
    if (!hit) fail(`reviewed choice "${rule.key} → ${rule.gloss}" is not a sense the sources give (${items.map(i => i.gloss).join(' | ')})`);
    chosenSeen.add(`${key}\t${rule.gloss}`);
    if (rule.families === null) { items = [hit]; preferOf.clear(); break; }
    preferOf.set(hit, [...(preferOf.get(hit) || []), ...rule.families]);
  }
  const ids = [];
  for (const item of items) {
    const id = entries.length;
    const isReviewed = rules.length > 0 || reviewed || Boolean(allow);
    entries.push({ id, canonicalKey: key, displayGloss: item.gloss, type: item.type, pos: item.pos, sourceId: item.sourceId, sourceEntryId: item.sourceEntryId, confidence: isReviewed ? 'reviewed' : item.confidence, contexts, prefer: preferOf.get(item) || [], reviewStatus: isReviewed ? 'reviewed' : 'rule', morphology: item.via, aliases: [] });
    ids.push(id);
  }
  index.set(key, ids);
}
for (const [key, rules] of choices) for (const rule of rules) if (!chosenSeen.has(`${key}\t${rule.gloss}`)) fail(`reviewed choice for ${rule.key} → ${rule.gloss} matched nothing`);

// Aliases: a known spelling of an indexed word, never over an indexed word, never a common Hebrew homograph.
const aliases = new Map();
for (const alias of aliasCandidates.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.target < b.target ? -1 : a.target > b.target ? 1 : 0))) {
  if (!alias.key || alias.key === alias.target || index.has(alias.key)) continue;
  if (!index.has(alias.target)) { reject('alias-target-not-kept', `${alias.key} → ${alias.target}`); continue; }
  const freq = hebrewFrequency.get(alias.key) || 0;
  const allow = homographAllow.get(alias.key);
  if (freq >= HEBREW_COMMON && !allow) { reject('alias-is-common-biblical-hebrew', `${alias.key} (${freq}×)`); continue; }
  if ((mishnahFrequency.get(alias.key) || 0) >= MISHNAH_COMMON && !allow) { reject('alias-is-common-mishnaic-hebrew', alias.key); continue; }
  if ((rambamFrequency.get(alias.key) || 0) >= RAMBAM_COMMON && !allow) { reject('alias-is-rabbinic-hebrew', alias.key); continue; }
  if (((bavliFrequency.get(alias.key) || 0) >= BAVLI_COMMON || (zoharFrequency.get(alias.key) || 0) >= ZOHAR_REVIEW || (targumFrequency.get(alias.key) || 0) >= TARGUM_REVIEW) && !frequentReviewed.has(alias.key) && !allow) { reject('alias-is-frequent-in-the-gemara-unreviewed', `${alias.key} → ${alias.target}`); continue; }
  if (alias.key.replace(/[״׳]/g, '').length < 3) { reject('alias-too-short', alias.key); continue; }
  if (aliases.has(alias.key) && aliases.get(alias.key).target !== alias.target) { aliases.get(alias.key).conflict = true; continue; }
  aliases.set(alias.key, alias);
  entries.filter(entry => index.get(alias.target).includes(entry.id)).forEach(entry => entry.aliases.push(alias.key));
}
for (const [key, alias] of [...aliases]) if (alias.conflict) { aliases.delete(key); reject('alias-ambiguous', key); }
// A homograph allowed in some families is allowed as an alias only there: move it to its own indexed key.
for (const [key, alias] of [...aliases]) {
  const allow = homographAllow.get(key);
  if (!allow) continue;
  aliases.delete(key);
  const ids = [];
  for (const id of index.get(alias.target)) { const base = entries[id]; const copy = { ...base, id: entries.length, canonicalKey: key, contexts: allow.families, reviewStatus: 'reviewed', morphology: 'plene', aliases: [] }; entries.push(copy); ids.push(copy.id); }
  index.set(key, ids);
}

for (const key of frequentReviewed.keys()) if (!index.has(key) && !aliases.has(key)) fail(`reviewed frequent word ${key} is not in the dictionary`);

// The short-gloss gate: a gloss is a few words, never a paragraph — an Aramaic word's gloss at most four words, an
// abbreviation's expansion at most six, and no gloss longer than 40 characters. Anything else is a data bug: the build fails.
for (const entry of entries) {
  const n = entry.displayGloss.split(/\s+/).length;
  if (n > (entry.type === 'B' ? 6 : 4) || entry.displayGloss.length > 40 || /\n/.test(entry.displayGloss)) fail(`gloss too long for the bubble: ${entry.canonicalKey} → ${entry.displayGloss}`);
}

// ---------- Output ----------
const SOURCE_IDS = importedSources().map(source => source.sourceId);
const TYPE_CODE = { A: 'A', B: 'B' };
const entryLine = entry => [entry.displayGloss, TYPE_CODE[entry.type], SOURCE_IDS.indexOf(entry.sourceId), entry.contexts.join(','), entry.prefer.join(','), entry.pos].join('\t');
const ENTRIES = entries.map(entryLine).join('\n');
const INDEX = [...index.keys()].sort().map(key => `${key}\t${index.get(key).join(',')}`).join('\n');
const ALIASES = [...aliases.keys()].sort().map(key => `${key}\t${aliases.get(key).target}`).join('\n');
// Prefix forms (ו־ ד־ ב־ ל־ כ־ + a known word) are composed at tap time — but a form the Mishnah uses, or one the Gemara
// uses five times or more, is often a word of its own (דמיא "is like", כספא "silver", בבלאי "Babylonians"): the engine
// itself is run over both corpora here, and every such composition not reviewed (reviewed.mjs › PREFIX_REVIEWED) is
// listed in NOPREFIX so the engine leaves it alone.
const prefixReviewed = new Set(PREFIX_REVIEWED.map(normalizeLookupToken));
setWordDictionary({ SOURCE_IDS: importedSources().map(source => source.sourceId), ENTRIES, INDEX, ALIASES, NOPREFIX: '' });
const noPrefix = new Set();
const prefixSeen = new Set();
for (const [key] of [...bavliFrequency, ...mishnahFrequency, ...rambamFrequency, ...zoharFrequency, ...targumFrequency]) {
  if (prefixSeen.has(key)) continue;
  prefixSeen.add(key);
  const found = lookupWord(key, resolveWordContext({ family: 'talmud' })) || lookupWord(key, resolveWordContext({ family: 'torah' }));
  if (!found || found.via !== 'prefix') continue;
  if (prefixReviewed.has(key)) continue;
  if ((mishnahFrequency.get(key) || 0) >= 1 || (rambamFrequency.get(key) || 0) >= 1 || (bavliFrequency.get(key) || 0) >= 5 || (zoharFrequency.get(key) || 0) >= 5 || (targumFrequency.get(key) || 0) >= 3) { noPrefix.add(key); reject('prefix-form-unreviewed', `${key} (${bavliFrequency.get(key) || 0}×) → ${found.entries.map(e => e.gloss).join(' · ')}`); }
}
for (const key of prefixReviewed) { const found = lookupWord(key, resolveWordContext({ family: 'talmud' })); if (!found || found.via !== "prefix") fail(`reviewed prefix form ${key} does not compose`); }
const NOPREFIX = [...noPrefix].sort().join('\n');
const counts = {
  sourceEntries: { [KRUPNIK]: rawText[KRUPNIK].split('\n').filter(Boolean).length, [WIKT]: rawText[WIKT].split('\n').filter(Boolean).length },
  productionEntries: entries.length,
  productionGlosses: new Set(entries.map(e => `${e.canonicalKey}\t${e.displayGloss}`)).size,
  indexedWords: index.size,
  abbreviations: [...index.keys()].filter(isAbbreviationKey).length,
  aramaicWords: [...index.keys()].filter(key => !isAbbreviationKey(key)).length,
  aliases: aliases.size,
  aliasesByKind: [...aliases.values()].reduce((acc, a) => ({ ...acc, [a.kind]: (acc[a.kind] || 0) + 1 }), {}),
  entriesBySource: entries.reduce((acc, e) => ({ ...acc, [e.sourceId]: (acc[e.sourceId] || 0) + 1 }), {}),
  ambiguousKeys: [...index.values()].filter(ids => new Set(ids.map(id => entries[id].displayGloss)).size > 1).length,
};
const header = `// GENERATED by scripts/dictionary/build-word-dictionary.mjs — do not edit. The word dictionary of the readers.
// Sources (src/data/dictionary/sources.mjs): ${importedSources().map(s => `${s.sourceId} — ${s.title}, ${s.licenceId}`).join('; ')}.
// The lines whose source index is ${SOURCE_IDS.indexOf(WIKT)} (${WIKT}) are adapted from Hebrew Wiktionary and are shared under
// CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/); the rest is public domain.
// ENTRIES: gloss \\t type (A Aramaic word, B abbreviation) \\t source index \\t families (empty: all) \\t preferred in \\t part of speech
// INDEX: key \\t entry ids.  ALIASES: key \\t indexed key (a spelling the source gives, or the plene spelling of a pointed headword).
// NOPREFIX: forms the engine must not take apart into a prefix and a word.
`;
const moduleText = `${header}export const DICTIONARY_VERSION = ${JSON.stringify(`${BUILD_RULES_VERSION}.${LOOKUP_NORMALIZER_VERSION}.${sha256(ENTRIES + INDEX + ALIASES + NOPREFIX).slice(0, 12)}`)};
export const SOURCE_IDS = ${JSON.stringify(SOURCE_IDS)};
export const ENTRIES = ${JSON.stringify(ENTRIES)};
export const INDEX = ${JSON.stringify(INDEX)};
export const ALIASES = ${JSON.stringify(ALIASES)};
export const NOPREFIX = ${JSON.stringify(NOPREFIX)};
`;
const fullLines = entries.map(entry => JSON.stringify(entry)).join('\n') + '\n';
const report = { awaitingReview: awaiting.sort((a, b) => (b.bavli + b.zohar + b.targum) - (a.bavli + a.zohar + a.targum)), rulesVersion: BUILD_RULES_VERSION, normalizerVersion: LOOKUP_NORMALIZER_VERSION, sources: DICTIONARY_SOURCES.map(s => ({ sourceId: s.sourceId, imported: s.imported, contentHash: s.contentHash || null })), counts, moduleBytes: Buffer.byteLength(moduleText), excludedByReason: Object.fromEntries(Object.entries(reasons).sort()) };
const outputs = [
  ['src/data/dictionary/wordDictionary.mjs', moduleText],
  ['sources/word-dictionary/entries.jsonl', fullLines],
  ['sources/word-dictionary/build-report.json', JSON.stringify(report, null, 1) + '\n'],
];
if (CHECK) {
  const stale = outputs.filter(([path, text]) => { try { return readFileSync(join(ROOT, path), 'utf8') !== text; } catch { return true; } }).map(([path]) => path);
  if (stale.length) fail(`outputs are stale (run the build): ${stale.join(', ')}`);
  console.log('word dictionary: up to date');
} else {
  mkdirSync(join(ROOT, 'sources/word-dictionary'), { recursive: true });
  for (const [path, text] of outputs) writeFileSync(join(ROOT, path), text);
  console.log(JSON.stringify(counts, null, 1));
}
