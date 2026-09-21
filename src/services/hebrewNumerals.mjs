const HEBREW_NUMERAL_LETTERS = [[400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק'], [90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'], [50, 'נ'], [40, 'מ'], [30, 'ל'], [20, 'כ'], [10, 'י'], [9, 'ט'], [8, 'ח'], [7, 'ז'], [6, 'ו'], [5, 'ה'], [4, 'ד'], [3, 'ג'], [2, 'ב'], [1, 'א']];

export function hebrewNumeral(value, { year = false } = {}) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) throw new RangeError('מספר עברי אינו תקין');
  let remainder = numeric;
  if (year && remainder >= 1000) remainder %= 1000;
  if (remainder === 15) return 'ט״ו';
  if (remainder === 16) return 'ט״ז';
  let result = '';
  for (const [amount, letter] of HEBREW_NUMERAL_LETTERS) {
    while (remainder >= amount) { result += letter; remainder -= amount; }
  }
  if (!result) result = 'א';
  if (result.length === 1) return `${result}׳`;
  return `${result.slice(0, -1)}״${result.slice(-1)}`;
}
