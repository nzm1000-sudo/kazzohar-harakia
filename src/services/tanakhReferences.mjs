import { hebrewNumeral } from './hebrewNumerals.mjs';

const TANAKH_REFERENCE_BOOKS = new Map([
  ['Genesis', 'בראשית'], ['Exodus', 'שמות'], ['Leviticus', 'ויקרא'], ['Numbers', 'במדבר'], ['Deuteronomy', 'דברים'],
  ['Joshua', 'יהושע'], ['Judges', 'שופטים'], ['Samuel_1', 'שמואל א'], ['Samuel_2', 'שמואל ב'],
  ['Kings_1', 'מלכים א'], ['Kings_2', 'מלכים ב'], ['Isaiah', 'ישעיהו'], ['Jeremiah', 'ירמיהו'], ['Ezekiel', 'יחזקאל'],
  ['Hosea', 'הושע'], ['Joel', 'יואל'], ['Amos', 'עמוס'], ['Obadiah', 'עובדיה'], ['Jonah', 'יונה'], ['Micah', 'מיכה'],
  ['Nahum', 'נחום'], ['Habakkuk', 'חבקוק'], ['Zephaniah', 'צפניה'], ['Haggai', 'חגי'], ['Zechariah', 'זכריה'], ['Malachi', 'מלאכי'],
  ['Psalms', 'תהילים'], ['Proverbs', 'משלי'], ['Job', 'איוב'], ['Song_of_songs', 'שיר השירים'], ['Ruth', 'רות'],
  ['Lamentations', 'איכה'], ['Ecclesiastes', 'קהלת'], ['Esther', 'אסתר'], ['Daniel', 'דניאל'], ['Ezra', 'עזרא'],
  ['Nehemiah', 'נחמיה'], ['Chronicles_1', 'דברי הימים א'], ['Chronicles_2', 'דברי הימים ב'],
  ['I Samuel', 'שמואל א'], ['II Samuel', 'שמואל ב'], ['I Kings', 'מלכים א'], ['II Kings', 'מלכים ב'],
]);

export function formatTanakhReference(bookName, chapter, verse) {
  if (chapter === undefined && verse === undefined) {
    const match = String(bookName || '').trim().match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+)(?::(\d+))?)?$/);
    if (!match) return String(bookName || '');
    const [, book, chapterValue, verseValue, endChapter, endVerse] = match;
    const hebrewBook = TANAKH_REFERENCE_BOOKS.get(book) || book;
    const start = `${hebrewNumeral(chapterValue)}, ${hebrewNumeral(verseValue)}`;
    if (!endChapter) return `${hebrewBook} ${start}`;
    const end = endVerse ? `${hebrewNumeral(endChapter)}, ${hebrewNumeral(endVerse)}` : hebrewNumeral(endChapter);
    return `${hebrewBook} ${start}–${end}`;
  }
  return `${bookName} ${hebrewNumeral(chapter)}, ${hebrewNumeral(verse)}`;
}

export function formatTanakhReferences(value) {
  return String(value || '').split(';').map(reference => reference.trim()).filter(Boolean).map(reference => formatTanakhReference(reference)).join(' · ');
}

export function formatVisibleSourceTitle(title, reference = title) {
  const value = String(title || reference || '').trim();
  const tanakhTitle = formatTanakhReferences(value);
  if (tanakhTitle !== value) return tanakhTitle;
  if (/^Yalkut Yosef\b/i.test(value) || /^Yalkut Yosef\b/i.test(reference) || /^yalkut-yosef-/i.test(reference) || /^ילקוט יוסף(?:\s*·)?/u.test(value)) {
    const suffix = value
      .replace(/^(?:Yalkut Yosef\s*)+/i, '')
      .replace(/^(?:ילקוט יוסף\s*·?\s*)+/u, '')
      .replace(/\s*·\s*סימן(?:ים)?\s+[^–—-]+[–—-][^·]*$/u, '')
      .replace(/^סימן(?:ים)?\s+[^–—-]+[–—-]\s*/u, '')
      .trim();
    return suffix && !/^yalkut-yosef-/i.test(suffix) ? `ילקוט יוסף · ${suffix}` : 'ילקוט יוסף · קיצור שולחן ערוך';
  }
  return value;
}
