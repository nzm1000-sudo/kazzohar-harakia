// Concepts: a general question ("מתי אומרים הלל?") is answered by a group of verified entries — the overview and each
// occasion — not by whichever single entry shares a word with it. Every id here is a verified entry; a concept adds no
// halacha of its own, only the grouping. "היום" questions go to the calendar (halachaToday.mjs), not here.
export const HALACHA_CONCEPTS = [
  { id: 'hallel', words: /(?:^|\s)[ובה]?הלל(?:\s|$)/, ask: /מתי|באילו|באיזה|אילו ימים|איזה הלל|כמה פעמים|גומרים/,
    overview: 'hal-basic-hallel-full-or-no-bracha',
    occasions: ['hal-basic-hallel-rosh-chodesh-dilug', 'hal-basic-hallel-pesach-which-days', 'hal-basic-hallel-sukkot', 'hal-basic-hallel-chanukah', 'hal-basic-hallel-seder-night-shul', 'hal-basic-hallel-rosh-hashana-yom-kippur', 'hal-moed-chm-hallel', 'hal-moed-rc-hallel-no-bracha', 'hal-basic-hallel-yom-haatzmaut'] },
  { id: 'tachanun', words: /תחנון|נפילת אפיים|נפילת אפים|וידוי/, ask: /מתי|באילו|באיזה|אילו ימים/,
    overview: 'hal-basic-tachanun-when',
    occasions: ['hal-basic-tachanun-days-skipped', 'hal-basic-tachanun-mincha-before', 'hal-basic-tachanun-erev-shabbat-mincha', 'hal-basic3-rc-no-tachanun', 'hal-moed-nisan-no-tachanun', 'hal-moed-lag-baomer-tachanun', 'hal-chag-no-tachanun-until-2-cheshvan', 'hal-basic-tachanun-chatan', 'hal-basic-tachanun-bar-mitzva', 'hal-prayer-no-tachanun-brit', 'hal-prayer-no-tachanun-shiva-house', 'hal-prayer-tachanun-night'] },
  { id: 'yaaleh', words: /יעלה ויבוא|יעלה ויבא/, ask: /מתי|באילו|באיזה|אילו ימים|איפה/,
    overview: 'qa-yaaleh-veyavo',
    occasions: ['hal-basic-yaale-chol-hamoed', 'hal-basic-yaale-shabbat-chol-hamoed', 'hal-moed-rc-yaale-veyavo-reminder'] },
  { id: 'shehecheyanu', words: /שהחיינו/, ask: /^(?:מתי|על מה|על אילו|באילו|על איזה)/,
    overview: 'hal-basic-shehecheyanu-first-mitzva',
    occasions: ['hal-brachot-shehecheyanu-fruit', 'hal-basic-shehecheyanu-new-vegetables', 'hal-basic-shehecheyanu-food-first-time', 'hal-brachot-shehecheyanu-garment', 'hal-brachot-shehecheyanu-home', 'hal-brachot-shehecheyanu-baby', 'hal-brachot-shehecheyanu-friend', 'hal-prayer-shehecheyanu-new-tallit', 'hal-basic-shehecheyanu-birthday'] },
  { id: 'al-hanisim', words: /על הניסים|על הנסים|ועל הנסים/, ask: /מתי|באילו|באיזה|אילו ימים|איפה/,
    overview: 'hal-basic-al-hanisim-chanukah-arvit',
    occasions: ['hal-basic-al-hanisim-purim', 'hal-chag-forgot-al-hanisim', 'hal-brachot-forgot-al-hanisim'] },
];

// A concept question: the concept's word, a general "when / which days" ask, and no personal situation or "today".
const PERSONAL = /(?:^|\s)(?:שכחתי|טעיתי|נזכרתי|אמרתי|דילגתי|היום|הערב|עכשיו|הלילה|מברכים|ברכה|נשים|אישה|יחיד)(?:\s|$)/;
const plainText = text => ` ${String(text || '').replace(/[?!.,;:]/g, ' ').replace(/\s+/g, ' ').trim()} `;
export function conceptFor(text) {
  const t = plainText(text);
  if (PERSONAL.test(t)) return null;
  return HALACHA_CONCEPTS.find(concept => concept.words.test(t) && concept.ask.test(t.trim())) || null;
}

// Fixed routes: situations whose verified answer is known from the words alone, which word search ranks poorly
// (the question's words are not the entry's words). Each route names only verified entries.
const DAIRY_FOOD = /(?:ה)?(?:גבינה|גבינות|גבינה צהובה|טוסט גבינה|יוגורט|שמנת|קוטג'|פיצה|חמאה)/;
const MILK_DRINK = /(?:קפה עם חלב|חלב|שוקו|קפה הפוך|תה עם חלב)/;
export const FIXED_ROUTES = [
  // Dairy first, then meat (not the six hours).
  { id: 'milk-then-meat', test: text => /שתיתי|שותה|אחרי ששתיתי/.test(text) && MILK_DRINK.test(text) && /בשר/.test(text) && text.search(MILK_DRINK) < text.search(/בשר/), entries: ['hal-bayit-milk-drink-then-meat'] },
  { id: 'cheese-then-meat', test: text => !/צמחי|פרווה|סויה|שקדים/.test(text) && DAIRY_FOOD.test(text) && /בשר|עוף/.test(text) && (text.search(DAIRY_FOOD) < text.search(/בשר|עוף/) ? /אכלתי|אחרי|מיד|לחכות|מתי/.test(text) : /(?:בשר|עוף)\s+(?:\S+\s+){0,2}(?:אחרי|אחר)\s+(?:\S+\s+){0,1}(?:גבינה|גבינות|טוסט|יוגורט|פיצה)/.test(text)), entries: ['hal-bayit-meat-after-cheese'] },
  { id: 'dairy-then-meat', test: text => /בין (?:ה)?חלב ל(?:ה)?בשר|אחרי (?:ה)?(?:חלב|חלבי|גבינה)\s+(?:\S+\s+){0,2}(?:ל)?(?:בשר|בשרי)/.test(text) && !/חלב שקדים|חלב סויה|צמחי/.test(text), entries: ['hal-bayit-meat-after-cheese', 'hal-bayit-milk-drink-then-meat'] },
  { id: 'fast-start', test: text => /(?:מתי|באיזה שעה|ממתי).{0,10}(?:מתחיל|מתחילה|נכנס|מתחילים).{0,6}(?:ה)?(?:צום|תענית)/.test(text) && !/יום כיפור|יום הכיפורים|תשעה באב|ט' באב/.test(text), entries: ['hal-moed-fast-times'] },
  // Tasting a meat dish and spitting it out.
  { id: 'tasted-spat', test: text => /טעמתי|טועם|טועמת|לטעום/.test(text) && /פלטתי|ופלטתי|פולט|פולטת|ירקתי/.test(text), entries: ['hal-bayit-tasting-meat-spit'] },
];
export const fixedRouteFor = text => FIXED_ROUTES.find(route => route.test(` ${text} `)) || null;
