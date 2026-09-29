// One commentary engine for every base text: which commentators have something at this exact place, from data that is
// already on the device (nothing is loaded to decide, except the Talmud's amud). Each reader keeps its own
// presentation; they all ask here. Only commentators with content at the place are returned — never an empty tab.
//   Tanakh / Mishnah   per verse / mishnah   src/data/torah/verseLayers.mjs (built from the commentaries themselves)
//   Shulchan Arukh     per seif              seifCounts in the registry (relations.layersBySeif)
//   Zohar              per page              anchorNodes in the registry (relations.layersAt)
//   Talmud             per Gemara segment    the amud's local Rashi / Tosafot (talmudLocal.loadLocalAmud)
import VERSE_LAYERS from '../../data/torah/verseLayers.mjs';
import { WORKS, workById } from '../../data/library/registry.mjs';
import { layersAt, layersBySeif, layersOf, isParallel } from '../library/relations.mjs';
import { workIsTalmudBase } from './inventory.mjs';
import { amudOf, libraryReadRoute, talmudReadRoute } from './refs.mjs';

const rankOf = baseWorkId => new Map(layersOf(baseWorkId).map((work, i) => [work.workId, i]));
const entry = (work, precision, extra = {}) => ({ workId: work.workId, work, title: work.layerTitle || work.shortTitle || work.title, remote: work.kind === 'remote', precision, ...extra });

// Bundled commentators with a comment on this verse (Tanakh) or mishnah, in their customary order.
export function commentatorsOnVerse(baseWorkId, chapter, verse) {
  const map = VERSE_LAYERS[baseWorkId];
  if (!map) return [];
  const row = map.chapters[chapter - 1];
  if (!row || verse < 1 || verse * map.width > row.length) return [];
  const mask = parseInt(row.slice((verse - 1) * map.width, verse * map.width), 16);
  if (!mask) return [];
  const rank = rankOf(baseWorkId);
  return map.layers
    .filter((_, bit) => mask & (1 << bit))
    .map(id => workById(id))
    .filter(Boolean)
    .sort((a, b) => (rank.get(a.workId) ?? 99) - (rank.get(b.workId) ?? 99))
    .map(work => entry(work, 'verse'));
}
// Does this base text have verse-level commentary data at all (the Tanakh and the Mishnah)?
export const hasVerseCommentaries = baseWorkId => Boolean(VERSE_LAYERS[baseWorkId]);

// Every commentary layer with something at { workId, section, segment } — synchronous, for the library's readers.
export function commentariesAt({ workId, section, segment = null }) {
  const work = workById(workId);
  if (!work || work.kind !== 'pack') return [];
  if (VERSE_LAYERS[workId]) {
    if (segment) return commentatorsOnVerse(workId, section, segment);
    return layersAt(workId, section).filter(layer => layer.relationType !== 'translation' && !isParallel(layer)).map(layer => entry(layer.work, 'chapter', { count: layer.count }));
  }
  if (work.editions[0].unitLabel === 'סעיף' && segment) {
    const row = layersBySeif(workId, section).find(item => item.seif === segment);
    return (row?.layers || []).map(layer => entry(layer.work, 'seif', { count: layer.count }));
  }
  return layersAt(workId, section).filter(layer => layer.relationType !== 'translation' && !isParallel(layer)).map(layer => entry(layer.work, work.editions[0].pagination ? 'page' : 'chapter', { count: layer.count }));
}

// The same answer for any base, the Talmud included (its segments' commentators come from the amud on the device).
export async function getCommentaries(ref, { loadAmud = null } = {}) {
  const work = workById(ref?.workId);
  if (!work) return [];
  if (work.reader === 'talmud') {
    const { loadLocalAmud } = await import('../talmudLocal.mjs');
    const amud = amudOf(work, ref.section);
    const data = await (loadAmud || loadLocalAmud)({ title: work.sourceTitle }, amud);
    const segments = ref.segment ? data?.segments.filter(seg => seg.n === ref.segment) : data?.segments;
    const names = new Map();
    for (const seg of segments || []) for (const comment of seg.commentaries) names.set(comment.commentator, (names.get(comment.commentator) || 0) + 1);
    const layers = WORKS.filter(item => item.relation?.baseWorkId === work.workId).sort((a, b) => (a.layerRank ?? 99) - (b.layerRank ?? 99));
    return layers.filter(layer => names.has(layerLinkName(layer))).map(layer => entry(layer, ref.segment ? 'segment' : 'amud', { count: names.get(layerLinkName(layer)) }));
  }
  return commentariesAt(ref);
}
const LINK_NAMES = { rashi: 'רש"י', tosafot: 'תוספות' };
const layerLinkName = layer => LINK_NAMES[layer.group] || layer.layerTitle;

// Where a reader opens a commentator at a place: the base text's מפרשים tab (library) or the Talmud's panel.
export function commentaryRoute({ workId, section, segment = null }, layerWorkId = null) {
  const work = workById(workId);
  if (!work) return null;
  if (work.reader === 'talmud') {
    const layer = layerWorkId ? workById(layerWorkId) : null;
    return talmudReadRoute(work.sourceTitle, amudOf(work, section), segment, layer?.group || null);
  }
  return libraryReadRoute(workId, section, segment, { commentary: true });
}

// Every base work that some published commentary explains, and how a reader reaches it (for the validation tests).
export function commentaryBases(works = WORKS) {
  const bases = new Map();
  for (const work of works) {
    if (!work.relation?.baseWorkId || work.relation.relationType === 'translation') continue;
    const list = bases.get(work.relation.baseWorkId) || [];
    list.push(work);
    bases.set(work.relation.baseWorkId, list);
  }
  return [...bases].map(([baseWorkId, layers]) => ({ baseWorkId, base: workById(baseWorkId), layers, talmud: workIsTalmudBase(baseWorkId) }));
}
