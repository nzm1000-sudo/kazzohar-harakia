// The Siddur's own condition captions ("בחול המועד:", "בסוכות:", "בראש חודש ביום טוב ובחול המועד אומרים")
// read as predicates over the prayer day. One explicit table: a caption is either a known day
// condition, a known non-conditional instruction, or unknown (shown as printed — never guessed).
import { removeNikud } from '../../hebrewText.mjs';
import { HDate } from '@hebcal/core';

// Hebcal month numbers.
const NISAN = 1; const SIVAN = 3; const TAMUZ = 4; const AV = 5; const TISHREI = 7; const TEVET = 10;

const weekdayOf = key => (typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) ? new Date(`${key}T12:00:00Z`).getUTCDay() : null);

// Day conditions from the app's Jewish context (JewishContextEngine). `resolved: false` when the
// Hebrew date is unknown — then nothing is filtered and the edition is shown with all its captions.
const KISLEV = 9;
// Is a Hebrew date a day of Yom Tov (a full festival day, not Chol HaMoed)? Israel keeps one day, the diaspora two.
export function isYomTovDate(month, day, israel) {
  if (month === TISHREI) return day === 1 || day === 2 || day === 10 || day === 15 || day === 22 || (!israel && (day === 16 || day === 23));
  if (month === NISAN) return day === 15 || day === 21 || (!israel && (day === 16 || day === 22));
  if (month === SIVAN) return day === 6 || (!israel && day === 7);
  return false;
}
// The day-number keys the calendar gives (the Omer, Chanukah, Chol HaMoed, the days of a festival), from the app's
// own Hebrew date — no second calendar.
export function dayNumbers(hebrewDate, israel) {
  const { day, month, year } = hebrewDate || {};
  if (!day || !month || !year) return {};
  let abs;
  try { abs = new HDate(day, month, year).abs(); } catch { return {}; }
  const from = (d, m, y = year) => abs - new HDate(d, m, y).abs() + 1;
  const omerDay = from(16, NISAN);
  const chanukahDay = month === KISLEV || month === KISLEV + 1 ? from(25, KISLEV, month === KISLEV + 1 ? year : year) : 0;
  const sukkotDay = month === TISHREI && day >= 15 && day <= 21 ? day - 14 : 0;
  const pesachDay = month === NISAN && day >= 15 && day <= (israel ? 21 : 22) ? day - 14 : 0;
  const yesterday = new HDate(abs - 1); const tomorrow = new HDate(abs + 1);
  return {
    omerDay: omerDay >= 1 && omerDay <= 49 ? omerDay : 0,
    chanukahDay: chanukahDay >= 1 && chanukahDay <= 8 ? chanukahDay : 0,
    sukkotDay, pesachDay,
    cholHamoedDay: sukkotDay ? (sukkotDay >= (israel ? 2 : 3) && sukkotDay <= 6 ? sukkotDay - (israel ? 1 : 2) : 0)
      : pesachDay >= (israel ? 2 : 3) && pesachDay <= 6 ? pesachDay - (israel ? 1 : 2) : 0,
    yomTovToday: isYomTovDate(month, day, israel),
    yomTovYesterday: isYomTovDate(yesterday.getMonth(), yesterday.getDate(), israel),
    yomTovTomorrow: isYomTovDate(tomorrow.getMonth(), tomorrow.getDate(), israel),
  };
}
export function dayConditionsFromContext(context = {}) {
  const month = Number(context.hebrewDate?.month);
  const day = Number(context.hebrewDate?.day);
  const resolved = Number.isInteger(month) && month > 0 && Number.isInteger(day) && day > 0;
  const il = Boolean(context.isIsrael);
  const weekday = weekdayOf(context.key);
  const prayerType = context.prayerContext?.type || context.prayerType || null;
  const tishrei = month === TISHREI;
  const pesach = month === NISAN && day >= 15 && day <= (il ? 21 : 22);
  const shavuot = month === SIVAN && (day === 6 || (!il && day === 7));
  const sukkot = tishrei && day >= 15 && day <= 21;
  const sheminiAtzeret = tishrei && (day === 22 || (!il && day === 23));
  const roshHashana = tishrei && (day === 1 || day === 2);
  const yomKippur = tishrei && day === 10;
  const shabbat = weekday === 6;
  const holidays = (context.holidays || []).map(event => String(event?.getDesc?.() || event?.desc || '')).join(' | ');
  const fast = Boolean(context.fast || context.prayerContext?.fast);
  const yomTov = context.isYomTov === true;
  const cholHamoed = context.isCholHaMoed === true;
  // The night after Shabbat / Yom Tov: the Jewish day already moved on (Arvit after sunset).
  const motzaeiShabbat = weekday === 0 && prayerType === 'maariv';
  const numbers = dayNumbers(context.hebrewDate, il);
  // The night after a Yom Tov that falls on a weekday — not Motzaei Shabbat (Havdalah and אתה חוננתנו are said then too).
  const motzaeiYomTov = prayerType === 'maariv' && Boolean(numbers.yomTovYesterday) && !numbers.yomTovToday;
  const year = Number(context.hebrewDate?.year);
  const leapYear = typeof context.hebrewDate?.isLeapYear === 'boolean' ? context.hebrewDate.isLeapYear
    : Number.isInteger(year) && year > 0 && HDate.isLeapYear(year);
  return {
    resolved,
    summer: context.seasonal?.mashivHaruch === false,
    winter: context.seasonal?.mashivHaruch === true,
    rainSummer: context.seasonal?.vetenTalUmatar === false,
    rainWinter: context.seasonal?.vetenTalUmatar === true,
    weekday, shabbat, erevShabbat: weekday === 5, mondayThursday: weekday === 1 || weekday === 4, motzaeiShabbat, motzaeiYomTov,
    roshChodesh: Boolean(context.isRoshChodesh),
    yomTov, cholHamoed, festivalSeason: yomTov || cholHamoed,
    pesach, shavuot, sukkot, sheminiAtzeret, roshHashana, yomKippur,
    hoshanaRabbah: tishrei && day === 21,
    aseret: context.isAseretYemeiTeshuvah === true || (tishrei && day >= 1 && day <= 10),
    shabbatShuva: shabbat && tishrei && day >= 3 && day <= 9,
    chanukah: Boolean(context.chanukah),
    purim: Boolean(context.purim),
    fast,
    tishaBav: fast && month === AV,
    shivaAsarBetammuz: fast && month === TAMUZ,
    tzomGedaliah: fast && tishrei,
    asaraBetevet: fast && month === TEVET,
    taanitEsther: fast && /esther/i.test(holidays),
    tachanun: !context.prayerContext?.omitTachanun,
    fullHallel: context.prayerContext?.hallel === 'הלל שלם',
    halfHallel: context.prayerContext?.hallel === 'חצי הלל',
    // The app's hebrewDate carries no isLeapYear: the year's own calendar decides (a leap year has Adar I and II).
    leapYear,
    // "בשנת העיבור עד חודש ניסן" (the Metsudah / Sefard Rosh Chodesh Musaf: ולכפרת פשע): a leap year, from Tishrei
    // up to (not including) Nisan — the edition's own caption. Adar II has 29 days: Rosh Chodesh Nisan is 1 Nisan.
    leapYearBeforeNisan: leapYear && month >= TISHREI,
  };
}

// A maqaf in a caption ("בראש־חודש", "בראש־השנה") is the space of the same caption elsewhere (before the nikud goes:
// removeNikud takes the maqaf with it).
const clean = text => removeNikud(String(text || '').replace(/־/g, ' '))
  .replace(/<[^>]+>/g, ' ')
  .replace(/״|''|׳׳|[”“]/g, '"').replace(/[׳’]/g, "'")
  .replace(/[‍‎‏]/g, '')
  .replace(/\s+/g, ' ').trim();

const C = c => c; // readability in the table below
// Order matters: the most specific phrase first. `when` → the following text is said when true.
const CONDITIONS = [
  // Caption forms of the Metsudah (Ashkenaz, Sefard) and Torah Or (Chabad) editions.
  [/^בימות החמה/, c => c.rainSummer],
  [/^בימות הגשמים/, c => c.rainWinter],
  [/^בעשי"ת מסיים|^בעשי"ת:?$|^בעשי"ת /, c => c.aseret],
  // The Metsudah Shabbat Musaf / Mincha abbreviations: בעש"ת (the Ten Days, without yod) and בש"ת (Shabbat Shuva).
  [/^בעש"ת:?$/, c => c.aseret],
  [/^בש"ת:?$/, c => c.shabbatShuva],
  // The Rosh Chodesh Musaf's ולכפרת פשע (Sefard prints the caption alone, in brackets with the words).
  [/^בשנת העיבור עד חו?דש ניסן:?$/, c => c.leapYearBeforeNisan],
  [/^בראש חדש ובחול המועד|^בר"ח ובחוה"מ|^בראש חודש וחול המועד|^בראש חו?דש ובחוה"מ/, c => c.roshChodesh || c.cholHamoed],
  // "ביום טוב ובחוה״מ: וְשַׂמְּחֵנוּ בְיוֹם" (the Metsudah Me'ein Shalosh): the festival line is said on Chol HaMoed too.
  [/^ביום טוב ובחוה"מ|^ביום טוב ובחול המועד|^ביו"ט ובחוה"מ/, c => c.yomTov || c.cholHamoed],
  [/^בחנוכה ופורים אומרים/, c => c.chanukah || c.purim],
  [/^בתענית צבור|^בתענית ציבור אומר/, c => c.fast],
  [/^במוצאי שבת ויו"ט/, c => c.motzaeiShabbat || c.motzaeiYomTov],
  [/^במוצ"ש/, c => c.motzaeiShabbat],
  [/^בחוה"מ פסח|^בחול המועד פסח/, c => c.cholHamoed && c.pesach],
  [/^בחוה"מ סוכות|^בחול המועד סוכות/, c => c.cholHamoed && c.sukkot],
  [/^בשבת ר"ח או חול המועד או חנוכה/, c => c.shabbat && (c.roshChodesh || c.cholHamoed || c.chanukah)],
  [/^בראש חודש ביום טוב ובחול המועד/, c => c.roshChodesh || c.yomTov || c.cholHamoed],
  [/^בראש חודש ובחול המועד/, c => c.roshChodesh || c.cholHamoed],
  [/^בחזרת הש"ץ במוסף של יו"ט או שבת/, c => c.yomTov || c.shabbat],
  [/^בחזרת הש"ץ במוסף של חול המועד/, c => c.cholHamoed],
  [/^אם שכח לומר "רצה" או "יעלה ויבא"/, c => c.shabbat || c.roshChodesh || c.yomTov || c.cholHamoed],
  [/^בעשרת ימי תשובה והושענא רבה/, c => c.aseret || c.hoshanaRabbah],
  [/^בעשרת ימי תשובה/, c => c.aseret],
  [/^בשבת תשובה|^בשבת שובה/, c => c.shabbatShuva],
  [/^בחנוכה ופורים/, c => c.chanukah || c.purim],
  [/^בתענית אסתר ובפורים/, c => c.taanitEsther || c.purim],
  [/^בחנוכה/, c => c.chanukah],
  [/^בפורים/, c => c.purim],
  [/^בצום גדליה ובעשרה בטבת/, c => c.tzomGedaliah || c.asaraBetevet],
  [/^בשבעה עשר בתמוז/, c => c.shivaAsarBetammuz],
  [/^בתשעה באב|^במנחת תשעה באב|^במנחת ט' באב/, c => c.tishaBav],
  [/^בתענית ציבור|^בתעניות ציבור|^בתענית|^ביום תענית|^נוסח עננו/, c => c.fast],
  [/^בליל ראש חודש/, c => c.roshChodesh],
  [/^בראש חודש|^בראש חדש|^בראש-חודש|^בר"ח|^ביום ראש חודש/, c => c.roshChodesh],
  [/^בחול המועד|^בחוה"מ/, c => c.cholHamoed],
  [/^במוסף לפסח/, c => c.pesach],
  [/^במוסף לסוכות/, c => c.sukkot],
  [/^בשבועות, סוכות, ושמיני עצרת/, c => c.shavuot || c.sukkot || c.sheminiAtzeret],
  [/^בפסח|^פסח:/, c => c.pesach],
  [/^בשבועות/, c => c.shavuot],
  [/^בסוכות|^סוכות:/, c => c.sukkot],
  [/^בשמיני עצרת|^בש"ע/, c => c.sheminiAtzeret],
  [/^בראש השנה|^בראש-השנה|^ברה"ש|^בר"ה/, c => c.roshHashana],
  [/^במועדים/, c => c.festivalSeason],
  [/^ביום טוב שאינו שבת|^ביום-טוב שאינו שבת|^ביום טוב שחל בחול/, c => c.yomTov && !c.shabbat],
  [/^ביום טוב|^ביום-טוב|^ביו"ט/, c => c.yomTov],
  [/^במוצאי שבת ויום טוב/, c => c.motzaeiShabbat || c.motzaeiYomTov],
  [/^במוצאי יו"ט|^במוצאי יום טוב/, c => c.motzaeiYomTov],
  [/^במוצאי שבת/, c => c.motzaeiShabbat],
  [/^בערב שבת/, c => c.erevShabbat],
  [/^בימים שאין בהם תחנון|^בימים שאין אומרים תחנון אין|^ביום שאין בו תחנון|^ביום שאין אומרים בו תחנון במנחה/, c => !c.tachanun],
  [/^בימים שגומרים את ההלל/, c => c.fullHallel],
  [/^בימים שני וחמישי|^בימי שני וחמישי/, c => c.mondayThursday],
  [/^בשנה מעוברת/, c => c.leapYear],
  [/^אם חל בשבת/, c => c.shabbat],
  [/^בשבת/, c => c.shabbat],
  [/^לשבת:?$/, c => c.shabbat],
  [/^בחול קודם ברכת המזון/, c => !c.shabbat && !c.yomTov],
  // Torah Or (Chabad) captions.
  [/^בראשון בשבת:?$|^ביום ראשון:?$/, c => c.weekday === 0],
  [/^ביום שאומרים בו תחנון|^בימים שאומרים תחנון/, c => c.tachanun],
  [/^ובימים שאין בהם תחנון|^ובימים שאין אומרים תחנון/, c => !c.tachanun],
  // The Metsudah Ya'ale Veyavo names the day by a caption each ("לר\"ח:", "לפסח:", "לסכות:").
  [/^לר"ח:?$|^לראש חדש:?$/, c => c.roshChodesh],
  [/^לפסח:?$/, c => c.pesach],
  [/^לסכות:?$|^לסוכות:?$/, c => c.sukkot],
  [/^לשבועות:?$/, c => c.shavuot],
  [/^לשמיני עצרת:?$|^לשמע"צ:?$/, c => c.sheminiAtzeret],
  [/^לתענית ציבור:?$|^לתענית צבור:?$/, c => c.fast],
  [/^לראש חודש$/, c => c.roshChodesh],
  [/^לראש השנה$/, c => c.roshHashana],
  [/^לשלש רגלים$/, c => c.pesach || c.shavuot || c.sukkot || c.sheminiAtzeret],
].map(([pattern, when]) => ({ pattern, when: C(when) }));

// Captions that tell what to SKIP on a day: acted on elsewhere or shown as printed, never inverted here.
// Directions about the chazzan's melody or starting point ("ביום טוב ינגן החזן 'האל בתעצומות'") are not conditions
// on the words either: the words are said every day.
const SKIP_INSTRUCTIONS = /מדלגים|מדלגין|לא יאמר|אין אומרים|אין מברכים|ינגן|יתחיל החזן|מתחיל החזן|החזן מתחיל|הש"ץ מתחיל|מתחיל הש"ץ/;

// strict: decide from whatever flags the context has even without a full date (the per-caption path).
export function evaluateRubric(text, conditions, { strict = false } = {}) {
  const value = clean(text);
  if (!value) return { known: false, applies: true };
  // Seasons come from the app's seasonal rule directly, even when the full date is not known.
  if (value === 'בקיץ:' || value === 'בקיץ') return { known: true, applies: Boolean(conditions.summer), season: true };
  if (value === 'בחורף:' || value === 'בחורף') return { known: true, applies: Boolean(conditions.winter), season: true };
  if (SKIP_INSTRUCTIONS.test(value)) return { known: false, applies: true, skip: true };
  const rule = CONDITIONS.find(entry => entry.pattern.test(value));
  if (!rule) return { known: false, applies: true };
  return { known: true, applies: conditions.resolved || strict ? Boolean(rule.when(conditions)) : true };
}

export const RUBRIC_CONDITION_PATTERNS = CONDITIONS.map(entry => entry.pattern);

// An alternative printed as ONE small-print group that opens with its own caption: "האל <small>בעש"ת המלך</small>
// הקדוש", "עושה שלום <small>בעשי”ת: השלום</small> במרומיו", "<small>בשנת העיבור עד חודש ניסן ולכפרת פשע</small>",
// "באהבה <small>לשבת שבתות למנוחה ו</small> מועדים". On a day the caption does not hold, the group goes (the
// surrounding words are the ordinary text). On a day it holds:
//   addition    — words said in addition, where they stand (ולכפרת פשע; the Shabbat words of the festival Amidah):
//                 the caption goes, the words stay;
//   replacement — words said instead of printed words the edition does not mark (המלך for האל; השלום; לעלא לעלא
//                 מכל; ושני שעירים for ושעיר): the group stays as printed, caption and all — never a guess.
// Only these captions, only short groups (a caption's length), never a direction ("בעשי"ת אומרים …").
const INLINE_ALTERNATIVES = [
  { pattern: /^(?:בעשי"ת|בעש"ת)(?:\s+(?:מסיים|יסיים))?\s*[:\-–]?\s+(?!אומרים|מיום)(?=\S)/, when: c => c.aseret, addition: false },
  { pattern: /^בש"ת\s*[:\-–]?\s+(?=\S)/, when: c => c.shabbatShuva, addition: false },
  { pattern: /^בשנת העיבור עד חו?דש ניסן\s*:?\s+(?=\S)/, when: c => c.leapYearBeforeNisan, addition: true },
  { pattern: /^לשבת\s*[:\-–]?\s+(?=\S)/, when: c => c.shabbat, addition: true },
  { pattern: /^בשבועות\s+(?=ושני שעירים)/, when: c => c.shavuot, addition: false },
  // The Metsudah festival Musaf prints the last Shabbat words without their caption ("בשמחה ובששון <small>שבת ו</small>
  // מועדי קדשך", "מקדש <small>השבת ו</small> ישראל"); its festival Amidah prints the same words captioned ("לשבת שבת ו",
  // "לשבת השבת ו"). The words alone, exactly these, are that addition.
  { pattern: /^ה?שבת ו$/, when: c => c.shabbat, addition: true, bare: true },
];
// A note that a passage printed elsewhere is said HERE, in place of the rest of the paragraph: Torah Or (Chabad),
// Mincha Amidah ¶22 — "…בנין עולם. <small>(בתשעה באב אומרים כאן נחם)</small> ברוך אתה יי, בונה ירושלים:". Nachem
// (¶23) ends with its own chatima, "ברוך אתה יי, מנחם ציון ובונה ירושלים", which takes the place of the ordinary
// one — one blessing has one chatima (Nachem is said in בונה ירושלים, SA OC 557:1; its ending as ¶23 prints it).
// When the note holds, the words after it in the paragraph are not said.
const SAID_INSTEAD = [
  { pattern: /^\(?בתשעה באב אומרים כאן נחם\)?$/, when: c => c.tishaBav },
];
export function saidInsteadOfRest(text, conditions) {
  const value = clean(text);
  const rule = value && SAID_INSTEAD.find(entry => entry.pattern.test(value));
  return rule ? { applies: Boolean(rule.when(conditions)) } : null;
}
// text: the group's text. Returns { applies, addition, captionWords } or null.
export function inlineAlternative(text, conditions) {
  const value = clean(text);
  if (!value || value.length > 90) return null;
  const rule = INLINE_ALTERNATIVES.find(entry => entry.pattern.test(value));
  if (!rule) return null;
  const caption = rule.bare ? '' : value.match(rule.pattern)[0].trim();
  return { applies: Boolean(rule.when(conditions)), addition: rule.addition, captionWords: caption ? caption.split(/\s+/).length : 0 };
}

// The day's verdict on a caption the reader shows as printed (one the engine does not decide): 'today', 'other', or
// null when the day cannot tell. Brackets around a caption ("(בשבת:)") are the edition's typography. A bare Yom Tov
// caption on Chol HaMoed stays undecided: an edition may mean the festival days only ("בְּיוֹם טוֹב מִקְרָא קֹדֶשׁ") or
// every day of the festival ("(ביו״ט:) וְשַׂמְּחֵנוּ בְּיוֹם חַג (פלוני) הַזֶּה") — no mark is better than a wrong one.
export function todayVerdict(text, conditions = {}) {
  if (!conditions.resolved) return null;
  const value = clean(text).replace(/^[([]\s*/, '').replace(/\s*[)\]]$/, '').replace(/[\s:\-–—]+$/, '');
  if (!value || value.length > 60) return null;
  const verdict = evaluateRubric(value, conditions, { strict: true });
  if (!verdict.known || verdict.skip) return null;
  if (conditions.cholHamoed && /^(?:ביום טוב|ביום-טוב|ביו"ט)$/.test(value)) return null;
  return verdict.applies ? 'today' : 'other';
}
