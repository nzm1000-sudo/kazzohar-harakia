// The word-lookup tokenizer and normalizer — for matching only, never for display. The text on the screen is never
// changed: a token is a span [start, end) of the original string, and its key is what the dictionary is indexed by.
//   nikud, te'amim, meteg, shin/sin dots, CGJ and zero-width marks → ignored (אִיתְּמַר → איתמר)
//   final letters → regular form inside the key (so רמב"ם and רמבם-with-a-final-mem written either way agree)
//   gershayim in any spelling — " ״ '' ׳׳ “ ” — between letters → one ״ (ת"ש = ת״ש = ת׳׳ש)
//   geresh in any spelling — ' ׳ ‘ ’ — right after a letter at the end of a word → one ׳ (מתני' = מתני׳)
//   word boundaries: whitespace, maqaf, hyphens and dashes, paseq, sof pasuq, colon, semicolon, comma, period,
//   parentheses and brackets, slashes, digits, Latin letters, any other punctuation; a quote that opens or closes a
//   quotation (not between letters) is a boundary too
export const LOOKUP_NORMALIZER_VERSION = 1;

const FINAL = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const LIGATURE = { 'װ': 'וו', 'ױ': 'וי', 'ײ': 'יי' };
const DOUBLE = new Set(['"', '״', '“', '”', '„']);
const SINGLE = new Set(["'", '׳', '‘', '’', '`', '´', '‛']);
export const isHebrewLetter = code => (code >= 0x05d0 && code <= 0x05ea) || code === 0x05f0 || code === 0x05f1 || code === 0x05f2;
// Combining marks inside a word: te'amim 0591–05AF, nikud 05B0–05BD, rafe 05BF, shin/sin dots 05C1–05C2, upper/lower
// dots 05C4–05C5, qamats qatan 05C7; zero-width characters, joiners and direction marks; soft hyphen.
export const isMark = code => (code >= 0x0591 && code <= 0x05bd) || code === 0x05bf || code === 0x05c1 || code === 0x05c2 || code === 0x05c4 || code === 0x05c5 || code === 0x05c7
  || code === 0x034f || (code >= 0x200b && code <= 0x200f) || code === 0x2060 || code === 0xfeff || code === 0x00ad;
const isDouble = ch => DOUBLE.has(ch);
const isSingle = ch => SINGLE.has(ch);
// A character that can be part of a word's span (letters, marks, and quote characters that may turn out internal).
export const isWordChar = ch => { const code = ch.charCodeAt(0); return isHebrewLetter(code) || isMark(code) || isDouble(ch) || isSingle(ch); };

// The key of one word (already cut out of its text): marks dropped, quotes unified, finals regularised. Leading
// quotes and a closing quotation mark are dropped; '' / ׳׳ between letters is gershayim. Returns '' for no letters.
export function normalizeLookupToken(word) {
  const source = String(word ?? '');
  // Letters and quote runs only, marks removed.
  const parts = [];
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const code = source.charCodeAt(i);
    if (isHebrewLetter(code)) parts.push({ letter: LIGATURE[ch] || FINAL[ch] || ch });
    else if (isMark(code)) continue;
    else if (isDouble(ch) || isSingle(ch)) {
      const last = parts.at(-1);
      const weight = isDouble(ch) ? 2 : 1;
      if (last && last.quote) last.quote += weight; else parts.push({ quote: weight });
    } else parts.push({ stop: true });
  }
  let key = '';
  let started = false;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part.stop) { if (started) break; continue; }
    if (part.letter) { key += part.letter; started = true; continue; }
    if (!started) continue; // an opening quote
    const next = parts[i + 1];
    if (next?.letter) { if (part.quote >= 2) key += '״'; else key += '׳'; continue; } // internal: gershayim (or a lone geresh, kept)
    // At the end of the word: a lone geresh is an abbreviation mark (מתני׳); a double quote closes a quotation.
    if (part.quote === 1) key += '׳';
    break;
  }
  return key;
}

// The letters of a key alone (no ״ ׳) — for a morphological remainder.
export const lettersOf = key => key.replace(/[״׳]/g, '');
export const isAbbreviationKey = key => /[״׳]/.test(key);

// The word around a character offset of a text: { start, end, raw } or null (the offset is on a boundary). A quote
// belongs to the word only between two letters (gershayim) or as a final geresh right after a letter; the maqaf and
// every punctuation mark are boundaries. Offsets at the very end of a word (a caret after its last letter) count.
export function tokenAt(text, offset) {
  const source = String(text ?? '');
  if (!source) return null;
  let at = Math.max(0, Math.min(offset, source.length - 1));
  const code = i => source.charCodeAt(i);
  const inWord = i => i >= 0 && i < source.length && (isHebrewLetter(code(i)) || isMark(code(i)));
  // A caret right after the last letter (or on a trailing quote) belongs to the word before it.
  if (!inWord(at) && inWord(at - 1)) at -= 1;
  if (!inWord(at)) {
    // A quote between letters (the caret landed on the gershayim itself).
    const ch = source[at];
    if ((isDouble(ch) || isSingle(ch)) && inWord(at - 1)) at -= 1; else return null;
  }
  const quoteRunEnd = i => { let j = i; while (j < source.length && (isDouble(source[j]) || isSingle(source[j]))) j += 1; return j; };
  let start = at;
  while (start > 0) {
    if (inWord(start - 1)) { start -= 1; continue; }
    // A quote run between letters on the left: part of the word (ת"ש).
    let j = start - 1;
    while (j >= 0 && (isDouble(source[j]) || isSingle(source[j]))) j -= 1;
    if (j < start - 1 && j >= 0 && inWord(j)) { start = j; continue; }
    break;
  }
  let end = at + 1;
  while (end < source.length) {
    if (inWord(end)) { end += 1; continue; }
    const runEnd = quoteRunEnd(end);
    if (runEnd > end) {
      if (runEnd < source.length && isHebrewLetter(code(runEnd))) { end = runEnd; continue; } // gershayim inside
      // A lone geresh (one mark) closing the word is an abbreviation mark: kept. A double quote closes a quotation.
      const run = source.slice(end, runEnd);
      if (run.length === 1 && isSingle(run)) end = runEnd;
    }
    break;
  }
  const raw = source.slice(start, end);
  return normalizeLookupToken(raw) ? { start, end, raw } : null;
}

// Every word of a text with its span (tests and the visible-text checks use it; lookups use tokenAt).
export function tokenizeLookup(text) {
  const source = String(text ?? '');
  const out = [];
  let i = 0;
  while (i < source.length) {
    const token = tokenAt(source, i);
    if (token && token.start >= i - 1 && token.end > i) { if (!out.length || out.at(-1).start !== token.start) out.push({ ...token, key: normalizeLookupToken(token.raw) }); i = token.end; } else i += 1;
  }
  return out;
}
