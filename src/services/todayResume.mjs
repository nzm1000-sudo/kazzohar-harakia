// היום › "להמשיך מהיכן שהפסקת" (CLAY, owner 2026-10-02): always four tiles, a symmetric 2×2.
//   right column (fixed):  תפילה חכמה (top) · בשרי · חלבי (below it) — they never move;
//   left column (recent):  the last two things actually opened, the most recent on top; they replace each other as
//                          other things are opened. A brand-new user sees סידור and שעשועון טריוויה there.
// "Opened" = a reading kept by the learning memory (services/learningMemory.mjs — it shows its position, as before) or
// one of the app's places below (recorded here when the place is shown). Pure logic; NewApp records, TodayPage draws.
export const RECENT_PLACES_KEY = 'kz-recent-places-v1';
const KEEP = 8;

// The places a recent tile can name: [route, title, the line under it].
export const PLACES = Object.freeze({
  siddur: { route: 'siddur', title: 'סידור', note: 'תפילות לפי השעה' },
  'leatzmi/quiz': { route: 'leatzmi/quiz', title: 'שעשועון טריוויה', note: 'טריוויה, ידע ורוח' },
  tehillim: { route: 'tehillim', title: 'תהילים', note: 'ספר התהילים' },
  calendar: { route: 'calendar', title: 'לוח שנה', note: 'חגים ומועדים' },
  times: { route: 'times', title: 'זמנים', note: 'זמני היום' },
  halacha: { route: 'halacha', title: 'הלכה', note: 'שאלות ותשובות' },
  books: { route: 'books', title: 'ספרים', note: 'הספרייה' },
  talmud: { route: 'talmud', title: 'תלמוד', note: 'דף ולימוד יומי' },
  parasha: { route: 'parasha', title: 'פרשת השבוע', note: 'קריאה ודברי תורה' },
  otiyot: { route: 'otiyot', title: 'אותיות 26', note: 'סוד האותיות' },
  'shalom-rav': { route: 'shalom-rav', title: 'שלום רב', note: 'הספר' },
  'torat-shai': { route: 'torat-shai', title: 'תורת ש״י', note: 'דברי תורה' },
  'chok-leyisrael': { route: 'chok-leyisrael', title: 'חק לישראל', note: 'הלימוד היומי' },
  'siddur-zemirot': { route: 'siddur-zemirot', title: 'פיוטים וזמירות', note: 'שירי שבת וחג' },
  leatzmi: { route: 'leatzmi', title: 'לעצמי', note: 'רגע של עצמי' },
  'leatzmi/hitbodedut': { route: 'leatzmi/hitbodedut', title: 'התבודדות', note: 'שיחה עם הבורא' },
  'mitzvot-journal': { route: 'mitzvot-journal', title: 'המעגל הרוחני', note: 'האורות שלך' },
  'personal-tools': { route: 'personal-tools', title: 'כלים אישיים', note: 'הכלים שלך' },
});
export const DEFAULT_RECENTS = Object.freeze(['siddur', 'leatzmi/quiz']);
// A learning reading from these sources already names the place, so the bare place is not shown beside it.
const COVERED_BY_LEARNING = { tehillim: 'tehillim', talmud: 'talmud' };

export function placeKeyFor(route) {
  const parts = String(route || '').split('/').filter(Boolean);
  if (!parts.length) return null;
  const two = parts.slice(0, 2).join('/');
  if (PLACES[two]) return two;
  return PLACES[parts[0]] ? parts[0] : null;
}

function storage() { try { return globalThis.localStorage || null; } catch { return null; } }
export function readRecentPlaces(store = storage()) {
  try {
    const list = JSON.parse(store?.getItem(RECENT_PLACES_KEY) || '[]');
    return Array.isArray(list) ? list.filter(entry => PLACES[entry?.key] && Number.isFinite(Date.parse(entry.at))) : [];
  } catch { return []; }
}

// Shown a place: it becomes the most recent (once — the same place again only moves it up).
export function recordPlace(route, { store = storage(), now = new Date() } = {}) {
  const key = placeKeyFor(route);
  if (!key) return readRecentPlaces(store);
  const next = [{ key, at: new Date(now).toISOString() }, ...readRecentPlaces(store).filter(entry => entry.key !== key)].slice(0, KEEP);
  try { store?.setItem(RECENT_PLACES_KEY, JSON.stringify(next)); } catch { /* private browsing: kept for this session only */ }
  return next;
}

// The two recent tiles, most recent first: learning readings and places, by when each was last opened.
export function recentTiles({ learning = [], places = [] } = {}) {
  const learned = learning.filter(item => item && item.reference);
  const covered = new Set(learned.map(item => COVERED_BY_LEARNING[item.source]).filter(Boolean));
  const candidates = [
    ...learned.map(item => ({ kind: 'learning', key: `learning:${item.id}`, at: Date.parse(item.lastOpenedAt) || 0, item })),
    ...places.filter(entry => !covered.has(entry.key)).map(entry => ({ kind: 'place', key: `place:${entry.key}`, at: Date.parse(entry.at) || 0, place: PLACES[entry.key], placeKey: entry.key })),
  ].sort((a, b) => b.at - a.at);
  const seen = new Set();
  const tiles = [];
  for (const tile of candidates) {
    if (seen.has(tile.key)) continue;
    seen.add(tile.key);
    tiles.push(tile);
    if (tiles.length === 2) return tiles;
  }
  for (const key of DEFAULT_RECENTS) {
    if (tiles.length === 2) break;
    if (seen.has(`place:${key}`)) continue;
    seen.add(`place:${key}`);
    tiles.push({ kind: 'place', key: `place:${key}`, at: 0, place: PLACES[key], placeKey: key, isDefault: true });
  }
  return tiles;
}
