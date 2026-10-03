// הגדרות › חיפוש: the settings page's own index — every setting with the words a reader may type for it. Pure: the page
// (pages/SettingsPage.jsx) draws the results and jumps to the setting (`[data-setting="<id>"]`); tested in Node.
// Matching ignores niqqud, te'amim, gershayim and final letters (normalizeForSearch), and a one-letter prefix (ה, ו, ב,
// ל, מ, ש) before three letters or more — "הנוסח", "בצבע" and "לניגודיות" find their setting. Every word typed must be found.
import { normalizeForSearch } from '../hebrewText.mjs';

// The sections, in the page's order: [id, title, short title (the jump row)].
export const SETTINGS_SECTIONS = Object.freeze([
  Object.freeze({ id: 'accessibility', title: 'נגישות', short: 'נגישות' }),
  Object.freeze({ id: 'location', title: 'מיקום', short: 'מיקום' }),
  Object.freeze({ id: 'nusach', title: 'נוסח', short: 'נוסח' }),
  Object.freeze({ id: 'theme', title: 'ערכת צבעים', short: 'צבעים' }),
  Object.freeze({ id: 'notifications', title: 'התראות', short: 'התראות' }),
  Object.freeze({ id: 'challenge', title: 'האתגר העולמי', short: 'אתגר' }),
]);
export const sectionTitle = id => SETTINGS_SECTIONS.find(section => section.id === id)?.title || '';

// [id, section, title, words]: the id is the row's data-setting on the page.
const ENTRIES = [
  ['a11y-auto', 'accessibility', 'התאמה אוטומטית למכשיר', 'אוטומטי מכשיר מערכת טלפון אייפון אנדרואיד'],
  ['a11y-text', 'accessibility', 'גודל טקסט', 'גופן פונט אותיות הגדלה הקטנה גדול קטן כתב גודל אות זום'],
  ['a11y-spacing', 'accessibility', 'מרווח שורות', 'שורות רווח מרווח צפיפות ריווח'],
  ['a11y-bold', 'accessibility', 'טקסט מודגש', 'מודגש הדגשה עבה בולד גופן'],
  ['a11y-contrast', 'accessibility', 'ניגודיות גבוהה', 'ניגודיות קונטרסט חדות קווים ראות'],
  ['a11y-transparency', 'accessibility', 'הפחתת שקיפות', 'שקיפות שקוף אטום'],
  ['a11y-motion', 'accessibility', 'הפחתת תנועה', 'תנועה אנימציה הנפשה סחרחורת'],
  ['a11y-haptics', 'accessibility', 'משוב מישושי', 'רטט ויברציה מישוש משוב הפטי'],
  ['a11y-focused', 'accessibility', 'קריאה ממוקדת', 'קריאה ממוקדת ריכוז קישוטים הערות'],
  ['a11y-reset', 'accessibility', 'איפוס להגדרות המכשיר', 'איפוס אתחול ברירת מחדל'],
  ['a11y-statement', 'accessibility', 'הצהרת נגישות ודיווח', 'הצהרה דיווח תקלה בעיה מייל'],
  ['location-active', 'location', 'מיקום פעיל', 'מיקום עיר מקום ישוב חיפוש איתור GPS זמנים'],
  ['location-status', 'location', 'מעמד הלכתי', 'מעמד תושב ישראל חו״ל חוץ לארץ גולה'],
  ['location-diaspora', 'location', 'מצב חו״ל ויום טוב שני', 'יום טוב שני חו״ל חג מגורים'],
  ['location-manual', 'location', 'מיקום ידני · קואורדינטות ואזור זמן', 'ידני קואורדינטות קו רוחב קו אורך אזור זמן IANA גובה'],
  ['nusach', 'nusach', 'נוסח התפילה', 'נוסח סידור תפילה ספרד אשכנז עדות המזרח ספרדי חב״ד חסידים מנהג'],
  ['theme', 'theme', 'ערכת צבעים', 'צבע צבעים עיצוב ערכה מראה רקע כהה בהיר לילה מרווה כחול שזיף קורל טורקיז זהב'],
  ['notify-status', 'notifications', 'אישור התראות', 'התראות הרשאה אישור תזכורות'],
  ['notify-reminders', 'notifications', 'תזכורות', 'תזכורות התראות קריאת שמע מנחה נרות הדלקת עומר ברכות השחר לימוד יומי שניים מקרא צדקה חנוכה לבנה אילנות תיקון חצות שמע על המיטה'],
  ['notify-mazkir', 'notifications', 'המזכיר היהודי', 'המזכיר תזכורות שעות פרטים תאריכים עבריים ימי הולדת נישואין'],
  ['notify-alarm', 'notifications', 'השעון היהודי', 'שעון מעורר השכמה צלצול'],
  ['notify-memorial', 'notifications', 'נר זיכרון', 'אזכרה יארצייט נר זיכרון'],
  ['challenge-participate', 'challenge', 'השתתפות באתגר העולמי', 'אתגר עולמי יומי שעשועון טריוויה חידון שאלות השתתפות'],
  ['challenge-board', 'challenge', 'הופעה בטבלת השיאים', 'טבלה שיאים דירוג מקום תחרות לוח'],
  ['challenge-nickname', 'challenge', 'הכינוי', 'כינוי שם משתמש ניק'],
  ['challenge-delete', 'challenge', 'מחיקת הנתונים שלי מהשרת', 'מחיקה מחק נתונים פרטיות שרת'],
];

// Gershayim and geresh are dropped (not spaced), so "חו״ל", "חו\"ל" and "חול" are one word.
const fold = text => normalizeForSearch(String(text || '').replace(/[״׳"'`]/g, ''));

export const SETTINGS_INDEX = Object.freeze(ENTRIES.map(([id, section, title, words]) => Object.freeze({
  id, section, title, sectionTitle: sectionTitle(section),
  haystack: ` ${fold(`${title} ${sectionTitle(section)} ${words}`)} `,
})));

const PREFIX = /^[הובלמש](?=...)/;
// Spelling with niqqud is usually without matres lectionis ("נֻסַּח", "גֹּפֶן"): a second, looser comparison drops ו and י
// inside a word, so "נסח" finds נוסח and "גפן" finds גופן.
const loose = text => text.replace(/(?<=[א-ת])[וי]+/g, '');
// The words of a query, normalised; an empty query is [].
export function settingsQueryWords(query) {
  return fold(query).split(' ').filter(Boolean);
}
// A word is found at the start of a word of the setting ("צבע" → צבעים), never in the middle of one ("חול" ≠ כחול).
const at = (haystack, word) => haystack.includes(` ${word}`);
const foundOne = (haystack, word) => at(haystack, word) || at(loose(haystack), loose(word));
const found = (haystack, word) => foundOne(haystack, word) || (PREFIX.test(word) && foundOne(haystack, word.replace(PREFIX, '')));

// The settings that match every word of the query, in the page's order (a title match first within the section).
export function searchSettings(query, index = SETTINGS_INDEX) {
  const words = settingsQueryWords(query);
  if (!words.length) return [];
  const order = id => SETTINGS_SECTIONS.findIndex(section => section.id === id);
  return index
    .filter(entry => words.every(word => found(entry.haystack, word)))
    .map((entry, position) => ({ entry, position, titled: words.every(word => found(` ${fold(entry.title)} `, word)) }))
    .sort((a, b) => order(a.entry.section) - order(b.entry.section) || Number(b.titled) - Number(a.titled) || a.position - b.position)
    .map(({ entry }) => entry);
}

// The sections that hold at least one match (the page hides the others while a query is typed).
export const matchingSections = results => [...new Set(results.map(entry => entry.section))];
