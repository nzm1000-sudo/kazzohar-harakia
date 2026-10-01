// The library's route parser, without loading the page (the same rules as pages/LibraryPage.jsx parseLibraryRoute).
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../../src/pages/LibraryPage.jsx', import.meta.url), 'utf8');
if (!source.includes("if (view === 'r') return { view: 'read', id, node: Number(node) || 1, unit: Number(unit) || null")) throw new Error('LibraryPage read route changed — update tests/helpers/libraryRoute.mjs');
export function parseLibraryRouteForTest(mode) {
  const parts = String(mode).split('/').map(part => { try { return decodeURIComponent(part); } catch { return part; } });
  const [, view, id, node, unit] = parts;
  if (view === 'r' && /^v\d+$/.test(unit || '')) return { view: 'read', id, node: Number(node) || 1, unit: null, verse: Number(unit.slice(1)) };
  if (view === 'r') return { view: 'read', id, node: Number(node) || 1, unit: Number(unit) || null };
  return { view: 'other' };
}
