// The Torah content engine: the divrei torah of the authorized "בני ציון" archive (docs/bnei-zion/SCHEMA.md), found by
// parasha, festival, special Shabbat, topic, kind and reading time — and, wherever the archive has nothing (or is not in
// the build at all), the app's own three divrei torah per parasha and festival (data/divreiTorah.mjs), so no screen is
// ever empty.
//
//   • The archive's compact index is loaded once, lazily (its own chunk), never at launch.
//   • Article bodies live in packs (public/torah-content/packs/<pack>.json.gz), loaded on demand, verified against their
//     checksum (FNV-1a of the JSON text, as the library packs), kept in memory, readable offline (bundled with the app).
//   • Until the index has loaded — and forever, if the build has no archive — the catalog is the app's own divrei torah,
//     synchronously, so a first render (and a server-rendered test) always has three to show.
import { HOLIDAY_DIVREI_TORAH, PARASHA_DIVREI_TORAH } from '../data/divreiTorah.mjs';
import { checksum } from './prayer/checksum.mjs';
import { packBytesToText } from './library/packs.mjs';
import { HOLIDAYS, PARASHOT, SLOT_LABELS, SLOT_OF, SPECIAL_SHABBATOT, canonicalParasha, contentTypeLabel, holidayLabel, minutesLabel, parashaIndex, specialShabbatLabel } from './torahTaxonomy.mjs';

export const BNEI_ZION = Object.freeze({ collection: 'בני ציון', author: 'משה מזרחי', permission: 'מובא באישור בעל הזכויות' });

// ---- where the data comes from (replaceable in tests) ----
let source = null;
let defaultSource = null;
/** Tests (and the dev fixture) hand the engine their own loaders: { loadIndex, loadPack(name, entry), loadSearch }. */
export function configureTorahContent(next) { source = next; resetTorahContent(); }
export function resetTorahContent() { loaded = null; loading = null; packs.clear(); bodies.clear(); }
async function activeSource() {
  if (source) return source;
  if (!defaultSource) defaultSource = (await import('./torahContentSource.mjs')).default;
  return defaultSource;
}

// ---- the app's own divrei torah, as articles ----
const words = text => String(text || '').split(/\s+/).filter(Boolean).length;
export const readMinutesOf = text => Math.max(1, Math.round(words(text) / 170));
const legacyHolidayIds = id => (id === 'shmini-atzeret' ? ['shmini-atzeret', 'simchat-torah'] : [id]);
function legacyArticles() {
  const list = [];
  for (const [name, items] of Object.entries(PARASHA_DIVREI_TORAH)) {
    const parasha = canonicalParasha(name);
    if (!parasha) continue;
    items.forEach((item, n) => list.push(legacyArticle(`app-p${parashaIndex(parasha) + 1}-${n + 1}`, item, { parashot: [parasha] })));
  }
  for (const [id, items] of Object.entries(HOLIDAY_DIVREI_TORAH)) items.forEach((item, n) => list.push(legacyArticle(`app-${id}-${n + 1}`, item, { holidays: legacyHolidayIds(id) })));
  return list;
}
function legacyArticle(id, item, scope) {
  return {
    id, title: item.title, contentType: 'short', parashot: [], holidays: [], specialShabbatot: [], topics: [], ...scope,
    readMinutes: readMinutesOf(item.text), excerpt: item.text.slice(0, 160), collection: 'app',
    body: { paragraphs: [item.text], source: { ref: item.source } },
  };
}

// ---- the catalog: one shape for the archive and the fallback ----
const listOf = value => (Array.isArray(value) ? value : value ? [value] : []);
function normalizeArticle(raw) {
  if (!raw || typeof raw.id !== 'string' || !raw.id || !String(raw.title || '').trim()) return null;
  return {
    id: raw.id,
    title: String(raw.title).trim(),
    // The author's full heading line, when the short title is an abridgement of it (shown once, in the reader).
    heading: String(raw.heading || '').trim() && String(raw.heading).trim() !== String(raw.title).trim() ? String(raw.heading).trim() : null,
    contentType: raw.contentType || 'dvar-torah',
    shabbatTable: raw.shabbatTable === true,
    parashot: [...new Set(listOf(raw.parashot).map(canonicalParasha).filter(Boolean))],
    holidays: listOf(raw.holidays).filter(id => typeof id === 'string'),
    specialShabbatot: listOf(raw.specialShabbatot).filter(id => typeof id === 'string'),
    topics: listOf(raw.topics).map(String).filter(Boolean),
    readMinutes: Number(raw.readMinutes) > 0 ? Number(raw.readMinutes) : 1,
    year: raw.year ?? null,
    pack: raw.pack || null,
    excerpt: String(raw.excerpt || ''),
    collection: 'bnei-zion',
  };
}
const push = (map, key, id) => { if (!key) return; if (!map.has(key)) map.set(key, []); map.get(key).push(id); };

/** Builds the catalog from an index (or none): the archive's articles, and the app's own where the archive has none. */
export function buildCatalog(index = null, { loaded: wasLoaded = Boolean(index) } = {}) {
  const archive = listOf(index?.articles).map(normalizeArticle).filter(Boolean);
  const seen = new Set();
  const articles = archive.filter(item => (seen.has(item.id) ? false : (seen.add(item.id), true)));
  const covered = { parashot: new Set(articles.flatMap(item => item.parashot)), holidays: new Set(articles.flatMap(item => item.holidays)) };
  // The fallback fills each parasha and festival the archive does not cover (all of them when there is no archive).
  for (const item of legacyArticles()) {
    if (item.parashot.length && covered.parashot.has(item.parashot[0])) continue;
    if (item.holidays.length && item.holidays.every(id => covered.holidays.has(id))) continue;
    articles.push(item);
  }
  const byId = new Map(articles.map(item => [item.id, item]));
  const byParasha = new Map(); const byHoliday = new Map(); const bySpecial = new Map(); const byTopic = new Map(); const byType = new Map();
  for (const item of articles) {
    item.parashot.forEach(name => push(byParasha, name, item.id));
    item.holidays.forEach(id => push(byHoliday, id, item.id));
    item.specialShabbatot.forEach(id => push(bySpecial, id, item.id));
    item.topics.forEach(topic => push(byTopic, topic, item.id));
    push(byType, item.contentType, item.id);
  }
  return {
    version: index?.version || null,
    loaded: wasLoaded,
    hasArchive: archive.length > 0,
    archiveCount: archive.length,
    articles, byId, byParasha, byHoliday, bySpecial, byTopic, byType,
    packs: index?.packs || null,
  };
}

let loaded = null;
let loading = null;
let fallback = null;
const legacyCatalog = () => fallback || (fallback = buildCatalog(null, { loaded: false }));

/** The catalog as it is now: the full one once loaded, else the app's own divrei torah (always synchronous). */
export const currentTorahCatalog = () => loaded || legacyCatalog();
export const torahCatalogLoaded = () => Boolean(loaded);

/** Loads the archive's index once (a missing or broken index leaves the app's own divrei torah, never an error). */
export function loadTorahCatalog() {
  if (loaded) return Promise.resolve(loaded);
  if (!loading) {
    loading = activeSource()
      .then(src => src.loadIndex?.())
      .then(index => validateIndex(index).ok ? index : null)
      .catch(() => null)
      .then(index => (loaded = buildCatalog(index, { loaded: true })));
  }
  return loading;
}

// ---- queries ----
const resolve = (catalog, ids) => (ids || []).map(id => catalog.byId.get(id)).filter(Boolean);
const unique = list => { const seen = new Set(); return list.filter(item => (seen.has(item.id) ? false : (seen.add(item.id), true))); };
/** One parasha, or a combined reading: every half's articles (an article filed under both appears once). */
export function articlesForParasha(catalog, name) {
  const names = Array.isArray(name) ? name : [name];
  return unique(names.flatMap(part => resolve(catalog, catalog.byParasha.get(canonicalParasha(part)))));
}
export const articlesForHoliday = (catalog, id) => resolve(catalog, catalog.byHoliday.get(id));
export const articlesForSpecialShabbat = (catalog, id) => resolve(catalog, catalog.bySpecial.get(id));
export const articlesForTopic = (catalog, topic) => resolve(catalog, catalog.byTopic.get(topic));
export const torahArticle = (catalog, id) => catalog.byId.get(id) || null;

export function parashaCounts(catalog) {
  return Object.fromEntries(PARASHOT.map(name => [name, (catalog.byParasha.get(name) || []).length]));
}
export const holidayCollections = catalog => HOLIDAYS.map(item => ({ ...item, count: (catalog.byHoliday.get(item.id) || []).length })).filter(item => item.count);
export const specialShabbatCollections = catalog => SPECIAL_SHABBATOT.map(item => ({ ...item, count: (catalog.bySpecial.get(item.id) || []).length })).filter(item => item.count);
export const topicCollections = catalog => [...catalog.byTopic.entries()].map(([topic, ids]) => ({ id: topic, he: topic, count: ids.length })).sort((a, b) => b.count - a.count || a.he.localeCompare(b.he, 'he'));

// Filters (kind, topic, reading time) and the orders a reader can choose.
export const READ_TIME_FILTERS = Object.freeze([['all', 'כל האורכים'], ['short', 'עד 3 דקות'], ['medium', '4–7 דקות'], ['long', '8 דקות ומעלה']]);
const inReadTime = (minutes, band) => band === 'short' ? minutes <= 3 : band === 'medium' ? minutes >= 4 && minutes <= 7 : band === 'long' ? minutes >= 8 : true;
export function filterArticles(list, { contentType = 'all', topic = 'all', readTime = 'all' } = {}) {
  return list.filter(item => (contentType === 'all' || item.contentType === contentType) && (topic === 'all' || item.topics.includes(topic)) && inReadTime(item.readMinutes, readTime));
}
export const SORTS = Object.freeze([['order', 'לפי הסדר'], ['short', 'הקצרים תחילה'], ['long', 'הארוכים תחילה'], ['title', 'לפי שם']]);
export function sortArticles(list, sort = 'order') {
  const copy = [...list];
  if (sort === 'short') return copy.sort((a, b) => a.readMinutes - b.readMinutes);
  if (sort === 'long') return copy.sort((a, b) => b.readMinutes - a.readMinutes);
  if (sort === 'title') return copy.sort((a, b) => a.title.localeCompare(b.title, 'he'));
  return copy;
}

/** A collection organised for reading: stories and meshalim, short ones, longer ones — each group in its own order. */
export function groupArticles(list) {
  return ['story', 'short', 'deep'].map(slot => ({ slot, label: SLOT_LABELS[slot], items: list.filter(item => SLOT_OF(item) === slot) })).filter(group => group.items.length);
}

// ---- the collection an article belongs to (for "עוד לפרשה", next / previous, the reader's quiet line) ----
export function primaryScope(article) {
  if (!article) return null;
  if (article.parashot.length) return { kind: 'parasha', id: article.parashot[0], label: `פרשת ${article.parashot.join('–')}`, route: torahRoute.parasha(article.parashot[0]) };
  if (article.holidays.length) return { kind: 'holiday', id: article.holidays[0], label: holidayLabel(article.holidays[0]) || 'מועדים', route: torahRoute.holiday(article.holidays[0]) };
  if (article.specialShabbatot.length) return { kind: 'special', id: article.specialShabbatot[0], label: specialShabbatLabel(article.specialShabbatot[0]) || 'שבתות מיוחדות', route: torahRoute.special(article.specialShabbatot[0]) };
  if (article.topics.length) return { kind: 'topic', id: article.topics[0], label: article.topics[0], route: torahRoute.topic(article.topics[0]) };
  return { kind: 'all', id: null, label: 'דברי תורה', route: torahRoute.home() };
}
export function scopeArticles(catalog, scope) {
  if (!scope) return [];
  if (scope.kind === 'parasha') return articlesForParasha(catalog, scope.id);
  if (scope.kind === 'holiday') return articlesForHoliday(catalog, scope.id);
  if (scope.kind === 'special') return articlesForSpecialShabbat(catalog, scope.id);
  if (scope.kind === 'topic') return articlesForTopic(catalog, scope.id);
  return catalog.articles;
}
export function articleNeighbours(catalog, id) {
  const article = torahArticle(catalog, id);
  const list = scopeArticles(catalog, primaryScope(article));
  const index = list.findIndex(item => item.id === id);
  return { previous: index > 0 ? list[index - 1] : null, next: index >= 0 && index < list.length - 1 ? list[index + 1] : null, position: index + 1, total: list.length };
}
/** The reader's quiet line: "פרשת יתרו · 4 דקות". */
export const articleMetaLine = article => [primaryScope(article)?.label, minutesLabel(article?.readMinutes)].filter(Boolean).join(' · ');
// A list's quiet line: the time, the kind (when it is not the plain "דבר תורה"), the first topic.
export const articleKindLine = article => {
  const kind = contentTypeLabel(article.contentType);
  return [minutesLabel(article.readMinutes), kind !== 'דבר תורה' ? kind : null, article.topics[0] || (kind === 'דבר תורה' ? kind : null)].filter(Boolean).join(' · ');
};

// ---- routes (the app's hash routes: #torah, #torah/parasha/<name>, #torah/article/<id> …) ----
const enc = value => encodeURIComponent(value);
export const torahRoute = {
  home: () => 'torah',
  parasha: name => `torah/parasha/${enc(name)}`,
  holiday: id => `torah/holiday/${enc(id)}`,
  special: id => `torah/special/${enc(id)}`,
  topic: name => `torah/topic/${enc(name)}`,
  favorites: () => 'torah/favorites',
  article: id => `torah/article/${enc(id)}`,
};
export function parseTorahRoute(mode) {
  const [, view, ...rest] = String(mode || '').split('/');
  let id = null;
  try { id = rest.length ? decodeURIComponent(rest.join('/')) : null; } catch { id = null; }
  if (['parasha', 'holiday', 'special', 'topic', 'article'].includes(view) && id) return { view, id };
  if (view === 'favorites') return { view };
  return { view: 'home' };
}

// ---- article bodies ----
const packs = new Map();
const PACK_CACHE_LIMIT = 8;
function packEntry(catalog, name) {
  const entry = catalog.packs?.[name];
  return { name, file: entry?.file || `${name}.json.gz`, checksum: entry?.checksum || null };
}
export async function verifiedPackText(bytesOrText, expected) {
  const text = typeof bytesOrText === 'string' ? bytesOrText : await packBytesToText(bytesOrText);
  if (expected && checksum(text) !== expected) throw new Error('חבילת דברי התורה אינה תואמת לחתימה שלה ולכן לא נפתחה.');
  return text;
}
async function loadPack(catalog, name) {
  if (packs.has(name)) return packs.get(name);
  const src = await activeSource();
  const entry = packEntry(catalog, name);
  // A loader returns the file's bytes or text (verified here), or an already-parsed pack (a bundled module).
  const promise = Promise.resolve(src.loadPack(name, entry)).then(async raw => {
    const bytes = raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw;
    const data = typeof bytes === 'string' || bytes instanceof Uint8Array ? JSON.parse(await verifiedPackText(bytes, entry.checksum)) : bytes;
    if (!data?.articles || typeof data.articles !== 'object') throw new Error('חבילת דברי התורה ריקה.');
    return data;
  });
  packs.set(name, promise);
  promise.catch(() => packs.delete(name));
  if (packs.size > PACK_CACHE_LIMIT) packs.delete(packs.keys().next().value);
  return promise;
}

const paragraphsOf = body => {
  const list = Array.isArray(body?.paragraphs) && body.paragraphs.length ? body.paragraphs : String(body?.text || '').split(/\n{2,}|\r?\n/);
  return list.map(text => String(text || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
};
// Articles already read in this session, ready at once (Back to an article, the Shabbat table after the reader).
const bodies = new Map();
export const cachedTorahArticle = id => bodies.get(id) || null;
/** The whole article: its index entry, its paragraphs, its source and its rights. Throws when it cannot be read. */
export async function loadTorahArticle(id, { catalog = null } = {}) {
  const cat = catalog || await loadTorahCatalog();
  const meta = torahArticle(cat, id);
  if (!meta) throw new Error('דבר התורה לא נמצא.');
  if (meta.body) return { ...meta, paragraphs: paragraphsOf(meta.body), source: meta.body.source, rights: null };
  if (bodies.has(id)) return bodies.get(id);
  const pack = await loadPack(cat, meta.pack);
  const body = pack.articles[id];
  if (!body || (body.status && body.status !== 'published')) throw new Error('דבר התורה אינו זמין כרגע במכשיר.');
  const article = { ...meta, paragraphs: paragraphsOf(body), source: body.source || { collection: BNEI_ZION.collection, author: BNEI_ZION.author }, rights: body.rights || null, sourceAppearances: body.sourceAppearances || [] };
  if (bodies.size > 40) bodies.delete(bodies.keys().next().value);
  bodies.set(id, article);
  return article;
}

// ---- the data contract, checked (tests, and the engine before it trusts an index) ----
export function validateIndex(index) {
  const problems = [];
  if (!index || typeof index !== 'object') return { ok: false, problems: ['index: missing'] };
  if (!Array.isArray(index.articles)) problems.push('index.articles: not an array');
  const ids = new Set();
  for (const item of index.articles || []) {
    if (!item?.id || typeof item.id !== 'string') { problems.push('article without id'); continue; }
    if (ids.has(item.id)) problems.push(`${item.id}: duplicate id`);
    ids.add(item.id);
    if (!String(item.title || '').trim()) problems.push(`${item.id}: no title`);
    if (!item.pack) problems.push(`${item.id}: no pack`);
    if (!(Number(item.readMinutes) > 0)) problems.push(`${item.id}: readMinutes`);
    for (const name of item.parashot || []) if (!canonicalParasha(name)) problems.push(`${item.id}: unknown parasha ${name}`);
  }
  return { ok: problems.filter(problem => !/unknown parasha/.test(problem)).length === 0 && Array.isArray(index.articles), problems };
}
export function validatePack(pack, { index = null } = {}) {
  const problems = [];
  if (!pack?.articles || typeof pack.articles !== 'object') return { ok: false, problems: ['pack.articles: missing'] };
  for (const [id, body] of Object.entries(pack.articles)) {
    if (!paragraphsOf(body).length) problems.push(`${id}: empty text`);
    if (body.source?.collection !== BNEI_ZION.collection || body.source?.author !== BNEI_ZION.author) problems.push(`${id}: source must name בני ציון / משה מזרחי`);
    if (body.rights?.permission !== 'granted' || body.rights?.creditRequired !== true) problems.push(`${id}: rights must record the permission and the required credit`);
    if (index && !index.articles.some(item => item.id === id)) problems.push(`${id}: not in the index`);
  }
  return { ok: problems.length === 0, problems };
}
