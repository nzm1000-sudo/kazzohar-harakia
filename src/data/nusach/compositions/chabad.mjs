// Nusach Chabad (Arizal), composed from Sefaria's "Weekday Siddur Chabad" (Siddur Torah Or, Wikisource, CC BY-SA).
// Every section is a slice of that edition — see dsl.mjs for the vocabulary and prayerSchema.mjs for the concepts.
// The edition's leaves are coarse (Maariv is one leaf; each Amidah is one leaf), so the sections are cut by anchors
// inside the leaves. Review notes: docs/siddur/notes-chabad.md.
import { sec, omit, service, leaf } from './dsl.mjs';

const R = leaf('Weekday Siddur Chabad');
const SH = path => R(`Shacharit, ${path}`);
const MI = path => R(`Mincha, ${path}`);
const MAARIV = R('Maariv');
const OMER = R('Sefirat HaOmer');
const HALLEL = R('Hallel');
const MOURNERS = SH("Mourner's Kaddish");

// "a&b" of two condition expressions (each an OR of ANDs): the product, still an OR of ANDs.
function andWhen(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a.split('|').flatMap(x => b.split('|').map(y => `${x}&${y}`)).join('|');
}
// A block of sections said only under a condition, with ids of their own inside the service.
const scoped = (sections, prefix, condition) => sections.map(section => ({ ...section, id: `${prefix}${section.id}`, when: andWhen(condition, section.when) }));
const RC_CHM = 'roshChodesh|cholHamoed';
const ORDINARY = '!roshChodesh&!cholHamoed';

// ── The weekday Amidah ────────────────────────────────────────────────────────────────────────────────────────────
// The three weekday Amidot of the edition are printed alike; `kind` picks what each one has of its own:
//   shacharit — the chazzan's Aneinu and Kedusha, Birkat Kohanim daily in the repetition;
//   mincha    — also the individual's Aneinu, Nachem on Tisha B'Av, Birkat Kohanim on a fast day;
//   maariv    — no repetition; Atah Chonantanu on Motzaei Shabbat.
// Nusach HaAri says Sim Shalom at every Amidah (no Shalom Rav), as the edition prints.
function weekdayAmidah(ref, kind, p = '') {
  const id = name => `${p}${name}`;
  const repetition = kind !== 'maariv';
  return [
    sec(id('avot'), 'amidah', 'ברכת אבות', ref, { start: 'שפתי תפתח' }),
    sec(id('gevurot'), 'amidah', 'גבורות', ref, { start: 'אתה גבור לעולם' }),
    ...(repetition ? [sec(id('kedusha'), 'kedusha', 'קדושה', ref, { start: 'כשהש"ץ חוזר הש"ע', role: 'repetition' })] : []),
    sec(id('kedushat-hashem'), 'amidah', 'קדושת השם', ref, { start: 'אתה קדוש ושמך קדוש' }),
    ...(kind === 'maariv' ? [
      sec(id('daat'), 'amidah', 'חונן הדעת', ref, { start: 'אתה חונן לאדם דעת' }),
      sec(id('atah-chonantanu'), 'amidah', 'אתה חוננתנו', ref, { start: 'במוצאי שבת ויום טוב אומרים', when: 'motzaeiShabbat' }),
      sec(id('daat-end'), 'amidah', '', ref, { start: 'חננו מאתך חכמה', continues: true }),
    ] : [
      sec(id('daat'), 'amidah', 'חונן הדעת', ref, { start: 'אתה חונן לאדם דעת' }),
    ]),
    sec(id('teshuva'), 'amidah', 'תשובה', ref, { start: 'השיבנו אבינו לתורתך' }),
    sec(id('selicha'), 'amidah', 'סליחה', ref, { start: 'סלח לנו אבינו' }),
    sec(id('geula'), 'amidah', 'גאולה', ref, { start: 'ראה נא בענינו' }),
    ...(repetition ? [sec(id('aneinu-chazzan'), 'amidah', 'עננו', ref, { start: 'אומר הש"ץ כאן עננו', role: 'repetition', when: 'fast' })] : []),
    sec(id('refua'), 'amidah', 'רפואה', ref, { start: 'רפאנו יי ונרפא' }),
    sec(id('birkat-hashanim'), 'amidah', 'ברכת השנים', ref, { start: 'ברך עלינו יי אלהינו את השנה' }),
    sec(id('kibbutz-galuyot'), 'amidah', 'קיבוץ גלויות', ref, { start: 'תקע בשופר גדול' }),
    sec(id('mishpat'), 'amidah', 'השבת המשפט', ref, { start: 'השיבה שופטינו' }),
    sec(id('minim'), 'amidah', 'ברכת המינים', ref, { start: 'ולמלשינים אל תהי תקוה' }),
    sec(id('tzadikim'), 'amidah', 'על הצדיקים', ref, { start: 'על הצדיקים ועל החסידים' }),
    sec(id('yerushalayim'), 'amidah', 'בונה ירושלים', ref, { start: 'עירך ברחמים תשוב' }),
    ...(kind === 'mincha' ? [sec(id('nachem'), 'amidah', 'נחם', ref, { start: 'במנחת תשעה באב', when: 'tishaBav' })] : []),
    sec(id('malchut-david'), 'amidah', 'מלכות בית דוד', ref, { start: 'את צמח דוד עבדך' }),
    ...(kind === 'mincha' ? [
      sec(id('shomea-tefila'), 'amidah', 'שומע תפילה', ref, { start: 'שמע קולנו יי אלהינו' }),
      sec(id('aneinu'), 'amidah', 'עננו', ref, { start: 'בתענית צבור יאמר כאן עננו', when: 'fast' }),
      sec(id('shomea-tefila-end'), 'amidah', '', ref, { start: 'כי אתה שומע תפלת כל פה', continues: true }),
    ] : [
      sec(id('shomea-tefila'), 'amidah', 'שומע תפילה', ref, { start: 'שמע קולנו יי אלהינו' }),
    ]),
    sec(id('retze'), 'amidah', 'רצה', ref, { start: 'רצה יי אלהינו בעמך ישראל' }),
    sec(id('yaale-veyavo'), 'amidah', 'יעלה ויבוא', ref, { start: 'בראש חודש ובחול המועד אומרים', when: 'roshChodesh|cholHamoed' }),
    sec(id('retze-end'), 'amidah', '', ref, { start: 'ותחזינה עינינו', continues: true }),
    sec(id('modim'), 'amidah', 'מודים', ref, { start: 'מודים אנחנו לך' }),
    ...(repetition ? [sec(id('modim-derabanan'), 'modim-derabanan', 'מודים דרבנן', ref, { start: 'מודים דרבנן', role: 'repetition' })] : []),
    sec(id('al-hanisim'), 'amidah', 'על הנסים', ref, { start: 'בחנוכה ופורים אומרים כאן', when: 'chanukah|purim' }),
    sec(id('al-hanisim-chanukah'), 'amidah', 'בימי מתתיהו', ref, { start: 'לחנוכה', when: 'chanukah', continues: true }),
    sec(id('al-hanisim-purim'), 'amidah', 'בימי מרדכי ואסתר', ref, { start: 'לפורים', when: 'purim', continues: true }),
    sec(id('modim-end'), 'amidah', '', ref, { start: 'ועל כלם יתברך', continues: true }),
    ...(kind === 'shacharit' ? [sec(id('birkat-kohanim'), 'birkat-kohanim', 'ברכת כהנים', ref, { start: 'לשליח ציבור', role: 'repetition' })] : []),
    ...(kind === 'mincha' ? [sec(id('birkat-kohanim'), 'birkat-kohanim', 'ברכת כהנים', ref, { start: 'בתענית ציבור אומר השליח ציבור', role: 'repetition', when: 'fast' })] : []),
    sec(id('sim-shalom'), 'amidah', 'שים שלום', ref, { start: 'שים שלום', end: 'יהיו לרצון אמרי פי' }),
    sec(id('elokai-netzor'), 'elokai-netzor', 'אלהי נצור', ref, { start: 'נצור לשוני מרע', end: 'שיבנה בית המקדש' }),
  ];
}

// ── Tachanun (Shacharit and Mincha print it alike; the Shacharit leaf adds the Monday/Thursday supplications) ──────
function tachanun(ref, kind) {
  return [
    sec('vidui', 'vidui', 'וידוי ושלש עשרה מדות', ref, { start: 'אחר שמונה עשרה', when: 'tachanun' }),
    sec('nefilat-apayim', 'tachanun', 'נפילת אפים', ref, { start: 'לדוד אליך יי נפשי אשא', when: 'tachanun' }),
    ...(kind === 'shacharit' ? [sec('tachanun-mon-thu', 'tachanun', 'והוא רחום · לשני ולחמישי', ref, { start: 'לשני וחמישי', end: 'מה שמוסיפין בשני ובחמישי', when: 'mondayThursday&tachanun' })] : []),
    sec('avinu-malkeinu', 'avinu-malkeinu', 'אבינו מלכנו', ref, { start: 'בתענית ציבור ובעשי"ת אומרים כאן אבינו מלכנו', when: 'avinuMalkeinu' }),
    sec('vaanachnu', 'tachanun', 'ואנחנו לא נדע', ref, { start: 'אבינו מלכנו אבינו אתה', end: 'ואנחנו לא נדע מה נעשה', when: 'tachanun' }),
  ];
}

// ── The Counting of the Omer (its own service, and inside Maariv in its days) ─────────────────────────────────────
function omerSections(p = '', when) {
  const w = when ? { when } : {};
  return [
    sec(`${p}omer-blessing`, 'omer', 'ספירת העומר', OMER, { end: 'על ספירת העמר', ...w }),
    sec(`${p}omer-count`, 'omer', 'סדר הספירה', OMER, { start: 'יכוין לספירה של אותו הלילה', end: 'היום תשעה וארבעים יום', ...w }),
    sec(`${p}omer-harachaman`, 'omer', 'הרחמן', OMER, { start: 'הרחמן הוא יחזיר לנו', ...w }),
    sec(`${p}omer-lamenatzeach`, 'omer', 'למנצח בנגינות', OMER, { start: 'למנצח בנגינות', ...w }),
    sec(`${p}omer-ana-bekoach`, 'omer', 'אנא בכח', OMER, { start: 'בכח גדלת ימינך', ...w }),
    sec(`${p}omer-ribono`, 'omer', 'רבונו של עולם', OMER, { start: 'אתה צויתנו על ידי משה עבדך לספר', ...w }),
  ];
}

// ── Hallel (its own service, and inside Shacharit on its days) ───────────────────────────────────────────────────
// On Rosh Chodesh and the last days of Pesach (half Hallel) "לא לנו" and "אהבתי" are skipped from their start to
// the verse the edition marks. The edition's caption for it ("בראש חודש ובחוה"מ פסח מדלגין:") is kept at the END of
// the section before the skipped verses, so that it is shown as an instruction and governs nothing.
function hallelSections() {
  return [
    sec('hallel', 'hallel', 'הלל', HALLEL, { end: 'מדלגין' }),
    sec('lo-lanu', 'hallel', '', HALLEL, { start: 'לא לנו יי לא לנו', when: 'fullHallel', continues: true }),
    sec('hashem-zecharanu', 'hallel', '', HALLEL, { start: 'יי זכרנו יברך', end: 'מדלגין', continues: true }),
    sec('ahavti', 'hallel', '', HALLEL, { start: 'אהבתי כי ישמע', when: 'fullHallel', continues: true }),
    sec('ma-ashiv', 'hallel', '', HALLEL, { start: 'מה אשיב ליי', end: 'מלך מהלל בתשבחות', continues: true }),
    sec('veavraham-zaken', 'hallel', 'ואברהם זקן', HALLEL, { start: 'יש נוהגין לומר בר"ח אחר הלל', end: 'כל זה יאמר ג\' פעמים', role: 'optional', when: 'roshChodesh' }),
    sec('hallel-after', 'hallel', 'אחר ההלל', HALLEL, { start: 'בראש חדש [אחר אמירת הלל]' }),
  ];
}

// ── Musaf of Rosh Chodesh and of Chol HaMoed (their own services, and inside Shacharit on their days) ─────────────
const RC = R('Rosh Chodesh');
function roshChodeshMusafSections() {
  return [
    sec('half-kaddish', 'half-kaddish', 'חצי קדיש', RC, { end: 'דאמירן בעלמא', role: 'minyan' }),
    sec('avot', 'musaf', 'ברכת אבות', RC, { start: 'שפתי תפתח' }),
    sec('gevurot', 'musaf', 'גבורות', RC, { start: 'אתה גבור לעולם' }),
    sec('kedusha', 'kedusha', 'קדושה', RC, { start: 'כשהש"ץ חוזר הש"ע', role: 'repetition' }),
    sec('kedushat-hashem', 'musaf', 'קדושת השם', RC, { start: 'אתה קדוש ושמך קדוש' }),
    sec('kedushat-hayom', 'musaf', 'ראשי חדשים', RC, { start: 'ראשי חדשים לעמך נתת', end: 'מקדש ישראל וראשי חדשים' }),
    sec('retze', 'musaf', 'רצה', RC, { start: 'רצה יי אלהינו בעמך ישראל' }),
    sec('modim', 'musaf', 'מודים', RC, { start: 'מודים אנחנו לך' }),
    sec('modim-derabanan', 'modim-derabanan', 'מודים דרבנן', RC, { start: 'מודים דרבנן', role: 'repetition' }),
    sec('al-hanisim', 'musaf', 'על הנסים', RC, { start: 'בחנוכה אומרים כאן', end: 'בימי מתתיהו בן יוחנן', when: 'chanukah' }),
    sec('modim-end', 'musaf', '', RC, { start: 'ועל כלם יתברך', continues: true }),
    sec('birkat-kohanim', 'birkat-kohanim', 'ברכת כהנים', RC, { start: 'לשליח ציבור', role: 'repetition' }),
    sec('sim-shalom', 'musaf', 'שים שלום', RC, { start: 'שים שלום', end: 'יהיו לרצון אמרי פי' }),
    sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', RC, { start: 'נצור לשוני מרע', end: 'שיבנה בית המקדש' }),
    sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', RC, { start: 'הש"ץ אומר קדיש שלם', role: 'minyan' }),
  ];
}

const FM = R('Musaf for Festivals');
function cholHamoedMusafSections() {
  return [
    sec('half-kaddish', 'half-kaddish', 'חצי קדיש', FM, { end: 'דאמירן בעלמא', role: 'minyan' }),
    sec('avot', 'musaf', 'ברכת אבות', FM, { start: 'שפתי תפתח' }),
    sec('gevurot', 'musaf', 'גבורות', FM, { start: 'אתה גבור לעולם' }),
    sec('kedusha', 'kedusha', 'קדושה', FM, { start: 'כשהש"ץ חוזר הש"ע', role: 'repetition' }),
    sec('kedushat-hashem', 'musaf', 'קדושת השם', FM, { start: 'אתה קדוש ושמך קדוש' }),
    sec('ata-bechartanu', 'musaf', 'אתה בחרתנו', FM, { start: 'אתה בחרתנו מכל העמים', end: 'מפי כבודך כאמור' }),
    sec('korbanot-pesach', 'musaf', 'מוסף חול המועד פסח', FM, { start: 'בחוה"מ פסח', end: 'ושני תמידים כהלכתם', when: 'pesach' }),
    sec('korbanot-sukkot', 'musaf', 'מוסף חול המועד סוכות', FM, { start: 'ליום ראשון של חול המועד סוכות', end: /תמידים כהלכתם:$/, when: 'sukkot' }),
    sec('melech-rachaman', 'musaf', 'מלך רחמן', FM, { start: 'מלך רחמן רחם עלינו' }),
    sec('vehasienu', 'musaf', 'והשיאנו', FM, { start: 'והשיאנו יי אלהינו' }),
    sec('retze', 'musaf', 'רצה', FM, { start: 'רצה יי אלהינו בעמך ישראל' }),
    sec('modim', 'musaf', 'מודים', FM, { start: 'מודים אנחנו לך' }),
    sec('modim-derabanan', 'modim-derabanan', 'מודים דרבנן', FM, { start: 'מודים דרבנן', role: 'repetition' }),
    sec('modim-end', 'musaf', '', FM, { start: 'ועל כלם יתברך', continues: true }),
    sec('birkat-kohanim', 'birkat-kohanim', 'ברכת כהנים', FM, { start: 'לשליח ציבור', role: 'repetition' }),
    sec('sim-shalom', 'musaf', 'שים שלום', FM, { start: 'שים שלום', end: 'יהיו לרצון אמרי פי' }),
    sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', FM, { start: 'נצור לשוני מרע', end: 'שיבנה בית המקדש' }),
  ];
}
const SUKKOT_PENDING = 'the Sukkot Musaf verses of each day of Chol HaMoed (and the diaspora additions) — the app has no key for the day of Sukkot, so all of them are shown on every day of Chol HaMoed Sukkot';

// ── The Song of the Day: after Beit Yaakov on an ordinary day; on Rosh Chodesh and Chol HaMoed right after Hallel
// and its Kaddish, before the Torah reading (the edition's instruction after Hallel, ¶26). `days` = the extra condition.
const SONG = SH('Song of the Day');
const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
const DAY_STARTS = ['שיר של יום', 'בשני בשבת', 'בשלישי בשבת', 'ברביעי בשבת', 'בחמישי בשבת', 'בשישי בשבת'];
function songOfDay(p, extra, options = {}) {
  return DAY_STARTS.map((start, day) => sec(`${p}song-day${day}`, 'song-of-day', `שיר של יום · יום ${DAY_NAMES[day]}`, SONG,
    { start, end: 'קדיש יתום', when: andWhen(`day${day}`, extra), ...options }));
}

// ── Weekday Shacharit ─────────────────────────────────────────────────────────────────────────────────────────────
const weekdayShacharit = service('שחרית לימות החול', [
  sec('modeh-ani', 'modeh-ani', 'מודה אני', SH('Upon Arising')),
  sec('netilat-yadayim', 'netilat-yadayim', 'נטילת ידים', SH('Morning Blessings'), { end: 'וצונו על נטילת ידים' }),
  sec('asher-yatzar', 'morning-blessings', 'אשר יצר', SH('Morning Blessings'), { start: 'צריך להיות צנוע', end: 'ומפליא לעשות' }),
  sec('elokai-neshama', 'morning-blessings', 'אלהי נשמה', SH('Morning Blessings'), { start: 'נשמה שנתת בי' }),
  sec('birchot-hashachar', 'morning-blessings', 'ברכות השחר', SH('Morning Blessings'), { start: 'כל הברכות הללו מברך', end: 'ומדינה של גיהנם' }),
  sec('birchot-hatorah', 'torah-blessings', 'ברכות התורה', SH('Morning Blessings'), { start: 'ברכת התורה צריך ליזהר' }),
  sec('tzitzit', 'tallit', 'ציצית', SH('Tzitzit and Tallit'), { end: 'על מצות ציצית' }),
  // No Tallit Gadol and Tefillin at Shacharit of Tisha B'Av (they are put on at Mincha); no Tefillin on Chol HaMoed
  // in the Chabad custom (the Arizal's).
  sec('tallit', 'tallit', 'עטיפת טלית גדול', SH('Tzitzit and Tallit'), { start: 'סדר לבישת טלית גדול', when: '!tishaBav' }),
  sec('tefillin', 'tefillin', 'הנחת תפילין', SH('Tefillin'), { when: '!tishaBav&!cholHamoed' }),
  sec('hareini', 'morning-prayers', 'הריני מקבל', SH('Morning Prayer'), { end: 'ואהבת לרעך כמוך' }),
  sec('ma-tovu', 'morning-prayers', 'מה טבו', SH('Morning Prayer'), { start: 'מה טבו אהליך' }),
  sec('adon-olam', 'morning-prayers', 'אדון עולם', SH('Morning Prayer'), { start: 'אדון עולם אשר מלך' }),
  sec('akeda-intro', 'morning-prayers', 'זכרנו בזכרון טוב', SH('Morning Prayer'), { start: 'זכרנו בזכרון טוב לפניך', when: 'tachanun' }),
  sec('akeda', 'morning-prayers', 'פרשת העקדה', SH('Morning Prayer'), { start: 'ויהי אחר הדברים האלה' }),
  sec('akeda-ribono', 'morning-prayers', 'רבונו של עולם', SH('Morning Prayer'), { start: 'ביום שאין אומרים תחנון אין אומרים זה', end: 'יקרא לכל העמים', when: 'tachanun' }),
  sec('leolam', 'morning-prayers', 'לעולם יהא אדם', SH('Morning Prayer'), { start: 'לעולם יהא אדם ירא שמים', end: 'בשובי את שבותיכם' }),
  sec('terumat-hadeshen', 'korbanot', 'תרומת הדשן', SH('Morning Prayer'), { start: 'נכון מאוד לומר בכל יום פרשת תרומת הדשן', end: 'אש תמיד תוקד' }),
  sec('korbanot-yehi-ratzon', 'korbanot', 'יהי רצון', SH('Morning Prayer'), { start: 'שתרחם עלינו', when: 'tachanun' }),
  sec('tamid', 'korbanot', 'פרשת התמיד', SH('Morning Prayer'), { start: 'צו את בני ישראל ואמרת אלהם', end: 'את דמו על המזבח סביב' }),
  sec('ketoret', 'ketoret', 'פטום הקטרת', SH('Morning Prayer'), { start: 'שהקטירו אבותינו לפניך את קטרת', end: 'כימי עולם וכשנים קדמניות' }),
  sec('abaye', 'korbanot', 'אביי הוה מסדר', SH('Morning Prayer'), { start: 'אביי הוה מסדר' }),
  sec('ana-bekoach', 'korbanot', 'אנא בכח', SH('Morning Prayer'), { start: 'בכח גדלת ימינך' }),
  sec('ribon-haolamim', 'korbanot', 'רבון העולמים', SH('Morning Prayer'), { start: 'להקריב קרבן התמיד במועדו', when: 'tachanun' }),
  sec('eizehu-mekoman', 'korbanot', 'איזהו מקומן', SH('Morning Prayer'), { start: 'איזהו מקומן של זבחים', end: 'ואינו נאכל אלא צלי' }),
  sec('rabbi-yishmael', 'korbanot', 'ברייתא דרבי ישמעאל', SH('Morning Prayer'), { start: 'רבי ישמעאל אומר' }),
  sec('kaddish-derabanan', 'kaddish-derabanan', 'קדיש דרבנן', SH('Kaddish DeRabbanan'), { role: 'minyan' }),
  sec('hodu', 'hodu', 'הודו', SH('Hodu'), { end: 'הושיעה את עמך וברך את נחלתך' }),
  sec('mizmor-shir', 'mizmor-shir', 'מזמור שיר חנכת הבית', SH('Hodu'), { start: 'מזמור שיר חנכת הבית' }),
  sec('kaddish-yatom-mizmor', 'kaddish-yatom', 'קדיש יתום', MOURNERS, { role: 'mourners' }),
  sec('hashem-melech', 'hodu', 'יי מלך', SH('Hodu'), { start: 'יי מלך, יי מלך' }),
  sec('baruch-sheamar', 'baruch-sheamar', 'ברוך שאמר', SH('Pesukei Dezimra'), { end: 'מלך מהלל בתשבחות' }),
  sec('mizmor-letoda', 'pesukei-dezimra', 'מזמור לתודה', SH('Pesukei Dezimra'), { start: 'מזמור לתודה' }),
  sec('yehi-chevod', 'pesukei-dezimra', 'יהי כבוד', SH('Pesukei Dezimra'), { start: 'יהי כבוד יי לעולם' }),
  sec('ashrei-pz', 'pesukei-dezimra', 'אשרי', SH('Pesukei Dezimra'), { start: 'אשרי יושבי ביתך' }),
  sec('halleluya', 'pesukei-dezimra', 'הללויה', SH('Pesukei Dezimra'), { start: 'הללויה הללי נפשי' }),
  sec('vayevarech-david', 'pesukei-dezimra', 'ויברך דויד', SH('Pesukei Dezimra'), { start: 'ברוך יי לעולם אמן' }),
  sec('az-yashir', 'az-yashir', 'שירת הים', SH('Pesukei Dezimra'), { start: 'ויושע יי ביום ההוא' }),
  sec('yishtabach', 'yishtabach', 'ישתבח', SH('Pesukei Dezimra'), { start: 'ישתבח שמך לעד' }),
  sec('mimaamakim', 'pesukei-dezimra', 'שיר המעלות ממעמקים', SH('Pesukei Dezimra'), { start: 'מיום א\' דר"ה עד לאחר יו"כ', when: 'aseret' }),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', SH('Pesukei Dezimra'), { start: 'יתגדל ויתקדש', role: 'minyan' }),
  sec('barchu', 'barchu', 'ברכו', SH('Pesukei Dezimra'), { start: 'ברכו את יי המברך', role: 'minyan' }),
  sec('yotzer', 'shema-blessings', 'יוצר אור', SH('Blessings of the Shema'), { end: 'יוצר המאורות' }),
  sec('ahavat-olam', 'shema-blessings', 'אהבת עולם', SH('Blessings of the Shema'), { start: 'אהבת עולם אהבתנו' }),
  sec('shema', 'shema', 'קריאת שמע', SH('Blessings of the Shema'), { start: 'שמע ישראל' }),
  sec('emet-veyatziv', 'after-shema', 'אמת ויציב', SH('Blessings of the Shema'), { start: 'ויציב, ונכון' }),
  ...weekdayAmidah(SH('The Amidah'), 'shacharit'),
  ...scoped(hallelSections(), 'hallel-', 'hallel'),
  ...tachanun(SH('Tachnun'), 'shacharit'),
  // After Hallel: Kaddish Shalem on Rosh Chodesh and Chol HaMoed, half Kaddish on Chanukah (Hallel ¶25).
  sec('half-kaddish-2', 'half-kaddish', 'חצי קדיש', SH('Tachnun'), { start: 'הש"ץ אומר חצי קדיש', role: 'minyan', when: ORDINARY }),
  sec('kaddish-titkabal-hallel', 'kaddish-titkabal', 'קדיש תתקבל', SH('Ashrei Uva LeZion'), { start: 'הש"ץ אומר קדיש שלם', end: 'עשה שלום', rewind: true, role: 'minyan', when: RC_CHM }),
  // Rosh Chodesh and Chol HaMoed: the Song of the Day (and Barchi Nafshi, and Ledavid in its season) before the reading.
  ...songOfDay('rc-', RC_CHM, { rewind: true }),
  sec('rc-kaddish-yatom-song', 'kaddish-yatom', 'קדיש יתום', MOURNERS, { rewind: true, role: 'mourners', when: RC_CHM }),
  sec('barchi-nafshi', 'barchi-nafshi', 'ברכי נפשי', SONG, { start: 'בראש חדש אחר שיר של יום', end: 'קדיש יתום', rewind: true, when: 'roshChodesh' }),
  sec('kaddish-yatom-barchi-nafshi', 'kaddish-yatom', 'קדיש יתום', MOURNERS, { rewind: true, role: 'mourners', when: 'roshChodesh' }),
  sec('rc-ledavid', 'ledavid-ori', 'לדוד יי אורי', SONG, { start: 'מר"ח אלול עד הושענא רבא', rewind: true, when: andWhen('ledavid', RC_CHM) }),
  sec('rc-kaddish-yatom-ledavid', 'kaddish-yatom', 'קדיש יתום', MOURNERS, { rewind: true, role: 'mourners', when: andWhen('ledavid', RC_CHM) }),
  sec('el-erech-apayim', 'torah-service', 'אל ארך אפים', SH('Torah Reading'), { end: 'סלח נא כרוב רחמיך אל', when: 'mondayThursday&tachanun' }),
  sec('hotzaat-sefer-torah', 'torah-service', 'הוצאת ספר תורה', SH('Torah Reading'), { start: 'כשפותחין ארון הקדוש', when: 'torahReading' }),
  sec('torah-reading', 'torah-reading', 'קריאת התורה', SH('Torah Reading'), { start: 'כשקורין אותו לתורה', end: 'אחר קריאת התורה אומר חצי קדיש', when: 'torahReading' }),
  sec('birkat-hagomel', 'torah-reading', 'ברכת הגומל', SH('Torah Reading'), { start: 'ברכת הגומל', end: 'הוא יגמלך כל טוב סלה', when: 'torahReading' }),
  sec('baruch-shepetarani', 'torah-reading', 'ברוך שפטרני', SH('Torah Reading'), { start: 'ברכת ברוך שפטרני', end: 'ברוך שפטרני מענש הלזה', when: 'torahReading' }),
  // The edition only says "after the reading, half Kaddish" (¶15); its words are those of the Kaddish it prints.
  sec('half-kaddish-torah', 'half-kaddish', 'חצי קדיש', MOURNERS, { end: 'דאמירן בעלמא', rewind: true, role: 'minyan', when: 'torahReading' }),
  sec('hagbaha', 'torah-reading', 'הגבהת התורה', SH('Torah Reading'), { start: 'וכשמגביהין הספר תורה', when: 'torahReading' }),
  sec('ashrei', 'ashrei', 'אשרי', SH('Ashrei Uva LeZion'), { start: 'אשרי יושבי ביתך', end: 'ואנחנו נברך יה', rewind: true }),
  sec('lamenatzeach', 'lamenatzeach', 'למנצח', SH('Ashrei Uva LeZion'), { start: 'מנהג ספרד שבכל יום שאין בו תחנון', when: 'tachanun' }),
  sec('uva-letzion', 'uva-letzion', 'ובא לציון', SH('Ashrei Uva LeZion'), { start: 'ובא לציון גואל' }),
  // On Rosh Chodesh and Chol HaMoed the Torah is returned after Uva Letzion and Musaf follows with its half Kaddish;
  // Kaddish Tiskabel comes after Musaf (Hallel ¶27).
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', SH('Ashrei Uva LeZion'), { start: 'הש"ץ אומר קדיש שלם', end: 'עשה שלום', role: 'minyan', when: ORDINARY }),
  sec('yehalelu', 'return-torah', 'הכנסת ספר תורה', SH('Ashrei Uva LeZion'), { start: 'בשני ובחמישי ושאר ימים שמוציאין', when: 'torahReading' }),
  ...scoped(roshChodeshMusafSections(), 'musaf-rc-', 'roshChodesh'),
  ...scoped(cholHamoedMusafSections(), 'musaf-chm-', 'cholHamoed'),
  sec('musaf-chm-kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', SH('Ashrei Uva LeZion'), { start: 'הש"ץ אומר קדיש שלם', end: 'עשה שלום', rewind: true, role: 'minyan', when: 'cholHamoed' }),
  sec('tefila-ledavid', 'closing-passages', 'תפלה לדוד', SONG, { start: 'בימים שאין אומרים תחנון אין אומרים תפלה לדוד', end: 'כי אתה יי עזרתני ונחמתני', rewind: true, when: 'tachanun' }),
  sec('beit-yaakov', 'closing-passages', 'בית יעקב', SONG, { start: 'בית יעקב לכו ונלכה' }),
  sec('lulei', 'closing-passages', 'שיר המעלות לדוד', SONG, { start: 'לולי יי שהיה לנו' }),
  ...songOfDay('', ORDINARY),
  sec('kaddish-yatom-song', 'kaddish-yatom', 'קדיש יתום', MOURNERS, { rewind: true, role: 'mourners', when: ORDINARY }),
  sec('ledavid', 'ledavid-ori', 'לדוד יי אורי', SONG, { start: 'מר"ח אלול עד הושענא רבא', when: andWhen('ledavid', ORDINARY) }),
  sec('kaddish-yatom-ledavid', 'kaddish-yatom', 'קדיש יתום', MOURNERS, { rewind: true, role: 'mourners', when: andWhen('ledavid', ORDINARY) }),
  sec('kaveh', 'kaveh', 'קוה אל יי', SH('Kaveh'), { end: 'ומי צור זולתי אלהינו' }),
  sec('ein-keloheinu', 'ein-keloheinu', 'אין כאלהינו', SH('Kaveh'), { start: 'אין כאלהינו' }),
  sec('pitum-haketoret', 'ketoret', 'פטום הקטרת', SH('Kaveh'), { start: 'פטום הקטרת' }),
  sec('tana-dvei-eliyahu', 'closing-passages', 'תנא דבי אליהו', SH('Kaveh'), { start: 'תנא דבי אליהו', end: 'יי יברך את עמו בשלום' }),
  sec('kaddish-derabanan-2', 'kaddish-derabanan', 'קדיש דרבנן', SH('Kaveh'), { start: 'קדיש דרבנן', role: 'minyan' }),
  sec('aleinu', 'aleinu', 'עלינו לשבח', SH('Aleinu'), { end: 'ושמו אחד' }),
  sec('kaddish-yatom', 'kaddish-yatom', 'קדיש יתום', SH('Aleinu'), { start: 'קדיש יתום', end: 'עשה שלום', role: 'mourners' }),
  sec('al-tira', 'closing-passages', 'אל תירא', SH('Aleinu'), { start: 'אל תירא מפחד פתאם' }),
  sec('rabbenu-tam', 'tefillin', 'תפילין דרבינו תם', SH('Rabbenu Tam'), { when: '!tishaBav&!cholHamoed' }),
  sec('shesh-zechirot', 'closing-passages', 'שש זכירות', SH('Six Remembrances')),
], { reviewed: true });

// ── Weekday Mincha ────────────────────────────────────────────────────────────────────────────────────────────────
const weekdayMincha = service('מנחה לימות החול', [
  sec('tamid', 'korbanot', 'פרשת התמיד', MI('Korbanot'), { end: 'את דמו על המזבח סביב' }),
  sec('ketoret', 'ketoret', 'פטום הקטרת', MI('Korbanot'), { start: 'שהקטירו אבותינו לפניך', end: 'כימי עולם וכשנים קדמניות' }),
  sec('ana-bekoach', 'korbanot', 'אנא בכח', MI('Korbanot'), { start: 'בכח גדלת ימינך' }),
  sec('ashrei', 'ashrei', 'אשרי', MI('Ashrei'), { end: 'ואנחנו נברך יה' }),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', MI('Ashrei'), { start: 'הש"ץ אומר חצי קדיש', role: 'minyan' }),
  ...weekdayAmidah(MI('Amidah'), 'mincha'),
  ...tachanun(MI('Tachanun'), 'mincha'),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', MI('Tachanun'), { start: 'הש"ץ אומר קדיש שלם', role: 'minyan' }),
  sec('ledavid', 'ledavid-ori', 'לדוד יי אורי', MI('Aleinu'), { end: 'וקוה אל יי', when: 'ledavid' }),
  sec('aleinu', 'aleinu', 'עלינו לשבח', MI('Aleinu'), { start: 'עלינו לשבח', end: 'ושמו אחד' }),
  sec('kaddish-yatom', 'kaddish-yatom', 'קדיש יתום', MI('Aleinu'), { start: 'קדיש יתום', end: 'עשה שלום', role: 'mourners' }),
  sec('al-tira', 'closing-passages', 'אל תירא', MI('Aleinu'), { start: 'אל תירא מפחד פתאם' }),
], { reviewed: true });

// ── Weekday Maariv ────────────────────────────────────────────────────────────────────────────────────────────────
const weekdayMaariv = service('ערבית לימות החול', [
  sec('vehu-rachum', 'vehu-rachum', 'והוא רחום', MAARIV, { end: 'יעננו ביום קראנו' }),
  sec('shir-hamaalot', 'vehu-rachum', 'שיר המעלות הנה ברכו', MAARIV, { start: 'שיר המעלות הנה ברכו' }),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', MAARIV, { start: 'יתגדל ויתקדש', role: 'minyan' }),
  sec('barchu', 'barchu', 'ברכו', MAARIV, { start: 'ברכו את יי המברך', role: 'minyan' }),
  sec('maariv-aravim', 'shema-blessings', 'המעריב ערבים', MAARIV, { start: 'אשר בדברו מעריב ערבים' }),
  sec('ahavat-olam', 'shema-blessings', 'אהבת עולם', MAARIV, { start: 'אהבת עולם בית ישראל' }),
  sec('shema', 'shema', 'קריאת שמע', MAARIV, { start: 'שמע ישראל' }),
  sec('emet-veemuna', 'after-shema', 'אמת ואמונה', MAARIV, { start: 'ואמונה כל זאת' }),
  sec('hashkiveinu', 'hashkiveinu', 'השכיבנו', MAARIV, { start: 'השכיבנו אבינו לשלום' }),
  sec('half-kaddish-2', 'half-kaddish', 'חצי קדיש', MAARIV, { start: 'יתגדל ויתקדש', role: 'minyan' }),
  ...weekdayAmidah(MAARIV, 'maariv'),
  // "The chazzan says Kaddish Shalem (and when Vihi Noam is said, half Kaddish)": on Motzaei Shabbat the half
  // Kaddish, Vihi Noam and Ve'atah Kadosh, then the whole Kaddish.
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', MAARIV, { start: 'הש"ץ אומר קדיש שלם', end: 'עשה שלום', role: 'minyan', when: '!motzaeiShabbat' }),
  sec('half-kaddish-motzash', 'half-kaddish', 'חצי קדיש', MAARIV, { start: 'הש"ץ אומר קדיש שלם', end: 'דאמירן בעלמא', rewind: true, role: 'minyan', when: 'motzaeiShabbat' }),
  sec('vihi-noam', 'motzaei-shabbat', 'ויהי נעם', MAARIV, { start: 'למוצאי שבת', end: 'ואראהו בישועתי', when: 'motzaeiShabbat' }),
  sec('veata-kadosh', 'motzaei-shabbat', 'ואתה קדוש', MAARIV, { start: 'ואתה קדוש, יושב תהלות ישראל', when: 'motzaeiShabbat' }),
  sec('kaddish-titkabal-motzash', 'kaddish-titkabal', 'קדיש תתקבל', MAARIV, { range: [59, 62], rewind: true, role: 'minyan', when: 'motzaeiShabbat' }),
  ...omerSections('maariv-', 'omer'),
  sec('aleinu', 'aleinu', 'עלינו לשבח', MAARIV, { start: 'עלינו לשבח', end: 'ושמו אחד' }),
  sec('kaddish-yatom', 'kaddish-yatom', 'קדיש יתום', MAARIV, { start: 'קדיש יתום', end: 'עשה שלום', role: 'mourners' }),
  sec('al-tira', 'closing-passages', 'אל תירא', MAARIV, { start: 'אל תירא מפחד פתאם' }),
], { reviewed: true });

// ── Bedtime Shema ─────────────────────────────────────────────────────────────────────────────────────────────────
const BS = R('Bedtime Shema');
const bedtimeShema = service('קריאת שמע על המיטה', [
  sec('ribono-mochel', 'bedtime-shema', 'רבונו של עולם הריני מוחל', BS),
  sec('hashkiveinu', 'bedtime-shema', 'השכיבנו', BS, { start: 'השכיבנו אבינו לשלום' }),
  sec('shema', 'shema', 'קריאת שמע', BS, { start: 'שמע ישראל' }),
  sec('yaalzu', 'bedtime-shema', 'יעלזו חסידים', BS, { start: 'יעלזו חסידים' }),
  sec('yoshev-beseter', 'bedtime-shema', 'יושב בסתר', BS, { start: 'ישב בסתר עליון' }),
  sec('vidui', 'vidui', 'וידוי', BS, { start: 'תבוא לפניך תפלתנו', end: 'ותמחל ותסלח לנו על כל פשעינו' }),
  sec('yehi-ratzon', 'bedtime-shema', 'יהי רצון', BS, { start: 'שאם חטאתי עויתי פשעתי', end: 'ופגמתי באות (ה) אחרונה' }),
  sec('ana-bekoach', 'bedtime-shema', 'אנא בכח', BS, { start: 'בכח גדלת ימינך' }),
  sec('lamenatzeach', 'bedtime-shema', 'למנצח מזמור לדוד', BS, { start: 'למנצח מזמור לדוד בבוא אליו' }),
  sec('shir-lamaalot', 'bedtime-shema', 'שיר למעלות', BS, { start: 'שיר למעלות אשא עיני' }),
  sec('pesukim', 'bedtime-shema', 'פסוקי שמירה', BS, { start: 'גד גדוד יגודנו' }),
  sec('ribon-haolamim', 'bedtime-shema', 'רבון העולמים', BS, { start: 'אתה בראת עולמך ברצונך' }),
  sec('before-union', 'bedtime-shema', 'קודם הזיווג', BS, { start: 'יש לומר קודם הזווג', end: 'עטיפא בקיטפא' }),
  sec('hamapil', 'bedtime-shema', 'המפיל', BS, { start: 'המפיל חבלי שנה' }),
], { reviewed: true });

// ── Birkat HaMazon ────────────────────────────────────────────────────────────────────────────────────────────────
const BHM = R('Blessings, Birkat HaMazon');
const birkatHamazon = service('ברכת המזון', [
  sec('al-naharot', 'birkat-hamazon', 'על נהרות בבל', BHM, { end: 'יברכנו אלהים וייראו', when: 'tachanun' }),
  sec('shir-hamaalot', 'birkat-hamazon', 'שיר המעלות', BHM, { start: 'ביום שאין אומרים בו תחנון', end: 'ושרים כחללים', when: '!tachanun' }),
  sec('avarcha', 'birkat-hamazon', 'אברכה את יי', BHM, { start: 'אברכה את יי בכל עת' }),
  sec('mayim-acharonim', 'birkat-hamazon', 'מים אחרונים', BHM, { start: 'קודם מים אחרונים', end: 'זה השלחן אשר לפני' }),
  sec('zimun', 'birkat-hamazon', 'זימון', BHM, { start: 'אם מברכים בזימון', end: 'ומי שלא אכל עונה' }),
  sec('hazan', 'birkat-hamazon', 'ברכת הזן', BHM, { start: 'הזן את העולם כלו בטובו' }),
  sec('nodeh', 'birkat-hamazon', 'ברכת הארץ', BHM, { start: 'נודה לך יי אלהינו' }),
  sec('al-hanisim', 'birkat-hamazon', 'על הנסים', BHM, { start: 'בחנוכה ופורים אומרים כאן', end: 'ועל הנסים ועל הפרקן', when: 'chanukah|purim' }),
  sec('al-hanisim-chanukah', 'birkat-hamazon', 'בימי מתתיהו', BHM, { start: 'לחנוכה', when: 'chanukah', continues: true }),
  sec('al-hanisim-purim', 'birkat-hamazon', 'בימי מרדכי ואסתר', BHM, { start: 'לפורים', when: 'purim', continues: true }),
  sec('veal-hakol', 'birkat-hamazon', '', BHM, { start: 'ועל הכל יי אלהינו', continues: true }),
  sec('rachem', 'birkat-hamazon', 'בונה ירושלים', BHM, { start: 'רחם יי אלהינו על ישראל' }),
  sec('yaale-veyavo', 'birkat-hamazon', 'יעלה ויבוא', BHM, { start: 'בראש חודש ובחול המועד אומרים', when: 'roshChodesh|cholHamoed' }),
  sec('uvne', 'birkat-hamazon', '', BHM, { start: 'ובנה ירושלים עיר הקדש', continues: true }),
  sec('hatov-vehametiv', 'birkat-hamazon', 'הטוב והמטיב · הרחמן', BHM, { start: 'האל. אבינו מלכנו' }),
  sec('harachaman', 'birkat-hamazon', '', BHM, { start: 'ממרום ילמדו', continues: true }),
  sec('yiru', 'birkat-hamazon', 'יראו את יי', BHM, { start: 'יראו את יי קדושיו' }),
], { reviewed: true });

// ── Hallel, the Omer, Rosh Chodesh Musaf, Chol HaMoed Musaf ──────────────────────────────────────────────────────
const hallel = service('הלל', hallelSections(), { reviewed: true });
const omer = service('ספירת העומר', omerSections(), { reviewed: true });

const roshChodeshMusaf = service('מוסף לראש חודש', roshChodeshMusafSections(), { reviewed: true });

// ══ Siddur Tehillat Hashem (Open Siddur, Shmuel Gonzales; CC0 Hebrew / CC BY 4.0 instructions) ══════════════════
// The Shabbat and Yom Tov services, which Torah Or for weekdays does not print. Each service below is composed from
// Tehillat Hashem alone. Its conditions are printed as ENGLISH captions ("From Rosh HaShanah to Yom Kippur … add:"),
// which the day engine cannot read, so every insertion they govern is a section of its own with a `when`.
const TH = leaf('Siddur Tehillat Hashem');
const KS = path => TH(`Kabbalat Shabbat, ${path}`);
const SB = path => TH(`The Shabbat Book, ${path}`);
const SS = path => TH(`Shacharit and Musaf for Shabbat and Festivals, ${path}`);
const SM = path => TH(`The Afternoon Prayers for Shabbat, ${path}`);
const F3 = path => TH(`Prayers for the Three Festivals, ${path}`);
const TH_OMER = TH('Counting the Omer, Counting the Omer');
const TH_MUSAF = SS('Musaf Amidah for Shabbat and Rosh Chodesh');
const ASERET = 'From Rosh HaShanah to Yom Kippur';

// The opening blessings of a Tehillat Hashem Amidah. `aseret`: the leaf prints the Ten Days' additions.
function thFront(ref, c, { aseret = true } = {}) {
  return [
    sec('sefatai', c, 'אדני שפתי תפתח', ref),
    sec('avot', c, 'ברכת אבות', ref, { start: /^אבות$/, end: 'ומביא גואל לבני בניהם' }),
    ...(aseret ? [sec('avot-aseret', c, 'זכרנו לחיים', ref, { start: ASERET, end: 'למענך אלהים חיים', when: 'aseret' })] : []),
    sec('avot-end', c, '', ref, { start: 'Bend at', end: 'מגן אברהם', continues: true }),
    sec('gevurot', c, 'גבורות', ref, { start: /^גבורות$/, end: 'רב להושיע' }),
    sec('gevurot-summer', c, 'מוריד הטל', ref, { start: 'Summer, Pesach through Sukkot', end: 'מוריד הטל', when: 'summer' }),
    sec('gevurot-winter', c, 'משיב הרוח ומוריד הגשם', ref, { start: 'Winter, Shmini Atzeret', end: 'ומוריד הגשם', when: 'winter' }),
    ...(aseret ? [
      sec('gevurot-mid', c, '', ref, { start: 'מכלכל חיים בחסד', end: 'ומצמיח ישועה', continues: true }),
      sec('gevurot-aseret', c, 'מי כמוך אב הרחמן', ref, { start: ASERET, end: 'זוכר יצוריו', when: 'aseret' }),
      sec('gevurot-end', c, '', ref, { start: 'ונאמן אתה להחיות', continues: true }),
    ] : [sec('gevurot-end', c, '', ref, { start: 'מכלכל חיים בחסד', continues: true })]),
  ];
}
// Ya'aleh VeYavo of a Shabbat Amidah (Shabbat Rosh Chodesh and Shabbat Chol HaMoed), with its day names.
function thYaaleVeyavo(ref, c) {
  return [
    sec('yaale-veyavo', c, 'יעלה ויבוא', ref, { start: 'Chol haMoed, one adds the following', end: 'יעלה ויבא', when: 'roshChodesh|cholHamoed' }),
    sec('yaale-rc', c, '', ref, { start: 'On Rosh Chodesh:', end: 'ראש החדש', when: 'roshChodesh', continues: true }),
    sec('yaale-pesach', c, '', ref, { start: 'On Pesach:', end: 'חג המצות', when: 'cholHamoed&pesach', continues: true }),
    sec('yaale-sukkot', c, '', ref, { start: 'On Sukkot:', end: 'חג הסכות', when: 'cholHamoed&sukkot', continues: true }),
    sec('yaale-end', c, '', ref, { start: 'זכרנו יי אלהינו בו לטובה', end: 'כי אל מלך חנון ורחום', when: 'roshChodesh|cholHamoed', continues: true }),
  ];
}
// Modim to the end of the Amidah (Shabbat leaves). `bk`: the chazzan's Birkat Kohanim is printed.
function thBack(ref, c, { bk = false, yaale = true } = {}) {
  return [
    sec('retze', c, 'רצה', ref, { start: /^אבודה$/, end: 'עבודת ישראל עמך' }),
    ...(yaale ? thYaaleVeyavo(ref, c) : []),
    sec('retze-end', c, '', ref, { start: 'ותחזינה עינינו', continues: true }),
    sec('modim', c, 'מודים', ref, { start: /^מודים$/, end: 'כי מעולם קוינו לך' }),
    sec('al-hanisim', c, 'על הנסים', ref, { start: 'Chanukah one adds the following', end: 'שמונת ימי חנכה אלו', when: 'chanukah' }),
    sec('modim-end', c, '', ref, { start: 'ועל כלם יתברך', end: 'ועל כלם יתברך', continues: true }),
    sec('modim-aseret', c, 'וכתוב לחיים', ref, { start: ASERET, end: 'וכתוב לחיים טובים', when: 'aseret' }),
    sec('modim-end-2', c, '', ref, { start: 'Bend at', end: 'ולך נאה להודות', continues: true }),
    ...(bk ? [sec('birkat-kohanim', 'birkat-kohanim', 'ברכת כהנים', ref, { start: /^ברכת קהנים$/, role: 'repetition' })] : []),
    sec('sim-shalom', c, 'שים שלום', ref, { start: /^שלום$/, end: 'בכל עת ובכל שעה בשלומך' }),
    sec('shalom-aseret', c, 'ובספר חיים', ref, { start: ASERET, end: 'לחיים טובים ולשלום', when: 'aseret' }),
    sec('shalom-end', c, '', ref, { start: 'המברך את עמו ישראל בשלום', continues: true }),
    sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', ref, { start: 'נצור לשוני מרע', end: 'שיבנה בית המקדש' }),
  ];
}
const thOmer = (p, when) => [
  sec(`${p}omer`, 'omer', 'ספירת העומר', TH_OMER, { end: 'על ספירת העומר', when }),
  sec(`${p}omer-count`, 'omer', 'סדר הספירה', TH_OMER, { start: 'One should proceed to reciting the Omer count', end: 'Upon recitation of that day', when }),
  sec(`${p}omer-after`, 'omer', 'הרחמן · למנצח · אנא בכח', TH_OMER, { start: 'הרחמן הוא יחזיר', end: 'ברוך שם כבוד מלכותו', when }),
  sec(`${p}omer-ribono`, 'omer', 'רבונו של עולם', TH_OMER, { start: 'רבונו של עולם, אתה צויתנו', when }),
];
const KADDISH_NOTE = 'In the presence of a minyan';

// ── Kabbalat Shabbat ──────────────────────────────────────────────────────────────────────────────────────────────
const kabbalatShabbat = service('קבלת שבת', [
  // Said on Friday before Mincha (the edition: "then continue on to say Minchah for Weekdays, excluding Tachanun").
  sec('hodu-107', 'kabbalat-shabbat', 'הודו לה׳ כי טוב · לפני מנחה', KS('Mincha for Shabbat Eve'), { end: 'ויתבוננו חסדי יי', when: '!yomTov&!cholHamoed' }),
  sec('patach-eliyahu', 'kabbalat-shabbat', 'פתח אליהו', KS('Mincha for Shabbat Eve'), { start: 'Tikkunei Zohar' }),
  sec('yedid-nefesh', 'kabbalat-shabbat', 'ידיד נפש', KS('Mincha for Shabbat Eve'), { start: 'ידיד נפש' }),
  sec('lechu-neranena', 'kabbalat-shabbat', 'לכו נרננה', KS('Kabbalat Shabbat – Welcoming the Sabbath'), { end: 'כי קדוש יי אלהינו', when: '!yomTov&!cholHamoed' }),
  sec('mizmor-ledavid', 'kabbalat-shabbat', 'מזמור לדוד', KS('Kabbalat Shabbat – Welcoming the Sabbath'), { start: 'When Shabbat and a Festival or Chol haMoed', end: 'יי יברך את עמו בשלום' }),
  sec('ana-bekoach', 'kabbalat-shabbat', 'אנא בכח', KS('Kabbalat Shabbat – Welcoming the Sabbath'), { start: 'While reciting the following prayer', end: 'ברוך שם כבוד מלכותו' }),
  sec('lecha-dodi', 'lecha-dodi', 'לכה דודי', KS('Kabbalat Shabbat – Welcoming the Sabbath'), { start: 'In a congregation the following is most often sung' }),
  sec('mizmor-shir', 'mizmor-shir-shabbat', 'מזמור שיר ליום השבת', KS('Kabbalat Shabbat – Welcoming the Sabbath'), { start: 'Psalm 92', end: 'לביתך נאוה קדש' }),
  sec('kaddish-yatom', 'kaddish-yatom', 'קדיש יתום', KS('Kabbalat Shabbat – Welcoming the Sabbath'), { start: /^קדיש יתום$/, end: /^עשה שלום/, role: 'mourners' }),
  sec('kegavna', 'kabbalat-shabbat', 'כגונא', KS('Kabbalat Shabbat – Welcoming the Sabbath'), { start: 'Zohar, Terumah 134a', end: 'בנהירו דאנפין ולומר' }),
  // "If one is praying without the presence of a minyan, the following should be added".
  sec('kegavna-yachid', 'kabbalat-shabbat', 'ביחיד: ולומר ברכו', KS('Kabbalat Shabbat – Welcoming the Sabbath'), { start: 'If one is praying without the presence of a minyan' }),
], { reviewed: true });

// ── Maariv of Shabbat ─────────────────────────────────────────────────────────────────────────────────────────────
const SA = KS('Shemoneh Esrei – The Amidah');
const shabbatMaariv = service('ערבית לליל שבת', [
  // On a Yom Tov night on a weekday Maariv opens with Shir HaMa'alot; on Friday night it follows Kabbalat Shabbat.
  sec('shir-hamaalot', 'vehu-rachum', 'שיר המעלות הנה ברכו', KS('Maariv For Shabbat and Festivals'), { end: 'Psalms 20:10', when: '!shabbat' }),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', KS('Maariv For Shabbat and Festivals'), { start: KADDISH_NOTE, end: 'דאמירן בעלמא', role: 'minyan' }),
  sec('barchu', 'barchu', 'ברכו', KS('Maariv For Shabbat and Festivals'), { start: 'The chazzan and congregation bow', end: 'One may now be seated', role: 'minyan' }),
  sec('maariv-aravim', 'shema-blessings', 'המעריב ערבים', KS('Maariv For Shabbat and Festivals'), { start: /^ברכות קריאת שמע$/, end: 'המעריב ערבים' }),
  sec('ahavat-olam', 'shema-blessings', 'אהבת עולם', KS('Maariv For Shabbat and Festivals'), { start: 'אהבת עולם בית ישראל' }),
  sec('shema', 'shema', 'קריאת שמע', KS('The Shema'), { end: 'אני יי אלהיכם' }),
  sec('emet-veemuna', 'after-shema', 'אמת ואמונה', KS('The Shema'), { start: 'One should not pause between', end: 'Exodus 15:11' }),
  sec('hashkiveinu', 'hashkiveinu', 'השכיבנו', KS('The Shema'), { start: /^\( Cong: אמן\)$/, end: 'ועל ירושלים' }),
  omit('verses-not-chabad', KS('The Shema'), { start: /^\( Cong: אמן\)$/, end: 'Leviticus 16:30', why: 'the verses of the day (ושמרו …), which the edition itself marks "not the Chabad tradition"' }),
  sec('half-kaddish-2', 'half-kaddish', 'חצי קדיש', KS('The Shema'), { start: KADDISH_NOTE, role: 'minyan' }),
  ...thFront(SA, 'amidah'),
  sec('kedushat-hashem', 'amidah', 'קדושת השם', SA, { start: /^קדושת השם$/, end: /^אתה קדוש ושמך קדוש/ }),
  sec('kedushat-hayom', 'amidah', 'אתה קדשת', SA, { start: /^קדושת היום$/, end: 'מקדש השבת' }),
  ...thBack(SA, 'amidah'),
  sec('vayechulu', 'vayechulu', 'ויכלו', SA, { start: 'The Amidah ends here', end: 'When the first night of Pesach and Shabbat coincide' }),
  sec('magen-avot', 'magen-avot', 'ברכה מעין שבע · מגן אבות', SA, { start: 'The Chazzan recites the following', end: /^\( Cong: אמן\)$/, role: 'minyan' }),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', SA, { start: /^קדיש שלם$/, end: /^עשה שלום/, role: 'minyan' }),
  sec('mizmor-ledavid-23', 'closing-passages', 'מזמור לדוד ה׳ רועי', SA, { start: 'Psalm 23', end: 'לארך ימים' }),
  sec('half-kaddish-3', 'half-kaddish', 'חצי קדיש', SA, { start: KADDISH_NOTE, end: 'דאמירן בעלמא', role: 'minyan' }),
  sec('barchu-2', 'barchu', 'ברכו', SA, { start: 'The chazzan and congregation bow', end: 'is added here', role: 'minyan' }),
  ...thOmer('', 'omer'),
  sec('aleinu', 'aleinu', 'עלינו לשבח', SA, { start: 'One should rise to recite', end: 'Zechariah 14:9' }),
  sec('kaddish-yatom', 'kaddish-yatom', 'קדיש יתום', SA, { start: /^קדיש יתום$/, end: /^עשה שלום/, role: 'mourners' }),
  sec('al-tira', 'closing-passages', 'אל תירא', SA, { start: 'אל תירא מפחד פתאום' }),
], { reviewed: true });

// ── Shabbat evening meal: Shalom Aleichem, Eshet Chayil, Kiddush, Azamer Bishvachin ─────────────────────────────
const KID = SB('The Shabbat Evening Kiddush');
const shabbatKiddush = service('קידוש לליל שבת', [
  sec('shalom-aleichem', 'shalom-aleichem', 'שלום עליכם', SB('The Shabbat Evening Meal'), { end: 'יי ישמר צאתך ובואך' }),
  sec('eshet-chayil', 'eshet-chayil', 'אשת חיל', SB('The Shabbat Evening Meal'), { start: 'אשת חיל מי ימצא' }),
  sec('mizmor-ledavid', 'kiddush', 'מזמור לדוד · אתקינו סעודתא', KID, { end: 'אתין לסעדא בהדה' }),
  sec('kiddush', 'kiddush', 'קידוש', KID, { start: 'One should take the Kiddush cup', end: 'מקדש השבת' }),
  sec('sukkah', 'kiddush', 'לישב בסוכה', KID, { start: 'When Shabbat coincides with Chol HaMoed Sukkot', end: /^ברוך אתה.*לישב בסכה/, when: 'sukkot' }),
  sec('after-kiddush', 'kiddush', 'אחר הקידוש', KID, { start: 'The wine should be distributed', end: 'All people present should wash' }),
  sec('azamer', 'zemirot', 'אזמר בשבחין', KID, { start: 'It is customary to sing the following table hymn' }),
], { reviewed: true });

// ── Shacharit of Shabbat ──────────────────────────────────────────────────────────────────────────────────────────
const SPZ = SS('Verses of Praise');
const SSA = SS('Shemoneh Esrei – The Amidah');
const TR = SS('Order of the Torah Reading for Shabbat and Festivals');
const shabbatShacharit = service('שחרית של שבת', [
  sec('hodu', 'hodu', 'הודו', SPZ, { end: 'אשירה לײ כי גמל' }),
  sec('mizmor-shir', 'mizmor-shir', 'מזמור שיר חנכת הבית', SPZ, { start: 'Psalm 30', end: 'יי אלהי לעולם' }),
  sec('hashem-melech', 'hodu', 'יי מלך', SPZ, { start: '"יהי כבוד" Stand', end: 'כל הנשמה תהלל' }),
  sec('shabbat-psalms', 'pesukei-dezimra', 'מזמורים לשבת', SPZ, { start: 'Psalm 19' }),
  sec('shir-hamaalot-psalms', 'pesukei-dezimra', 'שיר המעלות', SPZ, { start: 'Psalm 121' }),
  sec('hallel-hagadol', 'pesukei-dezimra', 'הללויה · הודו לה׳ כי טוב', SPZ, { start: 'Psalm 135', end: 'הודו לאל השמי' }),
  sec('haaderet', 'pesukei-dezimra', 'האדרת והאמונה', SPZ, { start: 'האדרת והאמונה', end: 'התהלה והתפארת' }),
  sec('baruch-sheamar', 'baruch-sheamar', 'ברוך שאמר', SPZ, { start: 'לשם יחוד קדשא', end: 'מלך מהלל בתש' }),
  sec('mizmor-shir-shabbat', 'mizmor-shir-shabbat', 'מזמור שיר ליום השבת', SPZ, { start: '92 Psalm', end: 'לביתך נאוה קדש' }),
  sec('yehi-chevod', 'pesukei-dezimra', 'יהי כבוד', SPZ, { start: 'יהי כבוד יי לעולם' }),
  sec('ashrei-pz', 'pesukei-dezimra', 'אשרי', SPZ, { start: 'אשרי יושבי ביתך', end: 'ואנחנו נברך יה' }),
  sec('halleluya', 'pesukei-dezimra', 'הללויה', SPZ, { start: 'Psalm 146', end: 'כל הנשמה תהלל יה' }),
  sec('vayevarech-david', 'pesukei-dezimra', 'ויברך דויד', SPZ, { start: 'ברוך יי לעולם אמן ואמן', end: 'כמו אבן במים' }),
  sec('az-yashir', 'az-yashir', 'שירת הים', SPZ, { start: /^שירת הים$/, end: 'ושמו אחד' }),
  sec('nishmat', 'pesukei-dezimra', 'נשמת', SPZ, { start: 'נשמת כל חי', end: 'שכן חובת כל היצורים' }),
  sec('yishtabach', 'yishtabach', 'ישתבח', SPZ, { start: 'ובכן ישתבח' }),
  sec('mimaamakim', 'pesukei-dezimra', 'שיר המעלות ממעמקים', SPZ, { start: ASERET, end: 'והוא יפדה את ישראל', when: 'aseret' }),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', SPZ, { start: KADDISH_NOTE, end: 'דאמירן בעלמא', role: 'minyan' }),
  sec('barchu', 'barchu', 'ברכו', SPZ, { start: 'The chazzan and congregation bow', end: 'One may now be seated', role: 'minyan' }),
  sec('yotzer', 'shema-blessings', 'יוצר אור', SPZ, { start: /^ברכות קריאת שמע$/, end: 'ובורא את הכל' }),
  sec('el-adon', 'shema-blessings', 'אל אדון · לאל אשר שבת', SPZ, { start: 'When Festivals occur on weekdays, one should substitute', end: 'ועל מאורי אור שיצרת יפארוך', when: 'shabbat' }),
  sec('hameir', 'shema-blessings', 'המאיר לארץ', SPZ, { start: 'When Festivals occur on weekdays, the following is substituted', end: 'המה יפארוך', when: '!shabbat' }),
  sec('titbarach', 'shema-blessings', '', SPZ, { start: 'תתברך לנצח צורנו', end: 'יוצר המאורות', continues: true }),
  sec('ahavat-olam', 'shema-blessings', 'אהבת עולם', SPZ, { start: 'אהבת עולם אהבתנו' }),
  sec('shema', 'shema', 'קריאת שמע', SS('The Shema'), { end: 'אני יי א' }),
  sec('emet-veyatziv', 'after-shema', 'אמת ויציב', SS('The Shema'), { start: 'One should not pause between' }),
  ...thFront(SSA, 'amidah'),
  sec('kedusha', 'kedusha', 'קדושה', SSA, { start: /^קדושה$/, role: 'repetition' }),
  sec('kedushat-hashem', 'amidah', 'קדושת השם', SSA, { start: /^קדושת השם$/, end: /^אתה קדוש ושמך קדוש/ }),
  sec('kedushat-hayom', 'amidah', 'ישמח משה', SSA, { start: /^קדושת היום$/, end: 'מקדש השבת' }),
  ...thBack(SSA, 'amidah', { bk: true }),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', SSA, { start: 'The individual Amidah ends here', role: 'minyan' }),
  sec('song-of-day', 'song-of-day', 'שיר של יום · שבת', SS('Song of the Day'), { end: 'אמן ואמן' }),
  sec('barchi-nafshi', 'barchi-nafshi', 'ברכי נפשי', SS('Song of the Day'), { start: 'On Rosh Chodesh, after recital of The Song of the Day', end: 'ברכי נפשי את יי, הל', when: 'roshChodesh' }),
  sec('ledavid', 'ledavid-ori', 'לדוד יי אורי', SS('Song of the Day'), { start: 'From the first day of Rosh Chodesh Elul', end: 'וקוה א', when: 'ledavid' }),
  sec('kaddish-yatom', 'kaddish-yatom', 'קדיש יתום', SS('Song of the Day'), { start: /^קדיש יתום$/, end: /^עשה שלום/, role: 'mourners' }),
  sec('ata-hareta', 'torah-service', 'אתה הראת', SS('Song of the Day'), { start: 'אתה הראת לדעת' }),
  sec('vayehi-binsoa', 'torah-service', 'פתיחת הארון · ויהי בנסוע', TR, { end: 'ברוך שנתן תורה לעמ' }),
  sec('thirteen-attributes', 'torah-service', 'י״ג מדות · רבונו של עולם', TR, { start: 'When a festival coincides with a weekday', end: 'ענני באמת ישעך', when: 'yomTov&!shabbat' }),
  sec('berich-shmei', 'torah-service', 'בריך שמה', TR, { start: 'בריך שמה דמרא עלמא' }),
  sec('hotzaat-sefer-torah', 'torah-service', 'הוצאת ספר תורה', TR, { start: 'The Torah is received by the chazzan', end: 'Once the Torah is placed on the bimah' }),
  sec('torah-reading', 'torah-reading', 'קריאת התורה', TR, { start: 'The following formula is used for the gabbai', end: 'הוא ירפא את' }),
  sec('birkat-hagomel', 'torah-reading', 'ברכת הגומל', TR, { start: /^ברכת הגומל$/, end: 'הוא יגמלך כל טוב סלה' }),
  sec('baruch-shepetarani', 'torah-reading', 'ברוך שפטרני', TR, { start: /^ברוך שפטרני$/, end: 'שפטרני מענשו' }),
  sec('mi-sheberach', 'torah-reading', 'מי שברך', TR, { start: /^מי שבירך ליולדת זכר$/ }),
  sec('mi-sheberach-weekday', 'torah-reading', 'מי שברך לחולה בחול', TR, { start: /^מי שברך לחולה לחול$/, when: '!shabbat' }),
  sec('half-kaddish-torah', 'half-kaddish', 'חצי קדיש', TR, { start: 'Upon completion of the final aliyah', end: 'דאמירן בעלמא', role: 'minyan' }),
  sec('hagbaha', 'torah-reading', 'הגבהת התורה', TR, { start: 'Before raising the Sefer Torah', end: 'You may now be seated' }),
  sec('haftarah', 'haftarah', 'ברכות ההפטרה', TR, { start: /^ברכות ההפטרה$/, end: 'מגן דו' }),
  sec('haftarah-shabbat', 'haftarah', '', TR, { start: 'On a public fast day', end: 'אנחנו מודים לך, ומברכים אותך', when: '!yomTov', continues: true }),
  sec('haftarah-yomtov', 'haftarah', '', TR, { start: 'On festivals add', end: 'On all other festivals, when they occur on weekdays', when: 'yomTov', continues: true }),
  sec('yekum-purkan', 'torah-service', 'יקום פורקן · מי שברך', TR, { start: 'On any other Shabbat continue below', end: 'On the final days of Pesach, Shavuot and Shemini Atzeret continue on with Yizkor', when: 'shabbat' }),
  sec('birkat-hachodesh', 'birkat-hachodesh', 'ברכת החודש', TR, { start: /^ברכת החודש$/, end: 'לששון ולשמחה', when: 'shabbatMevarchim' }),
  sec('av-harachamim', 'av-harachamim', 'אב הרחמים', TR, { start: 'On every Shabbat the following is said', end: 'מנחל בדרך ישתה' }),
  sec('ashrei', 'ashrei', 'אשרי', TR, { start: 'אשרי יושבי ביתך', end: 'ואנחנו נברך יה' }),
  sec('yehalelu', 'return-torah', 'הכנסת ספר תורה', TR, { start: 'The Torah is returned to the Ark', end: 'לבני ישראל עם קרבו' }),
  sec('half-kaddish-musaf', 'half-kaddish', 'חצי קדיש', TR, { start: KADDISH_NOTE, role: 'minyan' }),
], {
  reviewed: true,
  conditionsPending: [
    'Birkat HaChodesh — only on Shabbat Mevarchim; the app has no key for it',
    'Av HaRachamim — omitted on Shabbat Mevarchim and on festive Shabbatot (edition ¶167); no key for it',
  ],
});

// ── Musaf of Shabbat ──────────────────────────────────────────────────────────────────────────────────────────────
const shabbatMusaf = service('מוסף לשבת', [
  ...thFront(TH_MUSAF, 'musaf'),
  sec('kedusha', 'kedusha', 'קדושה', TH_MUSAF, { start: /^קדושה$/, role: 'repetition' }),
  sec('kedushat-hashem', 'musaf', 'קדושת השם', TH_MUSAF, { start: /^קדושת השם$/, end: /^אתה קדוש ושמך קדוש/ }),
  sec('tikanta-shabbat', 'musaf', 'תכנת שבת', TH_MUSAF, { start: /^קדושת היום$/, end: 'מקדש השבת', when: '!roshChodesh' }),
  sec('ata-yatzarta', 'musaf', 'אתה יצרת · לשבת ראש חודש', TH_MUSAF, { start: 'On Shabbat Rosh Chodesh:', end: 'וחדש עלינו ביום השבת הזה', when: 'roshChodesh' }),
  ...thBack(TH_MUSAF, 'musaf', { bk: true, yaale: false }),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', TH_MUSAF, { start: 'The individual Amidah ends here', end: /^עשה שלום/, role: 'minyan' }),
  sec('kaveh', 'kaveh', 'קוה אל יי', TH_MUSAF, { start: 'קוה אל יי, חזק' }),
  sec('ein-keloheinu', 'ein-keloheinu', 'אין כאלהינו', TH_MUSAF, { start: 'אין כאלהינו' }),
  sec('pitum-haketoret', 'ketoret', 'פטום הקטרת', TH_MUSAF, { start: 'Kereitot 6a' }),
  sec('tana-dvei-eliyahu', 'closing-passages', 'תנא דבי אליהו', TH_MUSAF, { start: 'Megillah 28b', end: 'Berachot 64a' }),
  sec('amar-rabbi-elazar', 'closing-passages', '', TH_MUSAF, { start: 'אמר רבי אלעזר', continues: true }),
  sec('kaddish-derabanan', 'kaddish-derabanan', 'קדיש דרבנן', TH_MUSAF, { start: /^קדיש דרבנן$/, end: /^עשה שלום/, role: 'minyan' }),
  sec('aleinu', 'aleinu', 'עלינו לשבח', TH_MUSAF, { start: 'One should rise to recite', end: 'ביום ההוא יהיה' }),
  sec('kaddish-yatom', 'kaddish-yatom', 'קדיש יתום', TH_MUSAF, { start: /^קדיש יתום$/, end: /^עשה שלום/, role: 'mourners' }),
  sec('al-tira', 'closing-passages', 'אל תירא', TH_MUSAF, { start: 'אל תירא מפחד פתאם', end: 'Mourners should take on' }),
  sec('lechem-hapanim', 'closing-passages', 'פרשת לחם הפנים', TH_MUSAF, { start: 'The following section relates to the rituals of incense and showbread' }),
  sec('shesh-zechirot', 'closing-passages', 'שש זכירות', TH_MUSAF, { start: /^שש זכירות$/ }),
], { reviewed: true });

// ── Kiddusha Rabba ────────────────────────────────────────────────────────────────────────────────────────────────
const KD = SB('The Kiddush for Shabbat Day');
const shabbatKiddushDay = service('קידושא רבא', [
  sec('mizmor-ledavid', 'kiddush-day', 'מזמור לדוד · אתקינו · ושמרו', KD, { end: /^דא היא סעודתא/ }),
  sec('kiddush', 'kiddush-day', 'קידושא רבא', KD, { start: 'One should take the Kiddush cup', end: 'בורא פרי הגפן' }),
  sec('sukkah', 'kiddush-day', 'לישב בסוכה', KD, { start: 'When Shabbat coincides with Chol HaMoed Sukkot', end: /^ברוך אתה.*לישב בסכה/, when: 'sukkot' }),
  sec('netilat-yadayim', 'kiddush-day', 'נטילת ידים', KD, { start: /^\.$/, end: 'After washing one should abstain' }),
  sec('asader', 'zemirot', 'אסדר לסעודתא', KD, { start: 'It is customary to sing the following table hymn' }),
], { reviewed: true });

// ── Mincha of Shabbat ─────────────────────────────────────────────────────────────────────────────────────────────
const SMA = SM('Shemoneh Esrei – The Amidah');
const SMT = SM('Order of the Torah Reading');
const shabbatMincha = service('מנחה לשבת', [
  sec('tamid', 'korbanot', 'פרשת התמיד', SM('Mincha for Shabbat'), { end: 'את דמו על המזבח סביב' }),
  sec('ketoret', 'ketoret', 'פטום הקטרת', SM('Mincha for Shabbat'), { start: /^קטרת$/, end: 'כימי עולם וכשנים קדמוניות' }),
  sec('ana-bekoach', 'korbanot', 'אנא בכח', SM('Mincha for Shabbat'), { start: 'While reciting the following prayer', end: 'ברוך שם כבוד מלכותו' }),
  sec('ashrei', 'ashrei', 'אשרי', SM('Mincha for Shabbat'), { start: 'אשרי יושבי ביתך', end: 'ואנחנו נברך יה' }),
  sec('uva-letzion', 'uva-letzion', 'ובא לציון', SM('Mincha for Shabbat'), { start: 'ובא לציון גואל', end: 'ברוך הוא אלהינו שבראנו' }),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', SM('Mincha for Shabbat'), { start: KADDISH_NOTE, end: 'דאמירן בעלמא', role: 'minyan' }),
  sec('vaani-tefilati', 'torah-service', 'ואני תפלתי', SM('Mincha for Shabbat'), { start: 'When a festival occurs on a weekday' }),
  sec('hotzaat-sefer-torah', 'torah-service', 'הוצאת ספר תורה', SMT, { end: 'Once the Torah is placed on the bimah', when: 'shabbat' }),
  sec('torah-reading', 'torah-reading', 'קריאת התורה', SMT, { start: 'Three olim are called up', end: 'Kaddish is not said after the completion', when: 'shabbat' }),
  sec('hagbaha', 'torah-reading', 'הגבהת התורה', SMT, { start: 'Before raising the Sefer Torah', end: 'The Torah is then lowered', when: 'shabbat' }),
  sec('half-kaddish-torah', 'half-kaddish', 'חצי קדיש', SMT, { start: 'As the Torah is being dressed', end: 'דאמירן בעלמא', role: 'minyan', when: 'shabbat' }),
  sec('yehalelu', 'return-torah', 'הכנסת ספר תורה', SMT, { start: 'Then the Torah is returned to the Ark', when: 'shabbat' }),
  ...thFront(SMA, 'amidah'),
  sec('kedusha', 'kedusha', 'קדושה', SMA, { start: /^קדושה$/, role: 'repetition' }),
  sec('kedushat-hashem', 'amidah', 'קדושת השם', SMA, { start: /^קדושת השם$/, end: /^אתה קדוש ושמך קדוש/ }),
  sec('kedushat-hayom', 'amidah', 'אתה אחד', SMA, { start: /^קדושת היום$/, end: 'מקדש השבת' }),
  ...thBack(SMA, 'amidah'),
  sec('tzidkatcha', 'tzidkatcha', 'צדקתך', SMA, { start: 'The individual Amidah ends here', end: 'צדקתך כהררי אל', when: 'tachanunIfWeekday' }),
  // The Mincha leaves say "followed by the recitation of the Full-Kaddish" but print no Kaddish; its words are
  // those printed in the same edition after Shabbat Musaf.
  omit('musaf-before-kaddish', TH_MUSAF, { end: 'The individual Amidah ends here', why: 'Shabbat Musaf (its own service); from this leaf Mincha uses only the Kaddish Shalem' }),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', TH_MUSAF, { start: /^קדיש שלם$/, end: /^עשה שלום/, role: 'minyan' }),
  omit('musaf-after-kaddish', TH_MUSAF, { start: 'קוה אל יי, חזק', why: 'the conclusion of Shabbat Musaf (its own service)' }),
  sec('aleinu', 'aleinu', 'עלינו לשבח', SMA, { start: 'One should rise to recite', end: 'ביום ההוא יהיה' }),
  sec('kaddish-yatom', 'kaddish-yatom', 'קדיש יתום', SMA, { start: /^קדיש יתום$/, end: /^עשה שלום/, role: 'mourners' }),
  sec('al-tira', 'closing-passages', 'אל תירא', SMA, { start: 'אל תירא מפחד פתאם' }),
], {
  reviewed: true,
  conditionsPending: ['Tzidkatcha — omitted on Shabbatot on which Tachanun would not be said on a weekday (edition ¶85); the app\'s `tachanun` is always false on Shabbat, so no key decides it'],
});

// ── Havdalah and Vayiten Lecha ────────────────────────────────────────────────────────────────────────────────────
const havdalah = service('הבדלה', [
  sec('hine-el', 'havdalah', 'הנה אל ישועתי', SB('Havdalah'), { end: 'ובשם יי אקרא' }),
  sec('havdalah', 'havdalah', 'הבדלה', SB('Havdalah'), { start: 'סברי מרנן' }),
  // The edition: "Upon completion of Havdalah the following selections are read".
  sec('vayiten-lecha', 'motzaei-shabbat', 'ויתן לך', SB('For the Conclusion of Shabbat')),
], { reviewed: true });

// ── The Yom Tov Amidah ────────────────────────────────────────────────────────────────────────────────────────────
const FA = F3('Amidah for the Three Festivals');
const FESTIVAL_DAYS = [['pesach', 'On Pesach:', 'חג המצות'], ['shavuot', 'On Shavuot:', 'חג השבעות'], ['sukkot', 'On Sukkot:', 'חג הסכות'], ['sheminiAtzeret', 'On Shemini Atzeret', 'שמיני עצרת החג']];
const festivalAmidah = service('עמידה לשלוש רגלים', [
  sec('pesach-shavuot-sukkot', 'festival-amidah', 'אדני שפתי תפתח', FA, { end: 'שפתי תפתח' }),
  sec('avot', 'festival-amidah', 'ברכת אבות', FA, { start: /^אבות$/, end: 'מגן אברהם' }),
  sec('gevurot', 'festival-amidah', 'גבורות', FA, { start: /^גבורות$/, end: 'רב להושיע' }),
  sec('gevurot-summer', 'festival-amidah', 'מוריד הטל', FA, { start: 'Summer, Pesach through Sukkot', end: 'מוריד הטל', when: 'summer' }),
  sec('gevurot-winter', 'festival-amidah', 'משיב הרוח ומוריד הגשם', FA, { start: 'Winter, Shmini Atzeret', end: 'ומוריד הגשם', when: 'winter' }),
  sec('gevurot-end', 'festival-amidah', '', FA, { start: 'מכלכל חיים בחסד', continues: true }),
  sec('kedusha-shacharit', 'kedusha', 'קדושה לשחרית', FA, { start: /^קדושה$/, role: 'repetition' }),
  sec('kedusha-mincha', 'kedusha', 'קדושה למנחה', FA, { start: /^קדושה למנחה$/, role: 'repetition' }),
  sec('kedushat-hashem', 'festival-amidah', 'קדושת השם', FA, { start: /^קדושת השם$/, end: /^אתה קדוש ושמך קדוש/ }),
  sec('ata-bechartanu', 'festival-amidah', 'אתה בחרתנו', FA, { start: /^קדושת היום$/, end: 'עלינו קראת' }),
  sec('vatodienu', 'festival-amidah', 'ותודיענו', FA, { start: 'When a Festival falls on a Saturday night', end: 'ותודיענו', when: 'motzaeiShabbat' }),
  sec('vatiten', 'festival-amidah', '', FA, { start: 'ותתן לנו יי אלהינו באהבה', continues: true }),
  sec('vatiten-shabbat', 'festival-amidah', '', FA, { start: /^\( On Shabbat add : השבת הזה ואת יום\)$/, when: 'shabbat', continues: true }),
  ...FESTIVAL_DAYS.map(([key, caption, words]) => sec(`day-${key}`, 'festival-amidah', '', FA, { start: caption, end: words, when: key, continues: true })),
  sec('mikra-kodesh', 'festival-amidah', '', FA, { start: 'מקרא קדש זכר ליציאת מצרים', continues: true }),
  sec('yaale-veyavo', 'festival-amidah', 'יעלה ויבוא', FA, { start: 'יעלה ויבא ויגיע' }),
  sec('yaale-shabbat', 'festival-amidah', '', FA, { start: /^\( On Shabbat add : השבת הזה וביום\)$/, when: 'shabbat', continues: true }),
  ...FESTIVAL_DAYS.map(([key, caption, words]) => sec(`yaale-${key}`, 'festival-amidah', '', FA, { start: caption, end: words, when: key, continues: true })),
  sec('yaale-end', 'festival-amidah', '', FA, { start: 'ביום טוב מקרא קדש הזה, זכרנו', continues: true }),
  sec('vehasienu', 'festival-amidah', 'והשיאנו', FA, { start: 'והשיאנו יי אלהינו' }),
  sec('retze', 'festival-amidah', 'רצה', FA, { start: /^אבודה$/ }),
  sec('modim', 'festival-amidah', 'מודים', FA, { start: /^מודים$/ }),
  sec('birkat-kohanim', 'birkat-kohanim', 'ברכת כהנים', FA, { start: /^ברכת קהנים$/, role: 'repetition' }),
  sec('sim-shalom', 'festival-amidah', 'שים שלום', FA, { start: /^שלום$/, end: 'The Chazzan\'s repetition ends here' }),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', FA, { start: 'נצור לשוני מרע', end: 'שיבנה בית המקדש' }),
  sec('after-amidah', 'festival-amidah', 'אחר העמידה', FA, { start: 'The individual Amidah ends here' }),
], {
  reviewed: true,
  conditionsPending: ['the Kedusha of Shacharit and of Mincha are both printed; the composer has no key for the prayer (Shacharit / Mincha / Maariv) the Amidah is said at'],
});

// ── Musaf of the Three Festivals (Yom Tov and Chol HaMoed) ────────────────────────────────────────────────────────
const FMU = F3('Musaf for the Three Festivals');
const FESTIVAL_KORBANOT = [
  ['pesach-first', 'On the first two days of Pesach add', 'pesach&yomTov'],
  ['pesach-rest', 'On the last six days of Pesach add', 'pesach'],
  ['shavuot', 'On Shavuot add', 'shavuot'],
  ['sukkot-first', 'On the first two days of Sukkot add', 'sukkot&yomTov'],
  ['sukkot-chm-1', 'On the first day of Chol haMoed Sukkot add', 'sukkot&cholHamoed'],
  ['sukkot-chm-2', 'On the second day of Chol haMoed Sukkot add', 'sukkot&cholHamoed'],
  ['sukkot-chm-3', 'On the third day of Chol haMoed Sukkot add', 'sukkot&cholHamoed'],
  ['sukkot-chm-4', 'On the fourth day of Chol haMoed Sukkot add', 'sukkot&cholHamoed'],
  ['hoshana-rabbah', 'On Hoshanah Rabba add', 'hoshanaRabbah'],
  ['shemini-atzeret', 'On Shemini Atzeret and Simchat Torah add', 'sheminiAtzeret'],
];
const festivalMusafTH = service('מוסף לשלוש רגלים', [
  sec('sefatai', 'musaf', 'אדני שפתי תפתח', FMU, { end: 'שפתי תפתח' }),
  sec('avot', 'musaf', 'ברכת אבות', FMU, { start: /^אבות$/, end: 'מגן אברהם' }),
  sec('gevurot', 'musaf', 'גבורות', FMU, { start: /^גבורות$/, end: 'רב להושיע' }),
  sec('gevurot-summer', 'musaf', 'מוריד הטל', FMU, { start: 'Summer, Pesach through Sukkot', end: 'מוריד הטל', when: 'summer' }),
  sec('gevurot-winter', 'musaf', 'משיב הרוח ומוריד הגשם', FMU, { start: 'Winter, Shmini Atzeret', end: 'ומוריד הגשם', when: 'winter' }),
  sec('gevurot-end', 'musaf', '', FMU, { start: 'מכלכל חיים בחסד', continues: true }),
  // The chazzan's repetition of Avot and Gevurot on the first day of Pesach (Tal) and on Shemini Atzeret (Geshem).
  sec('tal', 'musaf', 'תפלת טל', F3('Musaf for the First Day of Pesach'), { role: 'repetition', when: 'pesach&yomTov' }),
  sec('geshem', 'musaf', 'תפלת גשם', F3('Musaf for Shemini Atzeret'), { role: 'repetition', when: 'sheminiAtzeret' }),
  sec('kedusha', 'kedusha', 'קדושה לשבת ויום טוב', FMU, { start: 'The Kedushah is recited', role: 'repetition', when: 'yomTov|shabbat' }),
  sec('kedusha-chm', 'kedusha', 'קדושה לחול המועד', FMU, { start: /^קדושה לחול המועד$/, role: 'repetition', when: 'cholHamoed&!shabbat' }),
  sec('kedushat-hashem', 'musaf', 'קדושת השם', FMU, { start: 'One is to remain standing until after the Chazzan', end: 'האל הקדוש' }),
  sec('ata-bechartanu', 'musaf', 'אתה בחרתנו', FMU, { start: /^קדושת היום$/, end: 'חגים וזמנים לששון' }),
  sec('vatiten-shabbat', 'musaf', '', FMU, { start: /^\( On Shabbat add : השבת הזה ואת יום\)$/, when: 'shabbat', continues: true }),
  sec('day-note', 'musaf', '', FMU, { start: 'On the days of Chol HaMoed omit the word', end: 'On the days of Chol HaMoed omit the word', continues: true }),
  sec('day-pesach', 'musaf', '', FMU, { start: 'On Pesach:', end: 'זמן חרותנו', when: 'pesach', continues: true }),
  sec('day-shavuot', 'musaf', '', FMU, { start: 'On Shavuot:', end: 'זמן מתן תורתנו', when: 'shavuot', continues: true }),
  sec('day-sukkot', 'musaf', '', FMU, { start: 'On Sukkot:', end: 'זמן שמחתנו', when: 'sukkot', continues: true }),
  sec('day-shemini-atzeret', 'musaf', '', FMU, { start: 'On Shemini Atzeret and Simchat Torah:', end: 'זמן שמחתנו', when: 'sheminiAtzeret', continues: true }),
  sec('umipnei-chataeinu', 'musaf', 'ומפני חטאינו', FMU, { start: 'מקרא קדש זכר ליציאת מצרים', end: 'ומפני חטאינו' }),
  sec('musaf-pesach', 'musaf', '', FMU, { start: 'On Pesach:', end: 'חג המצות', when: 'pesach', continues: true }),
  sec('musaf-shavuot', 'musaf', '', FMU, { start: 'On Shavuot:', end: 'חג השבעות', when: 'shavuot', continues: true }),
  sec('musaf-sukkot', 'musaf', '', FMU, { start: 'On Sukkot:', end: 'חג הסכות', when: 'sukkot', continues: true }),
  sec('musaf-shemini-atzeret', 'musaf', '', FMU, { start: 'On Shemini Atzeret:', end: 'שמיני עצרת החג', when: 'sheminiAtzeret', continues: true }),
  sec('naase-venakriv', 'musaf', '', FMU, { start: 'On the days of Chol HaMoed omit the word', end: 'מפי כבודך', continues: true }),
  sec('korbanot-shabbat', 'musaf', 'וביום השבת', FMU, { start: 'On Shabbat add:', end: 'וביום השבת', when: 'shabbat' }),
  ...FESTIVAL_KORBANOT.map(([id, caption, when]) => sec(`korbanot-${id}`, 'musaf', 'קרבנות היום', FMU, { start: caption, end: /"אלהינו" below/, when })),
  sec('yismechu', 'musaf', 'ישמחו במלכותך', FMU, { start: 'On Shabbat add:', end: 'ישמחו במלכותך', when: 'shabbat' }),
  sec('melech-rachaman', 'musaf', 'מלך רחמן', FMU, { start: 'מלך רחמן, רחם עלינו' }),
  sec('vehasienu', 'musaf', 'והשיאנו', FMU, { start: 'On Shabbat add the words in parenthesis' }),
  sec('retze', 'musaf', 'רצה', FMU, { start: 'רצה יי אלהינו בעמך ישראל', end: 'המחזיר שכינתו לציון' }),
  sec('modim', 'musaf', 'מודים', FMU, { start: /^מודים$/, end: 'ולך נאה להודות' }),
  sec('nesiat-kapayim', 'birkat-kohanim', 'ברכת כהנים · נשיאת כפים', F3('The Priestly Blessing'), { role: 'repetition', when: 'yomTov' }),
  sec('birkat-kohanim', 'birkat-kohanim', 'ברכת כהנים', FMU, { start: 'On Festival days the Kohanim ascend', role: 'repetition' }),
  sec('sim-shalom', 'musaf', 'שים שלום', FMU, { start: /^שלום$/, end: 'repetition of the Amidah ends here' }),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', FMU, { start: 'נצור לשוני מרע', end: 'שיבנה בית המקדש' }),
  sec('after-amidah', 'musaf', 'אחר העמידה', FMU, { start: 'The individual Amidah ends here' }),
], {
  reviewed: true,
  conditionsPending: [
    'the day within the festival: the first-days and last-days verses of Pesach, and the Sukkot verses of each day of Chol HaMoed, are each shown on every day their festival key holds — the app has no key for the day of the festival',
    'Tal (first day of Pesach only) and Geshem (Shemini Atzeret, not Simchat Torah abroad) are marked by their festival key, which also holds on other days',
  ],
});

export default {
  nusach: 'chabad',
  index: 'Weekday Siddur Chabad',
  // The second licensed Chabad edition, for the Shabbat and Yom Tov services.
  extraIndexes: ['Siddur Tehillat Hashem'],
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
    hallel,
    'rosh-chodesh-musaf': roshChodeshMusaf,
    omer,
    'festival-amidah': festivalAmidah,
    'festival-musaf': festivalMusafTH,
  },
  // Services of the schema that the licensed editions do not contain: schema id → reason.
  sourceGaps: {},
};
