// Batch H — questions women ask about their own obligations (Shabbat morning, blessings, challah, mourning, the
// synagogue), filed under הלכות נשים so the category holds verified answers and not only sources.
import { E, span, write, OWNER } from './lib.mjs';
const Y = n => `yalkut-yosef-${n}`;
const W = { place: 'women' };
write('h-women', [
  E({ ...W, id: 'hal-prk-woman-eat-before-kiddush-morning', topic: 'קידוש והבדלה', subtopic: 'שבת בבוקר', contexts: ['shabbat'], timeOfDay: 'morning',
    sectionId: Y('23-46-4'), excerpt: span(Y('23-46-4'), 'משעלה עמוד השחר אסור להן לטעום אפילו מים קודם הקידוש', 'ואין לה לטעום מאומה קודם הקידוש.'),
    extraSources: [
      { sectionId: Y('23-46-4'), excerpt: span(Y('23-46-4'), 'ומכל מקום בשעת הדחק כגון אשה שהיא חולה קצת', 'על ידי הקידוש שבלילה.') },
      { sectionId: Y('23-46-4'), excerpt: span(Y('23-46-4'), 'אבל אשה שרגילה להתפלל שחרית', 'קודם תפלת שחרית.') },
    ],
    question: 'אני אישה ולא תמיד מתפללת שחרית – מותר לי לשתות קפה בשבת בבוקר לפני הקידוש?',
    shortAnswer: 'אישה שאין לה זמן קבוע לתפילה – משעלה עמוד השחר אסור לה לטעום אפילו מים לפני הקידוש. בשעת הדחק, כגון חולה קצת או מינקת, יכולה לסמוך על המתירים. ואישה שרגילה להתפלל שחרית כל יום – רשאית לטעום לפני התפילה.',
    ruleType: 'din', conditions: ['בליל שבת – גם הנשים אסורות לאכול ולשתות לפני הקידוש.'],
    variants: ['אישה שותה קפה לפני קידוש בשבת בבוקר', 'אשה מינקת לשתות לפני קידוש', 'נשים לאכול לפני קידוש של יום', 'לשתות מים בשבת בבוקר לפני קידוש אישה'],
    searchTerms: ['קידוש', 'שבת בבוקר', 'אישה', 'נשים', 'קפה', 'מינקת'],
    tags: ['נשים', 'קידוש', 'שבת'], related: ['hal-shabbat-coffee-before-shacharit', 'qa-woman-kiddush'], discovery: [OWNER] }),

  E({ ...W, id: 'hal-prk-woman-birkat-for-husband', topic: 'תפילת נשים', subtopic: 'ברכת המזון', contexts: ['meal'],
    sectionId: Y('15-5-1'), excerpt: span(Y('15-5-1'), 'נשים חייבות בברכת המזון', 'יכולה האשה [שאכלה ושבעה] להוציאם ידי חובתם.'),
    question: 'בעלי חולה ולא יכול לברך ברכת המזון – אני יכולה לברך ולהוציא אותו?',
    shortAnswer: 'נשים חייבות בברכת המזון, אבל יש ספק אם מן התורה, ולכן אם הבעל או הבן אכלו ושבעו – אינה יכולה להוציאם. רק כשאכלו כזית בלבד, שחיובם מדרבנן, יכולה אישה שאכלה ושבעה להוציאם.',
    ruleType: 'din', conditions: [],
    variants: ['אשה מוציאה את בעלה בברכת המזון', 'לברך ברכת המזון בשביל הבעל', 'נשים חייבות בברכת המזון', 'אמא מברכת בשביל הבן החולה'],
    searchTerms: ['ברכת המזון', 'אישה', 'להוציא ידי חובה', 'חולה'],
    tags: ['נשים', 'ברכת המזון'], related: ['hal-brachot-zimun-women'], discovery: [OWNER] }),

  E({ ...W, id: 'hal-prk-woman-lechem-mishneh-melave-malka', topic: 'מצוות התלויות בזמן', subtopic: 'סעודות שבת', contexts: ['shabbat', 'motzei-shabbat'],
    sectionId: Y('23-58-3'), excerpt: span(Y('23-58-3'), 'גם הנשים חייבות בסעודה רביעית במוצאי שבת', 'סעודת מלוה מלכה.'),
    extraSources: [{ sectionId: Y('23-48-9'), excerpt: span(Y('23-48-9'), 'וגם הנשים חייבות בלחם משנה.', 'שיהיה נראה כשלם.') }],
    question: 'נשים חייבות בלחם משנה ובסעודת מלווה מלכה?',
    shortAnswer: 'כן. גם הנשים חייבות בלחם משנה, ואם אין שתי חלות שלמות – מצרפים שני חצאים שייראו כשלם. וגם בסעודה רביעית של מוצאי שבת הנשים חייבות, כדין האיש בכל ענייני שבת.',
    ruleType: 'din', conditions: [],
    variants: ['אשה לחם משנה', 'נשים מלווה מלכה', 'סעודה רביעית לנשים', 'אישה צריכה שתי חלות'],
    searchTerms: ['לחם משנה', 'מלווה מלכה', 'סעודה רביעית', 'נשים'],
    tags: ['נשים', 'סעודות שבת', 'מלווה מלכה'], related: ['hal-shabbat-women-seuda-shlishit', 'hal-shabbat-lechem-mishne'], discovery: [OWNER] }),

  E({ ...W, id: 'hal-prk-woman-tefillin', topic: 'מצוות התלויות בזמן', subtopic: 'תפילין', contexts: ['weekday-morning'],
    sectionId: Y('4-17-1'), excerpt: span(Y('4-17-1'), 'נשים פטורות מלהניח תפילין', 'יש למחות בידן.'),
    question: 'אישה רוצה להניח תפילין – מותר לה?',
    shortAnswer: 'נשים פטורות מתפילין, ואם רוצות להחמיר ולהניח – מוחים בידן.',
    ruleType: 'din', conditions: [],
    variants: ['אשה מניחה תפילין', 'נשים תפילין מותר', 'בת רוצה להניח תפילין'],
    searchTerms: ['תפילין', 'נשים', 'אישה'],
    tags: ['נשים', 'תפילין'], related: ['hal-prayer-women-tzitzit'], discovery: [OWNER] }),

  E({ ...W, id: 'hal-prk-woman-keria', topic: 'אבלות', subtopic: 'קריעה', place: 'family', contexts: ['life-cycle'],
    sectionId: Y('66-4-20'), excerpt: span(Y('66-4-20'), 'נשים חייבות אף הן לקרוע על המת כדין האנשים', 'יסגרו מקום הקריעה בסיכת בטחון, לצניעות.'),
    question: 'גם נשים קורעות קריעה בלוויה?',
    shortAnswer: 'כן. נשים חייבות לקרוע על מת שמתאבלות עליו כמו הגברים, ומנהג שלא לקרוע – יש לבטלו. אחרי הקריעה סוגרים את מקום הקריעה בסיכת ביטחון, לצניעות.',
    ruleType: 'din', conditions: [],
    variants: ['נשים קריעה', 'אישה קורעת בגד בלוויה', 'בת קורעת על אביה', 'קריעה לנשים צניעות'],
    searchTerms: ['קריעה', 'נשים', 'אבלות', 'לוויה'],
    tags: ['אבלות', 'קריעה', 'נשים'], related: ['hal-bayit-keria-blessing'], discovery: [OWNER] }),

  E({ ...W, id: 'hal-prk-woman-challah-without-husband', topic: 'הפרשת חלה', subtopic: 'מי מפריש', contexts: ['home', 'friday'],
    sectionId: Y('63-10-15'), excerpt: span(Y('63-10-15'), 'אין מפרישין חלה בלי רשות בעל העיסה', 'שיש לה דין בעלים על העיסה.'),
    question: 'אני צריכה רשות מבעלי כדי להפריש חלה מהבצק?',
    shortAnswer: 'לא. אמנם אין מפרישים חלה בלי רשות בעל העיסה, אבל האישה אינה צריכה רשות מבעלה, כי היא קודמת לו במצווה זו; והיא אף יכולה למנות שליח להפריש.',
    ruleType: 'din', conditions: [],
    variants: ['הפרשת חלה בלי הבעל', 'אשה מפרישה חלה רשות', 'לבקש מאחרת להפריש חלה בשבילי', 'שליח להפרשת חלה'],
    searchTerms: ['הפרשת חלה', 'חלה', 'רשות', 'שליח'],
    tags: ['הפרשת חלה', 'נשים'], related: [], discovery: [OWNER] }),

  E({ ...W, id: 'hal-prk-woman-torah-reading', topic: 'תפילת נשים', subtopic: 'קריאת התורה', contexts: ['shabbat'],
    sectionId: Y('9-2-9'), excerpt: span(Y('9-2-9'), 'אין הנשים חייבות לבוא לבית הכנסת לשמיעת קריאת התורה', 'כדי לשמוע קריאת התורה בצבור.'),
    question: 'נשים חייבות ללכת לבית הכנסת לשמוע קריאת התורה?',
    shortAnswer: 'לא. אין הנשים חייבות לבוא לשמוע קריאת התורה, ויש נוהגות ממידת חסידות לבוא בימי שני וחמישי, בשבתות ובחגים, כדי לשמוע אותה בציבור.',
    ruleType: 'din', conditions: ['בפרשת זכור יש אומרים שגם נשים צריכות לשמוע, ויש חולקים.'],
    variants: ['נשים קריאת התורה חובה', 'אישה צריכה לשמוע קריאת התורה בשבת', 'עזרת נשים קריאת התורה'],
    searchTerms: ['קריאת התורה', 'נשים', 'בית הכנסת', 'עזרת נשים'],
    tags: ['נשים', 'קריאת התורה'], related: [], discovery: [OWNER] }),
]);
