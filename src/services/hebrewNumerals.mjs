const HEBREW_NUMERAL_LETTERS = [[400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק'], [90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'], [50, 'נ'], [40, 'מ'], [30, 'ל'], [20, 'כ'], [10, 'י'], [9, 'ט'], [8, 'ח'], [7, 'ז'], [6, 'ו'], [5, 'ה'], [4, 'ד'], [3, 'ג'], [2, 'ב'], [1, 'א']];

function punctuate(letters) {
  if (letters.length === 1) return `${letters}׳`;
  return `${letters.slice(0, -1)}״${letters.slice(-1)}`;
}

export function hebrewLetters(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) throw new RangeError('מספר עברי אינו תקין');
  if (numeric >= 1000) throw new RangeError('Use hebrewNumeral for thousands');
  if (numeric === 15) return 'טו';
  if (numeric === 16) return 'טז';

  let remainder = numeric;
  let result = '';
  for (const [amount, letter] of HEBREW_NUMERAL_LETTERS) {
    if (amount < 100 && (remainder === 15 || remainder === 16)) {
      return `${result}${remainder === 15 ? 'טו' : 'טז'}`;
    }
    while (remainder >= amount) {
      result += letter;
      remainder -= amount;
    }
  }
  if (!result) result = 'א';
  return result;
}

export function hebrewNumeral(value, { year = false } = {}) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) throw new RangeError('מספר עברי אינו תקין');

  if (numeric === 15) return 'ט״ו';
  if (numeric === 16) return 'ט״ז';

  const thousands = Math.floor(numeric / 1000);
  const remainder = numeric % 1000;
  if (!remainder) {
    const thousandsText = punctuate(hebrewLetters(thousands));
    return yearsLabel(thousandsText, thousands, year);
  }

  if (year || !thousands) return punctuate(hebrewLetters(remainder));
  return `${punctuate(hebrewLetters(thousands))} אלף ${punctuate(hebrewLetters(remainder))}`;
}

function yearsLabel(thousandsText, thousands, year) {
  if (year || !thousands) {
    if (thousands === 1) return 'א׳ אלף';
    return `${thousandsText} אלפים`;
  }
  return `${thousandsText} אלף`;
}

// Display only: a place in a book written with Arabic digits — "סימן 12, סעיף 3", "פרק 3, הלכה 2", "· הלכה 4",
// "סימנים 1–50" — in Hebrew numerals, as every learner reads it: "סימן י״ב, סעיף ג׳". Ids, routes and stored data keep
// their numbers; a number after any other word (a count, a page of a modern book, a year) is never touched.
const LOCATION_WORDS = 'סימנים|סימן|סעיפים|סעיף קטן|סעיף|ס"ק|ס״ק|הלכות|הלכה|פרקים|פרק|דף|משנה|פסוק|כלל|אות';
const LOCATION = new RegExp(`(^|[^\\u05D0-\\u05EA])(${LOCATION_WORDS}) (\\d+)(?:\\s*[–-]\\s*(\\d+))?(?![\\d:a-zA-Z])`, 'g');
export function hebrewLocations(text) {
  return String(text ?? '').replace(LOCATION, (match, before, word, from, to) => {
    if (Number(from) < 1 || (to && Number(to) < 1)) return match;
    return `${before}${word} ${hebrewNumeral(Number(from))}${to ? `–${hebrewNumeral(Number(to))}` : ''}`;
  });
}
