// "נר ה' נשמת אדם" — the famous tzaddikim whose yahrzeit / hilula falls on a Hebrew date. Pure; offline.
// The date is the app's own Jewish date (context.hebrewDate: it turns at sunset) — no second calendar here.
// Months use hebcal's numbering: Nisan 1 … Elul 6, Tishrei 7 … Shevat 11, Adar / Adar I 12, Adar II 13.

export const MONTH = { Nisan: 1, Iyar: 2, Sivan: 3, Tamuz: 4, Av: 5, Elul: 6, Tishrei: 7, Cheshvan: 8, Kislev: 9, Tevet: 10, Shevat: 11, Adar: 12, AdarI: 12, AdarII: 13 };
export const MONTH_HE = { Nisan: 'ניסן', Iyar: 'אייר', Sivan: 'סיוון', Tamuz: 'תמוז', Av: 'אב', Elul: 'אלול', Tishrei: 'תשרי', Cheshvan: 'חשוון', Kislev: 'כסלו', Tevet: 'טבת', Shevat: 'שבט', Adar: 'אדר', AdarI: 'אדר א׳', AdarII: 'אדר ב׳' };

// A Hebrew year is a leap year when (7y + 1) mod 19 < 7.
export const isLeapYear = year => ((7 * year + 1) % 19) < 7;

// The months a record is observed in, in a given year.
//   died in Adar (a plain year):  leap year → Adar II ("adar2", the common practice), Adar I ("adar1"), or both ("both")
//   died in Adar I:               leap year → Adar I;  plain year → Adar
//   died in Adar II:              leap year → Adar II; plain year → Adar
export function observedMonths(record, year) {
  const { month, leapYearPolicy } = record.hebrewDate;
  if (!isLeapYear(year)) return [/^Adar/.test(month) ? 12 : MONTH[month]];  // a plain year has one Adar
  if (month === 'Adar') return leapYearPolicy === 'adar1' ? [12] : leapYearPolicy === 'both' ? [12, 13] : [13];
  return [MONTH[month]];
}

// Months of 29 days: a yahrzeit on the 30th is kept on the month's last day when the month has no 30th that year.
const monthLength = (month, year, lengths) => lengths?.[month] ?? 30;

export function yahrzeitsOn(hebrewDate, records, { monthLengths } = {}) {
  if (!hebrewDate) return [];
  const { day, month, year } = hebrewDate;
  const last = monthLength(month, year, monthLengths);
  return records
    .filter(record => observedMonths(record, year).includes(month)
      && (record.hebrewDate.day === day || (record.hebrewDate.day === 30 && last === 29 && day === 29)))
    .sort((a, b) => Number(Boolean(b.ownerPinned)) - Number(Boolean(a.ownerPinned))
      || (b.displayPriority || 0) - (a.displayPriority || 0)
      || a.displayNameHe.localeCompare(b.displayNameHe, 'he'));
}

export const labelFor = record => (record.gender === 'f' ? 'אזכרת הצדקת' : 'אזכרת הצדיק');
export const nameWithHonorific = record => (record.honorific ? `${record.displayNameHe} ${record.honorific}` : record.displayNameHe);

// A day with no record: one quiet line under the title — never a name, never on a day that has a record.
export const EMPTY_DAY_LINE = 'הדליקו נר לרחל אמנו';

const COUNT_HE = ['', 'אחת', 'שתי', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע', 'עשר'];
export function spokenSummary(list) {
  if (!list.length) return `נר ה' נשמת אדם. ${EMPTY_DAY_LINE}.`;
  if (list.length === 1) return `נר ה' נשמת אדם. ${list[0].displayNameHe}.`;
  return `נר ה' נשמת אדם. ${COUNT_HE[list.length] || list.length} אזכרות היום. הקש להצגת הרשימה.`;
}

export const formatHebrewDateLabel = record => {
  const { day, month } = record.hebrewDate;
  const letters = ['', 'א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳', 'ח׳', 'ט׳', 'י׳', 'י״א', 'י״ב', 'י״ג', 'י״ד', 'ט״ו', 'ט״ז', 'י״ז', 'י״ח', 'י״ט', 'כ׳', 'כ״א', 'כ״ב', 'כ״ג', 'כ״ד', 'כ״ה', 'כ״ו', 'כ״ז', 'כ״ח', 'כ״ט', 'ל׳'];
  return `${letters[day]} ${MONTH_HE[month]}`;
};
