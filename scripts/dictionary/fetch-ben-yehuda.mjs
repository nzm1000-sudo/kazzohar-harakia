// Fetches "ספר ראשי תיבות" (Project Ben-Yehuda work 37578) from the Project Ben-Yehuda public-domain dump
// (github.com/projectbenyehuda/public_domain_dump) at a pinned commit, with the dump's licence statement and its
// catalogue row re-read and checked, and stores the text as sources/ben-yehuda/raw/abbreviations.txt.gz.
// Run (network, once): node scripts/dictionary/fetch-ben-yehuda.mjs
// The work: an alphabetical dictionary of about 14,000 Hebrew and Aramaic abbreviations (ראשי תיבות) of the Talmud,
// the Midrash and the rabbinic literature, published Sighet 1926 under the name of Avraham Yitzhak Stern; Project
// Ben-Yehuda identifies it as the work of Meir Halperin (1850–1923), הנוטריקון, הסימנים והכינויים (Vilna 1912).
// Rights: the dump's LICENSE ("Public domain … free to make any use of them"); the author identified by the provider
// died 1923 (life + 70 ended 1993); published 1926 (US: 95 years ended 2021). Build time only: its readings become
// abbreviation expansions through the fusion rules of scripts/dictionary/aramaic/abbreviations.mjs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT = join(ROOT, 'sources/ben-yehuda/raw');
export const BEN_YEHUDA_COMMIT = '5e4277fead7b565f32cc4b352abd3565023a77d8';
const BASE = `https://raw.githubusercontent.com/projectbenyehuda/public_domain_dump/${BEN_YEHUDA_COMMIT}`;
const get = async url => { const response = await fetch(url, { headers: { 'User-Agent': 'kazzohar-build/1.0' } }); if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`); return response.text(); };

const licence = await get(`${BASE}/LICENSE`);
if (!/^Public domain/m.test(licence) || !/free to make any use of them/.test(licence)) throw new Error('licence statement changed');
const catalogue = await get(`${BASE}/pseudocatalogue.csv`);
const row = catalogue.split('\n').find(line => line.startsWith('37578,'));
if (!row || !row.includes('/p1950/m37578') || !row.includes('ספר ראשי תיבות')) throw new Error('catalogue row changed');
const text = await get(`${BASE}/txt/p1950/m37578.txt`);
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'abbreviations.txt.gz'), gzipSync(text, { level: 9 }));
const meta = {
  source: 'Project Ben-Yehuda public-domain dump', url: 'https://github.com/projectbenyehuda/public_domain_dump', commit: BEN_YEHUDA_COMMIT,
  work: { id: 37578, path: 'txt/p1950/m37578.txt', title: 'ספר ראשי תיבות', catalogue: row.trim(), read: 'https://benyehuda.org/read/37578' },
  licence: 'Public domain (dump LICENSE)', credit: 'Project Ben-Yehuda volunteers', retrievedAt: new Date().toISOString().slice(0, 10),
  bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex'),
};
writeFileSync(join(OUT, 'fetch.json'), JSON.stringify(meta, null, 1) + '\n');
console.log(meta);
