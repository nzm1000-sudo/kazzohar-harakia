// Layers of a passage: given a place in a base work (the Zohar, later the Tanakh, Mishnah, Talmud…), which
// translations and commentaries exist for it, and their text. Decided from the compact page index in the registry,
// so the reader knows which tabs to offer without loading a whole commentary.
//   relation: { relationType, baseWorkId, anchorScheme }   anchors: { unitId, anchorRef, canonicalRef }
import { WORKS, workById } from '../../data/library/registry.mjs';
import { loadEditionChunk, loadPackJson } from './packs.mjs';
import { amudIndex, indexAmud, nodeForRef, paginationNodes } from './pagination.mjs';

export const RELATION_TYPES = Object.freeze(['translation', 'commentary', 'supercommentary', 'parallel', 'quotation', 'halachic-descendant']);
// Shown, word for word, where a work looks for a translation and none covers the page. Never filled with other text.
export const NO_TRANSLATION_NOTICE = 'טרם קיים תרגום פתוח לקטע זה';
const ORDER = { translation: 0, commentary: 1, supercommentary: 2, parallel: 3, quotation: 4, 'halachic-descendant': 5 };

// Layers of a base work, by kind, then by the commentator's customary place (רש״י before רמב״ן…), bundled before remote.
// The registry's own layers are grouped by base once (a reader asks per verse); another list of works is sorted as given.
const sortLayers = list => list.sort((a, b) => ORDER[a.relation.relationType] - ORDER[b.relation.relationType] || (a.layerRank ?? 99) - (b.layerRank ?? 99));
let LAYERS_BY_BASE = null;
export const layersOf = (baseWorkId, works = WORKS) => {
  if (works !== WORKS) return sortLayers(works.filter(work => work.relation?.baseWorkId === baseWorkId));
  if (!LAYERS_BY_BASE) {
    LAYERS_BY_BASE = new Map();
    for (const work of WORKS) if (work.relation?.baseWorkId) (LAYERS_BY_BASE.get(work.relation.baseWorkId) || LAYERS_BY_BASE.set(work.relation.baseWorkId, []).get(work.relation.baseWorkId)).push(work);
    for (const list of LAYERS_BY_BASE.values()) sortLayers(list);
  }
  return [...(LAYERS_BY_BASE.get(baseWorkId) || [])];
};

// Tab names follow the base text: the Tanakh reads מקרא, the Mishnah משנה; other books מקור. Parallel and quoted
// sources are מקורות beside the Tanakh and מקבילות beside the Mishnah.
const TAB_NAMES = {
  tanakh: { source: 'מקרא', parallel: 'מקורות' },
  mishnah: { source: 'משנה', parallel: 'מקבילות' },
};
// A work may name its own tabs (עונג שבת: "לשון הספר" and "מקורות וטעמים").
export function layerTabNames(baseWork) {
  const names = { ...(TAB_NAMES[baseWork?.primaryCategory] || {}), ...(baseWork?.tabNames || {}) };
  return { source: names.source || 'מקור', translation: 'תרגום', commentary: names.commentary || 'מפרשים', parallel: names.parallel || 'מקבילות' };
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
// A layer stored in files by node range loads the file of each segment's node (an introduction may sit in another file).
export async function loadLayerUnits(layer, options = {}) {
  const units = [];
  for (const segment of layer.segments) {
    const chunk = await loadEditionChunk(layer.work.editions[0], { ...options, node: segment.node });
    units.push(...(chunk.nodes.find(item => item.n === segment.node)?.units || []).filter(unit => unit.n >= segment.from && unit.n <= segment.to));
  }
  return units;
}

// The Shulchan Arukh: which commentaries have something on each seif of a siman, known from the per-seif counts in the
// registry (nothing is loaded). → [{ seif, layers: [{ work, count, remote }] }] for the seifim that have any.
export function layersBySeif(baseWorkId, node, works = WORKS) {
  const bySeif = new Map();
  for (const work of layersOf(baseWorkId, works)) {
    const counts = work.editions[0].seifCounts?.find(row => row[0] === node)?.[1];
    if (!counts) continue;
    counts.forEach((count, i) => {
      if (!count) return;
      if (!bySeif.has(i + 1)) bySeif.set(i + 1, []);
      bySeif.get(i + 1).push({ work, count, remote: work.kind === 'remote' });
    });
  }
  return [...bySeif].sort((a, b) => a[0] - b[0]).map(([seif, layers]) => ({ seif, layers }));
}
// Anchor schemes whose units carry v (the verse, mishnah or seif they explain), so a place in the address can narrow them.
export const SEIF_SCHEMES = new Set(['sefaria-ref', 'seif-markers']);

// Units grouped by the verse (mishnah) they explain, in order: [{ v, units }]. Units without v form one group.
export function groupByVerse(units) {
  const groups = [];
  for (const unit of units) {
    const last = groups.at(-1);
    if (last && last.v === (unit.v ?? null)) last.units.push(unit); else groups.push({ v: unit.v ?? null, units: [unit] });
  }
  return groups;
}

// A layer's anchor records (unitId → anchorRef/canonicalRef), checksum-verified from its pack. The Talmud layers store
// them as compact rows [node, unit, segment, comment] (format "rows"); they are expanded here to the same records.
const expanded = new WeakMap();
export function expandAnchorRows(data) {
  if (data?.format === 'seif-rows') {
    // The Shulchan Arukh's commentaries: [siman, seif katan, seif].
    if (expanded.has(data)) return expanded.get(data);
    const anchors = data.rows.map(([siman, sk, seif]) => ({ unitId: `${data.workId}.${siman}.${sk}`, anchorRef: `${data.baseWorkId}.${siman}.${seif}`, canonicalRef: `${data.title} ${siman}:${sk}`, baseCanonicalRef: `${data.baseTitle} ${siman}:${seif}` }));
    const { rows, ...rest } = data;
    const result = { ...rest, anchors };
    expanded.set(data, result);
    return result;
  }
  if (data?.format !== 'rows') return data;
  if (expanded.has(data)) return expanded.get(data);
  const first = amudIndex(data.firstAmud);
  const anchors = data.rows.map(([node, unit, segment, comment]) => {
    const amud = indexAmud(first + node - 1);
    return { unitId: `${data.workId}.${node}.${unit}`, anchorRef: `${data.baseWorkId}.${node}.${segment}`, canonicalRef: `${data.title} ${amud}:${segment}:${comment}`, baseCanonicalRef: `${data.baseTitle} ${amud}:${segment}` };
  });
  const { rows, ...rest } = data;
  const result = { ...rest, anchors };
  expanded.set(data, result);
  return result;
}
export async function loadAnchors(work, options = {}) {
  const edition = work.editions[0];
  if (!edition.anchorsFile) return null;
  return expandAnchorRows(await loadPackJson({ packId: edition.packId, file: edition.anchorsFile, checksum: edition.anchorsChecksum }, options));
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
  // A layer on its own structure (the Rosh by perek, the Ran on the Rif's pages) has no ref per base page.
  if (!pattern) return null;
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
  // Only the registered edition, only while its licence is still the one registered (public domain, or a Wikisource
  // transcription under CC BY-SA credited where it is read); anything else is refused.
  const registered = String(edition.recordedLicense || 'Public Domain').trim().toLowerCase();
  const returned = String(version?.license || '').trim().toLowerCase();
  const sameLicence = registered === 'public domain' || registered === 'pd' ? /^(public domain|pd)$/.test(returned) : returned === registered && OPEN_LICENCES.has(returned);
  if (!version || version.versionTitle !== edition.versionTitle || !sameLicence) throw new Error('המהדורה שהתקבלה אינה המהדורה הרשומה, ולכן לא הוצגה.');
  const list = Array.isArray(version.text) ? version.text : [version.text];
  // A siman of the Shulchan Arukh's commentaries arrives as seifim katanim (Kaf HaChaim: each a list of paragraphs,
  // joined); its seif comes from the map built from the printed markers. A chapter of a verse commentary arrives as
  // verses → comments; a printed page as a flat list of paragraphs.
  let slots;
  const siman = Boolean(edition.joinParagraphs || edition.seifMap || edition.unitLabel);
  if (siman) {
    const map = edition.seifMap ? (await loadSeifMaps(edition.seifMap, fetchImpl))?.[layer.work.workId]?.find(row => row[0] === node)?.[1] : null;
    slots = list.map((value, i) => ({ text: Array.isArray(value) ? value.join('\n') : value, ...(map?.[i] ? { v: map[i] } : {}) }));
  } else slots = list.some(Array.isArray) ? list.flatMap((comments, i) => (Array.isArray(comments) ? comments : [comments]).map(text => ({ v: i + 1, text }))) : list.map(text => ({ text }));
  const units = slots.map((slot, i) => ({ id: `${layer.work.workId}.${node}.${i + 1}`, n: i + 1, ...(slot.v ? { v: slot.v } : {}), ...(siman ? splitOpening(String(slot.text ?? '')) : { text: plain(slot.text) }) })).filter(unit => unit.text);
  remoteCache.set(key, units);
  return units;
}
const OPEN_LICENCES = new Set(['public domain', 'pd', 'cc0', 'cc-by', 'cc-by-sa']);
// The bold opening words of a live comment, kept apart as in the bundled layers (never merged into the comment).
function splitOpening(html) {
  const m = /^\s*<b>([\s\S]*?)<\/b>([\s\S]*)$/.exec(html);
  if (m && plain(m[1]) && plain(m[2])) return { dh: plain(m[1]), text: m[2].includes('\n') ? m[2].split('\n').map(plain).filter(Boolean).join('\n') : plain(m[2]) };
  return { text: html.includes('\n') ? html.split('\n').map(plain).filter(Boolean).join('\n') : plain(html) };
}
// The s"k → seif maps of the remote layers: one small checksum-verified side file in the pack.
let seifMaps = null;
async function loadSeifMaps(ref, fetchImpl) {
  if (!seifMaps) seifMaps = loadPackJson(ref, { fetchImpl }).then(data => data.maps).catch(() => { seifMaps = null; return null; });
  return seifMaps;
}
