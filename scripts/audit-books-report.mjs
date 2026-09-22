import { writeFile } from 'node:fs/promises';
import { BOOK_CATALOG } from '../src/data/bookCatalog.mjs';
import booksOffline from '../src/data/booksOffline.mjs';

const API = 'https://www.sefaria.org/api';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchJson(path) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    let response;
    try {
      response = await fetch(`${API}${path}`, { signal: controller.signal });
    } catch {
      response = null;
    } finally {
      clearTimeout(timer);
    }
    if (!response) return null;
    if (response.ok) return response.json();
    if (response.status !== 429 && response.status < 500) return null;
    await delay(400 * (attempt + 1));
  }
  return null;
}

function sumShape(node) {
  if (node == null) return 0;
  if (typeof node === 'number') return node;
  if (Array.isArray(node)) return node.reduce((total, item) => total + sumShape(item), 0);
  if (typeof node === 'object') {
    if (Array.isArray(node.chapters)) return sumShape(node.chapters);
    if (typeof node.chapters === 'number') return node.chapters;
    if (typeof node.length === 'number') return node.length;
  }
  return 0;
}

function countEmptyAndDuplicates(hebrew) {
  const emptyCount = hebrew.filter(section => !section || !String(section).trim()).length;
  const seen = new Map();
  let duplicateCount = 0;
  hebrew.forEach(section => {
    const key = String(section || '').trim();
    if (!key || key.length < 20) return; // ignore trivial short citations like "(שם)"
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    if (n === 2) duplicateCount += 1;
  });
  return { emptyCount, duplicateCount };
}

const results = [];
for (const book of BOOK_CATALOG) {
  if (book.id === 'tanakh') continue;
  const references = book.reference.split(/\s*;\s*/).filter(Boolean);
  for (const ref of references) {
    const entry = booksOffline[ref];
    const actualCount = entry?.hebrew?.length || 0;
    const shape = await fetchJson(`/shape/${encodeURIComponent(ref)}`);
    const expectedCount = Array.isArray(shape) ? sumShape(shape) : null;
    const { emptyCount, duplicateCount } = entry ? countEmptyAndDuplicates(entry.hebrew) : { emptyCount: 0, duplicateCount: 0 };
    const missing = !entry;
    const truncated = expectedCount != null && expectedCount > 0 && actualCount < expectedCount * 0.98;
    const flags = [];
    if (missing) flags.push('missing');
    if (truncated) flags.push(`truncated(${actualCount}/${expectedCount})`);
    if (emptyCount > 0) flags.push(`empty-sections:${emptyCount}`);
    if (duplicateCount > 0) flags.push(`duplicate-sections:${duplicateCount}`);
    results.push({ id: book.id, title: book.title, category: book.category, ref, actualCount, expectedCount, flags, needsReimport: missing || truncated });
    await delay(120);
  }
}

await writeFile('/tmp/book-audit-report.json', JSON.stringify(results, null, 2));
const flagged = results.filter(r => r.flags.length);
console.log(`audited ${results.length} refs, flagged ${flagged.length}`);
for (const r of flagged) console.log(`- [${r.category}] ${r.title} (${r.ref}): ${r.actualCount}/${r.expectedCount ?? '?'} flags=${r.flags.join(',')}`);
