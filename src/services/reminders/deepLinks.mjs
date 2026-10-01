// Where a reminder's notification leads when it is tapped. A target is a plain string kept in the notification's
// `extra.route`:
//   prayer/<shacharit|mincha|maariv|omer|candles> → the Siddur opens that prayer directly (the Omer count; the
//                                                  Shabbat candle-lighting blessing; Shacharit, where Shema is read)
//   prayer/<chanukah|bedtime-shema|tikkun-chatzot|birkot-hashachar|levana|ilanot> → המזכיר היהודי's texts in the Siddur
//                                                  (services/reminders/siddurTargets.mjs; the rite's own text, if it has one)
//   any other app route (e.g. personal-tools/memorial/<id>, jewish-alarm/reminders/e/<id>) → that screen.
// Anything unknown or malformed opens nothing (never a crash, never an arbitrary URL).
export const PRAYER_TARGETS = Object.freeze(['shacharit', 'mincha', 'maariv', 'omer', 'candles', 'chanukah', 'bedtime-shema', 'tikkun-chatzot', 'birkot-hashachar', 'levana', 'ilanot']);
const ROUTE_PREFIXES = Object.freeze(['personal-tools/memorial', 'personal-tools/mazkir', 'jewish-alarm', 'siddur', 'shabbat-page', 'books', 'shnayim-mikra', 'learning']);
const SAFE = /^[A-Za-z0-9\-/%._]+$/;

export function parseDeepLink(target) {
  const text = String(target || '').trim().replace(/^#/, '');
  if (!text || text.length > 200 || !SAFE.test(text) || text.includes('..')) return null;
  const [head, second] = text.split('/');
  if (head === 'prayer') return PRAYER_TARGETS.includes(second) ? { kind: 'prayer', prayer: second } : null;
  if (ROUTE_PREFIXES.some(prefix => text === prefix || text.startsWith(`${prefix}/`))) return { kind: 'route', route: text };
  return null;
}

export const REMINDER_TAP_EVENT = 'kz-reminder-open';
