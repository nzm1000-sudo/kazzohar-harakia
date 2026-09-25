import { months } from '@hebcal/core';

export const RULES_VERSION = 'weekday-mincha-rules/1.0.0';
export const STATUS = Object.freeze({
  APPLICABLE: 'applicable',
  NOT_APPLICABLE: 'not-applicable',
  NEEDS_INPUT: 'needs-input',
  UNRESOLVED: 'unresolved',
  UNSUPPORTED: 'unsupported',
});

// Precise citations. Corpus ids point into src/data/yalkutYosef.mjs (Torat Emet, 2007 ed.).
// Three separate axes: text license (see pack/source), halachic review, software tests.
const cite = (text, corpusId = null) => ({ text, corpusId });
export const SOURCES = Object.freeze({
  yy114_1: cite('ילקוט יוסף, סימן קיד, הלכה 1', 'yalkut-yosef-7-34-1'),
  yy114_4: cite('ילקוט יוסף, סימן קיד, הלכה 4', 'yalkut-yosef-7-34-4'),
  yy117_1: cite('ילקוט יוסף, סימן קיז, הלכה 1', 'yalkut-yosef-7-37-1'),
  yy117_2: cite('ילקוט יוסף, סימן קיז, הלכה 2', 'yalkut-yosef-7-37-2'),
  yy117_4: cite('ילקוט יוסף, סימן קיז, הלכה 4', 'yalkut-yosef-7-37-4'),
  yy117_18: cite('ילקוט יוסף, סימן קיז, הלכה 18', 'yalkut-yosef-7-37-18'),
  yy117_20: cite('ילקוט יוסף, סימן קיז, הלכה 20', 'yalkut-yosef-7-37-20'),
  yy131_1: cite('ילקוט יוסף, סימן קלא, הלכה 1', 'yalkut-yosef-8-7-1'),
  yy131_19: cite('ילקוט יוסף, סימן קלא, הלכה 19', 'yalkut-yosef-8-7-19'),
  yy131_37: cite('ילקוט יוסף, סימן קלא, הלכה 37', 'yalkut-yosef-8-7-37'),
  yy131_38: cite('ילקוט יוסף, סימן קלא, הלכה 38', 'yalkut-yosef-8-7-38'),
  yy131_39: cite('ילקוט יוסף, סימן קלא, הלכה 39', 'yalkut-yosef-8-7-39'),
  yy267_1: cite('ילקוט יוסף, סימן רסז, הלכה 1', 'yalkut-yosef-23-25-1'),
  sa422_1: cite('שולחן ערוך, אורח חיים, סימן תכב, סעיף א'),
  edition: cite('הוראות המהדורה עצמה: סידור עדות המזרח, מהדורת שליחסבו'),
});

const REVIEW = 'not-reviewed';
const result = (id, status, { value = null, sources = [], kind = 'din', reason = null } = {}) => ({ id, status, value, sources, kind, review: REVIEW, reason });

// Days listed in Yalkut Yosef 131:37 (with 131:38) on which Vidui is not said.
export function noViduiDay({ day, month, chanukah }) {
  if (month === months.NISAN) return 'nisan';
  if (month === months.IYYAR && day === 14) return 'pesach-sheni';
  if (month === months.IYYAR && day === 18) return 'lag-baomer';
  if (month === months.SIVAN && day <= 12) return 'sivan-1-12';
  if (month === months.AV && day === 9) return 'tisha-beav';
  if (month === months.AV && day === 15) return 'tu-beav';
  if (month === months.ELUL && day === 29) return 'erev-rosh-hashana';
  if (month === months.TISHREI && day === 9) return 'erev-yom-kippur';
  if ((month === months.TISHREI && day >= 11) || (month === months.CHESHVAN && day <= 2)) return 'tishrei-cheshvan';
  if (chanukah) return 'chanukah';
  if (month === months.SHVAT && day === 15) return 'tu-bishvat';
  if ((month === months.ADAR_I || month === months.ADAR_II) && (day === 14 || day === 15)) return 'purim';
  if (day === 30 || day === 1) return 'rosh-chodesh';
  return null;
}

const UNRESOLVED_OBSERVANCES = new Set(["Yom HaAtzma'ut", 'Yom Yerushalayim']);
const VIDUI_WINDOW_ZMANIYOT = 13.5;

function resolveScope({ calendar, profile }) {
  const reasons = [];
  const f = calendar.facts;
  if (profile.nusach !== 'edot-hamizrach') reasons.push('הנוסח שנבחר');
  if (f.shabbat) reasons.push('שבת');
  if (f.yomTov) reasons.push('יום טוב');
  if (f.cholHamoed) reasons.push('חול המועד');
  if (f.aseret) reasons.push('עשרת ימי תשובה');
  if (f.publicFast) reasons.push('תענית ציבור');
  if (f.chanukah) reasons.push('חנוכה');
  if (f.purim) reasons.push('פורים');
  return reasons.length
    ? result('scope.weekday-mincha', STATUS.UNSUPPORTED, { value: reasons, kind: 'scope', reason: 'outside-supported-days' })
    : result('scope.weekday-mincha', STATUS.APPLICABLE, { kind: 'scope' });
}

function resolveSeason(id, winter, sources, location) {
  if (Number(location?.latitude) < 0) return result(id, STATUS.UNRESOLVED, { sources: [SOURCES.yy117_20], kind: 'minhag', reason: 'southern-hemisphere' });
  return result(id, STATUS.APPLICABLE, { value: winter ? 'winter' : 'summer', sources });
}

function resolveTachanun({ time, calendar }) {
  const sources = [SOURCES.yy131_1, SOURCES.yy131_37];
  if (calendar.weekday === 5) return result('tachanun', STATUS.NOT_APPLICABLE, { value: { day: 'not-said' }, sources: [SOURCES.yy267_1], reason: 'erev-shabbat' });
  const dayReason = noViduiDay({ ...calendar.hebrew, chanukah: calendar.facts.chanukah });
  if (dayReason) return result('tachanun', STATUS.NOT_APPLICABLE, { value: { day: 'not-said' }, sources: [SOURCES.yy131_37, SOURCES.yy131_38], reason: dayReason });
  const tomorrowReason = noViduiDay(calendar.tomorrow);
  if (tomorrowReason === 'pesach-sheni') return result('tachanun', STATUS.UNRESOLVED, { value: { day: 'unresolved' }, sources: [SOURCES.yy131_39], reason: 'erev-pesach-sheni' });
  if (tomorrowReason && tomorrowReason !== 'erev-rosh-hashana' && tomorrowReason !== 'erev-yom-kippur') {
    return result('tachanun', STATUS.NOT_APPLICABLE, { value: { day: 'not-said' }, sources: [SOURCES.yy131_39], reason: `erev-${tomorrowReason}` });
  }
  const observance = calendar.facts.modernObservances.find(name => UNRESOLVED_OBSERVANCES.has(name));
  if (observance) return result('tachanun', STATUS.UNRESOLVED, { value: { day: 'unresolved' }, sources, kind: 'minhag', reason: 'modern-observance' });
  if (time.sun.state === 'unknown') return result('tachanun', STATUS.NEEDS_INPUT, { value: { day: 'said' }, sources: [SOURCES.yy131_19], reason: 'sunset-unknown' });
  if (time.sun.state === 'after') {
    const minutes = time.sun.zmaniyotMinutesAfterSunset;
    if (minutes === null) return result('tachanun', STATUS.UNRESOLVED, { value: { day: 'said' }, sources: [SOURCES.yy131_19], reason: 'after-sunset-window-unknown' });
    if (minutes > VIDUI_WINDOW_ZMANIYOT) return result('tachanun', STATUS.NOT_APPLICABLE, { value: { day: 'said', time: 'too-late' }, sources: [SOURCES.yy131_19], reason: 'night' });
  }
  return result('tachanun', STATUS.APPLICABLE, { value: { day: 'said' }, sources, reason: 'personal-exceptions-not-asked' });
}

// The edition prints "יהי שם" for days without Tachanun at the end of the Amida, a layout that
// matches Shacharit. Its place in Mincha has not been verified, so it is never auto-included.
function resolveYehiShem(tachanun) {
  if (tachanun.value?.day === 'said') return result('yehi-shem', STATUS.NOT_APPLICABLE, { sources: [SOURCES.edition], kind: 'edition', reason: 'tachanun-day' });
  return result('yehi-shem', STATUS.UNRESOLVED, { sources: [SOURCES.edition], kind: 'edition', reason: 'mincha-order-not-verified' });
}

const fact = (id, value, sources = [SOURCES.edition]) => result(id, value ? STATUS.APPLICABLE : STATUS.NOT_APPLICABLE, { sources, kind: 'calendar' });

export function resolveWeekdayMinchaRules({ time, calendar, profile, location }) {
  const f = calendar.facts;
  const tachanun = resolveTachanun({ time, calendar });
  const rules = [
    resolveScope({ calendar, profile }),
    resolveSeason('season.gevurot', calendar.seasonal.mashivHaruch, [SOURCES.yy114_1, SOURCES.yy114_4], location),
    resolveSeason('season.birkat-hashanim', calendar.seasonal.vetenTalUmatar, [calendar.isIsrael ? SOURCES.yy117_1 : SOURCES.yy117_4, SOURCES.yy117_2, SOURCES.yy117_18], location),
    tachanun,
    resolveYehiShem(tachanun),
    result('setting.minyan', profile.setting === 'individual' ? STATUS.NOT_APPLICABLE : STATUS.APPLICABLE, { kind: 'practice', sources: [SOURCES.edition] }),
    fact('day.aseret', f.aseret),
    fact('day.public-fast', f.publicFast),
    fact('day.tisha-beav', f.tishaBeAv),
    fact('day.rosh-chodesh', f.roshChodesh, [SOURCES.sa422_1, SOURCES.edition]),
    fact('day.chol-hamoed', f.cholHamoed),
    fact('day.chol-hamoed-pesach', f.cholHamoed && calendar.hebrew.month === months.NISAN),
    fact('day.chol-hamoed-sukkot', f.cholHamoed && calendar.hebrew.month === months.TISHREI),
    fact('day.chanukah', f.chanukah),
    fact('day.purim', f.purim),
    fact('day.friday', calendar.weekday === 5, [SOURCES.edition, SOURCES.yy267_1]),
  ];
  return Object.fromEntries(rules.map(rule => [rule.id, rule]));
}

const is = rule => (rule.status === STATUS.APPLICABLE ? true : rule.status === STATUS.NOT_APPLICABLE ? false : null);
const all = (...values) => (values.includes(false) ? false : values.includes(null) ? null : true);
const any = (...values) => (values.includes(true) ? true : values.includes(null) ? null : false);
const season = (rule, wanted) => (rule.status === STATUS.APPLICABLE ? rule.value === wanted : null);

// Every condition named in the reviewed map resolves here to include / omit / undecided (null).
export const CONDITIONS = Object.freeze({
  minyan: r => ({ include: is(r['setting.minyan']), rules: ['setting.minyan'] }),
  aseret: r => ({ include: is(r['day.aseret']), rules: ['day.aseret'] }),
  'gevurot-summer': r => ({ include: season(r['season.gevurot'], 'summer'), rules: ['season.gevurot'] }),
  'gevurot-winter': r => ({ include: season(r['season.gevurot'], 'winter'), rules: ['season.gevurot'] }),
  'hashanim-summer': r => ({ include: season(r['season.birkat-hashanim'], 'summer'), rules: ['season.birkat-hashanim'] }),
  'hashanim-winter': r => ({ include: season(r['season.birkat-hashanim'], 'winter'), rules: ['season.birkat-hashanim'] }),
  fast: r => ({ include: is(r['day.public-fast']), rules: ['day.public-fast'] }),
  'fast-chazara': r => ({ include: all(is(r['day.public-fast']), is(r['setting.minyan'])), rules: ['day.public-fast', 'setting.minyan'] }),
  'tisha-beav': r => ({ include: is(r['day.tisha-beav']), rules: ['day.tisha-beav'] }),
  'birkat-kohanim': r => ({ include: all(is(r['day.public-fast']), is(r['setting.minyan'])), rules: ['day.public-fast', 'setting.minyan'] }),
  yaaleh: r => ({ include: any(is(r['day.rosh-chodesh']), is(r['day.chol-hamoed'])), rules: ['day.rosh-chodesh', 'day.chol-hamoed'] }),
  'yaaleh-rosh-chodesh': r => ({ include: is(r['day.rosh-chodesh']), rules: ['day.rosh-chodesh'] }),
  'yaaleh-pesach': r => ({ include: is(r['day.chol-hamoed-pesach']), rules: ['day.chol-hamoed-pesach'] }),
  'yaaleh-sukkot': r => ({ include: is(r['day.chol-hamoed-sukkot']), rules: ['day.chol-hamoed-sukkot'] }),
  'al-hanissim': r => ({ include: any(is(r['day.chanukah']), is(r['day.purim'])), rules: ['day.chanukah', 'day.purim'] }),
  chanukah: r => ({ include: is(r['day.chanukah']), rules: ['day.chanukah'] }),
  purim: r => ({ include: is(r['day.purim']), rules: ['day.purim'] }),
  tachanun: r => ({ include: is(r.tachanun), rules: ['tachanun'] }),
  'yehi-shem': r => ({ include: is(r['yehi-shem']), rules: ['yehi-shem'] }),
  friday: r => ({ include: is(r['day.friday']), rules: ['day.friday'] }),
  'not-friday': r => ({ include: is(r['day.friday']) === null ? null : !is(r['day.friday']), rules: ['day.friday'] }),
});
