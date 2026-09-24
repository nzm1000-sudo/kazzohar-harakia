// Centralized Hebrew localization for external Jewish-calendar (Hebcal) event names
// and internal English fallback day labels. Every user-visible calendar/event string
// must be passed through hebrewEventLabel() before rendering — never displayed raw.
const HOLIDAY_NAMES = [
  [/rosh hashan[ae]/i, 'ראש השנה'],
  [/yom kippur/i, 'יום הכיפורים'],
  [/shmini atzeret/i, 'שמיני עצרת'],
  [/simcha?t torah/i, 'שמחת תורה'],
  [/sukkot/i, 'סוכות'],
  [/chanukah|hanukkah/i, 'חנוכה'],
  [/tu bishvat/i, 'ט״ו בשבט'],
  [/purim/i, 'פורים'],
  [/pesach|passover/i, 'פסח'],
  [/lag ba.?omer/i, 'ל״ג בעומר'],
  [/shavuot/i, 'שבועות'],
  [/tzom gedaliah/i, 'צום גדליה'],
  [/asara b.?tevet/i, 'עשרה בטבת'],
  [/seventeenth of tammuz/i, 'שבעה עשר בתמוז'],
  [/tisha b.?av/i, 'תשעה באב'],
  [/tu b.?av/i, 'ט״ו באב'],
  [/rosh chodesh/i, 'ראש חודש'],
  [/parashat/i, 'פרשת'],
  [/shabbat/i, 'שבת'],
  [/candle lighting/i, 'הדלקת נרות'],
  [/havdalah/i, 'הבדלה'],
];

const ROMAN_DAY = { I: 'א׳', II: 'ב׳', III: 'ג׳', IV: 'ד׳', V: 'ה׳', VI: 'ו׳', VII: 'ז׳', VIII: 'ח׳' };

const MONTH_NAMES = [
  [/nisan/i, 'ניסן'],
  [/iyy?ar/i, 'אייר'],
  [/sivan/i, 'סיון'],
  [/tam?muz/i, 'תמוז'],
  [/^av$/i, 'אב'],
  [/elul/i, 'אלול'],
  [/tishr[ei]i?/i, 'תשרי'],
  [/che?shvan/i, 'חשוון'],
  [/kislev/i, 'כסלו'],
  [/te?vet/i, 'טבת'],
  [/sh.?vat/i, 'שבט'],
  [/adar ?i+$/i, month => (/ii/i.test(month) ? 'אדר ב׳' : 'אדר א׳')],
  [/adar$/i, 'אדר'],
];

const INTERNAL_LABELS = {
  'Rosh Chodesh': 'ראש חודש',
  Shabbat: 'שבת',
  'Fast Day': 'יום צום',
  Weekday: 'יום חול',
};

function translateHoliday(value) {
  let text = value;
  let matched = false;
  for (const [pattern, hebrew] of HOLIDAY_NAMES) {
    if (pattern.test(text)) { text = text.replace(pattern, hebrew); matched = true; break; }
  }
  if (!matched) return null;
  text = text.replace(/^Erev\s+/i, 'ערב ').replace(/^Chol HaMoed\s+/i, 'חול המועד ');
  text = text.replace(/\b(I{1,3}|IV|VI{0,3}|VIII)\b$/, day => ROMAN_DAY[day] || day);
  text = text.replace(/:\s*\d+\s*candles?$/i, '');
  return text.trim();
}

// "Rosh Chodesh <Month>" needs the month name itself translated too, once the
// holiday-name pass above has already turned the prefix into ראש חודש.
function translateTrailingMonthName(text) {
  const match = text.match(/([A-Za-z']+)\s*$/);
  if (!match) return text;
  for (const [pattern, hebrew] of MONTH_NAMES) {
    if (pattern.test(match[1])) {
      const replacement = typeof hebrew === 'function' ? hebrew(match[1]) : hebrew;
      return text.slice(0, match.index) + replacement;
    }
  }
  return text;
}

// Only true if the value is plain ASCII (a strong signal it is untranslated English
// Hebcal metadata rather than Hebrew text that merely contains Latin punctuation).
const looksLikeUntranslatedEnglish = value => /^[\x00-\x7F]+$/.test(value) && /[A-Za-z]/.test(value);

export function hebrewEventLabel(value, fallbackHebrew = null) {
  const text = String(value || '').trim();
  if (!text) return fallbackHebrew || '';
  if (INTERNAL_LABELS[text]) return INTERNAL_LABELS[text];
  if (!looksLikeUntranslatedEnglish(text)) return text;
  const translated = translateHoliday(text);
  if (translated) return translateTrailingMonthName(translated);
  // Never leak raw English into the Hebrew UI, even for an event name we don't
  // recognize — prefer any Hebrew the source already gave us, or a neutral label.
  return fallbackHebrew || 'יום מיוחד בלוח';
}
