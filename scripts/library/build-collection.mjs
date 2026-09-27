// The expansion collection: Sefaria works (one explicit, freely licensed Hebrew edition each) → validated packs.
// Run: node scripts/library/build-collection.mjs [--cache /tmp/kz-library-cache/collection] [--offline] [--retrieved-at YYYY-MM-DD]
// Structure comes from Sefaria's index (section names, part titles) and shape (exact counts) — independent of the
// text. A work is published only if its text validates against that structure: FULL, or PARTIAL with ≥97% of units
// present and the gaps listed. Anything duplicated, unexpected or out of order is left out and reported, never fixed.
// Existing packs (Tanakh, Mishnah, Rambam, Shulchan Arukh) are built by build-library.mjs and are not touched here.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checksum } from '../../src/services/prayer/checksum.mjs';
import { COVERAGE, summarizeReports, validateWorkChunk } from '../../src/services/library/integrity.mjs';
import { hebrewNumeral } from '../../src/services/hebrewNumerals.mjs';
import { COLLECTION_PLAN } from './collection-plan.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const CACHE = arg('--cache', '/tmp/kz-library-cache/collection');
const OFFLINE = args.includes('--offline');
const RETRIEVED_AT = arg('--retrieved-at', new Date().toISOString().slice(0, 10));
const PACKS_DIR = join(ROOT, 'public/library/packs');
const DATA_DIR = join(ROOT, 'src/data/library');
const MIN_PARTIAL_COVERAGE = 0.97;
mkdirSync(CACHE, { recursive: true });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function cachedJson(name, url) {
  const file = join(CACHE, `${name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 200)}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  if (OFFLINE) throw new Error(`offline and not cached: ${url}`);
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (response.ok) {
        const data = await response.json();
        writeFileSync(file, JSON.stringify(data));
        await sleep(120);
        return data;
      }
      if (response.status < 500 && response.status !== 429) { writeFileSync(file, JSON.stringify({ error: response.status })); return { error: response.status }; }
    } catch (error) {
      if (attempt === 5) throw error;
    }
    await sleep(800 * attempt);
  }
  throw new Error(`${url}: unreachable`);
}

// Redistributable editions only. Free licenses first; non-commercial (CC-BY-NC / -SA) only where no free edition
// carries the work — approved by the user (2026-09-27) for this non-commercial app, and recorded on each book.
const FREE_LICENSE = { 'public domain': 'public-domain', pd: 'public-domain', cc0: 'public-domain', 'cc-by': 'cc-by', 'cc-by-sa': 'cc-by-sa', 'cc-by-nc': 'cc-by-nc', 'cc-by-nc-sa': 'cc-by-nc-sa' };
const licenseOf = value => { const text = String(value || '').trim().toLowerCase().replace(/\s+\d(\.\d)*$/, '').replace(/^cc by/, 'cc-by'); return FREE_LICENSE[text] || null; };
const NON_COMMERCIAL = new Set(['cc-by-nc', 'cc-by-nc-sa']);

// Canonical ids: letters and underscores only (the unit-id grammar), unique across the whole library.
const workIdFor = title => {
  const id = title.replace(/['’"]/g, '').replace(/[^A-Za-z]+/g, '_').replace(/^_+|_+$/g, '');
  return id.charAt(0).toUpperCase() + id.slice(1);
};

const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", thinsp: ' ', ndash: '–', mdash: '—' };
// Plain reading text: footnote markers and footnotes out, tags out, entities decoded, whitespace collapsed.
// A literal angle bracket left in the prose becomes ‹ › (the pack grammar reserves < > for markup) and is counted.
export function cleanText(value, stats = {}) {
  let text = String(value ?? '')
    .replace(/<sup[^>]*class="footnote-marker"[^>]*>[\s\S]*?<\/sup>/gi, '')
    .replace(/<i[^>]*class="footnote"[^>]*>[\s\S]*?<\/i>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => code[0] === '#' ? String.fromCodePoint(code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1))) : ENTITIES[code.toLowerCase()] ?? match);
  if (/[<>]/.test(text)) { stats.brackets = (stats.brackets || 0) + 1; text = text.replace(/</g, '‹').replace(/>/g, '›'); }
  return text.replace(/\s+/g, ' ').trim();
}

// Sefaria names a work's levels in English only (sectionNames); these are their Hebrew names in print.
const SECTION_HE = { chapter: 'פרק', paragraph: 'פסקה', pararaph: 'פסקה', comment: 'קטע', siman: 'סימן', section: 'חלק', word: 'ערך', teshuva: 'תשובה', teshuvah: 'תשובה', mishnah: 'משנה', halakhah: 'הלכה', nahar: 'נהר', parasha: 'פרשה', daf: 'דף', verse: 'פסוק', klal: 'כלל', shaar: 'שער', gate: 'שער', principle: 'עיקר', letter: 'אות', ot: 'אות', inyan: 'ענין', midrash: 'מדרש', seif: 'סעיף', 'seif katan': 'סעיף קטן', mitzvah: 'מצוה', 'positive mitzvah': 'מצות עשה', 'negative mitzvah': 'מצות לא תעשה', essay: 'מאמר', statement: 'פסקה', psalm: 'מזמור', treatise: 'מאמר', shoresh: 'שורש', question: 'שאלה', story: 'מעשה', sheilta: 'שאילתא', segment: 'פסקה', volume: 'כרך', part: 'חלק' };
const hebrewSectionNames = node => (node.heSectionNames?.length ? node.heSectionNames : (node.sectionNames || []).map(name => SECTION_HE[String(name).toLowerCase()] || null));

// Leaves in reading order, each with its Hebrew title and section names from the index and its exact counts from
// Sefaria's shape of that very part (the book-level shape leaves out small parts such as introductions).
async function leavesOf(work, index) {
  const schemaLeaves = [];
  const en = node => node.sharedTitle || node.titles?.find(t => t.lang === 'en' && t.primary)?.text || node.title || node.key;
  const he = node => node.titles?.find(t => t.lang === 'he' && t.primary)?.text || node.heTitle || '';
  const walk = (node, enPath, hePath) => {
    const isRoot = node === index.schema;
    if (node.nodes) return node.nodes.forEach(child => walk(child, isRoot ? [] : [...enPath, en(node)], isRoot ? [] : [...hePath, he(node)]));
    schemaLeaves.push({
      ref: isRoot ? work.title : [work.title, ...enPath, ...(node.default ? [] : [en(node)])].join(', '),
      path: isRoot ? [] : [...hePath, ...(node.default ? [] : [he(node)])].filter(Boolean),
      depth: node.depth,
      heSectionNames: hebrewSectionNames(node),
    });
  };
  walk(index.schema, [], []);
  const leaves = [];
  for (const leaf of schemaLeaves) {
    // Three levels (the Jerusalem Talmud: chapter → halakhah → passage): each chapter becomes a part of its own, its
    // halakhot the numbered nodes — read chapter by chapter, exactly as the two-level books are.
    if (leaf.depth === 3) {
      const shape3 = await cachedJson(`shape-${leaf.ref}`, `https://www.sefaria.org/api/shape/${encodeURIComponent(leaf.ref)}`);
      const chapters = Array.isArray(shape3) ? shape3[0]?.chapters : null;
      if (!Array.isArray(chapters) || !chapters.every(list => Array.isArray(list) && list.every(Number.isInteger))) throw new Error(`no structure for ${leaf.ref}`);
      const names = leaf.heSectionNames.slice(1);
      chapters.forEach((counts, c) => leaves.push({ ref: `${leaf.ref} ${c + 1}`, label: `${leaf.heSectionNames[0] || 'פרק'} ${hebrewNumeral(c + 1)}`, depth: 2, counts, heSectionNames: names }));
      continue;
    }
    if (leaf.depth > 3) throw new Error(`depth ${leaf.depth} at ${leaf.ref}`);
    const shape = await cachedJson(`shape-${leaf.ref}`, `https://www.sefaria.org/api/shape/${encodeURIComponent(leaf.ref)}`);
    const root = Array.isArray(shape) ? shape[0] : null;
    if (!root || root.isComplex) throw new Error(`no structure for ${leaf.ref}`);
    const depth = Array.isArray(root.chapters) ? 2 : 1;
    if (depth !== leaf.depth) throw new Error(`depth mismatch at ${leaf.ref}: index ${leaf.depth}, shape ${depth}`);
    if (depth === 2 && !root.chapters.every(Number.isInteger)) throw new Error(`non-integer structure at ${leaf.ref}`);
    // The part's Hebrew name as Sefaria prints it ("קדושת לוי, בראשית, נח"): shared-title parts carry no name of their own.
    const book = root.heBook || work.he;
    const printed = String(root.heTitle || '');
    const label = printed && printed !== book ? printed.replace(new RegExp(`^${book.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},\\s*`), '').split(/,\s*/).join(' · ') : leaf.path.join(' · ');
    leaves.push({ ref: leaf.ref, label, depth, counts: depth === 2 ? root.chapters : [Number(root.chapters) || 0], heSectionNames: leaf.heSectionNames });
  }
  return leaves;
}

async function leafText(ref, versionTitle) {
  const url = `https://www.sefaria.org/api/v3/texts/${encodeURIComponent(ref)}?version=${encodeURIComponent(`hebrew|${versionTitle}`)}&fill_in_missing_segments=0&return_format=text_only`;
  const data = await cachedJson(`v3-${ref}-${versionTitle}`, url);
  const version = data?.versions?.[0];
  if (!version || data.versions.length !== 1 || version.versionTitle !== versionTitle) return null;
  return version;
}

// One edition for the whole work: every leaf from the same named version, nothing filled in from another.
const LICENSE_RANK = { 'public-domain': 0, 'cc-by': 1, 'cc-by-sa': 2, 'cc-by-nc': 3, 'cc-by-nc-sa': 4 };
async function buildWith(work, workId, leaves, picks) {
  const nodes = [];
  const expected = [];
  const nodeTitles = [];
  const sections = [];
  const stats = {};
  let license = null;
  let versionSource = null;
  let n = 0;
  for (const [leafIndex, leaf] of leaves.entries()) {
    const version = picks[leafIndex] ? await leafText(leaf.ref, picks[leafIndex]) : null;
    if (version) {
      const id = licenseOf(version.license);
      if (!id) return { error: `license ${version.license} on ${leaf.ref}` };
      if (!license || LICENSE_RANK[id] > LICENSE_RANK[license]) license = id;
      versionSource ||= version.versionSource || null;
    }
    const text = version?.text;
    const from = n + 1;
    const chapters = leaf.depth === 2 ? leaf.counts : [leaf.counts[0]];
    chapters.forEach((count, c) => {
      n += 1;
      const raw = leaf.depth === 2 ? (Array.isArray(text) ? text[c] : null) : text;
      const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
      const units = list.map((value, u) => ({ id: `${workId}.${n}.${u + 1}`, n: u + 1, text: typeof value === 'string' ? cleanText(value, stats) : '' })).filter(unit => unit.text);
      nodes.push({ id: `${workId}.${n}`, n, units });
      expected.push({ n, units: count });
      const nodeName = leaf.heSectionNames[0] || 'פרק';
      nodeTitles.push(leaf.depth === 2 ? `${leaf.label ? `${leaf.label} · ` : ''}${nodeName} ${hebrewNumeral(c + 1)}` : leaf.label || work.he);
    });
    if (leaves.length > 1) sections.push({ title: leaf.label || work.he, from, to: n, ...(new Set(picks).size > 1 ? { edition: picks[leafIndex] || null } : {}) });
  }
  if (!license) return { error: 'edition not found' };
  const chunk = { workId, editionId: null, packId: null, nodes: nodes.filter(node => node.units.length) };
  const report = validateWorkChunk(chunk, expected);
  return { chunk, expected, report, license, versionSource, nodeTitles, sections, stats };
}

async function buildWork(work) {
  const workId = workIdFor(work.title);
  const index = await cachedJson(`idx-${work.title}`, `https://www.sefaria.org/api/v2/raw/index/${encodeURIComponent(work.title)}`);
  const versions = await cachedJson(`versions-${work.title}`, `https://www.sefaria.org/api/texts/versions/${encodeURIComponent(work.title)}`);
  if (!index?.schema) return { skip: 'index unavailable' };
  let leaves;
  try { leaves = await leavesOf(work, index); } catch (error) { return { skip: error.message }; }
  const usable = (Array.isArray(versions) ? versions : []).filter(v => v.language === 'he' && licenseOf(v.license));
  const candidates = [...usable.filter(v => !NON_COMMERCIAL.has(licenseOf(v.license))), ...usable.filter(v => NON_COMMERCIAL.has(licenseOf(v.license)))].map(v => v.versionTitle);
  if (!candidates.length) return { skip: 'no freely licensed Hebrew edition' };
  let best = null;
  const attempts = [];
  for (const versionTitle of candidates) {
    const built = await buildWith(work, workId, leaves, leaves.map(() => versionTitle));
    if (built.error) { attempts.push(`${versionTitle}: ${built.error}`); continue; }
    const r = built.report;
    const corrupt = r.duplicateIds.length || r.emptyUnits.length || r.invalidRefs.length || r.unexpectedUnits.length || r.orderErrors.length;
    if (corrupt) { attempts.push(`${versionTitle}: ${[r.duplicateIds.length && 'duplicates', r.invalidRefs.length && 'invalid ids', r.unexpectedUnits.length && `${r.unexpectedUnits.length} units beyond the structure`, r.orderErrors.length && 'order'].filter(Boolean).join(', ')}`); continue; }
    const coverage = r.expectedUnits ? r.importedUnits / r.expectedUnits : 0;
    if (!best || coverage > best.coverage) best = { ...built, versionTitle, coverage };
    if (r.status === COVERAGE.FULL) break;
  }
  // A work in separate volumes (the Tur's four parts…) may have a named edition per volume: then each part takes the
  // edition that carries it completely. Never mixed inside a part; each part's edition is recorded.
  if (leaves.length > 1 && (!best || best.coverage < MIN_PARTIAL_COVERAGE)) {
    const picks = [];
    for (const leaf of leaves) {
      let pick = null;
      let pickCount = -1;
      for (const versionTitle of candidates) {
        const version = await leafText(leaf.ref, versionTitle);
        if (!version || !licenseOf(version.license)) continue;
        const text = version.text;
        const lists = leaf.depth === 2 ? (Array.isArray(text) ? text : []) : [Array.isArray(text) ? text : [text]];
        if (lists.length > leaf.counts.length || lists.some((list, c) => (Array.isArray(list) ? list.length : 0) > (leaf.counts[c] ?? 0))) continue;
        const present = lists.reduce((total, list) => total + (Array.isArray(list) ? list.filter(value => typeof value === 'string' && cleanText(value)).length : 0), 0);
        if (present > pickCount) { pick = versionTitle; pickCount = present; }
      }
      picks.push(pick);
    }
    const built = await buildWith(work, workId, leaves, picks);
    const r = built.report;
    if (!built.error && !(r.duplicateIds.length || r.emptyUnits.length || r.invalidRefs.length || r.unexpectedUnits.length || r.orderErrors.length)) {
      const coverage = r.expectedUnits ? r.importedUnits / r.expectedUnits : 0;
      if (!best || coverage > best.coverage) best = { ...built, versionTitle: [...new Set(picks.filter(Boolean))].join(' · '), coverage };
    }
  }
  if (!best) return { skip: attempts.join(' | ') || 'no usable edition' };
  if (best.coverage < MIN_PARTIAL_COVERAGE) return { skip: `best edition "${best.versionTitle}" covers ${(best.coverage * 100).toFixed(1)}% of the structure` };
  const mainLeaf = leaves.reduce((a, b) => (b.counts.reduce((x, y) => x + y, 0) > a.counts.reduce((x, y) => x + y, 0) ? b : a));
  const nodeLabel = mainLeaf.depth === 2 ? mainLeaf.heSectionNames[0] || 'פרק' : 'חלק';
  const unitLabel = mainLeaf.heSectionNames.at(-1) || 'פסקה';
  const simple = leaves.length === 1 && leaves[0].depth === 2;
  return {
    workId,
    title: work.title,
    heTitle: work.he,
    category: work.category,
    group: work.group,
    authors: (index.authors || []).map(author => (typeof author === 'string' ? author : author.he || author.en)).filter(Boolean),
    compDate: index.compDateString?.he || null,
    license: best.license,
    editionTitle: best.versionTitle,
    versionSource: best.versionSource,
    nodeLabel,
    unitLabel,
    nodeTitles: simple ? null : best.nodeTitles,
    sections: best.sections.length > 1 ? best.sections : null,
    expected: best.expected,
    chunk: best.chunk,
    report: best.report,
    bracketsReplaced: best.stats.brackets || 0,
  };
}

function writeAtomic(target, write) {
  const staging = `${target}.staging`;
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  write(staging);
  rmSync(target, { recursive: true, force: true });
  renameSync(staging, target);
}

// ---------- Build ----------
const existingIds = new Set((await import('../../src/data/library/packIndex.mjs')).default.flatMap(pack => pack.works.map(work => work.workId)));
const built = [];
const skipped = [];
let cursor = 0;
async function worker() {
  while (cursor < COLLECTION_PLAN.length) {
    const work = COLLECTION_PLAN[cursor++];
    try {
      const result = await buildWork(work);
      if (result.skip) skipped.push({ title: work.title, he: work.he, reason: result.skip });
      else built.push(result);
    } catch (error) {
      skipped.push({ title: work.title, he: work.he, reason: error.message });
    }
    process.stdout.write(`\r${built.length + skipped.length}/${COLLECTION_PLAN.length} (${skipped.length} skipped)   `);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
process.stdout.write('\n');
const ids = new Set();
for (const work of built) {
  if (existingIds.has(work.workId) || ids.has(work.workId)) throw new Error(`work id collision: ${work.workId}`);
  ids.add(work.workId);
}
const order = new Map(COLLECTION_PLAN.map((work, i) => [work.title, i]));
built.sort((a, b) => order.get(a.title) - order.get(b.title));

// One pack per category and license, so a pack's license is always exact.
const packs = new Map();
for (const work of built) {
  const packId = `sefaria-collection-${work.category}-${work.license}`;
  if (!packs.has(packId)) packs.set(packId, { packId, category: work.category, license: work.license, works: [] });
  packs.get(packId).works.push(work);
}
const collectionIndex = [];
for (const pack of packs.values()) {
  const files = [];
  writeAtomic(join(PACKS_DIR, pack.packId), staging => {
    for (const work of pack.works) {
      const chunk = { ...work.chunk, editionId: `${pack.packId}:${work.workId}`, packId: pack.packId };
      const body = JSON.stringify(chunk);
      // Stored gzip-compressed (about a quarter of the size); the checksum is of the JSON text inside.
      const packed = gzipSync(Buffer.from(body), { level: 9 });
      writeFileSync(join(staging, `${work.workId}.json.gz`), packed);
      const sum = checksum(body);
      Object.assign(work, { file: `${work.workId}.json.gz`, bytes: packed.length, rawBytes: Buffer.byteLength(body), checksum: sum, packId: pack.packId });
      files.push({ workId: work.workId, file: work.file, bytes: work.bytes, rawBytes: work.rawBytes, checksum: sum });
    }
    writeFileSync(join(staging, 'manifest.json'), JSON.stringify({
      packId: pack.packId, contentVersion: `Sefaria, one named edition per work (retrieved ${RETRIEVED_AT})`, family: 'collection', category: pack.category,
      structure: ['node', 'unit'], nodeLabel: 'פרק', unitLabel: 'פסקה', policy: 'source', source: 'sefaria', license: pack.license,
      edition: { title: 'Sefaria — per-work edition', heTitle: 'ספריא · מהדורה לכל ספר', editor: 'לפי ספר', notes: 'לכל ספר מהדורה עברית אחת בשמה, ללא השלמת קטעים ממהדורות אחרות. המבנה נבדק מול מפתח ומבנה ספריא.' },
      sourceUrl: 'https://www.sefaria.org/texts', retrievedAt: RETRIEVED_AT, files,
    }, null, 1));
  });
  collectionIndex.push({
    packId: pack.packId, contentVersion: `Sefaria, one named edition per work (retrieved ${RETRIEVED_AT})`, family: 'collection', category: pack.category,
    structure: ['node', 'unit'], nodeLabel: 'פרק', unitLabel: 'פסקה', policy: 'source', source: 'sefaria', license: pack.license,
    edition: { title: 'Sefaria — per-work edition', heTitle: 'ספריא · מהדורה לכל ספר', editor: 'לפי ספר', notes: 'לכל ספר מהדורה עברית אחת בשמה, ללא השלמת קטעים ממהדורות אחרות.' },
    sourceUrl: 'https://www.sefaria.org/texts', retrievedAt: RETRIEVED_AT,
    bytes: pack.works.reduce((total, work) => total + work.bytes, 0),
    works: pack.works.map(work => ({
      workId: work.workId, title: work.title, heTitle: work.heTitle, group: work.group, aliases: [], authors: work.authors, compDate: work.compDate,
      editionTitle: work.editionTitle, versionSource: work.versionSource, license: work.license, nodeLabel: work.nodeLabel, unitLabel: work.unitLabel,
      nodeTitles: work.nodeTitles, sections: work.sections, status: work.report.status, missingUnits: work.report.missingUnits,
      file: work.file, bytes: work.bytes, rawBytes: work.rawBytes, checksum: work.checksum,
      nodes: work.expected.map(({ n }) => work.chunk.nodes.find(node => node.n === n)?.units.length || 0),
      expected: work.expected.map(({ units }) => units),
    })),
  });
}
const reports = built.map(work => ({ ...work.report, sourceRef: work.title, checksum: work.checksum }));
const banner = '// Generated by scripts/library/build-collection.mjs. Do not edit by hand.\n';
writeFileSync(join(DATA_DIR, 'collectionIndex.mjs'), `${banner}export default ${JSON.stringify(collectionIndex)};\n`);
writeFileSync(join(DATA_DIR, 'collectionReports.mjs'), `${banner}export default ${JSON.stringify({
  generatedAt: RETRIEVED_AT,
  summary: summarizeReports(reports),
  reports: reports.map(({ workId, sourceRef, expectedUnits, importedUnits, status, checksum: sum, missingUnits }) => ({ workId, sourceRef, expectedUnits, importedUnits, status, checksum: sum, missing: missingUnits.length })),
  skipped,
  bracketsReplaced: built.filter(work => work.bracketsReplaced).map(work => ({ workId: work.workId, units: work.bracketsReplaced })),
}, null, 1)};\n`);
console.log(JSON.stringify({ rawBytes: built.reduce((t, w) => t + w.rawBytes, 0), built: built.length, full: built.filter(w => w.report.status === COVERAGE.FULL).length, partial: built.filter(w => w.report.status === COVERAGE.PARTIAL).length, skipped: skipped.length, bytes: collectionIndex.reduce((t, p) => t + p.bytes, 0), packs: collectionIndex.map(p => `${p.packId}:${p.works.length}`) }, null, 1));
