import { hebrewNumber } from './content.mjs';

const DAILY_TEHILLIM = [
  [1, 9], [10, 17], [18, 22], [23, 28], [29, 34], [35, 38], [39, 43], [44, 48],
  [49, 54], [55, 59], [60, 65], [66, 68], [69, 71], [72, 76], [77, 78], [79, 82],
  [83, 87], [88, 89], [90, 96], [97, 103], [104, 105], [106, 107], [108, 112], [113, 118],
  [119, 119, 1, 96], [119, 119, 97, 176], [120, 134], [135, 139], [140, 144], [145, 150],
];

const withPunctuation = value => {
  const text = hebrewNumber(value);
  if (text.length === 1) return `${text}׳`;
  return `${text.slice(0, -1)}״${text.slice(-1)}`;
};

export function getDailyTehillim(day) {
  if (!Number.isInteger(day) || day < 1 || day > DAILY_TEHILLIM.length) return null;
  const [start, end, verseStart = 1, verseEnd] = DAILY_TEHILLIM[day - 1];
  return { day, start, end, verseStart, verseEnd: verseEnd || (start === 119 ? 176 : null) };
}

export function dailyTehillimLabel(portion) {
  if (!portion) return '';
  const range = portion.start === portion.end
    ? `פרק ${withPunctuation(portion.start)}`
    : `פרקים ${withPunctuation(portion.start)}–${withPunctuation(portion.end)}`;
  if (portion.start === 119) return `${range} · פסוקים ${withPunctuation(portion.verseStart)}–${withPunctuation(portion.verseEnd)}`;
  return range;
}

export function dailyTehillimTitle(day) {
  return `תהילים ליום ${withPunctuation(day)} בחודש`;
}