// Nusach Edot HaMizrach, composed from Sefaria's "Siddur Edot HaMizrach" (Mordechai Shaliach Tzibur edition, CC0).
// Every section is a slice of that edition — see dsl.mjs for the vocabulary and prayerSchema.mjs for the concepts.
// The edition follows the Ben Ish Chai (its own references "בא"ח …") and prints the Kabbalistic "לשם יחוד" and
// name combinations as part of the text; nothing here changes a word. Review notes: docs/siddur/notes-edot-hamizrach.md.
import { sec, omit, service, leaf } from './dsl.mjs';

const R = leaf('Siddur Edot HaMizrach');
const SH = path => R(`Weekday Shacharit, ${path}`);
const MIN = path => R(`Weekday Mincha, ${path}`);

// ── Weekday Mincha ────────────────────────────────────────────────────────────────────────────────────────────────
// Order of the edition: Ps 84, the Tamid and the Ketoret, Ashrei, half Kaddish, the Amidah, (Avinu Malkeinu in the
// Ten Days), Vidui, the Thirteen Attributes and Nefilat Apayim, Kaddish Titkabal, Ps 67 (Ps 93 on Friday), Kaddish,
// Alenu. On a public fast the Torah is read (ויחל) before the Amidah, from the Shacharit Torah service.
const minchaFastReading = [
  sec('torah-out-tachanun', 'torah-service', 'הוצאת ספר תורה', SH('Torah Reading'), { end: 'אל ארך אפים ומלא רחמים', when: 'fast&tachanun' }),
  sec('torah-out-no-tachanun', 'torah-service', 'הוצאת ספר תורה', SH('Torah Reading'), { start: 'ביום שאין בו תחנון אומרים', end: 'יהי יהוה אלהינו עמנו', when: 'fast&!tachanun' }),
  sec('torah-out', 'torah-service', '', SH('Torah Reading'), { start: 'שמוציאים ספר תורה אומרים', end: 'וזאת התורה אשר שם משה', when: 'fast', continues: true }),
  sec('aliyah-before', 'torah-reading', 'ברכות העולה', SH('Torah Reading'), { start: 'ואומר העולה: השם עמכם', end: 'אשר בחר בנו מכל העמים', when: 'fast' }),
  sec('vayechal', 'torah-reading', 'קריאת התורה — ויחל', R('Fast Days and Mourning, Torah Reading for Fast Days'), { when: 'fast' }),
  sec('aliyah-after', 'torah-reading', 'ברכה אחרונה', SH('Torah Reading'), { start: 'אחר הקריאה מברך העולה', end: 'ברכת הגומל נמצא', when: 'fast' }),
  sec('torah-half-kaddish', 'half-kaddish', 'חצי קדיש', SH('Torah Reading'), { start: 'העולה האחרון אומר חצי קדיש', role: 'minyan', when: 'fast' }),
  omit('uva-letzion-shacharit', SH('Uva LeSion'), { end: 'עושה שלום במרומיו', why: 'ובא לציון וקדיש תתקבל של שחרית — אינם חלק ממנחה; נלקחת מכאן רק החזרת ספר התורה' }),
  sec('return-torah', 'return-torah', 'החזרת ספר תורה', SH('Uva LeSion'), { start: 'ומחזירין את ספר התורה', when: 'fast' }),
];

// The weekday Amidah of Mincha, blessing by blessing.
const minchaAmidah = [
  sec('avot', 'amidah', 'ברכת אבות', MIN('Amida'), { end: 'מגן אברהם' }),
  sec('gevurot', 'amidah', 'גבורות', MIN('Amida'), { start: 'אתה גבור לעולם', end: 'מחיה המתים' }),
  sec('kedusha', 'kedusha', 'קדושה', MIN('Amida'), { start: 'קדושה', end: 'נקדישך ונעריצך', role: 'repetition' }),
  sec('kedushat-hashem', 'amidah', 'קדושת השם', MIN('Amida'), { start: 'אתה קדוש ושמך קדוש' }),
  sec('daat', 'amidah', 'חונן הדעת', MIN('Amida'), { start: 'אתה חונן לאדם דעת' }),
  sec('teshuva', 'amidah', 'תשובה', MIN('Amida'), { start: 'השיבנו אבינו לתורתך' }),
  sec('selicha', 'amidah', 'סליחה', MIN('Amida'), { start: 'סלח לנו אבינו' }),
  sec('geula', 'amidah', 'גאולה', MIN('Amida'), { start: 'ראה נא בענינו' }),
  sec('aneinu-chazzan', 'amidah', 'עננו', MIN('Amida'), { start: 'בתענית ציבור השליח ציבור אומר בחזרה', end: 'העונה לעמו ישראל בעת צרה', role: 'repetition', when: 'fast' }),
  sec('refua', 'amidah', 'רפואה', MIN('Amida'), { start: 'רפאנו יהוה ונרפא' }),
  sec('birkat-hashanim', 'amidah', 'ברכת השנים', MIN('Amida'), { start: 'בקיץ:', end: 'ברך עלינו יהוה אלהינו את השנה' }),
  sec('kibbutz-galuyot', 'amidah', 'קיבוץ גלויות', MIN('Amida'), { start: 'תקע בשופר גדול' }),
  sec('mishpat', 'amidah', 'השבת המשפט', MIN('Amida'), { start: 'השיבה שופטינו' }),
  sec('minim', 'amidah', 'ברכת המינים', MIN('Amida'), { start: 'למינים ולמלשינים' }),
  sec('tzadikim', 'amidah', 'על הצדיקים', MIN('Amida'), { start: 'על הצדיקים ועל החסידים' }),
  sec('yerushalayim', 'amidah', 'בונה ירושלים', MIN('Amida'), { start: 'תשכון בתוך ירושלים' }),
  sec('nachem', 'amidah', 'נחם', MIN('Amida'), { start: 'בתשעה באב אומרים: נחם', end: 'מנחם ציון בבנין ירושלים', when: 'tishaBav' }),
  sec('yerushalayim-end', 'amidah', '', MIN('Amida'), { start: 'ברוך אתה יהוה, בונה ירושלים', when: '!tishaBav', continues: true }),
  sec('malchut-david', 'amidah', 'מלכות בית דוד', MIN('Amida'), { start: 'את צמח דוד עבדך' }),
  sec('shomea-tefila', 'amidah', 'שומע תפילה', MIN('Amida'), { start: 'שמע קולנו' }),
  sec('aneinu', 'amidah', 'עננו', MIN('Amida'), { start: 'בתענית אומר היחיד עננו', when: 'fast' }),
  sec('aneinu-sansan', 'amidah', 'עננו — נוסח סנסן ליאיר', MIN('Amida'), { start: 'נוסח עננו בג\' צומות', role: 'optional', when: 'fast' }),
  sec('shomea-tefila-end', 'amidah', '', MIN('Amida'), { start: 'כי אתה שומע תפלת כל פה', continues: true }),
  sec('retze', 'amidah', 'רצה', MIN('Amida'), { start: 'רצה יהוה אלהינו בעמך' }),
  sec('yaale-veyavo', 'amidah', 'יעלה ויבוא', MIN('Amida'), { start: 'בראש חודש ובחול המועד אומרים', end: 'לרחם בו עלינו ולהושיענו', when: 'roshChodesh|cholHamoed' }),
  sec('retze-end', 'amidah', '', MIN('Amida'), { start: 'ואתה ברחמיך הרבים', continues: true }),
  sec('modim', 'amidah', 'מודים', MIN('Amida'), { start: 'בברכת "מודים" יכרע', end: 'כי מעולם קוינו לך' }),
  sec('modim-derabanan', 'modim-derabanan', 'מודים דרבנן', MIN('Amida'), { start: 'מודים דרבנן', role: 'repetition' }),
  sec('al-hanisim', 'amidah', 'על הנסים', MIN('Amida'), { start: 'בחנוכה ופורים אומרים', end: 'בפורים אומרים בימי מרדכי', when: 'chanukah|purim' }),
  sec('modim-end', 'amidah', '', MIN('Amida'), { start: 'ועל כלם יתברך', continues: true }),
  sec('birkat-kohanim', 'birkat-kohanim', 'ברכת כהנים', MIN('Amida'), { start: 'ברכת כהנים', end: 'ישא יהוה פניו אליך וישם לך שלום ועונים כן יהי רצון', role: 'repetition', when: 'fast' }),
  sec('sim-shalom', 'amidah', 'שים שלום', MIN('Amida'), { start: 'שים שלום טובה וברכה' }),
  // ¶67 prints the closing "יהיו לרצון" and, in small print in the same paragraph, the Chida's optional
  // "תפילת רב" — one paragraph, so it stays inside אלהי נצור (the reader shows the small print as a note).
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', MIN('Amida'), { start: 'יהיו לרצון אמרי פי', end: 'יש אומרים תפילת רב' }),
  sec('kabbalat-taanit', 'amidah', 'קבלת תענית יחיד', MIN('Amida'), { start: 'הרוצה להתענות תענית יחיד', role: 'optional' }),
  sec('taanit-prayer', 'amidah', 'תפילה ביום תענית', MIN('Amida'), { start: 'ביום תענית יאמר', when: 'fast' }),
  sec('oseh-shalom', 'elokai-netzor', 'עושה שלום', MIN('Amida'), { start: 'עשה שלום בעשרת ימי תשובה', end: 'שתבנה בית המקדש' }),
];

const weekdayMincha = service('מנחה לימות החול', [
  sec('leshem-yichud', 'korbanot', 'לשם יחוד', MIN('Offerings'), { end: 'לשם יחוד קדשא' }),
  sec('ps84', 'korbanot', 'מה ידידות', MIN('Offerings'), { start: 'למנצח על הגתית לבני קרח' }),
  sec('tamid', 'korbanot', 'פרשת התמיד', MIN('Offerings'), { start: 'צו את בני ישראל ואמרת אלהם' }),
  sec('ketoret', 'ketoret', 'פטום הקטורת', MIN('Offerings'), { start: 'שהקטירו אבותינו לפניך' }),
  sec('ashrei', 'ashrei', 'אשרי', MIN('Offerings'), { start: 'אשרי יושבי ביתך' }),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', MIN('Offerings'), { start: 'ואומר החזן חצי קדיש', role: 'minyan' }),
  ...minchaFastReading,
  ...minchaAmidah,
  sec('avinu-malkeinu', 'avinu-malkeinu', 'אבינו מלכנו', MIN('Amida'), { start: 'בעשרת ימי תשובה אומרים:', end: 'אל תשיבנו ריקם מלפניך', when: 'aseret' }),
  sec('yehi-shem', 'closing-passages', 'יהי שם', MIN('Amida'), { start: 'בימים שאין בהם תחנון אומרים', when: '!tachanun' }),
  sec('vidui', 'vidui', 'וידוי', MIN('Vidui'), { end: 'ואנחנו הרשענו', when: 'tachanun' }),
  sec('thirteen-middot', 'vidui', 'שלוש עשרה מידות', MIN('Vidui'), { start: 'אל ארך אפים אתה ובעל הרחמים', when: 'tachanun' }),
  sec('nefilat-apayim', 'tachanun', 'נפילת אפים', MIN('Vidui'), { start: 'יאמר בישיבה', when: 'tachanun' }),
  sec('tachanun-end', 'tachanun', 'ה׳ אלהי ישראל', MIN('Vidui'), { start: 'שוב מחרון אפך', when: 'tachanun' }),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', MIN('Vidui'), { start: 'ואומר החזן קדיש תתקבל', role: 'minyan' }),
  sec('lamnatzeach', 'closing-passages', 'למנצח בנגינות', MIN('Vidui'), { start: 'בערב שבת אין אומרים "למנצח"', end: 'אלהים יחננו ויברכנו', when: '!erevShabbat' }),
  sec('hashem-malach', 'closing-passages', 'ה׳ מלך גאות לבש', MIN('Vidui'), { start: 'בערב שבת אומרים מזמור', end: 'מלך גאות לבש', when: 'erevShabbat' }),
  sec('tefila-leani', 'closing-passages', 'תפלה לעני', MIN('Vidui'), { start: 'בתענית ציבור אומרים', end: 'תפלה לעני כי יעטף', when: 'fast' }),
  sec('kaddish-yehe-shlama', 'kaddish-yatom', 'קדיש יהא שלמא', MIN('Vidui'), { start: 'ואומרים קדיש "יהא שלמא"', role: 'mourners' }),
  sec('aleinu', 'aleinu', 'עלינו לשבח', MIN('Alenu')),
], { reviewed: true });

// ── Rosh Chodesh ─────────────────────────────────────────────────────────────────────────────────────────────────
const RC = path => R(`Rosh Hodesh, ${path}`);
const HALLEL = RC('Hallel');

// Hallel as the edition prints it ("הלל לראש חודש ולמועדים"): on a day of the complete Hallel with its blessing and
// all its psalms; on the other days (Rosh Chodesh, the last days of Pesach) "מדלגים" לא לנו and אהבתי, without the
// blessing and without יהללוך (the Sephardi custom the edition states: "בימים שאין גומרים את ההלל …").
const hallelSections = (prefix, when, { withKaddish = true } = {}) => {
  const w = extra => (!when ? extra : extra ? `${when}&${extra}` : when);
  const o = (options, extra) => ({ ...options, ...(w(extra) ? { when: w(extra) } : {}) });
  return [
    sec(`${prefix}hallel-blessing`, 'hallel', 'ברכת ההלל', HALLEL, o({ end: 'וצונו לגמור את ההלל' }, 'fullHallel')),
    sec(`${prefix}hallel`, 'hallel', 'הלל', HALLEL, o({ start: 'הללו עבדי יהוה' })),
    sec(`${prefix}lo-lanu`, 'hallel', '', HALLEL, o({ start: 'בימים שאין גומרים את ההלל מדלגים', end: 'לנו יהוה לא לנו כי לשמך', continues: true }, 'fullHallel')),
    sec(`${prefix}hallel-zecharanu`, 'hallel', '', HALLEL, o({ start: 'יהוה זכרנו יברך', continues: true })),
    sec(`${prefix}ahavti`, 'hallel', '', HALLEL, o({ start: 'בימים שאין גומרים את ההלל מדלגים', end: 'כי ישמע יהוה את קולי', continues: true }, 'fullHallel')),
    sec(`${prefix}hallel-ma-ashiv`, 'hallel', '', HALLEL, o({ start: 'מה אשיב ליהוה', continues: true })),
    sec(`${prefix}yehallelucha`, 'hallel', '', HALLEL, o({ start: 'בימים שאין גומרים את ההלל אין אומרים', end: 'יהללוך יהוה אלהינו', continues: true }, 'fullHallel')),
    ...(withKaddish ? [
      sec(`${prefix}hallel-kaddish`, 'kaddish-titkabal', 'קדיש תתקבל', HALLEL, o({ start: 'ואומר החזן קדיש תתקבל, ובחנוכה', end: 'יתגדל ויתקדש', role: 'minyan' })),
      // "ובחנוכה אומר רק חצי קדיש" — the rest of Kaddish Titkabal is not said on Chanukah.
      sec(`${prefix}hallel-titkabal`, 'kaddish-titkabal', '', HALLEL, o({ start: 'תתקבל צלותנא', end: 'יפסע שלש פסיעות', role: 'minyan', continues: true }, '!chanukah')),
    ] : [
      omit(`${prefix}hallel-kaddish`, HALLEL, { start: 'ואומר החזן קדיש תתקבל, ובחנוכה', end: 'יפסע שלש פסיעות', why: 'הקדיש שאחרי ההלל — בשבת נאמר אחרי ההלל קדיש תתקבל שבעמידת שחרית של שבת (¶79–84)' }),
    ]),
    sec(`${prefix}veavraham-zaken`, 'hallel', 'ואברהם זקן', HALLEL, o({ start: 'יש אומרים פסוק זה אחר ההלל', end: 'ישמרני ויחיני', role: 'optional' })),
  ];
};

// The Musaf of Rosh Chodesh (a weekday), blessing by blessing, with Yehi Shem and Kaddish Titkabal after it.
const rcMusafSections = (prefix, when, firstTitle) => {
  const M = RC('Mussaf');
  const w = extra => (!when ? extra : extra ? `${when}&${extra}` : when);
  const o = (options, extra) => ({ ...options, ...(w(extra) ? { when: w(extra) } : {}) });
  return [
    sec(`${prefix}avot`, 'musaf', firstTitle, M, o({ end: 'מגן אברהם' })),
    sec(`${prefix}gevurot`, 'musaf', 'גבורות', M, o({ start: 'אתה גבור לעולם', end: 'מחיה המתים' })),
    sec(`${prefix}keter`, 'kedusha', 'קדושה — כתר', M, o({ start: 'כתר יתנו לך', role: 'repetition' })),
    sec(`${prefix}kedushat-hashem`, 'musaf', 'קדושת השם', M, o({ start: 'אתה קדוש ושמך קדוש' })),
    sec(`${prefix}kedushat-hayom`, 'musaf', 'ראשי חדשים', M, o({ start: 'ראשי חדשים לעמך נתת', end: 'מקדש ישראל וראשי חדשים' })),
    sec(`${prefix}retze`, 'musaf', 'רצה', M, o({ start: 'רצה יהוה אלהינו בעמך' })),
    sec(`${prefix}modim`, 'musaf', 'מודים', M, o({ start: 'בברכת "מודים" יכרע', end: 'כי מעולם קוינו לך' })),
    sec(`${prefix}modim-derabanan`, 'modim-derabanan', 'מודים דרבנן', M, o({ start: 'מודים דרבנן', role: 'repetition' })),
    sec(`${prefix}al-hanisim`, 'musaf', 'על הנסים', M, o({ start: 'בחנוכה אומרים', end: 'בימי מתתיה בן יוחנן' }, 'chanukah')),
    sec(`${prefix}modim-end`, 'musaf', '', M, o({ start: 'ועל כלם יתברך', continues: true })),
    sec(`${prefix}birkat-kohanim`, 'birkat-kohanim', 'ברכת כהנים', M, o({ start: 'ברכת כהנים', end: 'ושמו את שמי על בני ישראל', role: 'repetition' })),
    sec(`${prefix}sim-shalom`, 'musaf', 'שים שלום', M, o({ start: 'שים שלום טובה וברכה' })),
    sec(`${prefix}elokai-netzor`, 'elokai-netzor', 'אלהי נצור', M, o({ start: 'יהיו לרצון אמרי פי', end: 'שתבנה בית המקדש' })),
    sec(`${prefix}yehi-shem`, 'closing-passages', 'יהי שם', M, o({ start: 'אחרי חזרת הש', end: 'מה אדיר שמך בכל הארץ' })),
    sec(`${prefix}kaddish-titkabal`, 'kaddish-titkabal', 'קדיש תתקבל', M, o({ start: 'ואומר החזן קדיש תתקבל', role: 'minyan' })),
  ];
};

// What follows Musaf on Rosh Chodesh: Barchi Nafshi, Kaddish, Kaveh, Ein Keloheinu, the Ketoret, Kaddish Al Yisrael,
// Barchu and Alenu (the edition's own Rosh Chodesh leaves).
const rcEndingSections = (prefix, when) => {
  const o = options => ({ ...options, ...(when ? { when } : {}) });
  return [
    sec(`${prefix}barchi-nafshi`, 'barchi-nafshi', 'ברכי נפשי', RC('Barchi Nafshi'), o({ end: 'נפשי את יהוה יהוה אלהי גדלת מאד' })),
    sec(`${prefix}kaddish-yehe-shlama`, 'kaddish-yatom', 'קדיש יהא שלמא', RC('Barchi Nafshi'), o({ start: 'ואומרים קדיש יהא שלמא', role: 'mourners' })),
    sec(`${prefix}kaveh`, 'kaveh', 'קוה', RC('Kaveh'), o({ end: 'קוה אל יהוה חזק' })),
    sec(`${prefix}ein-keloheinu`, 'ein-keloheinu', 'אין כאלהינו', RC('Kaveh'), o({ start: 'אין כאלהינו, אין כאדוננו' })),
    sec(`${prefix}ketoret`, 'ketoret', 'פטום הקטורת', RC('Incense Offering'), o({ end: 'תנא דבי אליהו' })),
    sec(`${prefix}kaddish-al-yisrael`, 'kaddish-derabanan', 'קדיש על ישראל', RC('Incense Offering'), o({ start: 'ואומרים קדיש על ישראל', end: 'יהא שלמא רבא', role: 'minyan' })),
    sec(`${prefix}barchu`, 'barchu', 'ברכו', RC('Incense Offering'), o({ start: 'ברכו את יהוה המברך', role: 'minyan' })),
    sec(`${prefix}aleinu`, 'aleinu', 'עלינו לשבח', RC('Alenu'), o({})),
  ];
};

// ── Weekday Shacharit ───────────────────────────────────────────────────────────────────────────────────────────
const PREP = path => R(`Preparatory Prayers, ${path}`);
const shacharitMorning = [
  sec('modeh-ani', 'modeh-ani', 'מודה אני', PREP('Modeh Ani')),
  sec('netilat-yadayim', 'netilat-yadayim', 'נטילת ידיים', PREP('Morning Blessings'), { end: 'וצונו על נטילת ידים' }),
  sec('asher-yatzar', 'morning-blessings', 'אשר יצר', PREP('Morning Blessings'), { start: 'אם הטיל מים או עשה צרכיו', end: 'רופא כל בשר ומפליא לעשות' }),
  sec('elokai-neshama', 'morning-blessings', 'אלהי נשמה', PREP('Morning Blessings'), { start: 'יסמוך ברכה זו', end: 'המחזיר נשמות לפגרים מתים' }),
  sec('birkot-hashachar', 'morning-blessings', 'ברכות השחר', PREP('Morning Blessings'), { start: 'הנותן לשכוי בינה', end: 'המכין מצעדי גבר' }),
  // "בתשעה באב ויום הכיפורים אין אומרים ברכה זו" (the edition, after Ben Ish Chai).
  sec('she-asa-li', 'morning-blessings', '', PREP('Morning Blessings'), { start: 'בתשעה באב ויום הכיפורים אין אומרים', end: 'שעשה לי כל צרכי', when: '!tishaBav', continues: true }),
  sec('birkot-hashachar-end', 'morning-blessings', '', PREP('Morning Blessings'), { start: 'אוזר ישראל בגבורה', end: 'גומל חסדים טובים לעמו ישראל', continues: true }),
  sec('yehi-ratzon', 'morning-blessings', 'יהי רצון שתצילני', PREP('Morning Blessings'), { start: 'שתצילני היום ובכל יום' }),
  sec('torah-blessings', 'torah-blessings', 'ברכות התורה', PREP('Torah Blessings')),
  sec('petichat-eliyahu', 'morning-prayers', 'פתח אליהו', SH('Petichat Eliyahu'), { end: 'יהא רעוא מן קדם עתיקא' }),
  sec('ramit-yadai', 'morning-prayers', 'אמר רבי שמעון', SH('Petichat Eliyahu'), { start: 'אחר פתיחת אליהו זכור לטוב' }),
  sec('tallit', 'tallit', 'עטיפת טלית', SH('Order of Talit')),
  // SA OC 31:2 (Chol HaMoed) and 555:1 (Tisha B'Av morning): no tefillin at Shacharit.
  sec('tefillin', 'tefillin', 'הנחת תפילין', SH('Order of Tefillin'), { when: '!cholHamoed&!tishaBav' }),
  sec('hanna', 'morning-prayers', 'תפלת חנה', SH("Hanna's Prayer")),
  sec('leshem-yichud', 'morning-prayers', 'לשם יחוד', SH('Morning Prayer'), { end: 'להתפלל לפני מלך מלכי המלכים' }),
  sec('akeida', 'morning-prayers', 'פרשת העקידה', SH('Morning Prayer'), { start: 'זכרנו בזכרון טוב מלפניך', end: 'וישב אברהם בבאר שבע' }),
  sec('akeida-vshachat', 'morning-prayers', 'ושחט אתו', SH('Morning Prayer'), { start: 'יש נוהגים לומר את הקטע הבא', end: 'ותאריך ימינו בטוב', role: 'optional' }),
  sec('akeida-ribono', 'morning-prayers', 'רבונו של עולם', SH('Morning Prayer'), { start: 'כמו שכבש אברהם אבינו' }),
  sec('eilu-devarim', 'morning-prayers', 'אלו דברים', SH('Morning Prayer'), { start: 'אלו דברים שאין להם שעור' }),
  sec('leolam-yehe-adam', 'morning-prayers', 'לעולם יהא אדם', SH('Morning Prayer'), { start: 'לעולם יהא אדם ירא שמים', end: 'ומיחדים שמך בכל יום' }),
  sec('shema-first-verse', 'morning-prayers', 'שמע ישראל', SH('Morning Prayer'), { start: 'כשיגיע לקריאת שמע קודם פרשת התמיד', end: 'ואומר בלחש ברוך שם' }),
  sec('ata-hu', 'morning-prayers', 'אתה הוא', SH('Morning Prayer'), { start: 'אתה הוא אחד קודם שבראת', end: 'אתה הוא יהוה האלהים בשמים' }),
  sec('tamid', 'korbanot', 'פרשת התמיד', SH('Morning Prayer'), { start: 'שתרחם עלינו, ותמחול' }),
  sec('ketoret', 'ketoret', 'פטום הקטורת', SH('Incense Offering'), { end: 'תני בר קפרא' }),
  sec('maaracha', 'korbanot', 'סדר המערכה', SH('Incense Offering'), { start: 'הוה מסדר סדר המערכה' }),
  sec('ana-bekoach', 'korbanot', 'אנא בכח', SH('Incense Offering'), { start: 'אנא בכח. גדולת ימינך', end: 'ברוך שם כבוד מלכותו' }),
  sec('ribon-haolamim', 'korbanot', 'רבון העולמים', SH('Incense Offering'), { start: 'אתה צויתנו להקריב קרבן התמיד', end: 'שיהא שיח שפתותינו' }),
  sec('eizehu-mekoman', 'korbanot', 'איזהו מקומן', SH('Incense Offering'), { start: 'איזהו מקומן של זבחים', end: 'הבכור והמעשר והפסח' }),
  sec('rabbi-yishmael', 'korbanot', 'רבי ישמעאל אומר', SH('Incense Offering'), { start: 'רבי ישמעאל אומר: בשלש עשרה מדות', end: 'שתבנה בית המקדש' }),
  sec('kaddish-al-yisrael', 'kaddish-derabanan', 'קדיש על ישראל', SH('Incense Offering'), { start: 'ואומרים כאן קדיש "על ישראל"', role: 'minyan' }),
  sec('hodu', 'hodu', 'הודו', SH('Hodu'), { end: 'אל נקמות יהוה אל נקמות הופיע' }),
  sec('mizmor-shir', 'mizmor-shir', 'מזמור שיר חנוכת הבית', SH('Hodu'), { start: 'ארוממך יהוה כי דליתני' }),
  sec('hashem-hu-haelokim', 'hodu', 'ה׳ הוא האלהים', SH('Hodu'), { start: 'בעשרת ימי תשובה והושענא רבה', end: 'יהוה הוא האלהים יהוה הוא האלהים', when: 'aseret|hoshanaRabbah' }),
  sec('hashem-melech', 'hodu', 'ה׳ מלך', SH('Hodu'), { start: 'עומדים ואומרים', end: 'בשבת ממשיכים מזמור השמים מספרים' }),
  sec('lamnatzeach-menorah', 'hodu', 'למנצח בנגינות — המנורה', SH('Hodu'), { start: 'טוב לומר מזמור אלהים יחננו' }),
  sec('baruch-sheamar', 'baruch-sheamar', 'ברוך שאמר', SH("Pesukei D'Zimra"), { end: 'כיון שהתחיל לומר ברוך שאמר' }),
  sec('mizmor-letoda', 'pesukei-dezimra', 'מזמור לתודה', SH("Pesukei D'Zimra"), { start: 'לתודה הריעו ליהוה' }),
  sec('yehi-chevod', 'pesukei-dezimra', 'יהי כבוד', SH("Pesukei D'Zimra"), { start: 'שמונה עשרה פסוקים של יהי כבוד' }),
  sec('tehila-ledavid', 'pesukei-dezimra', 'אשרי — תהלה לדוד', SH("Pesukei D'Zimra"), { start: 'אשרי יושבי ביתך' }),
  sec('hallelukah', 'pesukei-dezimra', 'הללויה', SH("Pesukei D'Zimra"), { start: 'הללי נפשי את יהוה' }),
  sec('baruch-hashem-leolam', 'pesukei-dezimra', 'ברוך ה׳ לעולם', SH("Pesukei D'Zimra"), { start: 'ברוך יהוה לעולם אמן ואמן' }),
  sec('vayevarech-david', 'pesukei-dezimra', 'ויברך דויד', SH("Pesukei D'Zimra"), { start: 'יאמר מעומד', end: 'ויברך דויד את יהוה' }),
  sec('az-yashir', 'az-yashir', 'שירת הים', SH("Pesukei D'Zimra"), { start: 'ביום ההוא את ישראל מיד מצרים', end: 'כי ליהוה המלוכה ומשל בגוים' }),
  sec('yishtabach', 'yishtabach', 'ישתבח', SH("Pesukei D'Zimra"), { start: 'ישתבח שמך לעד מלכנו' }),
  sec('shir-hamaalot-aseret', 'pesukei-dezimra', 'שיר המעלות ממעמקים', SH("Pesukei D'Zimra"), { start: 'בעשרת ימי תשובה מוסיפים', end: 'ממעמקים קראתיך', when: 'aseret' }),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', SH("Pesukei D'Zimra"), { start: 'ואומר החזן חצי קדיש', end: 'יתגדל ויתקדש', role: 'minyan' }),
  sec('barchu', 'barchu', 'ברכו', SH("Pesukei D'Zimra"), { start: 'ואומר החזן: ברכו', role: 'minyan' }),
  sec('yotzer', 'shema-blessings', 'יוצר אור', SH('The Shema'), { end: 'יוצר המאורות' }),
  sec('ahavat-olam', 'shema-blessings', 'אהבת עולם', SH('The Shema'), { start: 'אהבת עולם אהבתנו', end: 'הבוחר בעמו ישראל באהבה' }),
  sec('shema', 'shema', 'קריאת שמע', SH('The Shema'), { start: 'קודם שיקרא קריאת שמע יכוין', end: 'וחוזר החזן: יהוה אלהיכם אמת' }),
  sec('emet-veyatziv', 'after-shema', 'אמת ויציב', SH('The Shema'), { start: 'ונכון, וקים, וישר' }),
];

const SA = path => SH(`Amida, ${path}`);
const shacharitAmidah = [
  sec('avot', 'amidah', 'ברכת אבות', SH('Amida'), { end: 'מגן אברהם' }),
  sec('gevurot', 'amidah', 'גבורות', SH('Amida'), { start: 'אתה גבור לעולם', end: 'מחיה המתים' }),
  sec('kedusha', 'kedusha', 'קדושה', SH('Amida'), { start: 'קדושה', end: 'נקדישך ונעריצך', role: 'repetition' }),
  sec('kedushat-hashem', 'amidah', 'קדושת השם', SH('Amida'), { start: 'אתה קדוש ושמך קדוש' }),
  sec('daat', 'amidah', 'חונן הדעת', SH('Amida'), { start: 'אתה חונן לאדם דעת' }),
  sec('teshuva', 'amidah', 'תשובה', SH('Amida'), { start: 'השיבנו אבינו לתורתך' }),
  sec('selicha', 'amidah', 'סליחה', SH('Amida'), { start: 'סלח לנו אבינו' }),
  sec('geula', 'amidah', 'גאולה', SH('Amida'), { start: 'ראה נא בענינו' }),
  sec('aneinu-chazzan', 'amidah', 'עננו', SH('Amida'), { start: 'בתענית ציבור השליח ציבור אומר בחזרה', end: 'העונה לעמו ישראל בעת צרה', role: 'repetition', when: 'fast' }),
  sec('refua', 'amidah', 'רפואה', SH('Amida'), { start: 'רפאנו יהוה ונרפא' }),
  sec('birkat-hashanim', 'amidah', 'ברכת השנים', SH('Amida'), { start: 'בקיץ:', end: 'ברך עלינו יהוה אלהינו את השנה' }),
  sec('kibbutz-galuyot', 'amidah', 'קיבוץ גלויות', SH('Amida'), { start: 'תקע בשופר גדול' }),
  sec('mishpat', 'amidah', 'השבת המשפט', SH('Amida'), { start: 'השיבה שופטינו' }),
  sec('minim', 'amidah', 'ברכת המינים', SH('Amida'), { start: 'למינים ולמלשינים' }),
  sec('tzadikim', 'amidah', 'על הצדיקים', SH('Amida'), { start: 'על הצדיקים ועל החסידים' }),
  sec('yerushalayim', 'amidah', 'בונה ירושלים', SH('Amida'), { start: 'תשכון בתוך ירושלים' }),
  sec('malchut-david', 'amidah', 'מלכות בית דוד', SH('Amida'), { start: 'את צמח דוד עבדך' }),
  sec('shomea-tefila', 'amidah', 'שומע תפילה', SH('Amida'), { start: 'שמע קולנו' }),
  sec('aneinu', 'amidah', 'עננו', SH('Amida'), { start: 'בתענית אומר היחיד עננו', when: 'fast' }),
  sec('aneinu-sansan', 'amidah', 'עננו — נוסח סנסן ליאיר', SH('Amida'), { start: 'נוסח עננו בג\' צומות', role: 'optional', when: 'fast' }),
  sec('shomea-tefila-end', 'amidah', '', SH('Amida'), { start: 'כי אתה שומע תפלת כל פה', continues: true }),
  sec('retze', 'amidah', 'רצה', SH('Amida'), { start: 'רצה יהוה אלהינו בעמך' }),
  sec('yaale-veyavo', 'amidah', 'יעלה ויבוא', SH('Amida'), { start: 'בראש חודש ובחול המועד אומרים', end: 'לרחם בו עלינו ולהושיענו', when: 'roshChodesh|cholHamoed' }),
  sec('retze-end', 'amidah', '', SH('Amida'), { start: 'ואתה ברחמיך הרבים', continues: true }),
  sec('modim', 'amidah', 'מודים', SH('Amida'), { start: 'בברכת "מודים" יכרע', end: 'כי מעולם קוינו לך' }),
  sec('modim-derabanan', 'modim-derabanan', 'מודים דרבנן', SH('Amida'), { start: 'מודים דרבנן', end: 'ברוך אל ההודאות', role: 'repetition' }),
  sec('al-hanisim', 'amidah', 'על הנסים', SH('Amida'), { start: 'בחנוכה ופורים אומרים', end: 'בפורים אומרים בימי מרדכי', when: 'chanukah|purim' }),
  sec('modim-end', 'amidah', '', SH('Amida'), { start: 'ועל כלם יתברך', continues: true }),
  sec('birkat-kohanim', 'birkat-kohanim', 'ברכת כהנים', SH('Amida'), { start: 'ברכת כהנים', end: 'השקיפה ממעון קדשך', role: 'repetition' }),
  sec('sim-shalom', 'amidah', 'שים שלום', SH('Amida'), { start: 'שים שלום טובה וברכה' }),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', SH('Amida'), { start: 'יהיו לרצון אמרי פי', end: 'יש אומרים תפילת רב' }),
  sec('oseh-shalom', 'elokai-netzor', 'עושה שלום', SH('Amida'), { start: 'עשה שלום בעשרת ימי תשובה', end: 'בראש חודש אומרים כאן הלל' }),
];

const TORAH = SH('Torah Reading');
const weekdayTorah = 'torahReading&!roshChodesh';
const shacharitAfterAmidah = [
  ...hallelSections('', 'hallel'),
  sec('avinu-malkeinu', 'avinu-malkeinu', 'אבינו מלכנו', SH('Amida'), { start: 'בעשרת ימי תשובה אומרים:', end: 'אל תשיבנו ריקם מלפניך', when: 'aseret' }),
  sec('yehi-shem', 'closing-passages', 'יהי שם', SH('Amida'), { start: 'בימים שאין בהם תחנון אומרים', when: '!tachanun&!hallel' }),
  sec('vidui', 'vidui', 'וידוי', SH('Vidui'), { end: 'ואנחנו הרשענו', when: 'tachanun' }),
  sec('thirteen-middot', 'vidui', 'שלוש עשרה מידות', SH('Vidui'), { start: 'אל ארך אפים אתה ובעל הרחמים', when: 'tachanun' }),
  sec('nefilat-apayim', 'tachanun', 'נפילת אפים', SH('Vidui'), { start: 'ישב ויאמר', when: 'tachanun' }),
  sec('tachanun-end', 'tachanun', 'ה׳ אלהי ישראל', SH('Vidui'), { start: 'שוב מחרון אפך', end: 'בתעניות ציבור אומרים כאן תחנונים נוספים', when: 'tachanun' }),
  // "בתעניות ציבור אומרים כאן תחנונים נוספים שנמצאים ב'תעניות ואבילות'" — each fast's own Selichot.
  sec('selichot-gedalia', 'tachanun', 'סליחות לצום גדליה', R('Fast Days and Mourning, Fast of Gedalya'), { when: 'tzomGedaliah' }),
  sec('selichot-tevet', 'tachanun', 'סליחות לעשרה בטבת', R('Fast Days and Mourning, Tenth of Tevet'), { when: 'asaraBetevet' }),
  sec('selichot-esther', 'tachanun', 'סליחות לתענית אסתר', R('Fast Days and Mourning, Fast of Esther'), { when: 'taanitEsther' }),
  sec('selichot-tammuz', 'tachanun', 'סליחות לשבעה עשר בתמוז', R('Fast Days and Mourning, Seventeenth of Tammuz'), { when: 'shivaAsarBetammuz' }),
  // "בימים שני וחמישי אין אומרים את הקדיש הזה וממשיכים באל מלך"; on a Hallel day Kaddish Titkabal follows Hallel.
  sec('half-kaddish-tachanun', 'half-kaddish', 'חצי קדיש', SH('Vidui'), { start: 'בימים שני וחמישי אין אומרים את הקדיש הזה', end: 'יתגדל ויתקדש', role: 'minyan', when: '!hallel&!mondayThursday|!hallel&!tachanun|!hallel&fast' }),
  sec('monday-thursday', 'tachanun', 'תחנונים לשני וחמישי', SH('Vidui'), { start: 'בימי שני וחמישי מוסיפים', end: 'הפותח יד בתשובה', when: 'mondayThursday&tachanun&!fast' }),
  sec('half-kaddish-monday-thursday', 'half-kaddish', 'חצי קדיש', SH('Vidui'), { start: 'יתגדל ויתקדש', role: 'minyan', when: 'mondayThursday&tachanun&!fast' }),
  sec('torah-out-tachanun', 'torah-service', 'הוצאת ספר תורה', TORAH, { end: 'אל ארך אפים ומלא רחמים', when: `${weekdayTorah}&tachanun` }),
  sec('torah-out-no-tachanun', 'torah-service', 'הוצאת ספר תורה', TORAH, { start: 'ביום שאין בו תחנון אומרים', end: 'יהי יהוה אלהינו עמנו', when: `${weekdayTorah}&!tachanun` }),
  sec('torah-out', 'torah-service', '', TORAH, { start: 'שמוציאים ספר תורה אומרים', end: 'וזאת התורה אשר שם משה', when: weekdayTorah, continues: true }),
  sec('rc-torah-out', 'torah-service', 'הוצאת ספר תורה', HALLEL, { start: 'קודם הוצאת ספר תורה אומרים', end: 'מוציאים ספר תורה וקוראים ד\' עולים', when: 'roshChodesh' }),
  sec('aliyah-before', 'torah-reading', 'ברכות העולה', TORAH, { start: 'ואומר העולה: השם עמכם', end: 'אשר בחר בנו מכל העמים', when: 'torahReading' }),
  sec('vayechal', 'torah-reading', 'קריאת התורה — ויחל', R('Fast Days and Mourning, Torah Reading for Fast Days'), { when: 'fast&!tishaBav' }),
  sec('rc-reading', 'torah-reading', 'קריאת התורה לראש חודש', HALLEL, { start: 'צו את בני ישראל ואמרת אלהם את קרבני', when: 'roshChodesh' }),
  sec('aliyah-after', 'torah-reading', 'ברכה אחרונה', TORAH, { start: 'אחר הקריאה מברך העולה', end: 'ברכת הגומל נמצא', when: 'torahReading' }),
  sec('torah-half-kaddish', 'half-kaddish', 'חצי קדיש', TORAH, { start: 'העולה האחרון אומר חצי קדיש', role: 'minyan', when: weekdayTorah }),
  sec('rc-half-kaddish', 'half-kaddish', 'חצי קדיש', HALLEL, { start: 'בסיום הקריאה אומר המשלים חצי קדיש', end: 'יתגדל ויתקדש', role: 'minyan', when: 'roshChodesh' }),
  sec('rc-ashrei', 'ashrei', 'אשרי', HALLEL, { start: 'יהי חסדך יהוה עלינו', when: 'roshChodesh' }),
  sec('ashrei', 'ashrei', 'אשרי', SH('Ashrei'), { end: 'תהלה לדוד', when: '!roshChodesh' }),
  sec('lamnatzeach', 'lamenatzeach', 'למנצח', SH('Ashrei'), { start: 'ביום שאין אומרים בו תחנון מדלגים', when: 'tachanun' }),
  // Days without Rosh Chodesh.
  sec('uva-letzion', 'uva-letzion', 'ובא לציון', SH('Uva LeSion'), { end: 'ברוך אלהינו שבראנו', when: '!roshChodesh' }),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', SH('Uva LeSion'), { start: 'ואומר החזן קדיש תתקבל', end: 'יפסע שלש פסיעות', role: 'minyan', when: '!roshChodesh' }),
  sec('return-torah', 'return-torah', 'החזרת ספר תורה', SH('Uva LeSion'), { start: 'ומחזירין את ספר התורה', when: weekdayTorah }),
  sec('tefila-ledavid', 'closing-passages', 'תפלה לדוד', SH('Beit Yaakov'), { end: 'הטה יהוה אזנך ענני', when: 'tachanun' }),
  sec('beit-yaakov', 'closing-passages', 'בית יעקב', SH('Beit Yaakov'), { start: 'בית יעקב לכו ונלכה', when: '!roshChodesh' }),
  sec('song-of-day', 'song-of-day', 'שיר של יום', SH('Song of the Day'), { end: 'בכל יום אומר המזמור', when: '!roshChodesh' }),
  sec('song-day0', 'song-of-day', 'ליום ראשון', SH('Song of the Day'), { start: 'מזמור ליום ראשון', end: 'מזמור ליהוה הארץ ומלואה', when: 'day0&!roshChodesh' }),
  sec('song-day1', 'song-of-day', 'ליום שני', SH('Song of the Day'), { start: 'מזמור ליום שני', end: 'גדול יהוה ומהלל מאד', when: 'day1&!roshChodesh' }),
  sec('song-day2', 'song-of-day', 'ליום שלישי', SH('Song of the Day'), { start: 'מזמור ליום שלישי', end: 'אלהים נצב בעדת אל', when: 'day2&!roshChodesh' }),
  sec('song-day3', 'song-of-day', 'ליום רביעי', SH('Song of the Day'), { start: 'מזמור ליום רביעי', end: 'יהוה אל נקמות הופיע', when: 'day3&!roshChodesh' }),
  sec('song-day4', 'song-of-day', 'ליום חמישי', SH('Song of the Day'), { start: 'מזמור ליום חמישי', end: 'הרנינו לאלהים עוזנו', when: 'day4&!roshChodesh' }),
  sec('song-day5', 'song-of-day', 'ליום שישי', SH('Song of the Day'), { start: 'מזמור ליום ששי', end: 'מלך גאות לבש', when: 'day5&!roshChodesh' }),
  sec('song-gedalia-tevet', 'song-of-day', 'לצום גדליה ולעשרה בטבת', SH('Song of the Day'), { start: 'בצום גדליה ובעשרה בטבת', end: 'אלהים אל דמי לך', when: 'tzomGedaliah|asaraBetevet' }),
  // "למחרת יום הכיפורים" — the app has no condition key for 11 Tishrei yet (see the notes): hidden in prayer mode.
  sec('song-after-yom-kippur', 'song-of-day', 'למחרת יום הכיפורים', SH('Song of the Day'), { start: 'למחרת יום הכיפורים אומרים', end: 'רצית יהוה ארצך', when: 'afterYomKippur' }),
  sec('song-chanukah', 'song-of-day', 'לחנוכה', SH('Song of the Day'), { start: 'בחנוכה אומרים', end: 'שיר חנכת הבית', when: 'chanukah&!roshChodesh' }),
  sec('song-esther-purim', 'song-of-day', 'לתענית אסתר ולפורים', SH('Song of the Day'), { start: 'בתענית אסתר ובפורים אומרים', end: 'על אילת השחר', when: 'taanitEsther|purim' }),
  sec('song-tammuz', 'song-of-day', 'לשבעה עשר בתמוז', SH('Song of the Day'), { start: 'בשבעה עשר בתמוז אומרים', end: 'אלהים באו גוים', when: 'shivaAsarBetammuz' }),
  // "בבית האבל אומרים" — no condition key for a house of mourning (see the notes): hidden in prayer mode.
  sec('song-mourners', 'song-of-day', 'בבית האבל', SH('Song of the Day'), { start: 'בבית האבל אומרים', end: 'שמעו זאת כל העמים', when: 'houseOfMourning' }),
  sec('song-teshuat-tzadikim', 'song-of-day', 'ותשועת צדיקים', SH('Song of the Day'), { start: 'ויש שמוסיפים ותשועת צדיקים', role: 'optional', when: '!roshChodesh' }),
  sec('song-kaddish', 'kaddish-yatom', 'קדיש יהא שלמא', SH('Song of the Day'), { start: 'ואומרים קדיש "יהא שלמא"', role: 'mourners', when: '!roshChodesh' }),
  sec('kaveh', 'kaveh', 'קוה', SH('Kaveh'), { end: 'קוה אל יהוה חזק', when: '!roshChodesh' }),
  sec('ein-keloheinu', 'ein-keloheinu', 'אין כאלהינו', SH('Kaveh'), { start: 'אין כאלהינו, אין כאדוננו', when: '!roshChodesh' }),
  sec('ketoret-end', 'ketoret', 'פטום הקטורת', SH('Kaveh'), { start: 'פטום הקטורת', end: 'תנא דבי אליהו', when: '!roshChodesh' }),
  sec('kaddish-al-yisrael-end', 'kaddish-derabanan', 'קדיש על ישראל', SH('Kaveh'), { start: 'ואומרים קדיש "על ישראל"', end: 'יהא שלמא רבא', role: 'minyan', when: '!roshChodesh' }),
  sec('barchu-end', 'barchu', 'ברכו', SH('Kaveh'), { start: 'ברכו את יהוה המברך', role: 'minyan', when: '!roshChodesh' }),
  sec('aleinu', 'aleinu', 'עלינו לשבח', SH('Alenu'), { end: 'ובתורתך יהוה אלהינו כתוב', when: '!roshChodesh' }),
  sec('vayomer-im-shamoa', 'closing-passages', 'ויאמר אם שמוע', SH('Alenu'), { start: 'ויאמר אם שמוע תשמע', when: '!roshChodesh' }),
  // Rosh Chodesh (a weekday): the edition's own order from Uva LeSion to Alenu, with Musaf.
  sec('rc-uva-letzion', 'uva-letzion', 'ובא לציון', RC('Uva LeSion'), { end: 'ברוך אלהינו שבראנו', when: 'roshChodesh' }),
  sec('rc-beit-yaakov', 'closing-passages', 'בית יעקב', RC('Uva LeSion'), { start: 'בית יעקב לכו ונלכה', when: 'roshChodesh' }),
  sec('rc-song-day0', 'song-of-day', 'שיר של יום — ליום ראשון', RC('Song of the Day'), { end: 'מזמור ליהוה הארץ ומלואה', when: 'roshChodesh&day0' }),
  sec('rc-song-day1', 'song-of-day', 'שיר של יום — ליום שני', RC('Song of the Day'), { start: 'מזמור ליום שני', end: 'גדול יהוה ומהלל מאד', when: 'roshChodesh&day1' }),
  sec('rc-song-day2', 'song-of-day', 'שיר של יום — ליום שלישי', RC('Song of the Day'), { start: 'מזמור ליום שלישי', end: 'אלהים נצב בעדת אל', when: 'roshChodesh&day2' }),
  sec('rc-song-day3', 'song-of-day', 'שיר של יום — ליום רביעי', RC('Song of the Day'), { start: 'מזמור ליום רביעי', end: 'יהוה אל נקמות הופיע', when: 'roshChodesh&day3' }),
  sec('rc-song-day4', 'song-of-day', 'שיר של יום — ליום חמישי', RC('Song of the Day'), { start: 'מזמור ליום חמישי', end: 'הרנינו לאלהים עוזנו', when: 'roshChodesh&day4' }),
  sec('rc-song-day5', 'song-of-day', 'שיר של יום — ליום שישי', RC('Song of the Day'), { start: 'מזמור ליום ששי', end: 'מלך גאות לבש', when: 'roshChodesh&day5' }),
  sec('rc-song-chanukah', 'song-of-day', 'מזמור שיר חנוכת הבית', RC('Song of the Day'), { start: 'בחנוכה אומרים מזמור', when: 'roshChodesh&chanukah' }),
  sec('rc-return-torah', 'return-torah', 'החזרת ספר תורה', RC('Song of the Day'), { start: 'מחזירים ספר התורה למקומו ואומרים', end: 'יהללו את שם יהוה', when: 'roshChodesh' }),
  sec('rc-leshem-yichud', 'musaf', 'לשם יחוד', RC('Song of the Day'), { start: 'לשם יחוד קדשא בריך הוא', when: 'roshChodesh' }),
  sec('rc-musaf-half-kaddish', 'half-kaddish', 'חצי קדיש', RC('Song of the Day'), { start: 'אומר החזן חצי קדיש וחולצין תפילין', role: 'minyan', when: 'roshChodesh' }),
  ...rcMusafSections('rc-musaf-', 'roshChodesh', 'מוסף לראש חודש — ברכת אבות'),
  ...rcEndingSections('rc-', 'roshChodesh'),
  sec('ledavid', 'ledavid-ori', 'לדוד ה׳ אורי', SH('Alenu'), { start: 'יהוה אורי וישעי', when: 'ledavid' }),
  // The edition's additions after the prayer.
  sec('ikkarim', 'closing-passages', 'שלשה עשר עיקרים', R('Additions for Shacharit, Thirteen Principles of Faith')),
  sec('zechirot', 'closing-passages', 'עשר זכירות', R('Additions for Shacharit, Ten Remembrances'), { end: 'הרי אני מקים מצות עשר זכירות' }),
  sec('zechirot-chida', 'closing-passages', 'עשר זכירות — נוסח החיד"א', R('Additions for Shacharit, Ten Remembrances'), { start: 'יש אומרים נוסח ערוכה שכתב החיד"א', role: 'optional' }),
  sec('leaving', 'closing-passages', 'ביציאה מבית הכנסת', R('Additions for Shacharit, Ten Remembrances'), { start: 'כשיוצא מבית הכנסת' }),
];

const weekdayShacharit = service('שחרית לימות החול', [...shacharitMorning, ...shacharitAmidah, ...shacharitAfterAmidah], {
  reviewed: true,
  conditionsPending: [
    'חול המועד: מוסף לחול המועד, נטילת לולב והושענות אינם בסדר זה (הסידור החכם — dayServicePlan — מרכיב אותם)',
    'חנוכה: קריאת התורה של היום (״חנוכה, שחרית״) דורשת מפתח ליום החנוכה (chanukahDay); בר״ח טבת — שני ספרים',
    'פורים: קריאת המגילה נאמרת באמצע ״ובא לציון״ (¶1 כולל גם ״ואתה קדוש״) — לא ניתן לחתוך בתוך פסקה',
    'שיר של יום ״למחרת יום הכיפורים״ ו״בבית האבל״ — אין עדיין מפתחות afterYomKippur / houseOfMourning (מוסתרים במצב תפילה)',
  ],
});

// ── Counting of the Omer ───────────────────────────────────────────────────────────────────────────────────────────
// The edition prints all 49 days in one table (date, count, the day's Sefira and letters of אנא בכח / למנצח). The app
// has no key for the day of the Omer yet, so the whole table is one section (see conditionsPending and the notes).
const OMER = R('Counting of the Omer');
const omerSections = (prefix, when) => {
  const o = options => ({ ...options, ...(when ? { when } : {}) });
  return [
    sec(`${prefix}omer-leshem-yichud`, 'omer', 'ספירת העומר — לשם יחוד', OMER, o({ end: 'לשם יחוד קדשא בריך הוא' })),
    sec(`${prefix}omer-blessing`, 'omer', 'ברכת הספירה', OMER, o({ start: 'ברשות מורי ורבותי', end: 'וצונו על ספירת העמר' })),
    sec(`${prefix}omer-count`, 'omer', 'מניין הימים', OMER, o({ start: 'ט"ז ניסן', end: 'שק"ו צי"ת מלכות שבמלכות' })),
    sec(`${prefix}omer-harachaman`, 'omer', 'הרחמן', OMER, o({ start: 'הרחמן הוא יחזיר עבודת בית המקדש' })),
    sec(`${prefix}omer-lamnatzeach`, 'omer', 'למנצח בנגינות', OMER, o({ start: 'בנגינת מזמור שיר אלהים יחננו' })),
    sec(`${prefix}omer-ana-bekoach`, 'omer', 'אנא בכח', OMER, o({ start: 'אנא בכח. גדולת ימינך' })),
  ];
};

// ── Weekday Arvit ───────────────────────────────────────────────────────────────────────────────────────────────────
const AR = path => R(`Weekday Arvit, ${path}`);
const weekdayMaariv = service('ערבית לימות החול', [
  sec('barchi-nafshi', 'barchi-nafshi', 'ברכי נפשי', AR('Barchu'), { end: 'נפשי את יהוה יהוה אלהי גדלת מאד', role: 'optional', when: 'roshChodesh' }),
  sec('leshem-yichud', 'vehu-rachum', 'לשם יחוד — ה׳ צבאות עמנו', AR('Barchu'), { start: 'לשם יחוד קדשא בריך הוא', end: 'יהוה צבאות עמנו משגב לנו' }),
  sec('half-kaddish-before', 'half-kaddish', 'חצי קדיש', AR('Barchu'), { start: 'ואומר החזן חצי קדיש', end: 'יתגדל ויתקדש', role: 'minyan' }),
  sec('vehu-rachum', 'vehu-rachum', 'והוא רחום', AR('Barchu'), { start: 'והוא רחום יכפר עון' }),
  sec('barchu', 'barchu', 'ברכו', AR('Barchu'), { start: 'ואומר החזן: ברכו', role: 'minyan' }),
  sec('maariv-aravim', 'shema-blessings', 'המעריב ערבים', AR('The Shema'), { end: 'המעריב ערבים' }),
  sec('ahavat-olam', 'shema-blessings', 'אהבת עולם', AR('The Shema'), { start: 'אהבת עולם בית ישראל' }),
  sec('shema', 'shema', 'קריאת שמע', AR('The Shema'), { start: 'קודם שיקרא קריאת שמע יכוין', end: 'וחוזר החזן: יהוה אלהיכם אמת' }),
  sec('emet-veemuna', 'after-shema', 'אמת ואמונה', AR('The Shema'), { start: 'ואמונה כל זאת וקים עלינו' }),
  sec('hashkiveinu', 'hashkiveinu', 'השכיבנו', AR('The Shema'), { start: 'השכיבנו אבינו לשלום' }),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', AR('The Shema'), { start: 'ואומר החזן חצי קדיש', role: 'minyan' }),
  sec('avot', 'amidah', 'ברכת אבות', AR('Amidah'), { end: 'מגן אברהם' }),
  sec('gevurot', 'amidah', 'גבורות', AR('Amidah'), { start: 'אתה גבור לעולם', end: 'מחיה המתים' }),
  sec('kedushat-hashem', 'amidah', 'קדושת השם', AR('Amidah'), { start: 'אתה קדוש ושמך קדוש' }),
  sec('daat', 'amidah', 'חונן הדעת', AR('Amidah'), { start: 'אתה חונן לאדם דעת' }),
  sec('ata-chonantanu', 'amidah', 'אתה חוננתנו', AR('Amidah'), { start: 'במוצאי שבת ויום טוב אומרים', end: 'אתה חוננתנו יהוה אלהינו', when: 'motzaeiShabbat' }),
  sec('daat-end', 'amidah', '', AR('Amidah'), { start: 'וחננו מאתך חכמה בינה ודעת', continues: true }),
  sec('teshuva', 'amidah', 'תשובה', AR('Amidah'), { start: 'השיבנו אבינו לתורתך' }),
  sec('selicha', 'amidah', 'סליחה', AR('Amidah'), { start: 'סלח לנו אבינו' }),
  sec('geula', 'amidah', 'גאולה', AR('Amidah'), { start: 'ראה נא בענינו' }),
  sec('refua', 'amidah', 'רפואה', AR('Amidah'), { start: 'רפאנו יהוה ונרפא' }),
  sec('birkat-hashanim', 'amidah', 'ברכת השנים', AR('Amidah'), { start: 'בקיץ:', end: 'ברך עלינו יהוה אלהינו את השנה' }),
  sec('kibbutz-galuyot', 'amidah', 'קיבוץ גלויות', AR('Amidah'), { start: 'תקע בשופר גדול' }),
  sec('mishpat', 'amidah', 'השבת המשפט', AR('Amidah'), { start: 'השיבה שופטינו' }),
  sec('minim', 'amidah', 'ברכת המינים', AR('Amidah'), { start: 'למינים ולמלשינים' }),
  sec('tzadikim', 'amidah', 'על הצדיקים', AR('Amidah'), { start: 'על הצדיקים ועל החסידים' }),
  sec('yerushalayim', 'amidah', 'בונה ירושלים', AR('Amidah'), { start: 'תשכון בתוך ירושלים' }),
  sec('malchut-david', 'amidah', 'מלכות בית דוד', AR('Amidah'), { start: 'את צמח דוד עבדך' }),
  sec('shomea-tefila', 'amidah', 'שומע תפילה', AR('Amidah'), { start: 'שמע קולנו' }),
  sec('aneinu', 'amidah', 'עננו', AR('Amidah'), { start: 'בתשעה באב יש אומרים עננו', role: 'optional', when: 'tishaBav' }),
  sec('aneinu-sansan', 'amidah', 'עננו — נוסח סנסן ליאיר', AR('Amidah'), { start: 'נוסח עננו בג\' צומות', role: 'optional', when: 'tishaBav' }),
  sec('shomea-tefila-end', 'amidah', '', AR('Amidah'), { start: 'כי אתה שומע תפלת כל פה', continues: true }),
  sec('retze', 'amidah', 'רצה', AR('Amidah'), { start: 'רצה יהוה אלהינו בעמך' }),
  sec('yaale-veyavo', 'amidah', 'יעלה ויבוא', AR('Amidah'), { start: 'בראש חודש ובחול המועד אומרים', end: 'לרחם בו עלינו ולהושיענו', when: 'roshChodesh|cholHamoed' }),
  sec('retze-end', 'amidah', '', AR('Amidah'), { start: 'ואתה ברחמיך הרבים', continues: true }),
  sec('modim', 'amidah', 'מודים', AR('Amidah'), { start: 'בברכת "מודים" יכרע', end: 'כי מעולם קוינו לך' }),
  sec('al-hanisim', 'amidah', 'על הנסים', AR('Amidah'), { start: 'בחנוכה ופורים אומרים', end: 'בפורים אומרים בימי מרדכי', when: 'chanukah|purim' }),
  sec('modim-end', 'amidah', '', AR('Amidah'), { start: 'ועל כלם יתברך', continues: true }),
  sec('sim-shalom', 'amidah', 'שים שלום', AR('Amidah'), { start: 'שים שלום טובה וברכה' }),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', AR('Amidah'), { start: 'יהיו לרצון אמרי פי', end: 'יש אומרים תפילת רב' }),
  sec('oseh-shalom', 'elokai-netzor', 'עושה שלום', AR('Amidah'), { start: 'עשה שלום בעשרת ימי תשובה', end: 'שתבנה בית המקדש' }),
  sec('yehi-shem', 'closing-passages', 'יהי שם', AR('Amidah'), { start: 'יהי שם יהוה מברך מעתה' }),
  // "בכל לילות החול מלבד מוצאי שבת מדלגים לקדיש תתקבל".
  sec('motzaei-shabbat-kaddish', 'half-kaddish', 'חצי קדיש', AR('Amidah'), { start: 'בכל לילות החול מלבד מוצאי שבת', end: 'במוצאי שבת אומרים', role: 'minyan', when: 'motzaeiShabbat' }),
  sec('motzaei-shabbat-hachana', 'motzaei-shabbat', 'הריני מכין עצמי', AR('Amidah'), { start: 'לפני "שובה" יש נוהגים', end: 'הריני מכין עצמי לקבל אור', role: 'optional', when: 'motzaeiShabbat' }),
  sec('vihi-noam', 'motzaei-shabbat', 'ויהי נועם', AR('Amidah'), { start: 'שובה יהוה עד מתי', end: 'ברוך אלהינו שבראנו לכבודו', when: 'motzaeiShabbat' }),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', AR('Amidah'), { start: 'ואומר החזן קדיש תתקבל', end: 'עושה שלום במרומיו', role: 'minyan' }),
  ...omerSections('', 'omer'),
  sec('shir-lamaalot', 'closing-passages', 'שיר למעלות', AR('Amidah'), { start: 'למעלות אשא עיני אל ההרים' }),
  sec('kaddish-yehe-shlama', 'kaddish-yatom', 'קדיש יהא שלמא', AR('Amidah'), { start: 'ואומרים כאן קדיש "יהא שלמא"', end: 'יהא שלמא רבא מן שמיא', role: 'mourners' }),
  sec('barchu-end', 'barchu', 'ברכו', AR('Amidah'), { start: 'אומרים: ברכו את יהוה המברך', role: 'minyan' }),
  sec('aleinu', 'aleinu', 'עלינו לשבח', AR('Alenu')),
], {
  reviewed: true,
  conditionsPending: [
    'ספירת העומר: טבלת 49 הימים מוצגת כולה — אין עדיין מפתח ליום הספירה (omerDay)',
    'אתה חוננתנו: ״במוצאי שבת ויום טוב״ — אין מפתח למוצאי יום טוב שחל בחול (motzaeiYomTov)',
  ],
});

// ── Kabbalat Shabbat ───────────────────────────────────────────────────────────────────────────────────────────────
const KS = R('Kabbalat Shabbat');
const kabbalatShabbat = service('קבלת שבת', [
  sec('candle-lighting', 'kabbalat-shabbat', 'הדלקת נרות שבת', R('Shabbat Candle Lighting'), { end: 'ואחר הדלקת נרות שבת תברך' }),
  omit('candle-lighting-yom-tov', R('Shabbat Candle Lighting'), { start: 'לפני הדלקת נר של יום טוב', why: 'הדלקת נר של יום טוב — אינה חלק מקבלת שבת' }),
  sec('lechu-neranena', 'kabbalat-shabbat', 'לכו נרננה', KS, { end: 'לתודה הריעו ליהוה' }),
  sec('mizmor-ledavid', 'kabbalat-shabbat', 'מזמור לדוד — הבו לה׳', KS, { start: 'עומדים ואומרים מזמור' }),
  sec('lecha-dodi', 'lecha-dodi', 'לכה דודי', KS, { start: 'לכה דודי לקראת כלה', end: 'באי כלה, שבת מלכתא' }),
  sec('mizmor-shir', 'mizmor-shir-shabbat', 'מזמור שיר ליום השבת', KS, { start: 'שיר ליום השבת טוב להדות', end: 'מלך גאות לבש' }),
  sec('kol-yisrael', 'bameh-madlikin', 'כל ישראל', KS, { start: 'כל ישראל יש להם חלק', end: 'כל ישראל יש להם חלק' }),
  // "אין אומרים במה מדליקין בערב שבת שחל בו יום טוב או ערב יום טוב, ולא בחול המועד, ולא בערב שבת חנוכה או ערב
  // חנוכה, ולא בבית האבל, אלא יתכיל מאמר רבי אלעזר" — Yom Tov, Chol HaMoed and Chanukah are decided here; Erev Yom
  // Tov, Erev Chanukah and a house of mourning have no condition key yet (conditionsPending).
  sec('bameh-madlikin', 'bameh-madlikin', 'במה מדליקין', KS, { start: 'אין אומרים במה מדליקין', end: 'במה מדליקין ובמה אין מדליקין', when: '!cholHamoed&!chanukah&!yomTov' }),
  sec('rabbi-elazar', 'bameh-madlikin', 'אמר רבי אלעזר', KS, { start: 'אמר רבי אלעזר אמר רבי חנינא' }),
  sec('kaddish-al-yisrael', 'kaddish-derabanan', 'קדיש על ישראל', KS, { start: 'ואומרים קדיש "על ישראל"', role: 'minyan' }),
], {
  reviewed: true,
  conditionsPending: ['במה מדליקין: אינו נאמר בערב שבת שחל בו ערב יום טוב, בערב חנוכה ובבית האבל — אין עדיין מפתחות erevYomTov / erevChanukah / houseOfMourning'],
});

// ── Arvit of Shabbat ───────────────────────────────────────────────────────────────────────────────────────────────
const SAR = path => R(`Shabbat Arvit, ${path}`);
const shabbatMaariv = service('ערבית לליל שבת', [
  sec('leshem-yichud', 'barchu', 'לשם יחוד — ימלך ה׳', SAR('Barchu'), { end: 'ימלך יהוה לעולם אלהיך ציון' }),
  sec('half-kaddish-before', 'half-kaddish', 'חצי קדיש', SAR('Barchu'), { start: 'יתגדל ויתקדש', end: 'יתגדל ויתקדש', role: 'minyan' }),
  sec('barchu', 'barchu', 'ברכו', SAR('Barchu'), { start: 'ואומר החזן: ברכו', role: 'minyan' }),
  sec('maariv-aravim', 'shema-blessings', 'המעריב ערבים', SAR('The Shema'), { end: 'המעריב ערבים' }),
  sec('ahavat-olam', 'shema-blessings', 'אהבת עולם', SAR('The Shema'), { start: 'אהבת עולם בית ישראל' }),
  sec('shema', 'shema', 'קריאת שמע', SAR('The Shema'), { start: 'קודם שיקרא קריאת שמע יכוין', end: 'וחוזר החזן: יהוה אלהיכם אמת' }),
  sec('emet-veemuna', 'after-shema', 'אמת ואמונה', SAR('The Shema'), { start: 'ואמונה כל זאת וקים עלינו' }),
  sec('hashkiveinu', 'hashkiveinu', 'השכיבנו', SAR('The Shema'), { start: 'השכיבנו אבינו לשלום' }),
  sec('veshamru', 'hashkiveinu', 'ושמרו', SAR('The Shema'), { start: 'ושמרו בני ישראל את השבת' }),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', SAR('The Shema'), { start: 'ואומר החזן חצי קדיש', role: 'minyan' }),
  sec('avot', 'amidah', 'ברכת אבות', SAR('Magen Avot'), { end: 'מגן אברהם' }),
  sec('gevurot', 'amidah', 'גבורות', SAR('Magen Avot'), { start: 'אתה גבור לעולם', end: 'מחיה המתים' }),
  sec('kedushat-hashem', 'amidah', 'קדושת השם', SAR('Magen Avot'), { start: 'אתה קדוש ושמך קדוש' }),
  sec('kedushat-hayom', 'amidah', 'אתה קדשת', SAR('Magen Avot'), { start: 'אתה קדשת את יום השביעי', end: 'מקדש השבת' }),
  sec('retze', 'amidah', 'רצה', SAR('Magen Avot'), { start: 'רצה יהוה אלהינו בעמך' }),
  sec('yaale-veyavo', 'amidah', 'יעלה ויבוא', SAR('Magen Avot'), { start: 'בראש חודש ובחול המועד אומרים', end: 'לרחם בו עלינו ולהושיענו', when: 'roshChodesh|cholHamoed' }),
  sec('retze-end', 'amidah', '', SAR('Magen Avot'), { start: 'ואתה ברחמיך הרבים', continues: true }),
  sec('modim', 'amidah', 'מודים', SAR('Magen Avot'), { start: 'בברכת "מודים" יכרע', end: 'כי מעולם קוינו לך' }),
  sec('al-hanisim', 'amidah', 'על הנסים', SAR('Magen Avot'), { start: 'בחנוכה ופורים אומרים', end: 'בפורים אומרים בימי מרדכי', when: 'chanukah|purim' }),
  sec('modim-end', 'amidah', '', SAR('Magen Avot'), { start: 'ועל כלם יתברך', continues: true }),
  sec('sim-shalom', 'amidah', 'שים שלום', SAR('Magen Avot'), { start: 'שים שלום טובה וברכה' }),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', SAR('Magen Avot'), { start: 'יהיו לרצון אמרי פי', end: 'שתבנה בית המקדש' }),
  sec('vayechulu', 'vayechulu', 'ויכולו', SAR('Magen Avot'), { start: 'עומדים ואומרים', end: 'ויכלו השמים והארץ' }),
  sec('magen-avot', 'magen-avot', 'ברכה מעין שבע', SAR('Magen Avot'), { start: 'ואומר החזן ברכת מעין שבע', role: 'chazzan' }),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', SAR('Magen Avot'), { start: 'ואומר החזן קדיש תתקבל', end: 'יפסע שלש פסיעות', role: 'minyan' }),
  sec('mizmor-ledavid', 'closing-passages', 'מזמור לדוד ה׳ רועי', SAR('Magen Avot'), { start: 'לדוד יהוה רעי לא אחסר' }),
  // The edition prints this Kaddish from "תתקבל" — its opening "יתגדל" paragraph is missing (see the notes).
  sec('kaddish-yehe-shlama', 'kaddish-yatom', 'קדיש יהא שלמא', SAR('Magen Avot'), { start: 'ואומרים כאן קדיש "יהא שלמא"', end: 'יהא שלמא רבא מן שמיא', role: 'mourners' }),
  sec('barchu-end', 'barchu', 'ברכו', SAR('Magen Avot'), { start: 'ואומרים: ברכו את יהוה המברך', role: 'minyan' }),
  sec('aleinu', 'aleinu', 'עלינו לשבח', SAR('Alenu'), { end: 'על כן נקוה לך' }),
  sec('yigdal', 'closing-passages', 'יגדל', SAR('Alenu'), { start: 'יש נוהגים לומר אחר התפילה', role: 'optional' }),
], { reviewed: true });

// ── Kiddush of Shabbat night ───────────────────────────────────────────────────────────────────────────────────────
const SE = path => R(`Shabbat Evening, ${path}`);
const shabbatKiddush = service('קידוש לליל שבת', [
  sec('shalom-aleichem', 'shalom-aleichem', 'שלום עליכם', SE('Shalom Alekhem')),
  sec('eshet-chayil', 'eshet-chayil', 'אשת חיל', SE('Eshet Hayil'), { end: 'אשת חיל מי ימצא' }),
  sec('ahalela', 'eshet-chayil', 'אהללה שם אלהים', SE('Eshet Hayil'), { start: 'אהללה שם אלהים בשיר' }),
  sec('atkinu', 'zemirot', 'אתקינו סעודתא', SE('Atkenu Seudata'), { end: 'אתקינו סעדתא דמהימנותא' }),
  sec('azamer-bishvachin', 'zemirot', 'אזמר בשבחין', SE('Atkenu Seudata'), { start: 'פשט המנהג בכל המקומות', end: 'תעטרת כלה. ברזין דלעלא' }),
  sec('yehe-raava', 'zemirot', 'ויהא רעוא', SE('Atkenu Seudata'), { start: 'ויהא רעוא מן קדם עתיקא' }),
  sec('zohar-yoma-da', 'zemirot', 'יומא דא מתעטרא', SE('Atkenu Seudata'), { start: 'נוהגים לומר מזוהר פרשת ויקהל' }),
  sec('kiddush-leshem-yichud', 'kiddush', 'לשם יחוד לקידוש', SE('Kiddush'), { end: 'שבזכות מצות הברכה של קדוש שבת', role: 'optional' }),
  sec('kiddush-leshem-yichud-short', 'kiddush', 'לשם יחוד — נוסח קצר', SE('Kiddush'), { start: 'יש נוהגים לומר נוסך קצרה', role: 'optional' }),
  sec('mizmor-ledavid', 'kiddush', 'מזמור לדוד ה׳ רועי', SE('Kiddush'), { start: 'יש נוהגים לומר מזמור לדוד', role: 'optional' }),
  sec('kiddush', 'kiddush', 'קידוש', SE('Kiddush'), { start: 'ום ה ששי ו יכלו' }),
], { reviewed: true });

// ── Shabbat Shacharit ──────────────────────────────────────────────────────────────────────────────────────────────
// "מתפללים שחרית של חול עד סוף ה' מלך וממשיכים" (the edition, Psalms for Shabbat ¶1): the weekday morning order
// (without tefillin) up to ה׳ מלך, then the Shabbat psalms.
const SS = path => R(`Shabbat Shacharit, ${path}`);
const WEEKDAY_ONLY = new Set(['tefillin', 'lamnatzeach-menorah', 'baruch-sheamar', 'mizmor-letoda', 'yehi-chevod', 'tehila-ledavid', 'hallelukah', 'baruch-hashem-leolam', 'vayevarech-david', 'az-yashir', 'yishtabach', 'shir-hamaalot-aseret', 'half-kaddish', 'barchu', 'yotzer', 'ahavat-olam', 'shema', 'emet-veyatziv']);
const shabbatShacharit = service('שחרית של שבת', [
  ...shacharitMorning.filter(section => !WEEKDAY_ONLY.has(section.id)),
  omit('lamnatzeach-menorah', SH('Hodu'), { start: 'טוב לומר מזמור אלהים יחננו', why: '"בשבת ממשיכים מזמור השמים מספרים" — מזמור המנורה של חול אינו נאמר כאן בשבת' }),
  sec('shabbat-psalms', 'pesukei-dezimra', 'מזמורי שבת', SS('Psalms for Shabbat')),
  sec('baruch-sheamar', 'baruch-sheamar', 'ברוך שאמר', SS("Pesukei D'Zimra"), { end: 'יש אומרים כי גבר עלינו חסדו' }),
  sec('mizmor-shir-shabbat', 'pesukei-dezimra', 'מזמור שיר ליום השבת', SS("Pesukei D'Zimra"), { start: 'שיר ליום השבת טוב להדות', end: 'מלך גאות לבש' }),
  sec('yehi-chevod', 'pesukei-dezimra', 'יהי כבוד', SS("Pesukei D'Zimra"), { start: 'יהי כבוד יהוה לעולם' }),
  sec('tehila-ledavid', 'pesukei-dezimra', 'אשרי — תהלה לדוד', SS("Pesukei D'Zimra"), { start: 'אשרי יושבי ביתך' }),
  sec('hallelukah', 'pesukei-dezimra', 'הללויה', SS("Pesukei D'Zimra"), { start: 'הללי נפשי את יהוה' }),
  sec('baruch-hashem-leolam', 'pesukei-dezimra', 'ברוך ה׳ לעולם', SS("Pesukei D'Zimra"), { start: 'ברוך יהוה לעולם אמן ואמן' }),
  sec('vayevarech-david', 'pesukei-dezimra', 'ויברך דויד', SS("Pesukei D'Zimra"), { start: 'יאמר מעומד', end: 'ויברך דויד את יהוה' }),
  sec('az-yashir', 'az-yashir', 'שירת הים', SS("Pesukei D'Zimra"), { start: 'ביום ההוא את ישראל מיד מצרים', end: 'כי ליהוה המלוכה ומשל בגוים' }),
  sec('nishmat', 'pesukei-dezimra', 'נשמת כל חי', SS("Pesukei D'Zimra"), { start: 'כשאומר נשמת כל חי', end: 'במקהלות רבבות עמך' }),
  sec('yishtabach', 'yishtabach', 'ישתבח', SS("Pesukei D'Zimra"), { start: 'שבח ברכת ישתבח הוא עצום', end: 'ישתבח שמך לעד מלכנו' }),
  sec('shir-hamaalot-shuva', 'pesukei-dezimra', 'שיר המעלות ממעמקים', SS("Pesukei D'Zimra"), { start: 'בשבת תשובה אומרים', end: 'ממעמקים קראתיך', when: 'shabbatShuva' }),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', SS("Pesukei D'Zimra"), { start: 'ואומר החזן חצי קדיש', end: 'יתגדל ויתקדש', role: 'minyan' }),
  sec('barchu', 'barchu', 'ברכו', SS("Pesukei D'Zimra"), { start: 'ואומר החזן: ברכו', role: 'minyan' }),
  sec('yotzer', 'shema-blessings', 'יוצר אור', SS('The Shema'), { end: 'יוצר המאורות' }),
  sec('ahavat-olam', 'shema-blessings', 'אהבת עולם', SS('The Shema'), { start: 'אהבת עולם אהבתנו', end: 'הבוחר בעמו ישראל באהבה' }),
  sec('shema', 'shema', 'קריאת שמע', SS('The Shema'), { start: 'קודם שיקרא קריאת שמע יכוין', end: 'וחוזר החזן: יהוה אלהיכם אמת' }),
  sec('emet-veyatziv', 'after-shema', 'אמת ויציב', SS('The Shema'), { start: 'ונכון, וקים, וישר' }),
  sec('avot', 'amidah', 'ברכת אבות', SS('Amidah'), { end: 'מגן אברהם' }),
  sec('gevurot', 'amidah', 'גבורות', SS('Amidah'), { start: 'אתה גבור לעולם', end: 'מחיה המתים' }),
  sec('kedusha', 'kedusha', 'קדושה', SS('Amidah'), { start: 'קדושה בחזרת הש"ץ', end: 'נקדישך ונעריצך', role: 'repetition' }),
  sec('kedushat-hashem', 'amidah', 'קדושת השם', SS('Amidah'), { start: 'אתה קדוש ושמך קדוש' }),
  sec('kedushat-hayom', 'amidah', 'ישמח משה', SS('Amidah'), { start: 'ישמח משה במתנת חלקו', end: 'מקדש השבת' }),
  sec('retze', 'amidah', 'רצה', SS('Amidah'), { start: 'רצה יהוה אלהינו בעמך' }),
  sec('yaale-veyavo', 'amidah', 'יעלה ויבוא', SS('Amidah'), { start: 'בראש חודש ובחול המועד מוסיפים', end: 'לרחם בו עלינו ולהושיענו', when: 'roshChodesh|cholHamoed' }),
  sec('retze-end', 'amidah', '', SS('Amidah'), { start: 'ואתה ברחמיך הרבים', continues: true }),
  sec('modim', 'amidah', 'מודים', SS('Amidah'), { start: 'בברכת "מודים" יכרע', end: 'כי מעולם קוינו לך' }),
  sec('modim-derabanan', 'modim-derabanan', 'מודים דרבנן', SS('Amidah'), { start: 'מודים דרבנן', role: 'repetition' }),
  sec('al-hanisim', 'amidah', 'על הנסים', SS('Amidah'), { start: 'בחנוכה ופורים אומרים', end: 'בפורים אומרים בימי מרדכי', when: 'chanukah|purim' }),
  sec('modim-end', 'amidah', '', SS('Amidah'), { start: 'ועל כלם יתברך', continues: true }),
  sec('birkat-kohanim', 'birkat-kohanim', 'ברכת כהנים', SS('Amidah'), { start: 'ברכת כהנים', end: 'ושמו את שמי על בני ישראל', role: 'repetition' }),
  sec('sim-shalom', 'amidah', 'שים שלום', SS('Amidah'), { start: 'שים שלום טובה וברכה' }),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', SS('Amidah'), { start: 'יהיו לרצון אמרי פי', end: 'שתבנה בית המקדש' }),
  sec('avinu-malkeinu', 'avinu-malkeinu', 'אבינו מלכנו', SS('Amidah'), { start: 'אבינו מלכנו בשבת תשובה אומרים', end: 'אל תשיבנו ריקם מלפניך', when: 'shabbatShuva' }),
  sec('yehi-shem', 'closing-passages', 'יהי שם', SS('Amidah'), { start: 'יהי שם יהוה מברך מעתה', end: 'בשבת ר"ח או חול המועד או חנוכה אומרים הלל' }),
  ...hallelSections('shabbat-', 'hallel', { withKaddish: false }),
  omit('shabbat-rc-torah-and-ashrei', HALLEL, { start: 'קודם הוצאת ספר תורה אומרים', why: 'הוצאת ספר תורה וקריאה של ראש חודש בחול ואשרי — בשבת נאמר סדר קריאת התורה של שבת' }),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', SS('Amidah'), { start: 'ואומר החזן קדיש תתקבל', role: 'minyan' }),
  sec('torah-service', 'torah-service', 'הוצאת ספר תורה', SS('Torah Reading'), { end: 'וזאת התורה אשר שם משה' }),
  sec('aliyah-before', 'torah-reading', 'ברכות העולה', SS('Torah Reading'), { start: 'אסור לדבר בשעת הקריאה', end: 'אשר בחר בנו מכל העמים' }),
  sec('aliyah-after', 'torah-reading', 'ברכה אחרונה', SS('Torah Reading'), { start: 'ואחר קריאת התורה מברך העולה' }),
  sec('hagomel', 'torah-reading', 'ברכת הגומל', SS('HaGomel'), { role: 'optional' }),
  omit('weekday-torah-service', SH('Torah Reading'), { end: 'ברכת הגומל נמצא', why: 'סדר הוצאת ספר תורה של חול — בשבת נאמר הסדר של שבת; נלקח מכאן רק החצי קדיש שלפני המפטיר' }),
  sec('half-kaddish-maftir', 'half-kaddish', 'חצי קדיש', SH('Torah Reading'), { start: 'העולה האחרון אומר חצי קדיש', role: 'minyan' }),
  sec('haftarah', 'haftarah', 'ברכות ההפטרה', SS('Haftarah')),
  sec('mi-sheberach', 'torah-service', 'מי שברך לקהל', SS('Mi Sheberach')),
  sec('birkat-hachodesh', 'birkat-hachodesh', 'הכרזת ראש חודש', SS('Birkat HaChodesh')),
  sec('fast-announcement', 'birkat-hachodesh', 'הכרזת תענית', SS('Announcement of Fast')),
  sec('ashrei', 'ashrei', 'אשרי', SS('Ashrei'), { end: 'ימלך ימלך יהוה לעולם' }),
  sec('return-torah', 'return-torah', 'החזרת ספר תורה', SS('Ashrei'), { start: 'מחזירים את ספר התורה למקומו' }),
], {
  reviewed: true,
  conditionsPending: [
    'הכרזת ראש חודש: נאמרת רק בשבת שלפני ראש חודש (חוץ מתשרי) — אין עדיין מפתח shabbatMevarchim',
    'הכרזת תענית: רק בשבת שלפני י״ז בתמוז ועשרה בטבת — אין עדיין מפתח',
  ],
});

// ── Shabbat Musaf ─────────────────────────────────────────────────────────────────────────────────────────────────
const SM = path => R(`Shabbat Mussaf, ${path}`);
const shabbatMusafEnding = when => {
  const o = options => ({ ...options, ...(when ? { when } : {}) });
  return [
    sec('kol-yisrael', 'closing-passages', 'כל ישראל', SM('Amida'), o({ start: 'כל ישראל יש להם חלק', end: 'רבי חנניה בן עקשיא' })),
    sec('ein-keloheinu', 'ein-keloheinu', 'אין כאלהינו', SM('Amida'), o({ start: 'אין כאלהינו, אין כאדוננו' })),
    sec('ketoret', 'ketoret', 'פטום הקטורת', SM('Incense Offering'), o({ end: 'תנא דבי אליהו' })),
    sec('kaddish-al-yisrael', 'kaddish-derabanan', 'קדיש על ישראל', SM('Incense Offering'), o({ start: 'ואומרים קדיש על ישראל', end: 'יהא שלמא רבא', role: 'minyan' })),
    sec('barchu', 'barchu', 'ברכו', SM('Incense Offering'), o({ start: 'ברכו את יהוה המברך', role: 'minyan' })),
    sec('aleinu', 'aleinu', 'עלינו לשבח', SM('Alenu'), o({ end: 'על כן נקוה לך' })),
  ];
};
const shabbatMusaf = service('מוסף לשבת', [
  sec('leshem-yichud', 'musaf', 'לשם יחוד', SM('Amida'), { end: 'לשם יחוד קדשא בריך הוא' }),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', SM('Amida'), { start: 'ואומר החזן חצי קדיש', end: 'יתגדל ויתקדש', role: 'minyan' }),
  sec('avot', 'musaf', 'ברכת אבות', SM('Amida'), { start: 'אדני שפתי תפתח', end: 'מגן אברהם' }),
  sec('gevurot', 'musaf', 'גבורות', SM('Amida'), { start: 'אתה גבור לעולם', end: 'מחיה המתים' }),
  sec('keter', 'kedusha', 'קדושה — כתר', SM('Amida'), { start: 'בחזרת הש"ץ אומרים', end: 'כתר יתנו לך', role: 'repetition' }),
  sec('kedushat-hashem', 'musaf', 'קדושת השם', SM('Amida'), { start: 'אתה קדוש ושמך קדוש' }),
  sec('tikanta-shabbat', 'musaf', 'תכנת שבת', SM('Amida'), { start: 'בשבת יאמר', end: 'וביום השבת שני כבשים', when: '!roshChodesh' }),
  sec('ata-yatzarta', 'musaf', 'אתה יצרת — לשבת ראש חודש', SM('Amida'), { start: 'ואם חל ראש חודש בשבת יאמר', end: 'חדש עלינו את החדש הזה', when: 'roshChodesh' }),
  sec('yismechu', 'musaf', 'ישמחו במלכותך', SM('Amida'), { start: 'ישמחו במלכותך שומרי שבת', end: 'רצה נא במנוחתנו' }),
  sec('retze', 'musaf', 'רצה', SM('Amida'), { start: 'רצה יהוה אלהינו בעמך' }),
  sec('modim', 'musaf', 'מודים', SM('Amida'), { start: 'בברכת "מודים" יכרע', end: 'כי מעולם קוינו לך' }),
  sec('modim-derabanan', 'modim-derabanan', 'מודים דרבנן', SM('Amida'), { start: 'מודים דרבנן', role: 'repetition' }),
  sec('al-hanisim', 'musaf', 'על הנסים', SM('Amida'), { start: 'בחנוכה ופורים אומרים', end: 'בפורים אומרים בימי מרדכי', when: 'chanukah|purim' }),
  sec('modim-end', 'musaf', '', SM('Amida'), { start: 'ועל כלם יתברך', continues: true }),
  sec('birkat-kohanim', 'birkat-kohanim', 'ברכת כהנים', SM('Amida'), { start: 'ברכת כהנים', end: 'ושמו את שמי על בני ישראל', role: 'repetition' }),
  sec('sim-shalom', 'musaf', 'שים שלום', SM('Amida'), { start: 'שים שלום טובה וברכה' }),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', SM('Amida'), { start: 'יהיו לרצון אמרי פי', end: 'שתבנה בית המקדש' }),
  sec('yehi-shem', 'closing-passages', 'יהי שם', SM('Amida'), { start: 'אחרי חזרת הש', end: 'מה אדיר שמך בכל הארץ' }),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', SM('Amida'), { start: 'ואומר החזן קדיש תתקבל', end: 'יפסע שלש פסיעות', role: 'minyan' }),
  ...shabbatMusafEnding(null),
  sec('mizmor-shir', 'song-of-day', 'מזמור שיר ליום השבת', SM('Alenu'), { start: 'מזמור שיר ליום השבת' }),
], { reviewed: true });

// ── Kiddush of the day ─────────────────────────────────────────────────────────────────────────────────────────────
const DM = path => R(`Daytime Meal, ${path}`);
const shabbatKiddushDay = service('קידושא רבא', [
  sec('seuda-intro', 'zemirot', 'סדר סעודה שניה', DM('Daytime Meal'), { end: 'בשתיקה בעוד ההדס בידו' }),
  sec('mishnayot', 'zemirot', 'משניות', DM('Daytime Meal'), { start: 'אומרים משניות מסכת כלים', end: 'כלי עץ, וכלי עור' }),
  sec('zohar-yitro', 'zemirot', 'זוהר — ביומא דשבתא', DM('Daytime Meal'), { start: 'נוהגים לומר מזוהר פרשת יתרו' }),
  sec('atkinu', 'zemirot', 'אתקינו סעודתא', DM('Daytime Meal'), { start: 'אתקינו אתקינו סעודתא' }),
  sec('asader', 'zemirot', 'אסדר לסעודתא', DM('Daytime Meal'), { start: 'פשט המנהג בכל המקומות', end: 'זמן בתלתא, בכסא דברכתא' }),
  sec('yehe-raava', 'zemirot', 'ויהא רעוא', DM('Daytime Meal'), { start: 'יש אומרים יהא רעוא גם ביום', end: 'ויהא רעוא מן קדם עתיקא', role: 'optional' }),
  sec('zohar-kiddusha', 'zemirot', 'זוהר — קידושא דיומא', DM('Daytime Meal'), { start: 'נוהגים לומר מזוהר פרשת ויקהל' }),
  sec('kiddush', 'kiddush-day', 'קידוש היום', DM('Kiddush')),
], { reviewed: true });

// ── Shabbat Mincha ─────────────────────────────────────────────────────────────────────────────────────────────────
const SMN = path => R(`Shabbat Mincha, ${path}`);
const shabbatMincha = service('מנחה לשבת', [
  sec('leshem-yichud', 'korbanot', 'לשם יחוד', SMN('Offerings'), { end: 'לשם יחוד קדשא' }),
  sec('ps84', 'korbanot', 'מה ידידות', SMN('Offerings'), { start: 'למנצח על הגתית לבני קרח' }),
  sec('tamid', 'korbanot', 'פרשת התמיד', SMN('Offerings'), { start: 'צו את בני ישראל ואמרת אלהם' }),
  sec('ketoret', 'ketoret', 'פטום הקטורת', SMN('Offerings'), { start: 'שהקטירו אבותינו לפניך' }),
  sec('ashrei', 'ashrei', 'אשרי', SMN('Offerings'), { start: 'אשרי יושבי ביתך' }),
  sec('uva-letzion', 'uva-letzion', 'ובא לציון', SMN('Uva LeSion'), { end: 'ברוך אלהינו שבראנו' }),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', SMN('Uva LeSion'), { start: 'ואומר החזן חצי קדיש', end: 'יתגדל ויתקדש', role: 'minyan' }),
  sec('torah-service', 'torah-service', 'הוצאת ספר תורה', SMN('Uva LeSion'), { start: 'קודם פתיחת ההיכל אומרים', end: 'וזאת התורה אשר שם משה' }),
  omit('shabbat-morning-torah-service', SS('Torah Reading'), { end: 'וזאת התורה אשר שם משה', why: 'סדר הוצאת ספר תורה של שחרית — במנחה הסידור מדפיס סדר משלו (ובא לציון ¶5–15); נלקחות מכאן רק ברכות העולה' }),
  sec('aliyah-before', 'torah-reading', 'ברכות העולה', SS('Torah Reading'), { start: 'אסור לדבר בשעת הקריאה', end: 'אשר בחר בנו מכל העמים' }),
  sec('torah-reading', 'torah-reading', 'קריאת התורה', SMN('Uva LeSion'), { start: 'קוראים לפחות עשרה פסוקים', end: 'קוראים לפחות עשרה פסוקים' }),
  sec('aliyah-after', 'torah-reading', 'ברכה אחרונה', SS('Torah Reading'), { start: 'ואחר קריאת התורה מברך העולה' }),
  sec('mizmor-shir', 'mizmor-shir-shabbat', 'מזמור שיר ליום השבת', SMN('Uva LeSion'), { start: 'שיר ליום השבת טוב להדות' }),
  sec('return-torah', 'return-torah', 'החזרת ספר תורה', SMN('Uva LeSion'), { start: 'ומחזירים ספר התורה למקומו', end: 'כי לקח טוב נתתי לכם' }),
  sec('half-kaddish-amidah', 'half-kaddish', 'חצי קדיש', SMN('Uva LeSion'), { start: 'ואומר החזן חצי קדיש', role: 'minyan' }),
  sec('avot', 'amidah', 'ברכת אבות', SMN('Amida'), { end: 'מגן אברהם' }),
  sec('gevurot', 'amidah', 'גבורות', SMN('Amida'), { start: 'אתה גבור לעולם', end: 'מחיה המתים' }),
  sec('kedusha', 'kedusha', 'קדושה', SMN('Amida'), { start: 'קדושה בחזרת הש"ץ', end: 'נקדישך ונעריצך', role: 'repetition' }),
  sec('kedushat-hashem', 'amidah', 'קדושת השם', SMN('Amida'), { start: 'אתה קדוש ושמך קדוש' }),
  sec('kedushat-hayom', 'amidah', 'אתה אחד', SMN('Amida'), { start: 'אתה אחד ושמך אחד', end: 'מקדש השבת' }),
  sec('retze', 'amidah', 'רצה', SMN('Amida'), { start: 'רצה יהוה אלהינו בעמך' }),
  sec('yaale-veyavo', 'amidah', 'יעלה ויבוא', SMN('Amida'), { start: 'בראש חודש ובחול המועד אומרים', end: 'לרחם בו עלינו ולהושיענו', when: 'roshChodesh|cholHamoed' }),
  sec('retze-end', 'amidah', '', SMN('Amida'), { start: 'ואתה ברחמיך הרבים', continues: true }),
  sec('modim', 'amidah', 'מודים', SMN('Amida'), { start: 'בברכת "מודים" יכרע', end: 'כי מעולם קוינו לך' }),
  sec('modim-derabanan', 'modim-derabanan', 'מודים דרבנן', SMN('Amida'), { start: 'מודים דרבנן', role: 'repetition' }),
  sec('al-hanisim', 'amidah', 'על הנסים', SMN('Amida'), { start: 'בחנוכה ופורים אומרים', end: 'בפורים אומרים בימי מרדכי', when: 'chanukah|purim' }),
  sec('modim-end', 'amidah', '', SMN('Amida'), { start: 'ועל כלם יתברך', continues: true }),
  sec('sim-shalom', 'amidah', 'שים שלום', SMN('Amida'), { start: 'שים שלום טובה וברכה' }),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', SMN('Amida'), { start: 'יהיו לרצון אמרי פי', end: 'שתבנה בית המקדש' }),
  // "בשבת שובה אומרים כאן אבינו מלכינו" — the edition points to the Shabbat Avinu Malkeinu printed in Shacharit.
  sec('avinu-malkeinu-note', 'avinu-malkeinu', 'אבינו מלכנו', SMN('Amida'), { start: 'בשבת שובה אומרים כאן אבינו', end: 'בשבת שובה אומרים כאן אבינו', when: 'shabbatShuva' }),
  omit('shabbat-shacharit-amidah', SS('Amidah'), { end: 'שתבנה בית המקדש', why: 'עמידת שחרית של שבת — נלקח ממנה רק "אבינו מלכנו" לשבת שובה' }),
  sec('avinu-malkeinu', 'avinu-malkeinu', '', SS('Amidah'), { start: 'אבינו מלכנו בשבת תשובה אומרים', end: 'אל תשיבנו ריקם מלפניך', when: 'shabbatShuva', continues: true }),
  omit('shabbat-shacharit-after', SS('Amidah'), { start: 'יהי שם יהוה מברך מעתה', why: 'יהי שם, הוראת ההלל וקדיש תתקבל של שחרית — במנחה נאמרים מן המנחה עצמה' }),
  sec('tzidkatcha', 'tzidkatcha', 'צדקתך', SMN('Amida'), { start: 'ביום שהיו אומרים בו תחנון במנחה', end: 'צדקתך כהררי אל' }),
  sec('yehi-shem', 'closing-passages', 'יהי שם', SMN('Amida'), { start: 'ביום שאין אומרים בו תחנון במנחה', end: 'יהי שם יהוה מברך' }),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', SMN('Amida'), { start: 'ואומר החזן קדיש תתקבל', end: 'יפסע שלש פסיעות', role: 'minyan' }),
  sec('hallelukah-odeh', 'closing-passages', 'הללויה אודה ה׳', SMN('Amida'), { start: 'אודה יהוה בכל לבב בסוד ישרים' }),
  sec('kaddish-yehe-shlama', 'kaddish-yatom', 'קדיש יהא שלמא', SMN('Amida'), { start: 'ואומרים קדיש יהא שלמא', role: 'mourners' }),
  sec('aleinu', 'aleinu', 'עלינו לשבח', SMN('Alenu')),
], {
  reviewed: true,
  conditionsPending: ['צדקתך / יהי שם: "ביום שהיו אומרים בו תחנון במנחה אילו היה חל ביום חול" — אין עדיין מפתח ליום שהיה בו תחנון בחול (שני הנוסחים מוצגים עם הוראת הסידור)'],
});

// ── Havdalah ───────────────────────────────────────────────────────────────────────────────────────────────────────
const HV = path => R(`Havdalah, ${path}`);
const havdalah = service('הבדלה', [
  sec('eliyahu-hanavi', 'havdalah', 'אליהו הנביא', HV('Before Havdalah'), { end: 'הנה אנכי שלח לכם את אליה', role: 'optional' }),
  sec('besiman-tov', 'havdalah', 'בסימן טוב', HV('Before Havdalah'), { start: 'אומר או"א בסימן טוב', role: 'optional' }),
  sec('havdalah-verses', 'havdalah', 'פסוקי ההבדלה', HV('Havdala'), { end: 'שלח ברכה רוחה והצלחה' }),
  sec('havdalah', 'havdalah', 'סדר הבדלה', HV('Havdala'), { start: 'סברי מרנן. ועונים: לחיים', end: 'המבדיל בין קדש לחול, ובין אור לחשך' }),
  sec('al-hagefen', 'havdalah', 'ברכה אחרונה — על הגפן', HV('Havdala'), { start: 'שותה רביעית ומברך על הגפן', end: 'על הגפן ועל פרי הגפן ועל תנובת השדה' }),
  sec('al-hagefen-rc', 'havdalah', '', HV('Havdala'), { start: 'בראש חודש וזכרנו לטובה', end: 'בראש חודש וזכרנו לטובה', when: 'roshChodesh', continues: true }),
  sec('al-hagefen-pesach', 'havdalah', '', HV('Havdala'), { start: 'ושמחנו ביום חג המצות', end: 'ושמחנו ביום חג המצות', when: 'cholHamoed&pesach', continues: true }),
  sec('al-hagefen-sukkot', 'havdalah', '', HV('Havdala'), { start: 'ושמחנו ביום חג הסכות', end: 'ושמחנו ביום חג הסכות', when: 'cholHamoed&sukkot', continues: true }),
  sec('al-hagefen-end', 'havdalah', '', HV('Havdala'), { start: 'כי אתה טוב ומטיב לכל', continues: true }),
  sec('veyiten-lecha', 'motzaei-shabbat', 'ויתן לך', HV('Veyiten Lecha')),
], { reviewed: true });

// ── Bedtime Shema ─────────────────────────────────────────────────────────────────────────────────────────────────
const BS = R('Bedtime Shema');
const bedtimeShema = service('קריאת שמע על המיטה', [
  sec('leshem-yichud', 'bedtime-shema', 'לשם יחוד', BS, { end: 'לשם יחוד קדשא בריך הוא' }),
  sec('mechila', 'bedtime-shema', 'רבונו של עולם — הריני מוחל', BS, { start: 'הריני מוחל וסולח לכל מי שהכעיס' }),
  sec('hamapil', 'bedtime-shema', 'המפיל', BS, { start: 'בברכה זו לא יאמר בשם ומלכות', end: 'המפיל חבלי שנה על עיני' }),
  sec('shema', 'bedtime-shema', 'קריאת שמע', BS, { start: 'צריך להזהר מאד בקריאת שמע שעל המטה', end: 'וחוזר ואומר יהוה אלהיכם אמת' }),
  sec('yaalzu', 'bedtime-shema', 'יעלזו חסידים', BS, { start: 'יעלזו חסידים בכבוד' }),
  sec('yoshev-beseter', 'bedtime-shema', 'יושב בסתר', BS, { start: 'בסתר עליון בצל שדי' }),
  // "ואין לאומרו בליל שבת … וכן במוצאי יו"ט ור"ח" — the edition's own rule, shown with the Vidui.
  sec('vidui', 'bedtime-shema', 'וידוי', BS, { start: 'יעמוד ויאמר וידוי', end: 'ואנחנו הרשענו' }),
  sec('ana-bekoach', 'bedtime-shema', 'אנא בכח', BS, { start: 'אחר כך יאמר "אנא בכח"', end: 'בלחש: ברוך שם כבוד מלכותו' }),
  sec('beyadcha', 'bedtime-shema', 'בידך אפקיד רוחי', BS, { start: 'אתה תקום תרחם ציון' }),
], {
  reviewed: true,
  conditionsPending: ['וידוי: ״אין לאומרו בליל שבת ובשאר ימים שאין אומרים בהם תחנון … במוצ״ש עד חצות … במוצאי יו״ט ור״ח״ — תלוי בלילה ובשעה; מוצג עם הוראת הסידור', 'אנא בכח: הפסוק ״שכנגד אותו הלילה״ — אין מפתח ללילה בשבוע (מוצגים כל השבעה)'],
});

// ── Birkat HaMazon ────────────────────────────────────────────────────────────────────────────────────────────────
const BH = R('Post Meal Blessing');
const birkatHamazon = service('ברכת המזון', [
  sec('mayim-acharonim', 'birkat-hamazon', 'מים אחרונים', BH, { end: 'אברכה את יהוה בכל עת' }),
  sec('zimun', 'birkat-hamazon', 'זימון', BH, { start: 'אם המסובים שלושה או יותר' }),
  sec('hazan', 'birkat-hamazon', 'ברכת הזן', BH, { start: 'האל הזן אותנו ואת העולם' }),
  sec('haaretz', 'birkat-hamazon', 'ברכת הארץ', BH, { start: 'נודה לך יהוה אלהינו על שהנחלת' }),
  sec('al-hanisim', 'birkat-hamazon', 'על הנסים', BH, { start: 'בחנוכה ופורים אומרים', end: 'בפורים אומרים בימי מרדכי', when: 'chanukah|purim' }),
  sec('haaretz-end', 'birkat-hamazon', '', BH, { start: 'על הכל יהוה אלהינו אנחנו מודים לך', continues: true }),
  sec('boneh-yerushalayim', 'birkat-hamazon', 'בונה ירושלים', BH, { start: 'רחם יהוה אלהינו עלינו' }),
  sec('retze', 'birkat-hamazon', 'רצה והחליצנו', BH, { start: 'בשבת אומרים', end: 'רצה והחליצנו', when: 'shabbat' }),
  sec('yaale-veyavo', 'birkat-hamazon', 'יעלה ויבוא', BH, { start: 'בראש חודש ביום טוב ובחול המועד', end: 'לרחם בו עלינו ולהושיענו', when: 'roshChodesh|yomTov|cholHamoed' }),
  sec('boneh-yerushalayim-end', 'birkat-hamazon', '', BH, { start: 'ותבנה ירושלים עירך במהרה', continues: true }),
  sec('forgot', 'birkat-hamazon', 'אם שכח רצה או יעלה ויבוא', BH, { start: 'אם שכח לומר "רצה"', end: 'לשלש רגלים (ו)ימים טובים', when: 'shabbat|roshChodesh|yomTov|cholHamoed' }),
  sec('hatov-vehametiv', 'birkat-hamazon', 'הטוב והמטיב', BH, { start: 'האל אבינו, מלכנו, אדירנו' }),
  sec('harachaman', 'birkat-hamazon', 'הרחמן', BH, { start: 'הרחמן הוא ישתבח על כסא כבודו' }),
  sec('harachaman-shabbat', 'birkat-hamazon', '', BH, { start: 'בשבת', end: 'שכלו שבת ומנוחה', when: 'shabbat', continues: true }),
  sec('harachaman-rc', 'birkat-hamazon', '', BH, { start: "בר''ח", end: 'יחדש עלינו את החדש הזה', when: 'roshChodesh', continues: true }),
  sec('harachaman-rh', 'birkat-hamazon', '', BH, { start: "ברה''ש", end: 'יחדש עלינו את השנה הזאת', when: 'roshHashana', continues: true }),
  sec('harachaman-sukkot', 'birkat-hamazon', '', BH, { start: 'בסוכות', end: 'יקים לנו את סכת דוד', when: 'sukkot', continues: true }),
  sec('harachaman-moadim', 'birkat-hamazon', '', BH, { start: 'במועדים', end: 'יגיענו למועדים אחרים', when: 'yomTov|cholHamoed', continues: true }),
  sec('harachaman-yom-tov', 'birkat-hamazon', '', BH, { start: "ביו''ט", end: 'ינחילנו יום שכלו טוב', when: 'yomTov', continues: true }),
  sec('harachaman-end', 'birkat-hamazon', '', BH, { start: 'יטע תורתו ואהבתו בלבנו', end: 'יטע תורתו ואהבתו בלבנו', continues: true }),
  sec('harachaman-guest', 'birkat-hamazon', 'ברכת האורח', BH, { start: 'אורח אומר הרחמן הוא יברך', role: 'optional' }),
  sec('migdol', 'birkat-hamazon', 'הרחמן הוא יחינו — מגדיל ישועות', BH, { start: 'יחינו ויזכנו ויקרבנו לימות המשיח' }),
], { reviewed: true });

// ── Hallel ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const hallelService = service('הלל', [
  ...hallelSections('', null),
  omit('rc-torah-and-ashrei', HALLEL, { start: 'קודם הוצאת ספר תורה אומרים', why: 'הוצאת ספר תורה, קריאת ראש חודש ואשרי — מודפסים באותו קטע אחרי ההלל, אך אינם חלק מההלל (הם בשחרית של ראש חודש)' }),
], { reviewed: true });

// ── Musaf of Rosh Chodesh ────────────────────────────────────────────────────────────────────────────────────────
const roshChodeshMusaf = service('מוסף לראש חודש', [
  omit('rc-song-and-return', RC('Song of the Day'), { end: 'יהללו את שם יהוה', why: 'שיר של יום והחזרת ספר התורה — שייכים לשחרית של ראש חודש, לפני המוסף' }),
  sec('leshem-yichud', 'musaf', 'לשם יחוד', RC('Song of the Day'), { start: 'לשם יחוד קדשא בריך הוא' }),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', RC('Song of the Day'), { start: 'אומר החזן חצי קדיש וחולצין תפילין', role: 'minyan' }),
  ...rcMusafSections('', null, 'ברכת אבות'),
  ...rcEndingSections('', null),
], { reviewed: true });

// ── Counting of the Omer (the service by itself) ─────────────────────────────────────────────────────────────────
const omerService = service('ספירת העומר', omerSections('', null), {
  reviewed: true,
  conditionsPending: ['טבלת 49 הימים מוצגת כולה — אין עדיין מפתח ליום הספירה (omerDay)'],
});

// ── The festival Amidah (Shacharit, Mincha, Arvit of the Three Festivals) ─────────────────────────────────────────
const FEST = path => R(`Prayers for Three Festivals, ${path}`);
const festivalAmidah = service('עמידה לשלוש רגלים', [
  sec('avot', 'festival-amidah', 'ברכת אבות', FEST('Amidah'), { end: 'מגן אברהם' }),
  sec('gevurot', 'festival-amidah', 'גבורות', FEST('Amidah'), { start: 'אתה גבור לעולם', end: 'מחיה המתים' }),
  sec('kedusha', 'kedusha', 'קדושה', FEST('Amidah'), { start: 'קדושה בחזרת הש"ץ של שחרית ומנחה', end: 'נקדישך ונעריצך', role: 'repetition' }),
  sec('kedushat-hashem', 'festival-amidah', 'קדושת השם', FEST('Amidah'), { start: 'אתה קדוש ושמך קדוש' }),
  sec('ata-vechartanu', 'festival-amidah', 'אתה בחרתנו', FEST('Amidah'), { start: 'אתה בחרתנו מכל העמים' }),
  sec('vatodienu', 'festival-amidah', 'ותודיענו', FEST('Amidah'), { start: 'במוצאי שבת אומרים', end: 'ותודיענו משפטי צדקך', when: 'motzaeiShabbat' }),
  sec('vatiten-lanu', 'festival-amidah', '', FEST('Amidah'), { start: 'ותתן לנו יהוה אלהינו באהבה', end: 'באהבה מקרא קדש זכר ליציאת מצרים', continues: true }),
  sec('yaale-veyavo', 'festival-amidah', 'יעלה ויבוא', FEST('Amidah'), { start: 'יעלה ויבא, ויגיע ויראה', end: 'ביום טוב מקרא קדש הזה,לרחם' }),
  sec('vehasienu', 'festival-amidah', 'והשיאנו', FEST('Amidah'), { start: 'והשיאנו יהוה אלהינו את ברכת מועדיך', end: 'מקדש בשבת השבת' }),
  sec('retze', 'festival-amidah', 'רצה', FEST('Amidah'), { start: 'רצה יהוה אלהינו בעמך' }),
  sec('modim', 'festival-amidah', 'מודים', FEST('Amidah'), { start: 'בברכת "מודים" יכרע', end: 'כי מעולם קוינו לך' }),
  sec('modim-derabanan', 'modim-derabanan', 'מודים דרבנן', FEST('Amidah'), { start: 'מודים דרבנן', role: 'repetition' }),
  sec('modim-end', 'festival-amidah', '', FEST('Amidah'), { start: 'ועל כלם יתברך', continues: true }),
  sec('birkat-kohanim', 'birkat-kohanim', 'ברכת כהנים', FEST('Amidah'), { start: 'ברכת כהנים', end: 'ושמו את שמי על בני ישראל', role: 'repetition' }),
  sec('sim-shalom', 'festival-amidah', 'שים שלום', FEST('Amidah'), { start: 'שים שלום טובה וברכה' }),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', FEST('Amidah'), { start: 'יהיו לרצון אמרי פי', end: 'שתבנה בית המקדש' }),
  omit('after-amidah', FEST('Amidah'), { start: 'אחרי החזרה אומרים', why: 'מה שנאמר אחרי העמידה (יהי שם, ויכולו בשבת, מזמורים, קדיש ועלינו של ערבית) — אינו חלק מהעמידה' }),
], { reviewed: true });

// ── Musaf of the Three Festivals ────────────────────────────────────────────────────────────────────────────────
const festivalMusaf = service('מוסף לשלוש רגלים', [
  sec('avot', 'musaf', 'ברכת אבות', FEST('Mussaf'), { end: 'אלהי אברהם, אלהי יצחק' }),
  sec('gevurot', 'musaf', 'גבורות', FEST('Mussaf'), { start: 'אתה גבור לעולם', end: 'מכלכל חיים בחסד' }),
  sec('keter-yom-tov', 'kedusha', 'קדושה — כתר', FEST('Mussaf'), { start: 'בחזרת הש"ץ במוסף של יו"ט או שבת', end: 'כתר יתנו לך', role: 'repetition', when: '!cholHamoed|shabbat' }),
  sec('keter-chol-hamoed', 'kedusha', 'קדושה — כתר', FEST('Mussaf'), { start: 'בחזרת הש"ץ במוסף של חול המועד', end: 'כתר יתנו לך', role: 'repetition', when: 'cholHamoed&!shabbat' }),
  sec('kedushat-hashem', 'musaf', 'קדושת השם', FEST('Mussaf'), { start: 'אתה קדוש ושמך קדוש' }),
  sec('ata-vechartanu', 'musaf', 'אתה בחרתנו', FEST('Mussaf'), { start: 'אתה בחרתנו מכל העמים', end: 'באהבה מקרא קדש זכר ליציאת מצרים' }),
  sec('mipnei-chataeinu', 'musaf', 'ומפני חטאינו', FEST('Mussaf'), { start: 'מפני חטאינו גלינו מארצנו', end: 'יקם איש כמתנת ידו' }),
  sec('vehasienu', 'musaf', 'והשיאנו', FEST('Mussaf'), { start: 'והשיאנו יהוה אלהינו את ברכת מועדיך', end: 'שבענו מטובך, שמח נפשנו' }),
  sec('retze', 'musaf', 'רצה', FEST('Mussaf'), { start: 'רצה יהוה אלהינו בעמך' }),
  sec('modim', 'musaf', 'מודים', FEST('Mussaf'), { start: 'בברכת "מודים" יכרע', end: 'כי מעולם קוינו לך' }),
  sec('modim-derabanan', 'modim-derabanan', 'מודים דרבנן', FEST('Mussaf'), { start: 'מודים דרבנן', role: 'repetition' }),
  sec('modim-end', 'musaf', '', FEST('Mussaf'), { start: 'ועל כלם יתברך', continues: true }),
  sec('birkat-kohanim', 'birkat-kohanim', 'ברכת כהנים', FEST('Mussaf'), { start: 'ברכת כהנים', end: 'ושמו את שמי על בני ישראל', role: 'repetition' }),
  sec('sim-shalom', 'musaf', 'שים שלום', FEST('Mussaf'), { start: 'שים שלום טובה וברכה' }),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', FEST('Mussaf'), { start: 'יהיו לרצון אמרי פי', end: 'שתבנה בית המקדש' }),
  sec('after-repetition', 'closing-passages', 'אחרי החזרה', FEST('Mussaf'), { start: 'ביום טוב אחרי החזרה אומרים יהי שם', end: 'בחול המועד אחרי החזרה אומרים יהי שם' }),
  omit('other-festival-texts', FEST('Mussaf'), { start: 'קידוש לילי ראש השנה', why: 'קידוש ראש השנה, סימני ראש השנה, אושפיזין, קידוש ליל שלוש רגלים, זוהר לסעודות ושירי סוכות — מודפסים באותו קטע אך אינם חלק מתפילת המוסף' }),
  // "ביום טוב אחרי החזרה אומרים יהי שם, ואחריו אומר הש"ץ קדיש תתקבל … ובחול המועד … ואומרים המזמור השיך לאותו
  // יום טוב, וקדיש יהא שלמא וקוה עד הסוף" (¶57–58): Yehi Shem and Kaddish Titkabal as printed in the Rosh Chodesh Musaf.
  omit('rc-musaf-amidah', RC('Mussaf'), { end: 'שתבנה בית המקדש', why: 'עמידת מוסף של ראש חודש — נלקחים ממנה רק יהי שם וקדיש תתקבל, כהוראת הסידור (¶57–58)' }),
  sec('yehi-shem', 'closing-passages', 'יהי שם', RC('Mussaf'), { start: 'אחרי חזרת הש', end: 'מה אדיר שמך בכל הארץ' }),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', RC('Mussaf'), { start: 'ואומר החזן קדיש תתקבל', role: 'minyan' }),
  // Yom Tov: "וממשיכים כל ישראל כמו בשבת".
  omit('shabbat-musaf-amidah', SM('Amida'), { end: 'יפסע שלש פסיעות', why: 'מוסף של שבת — ביום טוב ממשיכים ממנו רק מ"כל ישראל" (הוראת הסידור ¶57)' }),
  ...shabbatMusafEnding('!cholHamoed'),
  sec('mizmor-shir-shabbat', 'song-of-day', 'מזמור שיר ליום השבת', SM('Alenu'), { start: 'מזמור שיר ליום השבת', when: 'shabbat&!cholHamoed' }),
  // Chol HaMoed: the festival's psalm, Kaddish Yehe Shelama, and Kaveh to the end.
  sec('psalm-pesach', 'closing-passages', 'מזמור לפסח', FEST('Song for Passover'), { when: 'cholHamoed&pesach' }),
  sec('psalm-sukkot', 'closing-passages', 'מזמור לסוכות', FEST('Song for Sukkot'), { when: 'cholHamoed&sukkot' }),
  omit('barchi-nafshi', RC('Barchi Nafshi'), { end: 'נפשי את יהוה יהוה אלהי גדלת מאד', why: 'ברכי נפשי — לראש חודש בלבד; נלקח מכאן רק קדיש יהא שלמא' }),
  sec('kaddish-yehe-shlama', 'kaddish-yatom', 'קדיש יהא שלמא', RC('Barchi Nafshi'), { start: 'ואומרים קדיש יהא שלמא', role: 'mourners', when: 'cholHamoed' }),
  sec('kaveh-chm', 'kaveh', 'קוה', SH('Kaveh'), { end: 'קוה אל יהוה חזק', when: 'cholHamoed' }),
  sec('ein-keloheinu-chm', 'ein-keloheinu', 'אין כאלהינו', SH('Kaveh'), { start: 'אין כאלהינו, אין כאדוננו', when: 'cholHamoed' }),
  sec('ketoret-chm', 'ketoret', 'פטום הקטורת', SH('Kaveh'), { start: 'פטום הקטורת', end: 'תנא דבי אליהו', when: 'cholHamoed' }),
  sec('kaddish-al-yisrael-chm', 'kaddish-derabanan', 'קדיש על ישראל', SH('Kaveh'), { start: 'ואומרים קדיש "על ישראל"', end: 'יהא שלמא רבא', role: 'minyan', when: 'cholHamoed' }),
  sec('barchu-chm', 'barchu', 'ברכו', SH('Kaveh'), { start: 'ברכו את יהוה המברך', role: 'minyan', when: 'cholHamoed' }),
  sec('aleinu-chm', 'aleinu', 'עלינו לשבח', SH('Alenu'), { end: 'ובתורתך יהוה אלהינו כתוב', when: 'cholHamoed' }),
  sec('vayomer-im-shamoa-chm', 'closing-passages', 'ויאמר אם שמוע', SH('Alenu'), { start: 'ויאמר אם שמוע תשמע', when: 'cholHamoed' }),
  sec('ledavid-chm', 'ledavid-ori', 'לדוד ה׳ אורי', SH('Alenu'), { start: 'יהוה אורי וישעי', when: 'cholHamoed&ledavid' }),
], {
  reviewed: true,
  conditionsPending: ['פסוקי קרבן המוסף של היום (״כמו שכתבת עלינו בתורתך … כאמור״) אינם מודפסים במהדורה: ¶26 מסתיים ״על ידי משה עבדך.״ ומיד ¶27 ״אלהינו ואלהי אבותינו מלך רחמן״'],
});

export default {
  nusach: 'edot-hamizrach',
  index: 'Siddur Edot HaMizrach',
  services: {
    'weekday-shacharit': weekdayShacharit,
    'weekday-mincha': weekdayMincha,
    'weekday-maariv': weekdayMaariv,
    'bedtime-shema': bedtimeShema,
    'kabbalat-shabbat': kabbalatShabbat,
    'shabbat-maariv': shabbatMaariv,
    'shabbat-kiddush': shabbatKiddush,
    'shabbat-shacharit': shabbatShacharit,
    'shabbat-musaf': shabbatMusaf,
    'shabbat-kiddush-day': shabbatKiddushDay,
    'shabbat-mincha': shabbatMincha,
    havdalah,
    'birkat-hamazon': birkatHamazon,
    hallel: hallelService,
    'rosh-chodesh-musaf': roshChodeshMusaf,
    omer: omerService,
    'festival-amidah': festivalAmidah,
    'festival-musaf': festivalMusaf,
  },
  // Services of the schema that the licensed edition does not contain: schema id → reason.
  sourceGaps: {},
};
