// Plain reading text from provider HTML (Sefaria): footnotes out, tags out, entities decoded, whitespace collapsed.
// The same rule as build-collection.mjs (which cannot be imported: it runs a build when loaded). A literal angle
// bracket left in the prose becomes ‹ › (the pack grammar reserves < > for markup) and is counted.
const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", thinsp: ' ', ndash: '–', mdash: '—' };

export function cleanText(value, stats = {}) {
  let text = String(value ?? '')
    .replace(/<sup[^>]*class="footnote-marker"[^>]*>[\s\S]*?<\/sup>/gi, '')
    .replace(/<i[^>]*class="footnote"[^>]*>[\s\S]*?<\/i>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => (code[0] === '#' ? String.fromCodePoint(code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1))) : ENTITIES[code.toLowerCase()] ?? match));
  if (/[<>]/.test(text)) { stats.brackets = (stats.brackets || 0) + 1; text = text.replace(/</g, '‹').replace(/>/g, '›'); }
  return text.replace(/\s+/g, ' ').trim();
}
