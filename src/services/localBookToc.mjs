import { hebrewNumeral } from './hebrewNumerals.mjs';

export function buildLocalBookToc(book, booksOffline = {}) {
  const references = String(book?.reference || '').split(/\s*;\s*/).map(value => value.trim()).filter(Boolean);
  const sections = references.map((reference, index) => ({
    key: `${book.id || reference}:${index + 1}`,
    label: references.length === 1 ? 'הספר המלא' : `${book.title} · חלק ${hebrewNumeral(index + 1)}`,
    ref: reference,
    mode: 'nikud',
  }));
  return {
    // The bundled corpus is intentionally flat and does not preserve a source schema.
    // Never invent chapter/section boundaries from paragraph offsets.
    fallback: sections.length <= 1,
    sections: sections.filter(section => booksOffline?.[section.ref]),
  };
}
