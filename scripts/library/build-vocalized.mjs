#!/usr/bin/env node
// Vocalized editions (מהדורות מנוקדות) of works the library already carries without nikud.
// Run (Node 20, so the gzip bytes are deterministic):
//   npx -y node@20 scripts/library/build-vocalized.mjs [--cache /tmp/kz-library-cache/vocalized] [--offline]
//                                                     [--retrieved-at YYYY-MM-DD] [--report]
//
// The owner's rule (2026-10-01): only an EXISTING vocalized edition with a compatible licence may stand in for an
// unvocalized text. The app never adds nikud itself, and nothing here does: every word comes from the named edition.
// Each candidate below is one exact Sefaria version; it is imported only if it passes every gate:
//   1. Licence, re-read LIVE from /api/texts/versions/<Title> (the export's own licence must agree): Public Domain,
//      CC0, CC-BY, CC-BY-SA, or — the owner's policy for this free app, with attribution — CC-BY-NC / CC-BY-NC-SA.
//   2. Same structure: every unit of the bundled edition is located in the bundled edition's own Sefaria export (its
//      anchors give the address; the unit's words must equal that export segment's words), and the vocalized export
//      has text at the very same address. Unit ids, node counts and anchors stay identical, so links, bookmarks and
//      search references keep working. A unit the vocalized edition lacks fails the work, unless the plan names that
//      address with a reason (a colophon) — then the bundled unit is kept as it is and recorded.
//   3. Same text: the words, compared without nikud, te'amim and the letters ו/י (vocalized editions spell
//      "ktiv chaser"), agree with the bundled edition unit by unit — beyond the abbreviations a vocalizing editor opens
//      (ב״ד → בית דין), at most a word or two (or 10%) may differ on either side — and over the work (WORK_AGREEMENT).
//   4. Vocalized: at least MIN_NIKUD vowel points per Hebrew letter over the whole new text.
// A passing work becomes the default edition (editions[0]) in src/data/library/registry.mjs; the bundled
// unvocalized edition stays in its pack, untouched, as editions[1] (the fallback). Rejections are recorded with reasons.
// Markup cleanup only (scripts/library/clean.mjs, bold opening words kept apart as dh, as build-commentary.mjs does).
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checksum } from '../../src/services/prayer/checksum.mjs';
import { tokenize } from '../../src/services/torah/hebrew.mjs';
import CORPUS_INDEX from '../../src/data/library/corpusIndex.mjs';
import { cleanText } from './clean.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const CACHE = arg('--cache', '/tmp/kz-library-cache/vocalized');
const OFFLINE = args.includes('--offline');
const REPORT_ONLY = args.includes('--report');
const RETRIEVED_AT = arg('--retrieved-at', new Date().toISOString().slice(0, 10));
const SEFARIA = 'https://www.sefaria.org';
const PACKS_DIR = join(ROOT, 'public/library/packs');
const UA = { Accept: 'application/json', 'User-Agent': 'kazzohar-library-import/1.0' };
mkdirSync(CACHE, { recursive: true });

export const WORK_AGREEMENT = 0.95;
export const MIN_NIKUD = 0.5;
// At most this share of a work's comments may stay as the bundled edition has them (a comment the vocalized edition
// lacks or words differently, and its unequal neighbours); the rest of the work reads vocalized.
export const MAX_KEPT_SHARE = 0.03;

const fail = message => { throw new Error(message); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha256 = text => createHash('sha256').update(text).digest('hex');
const safe = name => name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 180);

// ---------- The candidates (docs/library/nikud-audit.md §2 records how each was found and why others were refused) ----------
const MISHNAH_TRACTATES = CORPUS_INDEX.find(pack => pack.packId === 'sefaria-mishnah-commentary-public-domain').works
  .filter(work => work.workId.startsWith('Bartenura_on_') && work.editionTitle === 'On Your Way').map(work => work.title);
export const VOCALIZED_PLAN = [
  // Bartenura: Torat Emet's vocalized edition (toratemetfreeware.com, via Sefaria "Torat-Emet"), recorded CC-BY-NC.
  // Bartenura on Avot is already vocalized (ToratEmet, PD) and is not a candidate.
  ...MISHNAH_TRACTATES.map(title => ({ title, workId: title.replace(/['’]/g, '').replace(/[^A-Za-z0-9]+/g, '_'), versionTitle: 'Torat-Emet', heVersion: 'תורת אמת (מנוקד)' })),
  // Ramban on Genesis: Sefaria's "Vocalized Edition", recorded CC-BY. Two segments of the bundled edition are scribal
  // colophons that the vocalized edition does not print; they stay as they are.
  { title: 'Ramban on Genesis', workId: 'Ramban_on_Genesis', versionTitle: 'Vocalized Edition', heVersion: 'מהדורה מנוקדת (ספריא)', carryOver: { '32:2:2': 'חסלת פרשת ויצא — סימן סוף פרשה של המעתיק', '49:33:3': 'תם ונשלם שבח לבורא עולם — קולופון' } },
];

const OPEN = { 'public domain': 'public-domain', pd: 'public-domain', cc0: 'public-domain', 'cc-by': 'cc-by', 'cc-by-sa': 'cc-by-sa', 'cc-by-nc': 'cc-by-nc', 'cc-by-nc-sa': 'cc-by-nc-sa' };
const LICENCE_HE = { 'public-domain': 'נחלת הכלל', 'cc-by': 'CC BY', 'cc-by-sa': 'CC BY-SA', 'cc-by-nc': 'CC BY-NC', 'cc-by-nc-sa': 'CC BY-NC-SA' };
const LICENCE_URL = { 'cc-by': 'https://creativecommons.org/licenses/by/4.0/', 'cc-by-sa': 'https://creativecommons.org/licenses/by-sa/4.0/', 'cc-by-nc': 'https://creativecommons.org/licenses/by-nc/4.0/', 'cc-by-nc-sa': 'https://creativecommons.org/licenses/by-nc-sa/4.0/' };
const licenceId = value => OPEN[String(value || '').trim().toLowerCase().replace(/\s+\d(\.\d)*$/, '')] || null;

// ---------- Network (cached; licences always live) ----------
async function getJson(url) {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const response = await fetch(url, { headers: UA });
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
async function liveVersions(title) {
  const file = join(CACHE, `${safe(`versions-${title}`)}.json`);
  if (OFFLINE) { if (!existsSync(file)) fail(`offline: no licence record for ${title}`); return JSON.parse(readFileSync(file, 'utf8')); }
  const data = await getJson(`${SEFARIA}/api/texts/versions/${encodeURIComponent(title)}`);
  if (!Array.isArray(data)) fail(`${title}: the versions API answered ${JSON.stringify(data).slice(0, 200)}`);
  writeFileSync(file, JSON.stringify(data));
  return data;
}
const versionsUrl = title => `${SEFARIA}/api/texts/versions/${encodeURIComponent(title)}`;
const exportUrl = (title, versionTitle) => `${SEFARIA}/download/version/${encodeURIComponent(`${title} - he - ${versionTitle}`)}.json`;

// ---------- Text ----------
const INVISIBLE = /[‎‏‪-‮]/g;
const plainText = html => cleanText(String(html ?? '').replace(INVISIBLE, ''));
// The opening words printed in bold are kept apart (as build-commentary.mjs does), never merged into the comment.
function splitComment(html) {
  const value = String(html ?? '').replace(INVISIBLE, '');
  const m = /^\s*<b>([\s\S]*?)<\/b>([\s\S]*)$/.exec(value);
  if (m) {
    let dh = cleanText(m[1]);
    let rest = cleanText(m[2]);
    const lead = /^([.:,;־–—]+)\s*/.exec(rest);
    if (lead) { dh = `${dh}${lead[1]}`; rest = rest.slice(lead[0].length); }
    if (dh && rest) return { dh, text: rest };
  }
  return { text: cleanText(value) };
}
const NIKUD = /[ְ-ׇּׁׂ]/gu;
const LETTER = /[א-ת]/gu;
export const nikudRatioOf = text => { const letters = (text.match(LETTER) || []).length; return letters ? (text.match(NIKUD) || []).length / letters : 0; };
const skeleton = word => word.replace(/[וי]/g, '');
function lcsLength(a, b) {
  if (!a.length || !b.length) return 0;
  let prev = new Uint32Array(b.length + 1);
  let cur = new Uint32Array(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}
// Words of two renderings of one unit, compared without nikud/te'amim (tokenize) and without ו/י. A vocalizing editor
// opens abbreviations (ר״ע → רבי עקיבא, ד׳ → ארבעה), so an old word written as an abbreviation (with ׳ ״ ' ") may go
// unmatched and the new words that spell it out may too: each opened abbreviation may account for up to
// ABBREVIATION_WORDS new words. Beyond that, a unit may differ by at most max(SLACK_WORDS, SLACK_RATIO × its words) words
// on each side (a spelling variant such as טבלא/טבלה).
export const ABBREVIATION_WORDS = 3;
export const SLACK_WORDS = 2;
export const SLACK_RATIO = 0.1;
const ABBREVIATION = /[\u05F3\u05F4'"׳״]/;
const words = text => scanWords(text);
function scanWords(text) {
  // Every word with its abbreviation flag (the original spelling between separators carries the mark).
  return String(text ?? '').split(/[\s\u05BE\-–—/,.:;!?()[\]{}]+/u).flatMap(raw => {
    const tokens = tokenize(raw);
    return tokens.map(norm => ({ norm: skeleton(norm), abbreviation: ABBREVIATION.test(raw) && tokens.length === 1 }));
  });
}
function lcsMatch(a, b) {
  // Which items of a and b take part in one longest common subsequence (by norm).
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) for (let j = m - 1; j >= 0; j -= 1) dp[i][j] = a[i].norm === b[j].norm ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const inA = new Uint8Array(n);
  const inB = new Uint8Array(m);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i].norm === b[j].norm) { inA[i] = 1; inB[j] = 1; i += 1; j += 1; } else if (dp[i + 1][j] >= dp[i][j + 1]) i += 1; else j += 1;
  }
  return { common: dp[0][0], inA, inB };
}
export function agreement(oldText, newText) {
  const a = words(oldText);
  const b = words(newText);
  if (a.length * b.length > 4e7) { const common = lcsLength(a.map(w => w.norm), b.map(w => w.norm)); return { oldWords: a.length, newWords: b.length, common, recall: common / a.length, precision: common / b.length, pass: common / a.length >= 0.95 && common / b.length >= 0.9 }; }
  const { common, inA, inB } = lcsMatch(a, b);
  const lostAbbreviations = a.filter((w, i) => !inA[i] && w.abbreviation).length;
  const lostWords = a.filter((w, i) => !inA[i] && !w.abbreviation).length;
  const newWords = b.filter((w, i) => !inB[i]).length;
  const slack = Math.max(SLACK_WORDS, Math.ceil(SLACK_RATIO * a.length));
  const pass = lostWords <= slack && newWords <= lostAbbreviations * ABBREVIATION_WORDS + slack;
  return { oldWords: a.length, newWords: b.length, common, recall: a.length ? common / a.length : 1, precision: b.length ? common / b.length : 1, lostWords, lostAbbreviations, addedWords: newWords, pass };
}
const unitText = unit => [unit.dh, unit.text].filter(Boolean).join(' ');

// ---------- One work ----------
const corpusWork = workId => {
  for (const pack of CORPUS_INDEX) { const work = pack.works.find(item => item.workId === workId); if (work) return { pack, work }; }
  return fail(`${workId}: not a bundled corpus work`);
};
const readPack = (packId, file, expected) => {
  const bytes = readFileSync(join(PACKS_DIR, packId, file));
  const text = (bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes).toString('utf8');
  if (expected && checksum(text) !== expected) fail(`checksum mismatch: ${packId}/${file}`);
  return JSON.parse(text);
};
// Every segment of an export with its address ("c:v:k", or "Part:k" for a named part).
function leaves(value, path = [], out = []) {
  if (typeof value === 'string') { out.push([path.join(':'), value]); return out; }
  if (Array.isArray(value)) value.forEach((item, i) => leaves(item, [...path, i + 1], out));
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) leaves(item, key === '' ? path : [...path, key], out);
  return out;
}
// The export's segment at an address: "c:v:k" in the body (key "" of a complex text), or "Part:k" in a named part.
function segmentAt(text, address) {
  const parts = address.split(':');
  let node = Array.isArray(text) ? text : (/^\d+$/.test(parts[0]) ? text[''] : text);
  for (const part of parts) {
    if (node == null) return null;
    node = /^\d+$/.test(part) && Array.isArray(node) ? node[Number(part) - 1] : node[part];
  }
  return typeof node === 'string' ? node : null;
}
const PART_KEY = { הקדמה: ['Introduction', 'Prelude'], פתיחה: ['Foreword', 'Prelude', 'Introduction'] };

async function buildOne(item) {
  const { pack, work } = corpusWork(item.workId);
  const versions = await liveVersions(item.title);
  const current = versions.find(v => v.language === 'he' && v.versionTitle === work.editionTitle) || fail(`${item.title}: the bundled version "${work.editionTitle}" is no longer listed`);
  const target = versions.find(v => v.language === 'he' && v.versionTitle === item.versionTitle);
  if (!target) return { reject: `version "${item.versionTitle}" is not listed by Sefaria` };
  const license = licenceId(target.license);
  if (!license) return { reject: `licence "${target.license || '(none)'}" is not one the library accepts` };
  const [oldExport, newExport] = await Promise.all([
    cachedJson(`export-${item.title}-${work.editionTitle}`, exportUrl(item.title, work.editionTitle)),
    cachedJson(`export-${item.title}-${item.versionTitle}`, exportUrl(item.title, item.versionTitle)),
  ]);
  if (newExport.versionTitle !== item.versionTitle) fail(`${item.title}: export is "${newExport.versionTitle}"`);
  if (licenceId(newExport.license) !== license) return { reject: `export licence "${newExport.license}" differs from the live record "${target.license}"` };
  if (current.versionTitle !== oldExport.versionTitle) fail(`${item.title}: bundled export mismatch`);

  const chunk = readPack(pack.packId, work.file, work.checksum);
  const anchors = work.anchorsFile ? readPack(pack.packId, work.anchorsFile, work.anchorsChecksum) : { anchors: [] };
  const addressOf = new Map(anchors.anchors.map(row => [row.unitId, row.canonicalRef.slice(item.title.length + 1)]));
  const nodeTitles = work.nodeTitles || [];
  const wordsOf = text => tokenize(text).join(' ');
  // A unit without an anchor (a named part, a chapter the anchors skip) is found by its words in the bundled export.
  const byWords = new Map();
  for (const [address, seg] of leaves(oldExport.text)) { const key = wordsOf(plainText(seg)); if (key) { if (!byWords.has(key)) byWords.set(key, []); byWords.get(key).push(address); } }
  const used = new Set();
  const problems = [];
  const carried = [];
  const shifted = [];
  const located = chunk.nodes.map((node, index) => node.units.map(unit => {
    const own = wordsOf(unitText(unit));
    let address = addressOf.get(unit.id) || null;
    if (!address) {
      const keys = PART_KEY[nodeTitles[index]] || [];
      address = keys.map(key => `${key}:${unit.n}`).find(candidate => { const seg = segmentAt(oldExport.text, candidate); return seg && wordsOf(plainText(seg)) === own; })
        || (byWords.get(own) || []).find(candidate => !used.has(candidate)) || null;
    }
    const oldSeg = address && segmentAt(oldExport.text, address);
    if (!oldSeg || wordsOf(plainText(oldSeg)) !== own) { problems.push(`${unit.id}: not located in the bundled edition's export`); return { unit, address: null }; }
    used.add(address);
    const newSeg = segmentAt(newExport.text, address);
    const fresh = newSeg ? splitComment(newSeg) : null;
    if (!fresh || !tokenize(unitText(fresh)).length) {
      if (item.carryOver?.[address]) { carried.push({ unitId: unit.id, address, reason: item.carryOver[address] }); return { unit, address, carried: true }; }
      problems.push(`${unit.id} (${address}): no text in the vocalized edition`);
      return { unit, address, fresh: null };
    }
    return { unit, address, fresh, score: agreement(unitText(unit), unitText(fresh)) };
  }));
  // Where an edition moves the border between two neighbouring comments (a sentence printed as the next comment's
  // opening words), the pair is judged together: it passes if the two comments, joined, are the same words.
  for (const units of located) {
    for (let i = 0; i < units.length; i += 1) {
      const row = units[i];
      if (!row.score || row.score.pass) continue;
      const next = units[i + 1];
      const prev = units[i - 1];
      const pairWith = [next, prev].find(other => other?.score && agreement(`${unitText((other === next ? row : other).unit)} ${unitText((other === next ? other : row).unit)}`, `${unitText((other === next ? row : other).fresh)} ${unitText((other === next ? other : row).fresh)}`).pass);
      if (pairWith) { row.pairPass = true; shifted.push([row.unit.id, pairWith.unit.id].sort().join(' + ')); }
    }
  }
  let oldWords = 0;
  let common = 0;
  const rows = [];
  // A comment the vocalized edition lacks, or prints with other words, is not taken from it: the bundled comment stays
  // there as it is (unvocalized), and so do its neighbours whose words are not the same (the border between them may
  // have moved, so taking them would drop or repeat words). Recorded in verification.carriedOver. Only a few comments
  // per work may be kept so (MAX_KEPT_SHARE); more, and the work is refused.
  const differing = [];
  const keptReason = new Map();
  const sameWords = row => row.score && row.score.lostWords === 0 && row.score.addedWords <= row.score.lostAbbreviations * ABBREVIATION_WORDS;
  for (const units of located) {
    const queue = [];
    units.forEach((row, i) => {
      const words = row.score && `${row.score.lostWords} word(s) missing, ${row.score.addedWords} added (${row.score.lostAbbreviations} abbreviation(s) opened)`;
      const reason = !row.address || row.carried ? null : !row.fresh ? 'no text in the vocalized edition' : !row.score.pass && !row.pairPass ? `words differ: ${words}` : null;
      if (!reason) return;
      differing.push(`${row.unit.id} (${row.address}): ${reason}`);
      keptReason.set(row, `bundled comment kept — ${reason}`);
      queue.push(i);
    });
    // Outward from each kept comment, until a neighbour with the same words (the chain of moved borders ends there).
    while (queue.length) {
      const i = queue.shift();
      for (const j of [i - 1, i + 1]) {
        const other = units[j];
        if (!other?.fresh || other.carried || keptReason.has(other) || sameWords(other)) continue;
        keptReason.set(other, `bundled comment kept — beside ${units[i].unit.id}, words not the same`);
        queue.push(j);
      }
    }
  }
  // Only a unit that could not be located in the bundled export fails the work outright; the others are decided here.
  problems.splice(0, problems.length, ...problems.filter(problem => /not located/.test(problem)));
  const unitCount = located.flat().length;
  if (keptReason.size > Math.max(1, Math.floor(MAX_KEPT_SHARE * unitCount))) problems.push(...differing);
  else for (const [row, reason] of keptReason) { row.kept = true; carried.push({ unitId: row.unit.id, address: row.address, reason }); }
  for (const row of located.flat()) {
    if (!row.score) continue;
    oldWords += row.score.oldWords;
    common += row.score.common;
    rows.push(row.score);
  }
  const nodes = chunk.nodes.map((node, index) => ({
    ...node,
    units: located[index].map(({ unit, fresh, carried: planned, kept }) => {
      if (planned || kept || !fresh) return unit;
      const { dh, text, ...rest } = unit;
      return { ...rest, ...(fresh.dh ? { dh: fresh.dh } : {}), text: fresh.text };
    }),
  }));
  const workAgreement = oldWords ? common / oldWords : 0;
  const newText = nodes.flatMap(node => node.units.map(unitText)).join(' ');
  const nikud = nikudRatioOf(newText);
  const verification = {
    units: located.flat().length, comparedUnits: rows.length, carriedOver: carried, borderShifts: [...new Set(shifted)],
    identicalWordsUnits: rows.filter(row => row.common === row.oldWords && row.common === row.newWords).length,
    openedAbbreviations: rows.reduce((total, row) => total + (row.lostAbbreviations || 0), 0),
    workAgreement: Number(workAgreement.toFixed(4)), nikudPerLetter: Number(nikud.toFixed(3)),
    rule: `nikud-, te'amim- and ו/י-insensitive words; per unit ≤ max(${SLACK_WORDS}, ${SLACK_RATIO * 100}%) words differ on each side beyond opened abbreviations (≤ ${ABBREVIATION_WORDS} words each); neighbouring comments judged together where the border moved; work ≥ ${WORK_AGREEMENT * 100}%; nikud ≥ ${MIN_NIKUD}/letter`,
  };
  if (problems.length) return { reject: `${problems.length} unit(s) fail: ${problems.slice(0, 4).join('; ')}${problems.length > 4 ? ' …' : ''}`, verification, license, problems };
  if (workAgreement < WORK_AGREEMENT) return { reject: `words agree ${(workAgreement * 100).toFixed(1)}% (< ${WORK_AGREEMENT * 100}%)`, verification, license };
  if (nikud < MIN_NIKUD) return { reject: `only ${nikud.toFixed(2)} vowel points per letter`, verification, license };
  return { pack, work, target, license, nodes, verification, exportSha256: sha256(JSON.stringify(newExport.text)) };
}

// ---------- Output ----------
const packIdFor = license => `sefaria-vocalized-${license}`;
function compress(raw, path) {
  if (path && existsSync(path)) {
    const disk = readFileSync(path);
    try { if (gunzipSync(disk).equals(Buffer.from(raw))) return disk; } catch { /* not a valid gzip: rebuild it */ }
  }
  return gzipSync(raw, { level: 9 });
}

async function main() {
  const built = [];
  const rejected = [];
  for (const item of VOCALIZED_PLAN) {
    const result = await buildOne(item);
    const line = `${item.title} ← "${item.versionTitle}"`;
    if (result.reject) { rejected.push({ workId: item.workId, title: item.title, versionTitle: item.versionTitle, license: result.license || null, reason: result.reject, verification: result.verification || null }); console.log(`REJECT ${line}: ${result.reject}`); continue; }
    built.push({ item, ...result });
    console.log(`OK     ${line}: ${result.license}, words agree ${(result.verification.workAgreement * 100).toFixed(2)}%, nikud ${result.verification.nikudPerLetter}`);
  }
  if (REPORT_ONLY) return;

  const byPack = new Map();
  for (const entry of built) { const id = packIdFor(entry.license); if (!byPack.has(id)) byPack.set(id, []); byPack.get(id).push(entry); }
  const works = {};
  const packs = [];
  for (const [packId, entries] of byPack) {
    const staging = join(PACKS_DIR, `${packId}.staging`);
    rmSync(staging, { recursive: true, force: true });
    mkdirSync(staging, { recursive: true });
    const files = [];
    for (const entry of entries.sort((a, b) => a.item.workId.localeCompare(b.item.workId))) {
      const { item, work, target, license, nodes, verification } = entry;
      const editionId = `${packId}:${work.workId}`;
      const raw = JSON.stringify({ workId: work.workId, editionId, packId, nodes });
      const file = `${work.workId}.json.gz`;
      const gz = compress(raw, join(PACKS_DIR, packId, file));
      writeFileSync(join(staging, file), gz);
      const sum = checksum(raw);
      files.push({ workId: work.workId, file, bytes: gz.length, rawBytes: Buffer.byteLength(raw), checksum: sum });
      const licenceHe = LICENCE_HE[license];
      works[work.workId] = {
        workId: work.workId, packId, file, checksum: sum, bytes: gz.length, rawBytes: Buffer.byteLength(raw),
        title: item.title, editionTitle: item.versionTitle, editionHeTitle: item.heVersion, versionSource: target.versionSource || null,
        license, recordedLicense: String(target.license).trim(), licenseVerifiedAt: RETRIEVED_AT,
        sourceLine: `${work.layerTitle || work.heTitle} · ${item.heVersion} · ${licenceHe} · ספריא`,
        attribution: { text: `${work.heTitle} — ${item.heVersion}${target.versionSource ? ` (${target.versionSource.replace(/^https?:\/\//, '').replace(/\/$/, '')})` : ''}, ${licenceHe}, דרך ספריא`, url: target.versionSource || null, licenseUrl: LICENCE_URL[license] || null, modified: `עיבוד: ניקוי סימון בלבד; מילות הפתיחה המודגשות נשמרו בנפרד. המילים והניקוד כפי שהם במהדורה.${verification.carriedOver.length ? ` ${verification.carriedOver.length === 1 ? 'קטע אחד שאינו במהדורה המנוקדת כלשונו מובא כפי שהוא' : `${verification.carriedOver.length} קטעים שאינם במהדורה המנוקדת כלשונם מובאים כפי שהם`} במהדורה הלא־מנוקדת (${work.editionHeTitle || work.editionTitle}).` : ''}` },
        fallback: { packId: entry.pack.packId, file: work.file, checksum: work.checksum, editionTitle: work.editionTitle },
        verification,
      };
    }
    const manifest = {
      packId, contentVersion: `Sefaria exports, licences verified live ${RETRIEVED_AT}`, family: 'vocalized', license: [...new Set(entries.map(entry => entry.license))][0], source: 'sefaria',
      edition: { title: `Sefaria — vocalized editions (${entries[0].license})`, heTitle: 'מהדורות מנוקדות · ספריא', editor: 'Sefaria (each edition as recorded per book)', notes: 'כל ספר במהדורה מנוקדת אחת מוצמדת (versionTitle), שנבדקה מול המהדורה הלא־מנוקדת שבספרייה: אותם קטעים, אותן מילים. המהדורה הלא־מנוקדת נשמרת בחבילתה כגיבוי.' },
      retrievedAt: RETRIEVED_AT, provenance: 'sources/vocalized/provenance.json', files,
    };
    writeFileSync(join(staging, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);
    rmSync(join(PACKS_DIR, packId), { recursive: true, force: true });
    renameSync(staging, join(PACKS_DIR, packId));
    packs.push({ packId, license: manifest.license, works: files.length, bytes: files.reduce((total, file) => total + file.bytes, 0) });
  }
  const sortedWorks = Object.fromEntries(Object.entries(works).sort(([a], [b]) => a.localeCompare(b)));
  const module = `// Generated by scripts/library/build-vocalized.mjs. Do not edit by hand.\n// Vocalized editions that stand in for a bundled unvocalized edition (which stays as the fallback edition).\nexport default ${JSON.stringify({ generatedAt: RETRIEVED_AT, packs, works: sortedWorks })};\n`;
  writeFileSync(join(ROOT, 'src/data/library/vocalizedIndex.mjs'), module);
  mkdirSync(join(ROOT, 'sources/vocalized'), { recursive: true });
  const provenance = {
    work: 'Vocalized editions of works the library carries without nikud (Sefaria exports, one pinned version per work)',
    rule: 'Owner, 2026-10-01: only existing vocalized editions with a compatible licence; the app never adds nikud itself. Licences re-read live from /api/texts/versions/<Title> at build time; accepted: Public Domain, CC0, CC-BY, CC-BY-SA, and CC-BY-NC / CC-BY-NC-SA under the owner\'s non-commercial policy (with attribution).',
    verification: `Each unit is located in the bundled edition's own export (its anchor address; identical words), and the vocalized edition must have text at the same address. Words compared without nikud, te'amim and ו/י; per unit at most max(${SLACK_WORDS}, ${SLACK_RATIO * 100}%) words may differ on either side beyond abbreviations the vocalizing editor opened (each may become up to ${ABBREVIATION_WORDS} words); neighbouring comments are judged together where the edition moved the border between them; work agreement ≥ ${WORK_AGREEMENT}; at least ${MIN_NIKUD} vowel points per letter.`,
    modifications: 'Markup only: tags, empty commentator markers and directional marks removed; the bold opening words kept apart as unit.dh. Words and nikud are the edition\'s own.',
    fallback: 'The unvocalized edition stays in its pack (unchanged) and is listed as the work\'s second edition.',
    editions: built.map(({ item, work, target, license, verification, exportSha256 }) => ({ workId: work.workId, title: item.title, versionTitle: item.versionTitle, recordedLicense: String(target.license).trim(), license, versionSource: target.versionSource || null, versions: versionsUrl(item.title), export: exportUrl(item.title, item.versionTitle), exportTextSha256: exportSha256, licenseVerifiedAt: RETRIEVED_AT, replaces: { versionTitle: work.editionTitle, packId: corpusWork(work.workId).pack.packId }, verification })),
    rejected,
  };
  writeFileSync(join(ROOT, 'sources/vocalized/provenance.json'), `${JSON.stringify(provenance, null, 1)}\n`);
  console.log(`${built.length} vocalized, ${rejected.length} rejected; ${packs.map(pack => `${pack.packId}: ${pack.works} works, ${(pack.bytes / 1024).toFixed(0)} KB`).join('; ')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
