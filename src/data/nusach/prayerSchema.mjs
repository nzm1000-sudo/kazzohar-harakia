// The canonical prayer schema: which services a Siddur holds, which prayer concepts make up each service, which of
// them are required, and the order the required ones must keep. It is the same for every rite; each rite's
// composition (data/nusach/compositions/*.mjs) maps its own edition onto these concepts, and the QA
// (scripts/siddur-qa.mjs, tests/siddurCompositions.test.mjs) checks the mapping against this file.
//
// `spine`: the required concepts that every rite says in this relative order (the core of the service). A rite may
// add, omit (with a stated source gap) or place other concepts differently — Hodu before or after Baruch She'amar,
// the Song of the Day before or after Aleinu — so only the spine is order-checked.
// `required`: concepts whose absence makes the service PARTIAL (or SOURCE GAP when the licensed edition lacks it).
// Concept titles are the default Hebrew names; a composition may give a rite-specific title.

export const CONCEPTS = Object.freeze({
  'modeh-ani': 'מודה אני',
  'netilat-yadayim': 'נטילת ידיים',
  'morning-blessings': 'ברכות השחר',
  'torah-blessings': 'ברכות התורה',
  tallit: 'עטיפת טלית',
  tefillin: 'הנחת תפילין',
  'morning-prayers': 'תפילות השחר',
  korbanot: 'קרבנות',
  ketoret: 'פטום הקטורת',
  'kaddish-derabanan': 'קדיש דרבנן',
  'mizmor-shir': 'מזמור שיר חנוכת הבית',
  hodu: 'הודו',
  'baruch-sheamar': 'ברוך שאמר',
  'pesukei-dezimra': 'פסוקי דזמרה',
  'az-yashir': 'שירת הים',
  yishtabach: 'ישתבח',
  'half-kaddish': 'חצי קדיש',
  barchu: 'ברכו',
  'shema-blessings': 'ברכות קריאת שמע',
  shema: 'קריאת שמע',
  'after-shema': 'אמת ויציב',
  hashkiveinu: 'השכיבנו',
  amidah: 'תפילת העמידה',
  kedusha: 'קדושה',
  'modim-derabanan': 'מודים דרבנן',
  'birkat-kohanim': 'ברכת כהנים',
  'elokai-netzor': 'אלהי נצור',
  vidui: 'וידוי ושלוש עשרה מידות',
  'avinu-malkeinu': 'אבינו מלכנו',
  tachanun: 'תחנון',
  'torah-reading': 'קריאת התורה',
  ashrei: 'אשרי',
  lamenatzeach: 'למנצח',
  'uva-letzion': 'ובא לציון',
  'kaddish-titkabal': 'קדיש תתקבל',
  'kaddish-yatom': 'קדיש יתום',
  'song-of-day': 'שיר של יום',
  'ledavid-ori': 'לדוד ה׳ אורי',
  'barchi-nafshi': 'ברכי נפשי',
  kaveh: 'קוה אל ה׳',
  'ein-keloheinu': 'אין כאלהינו',
  aleinu: 'עלינו לשבח',
  'closing-passages': 'תפילות לסיום',
  'vehu-rachum': 'והוא רחום',
  'motzaei-shabbat': 'תוספות למוצאי שבת',
  omer: 'ספירת העומר',
  'kiddush-levana': 'קידוש לבנה',
  'bedtime-shema': 'קריאת שמע על המיטה',
  'song-of-songs': 'שיר השירים',
  'kabbalat-shabbat': 'קבלת שבת',
  'lecha-dodi': 'לכה דודי',
  'mizmor-shir-shabbat': 'מזמור שיר ליום השבת',
  'bameh-madlikin': 'במה מדליקין',
  vayechulu: 'ויכולו',
  'magen-avot': 'מגן אבות',
  'shalom-aleichem': 'שלום עליכם',
  'eshet-chayil': 'אשת חיל',
  kiddush: 'קידוש',
  'kiddush-day': 'קידושא רבא',
  zemirot: 'זמירות',
  'torah-service': 'הוצאת ספר תורה',
  'return-torah': 'הכנסת ספר תורה',
  haftarah: 'ברכות ההפטרה',
  'birkat-hachodesh': 'ברכת החודש',
  'av-harachamim': 'אב הרחמים',
  musaf: 'תפילת מוסף',
  'pirkei-avot': 'פרקי אבות',
  'tzidkatcha': 'צדקתך',
  havdalah: 'הבדלה',
  hallel: 'הלל',
  'birkat-hamazon': 'ברכת המזון',
  'festival-amidah': 'עמידה לשלוש רגלים',
});

const S = (id, title, group, spine, required = spine, extra = {}) => ({ id, title, group, spine, required: [...new Set([...spine, ...required])], ...extra });

export const SERVICES = [
  S('weekday-shacharit', 'שחרית לימות החול', 'weekday',
    ['morning-blessings', 'torah-blessings', 'pesukei-dezimra', 'shema-blessings', 'shema', 'amidah', 'tachanun', 'ashrei', 'uva-letzion', 'aleinu'],
    ['tallit', 'tefillin', 'korbanot', 'yishtabach', 'half-kaddish', 'kaddish-titkabal', 'song-of-day', 'torah-reading'],
    { prayerType: 'shacharit' }),
  S('weekday-mincha', 'מנחה לימות החול', 'weekday',
    ['ashrei', 'amidah', 'tachanun', 'aleinu'],
    ['half-kaddish', 'kaddish-titkabal'],
    { prayerType: 'mincha' }),
  S('weekday-maariv', 'ערבית לימות החול', 'weekday',
    ['barchu', 'shema', 'hashkiveinu', 'amidah', 'aleinu'],
    ['shema-blessings', 'half-kaddish', 'kaddish-titkabal'],
    { prayerType: 'maariv' }),
  S('bedtime-shema', 'קריאת שמע על המיטה', 'weekday', ['bedtime-shema'], [], { prayerType: null }),
  S('kabbalat-shabbat', 'קבלת שבת', 'shabbat', ['kabbalat-shabbat', 'lecha-dodi', 'mizmor-shir-shabbat'], [], { prayerType: 'maariv', shabbat: true }),
  S('shabbat-maariv', 'ערבית לליל שבת', 'shabbat', ['barchu', 'shema', 'hashkiveinu', 'amidah', 'aleinu'], ['vayechulu', 'magen-avot', 'kaddish-titkabal'], { prayerType: 'maariv', shabbat: true }),
  S('shabbat-kiddush', 'קידוש לליל שבת', 'shabbat', ['kiddush'], ['shalom-aleichem', 'eshet-chayil'], { prayerType: null, shabbat: true }),
  S('shabbat-shacharit', 'שחרית של שבת', 'shabbat', ['pesukei-dezimra', 'shema-blessings', 'shema', 'amidah', 'torah-reading'], ['yishtabach', 'half-kaddish', 'kaddish-titkabal', 'torah-service', 'return-torah'], { prayerType: 'shacharit', shabbat: true }),
  S('shabbat-musaf', 'מוסף לשבת', 'shabbat', ['musaf', 'aleinu'], ['kaddish-titkabal'], { prayerType: 'mussaf', shabbat: true }),
  S('shabbat-kiddush-day', 'קידושא רבא', 'shabbat', ['kiddush-day'], [], { prayerType: null, shabbat: true }),
  S('shabbat-mincha', 'מנחה לשבת', 'shabbat', ['ashrei', 'uva-letzion', 'amidah', 'aleinu'], ['half-kaddish', 'torah-reading', 'kaddish-titkabal'], { prayerType: 'mincha', shabbat: true }),
  S('havdalah', 'הבדלה', 'shabbat', ['havdalah'], [], { prayerType: null }),
  S('birkat-hamazon', 'ברכת המזון', 'blessings', ['birkat-hamazon'], [], { prayerType: null }),
  S('hallel', 'הלל', 'seasons', ['hallel'], [], { prayerType: 'shacharit' }),
  S('rosh-chodesh-musaf', 'מוסף לראש חודש', 'seasons', ['musaf'], [], { prayerType: 'mussaf' }),
  S('omer', 'ספירת העומר', 'seasons', ['omer'], [], { prayerType: 'maariv' }),
  S('festival-amidah', 'עמידה לשלוש רגלים', 'festivals', ['festival-amidah'], [], { prayerType: null }),
  S('festival-musaf', 'מוסף לשלוש רגלים', 'festivals', ['musaf'], [], { prayerType: 'mussaf' }),
];

export const SERVICE_INDEX = Object.fromEntries(SERVICES.map(service => [service.id, service]));
export const conceptTitle = id => CONCEPTS[id] || id;

// The groups of the Siddur home, in order, with their Hebrew titles.
export const SERVICE_GROUPS = [
  { key: 'weekday', title: 'תפילות החול' },
  { key: 'shabbat', title: 'שבת' },
  { key: 'seasons', title: 'ראש חודש ומועדי השנה' },
  { key: 'festivals', title: 'שלוש רגלים' },
  { key: 'blessings', title: 'ברכות' },
];

// Completeness levels (docs/siddur/siddur-qa.md). Only VERIFIED COMPLETE means complete.
export const COMPLETENESS = Object.freeze({
  VERIFIED: 'VERIFIED COMPLETE',
  CONDITIONS_PENDING: 'TEXT COMPLETE / CONDITIONS PENDING',
  PARTIAL: 'PARTIAL',
  SOURCE_GAP: 'SOURCE GAP',
  UNVERIFIED: 'UNVERIFIED',
});
