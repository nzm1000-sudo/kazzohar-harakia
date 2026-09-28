// Nusach Sefard (Chassidic), composed from Sefaria's "Siddur Sefard" (Torat Emet 357, Public Domain; the Metsudah
// siddur, CC-BY). Every section is a slice of that edition — see dsl.mjs for the vocabulary and prayerSchema.mjs for
// the concepts. Authoring notes, doubts and source gaps: docs/siddur/notes-sefard.md.
import { sec, omit, service, leaf } from './dsl.mjs';

const R = leaf('Siddur Sefard');

// The edition prints a one- or two-word bold heading above each blessing ("אבות", "בינה", "עבודה"…). The reader drops
// an edition heading only when it is the section's first paragraph AND equals the section's title; where the reviewed
// title differs from the edition's word, the heading paragraph is left out here (it would otherwise read as words of
// the prayer). The section's title stands in its place.
const HEADING_WHY = 'the edition\'s own one-word heading for this blessing — the section carries its reviewed title instead';
const exact = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const heading = (id, ref, text) => omit(`${id}-heading`, ref, { start: exact(text), end: exact(text), why: HEADING_WHY });

// ── The weekday Amidah (Shacharit, Mincha, Maariv) ──────────────────────────────────────────────────────────────────
// The three leaves print the same blessings under the same headings; they differ in what each service adds
// (Kedusha, Modim DeRabbanan and Birkat Kohanim in the repetition; Aneinu at Mincha; Atah Chonantanu at Maariv).
function weekdayAmidah(kind) {
  const leafName = { shacharit: 'Weekday Shacharit, Amidah', mincha: 'Weekday Mincha, Amidah', maariv: 'Weekday Maariv, Amidah' }[kind];
  const A = R(leafName);
  const MINCHA_A = R('Weekday Mincha, Amidah');
  const repetition = kind !== 'maariv';
  return [
    sec('amidah-opening', 'amidah', 'תפילת העמידה', A, { end: 'אדני שפתי תפתח' }),
    heading('avot', A, 'אבות'),
    sec('avot', 'amidah', 'ברכת אבות', A, { end: 'ברוך אתה יהוה מגן אברהם' }),
    sec('gevurot', 'amidah', 'גבורות', A, { start: exact('גבורות'), end: 'ברוך אתה יהוה מחיה המתים' }),
    ...(repetition ? [
      // "In the repetition Kedusha is said here" — the section's role label says exactly this.
      omit('kedusha-direction', A, { start: 'בחזרת הש"ץ אומרים כאן קדושה', end: 'בחזרת הש"ץ אומרים כאן קדושה', why: 'the direction "in the repetition Kedusha is said here", shown as the section\'s role label (בחזרת שליח הציבור)' }),
      sec('kedusha', 'kedusha', 'קדושה', A, { start: exact('קדושה'), end: 'ימלך יהוה לעולם אלהיך ציון', role: 'repetition' }),
    ] : []),
    sec('kedushat-hashem', 'amidah', 'קדושת השם', A, { start: exact('קדושת השם'), end: 'אם טעה וסיים האל הקדוש' }),
    heading('daat', A, 'בינה'),
    ...(kind === 'maariv' ? [
      sec('daat', 'amidah', 'חונן הדעת', A, { end: 'ומלמד לאנוש בינה' }),
      sec('atah-chonantanu', 'motzaei-shabbat', 'אתה חוננתנו', A, { start: 'אתה חוננתנו למדע תורתך', end: 'אתה חוננתנו למדע תורתך', when: 'motzaeiShabbat' }),
      sec('daat-end', 'amidah', '', A, { start: 'חננו מאתך חכמה', end: 'חונן הדעת', continues: true }),
    ] : [
      sec('daat', 'amidah', 'חונן הדעת', A, { end: 'חונן הדעת' }),
    ]),
    sec('teshuva', 'amidah', 'תשובה', A, { start: exact('תשובה'), end: 'הרוצה בתשובה' }),
    sec('selicha', 'amidah', 'סליחה', A, { start: exact('סליחה'), end: 'חנון המרבה לסלוח' }),
    sec('geula', 'amidah', 'גאולה', A, { start: exact('גאולה'), end: 'ברוך אתה יהוה גואל ישראל' }),
    ...(kind === 'mincha' ? [
      sec('aneinu-chazzan', 'amidah', 'עננו', A, { start: 'בתענית ציבור אומר כאן הש"ץ עננו', end: 'העונה לעמו ישראל בעת צרה', when: 'fast', role: 'repetition' }),
    ] : []),
    ...(kind === 'shacharit' ? [
      // Shacharit prints only a pointer to the chazzan's Aneinu; its words are printed once, in the edition's Mincha.
      omit('aneinu-pointer', A, { start: '(בתענית ציבור אומר כאן הש"ץ עננו', end: '(בתענית ציבור אומר כאן הש"ץ עננו', why: 'a pointer to the chazzan\'s Aneinu, whose words are shown from the edition\'s Mincha (next section)' }),
      omit('mincha-amidah-before', MINCHA_A, { end: /^ראה נא בענינו/, why: 'the edition\'s Mincha Amidah: only its chazzan\'s Aneinu is used here' }),
      sec('aneinu-chazzan', 'amidah', 'עננו', MINCHA_A, { start: 'בתענית ציבור אומר כאן הש"ץ עננו', end: 'העונה לעמו ישראל בעת צרה', when: 'fast', role: 'repetition' }),
      omit('mincha-amidah-after', MINCHA_A, { start: exact('רפואה'), why: 'the edition\'s Mincha Amidah: only its chazzan\'s Aneinu is used here' }),
    ] : []),
    sec('refua', 'amidah', 'רפואה', A, { start: exact('רפואה'), end: 'רופא חולי עמו ישראל' }),
    sec('birkat-hashanim', 'amidah', 'ברכת השנים', A, { start: exact('ברכת השנים') }),
    sec('kibbutz-galuyot', 'amidah', 'קיבוץ גליות', A, { start: exact('קיבוץ גליות') }),
    heading('mishpat', A, 'דין'),
    sec('mishpat', 'amidah', 'השבת המשפט', A, { end: 'בכל השנה אם אמר המלך המשפט' }),
    sec('minim', 'amidah', 'ברכת המינים', A, { start: exact('ברכת המינים') }),
    heading('tzadikim', A, 'צדיקים'),
    sec('tzadikim', 'amidah', 'על הצדיקים', A, { end: 'משען ומבטח לצדיקים' }),
    ...(kind === 'mincha' ? [
      sec('yerushalayim', 'amidah', 'בנין ירושלים', A, { start: exact('בנין ירושלים'), end: 'מהרה לתוכה תכין' }),
      sec('nachem', 'amidah', 'נחם', A, { start: 'במנחת תשעה באב', end: '(את צמח וגו\')', when: 'tishaBav' }),
      sec('yerushalayim-end', 'amidah', '', A, { start: 'ברוך אתה יהוה בונה ירושלים', end: 'ברוך אתה יהוה בונה ירושלים', when: '!tishaBav', continues: true }),
    ] : [
      sec('yerushalayim', 'amidah', 'בנין ירושלים', A, { start: exact('בנין ירושלים') }),
    ]),
    sec('malchut-david', 'amidah', 'מלכות בית דוד', A, { start: exact('מלכות בית דוד') }),
    heading('shomea-tefila', A, 'קבלת תפלה'),
    ...(kind === 'mincha' ? [
      sec('shomea-tefila', 'amidah', 'שומע תפילה', A, { end: 'ריקם אל תשיבנו' }),
      sec('aneinu', 'amidah', 'עננו', A, { start: 'בתענית ציבור אומרים כאן עננו', end: 'העונה בעת צרה', when: 'fast' }),
      sec('shomea-tefila-end', 'amidah', '', A, { start: 'כי אתה שומע תפלת', end: 'ברוך אתה יהוה שומע תפלה', continues: true }),
    ] : [
      sec('shomea-tefila', 'amidah', 'שומע תפילה', A, {}),
    ]),
    heading('retze', A, 'עבודה'),
    sec('retze', 'amidah', 'רצה', A, { end: 'עבודת ישראל עמך' }),
    sec('yaale-veyavo', 'amidah', 'יעלה ויבוא', A, { start: 'בראש חדש ובחול המועד', when: 'roshChodesh|cholHamoed' }),
    sec('retze-end', 'amidah', '', A, { start: /^ותחזינה עינינו/, end: 'המחזיר שכינתו לציון', continues: true }),
    heading('modim', A, 'הודאה'),
    sec('modim', 'amidah', 'מודים', A, { end: 'כי מעולם קוינו לך' }),
    ...(repetition ? [
      sec('modim-derabanan', 'modim-derabanan', 'מודים דרבנן', A, { start: 'כשיגיע שליח צבור למודים', end: 'ברוך אל ההודאות', role: 'repetition' }),
    ] : []),
    sec('al-hanisim', 'amidah', 'על הנסים', A, { start: 'בחנוכה ופורים אומרים על הנסים', end: 'ותלו אותו ואת בניו על העץ', when: 'chanukah|purim' }),
    sec('modim-end', 'amidah', '', A, { start: 'ועל כלם יתברך', end: 'הטוב שמך ולך נאה להודות', continues: true }),
    ...(kind === 'shacharit' ? [
      sec('birkat-kohanim', 'birkat-kohanim', 'ברכת כהנים', A, { start: exact('ברכת כהנים'), end: 'למשמרת שלום', role: 'repetition' }),
    ] : []),
    ...(kind === 'mincha' ? [
      omit('birkat-kohanim-direction', A, { start: 'בתענית ציבור אומר כאן הש"ץ ברכת כהנים', end: 'בתענית ציבור אומר כאן הש"ץ ברכת כהנים', why: 'the direction "on a public fast the chazzan says Birkat Kohanim here", shown as the section\'s condition and role labels' }),
      sec('birkat-kohanim', 'birkat-kohanim', 'ברכת כהנים', A, { start: exact('ברכת כהנים'), end: 'למשמרת שלום', role: 'repetition', when: 'fast' }),
    ] : []),
    heading('sim-shalom', A, 'שלום'),
    sec('sim-shalom', 'amidah', 'שים שלום', A, { end: /^ברוך אתה יהוה המברך את עמו/ }),
    sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', A, { start: 'יהיו לרצון אמרי פי', end: 'שיבנה בית המקדש' }),
  ];
}

// ── Weekday Shacharit ───────────────────────────────────────────────────────────────────────────────────────────────
const UA = path => R(`Upon Arising, ${path}`);
const WS = path => R(`Weekday Shacharit, ${path}`);
const RC = path => R(`Rosh Chodesh, ${path}`);
const TR = path => R(`Torah Readings, ${path}`);
const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'ששי'];
// Lamenatzeach, Kel Erech Apayim and Beit Yaakov are not said on Rosh Chodesh, Chanukah, Purim, Erev Pesach, Erev
// Yom Kippur and Tisha B'Av (the edition's own notes: Ashrei ¶1, Beit Yaakov ¶0). Erev Pesach, Erev Yom Kippur and
// Purim Katan have no condition key yet (conditionsPending).
const LAMENATZEACH_DAYS = '!roshChodesh&!chanukah&!purim&!tishaBav';
// On Rosh Chodesh and Chol HaMoed the service goes on to Musaf after Uva LeTziyon; the closing prayers are then said
// after Musaf (the edition prints them in its Rosh Chodesh and festival Musaf).
const NO_MUSAF = '!roshChodesh&!cholHamoed';

const weekdayShacharit = service('שחרית לימות החול', [
  // Upon arising (the edition's "סדר השכמת הבוקר", in its order)
  sec('modeh-ani', 'modeh-ani', 'מודה אני', UA('Modeh Ani'), { end: 'רבה אמונתך' }),
  sec('reishit-chochma', 'netilat-yadayim', 'ראשית חכמה', UA('Modeh Ani'), { start: 'לאחר שנטל ידיו', end: 'ראשית חכמה יראת' }),
  sec('tzitzit', 'tallit', 'ברכת טלית קטן', UA('Modeh Ani'), { start: 'לפני עטיפת הטלית קטן' }),
  sec('tallit', 'tallit', 'עטיפת טלית', UA('Tallit')),
  sec('tefillin', 'tefillin', 'הנחת תפילין', UA('Tefilin'), { end: 'וארשתיך לי לעולם' }),
  sec('kadesh', 'tefillin', 'קדש · והיה כי יביאך', UA('Tefilin'), { start: 'אחר שיניח תפילין יאמר פרשיות' }),
  sec('tefila-kodem', 'morning-prayers', 'תפילה קודם התפילה', UA('Introductory Prayers'), { end: 'ותחזק התקשרותנו באהבה' }),
  sec('patach-eliyahu', 'morning-prayers', 'פתח אליהו', UA('Introductory Prayers'), { start: 'נוהגים לומר זה מתיקוני הזהר', end: 'רבון העולמים, אנת הוא עלת העלות' }),
  sec('odeh-lael', 'morning-prayers', 'אודה לאל לבב חוקר', UA('Introductory Prayers'), { start: 'אודה לאל לבב חוקר' }),
  sec('hareini-mechaven', 'morning-prayers', 'הריני מכוון', UA('Introductory Prayers'), { start: 'כתב הרב מבוטשאטש', role: 'optional' }),
  sec('ahavat-reim', 'morning-prayers', 'הריני מקבל עלי', UA('Upon Entering Synagogue'), { end: 'ואהבת לרעך כמוך' }),
  sec('ma-tovu', 'morning-prayers', 'מה טובו', UA('Upon Entering Synagogue'), { start: 'כשיכנס לבית הכנסת', end: 'מה טבו אהליך' }),
  sec('adon-olam', 'morning-prayers', 'אדון עולם', UA('Upon Entering Synagogue'), { start: 'ויאמר פיוט "אדון עולם"', end: 'ועם רוחי גויתי' }),
  sec('yigdal', 'morning-prayers', 'יגדל', UA('Upon Entering Synagogue'), { start: 'פיוט המיוסד על שלושה עשר עקרי האמונה' }),
  // Morning blessings and the blessings over the Torah
  sec('al-netilat-yadayim', 'netilat-yadayim', 'על נטילת ידיים', WS('Morning Blessings'), { end: 'על נטילת ידים' }),
  sec('asher-yatzar', 'morning-blessings', 'אשר יצר', WS('Morning Blessings'), { start: 'אשר יצר את האדם', end: 'אשר יצר את האדם' }),
  sec('elokai-neshama', 'morning-blessings', 'אלהי נשמה', WS('Morning Blessings'), { start: 'אלהי, נשמה שנתת בי' }),
  sec('birkot-hatorah', 'torah-blessings', 'ברכות התורה', WS('Blessings on Torah'), { end: 'ותלמוד תורה כנגד כלם' }),
  sec('birkot-hashachar', 'morning-blessings', 'ברכות השחר', WS('Blessings on Torah'), { start: 'הנותן לשכוי בינה' }),
  sec('akeda', 'morning-prayers', 'פרשת העקדה', WS('Morning Prayer'), { end: 'וישב אברהם בבאר שבע' }),
  sec('ribono-akeda', 'morning-prayers', 'רבונו של עולם', WS('Morning Prayer'), { start: 'ביום שאין אומרים תחנון אין אומרים זה', end: 'כי ביתי בית תפלה', when: 'tachanun' }),
  sec('leolam-yehe', 'morning-prayers', 'לעולם יהא אדם', WS('Morning Prayer'), { start: 'לעולם יהא אדם ירא שמים' }),
  // Korbanot
  sec('kiyor', 'korbanot', 'פרשת הכיור', WS('Korbanot'), { end: 'ועשית כיור נחשת' }),
  sec('terumat-hadeshen', 'korbanot', 'פרשת תרומת הדשן', WS('Korbanot'), { start: 'תרומת הדשן קודמת לכל עבודות', end: 'אש תמיד תוקד על המזבח' }),
  sec('tamid', 'korbanot', 'פרשת התמיד', WS('Korbanot'), { start: 'אומרים פרשת התמיד', end: 'שתהא אמירה זו, חשובה ומקבלת' }),
  sec('ketoret', 'ketoret', 'פטום הקטורת', WS('Korbanot'), { start: 'אתה הוא יהוה אלהינו שהקטירו', end: 'אתה סתר לי מצר' }),
  sec('abaye', 'korbanot', 'אביי הוה מסדר', WS('Korbanot'), { start: 'אביי הוה מסדר', end: 'אביי הוה מסדר' }),
  sec('ana-bekoach', 'korbanot', 'אנא בכח', WS('Korbanot'), { start: 'ואח"כ יאמר תפלת רבי נחוניא', end: 'אנא בכח גדלת ימינך' }),
  sec('ribon-haolamim', 'korbanot', 'רבון העולמים', WS('Korbanot'), { start: 'רבון העולמים אתה צויתנו', end: 'רבון העולמים אתה צויתנו' }),
  sec('musaf-rosh-chodesh-korban', 'korbanot', 'ובראשי חדשיכם', WS('Korbanot'), { start: 'בראש חודש מוסיפים', end: 'ובראשי חדשיכם תקריבו', when: 'roshChodesh' }),
  sec('eizehu-mekoman', 'korbanot', 'איזהו מקומן', WS('Korbanot'), { start: 'קבעו לשנות אחר פרשת התמיד' }),
  sec('braita', 'korbanot', 'ברייתא דרבי ישמעאל', WS("B'raita d'Rabi Yishmael"), { end: 'שיבנה בית המקדש' }),
  sec('kaddish-derabanan-1', 'kaddish-derabanan', 'קדיש דרבנן', WS("B'raita d'Rabi Yishmael"), { start: 'מה שאנו אומרין הקדיש בלשון תרגום', role: 'minyan' }),
  // Pesukei DeZimra
  sec('hodu', 'hodu', 'הודו', WS('Hodu'), { end: 'אשירה ליהוה כי גמל עלי' }),
  sec('mizmor-shir', 'mizmor-shir', 'מזמור שיר חנוכת הבית', WS('Hodu'), { start: 'מזמור זה אמרו שלמה', end: 'מזמור שיר חנכת הבית' }),
  sec('hashem-melech', 'pesukei-dezimra', 'ה׳ מלך · הושיענו · למנצח', WS('Hodu'), { start: 'יהוה מלך, יהוה מלך', end: 'למנצח בנגינת מזמור שיר' }),
  sec('baruch-sheamar', 'baruch-sheamar', 'ברוך שאמר', WS('Hodu'), { start: 'ברוך שאמר צריך לאומרו', end: 'מלך מהלל בתשבחות' }),
  sec('mizmor-letoda', 'pesukei-dezimra', 'מזמור לתודה', WS('Hodu'), { start: 'מזמור לתודה יש לאומרו', end: 'מזמור לתודה הריעו' }),
  sec('yehi-chevod', 'pesukei-dezimra', 'יהי כבוד', WS('Hodu'), { start: 'שמונה עשר פסוקי יהי כבוד', end: 'יהי כבוד יהוה לעולם' }),
  // The Ashrei of Pesukei DeZimra is concept pesukei-dezimra: the spine's Ashrei is the one after Tachanun.
  sec('ashrei-pz', 'pesukei-dezimra', 'אשרי', WS('Hodu'), { start: 'צריך לכוין בתהלה לדוד', end: /^אשרי יושבי ביתך/ }),
  sec('halleluyah', 'pesukei-dezimra', 'הללויה', WS('Hodu'), { start: 'זה המזמור מעורר לאדם', end: 'הללויה הללו אל בקדשו' }),
  sec('baruch-hashem-leolam', 'pesukei-dezimra', 'ברוך ה׳ לעולם', WS('Hodu'), { start: 'קבעו פסוקים אלו אחר כל הנשמה', end: 'ברוך יהוה לעולם אמן ואמן' }),
  sec('vayevarech-david', 'pesukei-dezimra', 'ויברך דוד', WS('Hodu'), { start: 'הטעם שנהגו לומר ויברך דוד', end: 'וכרות עמו הברית' }),
  sec('az-yashir', 'az-yashir', 'שירת הים', WS('Hodu'), { start: 'תקנו לומר וישע' }),
  sec('yishtabach', 'yishtabach', 'ישתבח', WS('Yishtabach'), { end: 'ישתבח שמך לעד' }),
  sec('shir-hamaalot-aseret', 'yishtabach', 'שיר המעלות ממעמקים', WS('Yishtabach'), { start: 'בעשרת ימי תשובה מוסיפין', end: 'שיר המעלות ממעמקים', when: 'aseret' }),
  sec('half-kaddish-yishtabach', 'half-kaddish', 'חצי קדיש', WS('Yishtabach'), { start: 'ואומר החזן חצי קדיש', role: 'minyan' }),
  // Shema and its blessings
  sec('barchu', 'barchu', 'ברכו', WS('The Shema'), { end: 'ברוך יהוה המברך לעולם ועד', role: 'minyan' }),
  sec('yotzer', 'shema-blessings', 'יוצר אור', WS('The Shema'), { start: 'אין להפסיק כלל בין ברכו', end: 'יוצר המאורות' }),
  sec('ahavat-olam', 'shema-blessings', 'אהבת עולם', WS('The Shema'), { start: 'בברכה זו נכללים דברים רבים', end: 'הבוחר בעמו ישראל באהבה' }),
  sec('shema', 'shema', 'קריאת שמע', WS('The Shema'), { start: 'ואומר שמע ישראל. ונהגו לאומרו', end: 'יהוה אלהיכם אמת' }),
  sec('emet-veyatziv', 'after-shema', 'אמת ויציב', WS('The Shema'), { start: 'כל שלא אמר אמת ויציב' }),
  // The Amidah
  ...weekdayAmidah('shacharit'),
  // Hallel (Rosh Chodesh, Chanukah, Chol HaMoed) — printed once, in the edition's Rosh Chodesh section.
  heading('hallel', RC('Hallel'), 'סדר הלל'),
  sec('hallel', 'hallel', 'הלל', RC('Hallel'), { end: 'זבדיה ישמרנו ויחינו', when: 'hallel' }),
  sec('kaddish-after-hallel', 'kaddish-titkabal', 'קדיש תתקבל', RC('Hallel'), { start: 'בראש חודש וביום טוב ובחול המועד אומר החזן', when: 'hallel&!chanukah', role: 'minyan' }),
  sec('half-kaddish-after-hallel', 'half-kaddish', 'חצי קדיש', RC('Hallel'), { start: 'בראש חודש וביום טוב ובחול המועד אומר החזן', end: 'עד כאן אומרים בחנוכה', when: 'chanukah', role: 'minyan', rewind: true }),
  // Avinu Malkeinu and Tachanun
  sec('avinu-malkeinu', 'avinu-malkeinu', 'אבינו מלכנו', WS('Avinu Malkeinu'), { when: 'avinuMalkeinu' }),
  sec('vidui', 'vidui', 'וידוי ושלוש עשרה מידות', WS('Tachanun'), { end: 'כי אתה אדני טוב וסלח', when: 'tachanun' }),
  sec('nefilat-apayim', 'tachanun', 'נפילת אפיים', WS('Tachanun'), { start: 'כשנופל על פניו', when: 'tachanun' }),
  sec('vehu-rachum', 'tachanun', 'והוא רחום', WS('For Monday & Thursday'), { when: 'mondayThursday&tachanun' }),
  sec('shomer-yisrael', 'tachanun', 'שומר ישראל', WS('For Monday & Thursday'), { start: 'שומר ישראל שמור', end: 'ואנחנו לא נדע מה נעשה', when: 'tachanun' }),
  // On Hallel days the Kaddish after Hallel (above) takes this Kaddish's place.
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', WS('For Monday & Thursday'), { start: 'ש"ץ אומר חצי קדיש', when: '!hallel', role: 'minyan' }),
  // The Torah reading (Monday, Thursday, fasts, Chanukah, Purim, Chol HaMoed); Rosh Chodesh has its own below.
  sec('kel-erech-apayim', 'torah-service', 'אל ארך אפים', WS('Torah Reading'), { end: 'סלח נא כרוב רחמיך אל', when: 'mondayThursday&tachanun' }),
  sec('torah-service', 'torah-service', 'הוצאת ספר תורה', WS('Torah Reading'), { start: 'משה רבינו ונביאים שעמו תקנו', end: 'ואתם הדבקים ביהוה', when: 'torahReading&!roshChodesh', role: 'minyan' }),
  sec('torah-reading', 'torah-reading', 'קריאת התורה', WS('Torah Reading'), { start: 'כשקורין אותו לתורה יאמר זה', end: 'ברוך שפטרני מענשו', when: 'torahReading&!roshChodesh', role: 'minyan' }),
  sec('fast-torah-text', 'torah-reading', 'קריאה בתורה לתענית ציבור', TR('Fast Day Torah Reading'), { when: 'fast&!tishaBav', role: 'minyan' }),
  // The weekday leaf prints no Kaddish after the reading: the edition's own half Kaddish of this rite is repeated.
  sec('half-kaddish-torah', 'half-kaddish', 'חצי קדיש', WS('For Monday & Thursday'), { start: 'ש"ץ אומר חצי קדיש', end: 'דאמירן בעלמא', when: 'torahReading&!roshChodesh', role: 'minyan', rewind: true }),
  sec('hagbaha', 'torah-reading', 'הגבהת ספר תורה', WS('Torah Reading'), { start: 'בעת הגבהת ס"ת לאחר הקריאה', end: 'יהוה חפץ למען צדקו', when: 'torahReading&!roshChodesh', role: 'minyan' }),
  sec('yehi-ratzon-torah', 'torah-reading', 'יהי רצון', WS('Torah Reading'), { start: 'בשני וחמישי כשאומרים תחנון בשעה שהגולל', when: 'mondayThursday&tachanun' }),
  sec('return-torah', 'return-torah', 'הכנסת ספר תורה', WS('Ashrei'), { start: 'בשני ובחמישי ושאר ימים שמוציאין', when: 'torahReading&!roshChodesh', role: 'minyan' }),
  // Rosh Chodesh, in the edition's own order for the day: the Song of the Day and Barchi Nafshi after Hallel,
  // before the Torah reading.
  omit('rc-song-heading', RC('Song of the Day'), { start: exact('שיר של יום'), end: exact('שיר של יום'), why: HEADING_WHY }),
  ...DAYS.flatMap((day, index) => [
    sec(`rc-song-day${index}`, 'song-of-day', 'שיר של יום', RC('Song of the Day'), { start: `שיר של יום ${day}:`, end: 'הושיענו יהוה אלהינו וקבצנו', when: `roshChodesh&day${index}` }),
    sec(`rc-song-kaddish-day${index}`, 'kaddish-yatom', 'קדיש יתום', RC('Song of the Day'), { start: 'קדיש יתום:', end: 'עשה שלום במרומיו', when: `roshChodesh&day${index}`, role: 'mourners' }),
  ]),
  sec('rc-barchi-nafshi', 'barchi-nafshi', 'ברכי נפשי', RC('Barchi Nafshi'), { end: 'ברכי נפשי את יהוה יהוה אלהי', when: 'roshChodesh' }),
  sec('rc-barchi-nafshi-kaddish', 'kaddish-yatom', 'קדיש יתום', RC('Barchi Nafshi'), { start: 'קדיש יתום:', when: 'roshChodesh', role: 'mourners' }),
  // Rosh Chodesh: the reading, Ashrei and Uva LeTziyon, Beit Yaakov, the Torah returned, half Kaddish before Musaf.
  omit('rc-torah-heading', RC('Torah Reading'), { start: exact('ספר תורה לראש חדש'), end: exact('ספר תורה לראש חדש'), why: HEADING_WHY }),
  sec('rc-torah-service', 'torah-service', 'הוצאת ספר תורה', RC('Torah Reading'), { end: 'ואתם הדבקים ביהוה', when: 'roshChodesh', role: 'minyan' }),
  sec('rc-torah-reading', 'torah-reading', 'קריאת התורה', RC('Torah Reading'), { start: 'סדר ברכת התורה', end: 'קריאה לראש חודש', when: 'roshChodesh', role: 'minyan' }),
  sec('rc-torah-text', 'torah-reading', 'קריאה לראש חודש', TR('Torah Reading for Rosh Chodesh'), { when: 'roshChodesh', role: 'minyan' }),
  sec('rc-half-kaddish-torah', 'half-kaddish', 'חצי קדיש', RC('Torah Reading'), { start: 'חצי קדיש:', end: 'יהא שמה רבא מברך', when: 'roshChodesh', role: 'minyan' }),
  sec('rc-hagbaha', 'torah-reading', 'הגבהת ספר תורה', RC('Torah Reading'), { start: 'מגביהים את ספר התורה', when: 'roshChodesh', role: 'minyan' }),
  omit('rc-ashrei-heading', RC("Ashrei Uva L'Tziyon"), { start: exact('אשרי ובא לציון'), end: exact('אשרי ובא לציון'), why: HEADING_WHY }),
  sec('rc-ashrei', 'ashrei', 'אשרי', RC("Ashrei Uva L'Tziyon"), { end: 'אשרי יושבי ביתך', when: 'roshChodesh' }),
  sec('rc-uva-letzion', 'uva-letzion', 'ובא לציון', RC("Ashrei Uva L'Tziyon"), { start: 'ובא לציון גואל', when: 'roshChodesh' }),
  sec('rc-beit-yaakov', 'closing-passages', 'בית יעקב', RC('Returning Sefer Torah'), { end: 'שיר המעלות לדוד לולי', when: 'roshChodesh' }),
  sec('rc-return-torah', 'return-torah', 'הכנסת ספר תורה', RC('Returning Sefer Torah'), { start: 'ומחזירין את ספר התורה למקומו', end: 'ובנחה יאמר', when: 'roshChodesh', role: 'minyan' }),
  sec('rc-half-kaddish-musaf', 'half-kaddish', 'חצי קדיש', RC('Returning Sefer Torah'), { start: 'ואמר הש"ץ חצי קדיש וחולצין תפילין', when: 'roshChodesh', role: 'minyan' }),
  // Ashrei, Lamenatzeach, Uva LeTziyon (every day but Rosh Chodesh)
  sec('ashrei', 'ashrei', 'אשרי', WS('Ashrei'), { start: 'אשרי יושבי ביתך', end: 'אשרי יושבי ביתך', when: '!roshChodesh', rewind: true }),
  sec('lamenatzeach', 'lamenatzeach', 'למנצח', WS('Ashrei'), { start: 'אלו ימים שאין אומרים בהם למנצח', end: 'למנצח מזמור לדוד', when: LAMENATZEACH_DAYS }),
  sec('uva-letzion', 'uva-letzion', 'ובא לציון', WS('Ashrei'), { start: 'מה שתקנו סדר קדושה בסוף התפלה', end: '(יהוה אדונינו, מה אדיר שמך', when: '!roshChodesh' }),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', WS('Ashrei'), { start: 'כל ימות השנה כשאין מוסף', end: 'עושה שלום', when: NO_MUSAF, role: 'minyan' }),
  sec('half-kaddish-musaf', 'half-kaddish', 'חצי קדיש', WS('Ashrei'), { start: 'כל ימות השנה כשאין מוסף', end: 'דאמירן בעלמא', when: 'cholHamoed', role: 'minyan', rewind: true }),
  // The closing (on Rosh Chodesh and Chol HaMoed it follows Musaf, in those services)
  sec('tefila-ledavid', 'closing-passages', 'תפלה לדוד', WS('Beit Yaakov'), { end: 'תפלה לדוד הטה', when: `${NO_MUSAF}&tachanun` }),
  sec('beit-yaakov', 'closing-passages', 'בית יעקב', WS('Beit Yaakov'), { start: 'בית יעקב לכו ונלכה', when: `!cholHamoed&${LAMENATZEACH_DAYS}` }),
  sec('song-of-day', 'song-of-day', 'שיר של יום', WS('Song of the Day'), { end: 'נהגו לומר בכל ימי השבוע השיר', when: NO_MUSAF }),
  ...DAYS.map((day, index) => sec(`song-day${index}`, 'song-of-day', '', WS('Song of the Day'), { start: index ? `ב${day === 'ששי' ? 'שישי' : day} בשבת:` : 'בראשון בשבת:', when: `${NO_MUSAF}&day${index}`, continues: true })),
  sec('hoshienu', 'song-of-day', '', WS('Song of the Day'), { start: 'הושיענו אלהי ישענו', when: NO_MUSAF, continues: true }),
  sec('kaddish-yatom-song', 'kaddish-yatom', 'קדיש יתום', WS("L'David Hashem"), { start: 'קדיש יתום יתגדל', when: NO_MUSAF, role: 'mourners' }),
  sec('ledavid', 'ledavid-ori', 'לדוד ה׳ אורי', WS("L'David Hashem"), { start: 'מנהג טוב לומר אחר כל תפלה', end: '(קדיש יתום)', when: `${NO_MUSAF}&ledavid`, rewind: true }),
  sec('lamenatzeach-avel', 'closing-passages', 'למנצח לבני קרח · בבית האבל', WS("L'David Hashem"), { start: 'בבית האבל בבוקר', end: '(קדיש יתום)', when: `${NO_MUSAF}&tachanun`, role: 'optional' }),
  sec('michtam-avel', 'closing-passages', 'מכתם לדוד · בבית האבל', WS("L'David Hashem"), { start: 'ובימים שאין בהם תחנון אומרים זה', end: 'מכתם לדוד שמרני', when: `${NO_MUSAF}&!tachanun`, role: 'optional' }),
  sec('kaveh', 'kaveh', 'קוה אל ה׳', WS('Kaveh'), { end: 'קוה אל יהוה חזק', when: NO_MUSAF }),
  sec('ein-keloheinu', 'ein-keloheinu', 'אין כאלהינו', WS('Kaveh'), { start: 'אין כאלהינו', end: 'אין כאלהינו', when: NO_MUSAF }),
  sec('pitum-haketoret', 'ketoret', 'פטום הקטורת', WS('Kaveh'), { start: 'פטום הקטרת הצרי', end: 'אתה סתר לי מצר', when: NO_MUSAF }),
  sec('tanna-devei-eliyahu', 'closing-passages', 'תנא דבי אליהו', WS('Kaveh'), { start: 'תנא דבי אליהו', end: 'אמר רבי אלעזר אמר רבי חנינא', when: NO_MUSAF }),
  sec('kaddish-derabanan', 'kaddish-derabanan', 'קדיש דרבנן', WS('Kaveh'), { start: 'קדיש דרבנן:', when: NO_MUSAF, role: 'minyan' }),
  sec('aleinu', 'aleinu', 'עלינו לשבח', WS('Aleinu'), { end: 'אל תירא מפחד פתאם', when: NO_MUSAF }),
  sec('kaddish-yatom', 'kaddish-yatom', 'קדיש יתום', WS('Aleinu'), { start: 'כתב הלבוש בסי קל"ג', when: NO_MUSAF, role: 'mourners' }),
], { conditionsPending: [
  'למנצח, אל ארך אפים ובית יעקב אינם נאמרים בערב פסח, בערב יום כיפור ובפורים קטן — אין עדיין מפתח תנאי לימים אלה',
  'מזמור לתודה אינו נאמר בערב פסח, בחול המועד פסח ובערב יום כיפור (הערת המהדורה בתוך הקטע) — אין מפתח תנאי',
] });

// ── Weekday Mincha ─────────────────────────────────────────────────────────────────────────────────────────────────
const WM = path => R(`Weekday Mincha, ${path}`);

const weekdayMincha = service('מנחה לימות החול', [
  sec('tamid', 'korbanot', 'פרשת התמיד', WM('Korbanot'), { end: 'קרבן התמיד במועדו' }),
  sec('ketoret', 'ketoret', 'פטום הקטורת', WM('Korbanot'), { start: 'אתה הוא יהוה אלהינו שהקטירו', end: 'אתה סתר לי מצר' }),
  sec('ana-bekoach', 'korbanot', 'אנא בכח', WM('Korbanot'), { start: 'ואח"כ יאמר תפלת רבי נחוניא', end: 'ברוך שם כבוד מלכותו' }),
  sec('ashrei', 'ashrei', 'אשרי', WM('Korbanot'), { start: 'אשרי יושבי ביתך', end: 'אשרי יושבי ביתך' }),
  // On a public fast the Torah is read after Ashrei; the half Kaddish follows the reading (the edition's own direction).
  sec('fast-torah-reading', 'torah-reading', 'קריאת התורה לתענית ציבור במנחה', WM('Torah Reading for Fast Day'), { when: 'fast', role: 'minyan' }),
  sec('fast-torah-text', 'torah-reading', 'קריאה בתורה לתענית ציבור', TR('Fast Day Torah Reading'), { when: 'fast', role: 'minyan' }),
  sec('fast-haftarah', 'torah-reading', 'הפטרה לתענית ציבור במנחה', TR('Fast Day Mincha Haftara'), { when: 'fast', role: 'minyan' }),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', WM('Korbanot'), { start: 'החזן אומר חצי קדיש', role: 'minyan' }),
  ...weekdayAmidah('mincha'),
  sec('avinu-malkeinu', 'avinu-malkeinu', 'אבינו מלכנו', WM('Avinu Malkeinu'), { when: 'avinuMalkeinu' }),
  sec('vidui', 'vidui', 'וידוי ושלוש עשרה מידות', WM('Tachanun'), { end: 'כי אתה אדני טוב וסלח', when: 'tachanun' }),
  sec('nefilat-apayim', 'tachanun', 'נפילת אפיים', WM('Tachanun'), { start: 'כשנופל על פניו', end: 'יבשו ויבהלו מאד', when: 'tachanun' }),
  sec('shomer-yisrael', 'tachanun', 'שומר ישראל', WM('Tachanun'), { start: 'שומר ישראל שמור', end: 'ואנחנו לא נדע מה נעשה', when: 'tachanun' }),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', WM('Tachanun'), { start: 'הש"ץ אומר קדיש שלם', end: 'עושה שלום', role: 'minyan' }),
  sec('aleinu', 'aleinu', 'עלינו לשבח', WM('Tachanun'), { start: 'עלינו לשבח לאדון הכל', end: 'אל תירא מפחד פתאם' }),
  sec('kaddish-yatom', 'kaddish-yatom', 'קדיש יתום', WM('Tachanun'), { start: 'יתגדל ויתקדש', end: 'עושה שלום', role: 'mourners' }),
  sec('ledavid', 'ledavid-ori', 'לדוד ה׳ אורי', WM('Tachanun'), { start: 'מנהג טוב לומר אחר כל תפלה', end: '(קדיש יתום)', when: 'ledavid' }),
  sec('lamenatzeach-avel', 'closing-passages', 'למנצח לבני קרח · בבית האבל', WM('Tachanun'), { start: 'בבית האבל בבוקר', when: 'tachanun', role: 'optional' }),
], { reviewed: true });

// ── Weekday Maariv (with Motzaei Shabbat and the Omer) ─────────────────────────────────────────────────────────────
const WV = path => R(`Weekday Maariv, ${path}`);
const WVA = WV('Amidah');

const weekdayMaariv = service('ערבית לימות החול', [
  sec('vehu-rachum', 'vehu-rachum', 'והוא רחום', WV('The Shema'), { end: 'והוא רחום יכפר עון' }),
  sec('barchu', 'barchu', 'ברכו', WV('The Shema'), { start: 'ואומר שליח צבור', end: 'ברוך יהוה המברך לעולם ועד', role: 'minyan' }),
  sec('maariv-aravim', 'shema-blessings', 'המעריב ערבים', WV('The Shema'), { start: 'אשר בדברו מעריב ערבים', end: 'אשר בדברו מעריב ערבים' }),
  sec('ahavat-olam', 'shema-blessings', 'אהבת עולם', WV('The Shema'), { start: 'אהבת עולם בית ישראל', end: 'אהבת עולם בית ישראל' }),
  sec('shema', 'shema', 'קריאת שמע', WV('The Shema'), { start: 'יחיד אומר', end: 'יהוה אלהיכם אמת' }),
  sec('emet-veemuna', 'after-shema', 'אמת ואמונה', WV('The Shema'), { start: 'אמת ואמונה אינה פותחת', end: 'ברוך אתה יהוה גאל ישראל' }),
  sec('hashkiveinu', 'hashkiveinu', 'השכיבנו', WV('The Shema'), { start: 'אומר השכיבנו וחותם', end: 'שומר עמו ישראל לעד' }),
  sec('baruch-hashem-leolam', 'shema-blessings', 'ברוך ה׳ לעולם', WV('The Shema'), { start: 'מה שנוהגין להפסיק בפסוקים', end: 'יראו עינינו וישמח לבנו' }),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', WV('The Shema'), { start: 'ואומר שליח צבור חצי קדיש', role: 'minyan' }),
  ...weekdayAmidah('maariv'),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', WVA, { start: 'בחול אומר החזן קדיש שלם', end: 'עושה שלום במרומיו', when: '!motzaeiShabbat', role: 'minyan' }),
  // Motzaei Shabbat: half Kaddish, Vihi No'am, Ve'atah Kadosh, Kaddish Titkabal (the edition's own leaf).
  sec('ms-half-kaddish', 'half-kaddish', 'חצי קדיש', WV('Motzaei Shabbat'), { end: 'דאמירן בעלמא', when: 'motzaeiShabbat', role: 'minyan' }),
  sec('vihi-noam', 'motzaei-shabbat', 'ויהי נועם', WV('Motzaei Shabbat'), { start: 'ויהי נעם אדני אלהינו', end: 'ישב בסתר עליון', when: 'motzaeiShabbat' }),
  sec('veata-kadosh', 'motzaei-shabbat', 'ואתה קדוש', WV('Motzaei Shabbat'), { start: 'ואתה קדוש יושב תהלות', end: 'ונטלתני רוחא', when: 'motzaeiShabbat' }),
  sec('ms-kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', WV('Motzaei Shabbat'), { start: 'יתגדל ויתקדש', end: 'עושה שלום במרומיו', when: 'motzaeiShabbat', role: 'minyan' }),
  omit('ms-aleinu', WV('Motzaei Shabbat'), { start: 'עלינו לשבח לאדון הכל', why: 'a second printing of Aleinu and Kaddish Yatom, identical in order to the weekday Maariv\'s (shown once, below)' }),
  // The Omer, counted after Kaddish Titkabal.
  sec('omer', 'omer', 'ספירת העומר', WV('Sefirat HaOmer'), { end: 'ה סיון 49', when: 'omer' }),
  sec('omer-after', 'omer', 'הרחמן · למנצח · אנא בכח', WV('Sefirat HaOmer'), { start: 'הרחמן הוא יחזיר לנו עבודת', when: 'omer' }),
  // "In Eretz Yisrael some say Shir LaMa'alot here", with its Kaddish.
  sec('shir-lamaalot', 'closing-passages', 'שיר למעלות', WVA, { start: 'בתפילת ערבית בארץ ישראל יש נוהגים', end: 'שיר למעלות אשא עיני', when: 'israel', role: 'optional' }),
  sec('shir-lamaalot-kaddish', 'kaddish-yatom', 'קדיש יתום', WVA, { start: 'קדיש יתום:', end: 'עושה שלום במרומיו', when: 'israel', role: 'mourners' }),
  sec('barchu-end', 'barchu', 'ברכו', WVA, { start: 'חזן: ברכו את יהוה', end: 'קהל וחזן: ברוך יהוה', role: 'minyan' }),
  sec('aleinu', 'aleinu', 'עלינו לשבח', WVA, { start: 'עלינו לשבח לאדון הכל', end: 'אל תירא מפחד פתאם' }),
  sec('kaddish-yatom', 'kaddish-yatom', 'קדיש יתום', WVA, { start: 'יתגדל ויתקדש', role: 'mourners' }),
  // "After the Maariv of Motzaei Shabbat one says this" (the edition's own direction, in its Motzaei Shabbat order).
  omit('vayiten-lecha-heading', R('Third Meal, Motzaei Shabbat Prayers'), { start: exact('סדר מוצאי שבת'), end: exact('סדר מוצאי שבת'), why: HEADING_WHY }),
  sec('vayiten-lecha', 'motzaei-shabbat', 'ויתן לך', R('Third Meal, Motzaei Shabbat Prayers'), { when: 'motzaeiShabbat' }),
], { reviewed: true, conditionsPending: [
  'ספירת העומר: המהדורה מדפיסה את 49 הימים ברצף — בחירת היום של היום אינה בידי התנאים של החיבור',
  'ויהי נועם ואתה קדוש אינם נאמרים במוצאי שבת שחל יום טוב בימי השבוע הבא — אין מפתח תנאי',
] });


// ── Shared: Birkat Kohanim printed once ────────────────────────────────────────────────────────────────────────────
// The Shabbat, Rosh Chodesh and festival Amidot print only the caption "ברכת כהנים"; the chazzan's words are printed
// in the edition's weekday Shacharit Amidah, and are shown from there (the rest of that leaf is not part of the service).
const WS_AMIDAH = R('Weekday Shacharit, Amidah');
const BK_WHY = 'the edition\'s weekday Shacharit Amidah: only its Birkat Kohanim is used in this service';
const reusedBirkatKohanim = (captionRef, captionStart, when) => [
  omit('birkat-kohanim-caption', captionRef, { start: captionStart, end: captionStart, why: 'the caption "ברכת כהנים" — its words are printed in the weekday Shacharit and shown in the next section' }),
  omit('birkat-kohanim-ws-before', WS_AMIDAH, { end: 'וכל החיים יודוך סלה', why: BK_WHY }),
  sec('birkat-kohanim', 'birkat-kohanim', 'ברכת כהנים', WS_AMIDAH, { start: exact('ברכת כהנים'), end: 'למשמרת שלום', role: 'repetition', ...(when ? { when } : {}) }),
  omit('birkat-kohanim-ws-after', WS_AMIDAH, { why: BK_WHY }),
];
const FESTIVAL_ONLY = 'said on the festivals (the edition prints it for them), not in this service';

// ── Kabbalat Shabbat ───────────────────────────────────────────────────────────────────────────────────────────────
const KS = R('Kabbalat Shabbat');
const kabbalatShabbat = service('קבלת שבת', [
  // "On Yom Tov and Shabbat Chol HaMoed one begins here" (¶5): the first five psalms are skipped then.
  sec('lechu-neranena', 'kabbalat-shabbat', 'לכו נרננה', KS, { end: 'יהוה מלך ירגזו עמים', when: '!cholHamoed' }),
  sec('mizmor-ledavid', 'kabbalat-shabbat', 'מזמור לדוד הבו לה׳', KS, { start: 'ביום טוב ובשבת חול המועד מתחילים כאן', end: 'מזמור לדוד הבו ליהוה' }),
  sec('ana-bekoach', 'kabbalat-shabbat', 'אנא בכח', KS, { start: 'אנא בכח', end: 'ברוך, שם כבוד מלכותו' }),
  sec('lecha-dodi', 'lecha-dodi', 'לכה דודי', KS, { start: 'שם המחבר בראשי החרוזים' }),
  // "On Yom Tov and Shabbat Chol HaMoed one skips to ימין ושמאל" (¶22).
  sec('lecha-dodi-middle', 'lecha-dodi', '', KS, { start: 'ביום טוב ובשבת חול המועד מדלגים', when: '!cholHamoed', continues: true }),
  sec('lecha-dodi-end', 'lecha-dodi', '', KS, { start: 'ימין ושמאל תפרוצי', continues: true }),
  sec('mizmor-shir-shabbat', 'mizmor-shir-shabbat', 'מזמור שיר ליום השבת', KS, { start: 'מזמור שיר ליום השבת', end: 'יהוה מלך גאות לבש' }),
  sec('kaddish-yatom', 'kaddish-yatom', 'קדיש יתום', KS, { start: 'קדיש יתום:', role: 'mourners' }),
], { reviewed: true });

// ── Friday night Maariv ────────────────────────────────────────────────────────────────────────────────────────────
const SEM = path => R(`Shabbat Eve Maariv, ${path}`);
const SEMA = SEM('Amidah');
const shabbatMaariv = service('ערבית לליל שבת', [
  // "When Shabbat is Yom Tov, Motzaei Yom Tov or Chol HaMoed, Kegavna is not said — straight to Barchu" (¶0).
  sec('kegavna', 'kabbalat-shabbat', 'כגונא', SEM('Shabbat Eve Maariv'), { end: 'ולומר ברכו את יהוה המבורך', when: '!cholHamoed' }),
  sec('barchu', 'barchu', 'ברכו', SEM('Shabbat Eve Maariv'), { start: 'חזן: ברכו את יהוה', role: 'minyan' }),
  sec('maariv-aravim', 'shema-blessings', 'המעריב ערבים', SEM('Shema & Blessings'), { end: 'המעריב ערבים' }),
  sec('ahavat-olam', 'shema-blessings', 'אהבת עולם', SEM('Shema & Blessings'), { start: 'אהבה רבה (אהבת עולם)', end: 'אוהב עמו ישראל' }),
  sec('shema', 'shema', 'קריאת שמע', SEM('Shema & Blessings'), { start: '( יחיד אומר', end: 'וחוזר החזן: יהוה אלהיכם אמת' }),
  sec('emet-veemuna', 'after-shema', 'אמת ואמונה', SEM('Shema & Blessings'), { start: 'ואמונה כל זאת וקים עלינו', end: 'גאל ישראל' }),
  sec('hashkiveinu', 'hashkiveinu', 'השכיבנו', SEM('Shema & Blessings'), { start: 'השכיבנו יהוה אלהינו', end: 'השכיבנו יהוה אלהינו' }),
  sec('veshamru', 'shema-blessings', 'ושמרו', SEM('Shema & Blessings'), { start: 'לשבת:', end: 'ושמרו בני ישראל את השבת' }),
  omit('vayedaber-moshe', SEM('Shema & Blessings'), { start: 'לג\' רגלים:', end: 'וידבר משה את מועדי', why: FESTIVAL_ONLY }),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', SEM('Shema & Blessings'), { start: 'חצי קדיש:', end: 'יהא שמה רבא מברך', role: 'minyan' }),
  omit('festival-amidah-pointer', SEM('Shema & Blessings'), { start: '(בג\' רגלים מתפללים כאן', why: FESTIVAL_ONLY }),
  sec('amidah-opening', 'amidah', 'תפילת העמידה', SEMA, { end: 'אדני, שפתי תפתח' }),
  sec('avot', 'amidah', 'ברכת אבות', SEMA, { start: 'ברוך אתה יהוה, אלהינו ואלהי אבותינו', end: 'מגן אברהם' }),
  sec('gevurot', 'amidah', 'גבורות', SEMA, { start: 'אתה גבור לעולם', end: /^ונאמן אתה להחיות מתים/ }),
  sec('kedushat-hashem', 'amidah', 'קדושת השם', SEMA, { start: /^אתה קדוש/, end: /^אתה קדוש/ }),
  sec('kedushat-hayom', 'amidah', 'אתה קדשת', SEMA, { start: 'אתה קדשת את יום השביעי', end: 'מקדש השבת' }),
  sec('retze', 'amidah', 'רצה', SEMA, { start: /^רצה יהוה אלהינו/, end: /^רצה יהוה אלהינו/ }),
  sec('yaale-veyavo', 'amidah', 'יעלה ויבוא', SEMA, { start: 'בשבת ראש חודש ובשבת חול המועד', when: 'roshChodesh|cholHamoed' }),
  sec('retze-end', 'amidah', '', SEMA, { start: /^ותחזינה עינינו/, end: /^ותחזינה עינינו/, continues: true }),
  sec('modim', 'amidah', 'מודים', SEMA, { start: /^מודים אנחנו לך/, end: /^מודים אנחנו לך/ }),
  sec('al-hanisim', 'amidah', 'על הנסים', SEMA, { start: 'בחנוכה ופורים המשולש', end: /^בפורים המשולש אומרים/, when: 'chanukah|purim' }),
  sec('modim-end', 'amidah', '', SEMA, { start: 'ועל כלם יתברך', end: 'הטוב שמך ולך נאה להודות', continues: true }),
  sec('sim-shalom', 'amidah', 'שים שלום', SEMA, { start: 'שים שלום טובה וברכה', end: /^ברוך אתה יהוה, המברך את עמו/ }),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', SEMA, { start: 'יהיו לרצון אמרי פי' }),
  sec('vayechulu', 'vayechulu', 'ויכולו', SEM('Vayechulu'), { end: 'ויכלו השמים והארץ' }),
  sec('magen-avot', 'magen-avot', 'מגן אבות', SEM('Vayechulu'), { start: 'קהל וחזן: ברוך אתה יהוה', end: 'חזן: אלהינו ואלהי אבותינו, רצה נא', role: 'minyan' }),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', SEM('Vayechulu'), { start: 'קדיש שלם:', end: 'יהא שלמא רבא מן שמיא', role: 'minyan' }),
  sec('mizmor-ledavid', 'closing-passages', 'מזמור לדוד ה׳ רועי', SEM('Vayechulu'), { start: 'מזמור לדוד יהוה רעי', end: 'מזמור לדוד יהוה רעי' }),
  sec('half-kaddish-2', 'half-kaddish', 'חצי קדיש', SEM('Vayechulu'), { start: 'חצי קדיש:', end: 'יהא שמה רבא מברך', role: 'minyan' }),
  sec('barchu-2', 'barchu', 'ברכו', SEM('Vayechulu'), { start: 'חזן: ברכו את יהוה', end: 'ברוך יהוה המברך לעולם ועד', role: 'minyan' }),
  sec('omer', 'omer', 'ספירת העומר', SEM('Vayechulu'), { start: 'מפסח עד שבועות סופרים כאן', end: 'מפסח עד שבועות סופרים כאן', when: 'omer' }),
  sec('omer-count', 'omer', '', WV('Sefirat HaOmer'), { end: 'ה סיון 49', when: 'omer', continues: true }),
  sec('omer-after', 'omer', 'הרחמן · למנצח · אנא בכח', WV('Sefirat HaOmer'), { start: 'הרחמן הוא יחזיר לנו עבודת', when: 'omer' }),
  sec('aleinu', 'aleinu', 'עלינו לשבח', SEM('Vayechulu'), { start: 'עלינו לשבח לאדון הכל', end: 'ועל כן נקוה לך' }),
  sec('kaddish-yatom', 'kaddish-yatom', 'קדיש יתום', SEM('Vayechulu'), { start: 'קדיש יתום', role: 'mourners' }),
], { reviewed: true, conditionsPending: ['ספירת העומר: המהדורה מדפיסה את 49 הימים ברצף'] });

// ── Friday night Kiddush and the meal's opening ────────────────────────────────────────────────────────────────────
const SEMEAL = path => R(`Shabbat Evening Meal, ${path}`);
const shabbatKiddush = service('קידוש לליל שבת', [
  sec('birkat-habanim', 'shalom-aleichem', 'ברכת הבנים', SEMEAL('Blessing the Children')),
  sec('shalom-aleichem', 'shalom-aleichem', 'שלום עליכם', SEMEAL('Shalom Aleichem'), { end: 'כי מלאכיו יצוה לך' }),
  sec('ribon-kol-haolamim', 'shalom-aleichem', 'רבון כל העולמים', SEMEAL('Shalom Aleichem'), { start: 'רבון כל העולמים אדון כל הנשמות' }),
  sec('eshet-chayil', 'eshet-chayil', 'אשת חיל', SEMEAL('Eishet Chayil')),
  sec('atkinu', 'zemirot', 'אתקינו סעודתא', SEMEAL('Atkinu Seudata'), { end: 'רבי אבא (נ"א' }),
  sec('azamer', 'zemirot', 'אזמר בשבחין', SEMEAL('Atkinu Seudata'), { start: 'פיוט משובח מהאר"י' }),
  sec('kiddush', 'kiddush', 'קידוש', SEMEAL('Shabbat Eve Kiddush'), { end: 'אחר שגמר הקידוש ישתה' }),
  sec('leshev-basukka', 'kiddush', 'לישב בסוכה', SEMEAL('Shabbat Eve Kiddush'), { start: 'בשבת חוה"מ סוכות יאמר זה', when: 'sukkot' }),
], { conditionsPending: ['לישב בסוכה מסומן במפתח sukkot (ט"ו–כ"א בתשרי) שאין לו תווית ב-WHEN_LABELS'] });

// ── Shabbat Shacharit ──────────────────────────────────────────────────────────────────────────────────────────────
// The edition: "one prays as on a weekday up to Hodu and continues here" — the morning blessings and Korbanot are in
// the weekday Shacharit; this service begins with the Shabbat Pesukei DeZimra.
const SM = path => R(`Shabbat Morning Services, ${path}`);
const SMA = SM('Amidah');
const PZ = SM("Pesukei D'Zimrah");
const AVH = SM('Av HaRachamim');
const shabbatShacharit = service('שחרית של שבת', [
  sec('hodu', 'hodu', 'הודו', PZ, { end: 'אשירה ליהוה כי גמל עלי' }),
  sec('mizmor-shir', 'mizmor-shir', 'מזמור שיר חנוכת הבית', PZ, { start: 'מזמור שיר חנכת הבית', end: 'מזמור שיר חנכת הבית' }),
  sec('hashem-melech', 'pesukei-dezimra', 'ה׳ מלך · הושיענו', PZ, { start: 'עומדים ואומרים', end: 'הושיענו יהוה אלהינו וקבצנו' }),
  sec('shabbat-psalms', 'pesukei-dezimra', 'מזמורי שבת', PZ, { start: 'למנצח מזמור לדוד : השמים מספרים', end: 'הודו לאל השמים כי לעולם חסדו' }),
  sec('haaderet', 'pesukei-dezimra', 'האדרת והאמונה', PZ, { start: /^ה א דרת והאמונה/, end: /^ה ת הלה והתפארת/ }),
  sec('baruch-sheamar', 'baruch-sheamar', 'ברוך שאמר', PZ, { start: 'הריני מזמן את פי להודות', end: 'מלך מהלל בתשבחות' }),
  sec('mizmor-shir-leyom', 'pesukei-dezimra', 'מזמור שיר ליום השבת', PZ, { start: 'מזמור שיר ליום השבת', end: 'יהוה מלך גאות לבש' }),
  sec('yehi-chevod', 'pesukei-dezimra', 'יהי כבוד', PZ, { start: 'יהי כבוד יהוה לעולם', end: 'יהי כבוד יהוה לעולם' }),
  sec('ashrei-pz', 'pesukei-dezimra', 'אשרי', PZ, { start: /^אשרי יושבי ביתך/, end: /^אשרי יושבי ביתך/ }),
  sec('halleluyah', 'pesukei-dezimra', 'הללויה', PZ, { start: 'הללויה הללי נפשי', end: 'הללויה הללו אל בקדשו' }),
  sec('baruch-hashem-leolam', 'pesukei-dezimra', 'ברוך ה׳ לעולם', PZ, { start: 'ברוך יהוה לעולם אמן ואמן', end: 'ברוך יהוה לעולם אמן ואמן' }),
  sec('vayevarech-david', 'pesukei-dezimra', 'ויברך דוד', PZ, { start: 'ויברך דוד יאמר מעומד', end: 'וכרות עמו הברית' }),
  sec('az-yashir', 'az-yashir', 'שירת הים', PZ, { start: 'ויושע יהוה ביום ההוא', end: 'אז ישיר משה ובני ישראל' }),
  sec('nishmat', 'pesukei-dezimra', 'נשמת', PZ, { start: 'תקנו לומר נשמת בשבת', end: 'ובמקהלות רבבות עמך' }),
  sec('yishtabach', 'yishtabach', 'ישתבח', PZ, { start: 'ובכן ישתבח שמך לעד', end: 'ובכן ישתבח שמך לעד' }),
  sec('shir-hamaalot-aseret', 'yishtabach', 'שיר המעלות ממעמקים', PZ, { start: 'בשבת שובה אומרים קודם חצי קדיש', end: 'שיר המעלות ממעמקים', when: 'aseret' }),
  sec('half-kaddish-yishtabach', 'half-kaddish', 'חצי קדיש', PZ, { start: 'חצי קדיש:', end: 'יהא שמה רבא מברך', role: 'minyan' }),
  sec('barchu', 'barchu', 'ברכו', PZ, { start: 'חזן: ברכו את יהוה', role: 'minyan' }),
  omit('shema-heading', SM('Shema & Blessings'), { start: exact('ק"ש וברכותיה'), end: exact('ק"ש וברכותיה'), why: HEADING_WHY }),
  sec('yotzer', 'shema-blessings', 'יוצר אור', SM('Shema & Blessings'), { end: 'יוצר המאורות' }),
  sec('ahavat-olam', 'shema-blessings', 'אהבת עולם', SM('Shema & Blessings'), { start: 'אהבת עולם (אהבה רבה)', end: 'אהבת עולם (אהבה רבה)' }),
  sec('shema', 'shema', 'קריאת שמע', SM('Shema & Blessings'), { start: 'יאמר הקריאת שמע באימה', end: 'הש"ץ חוזר ואומר' }),
  sec('emet-veyatziv', 'after-shema', 'אמת ויציב', SM('Shema & Blessings'), { start: /^ויציב , ונכון/, end: 'גאל ישראל' }),
  omit('festival-amidah-pointer', SM('Shema & Blessings'), { start: '(בג\' רגלים מתפללים כאן', why: FESTIVAL_ONLY }),
  // The Amidah
  sec('amidah-opening', 'amidah', 'תפילת העמידה', SMA, { end: 'אדני, שפתי תפתח' }),
  sec('avot', 'amidah', 'ברכת אבות', SMA, { start: 'ברוך אתה יהוה, אלהינו ואלהי אבותינו', end: 'מגן אברהם' }),
  sec('gevurot', 'amidah', 'גבורות', SMA, { start: 'אתה גבור לעולם', end: /^ונאמן אתה להחיות מתים/ }),
  sec('kedusha', 'kedusha', 'קדושה', SMA, { start: exact('קדושה'), end: 'קו"ח: ימלך יהוה לעולם', role: 'repetition' }),
  sec('kedushat-hashem', 'amidah', 'קדושת השם', SMA, { start: /^אתה קדוש/, end: /^אתה קדוש/ }),
  sec('kedushat-hayom', 'amidah', 'ישמח משה', SMA, { start: 'ישמח משה במתנת חלקו', end: 'מקדש השבת' }),
  sec('retze', 'amidah', 'רצה', SMA, { start: /^רצה יהוה אלהינו/, end: /^רצה יהוה אלהינו/ }),
  sec('yaale-veyavo', 'amidah', 'יעלה ויבוא', SMA, { start: 'בראש חודש ובחול המועד אומרים כאן', when: 'roshChodesh|cholHamoed' }),
  sec('retze-end', 'amidah', '', SMA, { start: /^ותחזינה עינינו/, end: /^ותחזינה עינינו/, continues: true }),
  sec('modim', 'amidah', 'מודים', SMA, { start: /^מודים אנחנו לך/, end: /^מודים אנחנו לך/ }),
  sec('modim-derabanan', 'modim-derabanan', 'מודים דרבנן', SMA, { start: exact('מודים דרבנן'), end: 'ברוך אל ההודאות', role: 'repetition' }),
  heading('al-hanisim', SMA, 'על הניסים'),
  sec('al-hanisim', 'amidah', 'על הנסים', SMA, { end: /^בפורים המשולש אומרים/, when: 'chanukah|purim' }),
  sec('modim-end', 'amidah', '', SMA, { start: 'ועל כלם יתברך', end: 'הטוב שמך ולך נאה להודות', continues: true }),
  ...reusedBirkatKohanim(SMA, exact('ברכת כהנים')),
  sec('sim-shalom', 'amidah', 'שים שלום', SMA, { start: 'שים שלום טובה וברכה', end: /^ברוך אתה יהוה, המברך את עמו/ }),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', SMA, { start: 'יהיו לרצון אמרי פי', end: 'וערבה ליהוה מנחת יהודה' }),
  // "On Rosh Chodesh Hallel is said here" (¶54) — Hallel as printed in the edition's Rosh Chodesh order.
  sec('hallel-direction', 'hallel', 'הלל', SMA, { start: 'בראש חודש אומרים כאן הלל', end: 'בראש חודש אומרים כאן הלל', when: 'roshChodesh' }),
  heading('hallel', RC('Hallel'), 'סדר הלל'),
  sec('hallel', 'hallel', '', RC('Hallel'), { end: 'זבדיה ישמרנו ויחינו', when: 'roshChodesh', continues: true }),
  omit('hallel-weekday-kaddish', RC('Hallel'), { start: 'בראש חודש וביום טוב ובחול המועד אומר החזן', why: 'the Kaddish after Hallel as printed for weekdays; on Shabbat the Kaddish of the Shabbat order follows' }),
  heading('kaddish-titkabal', SMA, 'קדיש שלם'),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', SMA, { end: 'עשה שלום ( בעשי"ת השלום) במרומיו', role: 'minyan' }),
  // The Song of the Day follows Shacharit on Shabbat (the edition's order).
  sec('song-of-day', 'song-of-day', 'שיר של יום', SMA, { start: exact('שיר של יום'), end: 'מזמור שיר ליום השבת' }),
  sec('kaddish-yatom-song', 'kaddish-yatom', 'קדיש יתום', SMA, { start: exact('קדיש יתום'), end: 'יהא שלמא רבא מן שמיא', role: 'mourners' }),
  sec('barchi-nafshi', 'barchi-nafshi', 'ברכי נפשי', SMA, { start: 'בראש חדש אחר שיר של יום אומרים ברכי נפשי', end: 'ברכי נפשי את יהוה יהוה אלהי', when: 'roshChodesh' }),
  sec('kaddish-yatom-barchi', 'kaddish-yatom', 'קדיש יתום', SMA, { start: exact('קדיש יתום'), end: 'יהא שלמא רבא מן שמיא', when: 'roshChodesh', role: 'mourners' }),
  sec('ledavid', 'ledavid-ori', 'לדוד ה׳ אורי', SMA, { start: 'מראש חדש אלול עד אחר הושענא רבה', end: 'לדוד יהוה אורי וישעי', when: 'ledavid' }),
  sec('kaddish-yatom-ledavid', 'kaddish-yatom', 'קדיש יתום', SMA, { start: exact('קדיש יתום'), when: 'ledavid', role: 'mourners' }),
  // The Torah service
  sec('ata-hareta', 'torah-service', 'אתה הראת', SM('Shabbat Torah Reading'), { end: 'אב הרחמים. היטיבה ברצונך' }),
  sec('vayehi-binsoa', 'torah-service', 'ויהי בנסוע', SM('Shabbat Torah Reading'), { start: 'כשפותחין ארון הקודש אומרים זה', end: 'ויהי בנסע הארן', role: 'minyan' }),
  omit('festival-additions', SM('Shabbat Torah Reading'), { start: 'ביו"ט כשחל בחול, בראש השנה', end: /^ואני תפלתי לך יהוה עת רצון/, why: 'the Thirteen Attributes with their Ribbono shel Olam and the Ten Days\' additions — printed for festivals falling on a weekday, Rosh Hashana, Yom Kippur and Hoshana Rabba, not for Shabbat' }),
  sec('brich-shmei', 'torah-service', 'בריך שמיה', SM('Shabbat Torah Reading'), { start: 'בריך שמה דמרא עלמא', end: 'בריך שמה דמרא עלמא' }),
  sec('gadlu', 'torah-service', 'שמע ישראל · גדלו', SM('Shabbat Torah Reading'), { start: 'חו"ק: שמע ישראל', role: 'minyan' }),
  sec('torah-blessings', 'torah-reading', 'ברכות התורה', SM('Blessings on Torah Reading'), { role: 'minyan' }),
  sec('mi-sheberach-oleh', 'torah-reading', 'מי שברך לעולה לתורה', SM('Prayer for Oleh'), { role: 'minyan' }),
  sec('mi-sheberach-yoledet', 'torah-reading', 'מי שברך ליולדת', SM('Prayer for Mother after Chilbirth'), { role: 'optional' }),
  sec('mi-sheberach-choleh', 'torah-reading', 'מי שברך לחולה', SM('Prayer for Sick'), { role: 'optional' }),
  sec('gomel', 'torah-reading', 'ברכת הגומל', SM('Thanksgiving Blessing'), { role: 'optional' }),
  sec('bar-mitzva', 'torah-reading', 'ברוך שפטרני', SM('Bar Mitzva'), { role: 'optional' }),
  // The half Kaddish before Maftir is not printed in the reading's order: the edition's Shabbat half Kaddish (printed
  // before Musaf) is said here too.
  sec('half-kaddish-maftir', 'half-kaddish', 'חצי קדיש', AVH, { start: 'חצי קדיש:', role: 'minyan', rewind: true }),
  sec('hagbaha', 'torah-reading', 'הגבהת ספר תורה', SM('Hagbahah'), { role: 'minyan' }),
  sec('haftarah-blessings', 'haftarah', 'ברכות ההפטרה', SM('Haftarah Blessings'), { end: 'מגן דוד' }),
  sec('al-hatorah', 'haftarah', '', SM('Haftarah Blessings'), { start: 'בכל שבתות השנה חוץ משבת חול המועד', end: 'על התורה ועל העבודה', when: '!cholHamoed', continues: true }),
  sec('al-hatorah-chm', 'haftarah', '', SM('Haftarah Blessings'), { start: 'בג\' רגלים וגם בשבת חוה"מ', end: 'מקדש (השבת ו)ישראל והזמנים', when: 'cholHamoed', continues: true }),
  omit('al-hatorah-rh-yk', SM('Haftarah Blessings'), { start: 'בראש השנה אומרים זה', end: 'ויום הכפורים:', why: 'the endings for Rosh Hashana and Yom Kippur — not for Shabbat' }),
  sec('yekum-purkan', 'torah-service', 'יקום פורקן · מי שברך', SM('Haftarah Blessings'), { start: 'אחר ברכות ההפטרה אומרים זה' }),
  sec('birkat-hachodesh', 'birkat-hachodesh', 'ברכת החודש', SM('Blessing of New Month'), { role: 'minyan', when: 'shabbatMevarchim' }),
  sec('bahab', 'birkat-hachodesh', 'מי שברך לבה"ב', SM('BaHaB Blessing'), { role: 'optional' }),
  sec('hazkarat-neshamot', 'av-harachamim', 'אל מלא רחמים', SM('Prayer for Deceased'), { role: 'optional' }),
  sec('av-harachamim', 'av-harachamim', 'אב הרחמים', AVH, { end: 'אב הרחמים שוכן מרומים', rewind: true }),
  sec('ashrei', 'ashrei', 'אשרי', AVH, { start: /^אשרי יושבי ביתך/, end: /^אשרי יושבי ביתך/ }),
  sec('return-torah', 'return-torah', 'הכנסת ספר תורה', AVH, { start: 'כשמחזירין הספר תורה להיכל', end: 'מזמור לדוד. הבו ליהוה' }),
  omit('return-torah-festival', AVH, { start: 'ביו"ט כשחל בחול', end: 'לדוד מזמור. ליהוה הארץ', why: FESTIVAL_ONLY }),
  sec('return-torah-end', 'return-torah', '', AVH, { start: 'כשמכניסים הס"ת להיכל', end: 'ובנחה יאמר', continues: true }),
  sec('half-kaddish-musaf', 'half-kaddish', 'חצי קדיש', AVH, { start: 'חצי קדיש:', role: 'minyan' }),
], { conditionsPending: [
  'ברכת החודש: בשבת מברכים בלבד — אין מפתח תנאי',
  'מי שברך לבה"ב: בשבת שלפני בה"ב — אין מפתח תנאי',
  'אב הרחמים והזכרת נשמות: אינם נאמרים בשבת שבחול לא היו אומרים בה תחנון ובשבתות מיוחדות (הערת המהדורה) — אין מפתח תנאי',
] });

// ── Shabbat Musaf ──────────────────────────────────────────────────────────────────────────────────────────────────
const MU = R('Musaf');
const shabbatMusaf = service('מוסף לשבת', [
  sec('amidah-opening', 'musaf', 'תפילת מוסף', MU, { end: 'אדני, שפתי תפתח' }),
  sec('avot', 'musaf', 'ברכת אבות', MU, { start: 'ברוך אתה יהוה, אלהינו ואלהי אבותינו', end: 'מגן אברהם' }),
  sec('gevurot', 'musaf', 'גבורות', MU, { start: 'אתה גבור לעולם', end: /^ונאמן אתה להחיות מתים/ }),
  sec('keter', 'kedusha', 'כתר', MU, { start: exact('כתר'), end: 'חזן: לדור ודור נגיד גדלך', role: 'repetition' }),
  sec('kedushat-hashem', 'musaf', 'קדושת השם', MU, { start: /^אתה קדוש/, end: /^אתה קדוש/ }),
  sec('ata-yatzarta', 'musaf', 'אתה יצרת', MU, { start: 'כשחל ראש חודש בשבת אומרים', end: 'וממשיכים רצה', when: 'roshChodesh' }),
  sec('tikanta-shabbat', 'musaf', 'תכנת שבת', MU, { start: 'תכנת שבת רצית קרבנותיה', end: 'מקדש השבת', when: '!roshChodesh' }),
  sec('retze', 'musaf', 'רצה', MU, { start: /^רצה יהוה אלהינו/, end: /^ותחזינה עינינו/ }),
  sec('modim', 'musaf', 'מודים', MU, { start: /^מודים אנחנו לך/, end: /^מודים אנחנו לך/ }),
  sec('modim-derabanan', 'modim-derabanan', 'מודים דרבנן', MU, { start: exact('מודים דרבנן'), end: 'ברוך אל ההודאות', role: 'repetition' }),
  heading('al-hanisim', MU, 'על הניסים'),
  sec('al-hanisim', 'musaf', 'על הנסים', MU, { end: /^בפורים המשולש אומרים/, when: 'chanukah|purim' }),
  sec('modim-end', 'musaf', '', MU, { start: 'ועל כלם יתברך', end: 'הטוב שמך ולך נאה להודות', continues: true }),
  ...reusedBirkatKohanim(MU, exact('ברכת כהנים')),
  sec('sim-shalom', 'musaf', 'שים שלום', MU, { start: 'שים שלום טובה וברכה', end: /^ברוך אתה יהוה, המברך את עמו/ }),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', MU, { start: 'יהיו לרצון אמרי פי', end: 'וערבה ליהוה מנחת יהודה' }),
  heading('kaddish-titkabal', MU, 'קדיש שלם'),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', MU, { end: 'עשה שלום ( בעשי"ת השלום) במרומיו', role: 'minyan' }),
  sec('kaveh', 'kaveh', 'קוה אל ה׳', MU, { start: 'קוה אל יהוה חזק', end: 'קוה אל יהוה חזק' }),
  sec('ein-keloheinu', 'ein-keloheinu', 'אין כאלהינו', MU, { start: /^אין כאלהינו/, end: /^אין כאלהינו/ }),
  sec('pitum-haketoret', 'ketoret', 'פטום הקטורת', MU, { start: 'פטום הקטרת הצרי', end: 'השיר שהלוים היו אומרים' }),
  sec('tanna-devei-eliyahu', 'closing-passages', 'תנא דבי אליהו', MU, { start: 'תנא דבי אליהו', end: 'אמר רבי אלעזר אמר רבי חנינא' }),
  heading('kaddish-derabanan', MU, 'קדיש דרבנן:'),
  sec('kaddish-derabanan', 'kaddish-derabanan', 'קדיש דרבנן', MU, { end: 'על ישראל ועל רבנן', role: 'minyan' }),
  sec('barchu', 'barchu', 'ברכו', MU, { start: exact('ברכו את יהוה המברך:'), end: 'קהל וחזן: ברוך יהוה המברך', role: 'minyan' }),
  sec('aleinu', 'aleinu', 'עלינו לשבח', MU, { start: 'עלינו לשבח לאדון הכל', end: 'ועל כן נקוה לך' }),
  sec('kaddish-yatom', 'kaddish-yatom', 'קדיש יתום', MU, { start: exact('קדיש יתום'), end: 'יהא שלמא רבא מן שמיא', role: 'mourners' }),
  sec('shir-hayichud', 'closing-passages', 'שיר היחוד ליום השבת', MU, { start: exact('שיר היחוד ליום השבת'), end: 'ככתוב ברוך יהוה אלהי ישראל' }),
  sec('shir-hakavod', 'closing-passages', 'שיר הכבוד', MU, { start: exact('שיר הכבוד'), end: 'סוגרין הארון' }),
  sec('kaddish-yatom-2', 'kaddish-yatom', 'קדיש יתום', MU, { start: exact('קדיש יתום'), end: 'יהא שלמא רבא מן שמיא', role: 'mourners' }),
  sec('adon-olam', 'closing-passages', 'אדון עולם', MU, { start: 'אדון עולם אשר מלך', end: 'אדון עולם אשר מלך' }),
  sec('lechem-hapanim', 'closing-passages', 'פרשת לחם הפנים', MU, { start: 'ראוי לכל יחיד לקרות הפרשה', role: 'optional' }),
]);

// ── Shabbat day Kiddush ────────────────────────────────────────────────────────────────────────────────────────────
const SDK = R('Shabbat Day Meal, Shabbat Day Kiddush');
const shabbatKiddushDay = service('קידושא רבא', [
  sec('asader', 'zemirot', 'אתקינו · אסדר לסעודתא', SDK, { end: /^ר בו יתיר יסגא/ }),
  sec('chai-hashem', 'zemirot', 'חי ה׳ וברוך צורי', SDK, { start: 'מחבר הזמר חיים יצחק', end: /^ק ומה יהוה למנוחתי/ }),
  sec('kiddush-day', 'kiddush-day', 'קידושא רבא', SDK, { start: 'מזמור לדוד , יהוה רעי', end: 'בורא פרי הגפן' }),
  sec('leshev-basukka', 'kiddush-day', 'לישב בסוכה', SDK, { start: 'בשבת חוה"מ סוכות יברך', when: 'sukkot' }),
], { conditionsPending: ['לישב בסוכה מסומן במפתח sukkot (ט"ו–כ"א בתשרי) שאין לו תווית ב-WHEN_LABELS'] });

// ── Shabbat Mincha ─────────────────────────────────────────────────────────────────────────────────────────────────
const SMI = path => R(`Shabbat Mincha, ${path}`);
const SMIA = SMI('Amidah');
const shabbatMincha = service('מנחה לשבת', [
  sec('kiyor', 'korbanot', 'פרשת הכיור', SMI('Korbanot'), { end: 'ועשית כיור נחשת' }),
  sec('tamid', 'korbanot', 'פרשת התמיד', SMI('Korbanot'), { start: 'צו את בני ישראל ואמרת אלהם', end: 'ושחט אתו על ירך המזבח' }),
  sec('ketoret', 'ketoret', 'פטום הקטורת', SMI('Korbanot'), { start: 'אתה הוא יהוה אלהינו שהקטירו', end: 'אומר ג\' פעמים' }),
  sec('ana-bekoach', 'korbanot', 'אנא בכח', SMI('Korbanot'), { start: 'אנא בכח גדלת ימינך', end: 'אנא בכח גדלת ימינך' }),
  sec('ashrei', 'ashrei', 'אשרי', SMI('Korbanot'), { start: /^אשרי יושבי ביתך/, end: /^אשרי יושבי ביתך/ }),
  sec('uva-letzion', 'uva-letzion', 'ובא לציון', SMI('Korbanot'), { start: 'ובא לציון גואל', end: '(יהוה אדונינו' }),
  heading('half-kaddish', SMI('Korbanot'), 'חצי קדיש:'),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', SMI('Korbanot'), { end: 'דאמירן בעלמא', role: 'minyan' }),
  omit('festival-amidah-pointer', SMI('Korbanot'), { start: '(ביום טוב שחל בחול מתפללים כאן', end: '(ביום טוב שחל בחול מתפללים כאן', why: FESTIVAL_ONLY }),
  sec('vaani-tefilati', 'torah-service', 'ואני תפלתי', SMI('Korbanot'), { start: 'ואני תפלתי לך יהוה', end: 'ואני תפלתי לך יהוה' }),
  sec('torah-service', 'torah-service', 'הוצאת ספר תורה', SMI('Korbanot'), { start: 'כשפותחין הארון הקדוש', end: 'ואתם הדבקים ביהוה', role: 'minyan' }),
  sec('torah-reading', 'torah-reading', 'קריאת התורה', SMI('Korbanot'), { start: 'כשקורין אותו לתורה יאמר זה', end: 'מי שגמלך טוב', role: 'minyan' }),
  sec('shepatrani', 'torah-reading', 'ברכת ברוך שפטרני', SMI('Korbanot'), { start: exact('ברכת ברוך שפטרני'), end: 'ברוך שפטרני מענשו', role: 'optional' }),
  sec('hagbaha', 'torah-reading', 'הגבהת ספר תורה', SMI('Korbanot'), { start: 'בעת הגבהת ס"ת לאחר הקריאה', end: 'וזאת התורה אשר שם משה', role: 'minyan' }),
  sec('halleluyah-psalms', 'return-torah', 'הללויה אודה ה׳ · אשרי איש', SMI('Korbanot'), { start: 'הללויה אודה יהוה בכל לבב', end: 'הללויה אשרי איש ירא' }),
  sec('return-torah', 'return-torah', 'הכנסת ספר תורה', SMI('Korbanot'), { start: 'ומחזירין את ספר התורה למקומו', end: 'וכשמכניסין הספר תורה להיכל', role: 'minyan' }),
  heading('half-kaddish-2', SMI('Korbanot'), 'חצי קדיש:'),
  sec('half-kaddish-2', 'half-kaddish', 'חצי קדיש', SMI('Korbanot'), { role: 'minyan' }),
  heading('amidah-opening', SMIA, 'תפילת שמונה עשרה'),
  sec('amidah-opening', 'amidah', 'תפילת העמידה', SMIA, { end: 'אדני, שפתי תפתח' }),
  sec('avot', 'amidah', 'ברכת אבות', SMIA, { start: 'ברוך אתה יהוה, אלהינו ואלהי אבותינו', end: 'מגן אברהם' }),
  sec('gevurot', 'amidah', 'גבורות', SMIA, { start: 'אתה גבור לעולם', end: /^ונאמן אתה להחיות מתים/ }),
  sec('kedusha', 'kedusha', 'קדושה', SMIA, { start: exact('קדושה'), end: 'ברוך כבוד יהוה ממקומו. ובדברי', role: 'repetition' }),
  sec('kedushat-hashem', 'amidah', 'קדושת השם', SMIA, { start: /^אתה קדוש/, end: /^אתה קדוש/ }),
  sec('kedushat-hayom', 'amidah', 'אתה אחד', SMIA, { start: 'אתה אחד ושמך אחד', end: 'מקדש השבת' }),
  sec('retze', 'amidah', 'רצה', SMIA, { start: /^רצה יהוה אלהינו/, end: /^רצה יהוה אלהינו/ }),
  sec('yaale-veyavo', 'amidah', 'יעלה ויבוא', SMIA, { start: 'בשבת ראש חודש ובשבת חול המועד', when: 'roshChodesh|cholHamoed' }),
  sec('retze-end', 'amidah', '', SMIA, { start: /^ותחזינה עינינו/, end: /^ותחזינה עינינו/, continues: true }),
  sec('modim', 'amidah', 'מודים', SMIA, { start: /^מודים אנחנו לך/, end: /^מודים אנחנו לך/ }),
  sec('modim-derabanan', 'modim-derabanan', 'מודים דרבנן', SMIA, { start: 'מודים דרבנן בחזרת הש"ץ', end: 'ברוך אל ההודאות', role: 'repetition' }),
  sec('al-hanisim', 'amidah', 'על הנסים', SMIA, { start: 'על הניסים בשבת חנוכה', end: /^בפורים המשולש אומרים/, when: 'chanukah|purim' }),
  sec('modim-end', 'amidah', '', SMIA, { start: 'ועל כלם יתברך', end: 'הטוב שמך ולך נאה להודות', continues: true }),
  sec('sim-shalom', 'amidah', 'שים שלום', SMIA, { start: 'שים שלום טובה וברכה', end: /^ברוך אתה יהוה, המברך את עמו/ }),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', SMIA, { start: 'יהיו לרצון אמרי פי', end: 'וערבה ליהוה מנחת יהודה' }),
  sec('tzidkatcha', 'tzidkatcha', 'צדקתך', SMIA, { start: 'בימים שאין אומרים בהם תחנון בחול', end: /^צדקתך צדק לעולם, ותורתך אמת: וצדקתך/, when: 'tachanunIfWeekday' }),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', SMIA, { start: exact('קדיש שלם'), end: 'עשה שלום (בעשי"ת השלום ) במרומיו', role: 'minyan' }),
  sec('aleinu', 'aleinu', 'עלינו לשבח', SMIA, { start: 'עלינו לשבח לאדון הכל', end: 'ועל כן נקוה לך' }),
  sec('kaddish-yatom', 'kaddish-yatom', 'קדיש יתום', SMIA, { start: exact('קדיש יתום'), end: 'יהא שלמא רבא מן שמיא', role: 'mourners' }),
  sec('ledavid', 'ledavid-ori', 'לדוד ה׳ אורי', SMIA, { start: 'מראש חדש אלול עד אחר הושענא רבה', end: 'לדוד יהוה אורי וישעי', when: 'ledavid' }),
  sec('kaddish-yatom-ledavid', 'kaddish-yatom', 'קדיש יתום', SMIA, { start: exact('קדיש יתום'), end: 'יהא שלמא רבא מן שמיא', when: 'ledavid', role: 'mourners' }),
  // Winter: Barchi Nafshi and the Songs of Ascents; summer: Pirkei Avot (the edition's note, ¶68).
  sec('barchi-nafshi', 'barchi-nafshi', 'ברכי נפשי ושירי המעלות', SMIA, { start: 'בשבת אחר סוכות מתחילין לומר ברכי נפשי', when: 'winter' }),
  sec('pirkei-avot', 'pirkei-avot', 'פרקי אבות', SMI('Pirkei Avot')),
], { conditionsPending: [
  'צדקתך: אינו נאמר בשבת שבחול לא היו אומרים בה תחנון ובארבע פרשיות — אין מפתח תנאי',
  'ברכי נפשי ושירי המעלות (מסוכות עד שבת הגדול) ופרקי אבות (מפסח עד ראש השנה, פרק לשבת) — אין מפתח עונה ופרק',
] });

// ── Havdalah ───────────────────────────────────────────────────────────────────────────────────────────────────────
const MSH = path => R(`Motzaei Shabbat , ${path}`);
const havdalah = service('הבדלה', [
  sec('havdalah', 'havdalah', 'סדר הבדלה', MSH('Havdala')),
  heading('hamavdil', MSH('Hamavdil'), 'זמר למוצאי שבת'),
  sec('hamavdil', 'havdalah', 'המבדיל בין קודש לחול', MSH('Hamavdil'), { role: 'optional' }),
], { reviewed: true });

// ── Birkat HaMazon ─────────────────────────────────────────────────────────────────────────────────────────────────
// The edition's leaf has lost its small-print captions (the empty paragraphs), so the day's alternatives are cut here
// as sections: Al Naharot Bavel on days with Tachanun, Shir HaMa'alot on the others; Retze on Shabbat.
const BH = R('Birchat HaMazon, Birchat HaMazon');
const birkatHamazon = service('ברכת המזון', [
  sec('al-naharot', 'birkat-hamazon', 'על נהרות בבל', BH, { start: 'על נהרות בבל', end: 'על נהרות בבל', when: 'tachanun' }),
  sec('shir-hamaalot', 'birkat-hamazon', 'שיר המעלות', BH, { start: 'שיר המעלות בשוב יהוה', end: 'שיר המעלות בשוב יהוה', when: '!tachanun' }),
  sec('zimun', 'birkat-hamazon', 'זימון', BH, { start: /^רבותי נברך/, end: 'ברוך הוא וברוך שמו' }),
  sec('zimun-nisuin', 'birkat-hamazon', 'זימון בסעודת נישואין', BH, { start: /^רבותי נברך/, role: 'optional' }),
  sec('hazan', 'birkat-hamazon', 'ברכת הזן', BH, { start: 'ברכה זו משה רבינו', end: 'ברוך אתה יהוה הזן את הכל' }),
  sec('haaretz', 'birkat-hamazon', 'ברכת הארץ', BH, { start: 'ברכה זו יהושע תקנה', end: 'נודה לך יהוה אלהינו' }),
  sec('al-hanisim', 'birkat-hamazon', 'על הנסים', BH, { start: /^ועל הנסים ועל הפרקן/, end: 'ותלו אותו ואת בניו על העץ', when: 'chanukah|purim' }),
  sec('haaretz-end', 'birkat-hamazon', '', BH, { start: 'ועל הכל יהוה אלהינו', end: 'ועל הכל יהוה אלהינו', continues: true }),
  sec('boneh-yerushalayim', 'birkat-hamazon', 'בונה ירושלים', BH, { start: 'בונה ירושלים דוד ושלמה', end: 'רחם יהוה אלהינו על ישראל' }),
  sec('retze', 'birkat-hamazon', 'רצה והחליצנו', BH, { start: 'רצה והחליצנו', end: 'רצה והחליצנו', when: 'shabbat' }),
  sec('yaale-veyavo', 'birkat-hamazon', 'יעלה ויבוא', BH, { start: /^אלהינו ואלהי אבותינו יעלה ויבא/, end: 'זכרנו יהוה אלהינו בו לטובה', when: 'roshChodesh|cholHamoed|yomTov|roshHashana' }),
  sec('boneh-end', 'birkat-hamazon', '', BH, { start: 'ובנה ירושלים עיר הקדש', end: 'ובנה ירושלים עיר הקדש', continues: true }),
  sec('hatov-vehametiv', 'birkat-hamazon', 'הטוב והמטיב', BH, { start: 'הטוב והמטיב ביבנה', end: 'האל אבינו, מלכנו' }),
  sec('harachaman', 'birkat-hamazon', 'הרחמן', BH, { start: /^הרחמן הוא ימלוך/, end: 'יראו את יהוה קדושיו' }),
  // What one says on Shabbat, Rosh Chodesh or a festival when Retze or Ya'aleh VeYavo was forgotten (the edition's
  // captions for these are lost; the words themselves say which day each is for).
  sec('shachach', 'birkat-hamazon', 'מי ששכח רצה או יעלה ויבוא', BH, { start: /^ברוך אתה יהוה אלהינו מלך העולם אשר נתן שבתות/, role: 'optional' }),
], { conditionsPending: [
  'המהדורה איבדה את הכותרות הקטנות של ברכת המזון (פסקאות ריקות): התנאים על נהרות/שיר המעלות, רצה ויעלה ויבוא נחתכו כאן כמקטעים',
  'יעלה ויבוא נאמר גם ביום טוב ובראש השנה — אין מפתח תנאי ליום טוב; רצה מסומן במפתח shabbat שאין לו תווית ב-WHEN_LABELS',
] });

// ── Bedtime Shema ──────────────────────────────────────────────────────────────────────────────────────────────────
const BS = R('Bedtime Shema');
const bedtimeShema = service('קריאת שמע על המיטה', [
  sec('ribono-mochel', 'bedtime-shema', 'רבונו של עולם הריני מוחל', BS, { end: 'הריני מוחל לכל מי שהכעיס' }),
  sec('hamapil', 'bedtime-shema', 'המפיל', BS, { start: 'המפיל חבלי שנה', end: 'המפיל חבלי שנה' }),
  sec('shema', 'bedtime-shema', 'קריאת שמע', BS, { start: 'מי שאינו מדקדק לקרות', end: 'ואהבת את יהוה אלהיך' }),
  sec('vihi-noam', 'bedtime-shema', 'ויהי נועם · יושב בסתר · ה׳ מה רבו צרי', BS, { start: 'ויהי נעם אדני', end: 'יהוה מה רבו צרי' }),
  sec('hashkiveinu', 'bedtime-shema', 'השכיבנו', BS, { start: 'השכיבנו יהוה אלהינו', end: 'יראו עינינו וישמח לבנו' }),
  sec('hamalach', 'bedtime-shema', 'המלאך הגואל', BS, { start: 'המלאך הגאל אתי', end: 'רגזו ואל תחטאו' }),
  sec('adon-olam', 'bedtime-shema', 'אדון עולם', BS, { start: 'אדון עולם אשר מלך' }),
], { reviewed: true });

// ── Hallel ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const hallel = service('הלל', [
  heading('hallel', RC('Hallel'), 'סדר הלל'),
  sec('hallel', 'hallel', 'הלל', RC('Hallel'), { end: 'זבדיה ישמרנו ויחינו' }),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', RC('Hallel'), { start: 'בראש חודש וביום טוב ובחול המועד אומר החזן', when: '!chanukah', role: 'minyan' }),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', RC('Hallel'), { start: 'בראש חודש וביום טוב ובחול המועד אומר החזן', end: 'עד כאן אומרים בחנוכה', when: 'chanukah', role: 'minyan', rewind: true }),
], { reviewed: true, conditionsPending: ['חצי הלל: "לא לנו" ו"אהבתי" מדולגים בראש חודש ובחול המועד פסח ובשני הימים האחרונים של פסח — הכותרת בתוך הטקסט; אין מפתח לפסח'] });

// ── Rosh Chodesh Musaf ─────────────────────────────────────────────────────────────────────────────────────────────
const RCM = RC('Mussaf');
const roshChodeshMusaf = service('מוסף לראש חודש', [
  heading('amidah-opening', RCM, 'מוסף לראש חודש'),
  sec('amidah-opening', 'musaf', 'תפילת מוסף', RCM, { end: 'אדני, שפתי תפתח' }),
  sec('avot', 'musaf', 'ברכת אבות', RCM, { start: 'ברוך אתה יהוה, אלהינו ואלהי אבותינו', end: 'מגן אברהם' }),
  sec('gevurot', 'musaf', 'גבורות', RCM, { start: 'אתה גבור לעולם' }),
  sec('keter', 'kedusha', 'כתר', RCM, { start: /^כתר/, end: 'חזן: לדור ודור נגיד גדלך', role: 'repetition' }),
  sec('kedushat-hashem', 'musaf', 'קדושת השם', RCM, { start: /^אתה קדוש/, end: /^אתה קדוש/ }),
  sec('rashei-chodashim', 'musaf', 'ראשי חדשים', RCM, { start: 'ראשי חדשים לעמך נתת', end: 'מקדש ישראל וראשי חדשים' }),
  sec('retze', 'musaf', 'רצה', RCM, { start: /^רצה יהוה אלהינו/, end: /^ותחזינה עינינו/ }),
  sec('modim', 'musaf', 'מודים', RCM, { start: /^מודים אנחנו לך/, end: /^מודים אנחנו לך/ }),
  sec('modim-derabanan', 'modim-derabanan', 'מודים דרבנן', RCM, { start: 'מודים דרבנן בחזרת הש"ץ', end: 'ברוך אל ההודאות', role: 'repetition' }),
  sec('al-hanisim', 'musaf', 'על הנסים', RCM, { start: 'על הניסים בחנוכה אומרים כאן', end: 'ימי חנכה אלו להודות', when: 'chanukah' }),
  sec('modim-end', 'musaf', '', RCM, { start: 'ועל כלם יתברך', end: 'הטוב שמך ולך נאה להודות', continues: true }),
  ...reusedBirkatKohanim(RCM, exact('ברכת כהנים')),
  sec('sim-shalom', 'musaf', 'שים שלום', RCM, { start: 'שים שלום טובה וברכה', end: /^ברוך אתה יהוה, המברך את עמו/ }),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', RCM, { start: 'יהיו לרצון אמרי פי', end: 'וערבה ליהוה מנחת יהודה' }),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', RCM, { start: exact('קדיש שלם'), end: 'עשה שלום במרומיו הוא יעשה', role: 'minyan' }),
  sec('kaveh', 'kaveh', 'קוה אל ה׳', RCM, { start: 'קוה אל יהוה חזק', end: 'קוה אל יהוה חזק' }),
  sec('ein-keloheinu', 'ein-keloheinu', 'אין כאלהינו', RCM, { start: /^אין כאלהינו/, end: /^אין כאלהינו/ }),
  sec('pitum-haketoret', 'ketoret', 'פטום הקטורת', RCM, { start: 'פטום הקטרת הצרי', end: 'אתה סתר לי מצר' }),
  sec('tanna-devei-eliyahu', 'closing-passages', 'תנא דבי אליהו', RCM, { start: 'תנא דבי אליהו', end: 'אמר רבי אלעזר אמר רבי חנינא' }),
  sec('kaddish-derabanan', 'kaddish-derabanan', 'קדיש דרבנן', RCM, { start: 'קדיש דרבנן:', end: 'על ישראל ועל רבנן', role: 'minyan' }),
  sec('barchu', 'barchu', 'ברכו', RCM, { start: exact('ברכו את יהוה המברך:'), end: 'קהל וחזן: ברוך יהוה המברך', role: 'minyan' }),
  sec('aleinu', 'aleinu', 'עלינו לשבח', RCM, { start: 'עלינו לשבח לאדון הכל', end: 'ועל כן נקוה לך' }),
  sec('kaddish-yatom', 'kaddish-yatom', 'קדיש יתום', RCM, { start: exact('קדיש יתום'), role: 'mourners' }),
]);

// ── Sefirat HaOmer ─────────────────────────────────────────────────────────────────────────────────────────────────
const omerService = service('ספירת העומר', [
  sec('omer', 'omer', 'ספירת העומר', WV('Sefirat HaOmer'), { end: 'ה סיון 49' }),
  sec('omer-after', 'omer', 'הרחמן · למנצח · אנא בכח', WV('Sefirat HaOmer'), { start: 'הרחמן הוא יחזיר לנו עבודת' }),
], { reviewed: true, conditionsPending: ['המהדורה מדפיסה את 49 הימים ברצף — בחירת היום של היום אינה בידי התנאים של החיבור'] });

// ── The festival Amidah (Maariv, Shacharit, Mincha of the Three Festivals) ─────────────────────────────────────────
const HOL = path => R(`Holidays, ${path}`);
const FA = HOL('Maariv, Shacharit & Mincha Amidah');
const festivalAmidah = service('עמידה לשלוש רגלים', [
  heading('vayedaber', HOL('Kaddish Before Maariv Amidah'), 'תפילת ג\' רגלים לערבית, לשחרית ולמנחה'),
  sec('vayedaber', 'shema-blessings', 'וידבר משה · בערבית', HOL('Kaddish Before Maariv Amidah'), { end: 'וידבר משה את מועדי' }),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', HOL('Kaddish Before Maariv Amidah'), { start: 'חצי קדיש:', role: 'minyan' }),
  heading('amidah-opening', FA, 'תפילת שמונה עשרה לשחרית, מנחה וערבית של ג\' רגלים'),
  sec('amidah-opening', 'festival-amidah', 'תפילת העמידה', FA, {}),
  sec('avot', 'festival-amidah', 'ברכת אבות', FA, { start: 'ברוך אתה יהוה, אלהינו ואלהי אבותינו', end: 'מגן אברהם' }),
  sec('gevurot', 'festival-amidah', 'גבורות', FA, { start: 'אתה גבור לעולם' }),
  sec('kedusha', 'kedusha', 'קדושה', FA, { start: exact('קדושה'), role: 'repetition' }),
  sec('kedushat-hashem', 'festival-amidah', 'קדושת השם', FA, { start: /^אתה קדוש/, end: /^אתה קדוש/ }),
  sec('ata-bechartanu', 'festival-amidah', 'אתה בחרתנו', FA, { start: 'אתה בחרתנו מכל העמים', end: 'אתה בחרתנו מכל העמים' }),
  sec('vatodienu', 'festival-amidah', 'ותודיענו', FA, { start: 'כשחל יו"ט במוצאי שבת', end: 'ותודיענו יהוה אלהינו', when: 'motzaeiShabbat' }),
  sec('vatiten-lanu', 'festival-amidah', '', FA, { start: 'ותתן לנו יהוה אלהינו באהבה', end: 'מקרא קדש זכר ליציאת מצרים', continues: true }),
  sec('yaale-veyavo', 'festival-amidah', 'יעלה ויבוא', FA, { start: /^אלהינו ואלהי אבותינו, יעלה ויבא/, end: 'הזה. זכרנו יהוה אלהינו' }),
  sec('vehasienu', 'festival-amidah', 'והשיאנו', FA, { start: 'והשיאנו יהוה אלהינו', end: 'והשיאנו יהוה אלהינו' }),
  sec('retze', 'festival-amidah', 'רצה', FA, { start: /^רצה יהוה אלהינו/, end: /^ותחזינה עינינו/ }),
  sec('modim', 'festival-amidah', 'מודים', FA, { start: /^מודים אנחנו לך/, end: /^מודים אנחנו לך/ }),
  sec('modim-derabanan', 'modim-derabanan', 'מודים דרבנן', FA, { start: 'מודים דרבנן בחזרת הש"ץ', end: 'ברוך אל ההודאות', role: 'repetition' }),
  sec('modim-end', 'festival-amidah', '', FA, { start: 'ועל כלם יתברך', end: 'הטוב שמך ולך נאה להודות', continues: true }),
  ...reusedBirkatKohanim(FA, exact('ברכת כהנים')),
  sec('sim-shalom', 'festival-amidah', 'שים שלום', FA, { start: 'שים שלום טובה וברכה', end: /^ברוך אתה יהוה, המברך את עמו/ }),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', FA, { start: 'יהיו לרצון אמרי פי', end: 'וערבה ליהוה מנחת יהודה' }),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', FA, { start: exact('קדיש שלם'), end: 'עשה שלום במרומיו הוא יעשה', role: 'minyan' }),
  sec('aleinu', 'aleinu', 'עלינו לשבח', FA, { start: 'בערבית ליל יום טוב, אחרי שמונה עשרה', end: 'ועל כן נקוה לך' }),
  sec('kaddish-yatom', 'kaddish-yatom', 'קדיש יתום', FA, { start: exact('קדיש יתום'), role: 'mourners' }),
], { conditionsPending: [
  'השירות משותף לערבית, שחרית ומנחה: "וידבר משה" והחצי קדיש שלפניו — בערבית בלבד; הקדושה — בשחרית ובמנחה (כותרות בתוך הטקסט); אין מפתח לסוג התפילה בתנאי החיבור',
  'שם החג ביעלה ויבוא ובאתה בחרתנו (פסח/שבועות/סוכות/שמיני עצרת) — כותרות בתוך הטקסט; אין מפתחות לחגים עצמם',
] });

// ── The festival Musaf ─────────────────────────────────────────────────────────────────────────────────────────────
const FM = HOL('Yom Tov Musaf Amidah');
const festivalMusaf = service('מוסף לשלוש רגלים', [
  heading('amidah-opening', FM, 'מוסף לג\' רגלים'),
  sec('amidah-opening', 'musaf', 'תפילת מוסף', FM, { end: 'אדני, שפתי תפתח' }),
  sec('avot', 'musaf', 'ברכת אבות', FM, { start: 'ברוך אתה יהוה, אלהינו ואלהי אבותינו', end: 'מגן אברהם' }),
  sec('gevurot', 'musaf', 'גבורות', FM, { start: 'אתה גבור לעולם' }),
  sec('keter', 'kedusha', 'כתר', FM, { start: /^כתר בחזרת/, end: /^כתר בחזרת/, role: 'repetition' }),
  // Two printings of Keter: for the festival, Hoshana Rabba and Shabbat Chol HaMoed; and for a weekday of Chol HaMoed.
  sec('keter-yom-tov', 'kedusha', '', FM, { start: 'למוסף של חג, הושענא רבה', end: /^כתר יתנו לך/, when: '!cholHamoed|shabbat', role: 'repetition', continues: true }),
  sec('keter-chol-hamoed', 'kedusha', '', FM, { start: 'למוסף של חוה"מ:', end: /^כתר יתנו לך/, when: 'cholHamoed&!shabbat', role: 'repetition', continues: true }),
  sec('keter-end', 'kedusha', '', FM, { start: 'חזן: לדור ודור נגיד גדלך', end: 'חזן: לדור ודור נגיד גדלך', role: 'repetition', continues: true }),
  sec('kedushat-hashem', 'musaf', 'קדושת השם', FM, { start: /^אתה קדוש/, end: /^אתה קדוש/ }),
  sec('ata-bechartanu', 'musaf', 'אתה בחרתנו', FM, { start: 'אתה בחרתנו מכל העמים', end: 'מקרא קדש זכר ליציאת מצרים' }),
  sec('umipnei-chataeinu', 'musaf', 'ומפני חטאינו', FM, { start: 'ומפני חטאינו גלינו מארצנו', end: 'עלת שבת בשבתו. על עלת התמיד' }),
  // The additional offerings of the day, festival by festival (the edition's own captions). The first and last days of
  // Pesach cannot be told apart by the condition keys (the last days take the Chol HaMoed verses, ¶41).
  sec('musaf-pesach', 'musaf', 'מוספי היום · פסח', FM, { start: 'ליום א\' וב\' דפסח:', when: 'pesach&!cholHamoed' }),
  sec('musaf-shavuot', 'musaf', 'מוספי היום · שבועות', FM, { start: 'לשבועות:', when: 'shavuot' }),
  sec('musaf-sukkot', 'musaf', 'מוספי היום · סוכות', FM, { start: 'ליום א\' וב\' דסכות:', when: 'sukkot&!cholHamoed' }),
  sec('musaf-chm-pesach', 'musaf', 'מוספי היום · חול המועד ואחרון של פסח', FM, { start: 'בחול המועד פסח ובשני ימים אחרונים', when: 'pesach&cholHamoed' }),
  sec('musaf-chm-sukkot', 'musaf', 'מוספי היום · חול המועד סוכות', FM, { start: 'בסוכות בחו"ל אומרים גם ספיקא דיומא', when: 'sukkot&cholHamoed&!hoshanaRabbah' }),
  sec('musaf-hoshana-rabba', 'musaf', 'מוספי היום · הושענא רבה', FM, { start: 'להושענא רבה:', when: 'hoshanaRabbah' }),
  sec('musaf-shemini-atzeret', 'musaf', 'מוספי היום · שמיני עצרת', FM, { start: 'לשמיני עצרת ולשמחת תורה:', when: 'sheminiAtzeret' }),
  sec('yismechu', 'musaf', 'ישמחו במלכותך', FM, { start: 'לשבת: ישמחו במלכותך', end: 'לשבת: ישמחו במלכותך', when: 'shabbat' }),
  sec('elokeinu-melech-rachaman', 'musaf', 'אלהינו ואלהי אבותינו מלך רחמן', FM, { start: 'אלהינו ואלהי אבותינו. מלך רחמן', end: 'אלהינו ואלהי אבותינו. מלך רחמן' }),
  sec('vehasienu', 'musaf', 'והשיאנו', FM, { start: 'והשיאנו יהוה אלהינו', end: 'והשיאנו יהוה אלהינו' }),
  sec('retze', 'musaf', 'רצה', FM, { start: /^רצה יהוה אלהינו/, end: /^רצה יהוה אלהינו/ }),
  sec('veteerav', 'musaf', 'ותערב', FM, { start: 'בחזרת הש"ץ אומרים כאן ותערב', end: 'והחזן מסיים', role: 'repetition' }),
  sec('retze-end', 'musaf', '', FM, { start: /^ותחזינה עינינו/, end: /^ותחזינה עינינו/, continues: true }),
  sec('modim', 'musaf', 'מודים', FM, { start: /^מודים אנחנו לך/, end: /^מודים אנחנו לך/ }),
  sec('modim-derabanan', 'modim-derabanan', 'מודים דרבנן', FM, { start: 'מודים דרבנן בחזרת הש"ץ', end: 'ברוך אל ההודאות', role: 'repetition' }),
  sec('modim-end', 'musaf', '', FM, { start: 'ועל כלם יתברך', end: 'הטוב שמך ולך נאה להודות', continues: true }),
  // The festival Musaf is where the Kohanim bless the people (also in the Diaspora): the edition's own order of
  // Birkat Kohanim.
  omit('birkat-kohanim-caption', FM, { start: exact('ברכת כהנים'), end: exact('ברכת כהנים'), why: 'the caption "ברכת כהנים" — the Kohanim\'s order is printed in the edition\'s "סדר ברכת כהנים" (next section)' }),
  sec('birkat-kohanim', 'birkat-kohanim', 'סדר ברכת כהנים', R('Priestly Blessing'), { role: 'repetition' }),
  sec('sim-shalom', 'musaf', 'שים שלום', FM, { start: 'שים שלום טובה וברכה', end: 'שים שלום טובה וברכה' }),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', FM, { start: 'יהיו לרצון אמרי פי', end: 'וערבה ליהוה מנחת יהודה' }),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', FM, { start: exact('קדיש שלם'), end: 'עשה שלום במרומיו הוא יעשה', role: 'minyan' }),
  sec('kaveh', 'kaveh', 'קוה אל ה׳', FM, { start: 'קוה אל יהוה חזק', end: 'קוה אל יהוה חזק' }),
  sec('ein-keloheinu', 'ein-keloheinu', 'אין כאלהינו', FM, { start: /^אין כאלהינו/, end: /^אין כאלהינו/ }),
  sec('pitum-haketoret', 'ketoret', 'פטום הקטורת', FM, { start: 'פטום הקטרת הצרי', end: 'השיר שהלוים היו אומרים' }),
  sec('tanna-devei-eliyahu', 'closing-passages', 'תנא דבי אליהו', FM, { start: 'תנא דבי אליהו', end: 'אמר רבי אלעזר אמר רבי חנינא' }),
  sec('kaddish-derabanan', 'kaddish-derabanan', 'קדיש דרבנן', FM, { start: 'קדיש דרבנן:', end: 'על ישראל ועל רבנן', role: 'minyan' }),
  sec('barchu', 'barchu', 'ברכו', FM, { start: exact('ברכו את יהוה המברך:'), end: 'קהל וחזן: ברוך יהוה המברך', role: 'minyan' }),
  sec('aleinu', 'aleinu', 'עלינו לשבח', FM, { start: 'עלינו לשבח לאדון הכל', end: 'ועל כן נקוה לך' }),
  sec('kaddish-yatom', 'kaddish-yatom', 'קדיש יתום', FM, { start: exact('קדיש יתום'), role: 'mourners' }),
], { conditionsPending: [
  'מוספי היום: המפתחות pesach/shavuot/sukkot/sheminiAtzeret/hoshanaRabbah (של rubricConditions) אינם ב-WHEN_LABELS; ימים ראשונים ואחרונים של פסח אינם מובחנים; יום חול המועד סוכות (וספיקא דיומא בחו"ל) — כותרות בתוך הטקסט',
  'ברכת כהנים: בחוץ לארץ נשיאת כפים ביום טוב בלבד; בחול המועד אומר החזן "אלהינו ואלהי אבותינו" — אין הבחנה בתנאי',
] });

export default {
  nusach: 'sefard',
  index: 'Siddur Sefard',
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
    omer: omerService,
    'festival-amidah': festivalAmidah,
    'festival-musaf': festivalMusaf,
  },
  // Services of the schema that the licensed edition does not contain: schema id → reason. (None: the edition holds
  // every service of the schema.)
  sourceGaps: {},
};
