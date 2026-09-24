import { formatTanakhChapterOnly } from './tanakhReferences.mjs';

// "Continue where you left off" cards show only the book + chapter for Tanakh
// chapter reading, never verse ranges or long reference strings.
export function learningResumeCompactTitle(item) {
  if (item?.source === 'tehillim' || item?.source === 'talmud') return null;
  return formatTanakhChapterOnly(item?.reference);
}

export function learningResumeKind(item) {
  if (item.source === 'tehillim') return 'תהילים';
  if (item.source === 'talmud') return 'תלמוד';
  if (/^Siddur\b/i.test(item.reference || '') || /\bSiddur\b/i.test(item.title || '')) return 'סידור';
  return 'לימוד';
}

export function learningResumeSubtitle(item) {
  const kind = learningResumeKind(item);
  if (kind === 'סידור') return 'סידור · המשך תפילה';
  if (kind === 'תלמוד') return 'תלמוד · המשך לימוד';
  if (kind === 'תהילים') return 'המשך קריאה';
  if (/^Yalkut Yosef\b/i.test(item.reference || '') || /^yalkut-yosef-/i.test(item.reference || '') || /ילקוט יוסף/u.test(item.title || '')) {
    return 'ילקוט יוסף · מהדורת תשס״ז';
  }
  const reference = String(item.reference || '').trim();
  return reference && !/[A-Za-z]/.test(reference) ? reference : (item.status === 'opened' ? 'נפתח לאחרונה' : 'המשך לימוד');
}