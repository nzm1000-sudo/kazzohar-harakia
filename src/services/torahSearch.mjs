// Searching the divrei torah: title, text, parasha, festival, topic, keywords and source, on the device.
// The archive ships its search fields prebuilt and normalized (src/data/torahContent/search.mjs: { docs: [{ id, t, m, x }] });
// they are loaded once, lazily — never at launch and never on a keystroke — and a query is a scan of plain strings:
// no regular expressions, no normalizing of records per query. Typing on narrows the previous hits instead of scanning
// again. The search runs after the field's text has settled (the caller's deferred value / effect), never in a render.
import { normalizeHebrew } from '../content.mjs';
import { articleMetaLine, currentTorahCatalog, loadTorahCatalog } from './torahContent.mjs';
import { CONTENT_TYPES, canonicalParasha, holidayLabel, specialShabbatLabel } from './torahTaxonomy.mjs';

let prepared = null;
let preparing = null;
let configuredLoader = null;
let last = { query: null, ids: null };
const stats = { prepared: 0, scanned: 0 };
export const torahSearchStats = () => ({ ...stats });
/** Tests hand their own search-fields loader (the app's comes from the content source). */
export function configureTorahSearch(loader) { configuredLoader = loader; prepared = null; preparing = null; last = { query: null, ids: null }; }

async function loadFields() {
  if (configuredLoader) return configuredLoader();
  const source = (await import('./torahContentSource.mjs')).default;
  return source.loadSearch?.();
}

const metaWords = item => normalizeHebrew([
  ...item.parashot.flatMap(name => [name, `פרשת ${name}`]),
  ...item.holidays.map(id => holidayLabel(id) || ''),
  ...item.specialShabbatot.map(id => specialShabbatLabel(id) || ''),
  ...item.topics, CONTENT_TYPES[item.contentType] || '',
  item.collection === 'bnei-zion' ? 'בני ציון משה מזרחי' : '',
  item.collection === 'torat-shai' ? 'תורת ש״י תורת שי הרב שלום יוסף ברבי' : '',
  item.body?.source?.ref || '',
].join(' '));

/** Loads the catalog and the search fields once; returns the number of searchable articles. */
export function prepareTorahSearch() {
  if (prepared) return Promise.resolve(prepared.docs.length);
  if (!preparing) {
    preparing = Promise.all([loadTorahCatalog(), loadFields().catch(() => null)]).then(([catalog, fields]) => {
      const byId = new Map((fields?.docs || []).filter(doc => doc && typeof doc.id === 'string').map(doc => [doc.id, doc]));
      const docs = catalog.articles.map(item => {
        const doc = byId.get(item.id);
        // The archive's own fields when it has them; the app's own divrei torah (and any article without fields) from the index.
        return { id: item.id, t: doc?.t || normalizeHebrew(item.title), m: `${doc?.m || ''} ${metaWords(item)}`, x: doc?.x || normalizeHebrew(item.body ? item.body.paragraphs.join(' ') : item.excerpt) };
      });
      stats.prepared += docs.length;
      prepared = { docs, byId: new Map(docs.map(doc => [doc.id, doc])), catalog };
      last = { query: null, ids: null };
      return docs.length;
    }).finally(() => { preparing = null; });
  }
  return preparing;
}
export const torahSearchReady = () => Boolean(prepared);

function score(doc, words, phrase) {
  let total = 0;
  for (const word of words) {
    const value = doc.t.includes(word) ? 6 : doc.m.includes(word) ? 4 : doc.x.includes(word) ? 1 : 0;
    if (!value) return 0;
    total += value;
  }
  return total + (doc.t.includes(phrase) ? 10 : 0) + (doc.t === phrase ? 10 : 0);
}

/**
 * The divrei torah that match a query, best first: [{ id, title, meta, excerpt, article }], or null while the fields are
 * not loaded yet (call prepareTorahSearch first). Synchronous and cheap; meant for an effect, not for a render.
 */
export function searchTorahContent(query, { limit = 20 } = {}) {
  if (!prepared) return null;
  const raw = String(query || '').trim();
  const phrase = normalizeHebrew(canonicalParasha(raw) || raw);
  if (phrase.length < 2) return [];
  const words = phrase.split(' ').filter(Boolean);
  // A longer query (the next letter) only narrows: look only where the shorter one was found.
  const narrowing = last.query && last.ids && phrase.startsWith(last.query);
  const candidates = narrowing ? last.ids.map(id => prepared.byId.get(id)) : prepared.docs;
  stats.scanned += candidates.length;
  const hits = [];
  for (const doc of candidates) { const value = score(doc, words, phrase); if (value) hits.push({ doc, value }); }
  last = { query: phrase, ids: hits.map(hit => hit.doc.id) };
  const catalog = prepared.catalog || currentTorahCatalog();
  return hits.sort((a, b) => b.value - a.value).slice(0, limit).map(({ doc }) => {
    const article = catalog.byId.get(doc.id);
    return { id: doc.id, title: article.title, meta: articleMetaLine(article), excerpt: article.excerpt, article };
  });
}

export function _resetTorahSearch() { prepared = null; preparing = null; configuredLoader = null; last = { query: null, ids: null }; }
