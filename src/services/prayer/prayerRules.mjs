// Prayer rule resolution (Layer C) — Smart Siddur, first slice.
// Input: PrayerDayFacts (facts only) + the prayer actually opened + the sun state.
// Output: explainable rule results — never a bare boolean.
//
//   { ruleId, status, value, reasonCode, sourceRefs, inputFacts, warnings, review, kind }
//
// status: resolved | needs-input | unresolved | unsupported.  "Unknown is not false."
// review: every rule here is 'not-reviewed' by a posek; sources are text-verified citations
// into the bundled Yalkut Yosef corpus (src/data/yalkutYosef.mjs), read on 2026-09-27.
// Scope of this slice: Tachanun (Vidui / Nefilat Apayim), Gevurot season (משיב הרוח / מוריד הטל),
// Birkat HaShanim season (ברך עלינו / ברכנו). Nothing else is claimed.
import { months } from '@hebcal/core';
import { noViduiDay } from './weekdayMinchaRules.mjs';
import { GEO_REGIME, STATUS as FACT_STATUS } from './prayerDayFacts.mjs';

export const PRAYER_RULES_VERSION = 'prayer-rules/1.0.0';
export const RULE_STATUS = Object.freeze({ RESOLVED: 'resolved', NEEDS_INPUT: 'needs-input', UNRESOLVED: 'unresolved', UNSUPPORTED: 'unsupported' });
export const PRAYER_TYPES = Object.freeze(['arvit', 'shacharit', 'musaf', 'mincha']);
// Order of the services within one Jewish day (Arvit opens the day).
const ORDER = { arvit: 0, shacharit: 1, musaf: 2, mincha: 3 };
const REVIEW = 'not-reviewed';
const CORPUS = 'yalkut-yosef-tashz';

const yy = (ref, label) => Object.freeze({ corpus: CORPUS, ref, label, reviewStatus: 'text-verified' });
export const SOURCE_REFS = Object.freeze({
  yy114_1: yy('yalkut-yosef-7-34-1', 'ילקוט יוסף, סימן קיד, הלכה 1'),
  yy114_4: yy('yalkut-yosef-7-34-4', 'ילקוט יוסף, סימן קיד, הלכה 4'),
  yy117_1: yy('yalkut-yosef-7-37-1', 'ילקוט יוסף, סימן קיז, הלכה 1'),
  yy117_2: yy('yalkut-yosef-7-37-2', 'ילקוט יוסף, סימן קיז, הלכה 2'),
  yy117_4: yy('yalkut-yosef-7-37-4', 'ילקוט יוסף, סימן קיז, הלכה 4'),
  yy117_18: yy('yalkut-yosef-7-37-18', 'ילקוט יוסף, סימן קיז, הלכה 18'),
  yy117_20: yy('yalkut-yosef-7-37-20', 'ילקוט יוסף, סימן קיז, הלכה 20'),
  yy131_1: yy('yalkut-yosef-8-7-1', 'ילקוט יוסף, סימן קלא, הלכה 1'),
  yy131_19: yy('yalkut-yosef-8-7-19', 'ילקוט יוסף, סימן קלא, הלכה 19'),
  yy131_37: yy('yalkut-yosef-8-7-37', 'ילקוט יוסף, סימן קלא, הלכה 37'),
  yy131_38: yy('yalkut-yosef-8-7-38', 'ילקוט יוסף, סימן קלא, הלכה 38'),
  yy131_39: yy('yalkut-yosef-8-7-39', 'ילקוט יוסף, סימן קלא, הלכה 39'),
  yy267_1: yy('yalkut-yosef-23-25-1', 'ילקוט יוסף, סימן רסז, הלכה 1'),
  yy429_2: yy('yalkut-yosef-25-1-2', 'ילקוט יוסף, סימן תכט, הלכה 2'),
  yy559_26: yy('yalkut-yosef-28-15-26', 'ילקוט יוסף, סימן תקנט, הלכה 26'),
  yyErevRH_4: yy('yalkut-yosef-29-4-4', 'ילקוט יוסף, מהלכות ערב ראש השנה, הלכה 4'),
  yy604_8: yy('yalkut-yosef-30-1-8', 'ילקוט יוסף, סימן תרד, הלכה 8'),
  yyTuBishvat_3: yy('yalkut-yosef-34-1-3', 'ילקוט יוסף, מהלכות ט״ו בשבט, הלכה 3'),
  yy697_2: yy('yalkut-yosef-36-18-2', 'ילקוט יוסף, סימן תרצז, הלכה 2'),
  edition: Object.freeze({ corpus: 'siddur-edot-hamizrach-shaliehsaboo', ref: 'edition-structure', label: 'מבנה המהדורה: סידור עדות המזרח, מהדורת שליחסבו', reviewStatus: 'structural' }),
});

// Extra, day-specific citations for the reasons produced by noViduiDay (all text-verified).
const DAY_SOURCES = {
  nisan: [SOURCE_REFS.yy429_2],
  'pesach-sheni': [SOURCE_REFS.yy131_38],
  'tisha-beav': [],
  'tu-beav': [SOURCE_REFS.yy559_26],
  'erev-rosh-hashana': [SOURCE_REFS.yyErevRH_4],
  'erev-yom-kippur': [SOURCE_REFS.yy604_8],
  'tu-bishvat': [SOURCE_REFS.yyTuBishvat_3],
  purim: [SOURCE_REFS.yy697_2],
};

const rule = (ruleId, status, { value = null, reasonCode = null, sourceRefs = [], inputFacts = {}, warnings = [], kind = 'din' } = {}) =>
  Object.freeze({ ruleId, status, value, reasonCode, sourceRefs, inputFacts, warnings, review: REVIEW, kind });

function assertPrayer(prayer) {
  if (!PRAYER_TYPES.includes(prayer?.type)) throw new TypeError(`prayer.type must be one of ${PRAYER_TYPES.join(', ')}`);
}

const baseInputs = (facts, prayer) => ({
  prayerType: prayer.type,
  jewishDayKey: facts.jewishDay?.key ?? null,
  jewishDayStatus: facts.jewishDay?.status ?? null,
  hebrew: facts.jewishDay?.hebrew ?? null,
  weekday: facts.jewishDay?.weekday ?? null,
  geoRegime: facts.geoRegime,
  latitude: facts.location?.latitude ?? null,
});

const dayUnresolved = (ruleId, facts, prayer) =>
  (facts.status === FACT_STATUS.UNRESOLVED || !facts.jewishDay ? rule(ruleId, RULE_STATUS.UNRESOLVED, { reasonCode: 'jewish-day-unresolved', inputFacts: baseInputs(facts, prayer), warnings: facts.provenance?.warnings || [] }) : null);

// A provisional Jewish day (no sunset boundary) is fine far from a transition, but on the
// days around one the answer could flip with sunset — ask rather than guess.
const nearTransition = (hebrew, points) => points.some(([month, day]) => hebrew.month === month && Math.abs(hebrew.day - day) <= 1);
const provisionalGuard = (ruleId, facts, prayer, points, sourceRefs) => {
  if (facts.jewishDay.status === FACT_STATUS.RESOLVED) return null;
  if (!nearTransition(facts.jewishDay.hebrew, points)) return null;
  return rule(ruleId, RULE_STATUS.NEEDS_INPUT, { reasonCode: 'sunset-unknown-near-transition', sourceRefs, inputFacts: baseInputs(facts, prayer) });
};
const provisionalWarnings = facts => (facts.jewishDay.status === FACT_STATUS.RESOLVED ? [] : ['jewish-day-provisional']);

// ---------------------------------------------------------------------------------------
// Gevurot: משיב הרוח ומוריד הגשם from Mussaf of Shemini Atzeret (22 Tishrei) until Shacharit of
// 15 Nisan inclusive; מוריד הטל from Mussaf of 15 Nisan (YY 114:1, 114:4).
const GEVUROT_SOURCES = [SOURCE_REFS.yy114_1, SOURCE_REFS.yy114_4];
export function resolveGevurotSeason({ facts, prayer }) {
  assertPrayer(prayer);
  const id = 'gevurot.season';
  const early = dayUnresolved(id, facts, prayer);
  if (early) return early;
  const inputFacts = baseInputs(facts, prayer);
  if (facts.location?.latitude !== null && facts.location?.latitude < 0) {
    return rule(id, RULE_STATUS.UNRESOLVED, { reasonCode: 'southern-hemisphere', sourceRefs: [SOURCE_REFS.yy117_20], inputFacts, kind: 'minhag' });
  }
  const guard = provisionalGuard(id, facts, prayer, [[months.TISHREI, 22], [months.NISAN, 15]], GEVUROT_SOURCES);
  if (guard) return guard;
  const { month, day } = facts.jewishDay.hebrew;
  const order = ORDER[prayer.type];
  let winter;
  if (month === months.TISHREI) winter = day > 22 || (day === 22 && order >= ORDER.musaf);
  else if (month === months.NISAN) winter = day < 15 || (day === 15 && order < ORDER.musaf);
  else winter = [months.CHESHVAN, months.KISLEV, months.TEVET, months.SHVAT, months.ADAR_I, months.ADAR_II].includes(month);
  return rule(id, RULE_STATUS.RESOLVED, {
    value: winter ? 'mashiv-haruach' : 'morid-hatal',
    reasonCode: winter ? 'from-musaf-shemini-atzeret-until-shacharit-15-nisan' : 'from-musaf-15-nisan-until-shacharit-shemini-atzeret',
    sourceRefs: GEVUROT_SOURCES, inputFacts, warnings: provisionalWarnings(facts),
  });
}

// ---------------------------------------------------------------------------------------
// Birkat HaShanim. Israel: ברך עלינו (ותן טל ומטר) from Arvit of 7 Cheshvan until Mincha of
// 14 Nisan inclusive (YY 117:1); ברכנו from Motzaei first day of Pesach (YY 117:18).
// Diaspora: the request starts at Arvit of the 60th day after Tekufat Tishrei — 4 December,
// or 5 December when the following Gregorian year is a leap year (YY 117:4); it ends as above.
const isGregorianLeap = year => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
export const diasporaRainRequestStart = civilYear => `${civilYear}-12-${isGregorianLeap(civilYear + 1) ? '05' : '04'}`;

function hashanimWinterIsrael({ month, day }) {
  if (month === months.CHESHVAN) return day >= 7;
  if (month === months.NISAN) return day <= 15;
  return [months.KISLEV, months.TEVET, months.SHVAT, months.ADAR_I, months.ADAR_II].includes(month);
}
// Returns true/false, or null when the civil transition day needs the sunset state.
function hashanimWinterDiaspora(facts, prayer) {
  const { month, day } = facts.jewishDay.hebrew;
  if (month === months.NISAN) return day <= 15;
  if ([months.SHVAT, months.ADAR_I, months.ADAR_II].includes(month)) return true;
  if ([months.TISHREI, months.CHESHVAN, months.IYYAR, months.SIVAN, months.TAMUZ, months.AV, months.ELUL].includes(month)) return false;
  // Kislev / Tevet: the 60th day after the tekufah falls in December — compare the local civil date.
  // Kislev days still in November are before it; Tevet days already in January are after it
  // (both caught by the two-year sweep test). Only December needs the day-level comparison.
  const civil = facts.civilDate;
  const civilMonth = Number(civil.slice(5, 7));
  if (civilMonth !== 12) return civilMonth <= 6;
  const start = diasporaRainRequestStart(Number(civil.slice(0, 4)));
  if (civil > start) return true;
  if (civil < start) return false;
  if (prayer.type === 'arvit') return true;
  return facts.dayBoundary.afterSunset; // true / false / null (unknown)
}

export function resolveBirkatHashanimSeason({ facts, prayer }) {
  assertPrayer(prayer);
  const id = 'birkat-hashanim.season';
  const early = dayUnresolved(id, facts, prayer);
  if (early) return early;
  const inputFacts = { ...baseInputs(facts, prayer), civilDate: facts.civilDate, afterSunset: facts.dayBoundary.afterSunset };
  if (facts.location?.latitude !== null && facts.location?.latitude < 0) {
    return rule(id, RULE_STATUS.UNRESOLVED, { reasonCode: 'southern-hemisphere', sourceRefs: [SOURCE_REFS.yy117_20], inputFacts, kind: 'minhag' });
  }
  const israelSources = [SOURCE_REFS.yy117_1, SOURCE_REFS.yy117_2, SOURCE_REFS.yy117_18];
  const diasporaSources = [SOURCE_REFS.yy117_4, SOURCE_REFS.yy117_2, SOURCE_REFS.yy117_18];
  const guard = provisionalGuard(id, facts, prayer, [[months.CHESHVAN, 7], [months.NISAN, 15]], israelSources);
  if (guard) return guard;
  const decide = (winter, sourceRefs, extraWarnings = []) => rule(id, RULE_STATUS.RESOLVED, {
    value: winter ? 'barech-aleinu' : 'barchenu',
    reasonCode: winter ? 'rain-request-season' : 'dew-season',
    sourceRefs, inputFacts, warnings: [...provisionalWarnings(facts), ...extraWarnings],
  });
  if (facts.geoRegime === GEO_REGIME.ISRAEL) return decide(hashanimWinterIsrael(facts.jewishDay.hebrew), israelSources);
  if (facts.geoRegime === GEO_REGIME.DIASPORA) {
    const winter = hashanimWinterDiaspora(facts, prayer);
    if (winter === null) return rule(id, RULE_STATUS.NEEDS_INPUT, { reasonCode: 'sunset-unknown-on-transition-day', sourceRefs: diasporaSources, inputFacts });
    return decide(winter, diasporaSources);
  }
  // Regime unknown: answer only where Israel and the diaspora agree.
  const israel = hashanimWinterIsrael(facts.jewishDay.hebrew);
  const diaspora = hashanimWinterDiaspora(facts, prayer);
  if (diaspora !== null && israel === diaspora) return decide(israel, [...israelSources, SOURCE_REFS.yy117_4], ['geo-regime-unknown-but-both-agree']);
  return rule(id, RULE_STATUS.UNRESOLVED, { reasonCode: 'geo-regime-unknown', sourceRefs: [SOURCE_REFS.yy117_1, SOURCE_REFS.yy117_4], inputFacts });
}

// ---------------------------------------------------------------------------------------
// Tachanun (Vidui, 13 Middot, Nefilat Apayim) — said only in Shacharit and Mincha.
const VIDUI_WINDOW_ZMANIYOT = 13.5;
const MODERN_UNRESOLVED = new Set(['yom-haatzmaut', 'yom-yerushalayim']);

export function resolveTachanun({ facts, prayer, sun = null }) {
  assertPrayer(prayer);
  const id = 'tachanun';
  const early = dayUnresolved(id, facts, prayer);
  if (early) return early;
  const inputFacts = { ...baseInputs(facts, prayer), isShabbat: facts.facts?.isShabbat ?? facts.jewishDay.isShabbat, isYomTov: facts.facts?.isYomTov ?? null, chanukahDay: facts.facts?.chanukahDay ?? null, modernObservance: facts.facts?.modernObservance ?? null, sunState: sun?.state ?? null };
  const notSaid = (reasonCode, sourceRefs, kind = 'din') => rule(id, RULE_STATUS.RESOLVED, { value: 'not-said', reasonCode, sourceRefs, inputFacts, kind, warnings: provisionalWarnings(facts) });
  if (prayer.type === 'arvit' || prayer.type === 'musaf') return notSaid('not-in-this-service', [SOURCE_REFS.edition, SOURCE_REFS.yy131_37], 'structure');
  if (facts.jewishDay.isShabbat || facts.facts?.isYomTov) {
    // The Shabbat / Yom Tov services are not in this slice's scope and no citation was verified for them.
    return rule(id, RULE_STATUS.UNSUPPORTED, { reasonCode: 'shabbat-yom-tov-service', inputFacts, kind: 'scope', warnings: ['no-verified-citation-in-corpus'] });
  }
  if (facts.facts === null) return rule(id, RULE_STATUS.UNRESOLVED, { reasonCode: 'observances-unresolved', inputFacts, warnings: facts.provenance?.warnings || [] });
  const today = facts.jewishDay.hebrew;
  const dayReason = noViduiDay({ ...today, chanukah: Boolean(facts.facts.chanukahDay) });
  if (dayReason) return notSaid(dayReason, [SOURCE_REFS.yy131_37, ...(DAY_SOURCES[dayReason] || [])]);
  if (prayer.type === 'mincha') {
    if (facts.jewishDay.weekday === 5) return notSaid('erev-shabbat', [SOURCE_REFS.yy267_1]);
    const next = facts.jewishDay.next;
    const eveReason = noViduiDay({ ...next.hebrew, chanukah: Boolean(next.chanukahDay) });
    if (eveReason === 'pesach-sheni') return rule(id, RULE_STATUS.UNRESOLVED, { reasonCode: 'erev-pesach-sheni-see-note', sourceRefs: [SOURCE_REFS.yy131_39], inputFacts });
    if (eveReason && eveReason !== 'erev-rosh-hashana' && eveReason !== 'erev-yom-kippur') {
      return notSaid(`eve-of-${eveReason}`, [SOURCE_REFS.yy131_39, ...(eveReason === 'tu-bishvat' ? [SOURCE_REFS.yyTuBishvat_3] : [])]);
    }
  }
  if (MODERN_UNRESOLVED.has(facts.facts.modernObservance)) {
    return rule(id, RULE_STATUS.UNRESOLVED, { reasonCode: 'modern-observance-minhag', inputFacts, kind: 'minhag', warnings: ['no-verified-citation-in-corpus'] });
  }
  if (prayer.type === 'mincha') {
    const state = sun?.state ?? 'unknown';
    if (state === 'unknown') return rule(id, RULE_STATUS.NEEDS_INPUT, { reasonCode: 'sunset-unknown', sourceRefs: [SOURCE_REFS.yy131_19], inputFacts });
    if (state === 'after') {
      const minutes = sun?.zmaniyotMinutesAfterSunset ?? null;
      if (minutes === null) return rule(id, RULE_STATUS.UNRESOLVED, { reasonCode: 'after-sunset-window-unknown', sourceRefs: [SOURCE_REFS.yy131_19], inputFacts });
      if (minutes > VIDUI_WINDOW_ZMANIYOT) return notSaid('night', [SOURCE_REFS.yy131_19]);
    }
  }
  return rule(id, RULE_STATUS.RESOLVED, { value: 'said', reasonCode: 'ordinary-day', sourceRefs: [SOURCE_REFS.yy131_1], inputFacts, warnings: [...provisionalWarnings(facts), 'personal-exceptions-not-asked'] });
}

// ---------------------------------------------------------------------------------------
export function resolvePrayerRules({ facts, prayer, sun = null }) {
  assertPrayer(prayer);
  const rules = {
    tachanun: resolveTachanun({ facts, prayer, sun }),
    'gevurot.season': resolveGevurotSeason({ facts, prayer }),
    'birkat-hashanim.season': resolveBirkatHashanimSeason({ facts, prayer }),
  };
  return Object.freeze({ version: PRAYER_RULES_VERSION, prayer: { type: prayer.type }, factsSchemaVersion: facts.schemaVersion, rules });
}

// Technical, machine-readable audit line for one rule ("why did the Siddur show this?").
export const explainRule = r => `${r.ruleId}: ${r.status}${r.value ? ` → ${r.value}` : ''} [${r.reasonCode || '-'}] sources=${r.sourceRefs.map(s => s.ref).join(',') || '-'} review=${r.review}${r.warnings.length ? ` warnings=${r.warnings.join(',')}` : ''}`;
