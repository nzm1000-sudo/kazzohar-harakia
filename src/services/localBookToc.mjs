import { hebrewNumeral } from './hebrewNumerals.mjs';

const MISHNAH_SEDERS = {
  'Seder Zeraim': 'זרעים',
  'Seder Moed': 'מועד',
  'Seder Nashim': 'נשים',
  'Seder Nezikin': 'נזיקין',
  'Seder Kodashim': 'קודשים',
  'Seder Tahorot': 'טהרות',
};

const MISHNAH_SHAPE = [
  { section: 'Seder Zeraim', title: 'Mishnah Berakhot', heTitle: 'משנה ברכות', chapters: [5, 8, 6, 7, 5, 8, 5, 8, 5] },
  { section: 'Seder Zeraim', title: 'Mishnah Peah', heTitle: 'משנה פאה', chapters: [6, 8, 8, 11, 8, 11, 8, 9] },
  { section: 'Seder Zeraim', title: 'Mishnah Demai', heTitle: 'משנה דמאי', chapters: [4, 5, 6, 7, 11, 12, 8] },
  { section: 'Seder Zeraim', title: 'Mishnah Kilayim', heTitle: 'משנה כלאים', chapters: [9, 11, 7, 9, 8, 9, 8, 6, 10] },
  { section: 'Seder Zeraim', title: 'Mishnah Sheviit', heTitle: 'משנה שביעית', chapters: [8, 10, 10, 10, 9, 6, 7, 11, 9, 9] },
  { section: 'Seder Moed', title: 'Mishnah Shabbat', heTitle: 'משנה שבת', chapters: [6, 6, 5, 9, 5, 6, 7, 4, 6, 7] },
  { section: 'Seder Moed', title: 'Mishnah Eruvin', heTitle: 'משנה עירובין', chapters: [10, 10, 10, 10, 10, 10, 10, 10] },
  { section: 'Seder Moed', title: 'Mishnah Pesahim', heTitle: 'משנה פסחים', chapters: [8, 8, 8, 8, 8, 8, 8, 8, 8] },
  { section: 'Seder Nashim', title: 'Mishnah Ketubot', heTitle: 'משנה כתובות', chapters: [8, 8, 8, 8, 8] },
  { section: 'Seder Nezikin', title: 'Mishnah Sanhedrin', heTitle: 'משנה סנהדרין', chapters: [11, 11, 11, 11, 11, 11] },
  { section: 'Seder Kodashim', title: 'Mishnah Zevachim', heTitle: 'משנה זבחים', chapters: [14, 14, 14, 14, 14] },
  { section: 'Seder Tahorot', title: 'Mishnah Niddah', heTitle: 'משנה נדה', chapters: [10, 10, 10, 10, 10] },
];

export function buildMishnahToc(book, booksOffline = {}) {
  const sections = [];
  for (const entry of MISHNAH_SHAPE) {
    const sederLabel = MISHNAH_SEDERS[entry.section] || entry.section.replace(/^Seder\s+/, '');
    sections.push({
      key: `${book.id}:${entry.title}:masechet`,
      label: `${sederLabel} · ${entry.heTitle}`,
      ref: entry.title,
      mode: 'source',
      seder: sederLabel,
      masechet: entry.heTitle,
      kind: 'masechet',
    });
    entry.chapters.forEach((chapterCount, index) => {
      const chapter = index + 1;
      const perekRef = `${entry.title} ${chapter}`;
      sections.push({
        key: `${book.id}:${entry.title}:${chapter}:perek`,
        label: `פרק ${hebrewNumeral(chapter)}`,
        ref: perekRef,
        mode: 'source',
        seder: sederLabel,
        masechet: entry.heTitle,
        kind: 'perek',
      });
      for (let mishnah = 1; mishnah <= chapterCount; mishnah += 1) {
        sections.push({
          key: `${book.id}:${entry.title}:${chapter}:${mishnah}:mishnah`,
          label: `משנה ${hebrewNumeral(mishnah)}`,
          ref: `${perekRef}:${mishnah}`,
          mode: 'source',
          seder: sederLabel,
          masechet: entry.heTitle,
          kind: 'mishnah',
        });
      }
    });
  }
  return { fallback: false, sections: sections.filter(section => section.ref === book.reference || booksOffline?.[section.ref] || section.ref.startsWith('Mishnah ')) };
}

export function buildLocalBookToc(book, booksOffline = {}) {
  if (book?.id === 'mishnah') return buildMishnahToc(book, booksOffline);
  const references = String(book?.reference || '').split(/\s*;\s*/).map(value => value.trim()).filter(Boolean);
  const sections = references.map((reference, index) => ({
    key: `${book.id || reference}:${index + 1}`,
    label: references.length === 1 ? book.title || 'הספר' : `${book.title} · ${reference}`,
    ref: reference,
    mode: 'nikud',
  }));
  return {
    fallback: sections.length <= 1,
    sections: sections.filter(section => booksOffline?.[section.ref]),
  };
}
