// Builds the חק לישראל packs from the pinned Torat Emet export (sources/torat-emet-chok-leyisrael).
//   node scripts/chok-leyisrael/build.mjs           writes the packs, the runtime manifest and the build log
//   node scripts/chok-leyisrael/build.mjs --check   rebuilds in memory and fails if anything on disk differs
//   node scripts/chok-leyisrael/build.mjs --fetch   downloads the five files again from the pinned commit (SHA-256 checked)
// One gzipped JSON pack per parasha (54) and one for the introductions, lazy-loaded and checksum-verified by the reader.
// Deterministic: the same sources always give the same JSON; a pack whose JSON is unchanged keeps its bytes on disk, so a
// different zlib (another Node) never rewrites it.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checksum } from '../../src/services/prayer/checksum.mjs';
import { SHNAYIM_MIKRA_CANONICAL_RANGES } from '../../src/data/shnayimMikraRanges.mjs';
import { DAYS, PARTS, fixTargumJoins, lettersOf, parseVolume } from './parse.mjs';
import { numberOf } from './numbers.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = join(ROOT, 'sources/torat-emet-chok-leyisrael');
const PROVENANCE = JSON.parse(readFileSync(join(SRC, 'provenance.json'), 'utf8'));
export const PACK_ID = 'torat-emet-chok-leyisrael-cc-by-nc-sa';
const OUT = join(ROOT, 'public/library/packs', PACK_ID);
const MODULE = join(ROOT, 'src/data/chokLeYisrael/manifest.mjs');
const LOG = join(SRC, 'build-log.json');
const REFERENCE_PACK = 'shnayim-mikra-sefaria-pd';
const CHECK = process.argv.includes('--check');
const FETCH = process.argv.includes('--fetch');
const VOLUMES = [['genesis', 'Genesis', 'בראשית'], ['exodus', 'Exodus', 'שמות'], ['leviticus', 'Leviticus', 'ויקרא'], ['numbers', 'Numbers', 'במדבר'], ['deuteronomy', 'Deuteronomy', 'דברים']];
const sha256 = data => createHash('sha256').update(data).digest('hex');

// ---------- Sources ----------
async function fetchSources() {
  const { repository, commit } = PROVENANCE.source;
  const [, owner, repo] = /github\.com\/([^/]+)\/([^/]+)/.exec(repository);
  for (const file of PROVENANCE.source.files) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${commit}/${file.path.split('/').map(encodeURIComponent).join('/')}`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; source-check)' } });
    if (!response.ok) throw new Error(`${file.book}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (sha256(bytes) !== file.sha256) throw new Error(`${file.book}: SHA-256 differs from the pinned file`);
    mkdirSync(dirname(join(ROOT, file.cache)), { recursive: true });
    writeFileSync(join(ROOT, file.cache), gzipSync(bytes, { level: 9 }));
    console.log(`fetched ${file.book} (${bytes.length} bytes)`);
  }
}
function readSource(book) {
  const file = PROVENANCE.source.files.find(item => item.book === book);
  const bytes = gunzipSync(readFileSync(join(ROOT, file.cache)));
  if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) throw new Error(`${book}: the cached source is not the pinned file (run --fetch)`);
  return bytes.toString('utf8');
}

// ---------- The reference Onkelos (to split glued Targum words) ----------
function referenceOnkelos() {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'public/library/packs', REFERENCE_PACK, 'manifest.json'), 'utf8'));
  const verses = new Map();
  const files = {};
  for (const entry of manifest.files) {
    const text = gunzipSync(readFileSync(join(ROOT, 'public/library/packs', REFERENCE_PACK, entry.file))).toString('utf8');
    if (checksum(text) !== entry.checksum) throw new Error(`${entry.file}: checksum differs from its manifest`);
    files[entry.file] = entry.checksum;
    for (const node of JSON.parse(text).nodes) for (const unit of node.units) {
      if (unit.targum) verses.set(unit.id, unit.targum.split(/[\s־]+/).map(lettersOf).filter(Boolean));
    }
  }
  return { verses, files };
}

// ---------- Build ----------
const PARASHOT = SHNAYIM_MIKRA_CANONICAL_RANGES.filter(item => !item.combined);
const sameName = (a, b) => lettersOf(a).replace(/ו/g, '') === lettersOf(b).replace(/ו/g, '');

export function buildAll() {
  const reference = referenceOnkelos();
  const joined = [];
  const structural = [];
  const parashot = [];
  let intro = null;
  for (const [volume, bookEn, bookHe] of VOLUMES) {
    const parsed = parseVolume(readSource(volume), { volume });
    structural.push(...parsed.issues.filter(issue => !(issue.kind === 'empty-heading' && volume !== 'genesis')));
    if (!intro) intro = parsed.intro;
    else if (JSON.stringify(parsed.intro.map(section => ({ ...section, blocks: section.blocks.map(block => ({ ...block, x: block.x.replace(/\s+/g, ' ') })) })))
      !== JSON.stringify(intro.map(section => ({ ...section, blocks: section.blocks.map(block => ({ ...block, x: block.x.replace(/\s+/g, ' ') })) })))) {
      structural.push({ at: `${volume}:intro`, kind: 'intro-differs', text: 'the introductions of this volume differ from Genesis beyond spacing' });
    }
    for (const parasha of parsed.parashot) {
      const canonical = PARASHOT[parashot.length];
      if (!canonical || !sameName(canonical.he, parasha.he)) throw new Error(`${volume}: parasha "${parasha.he}" is not the expected ${canonical?.he}`);
      if (canonical.reference.split(' ')[0] !== bookEn) throw new Error(`${parasha.he}: not in ${bookEn}`);
      // Chapters: the Torah part continues day after day (the first day from the parasha's first verse); a chapter mark
      // (<big>) changes it. Used here only to find the reference verse of the Onkelos.
      let chapter = Number(/ (\d+):/.exec(canonical.reference)[1]);
      const days = [];
      for (const day of parasha.days) {
        const parts = [];
        for (const part of day.parts) {
          const sections = [];
          for (const section of part.sections) {
            let nachChapter = section.heading ? numberOf((/פרק\s+([^\s-]+)/.exec(section.heading) || [])[1] || '') : 0;
            const blocks = [];
            for (const block of section.blocks) {
              if (block.t === 'v') {
                if (part.key === 'torah' && block.c) chapter = numberOf(block.c);
                if (part.key !== 'torah' && block.c) nachChapter = numberOf(block.c);
                if (block.g) {
                  const verseId = part.key === 'torah' ? `${bookEn}.${chapter}.${numberOf(block.n)}` : null;
                  const fixed = fixTargumJoins(block.g, verseId ? reference.verses.get(verseId) || null : null);
                  if (fixed.changes.length) {
                    block.g = fixed.text;
                    for (const change of fixed.changes) joined.push({ parasha: canonical.id, day: day.key, part: part.key, verse: verseId ? verseId.replace(/\./g, ' ').replace(/ (\d+) (\d+)$/, ' $1:$2') : `${section.heading || ''} · ${nachChapter}:${numberOf(block.n)}`, ...change });
                  }
                }
              }
              blocks.push(block);
            }
            if (blocks.length) sections.push({ ...(section.heading ? { h: section.heading } : {}), b: blocks });
          }
          if (sections.length) parts.push({ key: part.key, s: sections });
          else structural.push({ at: `${canonical.id}/${day.key}`, kind: 'empty-part', text: `${part.key}: the edition has no text here (the day's part is not shown)` });
        }
        days.push({ key: day.key, parts });
      }
      const keys = days.map(day => day.key).join(',');
      if (keys !== DAYS.map(day => day.key).join(',')) throw new Error(`${canonical.id}: days ${keys}`);
      parashot.push({ id: canonical.id, he: canonical.he, edition: parasha.he, book: bookHe, days });
    }
  }
  if (parashot.length !== 54) throw new Error(`expected 54 parashot, found ${parashot.length}`);
  return { parashot, intro, joined, structural, referenceFiles: reference.files };
}

const json = value => `${JSON.stringify(value)}\n`;
const gz = body => gzipSync(Buffer.from(body), { level: 9 });

function outputs() {
  const { parashot, intro, joined, structural, referenceFiles } = buildAll();
  const files = [];
  const write = (file, data) => {
    const body = json({ packId: PACK_ID, ...data });
    files.push({ file, body, checksum: checksum(body), rawBytes: Buffer.byteLength(body) });
  };
  write('intro.json.gz', { id: 'intro', sections: intro.map(section => ({ title: section.title, b: section.blocks })) });
  for (const parasha of parashot) write(`${parasha.id}.json.gz`, parasha);
  return { files, parashot, joined, structural, referenceFiles };
}

function packBytes(file) {
  const path = join(OUT, file.file);
  if (existsSync(path)) {
    const disk = readFileSync(path);
    try { if (gunzipSync(disk).toString('utf8') === file.body) return disk; } catch { /* rewritten below */ }
  }
  return gz(file.body);
}

function main() {
  const { files, parashot, joined, structural, referenceFiles } = outputs();
  const packed = files.map(file => ({ ...file, bytes: packBytes(file) }));
  const manifest = {
    packId: PACK_ID,
    work: 'חק לישראל',
    credit: PROVENANCE.credit,
    edition: PROVENANCE.edition,
    license: PROVENANCE.license.id,
    licenseTitle: PROVENANCE.license.title,
    licenseUrl: PROVENANCE.license.termsUrl,
    source: { repository: PROVENANCE.source.repository, commit: PROVENANCE.source.commit, files: PROVENANCE.source.files.map(file => ({ book: file.book, sha256: file.sha256 })) },
    provenance: 'sources/torat-emet-chok-leyisrael/provenance.json',
    files: packed.map(file => ({ file: file.file, bytes: file.bytes.length, rawBytes: file.rawBytes, checksum: file.checksum })),
  };
  const runtime = {
    packId: PACK_ID,
    credit: PROVENANCE.credit,
    licenseTitle: PROVENANCE.license.title,
    licenseUrl: PROVENANCE.license.termsUrl,
    intro: { file: 'intro.json.gz', checksum: packed[0].checksum, bytes: packed[0].bytes.length },
    parashot: parashot.map((parasha, i) => ({ id: parasha.id, he: parasha.he, book: parasha.book, file: packed[i + 1].file, checksum: packed[i + 1].checksum, bytes: packed[i + 1].bytes.length,
      days: parasha.days.map(day => [day.key, day.parts.map(part => part.key)]) })),
  };
  const moduleText = `// Generated by scripts/chok-leyisrael/build.mjs — do not edit. חק לישראל (${PROVENANCE.credit}, ${PROVENANCE.license.title}):\n// one pack per parasha in public/library/packs/${PACK_ID}/, each with its checksum and the parts of each of its seven days.\nexport default ${JSON.stringify(runtime)};\n`;
  const log = {
    note: 'Every change the build makes to the words of the edition (a Targum word glued to the next by a lost line break, split again) and every structural fact it records. Generated; do not edit.',
    reference: { pack: REFERENCE_PACK, files: referenceFiles },
    joinedTargumWords: { count: joined.length, byRule: joined.reduce((acc, item) => ({ ...acc, [item.rule]: (acc[item.rule] || 0) + 1 }), {}), changes: joined },
    structural,
  };
  const logText = `${JSON.stringify(log, null, 1)}\n`;
  const manifestText = `${JSON.stringify(manifest, null, 1)}\n`;
  const units = parashot.reduce((sum, parasha) => sum + parasha.days.length, 0);
  if (CHECK) {
    const problems = [];
    for (const file of packed) {
      const path = join(OUT, file.file);
      if (!existsSync(path) || gunzipSync(readFileSync(path)).toString('utf8') !== file.body) problems.push(path);
    }
    const expected = new Set([...packed.map(file => file.file), 'manifest.json']);
    if (existsSync(OUT)) for (const name of readdirSync(OUT)) if (!expected.has(name)) problems.push(`${join(OUT, name)} (not built)`);
    for (const [path, text] of [[join(OUT, 'manifest.json'), manifestText], [MODULE, moduleText], [LOG, logText]]) if (!existsSync(path) || readFileSync(path, 'utf8') !== text) problems.push(path);
    if (problems.length) { console.error(`חק לישראל packs are stale:\n  ${problems.slice(0, 12).join('\n  ')}`); process.exit(1); }
    console.log(`חק לישראל current: ${parashot.length} parashot, ${units} days, ${packed.length} files, ${joined.length} Targum words split`);
    return;
  }
  if (existsSync(OUT)) for (const name of readdirSync(OUT)) if (!packed.some(file => file.file === name) && name !== 'manifest.json') rmSync(join(OUT, name));
  mkdirSync(OUT, { recursive: true });
  for (const file of packed) writeFileSync(join(OUT, file.file), file.bytes);
  writeFileSync(join(OUT, 'manifest.json'), manifestText);
  mkdirSync(dirname(MODULE), { recursive: true });
  writeFileSync(MODULE, moduleText);
  writeFileSync(LOG, logText);
  const total = packed.reduce((sum, file) => sum + file.bytes.length, 0);
  const raw = packed.reduce((sum, file) => sum + file.rawBytes, 0);
  console.log(JSON.stringify({ parashot: parashot.length, days: units, files: packed.length, gzKB: Math.round(total / 1024), rawKB: Math.round(raw / 1024), largestKB: Math.round(Math.max(...packed.map(file => file.bytes.length)) / 1024), targumSplits: log.joinedTargumWords.byRule, structural: structural.length, parts: PARTS.length }, null, 1));
}

if (FETCH) await fetchSources();
else main();
