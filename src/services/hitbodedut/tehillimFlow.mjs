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

// ── The wheel (תהילים ברצף as a drum of verses) ─────────────────────────────────────────────────────────────────────
// The order of the chapters: from a chosen chapter onwards, or a random order drawn from a shuffle bag that is kept on
// the device — every chapter comes once before any comes again, across sessions too.
export const TEHILLIM_ORDERS = Object.freeze({
  sequential: { id: 'sequential', title: 'לפי הסדר' },
  random: { id: 'random', title: 'סדר אקראי' },
});
export const normalizeOrder = value => (value === 'random' ? 'random' : 'sequential');
export const SHUFFLE_KEY = 'kz-hitbodedut-tehillim-bag-v1';

// A fresh shuffled list of 1…150 (Fisher–Yates); `avoidFirst` (the chapter just read) is never put first.
export function shuffledChapters(random = Math.random, avoidFirst = null) {
  const list = Array.from({ length: TEHILLIM_CHAPTERS }, (_, index) => index + 1);
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  if (avoidFirst != null && list[0] === avoidFirst) [list[0], list[list.length - 1]] = [list[list.length - 1], list[0]];
  return list;
}

// The bag: draw() takes the next chapter and saves what is left; an empty (or broken) bag is refilled with a new shuffle.
export function createShuffleBag({ storage = null, random = Math.random, key = SHUFFLE_KEY } = {}) {
  const read = () => {
    try {
      const value = JSON.parse(storage?.getItem(key) || 'null');
      const bag = Array.isArray(value?.bag) ? value.bag.filter(chapter => Number.isInteger(chapter) && chapter >= 1 && chapter <= TEHILLIM_CHAPTERS) : [];
      return { bag: [...new Set(bag)], last: Number.isInteger(value?.last) ? value.last : null };
    } catch { return { bag: [], last: null }; }
  };
  const write = value => { try { storage?.setItem(key, JSON.stringify(value)); } catch {} };
  return {
    get remaining() { return read().bag.length; },
    draw() {
      let { bag, last } = read();
      if (!bag.length) bag = shuffledChapters(random, last);
      const chapter = bag.shift();
      write({ bag, last: chapter });
      return chapter;
    },
    reset() { try { storage?.removeItem(key); } catch {} },
  };
}

// The next chapter of a session: the one after `previous` in order, or the bag's next in random order.
export function nextWheelChapter({ order, previous = null, start = 1, bag = null }) {
  if (normalizeOrder(order) === 'random' && bag) return bag.draw();
  return previous == null ? clampChapter(start) : nextChapter(previous);
}

// The wheel's items for one chapter: a quiet title, then its verses.
export function wheelItems(chapter, verses = []) {
  const items = [{ type: 'title', chapter, key: `${chapter}:t` }];
  verses.forEach((text, index) => items.push({ type: 'verse', chapter, index, text, last: index === verses.length - 1, key: `${chapter}:${index}` }));
  return items;
}

// How long an item stays in the centre: a calm reading pace by the number of words, at one of five speeds.
export const WHEEL_SPEEDS = Object.freeze([0.6, 0.8, 1, 1.25, 1.6]);
export const DEFAULT_WHEEL_SPEED = 2;
export const clampSpeed = value => Math.min(WHEEL_SPEEDS.length - 1, Math.max(0, Math.round(Number.isFinite(Number(value)) ? Number(value) : DEFAULT_WHEEL_SPEED)));
export function itemDurationMs(item, speedIndex = DEFAULT_WHEEL_SPEED) {
  const factor = WHEEL_SPEEDS[clampSpeed(speedIndex)];
  if (!item) return 3000;
  if (item.type === 'title') return Math.round(3200 / factor);
  const words = String(item.text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.round((2200 + words * 520) / factor);
}
