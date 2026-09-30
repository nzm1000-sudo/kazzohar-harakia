// Fetches every entry of "A Dictionary of the Talmud" (Krupnik & Silbermann, London 1927 — Sefaria "מילון שימושי
// לתלמוד", version "A dictionary of the Talmud, London, 1927", recorded Public Domain, digitized by Sefaria) and stores
// the entries unaltered, in the dictionary's own order, as sources/talmud-dictionary/raw/entries.jsonl.gz.
// Run (network, once): node scripts/dictionary/fetch-krupnik.mjs [--concurrency 6]
// The build (scripts/dictionary/build-word-dictionary.mjs) never touches the network: it reads this file only.
//
// - The version's licence is re-read live from /api/texts/versions/A_Dictionary_of_the_Talmud; anything but
//   "Public Domain" stops the run and nothing is written.
// - Headwords come from Sefaria's completion list for the lexicon "Krupnik Dictionary" (which omits abbreviations and
//   homograph numbers), and every entry's `next` link is followed until the chain is closed, so the file holds the
//   whole dictionary. The entries are then ordered by the `next` chain from the first entry.
// - No personal data is sent: a fixed, anonymous User-Agent.
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT = join(ROOT, 'sources/talmud-dictionary/raw');
const args = process.argv.slice(2);
const CONCURRENCY = Number(args[args.indexOf('--concurrency') + 1]) || 6;
const SEFARIA = 'https://www.sefaria.org';
const INDEX = 'A Dictionary of the Talmud';
const VERSION = 'A dictionary of the Talmud, London, 1927';
const LETTERS = [...'אבגדהוזחטיכלמנסעפצקרשת'];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getJson(url) {
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'kazzohar-dictionary-import/1.0' } });
      if (response.ok) return await response.json();
      if (response.status < 500 && response.status !== 429) throw new Error(`${url}: HTTP ${response.status}`);
    } catch (error) { if (attempt === 8 || /HTTP 4/.test(error.message)) throw error; }
    await sleep(800 * attempt);
  }
  throw new Error(`${url}: unreachable`);
}

const versions = await getJson(`${SEFARIA}/api/texts/versions/${encodeURIComponent(INDEX.replace(/ /g, '_'))}`);
const version = versions.find(item => item.versionTitle === VERSION && item.language === 'he');
if (!version) throw new Error(`version "${VERSION}" not found`);
if (version.license !== 'Public Domain') throw new Error(`licence changed: ${version.license}`);

const headwords = new Set();
for (const letter of LETTERS) {
  const list = await getJson(`${SEFARIA}/api/words/completion/${encodeURIComponent(letter)}/Krupnik%20Dictionary?limit=100000`);
  for (const [, headword] of list) headwords.add(headword);
}
const first = `${INDEX}, א״א`;
const queue = [first, ...[...headwords].map(headword => `${INDEX}, ${headword}`)];
const seen = new Set(queue);
const entries = new Map();
const missing = [];
let done = 0;

async function worker() {
  while (queue.length) {
    const ref = queue.shift();
    let data;
    try { data = await getJson(`${SEFARIA}/api/texts/${encodeURIComponent(ref)}?context=0&commentary=0&pad=0`); }
    catch (error) { missing.push(ref); continue; }
    if (data.error) { missing.push(ref); continue; }
    if (data.heVersionTitle !== VERSION || data.heLicense !== 'Public Domain') throw new Error(`${ref}: unexpected version ${data.heVersionTitle} / ${data.heLicense}`);
    entries.set(data.ref, { ref: data.ref, he: data.he, next: data.next || null, prev: data.prev || null });
    for (const link of [data.next, data.prev]) if (link && !seen.has(link)) { seen.add(link); queue.push(link); }
    done += 1;
    if (done % 500 === 0) console.log(`${done} entries, ${queue.length} queued`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// Order by the dictionary's own chain.
const ordered = [];
const visited = new Set();
for (let ref = first; ref && entries.has(ref) && !visited.has(ref); ref = entries.get(ref).next) { visited.add(ref); ordered.push(entries.get(ref)); }
const orphans = [...entries.values()].filter(entry => !visited.has(entry.ref)).sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
if (orphans.length) console.warn(`${orphans.length} entries outside the chain (kept, after the chain)`);

mkdirSync(OUT, { recursive: true });
const lines = [...ordered, ...orphans].map(entry => JSON.stringify({ ref: entry.ref, he: entry.he })).join('\n') + '\n';
// Stored gzip-compressed; its hash (fetch.json, the registry) is of the uncompressed text, never of gzip bytes.
writeFileSync(join(OUT, 'entries.jsonl.gz'), gzipSync(lines, { level: 9 }));
const meta = {
  index: INDEX, heIndex: 'מילון שימושי לתלמוד', versionTitle: VERSION, license: version.license,
  versionSource: version.versionSource, digitizedBySefaria: version.digitizedBySefaria === true,
  retrievedAt: new Date().toISOString().slice(0, 10), entries: ordered.length + orphans.length,
  inChain: ordered.length, orphans: orphans.length, unreachable: missing.sort(),
  sha256: createHash('sha256').update(lines).digest('hex'),
};
writeFileSync(join(OUT, 'fetch.json'), JSON.stringify(meta, null, 1) + '\n');
console.log(JSON.stringify({ ...meta, unreachable: meta.unreachable.length }));
