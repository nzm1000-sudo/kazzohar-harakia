// The Torah content inventory: every corpus the app carries or reaches, one record each, derived from the library
// registry (no second copy of any metadata). It is the authority for three questions the rest of the engine asks:
//   • rights — may this text surface in full-text search at all? (the rights gate)
//   • capabilities — browsing, global search, in-book search, offline, commentary engine, reference resolution
//   • where it is read — the reader and the route pattern of a place in it
// A work becomes searchable only through this gate; text existing somewhere in the bundle is never enough.
import { ACQUISITION_QUEUE, AUTHOR_PERMISSION_WORKS, BLOCKED_LAYERS, WORKS, categoryById } from '../../data/library/registry.mjs';

export const RIGHTS = Object.freeze({
  OPEN: 'OPEN',
  PERMISSION_GRANTED: 'PERMISSION_GRANTED',
  NONCOMMERCIAL_ONLY: 'NONCOMMERCIAL_ONLY',
  UNKNOWN: 'UNKNOWN',
  PENDING_PERMISSION: 'PENDING_PERMISSION',
  REMOTE_ONLY: 'REMOTE_ONLY',
});
// The app is free and carries no advertising (the owner's decision), so non-commercial licences are honoured as they
// are today. Unknown or pending rights never reach full-text search.
export const SEARCHABLE_RIGHTS = new Set([RIGHTS.OPEN, RIGHTS.PERMISSION_GRANTED, RIGHTS.NONCOMMERCIAL_ONLY]);

const OPEN_LICENCES = new Set(['public-domain', 'uxlc-free', 'cc-by', 'cc-by-sa']);
const NC_LICENCES = new Set(['cc-by-nc', 'cc-by-nc-sa']);

export function rightsOf(work) {
  if (!work) return RIGHTS.UNKNOWN;
  if (work.kind === 'remote' && !isBundledRemote(work)) return RIGHTS.REMOTE_ONLY;
  const licence = work.editions?.[0]?.license || work.license;
  if (licence === 'author-permission') return AUTHOR_PERMISSION_WORKS[work.workId] ? RIGHTS.PERMISSION_GRANTED : RIGHTS.UNKNOWN;
  if (OPEN_LICENCES.has(licence)) return RIGHTS.OPEN;
  if (NC_LICENCES.has(licence)) return RIGHTS.NONCOMMERCIAL_ONLY;
  return RIGHTS.UNKNOWN;
}
// Yalkut Yosef is listed as a "remote" reader entry, but its text (Torat Emet, CC BY-NC-SA 2.5) is in the bundle.
export const BUNDLED_TEXT_WORKS = Object.freeze({ 'halacha.yalkut-yosef-tashz': { store: 'yalkut-yosef', bytes: 14335039, module: 'src/data/yalkutYosef.mjs' } });
export const isBundledRemote = work => Boolean(BUNDLED_TEXT_WORKS[work?.workId]);

// ---------- Filter families (the search filter chips) ----------
export const FAMILIES = Object.freeze([
  { id: 'all', title: 'הכל' },
  { id: 'tanakh', title: 'תנ״ך' },
  { id: 'mishnah', title: 'משנה' },
  { id: 'talmud', title: 'תלמוד' },
  { id: 'halacha', title: 'הלכה' },
  { id: 'zohar', title: 'זוהר' },
]);
const isZohar = work => work.workId === 'Zohar' || work.relation?.baseWorkId === 'Zohar';
export function familyOf(work) {
  const category = work.primaryCategory;
  if (category === 'tanakh' || category === 'tanakh-commentary') return 'tanakh';
  if (category === 'mishnah' || category === 'mishnah-commentary') return 'mishnah';
  if (category === 'talmud' || category === 'talmud-commentary') return 'talmud';
  if (category === 'halacha' || category === 'rambam' || category === 'answers') return 'halacha';
  if (isZohar(work)) return 'zohar';
  return 'other';
}

// ---------- Global full-text scope (Stage 0) ----------
// Stage 0 indexes the Torah engine's corpora: Tanakh, Mishnah, Talmud, halacha (the Shulchan Arukh and its
// commentaries, Rambam, the halacha shelf, Yalkut Yosef, עונג שבת, the published answers) and the Zohar — every one
// local and rights-cleared. Measured cost of the whole library: 38 MB of index for 691,392 units; these families:
// ≈ 18 MB. The other shelves keep title search and their in-book search; the reason is recorded, never silent.
const STAGE0_REASON = 'Stage 0 scope: outside the Torah engine corpora (title and in-book search only; index cost measured)';
export const FULL_TEXT_EXCLUDED_FAMILIES = Object.freeze({ other: STAGE0_REASON });
// Two corpora are read outside the pack format and indexed from their bundled modules.
export const EXTRA_CORPORA = Object.freeze([
  { id: 'halacha.yalkut-yosef-tashz', store: 'yalkut-yosef', title: 'ילקוט יוסף · קיצור שולחן ערוך', family: 'halacha', rights: RIGHTS.NONCOMMERCIAL_ONLY, licence: 'cc-by-nc-sa', provider: 'תורת אמת', refFormat: 'section', reader: 'source' },
  { id: 'halacha.answers', store: 'halacha-answers', title: 'תשובות הלכה מאומתות', family: 'halacha', rights: RIGHTS.PERMISSION_GRANTED, licence: 'mixed (ילקוט יוסף CC BY-NC-SA 2.5 · עונג שבת באישור המחבר)', provider: 'מנוע ההלכה', refFormat: 'question', reader: 'halacha' },
]);

const REF_FORMAT = {
  talmud: 'amud:segment', 'talmud-commentary': 'amud:segment:comment', tanakh: 'chapter:verse', 'tanakh-commentary': 'chapter:verse:comment',
  mishnah: 'chapter:mishnah', 'mishnah-commentary': 'chapter:mishnah:comment',
};
export function refFormatOf(work) {
  const edition = work.editions?.[0] || {};
  if (work.reader === 'talmud') return 'amud:segment';
  if (edition.pagination) return work.relation ? 'page:comment' : 'page:paragraph';
  if (work.relation?.anchorScheme === 'seif-markers' || work.relation?.anchorScheme === 'siman') return 'siman:seif-katan';
  if (edition.unitLabel === 'סעיף') return 'siman:seif';
  return REF_FORMAT[work.primaryCategory] || `${edition.nodeLabel || 'node'}:${edition.unitLabel || 'unit'}`;
}

// The reader a work is read in and its route pattern.
export function readerOf(work) {
  if (work.kind === 'pack' && work.reader === 'talmud') return { reader: 'talmud', route: 'talmud/<Tractate>/<amud>/<segment>' };
  if (work.kind === 'pack' && work.relation?.baseWorkId && workIsTalmudBase(work.relation.baseWorkId)) return { reader: 'talmud', route: 'talmud/<Tractate>/<amud>/<segment>/<commentator>' };
  if (work.kind === 'pack' && (work.layerOnly || work.relation)) return { reader: 'library', route: `books/r/${work.relation.baseWorkId}/<node>/<unit>/m/<unitId>` };
  if (work.kind === 'pack') return { reader: 'library', route: `books/r/${work.workId}/<node>/<unit>` };
  if (work.kind === 'legacy') return { reader: 'source', route: 'openSource(<ref>)' };
  if (isBundledRemote(work)) return { reader: 'source', route: 'openSource(Yalkut Yosef <section>)' };
  if (work.kind === 'remote' && work.layerOnly) return { reader: 'library', route: `books/r/${work.relation?.baseWorkId}/<node> (מפרשים, live)` };
  if (work.kind === 'remote') return { reader: work.route?.startsWith('talmud/') ? 'talmud' : 'remote', route: work.route || null };
  return { reader: null, route: null };
}
const talmudBases = new Set(WORKS.filter(work => work.reader === 'talmud').map(work => work.workId));
export const workIsTalmudBase = workId => talmudBases.has(workId);

export function capabilitiesOf(work) {
  const rights = rightsOf(work);
  const local = work.kind === 'pack' || work.kind === 'legacy' || isBundledRemote(work);
  const listed = Boolean(work.public && !work.layerOnly);
  const visible = listed || (work.layerOnly && work.kind === 'pack' && WORKS.find(item => item.workId === work.relation?.baseWorkId)?.public);
  const indexable = work.kind === 'pack' || isBundledRemote(work);
  const excluded = FULL_TEXT_EXCLUDED_FAMILIES[familyOf(work)] || null;
  const fullText = Boolean(visible && local && indexable && SEARCHABLE_RIGHTS.has(rights) && !excluded);
  return {
    browsing: listed,
    globalSearch: fullText ? 'full-text' : listed ? 'title' : 'none',
    bookSearch: work.kind === 'pack' || isBundledRemote(work),
    offline: local && rights !== RIGHTS.UNKNOWN,
    commentaryEngine: Boolean(work.relation) || WORKS.some(item => item.relation?.baseWorkId === work.workId),
    referenceResolution: work.kind === 'pack' || work.reader === 'talmud' || work.primaryCategory === 'talmud',
    fullTextReason: fullText ? null
      : !visible ? 'not published (hidden from the library)'
        : !SEARCHABLE_RIGHTS.has(rights) ? `rights: ${rights}`
          : !indexable ? (work.kind === 'legacy' ? 'legacy flat book: title and in-reader search only (Stage 0)' : 'remote text: fetched live, never indexed as offline')
            : excluded || null,
  };
}

// One inventory record per work (packs, legacy books, remote readers and layers).
export function inventoryRecord(work) {
  const edition = work.editions?.[0] || {};
  const capabilities = capabilitiesOf(work);
  return {
    id: work.workId,
    heTitle: work.title,
    title: work.sourceTitle || null,
    category: work.primaryCategory,
    categoryTitle: categoryById(work.primaryCategory)?.title || null,
    subcategory: work.group || null,
    family: familyOf(work),
    baseWork: work.relation?.baseWorkId || work.onTractate || null,
    commentator: work.relation ? (work.layerTitle || work.title) : null,
    refFormat: refFormatOf(work),
    local: capabilities.offline || work.kind === 'pack',
    remote: work.kind === 'remote' && !isBundledRemote(work),
    provider: edition.sourceProvider || null,
    licence: edition.license || work.license || 'unknown',
    rights: rightsOf(work),
    commercialRestriction: NC_LICENCES.has(edition.license || work.license),
    attribution: edition.attribution?.text || (work.rights ? `${work.rights.work} · ${work.rights.author} · באישור המחבר` : null),
    searchable: capabilities.globalSearch === 'full-text',
    offlineSearchable: capabilities.globalSearch === 'full-text',
    capabilities,
    reader: readerOf(work),
    commentaryRelationship: work.relation ? { type: work.relation.relationType, base: work.relation.baseWorkId, anchorScheme: work.relation.anchorScheme } : null,
    segments: Array.isArray(edition.nodes) ? edition.nodes.reduce((sum, count) => sum + (count || 0), 0) : edition.units || null,
    dataLocation: work.kind === 'pack' ? `public/library/packs/${edition.packId}/${edition.parts?.length ? `${edition.parts.length} files` : edition.file}` : BUNDLED_TEXT_WORKS[work.workId]?.module || (work.kind === 'legacy' ? 'src/data/booksOffline.mjs' : 'remote'),
    parser: work.kind === 'pack' ? 'library pack (checksum-verified)' : work.kind === 'legacy' ? 'booksOffline (flat paragraphs)' : isBundledRemote(work) ? 'bundled module' : 'provider API (registered edition)',
    coverage: work.coverage || null,
    public: Boolean(work.public),
  };
}

let cache = null;
export function torahInventory(works = WORKS) {
  if (works === WORKS && cache) return cache;
  const records = works.map(inventoryRecord);
  const queued = ACQUISITION_QUEUE.filter(item => item.status === 'PERMISSION_REQUIRED' || item.status === 'BLOCKED')
    .map(item => ({ id: `queue:${item.title}`, heTitle: item.title, rights: RIGHTS.PENDING_PERMISSION, status: item.status, searchable: false, local: false, imported: false }));
  const blocked = BLOCKED_LAYERS.map(layer => ({ id: `blocked:${layer.workId || layer.title}`, heTitle: layer.heTitle || layer.title, rights: RIGHTS.PENDING_PERMISSION, status: 'BLOCKED', searchable: false, local: false, imported: false }));
  const result = { records, pending: [...queued, ...blocked] };
  if (works === WORKS) cache = result;
  return result;
}

export function inventorySummary(inventory = torahInventory()) {
  const { records, pending } = inventory;
  const count = predicate => records.filter(predicate).length;
  const byRights = {};
  for (const record of records) byRights[record.rights] = (byRights[record.rights] || 0) + 1;
  return {
    total: records.length,
    local: count(record => record.local && !record.remote),
    remote: count(record => record.remote),
    commentaries: count(record => record.commentaryRelationship),
    searchable: count(record => record.searchable),
    rightsBlocked: count(record => !SEARCHABLE_RIGHTS.has(record.rights) && record.rights !== RIGHTS.REMOTE_ONLY),
    pendingNotImported: pending.length,
    byRights,
  };
}

// The works whose text goes into the full-text index, in a stable order (registry order).
export const indexedWorks = (works = WORKS) => works.filter(work => capabilitiesOf(work).globalSearch === 'full-text');
