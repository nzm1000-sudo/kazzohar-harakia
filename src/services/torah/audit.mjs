// The Torah Engine's data-quality audit (run by the tests and by scripts/torah/audit.mjs). Every number here is
// computed from the registry and the index as they are — nothing is taken from an earlier report.
import { WORKS, workById } from '../../data/library/registry.mjs';
import MANIFEST from '../../data/torah/searchIndex.mjs';
import VERSE_LAYERS from '../../data/torah/verseLayers.mjs';
import CITATION_EDGES from '../../data/torah/citationEdges.mjs';
import { SEARCHABLE_RIGHTS, capabilitiesOf, indexedWorks, inventorySummary, torahInventory, workIsTalmudBase } from './inventory.mjs';
import { commentaryBases } from './commentaries.mjs';
import { targetFor } from './refs.mjs';

const listedReader = work => Boolean(work && ((work.public && !work.layerOnly) || work.reader === 'talmud'));

// A published commentary must be reachable from a reader of its base text.
export function commentaryReachability(works = WORKS) {
  const problems = [];
  for (const { baseWorkId, base, layers, talmud } of commentaryBases(works)) {
    for (const layer of layers) {
      const published = layer.public || layer.layerOnly;
      if (!published) continue;
      if (!base) { problems.push({ workId: layer.workId, problem: 'orphan: base work missing' }); continue; }
      if (!listedReader(base) && !(base.public)) { problems.push({ workId: layer.workId, problem: `base ${baseWorkId} is not readable` }); continue; }
      const edition = layer.editions[0];
      if (talmud) {
        // The Talmud reader shows the local Rashi / Tosafot per segment; the live Rishonim per amud.
        if (layer.kind === 'pack' && !['rashi', 'tosafot'].includes(layer.group)) problems.push({ workId: layer.workId, problem: 'local Talmud layer with no panel in the reader' });
        continue;
      }
      const reachable = (edition.anchorNodes?.length || 0) > 0 || (edition.seifCounts?.length || 0) > 0 || Boolean(VERSE_LAYERS[baseWorkId]?.layers.includes(layer.workId)) || layer.relation.anchorScheme === 'footnote-marker' || layer.relation.anchorScheme === 'sefaria-links-live';
      if (!reachable) problems.push({ workId: layer.workId, problem: 'no anchor data: the reader cannot show it on any page' });
    }
  }
  return problems;
}

export function torahAudit() {
  const inventory = torahInventory();
  const indexed = new Map(MANIFEST.works.map(row => [row[0], row]));
  const ids = WORKS.map(work => work.workId);
  const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i);
  const shouldIndex = indexedWorks();
  const missingFromIndex = shouldIndex.filter(work => !indexed.has(work.workId)).map(work => work.workId);
  const staleInIndex = shouldIndex.filter(work => work.kind === 'pack' && indexed.has(work.workId) && indexed.get(work.workId)[4] !== work.editions[0].checksum).map(work => work.workId);
  const indexedButNotAllowed = MANIFEST.works.filter(([id, , rights]) => !SEARCHABLE_RIGHTS.has(rights) || (workById(id) && capabilitiesOf(workById(id)).globalSearch !== 'full-text')).map(([id]) => id);
  const noTarget = shouldIndex.filter(work => work.kind === 'pack').filter(work => {
    const node = work.editions[0].nodes.findIndex(Boolean) + 1;
    return !targetFor(work, node, 1, { anchor: work.relation ? 1 : null });
  }).map(work => work.workId);
  const missingRights = WORKS.filter(work => !(work.editions?.[0]?.license || work.license)).map(work => work.workId);
  const orphanCommentary = WORKS.filter(work => work.relation?.baseWorkId && !workById(work.relation.baseWorkId)).map(work => work.workId);
  const unreachableCommentary = commentaryReachability();
  const emptyWorks = shouldIndex.filter(work => work.kind === 'pack' && !work.editions[0].nodes.some(Boolean)).map(work => work.workId);
  const records = inventory.records;
  const byFamily = {};
  for (const [, family, , docs] of MANIFEST.works) byFamily[family] = (byFamily[family] || 0) + docs;
  return {
    summary: inventorySummary(inventory),
    index: { version: MANIFEST.version, works: MANIFEST.works.length, units: MANIFEST.totals.documents, terms: MANIFEST.totals.terms, postings: MANIFEST.totals.postings, bytes: MANIFEST.totals.bytes, stopTerms: MANIFEST.stopTerms.length, byFamily },
    graph: {
      nodes: MANIFEST.totals.documents,
      edges: {
        COMMENTS_ON: records.filter(record => record.commentaryRelationship && record.searchable).reduce((sum, record) => sum + (MANIFEST.works.find(row => row[0] === record.id)?.[3] || 0), 0),
        EXPLICITLY_CITES: CITATION_EDGES.length,
        BELONGS_TO: MANIFEST.totals.documents,
      },
    },
    problems: { duplicateIds, missingFromIndex, staleInIndex, indexedButNotAllowed, noTarget, missingRights, orphanCommentary, unreachableCommentary, emptyWorks },
    notFullText: records.filter(record => record.capabilities.browsing && record.capabilities.globalSearch !== 'full-text').map(record => ({ id: record.id, reason: record.capabilities.fullTextReason })),
    talmudBases: WORKS.filter(work => workIsTalmudBase(work.workId)).length,
  };
}
