const LETTERS = [[400, '\u05ea'], [300, '\u05e9'], [200, '\u05e8'], [100, '\u05e7'], [90, '\u05e6'], [80, '\u05e4'], [70, '\u05e2'], [60, '\u05e1'], [50, '\u05e0'], [40, '\u05de'], [30, '\u05dc'], [20, '\u05db'], [10, '\u05d9'], [9, '\u05d8'], [8, '\u05d7'], [7, '\u05d6'], [6, '\u05d5'], [5, '\u05d4'], [4, '\u05d3'], [3, '\u05d2'], [2, '\u05d1'], [1, '\u05d0']];

function checked(value) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > 999999) throw new RangeError('Invalid Hebrew numeral');
  return n;
}

// The exceptions for 15 and 16 apply AFTER hundreds as well (115, 216, ...).
export function hebrewLetters(value) {
  let n = checked(value);
  if (n >= 1000) throw new RangeError('Use hebrewNumeral for thousands');
  let out = '';
  for (const [amount, letter] of LETTERS) {
    if (amount < 100 && (n === 15 || n === 16)) {
      out += n === 15 ? '\u05d8\u05d5' : '\u05d8\u05d6';
      n = 0;
      break;
    }
    while (n >= amount) { out += letter; n -= amount; }
  }
  return out;
}
const punctuate = letters => letters.length === 1 ? `${letters}\u05f3` : `${letters.slice(0, -1)}\u05f4${letters.slice(-1)}`;
export function hebrewNumeral(value, { year = false } = {}) {
  const n = checked(value);
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  // Never mislabel an exact millennium as aleph (the previous fallback).
  if (!rest) return `${punctuate(hebrewLetters(thousands))} \u05d0\u05dc\u05e4\u05d9\u05dd`;
  if (year || !thousands) return punctuate(hebrewLetters(rest));
  return `${punctuate(hebrewLetters(thousands))} \u05d0\u05dc\u05e4\u05d9\u05dd ${punctuate(hebrewLetters(rest))}`;
}
