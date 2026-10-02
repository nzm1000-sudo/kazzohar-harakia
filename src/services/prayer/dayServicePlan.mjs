// The Smart Siddur's order of service for one prayer day: which sections, in which order, and which
// part of each. Pure: the app's Jewish context (JewishContextEngine) in, a plan out. The text itself is
// never written here — every step points into a bundled edition by reference and paragraph range.
// Sources for the order: the edition's own instructions (quoted per step) and Shulchan Arukh OC.
import { cholHamoedSukkotReading, READINGS_SOURCE } from './festivalReadings.mjs';
import { dayConditionsFromContext } from './rubricConditions.mjs';
import { HDate, months } from '@hebcal/core';

const S = section => `Siddur Edot HaMizrach, ${section}`;
const F = text => `Festival Liturgy, ${text}`;
const WEEKDAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];

// Recording in "המצוות שלי" under the same keys as the printed services.
export const DAY_SERVICE_COMPLETION = Object.freeze({ shacharit: 'Weekday Shacharit', mincha: 'Weekday Mincha', maariv: 'Weekday Arvit', 'birkat-hamazon': 'Post Meal Blessing' });
export const DAY_SERVICE_TITLES = Object.freeze({ shacharit: 'שחרית', mincha: 'מנחה', maariv: 'ערבית', 'birkat-hamazon': 'ברכת המזון' });

// Sephardim say the Hoshanot right after Hallel, before Kaddish Titkabal and the Torah reading
// (Kaf HaChaim 660:4 — the Ari, the custom of Jerusalem, the Chida; after Mussaf is the Tur's order).

const step = (id, title, ref, extra = {}) => ({ id, kind: 'siddur', title, ref, ...extra });
// A quick link to a place in the service: its section, and optionally the words to land on inside it.
const link = (label, section, find = null) => ({ label, section, find });

// The daily psalm (by weekday) and the day's additional psalm, from "Song of the Day".
function songOfTheDay(c, weekday) {
  const ranges = [[0, 1], [2 + weekday * 2, 3 + weekday * 2]];
  if (c.tzomGedaliah || c.asaraBetevet) ranges.push([14, 15]);
  if (c.chanukah) ranges.push([18, 19]);
  if (c.taanitEsther || c.purim) ranges.push([20, 21]);
  if (c.shivaAsarBetammuz) ranges.push([22, 23]);
  ranges.push([27, 29]);
  return [step('song-of-day', 'שיר של יום', S('Weekday Shacharit, Song of the Day'), { ranges })];
}

// Hallel from the edition's "הלל לראש חודש ולמועדים": the psalms and Kaddish only (¶0–29, ¶30–33 "יש אומרים");
// the Rosh Chodesh reading and Ashrei that follow it in that section are not part of Hallel.
// Full Hallel (Sukkot, Chanukah…): with the blessings and יהללוך. Half Hallel ("בימים שאין גומרים את ההלל מדלגים"):
// without לא לנו and אהבתי, and — as Sephardim — without the blessings.
export function hallelStep(c, { withKaddish = true } = {}) {
  const full = c.fullHallel || c.sukkot;
  const ranges = full ? [[0, 0], [2, 6], [8, 9], [11, 22], [24, 24]] : [[0, 0], [5, 6], [9, 9], [12, 22]];
  if (withKaddish) ranges.push(...hallelKaddishRanges);
  return step('hallel', full ? 'הלל שלם' : 'חצי הלל', S('Rosh Hodesh, Hallel'), { ranges });
}
// Kaddish Titkabal after Hallel (¶25–29) and the verse "some say after Hallel" (¶30–33).
const hallelKaddishRanges = [[25, 29], [30, 33]];

// The weekday Torah service; on a day without Tachanun "יהי ה׳ אלהינו עמנו" replaces "אל ארך אפים" (¶1–5).
export function torahServiceStep(c, { upTo = 15 } = {}) {
  const ranges = c.tachanun ? [[0, 0], [2, 3], [6, upTo]] : [[0, 0], [5, upTo]];
  return step('torah-service', 'הוצאת ספר תורה', S('Weekday Shacharit, Torah Reading'), { ranges });
}
// The oleh's blessings before the reading (¶9–15), when the Sefer Torah was taken out earlier.
const aliyahBlessingsStep = () => step('aliyah-blessings', 'ברכות העולה', S('Weekday Shacharit, Torah Reading'), { range: [9, 15] });

function dayLabel(context, c) {
  const parts = [context.hebrewDate?.label];
  if (c.sheminiAtzeret) parts.push(context.isIsrael ? 'שמיני עצרת · שמחת תורה' : 'שמיני עצרת');
  if (c.shabbat) parts.push('שבת');
  if (c.cholHamoed) parts.push(c.sukkot ? 'חול המועד סוכות' : 'חול המועד פסח');
  if (c.hoshanaRabbah) parts.push('הושענא רבה');
  if (c.roshChodesh) parts.push('ראש חודש');
  if (c.chanukah) parts.push('חנוכה');
  if (c.purim) parts.push('פורים');
  if (c.fast) parts.push('תענית ציבור');
  return parts.filter(Boolean).join(' · ');
}

// Days the Smart Siddur composes today. Everything else keeps the printed service (with the day-condition engine).
export function dayServiceSupport(context, { nusach = 'edot-hamizrach' } = {}) {
  // The plan below quotes the Edot HaMizrach edition step by step; another rite reads its own printed service
  // (with the same day conditions inside the text) until its plan is verified the same way.
  if (nusach !== 'edot-hamizrach') return { supported: false, reason: 'nusach' };
  const c = dayConditionsFromContext(context);
  if (!c.resolved) return { supported: false, reason: 'unresolved-day' };
  // Shemini Atzeret / Simchat Torah in Eretz Yisrael (one day). Abroad the two days read differently — not yet.
  if (c.sheminiAtzeret && context.isIsrael) return { supported: true, reason: 'shemini-atzeret' };
  if (c.yomTov || c.shabbat) return { supported: false, reason: 'yom-tov-or-shabbat' };
  if (c.cholHamoed && c.sukkot) return { supported: true, reason: 'chol-hamoed-sukkot' };
  if (c.cholHamoed && c.pesach) return { supported: true, reason: 'chol-hamoed-pesach' };
  if (c.roshChodesh) return { supported: true, reason: 'rosh-chodesh' };
  if (c.chanukah) return { supported: true, reason: 'chanukah' };
  if (c.purim) return { supported: true, reason: 'purim' };
  if (c.fast && !c.tishaBav && !c.yomKippur) return { supported: true, reason: 'fast' };
  return { supported: false, reason: 'not-yet' };
}

function cholHamoedSukkotShacharit(context, c) {
  const weekday = new Date(`${context.key}T12:00:00Z`).getUTCDay();
  const dayOfSukkot = Number(context.hebrewDate.day) - 14;
  const israel = Boolean(context.isIsrael);
  const hoshanotDay = c.hoshanaRabbah ? null : israel ? dayOfSukkot : dayOfSukkot; // the festival day, 1–6 (Edot HaMizrach order is by day)
  const reading = cholHamoedSukkotReading(dayOfSukkot, { israel });
  const hoshanot = c.hoshanaRabbah
    // Hoshana Rabbah: seven circuits with their Hoshanot, the Kaddish, then the aravah (Ben Ish Chai, Vezot HaBeracha 6–7).
    ? [step('hoshanot', 'הושענות להושענא רבה — שבע הקפות', F('Hoshanot, Hoshana Rabbah')), step('aravah', 'חבטת ערבה', F('Hoshana Rabbah, Aravah'))]
    : [step('hoshanot', `הושענות ליום ה${['', 'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'][hoshanotDay]}`, F(`Hoshanot, Day ${hoshanotDay}`), { note: 'מקיפים את התיבה פעם אחת (שו״ע או״ח תרס, א).' }),
      step('hallel-kaddish', 'קדיש תתקבל', S('Rosh Hodesh, Hallel'), { ranges: hallelKaddishRanges })];
  const steps = [
    step('petichat-eliyahu', 'פתח אליהו', S('Weekday Shacharit, Petichat Eliyahu')),
    step('talit', 'סדר עטיפת טלית', S('Weekday Shacharit, Order of Talit')),
    // SA OC 31:2 — "בחוה״מ גם כן אסור להניח תפילין". The tefillin section is left out on Chol HaMoed.
    step('hanna', 'תפלת חנה', S("Weekday Shacharit, Hanna's Prayer")),
    step('korbanot', 'קרבנות וקטורת', S('Weekday Shacharit, Incense Offering')),
    step('hodu', 'הודו', S('Weekday Shacharit, Hodu')),
    step('pesukei-dezimra', 'פסוקי דזמרה', S("Weekday Shacharit, Pesukei D'Zimra")),
    step('shema', 'קריאת שמע וברכותיה', S('Weekday Shacharit, The Shema')),
    amidaStep({ hallelDay: true }),
    // SA OC 644:1 — after the repetition: the lulav with its blessings, then the complete Hallel.
    step('lulav', 'נטילת לולב', F('Netilat Lulav')),
    hallelStep(c, { withKaddish: false }),
    // The Sefer Torah is taken out and brought to the bimah, and the Hoshanot circle it (SA OC 660:1);
    // Kaddish Titkabal after the Hoshanot (Kaf HaChaim 660:4); then the reading.
    torahServiceStep(c, { upTo: 8 }),
    ...hoshanot,
    aliyahBlessingsStep(),

    { id: 'torah', kind: 'torah', title: 'קריאת התורה', aliyot: reading, note: israel ? 'בארץ ישראל כל ארבעת העולים קוראים בקרבן היום בלבד (שו״ע או״ח תרסג, א).' : null, source: READINGS_SOURCE },
    step('torah-after', 'ברכה אחרונה וחצי קדיש', S('Weekday Shacharit, Torah Reading'), { range: [16, 20] }),
    // No Tachanun: "ביום שאין אומרים בו תחנון מדלגים למנצח" — Ashrei without למנצח.
    step('ashrei', 'אשרי', S('Weekday Shacharit, Ashrei'), { range: [0, 3] }),
    // The Rosh Chodesh form (the edition's festive order): ובא לציון, בית יעקב, שיר המעלות.
    step('uva-lesion', 'ובא לציון', S('Rosh Hodesh, Uva LeSion')),
    ...songOfTheDay(c, weekday),
    // Returning the Sefer Torah (יהללו), then half Kaddish before Mussaf (the tefillin line does not apply).
    step('return-torah', 'החזרת ספר תורה וחצי קדיש', S('Rosh Hodesh, Song of the Day'), { ranges: [[14, 15], [18, 18]] }),
    step('mussaf', 'מוסף לחול המועד', S('Prayers for Three Festivals, Mussaf'), { range: [0, 58] }),
    // "בחול המועד אחרי החזרה אומרים יהי שם, ואחריו אומר הש״ץ קדיש תתקבל" (the edition, Mussaf ¶58).
    step('yehi-shem', 'יהי שם וקדיש תתקבל', S('Rosh Hodesh, Mussaf'), { range: [42, 47] }),
    // "ואומרים המזמור השייך לאותו יום טוב, וקדיש יהא שלמא וקוה עד הסוף" (¶58).
    step('festival-psalm', 'מזמור לסוכות', S('Prayers for Three Festivals, Song for Sukkot'), { range: [0, 1] }),
    step('kaddish-yehe-shlama', 'קדיש יהא שלמא', S('Rosh Hodesh, Barchi Nafshi'), { range: [3, 5] }),
    step('kaveh', 'קוה', S('Weekday Shacharit, Kaveh')),
    step('alenu', 'עלינו לשבח', S('Weekday Shacharit, Alenu')),
  ];
  return {
    steps,
    highlights: [link('יעלה ויבוא בעמידה', 'amida', 'יעלה ויבא'), link('נטילת לולב והלל שלם', 'lulav'), link(c.hoshanaRabbah ? 'הושענות — שבע הקפות' : 'הושענות', 'hoshanot'), link('קריאת התורה בקרבנות החג', 'torah'), link('מוסף לחול המועד', 'mussaf'), link('אין תחנון ואין למנצח', 'ashrei'), link('אין מניחים תפילין', 'talit')],
  };
}

function cholHamoedMincha() {
  return {
    steps: [
      step('offerings', 'קרבנות', S('Weekday Mincha, Offerings')),
      step('amida', 'עמידה', S('Weekday Mincha, Amida')),
      step('alenu', 'עלינו לשבח', S('Weekday Mincha, Alenu')),
    ],
    highlights: [link('יעלה ויבוא בעמידה', 'amida', 'יעלה ויבא'), link('אין וידוי ואין תחנון', 'alenu')],
  };
}

function cholHamoedMaariv(c) {
  // The Motzaei Shabbat additions (¶52–60) belong to Motzaei Shabbat only: "בכל לילות החול מלבד מוצאי שבת מדלגים לקדיש תתקבל".
  const amidah = c.motzaeiShabbat
    ? [step('amida', 'עמידה', S('Weekday Arvit, Amidah'), { range: [0, 51] }), step('motzaei-shabbat', 'למוצאי שבת', S('Weekday Arvit, Amidah'), { range: [53, 60] }), step('titkabal', 'קדיש תתקבל', S('Weekday Arvit, Amidah'), { range: [61, 200] })]
    : [step('amida', 'עמידה', S('Weekday Arvit, Amidah'), { range: [0, 51] }), step('titkabal', 'קדיש תתקבל', S('Weekday Arvit, Amidah'), { range: [61, 200] })];
  return {
    steps: [
      step('barchu', 'ברכו', S('Weekday Arvit, Barchu')),
      step('shema', 'קריאת שמע וברכותיה', S('Weekday Arvit, The Shema')),
      ...amidah,
      step('alenu', 'עלינו לשבח', S('Weekday Arvit, Alenu')),
    ],
    highlights: [link('יעלה ויבוא בעמידה', 'amida', 'יעלה ויבא')],
  };
}

// Arvit is the service of the coming night: before sunset it is composed for the evening that follows.
export function dayServiceInstant(prayer, now = new Date(), times = null) {
  const sunset = times?.sunset ? new Date(times.sunset) : null;
  if (prayer === 'maariv' && sunset && Number.isFinite(sunset.getTime()) && now < sunset) return new Date(sunset.getTime() + 10 * 60 * 1000);
  return now;
}

// ——— ברכות השחר ———
// Every Shacharit of the Smart Siddur opens with the edition's "סדר השכמת הבוקר" — מודה אני, the morning blessings
// (על נטילת ידים … המעביר שינה, ויהי רצון שתרגילנו, יהי רצון שתצילני) and ברכות התורה with יברכך and אלו דברים —
// whole, in its order, as one part titled ברכות השחר (the steps share a group, so they read as one section).
// "בתשעה באב ויום הכיפורים אין אומרים ברכה זו" (Morning Blessings ¶15): שעשה לי כל צרכי (¶16) is left out on those days.
export const BIRCHOT_HASHACHAR_TITLE = 'ברכות השחר';
export function birchotHashacharSteps(c = {}) {
  const part = { group: 'birchot-hashachar', part: true };
  return [
    step('birchot-hashachar', BIRCHOT_HASHACHAR_TITLE, S('Preparatory Prayers, Modeh Ani'), part),
    step('birchot-hashachar-blessings', '', S('Preparatory Prayers, Morning Blessings'), { ...part, ...(c.tishaBav || c.yomKippur ? { ranges: [[0, 14], [17, 26]] } : {}) }),
    step('birchot-hashachar-torah', '', S('Preparatory Prayers, Torah Blessings'), part),
  ];
}

// ——— Weekday building blocks ———
// Weekday Shacharit up to and including Shema; tefillin except on Chol HaMoed (SA OC 31:2) and Tisha B'Av morning.
const weekdayPrelude = ({ tefillin = true } = {}) => [
  step('petichat-eliyahu', 'פתח אליהו', S('Weekday Shacharit, Petichat Eliyahu')),
  step('talit', 'סדר עטיפת טלית', S('Weekday Shacharit, Order of Talit')),
  ...(tefillin ? [step('tefillin', 'סדר הנחת תפילין', S('Weekday Shacharit, Order of Tefillin'))] : []),
  step('hanna', 'תפלת חנה', S("Weekday Shacharit, Hanna's Prayer")),
  step('korbanot', 'קרבנות וקטורת', S('Weekday Shacharit, Incense Offering')),
  step('hodu', 'הודו', S('Weekday Shacharit, Hodu')),
  step('pesukei-dezimra', 'פסוקי דזמרה', S("Weekday Shacharit, Pesukei D'Zimra")),
  step('shema', 'קריאת שמע וברכותיה', S('Weekday Shacharit, The Shema')),
];
// The weekday Amidah (¶0–71); Avinu Malkeinu (¶73–105) is gated by the edition itself (Aseret). On a Hallel day
// Hallel follows the repetition directly — "יהי שם" (¶106–107) belongs only to days without Tachanun and Hallel.
function amidaStep({ hallelDay = false } = {}) {
  return step('amida', 'עמידה', S('Weekday Shacharit, Amida'), hallelDay ? { ranges: [[0, 71], [73, 105]] } : { range: [0, 107] });
}
const ashreiStep = c => step('ashrei', 'אשרי', S('Weekday Shacharit, Ashrei'), { range: c.tachanun ? [0, 5] : [0, 3] });
// "בימים שאין אומרים תחנון אין אומרים תפלה לדוד" (Beit Yaakov ¶1–2).
const beitYaakovStep = c => step('beit-yaakov', 'בית יעקב', S('Weekday Shacharit, Beit Yaakov'), { ranges: c.tachanun ? [[0, 4]] : [[0, 0], [3, 4]] });
const torahAfter = () => step('torah-after', 'ברכה אחרונה וחצי קדיש', S('Weekday Shacharit, Torah Reading'), { range: [16, 20] });
const weekdayClose = (c, weekday) => [
  step('uva-lesion', 'ובא לציון', S('Weekday Shacharit, Uva LeSion')),
  beitYaakovStep(c),
  ...songOfTheDay(c, weekday),
  step('kaveh', 'קוה', S('Weekday Shacharit, Kaveh')),
  step('alenu', 'עלינו לשבח', S('Weekday Shacharit, Alenu')),
];
const weekdayOf = context => new Date(`${context.key}T12:00:00Z`).getUTCDay();
// Day of Chanukah (1–8) from the Hebrew calendar: days since 25 Kislev (Kislev may have 29 or 30 days).
export function chanukahDayOf(context) {
  const [y, m, d] = String(context.key).split('-').map(Number);
  const today = new HDate(new Date(y, m - 1, d));
  const year = today.getMonth() === months.KISLEV ? today.getFullYear() : today.getFullYear();
  const start = new HDate(25, months.KISLEV, year);
  const day = today.abs() - start.abs() + 1;
  return day >= 1 && day <= 8 ? day : null;
}
const torah = (id, title, aliyot, extra = {}) => ({ id, kind: 'torah', title, aliyot, ...extra });

// The edition's own tables (Siddur, "Hanukkah, Shacharit" ¶4–21; the continuation's "קריאת התורה לראש חודש").
const NUM = (from, to) => `Numbers ${from}-${to}`;
const RC_READING = [{ label: 'כהן', ref: NUM('28:1', '28:3') }, { label: 'לוי', ref: NUM('28:3', '28:5') }, { label: 'ישראל', ref: NUM('28:6', '28:10') }, { label: 'רביעי', ref: NUM('28:11', '28:15') }];
// Rosh Chodesh Tevet in Chanukah: "כהן קורא עד רביעית ההין, לוי עד ונסכה, ושלישי עד סוף קריאת ראש חדש".
const RC_READING_THREE = [{ label: 'כהן', ref: NUM('28:1', '28:5') }, { label: 'לוי', ref: NUM('28:6', '28:10') }, { label: 'שלישי', ref: NUM('28:11', '28:15') }];
// Chanukah day d (1–8): day 1 from Birkat Kohanim (6:22) — Kohen to "לפני המשכן", Levi to "לחנוכת המזבח",
// Yisrael to "נחשון בן עמינדב"; days 2–7 the day's nasi, Yisrael repeating it; day 8 to "כן עשה את המנורה".
function chanukahReading(day) {
  if (day === 1) return [{ label: 'כהן', ref: NUM('6:22', '7:3') }, { label: 'לוי', ref: NUM('7:4', '7:11') }, { label: 'ישראל', ref: NUM('7:12', '7:17') }];
  if (day === 8) return [{ label: 'כהן', ref: NUM('7:54', '7:56') }, { label: 'לוי', ref: NUM('7:57', '7:59') }, { label: 'ישראל', ref: NUM('7:54', '8:4') }];
  const first = 12 + (day - 1) * 6;
  return [{ label: 'כהן', ref: NUM(`7:${first}`, `7:${first + 2}`) }, { label: 'לוי', ref: NUM(`7:${first + 3}`, `7:${first + 5}`) }, { label: 'ישראל', ref: NUM(`7:${first}`, `7:${first + 5}`) }];
}
const chanukahDayPortion = day => (day === 8 ? NUM('7:54', '8:4') : day === 1 ? NUM('7:1', '7:17') : NUM(`7:${12 + (day - 1) * 6}`, `7:${17 + (day - 1) * 6}`));
const VAYECHAL = [{ label: 'כהן', ref: 'Exodus 32:11-32:14' }, { label: 'לוי', ref: 'Exodus 34:1-34:3' }, { label: 'ישראל', ref: 'Exodus 34:4-34:10' }];
// Chol HaMoed Pesach in Eretz Yisrael (the continuation's "קריאת התורה לפסח"): three from the first scroll,
// the fourth "והקרבתם" from the second; if the third day is Shabbat, each later reading moves one day on.
const PESACH_CHM = {
  16: [{ label: 'כהן', ref: 'Leviticus 22:26-23:8' }, { label: 'לוי', ref: 'Leviticus 23:9-23:14' }, { label: 'ישראל', ref: 'Leviticus 23:15-23:44' }],
  17: [{ label: 'כהן', ref: 'Exodus 13:1-13:4' }, { label: 'לוי', ref: 'Exodus 13:5-13:10' }, { label: 'ישראל', ref: 'Exodus 13:11-13:16' }],
  18: [{ label: 'כהן', ref: 'Exodus 22:24-23:5' }, { label: 'לוי', ref: 'Exodus 23:6-23:14' }, { label: 'ישראל', ref: 'Exodus 23:15-23:19' }],
  19: [{ label: 'כהן', ref: 'Exodus 34:1-34:3' }, { label: 'לוי', ref: 'Exodus 34:4-34:17' }, { label: 'ישראל', ref: 'Exodus 34:18-34:26' }],
  20: [{ label: 'כהן', ref: 'Numbers 9:1-9:4' }, { label: 'לוי', ref: 'Numbers 9:5-9:8' }, { label: 'ישראל', ref: 'Numbers 9:9-9:14' }],
};
export function pesachCholHamoedReading(day, weekday17) {
  const shifted = weekday17 === 6 && day >= 18 ? PESACH_CHM[day - 1] : PESACH_CHM[day];
  return shifted ? [...shifted, { label: 'רביעי', ref: 'Numbers 28:17-28:25' }] : null;
}

function roshChodeshShacharit(context, c) {
  const weekday = weekdayOf(context);
  const chanukahDay = context.chanukah ? chanukahDayOf(context) : null;
  const withChanukah = Boolean(c.chanukah);
  return {
    steps: [
      ...weekdayPrelude(),
      amidaStep({ hallelDay: true }),
      // Rosh Chodesh: half Hallel, without a blessing (Sephardim). In Chanukah: the full Hallel.
      hallelStep(withChanukah ? { ...c, fullHallel: true } : c),
      step('torah-service', 'הוצאת ספר תורה', S('Weekday Shacharit, Torah Reading'), { ranges: [[0, 0], [5, 15]] }),
      ...(withChanukah
        ? [torah('torah', 'קריאת התורה — ראש חודש', RC_READING_THREE, { note: 'מוציאים שני ספרים. בראשון שלושה בפרשת ראש חודש, ואין אומרים קדיש (הוראת הסידור, חנוכה).' }),
          torah('torah-chanukah', 'קריאת התורה — חנוכה', [{ label: 'רביעי', ref: chanukahDayPortion(chanukahDay || 6) }], { note: 'בספר השני קורא הרביעי בפרשת הנשיאים, קרבן של אותו היום.' })]
        : [torah('torah', 'קריאת התורה — ראש חודש', RC_READING, { note: 'לוי חוזר מ״ואמרת להם״ (הוראת הסידור).' })]),
      torahAfter(),
      ashreiStep(c),
      step('uva-lesion', 'ובא לציון, בית יעקב ושיר המעלות', S('Rosh Hodesh, Uva LeSion')),
      step('song-of-day', 'שיר של יום', S('Rosh Hodesh, Song of the Day'), { ranges: [[0, 0], [1 + weekday * 2, 2 + weekday * 2]] }),
      step('return-torah', 'החזרת ספר תורה, חצי קדיש וחליצת תפילין', S('Rosh Hodesh, Song of the Day'), { range: [14, 18] }),
      step('mussaf', 'מוסף לראש חודש', S('Rosh Hodesh, Mussaf'), { range: [0, 47], prayerType: 'mussaf' }),
      step('barchi-nafshi', 'ברכי נפשי', S('Rosh Hodesh, Barchi Nafshi'), { range: [0, 2] }),
      ...(withChanukah ? [step('chanukah-psalm', 'מזמור שיר חנוכת הבית', S('Weekday Shacharit, Song of the Day'), { range: [18, 19] })] : []),
      step('kaddish-yehe-shlama', 'קדיש יהא שלמא', S('Rosh Hodesh, Barchi Nafshi'), { range: [3, 5] }),
      step('kaveh', 'קוה', S('Rosh Hodesh, Kaveh')),
      step('incense', 'פטום הקטורת', S('Rosh Hodesh, Incense Offering')),
      step('alenu', 'עלינו לשבח', S('Rosh Hodesh, Alenu')),
    ],
    highlights: [link('יעלה ויבוא בעמידה', 'amida', 'יעלה ויבא'), ...(withChanukah ? [link('על הניסים', 'amida', 'על הנסים'), link('הלל שלם', 'hallel')] : [link('חצי הלל', 'hallel')]), link('קריאת התורה', 'torah'), ...(withChanukah ? [link('קריאת חנוכה', 'torah-chanukah')] : []), link('מוסף לראש חודש', 'mussaf'), link('ברכי נפשי', 'barchi-nafshi'), link('אין תחנון ואין למנצח', 'ashrei')],
  };
}

function chanukahShacharit(context, c) {
  const day = chanukahDayOf(context) || 1;
  return {
    steps: [
      ...weekdayPrelude(),
      amidaStep({ hallelDay: true }),
      // "גומרים ההלל" — the full Hallel with its blessing; after it only half Kaddish ("ובחנוכה אומר רק חצי קדיש").
      step('hallel', 'הלל שלם', S('Rosh Hodesh, Hallel'), { ranges: [[0, 0], [2, 6], [8, 9], [11, 22], [24, 26]] }),
      // "מוציאים ספר תורה ואין אומרים בריך שמיה, קוראים ג׳ גברי".
      step('torah-service', 'הוצאת ספר תורה', S('Weekday Shacharit, Torah Reading'), { ranges: [[0, 0], [5, 15]] }),
      torah('torah', `קריאת התורה — חנוכה, יום ${['', 'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שביעי', 'שמיני'][day]}`, chanukahReading(day), day === 1 ? { note: 'ביום הראשון מתחילים ב״וידבר… דבר אל אהרן״ (ברכת כהנים) — כף החיים תרפד, ד.' } : { note: 'ישראל חוזר וקורא את קרבן היום כולו (הוראת הסידור).' }),
      torahAfter(),
      ashreiStep(c),
      // "אין אומרים יענך ותפלה לדוד … ואחרי הושיענו אומרים מזמור שיר חנוכת" (¶2).
      ...weekdayClose(c, weekdayOf(context)),
    ],
    highlights: [link('על הניסים בעמידה', 'amida', 'על הנסים'), link('הלל שלם', 'hallel'), link('קריאת חנוכה', 'torah'), link('מזמור שיר חנוכת הבית', 'song-of-day', 'חנכת הבית'), link('אין תחנון ואין למנצח', 'ashrei')],
  };
}

const FAST_SECTION = { tzomGedaliah: 'Fast of Gedalya', asaraBetevet: 'Tenth of Tevet', taanitEsther: 'Fast of Esther', shivaAsarBetammuz: 'Seventeenth of Tammuz' };
function fastShacharit(context, c) {
  const which = Object.keys(FAST_SECTION).find(key => c[key]);
  return {
    steps: [
      ...weekdayPrelude(),
      amidaStep(),
      // "אחר החזרה אומרים וידוי ונפילת אפים, ואחר כך אומרים" — then the fast's own selichot.
      step('vidui', 'וידוי ונפילת אפים', S('Weekday Shacharit, Vidui')),
      ...(which ? [step('selichot', 'סליחות לתענית', S(`Fast Days and Mourning, ${FAST_SECTION[which]}`), { range: [1, 200] })] : []),
      step('torah-service', 'הוצאת ספר תורה', S('Weekday Shacharit, Torah Reading'), { ranges: [[0, 0], [2, 3], [6, 15]] }),
      torah('torah', 'קריאת התורה — ויחל', VAYECHAL),
      torahAfter(),
      ashreiStep(c),
      ...weekdayClose(c, weekdayOf(context)),
    ],
    highlights: [link('עננו בחזרת הש״ץ', 'amida', 'עננו'), link('וידוי ונפילת אפים', 'vidui'), ...(which ? [link('סליחות', 'selichot')] : []), link('קריאת ויחל', 'torah'), link('מזמור היום', 'song-of-day')],
  };
}

function purimShacharit(context, c) {
  return {
    steps: [
      ...weekdayPrelude(),
      // "ולאחר העמידה יהי שם וחצי קדיש" (Purim Day ¶1).
      amidaStep(),
      step('half-kaddish', 'חצי קדיש', S('Weekday Shacharit, Torah Reading'), { range: [19, 20] }),
      step('torah-service', 'הוצאת ספר תורה', S('Weekday Shacharit, Torah Reading'), { ranges: [[0, 0], [5, 15]] }),
      torah('torah', 'קריאת התורה — ויבא עמלק', [{ label: 'כהן', ref: 'Exodus 17:8-17:10' }, { label: 'לוי', ref: 'Exodus 17:11-17:13' }, { label: 'ישראל', ref: 'Exodus 17:14-17:16' }], { note: 'נוהגים לחזור על הפסוק האחרון פעם נוספת, להשלים לעשרה פסוקים (הוראת הסידור).' }),
      torahAfter(),
      ashreiStep(c),
      // "ובא לציון עד מעתה ועד עולם, וקורין המגילה בברכותיה לפניה ולאחריה".
      step('uva-lesion', 'ובא לציון', S('Weekday Shacharit, Uva LeSion'), { range: [0, 1] }),
      step('megillah-before', 'ברכות המגילה', S('Purim, Megillah Reading'), { range: [0, 4] }),
      torah('megillah', 'מגילת אסתר', [{ label: 'מגילת אסתר', ref: 'Esther 1:1-10:3' }]),
      step('megillah-after', 'אחר המגילה', S('Purim, Megillah Reading'), { range: [8, 13] }),
      // "אחר המגילה אומרים ואתה קדוש, קדיש תתקבל, יהללו, ומחזירין הס״ת למקומו".
      step('titkabal', 'ואתה קדוש, קדיש תתקבל והחזרת ספר תורה', S('Weekday Shacharit, Uva LeSion'), { range: [2, 9] }),
      beitYaakovStep(c),
      ...songOfTheDay(c, weekdayOf(context)),
      step('kaveh', 'קוה', S('Weekday Shacharit, Kaveh')),
      step('alenu', 'עלינו לשבח', S('Weekday Shacharit, Alenu')),
    ],
    highlights: [link('על הניסים בעמידה', 'amida', 'על הנסים'), link('קריאת ויבא עמלק', 'torah'), link('מגילת אסתר', 'megillah'), link('למנצח על אילת השחר', 'song-of-day', 'אילת השחר')],
  };
}

function pesachCholHamoedShacharit(context, c) {
  const day = Number(context.hebrewDate.day);
  const hd17 = new Date(`${context.key}T12:00:00Z`);
  hd17.setUTCDate(hd17.getUTCDate() + (17 - day));
  const reading = pesachCholHamoedReading(day, hd17.getUTCDay());
  return {
    steps: [
      ...weekdayPrelude({ tefillin: false }),
      amidaStep({ hallelDay: true }),
      hallelStep(c),
      step('torah-service', 'הוצאת ספר תורה', S('Weekday Shacharit, Torah Reading'), { ranges: [[0, 0], [5, 15]] }),
      torah('torah', 'קריאת התורה — חול המועד פסח', reading || [], { note: 'מוציאים שני ספרים; הרביעי קורא בספר השני ״והקרבתם״.' }),
      torahAfter(),
      ashreiStep(c),
      step('uva-lesion', 'ובא לציון', S('Rosh Hodesh, Uva LeSion')),
      ...songOfTheDay(c, weekdayOf(context)),
      step('return-torah', 'החזרת ספר תורה וחצי קדיש', S('Rosh Hodesh, Song of the Day'), { ranges: [[14, 15], [18, 18]] }),
      step('mussaf', 'מוסף לחול המועד', S('Prayers for Three Festivals, Mussaf'), { range: [0, 58], prayerType: 'mussaf' }),
      step('yehi-shem', 'יהי שם וקדיש תתקבל', S('Rosh Hodesh, Mussaf'), { range: [42, 47] }),
      step('festival-psalm', 'מזמור לפסח', S('Prayers for Three Festivals, Song for Passover'), { range: [0, 1] }),
      step('kaddish-yehe-shlama', 'קדיש יהא שלמא', S('Rosh Hodesh, Barchi Nafshi'), { range: [3, 5] }),
      step('kaveh', 'קוה', S('Weekday Shacharit, Kaveh')),
      step('alenu', 'עלינו לשבח', S('Weekday Shacharit, Alenu')),
    ].filter(item => item.kind !== 'torah' || item.aliyot.length),
    highlights: [link('יעלה ויבוא בעמידה', 'amida', 'יעלה ויבא'), link('חצי הלל', 'hallel'), link('קריאת התורה', 'torah'), link('מוסף לחול המועד', 'mussaf'), link('מזמור לפסח', 'festival-psalm'), link('אין מניחים תפילין', 'talit')],
  };
}

// Mincha of a weekday special day: Tachanun days keep Vidui; a fast day reads ויחל before the Amidah.
function specialMincha(c) {
  return {
    steps: [
      step('offerings', 'קרבנות ואשרי', S('Weekday Mincha, Offerings')),
      ...(c.fast ? [
        step('torah-service', 'הוצאת ספר תורה', S('Weekday Shacharit, Torah Reading'), { ranges: [[0, 0], [2, 3], [6, 15]] }),
        torah('torah', 'קריאת התורה — ויחל', VAYECHAL, { note: 'במנחה של תענית ציבור אין מפטירים (כף החיים תקסו, י).' }),
        torahAfter(),
      ] : []),
      step('amida', 'עמידה', S('Weekday Mincha, Amida')),
      ...(c.tachanun ? [step('vidui', 'וידוי ונפילת אפים', S('Weekday Mincha, Vidui'))] : []),
      step('alenu', 'עלינו לשבח', S('Weekday Mincha, Alenu')),
    ],
    highlights: [
      ...(c.roshChodesh || c.cholHamoed ? [link('יעלה ויבוא בעמידה', 'amida', 'יעלה ויבא')] : []),
      ...(c.chanukah || c.purim ? [link('על הניסים בעמידה', 'amida', 'על הנסים')] : []),
      ...(c.fast ? [link('קריאת ויחל', 'torah'), link('עננו', 'amida', 'עננו')] : []),
      ...(!c.tachanun ? [link('אין וידוי ואין תחנון', 'alenu')] : []),
    ],
  };
}

// Arvit of Purim night: after the Amidah the Megillah, then ואתה קדוש, Kaddish Titkabal, Ps 124, Ps 121,
// Kaddish Yehe Shelama, Barchu, Alenu (Purim, Megillah Reading ¶14).
function purimMaariv() {
  return {
    steps: [
      step('barchu', 'ברכו', S('Weekday Arvit, Barchu')),
      step('shema', 'קריאת שמע וברכותיה', S('Weekday Arvit, The Shema')),
      step('amida', 'עמידה', S('Weekday Arvit, Amidah'), { range: [0, 51] }),
      step('megillah-before', 'ברכות המגילה', S('Purim, Megillah Reading'), { range: [0, 6] }),
      torah('megillah', 'מגילת אסתר', [{ label: 'מגילת אסתר', ref: 'Esther 1:1-10:3' }]),
      step('megillah-after', 'אחר המגילה', S('Purim, Megillah Reading'), { range: [8, 14] }),
      step('ve-ata-kadosh', 'ואתה קדוש', S('Weekday Arvit, Amidah'), { range: [59, 59] }),
      step('titkabal', 'קדיש תתקבל', S('Weekday Arvit, Amidah'), { range: [61, 65] }),
      step('ps-124', 'שיר המעלות לדוד', S('Weekday Shacharit, Beit Yaakov'), { range: [4, 4] }),
      step('ps-121', 'שיר למעלות וקדיש', S('Weekday Arvit, Amidah'), { range: [66, 72] }),
      step('alenu', 'עלינו לשבח', S('Weekday Arvit, Alenu')),
    ],
    highlights: [link('על הניסים בעמידה', 'amida', 'על הנסים'), link('מגילת אסתר', 'megillah')],
  };
}

// ——— Shemini Atzeret / Simchat Torah, Eretz Yisrael (SA OC 668–669; Kaf HaChaim; the edition's own rubrics) ———
const FEST = section => S(`Prayers for Three Festivals, ${section}`);
// The festival Amidah (¶0–55). Arvit is silent only: no Kedusha (¶6–7), Modim deRabanan (¶34) or Birkat Kohanim (¶36–48).
const festivalAmidah = prayerType => prayerType === 'maariv'
  ? step('amida', 'עמידה ליום טוב', FEST('Amidah'), { ranges: [[0, 5], [8, 33], [35, 35], [49, 55]] })
  : prayerType === 'mincha'
    ? step('amida', 'עמידה ליום טוב', FEST('Amidah'), { ranges: [[0, 35], [49, 55]] })
    : step('amida', 'עמידה ליום טוב', FEST('Amidah'), { range: [0, 55] });
const halfKaddish = id => step(id, 'חצי קדיש', S('Weekday Shacharit, Torah Reading'), { range: [19, 20] });
const torahOut = () => step('torah-out', 'הוצאת ספר תורה', S('Shabbat Shacharit, Torah Reading'), { range: [0, 16] });
const hakafot = when => step(`hakafot-${when}`, when === 'night' ? 'הקפות — ליל שמחת תורה' : 'הקפות', F('Hakafot, Simchat Torah'), {
  note: when === 'night'
    ? 'אחר ערבית מוציאים את ספרי התורה ומקיפים את התיבה שבע הקפות (בן איש חי, וזאת הברכה יז; כף החיים תרסט, ל).'
    : 'מקיפים שבע הקפות לפני קריאת התורה (כף החיים תרסט, ל).',
});

function sheminiAtzeretMaariv(c) {
  return {
    steps: [
      // The edition: on Yom Tov that falls on Shabbat "במה מדליקין" is not said (Kabbalat Shabbat ¶27).
      step('kabbalat-shabbat', 'קבלת שבת', S('Kabbalat Shabbat'), { ranges: [[0, 0], [7, 26]], note: 'ביום טוב שחל בשבת מתחילים ״מזמור לדוד״; ״במה מדליקין״ אינו נאמר (הוראת הסידור).', when: c.shabbat }),
      // "בשלוש רגלים לפני תפילת ערבית… אומרים את המזמור השייך לאותו הרגל" — Ps 12 for Shemini Atzeret.
      step('festival-psalm', 'מזמור לשמיני עצרת', FEST('Song for Shemini Atzeret'), { range: [0, 1] }),
      step('barchu', 'ברכו', S('Shabbat Arvit, Barchu')),
      step('shema', 'קריאת שמע וברכותיה', S('Shabbat Arvit, The Shema'), { range: [0, 12] }),
      // "מתפללים ערבית כמו בשבת ואחר השכיבנו (ובשבת אחר ושמרו) אומרים אלה מועדי", then half Kaddish.
      step('ele-moadei', 'אלה מועדי וחצי קדיש', FEST('Song for Shemini Atzeret'), { range: [2, 5] }),
      festivalAmidah('maariv'),
      ...(c.shabbat ? [step('vayechulu', 'ויכולו, מעין שבע וקדיש תתקבל', S('Shabbat Arvit, Magen Avot'), { range: [33, 42] })] : []),
      // Ps 23 (Shabbat) and Ps 122, Kaddish Yehe Shelama, Alenu — the festival Amidah's closing rubrics.
      step('psalms', 'מזמורים וקדיש', FEST('Amidah'), { range: [59, 68] }),
      step('alenu', 'עלינו לשבח', FEST('Amidah'), { range: [69, 71] }),
      step('torah-out', 'הוצאת ספרי התורה', S('Shabbat Shacharit, Torah Reading'), { range: [0, 16] }),
      hakafot('night'),
    ].filter(item => item.when !== false),
    highlights: [link('מזמור לשמיני עצרת', 'festival-psalm'), link('אלה מועדי', 'ele-moadei'), link('עמידה ליום טוב', 'amida'), ...(c.shabbat ? [link('ויכולו ומעין שבע', 'vayechulu')] : []), link('הקפות', 'hakafot-night'), link('מוריד הטל — משיב הרוח מתחיל רק במוסף', 'amida', 'מוריד הטל')],
  };
}

function sheminiAtzeretShacharit(c) {
  return {
    steps: [
      step('petichat-eliyahu', 'פתח אליהו', S('Weekday Shacharit, Petichat Eliyahu')),
      step('talit', 'סדר עטיפת טלית', S('Weekday Shacharit, Order of Talit')),
      step('hanna', 'תפלת חנה', S("Weekday Shacharit, Hanna's Prayer")),
      step('korbanot', 'קרבנות וקטורת', S('Weekday Shacharit, Incense Offering')),
      // "מתפללים שחרית של חול עד סוף ה׳ מלך וממשיכים" (Shabbat Shacharit ¶1).
      step('hodu', 'הודו', S('Weekday Shacharit, Hodu'), { range: [0, 11] }),
      step('shabbat-psalms', 'מזמורי שבת ויום טוב', S('Shabbat Shacharit, Psalms for Shabbat'), { range: [2, 6] }),
      // "ובשחרית לאחר יושב בסתר עליון… אומרים את המזמור השייך לאותו הרגל" — Ps 12.
      step('festival-psalm', 'מזמור לשמיני עצרת', FEST('Song for Shemini Atzeret'), { range: [0, 1] }),
      step('shabbat-psalms-2', 'מזמורי שבת ויום טוב', S('Shabbat Shacharit, Psalms for Shabbat'), { range: [8, 39] }),
      step('pesukei-dezimra', 'פסוקי דזמרה', S("Shabbat Shacharit, Pesukei D'Zimra")),
      step('shema', 'קריאת שמע וברכותיה', S('Shabbat Shacharit, The Shema')),
      festivalAmidah('shacharit'),
      // SA OC 644:1 — full Hallel with its blessing on Shemini Atzeret; Kaddish Titkabal after it (no Hoshanot today).
      hallelStep({ ...c, fullHallel: true }),
      torahOut(),
      hakafot('day'),
      step('aliyah-blessings', 'ברכות העולה', S('Shabbat Shacharit, Torah Reading'), { range: [17, 25] }),
      // The edition's continuation (Wikisource), "קריאת התורה לסוכות": שמחת תורה; KH 669:2–8.
      { id: 'torah', kind: 'torah', title: 'קריאת התורה — וזאת הברכה', note: 'בספר הראשון. חתן תורה קורא מתחילת הפרשה ועד סוף התורה (כף החיים תרסט, ב).', aliyot: [
        { label: 'כהן', ref: 'Deuteronomy 33:1-33:7' }, { label: 'לוי', ref: 'Deuteronomy 33:8-33:12' }, { label: 'שלישי', ref: 'Deuteronomy 33:13-33:17' },
        { label: 'רביעי', ref: 'Deuteronomy 33:18-33:23' }, { label: 'חמישי', ref: 'Deuteronomy 33:24-33:26' }, { label: 'חתן מעונה', ref: 'Deuteronomy 33:27-33:29' },
        { label: 'חתן תורה', ref: 'Deuteronomy 33:1-34:12' },
      ] },
      { id: 'chatan-bereshit', kind: 'torah', title: 'חתן בראשית', note: 'בספר השני, בלי קדיש בין חתן תורה לחתן בראשית (כף החיים תרסט, ח).', aliyot: [{ label: 'חתן בראשית', ref: 'Genesis 1:1-2:3' }] },
      step('after-blessing', 'ברכה אחרונה', S('Shabbat Shacharit, Torah Reading'), { range: [26, 27] }),
      halfKaddish('kaddish-after-bereshit'),
      { id: 'maftir', kind: 'torah', title: 'מפטיר', note: 'בספר השלישי.', aliyot: [{ label: 'מפטיר', ref: 'Numbers 29:35-30:1' }] },
      halfKaddish('kaddish-after-maftir'),
      step('haftarah-before', 'ברכות ההפטרה', S('Shabbat Shacharit, Haftarah'), { range: [0, 2] }),
      { id: 'haftarah', kind: 'torah', title: 'הפטרה — ויהי אחרי מות משה', aliyot: [{ label: 'הפטרה', ref: 'Joshua 1:1-1:9' }] },
      step('haftarah-after', 'ברכות אחר ההפטרה', S('Shabbat Shacharit, Haftarah'), { range: [3, 9], note: 'ביום טוב מזכירים בברכה האחרונה גם את החג — ״ועל יום שמיני חג העצרת הזה״ — וחותמים ״מקדש השבת וישראל והזמנים״ (ברכות מט ע״א).' }),
      // KH 114:14 — after the reading and the haftarah, the Geshem piyyutim; then the scrolls return,
      // Kaddish, and the announcement before the silent Mussaf (SA 114:2, 668:2).
      step('geshem', 'תפילת הגשם', F('Tikkun HaGeshem'), { note: 'אחר ההפטרה אומרים את תיקון הגשם, כדי שידעו הכל להזכיר ״משיב הרוח ומוריד הגשם״ במוסף (כף החיים קיד, יד).' }),
      step('ashrei', 'אשרי והחזרת ספרי התורה', S('Shabbat Shacharit, Ashrei'), { range: [0, 9] }),
      step('announcement', 'חצי קדיש והכרזה', S('Weekday Shacharit, Torah Reading'), { range: [19, 20], note: 'אחר החזרת הספרים אומר החזן חצי קדיש ומכריז: ״משיב הרוח ומוריד הגשם״ (שו״ע או״ח קיד, ב; תרסח, ב).' }),
      step('mussaf', 'מוסף ליום טוב', FEST('Mussaf'), { range: [0, 57], prayerType: 'mussaf' }),
      step('yehi-shem', 'יהי שם וקדיש תתקבל', S('Rosh Hodesh, Mussaf'), { range: [42, 47] }),
      step('incense', 'פטום הקטורת', S('Shabbat Mussaf, Incense Offering')),
      step('alenu', 'עלינו לשבח', S('Shabbat Mussaf, Alenu')),
    ],
    highlights: [link('מזמור לשמיני עצרת', 'festival-psalm'), link('עמידה ליום טוב', 'amida'), link('הלל שלם', 'hallel'), link('הקפות', 'hakafot-day'), link('וזאת הברכה, חתן תורה וחתן בראשית', 'torah'), link('הפטרת יהושע', 'haftarah'), link('תפילת הגשם', 'geshem'), link('משיב הרוח ומוריד הגשם — מהמוסף', 'mussaf', 'משיב הרוח')],
  };
}

function sheminiAtzeretMincha(c) {
  return {
    steps: [
      step('offerings', 'קרבנות', S('Shabbat Mincha, Offerings')),
      step('uva-lesion', 'ובא לציון והוצאת ספר תורה', S('Shabbat Mincha, Uva LeSion'), { range: [0, 15] }),
      // KH 668:22 — when Shemini Atzeret falls on Shabbat, Mincha in Eretz Yisrael reads Bereshit.
      ...(c.shabbat ? [{ id: 'torah', kind: 'torah', title: 'קריאת התורה — בראשית', aliyot: [{ label: 'כהן', ref: 'Genesis 1:1-1:5' }, { label: 'לוי', ref: 'Genesis 1:6-1:8' }, { label: 'ישראל', ref: 'Genesis 1:9-1:13' }] }] : []),
      step('return-torah', 'החזרת ספר תורה וחצי קדיש', S('Shabbat Mincha, Uva LeSion'), { range: [18, 22] }),
      festivalAmidah('mincha'),
      // "ביום שאין אומרים בו תחנון במנחה אין אומרים בו צדקתך אלא אומרים יהי שם".
      step('yehi-shem', 'יהי שם', FEST('Amidah'), { range: [56, 57] }),
      step('titkabal', 'קדיש תתקבל', S('Shabbat Mincha, Amida'), { range: [39, 47] }),
      step('alenu', 'עלינו לשבח', S('Shabbat Mincha, Alenu')),
    ],
    highlights: [link('עמידה ליום טוב', 'amida'), ...(c.shabbat ? [link('קריאת בראשית', 'torah')] : []), link('אין צדקתך', 'yehi-shem'), link('משיב הרוח ומוריד הגשם', 'amida', 'משיב הרוח')],
  };
}

export function planDayService({ prayer, context }) {
  const c = dayConditionsFromContext(context);
  const support = dayServiceSupport(context);
  const title = `${DAY_SERVICE_TITLES[prayer] || 'תפילה'}${c.sheminiAtzeret ? ' לשמיני עצרת' : c.hoshanaRabbah ? ' להושענא רבה' : c.cholHamoed && c.sukkot ? ' לחול המועד סוכות' : c.cholHamoed && c.pesach ? ' לחול המועד פסח' : c.roshChodesh && c.chanukah ? ' לראש חודש וחנוכה' : c.roshChodesh ? ' לראש חודש' : c.chanukah ? ' לחנוכה' : c.purim ? ' לפורים' : c.fast ? ' לתענית ציבור' : ''}`;
  let body;
  if (prayer === 'birkat-hamazon') body = { steps: [step('birkat-hamazon', 'ברכת המזון', S('Post Meal Blessing'))], highlights: c.cholHamoed || c.yomTov || c.roshChodesh ? [link('יעלה ויבוא', 'birkat-hamazon', 'יעלה ויבא'), ...(c.sukkot ? [link('הרחמן הוא יקים לנו את סוכת דוד', 'birkat-hamazon', 'סכת דוד')] : [])] : [] };
  else if (!support.supported) body = null;
  else if (support.reason === 'shemini-atzeret') body = prayer === 'shacharit' ? sheminiAtzeretShacharit(c) : prayer === 'mincha' ? sheminiAtzeretMincha(c) : sheminiAtzeretMaariv(c);
  else if (support.reason === 'chol-hamoed-sukkot') body = prayer === 'shacharit' ? cholHamoedSukkotShacharit(context, c) : prayer === 'mincha' ? cholHamoedMincha() : cholHamoedMaariv(c);
  else if (prayer === 'maariv') body = support.reason === 'purim' ? purimMaariv() : cholHamoedMaariv(c);
  else if (prayer === 'mincha') body = specialMincha(c);
  else if (support.reason === 'chol-hamoed-pesach') body = pesachCholHamoedShacharit(context, c);
  else if (support.reason === 'rosh-chodesh') body = roshChodeshShacharit(context, c);
  else if (support.reason === 'chanukah') body = chanukahShacharit(context, c);
  else if (support.reason === 'purim') body = purimShacharit(context, c);
  else if (support.reason === 'fast') body = fastShacharit(context, c);
  if (!body) return { title, dayLabel: dayLabel(context, c), status: 'unsupported', reason: support.reason, steps: [], highlights: [] };
  // Shacharit always opens with ברכות השחר (birchotHashacharSteps), whatever the day adds later.
  const steps = prayer === 'shacharit' ? [...birchotHashacharSteps(c), ...body.steps] : body.steps;
  return { title, dayLabel: dayLabel(context, c), status: 'adapted', steps, highlights: body.highlights || [] };
}

export const WEEKDAY_LABELS = WEEKDAY_NAMES;
