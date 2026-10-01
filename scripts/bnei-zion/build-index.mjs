// Stage 7 — the runtime data (docs/bnei-zion/SCHEMA.md). Only articles that passed the quality gate ship.
//   src/data/torahContent/index.mjs           compact index (lazy chunk): metadata, short excerpts, lookup maps, pack table
//   public/torah-content/search.json.gz       prebuilt normalised search fields { id, t, m, x } (x = distinct words),
//                                             loaded lazily on the first search; checksum in the manifest and the index
//   public/torah-content/packs/<pack>.json.gz + manifest.json   article bodies by parasha / festival / general
// gzip bytes are kept when the content is unchanged (Node 20 and 26 zlib differ), so rebuilding never churns files.
// Usage: node scripts/bnei-zion/build-index.mjs [--out <dir>]   (default: the repository)
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { normalizeHebrew } from '../../src/content.mjs';
import { checksum } from '../../src/services/prayer/checksum.mjs';
import { HOLIDAYS, SPECIAL_SHABBATOT } from '../../src/services/torahTaxonomy.mjs';
import { cleanTitle, cutPhrase } from './classify.mjs';
import { AUTHOR, COLLECTION, GENERATED_HEADER, PARASHA_SLUGS, PARASHOT, RIGHTS, ROOT, paths, readJson, sha1, stripPoints } from './lib.mjs';

function compress(raw, path) {
  if (path && existsSync(path)) {
    const disk = readFileSync(path);
    try { if (gunzipSync(disk).equals(Buffer.from(raw))) return disk; } catch { /* not a valid gzip: rebuild it */ }
  }
  return gzipSync(raw, { level: 9 });
}
const writeIfChanged = (file, text) => { if (!existsSync(file) || readFileSync(file, 'utf8') !== text) writeFileSync(file, text); };

const HOLIDAY_ORDER = HOLIDAYS.map(h => h.id);
const holidayLabel = id => HOLIDAYS.find(h => h.id === id)?.he || '';
const specialLabel = id => SPECIAL_SHABBATOT.find(h => h.id === id)?.he || '';
const CONTENT_LABEL = { 'dvar-torah': 'דבר תורה', story: 'סיפור', mashal: 'משל', chizuk: 'חיזוק', commentary: 'פירוש', family: 'לשולחן המשפחה', general: 'כללי' };

export function packOf(a) {
  if (a.holidays.length) return a.holidays.includes('seventh-pesach') && !a.holidays.some(h => h !== 'seventh-pesach' && h !== 'pesach') ? 'pesach' : [...a.holidays].sort((x, y) => HOLIDAY_ORDER.indexOf(x) - HOLIDAY_ORDER.indexOf(y))[0];
  if (a.parashot.length) return PARASHA_SLUGS[a.parashot[0]];
  if (a.specialShabbatot.length) return 'special-shabbatot';
  return 'general';
}
// The card excerpt: the opening words, unpointed (the body keeps every point), cut at a word.
const excerptOf = paragraphs => {
  const first = stripPoints(paragraphs.join(' ')).replace(/\s+/g, ' ').trim();
  if (first.length <= 100) return first;
  const cut = first.slice(0, 100);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 70))}…`;
};
const scopeOf = a => a.parashot[0] || a.holidays[0] || a.specialShabbatot[0] || 'general';
// Two pieces of one parasha/festival should not share a short title: take more of the heading's own words.
function distinctTitles(list) {
  const groups = new Map();
  for (const a of list) { const k = `${scopeOf(a)}|${a.title}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(a); }
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    for (const a of g) {
      const h = cleanTitle(stripPoints(a.heading || '').replace(/^["״“]/, ''));
      const longer = cutPhrase(h, 6);
      if (longer && longer !== a.title && longer.split(' ').length <= 6) a.title = longer;
    }
    // Pieces on the very same verse keep the verse's words (the year and type tell them apart in the list).
  }
}
const sortKey = a => {
  const p = a.parashot.length ? PARASHOT.indexOf(a.parashot[0]) : 100 + (a.holidays.length ? HOLIDAY_ORDER.indexOf(a.holidays[0]) : 99);
  return `${String(p).padStart(3, '0')}|${(a.firstYear || 'תת').replace(/[״"]/g, '')}|${a.id}`;
};

export function buildIndex({ pilotOnly = false, outRoot = ROOT } = {}) {
  const P = paths();
  const { articles } = readJson(P.stage('validate'));
  const published = articles.filter(a => a.status === 'published').map(a => ({ ...a, id: `bz-${a.fingerprint.slice(0, 10)}` }));
  const ids = new Set();
  for (const a of published) { if (ids.has(a.id)) throw new Error(`id collision ${a.id}`); ids.add(a.id); }
  published.sort((x, y) => sortKey(x).localeCompare(sortKey(y), 'he'));
  distinctTitles(published);
  const packs = {};
  const index = { version: '', generatedFrom: 'בני ציון — משה מזרחי (authorized archive)', pilot: pilotOnly, collection: COLLECTION, author: AUTHOR, credit: 'מתוך "בני ציון" · משה מזרחי · מובא באישור בעל הזכויות', articles: [], parashot: {}, holidays: {}, specialShabbatot: {}, topics: {}, packs: {} };
  const docs = [];
  for (const a of published) {
    const pack = packOf(a);
    const entry = {
      id: a.id, title: a.title, ...(a.heading && stripPoints(a.heading).trim() !== a.title ? { heading: a.heading } : {}), contentType: a.contentType, length: a.length, parashot: a.parashot, holidays: a.holidays, specialShabbatot: a.specialShabbatot,
      topics: a.topics, readMinutes: a.readMinutes, ...(a.firstYear ? { year: a.firstYear } : {}), ...(a.shabbatTable ? { shabbatTable: true } : {}),
      pack, excerpt: excerptOf(a.paragraphs),
    };
    index.articles.push(entry);
    // Counts only (the engine builds its own id lists from the entries): the index stays small.
    for (const p of a.parashot) index.parashot[p] = (index.parashot[p] || 0) + 1;
    for (const h of a.holidays) index.holidays[h] = (index.holidays[h] || 0) + 1;
    for (const s of a.specialShabbatot) index.specialShabbatot[s] = (index.specialShabbatot[s] || 0) + 1;
    for (const t of a.topics) index.topics[t] = (index.topics[t] || 0) + 1;
    (packs[pack] ||= { generated: GENERATED_HEADER, articles: {} }).articles[a.id] = {
      heading: a.heading,
      paragraphs: a.paragraphs,
      source: { collection: COLLECTION, author: AUTHOR, originalPdf: a.originalPdf, pageStart: a.pageStart, pageEnd: a.pageEnd, ...(a.hebrewYear ? { year: a.hebrewYear } : {}) },
      sourceAppearances: a.sourceAppearances.map(s => ({ originalPdf: s.originalPdf, pageStart: s.pageStart, pageEnd: s.pageEnd, ...(s.hebrewYear ? { year: s.hebrewYear } : {}), ...(s.issueDate ? { date: s.issueDate } : {}) })),
      rights: RIGHTS,
      extraction: { method: a.method === 'ocr-heb' ? 'ocr-heb' : 'text-layer (legacy Hebrew font decoded)', confidence: a.confidence },
      status: 'published',
    };
    const meta = [...a.parashot.flatMap(p => [p, `פרשת ${p}`]), ...a.holidays.map(holidayLabel), ...a.specialShabbatot.map(specialLabel), ...a.topics, CONTENT_LABEL[a.contentType] || '', COLLECTION, AUTHOR, a.firstYear || ''].join(' ');
    const words = [...new Set(normalizeHebrew(stripPoints(a.paragraphs.join(' '))).split(' ').filter(w => w.length > 1))];
    docs.push({ id: a.id, t: normalizeHebrew(stripPoints(`${a.title} ${a.heading || ''}`)), m: normalizeHebrew(meta), x: words.join(' ') });
  }
  const packDir = join(outRoot, 'public', 'torah-content', 'packs');
  mkdirSync(packDir, { recursive: true });
  const manifest = { generated: GENERATED_HEADER, version: '', packs: {} };
  const keep = new Set(['manifest.json']);
  let packBytes = 0, packRaw = 0;
  for (const name of Object.keys(packs).sort()) {
    const text = JSON.stringify(packs[name]);
    const file = `${name}.json.gz`;
    const gz = compress(text, join(packDir, file));
    if (!existsSync(join(packDir, file)) || !readFileSync(join(packDir, file)).equals(gz)) writeFileSync(join(packDir, file), gz);
    keep.add(file);
    const info = { file, checksum: checksum(text), sha256: createHash('sha256').update(gz).digest('hex'), bytes: gz.length, raw: Buffer.byteLength(text), articles: Object.keys(packs[name].articles).length };
    manifest.packs[name] = info;
    index.packs[name] = { file, checksum: info.checksum, articles: info.articles };
    packBytes += gz.length; packRaw += info.raw;
  }
  for (const f of readdirSync(packDir)) if (!keep.has(f)) rmSync(join(packDir, f));
  const version = sha1(JSON.stringify(Object.values(manifest.packs).map(p => p.checksum)) + JSON.stringify(index.articles)).slice(0, 12);
  index.version = version; manifest.version = version;
  // Search fields: one gzip beside the packs, fetched on the first search.
  const contentDir = join(outRoot, 'public', 'torah-content');
  const searchText = JSON.stringify({ generated: GENERATED_HEADER, version, docs });
  const searchFile = join(contentDir, 'search.json.gz');
  const searchGz = compress(searchText, searchFile);
  if (!existsSync(searchFile) || !readFileSync(searchFile).equals(searchGz)) writeFileSync(searchFile, searchGz);
  manifest.search = { file: 'search.json.gz', path: 'torah-content/search.json.gz', checksum: checksum(searchText), sha256: createHash('sha256').update(searchGz).digest('hex'), bytes: searchGz.length, raw: Buffer.byteLength(searchText), docs: docs.length };
  index.search = { file: 'search.json.gz', path: 'torah-content/search.json.gz', checksum: manifest.search.checksum, docs: docs.length };
  writeIfChanged(join(packDir, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);
  const dataDir = join(outRoot, 'src', 'data', 'torahContent');
  mkdirSync(dataDir, { recursive: true });
  const header = `// ${GENERATED_HEADER}\n// Source: the authorized "בני ציון" archive by משה מזרחי (permission granted for this app). Pipeline: scripts/bnei-zion/.\n`;
  const indexText = `${header}export default ${JSON.stringify(index)};\n`;
  writeIfChanged(join(dataDir, 'index.mjs'), indexText);
  // The search fields used to be a module; they now ship as public/torah-content/search.json.gz.
  if (existsSync(join(dataDir, 'search.mjs'))) rmSync(join(dataDir, 'search.mjs'));
  return {
    articles: index.articles.length, packs: Object.keys(packs).length, indexBytes: Buffer.byteLength(indexText), indexGz: gzipSync(indexText, { level: 9 }).length,
    searchRaw: manifest.search.raw, searchGz: manifest.search.bytes, packBytes, packRaw, version,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const at = process.argv.indexOf('--out');
  console.log('build:', JSON.stringify(buildIndex({ pilotOnly: process.argv.includes('--pilot'), outRoot: at > 0 ? process.argv[at + 1] : ROOT })));
}
