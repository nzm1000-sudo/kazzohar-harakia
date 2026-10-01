// בחן אותי — a small built-in sample for the quiz tests (12 per area, difficulties 1–3, every second with a note).
import { CATEGORY_IDS } from '../../src/services/quiz/catalog.mjs';

const OPTION_SETS = [['א1', 'ב1', 'ג1', 'ד1'], ['א2', 'ב2', 'ג2', 'ד2']];
export const SAMPLE = CATEGORY_IDS.flatMap((category, c) => Array.from({ length: 12 }, (_, i) => ({
  id: `${category}-${String(i + 1).padStart(4, '0')}`, q: `שאלה ${i + 1} ב${category}?`, options: OPTION_SETS[i % 2].map(o => `${o}-${c}-${i}`),
  answer: (i + c) % 4, category, difficulty: (i % 3) + 1, tags: [category], ...(i % 2 ? { note: `מקור ${i}` } : {}),
})));
