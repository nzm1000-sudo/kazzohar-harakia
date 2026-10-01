// תהילים ברצף — the order of the chapters in the flowing display: from the chosen chapter onwards, one after another,
// and after 150 back to 1 (a long session simply goes on). Pure.
import { hebrewNumeral } from '../hebrewNumerals.mjs';

export const TEHILLIM_CHAPTERS = 150;

export const clampChapter = value => Math.min(TEHILLIM_CHAPTERS, Math.max(1, Math.round(Number(value) || 1)));
export const nextChapter = chapter => (clampChapter(chapter) % TEHILLIM_CHAPTERS) + 1;

// The first `count` chapters of the flow, starting at `start`.
export function chapterSequence(start, count) {
  const list = [];
  let chapter = clampChapter(start);
  for (let i = 0; i < Math.max(0, count); i += 1) { list.push(chapter); chapter = nextChapter(chapter); }
  return list;
}

// "פרקים א׳–ה׳" / "פרק כ״ג" / "5 פרקים" — what was read, for the closing screen.
export function chaptersLabel(chapters) {
  const list = (chapters || []).filter(Number.isInteger);
  if (!list.length) return '';
  const name = value => hebrewNumeral(value);
  if (list.length === 1) return `פרק ${name(list[0])}`;
  const contiguous = list.every((value, index) => index === 0 || value === nextChapter(list[index - 1]));
  if (contiguous) return `פרקים ${name(list[0])}–${name(list[list.length - 1])}`;
  return `${list.length} פרקים`;
}
