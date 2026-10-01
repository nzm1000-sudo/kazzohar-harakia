// תזכורות לפי התאריך העברי — a yahrzeit (אזכרה), a Hebrew birthday, a wedding anniversary: the Hebrew date of the
// event, the day it falls on in every later year, and the reminders before it. Pure (no storage, no clock, no UI).
//
// The recurrence is @hebcal/core's, never a second calendar:
//   • yahrzeit  → memorialYahrzeit.yahrzeitsInYear (HebrewCalendar.getYahrzeit + the Adar custom), exactly as נר זיכרון;
//   • birthday / anniversary → HebrewCalendar.getBirthdayOrAnniversary.
// The halachic rules and their sources:
//   Yahrzeit
//   – Adar of a common year, remembered in a leap year: Shulchan Aruch OC 568:7 — the Mechaber: Adar II (Sephardic
//     practice); the Rema: Adar I; "some are strict to keep both". Offered as a choice; the default follows Maran for
//     Edot HaMizrach (and when no rite is set), the Rema for Ashkenaz / Sefard / Chabad.
//   – Adar I or Adar II of a leap year: that Adar in a leap year, Adar in a common year (Rema YD 402:12; MB 568:42).
//   – 30 Cheshvan / 30 Kislev in a year where the month has 29 days: Magen Avraham 568:20 as brought in Mishnah
//     Berurah 568:42 — follow the first anniversary: if the first year had the 30th, the yahrzeit moves to the 1st of
//     the next month in short years; if it did not, it is the last day of that month every year — "יקבע ביום אחרון
//     לחודש זה", i.e. the day before Rosh Chodesh (the 29th, or the 30th in a long year) ("והעולם נוהגין כהמ״א").
//   – The day: the day of death, not of burial — Shulchan Aruch OC 568:8, Rema YD 402:12; also in the first year:
//     Shach YD 402:9 (rejecting the view that the first year follows the burial) and Yalkut Yosef, Avelut 40:4 / Yabia
//     Omer 7 YD 43. Some Ashkenazi communities keep the FIRST yahrzeit on the day of burial when the burial was three
//     or more days after the death; that is an explicit option (default off), never assumed.
//   Birthday / anniversary
//   – Born in Adar of a common year (or Adar II of a leap year): in a leap year, Adar II — Rema OC 55:10.
//   – Adar I (days 1–29) of a leap year: Adar I in a leap year, Adar in a common year — Shulchan Aruch OC 55:10.
//   – 30 Cheshvan / 30 Kislev / 30 Adar I when that day does not exist that year: the 1st of the next month —
//     Mishnah Berurah 55:45 (Cheshvan / Kislev); hebcal / Calendrical Calculations p. 111 (all three).
import { HDate, HebrewCalendar, months } from '@hebcal/core';
import { yahrzeitsInYear, validHebrewDate, adarChoiceMatters, defaultAdarRule, isLeap, daysInMonth } from '../memorialYahrzeit.mjs';

export const EVENT_TYPES = Object.freeze({
  yahrzeit: Object.freeze({ id: 'yahrzeit', title: 'אזכרה', noun: 'האזכרה', nameLabel: 'שם הנפטר/ת', add: 'אזכרה', newTitle: 'אזכרה חדשה' }),
  birthday: Object.freeze({ id: 'birthday', title: 'יום הולדת עברי', noun: 'יום ההולדת העברי', nameLabel: 'שם', add: 'יום הולדת', newTitle: 'יום הולדת עברי' }),
  anniversary: Object.freeze({ id: 'anniversary', title: 'יום נישואין עברי', noun: 'יום הנישואין העברי', nameLabel: 'שמות בני הזוג', add: 'יום נישואין', newTitle: 'יום נישואין עברי' }),
});
export const isEventType = type => Object.prototype.hasOwnProperty.call(EVENT_TYPES, type);

export const FIRST_YEAR_BURIAL_MIN_DAYS = 3;
export { adarChoiceMatters, defaultAdarRule, validHebrewDate, isLeap, daysInMonth };

const parts = hd => ({ day: hd.getDate(), month: hd.getMonth(), year: hd.getFullYear() });
const toHDate = date => new HDate(Number(date.day), Number(date.month), Number(date.year));

// A civil date (+ whether it was after sunset) → its Hebrew date. The Hebrew day turns at sunset.
export function hebrewFromCivil({ day, month, year, afterSunset = false } = {}) {
  const d = Number(day), m = Number(month), y = Number(year);
  const civil = new Date(y, m - 1, d, 12);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y) || !Number.isFinite(civil.getTime()) || civil.getDate() !== d || civil.getMonth() !== m - 1) return null;
  const hd = new HDate(civil);
  return parts(afterSunset ? hd.next() : hd);
}

// The event's own Hebrew date: from a linked memorial (its exact date), else from the entry's input.
export function eventHebrewDate(entry, memorial = null) {
  if (entry?.type === 'yahrzeit' && memorial?.hebrewDeathDate && memorial.dateConfidence === 'exact') return { ...memorial.hebrewDeathDate };
  if (!entry) return null;
  if (entry.inputType === 'civil') return hebrewFromCivil(entry.civil || {});
  return validHebrewDate(entry.hebrew || {}) ? { day: Number(entry.hebrew.day), month: Number(entry.hebrew.month), year: Number(entry.hebrew.year) } : null;
}

// The Adar custom of a yahrzeit: the linked memorial's own choice first (נר זיכרון asks it), then the entry's.
const adarRuleOf = (entry, memorial) => (memorial?.adarRule || entry?.adarRule || 'adar2');

// Does the first-year burial option apply to this entry (a yahrzeit whose burial was 3+ days after the death)?
export const firstYearBurialApplies = entry => entry?.type === 'yahrzeit' && entry.firstYear === 'burial' && Number(entry.burialDelayDays) >= FIRST_YEAR_BURIAL_MIN_DAYS;

/** The event's days in one Hebrew year, as HDates (a yahrzeit kept in both Adars has two). */
export function occurrencesInYear(entry, hyear, memorial = null) {
  const date = eventHebrewDate(entry, memorial);
  if (!date || !validHebrewDate(date) || !Number.isInteger(hyear) || hyear <= date.year) return [];
  if (entry.type === 'yahrzeit') {
    const record = { hebrewDeathDate: date, adarRule: adarChoiceMatters(date) ? adarRuleOf(entry, memorial) : null };
    const regular = yahrzeitsInYear(record, hyear);
    if (!firstYearBurialApplies(entry)) return regular;
    // The first yahrzeit on the anniversary of the burial instead of the death (the option some Ashkenazim keep).
    const burial = new HDate(toHDate(date).abs() + Number(entry.burialDelayDays));
    const firstBurial = new HDate(HebrewCalendar.getYahrzeit(burial.getFullYear() + 1, burial));
    const kept = hyear === date.year + 1 ? [] : regular;
    return firstBurial.getFullYear() === hyear ? [...kept, firstBurial].sort((a, b) => a.abs() - b.abs()) : kept;
  }
  const found = HebrewCalendar.getBirthdayOrAnniversary(hyear, toHDate(date));
  return found ? [new HDate(found)] : [];
}

/** The next `count` days of the event from a Hebrew day on (inclusive), each { hd, years } (years since the event). */
export function upcomingOccurrences(entry, fromHDate, count = 3, memorial = null) {
  const date = eventHebrewDate(entry, memorial);
  if (!date || !fromHDate) return [];
  const fromAbs = fromHDate.abs();
  const out = [];
  for (let y = fromHDate.getFullYear() - 1; y <= fromHDate.getFullYear() + count + 2 && out.length < count; y += 1) {
    for (const hd of occurrencesInYear(entry, y, memorial)) {
      if (hd.abs() >= fromAbs && out.length < count) out.push({ hd, years: hd.getFullYear() - date.year });
    }
  }
  return out;
}

// Why a date needs a word of explanation in the editor (never a silent adjustment).
export function dateNotes(entry, memorial = null) {
  const date = eventHebrewDate(entry, memorial);
  if (!date) return [];
  const notes = [];
  const m = Number(date.month), d = Number(date.day);
  if (entry.type === 'yahrzeit') {
    const chosen = { adar1: 'באדר א׳', adar2: 'באדר ב׳', both: 'בשני האדרים' }[memorial?.adarRule];
    if (adarChoiceMatters(date) && memorial && chosen) notes.push({ id: 'adar-memorial', text: `בשנה מעוברת — ${chosen}, לפי המנהג שנבחר בנר זיכרון (המנהג חלוק: למרן באדר ב׳, לרמ״א באדר א׳; או״ח תקסח, ז).` });
    else if (adarChoiceMatters(date)) notes.push({ id: 'adar-choice', text: 'בשנה מעוברת המנהג חלוק: למרן השולחן ערוך באדר ב׳, לרמ״א באדר א׳, ויש המחמירים בשניהם (או״ח תקסח, ז).' });
    else if (m === months.ADAR_I || m === months.ADAR_II) notes.push({ id: 'adar-leap', text: m === months.ADAR_I ? 'נפטר/ה באדר א׳: בשנה מעוברת באדר א׳, ובשנה פשוטה באדר.' : 'נפטר/ה באדר ב׳: בשנה מעוברת באדר ב׳, ובשנה פשוטה באדר.' });
    if (d === 30 && (m === months.CHESHVAN || m === months.KISLEV)) notes.push({ id: 'day-30', text: `בשנה שבה ל׳ ב${m === months.CHESHVAN ? 'חשוון' : 'כסלו'} אינו קיים, האזכרה נקבעת לפי השנה הראשונה: אם בה היה ל׳ — בא׳ בחודש שאחריו, ואם לא — ביום האחרון של החודש (מגן אברהם, הובא במשנה ברורה תקסח, מב).` });
    if (d === 30 && m === months.ADAR_I) notes.push({ id: 'day-30-adar', text: 'ל׳ באדר א׳: בשנה פשוטה האזכרה בל׳ שבט.' });
  } else {
    if ((m === months.ADAR_I && !isLeap(date.year)) || (m === months.ADAR_II && isLeap(date.year))) notes.push({ id: 'adar-birthday', text: 'בשנה מעוברת — באדר ב׳ (רמ״א או״ח נה, י).' });
    else if (m === months.ADAR_I) notes.push({ id: 'adar-i-birthday', text: d === 30 ? 'ל׳ באדר א׳: בשנה פשוטה — בא׳ בניסן.' : 'באדר א׳: בשנה מעוברת באדר א׳, ובשנה פשוטה באדר (שו״ע או״ח נה, י).' });
    if (d === 30 && (m === months.CHESHVAN || m === months.KISLEV)) notes.push({ id: 'day-30', text: `בשנה שבה ל׳ ב${m === months.CHESHVAN ? 'חשוון' : 'כסלו'} אינו קיים — בא׳ ב${m === months.CHESHVAN ? 'כסלו' : 'טבת'} (משנה ברורה נה, מה).` });
  }
  return notes;
}

// The option of the first yahrzeit by the burial is shown only while that first yahrzeit is still ahead.
export function firstYearStillAhead(entry, fromHDate, memorial = null) {
  const date = eventHebrewDate(entry, memorial);
  if (!date || !fromHDate) return false;
  const first = yahrzeitsInYear({ hebrewDeathDate: date, adarRule: adarRuleOf(entry, memorial) }, date.year + 1)[0];
  return Boolean(first) && first.abs() + 40 >= fromHDate.abs();
}

// "ט״ו באב" (no year) and "ט״ו באב תשפ״ז".
export const hebrewDayLabel = hd => hd.renderGematriya(true).replace(/\s*ת?[א-ת]*״[א-ת]$/, '').replace(/^(\S+)\s/, '$1 ב');
export const hebrewFullLabel = date => toHDate(date).renderGematriya(true);

// The months of a Hebrew year for a picker, in the calendar's order (Adar I and Adar II in a leap year).
const MONTHS = [[months.TISHREI, 'תשרי'], [months.CHESHVAN, 'חשון'], [months.KISLEV, 'כסלו'], [months.TEVET, 'טבת'], [months.SHVAT, 'שבט'], [months.ADAR_I, 'אדר'], [months.NISAN, 'ניסן'], [months.IYYAR, 'אייר'], [months.SIVAN, 'סיון'], [months.TAMUZ, 'תמוז'], [months.AV, 'אב'], [months.ELUL, 'אלול']];
export const monthsOfYear = year => (isLeap(Number(year)) ? MONTHS.flatMap(([value, label]) => (value === months.ADAR_I ? [[months.ADAR_I, 'אדר א׳'], [months.ADAR_II, 'אדר ב׳']] : [[value, label]])) : MONTHS);

// "the 40th": "ה־40".
export const yearsOrdinal = years => (Number.isInteger(years) && years > 0 ? `ה־${years}` : '');

export { toHDate, parts as hdateParts };
