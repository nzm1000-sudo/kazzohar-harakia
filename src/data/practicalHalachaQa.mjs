import { HALACHA_ENGINE_ENTRIES } from './halachaEngineEntries.mjs';
import { HALACHA_TRACK_ENTRIES } from './halachaTrackEntries.mjs';
import { ONG_SHABBAT_QA } from './ongShabbatQa.mjs';
import { HIGH_STAKES_ANSWER, PUBLICATION, TECH_NOTE } from '../services/ongShabbatGate.mjs';
const yalkut = (localSourceId, citation) => ({
  work: 'קיצור שולחן ערוך ילקוט יוסף',
  localSourceId,
  ref: `Yalkut Yosef ${localSourceId}`,
  citation,
  sourceType: 'local-yalkut-yosef',
});

const qa = (id, question, shortAnswer, aliases, category, subcategory, source, extra = {}) => ({
  id,
  question,
  shortAnswer,
  conditions: extra.conditions || [],
  aliases,
  variants: aliases,
  category,
  topic: subcategory,
  subcategory,
  // Semantic event tags for contextual selection (e.g. the daily halacha card) —
  // grounded in what the question is actually about, never fabricated per event.
  tags: extra.tags || ['general'],
  authority: extra.authority || 'rav-yitzhak-yosef',
  // A claim that its first section does not carry alone lists the sections that do (extra.sources).
  sources: [source, ...(extra.sources || [])],
  quality: 'verified',
  reviewStatus: 'verified',
  answerStatus: 'published',
  searchKeywords: extra.searchKeywords || [],
  relatedQuestionIds: extra.relatedQuestionIds || [],
  sensitivity: extra.sensitivity || 'public',
  personal: Boolean(extra.personal),
});

// The Halacha Engine's verified entries (questions people ask, answered from a quoted Yalkut Yosef section) join the same
// published layer, so search, the daily halacha and the question page treat them exactly like the entries above.
// Their English semantic tags come only from the contexts each entry was verified for.
const SEMANTIC_TAG = { sukkot: 'sukkot', 'pre-sukkot': 'sukkot', 'hoshana-raba': 'sukkot', 'simchat-torah': 'sukkot', pesach: 'pesach', 'pesach-prep': 'pesach', shavuot: 'shavuot', 'rosh-hashana': 'rosh-hashanah', 'yom-kippur': 'yom-kippur', 'aseret-yemei-teshuva': 'aseret-yemei-teshuvah', chanukah: 'chanukah', purim: 'purim', 'rosh-chodesh': 'rosh-chodesh', friday: 'shabbat', shabbat: 'shabbat', omer: 'omer' };
const engineEntry = entry => ({
  ...qa(entry.id, entry.question, entry.shortAnswer, [...new Set([...entry.variants, ...entry.tags])], entry.category, entry.topic,
    { ...yalkut(entry.source.localSourceId, entry.source.citation), sectionTitle: entry.source.sectionTitle, excerpt: entry.source.excerpt, furtherRefs: entry.source.furtherRefs || [] },
    { tags: [...new Set(entry.contexts.map(context => SEMANTIC_TAG[context]).filter(Boolean))], searchKeywords: entry.tags,
      sources: (entry.supportingSources || []).map(extra => ({ ...yalkut(extra.localSourceId, extra.citation), excerpt: extra.excerpt, supporting: true })) }),
  subtopic: entry.subtopic || entry.topic,
  ruleType: entry.ruleType,
  contexts: entry.contexts,
  timeOfDay: entry.timeOfDay || null,
  askedOn: entry.askedOn || [],
  relatedSourceQuestion: entry.relatedSourceQuestion || null,
  engine: true,
});

// עונג שבת (הרב ישראל שריקי; באישור המחבר): the book's halachot join the same layer. Their source is the book itself,
// at its chapter, halacha and printed page; the excerpt is the book's exact wording. A high-stakes record (חולה, יולדת,
// תרופות) carries no derived answer: its "short answer" only routes to the book's words and a rabbi.
const ONG_SEMANTIC_TAG = { friday: 'shabbat', shabbat: 'shabbat', 'motzei-shabbat': 'shabbat', chanukah: 'chanukah', purim: 'purim', meal: 'berachot', 'yom-tov': 'shabbat' };
const ongSource = record => ({
  work: 'עונג שבת',
  author: 'הרב ישראל שריקי',
  localSourceId: `ong-shabbat-${record.chapter}-${record.n}`,
  ref: `Oneg_Shabbat.${record.chapter}.${record.n}`,
  route: `books/r/Oneg_Shabbat/${record.chapter}/${record.n}`,
  sourceType: 'local-ong-shabbat',
  citation: `פרק ${record.chapterLabel}, הלכה ${record.label}${record.title ? ` (${record.title})` : ''} · עמ׳ ${record.pages[0]}`,
  sectionTitle: record.section,
  excerpt: record.excerpt,
  pages: record.pages,
  notes: record.notes,
});
const ongEntry = record => {
  const high = record.publication === PUBLICATION.SOURCE_ONLY;
  return {
    ...qa(record.id, record.question, high ? HIGH_STAKES_ANSWER : record.shortAnswer, [...new Set([...record.variants, ...record.keywords, ...record.indexTerms])], record.category, record.topic, ongSource(record), {
      conditions: record.conditions,
      tags: [...new Set(record.contexts.map(context => ONG_SEMANTIC_TAG[context]).filter(Boolean))],
      authority: 'ong-shabbat',
      searchKeywords: [...new Set([...record.keywords, ...record.indexTerms])],
      personal: high,
    }),
    answerStatus: record.answerStatus,
    subtopic: record.section || record.topic,
    ruleType: record.ruleType,
    contexts: record.contexts,
    sourceBook: 'ong-shabbat',
    bookPlace: { chapter: record.chapter, unit: record.n, chapterLabel: record.chapterLabel, chapterTitle: record.chapterTitle, label: record.label, title: record.title, pages: record.pages },
    explanation: record.explanation,
    currentness: record.currentness,
    currentnessNote: record.currentnessNote,
    publication: record.publication,
    techNote: record.publication === PUBLICATION.FROM_BOOK_TECH ? TECH_NOTE : null,
    highStakes: high,
    answerIsRouting: high,
    dangerExcerpt: record.dangerExcerpt || null,
    yalkutParallels: record.yalkutParallels || [],
    unitHash: record.unitHash,
    reviewBasis: 'mechanical-extraction-check',
    rabbinicReview: 'pending',
  };
};

export const PRACTICAL_HALACHA_QA = [
  qa('qa-banana-blessing', 'מה מברכים על בננה?', 'בורא פרי האדמה.', ['ברכה על בננה', 'איזו ברכה מברכים על בננה', 'בננה אדמה או עץ', 'מה הברכה של בננה'], 'blessings', 'ברכות הנהנין', yalkut('yalkut-yosef-16-1-5', 'סימן רב, סעיף ה'), { tags: ['berachot'], relatedQuestionIds: ['qa-rice-blessing', 'qa-pizza-blessing', 'qa-gum-blessing'] }),
  qa('qa-rice-blessing', 'מה מברכים על אורז?', 'על אורז מבושל מברכים בורא מיני מזונות.', ['ברכה על אורז', 'אורז מזונות', 'אורז אדמה או מזונות', 'מה הברכה של אורז'], 'blessings', 'ברכות הנהנין', yalkut('yalkut-yosef-16-1-6', 'סימן רב, סעיף ו'), { tags: ['berachot'], relatedQuestionIds: ['qa-banana-blessing', 'qa-pizza-blessing'] }),
  qa('qa-pizza-blessing', 'מה מברכים על פיצה?', 'אם הבצק נילוש במים מברכים המוציא; אם נילוש בחלב וטעמו ניכר, מברכים מזונות.', ['ברכה על פיצה', 'פיצה המוציא או מזונות', 'איזו ברכה פיצה'], 'blessings', 'ברכות הנהנין', yalkut('yalkut-yosef-12-3-3', 'סימן קסח, סעיף ג'), { tags: ['berachot'], conditions: ['הברכה תלויה בהרכב הבצק.'], relatedQuestionIds: ['qa-rice-blessing', 'qa-banana-blessing'] }),
  qa('qa-gum-blessing', 'מה מברכים על מסטיק?', 'על מסטיק שיש בו מתיקות או טעם מברכים שהכל, אף שאינו נבלע.', ['ברכה על מסטיק', 'איזה ברכה מסטיק', 'מסטיק שהכל', 'צריך לברך על מסטיק'], 'blessings', 'ברכות הנהנין', yalkut('yalkut-yosef-16-3-21', 'סימן רד, סעיף כא'), { tags: ['berachot'], relatedQuestionIds: ['qa-banana-blessing'] }),
  qa('qa-yaaleh-veyavo', 'שכחתי יעלה ויבוא בראש חודש, מה עושים?', 'בערבית אין חוזרים. בשחרית או במנחה, אם סיימת את העמידה צריך לחזור ולהתפלל.', ['שכחתי יעלה ויבוא', 'לא אמרתי יעלה ויבוא', 'צריך לחזור על העמידה', 'שכחתי ראש חודש בתפילה'], 'prayer', 'יעלה ויבוא', yalkut('yalkut-yosef-24-4-1', 'סימן תיח, סעיף א'), { sources: [yalkut('yalkut-yosef-24-5-4', 'סימן תכא-תכב, סעיף ד'), yalkut('yalkut-yosef-24-5-8', 'סימן תכא-תכב, סעיף ח')], tags: ['rosh-chodesh', 'tefillah'], conditions: ['בשחרית ובמנחה הדין משתנה לפי השלב שבו נזכרת.'], relatedQuestionIds: ['qa-hamelech-hakadosh'] }),
  qa('qa-hamelech-hakadosh', 'שכחתי המלך הקדוש בעשרת ימי תשובה, מה עושים?', 'אם תיקנת מיד בתוך כדי דיבור, יצאת. אם נזכרת לאחר מכן, חוזרים לראש העמידה.', ['שכחתי המלך הקדוש', 'אמרתי האל הקדוש', 'המלך הקדוש צריך לחזור', 'טעות בעשרת ימי תשובה'], 'prayer', 'טעויות בתפילה', yalkut('yalkut-yosef-29-20-2', 'סימן תקפב–תרב, סעיף ב'), { tags: ['aseret-yemei-teshuvah', 'rosh-hashanah', 'yom-kippur', 'tefillah'], authority: 'both', relatedQuestionIds: ['qa-yaaleh-veyavo'] }),
  qa('qa-reheat-food-shabbat', 'מותר לחמם אוכל בשבת?', 'תבשיל יבש שהתבשל לגמרי מותר לחמם על פלטה או על גבי קדרה. תבשיל לח שהתקרר אסור לחמם.', ['חימום אוכל בשבת', 'אפשר לחמם אוכל בשבת', 'לחמם אוכל על הפלטה', 'אוכל קר על פלטה'], 'shabbat', 'חימום אוכל בשבת', yalkut('yalkut-yosef-23-109-1', 'סימן שיח, סעיף נז'), { tags: ['shabbat'], conditions: ['יש להבחין בין מאכל יבש לתבשיל לח.', 'אין להניח ישירות על אש גלויה.'], relatedQuestionIds: ['qa-place-food-plata'] }),
  qa('qa-place-food-plata', 'אפשר לשים אוכל על הפלטה בשבת?', 'תבשיל יבש שהתבשל כל צורכו מותר להניח על פלטה בשבת. תבשיל לח שהתקרר אסור להחזיר לחימום.', ['לשים אוכל על הפלטה', 'פלטה בשבת', 'להניח סיר על פלטה', 'אוכל קר על הפלטה'], 'shabbat', 'פלטה', yalkut('yalkut-yosef-23-109-1', 'סימן שיח, סעיף נז'), { tags: ['shabbat'], conditions: ['ההיתר הוא למאכל יבש ומבושל לגמרי.'], relatedQuestionIds: ['qa-reheat-food-shabbat'] }),
  qa('qa-open-fridge-shabbat', 'מותר לפתוח מקרר בשבת?', 'כן, בתנאי שהנורה והפעולות החשמליות הנגרמות מפתיחת הדלת נוטרלו לפני שבת.', ['פתיחת מקרר בשבת', 'מקרר בשבת', 'מותר לפתוח את המקרר', 'נורת מקרר בשבת'], 'tech', 'מקרר ומכשירי מטבח', yalkut('yalkut-yosef-23-182-1', 'מקרר בשבת, סעיף כ'), { tags: ['shabbat'], conditions: ['יש לנטרל מראש את הנורה וכל חיישן שמופעל בפתיחת הדלת.'] }),
  qa('qa-shower-shabbat', 'מותר להתקלח בשבת?', 'אסור לרחוץ את רוב הגוף במים חמים או פושרים בשבת, גם אם הוחמו לפני שבת. מותר לרחוץ במים חמים רק חלק קטן מהגוף, כגון פנים, ידיים ורגליים.', ['מקלחת בשבת', 'רחצה בשבת', 'מים חמים בשבת', 'אפשר להתקלח בשבת'], 'shabbat', 'רחצה', yalkut('yalkut-yosef-23-136-1', 'סימן שכו, סעיף א'), { tags: ['shabbat'], conditions: ['לחולה, לתינוק או לצורך רפואי עשויים להיות דינים אחרים.'] }),
  qa('qa-medicine-shabbat', 'מותר לקחת תרופה בשבת?', 'חולה שנפל למשכב רשאי לקחת תרופה. גם בכאב ראש גדול או כאב בטן חזק יש להקל; במיחוש קל בלבד אין היתר כללי.', ['תרופה בשבת', 'כדור בשבת', 'אקמול בשבת', 'מותר לקחת כדור בשבת'], 'shabbat', 'רפואה בשבת', yalkut('yalkut-yosef-23-140-1', 'סימן שכח, סעיף נב'), { tags: ['shabbat'], conditions: ['בחשש סכנה פועלים מיד לקבלת טיפול רפואי.'], personal: true }),
  qa('qa-woman-kiddush', 'מותר לאישה לעשות קידוש בשבת?', 'כן. אישה חייבת בקידוש ויכולה להוציא גם איש ידי חובה, כאשר שניהם מכוונים לצאת ולשמוע.', ['אישה מקדשת', 'אשה יכולה לעשות קידוש', 'נשים חייבות בקידוש', 'אישה מוציאה בקידוש'], 'women', 'קידוש והבדלה', yalkut('yalkut-yosef-23-29-9', 'סימן רעא, סעיף ט'), { tags: ['shabbat'] }),
  qa('qa-drink-before-prayer', 'מותר לשתות לפני תפילת שחרית?', 'מותר לשתות מים, תה או קפה לפני שחרית. הוספת מעט חלב ראויה בעיקר לאדם חלש, ולאחר ברכות השחר וברכות התורה.', ['שתייה לפני תפילה', 'קפה לפני שחרית', 'מותר לשתות קפה לפני תפילה', 'תה לפני תפילה'], 'prayer', 'אכילה ושתייה לפני תפילה', yalkut('yalkut-yosef-7-5-2', 'סימן פט, סעיף לז'), { tags: ['tefillah'], conditions: ['אין מדובר באכילה או בשתייה לשם פינוק.'] }),
  qa('qa-forgot-omer', 'שכחתי לספור את העומר, מה עושים?', 'אם נזכרת ביום, סופרים בלי ברכה וממשיכים בלילות הבאים בברכה. אם עברו גם הלילה וגם היום, ממשיכים לספור בלי ברכה.', ['שכחתי ספירת העומר', 'לא ספרתי אתמול', 'ספירת העומר בלי ברכה', 'אפשר להמשיך לספור'], 'holidays', 'ספירת העומר', yalkut('yalkut-yosef-25-56-26', 'סימן תפט, סעיף כו'), { tags: ['omer'], conditions: ['הדין תלוי אם נזכרת לפני השקיעה של היום הבא.'] }),
  qa('qa-shabbat-candle-time', 'מתי מדליקים נרות שבת?', 'למנהג הספרדים מדליקים לכתחילה כעשרים דקות לפני השקיעה; במקום צורך אפשר כעשר דקות לפני השקיעה.', ['זמן הדלקת נרות שבת', 'כמה דקות לפני שקיעה מדליקים', 'מתי כניסת שבת', 'הדלקת נרות לפני שקיעה'], 'shabbat', 'הדלקת נרות', yalkut('yalkut-yosef-23-19-3', 'סימן רסג, סעיף מז'), { tags: ['shabbat'] }),
  qa('qa-speaking-after-blessing', 'מותר לדבר אחרי הברכה ולפני האכילה?', 'לא מדברים בין הברכה לטעימה. אם דיברת בעניין שאינו קשור לאכילה, צריך לברך שוב; בדבר הנחוץ לסעודה אין חוזרים ומברכים.', ['דיבור אחרי ברכה', 'דיברתי לפני שטעמתי', 'הפסק בין ברכה לאכילה', 'מותר לדבר אחרי המוציא'], 'blessings', 'הפסק בברכה', yalkut('yalkut-yosef-12-2-7', 'סימן קסז, סעיף ז'), { tags: ['berachot'], conditions: ['לכתחילה אין לדבר גם בעניין הסעודה.'] }),
  qa('qa-borer-shabbat', 'איך מותר לברור אוכל בשבת?', 'מותר לקחת את האוכל מתוך הפסולת, ביד ולא בכלי מיוחד, כדי לאכול מיד. אסור לברור את הפסולת מתוך האוכל.', ['בורר בשבת', 'ברירה בשבת', 'אוכל מתוך פסולת', 'פסולת מתוך אוכל', 'לברור לאלתר'], 'shabbat', 'בורר', yalkut('yalkut-yosef-23-113-1', 'סימן שיט, סעיף א'), { tags: ['shabbat'], conditions: ['נדרשים יחד: אוכל מתוך פסולת, ביד, ולאכילה סמוכה.'] }),
  qa('qa-muktzeh-shabbat', 'מתי מותר לטלטל כלי מוקצה בשבת?', 'כלי שמלאכתו לאיסור מותר לטלטל לצורך שימוש מותר בגופו או כדי לפנות את מקומו, אך לא רק כדי לשמור עליו.', ['מוקצה בשבת', 'כלי שמלאכתו לאיסור', 'מותר להזיז מוקצה', 'טלטול מוקצה'], 'shabbat', 'מוקצה', yalkut('yalkut-yosef-23-83-1', 'סימן שח, סעיף צה'), { tags: ['shabbat'] }),
  qa('qa-kaddish-minyan', 'אפשר לומר קדיש בלי מניין?', 'לא. אומרים קדיש רק במניין של עשרה גברים גדולים.', ['קדיש בלי מניין', 'כמה אנשים צריך לקדיש', 'קדיש עשרה', 'מתי אומרים קדיש'], 'family', 'קדיש ואזכרה', yalkut('yalkut-yosef-66-27-20', 'סימן ל, סעיף כ'), { tags: ['general'] }),
  qa('qa-tefillin-until-when', 'עד מתי אפשר להניח תפילין?', 'לכתחילה מניחים תפילין עד השקיעה.', ['זמן תפילין', 'עד מתי תפילין', 'הנחת תפילין מאוחר', 'אפשר להניח תפילין בערב'], 'prayer', 'תפילין', yalkut('yalkut-yosef-4-6-4', 'סימן ל, סעיף ד'), { tags: ['tefillah'] }),
  ...HALACHA_ENGINE_ENTRIES.map(engineEntry),
  // Stage 5: the learning tracks' entries, produced and verified by the same pipeline (scripts/halacha, HALACHA_STAGE=tracks).
  // They are specific cases; a general question keeps finding its general answer first (halachaSearch: trackTier).
  ...HALACHA_TRACK_ENTRIES.map(entry => ({ ...engineEntry(entry), trackTier: true })),
  ...ONG_SHABBAT_QA.map(ongEntry),
];

export const PRACTICAL_HALACHA_QA_INDEX = Object.fromEntries(PRACTICAL_HALACHA_QA.map(item => [item.id, item]));
export const publishedPracticalQuestions = () => PRACTICAL_HALACHA_QA.filter(item =>
  item.quality === 'verified' && item.reviewStatus === 'verified' && item.answerStatus === 'published'
);
