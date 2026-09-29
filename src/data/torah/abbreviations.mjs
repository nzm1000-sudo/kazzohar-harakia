// Curated abbreviations for search (reviewable data, not code). A query word written as an abbreviation also searches
// its full form, and a full form also searches the abbreviation, since the sources write both. Normalized forms are
// computed by src/services/torah/hebrew.mjs, so רמב"ם / רמב״ם / רמב׳׳ם are one word already and need no entry.
//   context   — the expansion applies only when the query also holds one of these words (an ambiguous abbreviation:
//               מ"ב is also the number 42; יו"ד is also the letter's name)
//   ambiguous — has other common readings (ר"ח: ראש חודש / רבנו חננאל): expanded with a lower weight
// Expansions are spellings of the same words. They never assert that two halachic concepts are equivalent.
export const ABBREVIATIONS = Object.freeze([
  { abbr: 'שו"ע', full: 'שולחן ערוך' },
  { abbr: 'ש"ע', full: 'שולחן ערוך', ambiguous: true },
  { abbr: 'או"ח', full: 'אורח חיים' },
  { abbr: 'יו"ד', full: 'יורה דעה', context: ['שו"ע', 'שולחן', 'ערוך', 'הלכות', 'סימן'] },
  { abbr: 'חו"מ', full: 'חושן משפט' },
  { abbr: 'אה"ע', full: 'אבן העזר' },
  { abbr: 'מ"ב', full: 'משנה ברורה', context: ['סימן', 'סי', 'ס"ק', 'או"ח', 'שו"ע'] },
  { abbr: 'משנ"ב', full: 'משנה ברורה' },
  { abbr: 'ביה"ל', full: 'ביאור הלכה' },
  { abbr: 'בה"ל', full: 'ביאור הלכה' },
  { abbr: 'כה"ח', full: 'כף החיים' },
  { abbr: 'באה"ט', full: 'באר היטב' },
  { abbr: 'ק"ש', full: 'קריאת שמע' },
  { abbr: 'בהמ"ז', full: 'ברכת המזון' },
  { abbr: 'נט"י', full: 'נטילת ידים' },
  { abbr: 'חוה"מ', full: 'חול המועד' },
  { abbr: 'יו"ט', full: 'יום טוב' },
  { abbr: 'יוה"כ', full: 'יום הכפורים' },
  { abbr: 'ר"ח', full: 'ראש חודש', ambiguous: true },
  { abbr: 'ר"ה', full: 'ראש השנה', ambiguous: true },
  { abbr: 'לה"ר', full: 'לשון הרע' },
  { abbr: 'פקו"נ', full: 'פיקוח נפש' },
  { abbr: 'ביהכ"נ', full: 'בית הכנסת' },
  { abbr: 'ביהמ"ד', full: 'בית המדרש' },
  { abbr: 'הקב"ה', full: 'הקדוש ברוך הוא' },
  { abbr: 'שו"ת', full: 'שאלות ותשובות' },
  { abbr: 'ס"ת', full: 'ספר תורה' },
  { abbr: 'ת"ת', full: 'תלמוד תורה', ambiguous: true },
  { abbr: 'ע"ז', full: 'עבודה זרה', ambiguous: true },
]);
