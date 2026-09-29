// השעון היהודי — occurrences: the future absolute times of a rule, from the engine, with the recurrence and the
// Shabbat policy applied. Pure: `now` is always passed in. Cached per rule + context + day so a render never recomputes
// a year, and so the main screen opens instantly.
import { shiftCivilDate } from '../../civilDate.mjs';
import { alarmContext, contextSignature, civilKeyOf, resolveJewishAlarm, restWindowAt, weekdayOf } from './engine.mjs';
import { isEventRule, ringsOnWeekday } from './model.mjs';
import { anchorOf } from './anchors.mjs';

const resolutionCache = new Map();
const ruleSignature = rule => [rule.mode, rule.fixedTime, rule.jewishAnchorId, rule.offsetMinutes].join('|');
function resolveCached(rule, dateKey, ctx) {
  const key = `${contextSignature(ctx)}|${ruleSignature(rule)}|${dateKey}`;
  if (resolutionCache.has(key)) return resolutionCache.get(key);
  const value = resolveJewishAlarm(rule, dateKey, ctx);
  if (resolutionCache.size > 6000) resolutionCache.clear();
  resolutionCache.set(key, value);
  return value;
}
const asContext = context => (context?.valid === undefined ? alarmContext(context) : context);

// One day of a rule, with why it is silent when it is (for the 7-day preview): status 'ring' | 'rest' | 'off-day' | 'none'.
export function dayOfRule(rule, dateKey, context) {
  const ctx = asContext(context);
  const resolved = resolveCached(rule, dateKey, ctx);
  if (resolved.error) return { ...resolved, status: resolved.error === 'unavailable' ? 'none' : 'error' };
  if (!ringsOnWeekday(rule, weekdayOf(dateKey))) return { ...resolved, status: 'off-day' };
  if (!rule.ringOnRest && restWindowAt(resolved.alarmTime, ctx)) return { ...resolved, status: 'rest' };
  return { ...resolved, status: 'ring' };
}

/**
 * The next occurrences of a rule after `now`: [{ key, ruleId, date, at, anchorTime, ... }]. `days` is how far to look
 * (civil dates of the anchor), `limit` how many to return. A disabled rule has none.
 */
export function occurrencesFor(rule, context, { now = new Date(), days = 14, limit = 64 } = {}) {
  const ctx = asContext(context);
  if (!rule?.enabled || !ctx.valid || !rule.mode) return [];
  const from = new Date(now).getTime();
  const out = [];
  // Start one day back: an anchor dated tomorrow may ring tonight, and one dated yesterday may ring after midnight.
  const first = shiftCivilDate(civilKeyOf(from, ctx.tz), -1);
  for (let shift = 0; shift <= days + 1 && out.length < limit; shift += 1) {
    const dateKey = shiftCivilDate(first, shift);
    const day = dayOfRule(rule, dateKey, ctx);
    if (day.status !== 'ring' || day.alarmTime.getTime() <= from) continue;
    out.push({ key: `${rule.id}:${dateKey}`, ruleId: rule.id, date: dateKey, at: day.alarmTime, anchorTime: day.anchorTime || null, anchorLabel: day.anchorLabel || null, detail: day.detail || null });
  }
  return out.sort((a, b) => a.at - b.at);
}

// Event anchors (Chanukah, the Omer, fasts…) may be months away: look up to a year and a quarter ahead for the next one.
export function nextOccurrence(rule, context, now = new Date()) {
  const ctx = asContext(context);
  const horizon = isEventRule(rule) ? 460 : 10;
  return occurrencesFor(rule, ctx, { now, days: horizon, limit: 1 })[0] || null;
}

// The next alarm of all rules (fixed and Jewish together) — the main screen and the Today card.
export function getNextAlarm(rules, context, now = new Date()) {
  const ctx = asContext(context);
  let best = null;
  for (const rule of rules || []) {
    if (!rule?.enabled) continue;
    const next = nextOccurrence(rule, ctx, now);
    if (next && (!best || next.at < best.occurrence.at)) best = { rule, occurrence: next };
  }
  return best;
}

// The coming days of a rule for the preview row: each day's anchor and alarm, or why it is silent.
export function previewDays(rule, context, now = new Date(), count = 7) {
  const ctx = asContext(context);
  if (!ctx.valid || !rule?.mode) return [];
  const today = civilKeyOf(new Date(now).getTime(), ctx.tz);
  const out = [];
  if (isEventRule(rule)) {
    // Event anchors: the next `count` occurrences, whenever they are.
    let from = new Date(now);
    for (let index = 0; index < count; index += 1) {
      const next = occurrencesFor({ ...rule, enabled: true }, ctx, { now: from, days: 460, limit: 1 })[0];
      if (!next) break;
      out.push({ date: next.date, status: 'ring', alarmTime: next.at, anchorTime: next.anchorTime, detail: next.detail });
      from = new Date(next.at.getTime() + 1000);
    }
    return out;
  }
  for (let shift = 0; shift < count; shift += 1) {
    const dateKey = shiftCivilDate(today, shift);
    const day = dayOfRule(rule, dateKey, ctx);
    out.push({ date: dateKey, status: day.status, alarmTime: day.alarmTime || null, anchorTime: day.anchorTime || null, detail: day.detail || null });
  }
  return out;
}

// The anchor's time on the day the rule next rings (or tomorrow, for a draft) — the editor's live preview.
export function livePreview(rule, context, now = new Date()) {
  const ctx = asContext(context);
  if (!ctx.valid) return { error: 'no-location' };
  if (!rule?.mode || (rule.mode === 'jewish' && !rule.jewishAnchorId)) return null;
  const draft = { ...rule, enabled: true, offsetMinutes: rule.mode === 'jewish' ? (rule.offsetMinutes ?? 0) : rule.offsetMinutes };
  const next = nextOccurrence(draft, ctx, now);
  if (!next) return { error: 'unavailable', anchor: anchorOf(rule.jewishAnchorId) };
  return { occurrence: next, anchor: rule.mode === 'jewish' ? anchorOf(rule.jewishAnchorId) : null };
}

export function clearOccurrenceCache() { resolutionCache.clear(); }
