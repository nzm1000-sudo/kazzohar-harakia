// The Torah Engine's one entry point: the UI asks here, and every answer comes from the existing library data (the
// registry, the packs, the relations) — no second copy of anything.
//   getWork(id) · getSegment(ref) · getCommentaries(ref) · search(query, options) · resolveRef(text)
//   navigateToRef(ref) · getRights(id) · getAvailability(id) · getRelated(ref)
import { workById } from '../../data/library/registry.mjs';
import CITATION_EDGES from '../../data/torah/citationEdges.mjs';
import { ONG_SHABBAT_NOTE_LINKS } from '../../data/ongShabbatLinks.mjs';
import { loadEditionChunk } from '../library/packs.mjs';
import { capabilitiesOf, inventoryRecord, rightsOf } from './inventory.mjs';
import { commentariesAt, getCommentaries as commentariesFor } from './commentaries.mjs';
import { resolveTorahRef, targetFor, torahRef } from './refs.mjs';
import { searchTorah } from './search.mjs';

export const getWork = id => workById(id);
export const getRights = id => rightsOf(workById(id));
export function getAvailability(id) {
  const work = workById(id);
  if (!work) return null;
  const capabilities = capabilitiesOf(work);
  return { local: inventoryRecord(work).local, remote: work.kind === 'remote', offline: capabilities.offline, searchable: capabilities.globalSearch === 'full-text', capabilities };
}

// The text of one place: { ref, unit, text } (the edition's words, from the checksum-verified pack).
export async function getSegment({ workId, section, segment }, options = {}) {
  const work = workById(workId);
  if (!work || work.kind !== 'pack') return null;
  const chunk = await loadEditionChunk(work.editions[0], { ...options, node: section });
  const unit = chunk.nodes.find(node => node.n === section)?.units.find(item => item.n === segment) || null;
  return unit ? { ref: torahRef(work, section, segment, { anchor: unit.v || null }), unit, text: unit.text } : null;
}

export const getCommentaries = commentariesFor;
export const search = searchTorah;
export const resolveRef = resolveTorahRef;
// A TorahRef → where it is read ({ route } or { source }); the deep-link contract (never the library home).
export function navigateToRef({ workId, section, segment = null, anchor = null }) {
  return targetFor(workById(workId), section, segment, { anchor });
}

// Related sources, only from real relationships: the commentaries on this place (COMMENTS_ON), explicit citations
// parsed conservatively (EXPLICITLY_CITES), and the verified links of עונג שבת's notes. Never a guessed parallel.
export function getRelated({ workId, section, segment = null }) {
  const related = [];
  for (const layer of commentariesAt({ workId, section, segment })) related.push({ type: 'COMMENTS_ON', from: layer.workId, title: layer.title });
  const id = `${workId}.${section}${segment ? `.${segment}` : ''}`;
  for (const [from, kind, toWork, toNode, toUnit, cited] of CITATION_EDGES) {
    if (from === id) related.push({ type: 'EXPLICITLY_CITES', kind, to: { workId: toWork, section: toNode, segment: toUnit }, cited });
  }
  if (workId === 'Oneg_Shabbat_Notes' && segment) {
    for (const link of ONG_SHABBAT_NOTE_LINKS[String(segment)] || []) related.push({ type: 'EXPLICITLY_CITES', kind: link.kind, to: { workId: link.workId, section: link.node, segment: link.unit }, cited: link.cited, verified: true });
  }
  return related;
}
