// "המעגל הרוחני" — the circle of lights, and the circles completed over a lifetime ("מעגלי עולם"). Pure: journal events
// in, everything the circle shows out. The journal ("המצוות שלי") is the ONE source of truth; nothing here is counted
// separately, so a double tap, a reload or a replayed animation can never add a circle twice.
//
// Lights (אורות) — every real action gives light, with no daily ceiling, so a full circle can be reached in one day:
//   a prayer, Birkat HaMazon, counting the Omer, Shnayim Mikra, a blessing (ברכות הנהנין, מעין שלוש, בורא נפשות…) and
//   any other recorded mitzvah — one each; Tehillim — one per chapter; study — a "סיימתי" on a unit is one, and timed
//   study of at least one active minute is one, then one per five active minutes (1–9 minutes: 1, 10: 2, 15: 3…).
//   Study time is ACTIVE time only (services/studySession.mjs pauses after three idle minutes and when the app leaves
//   the screen); older entries keep their recorded minutes and are scored by the same rule.
// The circle: 72 lights (ע״ב) complete one circle, and the lights beyond it begin the next one at once — several
// circles may be completed in a day. The week runs from Motzaei Shabbat (the Jewish day already turned to Sunday) to
// Shabbat; the unfinished circle of a week vanishes at Motzaei Shabbat, the completed ones stay forever.
// Completed circles are DERIVED: each week adds floor(weekLights / 72); the lifetime count is their sum over the whole
// journal, kept by a high-water record (never lowered — a removed entry or a trimmed journal takes nothing away).

export const WEEK_GOAL = 72; // ע״ב — the number of חסד
export const ACHIEVEMENTS_KEY = 'kz-spiritual-achievements-v1';
// Lifetime circles: { best } the highest lifetime count ever derived, { seen } the count the completion animation last
// showed, { announced } the last rank whose opening was presented. Versioned; written only from derived counts.
export const CIRCLES_KEY = 'kz-olam-circles-v1';

// The light of one event.
export function lightsOf(event) {
  const quantity = Math.max(0, Number(event?.quantity) || 0);
  switch (event?.category) {
    case 'prayer': case 'birkat_hamazon': case 'omer_count': case 'shnayim_mikra': case 'brachot': case 'other': return 1;
    case 'tehillim': return Math.max(1, Math.floor(quantity));
    case 'torah_study': return event.unit === 'count' ? 1 : studyLights(quantity);
    default: return 0;
  }
}
// Timed study: nothing under one active minute; then one, and one more for every five minutes from ten.
export const studyLights = minutes => (Number(minutes) >= 1 ? Math.max(1, Math.floor(Number(minutes) / 5)) : 0);

// The lights of each day (no ceilings).
export function lightsByDay(events) {
  const out = new Map();
  for (const event of events || []) {
    const key = event?.jewishDate;
    if (typeof key !== 'string') continue;
    const light = lightsOf(event);
    if (light) out.set(key, (out.get(key) || 0) + light);
  }
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

// A week's lights → its completed circles and the circle still open.
export const circlesOfWeek = lights => Math.floor(Math.max(0, lights) / WEEK_GOAL);
export const activeOfWeek = lights => Math.max(0, lights) % WEEK_GOAL;

// "מעגלי עולם" — fifteen ranks of completed circles. Symbolic names in ascending order; not a teaching of any system.
export const RANKS = Object.freeze([
  { at: 5, name: 'מלכות' },
  { at: 10, name: 'יסוד' },
  { at: 20, name: 'הוד' },
  { at: 50, name: 'נצח' },
  { at: 100, name: 'תפארת' },
  { at: 150, name: 'גבורה' },
  { at: 250, name: 'חסד' },
  { at: 300, name: 'בינה' },
  { at: 400, name: 'חכמה' },
  { at: 500, name: 'כתר' },
  { at: 600, name: 'לוחות הברית' },
  { at: 750, name: 'אור הגנוז' },
  { at: 850, name: 'עץ החיים' },
  { at: 900, name: 'אור השכינה' },
  { at: 1000, name: 'אור אין סוף' },
].map(Object.freeze));

// Where a lifetime count stands: index -1 before the first rank; `progress` is the way from this rank to the next (0–1).
export function rankFor(count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  let index = -1;
  RANKS.forEach((rank, i) => { if (n >= rank.at) index = i; });
  const current = index >= 0 ? RANKS[index] : null;
  const nextRank = RANKS[index + 1] || null;
  const from = current ? current.at : 0;
  return {
    count: n, index, name: current?.name || null, at: current?.at ?? 0,
    next: nextRank ? { name: nextRank.name, at: nextRank.at, remaining: nextRank.at - n } : null,
    progress: nextRank ? (n - from) / (nextRank.at - from) : 1,
  };
}

// Words (Arabic numerals throughout): "325 מעגלים", "עוד 75 לחכמה", "עוד 75 מעגלים לחכמה".
export const circlesWord = n => (n === 1 ? 'מעגל אחד' : `${n} מעגלים`);
export function remainingShort(rank) { return rank.next ? `עוד ${rank.next.remaining} ל${rank.next.name}` : ''; }
export function remainingLong(rank) { return rank.next ? `עוד ${circlesWord(rank.next.remaining)} ל${rank.next.name}` : ''; }
// "אורות עגולים" and "מעגלי עולם" (never Today, whose line keeps the words above): no "0" and no "עוד" — at zero the
// label alone, "מעגלים"; the way ahead as "5 מעגלים למלכות", "75 מעגלים לחכמה".
export const circlesLabel = n => (n > 0 ? circlesWord(n) : 'מעגלים');
export const circlesTo = (remaining, name) => `${circlesWord(remaining)} ל${name}`;
export function remainingTo(rank) { return rank.next ? circlesTo(rank.next.remaining, rank.next.name) : ''; }
// One sentence for assistive technology.
// `zeroless`: nothing is said of a count still at zero (אורות עגולים); Today keeps the full sentence.
export function olamSpoken(rank, title = 'אורות עגולים', { zeroless = false } = {}) {
  const parts = [title];
  if (!zeroless || rank.count > 0) parts.push(`הושלמו ${circlesWord(rank.count)}`);
  if (rank.name) parts.push(`דרגת ${rank.name}`);
  if (rank.next) parts.push(`נותרו ${circlesWord(rank.next.remaining)} לדרגת ${rank.next.name}`);
  return `${parts.join('. ')}.`;
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
  const weeks = new Map();
  for (const [key, value] of byDay) { const start = weekStartOf(key); weeks.set(start, (weeks.get(start) || 0) + value); }
  // Past weeks only: a week later than today (a clock set back) never counts as done.
  const counted = [...weeks].filter(([start]) => start <= thisWeek);
  const lifetime = counted.reduce((sum, [, value]) => sum + circlesOfWeek(value), 0);
  const fullWeeks = counted.filter(([, value]) => value >= WEEK_GOAL).length;
  // The streak of full weeks: this week counts once it is full; otherwise the streak is the run up to last week.
  let streak = week >= WEEK_GOAL ? 1 : 0;
  for (let start = addDays(thisWeek, -7); ; start = addDays(start, -7)) {
    if ((weeks.get(start) || 0) >= WEEK_GOAL) streak += 1; else break;
  }
  const total = counted.reduce((sum, [, value]) => sum + value, 0);
  const count = category => (events || []).filter(event => event?.category === category);
  const stats = {
    total,
    prayers: count('prayer').length,
    tehillim: count('tehillim').reduce((sum, event) => sum + (Number(event.quantity) || 0), 0),
    studyMinutes: count('torah_study').filter(event => event.unit !== 'count').reduce((sum, event) => sum + (Number(event.quantity) || 0), 0),
    fullWeeks,
  };
  const active = activeOfWeek(week);
  return {
    week, goal: WEEK_GOAL, weekStart: thisWeek,
    // The open circle: what the ring shows (0 / 72 again the moment a circle completes).
    active, progress: active / WEEK_GOAL, remaining: WEEK_GOAL - active,
    completedThisWeek: circlesOfWeek(week),
    lifetime,
    today: byDay.get(todayKey) || 0,
    bestWeek: Math.max(0, ...counted.map(([, value]) => value)),
    fullWeeks, streak, total, stats,
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

// ── Lifetime circles: derived count + high-water ─────────────────────────────────────────────────────────────────
const whole = value => (Number.isFinite(Number(value)) && Number(value) > 0 ? Math.floor(Number(value)) : 0);
export function readCircles(storage = globalThis.localStorage) {
  try {
    const raw = JSON.parse(storage?.getItem(CIRCLES_KEY) || 'null');
    return raw && typeof raw === 'object' ? { best: whole(raw.best), seen: whole(raw.seen), announced: Number.isInteger(raw.announced) ? raw.announced : -1 } : null;
  } catch { return null; }
}
export function saveCircles(record, storage = globalThis.localStorage) {
  try { storage?.setItem(CIRCLES_KEY, JSON.stringify(record)); } catch { /* the journal still derives it */ }
}
// The lifetime shown is max(derived, best). A first run (no record — an existing user updating) starts with everything
// already "seen" and "announced": the retroactive circles appear at once, with no animation for the past.
export function mergeCircles(record, derived) {
  const lifetime = Math.max(whole(derived), record ? record.best : 0);
  if (!record) return { best: lifetime, seen: lifetime, announced: rankFor(lifetime).index };
  return { best: lifetime, seen: Math.min(record.seen, lifetime), announced: Math.min(record.announced, rankFor(lifetime).index) };
}
// Reads, merges and (when anything changed) writes the record. Returns the merged record.
export function syncCircles(derived, storage = globalThis.localStorage) {
  const before = readCircles(storage);
  const next = mergeCircles(before, derived);
  if (!before || before.best !== next.best || before.seen !== next.seen || before.announced !== next.announced) saveCircles(next, storage);
  return next;
}
// The completion animation plays once: it marks the new count as seen BEFORE it plays (a reload mid-animation shows the
// final state, never the animation again, and never a second circle).
export function markSeen(count, storage = globalThis.localStorage) {
  const record = readCircles(storage) || mergeCircles(null, count);
  if (record.seen >= count) return record;
  const next = { ...record, best: Math.max(record.best, count), seen: count };
  saveCircles(next, storage);
  return next;
}
export function markAnnounced(index, storage = globalThis.localStorage) {
  const record = readCircles(storage);
  if (!record || record.announced >= index) return record;
  const next = { ...record, announced: index };
  saveCircles(next, storage);
  return next;
}

// ── The acknowledgement of a "סיימתי" ──────────────────────────────────────────────────────────────────────────────
// What one completion added, from the circle before and after it (both derived from the journal): null when nothing was
// added (already recorded), otherwise the words shown quietly beside the button and spoken once.
export function lightAck(before, after) {
  if (!before || !after) return null;
  const gained = after.week - before.week;
  if (!(gained > 0)) return null;
  const completed = after.completedThisWeek > before.completedThisWeek;
  const lights = gained === 1 ? 'אור' : 'אורות';
  return {
    gained, completed, active: after.active,
    text: completed ? 'המעגל הושלם — מעגל חדש מתחיל' : `${lights} למעגל · ${after.active} מתוך ${WEEK_GOAL}`,
    spoken: completed ? 'המעגל הושלם. מעגל חדש מתחיל.' : `נוסף ${gained === 1 ? 'אור אחד' : `${gained} אורות`} למעגל. ${after.active} מתוך ${WEEK_GOAL}.`,
  };
}
