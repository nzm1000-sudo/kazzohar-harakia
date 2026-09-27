// The Siddur's own condition captions ("בחול המועד:", "בסוכות:", "בראש חודש ביום טוב ובחול המועד אומרים")
// read as predicates over the prayer day. One explicit table: a caption is either a known day
// condition, a known non-conditional instruction, or unknown (shown as printed — never guessed).
import { removeNikud } from '../../hebrewText.mjs';

// Hebcal month numbers.
const NISAN = 1; const SIVAN = 3; const TAMUZ = 4; const AV = 5; const TISHREI = 7; const TEVET = 10;

const weekdayOf = key => (typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) ? new Date(`${key}T12:00:00Z`).getUTCDay() : null);

// Day conditions from the app's Jewish context (JewishContextEngine). `resolved: false` when the
// Hebrew date is unknown — then nothing is filtered and the edition is shown with all its captions.
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
  return {
    resolved,
    summer: context.seasonal?.mashivHaruch === false,
    winter: context.seasonal?.mashivHaruch === true,
    rainSummer: context.seasonal?.vetenTalUmatar === false,
    rainWinter: context.seasonal?.vetenTalUmatar === true,
    shabbat, erevShabbat: weekday === 5, mondayThursday: weekday === 1 || weekday === 4, motzaeiShabbat,
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
    leapYear: Boolean(context.hebrewDate?.isLeapYear),
  };
}

const clean = text => removeNikud(String(text || ''))
  .replace(/<[^>]+>/g, ' ')
  .replace(/״|''|׳׳/g, '"').replace(/׳/g, "'")
  .replace(/[‍‎‏]/g, '')
  .replace(/\s+/g, ' ').trim();

const C = c => c; // readability in the table below
// Order matters: the most specific phrase first. `when` → the following text is said when true.
const CONDITIONS = [
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
  [/^בתשעה באב/, c => c.tishaBav],
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
  [/^בראש השנה|^בראש-השנה|^ברה"ש/, c => c.roshHashana],
  [/^במועדים/, c => c.festivalSeason],
  [/^ביום טוב שאינו שבת|^ביום-טוב שאינו שבת|^ביום טוב שחל בחול/, c => c.yomTov && !c.shabbat],
  [/^ביום טוב|^ביום-טוב|^ביו"ט/, c => c.yomTov],
  [/^במוצאי שבת ויום טוב|^במוצאי יו"ט/, c => c.motzaeiShabbat],
  [/^במוצאי שבת/, c => c.motzaeiShabbat],
  [/^בערב שבת/, c => c.erevShabbat],
  [/^בימים שאין בהם תחנון|^בימים שאין אומרים תחנון אין|^ביום שאין בו תחנון|^ביום שאין אומרים בו תחנון במנחה/, c => !c.tachanun],
  [/^בימים שגומרים את ההלל/, c => c.fullHallel],
  [/^בימים שני וחמישי|^בימי שני וחמישי/, c => c.mondayThursday],
  [/^בשנה מעוברת/, c => c.leapYear],
  [/^אם חל בשבת/, c => c.shabbat],
  [/^בשבת/, c => c.shabbat],
  [/^לשבת$/, c => c.shabbat],
  [/^לראש חודש$/, c => c.roshChodesh],
  [/^לראש השנה$/, c => c.roshHashana],
  [/^לשלש רגלים$/, c => c.pesach || c.shavuot || c.sukkot || c.sheminiAtzeret],
].map(([pattern, when]) => ({ pattern, when: C(when) }));

// Captions that tell what to SKIP on a day: acted on elsewhere or shown as printed, never inverted here.
const SKIP_INSTRUCTIONS = /מדלגים|לא יאמר|אין אומרים|אין מברכים/;

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
