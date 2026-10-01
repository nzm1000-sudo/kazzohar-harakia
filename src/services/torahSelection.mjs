// The week's three divrei torah. Pure selection plus a small per-week record on the device:
//   • The focus of the week comes from the app's calendar context (the parasha of the coming Shabbat, a festival during
//     the week, a special Shabbat) — exactly as the Shabbat table chose before (services/weeklyDivreiTorah.mjs): from
//     Sunday until Motzaei Shabbat the coming Shabbat; a festival today or before Shabbat (or on it) takes its place,
//     and keeps the parasha and the special Shabbat with it.
//   • Three picks: a short one, a deeper one and a story (or one for the family) when the collection has them, otherwise
//     three different ones. Deterministic for the week (seed: the scope, the Jewish year, the Shabbat's date): the same
//     three all week, another year may bring others. Unread ones first (the device's own read list only).
//   • "החלף דבר תורה" replaces one pick only; the change holds until the week ends, and a replaced one never returns
//     that week. Once chosen, the week's picks stay — reading one of them does not reshuffle the table.
import { HDate } from '@hebcal/core';
import { checksum } from './prayer/checksum.mjs';
import { articlesForHoliday, articlesForParasha, articlesForSpecialShabbat, currentTorahCatalog, torahRoute } from './torahContent.mjs';
import { SLOT_OF, holidayIdsFor, holidayLabel, parashotOfReading, specialShabbatIdFor, specialShabbatLabel } from './torahTaxonomy.mjs';

const weekday = key => new Date(`${key}T12:00:00Z`).getUTCDay();
const addDays = (key, days) => new Date(new Date(`${key}T12:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);
export const comingShabbatOf = todayKey => addDays(todayKey, (6 - weekday(todayKey) + 7) % 7);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export function jewishYearOf(dateKey) {
  if (!DATE.test(String(dateKey || ''))) return null;
  const [y, m, d] = dateKey.split('-').map(Number);
  try { return new HDate(new Date(y, m - 1, d)).getFullYear(); } catch { return null; }
}
const maqaf = parashot => parashot.join('־');

/** The week's focus from the calendar: { kind, id, name, parashot, holiday, specialShabbat, shabbatKey, weekKey, jewishYear, scopeKey, route }. */
export function torahWeekFocus({ items = [], todayKey = null, parashaName = null, catalog = currentTorahCatalog() } = {}) {
  const shabbatKey = DATE.test(String(todayKey || '')) ? comingShabbatOf(todayKey) : null;
  const parashot = parashotOfReading(parashaName);
  let holiday = null;
  let specialShabbat = null;
  if (shabbatKey) {
    const dated = (items || []).map(item => ({ item, dateKey: item?.date?.slice?.(0, 10) })).filter(entry => entry.dateKey);
    holiday = dated.filter(entry => entry.dateKey >= todayKey && entry.dateKey <= shabbatKey)
      .map(entry => ({ dateKey: entry.dateKey, id: holidayIdsFor(entry.item).find(id => catalog.byHoliday.has(id)) }))
      .filter(entry => entry.id)
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))[0] || null;
    specialShabbat = dated.filter(entry => entry.dateKey === shabbatKey).map(entry => specialShabbatIdFor(entry.item)).find(Boolean) || null;
  }
  const base = { parashot, holiday: holiday?.id || null, holidayDateKey: holiday?.dateKey || null, specialShabbat, shabbatKey, weekKey: shabbatKey || 'any', jewishYear: jewishYearOf(shabbatKey) };
  if (holiday) return { ...base, kind: 'holiday', id: holiday.id, name: holidayLabel(holiday.id), scopeKey: `holiday:${holiday.id}`, route: torahRoute.holiday(holiday.id) };
  if (parashot.length && articlesForParasha(catalog, parashot).length) return { ...base, kind: 'parasha', id: parashot[0], name: `פרשת ${maqaf(parashot)}`, scopeKey: `parasha:${parashot.join('+')}`, route: torahRoute.parasha(parashot[0]) };
  if (specialShabbat && articlesForSpecialShabbat(catalog, specialShabbat).length) return { ...base, kind: 'special', id: specialShabbat, name: specialShabbatLabel(specialShabbat), scopeKey: `special:${specialShabbat}`, route: torahRoute.special(specialShabbat) };
  return null;
}

/** The focus of one collection page (a parasha, a festival…), for "the three of the week" there too. */
export function collectionFocus(kind, id, { todayKey = null } = {}) {
  const shabbatKey = DATE.test(String(todayKey || '')) ? comingShabbatOf(todayKey) : null;
  const base = { parashot: kind === 'parasha' ? parashotOfReading(id) : [], holiday: kind === 'holiday' ? id : null, specialShabbat: kind === 'special' ? id : null, shabbatKey, weekKey: shabbatKey || 'any', jewishYear: jewishYearOf(shabbatKey) };
  return { ...base, kind, id, scopeKey: `${kind}:${kind === 'parasha' ? base.parashot.join('+') : id}` };
}

// The pool of a focus, and the order the week draws from it.
export function poolOf(catalog, focus) {
  if (!focus) return { main: [], special: [] };
  const special = focus.specialShabbat ? articlesForSpecialShabbat(catalog, focus.specialShabbat) : [];
  if (focus.kind === 'holiday') return { main: articlesForHoliday(catalog, focus.holiday || focus.id), special: [] };
  if (focus.kind === 'special') return { main: special, special: [] };
  return { main: articlesForParasha(catalog, focus.parashot?.length ? focus.parashot : [focus.id]), special };
}
const seedOf = focus => `${focus.scopeKey}|${focus.jewishYear ?? ''}|${focus.weekKey}`;
export function rankPool(pool, seed, readSet = new Set()) {
  return pool.map(item => ({ item, read: readSet.has(item.id) ? 1 : 0, key: checksum(`${seed}|${item.id}`) }))
    .sort((a, b) => a.read - b.read || a.key.localeCompare(b.key))
    .map(entry => entry.item);
}
const SLOTS = ['short', 'deep', 'story'];

/**
 * The week's three for a focus: [{ ...article, slot }]. Pure — the same input, the same three.
 * selectWeeklyTorah({ parasha, holiday, specialShabbat, weekKey, jewishYear, readHistory, catalog, exclude })
 */
export function selectWeeklyTorah({ parasha = null, holiday = null, specialShabbat = null, weekKey = 'any', jewishYear = null, readHistory = [], catalog = currentTorahCatalog(), exclude = [], focus = null } = {}) {
  const f = focus || (holiday
    ? { kind: 'holiday', id: holiday, holiday, parashot: parashotOfReading(parasha), specialShabbat, weekKey, jewishYear, scopeKey: `holiday:${holiday}` }
    : parasha ? { kind: 'parasha', id: parasha, parashot: Array.isArray(parasha) ? parasha.flatMap(parashotOfReading) : parashotOfReading(parasha), specialShabbat, weekKey, jewishYear }
      : specialShabbat ? { kind: 'special', id: specialShabbat, specialShabbat, parashot: [], weekKey, jewishYear, scopeKey: `special:${specialShabbat}` } : null);
  if (!f) return [];
  if (!f.scopeKey) f.scopeKey = `parasha:${f.parashot.join('+')}`;
  const readSet = new Set(readHistory);
  const excluded = new Set(exclude);
  const { main, special } = poolOf(catalog, f);
  const ranked = rankPool(main, seedOf(f), readSet).filter(item => !excluded.has(item.id));
  const chosen = [];
  const take = (item, slot) => { if (item && !chosen.some(pick => pick.id === item.id)) chosen.push({ ...item, slot }); };
  // A special Shabbat keeps its parasha: one of the three is the special Shabbat's own, when there is one.
  if (special.length && main.length) take(rankPool(special, seedOf(f), readSet).find(item => !excluded.has(item.id)), 'special');
  // The scarcest place first (a story), then a deeper one, then a short one; a story marked for the Shabbat table
  // (shabbatTable: a short story or mashal) before any other story.
  for (const slot of ['story', 'deep', 'short']) {
    if (chosen.length >= 3) break;
    const fits = item => SLOT_OF(item) === slot && !chosen.some(pick => pick.id === item.id);
    const first = ranked.find(fits);
    // (Never at the price of something already read: the preference holds among equally read ones.)
    take((slot === 'story' && first && ranked.find(item => fits(item) && item.shabbatTable && readSet.has(item.id) === readSet.has(first.id))) || first, slot);
  }
  for (const item of ranked) { if (chosen.length >= 3) break; take(item, SLOT_OF(item)); }
  const order = ['special', ...SLOTS];
  return chosen.sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot));
}

// ---- the week's record on the device ----
const KEY = 'kz-torah-week-v1';
const storage = () => { try { return globalThis.localStorage || null; } catch { return null; } };
function readWeek(store, weekKey) {
  try { const value = JSON.parse(store?.getItem(KEY) || 'null'); return value?.weekKey === weekKey && value.scopes && typeof value.scopes === 'object' ? value : { weekKey, scopes: {} }; } catch { return { weekKey, scopes: {} }; }
}
function writeWeek(store, record) { try { store?.setItem(KEY, JSON.stringify(record)); } catch { /* storage full or private mode */ } }

/**
 * The week's three for a focus, as the device keeps them: { focus, picks, total, replaced, more }.
 * `persist` writes the first choice of the week (never during a render: the caller does it from an effect).
 */
export function weeklyTorah(focus, { catalog = currentTorahCatalog(), store = storage(), readHistory = [], persist = false } = {}) {
  if (!focus) return null;
  const { main, special } = poolOf(catalog, focus);
  const total = new Set([...main, ...special].map(item => item.id)).size;
  const record = readWeek(store, focus.weekKey);
  const saved = record.scopes[focus.scopeKey];
  const replaced = saved?.replaced || [];
  const savedPicks = (saved?.picks || []).map(id => catalog.byId.get(id)).filter(Boolean);
  let picks;
  if (saved && savedPicks.length === saved.picks.length && savedPicks.length === Math.min(3, total)) picks = savedPicks.map(item => ({ ...item, slot: saved.slots?.[item.id] || SLOT_OF(item) }));
  else {
    picks = selectWeeklyTorah({ focus, catalog, readHistory, exclude: replaced });
    if (picks.length < Math.min(3, total)) picks = selectWeeklyTorah({ focus, catalog, readHistory });
    // Only a full catalog is worth keeping for the week (the first render may still be on the fallback).
    if (persist && catalog.loaded && picks.length) writeWeek(store, { ...record, scopes: { ...record.scopes, [focus.scopeKey]: { picks: picks.map(item => item.id), slots: Object.fromEntries(picks.map(item => [item.id, item.slot])), replaced } } });
  }
  const shown = new Set([...picks.map(item => item.id), ...replaced]);
  return { focus, picks, total, replaced, more: Math.max(0, total - picks.length), canReplace: [...main, ...special].some(item => !shown.has(item.id)) };
}

/** "החלף דבר תורה": one pick changes, for the rest of the week; the replaced one does not come back this week. */
export function replaceWeeklyPick(focus, position, { catalog = currentTorahCatalog(), store = storage(), readHistory = [] } = {}) {
  const current = weeklyTorah(focus, { catalog, store, readHistory, persist: true });
  const old = current?.picks[position];
  if (!old) return current;
  const replaced = [...new Set([...current.replaced, old.id])];
  const taken = new Set([...current.picks.map(item => item.id), ...replaced]);
  const { main, special } = poolOf(catalog, focus);
  const ranked = rankPool(old.slot === 'special' ? special : main, `${seedOf(focus)}|r${replaced.length}`, new Set(readHistory)).filter(item => !taken.has(item.id));
  const next = ranked.find(item => SLOT_OF(item) === old.slot) || ranked[0] || rankPool([...main, ...special], seedOf(focus), new Set(readHistory)).find(item => !taken.has(item.id));
  if (!next) return { ...current, exhausted: true };
  const picks = current.picks.map((item, index) => (index === position ? { ...next, slot: old.slot === 'special' ? 'special' : SLOT_OF(next) } : item));
  const record = readWeek(store, focus.weekKey);
  writeWeek(store, { ...record, scopes: { ...record.scopes, [focus.scopeKey]: { picks: picks.map(item => item.id), slots: Object.fromEntries(picks.map(item => [item.id, item.slot])), replaced } } });
  return weeklyTorah(focus, { catalog, store, readHistory });
}
