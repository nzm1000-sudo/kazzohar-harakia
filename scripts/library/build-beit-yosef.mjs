// The Beit Yosef, all four parts (אורח חיים, יורה דעה, אבן העזר, חושן משפט), as a book on the device and as the
// commentary layer of the Tur beside it, on the relation/anchor/coverage model of docs/library/content-model.md.
// Run: node scripts/library/build-beit-yosef.mjs [--cache /tmp/kz-library-cache/beit-yosef] [--offline]
//        [--retrieved-at YYYY-MM-DD]
//
// Edition: Sefaria's four Hebrew versions of "Beit Yosef" — "Tur Orach Chaim, Vilna, 1923", "Tur Yoreh Deah, Vilna,
// 1923", "Tur Even HaEzer, Vilna, 1923", "Tur Choshen Mishpat: Vilna, 1923": one print (the Vilna 1923 Tur with its
// commentaries, one NLI record — the same record as the Tur already in the library), one version per part, all Public
// Domain. The build proves it: the four versions must name the same source and be Public Domain, read LIVE from
// /api/texts/versions/Beit Yosef on every run (never from the cache); anything else stops the build.
// Markup cleanup only: the words of the edition are never changed. Nothing missing is filled from another edition.
//   • <small> — the author's later additions (בדק הבית, printed in smaller type and opened by "(ב"ה)") — is kept as a
//     range on the unit (g: [[from, to]], offsets in the unit's text), so the reader can tell them apart at the same
//     reading size; the words themselves are unchanged.
//   • <i data-commentator=…></i> — empty markers of the commentaries printed around the page (דרכי משה, פרישה, דרישה,
//     הגהות) — are removed; <b>, <br> — tags only.
// Structure: Sefaria's shape of each part. Orach Chayim, Yoreh De'ah, Even HaEzer: siman → segment (one unit each,
// numbered as Sefaria numbers them, so "Beit Yosef, Orach Chayim 1:3" is unit 3 of that siman). Choshen Mishpat: siman
// → seif of the Tur → pieces; a unit is one seif (its pieces as paragraphs), numbered in order and labelled by the
// seif of the Tur it explains (v, label). Every siman is anchored to the same siman of the Tur (anchorScheme 'siman').
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checksum } from '../../src/services/prayer/checksum.mjs';
import { COVERAGE, coverageRecord, validateWorkChunk } from '../../src/services/library/integrity.mjs';
import COLLECTION_INDEX from '../../src/data/library/collectionIndex.mjs';
import { cleanText } from './clean.mjs';
import { hebrewNumeral } from '../../src/services/hebrewNumerals.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const CACHE = arg('--cache', '/tmp/kz-library-cache/beit-yosef');
const OFFLINE = args.includes('--offline');
const RETRIEVED_AT = arg('--retrieved-at', new Date().toISOString().slice(0, 10));
const SEFARIA = 'https://www.sefaria.org';
const TITLE = 'Beit Yosef';
const WORK_ID = 'Beit_Yosef';
const PACK_ID = 'sefaria-beit-yosef-public-domain';
const PROVENANCE = join(ROOT, 'sources/beit-yosef/provenance.json');
const PART_TARGET = 1_400_000; // raw JSON bytes per file (≈ 350 KB gzip): a siman loads only its own range
mkdirSync(CACHE, { recursive: true });
const fail = message => { throw new Error(message); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha256 = text => createHash('sha256').update(text).digest('hex');
const safe = name => name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 180);

const PARTS = [
  { key: 'oc', en: 'Orach Chayim', he: 'אורח חיים', versionTitle: 'Tur Orach Chaim, Vilna, 1923', heVersion: 'בית יוסף על טור אורח חיים, וילנא תרפ״ג' },
  { key: 'yd', en: "Yoreh De'ah", he: 'יורה דעה', versionTitle: 'Tur Yoreh Deah, Vilna, 1923', heVersion: 'בית יוסף על טור יורה דעה, וילנא תרפ״ג' },
  { key: 'eh', en: 'Even HaEzer', he: 'אבן העזר', versionTitle: 'Tur Even HaEzer, Vilna, 1923', heVersion: 'בית יוסף על טור אבן העזר, וילנא תרפ״ג' },
  { key: 'cm', en: 'Choshen Mishpat', he: 'חושן משפט', versionTitle: 'Tur Choshen Mishpat: Vilna, 1923', heVersion: 'בית יוסף על טור חושן משפט, וילנא תרפ״ג', bySeif: true },
];

// ---------- Sefaria ----------
async function getJson(url) {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'kazzohar-library-import/1.0' } });
      if (response.ok) return await response.json();
      if (response.status < 500 && response.status !== 429) fail(`${url}: HTTP ${response.status}`);
    } catch (error) { if (attempt === 6 || /HTTP 4/.test(error.message)) throw error; }
    await sleep(900 * attempt);
  }
  fail(`${url}: unreachable`);
}
async function cachedJson(name, url) {
  const file = join(CACHE, `${safe(name)}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  if (OFFLINE) fail(`offline and not cached: ${url}`);
  const data = await getJson(url);
  writeFileSync(file, JSON.stringify(data));
  await sleep(60);
  return data;
}
// Licences are read live on every run; the copy kept in the cache is only a record of what was seen.
async function liveVersions(title) {
  const file = join(CACHE, `${safe(`versions-${title}`)}.json`);
  if (OFFLINE) { if (!existsSync(file)) fail(`offline: no licence record for ${title}`); return JSON.parse(readFileSync(file, 'utf8')); }
  const data = await getJson(`${SEFARIA}/api/texts/versions/${encodeURIComponent(title)}`);
  if (!Array.isArray(data)) fail(`${title}: the versions API answered ${JSON.stringify(data).slice(0, 200)}`);
  writeFileSync(file, JSON.stringify(data));
  return data;
}
const exportUrl = versionTitle => `${SEFARIA}/download/version/${encodeURIComponent(`${TITLE} - he - ${versionTitle}`)}.json`;
const shapeUrl = ref => `${SEFARIA}/api/shape/${encodeURIComponent(ref)}`;

// ---------- Text: markup out, the author's additions (<small>) kept as ranges ----------
// → { text, g: [[from, to]] } for one paragraph; offsets count the cleaned text of this paragraph.
export function cleanParagraph(html, stats = {}) {
  const source = String(html ?? '')
    .replace(/<i\s+data-commentator=[^>]*>\s*<\/i>/g, () => { stats.markers = (stats.markers || 0) + 1; return ''; })
    .replace(/<br\s*\/?>/gi, ' ');
  const pieces = [];
  let cursor = 0;
  for (const m of source.matchAll(/<small>([\s\S]*?)<\/small>/g)) {
    pieces.push({ html: source.slice(cursor, m.index), small: false }, { html: m[1], small: true });
    cursor = m.index + m[0].length;
  }
  pieces.push({ html: source.slice(cursor), small: false });
  let text = '';
  const g = [];
  for (const piece of pieces) {
    const clean = cleanText(piece.html, stats);
    if (!clean) continue;
    // Punctuation printed right after a small passage stays attached to it.
    const joiner = text && !/^[:.,;)\]]/.test(clean) ? ' ' : '';
    const from = text.length + joiner.length;
    text += joiner + clean;
    if (piece.small) { g.push([from, text.length]); stats.additions = (stats.additions || 0) + 1; }
  }
  if (/<\/?small>/.test(text)) fail(`unbalanced <small> in: ${String(html).slice(0, 120)}`);
  return { text, g };
}
// Paragraphs of one unit joined by line breaks; their ranges moved to the unit's offsets.
function joinParagraphs(list, stats) {
  let text = '';
  const g = [];
  for (const html of list) {
    const paragraph = cleanParagraph(html, stats);
    if (!paragraph.text) continue;
    const offset = text ? text.length + 1 : 0;
    text = text ? `${text}\n${paragraph.text}` : paragraph.text;
    for (const [from, to] of paragraph.g) g.push([from + offset, to + offset]);
  }
  return { text, g };
}

// ---------- Build ----------
function compress(raw, path) {
  // The bytes on disk are kept when their content is unchanged, so a rebuild is identical on every Node version.
  if (existsSync(path)) {
    const disk = readFileSync(path);
    try { if (gunzipSync(disk).equals(Buffer.from(raw))) return disk; } catch { /* rebuilt below */ }
  }
  return gzipSync(Buffer.from(raw), { level: 9 });
}

async function main() {
  // Licence: live, per part; one source record for all four.
  const versions = await liveVersions(TITLE);
  const records = PARTS.map(part => {
    const version = versions.find(v => v.language === 'he' && v.versionTitle === part.versionTitle) || fail(`${TITLE}: version "${part.versionTitle}" is not listed by Sefaria`);
    if (String(version.license || '').trim().toLowerCase() !== 'public domain') fail(`${TITLE} / ${part.versionTitle}: licence "${version.license}" is not Public Domain`);
    return version;
  });
  const sources = new Set(records.map(v => v.versionSource));
  if (sources.size !== 1) fail(`${TITLE}: the four parts name different sources ${[...sources]}`);
  const versionSource = [...sources][0];
  // The Tur in the library is the same print (its versions name the same record).
  const tur = COLLECTION_INDEX.flatMap(pack => pack.works).find(work => work.workId === 'Tur') || fail('the Tur is not in the library');
  if (tur.versionSource !== versionSource) fail(`${TITLE}: source ${versionSource} differs from the Tur's ${tur.versionSource}`);
  const notUsed = versions.filter(v => v.language === 'he' && !PARTS.some(part => part.versionTitle === v.versionTitle)).map(v => ({ versionTitle: v.versionTitle, license: v.license || null, versionSource: v.versionSource || null, why: /public domain/i.test(v.license || '') ? 'not a complete edition of a part' : `licence "${v.license || 'none'}" is not open or not recorded; never imported` }));

  const stats = {};
  const nodes = [];      // { n, units }
  const expected = [];   // units per node
  const missing = [];
  const nodeTitles = [];
  const sections = [];
  const anchorNodes = []; // [turNode, byNode, firstUnit, lastUnit]
  const partRecords = [];
  let n = 0;
  const exports = new Map();
  for (const part of PARTS) {
    const data = await cachedJson(`export-${part.versionTitle}`, exportUrl(part.versionTitle));
    if (data.versionTitle !== part.versionTitle) fail(`${part.versionTitle}: export is "${data.versionTitle}"`);
    if (String(data.license || '').trim().toLowerCase() !== 'public domain') fail(`${part.versionTitle}: export licence "${data.license}"`);
    exports.set(part.key, data);
  }

  // The author's introduction (in the Orach Chayim volume).
  {
    const intro = exports.get('oc').text.Introduction;
    const list = (Array.isArray(intro) ? intro : []).filter(value => typeof value === 'string' && value.trim());
    const shape = await cachedJson('shape-Beit Yosef, Introduction', shapeUrl(`${TITLE}, Introduction`));
    const expectedCount = Number(shape[0]?.chapters) || list.length;
    n += 1;
    const units = [];
    list.forEach((html, i) => { const { text, g } = joinParagraphs([html], stats); if (text) units.push({ id: `${WORK_ID}.${n}.${i + 1}`, n: i + 1, text, ...(g.length ? { g } : {}) }); });
    nodes.push({ n, units });
    expected.push(Math.max(expectedCount, units.length));
    for (let u = 1; u <= expected.at(-1); u += 1) if (!units.some(unit => unit.n === u)) missing.push(`${WORK_ID}.${n}.${u}`);
    nodeTitles.push('הקדמה');
    sections.push({ title: 'הקדמה', from: n, to: n, edition: PARTS[0].versionTitle });
  }

  const turSection = heading => tur.sections.find(section => section.title === heading) || fail(`the Tur has no part "${heading}"`);
  for (const part of PARTS) {
    const data = exports.get(part.key);
    const body = data.text[part.en] || fail(`${part.versionTitle}: no "${part.en}" in the export`);
    const shape = (await cachedJson(`shape-Beit Yosef, ${part.en}`, shapeUrl(`${TITLE}, ${part.en}`)))[0].chapters;
    const turPart = turSection(part.he);
    const simanim = Math.max(shape.length, body.length);
    if (simanim !== turPart.to - turPart.from + 1) fail(`${part.he}: ${simanim} simanim, the Tur has ${turPart.to - turPart.from + 1}`);
    const from = n + 1;
    const partStats = { units: 0, expected: 0, additions: 0, simanimWithoutText: [] };
    const before = stats.additions || 0;
    for (let s = 0; s < simanim; s += 1) {
      const siman = s + 1;
      n += 1;
      const slots = Array.isArray(body[s]) ? body[s] : [];
      const shaped = Array.isArray(shape[s]) ? shape[s] : [];
      const units = [];
      let slotsExpected;
      if (part.bySeif) {
        // Choshen Mishpat: one unit per seif of the Tur that has text; the seif is its label.
        const seifim = Math.max(shaped.length, slots.length);
        let k = 0;
        slotsExpected = shaped.filter(count => count > 0).length;
        for (let f = 0; f < seifim; f += 1) {
          const list = (Array.isArray(slots[f]) ? slots[f] : [slots[f]]).filter(value => typeof value === 'string' && value.trim());
          const { text, g } = joinParagraphs(list, stats);
          if (!text) continue;
          k += 1;
          units.push({ id: `${WORK_ID}.${n}.${k}`, n: k, v: f + 1, label: hebrewNumeral(f + 1), text, ...(g.length ? { g } : {}) });
        }
        slotsExpected = Math.max(slotsExpected, units.length);
      } else {
        slotsExpected = Math.max(shaped.length, slots.length);
        for (let k = 0; k < slotsExpected; k += 1) {
          const list = (Array.isArray(slots[k]) ? slots[k] : [slots[k]]).filter(value => typeof value === 'string' && value.trim());
          const { text, g } = joinParagraphs(list, stats);
          if (text) units.push({ id: `${WORK_ID}.${n}.${k + 1}`, n: k + 1, text, ...(g.length ? { g } : {}) });
        }
      }
      // A siman the edition leaves empty is counted as one missing unit (never filled from elsewhere).
      if (!slotsExpected) { slotsExpected = 1; partStats.simanimWithoutText.push(siman); }
      const present = new Set(units.map(unit => unit.n));
      for (let u = 1; u <= slotsExpected; u += 1) if (!present.has(u)) missing.push(`${WORK_ID}.${n}.${u}`);
      nodes.push({ n, units });
      expected.push(slotsExpected);
      nodeTitles.push(`${part.he} · סימן ${hebrewNumeral(siman)}`);
      if (units.length) anchorNodes.push([turPart.from + s, n, units[0].n, units.at(-1).n]);
      partStats.units += units.length;
      partStats.expected += slotsExpected;
    }
    partStats.additions = (stats.additions || 0) - before;
    sections.push({ title: part.he, from, to: n, edition: part.versionTitle });
    partRecords.push({ part: part.key, he: part.he, versionTitle: part.versionTitle, heVersion: part.heVersion, recordedLicense: records[PARTS.indexOf(part)].license, versionSource, export: exportUrl(part.versionTitle), exportTextSha256: sha256(JSON.stringify(data.text[part.en])), shape: `${SEFARIA}/api/shape/${encodeURIComponent(`${TITLE}, ${part.en}`)}`, nodes: [from, n], simanim, turNodes: [turPart.from, turPart.to], ...partStats });
  }

  // Validate the whole book against the structure.
  const whole = { workId: WORK_ID, editionId: `${PACK_ID}:${WORK_ID}`, packId: PACK_ID, nodes: nodes.filter(node => node.units.length).map(node => ({ id: `${WORK_ID}.${node.n}`, n: node.n, units: node.units })) };
  const report = validateWorkChunk(whole, expected.map((units, i) => ({ n: i + 1, units })));
  if (report.duplicateIds.length || report.emptyUnits.length || report.invalidRefs.length || report.unexpectedUnits.length || report.orderErrors.length) fail(`${WORK_ID}: ${JSON.stringify({ d: report.duplicateIds.slice(0, 3), e: report.emptyUnits.slice(0, 3), i: report.invalidRefs.slice(0, 3), u: report.unexpectedUnits.slice(0, 3), o: report.orderErrors.slice(0, 3) })}`);
  if (report.missingUnits.length !== missing.length) fail(`missing units disagree (${report.missingUnits.length} vs ${missing.length})`);
  if (stats.brackets) fail(`${stats.brackets} paragraphs kept a literal angle bracket`);

  // Files by node range (never across two parts), each a checksummed chunk of the same edition.
  const staging = join(ROOT, 'public/library/packs', `${PACK_ID}.staging`);
  const packDir = join(ROOT, 'public/library/packs', PACK_ID);
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  const ranges = [];
  for (const section of sections) {
    let current = null;
    for (let node = section.from; node <= section.to; node += 1) {
      const units = nodes[node - 1].units;
      const size = Buffer.byteLength(JSON.stringify(units)) + 60;
      if (!current || (current.size + size > PART_TARGET && current.nodes.length)) { current = { from: node, to: node, size: 0, nodes: [] }; ranges.push(current); }
      current.to = node;
      current.size += size;
      if (units.length) current.nodes.push({ id: `${WORK_ID}.${node}`, n: node, units });
    }
  }
  const files = [];
  const parts = [];
  for (const range of ranges) {
    const body = JSON.stringify({ workId: WORK_ID, editionId: `${PACK_ID}:${WORK_ID}`, packId: PACK_ID, range: [range.from, range.to], nodes: range.nodes });
    const file = `${WORK_ID}.${range.from}-${range.to}.json.gz`;
    const packed = compress(body, join(packDir, file));
    writeFileSync(join(staging, file), packed);
    const record = { from: range.from, to: range.to, file, bytes: packed.length, rawBytes: Buffer.byteLength(body), checksum: checksum(body) };
    parts.push(record);
    files.push({ workId: WORK_ID, role: 'part', ...record });
  }
  const bytes = parts.reduce((total, part) => total + part.bytes, 0);
  const rawBytes = parts.reduce((total, part) => total + part.rawBytes, 0);
  const combined = checksum(parts.map(part => part.checksum).join('|'));
  const edition = { title: 'Sefaria — Beit Yosef, Vilna 1923 (four parts)', heTitle: 'בית יוסף · דפוס וילנא תרפ״ג · ספריא', editor: 'Sefaria (each part as recorded)', notes: 'ארבעה חלקים, גרסה אחת לכל חלק מאותו דפוס (רשומת הספרייה הלאומית אחת), ברישיון שנבדק מול ספריא בעת הבנייה. ניקוי סימון בלבד; תוספות "בדק הבית" מסומנות כבדפוס.' };
  const contentVersion = `Sefaria exports, licences verified live ${RETRIEVED_AT}`;
  writeFileSync(join(staging, 'manifest.json'), JSON.stringify({ packId: PACK_ID, contentVersion, family: 'corpus', category: 'halacha', structure: ['siman', 'segment'], license: 'public-domain', source: 'sefaria', edition, retrievedAt: RETRIEVED_AT, provenance: 'sources/beit-yosef/provenance.json', files }, null, 1));
  rmSync(packDir, { recursive: true, force: true });
  renameSync(staging, packDir);

  const coverage = coverageRecord({
    expectedUnits: report.expectedUnits, importedUnits: report.importedUnits, missingUnits: report.missingUnits,
    basis: 'Sefaria /api/shape/Beit Yosef, <part> (segments per siman; Choshen Mishpat: seifim of the Tur with text)', unit: 'segment',
    anchoredUnits: report.importedUnits - (nodes[0].units.length), unanchoredUnits: nodes[0].units.length, anchorBasis: 'the siman of the Tur (the same print, the same simanim)',
    parts: partRecords.map(({ part, he, units, expected: partExpected, simanimWithoutText, additions }) => ({ part, he, units, expected: partExpected, simanimWithoutText, additions })),
  });
  const work = {
    workId: WORK_ID, title: TITLE, heTitle: 'בית יוסף', shortTitle: 'בית יוסף', layerTitle: 'בית יוסף', layerRank: 1,
    group: 'tur-beit-yosef', aliases: ['ב"י', 'בית יוסף על הטור', 'בית יוסף אורח חיים', 'בית יוסף יורה דעה', 'בית יוסף אבן העזר', 'בית יוסף חושן משפט'],
    authors: ['רבי יוסף קארו'], compDate: null,
    editionTitle: PARTS.map(part => part.versionTitle).join(' · '), editionHeTitle: 'בית יוסף על הטור, דפוס וילנא תרפ״ג (ארבעה חלקים)',
    provider: 'sefaria', providerUrl: `${SEFARIA}/Beit_Yosef`, versionSource, license: 'public-domain', recordedLicense: 'Public Domain', licenseVerifiedAt: RETRIEVED_AT,
    sourceLine: 'בית יוסף · דפוס וילנא תרפ״ג · נחלת הכלל · ספריא',
    nodeLabel: 'סימן', unitLabel: 'קטע', nodeTitles, sections,
    status: report.status, missingUnits: report.missingUnits,
    file: parts[0].file, checksum: combined, bytes, rawBytes, parts,
    nodes: expected.map((_, i) => nodes[i].units.length), expected,
    relation: { relationType: 'commentary', baseWorkId: 'Tur', anchorScheme: 'siman' }, anchorNodes,
    coverage,
  };
  const pack = { packId: PACK_ID, contentVersion, family: 'corpus', category: 'halacha', structure: ['siman', 'segment'], nodeLabel: 'סימן', unitLabel: 'קטע', policy: 'source', source: 'sefaria', license: 'public-domain', edition, sourceUrl: SEFARIA, retrievedAt: RETRIEVED_AT, bytes, provenance: 'sources/beit-yosef/provenance.json', works: [work] };
  const reports = [{ workId: WORK_ID, expectedUnits: report.expectedUnits, importedUnits: report.importedUnits, status: report.status, checksum: combined, missing: report.missingUnits.length, anchored: coverage.anchoredUnits }];
  const index = { generatedAt: RETRIEVED_AT, packs: [pack], remoteLayers: [], blockedLayers: [], reports };
  writeFileSync(join(ROOT, 'src/data/library/corpus/beitYosef.mjs'), `// Generated by scripts/library/build-beit-yosef.mjs. Do not edit by hand.\nexport default ${JSON.stringify(index)};\n`);

  const provenance = {
    work: 'Beit Yosef (R. Yosef Karo) on the Tur, all four parts — Sefaria, the Vilna 1923 Tur with its commentaries, Public Domain',
    rule: 'Licences re-read live from /api/texts/versions/Beit Yosef at build time; only Public Domain is accepted for these four versions, and they must name one source record (the Tur\'s). NC and unknown versions are never imported. Nothing missing is filled from another edition.',
    modifications: 'Markup only: tags and entities removed; the empty commentary markers (<i data-commentator>) removed; the author\'s additions (בדק הבית), printed in smaller type (<small>), kept as ranges (unit.g) so the reader can mark them at the same reading size. Paragraph breaks kept as in the edition. The words were not changed.',
    anchors: 'Each siman is anchored to the same siman of the Tur in the library (the same print, the same simanim; checked per part). Choshen Mishpat units carry the seif of the Tur they explain (v), as the edition divides them.',
    versionSource,
    parts: partRecords,
    introduction: { from: PARTS[0].versionTitle, units: nodes[0].units.length },
    notUsed,
    stats: { commentaryMarkersRemoved: stats.markers || 0, additionsMarked: stats.additions || 0 },
    builtAt: RETRIEVED_AT,
  };
  mkdirSync(join(ROOT, 'sources/beit-yosef'), { recursive: true });
  writeFileSync(PROVENANCE, `${JSON.stringify(provenance, null, 1)}\n`);
  console.log(JSON.stringify({ bytes, rawBytes, files: parts.length, largest: Math.max(...parts.map(p => p.bytes)), status: report.status, expected: report.expectedUnits, imported: report.importedUnits, missing: report.missingUnits.length, parts: partRecords.map(p => [p.part, p.units, p.expected, p.simanimWithoutText, p.additions]), stats }, null, 1));
}

await main();
