// Search-gap signals, counted on the device only — nothing is uploaded, and no question text is ever stored.
// What is kept: daily counts of searches with no answer / only weak answers / only sources, quick reformulations,
// flows that ended in "ask a rabbi" (by flow and branch id), and which categories weak results fell into.
// Sensitive searches add one to a single "sensitive" counter and nothing else. See docs/privacy/halacha-gaps.md.
const KEY = 'kz-halacha-gaps-v1';
const KEEP_DAYS = 60;
const store = () => { try { return globalThis.localStorage || null; } catch { return null; } };
const read = storage => { try { const value = JSON.parse(storage?.getItem(KEY) || '{}'); return value && typeof value === 'object' ? value : {}; } catch { return {}; } };
const dayOf = now => new Date(now).toISOString().slice(0, 10);

function bump(storage, now, path) {
  const all = read(storage);
  const day = dayOf(now);
  const bucket = all[day] || {};
  let node = bucket;
  for (const part of path.slice(0, -1)) node = node[part] ||= {};
  const last = path[path.length - 1];
  node[last] = (node[last] || 0) + 1;
  all[day] = bucket;
  const cutoff = dayOf(now - KEEP_DAYS * 86400000);
  for (const key of Object.keys(all)) if (key < cutoff) delete all[key];
  try { storage?.setItem(KEY, JSON.stringify(all)); } catch { /* ignore */ }
  return all;
}

let lastSearch = null;
// Called with the router's result for a finished search. Only the outcome class and category ids are counted.
export function recordSearchOutcome(route, { storage = store(), now = Date.now() } = {}) {
  if (!route || route.intent === 'empty') return null;
  if (route.intent === 'personal-case') return bump(storage, now, ['sensitive']);
  const reformulated = lastSearch && now - lastSearch.at < 45000 && lastSearch.weak;
  const weak = route.intent === 'no-match' || route.intent === 'source-search' || (route.intent === 'practical-question' && !route.answer);
  lastSearch = { at: now, weak };
  if (reformulated) bump(storage, now, ['reformulated']);
  if (route.intent === 'no-match') return bump(storage, now, ['noMatch']);
  if (route.intent === 'source-search') return bump(storage, now, ['sourcesOnly']);
  if (weak) { const category = route.results?.questions?.[0]?.category || 'unknown'; bump(storage, now, ['weakByCategory', category]); return bump(storage, now, ['weak']); }
  return bump(storage, now, ['answered']);
}
export const recordRabbiRoute = (flowId, outcomeKey, { storage = store(), now = Date.now() } = {}) => bump(storage, now, ['rabbiRoutes', `${flowId}/${outcomeKey}`]);
export const readGapStats = (storage = store()) => read(storage);
