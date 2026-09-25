// Repeatable library import: Source → Fetch → Parse → Validate structure/completeness → Manifest → Packs.
// Run: node scripts/library/build-library.mjs [--uxlc /tmp/uxlc] [--cache /tmp/kz-library-cache] [--offline]
// Nothing is published unless every unit of every work validates as FULL against an independent expected structure.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checksum } from '../../src/services/prayer/checksum.mjs';
import { validateWorkChunk, summarizeReports, COVERAGE } from '../../src/services/library/integrity.mjs';
import { BOOK_CATALOG } from '../../src/data/bookCatalog.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const UXLC_DIR = arg('--uxlc', '/tmp/uxlc');
const CACHE = arg('--cache', '/tmp/kz-library-cache');
const OFFLINE = args.includes('--offline');
const RETRIEVED_AT = arg('--retrieved-at', new Date().toISOString().slice(0, 10));
const PACKS_DIR = join(ROOT, 'public/library/packs');
const DATA_DIR = join(ROOT, 'src/data/library');
mkdirSync(CACHE, { recursive: true });

const fail = message => { throw new Error(message); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const workIdFor = title => title.replace(/['’]/g, '').replace(/, /g, '__').replaceAll(' ', '_');

async function cachedJson(name, url) {
  const file = join(CACHE, `${name.replace(/[^A-Za-z0-9._-]+/g, '_')}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  if (OFFLINE) fail(`offline and not cached: ${url}`);
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (response.ok) {
        const data = await response.json();
        writeFileSync(file, JSON.stringify(data));
        await sleep(150);
        return data;
      }
      if (response.status < 500 && response.status !== 429) fail(`${url}: HTTP ${response.status}`);
    } catch (error) {
      if (attempt === 4) throw error;
    }
    await sleep(600 * attempt);
  }
  fail(`${url}: unreachable`);
}

// ---------- Tanakh: UXLC 2.5 (Tanach.us) ----------
const TANAKH_FILES = {
  Genesis: 'Genesis', Exodus: 'Exodus', Leviticus: 'Leviticus', Numbers: 'Numbers', Deuteronomy: 'Deuteronomy',
  Joshua: 'Joshua', Judges: 'Judges', 'I Samuel': 'Samuel_1', 'II Samuel': 'Samuel_2', 'I Kings': 'Kings_1', 'II Kings': 'Kings_2',
  Isaiah: 'Isaiah', Jeremiah: 'Jeremiah', Ezekiel: 'Ezekiel', Hosea: 'Hosea', Joel: 'Joel', Amos: 'Amos', Obadiah: 'Obadiah',
  Jonah: 'Jonah', Micah: 'Micah', Nahum: 'Nahum', Habakkuk: 'Habakkuk', Zephaniah: 'Zephaniah', Haggai: 'Haggai', Zechariah: 'Zechariah', Malachi: 'Malachi',
  Psalms: 'Psalms', Proverbs: 'Proverbs', Job: 'Job', 'Song of Songs': 'Song_of_Songs', Ruth: 'Ruth', Lamentations: 'Lamentations',
  Ecclesiastes: 'Ecclesiastes', Esther: 'Esther', Daniel: 'Daniel', Ezra: 'Ezra', Nehemiah: 'Nehemiah', 'I Chronicles': 'Chronicles_1', 'II Chronicles': 'Chronicles_2',
};
const FORMER_PROPHETS = new Set(['Joshua', 'Judges', 'I Samuel', 'II Samuel', 'I Kings', 'II Kings']);
const decode = value => value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

function ensureUxlc() {
  if (existsSync(join(UXLC_DIR, 'Books', 'Genesis.xml'))) return;
  if (OFFLINE) fail(`UXLC XML missing in ${UXLC_DIR}`);
  mkdirSync(UXLC_DIR, { recursive: true });
  execFileSync('curl', ['-sSL', '-o', join(UXLC_DIR, 'Tanach.xml.zip'), 'https://www.tanach.us/Books/Tanach.xml.zip']);
  execFileSync('unzip', ['-o', '-q', join(UXLC_DIR, 'Tanach.xml.zip'), '-d', UXLC_DIR]);
}

// Word tokens in source order. Ketiv → (ketiv), qere → [qere], open/closed section → {פ}/{ס} in place;
// UXLC transcription-note codes <x> are apparatus, not text.
export function uxlcVerseText(inner) {
  const tokens = [];
  const token = /<(w|k|q)>([\s\S]*?)<\/\1>|<reversednun\/>|<(pe|samekh)\/>/g;
  let match;
  let breaks = 0;
  while ((match = token.exec(inner))) {
    if (match[0] === '<reversednun/>') { tokens.push('\u05C6'); continue; }
    if (match[3]) { breaks += 1; tokens.push(match[3] === 'pe' ? '{פ}' : '{ס}'); continue; }
    const word = decode(match[2].replace(/<x>[\s\S]*?<\/x>/g, '').replace(/<s [^>]*>([\s\S]*?)<\/s>/g, '$1'));
    if (/[<>]/.test(word)) fail(`unhandled markup in word: ${match[0]}`);
    tokens.push(match[1] === 'k' ? `(${word})` : match[1] === 'q' ? `[${word}]` : word);
  }
  const text = tokens.reduce((out, word, i) => (i === 0 ? word : out.endsWith('\u05BE') ? out + word : `${out} ${word}`), '');
  return { text, breaks };
}

function uxlcExpected() {
  const xml = readFileSync(join(UXLC_DIR, 'Books', 'TanachIndex.xml'), 'utf8');
  const books = new Map();
  for (const [, body] of xml.matchAll(/<book>([\s\S]*?)<\/book>/g)) {
    const file = body.match(/<filename>([^<]+)<\/filename>/)[1];
    books.set(file, [...body.matchAll(/<c n="(\d+)">\s*<vs>(\d+)<\/vs>/g)].map(([, n, vs]) => ({ n: Number(n), units: Number(vs) })));
  }
  return books;
}

async function buildTanakh() {
  ensureUxlc();
  const header = readFileSync(join(UXLC_DIR, 'Books', 'Genesis.xml'), 'utf8');
  const version = header.match(/<version>([^<]+)<\/version>/)[1];
  const build = header.match(/<build>([^<]+)<\/build>/)[1];
  const shape = await cachedJson('shape-Tanakh', 'https://www.sefaria.org/api/shape/Tanakh');
  const expected = uxlcExpected();
  const packId = `uxlc-${version.replace(/[^0-9.]/g, '')}`;
  const works = [];
  const discrepancies = [];
  for (const [title, file] of Object.entries(TANAKH_FILES)) {
    const xml = readFileSync(join(UXLC_DIR, 'Books', `${file}.xml`), 'utf8');
    const workId = workIdFor(title);
    const nodes = [];
    const breaksInFile = (xml.match(/<(?:pe|samekh)\/>/g) || []).length;
    let breaksCaptured = 0;
    for (const [, n, chapterBody] of xml.matchAll(/<c n="(\d+)">([\s\S]*?)<\/c>/g)) {
      const units = [];
      for (const [, v, inner] of chapterBody.matchAll(/<v n="(\d+)">([\s\S]*?)<\/v>/g)) {
        const { text, breaks } = uxlcVerseText(inner);
        breaksCaptured += breaks;
        units.push({ id: `${workId}.${n}.${v}`, n: Number(v), text });
      }
      nodes.push({ id: `${workId}.${n}`, n: Number(n), units });
    }
    if (breaksCaptured !== breaksInFile) fail(`${title}: ${breaksInFile - breaksCaptured} section markers not captured`);
    const sefaria = shape.find(item => item.title === title);
    if (!sefaria) fail(`${title}: missing from Sefaria Tanakh shape`);
    const exp = expected.get(file) || fail(`${title}: missing from TanachIndex`);
    exp.forEach(({ n, units }) => {
      const other = sefaria.chapters[n - 1];
      if (other !== units) discrepancies.push({ workId, kind: 'numbering-difference', node: `${workId}.${n}`, primary: units, validation: other ?? null, validationSource: 'sefaria-shape' });
    });
    if (sefaria.chapters.length !== exp.length) discrepancies.push({ workId, kind: 'structural-difference', primary: exp.length, validation: sefaria.chapters.length, validationSource: 'sefaria-shape' });
    const section = sefaria.section === 'Torah' ? 'torah' : sefaria.section === 'Prophets' ? (FORMER_PROPHETS.has(title) ? 'neviim-rishonim' : 'neviim-acharonim') : 'ketuvim';
    works.push({ workId, title, heTitle: sefaria.heTitle, group: section, expected: exp, chunk: { workId, editionId: `${packId}:${workId}`, packId, nodes } });
  }
  return {
    pack: {
      packId,
      contentVersion: `${version} build ${build}`,
      family: 'tanakh',
      structure: ['chapter', 'verse'],
      unitLabel: 'פסוק',
      nodeLabel: 'פרק',
      policy: 'tanakh',
      source: 'tanach-us',
      license: 'uxlc-free',
      edition: { title: `Unicode/XML Leningrad Codex (${version})`, heTitle: 'כתר לנינגרד (UXLC)', editor: 'Christopher V. Kimball (publisher); Westminster Leningrad Codex transcription', build, notes: 'כתיב בסוגריים עגולים ( ), קרי בסוגריים מרובעים [ ]. פרשה פתוחה {פ} וסתומה {ס} במקומן בכתב היד. קודי הערות התעתיק של UXLC אינם חלק מהטקסט ואינם מוצגים.' },
      sourceUrl: 'https://www.tanach.us/Tanach.xml',
      retrievedAt: RETRIEVED_AT,
    },
    works,
    discrepancies,
  };
}

// ---------- Mishnah: Sefaria, single explicit Hebrew edition ----------
const MISHNAH_VERSION = 'Torat Emet 357';
const SEDER_ID = { 'Seder Zeraim': 'zeraim', 'Seder Moed': 'moed', 'Seder Nashim': 'nashim', 'Seder Nezikin': 'nezikin', 'Seder Kodashim': 'kodashim', 'Seder Tahorot': 'tahorot' };

async function buildMishnah() {
  const shape = await cachedJson('shape-Mishnah', 'https://www.sefaria.org/api/shape/Mishnah');
  if (shape.length !== 63) fail(`Mishnah shape lists ${shape.length} tractates`);
  const packId = 'sefaria-torat-emet-357-mishnah';
  const works = [];
  let license = null;
  let versionSource = null;
  for (const tractate of shape) {
    const url = `https://www.sefaria.org/api/v3/texts/${encodeURIComponent(tractate.title)}?version=${encodeURIComponent(`hebrew|${MISHNAH_VERSION}`)}&fill_in_missing_segments=0&return_format=text_only`;
    const data = await cachedJson(`v3-${tractate.title}-${MISHNAH_VERSION}`, url);
    const version = data.versions?.[0];
    if (!version || data.versions.length !== 1 || version.versionTitle !== MISHNAH_VERSION) fail(`${tractate.title}: exact edition not returned`);
    if (data.warnings?.length) fail(`${tractate.title}: source warnings ${JSON.stringify(data.warnings)}`);
    license ||= version.license;
    versionSource ||= version.versionSource;
    if (version.license !== license) fail(`${tractate.title}: license differs (${version.license})`);
    const workId = workIdFor(tractate.title);
    const nodes = version.text.map((perek, p) => ({
      id: `${workId}.${p + 1}`,
      n: p + 1,
      units: (Array.isArray(perek) ? perek : []).map((text, m) => ({ id: `${workId}.${p + 1}.${m + 1}`, n: m + 1, text: typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '' })),
    }));
    const index = await cachedJson(`index-${tractate.title}`, `https://www.sefaria.org/api/v2/index/${encodeURIComponent(tractate.title)}`);
    works.push({
      workId,
      title: tractate.title,
      heTitle: tractate.heTitle,
      group: SEDER_ID[tractate.section] || fail(`${tractate.title}: unknown seder ${tractate.section}`),
      authors: (index.authors || []).map(author => author.he || author.en).filter(Boolean),
      expected: tractate.chapters.map((units, i) => ({ n: i + 1, units })),
      chunk: { workId, editionId: `${packId}:${workId}`, packId, nodes },
    });
  }
  return {
    pack: {
      packId,
      contentVersion: `${MISHNAH_VERSION} (retrieved ${RETRIEVED_AT})`,
      family: 'mishnah',
      structure: ['perek', 'mishnah'],
      unitLabel: 'משנה',
      nodeLabel: 'פרק',
      policy: 'source',
      source: 'sefaria',
      license: license === 'Public Domain' ? 'public-domain' : fail(`unexpected Mishnah license ${license}`),
      edition: { title: MISHNAH_VERSION, heTitle: 'תורת אמת 357', editor: 'Torat Emet', versionSource, notes: 'מהדורה אחת בלבד, ללא השלמת קטעים ממהדורות אחרות (fill_in_missing_segments=0).' },
      sourceUrl: 'https://www.sefaria.org/texts/Mishnah',
      retrievedAt: RETRIEVED_AT,
    },
    works,
    discrepancies: [],
  };
}

// Second source for Mishnah: the previously bundled flat copy, aligned to canonical IDs through the expected shape.
async function crossCheckMishnah(mishnah) {
  const bundled = (await import('../../src/data/booksOffline.mjs')).default.Mishnah;
  const squash = value => String(value || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const flat = new Map();
  let position = 0;
  for (const work of mishnah.works) for (const { n, units } of work.expected) for (let m = 1; m <= units; m += 1) flat.set(`${work.workId}.${n}.${m}`, bundled?.hebrew?.[position++]);
  let identical = 0;
  const differing = [];
  const onlyInBundled = [];
  const imported = new Set();
  for (const work of mishnah.works) for (const node of work.chunk.nodes) for (const unit of node.units) {
    imported.add(unit.id);
    if (squash(flat.get(unit.id)) === unit.text) identical += 1; else differing.push(unit.id);
  }
  for (const [id, text] of flat) if (!imported.has(id) && squash(text)) onlyInBundled.push(id);
  return { validationSource: 'booksOffline.mjs (Mishnah, labelled Torat Emet 357)', bundledUnits: bundled?.hebrew?.length ?? 0, importedUnits: imported.size, identical, differing: differing.length, sampleDiffering: differing.slice(0, 10), onlyInBundled };
}

// ---------- Legacy bundled books: evidence-based metadata only ----------
async function legacyMetadata() {
  const books = (await import('../../src/data/booksOffline.mjs')).default;
  const out = {};
  for (const book of BOOK_CATALOG.filter(item => !['tanakh', 'mishnah'].includes(item.id))) {
    for (const ref of book.reference.split(/\s*;\s*/)) {
      const entry = books[ref];
      const index = await cachedJson(`index-${ref}`, `https://www.sefaria.org/api/v2/index/${encodeURIComponent(ref)}`).catch(() => null);
      const versions = await cachedJson(`versions-${ref}`, `https://www.sefaria.org/api/texts/versions/${encodeURIComponent(ref)}`).catch(() => null);
      const match = Array.isArray(versions) ? versions.find(version => version.language === 'he' && version.versionTitle === entry?.version) : null;
      out[ref] = {
        ref,
        heTitle: index?.heTitle || null,
        authors: (index?.authors || []).map(author => author.he || author.en).filter(Boolean),
        era: index?.era || null,
        compDate: index?.compDateString?.he || index?.compDateString?.en || null,
        sefariaCategories: index?.categories || [],
        storedVersion: entry?.version || null,
        storedLicense: entry?.license || null,
        sourceLicense: match?.license || null,
        versionSource: match?.versionSource || null,
        units: entry?.hebrew?.length || 0,
      };
    }
  }
  return out;
}

// ---------- Shnayim Mikra: Hebrew + Onkelos joined by canonical verse ID (Jewish verse numbering) ----------
const TORAH = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'];
const MIKRA_VERSION = "Tanach with Ta'amei Hamikra";

async function exactVersion(ref, versionTitle) {
  const url = `https://www.sefaria.org/api/v3/texts/${encodeURIComponent(ref)}?version=${encodeURIComponent(`hebrew|${versionTitle}`)}&fill_in_missing_segments=0&return_format=text_only`;
  const data = await cachedJson(`v3-${ref}-${versionTitle}`, url);
  const version = data.versions?.[0];
  if (!version || data.versions.length !== 1 || version.versionTitle !== versionTitle) fail(`${ref}: exact edition "${versionTitle}" not returned`);
  if (data.warnings?.length) fail(`${ref}: source warnings ${JSON.stringify(data.warnings)}`);
  return version;
}

async function buildShnayim() {
  const packId = 'shnayim-mikra-sefaria-pd';
  const tanakhShape = await cachedJson('shape-Tanakh', 'https://www.sefaria.org/api/shape/Tanakh');
  const books = [];
  const mismatches = [];
  const licenses = new Set();
  for (const book of TORAH) {
    const mikra = await exactVersion(book, MIKRA_VERSION);
    const targum = await exactVersion(`Onkelos ${book}`, `Onkelos ${book}`);
    licenses.add(mikra.license).add(targum.license);
    const expected = tanakhShape.find(item => item.title === book).chapters;
    const onkelosShape = (await cachedJson(`shape-Onkelos ${book}`, `https://www.sefaria.org/api/shape/${encodeURIComponent(`Onkelos ${book}`)}`))[0].chapters;
    if (onkelosShape.join() !== expected.join()) mismatches.push({ book, kind: 'onkelos-shape', detail: onkelosShape.map((n, i) => (n !== expected[i] ? `${i + 1}:${n}/${expected[i]}` : null)).filter(Boolean) });
    const nodes = expected.map((count, c) => ({
      id: `${book}.${c + 1}`,
      n: c + 1,
      units: Array.from({ length: count }, (_, v) => {
        const text = String(mikra.text[c]?.[v] ?? '').replace(/\s+/g, ' ').trim();
        const onkelos = String(targum.text[c]?.[v] ?? '').replace(/\s+/g, ' ').trim();
        if (!onkelos) mismatches.push({ book, kind: 'missing-onkelos', unit: `${book}.${c + 1}.${v + 1}` });
        if (/[<>]/.test(text + onkelos)) mismatches.push({ book, kind: 'markup', unit: `${book}.${c + 1}.${v + 1}` });
        return { id: `${book}.${c + 1}.${v + 1}`, n: v + 1, text, targum: onkelos };
      }),
    }));
    [mikra, targum].forEach((version, index) => version.text.forEach((chapter, c) => { if ((chapter?.length || 0) !== (expected[c] || 0)) mismatches.push({ book, kind: index ? 'onkelos-length' : 'mikra-length', node: `${book}.${c + 1}`, actual: chapter?.length || 0, expected: expected[c] || 0 }); }));
    const report = validateWorkChunk({ workId: book, nodes }, expected.map((units, i) => ({ n: i + 1, units })));
    books.push({ book, report, chunk: { workId: book, editionId: `${packId}:${book}`, packId, nodes } });
  }
  if ([...licenses].some(license => license !== 'Public Domain')) fail(`Shnayim Mikra licenses ${[...licenses]}`);
  return { packId, books, mismatches, retrievedAt: RETRIEVED_AT, mikraVersion: MIKRA_VERSION };
}

// ---------- Generic Sefaria family: one explicit edition per work, Sefaria shape as the expected structure ----------
async function buildSefariaFamily({ packId, family, category, works, structure, nodeLabel, unitLabel, contentVersion, edition, license }) {
  const built = [];
  const skipped = [];
  for (const work of works) {
    const shape = await cachedJson(`shape-${work.title}`, `https://www.sefaria.org/api/shape/${encodeURIComponent(work.title)}`).catch(error => ({ error: error.message }));
    const root = Array.isArray(shape) ? shape[0] : null;
    if (!root || !Array.isArray(root.chapters) || !root.chapters.every(count => Number.isInteger(count))) { skipped.push({ title: work.title, reason: 'structure-unavailable' }); continue; }
    let version;
    const candidates = [].concat(work.version);
    for (const candidate of candidates) {
      try { version = await exactVersion(work.title, candidate); break; } catch { version = null; }
    }
    if (!version) { skipped.push({ title: work.title, reason: `no edition among ${candidates.join(' / ')}` }); continue; }
    if (licenseIdFor(version.license) !== license) { skipped.push({ title: work.title, reason: `license ${version.license}` }); continue; }
    const workId = workIdFor(work.title);
    // Empty source slots are gaps: omitted here so the validator lists them as missing units.
    const nodes = version.text.map((node, c) => ({
      id: `${workId}.${c + 1}`,
      n: c + 1,
      units: (Array.isArray(node) ? node : []).map((text, u) => ({ id: `${workId}.${c + 1}.${u + 1}`, n: u + 1, text: typeof text === 'string' ? text.replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim() : '' })).filter(unit => unit.text),
    })).filter(node => node.units.length);
    const index = await cachedJson(`index-${work.title}`, `https://www.sefaria.org/api/v2/index/${encodeURIComponent(work.title)}`).catch(() => null);
    built.push({
      workId,
      title: work.title,
      heTitle: root.heTitle || work.heTitle,
      group: work.group,
      aliases: work.aliases || [],
      authors: (index?.authors || []).map(author => author.he || author.en).filter(Boolean),
      editionTitle: version.versionTitle,
      versionSource: version.versionSource || null,
      expected: root.chapters.map((units, i) => ({ n: i + 1, units })),
      chunk: { workId, editionId: `${packId}:${workId}`, packId, nodes },
    });
  }
  return { pack: { packId, contentVersion, family, category, structure, nodeLabel, unitLabel, policy: 'source', source: 'sefaria', license, edition, sourceUrl: 'https://www.sefaria.org/texts', retrievedAt: RETRIEVED_AT }, works: built, discrepancies: [], skipped };
}

const LICENSE_IDS = { 'Public Domain': 'public-domain', PD: 'public-domain', CC0: 'public-domain' };
const licenseIdFor = value => LICENSE_IDS[value] || String(value || 'unknown');

const SHULCHAN_ARUKH = [
  { title: 'Shulchan Arukh, Orach Chayim', version: 'Torat Emet 363', aliases: ['שולחן ערוך אורח חיים', 'שו"ע או"ח', 'או"ח', 'אורח חיים'] },
  { title: "Shulchan Arukh, Yoreh De'ah", version: 'Torat Emet 357', aliases: ['שולחן ערוך יורה דעה', 'שו"ע יו"ד', 'יו"ד', 'יורה דעה'] },
  { title: 'Shulchan Arukh, Even HaEzer', version: 'Torat Emet 357', aliases: ['שולחן ערוך אבן העזר', 'שו"ע אה"ע', 'אה"ע', 'אבן העזר'] },
  { title: 'Shulchan Arukh, Choshen Mishpat', version: 'Shulhan Arukh, Hoshen ha-Mishpat, Lemberg, 1898', aliases: ['שולחן ערוך חושן משפט', 'שו"ע חו"מ', 'חו"מ', 'חושן משפט'] },
].map(work => ({ ...work, group: 'shulchan-arukh' }));

const MT_SEFER = { 'Sefer Madda': 'madda', 'Sefer Ahavah': 'ahavah', 'Sefer Zemanim': 'zemanim', 'Sefer Nashim': 'nashim', 'Sefer Kedushah': 'kedushah', 'Sefer Haflaah': 'haflaah', 'Sefer Zeraim': 'zeraim', 'Sefer Avodah': 'avodah', 'Sefer Korbanot': 'korbanot', 'Sefer Taharah': 'taharah', 'Sefer Nezikim': 'nezikim', 'Sefer Kinyan': 'kinyan', 'Sefer Mishpatim': 'mishpatim', 'Sefer Shoftim': 'shoftim' };
async function mishnehTorahWorks() {
  const toc = await cachedJson('sefaria-toc', 'https://www.sefaria.org/api/index');
  const works = [];
  const walk = (node, path) => {
    if (Array.isArray(node)) return node.forEach(child => walk(child, path));
    if (node.contents) return walk(node.contents, [...path, node.category]);
    if (node.title && path.includes('Mishneh Torah') && MT_SEFER[path.at(-1)] && /^Mishneh Torah, /.test(node.title)) {
      const hilchot = String(node.heTitle || '').replace(/^משנה תורה,\s*/, '');
      works.push({ title: node.title, heTitle: node.heTitle, group: MT_SEFER[path.at(-1)], version: ['Torat Emet 363', 'Torat Emet 370'], aliases: [`רמב"ם ${hilchot}`, hilchot, `רמב"ם ${hilchot.replace(/^הלכות\s+/, '')}`] });
    }
  };
  walk(toc, []);
  return works;
}

// ---------- Publish ----------
function writeAtomic(target, write) {
  const staging = `${target}.staging`;
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  write(staging);
  rmSync(target, { recursive: true, force: true });
  renameSync(staging, target);
}

const results = [
  await buildTanakh(),
  await buildMishnah(),
  await buildSefariaFamily({ packId: 'sefaria-shulchan-arukh-pd', family: 'shulchan-arukh', category: 'halacha', works: SHULCHAN_ARUKH, structure: ['siman', 'seif'], nodeLabel: 'סימן', unitLabel: 'סעיף', contentVersion: `Sefaria, per-part edition (retrieved ${RETRIEVED_AT})`, edition: { title: 'Shulchan Arukh', heTitle: 'שולחן ערוך', editor: 'לפי חלק: תורת אמת / דפוס למברג', notes: 'לכל חלק מהדורה אחת בלבד, ללא השלמת קטעים ממהדורות אחרות.' }, license: 'public-domain' }),
  await buildSefariaFamily({ packId: 'sefaria-mishneh-torah-torat-emet-363', family: 'mishneh-torah', category: 'rambam', works: await mishnehTorahWorks(), structure: ['perek', 'halacha'], nodeLabel: 'פרק', unitLabel: 'הלכה', contentVersion: `Torat Emet 363 (retrieved ${RETRIEVED_AT})`, edition: { title: 'Torat Emet 363', heTitle: 'תורת אמת 363', editor: 'Torat Emet', notes: 'מהדורה אחת בלבד, ללא השלמת קטעים ממהדורות אחרות.' }, license: 'public-domain' }),
];
const skippedWorks = results.flatMap(result => result.skipped || []);
const mishnahCross = await crossCheckMishnah(results[1]);
const reports = results.flatMap(({ works }) => works.map(work => ({ ...validateWorkChunk(work.chunk, work.expected), sourceRef: work.title, checksum: null })));
// A gap in the named edition is published as PARTIAL with its missing units; corruption is never published.
const corrupt = reports.filter(report => report.duplicateIds.length || report.emptyUnits.length || report.invalidRefs.length || report.unexpectedUnits.length || report.orderErrors.length || report.status === COVERAGE.UNAVAILABLE);
if (corrupt.length) {
  console.error(JSON.stringify(corrupt.map(({ workId, duplicateIds, emptyUnits, invalidRefs, unexpectedUnits, orderErrors }) => ({ workId, duplicates: duplicateIds.slice(0, 5), empty: emptyUnits.slice(0, 5), invalid: invalidRefs.slice(0, 5), unexpected: unexpectedUnits.slice(0, 5), order: orderErrors.slice(0, 5) })), null, 1));
  fail(`${corrupt.length} works failed validation; nothing published`);
}


const shnayim = await buildShnayim();
const shnayimBroken = shnayim.books.filter(({ report }) => report.status !== COVERAGE.FULL);
if (shnayim.mismatches.length || shnayimBroken.length) {
  console.error(JSON.stringify({ mismatches: shnayim.mismatches.slice(0, 20), broken: shnayimBroken.map(({ book, report }) => ({ book, missing: report.missingUnits.slice(0, 5), empty: report.emptyUnits.slice(0, 5) })) }, null, 1));
  fail('Shnayim Mikra pack failed validation; nothing published');
}
const shnayimFiles = [];
writeAtomic(join(PACKS_DIR, shnayim.packId), staging => {
  for (const { book, chunk } of shnayim.books) {
    const body = JSON.stringify(chunk);
    writeFileSync(join(staging, `${book}.json`), body);
    shnayimFiles.push({ book, packId: shnayim.packId, editionId: chunk.editionId, file: `${book}.json`, bytes: Buffer.byteLength(body), checksum: checksum(body), chapters: chunk.nodes.map(node => node.units.length) });
  }
  writeFileSync(join(staging, 'manifest.json'), JSON.stringify({ packId: shnayim.packId, mikra: { versionTitle: shnayim.mikraVersion, license: 'public-domain', source: 'sefaria (tanach.us)' }, targum: { versionTitle: 'Onkelos <Book>', license: 'public-domain', source: 'sefaria (Torat Emet)' }, retrievedAt: shnayim.retrievedAt, files: shnayimFiles }, null, 1));
});
writeFileSync(join(DATA_DIR, 'shnayimIndex.mjs'), `// Generated by scripts/library/build-library.mjs. Do not edit by hand.\nexport default ${JSON.stringify({ packId: shnayim.packId, retrievedAt: shnayim.retrievedAt, mikra: { title: shnayim.mikraVersion, heTitle: 'תנ״ך עם טעמי המקרא (tanach.us)', license: 'public-domain' }, targum: { title: 'Onkelos (Torat Emet)', heTitle: 'תרגום אונקלוס · תורת אמת', license: 'public-domain' }, books: shnayimFiles })};\n`);
console.log(JSON.stringify({ shnayim: shnayimFiles.map(file => `${file.book}:${file.chapters.reduce((a, b) => a + b, 0)}`) }));
const packIndex = [];
for (const { pack, works } of results) {
  const files = [];
  writeAtomic(join(PACKS_DIR, pack.packId), staging => {
    for (const work of works) {
      const body = JSON.stringify(work.chunk);
      const file = `${work.workId}.json`;
      writeFileSync(join(staging, file), body);
      const sum = checksum(body);
      reports.find(report => report.workId === work.workId).checksum = sum;
      files.push({ workId: work.workId, file, bytes: Buffer.byteLength(body), checksum: sum });
    }
    writeFileSync(join(staging, 'manifest.json'), JSON.stringify({ ...pack, files }, null, 1));
  });
  packIndex.push({
    ...pack,
    bytes: files.reduce((total, file) => total + file.bytes, 0),
    works: works.map(work => ({
      workId: work.workId,
      title: work.title,
      heTitle: work.heTitle,
      group: work.group,
      aliases: work.aliases || [],
      editionTitle: work.editionTitle || null,
      versionSource: work.versionSource || null,
      authors: work.authors || [],
      status: reports.find(report => report.workId === work.workId).status,
      missingUnits: reports.find(report => report.workId === work.workId).missingUnits,
      file: `${work.workId}.json`,
      bytes: files.find(file => file.workId === work.workId).bytes,
      checksum: files.find(file => file.workId === work.workId).checksum,
      nodes: work.chunk.nodes.map(node => node.units.length),
      expected: work.expected.map(node => node.units),
    })),
  });
}

mkdirSync(DATA_DIR, { recursive: true });
const banner = '// Generated by scripts/library/build-library.mjs. Do not edit by hand.\n';
writeFileSync(join(DATA_DIR, 'packIndex.mjs'), `${banner}export default ${JSON.stringify(packIndex)};\n`);
writeFileSync(join(DATA_DIR, 'importReports.mjs'), `${banner}export default ${JSON.stringify({
  generatedAt: RETRIEVED_AT,
  summary: summarizeReports(reports),
  reports: reports.map(({ workId, editionId, sourceRef, expectedUnits, importedUnits, status, checksum: sum, missingUnits, duplicateIds, emptyUnits, invalidRefs, unexpectedUnits, orderErrors }) => ({ workId, editionId, sourceRef, expectedUnits, importedUnits, status, checksum: sum, missing: missingUnits.length, missingUnits, duplicates: duplicateIds.length, empty: emptyUnits.length, invalid: invalidRefs.length, unexpected: unexpectedUnits.length, order: orderErrors.length })),
  discrepancies: results.flatMap(result => result.discrepancies),
  skipped: skippedWorks,
  crossChecks: { mishnah: mishnahCross },
}, null, 1)};\n`);
writeFileSync(join(DATA_DIR, 'legacyMetadata.mjs'), `${banner}export default ${JSON.stringify(await legacyMetadata(), null, 1)};\n`);
console.log(JSON.stringify({ summary: summarizeReports(reports), packs: packIndex.map(pack => ({ packId: pack.packId, works: pack.works.length, bytes: pack.bytes })), discrepancies: results.flatMap(result => result.discrepancies).length, mishnahCross }, null, 1));
