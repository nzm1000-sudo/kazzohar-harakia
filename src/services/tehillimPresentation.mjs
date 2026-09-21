import { hebrewNumeral } from './hebrewNumerals.mjs';

export function formatTehillimChapter(chapter) {
  return hebrewNumeral(chapter);
}

export function tehillimTitle(chapter) {
  return `תהילים פרק ${formatTehillimChapter(chapter)}`;
}

export function tehillimResumeTitle(item) {
  const titleMatch = String(item?.title || '').match(/תהילים(?: פרק)?\s+(\d+)/);
  const referenceMatch = String(item?.reference || '').match(/^chapter\/(\d+)$/);
  const chapter = Number(titleMatch?.[1] || referenceMatch?.[1]);
  return Number.isInteger(chapter) && chapter >= 1 && chapter <= 150 ? tehillimTitle(chapter) : item?.title || 'תהילים';
}
