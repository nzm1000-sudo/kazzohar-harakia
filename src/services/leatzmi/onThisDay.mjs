// ביום הזה — a gentle look back, only inside the app (no notifications): what the user wrote around this Hebrew date
// in earlier years, what they wrote on this week's parasha before, and quiet milestones from "המצוות שלי".
// Pure: chidushim, journal events and today's date in; at most a few cards out. Never a count shown as a score.
import { HDate } from '@hebcal/core';
import { hebrewNumeral } from '../hebrewNumerals.mjs';
import { parashaOfWeek } from '../weeklyParasha.mjs';
import { toMs } from './storage.mjs';

const WINDOW_DAYS = 3; // "the same Hebrew week": three days either side of today's Hebrew date
const keyOf = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const hdate = when => new HDate(new Date(toMs(when)));

// How many Hebrew years ago `then` fell within WINDOW_DAYS of today's Hebrew date (by day-of-year), or 0.
export function yearsAgoSameHebrewDate(then, today = new Date()) {
  try {
    const a = hdate(then);
    const b = hdate(today);
    const years = b.getFullYear() - a.getFullYear();
    if (years < 1) return 0;
    // The same Hebrew date in the earlier year (a missing 30th or Adar II folds back), compared by days.
    const anniversary = new HDate(Math.min(b.getDate(), HDate.daysInMonth(foldMonth(b.getMonth(), a.getFullYear()), a.getFullYear())), foldMonth(b.getMonth(), a.getFullYear()), a.getFullYear());
    const diff = Math.abs(anniversary.abs() - a.abs());
    return diff <= WINDOW_DAYS ? years : 0;
  } catch { return 0; }
}
const foldMonth = (month, year) => (month === 13 && !HDate.isLeapYear(year) ? 12 : month);

const ago = years => (years === 1 ? 'לפני שנה' : years === 2 ? 'לפני שנתיים' : `לפני ${hebrewNumeral(years)} שנים`);

const JOURNAL_WORDS = { prayer: 'תפילה', tehillim: 'תהילים', torah_study: 'לימוד תורה', birkat_hamazon: 'ברכת המזון', omer_count: 'ספירת העומר', shnayim_mikra: 'שניים מקרא', brachot: 'ברכות' };

/**
 * cards: [{ kind: 'chidush-anniversary' | 'parasha' | 'journal' | 'journal-start', title, text, chidushId? }]
 * At most `limit` cards (default 3), the user's own words first.
 */
export function onThisDay({ chidushim = [], events = [], today = new Date(), il = true, limit = 3 } = {}) {
  const cards = [];
  const used = new Set();
  // 1. Written around this Hebrew date in an earlier year.
  for (const item of [...chidushim].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const years = yearsAgoSameHebrewDate(item.createdAt, today);
    if (!years) continue;
    used.add(item.id);
    cards.push({ kind: 'chidush-anniversary', title: `${ago(years)} כתבת`, text: item.title || firstLine(item.body), chidushId: item.id });
  }
  // 2. This week's parasha, in an earlier year.
  const parasha = parashaOfWeek(keyOf(new Date(toMs(today))), il);
  if (parasha) {
    const yearNow = hdate(today).getFullYear();
    const match = chidushim.find(item => !used.has(item.id) && hdate(item.createdAt).getFullYear() < yearNow && (item.parasha === parasha.he || parashaOfWeek(keyOf(new Date(toMs(item.createdAt))), il)?.id === parasha.id));
    if (match) { used.add(match.id); cards.push({ kind: 'parasha', title: `בפרשת ${parasha.he}, בשנה שעברה`, text: match.title || firstLine(match.body), chidushId: match.id }); }
  }
  // 3. The journal: the same Hebrew date in an earlier year (what was done, never how much).
  const sameDay = new Map();
  let first = null;
  for (const event of events) {
    if (!event?.occurredAt) continue;
    if (!first || event.occurredAt < first.occurredAt) first = event;
    const years = yearsAgoSameHebrewDate(event.occurredAt, today);
    if (years && Math.abs(hdate(event.occurredAt).getDate() - hdate(today).getDate()) === 0) {
      if (!sameDay.has(years)) sameDay.set(years, new Set());
      if (JOURNAL_WORDS[event.category]) sameDay.get(years).add(JOURNAL_WORDS[event.category]);
    }
  }
  for (const [years, kinds] of [...sameDay.entries()].sort((a, b) => a[0] - b[0])) {
    if (!kinds.size) continue;
    cards.push({ kind: 'journal', title: `${ago(years)}, ביום הזה`, text: [...kinds].join(' · ') });
    break;
  }
  if (first) {
    const years = yearsAgoSameHebrewDate(first.occurredAt, today);
    if (years && hdate(first.occurredAt).getDate() === hdate(today).getDate()) cards.push({ kind: 'journal-start', title: `${ago(years)} התחלת`, text: 'לרשום את המצוות שלך במעגל הרוחני' });
  }
  return cards.slice(0, limit);
}

const firstLine = text => String(text || '').split('\n').map(line => line.trim()).find(Boolean)?.slice(0, 120) || '';

// The optional reminder hook (off by default; nothing calls it unless a future setting turns it on): the one line a
// gentle reminder would carry, or null.
export function onThisDayReminderLine(input, { enabled = false } = {}) {
  if (!enabled) return null;
  const [card] = onThisDay({ ...input, limit: 1 });
  return card ? `${card.title}: ${card.text}` : null;
}
