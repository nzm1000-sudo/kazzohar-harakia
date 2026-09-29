// Printed pagination (volume · daf · amud) mapped onto a pack's running node numbers. Pack ids stay numeric
// (Work.node.unit); the printed page lives here, so every reader, anchor and search speaks the same page names.
// pagination = { scheme: 'daf', volumes: [{ n, title, first: '1a', last: '251a' }], extra: ['ליקוטים'] }
import { hebrewNumeral } from '../hebrewNumerals.mjs';

const AMUD = /^(\d+)([ab])$/;
export const amudIndex = amud => { const m = AMUD.exec(amud); return m ? (Number(m[1]) - 1) * 2 + (m[2] === 'b' ? 1 : 0) : -1; };
export const indexAmud = index => `${Math.floor(index / 2) + 1}${index % 2 ? 'b' : 'a'}`;
export const amudLabel = amud => { const m = AMUD.exec(amud); return m ? `דף ${hebrewNumeral(Number(m[1]))} ע״${m[2] === 'a' ? 'א' : 'ב'}` : amud; };

const cache = new WeakMap();
// Every node in order: { node, volume, volumeTitle, amud: '15a', daf: 15, side: 'a', title, ref: '1:15a' }; extra nodes
// (a book's addenda) follow the pages and carry only a title.
export function paginationNodes(pagination) {
  if (!pagination) return [];
  if (cache.has(pagination)) return cache.get(pagination);
  const nodes = [];
  for (const volume of pagination.volumes) {
    for (let index = amudIndex(volume.first); index <= amudIndex(volume.last); index += 1) {
      const amud = indexAmud(index);
      nodes.push({ node: nodes.length + 1, volume: volume.n, volumeTitle: volume.title, amud, daf: Math.floor(index / 2) + 1, side: amud.at(-1), title: `${volume.title} · ${amudLabel(amud)}`, ref: `${volume.n}:${amud}` });
    }
  }
  for (const title of pagination.extra || []) nodes.push({ node: nodes.length + 1, volume: null, title, ref: null });
  cache.set(pagination, nodes);
  return nodes;
}

export const paginationTitles = pagination => paginationNodes(pagination).map(item => item.title);

export function nodeForPage(pagination, volume, amud) {
  return paginationNodes(pagination).find(item => item.volume === volume && item.amud === amud)?.node || null;
}

// "1:15a" → node; anything else → null.
export function nodeForRef(pagination, ref) {
  const m = /^(\d+):(\d+[ab])$/.exec(String(ref || '').trim());
  return m ? nodeForPage(pagination, Number(m[1]), m[2]) : null;
}

// Short cell label for a grid of pages: "ט״ו." (amud a) and "ט״ו:" (amud b), as dapim are cited.
export const amudCell = item => `${hebrewNumeral(item.daf)}${item.side === 'a' ? '.' : ':'}`;
