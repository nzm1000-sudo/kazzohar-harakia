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
  if (c.fast) parts.push('תענית ציבור');
  return parts.filter(Boolean).join(' · ');
}

// Days the Smart Siddur composes today. Everything else keeps the printed service (with the day-condition engine).
export function dayServiceSupport(context) {
  const c = dayConditionsFromContext(context);
  if (!c.resolved) return { supported: false, reason: 'unresolved-day' };
  // Shemini Atzeret / Simchat Torah in Eretz Yisrael (one day). Abroad the two days read differently — not yet.
  if (c.sheminiAtzeret && context.isIsrael) return { supported: true, reason: 'shemini-atzeret' };
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

// Arvit is the service of the coming night: before sunset it is composed for the evening that follows.
export function dayServiceInstant(prayer, now = new Date(), times = null) {
  const sunset = times?.sunset ? new Date(times.sunset) : null;
  if (prayer === 'maariv' && sunset && Number.isFinite(sunset.getTime()) && now < sunset) return new Date(sunset.getTime() + 10 * 60 * 1000);
  return now;
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
    highlights: ['מזמור לשמיני עצרת', 'אלה מועדי', 'עמידה ליום טוב', ...(c.shabbat ? ['ויכולו ומעין שבע'] : []), 'הקפות', 'מוריד הטל — משיב הרוח מתחיל רק במוסף'],
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
    highlights: ['מזמור לשמיני עצרת', 'עמידה ליום טוב', 'הלל שלם', 'הקפות', 'וזאת הברכה, חתן תורה וחתן בראשית', 'הפטרת יהושע', 'תפילת הגשם', 'משיב הרוח ומוריד הגשם — מהמוסף'],
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
    highlights: ['עמידה ליום טוב', ...(c.shabbat ? ['קריאת בראשית'] : []), 'אין צדקתך', 'משיב הרוח ומוריד הגשם'],
  };
}

export function planDayService({ prayer, context }) {
  const c = dayConditionsFromContext(context);
  const support = dayServiceSupport(context);
  const title = `${DAY_SERVICE_TITLES[prayer] || 'תפילה'}${c.sheminiAtzeret ? ' לשמיני עצרת' : c.hoshanaRabbah ? ' להושענא רבה' : c.cholHamoed && c.sukkot ? ' לחול המועד סוכות' : ''}`;
  let body;
  if (prayer === 'birkat-hamazon') body = { steps: [step('birkat-hamazon', 'ברכת המזון', S('Post Meal Blessing'))], highlights: c.cholHamoed || c.yomTov || c.roshChodesh ? ['יעלה ויבוא', ...(c.sukkot ? ['הרחמן הוא יקים לנו את סוכת דוד'] : [])] : [] };
  else if (!support.supported) body = null;
  else if (support.reason === 'shemini-atzeret') body = prayer === 'shacharit' ? sheminiAtzeretShacharit(c) : prayer === 'mincha' ? sheminiAtzeretMincha(c) : sheminiAtzeretMaariv(c);
  else if (prayer === 'shacharit') body = cholHamoedSukkotShacharit(context, c);
  else if (prayer === 'mincha') body = cholHamoedMincha();
  else if (prayer === 'maariv') body = cholHamoedMaariv(c);
  if (!body) return { title, dayLabel: dayLabel(context, c), status: 'unsupported', reason: support.reason, steps: [], highlights: [] };
  return { title, dayLabel: dayLabel(context, c), status: 'adapted', steps: body.steps, highlights: body.highlights || [] };
}

export const WEEKDAY_LABELS = WEEKDAY_NAMES;
