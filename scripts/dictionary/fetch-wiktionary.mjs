// Fetches the Hebrew Wiktionary pages the word lookup may draw on — only the Jewish-studies categories: Aramaic words
// ("ערכים בשפה הארמית") and the abbreviations of the Jewish bookshelf, sages, blessings, Judaism, Kabbalah and Aramaic —
// and stores their wikitext pinned by revision id in sources/hebrew-wiktionary/raw/pages.jsonl.gz.
// Run (network, once): node scripts/dictionary/fetch-wiktionary.mjs
// The site licence is re-read live (siteinfo rightsinfo) and must be CC BY-SA; the build reads this file only.
// Polite: one request at a time, 50 titles per request, a pause between requests, maxlag honoured; a fixed
// User-Agent naming the project (no personal data).
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT = join(ROOT, 'sources/hebrew-wiktionary/raw');
const API = 'https://he.wiktionary.org/w/api.php';
const UA = 'KazzoharDictionaryImport/1.0 (https://github.com/nzm1000-sudo/kazzohar-harakia)';
export const WIKTIONARY_CATEGORIES = Object.freeze([
  'קטגוריה:ערכים בשפה הארמית',
  'קטגוריה:ראשי תיבות בארמית',
  'קטגוריה:ראשי תיבות בארון הספרים היהודי',
  'קטגוריה:ראשי תיבות - אישים',
  'קטגוריה:ראשי תיבות של ברכות',
  'קטגוריה:ראשי תיבות ביהדות',
  'קטגוריה:ראשי תיבות בתורת הקבלה',
]);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params })}`;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    await sleep(1500);
    try {
      const response = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      const text = await response.text();
      if (response.ok && text.startsWith('{')) { const data = JSON.parse(text); if (!data.error) return data; if (data.error.code !== 'maxlag') throw new Error(data.error.info); }
    } catch (error) { if (attempt === 8) throw error; }
    await sleep(5000 * attempt);
  }
  throw new Error(`unreachable: ${url}`);
}

const rights = (await api({ action: 'query', meta: 'siteinfo', siprop: 'rightsinfo' })).query.rightsinfo;
if (!/CC BY-SA|Creative Commons Attribution-Share ?Alike/i.test(`${rights.text} ${rights.url}`)) throw new Error(`site licence changed: ${JSON.stringify(rights)}`);

const members = new Map(); // title → Set(categories)
for (const category of WIKTIONARY_CATEGORIES) {
  let cont = {};
  do {
    const data = await api({ action: 'query', list: 'categorymembers', cmtitle: category, cmnamespace: '0', cmlimit: '500', ...cont });
    for (const item of data.query.categorymembers) { if (!members.has(item.title)) members.set(item.title, new Set()); members.get(item.title).add(category); }
    cont = data.continue || null;
  } while (cont);
}
const titles = [...members.keys()].sort();
const pages = [];
for (let i = 0; i < titles.length; i += 50) {
  const batch = titles.slice(i, i + 50);
  const data = await api({ action: 'query', prop: 'revisions', rvprop: 'ids|content', rvslots: 'main', titles: batch.join('|') });
  for (const page of data.query.pages) {
    if (page.missing || !page.revisions?.length) continue;
    const rev = page.revisions[0];
    pages.push({ title: page.title, pageid: page.pageid, revid: rev.revid, categories: [...members.get(page.title)].sort(), wikitext: rev.slots.main.content });
  }
  console.log(`${Math.min(i + 50, titles.length)} / ${titles.length}`);
}
pages.sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
mkdirSync(OUT, { recursive: true });
const lines = pages.map(page => JSON.stringify(page)).join('\n') + '\n';
// Stored gzip-compressed; its hash (fetch.json, the registry) is of the uncompressed text, never of gzip bytes.
writeFileSync(join(OUT, 'pages.jsonl.gz'), gzipSync(lines, { level: 9 }));
const meta = { site: 'he.wiktionary.org', rights, categories: WIKTIONARY_CATEGORIES, retrievedAt: new Date().toISOString().slice(0, 10), pages: pages.length, sha256: createHash('sha256').update(lines).digest('hex') };
writeFileSync(join(OUT, 'fetch.json'), JSON.stringify(meta, null, 1) + '\n');
console.log(JSON.stringify({ ...meta, categories: meta.categories.length }));
