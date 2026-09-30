// A halacha book's titled contents (edition.topics: [{ title, from, to, part? }], from the provider's own structure —
// scripts/library/build-halacha-topics.mjs) and the filter of its contents page.

// The groups a node belongs to (a siman shared by two groups — "כלאי זרעים" and "כלאי בהמה" in one siman — is in both).
export const topicsAt = (edition, node) => (edition?.topics || []).filter(topic => node >= topic.from && node <= topic.to);
// The reader's line under the heading: the group's name ("הלכות ציצית"), or both names of a shared siman.
export const topicLabel = (edition, node) => topicsAt(edition, node).map(topic => topic.title).join(' · ') || null;

// Contents are searched the way people type: without nikud, geresh or gershayim, and with or without the vowel letters
// (the Kitzur prints "חנכה", people type "חנוכה"); "קלט" finds "סימן קל״ט".
export function contentsKey(text) {
  return String(text ?? '')
    .replace(/[֑-ׇ]/g, '')
    .replace(/[׳״'"`]/g, '')
    .replace(/[וי]/g, '')
    .replace(/[^א-תa-z0-9 ]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
export const contentsMatch = (query, ...texts) => {
  const key = contentsKey(query);
  return !key || texts.some(text => contentsKey(text).includes(key));
};
