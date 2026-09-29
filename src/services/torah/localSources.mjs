// Offline-first reading of a provider reference: "Shulchan Arukh, Orach Chayim 263", "Mishnah Berurah 263:1",
// "Mishnah Berakhot 1:1", "Mishneh Torah, Foundations of the Torah 1:1-3" → the same place in the book that is already
// on the device. Used by the source reader (services/sefaria.mjs) before any network request, and by the global
// search to open a result locally. Only works whose sections are the provider's own sections are resolved (the
// Shulchan Arukh and its bundled commentaries, the Mishnah, the Rambam, and the halacha shelf's simanim books); anything
// else returns null and keeps its previous path. The text is the edition's own words, checksum-verified.
import { WORKS } from '../../data/library/registry.mjs';
import { loadEditionChunk } from '../library/packs.mjs';
import { libraryReadRoute } from './refs.mjs';

const plain = title => String(title || '').replace(/['’׳]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
// Categories whose pack nodes are numbered as the provider numbers its first-level sections (verified by
// tests/offlineGlobalSearch.test.mjs against every such work's expected node count).
const ALIGNED = work => work.kind === 'pack' && !work.editions?.[0]?.pagination && work.reader !== 'talmud'
  && (work.primaryCategory === 'mishnah' || work.primaryCategory === 'rambam'
    || (work.primaryCategory === 'halacha' && (work.group === 'shulchan-arukh' || ['Kitzur_Shulchan_Arukh', 'Chayyei_Adam', 'Mishnah_Berurah', 'Biur_Halacha'].includes(work.workId))));
let byTitle = null;
function titles() {
  if (byTitle) return byTitle;
  byTitle = new Map();
  for (const work of WORKS) {
    if (!ALIGNED(work)) continue;
    for (const name of [work.sourceTitle, work.editions[0].sourceIdentifier]) if (name) byTitle.set(plain(name), work);
  }
  return byTitle;
}

const REF = /^(.+?)\s+(\d+)(?::(\d+)(?:\s*[-–]\s*(\d+))?)?$/;
// → { work, node, from, to } (units inclusive; null for the whole section) or null.
export function localPlaceForRef(ref) {
  const m = REF.exec(String(ref || '').trim());
  if (!m) return null;
  const work = titles().get(plain(m[1]));
  if (!work) return null;
  const edition = work.editions[0];
  const node = Number(m[2]);
  if (!(node >= 1 && node <= (edition.expected?.length || edition.nodes?.length || 0))) return null;
  const from = m[3] ? Number(m[3]) : null;
  const to = m[4] ? Number(m[4]) : from;
  return { work, node, from, to };
}
// The library reader's route for a provider reference (a seif beyond the edition opens its siman).
export function localRouteForRef(ref) {
  const place = localPlaceForRef(ref);
  if (!place) return null;
  const within = place.from && place.from <= (place.work.editions[0].expected?.[place.node - 1] || 0) ? place.from : null;
  return libraryReadRoute(place.work.workId, place.node, within);
}

const CATEGORY = { halacha: 'Halakhah', rambam: 'Halakhah', mishnah: 'Mishnah' };
// The text of a provider reference from the device, in the source reader's shape; null when not on the device.
export async function localPackText(ref, { loadChunk = loadEditionChunk } = {}) {
  const place = localPlaceForRef(ref);
  if (!place) return null;
  const { work, node, from, to } = place;
  const edition = work.editions[0];
  const chunk = await loadChunk(edition, { node });
  const section = chunk.nodes?.find(item => item.n === node);
  if (!section?.units?.length) return null;
  const units = [...section.units].sort((a, b) => a.n - b.n).filter(unit => !from || (unit.n >= from && unit.n <= to));
  if (!units.length) return null;
  const single = from && from === to;
  const sectionRef = String(ref).replace(/:\d+(?:\s*[-–]\s*\d+)?$/, '');
  return {
    ref,
    heRef: null,
    category: CATEGORY[work.primaryCategory] || 'Halakhah',
    primary_category: CATEGORY[work.primaryCategory] || 'Halakhah',
    hebrew: units.map(unit => [unit.title, unit.dh, unit.text].filter(Boolean).join(' ')),
    indexes: units.map(unit => unit.n - 1),
    siddurMarkup: null,
    sectionRef: single ? sectionRef : null,
    segmentNumber: single ? from : null,
    version: edition.heTitle || edition.title || null,
    license: edition.license || null,
    attribution: edition.attribution?.text || null,
    sourceUrl: edition.sourceUrl || null,
    localRoute: libraryReadRoute(work.workId, node, single ? from : null),
    bundledOffline: true,
  };
}
