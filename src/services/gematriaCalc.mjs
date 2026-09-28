// A professional gematria calculator: the classical methods, each computed openly (the letters and the numbers are
// shown, so a result can be checked by hand). Pure; no DOM.
//   הכרחי (מספר רגיל)      א=1…ט=9, י=10…צ=90, ק=100…ת=400; final letters as their ordinary form
//   גדול                   the same, with the final letters ך=500 ם=600 ן=700 ף=800 ץ=900
//   קטן                    each letter without its zeros (י=1, כ=2, ק=1, ר=2 …)
//   סידורי                 the letter's place in the alphabet (א=1 … ת=22)
//   מספר מצומצם            the digits of the ordinary value added until one digit remains
//   עם הכולל               the ordinary value + 1 (the word as a whole), or + the number of words
//   עם האותיות             the ordinary value + the number of letters
//   מילוי                  the value of each letter's name (אלף, בית, גימל …) — the names are shown
//   נעלם (נסתר)            the milui without the letters themselves
//   את״ב״ש, אלב״ם, אט״ב״ח  letter substitutions; the substituted word and its ordinary value are shown

const LETTERS = 'אבגדהוזחטיכלמנסעפצקרשת';
const FINAL_TO_BASE = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
const VALUE = Object.fromEntries([...LETTERS].map((letter, i) => [letter, i < 10 ? i + 1 : i < 19 ? (i - 8) * 10 : (i - 17) * 100]));
const GADOL_FINAL = { ך: 500, ם: 600, ן: 700, ף: 800, ץ: 900 };
// The letters' names as they are usually spelled for milui (the spelling is shown beside the result).
export const LETTER_NAMES = Object.freeze({ א: 'אלף', ב: 'בית', ג: 'גימל', ד: 'דלת', ה: 'הא', ו: 'וו', ז: 'זין', ח: 'חית', ט: 'טית', י: 'יוד', כ: 'כף', ל: 'למד', מ: 'מם', נ: 'נון', ס: 'סמך', ע: 'עין', פ: 'פא', צ: 'צדי', ק: 'קוף', ר: 'ריש', ש: 'שין', ת: 'תו' });

// Letters only: nikud, te'amim, punctuation, geresh and gershayim removed; final letters kept (the "גדול" method needs them).
export const lettersOf = text => [...String(text || '').replace(/[֑-ׇ׳״"'׳״\-־]/g, '')].filter(ch => VALUE[ch] || FINAL_TO_BASE[ch]);
const base = letter => FINAL_TO_BASE[letter] || letter;
const wordsOf = text => String(text || '').replace(/[֑-ׇ]/g, '').split(/[\s־\-,.:;]+/).filter(word => lettersOf(word).length);
export const standardValue = text => lettersOf(text).reduce((sum, letter) => sum + VALUE[base(letter)], 0);

export function reduceDigits(value) {
  let result = Number(value);
  if (!Number.isInteger(result) || result < 1) return 0;
  while (result > 9) result = [...String(result)].reduce((sum, digit) => sum + Number(digit), 0);
  return result;
}

// A substitution cipher from pairs of letters (each pair swaps both ways; unlisted letters stay).
const cipher = pairs => { const map = {}; for (const [a, b] of pairs) { map[a] = b; map[b] = a; } return map; };
const ATBASH = cipher([...LETTERS.slice(0, 11)].map((letter, i) => [letter, LETTERS[21 - i]]));
const ALBAM = cipher([...LETTERS.slice(0, 11)].map((letter, i) => [letter, LETTERS[11 + i]]));
const ATBACH = cipher([['א', 'ט'], ['ב', 'ח'], ['ג', 'ז'], ['ד', 'ו'], ['י', 'צ'], ['כ', 'פ'], ['ל', 'ע'], ['מ', 'ס'], ['ק', 'ת'], ['ר', 'ש']]);
export const substitute = (text, map) => lettersOf(text).map(letter => map[base(letter)] || base(letter)).join('');

export function gematriaAll(text) {
  const letters = lettersOf(text);
  if (!letters.length) return null;
  const words = wordsOf(text);
  const standard = standardValue(text);
  const milui = letters.map(letter => LETTER_NAMES[base(letter)]);
  const miluiValue = milui.reduce((sum, name) => sum + standardValue(name), 0);
  const cipherResult = map => { const word = substitute(text, map); return { word, value: standardValue(word) }; };
  return {
    letters: letters.map(letter => ({ letter, value: VALUE[base(letter)], gadol: GADOL_FINAL[letter] || VALUE[base(letter)], katan: reduceDigits(VALUE[base(letter)]) || 0, ordinal: LETTERS.indexOf(base(letter)) + 1 })),
    wordCount: words.length,
    standard,
    gadol: letters.reduce((sum, letter) => sum + (GADOL_FINAL[letter] || VALUE[base(letter)]), 0),
    katan: letters.reduce((sum, letter) => sum + (VALUE[base(letter)] % 100 === 0 ? VALUE[base(letter)] / 100 : VALUE[base(letter)] % 10 === 0 ? VALUE[base(letter)] / 10 : VALUE[base(letter)]), 0),
    ordinal: letters.reduce((sum, letter) => sum + LETTERS.indexOf(base(letter)) + 1, 0),
    reduced: reduceDigits(standard),
    kolel: standard + 1,
    kolelWords: standard + Math.max(1, words.length),
    withLetters: standard + letters.length,
    milui: { names: milui, value: miluiValue },
    neelam: miluiValue - standard,
    atbash: cipherResult(ATBASH),
    albam: cipherResult(ALBAM),
    atbach: cipherResult(ATBACH),
  };
}

// Words of the Torah (the bundled text) whose ordinary value equals the given one — the most frequent first.
export function torahWordsWithValue(torahBooks, value, { limit = 24, exclude = '' } = {}) {
  if (!value) return [];
  const counts = new Map();
  const skip = lettersOf(exclude).map(base).join('');
  for (const book of torahBooks || []) for (const [, , verse] of book.verses || []) {
    for (const raw of String(verse).replace(/[֑-ֽ֯׀׃]/g, '').split(/[\s־]+/)) {
      const word = raw.replace(/[ְ-ׇ]/g, '').replace(/[^א-ת]/g, '');
      if (word.length < 2 || standardValue(word) !== value || lettersOf(word).map(base).join('') === skip) continue;
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'he')).slice(0, limit).map(([word, count]) => ({ word, count }));
}
