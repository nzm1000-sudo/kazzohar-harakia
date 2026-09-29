// The deterministic semantic lexicon (reviewable data, not code): how people ask, and the words the sources use.
// Read by src/services/torah/queryIntent.mjs; every expansion is weighted below the words as typed and marked in the
// result's explanation, so an exact match always ranks first and nothing here can invent a source.
//
// Relations (and their weight in search):
//   variant  0.95 — the same word in another spelling or register (כיפה → כיסוי ראש is NOT a variant)
//   synonym  0.90 — the same concept in other words (לדבר רע → לשון הרע)
//   modern   0.85 — modern Hebrew → the classical term the sources use for the same thing (אוכל נוזלי → תבשיל לח)
//   related  0.50 — a different but connected concept (כיפה → גילוי הראש): never a synonym, heavily penalized
// Rules of review: an expansion must be the same halachic concept (or marked related); never a ruling, never a
// "therefore"; a word with several meanings is expanded only in the phrase that fixes its meaning.
export const RELATION_WEIGHT = Object.freeze({ variant: 0.95, synonym: 0.9, modern: 0.85, related: 0.5 });

// Question scaffolding: words that carry the asking, not the subject. In a natural question they are optional —
// searched if present in a source, never required (מה, איך, איפה כתוב, מה עושים, אפשר, מותר…).
export const QUESTION_OPENERS = Object.freeze(['מה', 'מתי', 'איך', 'האם', 'למה', 'מדוע', 'כמה', 'איפה', 'היכן', 'מי', 'אפשר', 'מותר', 'אסור', 'צריך', 'צריכים', 'חייב', 'חייבים', 'יש', 'אם', 'כיצד', 'באיזה', 'איזה', 'איזו', 'אילו']);
export const QUESTION_SCAFFOLDING = Object.freeze([
  ...QUESTION_OPENERS,
  'כתוב', 'נאמר', 'עושים', 'עושה', 'לעשות', 'אני', 'אנחנו', 'אתה', 'זה', 'שזה', 'זאת', 'לגבי', 'בנוגע', 'הדין', 'דין', 'בדיוק',
  'מאכל', 'דבר', 'משהו', 'אדם', 'מישהו', 'אנשים', 'בין', 'שעשוי', 'עשוי', 'העשוי', 'שעשויה', 'עשויה', 'לומר', 'להגיד', 'אפילו', 'גם', 'בכלל', 'כדי', 'בבקשה',
]);

// Concepts: the forms a person types (phrases, matched as whole words, longest first) → the sources' words.
export const CONCEPTS = Object.freeze([
  // ---- doubt ----
  { id: 'safek', forms: ['לא בטוח', 'לא בטוחה', 'לא בטוחים', 'לא זוכר', 'לא זוכרת', 'לא זוכרים', 'מתלבט', 'מסופק', 'מסופקת'], expansions: [{ text: 'ספק', rel: 'modern' }, { text: 'נסתפק', rel: 'modern' }, { text: 'מסופק', rel: 'synonym' }], note: 'ספק (הלכות ספק)' },
  // ---- forgetting / omitting in prayer ----
  { id: 'shachach', forms: ['שכחתי', 'שכחנו', 'שכחה', 'שכחת', 'דילגתי', 'פספסתי'], expansions: [{ text: 'שכח', rel: 'variant' }, { text: 'לא אמר', rel: 'modern' }, { text: 'טעה', rel: 'modern' }, { text: 'לא הזכיר', rel: 'modern' }], note: 'שכח / טעה ולא אמר' },
  // ---- blessings ----
  { id: 'berach', forms: ['בירכתי', 'ברכתי', 'בירכנו', 'בירכה'], expansions: [{ text: 'בירך', rel: 'variant' }], note: 'בירך' },
  { id: 'ma-mevarchim', forms: ['מה מברכים', 'איזו ברכה', 'איזה ברכה', 'מה הברכה', 'מה מברכין'], expansions: [{ text: 'מברך', rel: 'variant' }, { text: 'ברכתו', rel: 'modern' }], note: 'ברכת הנהנין' },
  // ---- Shabbat cooking and heating ----
  { id: 'chimum', forms: ['מחממים', 'לחמם אוכל', 'לחמם את האוכל', 'לחמם את המאכל'], expansions: [{ text: 'לחמם', rel: 'variant' }, { text: 'חימום', rel: 'variant' }, { text: 'להחם', rel: 'variant' }, { text: 'בישול', rel: 'related' }], note: 'חימום (ובישול)' },
  { id: 'lach', forms: ['אוכל נוזלי', 'מאכל נוזלי', 'תבשיל נוזלי', 'נוזלי', 'נוזלים'], expansions: [{ text: 'רוטב', rel: 'modern' }, { text: 'תבשיל לח', rel: 'modern' }, { text: 'מרק', rel: 'modern' }], note: 'דבר לח / רוטב' },
  { id: 'plata', forms: ['פלטה', 'פלאטה', 'פלטת שבת'], expansions: [{ text: 'פלטה', rel: 'variant' }, { text: 'פלאטה', rel: 'variant' }], note: 'פלטה (שני הכתיבים)' },
  { id: 'kli', forms: ['סיר'], expansions: [{ text: 'קדרה', rel: 'modern' }, { text: 'קדירה', rel: 'modern' }], note: 'סיר → קדרה' },
  // ---- honouring parents ----
  { id: 'kibud', forms: ['כיבוד הורים', 'כבוד הורים', 'לכבד הורים', 'לכבד את ההורים', 'לכבד את ההורים שלי', 'כיבוד ההורים'], expansions: [{ text: 'כיבוד אב ואם', rel: 'synonym' }, { text: 'כבוד אב ואם', rel: 'synonym' }, { text: 'כבד את אביך', rel: 'synonym' }], note: 'כיבוד אב ואם' },
  { id: 'horim', forms: ['הורים', 'ההורים', 'להורים'], expansions: [{ text: 'אב ואם', rel: 'synonym' }, { text: 'אביו ואמו', rel: 'synonym' }], note: 'אב ואם' },
  // ---- speech ----
  { id: 'lashon-hara', forms: ['לדבר רע', 'לדבר רעה', 'לספר רע', 'דיבור רע', 'לרכל', 'רכילות', 'להשמיץ', 'השמצה', 'לדבר סרה'], expansions: [{ text: 'לשון הרע', rel: 'synonym' }, { text: 'המספר בגנות', rel: 'synonym' }, { text: 'רכילות', rel: 'related' }], note: 'לשון הרע (ורכילות — קרוב, לא זהה)' },
  { id: 'emet', forms: ['שזה אמת', 'זה אמת', 'גם אם זה אמת', 'אם זה נכון', 'שזה נכון', 'דבר אמת'], expansions: [{ text: 'אמת', rel: 'synonym' }], note: 'אף על פי שאומר אמת' },
  // ---- lost objects ----
  { id: 'hashavat-aveda', forms: ['להחזיר חפץ', 'להחזיר אבידה', 'להשיב אבידה', 'להחזיר את החפץ', 'להחזיר חפץ שנמצא', 'להחזיר מציאה', 'החזרת אבידה'], expansions: [{ text: 'השבת אבידה', rel: 'synonym' }, { text: 'חייב להחזיר', rel: 'modern' }, { text: 'אבידה', rel: 'related' }], note: 'השבת אבידה' },
  { id: 'motze', forms: ['מצאתי', 'מצאנו', 'שמצאתי', 'שנמצא', 'חפץ שנמצא', 'מצאתי חפץ', 'איבדתי', 'חפץ אבוד', 'מצא חפץ'], expansions: [{ text: 'המוצא', rel: 'modern' }, { text: 'אבידה', rel: 'modern' }, { text: 'מציאה', rel: 'modern' }, { text: 'השבת אבידה', rel: 'related' }], note: 'המוצא אבידה / מציאה' },
  { id: 'rechov', forms: ['ברחוב', 'רחוב', 'בכביש', 'במקום ציבורי'], expansions: [{ text: 'ברשות הרבים', rel: 'modern' }, { text: 'בשוק', rel: 'modern' }], note: 'רשות הרבים' },
  // ---- head covering ----
  { id: 'kippah', forms: ['בלי כיפה', 'בלי כיסוי ראש', 'בלי כובע', 'ראש מגולה', 'בראש גלוי', 'בלי כיסוי', 'כיסוי ראש'], expansions: [{ text: 'בגילוי הראש', rel: 'modern' }, { text: 'גלוי הראש', rel: 'modern' }, { text: 'כיסוי הראש', rel: 'synonym' }], note: 'גילוי / כיסוי הראש' },
  { id: 'kippah-word', forms: ['כיפה', 'כיפות'], expansions: [{ text: 'כיסוי הראש', rel: 'related' }, { text: 'גילוי הראש', rel: 'related' }], note: 'כיפה — קרוב, לא זהה' },
  // ---- meat and milk ----
  { id: 'hamtana', forms: ['כמה זמן מחכים', 'כמה לחכות', 'לחכות', 'מחכים', 'להמתין', 'כמה שעות'], expansions: [{ text: 'ישהה', rel: 'modern' }, { text: 'שש שעות', rel: 'related' }, { text: 'ימתין', rel: 'modern' }], note: 'המתנה בין בשר לחלב' },
  { id: 'chalavi', forms: ['חלבי', 'מאכל חלבי', 'חלביים'], expansions: [{ text: 'גבינה', rel: 'modern' }, { text: 'חלב', rel: 'modern' }], note: 'חלבי → גבינה / חלב' },
  { id: 'besari', forms: ['בשרי', 'בשריים', 'מאכל בשרי'], expansions: [{ text: 'בשר', rel: 'modern' }], note: 'בשרי → בשר' },
  // ---- verbs: the infinitive a person types and the forms a ruling is written in (the same word) ----
  { id: 'lalechet', forms: ['ללכת', 'הולכים', 'הולך', 'להסתובב'], expansions: [{ text: 'ילך', rel: 'variant' }, { text: 'לילך', rel: 'variant' }, { text: 'הולך', rel: 'variant' }, { text: 'ללכת', rel: 'variant' }], note: 'הליכה' },
  { id: 'leechol', forms: ['לאכול', 'אוכלים'], expansions: [{ text: 'יאכל', rel: 'variant' }, { text: 'לאכול', rel: 'variant' }, { text: 'האוכל', rel: 'variant' }, { text: 'אכילה', rel: 'variant' }], note: 'אכילה' },
  { id: 'lishtot', forms: ['לשתות', 'שותים'], expansions: [{ text: 'ישתה', rel: 'variant' }, { text: 'לשתות', rel: 'variant' }, { text: 'השותה', rel: 'variant' }, { text: 'שתיה', rel: 'variant' }], note: 'שתייה' },
  { id: 'lehitpalel', forms: ['להתפלל', 'מתפללים'], expansions: [{ text: 'יתפלל', rel: 'variant' }, { text: 'להתפלל', rel: 'variant' }, { text: 'המתפלל', rel: 'variant' }, { text: 'תפלה', rel: 'variant' }], note: 'תפילה' },
  // ---- common modern words with a fixed classical term ----
  { id: 'tzom', forms: ['צום', 'צמים', 'לצום'], expansions: [{ text: 'תענית', rel: 'synonym' }], note: 'צום → תענית' },
  { id: 'chatuna', forms: ['חתונה', 'חתונות'], expansions: [{ text: 'נישואין', rel: 'modern' }, { text: 'חופה', rel: 'related' }], note: 'חתונה' },
  { id: 'levaya', forms: ['לוויה', 'הלוויה'], expansions: [{ text: 'הלוית המת', rel: 'modern' }, { text: 'לויה', rel: 'variant' }], note: 'לוויה' },
  { id: 'sherutim', forms: ['שירותים', 'בשירותים', 'לשירותים'], expansions: [{ text: 'בית הכסא', rel: 'modern' }, { text: 'בית הכיסא', rel: 'variant' }], note: 'בית הכסא' },
  { id: 'chanukia', forms: ['חנוכיה', 'חנוכייה', 'חנוכיות'], expansions: [{ text: 'נר חנוכה', rel: 'modern' }, { text: 'נרות חנוכה', rel: 'modern' }], note: 'חנוכייה → נר חנוכה' },
  { id: 'nerot-shabbat', forms: ['נרות שבת', 'להדליק נרות'], expansions: [{ text: 'נר שבת', rel: 'variant' }, { text: 'הדלקת נר', rel: 'variant' }], note: 'נר שבת' },
  { id: 'rofe', forms: ['תרופה', 'תרופות', 'כדור'], expansions: [{ text: 'רפואה', rel: 'modern' }], note: 'תרופה → רפואה (כדור רק כתרופה)' },
  { id: 'aniyim', forms: ['לתת כסף לעניים', 'לתרום', 'תרומה לעניים'], expansions: [{ text: 'צדקה', rel: 'synonym' }], note: 'צדקה' },
]);

// Books and topics as people name them (the library's own aliases cover book titles; these are topic aliases).
export const TOPIC_ALIASES = Object.freeze([
  { forms: ['הלכות שבת'], expansions: [{ text: 'שבת', rel: 'variant' }] },
  { forms: ['ברכות הנהנין'], expansions: [{ text: 'ברכת הנהנין', rel: 'variant' }] },
]);
