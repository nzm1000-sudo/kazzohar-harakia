// Tanakh from the bundled UXLC 2.5 pack (Tanach.us), so every Tanakh reference — a chapter, a reading, a haftarah,
// Megillat Esther — opens without a network. References: "Book C", "Book C:V", "Book C:V-V2", "Book C:V-C2:V2", "Book C-C2".
import { workById } from '../data/library/registry.mjs';
import { loadEditionChunk } from './library/packs.mjs';

const REF = /^([A-Za-z][A-Za-z ]*?)\s+(\d+)(?::(\d+))?(?:-(\d+)(?::(\d+))?)?$/;

export function parseTanakhRef(ref) {
  const match = String(ref || '').trim().match(REF);
  if (!match) return null;
  const [, book, c1, v1, a, b] = match;
  const workId = book.trim().replace(/\s+/g, '_');
  const startChapter = Number(c1);
  const startVerse = v1 ? Number(v1) : 1;
  // "C:V-X" ends in the same chapter at verse X; "C:V-C2:V2" ends at C2:V2; "C-C2" is whole chapters.
  const endChapter = b ? Number(a) : a && !v1 ? Number(a) : startChapter;
  const endVerse = b ? Number(b) : a && v1 ? Number(a) : v1 && !a ? startVerse : Infinity;
  return { workId, startChapter, startVerse, endChapter, endVerse };
}

export async function localTanakhText(ref, { loadChunk = loadEditionChunk } = {}) {
  const range = parseTanakhRef(ref);
  const work = range && workById(range.workId);
  const edition = work?.editions?.[0];
  if (!edition || edition.packId !== 'uxlc-2.5') return null;
  const chunk = await loadChunk(edition);
  const hebrew = [];
  const indexes = [];
  for (const node of chunk.nodes || []) {
    if (node.n < range.startChapter || node.n > range.endChapter) continue;
    for (const unit of node.units || []) {
      if (node.n === range.startChapter && unit.n < range.startVerse) continue;
      if (node.n === range.endChapter && unit.n > range.endVerse) continue;
      hebrew.push(unit.text);
      indexes.push(node.n * 1000 + unit.n);
    }
  }
  if (!hebrew.length) return null;
  return {
    ref, heRef: null, category: 'Tanakh', primary_category: 'Tanakh', hebrew, indexes, siddurMarkup: null, sectionRef: null, segmentNumber: null,
    version: 'Miqra according to the Masorah · UXLC 2.5 (Tanach.us)', license: 'Public Domain', sourceUrl: 'https://tanach.us', bundledOffline: true,
  };
}
