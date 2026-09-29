// The header search ("חיפוש בספרייה…") runs on the Torah Engine — the same local, offline index and the same deep
// links as the library's search. Everything it shows first is on the device; the provider's online search is only an
// extra, clearly marked group that is asked when the device is online and whose failure never touches the rest.
//   localSections(query) → the app's own quick matches (an exact reference, books by title, topics, psalms, prayers)
//   remoteSearch(query)  → { status: 'offline' | 'done' | 'unavailable', hits } — never throws
//   openTargetForRemoteHit(hit) → the book on the device when it has that place, otherwise the online reader
import { PUBLIC_WORKS } from '../../data/library/registry.mjs';
import { halachot, prayers, psalmIndex, matches } from '../../content.mjs';
import { resolveLibraryReference, searchWorks } from '../library/search.mjs';
import { localRouteForRef } from './localSources.mjs';
import { libraryReadRoute } from './refs.mjs';

export const isOnline = () => { try { return globalThis.navigator?.onLine !== false; } catch { return true; } };

// Where a book opens from the header search: its reader (the Talmud at its first amud) or its page in the library.
export function workRoute(work) {
  if (work.reader === 'talmud' || (work.primaryCategory === 'talmud' && work.kind === 'remote' && !work.route)) return `talmud/${encodeURIComponent(work.sourceTitle)}/${work.firstAmud || '2a'}`;
  if (work.kind === 'remote' && work.route) return work.route;
  return `books/w/${encodeURIComponent(work.workId)}`;
}
export function referenceRoute(hit) {
  if (!hit) return null;
  if (hit.kind === 'route') return hit.route;
  return hit.node ? libraryReadRoute(hit.workId, hit.node, hit.unit || null) : `books/w/${encodeURIComponent(hit.workId)}`;
}
// A topic's source (a siman of the Shulchan Arukh) opens in the book on the device — never the network.
export function topicTarget(record) {
  const reference = `Shulchan Arukh, Orach Chayim ${record.sources[0].reference}`;
  const route = localRouteForRef(reference);
  return route ? { route } : { source: { reference, title: record.title } };
}

export function localSections(query, { works = PUBLIC_WORKS } = {}) {
  const text = String(query || '').trim();
  if (text.length < 2) return { reference: null, books: [], topics: [], psalms: [], prayers: [] };
  const reference = resolveLibraryReference(text, works);
  return {
    reference: reference ? { label: reference.label, route: referenceRoute(reference) } : null,
    books: searchWorks(text, works).slice(0, 6).map(({ work }) => ({ id: work.workId, title: work.title, route: workRoute(work), local: work.kind !== 'remote' })),
    topics: halachot.filter(record => matches(record, text)).map(record => ({ id: record.id, title: record.title, target: topicTarget(record) })),
    psalms: psalmIndex.filter(record => matches(record, text)).slice(0, 8),
    prayers: prayers.filter(record => matches(record, text)).slice(0, 5),
  };
}

// The provider's full-text search, as an extra: asked only online; any failure ("Load failed", a timeout, a server
// error) becomes a quiet status of its own group. Its hits open the local book when the device has that place.
export async function remoteSearch(query, { search, online = isOnline() } = {}) {
  if (!online) return { status: 'offline', hits: [] };
  try {
    const hits = await search(query);
    return { status: 'done', hits: (hits || []).map(hit => ({ ...hit, localRoute: localRouteForRef(hit.ref) })) };
  } catch {
    return { status: 'unavailable', hits: [] };
  }
}
