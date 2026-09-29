// "המעגל הרוחני" — the weekly circle of lights and what the user has built over time. Pure: journal events in, the
// week's fill and the lasting achievements out (the achievements' high-water record lives in localStorage and never
// goes down, so nothing earned is ever lost, whatever happens to the week).
//
// Lights (אורות): every real action of the journal gives light — a prayer, Birkat HaMazon, counting the Omer, Shnayim
// Mikra one each; a blessing (ברכות הנהנין, מעין שלוש, בורא נפשות…) one each; Tehillim one per two chapters, study one
// per ten minutes or per unit marked "סיימתי"; blessings, Tehillim and study each with a daily ceiling so that the
// week is filled by constancy, not by one long evening.
// The week: from Motzaei Shabbat (the Jewish day already turned to Sunday) to Shabbat. The circle fills at 72 lights
// — about a week of full, steady days (three prayers, Birkat HaMazon, a few chapters, a little learning) — and starts
// again every Motzaei Shabbat. Shabbat itself is never counted against the user (the app is not used on Shabbat).

export const WEEK_GOAL = 72; // ע״ב — the number of חסד
const DAY_CAP = { tehillim: 5, torah_study: 6, brachot: 3 };
export const ACHIEVEMENTS_KEY = 'kz-spiritual-achievements-v1';

// The light of one event (before the daily ceilings).
export function lightsOf(event) {
  const quantity = Math.max(0, Number(event?.quantity) || 0);
  switch (event?.category) {
    case 'prayer': case 'birkat_hamazon': case 'omer_count': case 'shnayim_mikra': case 'brachot': return 1;
    case 'tehillim': return Math.max(1, Math.ceil(quantity / 2));
    case 'torah_study': return event.unit === 'count' ? 1 : Math.max(1, Math.floor(quantity / 10));
    case 'other': return 1;
    default: return 0;
  }
}

// The lights of each day, with the daily ceilings applied per category.
export function lightsByDay(events) {
  const days = new Map();
  for (const event of events || []) {
    const key = event?.jewishDate;
    if (typeof key !== 'string') continue;
    const light = lightsOf(event);
    if (!light) continue;
    const day = days.get(key) || {};
    day[event.category] = (day[event.category] || 0) + light;
    days.set(key, day);
  }
  const out = new Map();
  for (const [key, day] of days) out.set(key, Object.entries(day).reduce((sum, [category, value]) => sum + Math.min(value, DAY_CAP[category] ?? Infinity), 0));
  return out;
}

const noon = key => new Date(`${key}T12:00:00Z`);
const keyOf = date => date.toISOString().slice(0, 10);
const addDays = (key, n) => keyOf(new Date(noon(key).getTime() + n * 86400000));
// The Sunday that opens the Jewish week of a day (Motzaei Shabbat already belongs to Sunday's key).
export const weekStartOf = key => addDays(key, -noon(key).getUTCDay());

export function weekLights(byDay, weekStart) {
  let sum = 0;
  for (let i = 0; i < 7; i += 1) sum += byDay.get(addDays(weekStart, i)) || 0;
  return sum;
}

// Levels of the lights gathered over time — "והמשכילים יזהירו כזוהר הרקיע ומצדיקי הרבים ככוכבים".
export const LEVELS = Object.freeze([
  { min: 0, name: 'ניצוץ' },
  { min: 72, name: 'נר' },
  { min: 300, name: 'אבוקה' },
  { min: 750, name: 'אור' },
  { min: 1500, name: 'זוהר' },
  { min: 3000, name: 'רקיע' },
  { min: 6000, name: 'כוכבים' },
]);
export function levelFor(total) {
  const index = LEVELS.reduce((found, level, i) => (total >= level.min ? i : found), 0);
  const next = LEVELS[index + 1] || null;
  return { index, name: LEVELS[index].name, min: LEVELS[index].min, next: next ? { name: next.name, min: next.min, remaining: next.min - total } : null, progress: next ? (total - LEVELS[index].min) / (next.min - LEVELS[index].min) : 1 };
}

// Milestones: kept once earned (the high-water record), each with the day it was first reached.
export const MILESTONES = Object.freeze([
  { id: 'first-light', title: 'האור הראשון', test: s => s.total >= 1 },
  { id: 'chai-prayers', title: 'ח״י תפילות', test: s => s.prayers >= 18 },
  { id: 'hundred-prayers', title: 'מאה תפילות', test: s => s.prayers >= 100 },
  { id: 'all-tehillim', title: 'ספר תהילים שלם — 150 פרקים', test: s => s.tehillim >= 150 },
  { id: 'ten-hours', title: 'עשר שעות לימוד', test: s => s.studyMinutes >= 600 },
  { id: 'first-week', title: 'שבוע שלם — המעגל התמלא', test: s => s.fullWeeks >= 1 },
  { id: 'four-weeks', title: 'חודש של שבועות מלאים', test: s => s.fullWeeks >= 4 },
  { id: 'chai-weeks', title: 'ח״י שבועות מלאים', test: s => s.fullWeeks >= 18 },
  { id: 'taryag', title: 'תרי״ג אורות', test: s => s.total >= 613 },
  { id: 'thousand', title: 'אלף אורות', test: s => s.total >= 1000 },
]);

// Everything the circle shows, from the journal alone.
export function computeCircle(events, todayKey) {
  const byDay = lightsByDay(events);
  const thisWeek = weekStartOf(todayKey);
  const week = weekLights(byDay, thisWeek);
  // Past weeks, from the first recorded day to last week.
  const days = [...byDay.keys()].sort();
  const weeks = new Map();
  for (const key of days) { const start = weekStartOf(key); weeks.set(start, (weeks.get(start) || 0) + byDay.get(key)); }
  const past = [...weeks].filter(([start]) => start < thisWeek).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const fullWeeks = [...weeks.values()].filter(value => value >= WEEK_GOAL).length;
  // The streak of full weeks: this week counts once it is full; otherwise the streak is the run up to last week.
  let streak = week >= WEEK_GOAL ? 1 : 0;
  for (let start = addDays(thisWeek, -7); ; start = addDays(start, -7)) {
    if ((weeks.get(start) || 0) >= WEEK_GOAL) streak += 1; else break;
  }
  const total = [...byDay.values()].reduce((sum, value) => sum + value, 0);
  const count = category => (events || []).filter(event => event?.category === category);
  const stats = {
    total,
    prayers: count('prayer').length,
    tehillim: count('tehillim').reduce((sum, event) => sum + (Number(event.quantity) || 0), 0),
    studyMinutes: count('torah_study').filter(event => event.unit !== 'count').reduce((sum, event) => sum + (Number(event.quantity) || 0), 0),
    fullWeeks,
  };
  return {
    week, goal: WEEK_GOAL, progress: Math.min(1, week / WEEK_GOAL), weekStart: thisWeek,
    today: byDay.get(todayKey) || 0,
    bestWeek: Math.max(week, ...past.map(([, value]) => value), 0),
    fullWeeks, streak, total, stats,
    level: levelFor(total),
    milestones: MILESTONES.map(item => ({ id: item.id, title: item.title, earned: item.test(stats) })),
  };
}

// The lasting record: the highest of everything ever reached, and each milestone with the day it was first earned.
// Merged, never lowered — so an undo, a cleared week or a new device's partial journal never takes an achievement away.
export function mergeAchievements(record, circle, todayKey) {
  const base = record && typeof record === 'object' ? record : {};
  const earned = { ...(base.earned || {}) };
  for (const item of circle.milestones) if (item.earned && !earned[item.id]) earned[item.id] = todayKey;
  return {
    total: Math.max(base.total || 0, circle.total),
    bestWeek: Math.max(base.bestWeek || 0, circle.bestWeek),
    fullWeeks: Math.max(base.fullWeeks || 0, circle.fullWeeks),
    longestStreak: Math.max(base.longestStreak || 0, circle.streak),
    earned,
  };
}

export function readAchievements(storage = globalThis.localStorage) {
  try { return JSON.parse(storage?.getItem(ACHIEVEMENTS_KEY) || 'null') || null; } catch { return null; }
}
export function saveAchievements(record, storage = globalThis.localStorage) {
  try { storage?.setItem(ACHIEVEMENTS_KEY, JSON.stringify(record)); } catch { /* storage full: the journal still holds it */ }
}
