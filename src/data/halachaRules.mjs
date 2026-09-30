// Structured rules: the numbers inside verified answers, made computable. A rule never adds halacha — every value is
// paired with `evidence`, the exact words in its verified entry that state it (tests check the words are there).
// The assistant combines: the rule (knowledge) + the user's facts (time, duration, amount, who) + the day's zmanim →
// a deterministic result, and shows the entry the rule comes from.
//
// Kinds: 'wait' (event time + minutes), 'window' (event time + minutes, compared with now), 'interval' (two stated
// times against a limit), 'duration-threshold' (a stated duration against a limit), 'amount-threshold' (grams against
// a limit), 'zman-offset' (a zman of today ± minutes, compared with now or a stated time), 'weekday-until',
// 'omer-status' (which verified omer case "now" is).

// Food words, for recognising "I ate meat… when may I have dairy?" however it is phrased.
const MEAT = '(?:ה)?(?:בשר|בשרי|בשרית|בשריים|עוף|שניצל|שניצלים|סטייק|קבב|נקניק|נקניקיות|נקניקייה|המבורגר|קציצות|קציצה|צלי|שווארמה|פרגית|כבד|אנטריקוט|שיפודים|חמין בשרי|ארוחה בשרית)';
const DAIRY = '(?:ה)?(?:חלב|חלבי|חלבית|חלביים|גבינה|גבינות|יוגורט|שמנת|קוטג\'|קוטג|פיצה|מעדן|שוקו|חמאה|גלידה|ארטיק|טוסט|לבנה|לאבנה|דני|מילקי|קפה עם חלב|שוקולד חלבי)';
// Plant "milk" and pareve cream are not dairy (their own question, not the six hours).
const PAREVE_QUALIFIER = /(?:חלב|שמנת|גבינה|יוגורט)\s+(?:צמחי|צמחית|פרווה|סויה|שקדים|אורז|שיבולת|קוקוס)/;
const UTENSILS = /(?:^|\s)[ובהלמש]?(?:כלי|כלים|סיר|סירים|סכין|סכינים|כפית|כפיות|כף|תנור|כיור|מדיח|מחבת|מקרר|שולחן|צלחת|צלחות|כוס|כוסות|מגבת|מפה|כיריים)(?=\s|$|[?,.!])/;
// Other verified questions that mention meat and hours: food left between the teeth, fish with meat.
const NOT_WAIT = /בין השיניים|דגים|דג עם/;
// Tasting and spitting is its own verified answer (no wait).
const SPAT = /פלטתי|ופלטתי|פולט|ירקתי/;
const EAT_VERB = '(?:אכלתי|אכל|אכלה|אכלנו|אכלו|סיימתי(?:\\s+לאכול)?|גמרתי(?:\\s+לאכול)?|סיים(?:\\s+לאכול)?|סיימה(?:\\s+לאכול)?|בלעתי|אני אוכל)';
const WHEN_ASK = /מתי|כמה זמן|כמה עוד|עד מתי|לחכות|להמתין|מחכים|ממתינים|מותר לי|אפשר לי|כבר מותר|צריך לחכות/;
const firstIndex = (text, pattern) => { const match = new RegExp(`(?:^|\\s)${pattern}(?=\\s|$|[?,.!])`).exec(text); return match ? match.index : -1; };

// A pareve food fried or cooked with meat ("צ'יפס שטוגן בשמן של שניצלים", "צ'יפס במסעדה בשרית") is its own verified
// question — the meat was not eaten — unless the message says the meat itself was eaten.
const PAREVE_FOOD = /(?:^|\s)[ובהלמש]?(?:צ['׳]?יפס|פלאפל|חביתה)(?=\s|$|[?,.!–-])/;
const ATE_MEAT_ITSELF = new RegExp(`${EAT_VERB}\\s+(?:(?:את|גם|קצת|רק)\\s+)?${MEAT}(?=\\s|$|[?,.!])`);

export function meatThenDairy(text) {
  const t = ` ${text} `;
  if (UTENSILS.test(t) || SPAT.test(t) || PAREVE_QUALIFIER.test(t) || NOT_WAIT.test(t)) return false;
  if (PAREVE_FOOD.test(t) && !ATE_MEAT_ITSELF.test(t)) return false;
  // "חלבי שלוש שעות אחרי בשר" is meat then dairy; "בשר מיד אחרי גבינה" is dairy then meat.
  if (new RegExp(`${DAIRY}.{0,40}(?:אחרי|אחר)\\s+(?:\\S+\\s+){0,2}${MEAT}`).test(t)) return true;
  if (new RegExp(`${MEAT}.{0,40}(?:אחרי|אחר)\\s+(?:\\S+\\s+){0,2}${DAIRY}`).test(t)) return false;
  const meat = firstIndex(t, MEAT);
  const dairy = firstIndex(t, DAIRY);
  if (meat >= 0 && dairy > meat) return true;
  // Dairy first ("אכלתי גבינה… מתי בשר?") is a different verified answer.
  if (dairy >= 0 && meat > dairy) return false;
  if (meat >= 0 && WHEN_ASK.test(t) && new RegExp(`${EAT_VERB}\\s+(?:\\S+\\s+){0,5}${MEAT}`).test(t)) return true;
  if (/(?:מחכים|לחכות|להמתין|ממתינים|מספיק(?:ות)?|צריך לחכות)\s+(?:\S+\s+){0,2}(?:שלוש|ארבע|חמש|שש|\d)\s+שעות|עד מתי אני בשרי|מתי אני (?:חלבי|כבר חלבי)|אני בשרי/.test(t)) return true;
  if (/(?:ה)?שש שעות/.test(t) && /מאיזה רגע|מתי|סופרים|לחכות|מחכים|מספיק|כמה/.test(t)) return true;
  return meat >= 0 && /(?:מחכים|לחכות|להמתין|ממתינים)/.test(t);
}
export const MEAT_WORDS = new RegExp(`(?:^|\\s)${MEAT}(?=\\s|$|[?,.!])`);
export const DAIRY_WORDS = new RegExp(`(?:^|\\s)${DAIRY}(?=\\s|$|[?,.!])`);
export const SWEETS = /ממתק|ממתקים|שוקולד|ארטיק|גלידה|חטיף|עוגה חלבית|שוקו/;

export const HALACHA_RULES = [
  { id: 'meat-dairy-wait', kind: 'wait', concept: 'meat-dairy', entryId: 'hal-bayit-six-hours-meat-to-dairy', minutes: 360, evidence: 'שש שעות',
    anchor: MEAT_WORDS, targetAfter: DAIRY_WORDS,
    variants: {
      need: { entryId: 'hal-bayit-five-and-half-hours', minutes: 330, evidence: 'חמש שעות וחצי', words: /צורך|נחוץ|נחוצה|חשוב|חשובה|אירוע|שמחה|חתונה|ברית|בר מצווה|בת מצווה/ },
      sick: { entryId: 'hal-bayit-sick-one-hour', minutes: 60, evidence: 'שעה אחת' },
      child: { entryId: 'hal-bayit-children-wait-meat-dairy', minutes: 60, evidence: 'אחרי שעה המקל יש לו על מה לסמוך', sweetsEvidence: 'ממתקים ושוקולד חלביים תוך שש שעות' },
      cooked: { entryId: 'hal-bayit-pareve-cooked-with-meat', minutes: 360, evidence: 'להמתין שש שעות גם כשאכל רק מהתבשיל', words: /(?:שהתבשל|שבושל|שנתבשל|מבושל|שהתבשלו|שבושלו)\s+עם\s+(?:ה)?בשר|רק\s+(?:את\s+|מה)?(?:ה)?(?:רוטב|תבשיל|אורז|תפוחי אדמה)\s+(?:של|מה|עם)/ },
    },
    note: { entryId: 'hal-bayit-count-from-end-of-meat', evidence: 'מסיום אכילת הבשר' },
    topicEntries: ['hal-bayit-six-hours-meat-to-dairy', 'hal-bayit-five-and-half-hours', 'hal-bayit-count-from-end-of-meat', 'hal-bayit-sick-one-hour', 'hal-bayit-children-wait-meat-dairy', 'hal-bayit-pareve-cooked-with-meat'],
    match: meatThenDairy },
  { id: 'asher-yatzar-window', kind: 'window', concept: 'asher-yatzar', entryId: 'hal-prayer-asher-yatzar-forgot', minutes: 72, evidence: '72 דקות',
    anchor: /שירותים|יצאתי|עשיתי צרכים|נפנתי/,
    topicEntries: ['hal-prayer-asher-yatzar-forgot', 'hal-prayer-asher-yatzar-after-amida'], triggers: [/אשר יצר/], overviewWords: /עד מתי|כמה זמן|עוד אפשר|אפשר עוד|אפשר לברך/ },
  { id: 'birkat-small-window', kind: 'window', concept: 'birkat-hamazon-time', entryId: 'hal-brachot-birkat-until-when', minutes: 72, evidence: '72 דקות',
    topicEntries: ['hal-brachot-birkat-until-when', 'hal-brachot-birkat-doubt-kezayit'],
    triggers: [/(?:אפשר|מותר|עוד|עד מתי|כבר).{0,25}(?:ברכת המזון|לבנטש)|(?:ברכת המזון|לבנטש).{0,25}(?:עד מתי|עוד אפשר|אפשר עוד|כבר עבר)|(?:לחם|פת|פיתה|לחמניה|כזית).{0,40}(?:לא בירכתי|שכחתי לברך)|(?:לא בירכתי|שכחתי לברך).{0,30}(?:לחם|פת|ברכת המזון)/],
    condition: 'אם אכלת רק כזית ולא שבעת; מי ששבע מברך כל זמן שהוא עדיין שבע.', conditionWords: /שבע|שבעתי|ארוחה מלאה|ארוחה שלמה/, conditionEvidence: 'יכול לברך כל זמן שהוא עדיין שבע' },
  { id: 'birkat-kezayit', kind: 'amount-threshold', concept: 'birkat-hamazon-amount', entryId: 'hal-brachot-birkat-kezayit', grams: 27, evidence: '27 גרם',
    topicEntries: ['hal-brachot-birkat-kezayit', 'hal-brachot-bread-less-kezayit'], triggers: [/\d+\s*גרם.{0,20}(?:לחם|פת|פיתה|לחמניה|חלה)|(?:לחם|פת|פיתה|לחמניה|חלה).{0,20}\d+\s*גרם/],
    within: { text: 'כזית פת או יותר – חייבים בברכת המזון, אף אם לא שבעת.', entryId: 'hal-brachot-birkat-kezayit' },
    beyond: { text: 'פחות מכזית – מברכים לפניה המוציא, אבל אחריה אין מברכים ברכת המזון.', entryId: 'hal-brachot-bread-less-kezayit', evidence: 'לאחריה אינו מברך כלום אם לא אכל כזית' } },
  { id: 'cake-meal', kind: 'amount-threshold', concept: 'cake-meal', entryId: 'hal-brachot-cake-meal', grams: 216, evidence: '216 גרם',
    topicEntries: ['hal-brachot-cake-meal'], triggers: [/\d+\s*גרם.{0,20}(?:עוגה|עוגות|מאפה|מאפים|בורקס|עוגיות)|(?:עוגה|עוגות|מאפה|מאפים|בורקס|עוגיות).{0,20}\d+\s*גרם/],
    within: { text: 'יותר מהשיעור של קביעת סעודה – מברכים המוציא וברכת המזון (וטוב להחמיר מ־230 גרם).', entryId: 'hal-brachot-cake-meal' },
    beyond: { text: 'פחות מהשיעור של קביעת סעודה לפי התשובה המאומתת.', entryId: 'hal-brachot-cake-meal' }, strictlyAbove: true },
  { id: 'achilat-pras', kind: 'duration-threshold', concept: 'bracha-achrona-time', entryId: 'hal-brachot-achilat-pras', minutes: 7.5, evidence: 'שבע דקות וחצי',
    topicEntries: ['hal-brachot-achilat-pras', 'hal-brachot-nefashot-shiur'], triggers: [/ברכה אחרונה|בורא נפשות|מעין שלוש|על המחיה/],
    overviewWords: /כמה זמן|בכמה זמן|תוך כמה|כמה צריך|שיעור|כמה לאכול/,
    within: 'אם אכלת כזית בתוך הזמן הזה – מברכים ברכה אחרונה.', beyond: 'אם אכילת הכזית נמשכה יותר מזה – אין מברכים ברכה אחרונה.' },
  { id: 'tefilat-haderech-distance', kind: 'duration-threshold', concept: 'tefilat-haderech', entryId: 'hal-prayer-tefilat-haderech-shiur', minutes: 72, evidence: '72 דקות',
    variants: { flight: { entryId: 'hal-prayer-tefilat-haderech-flight', minutes: 72, evidence: 'שעה ו-12 דקות' } },
    topicEntries: ['hal-prayer-tefilat-haderech-shiur', 'hal-prayer-tefilat-haderech-flight', 'hal-prayer-tefilat-haderech-once-a-day'], triggers: [/תפילת הדרך/],
    within: 'בנסיעה של 72 דקות לפחות חותמים בשם ומלכות.', beyond: 'בנסיעה קצרה מזה – אומרים בלי שם ומלכות.', thresholdMeansAtLeast: true },
  { id: 'tallit-removed', kind: 'interval', concept: 'tallit-bracha-again', entryId: 'hal-prayer-tallit-removed-bathroom', minutes: 30, evidence: 'בתוך חצי שעה',
    topicEntries: ['hal-prayer-tallit-removed-bathroom'], triggers: [/(?:הורדתי|פשטתי|הסרתי|הורדנו).{0,20}(?:טלית|ציצית)/],
    within: 'חזרת בתוך חצי שעה – אינך מברך שוב.', beyond: 'עברה חצי שעה או יותר – חוזרים ומברכים.' },
  { id: 'fast-end', kind: 'zman-offset', concept: 'fast-end', entryId: 'hal-moed-fast-times', zman: 'sunset', minutes: 20, evidence: 'כעשרים דקות אחר השקיעה',
    topicEntries: ['hal-moed-fast-times', 'hal-moed-tb-end'], triggers: [/(?:מתי|עד מתי|באיזה שעה).{0,20}(?:נגמר|מסתיים|יוצא|נגמרת).{0,10}(?:הצום|התענית)|(?:עד מתי|מתי נגמר) (?:הצום|התענית|צמים)/],
    label: 'סוף הצום', compare: 'from', onlyWhen: 'fast-day' },
  { id: 'shabbat-candles', kind: 'zman-offset', concept: 'shabbat-candles', entryId: 'qa-shabbat-candle-time', zman: 'sunset', minutes: -20, evidence: 'כעשרים דקות לפני השקיעה',
    variants: { need: { entryId: 'qa-shabbat-candle-time', minutes: -10, evidence: 'כעשר דקות לפני השקיעה', words: /צורך|מאוחר/ } },
    earliest: { entryId: 'hal-shabbat-earliest-time', zman: 'tzeit85deg', minutes: -75, evidence: 'שעה ורבע לפני צאת הכוכבים' },
    topicEntries: ['qa-shabbat-candle-time', 'hal-shabbat-earliest-time'], triggers: [/(?:מתי|באיזה שעה|עד מתי|ממתי).{0,15}(?:מדליקים|להדליק|הדלקת|מדליקה)\s+(?:את\s+)?(?:ה)?(?:נרות\s+)?(?:שבת|נרות)|(?:מתי|ממתי).{0,10}(?:הדלקת נרות|מדליקים נרות)/],
    label: 'הדלקת נרות שבת', compare: 'window', onlyWeekday: 5 },
  { id: 'chanukah-candles', kind: 'zman-offset', concept: 'chanukah-candles', entryId: 'hal-chag-candle-lighting-time', zman: 'sunset', minutes: 15, evidence: 'כרבע שעה אחר השקיעה',
    topicEntries: ['hal-chag-candle-lighting-time'], triggers: [/(?:מתי|באיזה שעה).{0,15}(?:מדליקים|להדליק|הדלקת).{0,15}חנוכה/], label: 'הדלקת נרות חנוכה', compare: 'from', onlyWhen: 'chanukah' },
  { id: 'tachanun-after-sunset', kind: 'zman-offset', concept: 'tachanun-night', entryId: 'hal-prayer-tachanun-night', zman: 'sunset', minutes: 13.5, evidence: 'בתוך 13.5 דקות',
    topicEntries: ['hal-prayer-tachanun-night'], triggers: [/(?:תחנון|וידוי|נפילת אפיים).{0,40}(?:שקיעה|השקיעה|שקעה)|(?:שקיעה|השקיעה|שקעה).{0,40}(?:תחנון|וידוי|נפילת אפיים)/],
    label: 'אמירת תחנון במנחה', compare: 'until' },
  { id: 'tallit-earliest', kind: 'zman-offset', concept: 'tallit-earliest', entryId: 'hal-prayer-tallit-earliest-time', zman: 'sunrise', minutes: -60, evidence: 'כשעה לפני הנץ',
    variants: { worker: { entryId: 'hal-prayer-tallit-earliest-time', zman: 'alotHaShachar', minutes: 6, evidence: 'כשש דקות אחרי עמוד השחר', words: /עבודה|ממהר|ממהרת|פועל|לעבוד/ } },
    topicEntries: ['hal-prayer-tallit-earliest-time'], triggers: [/(?:ממתי|מאיזו שעה|מאיזה שעה|מתי אפשר|מתי מותר|מתי מתחילים).{0,25}(?:טלית|ציצית)/],
    label: 'עטיפת טלית בברכה', compare: 'from' },
  { id: 'birkot-hatorah-awake', kind: 'zman-offset', concept: 'birkot-hatorah-awake', entryId: 'hal-prayer-birkot-hatorah-awake-all-night', zman: 'alotHaShachar', minutes: 0, evidence: 'רק לאחר עמוד השחר',
    topicEntries: ['hal-prayer-birkot-hatorah-awake-all-night'], triggers: [/ברכות התורה.{0,40}(?:ער כל הלילה|ניעור|לא ישנתי|ערה כל הלילה)|(?:ער כל הלילה|ניעור|לא ישנתי|ערה כל הלילה).{0,40}ברכות התורה/],
    label: 'ברכות התורה למי שהיה ער', compare: 'from' },
  { id: 'omer-eating-before', kind: 'zman-offset', concept: 'omer-eating', entryId: 'hal-moed-omer-eating-before', zman: 'sunset', minutes: -30, evidence: 'מחצי שעה לפני השקיעה',
    topicEntries: ['hal-moed-omer-eating-before'], triggers: [/(?:לאכול|אוכל|ארוחה|סעודה).{0,40}(?:ספירת העומר|לספור|הספירה)|(?:ספירת העומר|לספור|הספירה).{0,40}(?:לאכול|ארוחה|סעודה)/],
    label: 'סעודה לפני ספירת העומר', compare: 'until', onlyWhen: 'omer' },
  { id: 'omer-count-time', kind: 'zman-offset', concept: 'omer-time', entryId: 'hal-moed-omer-time', zman: 'tzeit85deg', minutes: 0, evidence: 'לכתחילה נכון לספור אחרי צאת הכוכבים',
    topicEntries: ['hal-moed-omer-time'], triggers: [/(?:מתי|ממתי|באיזה שעה).{0,20}(?:סופרים|לספור|ספירת|כדאי לספור)|(?:אפשר|מותר)\s+(?:כבר\s+)?לספור/],
    label: 'ספירת העומר', compare: 'from', onlyWhen: 'omer' },
  { id: 'omer-forgot-now', kind: 'omer-status', concept: 'omer-forgot', entryId: 'hal-moed-omer-forgot',
    night: { entryId: 'hal-moed-omer-time', evidence: 'מי ששכח בתחילת הלילה סופר כל הלילה' },
    day: { entryId: 'hal-moed-omer-forgot', evidence: 'אם נזכר ביום, סופר את מספר אותו יום בלי ברכה, ובלילות הבאים ממשיך לספור בברכה' },
    whole: { entryId: 'hal-moed-omer-forgot', evidence: 'מי ששכח לספור לילה ויום שלם — ממשיך לספור בלי ברכה' },
    topicEntries: ['hal-moed-omer-forgot', 'qa-forgot-omer'], triggers: [/(?:לא ספרתי|שכחתי לספור|שכחתי את הספירה|לא ספרנו).{0,60}(?:עכשיו|נזכרתי|רק עכשיו)|(?:נזכרתי|עכשיו).{0,40}(?:לא ספרתי|שכחתי לספור)/],
    fact: /עכשיו|נזכרתי|\d{1,2}:\d{2}/, onlyWhen: 'omer' },
  { id: 'havdala-until', kind: 'weekday-until', concept: 'havdala-late', entryId: 'hal-shabbat-havdala-until-tuesday', untilWeekday: 2, evidence: 'עד סוף יום שלישי',
    topicEntries: ['hal-shabbat-havdala-until-tuesday'], triggers: [/(?:שכחתי|לא עשיתי|פספסתי).{0,20}הבדלה|הבדלה.{0,20}(?:עד מתי|עוד אפשר|אפשר עוד)/] },
];

export const RULE_INDEX = Object.fromEntries(HALACHA_RULES.map(rule => [rule.id, rule]));
// A verified entry → the rule that makes it computable (for follow-ups like "ואם אכלתי ב-14:30?").
export const RULE_BY_ENTRY = Object.fromEntries(HALACHA_RULES.flatMap(rule => (rule.topicEntries || [rule.entryId]).map(id => [id, rule.id])));
export const ruleMatches = (rule, text) => (rule.match ? rule.match(text) : rule.triggers.some(pattern => pattern.test(text)));
