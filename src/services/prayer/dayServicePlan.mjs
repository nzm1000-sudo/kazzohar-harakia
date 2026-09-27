// The Smart Siddur's order of service for one prayer day: which sections, in which order, and which
// part of each. Pure: the app's Jewish context (JewishContextEngine) in, a plan out. The text itself is
// never written here — every step points into a bundled edition by reference and paragraph range.
// Sources for the order: the edition's own instructions (quoted per step) and Shulchan Arukh OC.
import { cholHamoedSukkotReading, READINGS_SOURCE } from './festivalReadings.mjs';
import { dayConditionsFromContext } from './rubricConditions.mjs';

const S = section => `Siddur Edot HaMizrach, ${section}`;
const F = text => `Festival Liturgy, ${text}`;
const WEEKDAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];

// Recording in "המצוות שלי" under the same keys as the printed services.
export const DAY_SERVICE_COMPLETION = Object.freeze({ shacharit: 'Weekday Shacharit', mincha: 'Weekday Mincha', maariv: 'Weekday Arvit', 'birkat-hamazon': 'Post Meal Blessing' });
export const DAY_SERVICE_TITLES = Object.freeze({ shacharit: 'שחרית', mincha: 'מנחה', maariv: 'ערבית', 'birkat-hamazon': 'ברכת המזון' });

// Sephardim say the Hoshanot right after Hallel, before Kaddish Titkabal and the Torah reading
// (Kaf HaChaim 660:4 — the Ari, the custom of Jerusalem, the Chida; after Mussaf is the Tur's order).

const step = (id, title, ref, extra = {}) => ({ id, kind: 'siddur', title, ref, ...extra });

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
export function torahServiceStep(c) {
  const ranges = c.tachanun ? [[0, 0], [2, 3], [6, 15]] : [[0, 0], [5, 15]];
  return step('torah-service', 'הוצאת ספר תורה', S('Weekday Shacharit, Torah Reading'), { ranges });
}

function dayLabel(context, c) {
  const parts = [context.hebrewDate?.label];
  if (c.cholHamoed) parts.push(c.sukkot ? 'חול המועד סוכות' : 'חול המועד פסח');
  if (c.hoshanaRabbah) parts.push('הושענא רבה');
  if (c.roshChodesh) parts.push('ראש חודש');
  if (c.chanukah) parts.push('חנוכה');
  if (c.fast) parts.push('תענית ציבור');
  return parts.filter(Boolean).join(' · ');
}

// Days the Smart Siddur composes today. Everything else keeps the printed service (with the day-condition engine).
export function dayServiceSupport(context) {
  const c = dayConditionsFromContext(context);
  if (!c.resolved) return { supported: false, reason: 'unresolved-day' };
  if (c.yomTov || c.shabbat) return { supported: false, reason: 'yom-tov-or-shabbat' };
  if (c.cholHamoed && c.sukkot) return { supported: true, reason: 'chol-hamoed-sukkot' };
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
    step('amida', 'עמידה', S('Weekday Shacharit, Amida')),
    // SA OC 644:1 — after the repetition: the lulav with its blessings, then the complete Hallel.
    step('lulav', 'נטילת לולב', F('Netilat Lulav')),
    hallelStep(c, { withKaddish: false }),
    ...hoshanot,

    torahServiceStep(c),
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
    highlights: ['יעלה ויבוא בעמידה', 'נטילת לולב והלל שלם', c.hoshanaRabbah ? 'הושענות — שבע הקפות' : 'הושענות', 'קריאת התורה בקרבנות החג', 'מוסף לחול המועד', 'אין תחנון ואין למנצח', 'אין מניחים תפילין'],
  };
}

function cholHamoedMincha() {
  return {
    steps: [
      step('offerings', 'קרבנות', S('Weekday Mincha, Offerings')),
      step('amida', 'עמידה', S('Weekday Mincha, Amida')),
      step('alenu', 'עלינו לשבח', S('Weekday Mincha, Alenu')),
    ],
    highlights: ['יעלה ויבוא בעמידה', 'אין וידוי ואין תחנון'],
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
    highlights: ['יעלה ויבוא בעמידה'],
  };
}

export function planDayService({ prayer, context }) {
  const c = dayConditionsFromContext(context);
  const support = dayServiceSupport(context);
  const title = `${DAY_SERVICE_TITLES[prayer] || 'תפילה'}${c.hoshanaRabbah ? ' להושענא רבה' : c.cholHamoed && c.sukkot ? ' לחול המועד סוכות' : ''}`;
  let body;
  if (prayer === 'birkat-hamazon') body = { steps: [step('birkat-hamazon', 'ברכת המזון', S('Post Meal Blessing'))], highlights: c.cholHamoed || c.yomTov || c.roshChodesh ? ['יעלה ויבוא', ...(c.sukkot ? ['הרחמן הוא יקים לנו את סוכת דוד'] : [])] : [] };
  else if (!support.supported) body = null;
  else if (prayer === 'shacharit') body = cholHamoedSukkotShacharit(context, c);
  else if (prayer === 'mincha') body = cholHamoedMincha();
  else if (prayer === 'maariv') body = cholHamoedMaariv(c);
  if (!body) return { title, dayLabel: dayLabel(context, c), status: 'unsupported', reason: support.reason, steps: [], highlights: [] };
  return { title, dayLabel: dayLabel(context, c), status: 'adapted', steps: body.steps, highlights: body.highlights || [] };
}

export const WEEKDAY_LABELS = WEEKDAY_NAMES;
