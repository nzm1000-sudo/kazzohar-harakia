// Display-time Hebrew typography and bracket repair for the bundled texts (Siddur, library packs,
// sources). The source files are never edited — packs are checksummed and the composed Mincha
// reads exact offsets — so every correction is applied here, deterministically, and is testable.
// Approved by the user (2026-09-27): typing errors in the editions are to be corrected.
const L = 'א-ת'; // Hebrew letters
const M = '֑-ׇ'; // nikud / cantillation marks
const LETTER_OR_MARK = new RegExp(`[${L}${M}]`);
const HAS_NIKUD = /[ְ-ׇּׁׂ]/;

// A ")" right after 1–3 letters at a word start with nothing open is a list marker ("א)", "יב)").
const isListMarker = (text, i) => /(^|[\s.:;])[א-ת׳״'"]{1,4}$/.test(text.slice(Math.max(0, i - 5), i).replace(/[֑-ׇ]/g, ''));

function depthAfter(text) {
  let depth = 0;
  let orphanClose = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') {
      if (depth === 0) { if (!isListMarker(text, i)) orphanClose += 1; } else depth -= 1;
    }
  }
  return { depth, orphanClose };
}

// Only paragraphs that are actually unbalanced are touched.
export function repairBrackets(text) {
  const source = String(text || '');
  if (!source.includes('(')) return source;
  const before = depthAfter(source);
  if (before.depth === 0) return source;
  // 1) A "(" glued to the end of a word and followed by a space/punctuation, while a bracket is open,
  //    is a closing bracket typed the wrong way: "(זכרון תרועה באהבה( מקרא".
  let depth = 0;
  let out = '';
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(') {
      const glued = i > 0 && LETTER_OR_MARK.test(source[i - 1]);
      const followedBySpace = i + 1 >= source.length || /[\s.,:;]/.test(source[i + 1]);
      if (depth > 0 && glued && followedBySpace) { out += ')'; depth -= 1; continue; }
      depth += 1;
    } else if (ch === ')') {
      if (depth > 0) depth -= 1;
    }
    out += ch;
  }
  if (depthAfter(out).depth === 0) return out;
  // 2) A gloss that opens and never closes ("(ושניהם פורעים… (ריב״ש…):"): close it just before the
  //    next bracket that opens at the same level, or at the end of the paragraph (before its final mark).
  let result = '';
  depth = 0;
  let pendingGloss = false;
  for (let i = 0; i < out.length; i += 1) {
    const ch = out[i];
    if (ch === '(') {
      if (depth === 1 && pendingGloss && /\s/.test(out[i - 1] || '')) { result = `${result.trimEnd()}) `; depth = 0; }
      depth += 1;
      pendingGloss = depth === 1;
    } else if (ch === ')') {
      if (depth > 0) depth -= 1;
      if (depth === 0) pendingGloss = false;
    }
    result += ch;
  }
  if (depth > 0) {
    const tail = /([.:;]\s*)$/.exec(result);
    result = tail ? `${result.slice(0, tail.index).trimEnd()})${tail[1]}` : `${result.trimEnd()})`;
  }
  return depthAfter(result).depth === 0 ? result : source;
}

export function fixHebrewTypography(text) {
  let t = String(text || '');
  if (!t) return t;
  // Gershayim and geresh (typed as ASCII quotes).
  t = t.replace(new RegExp(`([${L}${M}])(?:"|'')(?=[${L}])`, 'g'), '$1״');
  t = t.replace(new RegExp(`([${L}${M}])'(?=[\\s.,:;)\\]–-]|$)`, 'g'), '$1׳');
  // Ranges between numerals ("א׳-ג׳") take a dash; words joined by "-" take a maqaf in pointed text.
  t = t.replace(/([׳״][א-ת]?)-(?=[א-ת])/g, '$1–');
  if (HAS_NIKUD.test(t)) t = t.replace(new RegExp(`([${L}${M}])-(?=[${L}])`, 'g'), '$1־');
  // Spacing: none before punctuation, one after a colon between two whole words, one after ")" before a word.
  t = t.replace(new RegExp(`([${L}${M}\\u05F3\\u05F4]) +([,.:;])(?!\\.)`, 'g'), '$1$2');
  // A colon typed inside a pointed word ("אַ:תרָא", "לִ:תרֵין") is a stray keystroke — no reference is pointed.
  t = t.replace(new RegExp(`(^|[\\s(])([${L}][${M}]+):(?=[${L}])`, 'g'), '$1$2');
  // An abbreviation's colon before a pointed word ("נ״י:לִי") takes a space — references are never pointed.
  t = t.replace(new RegExp(`([${L}\\u05F3\\u05F4]):(?=[${L}][${M}])`, 'g'), '$1: ');
  // (chapter:verse references — "נג:מג", "ס״ז:א׳" — are short numerals or carry ״/׳, so they keep no space)
  t = t.replace(new RegExp(`((?:^|[^${L}${M}\\u05F3\\u05F4])(?:[${L}][${M}]*){3,}):(?=[${L}])`, 'g'), '$1: ');
  t = t.replace(new RegExp(`\\)(?=[${L}])`, 'g'), ') ');
  t = t.replace(/ {2,}/g, ' ');
  return repairBrackets(t);
}
