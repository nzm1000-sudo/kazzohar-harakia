// Nusach Ashkenaz, composed from Sefaria's "Siddur Ashkenaz" (the Metsudah siddur, CC-BY; Daat, Public Domain).
// Every section is a slice of that edition — see dsl.mjs for the vocabulary and prayerSchema.mjs for the concepts.
// Authoring notes, doubts and source gaps: docs/siddur/notes-ashkenaz.md.
import { sec, omit, service, leaf } from './dsl.mjs';

const A = leaf('Siddur Ashkenaz');

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────
// `prefix & when`, distributed over the `|` terms of both (the condition grammar has no parentheses).
const both = (prefix, when) => {
  if (!when) return prefix;
  const left = String(prefix).split('|');
  const right = String(when).split('|');
  return left.flatMap(a => right.map(b => `${a}&${b}`)).join('|');
};
// A block of sections said only when `prefix` holds (e.g. the Hallel inside Shacharit), with ids made unique.
const within = (prefix, idPrefix, sections) => sections.map(section => ({
  ...section,
  id: `${idPrefix}-${section.id}`,
  ...(section.omit ? {} : { when: both(prefix, section.when) }),
}));

// ── Leaves ───────────────────────────────────────────────────────────────────────────────────────────────────────
const WS = path => A(`Weekday, Shacharit, ${path}`);
const WSP = path => WS(`Preparatory Prayers, ${path}`);
const WSK = path => WSP(`Korbanot, ${path}`);
const WSD = path => WS(`Pesukei Dezimra, ${path}`);
const WSB = path => WS(`Blessings of the Shema, ${path}`);
const WSA = path => WS(`Amidah, ${path}`);
const WST = path => WS(`Post Amidah, ${path}`);
const WSR = path => WS(`Torah Reading, ${path}`);
const WSC = path => WS(`Concluding Prayers, ${path}`);
const MINCHA = path => A(`Weekday, Minchah, ${path}`);
const MA = path => MINCHA(`Amida, ${path}`);
const WM = path => A(`Weekday, Maariv, ${path}`);
const WMA = path => WM(`Amidah, ${path}`);
const WMB = path => WM(`Blessings of the Shema, ${path}`);
const KS = path => A(`Shabbat, Kabbalat Shabbat, ${path}`);
const SM = path => A(`Shabbat, Maariv, ${path}`);
const SMA = path => SM(`Amidah, ${path}`);
const SE = path => A(`Shabbat, Shabbat Evening, ${path}`);
const SS = path => A(`Shabbat, Shacharit, ${path}`);
const SSP = path => SS(`Preparatory Prayers, ${path}`);
const SSK = path => SSP(`Korbanot, ${path}`);
const SSD = path => SS(`Pesukei Dezimra, ${path}`);
const SSB = path => SS(`Blessings of the Shema, ${path}`);
const SSA = path => SS(`Amidah, ${path}`);
const SSR = path => SS(`Torah Reading, Removing the Torah from the Ark, ${path}`);
const SSF = path => SS(`Torah Reading, Reading from Sefer, ${path}`);
const SSC = path => SS(`Communal Prayers, ${path}`);
const MS = path => A(`Shabbat, Musaf LeShabbat, ${path}`);
const MSA = path => MS(`Amidah, ${path}`);
const SMI = path => A(`Shabbat, Minchah, ${path}`);
const SMIA = path => SMI(`Amidah, ${path}`);
const SMIT = path => SMI(`Torah Reading, ${path}`);
const HALLEL = path => A(`Festivals, Rosh Chodesh, Hallel, ${path}`);
const RCM = path => A(`Festivals, Rosh Chodesh, Musaf Amidah for Rosh Chodesh, ${path}`);
const FA = path => A(`Festivals, Shalosh Regalim, Amida for Maariv, Shacharit, Mincha, ${path}`);
const FM = path => A(`Festivals, Shalosh Regalim, Mussaf, ${path}`);

// The first two blessings where the edition prints the seasonal and Ten-Days lines as plain paragraphs, not as the
// small-print captions the day engine reads: each such line is a conditional continuation of its own.
//   seasons: the order the edition prints משיב הרוח (winter) and מוריד הטל (summer) in; aseret: מי כמוך is printed.
const avotWithZachreinu = (concept, ref) => [
  sec('avot', concept, 'ברכת אבות', ref, { end: 'למען שמו באהבה' }),
  sec('zachreinu', concept, '', ref, { start: 'זכרנו לחיים', end: 'זכרנו לחיים', when: 'aseret', continues: true }),
  sec('avot-end', concept, '', ref, { start: 'מלך עוזר', continues: true }),
];
const SEASON = { winter: ['mashiv-haruach', 'משיב הרוח ומוריד הגשם'], summer: ['morid-hatal', 'מוריד הטל'] };
const gevurotWithSeasons = (concept, ref, seasons, aseret) => [
  sec('gevurot', concept, 'גבורות', ref, { end: 'אתה גבור לעולם' }),
  ...seasons.map(season => sec(SEASON[season][0], concept, '', ref, { start: SEASON[season][1], end: SEASON[season][1], when: season, continues: true })),
  sec('mechalkel', concept, '', ref, { start: 'מכלכל חיים', continues: true }),
  ...(aseret ? [sec('mi-chamocha', concept, '', ref, { start: 'מי כמוך אב הרחמים', end: 'מי כמוך אב הרחמים', when: 'aseret', continues: true })] : []),
  sec('gevurot-end', concept, '', ref, { start: 'ונאמן אתה להחיות', continues: true }),
];

// Conditions this file repeats.
// A Ten-Days variant printed as plain words inside a paragraph (the Musaf and Shabbat-Mincha leaves).
const INLINE_ASERET = 'עשרת ימי תשובה: "האל בעש״ת המלך הקדוש" and "עשה בעש״ת השלום שלום" are printed as plain words inside the paragraph (not small print); the day engine cannot resolve them and drops the words after them';
const NO_MUSAF_TODAY = '!roshChodesh&!cholHamoed';
const MUSAF_TODAY = 'roshChodesh|cholHamoed';
// Lamenatze'ach is left out on Rosh Chodesh, Chanukah, Purim, Chol HaMoed and Tisha B'Av (Erev Pesach and Erev Yom
// Kippur too — no condition key yet, see the notes).
const LAMENATZEACH = '!roshChodesh&!chanukah&!purim&!cholHamoed&!tishaBav';
// Hallel: "לא לנו" and "אהבתי" are skipped on Rosh Chodesh, the last days of Pesach and Chol HaMoed Pesach.
const FULL_HALLEL_PARTS = '!roshChodesh&!halfHallel&!cholHamoed|!roshChodesh&!halfHallel&!pesach';
// The day engine reads the edition's "בראש חודש ובחוה"מ פסח מדלגין:" (inside the same paragraph as לא לנו / אהבתי) as
// "said on Rosh Chodesh" and hides those passages on full-Hallel days; the sections' own conditions are right.
const HALLEL_ENGINE_PENDING = 'לא לנו / אהבתי: the day engine reads the caption "בראש חודש ובחוה"מ פסח מדלגין" as a condition to say (SKIP_INSTRUCTIONS lacks "מדלגין") and hides them on full-Hallel days';

// ── Hallel (the edition prints it under Rosh Chodesh; the skipped passages are marked in it) ─────────────────────
const hallelSections = [
  sec('bracha', 'hallel', 'ברכת ההלל', HALLEL('Berakhah before the Hallel')),
  sec('ps113', 'hallel', 'הללויה הללו עבדי ה׳', HALLEL('Psalm 113')),
  sec('ps114', 'hallel', 'בצאת ישראל ממצרים', HALLEL('Psalm 114')),
  sec('lo-lanu', 'hallel', 'לא לנו', HALLEL('Psalm 115'), { end: 'יראי יהוה בטחו', when: FULL_HALLEL_PARTS }),
  sec('ps115', 'hallel', 'ה׳ זכרנו יברך', HALLEL('Psalm 115'), { start: 'זכרנו יברך' }),
  sec('ahavti', 'hallel', 'אהבתי כי ישמע', HALLEL('Psalm 116'), { end: 'אני אמרתי בחפזי', when: FULL_HALLEL_PARTS }),
  sec('ps116', 'hallel', 'מה אשיב', HALLEL('Psalm 116'), { start: 'מה אשיב' }),
  sec('ps117', 'hallel', 'הללו את ה׳ כל גוים', HALLEL('Psalm 117')),
  sec('ps118', 'hallel', 'הודו לה׳ כי טוב', HALLEL('Psalm 118')),
  sec('yehallelucha', 'hallel', 'יהללוך', HALLEL('Berakhah after the Hallel')),
];

// ── Weekday Amidah of Shacharit, blessing by blessing ────────────────────────────────────────────────────────────
const shacharitAmidah = [
  sec('avot', 'amidah', 'ברכת אבות', WSA('Patriarchs')),
  sec('gevurot', 'amidah', 'גבורות', WSA('Divine Might')),
  sec('kedusha', 'kedusha', 'קדושה', WSA('Kedushah'), { role: 'repetition' }),
  sec('kedushat-hashem', 'amidah', 'קדושת השם', WSA('Holiness of God')),
  sec('daat', 'amidah', 'חונן הדעת', WSA('Knowledge')),
  sec('teshuva', 'amidah', 'תשובה', WSA('Repentance')),
  sec('selicha', 'amidah', 'סליחה', WSA('Forgiveness')),
  sec('geula', 'amidah', 'גאולה', WSA('Redemption'), { end: 'גואל ישראל' }),
  sec('aneinu-chazzan', 'amidah', 'עננו', WSA('Redemption'), { start: 'אומר כאן הש"ץ עננו', role: 'repetition', when: 'fast' }),
  sec('refua', 'amidah', 'רפואה', WSA('Healing')),
  sec('birkat-hashanim', 'amidah', 'ברכת השנים', WSA('Prosperity')),
  sec('kibbutz-galuyot', 'amidah', 'קיבוץ גלויות', WSA('Gathering the Exiles')),
  sec('mishpat', 'amidah', 'השבת המשפט', WSA('Justice')),
  sec('minim', 'amidah', 'ברכת המינים', WSA('Against Enemies')),
  sec('tzadikim', 'amidah', 'על הצדיקים', WSA('The Righteous')),
  sec('yerushalayim', 'amidah', 'בונה ירושלים', WSA('Rebuilding Jerusalem')),
  sec('malchut-david', 'amidah', 'מלכות בית דוד', WSA('Kingdom of David')),
  sec('shomea-tefila', 'amidah', 'שומע תפילה', WSA('Response to Prayer')),
  sec('retze', 'amidah', 'רצה', WSA('Temple Service'), { end: 'עבודת ישראל עמך' }),
  sec('yaale-veyavo', 'amidah', 'יעלה ויבוא', WSA('Temple Service'), { start: 'בראש חדש ובחול המועד', end: 'שכח ולא אמר יעלה ויבא', when: MUSAF_TODAY }),
  sec('retze-end', 'amidah', '', WSA('Temple Service'), { start: 'ותחזינה עינינו', continues: true }),
  sec('modim', 'amidah', 'מודים', WSA('Thanksgiving'), { end: 'קוינו לך' }),
  sec('modim-derabanan', 'modim-derabanan', 'מודים דרבנן', WSA('Thanksgiving'), { start: 'כשיגיע שליח צבור למודים', end: 'ברוך אל ההודאות', role: 'repetition' }),
  sec('al-hanisim', 'amidah', 'על הנסים', WSA('Thanksgiving'), { start: 'בחנוכה ופורים אומרים על הנסים', end: 'ועשית עמהם נס ופלא', when: 'chanukah|purim' }),
  sec('modim-end', 'amidah', '', WSA('Thanksgiving'), { start: 'ועל כלם יתברך', continues: true }),
  sec('birkat-kohanim', 'birkat-kohanim', 'ברכת כהנים', WSA('Birkat Kohanim'), { role: 'repetition' }),
  sec('sim-shalom', 'amidah', 'שים שלום', WSA('Peace')),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', WSA('Concluding Passage')),
];

// ── Weekday Mincha Amidah (the template) ────────────────────────────────────────────────────────────────────────
const minchaAmidah = [
  sec('avot', 'amidah', 'ברכת אבות', MA('Patriarchs')),
  sec('gevurot', 'amidah', 'גבורות', MA('Divine Might')),
  sec('kedusha', 'kedusha', 'קדושה', MA('Keduasha'), { role: 'repetition' }),
  sec('kedushat-hashem', 'amidah', 'קדושת השם', MA('Holiness of God')),
  sec('daat', 'amidah', 'חונן הדעת', MA('Knowledge')),
  sec('teshuva', 'amidah', 'תשובה', MA('Repentance')),
  sec('selicha', 'amidah', 'סליחה', MA('Forgiveness')),
  sec('geula', 'amidah', 'גאולה', MA('Redemption'), { end: 'גואל ישראל' }),
  sec('aneinu-chazzan', 'amidah', 'עננו', MA('Redemption'), { start: 'אומר כאן הש"ץ עננו', role: 'repetition', when: 'fast' }),
  sec('refua', 'amidah', 'רפואה', MA('Healing')),
  sec('birkat-hashanim', 'amidah', 'ברכת השנים', MA('Prosperity')),
  sec('kibbutz-galuyot', 'amidah', 'קיבוץ גלויות', MA('Gathering the Exiles')),
  sec('mishpat', 'amidah', 'השבת המשפט', MA('Justice')),
  sec('minim', 'amidah', 'ברכת המינים', MA('Against Enemies')),
  sec('tzadikim', 'amidah', 'על הצדיקים', MA('The Righteous')),
  sec('yerushalayim', 'amidah', 'בונה ירושלים', MA('Rebuilding Jerusalem'), { end: 'בתוכה כאשר דברת' }),
  sec('nachem', 'amidah', 'נחם', MA('Rebuilding Jerusalem'), { start: 'במנחת תשעה באב', end: 'מנחם ציון ובונה ירושלים', when: 'tishaBav' }),
  sec('yerushalayim-end', 'amidah', '', MA('Rebuilding Jerusalem'), { start: 'ברוך אתה יהוה בונה ירושלים', when: '!tishaBav', continues: true }),
  sec('malchut-david', 'amidah', 'מלכות בית דוד', MA('Kingdom of David')),
  sec('shomea-tefila', 'amidah', 'שומע תפילה', MA('Response to Prayer'), { end: 'ריקם אל תשיבנו' }),
  sec('aneinu', 'amidah', 'עננו', MA('Response to Prayer'), { start: 'בתענית ציבור אומרים כאן עננו', end: 'העונה בעת צרה', when: 'fast' }),
  sec('shomea-tefila-end', 'amidah', '', MA('Response to Prayer'), { start: 'כי אתה שומע תפלת', continues: true }),
  sec('retze', 'amidah', 'רצה', MA('Temple Service'), { end: 'עבודת ישראל עמך' }),
  sec('yaale-veyavo', 'amidah', 'יעלה ויבוא', MA('Temple Service'), { start: 'בראש חדש ובחול המועד', end: 'שכח ולא אמר יעלה ויבא', when: MUSAF_TODAY }),
  sec('retze-end', 'amidah', '', MA('Temple Service'), { start: 'ותחזינה עינינו', continues: true }),
  sec('modim', 'amidah', 'מודים', MA('Thanksgiving'), { end: 'קוינו לך' }),
  sec('modim-derabanan', 'modim-derabanan', 'מודים דרבנן', MA('Thanksgiving'), { start: 'כשיגיע שליח צבור למודים', end: 'ברוך אל ההודאות', role: 'repetition' }),
  sec('al-hanisim', 'amidah', 'על הנסים', MA('Thanksgiving'), { start: 'בחנוכה ופורים אומרים על הנסים', end: 'ועשית עמהם נס ופלא', when: 'chanukah|purim' }),
  sec('modim-end', 'amidah', '', MA('Thanksgiving'), { start: 'ועל כלם יתברך', continues: true }),
  sec('birkat-kohanim', 'birkat-kohanim', 'ברכת כהנים', MA('Birkat Kohanim'), { role: 'repetition', when: 'fast' }),
  sec('shalom-rav', 'amidah', 'שלום רב', MA('Peace'), { end: 'שלום רב על ישראל', when: '!fast' }),
  sec('sim-shalom', 'amidah', 'שים שלום', MA('Peace'), { start: 'לתענית ציבור: שים שלום', end: 'לתענית ציבור: שים שלום', when: 'fast' }),
  sec('shalom-end', 'amidah', '', MA('Peace'), { start: 'בעשי"ת: בספר חיים', continues: true }),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', MA('Concluding Passage'), { end: 'שיבנה בית המקדש' }),
  // The edition's line "on days without Tachanun the chazzan says half Kaddish" is Shacharit's (where the Torah
  // reading or Ashrei follows); at Mincha the edition itself goes on to Kaddish Titkabal after the Amidah.
  omit('no-tachanun-note', MA('Concluding Passage'), { start: 'בימים שאין אומרים בהם תחנון', why: 'a Shacharit instruction printed at Mincha' }),
];

// ── Weekday Amidah of Maariv ─────────────────────────────────────────────────────────────────────────────────────
const maarivAmidah = [
  sec('avot', 'amidah', 'ברכת אבות', WMA('Patriarchs')),
  sec('gevurot', 'amidah', 'גבורות', WMA('Divine Might')),
  // Maariv has no repetition: the edition's line "בחזרת הש"ץ אומרים כאן קדושה" is copied from Shacharit/Mincha.
  omit('kedusha-note', WMA('Holiness of God'), { end: 'בחזרת הש"ץ אומרים כאן קדושה', why: 'a repetition instruction printed at Maariv, which has no repetition' }),
  sec('kedushat-hashem', 'amidah', 'קדושת השם', WMA('Holiness of God'), { start: 'אתה קדוש ושמך קדוש' }),
  sec('daat', 'amidah', 'חונן הדעת', WMA('Knowledge'), { end: 'ומלמד לאנוש בינה' }),
  sec('ata-chonantanu', 'motzaei-shabbat', 'אתה חוננתנו', WMA('Knowledge'), { start: 'אתה חוננתנו', end: 'אתה חוננתנו', when: 'motzaeiShabbat' }),
  sec('daat-end', 'amidah', '', WMA('Knowledge'), { start: 'חננו מאתך', continues: true }),
  sec('teshuva', 'amidah', 'תשובה', WMA('Repentance')),
  sec('selicha', 'amidah', 'סליחה', WMA('Forgiveness')),
  sec('geula', 'amidah', 'גאולה', WMA('Redemption')),
  sec('refua', 'amidah', 'רפואה', WMA('Healing')),
  sec('birkat-hashanim', 'amidah', 'ברכת השנים', WMA('Prosperity')),
  sec('kibbutz-galuyot', 'amidah', 'קיבוץ גלויות', WMA('Gathering the Exiles')),
  sec('mishpat', 'amidah', 'השבת המשפט', WMA('Justice')),
  sec('minim', 'amidah', 'ברכת המינים', WMA('Against Enemies')),
  sec('tzadikim', 'amidah', 'על הצדיקים', WMA('The Righteous')),
  sec('yerushalayim', 'amidah', 'בונה ירושלים', WMA('Rebuilding Jerusalem')),
  sec('malchut-david', 'amidah', 'מלכות בית דוד', WMA('Kingdom of David')),
  sec('shomea-tefila', 'amidah', 'שומע תפילה', WMA('Response to Prayer')),
  sec('retze', 'amidah', 'רצה', WMA('Temple Service'), { end: 'עבודת ישראל עמך' }),
  sec('yaale-veyavo', 'amidah', 'יעלה ויבוא', WMA('Temple Service'), { start: 'בראש חדש ובחול המועד', end: 'כי אליך עינינו', when: MUSAF_TODAY }),
  sec('retze-end', 'amidah', '', WMA('Temple Service'), { start: 'ותחזינה עינינו', continues: true }),
  sec('modim', 'amidah', 'מודים', WMA('Thanksgiving'), { end: 'קוינו לך' }),
  sec('al-hanisim', 'amidah', 'על הנסים', WMA('Thanksgiving'), { start: 'בחנוכה ופורים אומרים על הנסים', end: 'ועשית עמהם נס ופלא', when: 'chanukah|purim' }),
  sec('modim-end', 'amidah', '', WMA('Thanksgiving'), { start: 'ועל כלם יתברך', continues: true }),
  sec('shalom-rav', 'amidah', 'שלום רב', WMA('Peace')),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', WMA('Concluding Passage')),
];

// ── Musaf of Rosh Chodesh (weekday) ──────────────────────────────────────────────────────────────────────────────
const roshChodeshMusafAmidah = [
  sec('avot', 'musaf', 'ברכת אבות', RCM('Avot')),
  ...gevurotWithSeasons('musaf', RCM('Gevurot'), ['summer', 'winter'], false),
  sec('kedusha', 'kedusha', 'קדושה', RCM('Kedushah, Kedushat HaShem'), { end: 'האל בעשי"ת המלך הקדוש', role: 'repetition' }),
  sec('kedushat-hashem', 'musaf', 'קדושת השם', RCM('Kedushah, Kedushat HaShem'), { start: 'אתה קדוש ושמך קדוש' }),
  sec('kedushat-hayom', 'musaf', 'ראשי חדשים', RCM('Sanctity of the Day')),
  sec('retze', 'musaf', 'רצה', RCM('Avodah')),
  sec('modim', 'musaf', 'מודים', RCM('Hodayah'), { end: 'מעולם קוינו לך' }),
  sec('modim-derabanan', 'modim-derabanan', 'מודים דרבנן', RCM('Hodayah'), { start: 'מודים דרבנן', end: 'ברוך אל ההודאות', role: 'repetition' }),
  sec('al-hanisim', 'musaf', 'על הנסים', RCM('Hodayah'), { start: 'בחנוכה אומרים זה', end: 'להודות ולהלל לשמך הגדול', when: 'chanukah' }),
  sec('modim-end', 'musaf', '', RCM('Hodayah'), { start: 'ועל כלם יתברך', continues: true }),
  sec('birkat-kohanim', 'birkat-kohanim', 'ברכת כהנים', RCM('Birkat Kohanim'), { end: 'והש"ץ ממשיך', role: 'repetition' }),
  sec('nesiat-kapayim', 'birkat-kohanim', 'נשיאת כפיים', RCM('Birkat Kohanim'), { start: 'אם עלו כהנים לדוכן', role: 'repetition', when: 'israel' }),
  sec('sim-shalom', 'musaf', 'שים שלום', RCM('Peace')),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', RCM('Passages Ending Amidah')),
];

// ── Musaf of the Three Festivals (Yom Tov and Chol HaMoed) ───────────────────────────────────────────────────────
// The edition prints the whole year in one Musaf: the Kedusha of Yom Tov (נעריצך) and of Chol HaMoed (נקדש), and the
// offerings of every day. The festival lines are cut by festival; the days of Chol HaMoed Sukkot and the first/last
// days of Pesach have no condition key yet (see conditionsPending).
const NAARITZCHA = '!cholHamoed|shabbat|hoshanaRabbah';
const festivalMusafAmidah = [
  sec('avot', 'musaf', 'ברכת אבות', FM('Avot')),
  ...gevurotWithSeasons('musaf', FM('Gevurot'), ['winter', 'summer'], false),
  sec('kedusha', 'kedusha', 'קדושה', FM('Kedusha'), { end: 'אני ה\' אלהיכם', role: 'repetition', when: NAARITZCHA }),
  omit('kedusha-dup', FM('Kedusha'), { start: 'אני ה\' אלהיכם', end: 'אני ה\' אלהיכם', why: 'the congregation\'s "אני ה\' אלהיכם" printed a second time in the edition (a duplicate line)' }),
  sec('kedusha-chm', 'kedusha', 'קדושה לחול המועד', FM('Kedusha'), { start: 'לחוה"מ', end: 'אלהיך ציון לדור ודור', role: 'repetition', when: 'cholHamoed&!shabbat&!hoshanaRabbah' }),
  sec('adir-adirenu', 'kedusha', '', FM('Kedusha'), { start: 'בשבת חול המועד מדלגים', end: 'אדיר אדירנו', role: 'repetition', when: '!cholHamoed|hoshanaRabbah', continues: true }),
  sec('kedusha-yimloch', 'kedusha', '', FM('Kedusha'), { start: 'ובדברי קדשך', end: 'אלהיך ציון לדר ודר', role: 'repetition', when: NAARITZCHA, continues: true }),
  sec('kedusha-end', 'kedusha', '', FM('Kedusha'), { start: 'לדור ודור נגיד', role: 'repetition', continues: true }),
  sec('kedushat-hashem', 'musaf', 'קדושת השם', FM('Sanctity of the Name')),
  sec('ata-vechartanu', 'musaf', 'אתה בחרתנו', FM('Sanctity of the Day'), { end: 'חגים וזמנים לששון את יום' }),
  sec('day-shabbat', 'musaf', '', FM('Sanctity of the Day'), { start: 'לשבת - השבת הזה ואת יום', when: 'shabbat', continues: true }),
  sec('day-pesach', 'musaf', '', FM('Sanctity of the Day'), { start: 'לפסח - חג המצות הזה זמן', when: 'pesach', continues: true }),
  sec('day-shavuot', 'musaf', '', FM('Sanctity of the Day'), { start: 'לשבועות - חג השבועות הזה זמן', when: 'shavuot', continues: true }),
  sec('day-sukkot', 'musaf', '', FM('Sanctity of the Day'), { start: 'סוכות - חג הסכות הזה זמן', when: 'sukkot', continues: true }),
  sec('day-shemini', 'musaf', '', FM('Sanctity of the Day'), { start: 'לשמ"ע ולש"ת - השמיני חג העצרת הזה זמן', when: 'sheminiAtzeret', continues: true }),
  sec('mikra-kodesh', 'musaf', '', FM('Sanctity of the Day'), { start: 'לשבת באהבה מקרא קדש', end: 'לשבת באהבה מקרא קדש', continues: true }),
  sec('mipnei-chataeinu', 'musaf', 'ומפני חטאינו', FM('Sanctity of the Day'), { start: 'ומפני חטאינו', end: 'ואת מוסף לשבת ואת מוספי' }),
  sec('musaf-pesach', 'musaf', '', FM('Sanctity of the Day'), { start: 'לפסח - חג המצות הזה:', when: 'pesach', continues: true }),
  sec('musaf-shavuot', 'musaf', '', FM('Sanctity of the Day'), { start: 'לשבועות - חג השבועות הזה:', when: 'shavuot', continues: true }),
  sec('musaf-sukkot', 'musaf', '', FM('Sanctity of the Day'), { start: 'סוכות - חג הסכות הזה:', when: 'sukkot', continues: true }),
  sec('musaf-shemini', 'musaf', '', FM('Sanctity of the Day'), { start: 'לשמ"ע ולש"ת - השמיני חג העצרת הזה:', when: 'sheminiAtzeret', continues: true }),
  sec('naase', 'musaf', '', FM('Sanctity of the Day'), { start: 'נעשה ונקריב לפניך', continues: true }),
  sec('korban-shabbat', 'musaf', 'וביום השבת', FM('Sanctity of the Day'), { start: 'לשבת וביום השבת', end: 'עלת שבת בשבתו', when: 'shabbat' }),
  sec('korban-pesach', 'musaf', 'ובחדש הראשון', FM('Sanctity of the Day'), { start: 'ליום א\' וב\' דפסח', end: 'ומנחתם', when: 'pesach&yomTov' }),
  sec('korban-shavuot', 'musaf', 'וביום הבכורים', FM('Sanctity of the Day'), { start: 'לשבועות:', end: 'ומנחתם', when: 'shavuot' }),
  sec('korban-sukkot', 'musaf', 'ובחמשה עשר יום', FM('Sanctity of the Day'), { start: 'ליום א\' וב\' דסכות', end: 'ומנחתם', when: 'sukkot&yomTov' }),
  sec('uminchatam', 'musaf', 'ומנחתם ונסכיהם', FM('Sanctity of the Day'), { start: 'ומנחתם ונסכיהם כמדבר', end: 'או"א וכו\'' }),
  sec('korban-pesach-late', 'musaf', 'והקרבתם (חול המועד ושביעי של פסח)', FM('Sanctity of the Day'), { start: 'בחול המועד פסח ובשני ימים אחרונים', end: 'ומנחתם', when: 'pesach' }),
  sec('korban-sukkot-chm', 'musaf', 'קרבנות חול המועד סוכות', FM('Sanctity of the Day'), { start: 'בחו"ל אומרים גם ספיקא דיומא', when: 'sukkot&cholHamoed' }),
  sec('korban-hoshana-rabba', 'musaf', 'להושענא רבה', FM('Sanctity of the Day'), { start: 'להושענא רבה', end: 'ומנחתם', when: 'hoshanaRabbah' }),
  sec('korban-shemini', 'musaf', 'ביום השמיני', FM('Sanctity of the Day'), { start: 'לשמיני עצרת ולשמחת תורה', end: 'ומנחתם', when: 'sheminiAtzeret' }),
  sec('yismechu', 'musaf', 'ישמחו במלכותך', FM('Sanctity of the Day'), { start: 'לשבת: ישמחו במלכותך', end: 'לשבת: ישמחו במלכותך', when: 'shabbat' }),
  sec('melech-rachaman', 'musaf', 'אלהינו ואלהי אבותינו מלך רחמן', FM('Sanctity of the Day'), { start: 'מלך רחמן רחם עלינו' }),
  sec('retze', 'musaf', 'רצה', FM('Avodah')),
  sec('modim', 'musaf', 'מודים', FM('Modim'), { end: 'כי מעולם קוינו לך' }),
  sec('modim-derabanan', 'modim-derabanan', 'מודים דרבנן', FM('Modim'), { start: 'מודים דרבנן', end: 'ברוך אל ההודאות', role: 'repetition' }),
  sec('modim-end', 'musaf', '', FM('Modim'), { start: 'ועל כלם יתברך', continues: true }),
  sec('birkat-kohanim', 'birkat-kohanim', 'ברכת כהנים', FM('Birkat Kohanim'), { role: 'repetition' }),
  sec('sim-shalom', 'musaf', 'שים שלום', FM('Peace')),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', FM('Concluding Prayer')),
];

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Weekday Shacharit
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const weekdayShacharit = service('שחרית לימות החול', [
  // Upon waking and the morning blessings (the edition's order, with Netilat Yadayim before Asher Yatzar and the
  // Tallit before the Tefillin, as they are said).
  sec('modeh-ani', 'modeh-ani', 'מודה אני', WSP('Modeh Ani')),
  sec('netilat-yadayim', 'netilat-yadayim', 'על נטילת ידים', WSP('Netilat Yadayim')),
  sec('asher-yatzar', 'morning-blessings', 'אשר יצר', WSP('Asher Yatzar')),
  sec('elokai-neshama', 'morning-blessings', 'אלהי נשמה', WSP('Elokai Neshama')),
  sec('tzitzit', 'tallit', 'ברכת הציצית', WSP('Tzitzit')),
  sec('torah-blessings', 'torah-blessings', 'ברכות התורה', WSP('Torah Blessings')),
  sec('torah-study', 'torah-blessings', 'יברכך · אלו דברים', WSP('Torah Study')),
  sec('tallit', 'tallit', 'עטיפת טלית', WSP('Tallit')),
  sec('tefillin', 'tefillin', 'הנחת תפילין', WSP('Tefillin')),
  sec('ma-tovu', 'morning-prayers', 'מה טובו', WSP('Ma Tovu')),
  sec('adon-olam', 'morning-prayers', 'אדון עולם', WSP('Adon Olam')),
  sec('yigdal', 'morning-prayers', 'יגדל', WSP('Yigdal')),
  sec('morning-blessings', 'morning-blessings', 'ברכות השחר', WSP('Morning Blessings')),
  sec('akedah', 'morning-prayers', 'פרשת העקדה', WSP('Akedah')),
  sec('leolam', 'morning-prayers', 'לעולם יהא אדם', WSP('Sovereignty of Heaven')),
  // Korbanot.
  sec('kiyor', 'korbanot', 'פרשת הכיור', WSK('Kiyor')),
  sec('terumat-hadeshen', 'korbanot', 'פרשת תרומת הדשן', WSK('Terumat HaDeshen')),
  sec('tamid', 'korbanot', 'פרשת התמיד', WSK('Korban HaTamid')),
  sec('ketoret', 'ketoret', 'פטום הקטורת', WSK('Ketoret')),
  sec('abaye', 'korbanot', 'אביי הוה מסדר', WSK('Order of the Temple Service'), { end: 'אביי הוה מסדר' }),
  sec('ana-bekoach', 'korbanot', 'אנא בכח', WSK('Order of the Temple Service'), { start: 'אנא בכח' }),
  sec('ribon-haolamim', 'korbanot', 'רבון העולמים', WSK('Order of the Temple Service'), { start: 'רבון העולמים' }),
  sec('musaf-rosh-chodesh', 'korbanot', 'ובראשי חדשיכם', WSK('Order of the Temple Service'), { start: 'בראש חודש מוסיפים', when: 'roshChodesh' }),
  sec('eizehu-mekoman', 'korbanot', 'איזהו מקומן', WSK('Laws of Sacrifices')),
  sec('rabbi-yishmael', 'korbanot', 'ברייתא דרבי ישמעאל', WSK('Baraita of Rabbi Yishmael')),
  sec('kaddish-derabanan', 'kaddish-derabanan', 'קדיש דרבנן', WSK('Kaddish DeRabbanan'), { role: 'minyan' }),
  // Pesukei DeZimra.
  sec('mizmor-shir', 'mizmor-shir', 'מזמור שיר חנוכת הבית', WSD('Introductory Psalm')),
  sec('kaddish-yatom-1', 'kaddish-yatom', 'קדיש יתום', WSD("Mourner's Kaddish"), { role: 'mourners' }),
  sec('baruch-sheamar', 'baruch-sheamar', 'ברוך שאמר', WSD("Barukh She'amar")),
  sec('hodu', 'hodu', 'הודו', WSD('Hodu')),
  sec('mizmor-letoda', 'pesukei-dezimra', 'מזמור לתודה', WSD('Mizmor Letoda'), { when: '!cholHamoed|!pesach' }),
  sec('yehi-chevod', 'pesukei-dezimra', 'יהי כבוד', WSD('Yehi Chevod')),
  sec('ashrei-pd', 'pesukei-dezimra', 'אשרי', WSD('Ashrei')),
  sec('ps146', 'pesukei-dezimra', 'הללי נפשי', WSD('Psalm 146')),
  sec('ps147', 'pesukei-dezimra', 'כי טוב זמרה', WSD('Psalm 147')),
  sec('ps148', 'pesukei-dezimra', 'הללו את ה׳ מן השמים', WSD('Psalm 148')),
  sec('ps149', 'pesukei-dezimra', 'שירו לה׳ שיר חדש', WSD('Psalm 149')),
  sec('ps150', 'pesukei-dezimra', 'הללו אל בקדשו', WSD('Psalm 150')),
  sec('baruch-hashem-leolam', 'pesukei-dezimra', 'ברוך ה׳ לעולם', WSD('Closing Verses')),
  sec('vayevarech-david', 'pesukei-dezimra', 'ויברך דוד', WSD('Vayevarech David')),
  sec('ata-hu', 'pesukei-dezimra', 'אתה הוא ה׳ לבדך', WSD('Ata Hu')),
  sec('az-yashir', 'az-yashir', 'שירת הים', WSD('Az Yashir')),
  sec('yishtabach', 'yishtabach', 'ישתבח', WSD('Yishtabach')),
  sec('mimaamakim', 'pesukei-dezimra', 'שיר המעלות ממעמקים', WSD('Psalm 130'), { when: 'aseret' }),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', WSD('Half Kaddish'), { role: 'minyan' }),
  // The Shema and its blessings.
  sec('barchu', 'barchu', 'ברכו', WSB('Barchu'), { role: 'minyan' }),
  sec('yotzer-or', 'shema-blessings', 'יוצר אור', WSB('First Blessing before Shema')),
  sec('ahava-raba', 'shema-blessings', 'אהבה רבה', WSB('Second Blessing before Shema')),
  sec('shema', 'shema', 'קריאת שמע', WSB('Shema')),
  sec('emet-veyatziv', 'after-shema', 'אמת ויציב', WSB('Blessing after Shema')),
  // The Amidah.
  ...shacharitAmidah,
  // Hallel on Rosh Chodesh, Chanukah and Chol HaMoed; on Rosh Chodesh and Chol HaMoed Kaddish Titkabal follows it
  // (Musaf is still to come); on Chanukah the half Kaddish below follows it.
  ...within('hallel', 'hallel', hallelSections),
  sec('kaddish-after-hallel', 'kaddish-titkabal', 'קדיש תתקבל', WSC('Kaddish Shalem'), { role: 'minyan', when: MUSAF_TODAY, rewind: true }),
  // Tachanun.
  sec('avinu-malkeinu', 'avinu-malkeinu', 'אבינו מלכנו', WST('Avinu Malkenu'), { when: 'avinuMalkeinu' }),
  sec('vidui', 'vidui', 'וידוי ושלוש עשרה מידות', WST('Vidui and 13 Middot'), { role: 'optional', when: 'tachanun' }),
  sec('vehu-rachum', 'tachanun', 'והוא רחום', WST('Tachanun, For Monday and Thursday'), { when: 'mondayThursday&tachanun' }),
  sec('nefilat-apayim', 'tachanun', 'תחנון · נפילת אפיים', WST('Tachanun, Nefilat Apayim'), { when: 'tachanun' }),
  sec('elokei-yisrael', 'tachanun', 'ה׳ אלהי ישראל', WST('Tachanun, God of Israel'), { when: 'mondayThursday&tachanun' }),
  sec('shomer-yisrael', 'tachanun', 'שומר ישראל', WST('Tachanun, Shomer Yisrael'), { when: 'tachanun' }),
  sec('half-kaddish-2', 'half-kaddish', 'חצי קדיש', WST('Tachanun, Half Kaddish'), { role: 'minyan', when: NO_MUSAF_TODAY }),
  // The Torah reading (Monday, Thursday, Rosh Chodesh, fasts, Chanukah, Purim, Chol HaMoed).
  sec('el-erech-apayim', 'torah-service', 'אל ארך אפים', WSR('Removing the Torah from Ark, El Erech Appayim'), { when: 'torahReading&tachanun' }),
  sec('vayehi-binsoa', 'torah-service', 'ויהי בנסוע', WSR('Removing the Torah from Ark, Vayehi Binsoa'), { when: 'torahReading' }),
  sec('berich-shmei', 'torah-service', 'בריך שמיה', WSR('Removing the Torah from Ark, Berich Shmei'), { when: 'torahReading' }),
  sec('gadlu', 'torah-service', 'גדלו · לך ה׳', WSR('Removing the Torah from Ark, Lekha Hashem'), { when: 'torahReading' }),
  sec('av-harachamim', 'torah-service', 'אב הרחמים', WSR('Removing the Torah from Ark, Av Harachamim'), { when: 'torahReading' }),
  sec('vetigaleh', 'torah-service', 'ותגלה ותראה', WSR('Removing the Torah from Ark, Vetigaleh Veteraeh'), { when: 'torahReading' }),
  sec('torah-reading', 'torah-reading', 'ברכות העולה לתורה', WSR('Reading from Sefer, Birkat HaTorah'), { role: 'minyan', when: 'torahReading' }),
  sec('gomel', 'torah-reading', 'ברכת הגומל', WSR('Reading from Sefer, Birkat Hagomel'), { role: 'optional', when: 'torahReading' }),
  sec('half-kaddish-torah', 'half-kaddish', 'חצי קדיש', WSR('Reading from Sefer, Half Kaddish'), { role: 'minyan', when: 'torahReading' }),
  sec('hagbaha', 'torah-reading', 'הגבהה · וזאת התורה', WSR('Reading from Sefer, Raising the Torah'), { end: 'יגדיל תורה ויאדיר', when: 'torahReading' }),
  sec('yehi-ratzon', 'torah-reading', 'יהי רצון · אחינו', WSR('Reading from Sefer, Raising the Torah'), { start: 'בשני וחמישי כשאומרים תחנון', when: 'mondayThursday&tachanun' }),
  sec('yehalelu', 'return-torah', 'יהללו', WSR('Returning Sefer to Aron, Yehalelu'), { when: 'torahReading' }),
  sec('ledavid-mizmor', 'return-torah', 'לדוד מזמור', WSR('Returning Sefer to Aron, LeDavid Mizmor'), { when: 'torahReading' }),
  sec('uvenucho', 'return-torah', 'ובנחה יאמר', WSR('Returning Sefer to Aron, Uvenucho Yomar'), { when: 'torahReading' }),
  // Ashrei, Lamenatze'ach, Uva LeTzion.
  sec('ashrei', 'ashrei', 'אשרי', WSC('Ashrei')),
  sec('lamenatzeach', 'lamenatzeach', 'למנצח', WSC("Lamenatze'ach"), { when: LAMENATZEACH }),
  sec('uva-letzion', 'uva-letzion', 'ובא לציון', WSC('Uva Letzion')),
  // On Rosh Chodesh (and Chol HaMoed) half Kaddish and Musaf follow; Kaddish Titkabal then comes after Musaf.
  sec('half-kaddish-musaf', 'half-kaddish', 'חצי קדיש', A('Kaddish, Half Kaddish'), { role: 'minyan', when: MUSAF_TODAY }),
  ...within('roshChodesh', 'rc-musaf', roshChodeshMusafAmidah),
  ...within('cholHamoed', 'chm-musaf', festivalMusafAmidah),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', WSC('Kaddish Shalem'), { role: 'minyan', rewind: true }),
  // Concluding prayers.
  sec('aleinu', 'aleinu', 'עלינו לשבח', WSC('Alenu')),
  sec('kaddish-yatom', 'kaddish-yatom', 'קדיש יתום', WSC("Mourner's Kaddish"), { role: 'mourners' }),
  sec('song-of-day', 'song-of-day', 'שיר של יום', WSC('Song of the Day'), { end: 'נהגו לומר בכל ימי השבוע' }),
  sec('song-day0', 'song-of-day', 'שיר של יום · יום ראשון', WSC('Song of the Day'), { start: 'בראשון בשבת', end: 'הוא מלך הכבוד סלה', when: 'day0' }),
  sec('song-day1', 'song-of-day', 'שיר של יום · יום שני', WSC('Song of the Day'), { start: 'בשני בשבת', end: 'שיר מזמור לבני קרח', when: 'day1' }),
  sec('song-day2', 'song-of-day', 'שיר של יום · יום שלישי', WSC('Song of the Day'), { start: 'בשלישי בשבת', end: 'מזמור לאסף', when: 'day2' }),
  sec('song-day3', 'song-of-day', 'שיר של יום · יום רביעי', WSC('Song of the Day'), { start: 'ברביעי בשבת', end: 'אל נקמות', when: 'day3' }),
  sec('song-day4', 'song-of-day', 'שיר של יום · יום חמישי', WSC('Song of the Day'), { start: 'בחמישי בשבת', end: 'למנצח על הגתית', when: 'day4' }),
  sec('song-day5', 'song-of-day', 'שיר של יום · יום שישי', WSC('Song of the Day'), { start: 'בשישי בשבת', when: 'day5' }),
  sec('barchi-nafshi', 'barchi-nafshi', 'ברכי נפשי', WSC('Barchi Nafshi'), { when: 'roshChodesh' }),
  sec('kaddish-yatom-2', 'kaddish-yatom', 'קדיש יתום', WSC("Mourner's Kaddish"), { role: 'mourners', rewind: true }),
  sec('ledavid', 'ledavid-ori', 'לדוד ה׳ אורי', WSC('LeDavid'), { end: 'קוה אל יהוה חזק', when: 'ledavid' }),
  sec('kaddish-yatom-ledavid', 'kaddish-yatom', 'קדיש יתום', WSC('LeDavid'), { start: 'יתגדל ויתקדש', role: 'mourners', when: 'ledavid' }),
  // The custom of the Land of Israel: Ein Keloheinu, Pitum HaKetoret and Kaddish DeRabbanan every day, and Barchu
  // for those who came late.
  sec('kaveh', 'kaveh', 'קוה אל ה׳', WSC('Korbanot (Israel), Ein Kelohenu'), { end: 'קוה אל יהוה חזק', when: 'israel' }),
  sec('ein-keloheinu', 'ein-keloheinu', 'אין כאלהינו', WSC('Korbanot (Israel), Ein Kelohenu'), { start: 'אין כאלהינו', when: 'israel' }),
  sec('pitum-haketoret', 'ketoret', 'פטום הקטורת', WSC('Korbanot (Israel), Pitum HaKetoret'), { when: 'israel' }),
  sec('kaddish-derabanan-2', 'kaddish-derabanan', 'קדיש דרבנן', WSC("Korbanot (Israel), Mourner's Kaddish"), { role: 'minyan', when: 'israel' }),
  sec('barchu-end', 'barchu', 'ברכו', WSC('Korbanot (Israel), Barchu'), { role: 'minyan', when: 'israel' }),
  // After the prayer.
  sec('six-remembrances', 'closing-passages', 'שש זכירות', WS('Post Service, Six Remembrances'), { role: 'optional' }),
  sec('thirteen-principles', 'closing-passages', 'שלושה עשר עיקרים', WS('Post Service, Thirteen Principles'), { role: 'optional' }),
], {
  reviewed: true,
  conditionsPending: [
    'מזמור לתודה: not said on Erev Pesach and Erev Yom Kippur — no condition key',
    'למנצח: also left out on Erev Pesach and Erev Yom Kippur — no condition key',
    'מוסף לחול המועד: the offerings of each day of Chol HaMoed Sukkot, and the first/last days of Pesach — no day keys',
    HALLEL_ENGINE_PENDING,
  ],
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Weekday Mincha (the template)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const weekdayMincha = service('מנחה לימות החול', [
  sec('ashrei', 'ashrei', 'אשרי', MINCHA('Ashrei'), { end: 'אשרי יושבי ביתך' }),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', MINCHA('Ashrei'), { start: 'ואומר החזן חצי קדיש', role: 'minyan' }),
  ...minchaAmidah,
  sec('avinu-malkeinu', 'avinu-malkeinu', 'אבינו מלכנו', MINCHA('Post Amidah, Avinu Malkenu'), { when: 'avinuMalkeinu' }),
  sec('nefilat-apayim', 'tachanun', 'תחנון · נפילת אפיים', MINCHA('Post Amidah, Tachanun, Nefilat Appayim'), { when: 'tachanun' }),
  sec('shomer-yisrael', 'tachanun', 'שומר ישראל', MINCHA('Post Amidah, Tachanun, Shomer Yisrael'), { when: 'tachanun' }),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', MINCHA('Post Amidah, Kaddish Shalem'), { role: 'minyan' }),
  sec('aleinu', 'aleinu', 'עלינו לשבח', MINCHA('Concluding Prayers, Alenu')),
  sec('kaddish-yatom', 'kaddish-yatom', 'קדיש יתום', MINCHA("Concluding Prayers, Mourner's Kaddish"), { role: 'mourners' }),
], { reviewed: true });

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Weekday Maariv (with the additions of Motzaei Shabbat and the Omer)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const weekdayMaariv = service('ערבית לימות החול', [
  sec('vehu-rachum', 'vehu-rachum', 'והוא רחום', WM('Vehu Rachum')),
  sec('barchu', 'barchu', 'ברכו', WM('Barchu'), { role: 'minyan' }),
  sec('maariv-aravim', 'shema-blessings', 'המעריב ערבים', WMB('First Blessing before Shema')),
  sec('ahavat-olam', 'shema-blessings', 'אהבת עולם', WMB('Second Blessing before Shema')),
  sec('shema', 'shema', 'קריאת שמע', WMB('Shema')),
  sec('emet-veemuna', 'after-shema', 'אמת ואמונה', WMB('First Blessing after Shema')),
  sec('hashkiveinu', 'hashkiveinu', 'השכיבנו', WMB('Second Blessing after Shema')),
  // Not said in the Land of Israel.
  sec('baruch-hashem-leolam', 'shema-blessings', 'ברוך ה׳ לעולם', WMB('Third Blessing after Shema'), { when: 'diaspora' }),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', WMB('Half Kaddish'), { role: 'minyan' }),
  ...maarivAmidah,
  // A weekday night: Kaddish Titkabal. Motzaei Shabbat: half Kaddish, (the Omer), ויהי נועם and ואתה קדוש, then
  // Kaddish Titkabal — as the edition's own caption says.
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', WM('Kaddish Shalem'), { role: 'minyan', when: '!motzaeiShabbat' }),
  sec('half-kaddish-ms', 'half-kaddish', 'חצי קדיש', WM('Kaddish Shalem'), { end: 'לעלא מן כל', role: 'minyan', when: 'motzaeiShabbat', rewind: true }),
  sec('omer-ms', 'omer', 'ספירת העומר', WM('Sefirat HaOmer'), { when: 'omer&motzaeiShabbat' }),
  sec('vihi-noam', 'motzaei-shabbat', 'ויהי נועם', WM("Additions for Motza'ei Shabbat, Viyehi Noam"), { end: 'ואראהו בישועתי', when: 'motzaeiShabbat' }),
  sec('veata-kadosh', 'motzaei-shabbat', 'ואתה קדוש', WM("Additions for Motza'ei Shabbat, Viyehi Noam"), { start: 'ואתה קדוש יושב', when: 'motzaeiShabbat' }),
  sec('kaddish-titkabal-ms', 'kaddish-titkabal', 'קדיש תתקבל', WM('Kaddish Shalem'), { start: 'יתגדל ויתקדש', role: 'minyan', when: 'motzaeiShabbat', rewind: true }),
  sec('omer', 'omer', 'ספירת העומר', WM('Sefirat HaOmer'), { when: 'omer&!motzaeiShabbat', rewind: true }),
  sec('aleinu', 'aleinu', 'עלינו לשבח', WM('Alenu')),
  sec('kaddish-yatom', 'kaddish-yatom', 'קדיש יתום', WM("Mourner's Kaddish"), { role: 'mourners' }),
  sec('ledavid', 'ledavid-ori', 'לדוד ה׳ אורי', WM('LeDavid'), { end: 'קוה אל יהוה חזק', when: 'ledavid' }),
  sec('kaddish-yatom-ledavid', 'kaddish-yatom', 'קדיש יתום', WM('LeDavid'), { start: 'יתגדל ויתקדש', role: 'mourners', when: 'ledavid' }),
], {
  reviewed: true,
  conditionsPending: [
    'ויהי נועם: not said when a Yom Tov falls in the coming week — no condition key',
    'Motzaei Yom Tov (אתה חוננתנו): the motzaeiShabbat key covers Saturday night only',
  ],
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Bedtime Shema
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const KSM = WM("Keri'at Shema al Hamita");
const bedtimeShema = service('קריאת שמע על המיטה', [
  sec('ribono', 'bedtime-shema', 'רבונו של עולם הריני מוחל', KSM, { end: 'הריני מוחל' }),
  sec('hamapil', 'bedtime-shema', 'המפיל', KSM, { start: 'המפיל חבלי שנה' }),
  sec('shema', 'bedtime-shema', 'קריאת שמע', KSM, { start: 'אל מלך נאמן' }),
  sec('vihi-noam', 'bedtime-shema', 'ויהי נועם · יושב בסתר', KSM, { start: 'ויהי נעם' }),
  sec('ma-rabu', 'bedtime-shema', 'ה׳ מה רבו צרי', KSM, { start: 'מה רבו צרי' }),
  sec('hashkiveinu', 'bedtime-shema', 'השכיבנו', KSM, { start: 'השכיבנו' }),
  sec('baruch-bayom', 'bedtime-shema', 'ברוך ה׳ ביום', KSM, { start: 'ביום ברוך' }),
  sec('hamalach', 'bedtime-shema', 'המלאך הגואל', KSM, { start: 'המלאך הגאל' }),
  sec('adon-olam', 'bedtime-shema', 'אדון עולם', KSM, { start: 'אדון עולם' }),
], { reviewed: true });

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Kabbalat Shabbat
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// When Yom Tov or Chol HaMoed falls on Shabbat the edition begins at מזמור לדוד (its note on Psalm 95).
const SIX_PSALMS = '!yomTov&!cholHamoed';
const kabbalatShabbat = service('קבלת שבת', [
  sec('yedid-nefesh', 'kabbalat-shabbat', 'ידיד נפש', KS('Yedid Nefesh'), { role: 'optional' }),
  // The edition's note ("ביום טוב שחל בשבת ... מתחילים מזמור לדוד") stands in a section of its own: the day engine
  // reads a caption that opens with "ביום טוב" as "said on Yom Tov" and would hide the psalm after it.
  sec('kabbalat-shabbat-note', 'kabbalat-shabbat', 'קבלת שבת', KS('Psalm 95'), { end: 'ביום טוב שחל בשבת' }),
  sec('lechu-neranena', 'kabbalat-shabbat', 'לכו נרננה', KS('Psalm 95'), { start: 'לכו נרננה', when: SIX_PSALMS }),
  sec('shiru', 'kabbalat-shabbat', 'שירו לה׳ שיר חדש', KS('Psalm 96'), { when: SIX_PSALMS }),
  sec('tagel-haaretz', 'kabbalat-shabbat', 'ה׳ מלך תגל הארץ', KS('Psalm 97'), { when: SIX_PSALMS }),
  sec('mizmor-shiru', 'kabbalat-shabbat', 'מזמור שירו לה׳', KS('Psalm 98'), { when: SIX_PSALMS }),
  sec('yirgezu', 'kabbalat-shabbat', 'ה׳ מלך ירגזו עמים', KS('Psalm 99'), { when: SIX_PSALMS }),
  sec('mizmor-ledavid', 'kabbalat-shabbat', 'מזמור לדוד הבו לה׳', KS('Psalm 29')),
  sec('ana-bekoach', 'kabbalat-shabbat', 'אנא בכח', KS('Ana Bekoach')),
  sec('lecha-dodi', 'lecha-dodi', 'לכה דודי', KS('Lekha Dodi')),
  sec('mizmor-shir', 'mizmor-shir-shabbat', 'מזמור שיר ליום השבת', KS('Psalm 92')),
  sec('hashem-malach', 'mizmor-shir-shabbat', 'ה׳ מלך גאות לבש', KS('Psalm 93')),
  sec('kaddish-yatom', 'kaddish-yatom', 'קדיש יתום', KS("Mourner's Kaddish"), { role: 'mourners' }),
], {
  reviewed: true,
  missing: [{ concept: 'bameh-madlikin', why: 'the edition does not print במה מדליקין (its Kaddish DeRabbanan leaf stands alone, so it is left out as well)' }],
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Friday night Maariv
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const shabbatMaariv = service('ערבית לליל שבת', [
  sec('barchu', 'barchu', 'ברכו', SM('Barchu'), { role: 'minyan' }),
  sec('maariv-aravim', 'shema-blessings', 'המעריב ערבים', SM('Blessings of the Shema, First Blessing before Shema')),
  sec('ahavat-olam', 'shema-blessings', 'אהבת עולם', SM('Blessings of the Shema, Second Blessing before Shema')),
  sec('shema', 'shema', 'קריאת שמע', SM('Blessings of the Shema, Shema')),
  sec('emet-veemuna', 'after-shema', 'אמת ואמונה', SM('Blessings of the Shema, First Blessing after Shema')),
  sec('hashkiveinu', 'hashkiveinu', 'השכיבנו', SM('Blessings of the Shema, Second Blessing after Shema')),
  sec('veshamru', 'shema-blessings', 'ושמרו', SM('Veshamru'), { end: 'ושמרו בני ישראל' }),
  sec('vayedaber-moshe', 'shema-blessings', 'וידבר משה', SM('Veshamru'), { start: 'לשלש רגלים', when: 'yomTov' }),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', SM('Half Kaddish'), { role: 'minyan' }),
  sec('avot', 'amidah', 'ברכת אבות', SMA('Patriarchs')),
  sec('gevurot', 'amidah', 'גבורות', SMA('Divine Might')),
  sec('kedushat-hashem', 'amidah', 'קדושת השם', SMA("Holines of God's Name")),
  sec('kedushat-hayom', 'amidah', 'אתה קדשת', SMA('Sanctity of the Day')),
  sec('retze', 'amidah', 'רצה', SMA('Temple Service'), { end: 'עבודת ישראל עמך' }),
  sec('yaale-veyavo', 'amidah', 'יעלה ויבוא', SMA('Temple Service'), { start: 'בראש חדש ובחול המועד', end: 'בראש חדש ובחול המועד', when: MUSAF_TODAY }),
  sec('retze-end', 'amidah', '', SMA('Temple Service'), { start: 'ותחזינה עינינו', continues: true }),
  sec('modim', 'amidah', 'מודים', SMA('Thanksgiving'), { end: 'קוינו לך' }),
  sec('al-hanisim', 'amidah', 'על הנסים', SMA('Thanksgiving'), { start: 'בחנוכה ופורים אומרים כאן', end: 'ועשית עמהם נס ופלא', when: 'chanukah|purim' }),
  sec('modim-end', 'amidah', '', SMA('Thanksgiving'), { start: 'ועל כלם יתברך', continues: true }),
  sec('shalom-rav', 'amidah', 'שלום רב', SMA('Peace')),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', SMA('Concluding Passage')),
  sec('vayechulu', 'vayechulu', 'ויכולו', SM("Vay'chulu")),
  sec('meein-sheva', 'magen-avot', 'ברכה מעין שבע · מגן אבות', SM("Me'ein Sheva"), { role: 'minyan' }),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', SM('Kaddish Shalem'), { role: 'minyan' }),
  sec('omer', 'omer', 'ספירת העומר', SM('Sefirat HaOmer'), { when: 'omer' }),
  sec('aleinu', 'aleinu', 'עלינו לשבח', SM('Aleinu')),
  sec('kaddish-yatom', 'kaddish-yatom', 'קדיש יתום', SM("Mourner's Kaddish"), { role: 'mourners' }),
  sec('ledavid', 'ledavid-ori', 'לדוד ה׳ אורי', SM('LeDavid'), { end: 'קוה אל יהוה חזק', when: 'ledavid' }),
  sec('kaddish-yatom-ledavid', 'kaddish-yatom', 'קדיש יתום', SM('LeDavid'), { start: 'יתגדל ויתקדש', role: 'mourners', when: 'ledavid' }),
  sec('yigdal', 'closing-passages', 'יגדל', SM('Yigdal')),
  sec('adon-olam', 'closing-passages', 'אדון עולם', SM('Adon Olam'), { role: 'optional' }),
], { reviewed: true });

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Friday night at home: Shalom Aleichem, Eshet Chayil, Kiddush, the zemirot
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const Z1 = path => SE(`Zemirot for Shabbat Evening, ${path}`);
const shabbatKiddush = service('קידוש לליל שבת', [
  sec('birkat-habanim', 'kiddush', 'ברכת הבנים', SE('Blessing the Children'), { role: 'optional' }),
  sec('shalom-aleichem', 'shalom-aleichem', 'שלום עליכם', SE('Shalom Aleichem')),
  sec('ribon', 'shalom-aleichem', 'רבון כל העולמים', SE('Ribon Kol HaOlamim'), { role: 'optional' }),
  sec('eshet-chayil', 'eshet-chayil', 'אשת חיל', SE('Eshet Chayil')),
  sec('kiddush', 'kiddush', 'קידוש', SE('Kiddush')),
  sec('kol-mekadesh', 'zemirot', 'כל מקדש שביעי', Z1('Kol Mekadesh'), { role: 'optional' }),
  sec('ma-yedidut', 'zemirot', 'מה ידידות', Z1('Ma Yedidut'), { role: 'optional' }),
  sec('menucha-vesimcha', 'zemirot', 'מנוחה ושמחה', Z1('Menucha VeSimcha'), { role: 'optional' }),
  sec('yom-zeh-leyisrael', 'zemirot', 'יום זה לישראל', Z1("Yom zeh L'yisrael"), { role: 'optional' }),
  sec('yah-ribon', 'zemirot', 'יה רבון', Z1('Yah Ribon'), { role: 'optional' }),
  sec('tzama-nafshi', 'zemirot', 'צמאה נפשי', Z1('Tzamah Nafshi'), { role: 'optional' }),
  sec('tzur-mishelo', 'zemirot', 'צור משלו', Z1('Tzur Mishelo'), { role: 'optional' }),
], { reviewed: true });

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Shabbat Shacharit (with the Torah service)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const shabbatShacharit = service('שחרית של שבת', [
  sec('modeh-ani', 'modeh-ani', 'מודה אני', SSP('Modeh Ani')),
  sec('netilat-yadayim', 'netilat-yadayim', 'על נטילת ידים', SSP('Netilat Yadayim')),
  sec('asher-yatzar', 'morning-blessings', 'אשר יצר', SSP('Asher Yatzar')),
  sec('elokai-neshama', 'morning-blessings', 'אלהי נשמה', SSP('Elokai Neshama')),
  // The Shabbat part of the edition has no Birchot HaTorah: the edition's own weekday leaves are used.
  sec('torah-blessings', 'torah-blessings', 'ברכות התורה', WSP('Torah Blessings')),
  sec('torah-study', 'torah-blessings', 'יברכך · אלו דברים', WSP('Torah Study')),
  sec('tzitzit', 'tallit', 'ברכת הציצית', SSP('Tzitzit')),
  sec('tallit', 'tallit', 'עטיפת טלית', SSP('Tallit')),
  sec('ma-tovu', 'morning-prayers', 'מה טובו', SSP('Ma Tovu')),
  sec('adon-olam', 'morning-prayers', 'אדון עולם', SSP('Adon Olam')),
  sec('yigdal', 'morning-prayers', 'יגדל', SSP('Yigdal')),
  sec('morning-blessings', 'morning-blessings', 'ברכות השחר', SSP('Morning Blessings')),
  sec('akedah', 'morning-prayers', 'פרשת העקדה', SSP('Akedah')),
  sec('leolam', 'morning-prayers', 'לעולם יהא אדם', SSP('Sovereignty of Heaven')),
  sec('kiyor', 'korbanot', 'פרשת הכיור', SSK('Kiyor')),
  sec('terumat-hadeshen', 'korbanot', 'פרשת תרומת הדשן', SSK('Terumat HaDeshen')),
  sec('tamid', 'korbanot', 'פרשת התמיד', SSK('Korban HaTamid')),
  sec('ketoret', 'ketoret', 'פטום הקטורת', SSK('Ketoret'), { end: 'וערבה לה\' מנחת יהודה' }),
  sec('abaye', 'korbanot', 'אביי הוה מסדר', SSK('Ketoret'), { start: 'אביי הוה מסדר' }),
  sec('ana-bekoach', 'korbanot', 'אנא בכח', SSK('Order of the Temple Service'), { end: 'ברוך שם כבוד מלכותו' }),
  sec('ribon-haolamim', 'korbanot', 'רבון העולמים', SSK('Order of the Temple Service'), { start: 'רבון העולמים' }),
  sec('musaf-shabbat', 'korbanot', 'וביום השבת', SSK('Order of the Temple Service'), { start: 'לשבת וביום השבת' }),
  sec('musaf-rosh-chodesh', 'korbanot', 'ובראשי חדשיכם', SSK('Order of the Temple Service'), { start: 'לר"ח ובראשי חדשיכם', when: 'roshChodesh' }),
  sec('eizehu-mekoman', 'korbanot', 'איזהו מקומן', SSK('Laws of Sacrifices')),
  sec('rabbi-yishmael', 'korbanot', 'ברייתא דרבי ישמעאל', SSK('Baraita of Rabbi Yishmael')),
  sec('kaddish-derabanan', 'kaddish-derabanan', 'קדיש דרבנן', SSK('Kaddish DeRabbanan'), { role: 'minyan' }),
  sec('mizmor-shir', 'mizmor-shir', 'מזמור שיר חנוכת הבית', SSD('Mizmor Shir')),
  sec('kaddish-yatom-1', 'kaddish-yatom', 'קדיש יתום', SSD("Mourner's Kaddish"), { role: 'mourners' }),
  sec('baruch-sheamar', 'baruch-sheamar', 'ברוך שאמר', SSD("Barukh She'amar")),
  sec('hodu', 'hodu', 'הודו', SSD('Hodu')),
  sec('ps19', 'pesukei-dezimra', 'השמים מספרים', SSD('Psalm 19')),
  sec('ps34', 'pesukei-dezimra', 'לדוד בשנותו', SSD('Psalm 34')),
  sec('ps90', 'pesukei-dezimra', 'תפלה למשה', SSD('Psalm 90')),
  sec('ps91', 'pesukei-dezimra', 'יושב בסתר', SSD('Psalm 91')),
  sec('ps135', 'pesukei-dezimra', 'הללו את שם ה׳', SSD('Psalm 135')),
  sec('ps136', 'pesukei-dezimra', 'הודו לה׳ כי טוב', SSD('Psalm 136')),
  sec('ps33', 'pesukei-dezimra', 'רננו צדיקים', SSD('Psalm 33')),
  sec('ps92', 'pesukei-dezimra', 'מזמור שיר ליום השבת', SSD('Psalm 92')),
  sec('ps93', 'pesukei-dezimra', 'ה׳ מלך גאות לבש', SSD('Psalm 93')),
  sec('yehi-chevod', 'pesukei-dezimra', 'יהי כבוד', SSD('Yehi Chevod')),
  sec('ashrei-pd', 'pesukei-dezimra', 'אשרי', SSD('Ashrei')),
  sec('ps146', 'pesukei-dezimra', 'הללי נפשי', SSD('Psalm 146')),
  sec('ps147', 'pesukei-dezimra', 'כי טוב זמרה', SSD('Psalm 147')),
  sec('ps148', 'pesukei-dezimra', 'הללו את ה׳ מן השמים', SSD('Psalm 148')),
  sec('ps149', 'pesukei-dezimra', 'שירו לה׳ שיר חדש', SSD('Psalm 149')),
  sec('ps150', 'pesukei-dezimra', 'הללו אל בקדשו', SSD('Psalm 150')),
  sec('baruch-hashem-leolam', 'pesukei-dezimra', 'ברוך ה׳ לעולם', SSD('Baruch Hashem')),
  sec('vayevarech-david', 'pesukei-dezimra', 'ויברך דוד · אתה הוא', SSD('Vayevarech David')),
  sec('az-yashir', 'az-yashir', 'שירת הים', SSD('Shirat HaYam')),
  sec('nishmat', 'pesukei-dezimra', 'נשמת כל חי', SSD('Nishmat Kol Chai')),
  sec('shochen-ad', 'pesukei-dezimra', 'שוכן עד', SSD('Shochen Ad')),
  sec('yishtabach', 'yishtabach', 'ישתבח', SSD('Yishtabach')),
  sec('mimaamakim', 'pesukei-dezimra', 'שיר המעלות ממעמקים', SSD('Psalm 130'), { when: 'shabbatShuva' }),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', SSD('Half Kaddish'), { role: 'minyan' }),
  sec('barchu', 'barchu', 'ברכו', SSB('Barchu'), { role: 'minyan' }),
  sec('hakol-yoducha', 'shema-blessings', 'הכל יודוך · אל אדון', SSB('First Blessing before Shema'), { end: 'לאל אשר שבת' }),
  omit('hameir-laaretz', SSB('First Blessing before Shema'), { start: 'כשחל יו"ט ביום חל אומרים המאיר לארץ', end: 'תתברך ה\' אלהינו בשמים ממעל', why: 'the replacement for a Yom Tov that falls on a weekday (המאיר לארץ), not said on Shabbat' }),
  sec('titbarach', 'shema-blessings', 'תתברך צורנו', SSB('First Blessing before Shema'), { start: 'תתברך צורנו' }),
  sec('ahava-raba', 'shema-blessings', 'אהבה רבה', SSB('Second Blessing before Shema')),
  sec('shema', 'shema', 'קריאת שמע', SSB('Shema')),
  sec('emet-veyatziv', 'after-shema', 'אמת ויציב', SSB('Blessing after Shema')),
  sec('avot', 'amidah', 'ברכת אבות', SSA('Patriarchs')),
  sec('gevurot', 'amidah', 'גבורות', SSA('Divine Might')),
  sec('kedusha', 'kedusha', 'קדושה', SSA('Kedushah'), { end: 'לדור ודור נגיד', role: 'repetition' }),
  sec('kedushat-hashem', 'amidah', 'קדושת השם', SSA('Kedushah'), { start: 'אתה קדוש ושמך קדוש' }),
  sec('yismach-moshe', 'amidah', 'ישמח משה', SSA('Sanctity of the Day')),
  sec('retze', 'amidah', 'רצה', SSA('Temple Service'), { end: 'עבודת ישראל עמך' }),
  sec('yaale-veyavo', 'amidah', 'יעלה ויבוא', SSA('Temple Service'), { start: 'בראש חודש ובחול המועד', end: 'בראש חודש ובחול המועד', when: MUSAF_TODAY }),
  sec('retze-end', 'amidah', '', SSA('Temple Service'), { start: 'ותחזינה עינינו', continues: true }),
  sec('modim', 'amidah', 'מודים', SSA('Thanksgiving'), { end: 'מעולם קוינו לך' }),
  sec('modim-derabanan', 'modim-derabanan', 'מודים דרבנן', SSA('Thanksgiving'), { start: 'מודים דרבנן', role: 'repetition' }),
  sec('al-hanisim', 'amidah', 'על הנסים', SSA('Thanksgiving'), { start: 'בחנוכה ופורים אומרים כאן', end: 'לפורים:', when: 'chanukah|purim' }),
  sec('modim-end', 'amidah', '', SSA('Thanksgiving'), { start: 'ועל כלם יתברך', continues: true }),
  sec('birkat-kohanim', 'birkat-kohanim', 'ברכת כהנים', SSA('Birkat Kohanim'), { role: 'repetition' }),
  sec('sim-shalom', 'amidah', 'שים שלום', SSA('Peace')),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', SSA('Concluding Passage')),
  // Hallel on Shabbat Rosh Chodesh, Chanukah and Chol HaMoed.
  ...within('hallel', 'hallel', hallelSections),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', SSA('Kaddish Shalem'), { role: 'minyan' }),
  // The Torah service.
  sec('ein-kamocha', 'torah-service', 'אין כמוך · אב הרחמים', SSR('Ein Kamocha')),
  sec('vayehi-binsoa', 'torah-service', 'ויהי בנסוע', SSR('Vayehi Binsoa'), { end: 'כשפותחין ארון הקודש' }),
  omit('yom-tov-middot', SSR('Vayehi Binsoa'), { start: 'ביו"ט כשחל בחול', why: 'the Thirteen Attributes and רבונו של עולם said when a Yom Tov falls on a weekday — not on Shabbat' }),
  sec('berich-shmei', 'torah-service', 'בריך שמיה', SSR('Berich Shmei')),
  sec('shema-echad', 'torah-service', 'שמע ישראל · אחד · גדלו', SSR('Shema Yisrael (Gadlu)')),
  sec('lecha-hashem', 'torah-service', 'לך ה׳ הגדלה', SSR('Lecha Hashem')),
  sec('veyaazor', 'torah-service', 'ויעזור', SSR('Veyazor Veyagen')),
  sec('torah-reading', 'torah-reading', 'ברכות העולה לתורה', SSF('Birkat HaTorah'), { role: 'minyan' }),
  sec('mi-sheberach-oleh', 'torah-reading', 'מי שברך לעולה', SSF('Mi Sheberach, For an Oleh'), { role: 'optional' }),
  sec('mi-sheberach-choleh', 'torah-reading', 'מי שברך לחולה', SSF('Mi Sheberach, For Sickness (includes man and woman)'), { role: 'optional' }),
  sec('mi-sheberach-son', 'torah-reading', 'מי שברך ליולדת בן', SSF('Mi Sheberach, For Birth, Birth of a Son'), { role: 'optional' }),
  sec('mi-sheberach-daughter', 'torah-reading', 'מי שברך ליולדת בת', SSF('Mi Sheberach, For Birth, Birth of Daughter'), { role: 'optional' }),
  sec('mi-sheberach-bar-mitzvah', 'torah-reading', 'מי שברך לבר מצוה', SSF('Mi Sheberach, Bar Mitzvah'), { role: 'optional' }),
  sec('gomel', 'torah-reading', 'ברכת הגומל', SSF('Birkat Hagomel'), { role: 'optional' }),
  sec('half-kaddish-torah', 'half-kaddish', 'חצי קדיש', SSF('Half Kaddish'), { role: 'minyan' }),
  sec('hagbaha', 'torah-reading', 'הגבהה · וזאת התורה', SSF('Raising the Torah')),
  sec('haftarah', 'haftarah', 'ברכות ההפטרה', SSF('Haftarah'), { end: 'שמחנו ה\' אלהינו באליהו' }),
  sec('haftarah-shabbat', 'haftarah', '', SSF('Haftarah'), { start: 'בשבת, ובשבת חול המועד פסח', end: 'בשבת, ובשבת חול המועד פסח', when: '!yomTov&!cholHamoed|!yomTov&!sukkot', continues: true }),
  sec('haftarah-regalim', 'haftarah', '', SSF('Haftarah'), { start: 'בשלוש רגלים ובשבת חוה"מ סוכות', end: 'בשלוש רגלים ובשבת חוה"מ סוכות', when: 'yomTov&!roshHashana|cholHamoed&sukkot', continues: true }),
  sec('haftarah-rosh-hashana', 'haftarah', '', SSF('Haftarah'), { start: 'בראש השנה: על התורה', when: 'roshHashana', continues: true }),
  sec('yekum-purkan', 'torah-service', 'יקום פורקן', SSC('Yekum Purkan'), { end: 'יחיד המתפלל בביתו' }),
  sec('mi-sheberach-kahal', 'torah-service', 'מי שברך לקהל', SSC('Yekum Purkan'), { start: 'ברכה לקהל' }),
  sec('medinat-yisrael', 'torah-service', 'תפילה לשלום המדינה', SSC('Prayer of the State of Israel'), { role: 'optional' }),
  sec('tzahal', 'torah-service', 'מי שברך לחיילי צה״ל', SSC('Prayer for Israeli Soldiers'), { role: 'optional' }),
  sec('shvuyim', 'torah-service', 'מי שברך לשבויים', SSC('Prayer for Those Being Held in Captivity'), { role: 'optional' }),
  sec('birkat-hachodesh', 'birkat-hachodesh', 'ברכת החודש', SSC('Birkat Hachodesh'), { when: 'shabbatMevarchim' }),
  sec('av-harachamim', 'av-harachamim', 'אב הרחמים', SSC('Av HaRachamim')),
  sec('ashrei', 'ashrei', 'אשרי', SS('Ashrei')),
  sec('yehalelu', 'return-torah', 'יהללו · מזמור לדוד', SS('Returning Sefer to Aron'), { end: 'בשבת: מזמור לדוד' }),
  omit('ledavid-mizmor-yt', SS('Returning Sefer to Aron'), { start: 'ביו"ט כשחל בחול', end: 'ביו"ט כשחל בחול', why: 'Psalm 24, said instead of Psalm 29 when a Yom Tov falls on a weekday — not on Shabbat' }),
  sec('uvenucho', 'return-torah', 'ובנחה יאמר', SS('Returning Sefer to Aron'), { start: 'כשמכניסים ס"ת להיכל' }),
  sec('half-kaddish-musaf', 'half-kaddish', 'חצי קדיש', SS('Half Kaddish'), { role: 'minyan' }),
], {
  reviewed: true,
  conditionsPending: [
    'ברכת החודש: said only on Shabbat Mevarchim — no condition key',
    'אב הרחמים: left out on Shabbat Mevarchim (except Iyar and Sivan) and on Shabbatot when Tachanun would not be said on a weekday — no condition key',
    'שוכן עד: "האל בתעצומות עזך … המלך היושב על כסא רם ונשא" is printed in one paragraph with the caption "ביום טוב ינגן החזן" — the day engine reads it as "on Yom Tov" and hides these words on Shabbat, though everyone says them',
    HALLEL_ENGINE_PENDING,
  ],
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Shabbat Musaf
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const shabbatMusaf = service('מוסף לשבת', [
  ...avotWithZachreinu('musaf', MSA('Patriarchs')),
  ...gevurotWithSeasons('musaf', MSA('Divine Might'), ['winter', 'summer'], true),
  sec('kedusha', 'kedusha', 'קדושה', MSA('Kedushah'), { role: 'repetition' }),
  sec('kedushat-hashem', 'musaf', 'קדושת השם', MSA('Holiness of God')),
  sec('tikanta', 'musaf', 'תכנת שבת', MSA('Sanctity of the Day, For Shabbat'), { when: '!roshChodesh' }),
  sec('ata-yatzarta', 'musaf', 'אתה יצרת', MSA('Sanctity of the Day, For Shabbat Rosh Chodesh'), { when: 'roshChodesh' }),
  sec('retze', 'musaf', 'רצה', MSA('Temple Service')),
  sec('modim', 'musaf', 'מודים', MSA('Thanksgiving'), { end: 'מעולם קוינו לך' }),
  sec('modim-derabanan', 'modim-derabanan', 'מודים דרבנן', MSA('Thanksgiving'), { start: 'מודים דרבנן', end: 'ברוך אל ההודאות', role: 'repetition' }),
  sec('al-hanisim', 'musaf', 'על הנסים', MSA('Thanksgiving'), { start: 'בחנוכה ובפורים דמוקפין', when: 'chanukah|purim' }),
  sec('modim-end', 'musaf', '', MSA('Thanksgiving'), { start: 'ועל כלם יתברך', continues: true }),
  sec('birkat-kohanim', 'birkat-kohanim', 'ברכת כהנים', MSA('Birkat Kohanim'), { end: 'והש"ץ ממשיך', role: 'repetition' }),
  sec('nesiat-kapayim', 'birkat-kohanim', 'נשיאת כפיים', MSA('Birkat Kohanim'), { start: 'אם עלו כהנים לדוכן', role: 'repetition', when: 'israel' }),
  sec('sim-shalom', 'musaf', 'שים שלום', MSA('Peace')),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', MSA('Concluding Passage')),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', MS('Kaddish Shalem'), { role: 'minyan' }),
  sec('kaveh', 'kaveh', 'קוה אל ה׳', MS('Ein Keloheinu'), { end: 'קוה אל ה\'. חזק' }),
  sec('ein-keloheinu', 'ein-keloheinu', 'אין כאלהינו', MS('Ein Keloheinu'), { start: 'אין קדוש כיהוה' }),
  sec('pitum-haketoret', 'ketoret', 'פטום הקטורת', MS('Pitum Haketoret')),
  sec('kaddish-derabanan', 'kaddish-derabanan', 'קדיש דרבנן', MS('Kaddish Derabbanan'), { role: 'minyan' }),
  sec('aleinu', 'aleinu', 'עלינו לשבח', MS('Alenu')),
  sec('kaddish-yatom', 'kaddish-yatom', 'קדיש יתום', MS("Mourner's Kaddish"), { role: 'mourners' }),
  sec('song-of-day', 'song-of-day', 'שיר של יום · מזמור שיר ליום השבת', MS("Mizmor Shir L'Yom HaShabbat")),
  sec('kaddish-yatom-2', 'kaddish-yatom', 'קדיש יתום', MS("Mourner's Kaddish"), { role: 'mourners', rewind: true }),
  sec('ledavid', 'ledavid-ori', 'לדוד ה׳ אורי', MS('LeDavid'), { when: 'ledavid' }),
  sec('kaddish-yatom-ledavid', 'kaddish-yatom', 'קדיש יתום', MS("Mourner's Kaddish"), { role: 'mourners', when: 'ledavid', rewind: true }),
  sec('anim-zemirot', 'closing-passages', 'שיר הכבוד · אנעים זמירות', MS('Shir HaKavod')),
  sec('kaddish-yatom-3', 'kaddish-yatom', 'קדיש יתום', MS("Mourner's Kaddish"), { role: 'mourners', rewind: true }),
  sec('adon-olam', 'closing-passages', 'אדון עולם', MS('Adon Olam')),
], { reviewed: true, conditionsPending: [INLINE_ASERET] });

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Kiddusha Rabba and the zemirot of the day meal
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const Z2 = path => A(`Shabbat, Daytime Meal, Zemirot for Second Meal, ${path}`);
const shabbatKiddushDay = service('קידושא רבא', [
  sec('kiddusha-rabba', 'kiddush-day', 'קידושא רבא', A('Shabbat, Daytime Meal, Kiddusha Rabba')),
  sec('baruch-kel-elyon', 'zemirot', 'ברוך אל עליון', Z2('Baruch Kel Elyon'), { role: 'optional' }),
  sec('yom-zeh-mechubad', 'zemirot', 'יום זה מכובד', Z2('Yom Zeh Mechubad'), { role: 'optional' }),
  sec('yom-shabbaton', 'zemirot', 'יום שבתון', Z2('Yom Shabbaton'), { role: 'optional' }),
  sec('shimru-shabtotai', 'zemirot', 'שמרו שבתותי', Z2('Shimru Shabtotai'), { role: 'optional' }),
  sec('ki-eshmera', 'zemirot', 'כי אשמרה שבת', Z2('Ki Eshmera'), { role: 'optional' }),
  sec('dror-yikra', 'zemirot', 'דרור יקרא', Z2('Dror Yikrah'), { role: 'optional' }),
], { reviewed: true });

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Shabbat Mincha
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const shabbatMincha = service('מנחה לשבת', [
  sec('ashrei', 'ashrei', 'אשרי', SMI('Ashrei')),
  sec('uva-letzion', 'uva-letzion', 'ובא לציון', SMI('Uva Letzion')),
  sec('half-kaddish', 'half-kaddish', 'חצי קדיש', SMI('Half Kaddish'), { role: 'minyan' }),
  sec('vaani-tefilati', 'torah-service', 'ואני תפלתי', SMIT("Removing the Torah from Ark, Va'ani Tefillati")),
  sec('vayehi-binsoa', 'torah-service', 'ויהי בנסוע', SMIT('Removing the Torah from Ark, Vayehi Binsoa')),
  sec('berich-shmei', 'torah-service', 'בריך שמיה', SMIT('Removing the Torah from Ark, Berich Shmei')),
  sec('gadlu', 'torah-service', 'גדלו', SMIT('Removing the Torah from Ark, Gadlu')),
  sec('lecha-hashem', 'torah-service', 'לך ה׳ הממלכה', SMIT('Removing the Torah from Ark, Lekha Hashem')),
  sec('av-harachamim', 'torah-service', 'אב הרחמים', SMIT('Removing the Torah from Ark, Av Harachamim')),
  sec('vetigaleh', 'torah-service', 'ותגלה ותראה', SMIT('Removing the Torah from Ark, Vetigaleh Veteraeh')),
  sec('torah-reading', 'torah-reading', 'ברכות העולה לתורה', SMIT('Reading from Sefer, Birkat HaTorah'), { role: 'minyan' }),
  sec('hagbaha', 'torah-reading', 'הגבהה · וזאת התורה', SMIT('Reading from Sefer, Raising the Torah')),
  sec('yehalelu', 'return-torah', 'יהללו', SMIT('Returning Sefer to Aron, Yehalelu')),
  sec('ledavid-mizmor', 'return-torah', 'לדוד מזמור', SMIT('Returning Sefer to Aron, LeDavid')),
  sec('uvenucho', 'return-torah', 'ובנחה יאמר', SMIT('Returning Sefer to Aron, Uvenucho Yomar')),
  sec('half-kaddish-2', 'half-kaddish', 'חצי קדיש', SMI('Half Kaddish'), { role: 'minyan', rewind: true }),
  ...avotWithZachreinu('amidah', SMIA('Patriarchs')),
  ...gevurotWithSeasons('amidah', SMIA('Divine Might'), ['summer', 'winter'], true),
  sec('kedusha', 'kedusha', 'קדושה', SMIA('Kedushah'), { role: 'repetition' }),
  sec('kedushat-hashem', 'amidah', 'קדושת השם', SMIA('Holiness of God')),
  sec('ata-echad', 'amidah', 'אתה אחד', SMIA('Sanctity of the Day')),
  sec('retze-bimnuchatenu', 'amidah', '', SMIA('Temple Service'), { end: 'מקדש השבת', continues: true }),
  sec('retze', 'amidah', 'רצה', SMIA('Temple Service'), { start: 'רצה יהוה אלהינו', end: 'עבודת ישראל עמך' }),
  sec('yaale-veyavo', 'amidah', 'יעלה ויבוא', SMIA('Temple Service'), { start: 'בשבת בראש חודש ובשבת חול המועד', end: 'כי אליך עינינו', when: MUSAF_TODAY }),
  sec('retze-end', 'amidah', '', SMIA('Temple Service'), { start: 'ותחזינה עינינו', continues: true }),
  sec('modim', 'amidah', 'מודים', SMIA('Thanksgiving, Modim'), { end: 'מעולם קוינו לך' }),
  sec('modim-derabanan', 'modim-derabanan', 'מודים דרבנן', SMIA('Thanksgiving, Modim'), { start: 'מודים דרבנן', role: 'repetition' }),
  sec('al-hanisim-chanukah', 'amidah', 'על הנסים', SMIA('Thanksgiving, Al Hanisim for Chanukkah'), { when: 'chanukah' }),
  sec('al-hanisim-purim', 'amidah', 'על הנסים לפורים', SMIA('Thanksgiving, Al Hanisim for Purim'), { end: 'ותלו אותו ואת בניו על העץ', when: 'purim' }),
  sec('modim-end', 'amidah', '', SMIA('Thanksgiving, Al Hanisim for Purim'), { start: 'ועל כלם יתברך', continues: true }),
  sec('shalom', 'amidah', 'שים שלום', SMIA('Peace')),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', SMIA('Concluding Passage')),
  sec('tzidkatcha', 'tzidkatcha', 'צדקתך', SMI('Tzidkatkhah Tzedek'), { when: 'tachanunIfWeekday' }),
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', SMI('Kaddish Shalem'), { role: 'minyan' }),
  sec('aleinu', 'aleinu', 'עלינו לשבח', SMI('Alenu')),
  sec('kaddish-yatom', 'kaddish-yatom', 'קדיש יתום', SMI("Mourner's Kaddish"), { role: 'mourners' }),
  // From Shabbat Bereshit to Shabbat HaGadol (the winter half of the year).
  sec('barchi-nafshi', 'barchi-nafshi', 'ברכי נפשי', SMI('Barchi Nafshi'), { when: 'winter' }),
], {
  reviewed: true,
  missing: [{ concept: 'pirkei-avot', why: 'the edition does not print Pirkei Avot (said on summer Shabbat afternoons)' }],
  conditionsPending: [
    'צדקתך: left out when Tachanun would not be said on a weekday — the tachanun key is always false on Shabbat, so the section is shown every week',
  ],
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Havdalah
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const HAV = A('Shabbat, Havdalah');
const havdalah = service('הבדלה', [
  sec('hine-el', 'havdalah', 'הנה אל ישועתי', HAV),
  sec('hagefen', 'havdalah', 'בורא פרי הגפן', HAV, { start: 'בורא פרי הגפן' }),
  sec('besamim', 'havdalah', 'בורא מיני בשמים', HAV, { start: 'בורא מיני בשמים' }),
  sec('haesh', 'havdalah', 'בורא מאורי האש', HAV, { start: 'בורא מאורי האש' }),
  sec('havdala', 'havdalah', 'המבדיל', HAV, { start: 'המבדיל בין קדש לחול' }),
], { reviewed: true });

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Birkat HaMazon
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const BHM = A('Berachot, Birkat HaMazon');
const birkatHamazon = service('ברכת המזון', [
  // Ashkenaz: על נהרות בבל on weekdays with Tachanun, שיר המעלות on Shabbat, Yom Tov and days without Tachanun.
  sec('al-naharot', 'birkat-hamazon', 'על נהרות בבל', BHM, { end: 'אשרי שיאחז ונפץ', when: 'tachanun&!yomTov&!shabbat' }),
  // The edition's caption over שיר המעלות names Shabbat only; kept as a line of its own so that the day engine, which
  // reads it as "on Shabbat", does not hide the psalm on Rosh Chodesh and the festivals.
  sec('shir-hamaalot-caption', 'birkat-hamazon', '', BHM, { start: 'בשבת קודם ברכת המזון', end: 'בשבת קודם ברכת המזון', when: 'shabbat|!tachanun|yomTov', continues: true }),
  sec('shir-hamaalot', 'birkat-hamazon', 'שיר המעלות', BHM, { start: 'שיר המעלות בשוב', end: 'נשא אלמתיו', when: 'shabbat|!tachanun|yomTov' }),
  sec('zimun', 'birkat-hamazon', 'זימון', BHM, { start: 'שלושה שאכלו כאחד', end: 'ויש המוסיפים' }),
  sec('hazan', 'birkat-hamazon', 'ברכת הזן', BHM, { start: 'ברכה זו משה רבינו', end: 'ברוך אתה יהוה הזן את הכל' }),
  sec('haaretz', 'birkat-hamazon', 'ברכת הארץ', BHM, { start: 'ברכה זו יהושע תקנה', end: 'נודה לך' }),
  sec('al-hanisim', 'birkat-hamazon', 'על הנסים', BHM, { start: 'בחנוכה ופורים אומרים כאן על הניסים', end: 'בימי מרדכי ואסתר', when: 'chanukah|purim' }),
  sec('haaretz-end', 'birkat-hamazon', '', BHM, { start: 'ועל הכל יהוה אלהינו', end: 'על הארץ ועל המזון', continues: true }),
  sec('rachem', 'birkat-hamazon', 'בונה ירושלים', BHM, { start: 'בונה ירושלים דוד ושלמה', end: 'רחם יהוה אלהינו' }),
  sec('retze', 'birkat-hamazon', 'רצה והחליצנו', BHM, { start: 'בשבת מוסיפים', end: 'רצה והחליצנו', when: 'shabbat' }),
  sec('yaale-veyavo', 'birkat-hamazon', 'יעלה ויבוא', BHM, { start: 'בראש חודש ובחול המועד אומרים כאן', end: 'זכרנו יהוה אלהינו בו לטובה', when: 'roshChodesh|yomTov|cholHamoed' }),
  sec('uvneh', 'birkat-hamazon', '', BHM, { start: 'שכח לומר רצה בשבת', end: 'בונה ברחמיו ירושלים', continues: true }),
  sec('hatov-vehametiv', 'birkat-hamazon', 'הטוב והמטיב', BHM, { start: 'הטוב והמטיב ביבנה', end: 'ומכל טוב לעולם אל יחסרנו' }),
  sec('harachaman', 'birkat-hamazon', 'הרחמן', BHM, { start: 'הרחמן הוא ימלוך', end: 'יהוה יברך את עמו בשלום' }),
  sec('dinei-shikcha', 'birkat-hamazon', 'דיני שכחה', BHM, { start: 'דיני שכחה' }),
], { reviewed: true });

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Hallel, Musaf of Rosh Chodesh, the Omer, the festival Amidah and Musaf
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const hallel = service('הלל', hallelSections, { reviewed: true, conditionsPending: [HALLEL_ENGINE_PENDING] });

const roshChodeshMusaf = service('מוסף לראש חודש', [
  ...roshChodeshMusafAmidah,
  sec('kaddish-titkabal', 'kaddish-titkabal', 'קדיש תתקבל', WSC('Kaddish Shalem'), { role: 'minyan' }),
], { reviewed: true, conditionsPending: [INLINE_ASERET] });

const OMER = WM('Sefirat HaOmer');
const omer = service('ספירת העומר', [
  sec('leshem-yichud', 'omer', 'לשם יחוד', OMER, { end: 'הנני מוכן ומזמן' }),
  sec('vihi-noam', 'omer', 'ויהי נועם', OMER, { start: 'ויהי נעם' }),
  sec('bracha', 'omer', 'ברכת הספירה', OMER, { start: 'על ספירת העמר' }),
  sec('count', 'omer', 'הספירה', OMER, { start: 'היום יום אחד בעמר', end: 'היום תשעה וארבעים יום' }),
  sec('harachaman', 'omer', 'הרחמן', OMER, { start: 'הרחמן הוא יחזיר' }),
  sec('lamenatzeach', 'omer', 'למנצח בנגינות', OMER, { start: 'למנצח בנגינות' }),
  sec('ana-bekoach', 'omer', 'אנא בכח', OMER, { start: 'אנא בכח', end: 'ברוך שם כבוד מלכותו' }),
  sec('ribono', 'omer', 'רבונו של עולם', OMER, { start: 'רבונו של עולם' }),
], { reviewed: true, conditionsPending: ['The day\'s count: the edition prints all 49 counts (each with its date); nothing selects the night'] });

// The festival Amidah of Maariv, Shacharit and Mincha (one leaf set in the edition).
const festivalAmidah = service('עמידה לשלוש רגלים', [
  sec('avot', 'festival-amidah', 'ברכת אבות', FA('Avot')),
  ...gevurotWithSeasons('festival-amidah', FA('Gevurot'), ['winter', 'summer'], false),
  sec('kedusha-shacharit', 'kedusha', 'קדושה לשחרית', FA('Kedusha'), { end: 'אלהיך ציון לדר ודר', role: 'repetition' }),
  sec('kedusha-mincha', 'kedusha', 'קדושה למנחה', FA('Kedusha'), { start: 'למנחה:', end: 'אלהיך ציון לדור ודור', role: 'repetition' }),
  sec('kedushat-hashem', 'festival-amidah', 'קדושת השם', FA('Kedusha'), { start: 'אתה קדוש ושמך קדוש' }),
  sec('ata-vechartanu', 'festival-amidah', 'אתה בחרתנו', FA('Sanctity of the Day'), { end: 'ושמך הגדול והקדוש עלינו קראת' }),
  sec('vatodienu', 'festival-amidah', 'ותודיענו', FA('Sanctity of the Day'), { start: 'כשחל יו"ט במוצאי שבת', end: 'קדשת הבדלת וקדשת', when: 'motzaeiShabbat' }),
  sec('vatiten', 'festival-amidah', 'ותתן לנו', FA('Sanctity of the Day'), { start: 'ותתן לנו ה\' אלהינו באהבה', end: 'ותתן לנו ה\' אלהינו באהבה' }),
  sec('day-shabbat', 'festival-amidah', '', FA('Sanctity of the Day'), { start: 'לשבת השבת הזה ואת יום', when: 'shabbat', continues: true }),
  sec('day-pesach', 'festival-amidah', '', FA('Sanctity of the Day'), { start: 'לפסח - חג המצות', when: 'pesach', continues: true }),
  sec('day-shavuot', 'festival-amidah', '', FA('Sanctity of the Day'), { start: 'לשבועות - חג השבועות', when: 'shavuot', continues: true }),
  sec('day-sukkot', 'festival-amidah', '', FA('Sanctity of the Day'), { start: 'סוכות - חג הסכות', when: 'sukkot', continues: true }),
  sec('day-shemini', 'festival-amidah', '', FA('Sanctity of the Day'), { start: 'לשמ"ע ולש"ת', when: 'sheminiAtzeret', continues: true }),
  // "(לשבת: באהבה) מקרא קדש זכר ליציאת מצרים" — one paragraph for every day; the Shabbat word is a caption inside it.
  sec('mikra-kodesh', 'festival-amidah', '', FA('Sanctity of the Day'), { start: 'לשבת באהבה מקרא קדש', end: 'לשבת באהבה מקרא קדש', continues: true }),
  sec('yaale-veyavo', 'festival-amidah', 'יעלה ויבוא', FA('Sanctity of the Day'), { start: 'יעלה ויבוא ויגיע', end: 'לחיים ולשלום ביום' }),
  sec('yaale-pesach', 'festival-amidah', '', FA('Sanctity of the Day'), { start: 'לפסח - חג המצות', when: 'pesach', continues: true }),
  sec('yaale-shavuot', 'festival-amidah', '', FA('Sanctity of the Day'), { start: 'לשבועות - חג השבועות', when: 'shavuot', continues: true }),
  sec('yaale-sukkot', 'festival-amidah', '', FA('Sanctity of the Day'), { start: 'סוכות - חג הסכות', when: 'sukkot', continues: true }),
  sec('yaale-shemini', 'festival-amidah', '', FA('Sanctity of the Day'), { start: 'לשמ"ע ולש"ת', when: 'sheminiAtzeret', continues: true }),
  sec('yaale-end', 'festival-amidah', '', FA('Sanctity of the Day'), { start: 'זכרנו ה\' אלהינו בו לטובה', continues: true }),
  sec('vehasienu', 'festival-amidah', 'והשיאנו', FA('Sanctity of the Day'), { start: 'והשיאנו', end: 'והשיאנו' }),
  sec('retze-bimnuchatenu', 'festival-amidah', '', FA('Sanctity of the Day'), { start: 'לשבת אלהינו ואלהי אבותינו רצה במנוחתנו', end: 'לשבת אלהינו ואלהי אבותינו רצה במנוחתנו', when: 'shabbat', continues: true }),
  sec('kadshenu', 'festival-amidah', '', FA('Sanctity of the Day'), { start: 'קדשנו במצותיך', continues: true }),
  sec('retze', 'festival-amidah', 'רצה', FA('Avodah')),
  sec('modim', 'festival-amidah', 'מודים', FA('Modim'), { end: 'כי מעולם קוינו לך' }),
  sec('modim-derabanan', 'modim-derabanan', 'מודים דרבנן', FA('Modim'), { start: 'מודים דרבנן', end: 'ברוך אל ההודאות', role: 'repetition' }),
  sec('modim-end', 'festival-amidah', '', FA('Modim'), { start: 'ועל כלם יתברך', continues: true }),
  sec('birkat-kohanim', 'birkat-kohanim', 'ברכת כהנים', FA('Birkat Kohanim'), { role: 'repetition' }),
  sec('sim-shalom', 'festival-amidah', 'שים שלום', FA('Peace')),
  sec('elokai-netzor', 'elokai-netzor', 'אלהי נצור', FA('Concluding Prayer')),
], { reviewed: false });

const festivalMusaf = service('מוסף לשלוש רגלים', festivalMusafAmidah, {
  reviewed: false,
  conditionsPending: [
    'The offerings of each day of Chol HaMoed Sukkot (and the diaspora\'s doubled verses) — no day-of-Chol-HaMoed key; all five days are shown, each labelled by the edition',
    'The offerings of the first days of Pesach (ובחדש הראשון) vs Chol HaMoed and the last days (והקרבתם) — no first/last-days key; pesach&yomTov shows the first-days verses on the last days too',
    'ותערב (Birkat Kohanim in the repetition) — the edition prints the Israeli and diaspora forms together',
  ],
});

export default {
  nusach: 'ashkenaz',
  index: 'Siddur Ashkenaz',
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
    'festival-musaf': festivalMusaf,
  },
  // Services of the schema that the licensed edition does not contain: schema id → reason.
  sourceGaps: {},
};
