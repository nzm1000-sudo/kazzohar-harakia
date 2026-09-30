// Fetches the Open Scriptures Hebrew Lexicon (github.com/openscriptures/HebrewLexicon) at a pinned commit — its
// AugIndex.xml (OSHB's augmented Strong numbers → lexical index ids) and LexicalIndex.xml (the lexical index, with
// its Biblical Aramaic part, xml:lang="arc") — with the README's licence re-read and checked, and stores the Aramaic
// rows only as sources/oshb-lexicon/raw/aramaic-index.tsv.gz: aug \t id \t headword (pointed) \t pos \t English def.
// Run (network, once): node scripts/dictionary/fetch-oshb-lexicon.mjs
// Licence: CC BY 4.0 ("Open Scriptures Hebrew Bible Project"); the underlying BDB and Strong texts are public domain.
// Build time only (role LEMMA_ONLY): the human-annotated lemma of every Daniel/Ezra Aramaic word (OSHB, via this
// index) confirms the engine's own analysis of that word; the English is kept as evidence and never shown or translated.
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT = join(ROOT, 'sources/oshb-lexicon/raw');
export const LEXICON_COMMIT = '21c9add13bc727d3a951361778e97e3ff7afd1ce';
const BASE = `https://raw.githubusercontent.com/openscriptures/HebrewLexicon/${LEXICON_COMMIT}`;
const get = async url => { const response = await fetch(url, { headers: { 'User-Agent': 'kazzohar-build/1.0' } }); if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`); return response.text(); };
const sha = text => createHash('sha256').update(text).digest('hex');

const readme = await get(`${BASE}/readme.md`);
if (!/Creative Commons Attribution 4\.0 International/.test(readme)) throw new Error('licence statement changed');
const aug = await get(`${BASE}/AugIndex.xml`);
const lexical = await get(`${BASE}/LexicalIndex.xml`);
const arcPart = lexical.slice(lexical.indexOf('<part xml:lang="arc">'));
const entries = new Map();
for (const m of arcPart.matchAll(/<entry id="([^"]+)">([\s\S]*?)<\/entry>/g)) {
  const w = m[2].match(/<w[^>]*>([^<]*)<\/w>/)?.[1] || '';
  const pos = m[2].match(/<pos>([^<]*)<\/pos>/)?.[1] || '';
  const def = (m[2].match(/<def>([^<]*)<\/def>/)?.[1] || '').replace(/\s+/g, ' ').trim();
  entries.set(m[1], [w, pos, def]);
}
const rows = [];
for (const m of aug.matchAll(/<w aug="([^"]+)">([^<]+)<\/w>/g)) if (entries.has(m[2])) rows.push([m[1], m[2], ...entries.get(m[2])].join('\t'));
const text = rows.join('\n') + '\n';
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'aramaic-index.tsv.gz'), gzipSync(text, { level: 9 }));
const meta = { source: 'Open Scriptures Hebrew Lexicon', url: 'https://github.com/openscriptures/HebrewLexicon', commit: LEXICON_COMMIT, licence: 'CC BY 4.0', attribution: 'Open Scriptures Hebrew Bible Project', derivation: 'AugIndex.xml rows whose lexical id is in the Aramaic part (xml:lang="arc") of LexicalIndex.xml: aug, id, headword, pos, def', inputs: { 'AugIndex.xml': sha(aug), 'LexicalIndex.xml': sha(lexical) }, rows: rows.length, retrievedAt: new Date().toISOString().slice(0, 10), sha256: sha(text) };
writeFileSync(join(OUT, 'fetch.json'), JSON.stringify(meta, null, 1) + '\n');
console.log(meta);
