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
import { dayConditionsFromContext, dayNumbers } from './rubricConditions.mjs';
import { normalizeSiddurBlocks } from '../siddurBlocks.mjs';
import { normalizeHebrewText } from '../../hebrewText.mjs';
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
const NISAN = 1; const IYAR = 2; const SIVAN = 3; const ELUL = 6; const TISHREI = 7; const KISLEV = 9;
export { isYomTovDate, dayNumbers } from './rubricConditions.mjs';
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
  return {
    ...c,
    ...rain,
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
    shabbatMevarchim: c.shabbat && day >= 23 && day <= 29 && month !== ELUL,
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
    .filter((block, index) => !(index === 0 && block.type === 'heading' && !section.keepHeading));
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
  const sections = [];
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
      blocks: blocks.map((block, index) => ({ ...block, id: `${section.id}.${index}` })),
    };
    // A continuation (title '') has no heading of its own: it reads on after the section before it.
    entry.continues = Boolean(section.continues);
    sections.push(entry);
  }
  return {
    serviceId,
    title: service.title || schema.title,
    nusachTitle,
    mode,
    decided,
    sections,
  };
}
