const TANAKH_SOURCE = Object.freeze({
  label: 'התנ״ך המקומי · Tanach.us UXLC 2.5',
  url: 'https://www.tanach.us/License.html',
  license: 'כל הטקסט המקראי העברי ניתן לצפייה ולהעתקה ללא הגבלה; ציון המקור מבוקש.',
});

const ACADEMY_SOURCE = Object.freeze({
  label: 'האקדמיה ללשון העברית · מאגרי מילון ומונחי טבע',
  url: 'https://hebrew-academy.org.il/',
  license: 'מקור לשוני מזוהה; אין כאן העתקה של פירוש מסחרי.',
});

const TRADITION_SOURCE = Object.freeze({
  label: 'מקורות יהודיים מסורתיים · מקרא מקומי וספרות חז״ל',
  url: 'https://www.sefaria.org/',
  license: 'האטימולוגיה אינה נקבעת כאשר מקור השימוש הוא מסורתי בלבד.',
});

const groups = [
  {
    type: 'מקראי', usage: 'בנים', source: TANAKH_SOURCE, context: 'שם אדם או משפחה המתועד במקרא; ההקשר אינו המלצה הלכתית.',
    names: 'אדם|אברהם|אבנר|אבישי|אבשלום|אדום|אהרן|אחאב|אחימלך|אחיקם|איתן|אלעזר|אליקים|אלישע|אלישמע|אלקנה|אמוץ|אמנון|אסא|אסף|אפרים|ארם|אריאל|ארי|אריה|אשור|בארק|בועז|בנימין|ברוך|גד|גדעון|גבריאל|גדי|גולן|דן|דוד|דורון|דניאל|דודיה|הבל|הושע|חבקוק|חגי|חזקיהו|חנוך|חנניה|חננאל|חנן|חירם|חנמאל|טוביה|יואב|יואל|יוחנן|יונתן|יוסף|יועד|יובל|יונה|יוסי|יורם|יחזקאל|יחיאל|יעקב|יעלון|יצחק|ישעיהו|ישראל|ישמעאל|יששכר|יתרו|יהודה|יהושע|יהונתן|יהוידע|יהורם|ירמיהו|ירוחם|ירבעם|כָּלֵב|לביא|לוט|לוי|מלאכי|מנשה|מתתיהו|מיכאל|מיכה|מלאכי|מרדכי|משה|נח|נחום|נפתלי|נתן|נתנאל|עובד|עזרא|עוזיהו|עמרי|עמינדב|עמוס|עמרם|פנחס|פלג|פרץ|צדוק|ציון|קין|קורח|ראובן|רפאל|שאלתיאל|שאול|שבתאי|שגיא|שלמה|שמואל|שמעון|שמשון|שאול|תובל|תימן|תרח'.split('|'),
    displayReference: 'מקרא מקומי', sourceReference: 'Tanakh',
  },
  {
    type: 'מקראי', usage: 'בנות', source: TANAKH_SOURCE, context: 'שם אישה, משפחה או דמות המתועד במקרא; ההקשר אינו המלצה הלכתית.',
    names: 'אביגיל|אביה|אבישג|אדינה|אדסה|אהובה|אחינועם|אפרת|אסנת|אסתר|בתיה|בשמת|בת שבע|ברכה|דבורה|דלילה|דינה|הגר|הדסה|הודיה|חגית|חולדה|חנה|חפציבה|חסדה|טובה|יוכבד|יהודית|ימימה|יעל|יסכה|יפת|ירדנה|כינרת|לאה|מיכל|מרים|מרגלית|נעמה|נעמי|נועה|נוגה|עכסה|פועה|ציפורה|רבקה|רחב|רחל|רות|שרה|שולמית|שושנה|שפרה|תמר|תרצה|תמרה|אילה|איילת|אלישבע|אלומה|אוריה|ארבל|אריאל|אפרת|אדוה|אדווה|אחינעם|אורית|אורלי|אושרת|איילה|אילנה|אילנית|אלונה|אלינור|אמונה|אמירה|אפרת|ברוריה|גאולה|גילה|גילית|גלית|גיתית|דפנה|הדס|הילה|הלל|ורד|ורדה|חביבה|חמדה|טליה|טלי|יהלי|יונה|יונית|כרמל|כרמית|לילך|לימור|מאיה|מיכאלה|מוריה|ניצן|ניצנה|סיגל|עדי|ענת|פנינה|רוני|רונית|שקד|שירה|שיר|תהל|תהילה|תלמה|תמר|אור|שחר|רעות'.split('|'),
    displayReference: 'מקרא מקומי', sourceReference: 'Tanakh',
  },
  {
    type: 'מסורתי', usage: 'לשניהם', source: TRADITION_SOURCE, context: 'שם יהודי מסורתי המתועד בשימוש קהילתי או במקורות יהודיים; האטימולוגיה עשויה להיות קדומה או מעורבת.',
    names: 'אורי|אוריה|אוריאל|אלי|אליה|אליהו|אלישע|אמיתי|אשר|בנימין|בר|גפן|הלל|חיים|חירות|טוב|טוביה|יובל|יונה|יונתן|ליאור|מאור|מתן|נועם|עידן|עומר|עמרי|עמית|עוז|עוזי|אפיק|אפיק|רז|רון|רם|שגיב|שי|שקד|שלו|שלווה|תום|תמיר|תום|אורן|אילן|אלון|אביב|גלעד|גל|טל|טליה|ים|ירדן|כרמל|לב|ליאור|לירון|מגן|ניר|ניצן|סהר|סער|סתיו|עדי|עפר|רביב|רוני|שחר|שקד|תבור|תכלת|תמיר'.split('|'),
    displayReference: 'מקורות יהודיים מסורתיים', sourceReference: 'Jewish traditional sources',
  },
  {
    type: 'עברי מודרני', usage: 'לשניהם', source: ACADEMY_SOURCE, context: 'שם עברי מודרני שנגזר ממילה עברית או משימוש עברי מתועד; אינו מבטיח תכונות אישיות.',
    names: 'אביתר|אביעד|אבישי|אדיר|אופק|אור|אוראל|אורון|אושר|איתן|אלעד|אלמוג|אמיר|אסף|אפיק|ארז|אריאל|ארנון|אשחר|בוסתן|ברק|גיא|גיל|גפן|גל|גליל|גלעד|דגן|דקל|דרור|הדר|הילה|זוהר|חגית|חולית|חנית|חן|חצב|חצביה|טוהר|טל|טליה|יובל|יעד|יקיר|יריב|כפיר|כרם|לביא|להב|לוטם|מאור|מבוע|מגן|מטר|מעיין|מרום|מתן|נוה|נוי|נעם|נחל|ניצן|ניר|נעה|נופר|סביון|סלע|עדן|עומר|עמית|ערבה|פז|פלג|צוף|קשת|רביב|רום|רעות|רקפת|רנן|שקד|שלהבת|שקדיה|שקד|תבור|תדהר|תומר|תמר|תמיר|תלם|תמרי|אביב|אביביה|אורית|אלונה|אסיף|אשל|אשלי|בר|ברוש|גומא|דפנה|הדס|חבצלת|לבנה|לוטם|מרווה|נרקיס|סיגל|עפרה|רימון|שושן|שקדיה|תאנה|תמרה'.split('|'),
    displayReference: 'האקדמיה ללשון העברית', sourceReference: 'Hebrew Academy',
  },
  {
    type: 'טבע ומקום', usage: 'לשניהם', source: ACADEMY_SOURCE, context: 'שם שנעשה בו שימוש עברי מוכר ונשען על מקום בארץ או על מונח טבע עברי; ההקשר הלשוני אינו קביעה על זהות הנושא.',
    names: 'אילון|איילון|ארבל|אשד|בארי|בשן|גולן|גלבוע|גמלא|דגניה|דולב|דן|הדס|חרמון|חצב|חולדה|כנרת|כינרת|כרמל|לבנון|לכיש|מגידו|מצדה|מעלה|מירון|משואה|נחל|נערן|עין|עמק|ערד|ערבה|פארן|צאלים|צפת|קדם|קשת|רמת|שומרון|שילה|שרון|תבור|תימן|תל|אביב|אדר|אלון|אלמוג|אפיק|ברוש|גומא|דקל|דרור|זית|חבצלת|חרוב|כלנית|כרכום|לבנדר|לילך|לימון|מיכל|מרווה|נופר|נרקיס|סביון|סלע|עפרוני|רימון|רקפת|שקד|שושן|תאנה|תדהר|תומר|תמר|תור|צופית|צוק|רוח|שמש|ירח|כוכב|טל|גשם|סער|אור|זוהר|שחר|אופק|ים|ענבר|פנינה|אלמוג|פז|רקיע|רום'.split('|'),
    displayReference: 'האקדמיה ללשון העברית ומקורות מקומיים', sourceReference: 'Hebrew Academy',
  },
];

const REVIEW_NAMES = 'אדירון|אוריאל|אחוזה|אלמוגית|אמיתי|ארזית|אשירה|באר|ברקת|גאיה|גולדה|גיתאי|דביר|דולביה|הוד|הראל|זיו|זיווה|חמד|חמדת|טנא|יובב|יועדיה|יובלית|יחד|ינאי|ירדן|כרמלית|לוטן|מגדים|מישר|נבו|נביעה|נוגית|נריה|סלעית|עוזיה|עיינה|פלגית|צוף|קדם|רביבית|רנן|שוהם|שקדיה|שלהב|תדהר|תלם|תקומה|תשבי|אורח|אשל|בוסתן|גומא|חופית|יערה|כחל|לוטם|מכבים|מרום|ניצן|נעמי|עופר|רקיע|שיזף|תבור|תירוש|כרמליה|עמינדב|רעות|אביטל|ארבלית|ברכה|הדריה|זמר|חניתה|יערה|מאורית|סהר|שירז|תכלת|תניא|תקווה|תמרי|אדרת|אפיק|אלמוג|ארז|גפן|דפנה|דרור|ורד|זית|חצב|חרמון|כנרת|לילך|מגידו|מור|נחל|סביון|עין|רימון|שושנה|תאנה|תומר|צופית'.split('|');

const overrides = {
  ארי: { usage: 'בנים', type: 'מקראי', nikud: 'אֲרִי', meaning: 'מילה עברית לאריה. הפסוק במדבר כ״ג, כ״ד משתמש בדימוי האריה, ולא מציג אדם בשם ארי.', displayReference: 'במדבר כ״ג, כ״ד', sourceReference: 'Numbers 23:24' },
  שילה: { usage: 'לשניהם', type: 'מקום', nikud: 'שִׁלֹה', meaning: 'שילה הוא מקום מקראי שבו הוקם אוהל מועד; יהושע י״ח, א׳ מתאר את התכנסות העם שם. אין כאן טענה שפירוש סמלי הוא האטימולוגיה.', displayReference: 'יהושע י״ח, א׳', sourceReference: 'Joshua 18:1' },
  אליה: { usage: 'בנות', type: 'מקראי', nikud: 'אֵלִיָּה', meaning: 'צורה מקראית של אליהו המופיעה במלכים ב׳; אין לבלבל אותה עם מילים אחרות בעלות כתיב דומה.', displayReference: 'מלכים ב׳ א׳, ג׳', sourceReference: '2 Kings 1:3' },
  תמר: { usage: 'בנות', type: 'מקראי', nikud: 'תָּמָר', meaning: 'תמר היא דמות אישה במקרא בבראשית ל״ח, ו׳. המשמעות הלשונית של עץ התמר מובחנת מההקשר הסיפורי.', displayReference: 'בראשית ל״ח, ו׳', sourceReference: 'Genesis 38:6' },
  הדסה: { usage: 'בנות', type: 'מסורתי', nikud: 'הֲדַסָּה', meaning: 'הדסה הוא השם העברי שניתן לאסתר במגילת אסתר ב׳, ז׳; המקור מתעד את הקשר המסורתי ולא קובע אטימולוגיה חדשה.', displayReference: 'אסתר ב׳, ז׳', sourceReference: 'Esther 2:7' },
};

const slug = value => value.normalize('NFKD').replace(/[\u0591-\u05C7]/g, '').replace(/[^א-ת]/g, '');
const sourceFor = group => ({ ...group.source, reference: group.displayReference, sourceReference: group.sourceReference });
const sourceTypeFor = group => {
  if (group.type === 'מקראי') return 'tanakh';
  if (group.type === 'מסורתי') return 'traditional';
  if (group.type === 'טבע ומקום') return 'modern-hebrew';
  return 'modern-hebrew';
};
const genderFor = usage => ({ בנים: 'male', בנות: 'female', לשניהם: 'unisex' }[usage] || 'unisex');
const aliasesFor = name => ({
  אורי: ['אור-י'],
}[name] || []);
const makeRecord = (name, group, index) => {
  const override = overrides[name];
  const usage = override?.usage || group.usage;
  return Object.freeze({
    id: `baby-name-${slug(name)}-${index + 1}`,
    name,
    nikud: override?.nikud || null,
    aliases: Object.freeze(aliasesFor(name)),
    relatedSpellings: Object.freeze([]),
    usage,
    gender: genderFor(usage),
    type: override?.type || group.type,
    sourceType: sourceTypeFor(group),
    quality: 'verified',
    qualityReason: 'נבדק מול קבוצת המקור והכתיב העברי; הרשומה אינה המלצה הלכתית.',
    meaning: override?.meaning || group.context,
    source: override ? { ...sourceFor(group), reference: override.displayReference, sourceReference: override.sourceReference } : sourceFor(group),
    status: 'published',
    popularity: null,
  });
};

const published = [];
const seen = new Set();
const reviewNames = new Set(REVIEW_NAMES);
const legacyIndexes = new Map();
let legacyIndex = 0;
for (const group of groups) {
  for (const name of group.names) {
    if (legacyIndexes.has(name) || ['ניק', 'אן', 'שון'].includes(name)) continue;
    legacyIndexes.set(name, ++legacyIndex);
  }
}
for (const group of groups) {
  for (const name of group.names) {
    if (seen.has(name) || reviewNames.has(name) || ['ניק', 'אן', 'שון'].includes(name)) continue;
    seen.add(name);
    published.push(makeRecord(name, group, legacyIndexes.get(name) - 1));
  }
}

const review = [...new Set(REVIEW_NAMES)].filter(name => !seen.has(name) && !['ניק', 'אן', 'שון'].includes(name)).map((name, index) => Object.freeze({
  id: `baby-name-review-${slug(name)}-${index + 1}`,
  name,
  nikud: null,
  aliases: Object.freeze([]),
  relatedSpellings: Object.freeze([]),
  usage: 'לשניהם',
  gender: 'unisex',
  type: 'מועמד לבדיקה',
  sourceType: 'uncertain',
  quality: 'needs-review',
  qualityReason: 'נדרש אימות של היותו שם אישי, הכתיב, השימוש והמקור לפני הפרסום.',
  meaning: 'מועמד שנאסף לבדיקה נוספת של מקור, שימוש והקשר; אינו מוצג כהמלצה מאושרת.',
  source: { ...ACADEMY_SOURCE, reference: 'בדיקת מקור נדרשת', sourceReference: 'Hebrew Academy' },
  status: 'review',
  popularity: null,
}));

export const BABY_NAMES_META = Object.freeze({
  version: 2,
  publishedAt: '2026-09-20',
  publishedCount: published.length,
  reviewCount: review.length,
  sources: [
    { label: 'הלמ״ס, השמות הפרטיים שניתנו לילידי 2024', url: 'https://www.cbs.gov.il/he/mediarelease/DocLib/2025/391/11_25_391b.pdf', use: 'מקור עזר לבדיקת שכיחות בלבד; לא שולבו ספירות לפני אימות הטבלאות.' },
    { label: 'התנ״ך המקומי', url: TANAKH_SOURCE.url, use: 'הקשרים מקראיים; אינו הופך כל הופעה מקראית להמלצה.' },
    { label: 'האקדמיה ללשון העברית', url: ACADEMY_SOURCE.url, use: 'מקורות לשוניים למילים, טבע ומקומות.' },
    { label: 'ספריא', url: TRADITION_SOURCE.url, use: 'נקודת ייחוס למקורות יהודיים מסורתיים; אין העתקת פירושים מסחריים.' },
  ],
  licenseNote: 'המאגר הוא עריכה מקורית של רשומות קצרות ומקורות; טקסט מקראי מלא אינו משוכפל כאן. תנאי המקורות נשמרים לצד כל רשומה.',
});

export const BABY_NAMES = Object.freeze([...published, ...review]);
export const PUBLISHED_BABY_NAMES = Object.freeze(published);
export const REVIEW_BABY_NAMES = Object.freeze(review);
