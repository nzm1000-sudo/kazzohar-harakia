// Layers of a passage: given a place in a base work (the Zohar, later the Tanakh, Mishnah, Talmud…), which
// translations and commentaries exist for it, and their text. Decided from the compact page index in the registry,
// so the reader knows which tabs to offer without loading a whole commentary.
//   relation: { relationType, baseWorkId, anchorScheme }   anchors: { unitId, anchorRef, canonicalRef }
import { WORKS, workById } from '../../data/library/registry.mjs';
import { loadEditionChunk, loadPackJson } from './packs.mjs';
import { nodeForRef, paginationNodes } from './pagination.mjs';

export const RELATION_TYPES = Object.freeze(['translation', 'commentary', 'supercommentary', 'parallel', 'quotation', 'halachic-descendant']);
// Shown, word for word, where a work looks for a translation and none covers the page. Never filled with other text.
export const NO_TRANSLATION_NOTICE = 'טרם קיים תרגום פתוח לקטע זה';
const ORDER = { translation: 0, commentary: 1, supercommentary: 2, parallel: 3, quotation: 4, 'halachic-descendant': 5 };

// Layers of a base work, by kind, then by the commentator's customary place (רש״י before רמב״ן…), bundled before remote.
export const layersOf = (baseWorkId, works = WORKS) => works
  .filter(work => work.relation?.baseWorkId === baseWorkId)
  .sort((a, b) => ORDER[a.relation.relationType] - ORDER[b.relation.relationType] || (a.layerRank ?? 99) - (b.layerRank ?? 99));

// Tab names follow the base text: the Tanakh reads מקרא, the Mishnah משנה; other books מקור. Parallel and quoted
// sources are מקורות beside the Tanakh and מקבילות beside the Mishnah.
const TAB_NAMES = {
  tanakh: { source: 'מקרא', parallel: 'מקורות' },
  mishnah: { source: 'משנה', parallel: 'מקבילות' },
};
export function layerTabNames(baseWork) {
  const names = TAB_NAMES[baseWork?.primaryCategory] || {};
  return { source: names.source || 'מקור', translation: 'תרגום', commentary: 'מפרשים', parallel: names.parallel || 'מקבילות' };
}
export const isParallel = layer => layer.relationType === 'parallel' || layer.relationType === 'quotation';

// "Zohar.15", "Zohar.15.3" (pack ids) or "Zohar 1:15a" (printed page) → { workId, node, unit }.
export function parseBaseRef(ref, works = WORKS) {
  const text = String(ref || '').trim();
  const id = /^([A-Z][A-Za-z_]*)\.(\d+)(?:\.(\d+))?$/.exec(text);
  if (id) return { workId: id[1], node: Number(id[2]), unit: id[3] ? Number(id[3]) : null };
  const page = /^([A-Z][A-Za-z_ ]*?) (\d+:\d+[ab])$/.exec(text);
  if (page) {
    const work = works.find(item => item.workId === page[1].replace(/ /g, '_') || item.sourceTitle === page[1]);
    const node = work?.editions[0].pagination && nodeForRef(work.editions[0].pagination, page[2]);
    if (node) return { workId: work.workId, node, unit: null };
  }
  return null;
}

// Every layer with text on this page: bundled ones as [{ node, from, to }] segments of the layer, remote ones by count.
export function layersAt(baseWorkId, node, works = WORKS) {
  const found = [];
  for (const work of layersOf(baseWorkId, works)) {
    const edition = work.editions[0];
    const rows = (edition.anchorNodes || []).filter(row => row[0] === node);
    if (!rows.length) continue;
    const remote = work.kind === 'remote';
    found.push({
      work,
      relationType: work.relation.relationType,
      remote,
      segments: remote ? [] : rows.map(([, layerNode, from, to]) => ({ node: layerNode, from, to })),
      count: remote ? rows.reduce((total, row) => total + row[1], 0) : rows.reduce((total, row) => total + row[3] - row[2] + 1, 0),
    });
  }
  return found;
}

// The whole answer for one place: base, translations, commentaries, and the notice when no translation covers it.
export function layersForRef(ref, works = WORKS) {
  const base = parseBaseRef(ref, works);
  const work = base && works.find(item => item.workId === base.workId);
  if (!work) return null;
  const all = layersAt(work.workId, base.node, works);
  const translations = all.filter(layer => layer.relationType === 'translation');
  return {
    base: { ...base, title: work.editions[0].nodeTitles?.[base.node - 1] || null },
    translations,
    commentaries: all.filter(layer => layer.relationType !== 'translation' && !isParallel(layer)),
    parallels: all.filter(isParallel),
    translationNotice: work.translationSought && !translations.length ? NO_TRANSLATION_NOTICE : null,
  };
}

// A bundled layer's units for one base page (a commentary on the Tanakh or the Mishnah: one chapter; its units carry
// v, the verse or mishnah they sit on).
export async function loadLayerUnits(layer, options = {}) {
  const chunk = await loadEditionChunk(layer.work.editions[0], options);
  return layer.segments.flatMap(segment => (chunk.nodes.find(item => item.n === segment.node)?.units || []).filter(unit => unit.n >= segment.from && unit.n <= segment.to));
}

// Units grouped by the verse (mishnah) they explain, in order: [{ v, units }]. Units without v form one group.
export function groupByVerse(units) {
  const groups = [];
  for (const unit of units) {
    const last = groups.at(-1);
    if (last && last.v === (unit.v ?? null)) last.units.push(unit); else groups.push({ v: unit.v ?? null, units: [unit] });
  }
  return groups;
}

// A layer's anchor records (unitId → anchorRef/canonicalRef), checksum-verified from its pack.
export function loadAnchors(work, options = {}) {
  const edition = work.editions[0];
  if (!edition.anchorsFile) return Promise.resolve(null);
  return loadPackJson({ packId: edition.packId, file: edition.anchorsFile, checksum: edition.anchorsChecksum }, options);
}

// ---------- Remote layers: one exact public-domain edition, fetched live ----------
const SEFARIA = 'https://www.sefaria.org/api/v3/texts/';
const remoteCache = new Map();
const ENTITY = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '‹', gt: '›', thinsp: ' ' };
const plain = html => String(html ?? '')
  .replace(/<sup[^>]*class="footnote-marker"[^>]*>[\s\S]*?<\/sup>/gi, '')
  .replace(/<i[^>]*class="footnote"[^>]*>[\s\S]*?<\/i>/gi, '')
  .replace(/<[^>]+>/g, '')
  .replace(/&(#\d+|[a-z]+);/gi, (match, code) => (code[0] === '#' ? String.fromCodePoint(Number(code.slice(1))) : ENTITY[code.toLowerCase()] ?? match))
  .replace(/[<>]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

// The provider ref of one base place: a printed page of a paginated work ({volume}/{amud}), or a chapter ({chapter}).
export function remoteRef(work, baseWork, node) {
  const pattern = work.editions[0].refPattern;
  if (pattern.includes('{chapter}')) return node >= 1 && node <= (baseWork.editions[0].expected?.length || 0) ? pattern.replace('{title}', work.sourceTitle).replace('{chapter}', node) : null;
  const page = paginationNodes(baseWork.editions[0].pagination)[node - 1];
  if (!page?.volume) return null;
  return work.editions[0].refPattern.replace('{title}', work.sourceTitle).replace('{volume}', page.volume).replace('{amud}', page.amud);
}

export async function loadRemoteLayerUnits(layer, node, { fetchImpl = globalThis.fetch, baseWork = workById(layer.work.relation.baseWorkId) } = {}) {
  const edition = layer.work.editions[0];
  const ref = remoteRef(layer.work, baseWork, node);
  if (!ref) return [];
  const key = `${edition.editionId}|${ref}`;
  if (remoteCache.has(key)) return remoteCache.get(key);
  const url = `${SEFARIA}${encodeURIComponent(ref)}?version=${encodeURIComponent(`hebrew|${edition.versionTitle}`)}&return_format=text_only`;
  let data;
  try {
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error();
    data = await response.json();
  } catch {
    throw new Error('פירוש זה נטען מספריא, ולכן זמין רק עם חיבור לאינטרנט.');
  }
  const version = data?.versions?.[0];
  // Only the registered edition, only while it is still recorded as public domain; anything else is refused.
  if (!version || version.versionTitle !== edition.versionTitle || !/^(public domain|pd)$/i.test(String(version.license || '').trim())) throw new Error('המהדורה שהתקבלה אינה המהדורה הרשומה, ולכן לא הוצגה.');
  const list = Array.isArray(version.text) ? version.text : [version.text];
  // A chapter of a verse commentary arrives as verses → comments; a printed page as a flat list of paragraphs.
  const slots = list.some(Array.isArray) ? list.flatMap((comments, i) => (Array.isArray(comments) ? comments : [comments]).map(text => ({ v: i + 1, text }))) : list.map(text => ({ text }));
  const units = slots.map((slot, i) => ({ id: `${layer.work.workId}.${node}.${i + 1}`, n: i + 1, ...(slot.v ? { v: slot.v } : {}), text: plain(slot.text) })).filter(unit => unit.text);
  remoteCache.set(key, units);
  return units;
}
