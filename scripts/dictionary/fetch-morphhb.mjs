// Fetches the Open Scriptures Hebrew Bible (OSHB, github.com/openscriptures/morphhb) at a pinned commit and stores,
// for every word of the Westminster Leningrad Codex, its reference, surface (with its segmentation slashes), lemma
// (augmented Strong's number) and morphology code, as sources/morphhb/raw/words.tsv.gz.
// Run (network, once): node scripts/dictionary/fetch-morphhb.mjs
// Licence: lemma and morphology data CC BY 4.0 ("credit the Open Scriptures Hebrew Bible Project"); the WLC text is
// public domain (README of the pinned commit, re-read at fetch time and checked).
// Used at build time only: the proper-noun tags (morph Np) name the people and places of the Torah, so Onkelos's names
// are not counted as unknown Aramaic words; the Aramaic chapters (morph codes A…) give the segmentation, stem and
// lemma grouping of every Biblical Aramaic word. Nothing of it is shown in the app.
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT = join(ROOT, 'sources/morphhb/raw');
export const MORPHHB_COMMIT = '3d15126fb1ef74867fc1434be1942e837932691f';
const BASE = `https://raw.githubusercontent.com/openscriptures/morphhb/${MORPHHB_COMMIT}`;
const BOOKS = ['Gen', 'Exod', 'Lev', 'Num', 'Deut', 'Josh', 'Judg', 'Ruth', '1Sam', '2Sam', '1Kgs', '2Kgs', '1Chr', '2Chr', 'Ezra', 'Neh', 'Esth', 'Job', 'Ps', 'Prov', 'Eccl', 'Song', 'Isa', 'Jer', 'Lam', 'Ezek', 'Dan', 'Hos', 'Joel', 'Amos', 'Obad', 'Jonah', 'Mic', 'Nah', 'Hab', 'Zeph', 'Hag', 'Zech', 'Mal'];
const get = async url => { const response = await fetch(url, { headers: { 'User-Agent': 'kazzohar-dictionary-import/1.0' } }); if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`); return response.text(); };

const readme = await get(`${BASE}/README.md`);
if (!/Creative Commons Attribution 4\.0 International/.test(readme) || !/WLC remains in the\s+\[Public Domain\]/.test(readme)) throw new Error('licence statement changed');
const rows = [];
for (const book of BOOKS) {
  const xml = await get(`${BASE}/wlc/${book}.xml`);
  for (const verse of xml.matchAll(/<verse osisID="([^"]+)">([\s\S]*?)<\/verse>/g)) {
    for (const w of verse[2].matchAll(/<w ([^>]*)>([^<]*)<\/w>/g)) {
      const attrs = Object.fromEntries([...w[1].matchAll(/(\w+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
      rows.push([verse[1], w[2], attrs.lemma || '', attrs.morph || ''].join('\t'));
    }
  }
  console.log(book, rows.length);
}
mkdirSync(OUT, { recursive: true });
const text = rows.join('\n') + '\n';
writeFileSync(join(OUT, 'words.tsv.gz'), gzipSync(text, { level: 9 }));
const meta = { source: 'Open Scriptures Hebrew Bible (morphhb)', url: 'https://github.com/openscriptures/morphhb', commit: MORPHHB_COMMIT, licence: 'CC BY 4.0 (lemma and morphology); WLC text public domain', attribution: 'Open Scriptures Hebrew Bible Project', retrievedAt: new Date().toISOString().slice(0, 10), words: rows.length, sha256: createHash('sha256').update(text).digest('hex') };
writeFileSync(join(OUT, 'fetch.json'), JSON.stringify(meta, null, 1) + '\n');
console.log(JSON.stringify(meta));
