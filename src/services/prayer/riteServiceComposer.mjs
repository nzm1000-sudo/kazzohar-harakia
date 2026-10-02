// A whole service of one rite, composed from that rite's own edition: source structure → verified semantic mapping
// (data/nusach/compositions/*.mjs) → Siddur presentation. Pure: a composition, the rite's pack and the day in, an
// ordered document of named sections out. No word is written here; every block is a slice of the edition.
//
// A section points into one leaf of the edition and is cut out of it by anchors — short unpointed phrases that
// must be found in the text ("start" is the section's first paragraph, "end" its last). Anchors are checked by the
// QA (scripts/siddur-qa.mjs): a section whose anchor is not found is an error, never a silent guess.
//
// Two modes:
//   prayer  — today's prayer: sections whose condition does not hold today are left out, and the edition's own
//             conditional captions inside the text are resolved for the day (services/siddurBlocks.mjs).
//   edition — the full edition as printed: every section, each conditional one labelled with its condition.
import { SERVICE_INDEX, conceptTitle } from '../../data/nusach/prayerSchema.mjs';
import { HDate, HebrewCalendar, Sedra, flags } from '@hebcal/core';
import { dayConditionsFromContext, dayNumbers, isYomTovDate } from './rubricConditions.mjs';
import { frameToday, normalizeSiddurBlocks } from '../siddurBlocks.mjs';
import { normalizeHebrewText, removeNikud } from '../../hebrewText.mjs';
import { tachanunOmitted } from '../jewishContextEngine.mjs';
import { pirkeiAvotChapters } from './pirkeiAvot.mjs';

export const RITE_SERVICE_PREFIX = 'Rite Service, ';
export const riteServiceReference = (nusach, serviceId) => `${RITE_SERVICE_PREFIX}${nusach}, ${serviceId}`;
export const isRiteServiceReference = reference => String(reference || '').startsWith(RITE_SERVICE_PREFIX);
export function parseRiteServiceReference(reference) {
  if (!isRiteServiceReference(reference)) return null;
  const [nusach, serviceId] = String(reference).slice(RITE_SERVICE_PREFIX.length).split(', ');
  return nusach && serviceId ? { nusach, serviceId } : null;
}

// The words of a paragraph for matching anchors: no markup, no points, no cantillation; a maqaf and a line break
// separate words; quotation marks unified.
export function plainText(markup) {
  return String(markup || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&thinsp;/g, ' ')
    .replace(/[־׀]/g, ' ')
    .replace(/[֑-ׇ]/g, '')
    .replace(/[״”“"]/g, '"').replace(/[׳’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const plainCache = new WeakMap();
function plainsOf(paragraphs) {
  if (!plainCache.has(paragraphs)) plainCache.set(paragraphs, paragraphs.map(plainText));
  return plainCache.get(paragraphs);
}
const matches = (plain, anchor) => (anchor instanceof RegExp ? anchor.test(plain) : plain.includes(anchor));
const findFrom = (plains, anchor, from) => { for (let i = Math.max(0, from); i < plains.length; i += 1) if (matches(plains[i], anchor)) return i; return -1; };

// Cut every section of a service out of its leaf. Sections of one leaf are consecutive in the leaf's order unless a
// section says `rewind` (the rite says a passage of the leaf again, or in another place). Returns the sections with
// `from` / `to` (inclusive paragraph indexes) or an `error`.
export function resolveService(service, texts) {
  const cursors = new Map();
  const out = [];
  service.sections.forEach((section, index) => {
    const paragraphs = texts[section.ref]?.he;
    if (!paragraphs?.length) { out.push({ ...section, error: `leaf not in the pack: ${section.ref}` }); return; }
    const plains = plainsOf(paragraphs);
    if (section.range) {
      const [from, to] = section.range;
      if (from < 0 || to >= paragraphs.length || from > to) out.push({ ...section, error: `range ${from}–${to} outside 0–${paragraphs.length - 1}` });
      else { out.push({ ...section, from, to }); cursors.set(section.ref, to + 1); }
      return;
    }
    const cursor = section.rewind ? 0 : cursors.get(section.ref) ?? 0;
    const from = section.start ? findFrom(plains, section.start, cursor) : cursor;
    if (from < 0 || from >= paragraphs.length) { out.push({ ...section, error: `start anchor not found after ¶${cursor}: ${section.start}` }); return; }
    let to;
    if (section.end) {
      to = findFrom(plains, section.end, from);
      if (to < 0) { out.push({ ...section, error: `end anchor not found after ¶${from}: ${section.end}` }); return; }
    } else {
      // Up to the next section of the same leaf, or to the end of the leaf.
      const next = service.sections.slice(index + 1).find(other => other.ref === section.ref && !other.rewind);
      if (next?.range) to = next.range[0] - 1;
      else if (next?.start) {
        const nextFrom = findFrom(plains, next.start, from + 1);
        to = nextFrom < 0 ? paragraphs.length - 1 : nextFrom - 1;
      } else if (next) { out.push({ ...section, error: 'a following section of the same leaf has no start anchor' }); return; }
      else to = paragraphs.length - 1;
    }
    if (to < from) { out.push({ ...section, error: `empty section (¶${from}–${to})` }); return; }
    out.push({ ...section, from, to });
    cursors.set(section.ref, to + 1);
  });
  return out;
}

// The prayer day, read for the composition's conditions.
const NISAN = 1; const IYAR = 2; const SIVAN = 3; const TAMUZ = 4; const AV = 5; const ELUL = 6; const TISHREI = 7; const KISLEV = 9;
const TEVET = 10; const SHVAT = 11; const ADAR_I = 12; const ADAR_II = 13;
export { isYomTovDate, dayNumbers } from './rubricConditions.mjs';

const FOUR_PARSHIYOT = /^Shabbat (Shekalim|Zachor|Parah|HaChodesh)$/;
// Calendar facts beyond the day itself, from @hebcal/core (the app's one calendar): the Four Parshiyot, a Yom Tov later
// in the week, and the eve of a day without Tachanun.
function calendarFacts(hebrewDate, israel) {
  const { day, month, year } = hebrewDate || {};
  if (!day || !month || !year) return {};
  let hd;
  try { hd = new HDate(Number(day), Number(month), Number(year)); } catch { return {}; }
  // Shabbat Shekalim, Zachor, Parah and HaChodesh (hebcal's SPECIAL_SHABBAT events).
  const arbaParshiyot = hd.getDay() === 6 && (HebrewCalendar.getHolidaysOnDate(hd, israel) || [])
    .some(event => (event.getFlags() & flags.SPECIAL_SHABBAT) && FOUR_PARSHIYOT.test(event.getDesc()));
  // A day of Yom Tov (or Yom Kippur) from this day through Friday of the same week (isYomTovDate: the place's days).
  let yomTovThisWeek = false;
  for (let offset = 0; offset <= 5 - hd.getDay(); offset += 1) {
    const other = new HDate(hd.abs() + offset);
    if (isYomTovDate(other.getMonth(), other.getDate(), israel)) { yomTovThisWeek = true; break; }
  }
  // Tomorrow is Rosh Chodesh, Chanukah's first day, Purim or Purim Katan, Lag BaOmer, 15 Av or 15 Shevat.
  const next = new HDate(hd.abs() + 1);
  const [nm, nd] = [next.getMonth(), next.getDate()];
  const eveOfNoTachanunDay = nd === 1 || nd === 30
    || (nm === KISLEV && nd === 25)
    || ((nm === ADAR_I || nm === ADAR_II) && nd === 14)
    || (nm === IYAR && nd === 18) || (nm === AV && nd === 15) || (nm === SHVAT && nd === 15);
  // A Shabbat before the fast of 17 Tammuz or 10 Tevet as kept this year (17 Tammuz on Shabbat is kept on Sunday).
  let fastAnnouncement = false;
  if (hd.getDay() === 6) {
    for (let offset = 1; offset <= 6 && !fastAnnouncement; offset += 1) {
      const other = new HDate(hd.abs() + offset);
      const [om, od, ow] = [other.getMonth(), other.getDate(), other.getDay()];
      fastAnnouncement = (om === TEVET && od === 10) || (om === TAMUZ && ((od === 17 && ow !== 6) || (od === 18 && ow === 0)));
    }
  }
  // The weekly portion read on Monday, Thursday and at Shabbat Mincha: the portion of the next Shabbat on which one is
  // read (SA OC 135:2 — "בפרשה של שבת הבאה"), in hebcal's order 1–54. After Ha'azinu, until Simchat Torah, the next
  // portion is וזאת הברכה (read on Simchat Torah, never on a Shabbat).
  let weeklyReading = 0;
  const firstShabbat = new HDate(hd.abs() + 1).onOrAfter(6);
  for (let week = 0; week < 8 && !weeklyReading; week += 1) {
    const shabbat = new HDate(firstShabbat.abs() + 7 * week);
    const found = new Sedra(shabbat.getFullYear(), israel).lookup(shabbat);
    if (!found.chag) weeklyReading = Array.isArray(found.num) ? found.num[0] : Number(found.num) || 0;
  }
  const simchatTorah = new HDate(israel ? 22 : 23, TISHREI, hd.getFullYear());
  if (weeklyReading === 1 && hd.getMonth() === TISHREI && hd.abs() < simchatTorah.abs()) weeklyReading = 54;
  return { arbaParshiyot, yomTovThisWeek, eveOfNoTachanunDay, fastAnnouncement, weeklyReading };
}
export function compositionConditions(context = {}) {
  const c = dayConditionsFromContext(context);
  const month = Number(context.hebrewDate?.month);
  const day = Number(context.hebrewDate?.day);
  const israel = Boolean(context.isIsrael);
  const n = dayNumbers(context.hebrewDate, israel);
  const prayer = context.servicePrayer || context.prayerType || null;
  const weekday = typeof context.key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(context.key) ? new Date(`${context.key}T12:00:00Z`).getUTCDay() : null;
  // The Omer is counted from the night of 16 Nisan to the night of 6 Sivan (the context of Arvit is the coming night).
  const omer = (month === NISAN && day >= 16) || month === IYAR || (month === SIVAN && day <= 5);
  const torahReading = c.mondayThursday || c.roshChodesh || c.fast || c.chanukah || c.purim || c.cholHamoed;
  // Musaf is the turning point of the rain wording: משיב הרוח stops at Musaf of the first day of Pesach and starts at
  // Musaf of Shemini Atzeret (SA OC 114:1). The date engine is asked about Shacharit, so Musaf is set here.
  const musafTurn = (prayer === 'mussaf' || prayer === 'musaf') && ((month === NISAN && day === 15) || (month === TISHREI && day === 22));
  const rain = musafTurn ? { winter: month === TISHREI, summer: month === NISAN } : {};
  // Pirkei Avot at Shabbat Mincha in the summer: this Shabbat's chapter(s) (pirkeiAvot.mjs), avot1 … avot6.
  const avot = pirkeiAvotChapters(context.hebrewDate, israel) || [];
  const facts = calendarFacts(context.hebrewDate, israel);
  const shabbatMevarchim = c.shabbat && day >= 23 && day <= 29 && month !== ELUL;
  return {
    ...c,
    ...rain,
    // Shabbat Shekalim, Zachor, Parah, HaChodesh: no אב הרחמים and no צדקתך (the Metsudah Ashkenaz and Sefard editions'
    // own notes: "ולא בשבת של ארבע הפרשיות", "וכן בד' פרשיות אין אומרים צדקתך").
    arbaParshiyot: Boolean(facts.arbaParshiyot),
    // The Shabbat on which Av is blessed (late Tammuz): אב הרחמים is said (the same notes: "מלבד כשמברכין … אב").
    mevarchimAv: shabbatMevarchim && month === TAMUZ,
    // Purim Katan: 14–15 Adar I of a leap year (the `purim` key is Purim of Adar / Adar II).
    purimKatan: Boolean(c.leapYear) && month === ADAR_I && (day === 14 || day === 15),
    // A Yom Tov (or Yom Kippur) later in the coming week — asked on Motzaei Shabbat, whose Arvit belongs to Sunday: no
    // ויהי נועם and ואתה קדוש that night (Rema OC 295:1; Mishnah Berurah 295:3 — "ומעשה ידינו" asks a blessing on
    // six working days).
    yomTovThisWeek: Boolean(facts.yomTovThisWeek),
    // Tomorrow is a day without Tachanun in the Chabad list for Mincha (Torah Or, Ashrei Uva LeZion ¶1: "גם במנחה ערב
    // ראש חדש וערב חנוכה וערב פורים גדול וקטן וערב ל"ג בעומר וערב ט"ו באב וערב ט"ו בשבט אין אומרים תחנון").
    eveOfNoTachanunDay: Boolean(facts.eveOfNoTachanunDay),
    // The Shabbat before the fast of 17 Tammuz or 10 Tevet (Edot HaMizrach, Announcement of Fast ¶1: "בשבת שלפני הצום של
    // י"ז בתמוז ושל י' בטבת מכריז החזן ואין מכריזין בצום ט' באב וכיפור ותענית אסתר").
    fastAnnouncement: Boolean(facts.fastAnnouncement),
    // The weekday / Shabbat Mincha portion (1 Bereshit … 54 VeZot HaBerachah), and Purim's own reading day: 14 Adar
    // (Adar II) — the app keeps no walled-city (Shushan Purim) residence, so 15 Adar is not a reading day here.
    weeklyReading: facts.weeklyReading || 0,
    purimDay: c.purim && day === 14,
    // Tefillat Tal (Musaf of the first day of Pesach) and Tefillat Geshem (Musaf of Shemini Atzeret, 22 Tishrei — not
    // Simchat Torah abroad): the Musaf at which the wording turns (SA OC 114:1), as the editions' own leaves are titled
    // ("תפילת טל ליום ראשון של פסח"; the Musaf of Shemini Atzeret).
    tefillatTal: month === NISAN && day === 15,
    tefillatGeshem: month === TISHREI && day === 22,
    weekday,
    omer,
    // Psalm 27 from Rosh Chodesh Elul through Hoshana Rabbah (Mishnah Berurah 581:2).
    ledavid: month === ELUL || (month === TISHREI && day <= 21),
    torahReading,
    hallel: c.fullHallel || c.halfHallel || c.roshChodesh || c.chanukah || c.cholHamoed,
    avinuMalkeinu: c.tachanun && (c.aseret || c.fast) && !c.erevShabbat,
    // From Yom Kippur to Sukkot (11–14 Tishrei): no Tachanun, the Song of the Day's additions of those days.
    afterYomKippur: month === TISHREI && day >= 11 && day <= 14,
    erevPesach: month === NISAN && day === 14,
    erevYomKippur: month === TISHREI && day === 9,
    // Shabbat Mevarchim: the Shabbat before Rosh Chodesh (days 23–29), except before Rosh Hashana.
    // (the 30th is itself Rosh Chodesh: the month was blessed the Shabbat before)
    shabbatMevarchim,
    // Would Tachanun be said today were it a weekday (צדקתך at Shabbat Mincha, SA OC 292:2) — the app's own rule.
    tachanunIfWeekday: c.resolved && !tachanunOmitted({ month, day }, false, c.roshChodesh, c.chanukah, c.purim, context.prayerType),
    // Day numbers and the edges of festivals (the Omer count of tonight, the night of Chanukah, the days of Pesach).
    omerDay: n.omerDay || 0,
    chanukahDay: n.chanukahDay || 0,
    cholHamoedDay: n.cholHamoedDay || 0,
    sukkotDay: n.sukkotDay || 0,
    pesachDay: n.pesachDay || 0,
    pesachFirstDays: c.pesach && Boolean(n.yomTovToday) && n.pesachDay <= 2,
    pesachLastDays: c.pesach && n.pesachDay >= 7,
    cholHamoedPesach: c.pesach && !n.yomTovToday,
    cholHamoedSukkot: c.sukkot && !n.yomTovToday,
    sukkotFirstDays: c.sukkot && Boolean(n.yomTovToday),
    // The night after Yom Tov that falls on a weekday (not Motzaei Shabbat): Arvit whose previous day was Yom Tov.
    motzaeiYomTov: prayer === 'maariv' && Boolean(n.yomTovYesterday) && !n.yomTovToday,
    erevYomTov: Boolean(n.yomTovTomorrow) && !n.yomTovToday,
    erevChanukah: month === KISLEV && day === 24,
    shacharit: prayer === 'shacharit', mincha: prayer === 'mincha', maariv: prayer === 'maariv', musaf: prayer === 'mussaf' || prayer === 'musaf',
    pirkeiAvot: avot.length > 0,
    avot1: avot.includes(1), avot2: avot.includes(2), avot3: avot.includes(3), avot4: avot.includes(4), avot5: avot.includes(5), avot6: avot.includes(6),
    israel: Boolean(context.isIsrael),
    diaspora: !context.isIsrael,
    day0: weekday === 0, day1: weekday === 1, day2: weekday === 2, day3: weekday === 3, day4: weekday === 4, day5: weekday === 5, day6: weekday === 6,
  };
}

// "tachanun", "!tachanun", "mondayThursday&tachanun", "roshChodesh|fast".
export function whenHolds(expression, conditions) {
  if (!expression) return true;
  return String(expression).split('|').some(any => any.split('&').every(term => {
    const negate = term.startsWith('!');
    const value = Boolean(conditions[negate ? term.slice(1) : term]);
    return negate ? !value : value;
  }));
}
// A condition the app cannot decide by itself (a house of mourning, a personal custom): true when the expression
// names a key the day does not carry. Such a section is shown with its label rather than silently hidden.
// Three-valued: a branch with a known false term is false whatever its unknown terms; only a condition whose known
// parts do not rule it out is left open (houseOfMourning&!roshChodesh is simply hidden on Rosh Chodesh).
export const undecidable = (expression, conditions) => {
  if (!expression) return false;
  let open = false;
  for (const any of String(expression).split('|')) {
    let branch = true;
    for (const term of any.split('&')) {
      const key = term.replace(/^!/, '');
      if (!(key in conditions)) { branch = branch === false ? false : null; continue; }
      const value = term.startsWith('!') ? !conditions[key] : Boolean(conditions[key]);
      if (!value) { branch = false; break; }
    }
    if (branch === true) return false;
    if (branch === null) open = true;
  }
  return open;
};

// The label of a condition in the full-edition mode ("בימים שאומרים תחנון").
export const WHEN_LABELS = Object.freeze({
  tachanun: 'בימים שאומרים תחנון',
  '!tachanun': 'בימים שאין אומרים תחנון',
  mondayThursday: 'בשני ובחמישי',
  'mondayThursday&tachanun': 'בשני ובחמישי שאומרים בהם תחנון',
  torahReading: 'בימים שקוראים בתורה',
  roshChodesh: 'בראש חודש',
  hallel: 'בימים שאומרים הלל',
  fast: 'בתענית ציבור',
  avinuMalkeinu: 'בעשרת ימי תשובה ובתעניות',
  aseret: 'בעשרת ימי תשובה',
  omer: 'בימי ספירת העומר',
  ledavid: 'מראש חודש אלול עד הושענא רבה',
  motzaeiShabbat: 'במוצאי שבת',
  chanukah: 'בחנוכה',
  purim: 'בפורים',
  cholHamoed: 'בחול המועד',
  diaspora: 'בחוץ לארץ',
  israel: 'בארץ ישראל',
  erevShabbat: 'בערב שבת',
  houseOfMourning: 'בבית האבל',
  afterYomKippur: 'בימים שבין יום הכיפורים לסוכות',
  erevPesach: 'בערב פסח',
  erevYomKippur: 'בערב יום הכיפורים',
  shabbatMevarchim: 'בשבת מברכים',
  arbaParshiyot: 'בארבע הפרשיות (שקלים, זכור, פרה, החודש)',
  '!arbaParshiyot': 'שלא בארבע הפרשיות',
  mevarchimAv: 'בשבת מברכים אב',
  purimKatan: 'בפורים קטן',
  fastAnnouncement: 'בשבת שלפני י״ז בתמוז ועשרה בטבת',
  weeklyReading: 'פרשת השבוע הבאה',
  purimDay: 'בפורים (י״ד באדר)',
  yomTovThisWeek: 'במוצאי שבת שחל יום טוב בשבוע הבא',
  '!yomTovThisWeek': 'כשאין יום טוב בשבוע הבא',
  eveOfNoTachanunDay: 'בערב יום שאין אומרים בו תחנון',
  '!eveOfNoTachanunDay': 'שלא בערב יום שאין אומרים בו תחנון',
  tefillatTal: 'ביום ראשון של פסח (תפילת טל)',
  tefillatGeshem: 'בשמיני עצרת (תפילת גשם)',
  leapYear: 'בשנה מעוברת',
  leapYearBeforeNisan: 'בשנת העיבור עד חודש ניסן',
  tachanunIfWeekday: 'בשבת שאילו היה יום חול היו אומרים בו תחנון',
  tzomGedaliah: 'בצום גדליה',
  asaraBetevet: 'בעשרה בטבת',
  taanitEsther: 'בתענית אסתר',
  shivaAsarBetammuz: 'בשבעה עשר בתמוז',
  shabbat: 'בשבת',
  '!shabbat': 'בימות החול',
  roshHashana: 'בראש השנה',
  shavuot: 'בשבועות',
  sheminiAtzeret: 'בשמיני עצרת',
  hoshanaRabbah: 'בהושענא רבה',
  shabbatShuva: 'בשבת שובה',
  winter: 'בחורף',
  summer: 'בקיץ',
  weekdayOnly: 'בימות החול',
  fullHallel: 'בימים שגומרים את ההלל',
  halfHallel: 'בימים שאומרים חצי הלל',
  pesach: 'בפסח',
  sukkot: 'בסוכות',
  tishaBav: 'בתשעה באב',
  '!tishaBav': 'בכל יום מלבד תשעה באב',
  '!fast': 'בימים שאינם תענית ציבור',
  yomTov: 'ביום טוב',
  rainWinter: 'בימות הגשמים',
  rainSummer: 'בימות החמה',
  omerDay: 'בימי ספירת העומר',
  motzaeiYomTov: 'במוצאי יום טוב',
  erevYomTov: 'בערב יום טוב',
  erevChanukah: 'בערב חנוכה',
  pesachFirstDays: 'בימים הראשונים של פסח',
  pesachLastDays: 'בימים האחרונים של פסח',
  cholHamoedPesach: 'בחול המועד פסח',
  cholHamoedSukkot: 'בחול המועד סוכות',
  sukkotFirstDays: 'ביום טוב של סוכות',
  shacharit: 'בשחרית', mincha: 'במנחה', maariv: 'בערבית', musaf: 'במוסף',
  '!shacharit': 'שלא בשחרית', '!maariv': 'שלא בערבית',
  yomKippur: 'ביום הכיפורים',
  '!motzaeiYomTov': 'שלא במוצאי יום טוב',
  pirkeiAvot: 'בשבתות הקיץ (בין פסח לראש השנה)',
  avot1: 'פרקי אבות: בשבת של פרק ראשון', avot2: 'פרקי אבות: בשבת של פרק שני', avot3: 'פרקי אבות: בשבת של פרק שלישי',
  avot4: 'פרקי אבות: בשבת של פרק רביעי', avot5: 'פרקי אבות: בשבת של פרק חמישי', avot6: 'פרקי אבות: בשבת של פרק שישי',
  day0: 'ביום ראשון', day1: 'ביום שני', day2: 'ביום שלישי', day3: 'ביום רביעי', day4: 'ביום חמישי', day5: 'ביום שישי', day6: 'בשבת',
});
// A compound condition reads as its parts: "roshChodesh|cholHamoed" → "בראש חודש ובחול המועד".
export function whenLabel(expression) {
  if (!expression) return null;
  if (WHEN_LABELS[expression]) return WHEN_LABELS[expression];
  const term = value => WHEN_LABELS[value] || (value.startsWith('!') && WHEN_LABELS[value.slice(1)] ? `לא ${WHEN_LABELS[value.slice(1)]}` : null);
  const any = String(expression).split('|').map(part => term(part) || part.split('&').map(term).filter(Boolean).join(', ')).filter(Boolean);
  if (!any.length) return null;
  return any.length === 1 ? any[0] : `${any.slice(0, -1).join(', ')} ו${any.at(-1)}`;
}

// Who says a section: shown as a small, restrained label.
export const ROLE_LABELS = Object.freeze({
  repetition: 'בחזרת שליח הציבור',
  congregation: 'הקהל',
  chazzan: 'שליח הציבור',
  minyan: 'במניין',
  mourners: 'האבלים',
  optional: 'יש אומרים',
});

const WEEKDAY_WRAPPER = /לימי החול|ליום חול|ליום החול|לימות החול|של יום חול|של חול$/;

// A section that is itself the day's insertion (יעלה ויבוא, על הניסים, עננו, רצה, נחם, a day's line of יעלה ויבוא in
// Birkat HaMazon, a day's הרחמן, the season's גבורות in Musaf), shown because the day takes it: one copper frame around
// it with the tiny "היום" (services/prayer/todayInsertion.mjs). Names inside it the day does not take stay dimmed.
const TODAY_SECTION = /(?:^|-)(?:al-hanisim(?:-chanukah|-purim)?|aneinu(?:-chazzan|-sansan)?|yaale-veyavo|yv-[a-z-]+|retze|harachaman-[a-z-]+|nachem|atah-chonantanu|gevurot-(?:summer|winter))$/;
function markTodaySection(section, holds, blocks) {
  if (!holds || !TODAY_SECTION.test(section.id)) return blocks;
  return frameToday(blocks.map(block => {
    const { todayMark, framePos, ...rest } = block;
    return { ...rest, day: rest.day || 'today', frame: true };
  }));
}

// One section's blocks, in the shared block vocabulary (services/siddurBlocks.mjs).
function sectionBlocks(section, paragraphs, context, mode, conditions = {}) {
  let slice = paragraphs.slice(section.from, section.to + 1).map((markup, offset) => ({ markup, source: section.from + offset }));
  // A table printed for every day (the 49 days of the Omer): in today's prayer only today's line. The composition
  // says how its edition prints a day (perDay.match); when no line is recognised, the whole table stays.
  if (mode === 'prayer' && section.perDay && conditions[section.perDay.key]) {
    const keep = new Set(section.perDay.select(slice.map(({ markup }) => plainText(markup)), conditions[section.perDay.key]) || []);
    if (keep.size) slice = slice.filter((_, index) => keep.has(index));
  }
  const parts = slice.map(({ markup, source }) => ({ text: normalizeHebrewText(markup, 'siddur'), source }));
  // The full edition keeps every alternative the edition prints: the day is not applied.
  const blocks = normalizeSiddurBlocks(parts, { title: section.title, markup: slice.map(part => part.markup), context: mode === 'prayer' ? context : {}, asPrinted: mode !== 'prayer' });
  return blocks
    .filter(block => !(block.type === 'heading' && WEEKDAY_WRAPPER.test(block.text)))
    // The section carries its own reviewed title: the edition's heading at its very top would repeat it.
    .filter((block, index) => !(index === 0 && block.type === 'heading' && !section.keepHeading))
    // Nor is the title shown twice when the edition prints it again just below its top heading ("סדר השכמת הבוקר",
    // then "מודה אני" under a section titled מודה אני): a heading, never words of the prayer.
    .filter((block, index) => !(index === 0 && section.title && block.type === 'heading' && !section.keepHeading && sameHeading(block.text, section.title)));
}
const headingWords = text => removeNikud(String(text || '')).replace(/[^א-ת ]/g, '').replace(/\s+/g, ' ').trim();
const sameHeading = (a, b) => headingWords(a) !== '' && headingWords(a) === headingWords(b);

// The named parts of a service (dsl.part): section id → its part, by the run from `from` to `to` in service order.
export function partsOf(service) {
  const byId = new Map();
  for (const item of service?.parts || []) {
    const from = service.sections.findIndex(section => section.id === item.from);
    const to = service.sections.findIndex(section => section.id === item.to);
    if (from < 0 || to < from) throw new Error(`rite-service: part ${item.id} runs from ${item.from} to ${item.to}, not found in order`);
    for (let index = from; index <= to; index += 1) byId.set(service.sections[index].id, item);
  }
  return byId;
}

// The prayer's contents (the docked "הקודם | תוכן | הבא"): every titled section, each named part (ברכות השחר) listed
// just before its first section — the part's heading is the target (RiteServiceReader › PrayerPartHeading).
export function prayerNavItems(sections) {
  return sections.flatMap(section => [
    ...(section.partStart ? [{ key: `part:${section.part}`, title: section.partTitle, id: `part-${section.part}`, part: true }] : []),
    ...(section.title ? [{ key: section.id, title: section.title, id: section.id }] : []),
  ]);
}

// The composed service. `mode`: 'prayer' (default) or 'edition'.
export function composeRiteService({ composition, serviceId, texts, context = {}, mode = 'prayer', nusachTitle = '' }) {
  const service = composition?.services?.[serviceId];
  const schema = SERVICE_INDEX[serviceId];
  if (!service || !schema) throw new Error(`rite-service: no composition for ${serviceId}`);
  let conditions = compositionConditions(context);
  // At the Musaf where the rain wording turns (see compositionConditions), the edition's own "בקיץ / בחורף" captions
  // must read the same season as the sections do.
  if ((context.servicePrayer === 'mussaf' || context.servicePrayer === 'musaf') && (conditions.winter !== dayConditionsFromContext(context).winter)) {
    context = { ...context, seasonal: { ...(context.seasonal || {}), mashivHaruch: Boolean(conditions.winter) } };
    conditions = compositionConditions(context);
  }
  const decided = mode === 'prayer' && conditions.resolved;
  const partOf = partsOf(service);
  const sections = [];
  const parts = [];
  for (const section of resolveService(service, texts)) {
    if (section.error) throw new Error(`rite-service ${serviceId}/${section.id}: ${section.error}`);
    if (section.omit) continue;
    const open = undecidable(section.when, conditions);
    const applies = open || whenHolds(section.when, conditions);
    if (decided && !applies) continue;
    const blocks = sectionBlocks(section, texts[section.ref].he, context, decided ? 'prayer' : 'edition', conditions);
    if (!blocks.length) continue;
    const title = section.title === undefined ? conceptTitle(section.concept) : section.title;
    const entry = {
      id: section.id,
      concept: section.concept,
      ref: section.ref,
      title,
      role: section.role || null,
      roleLabel: section.role ? ROLE_LABELS[section.role] || null : null,
      when: section.when || null,
      // Shown when the day does not decide it (the full edition, or an unknown date).
      whenLabel: (!decided || open) && section.when ? whenLabel(section.when) : null,
      note: section.note || null,
      collapsed: mode === 'prayer' && section.role === 'repetition',
      blocks: markTodaySection(section, decided && !open && Boolean(section.when), blocks).map((block, index) => ({ ...block, id: `${section.id}.${index}` })),
    };
    // A continuation (title '') has no heading of its own: it reads on after the section before it.
    entry.continues = Boolean(section.continues);
    // Its named part (ברכות השחר): the first section shown of a part opens it with the part's heading.
    const owner = partOf.get(section.id);
    entry.part = owner?.id || null;
    entry.partTitle = owner?.title || null;
    entry.partStart = Boolean(owner) && !parts.some(item => item.id === owner.id);
    if (entry.partStart) parts.push({ id: owner.id, title: owner.title, firstSection: entry.id });
    sections.push(entry);
  }
  return {
    serviceId,
    title: service.title || schema.title,
    nusachTitle,
    mode,
    decided,
    parts,
    sections,
  };
}
