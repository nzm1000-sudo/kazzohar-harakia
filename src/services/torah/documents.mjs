// What one search unit's text is, for every corpus — used identically by the index builder and by the reader that
// shows the snippet, so a highlighted word is always the word that was indexed. The text is the edition's own words.
//   pack unit        → its title (a halacha's heading), its opening words (dibbur hamatchil) and its text
//   Yalkut Yosef     → the section's text (its heading is shown as the reference)
//   halacha answer   → the published question, the short answer and the book's exact excerpt(s)
export function packUnitText(unit) {
  return [unit?.title, unit?.dh, unit?.text].filter(Boolean).join(' · ');
}
export function yalkutSectionText(section) {
  return String(section?.text || '');
}
export function answerText(entry) {
  const excerpts = (entry?.sources || []).map(source => source.excerpt).filter(Boolean);
  return [entry?.question, entry?.shortAnswer, ...excerpts].filter(Boolean).join(' · ');
}
// The two corpora outside the packs, in the builder's fixed order (unit n = position + 1).
export const EXTRA_STORES = Object.freeze({ 'yalkut-yosef': 'halacha.yalkut-yosef-tashz', 'halacha-answers': 'halacha.answers' });
