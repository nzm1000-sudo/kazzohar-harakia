// The Siddur's visual hierarchy — presentation only. It never changes text, conditions or order:
// it reads a block's semantic type and its own words and says how the block should LOOK.
//   prayer      — the words one says (largest, the reading font, ordinary text colour)
//   heading     — a section title (the terracotta editorial token, compact, bold)
//   instruction — a direction about what to say ("בחורף אומרים", "ואומר החזן", "יפסע שלש פסיעות")
//   minhag      — a custom note ("יש אומרים", "נוהגים", "טוב לומר") — instruction style, a little quieter
//   commentary  — an explanation / halachic note of the app
//   reference   — a source ("(תהילים קי״ג)", "(בא״ח ויגש)") — smallest, muted
// One shared system for the printed reader, the composed Mincha and the Smart Siddur.
import { removeNikud } from '../../hebrewText.mjs';

const plain = text => removeNikud(String(text || '')).replace(/<[^>]+>/g, '').replace(/[֑-֯]/g, '').replace(/[״]/g, '"').replace(/׳/g, "'").replace(/\s+/g, ' ').trim();

const BOOKS = 'תהילים|תהלים|בראשית|שמות|ויקרא|במדבר|דברים|יהושע|שופטים|שמואל|מלכים|ישעיה|ישעיהו|ירמיה|ירמיהו|יחזקאל|הושע|יואל|עמוס|עובדיה|יונה|מיכה|נחום|חבקוק|צפניה|חגי|זכריה|מלאכי|משלי|איוב|שיר השירים|רות|איכה|קהלת|אסתר|דניאל|עזרא|נחמיה|דברי הימים|דה"י';
const SOURCES = 'בא"ח|בן איש חי|כף החיים|כה"ח|שו"ע|שולחן ערוך|ילקוט יוסף|מורה באצבע|לשון חכמים|סנסן ליאיר|סנסן ליעיר|זוהר|ברכות|שבת|תענית|מגילה|סוכה|יומא|עפ"י|על פי|מגמרא';
const REFERENCE = new RegExp(`^\\(\\s*(?:${BOOKS}|${SOURCES})[^()]{0,60}\\)$`);
const MINHAG = /^(?:יש אומרים|יש נוהגים|ויש נוהגים|נוהגים|ונוהגים|ויש שמוסיפים|יש שמוסיפים|ויש מוסיפים|טוב לומר|סגולה|למנהג|יש מקומות)/;
// Directions: who says it, how, when, what to do.
// Directions only by who acts and how — never by a day word: the day's conditions were resolved before
// this point, and small-print prayer text may itself begin with one ("ביום טוב מקרא קדש הזה" in יעלה ויבוא).
const DIRECTION = /^(?:ו?אומר(?:ים)?\s|ו?עונים|ו?עונין|והקהל|הקהל|ו?החזן\s|וחוזר(?:ים)?\s|חוזרים|הש"ץ|ש"ץ|יפסע|פוסע|יכוין|יכוון|יכרע|כורע|ויזקוף|כשיאמר|כשאומר|כשמגיע|כשמוציאים|כשמכניסים|מוציאים|מחזירים|ומחזירים|פותחים|מוליכים|מגביה|ואחר כך|ואח"כ|אסור|עומדים|בלחש|בקול רם|אם שכח|אם אין|אם חל|בחזרת הש"ץ)/;
const REPETITIONS = /^\(?\s*(?:ב'|ג'|ז'|ב"פ|ג"פ|שתי|שלש|שלוש|שבע)?\s*(?:פעמים|פעמים\))\s*\)?$|^\(?(?:ב"פ|ג"פ)\)?$/;
const RESPONSE = /^\[[^\]]{1,12}\]$/; // "[אמן]" — the congregation's response
const ENDS_AS_DIRECTION = /(?:אומרים|אומר|מוסיפים|מוסיף|עונים|ואומרים|מדלגים|מברכים|יאמר)\s*:?$/;

export function displayRoleFor(text, type) {
  const value = plain(text);
  if (type === 'heading') return 'heading';
  if (type === 'note' || type === 'commentary') return 'commentary';
  if (type === 'source' || REFERENCE.test(value)) return 'reference';
  if (!value) return 'prayer';
  if (MINHAG.test(value) && value.length < 140) return 'minhag';
  if (RESPONSE.test(value) || REPETITIONS.test(value)) return 'instruction';
  if (type === 'instruction' || type === 'rubric') return 'instruction';
  const smallPrint = type === 'conditionalAddition';
  if (smallPrint && value.length < 160 && (DIRECTION.test(value) || ENDS_AS_DIRECTION.test(value))) return 'instruction';
  // Printed in ordinary type but plainly a direction ("במוצאי שבת אומרים", "ואומר החזן קדיש תתקבל").
  if (!smallPrint && value.length < 70 && (ENDS_AS_DIRECTION.test(value) || /^(?:ו?אומר החזן|ואומרים קדיש|ואומר העולה|ועונים הקהל|וחוזר|מחזירים|מוציאים|פותחים|העולה האחרון)/.test(value))) return 'instruction';
  return 'prayer';
}

export const DISPLAY_CLASS = Object.freeze({
  prayer: 'siddur-display-prayer',
  heading: 'siddur-display-heading',
  instruction: 'siddur-display-instruction',
  minhag: 'siddur-display-minhag',
  commentary: 'siddur-display-commentary',
  reference: 'siddur-display-reference',
});

// A source that interrupts a sentence of prayer ("הַלְלוּיָהּ (תהילים קי״ג) הַלְלוּ עַבְדֵי…") is set inline,
// small and muted, so the words keep flowing — instead of leaving "הללויה" alone on a line.
export function withPresentation(blocks) {
  const out = [];
  for (const block of blocks) {
    const display = block.display || displayRoleFor(block.text, block.type);
    const current = { ...block, display, className: `${block.className || ''} ${DISPLAY_CLASS[display]}`.trim() };
    const previous = out.at(-1);
    if (display === 'reference' && previous?.display === 'prayer' && previous.source === current.source) {
      previous.segments = [...(previous.segments || [{ text: previous.text }]), { text: current.text, reference: true }];
      previous.openReference = true;
      continue;
    }
    if (display === 'prayer' && previous?.openReference && previous.source === current.source) {
      previous.segments.push({ text: current.text });
      previous.text = previous.segments.map(segment => segment.text).join(' ');
      delete previous.openReference;
      continue;
    }
    if (previous?.openReference) delete previous.openReference;
    out.push(current);
  }
  if (out.at(-1)?.openReference) delete out.at(-1).openReference;
  return out;
}
