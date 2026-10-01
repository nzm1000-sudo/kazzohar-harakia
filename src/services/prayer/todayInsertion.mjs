// "התוספת של היום מודגשת בעדינות": the day's insertion in the Siddur and the blessings (מעין שלוש, ברכת המזון, יעלה
// ויבוא, על הניסים, משיב הרוח / מוריד הטל, ותן טל ומטר / ברכה, עננו, זכרנו…) carries a thin copper frame and a tiny
// "היום"; an insertion the day does not take, shown beside it, is gently dimmed. Presentation only: the decision is the
// day engine's (prayer/conditionalMarkup.mjs, siddurBlocks.mjs — the user's place and the sunset day change come in
// with the Jewish context), the words never change, and with no decision nothing is marked. Styles:
// styles/today-insertion.css.

export const TODAY_MARK = 'היום';

// The fields a block carries for its mark (kept when a composer copies a block).
export function todayInsertionFields(block = {}) {
  if (!block.day) return {};
  const out = { day: block.day };
  for (const key of ['frame', 'framePos', 'todayMark', 'dayLabel', 'printed']) if (block[key]) out[key] = block[key];
  return out;
}

// The block's classes: today-insertion (inside today's frame, at its position), today-insertion-other (dimmed),
// today-insertion-label (the insertion's caption).
export function todayInsertionClass(block = {}) {
  if (!block.day) return '';
  const classes = [];
  if (block.frame) classes.push('today-insertion', `is-frame-${block.framePos || 'single'}`);
  if (block.day === 'other') classes.push('today-insertion-other');
  if (block.dayLabel) classes.push('today-insertion-label');
  return classes.join(' ');
}

// Attributes for the block's paragraph: the mark is drawn by CSS from data-today-mark (never a word of the text, so it
// is not copied, shared or looked up as one); screen readers hear it from the description.
export function todayInsertionAttrs(block = {}) {
  if (!block.day) return {};
  return {
    'data-day': block.day,
    ...(block.todayMark ? { 'data-today-mark': TODAY_MARK, 'aria-description': 'התוספת של היום' } : {}),
    ...(block.day === 'other' && block.dayLabel ? { 'aria-description': 'לא נאמר היום' } : {}),
  };
}
