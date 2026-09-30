// Passages an edition prints apart inside the running text — the Beit Yosef's own later additions (בדק הבית), set in
// smaller type in the Vilna print — are stored as ranges on the unit: g: [[from, to]], offsets in the unit's text
// (line breaks included). The reader marks them at the same reading size (never smaller); the words are unchanged.

// The runs of one stretch of a unit's text that starts at `start` (its offset in the whole text): [{ text, gloss }].
export function glossRuns(text, ranges = [], start = 0) {
  const value = String(text ?? '');
  const end = start + value.length;
  const runs = [];
  let cursor = start;
  for (const [from, to] of [...(ranges || [])].sort((a, b) => a[0] - b[0])) {
    const a = Math.max(from, cursor);
    const b = Math.min(to, end);
    if (b <= a) continue;
    if (a > cursor) runs.push({ text: value.slice(cursor - start, a - start), gloss: false });
    runs.push({ text: value.slice(a - start, b - start), gloss: true });
    cursor = b;
  }
  if (cursor < end || !runs.length) runs.push({ text: value.slice(cursor - start), gloss: false });
  return runs.filter(run => run.text);
}

// A unit's paragraphs (split at its line breaks), each as its runs.
export function glossParagraphs(item) {
  const out = [];
  let start = 0;
  for (const text of String(item.text ?? '').split('\n')) {
    out.push(glossRuns(text, item.g, start));
    start += text.length + 1;
  }
  return out;
}
