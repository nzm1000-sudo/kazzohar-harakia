// What each "שיתוף כתמונה" card says, per kind of text — with its source line and the attribution its rights require.
// Returns null when a text should not leave the app as an image (a sensitive or personal halacha, a high-stakes
// עונג שבת ruling, a book passage that would have to be cut, a blessing that depends on conditions).
import { hebrewNumeral } from './hebrewNumerals.mjs';
import { stripCantillation } from './shareImage.mjs';

export const TANAKH_CREDIT = 'נוסח המקרא: UXLC ‏(tanach.us) · נחלת הכלל';
// עונג שבת is carried by its author's permission (data/library/registry.mjs AUTHOR_PERMISSION_WORKS): the book's name,
// the author and the rights line always go with its words, and its words are never cut or changed.
export const ONG_SHARE_CREDIT = 'עונג שבת · הרב ישראל שריקי';
export const ONG_SHARE_NOTICE = 'באישור המחבר · כל הזכויות שמורות למחבר';
const ONG_MAX_CHARS = 700;

export function verseShareSpec(verse) {
  if (!verse?.text || !verse?.reference) return null;
  return { kind: 'verse', body: verse.text, source: verse.reference, credit: TANAKH_CREDIT };
}

// An excerpt of a psalm: whole verses from the first shown, up to about 480 letters (at least one verse), and the range
// in the source line ("תהילים פרק כג, א–ו"); the whole chapter when it fits.
export function tehillimShareSpec(chapter, verses, { firstVerse = 1, maxChars = 480 } = {}) {
  const list = (verses || []).map(verse => stripCantillation(verse).trim()).filter(Boolean);
  if (!chapter || !list.length) return null;
  const chosen = [];
  let size = 0;
  for (const verse of list) {
    if (chosen.length && size + verse.length > maxChars) break;
    chosen.push(verse);
    size += verse.length;
  }
  const last = firstVerse + chosen.length - 1;
  const whole = firstVerse === 1 && chosen.length === list.length;
  const chapterLabel = `תהילים פרק ${hebrewNumeral(chapter)}`;
  const range = whole ? '' : firstVerse === last ? `, פסוק ${hebrewNumeral(firstVerse)}` : `, פסוקים ${hebrewNumeral(firstVerse)}–${hebrewNumeral(last)}`;
  return { kind: 'tehillim', lines: chosen, source: `${chapterLabel}${range}`, credit: TANAKH_CREDIT };
}

// A halacha answer. Yalkut Yosef entries: the verified practical answer with the source it rests on. עונג שבת: the
// book's own words in full, with the author and the rights notice.
export function halachaShareSpec(question) {
  if (!question || question.sensitivity === 'sensitive' || question.personal) return null;
  const first = question.sources?.[0];
  if (question.sourceBook === 'ong-shabbat') {
    if (question.highStakes || !first?.excerpt || first.excerpt.length > ONG_MAX_CHARS) return null;
    return { kind: 'halacha', title: question.question, body: first.excerpt, source: `עונג שבת, ${first.citation}`, credit: ONG_SHARE_CREDIT, notice: ONG_SHARE_NOTICE };
  }
  if (question.quality !== 'verified' || !question.shortAnswer || !first?.citation) return null;
  return { kind: 'halacha', title: question.question, body: question.shortAnswer, source: `על פי ${first.work || 'ילקוט יוסף'}, ${first.citation}` };
}

// A blessing card with both blessings settled (not "לפי התנאים", not "טרם אומת"); its source lines as on the card.
export function blessingShareSpec(view) {
  const before = view?.before?.label;
  const after = view?.after?.label;
  if (!view?.name || !before || !after || view.before?.pending || view.after?.pending) return null;
  const sources = (view.sources || []).filter(Boolean);
  if (!sources.length) return null;
  return { kind: 'blessing', title: view.name, lines: [`לפני: ${before}`, `אחרי: ${after}`], source: sources.join(' · ') };
}
