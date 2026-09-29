// Hebrew normalization for search — never for display. The source text is never changed: every token keeps its span
// in the original string, so an unpointed query can highlight a pointed verse exactly where the words stand.
//   nikud and te'amim, meteg, shin/sin dots, CGJ and other invisible marks → ignored
//   final letters (ך ם ן ף ץ) → their regular form; Yiddish ligatures (װ ױ ײ) → two letters
//   geresh / gershayim / straight or curly quotes inside a word (רמב"ם, רמב״ם, שו׳׳ע) → dropped: one token
//   maqaf, hyphens, dashes, slashes, punctuation, whitespace of any kind → separators
//   digits → their own tokens ("318", "2a" → "2" + nothing: Latin letters are not indexed)
// A version number travels with the index: a change here makes the built index stale (tests compare them).
export const NORMALIZER_VERSION = 1;

const FINAL = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const LIGATURE = { 'װ': 'וו', 'ױ': 'וי', 'ײ': 'יי' };
const QUOTES = new Set(['"', "'", '׳', '״', '‘', '’', '“', '”', '„', '`', '´', '‛']);
const isLetter = code => code >= 0x05d0 && code <= 0x05ea;
const isDigit = code => code >= 0x30 && code <= 0x39;
// Combining marks inside a word: te'amim 0591–05AF, nikud 05B0–05BD, rafe 05BF, shin/sin dots 05C1–05C2, upper/lower
// dots 05C4–05C5, qamats qatan 05C7; plus zero-width and joiner characters (UXLC uses the CGJ U+034F).
const isMark = code => (code >= 0x0591 && code <= 0x05bd) || code === 0x05bf || code === 0x05c1 || code === 0x05c2 || code === 0x05c4 || code === 0x05c5 || code === 0x05c7
  || code === 0x034f || (code >= 0x200b && code <= 0x200f) || code === 0x2060 || code === 0xfeff || code === 0x00ad;

// Every token of a text: { norm, start, end } — norm is the searchable form, [start, end) its span in the original.
export function scanTokens(text) {
  const source = String(text ?? '');
  const tokens = [];
  let norm = '';
  let kind = null; // 'he' | 'num'
  let start = -1;
  let end = -1;
  const flush = () => { if (norm) tokens.push({ norm, start, end }); norm = ''; kind = null; start = -1; };
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const code = source.charCodeAt(i);
    if (isLetter(code) || LIGATURE[ch]) {
      if (kind === 'num') flush();
      if (!norm) start = i;
      kind = 'he';
      norm += LIGATURE[ch] || FINAL[ch] || ch;
      end = i + 1;
    } else if (isDigit(code)) {
      if (kind === 'he') flush();
      if (!norm) start = i;
      kind = 'num';
      norm += ch;
      end = i + 1;
    } else if (isMark(code)) {
      if (norm) end = i + 1;
    } else if (QUOTES.has(ch) && kind === 'he') {
      // Inside a word (an abbreviation or a numeral) only when a letter follows, marks aside.
      let j = i + 1;
      while (j < source.length && (isMark(source.charCodeAt(j)) || QUOTES.has(source[j]))) j += 1;
      if (j < source.length && isLetter(source.charCodeAt(j))) { i = j - 1; continue; }
      flush();
    } else flush();
  }
  flush();
  return tokens;
}

// The searchable tokens alone (in order, repeats kept).
export const tokenize = text => scanTokens(text).map(token => token.norm);
// One word → its searchable form ('' when it holds no letters or digits).
export const normalizeWord = word => tokenize(word).join('');
// A whole text → its searchable form, words joined by single spaces.
export const normalizeText = text => tokenize(text).join(' ');
// Plene and defective spelling (שולחן / שלחן, מצוה / מצווה, אבידה / אבדה) differ in ו and י after the first letter.
export const skeleton = term => (term.length > 1 ? term[0] + term.slice(1).replace(/[וי]/g, '') : term);

// Prefix letters a Hebrew (or Aramaic) word may carry: ו ה ב כ ל מ ש ד and their customary combinations. Used as
// expansions only — the word as written always stays the first match.
export const PREFIXES = Object.freeze([
  'ו', 'ה', 'ב', 'כ', 'ל', 'מ', 'ש', 'ד',
  'וה', 'וב', 'וכ', 'ול', 'ומ', 'וש', 'וד', 'שה', 'שב', 'שכ', 'של', 'שמ', 'מה', 'כש', 'לכש', 'ושה', 'ושב', 'ושל', 'וכש', 'דה', 'ודה', 'מש', 'ומה', 'בה', 'לה', 'כה',
]);
const PREFIX_SET = new Set(PREFIXES);
// Every way to read a word as prefix + core, core of at least three letters: "ובחלב" → [["וב","חלב"], ["ו","בחלב"]].
export function prefixSplits(term, minCore = 3) {
  const out = [];
  for (let n = 1; n <= 3 && term.length - n >= minCore; n += 1) {
    const prefix = term.slice(0, n);
    if (PREFIX_SET.has(prefix)) out.push([prefix, term.slice(n)]);
  }
  return out;
}
export const isPrefixOf = (prefix) => PREFIX_SET.has(prefix);

// Shard key of a term: its last two letters. A prefix never changes it, and plene spelling rarely does, so a word and
// its prefixed forms (חלב, בחלב, ובחלב, דחלב) always live in one shard.
export const SHARD_COUNT = 256;
export function shardOf(term) {
  const key = term.length >= 2 ? term.slice(-2) : term;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) { hash ^= key.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) % SHARD_COUNT;
}

// Terms are stored one byte per letter: א..ת (regular forms) → 1..22, digits → 23..32.
const LETTERS = 'אבגדהוזחטיכלמנסעפצקרשת';
export function encodeTerm(term) {
  const bytes = new Uint8Array(term.length);
  for (let i = 0; i < term.length; i += 1) {
    const ch = term[i];
    const letter = LETTERS.indexOf(ch);
    bytes[i] = letter >= 0 ? letter + 1 : ch >= '0' && ch <= '9' ? 23 + Number(ch) : 0;
    if (!bytes[i]) throw new Error(`unencodable term character ${ch} in ${term}`);
  }
  return bytes;
}
export function decodeTerm(bytes, from, length) {
  let out = '';
  for (let i = from; i < from + length; i += 1) out += bytes[i] <= 22 ? LETTERS[bytes[i] - 1] : String(bytes[i] - 23);
  return out;
}

// Highlight ranges in the original text for a set of matched searchable forms (and, optionally, spans of consecutive
// tokens). Ranges are [start, end) in the original string, sorted and merged; the text itself is never altered.
export function highlightRanges(text, matches) {
  const tokens = scanTokens(text);
  const ranges = [];
  for (const token of tokens) if (matches(token.norm)) ranges.push([token.start, token.end]);
  return mergeRanges(ranges);
}
export function mergeRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const range of sorted) {
    const last = out.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]); else out.push([...range]);
  }
  return out;
}
