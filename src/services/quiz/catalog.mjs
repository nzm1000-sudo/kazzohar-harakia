// בחן אותי — the fixed vocabulary of the game: categories, levels, session sizes. Pure data, no DOM.

// The eleven areas of src/data/quiz/SCHEMA.md, in the order the quiz home shows them (with "הכול" first: twelve
// choices, a symmetric 3 × 4 grid).
export const CATEGORIES = [
  { id: 'all', label: 'הכול' },
  { id: 'tanakh', label: 'תנ״ך' },
  { id: 'torah-stories', label: 'סיפורי התורה' },
  { id: 'places', label: 'מקומות' },
  { id: 'people', label: 'אישים' },
  { id: 'history', label: 'היסטוריה יהודית', short: 'היסטוריה' },
  { id: 'halacha', label: 'הלכה' },
  { id: 'shabbat', label: 'שבת' },
  { id: 'moadim', label: 'מועדים' },
  { id: 'brachot', label: 'ברכות' },
  { id: 'tefila', label: 'תפילה' },
  { id: 'yahadut', label: 'יהדות' },
];
export const CATEGORY_IDS = CATEGORIES.filter(c => c.id !== 'all').map(c => c.id);
export const categoryLabel = id => CATEGORIES.find(c => c.id === id)?.label || '';

// 1 מתחיל · 2 בינוני · 3 מתקדם, and 'adaptive' (משתנה): the difficulty follows the player.
export const LEVELS = [
  { id: 'easy', label: 'מתחיל', difficulty: 1 },
  { id: 'medium', label: 'בינוני', difficulty: 2 },
  { id: 'hard', label: 'מתקדם', difficulty: 3 },
  { id: 'adaptive', label: 'משתנה', difficulty: null },
];
export const LEVEL_IDS = LEVELS.map(l => l.id);
export const levelLabel = id => LEVELS.find(l => l.id === id)?.label || '';
export const DIFFICULTY_LABEL = { 1: 'מתחיל', 2: 'בינוני', 3: 'מתקדם' };

export const SESSION_SIZES = [5, 10, 15];
export const DEFAULT_SESSION_SIZE = 10;
// The optional timer (off by default): seconds per question.
export const TIMER_SECONDS = 30;
