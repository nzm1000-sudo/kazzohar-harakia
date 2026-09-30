// The commentator shelves (מפרשי המקרא, מפרשי המשנה, מפרשי הש״ס) are read commentator-first: the list of commentators
// (bundled and read live), a commentator's books grouped by the base text's own divisions (תורה / נביאים / כתובים; the
// sedarim), then the book. Everything here is derived once from the registry — nothing is loaded to draw a list.
import { COMMENTATORS, TAXONOMY, WORKS, categoryById, workById } from '../../data/library/registry.mjs';
import { TALMUD_COVERAGE } from '../../data/library/corpusIndex.mjs';
import { isParallel, layersAt } from './relations.mjs';
import { parashotOf } from '../parashot.mjs';

// Shelf → the base texts it explains and where its honest coverage record lives.
const SHELVES = Object.freeze({
  'tanakh-commentary': { base: 'tanakh', coverage: COMMENTATORS.tanakh },
  'mishnah-commentary': { base: 'mishnah', coverage: COMMENTATORS.mishnah },
  'talmud-commentary': { base: 'talmud', coverage: { bundled: TALMUD_COVERAGE.bundled, remote: TALMUD_COVERAGE.remote } },
});
export const isCommentatorShelf = id => Object.prototype.hasOwnProperty.call(SHELVES, id);

// The Tanakh is divided as the owner reads it — תורה, נביאים, כתובים; the Mishnah and the Talmud by their sedarim.
const TANAKH_SECTIONS = [['torah', 'תורה', ['torah']], ['neviim', 'נביאים', ['neviim-rishonim', 'neviim-acharonim']], ['ketuvim', 'כתובים', ['ketuvim']]];
function sectionsOf(baseCategory) {
  if (baseCategory === 'tanakh') return TANAKH_SECTIONS;
  const category = TAXONOMY.find(item => item.id === baseCategory);
  return (category?.groups || []).map(([id, title]) => [id, title, [id]]);
}

// The base text a commentary book explains: its relation, or the tractate it belongs to (the Rif, on his own pages).
const baseOf = work => workById(work.relation?.baseWorkId || work.onTractate || '') || null;
// Canonical order of the base texts: the registry's own order (בראשית … דברי הימים; ברכות … עוקצין).
let baseOrder = null;
const orderOf = workId => {
  if (!baseOrder) baseOrder = new Map(WORKS.map((work, index) => [work.workId, index]));
  return baseOrder.get(workId) ?? Number.MAX_SAFE_INTEGER;
};
// "מלבי״ם — ביאור המילות" → "ביאור המילות": a commentator's second work on the same book is told apart by it.
const variantOf = work => (work.layerTitle && work.layerTitle.includes(' — ') ? work.layerTitle.split(' — ').slice(1).join(' — ') : '');
// A commentator's name without its variant ("אבן עזרא — הפירוש הקצר" → "אבן עזרא").
const nameOf = work => (work.layerTitle || '').split(' — ')[0] || work.title;

function bookTitle(work, base) {
  if (work.kind === 'pack') return work.shortTitle || work.title;
  if (!base) return work.title;
  const variant = variantOf(work);
  return `${base.shortTitle || base.title}${variant ? ` · ${variant}` : ''}`;
}

// A book of the shelf: a bundled book (public, read as a book) or a layer read live beside its base text.
const onShelf = (work, shelfId) => work.primaryCategory === shelfId && ((work.public && !work.layerOnly) || (work.kind === 'remote' && work.layerOnly && work.relation?.baseWorkId));

const cache = new Map();
// The commentators of a shelf, in their customary order: bundled first (the taxonomy's order), then those read live
// (by their recorded rank). Each: { id, title, author, remote, books, sections, missing }.
export function commentatorsOf(shelfId) {
  if (cache.has(shelfId)) return cache.get(shelfId);
  const shelf = SHELVES[shelfId];
  const category = categoryById(shelfId);
  if (!shelf || !category) return [];
  const coverage = [...(shelf.coverage.bundled || []), ...(shelf.coverage.remote || [])];
  const record = id => coverage.find(item => item.id === id) || null;
  const byGroup = new Map();
  for (const work of WORKS) {
    if (!onShelf(work, shelfId)) continue;
    const id = work.group || 'other';
    if (!byGroup.has(id)) byGroup.set(id, []);
    byGroup.get(id).push(work);
  }
  const taxonomyOrder = category.groups.map(([id]) => id);
  const sections = sectionsOf(shelf.base);
  const list = [...byGroup].map(([id, works]) => {
    const info = record(id);
    const remote = works.every(work => work.kind === 'remote');
    const books = works.map(work => {
      const base = baseOf(work);
      const section = base ? sections.find(([, , groups]) => groups.includes(base.group))?.[0] || 'other' : 'general';
      return { workId: work.workId, work, base, section, title: bookTitle(work, base), remote: work.kind === 'remote' };
    }).sort((a, b) => (a.base ? orderOf(a.base.workId) : -1) - (b.base ? orderOf(b.base.workId) : -1) || orderOf(a.workId) - orderOf(b.workId));
    // Sections in the base text's order; a book with no base (an introduction) opens the list, unnamed.
    const grouped = [['general', null], ...sections.map(([sid, title]) => [sid, title]), ['other', 'נוספים']]
      .map(([sid, title]) => ({ id: sid, title, books: books.filter(book => book.section === sid) }))
      .filter(section => section.books.length);
    const title = category.groups.find(([gid]) => gid === id)?.[1] || info?.he || nameOf(works[0]);
    return {
      id,
      title,
      author: info?.author || works[0].authors?.[0] || null,
      remote,
      rank: taxonomyOrder.includes(id) ? taxonomyOrder.indexOf(id) : 100 + (info?.rank ?? works[0].layerRank ?? 99),
      books,
      sections: grouped,
      // Honest coverage, as recorded: the books the commentator wrote that the app does not carry, and why.
      missing: (info?.missingBooks || []).map(item => ({ title: item.he || item.title, reason: item.reason || null })),
    };
  }).sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title, 'he'));
  cache.set(shelfId, list);
  return list;
}
export const commentatorOf = (shelfId, id) => commentatorsOf(shelfId).find(item => item.id === id) || null;

// The commentator page a commentary book belongs to (for the reader's breadcrumbs and back link), or null.
export function commentatorOfWork(work) {
  if (!work || !isCommentatorShelf(work.primaryCategory) || !work.group) return null;
  return commentatorOf(work.primaryCategory, work.group);
}

// Where one tap on a commentator's book leads. A bundled book opens as a book (its chapters); the Talmud opens in its
// reader; a layer read live opens its base text's מפרשים tab with that commentator chosen, at its first chapter.
export function bookTarget(book) {
  const { work, base } = book;
  if (work.kind === 'pack') return work.reader === 'talmud' ? { kind: 'open', work } : { kind: 'work', workId: work.workId };
  if (!base) return null;
  if (base.primaryCategory === 'talmud') return { kind: 'open', work: base };
  const first = (work.editions[0].anchorNodes || []).map(row => row[0]).filter(Number.isInteger).sort((a, b) => a - b)[0] || 1;
  return { kind: 'commentary', baseWorkId: base.workId, node: first, choice: { key: base.primaryCategory || base.workId, name: work.layerTitle || work.shortTitle || work.title } };
}

// ---------- Inside one commentator's book (מפרשי המקרא): parashot, the other commentators, switching ----------
// A commentary on a book of the Torah follows the weekly portions of its base book (כלי יקר → בראשית → פרשת נח).
export function commentaryBase(work) {
  if (!work || work.kind !== 'pack' || work.primaryCategory !== 'tanakh-commentary') return null;
  return baseOf(work);
}
export function parashotFor(work) {
  const base = commentaryBase(work);
  return parashotOf(base ? base.workId : work.workId);
}
// The portions a chapter belongs to (a chapter may open in one portion and close in the next).
export const parashotOfChapter = (work, node) => parashotFor(work).filter(parasha => parasha.from[0] <= node && parasha.to[0] >= node);

// The commentators with something on this chapter of the base text, once each, in their customary order; the one being
// read is marked current. Bundled ones open as their own book; those read live open in the base text's מפרשים tab.
const commentaryLayer = layer => layer.relationType === 'commentary' && !isParallel(layer);
export function chapterCommentators(work, node) {
  const base = commentaryBase(work);
  if (!base) return [];
  const seen = new Set();
  const list = [];
  for (const layer of layersAt(base.workId, node)) {
    if (!commentaryLayer(layer)) continue;
    const name = nameOf(layer.work);
    if (seen.has(name)) continue;
    seen.add(name);
    // The variant being read (אבן עזרא הקצר) stays itself; the others' first work on the book is the one opened.
    const current = layer.work.group === work.group;
    // layerName: the name the מפרשים tab knows it by (its chips and the remembered choice).
    list.push({ name, layerName: layer.title || layer.work.layerTitle || layer.work.shortTitle || layer.work.title, group: layer.work.group, workId: current ? work.workId : layer.work.workId, remote: Boolean(layer.remote), current });
  }
  return list;
}
// Where a commentator tile leads, keeping the place: the same chapter, and the verse being read when there is one.
export function switchTarget(item, work, node, verse = null) {
  const base = commentaryBase(work);
  if (!base) return null;
  if (!item.remote) return { kind: 'read', workId: item.workId, node, verse };
  return { kind: 'commentary', baseWorkId: base.workId, node, verse, choice: { key: base.primaryCategory || base.workId, name: item.layerName || item.name } };
}
