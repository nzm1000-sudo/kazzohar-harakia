// Fetches one Sefaria siddur (its index tree and every leaf text) into a raw JSON dump, in the same shape as
// src/data/siddurOffline.mjs: { source, schema, texts }. Nothing is retyped: every paragraph is the edition's own.
// The dump is the input of scripts/build-nusach-pack.mjs, which checks the licence and writes the bundled chunk.
//   node scripts/build-nusach-siddur.mjs --index "Siddur Ashkenaz" --out /tmp/siddur-ashkenaz.json
import { writeFileSync } from 'node:fs';

const API = 'https://www.sefaria.org/api';
const args = Object.fromEntries(process.argv.slice(2).map((arg, i, list) => (arg.startsWith('--') ? [arg.slice(2), list[i + 1]] : null)).filter(Boolean));
const INDEX = args.index;
const OUT = args.out;
if (!INDEX || !OUT) { console.error('usage: --index "<Sefaria index title>" --out <file.json>'); process.exit(1); }

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function fetchJson(path, attempt = 0) {
  const response = await fetch(`${API}${path}`, { headers: { Accept: 'application/json' } }).catch(() => null);
  if (!response) { if (attempt < 4) { await delay(800 * (attempt + 1)); return fetchJson(path, attempt + 1); } return null; }
  if (response.status === 429 || response.status >= 500) { if (attempt < 5) { await delay(1500 * (attempt + 1)); return fetchJson(path, attempt + 1); } return null; }
  if (!response.ok) return null;
  return response.json();
}

const index = await fetchJson(`/v2/index/${encodeURIComponent(INDEX)}`);
if (!index?.schema) { console.error('index not found:', INDEX); process.exit(1); }

// Every leaf of the tree with its full address, exactly as Sefaria names it.
const leaves = [];
const walk = (node, path) => {
  for (const child of node.nodes || []) {
    const next = [...path, child.title];
    if (child.nodes) walk(child, next);
    else leaves.push({ ref: [INDEX, ...next].join(', '), depth: child.depth, heTitle: child.heTitle, title: child.title });
  }
};
walk(index.schema, []);
console.log(INDEX, '·', leaves.length, 'leaves');

const texts = {};
const excluded = [];
const licenses = new Map();
let done = 0;
const queue = [...leaves];
async function worker() {
  while (queue.length) {
    const leaf = queue.shift();
    const data = await fetchJson(`/texts/${encodeURIComponent(leaf.ref)}?context=0&commentary=0&pad=0`);
    done += 1;
    if (!data || data.error || !Array.isArray(data.he) || !data.he.length) { excluded.push({ ref: leaf.ref, why: data?.error || 'empty' }); continue; }
    // A depth-2 leaf (chapters of paragraphs) is flattened chapter by chapter, keeping the order of the edition.
    const he = data.he.every(Array.isArray) ? data.he.flat() : data.he;
    if (he.some(Array.isArray)) { excluded.push({ ref: leaf.ref, why: 'nested' }); continue; }
    texts[leaf.ref] = { ref: data.ref, heRef: data.heRef, he, heVersionTitle: data.heVersionTitle, heVersionSource: data.heVersionSource, heLicense: data.heLicense, primary_category: data.primary_category };
    const key = `${data.heVersionTitle} · ${data.heLicense}`;
    licenses.set(key, (licenses.get(key) || 0) + 1);
    if (done % 25 === 0) console.log(done, '/', leaves.length);
    await delay(120);
  }
}
await Promise.all(Array.from({ length: 3 }, worker));

const source = { index: INDEX, heTitle: index.heTitle, provider: 'Sefaria', url: `https://www.sefaria.org/${encodeURIComponent(INDEX).replace(/%20/g, '_')}`, accessedAt: new Date().toISOString().slice(0, 10), versions: [...licenses.entries()].map(([key, count]) => ({ version: key, leaves: count })), excludedLeaves: excluded };
writeFileSync(OUT, JSON.stringify({ source, schema: index.schema, texts }));
console.log('wrote', OUT, '·', Object.keys(texts).length, 'texts ·', excluded.length, 'excluded');
for (const [key, count] of licenses) console.log('  ', key, '×', count);
for (const item of excluded) console.log('  excluded:', item.ref, '·', item.why);
