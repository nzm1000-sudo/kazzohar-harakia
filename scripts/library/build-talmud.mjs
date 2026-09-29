// The Talmud canonical local layer: the Babylonian Talmud (Wikisource transcription, CC BY-SA) with Rashi and Tosafot
// anchored to the Gemara segment they explain, the Rif as books of their own, and the second-tier Rishonim registered
// as remote layers — on the relation/anchor/coverage model of docs/library/content-model.md.
// Run: node scripts/library/build-talmud.mjs [--cache /tmp/kz-library-cache/talmud] [--offline] [--retrieved-at YYYY-MM-DD]
//
// - Base text: "Wikisource Talmud Bavli" (Sefaria's copy of he.wikisource תלמוד בבלי), one pinned version per tractate.
//   Sefaria records it CC-BY-SA; it ships as CC BY-SA 4.0 with attribution. Its segmentation is Sefaria's canonical
//   one (the same as the William Davidson edition and every commentary ref), checked here against /api/shape and the
//   app's own catalog (src/data/talmudCatalog.mjs): a tractate whose amud/segment grid differs stops the build.
// - Node = amud, on the tractate's printed pagination (pagination descriptor, one volume per tractate: node 1 = the
//   first amud, 2a for most; 25b for Tamid). Unit = one Gemara segment (Berakhot 2a:3 → Bavli_Berakhot.1.3).
// - Rashi / Tosafot: Sefaria "Vilna Edition" (Rashi on Rosh Hashanah: "WikiSource Rashi", the Vilna version there has no
//   recorded licence). Node = the same amud as the base (same pagination); unit = one comment, numbered by its place in
//   Sefaria's /api/shape of the commentary so ids never shift; v = the Gemara segment (from the commentary's own ref:
//   "Rashi on Berakhot 2a:3:1" → Berakhot 2a:3). The opening words (dibbur hamatchil) stay apart from the comment.
// - Rif: "Vilna Edition", on the Rif's own pages. Sefaria's links from the Rif to the Gemara carry no published licence
//   (docs/library/corpus-gap-report.md §9.2), so the Rif is not anchored to the Gemara daf: it is a book per tractate.
// - Remote only (download tier): Rosh, Ran, Maharsha (halachot, aggadot), Chiddushei HaRamban, Ritva — one exact
//   public-domain edition each, licence re-read live; counted from the edition's own export.
// - Licences are re-read LIVE from /api/texts/versions/<Title> on every run; only Public Domain / CC0 / CC-BY / CC-BY-SA
//   pass, NC and unknown stop the build. A version whose versionSource is he.wikisource.org ships as CC BY-SA 4.0.
// - Packs are split by licence and stored one file per tractate and per commentary, gzip, checksum over the JSON text.
// Markup cleanup only: the words of an edition are never changed.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checksum } from '../../src/services/prayer/checksum.mjs';
import { COVERAGE, coverageRecord, validateWorkChunk } from '../../src/services/library/integrity.mjs';
import { amudIndex, amudLabel, indexAmud } from '../../src/services/library/pagination.mjs';
import catalog from '../../src/data/talmudCatalog.mjs';
import { cleanText } from './clean.mjs';
import { WIKISOURCE_LICENSE } from './wikisource.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const CACHE = arg('--cache', '/tmp/kz-library-cache/talmud');
const OFFLINE = args.includes('--offline');
const RETRIEVED_AT = arg('--retrieved-at', new Date().toISOString().slice(0, 10));
const SEFARIA = 'https://www.sefaria.org';
mkdirSync(CACHE, { recursive: true });
const fail = message => { throw new Error(message); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha256 = text => createHash('sha256').update(text).digest('hex');
const safe = name => name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 180);

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
// Licences are read live on every run (the copy kept in the cache is only a record of what was seen).
async function liveVersions(title) {
  const file = join(CACHE, `${safe(`versions-${title}`)}.json`);
  if (OFFLINE) { if (!existsSync(file)) fail(`offline: no licence record for ${title}`); return JSON.parse(readFileSync(file, 'utf8')); }
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const data = await getJson(`${SEFARIA}/api/texts/versions/${encodeURIComponent(title)}`);
    if (Array.isArray(data)) { writeFileSync(file, JSON.stringify(data)); return data; }
    if (attempt === 5) fail(`${title}: the versions API answered ${JSON.stringify(data).slice(0, 200)}`);
    await sleep(1500 * attempt);
  }
}
const exportUrl = (title, versionTitle) => `${SEFARIA}/download/version/${encodeURIComponent(`${title} - he - ${versionTitle}`)}.json`;
const shapeUrl = title => `${SEFARIA}/api/shape/${encodeURIComponent(title)}`;
const versionsUrl = title => `${SEFARIA}/api/texts/versions/${encodeURIComponent(title)}`;

const OPEN = { 'public domain': 'public-domain', pd: 'public-domain', cc0: 'public-domain', 'cc-by': 'cc-by', 'cc-by-sa': 'cc-by-sa' };
function licenceOf(version, title) {
  const recorded = String(version.license || '').trim();
  const id = OPEN[recorded.toLowerCase()];
  if (!id) fail(`${title} / ${version.versionTitle}: licence "${recorded}" is not open (NC and unknown are never imported)`);
  const wikisource = /wikisource\.org/i.test(version.versionSource || '');
  return { license: wikisource ? 'cc-by-sa' : id, recordedLicense: recorded, wikisource };
}
async function pool(items, size, run) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => { while (next < items.length) { const i = next; next += 1; out[i] = await run(items[i], i); } }));
  return out;
}
async function loadEdition(title, versionTitle) {
  const versions = await liveVersions(title);
  const version = versions.find(v => v.language === 'he' && v.versionTitle === versionTitle) || fail(`${title}: version "${versionTitle}" is not listed by Sefaria`);
  const licence = licenceOf(version, title);
  const data = await cachedJson(`export-${title}-${versionTitle}`, exportUrl(title, versionTitle));
  if (data.versionTitle !== versionTitle) fail(`${title}: export is "${data.versionTitle}"`);
  if (String(data.license || '').trim().toLowerCase() !== licence.recordedLicense.toLowerCase()) fail(`${title}: export licence "${data.license}" differs from the live record "${licence.recordedLicense}"`);
  return { version, licence, data, exportSha256: sha256(JSON.stringify(data.text)) };
}
const nonEmpty = value => typeof value === 'string' && cleanText(value) !== '';
const depthOf = value => (Array.isArray(value) ? 1 + Math.max(0, ...value.map(depthOf)) : 0);
const gz = body => gzipSync(Buffer.from(body), { level: 9 });
const workIdOf = title => title.replace(/['’]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// ---------- The tractates (the app's catalog: 37 Bavli tractates of the six orders) ----------
const TRACTATES = catalog.tractates.filter(t => t.steinsaltz);
if (TRACTATES.length !== 37) fail(`expected 37 tractates in the catalog, found ${TRACTATES.length}`);
const SEDER_ID = { 'Seder Zeraim': 'zeraim', 'Seder Moed': 'moed', 'Seder Nashim': 'nashim', 'Seder Nezikin': 'nezikin', 'Seder Kodashim': 'kodashim', 'Seder Tahorot': 'tahorot' };
const BASE_VERSION = 'Wikisource Talmud Bavli';

// Bundled commentators on the Gemara segment (Tamid has neither in Sefaria; Rashi / Tosafot on it are not indexes there).
const SEGMENT_COMMENTATORS = [
  { id: 'rashi', he: 'רש״י', linkName: 'רש"י', author: 'רש״י — רבי שלמה יצחקי', rank: 1, prefix: 'Rashi on', version: title => (title === 'Rosh Hashanah' ? 'WikiSource Rashi' : 'Vilna Edition') },
  { id: 'tosafot', he: 'תוספות', linkName: 'תוספות', author: 'בעלי התוספות', rank: 2, prefix: 'Tosafot on', version: () => 'Vilna Edition' },
];
const NO_INDEX = { rashi: ['Tamid'], tosafot: ['Tamid'] };
// The Rif, on his own pages: Sefaria's 25 titles (his scope, including Halakhot Ketanot).
const RIF_TITLES = { Berakhot: 'Rif Berakhot', Shabbat: 'Rif Shabbat', Eruvin: 'Rif Eruvin', Pesachim: 'Rif Pesachim', 'Rosh Hashanah': 'Rif Rosh Hashanah', Yoma: 'Rif Yoma', Sukkah: 'Rif Sukkah', Beitzah: 'Rif Beitzah', Taanit: "Rif Ta'anit", Megillah: 'Rif Megillah', 'Moed Katan': 'Rif Moed Katan', Yevamot: 'Rif Yevamot', Ketubot: 'Rif Ketubot', Nedarim: 'Rif Nedarim', Gittin: 'Rif Gittin', Kiddushin: 'Rif Kiddushin', 'Bava Kamma': 'Rif Bava Kamma', 'Bava Metzia': 'Rif Bava Metzia', 'Bava Batra': 'Rif Bava Batra', Sanhedrin: 'Rif Sanhedrin', Makkot: 'Rif Makkot', Shevuot: 'Rif Shevuot', 'Avodah Zarah': 'Rif Avodah Zarah', Menachot: 'Rif Halakhot Ketanot (Menachot)', Chullin: 'Rif Chullin' };
const RIF = { id: 'rif', he: 'רי״ף', author: 'רבי יצחק אלפסי (הרי״ף)', rank: 3 };

// Remote only (download tier, corpus-gap-report §7.3): one exact public-domain edition per title, read live.
// daf: the commentary is on the Gemara's own pages (Daf:Comment), so it is placed on the amud; otherwise it keeps its own
// structure (the Rosh by perek and siman, the Ran on the Rif's pages) and is reached through the reader's live links.
const RITVA = { Berakhot: 'Berakhah Meshuleshet, Warsaw, 1863.', Eruvin: 'Chidushi HaRitva, Amsterdam, 1729', Pesachim: 'Chiddushei haRitva, Warsaw 1864', 'Rosh Hashanah': 'Chiddushei HaRitva, Konigsberg, 1858.', Yoma: 'Chiddushei HaRitva, Berlin, 1860.', Sukkah: 'Chiddushei HaRashba, Sheva Shitot, Warsaw, 1883.', Taanit: 'Chidushi HaRitva, Amsterdam, 1729.', Megillah: 'Kodshei David, Livorno, 1792.', 'Moed Katan': 'Chidushi HaRitva, Amsterdam, 1729.', Yevamot: 'Chidushei HaRitva Yevamot; Lvov, 1861.', Ketubot: 'Chiddushei haRitva, Munkatch, 1908.', Kiddushin: 'Chiddushei haRitva, Munkatch, 1908.', Makkot: 'Hamisha Shitot, Sulzbach 1761.', Shevuot: 'Chiddushei haRitva, Lemberg, 1827', 'Avodah Zarah': "Orian Tlita'i, Salonika, 1758.", Chullin: 'Chiddushei haRitva, Lemberg 1861', Niddah: 'Hidushe ha-Ritba al Nidah; Wien 1868.' };
const ROSH = ['Berakhot', 'Shabbat', 'Eruvin', 'Pesachim', 'Rosh Hashanah', 'Yoma', 'Sukkah', 'Beitzah', 'Taanit', 'Megillah', 'Moed Katan', 'Yevamot', 'Ketubot', 'Nedarim', 'Gittin', 'Kiddushin', 'Bava Kamma', 'Bava Metzia', 'Bava Batra', 'Sanhedrin', 'Makkot', 'Shevuot', 'Avodah Zarah', 'Menachot', 'Chullin', 'Bekhorot', 'Niddah'];
const RAN_ON_RIF = ['Yoma', 'Avodah Zarah', 'Shevuot', 'Rosh Hashanah', 'Gittin', 'Beitzah', 'Kiddushin', 'Megillah', 'Chullin', 'Sukkah', 'Shabbat', 'Taanit', 'Pesachim', 'Ketubot'];
const HALACHOT = ['Berakhot', 'Shabbat', 'Eruvin', 'Pesachim', 'Rosh Hashanah', 'Yoma', 'Sukkah', 'Beitzah', 'Taanit', 'Megillah', 'Moed Katan', 'Chagigah', 'Yevamot', 'Ketubot', 'Nedarim', 'Sotah', 'Gittin', 'Kiddushin', 'Bava Kamma', 'Bava Metzia', 'Bava Batra', 'Sanhedrin', 'Makkot', 'Shevuot', 'Avodah Zarah', 'Horayot', 'Menachot', 'Chullin', 'Bekhorot', 'Niddah'];
const AGADOT = TRACTATES.map(t => t.title).filter(t => t !== 'Rosh Hashanah');
const RAMBAN = ['Berakhot', 'Shabbat', 'Eruvin', 'Pesachim', 'Rosh Hashanah', 'Yoma', 'Sukkah', 'Beitzah', 'Taanit', 'Megillah', 'Moed Katan', 'Chagigah', 'Yevamot', 'Ketubot', 'Nazir', 'Sotah', 'Gittin', 'Kiddushin', 'Bava Metzia', 'Bava Batra', 'Sanhedrin', 'Makkot', 'Shevuot', 'Avodah Zarah', 'Chullin', 'Niddah'];
const REMOTE = [
  { id: 'rosh', he: 'רא״ש', author: 'רבנו אשר בן יחיאל', rank: 4, works: ROSH.map(t => ({ title: `Rosh on ${t}`, base: t, versionTitle: 'Vilna Edition', daf: false })) },
  { id: 'ran', he: 'ר״ן', author: 'רבנו נסים גירונדי', rank: 5, works: [...RAN_ON_RIF.map(t => ({ title: `Ran on ${t}`, base: t, versionTitle: 'Vilna Edition', daf: false, onRif: true })), { title: 'Ran on Nedarim', base: 'Nedarim', versionTitle: 'Vilna Edition', daf: true }] },
  { id: 'maharsha', he: 'מהרש״א', author: 'רבי שמואל אליעזר אידלס (מהרש״א)', rank: 6, works: [
    ...HALACHOT.map(t => ({ title: `Chidushei Halachot on ${t}`, base: t, versionTitle: 'Vilna Edition', daf: true, he: 'מהרש״א — חידושי הלכות' })),
    { title: 'Chidushei Halachot on Yevamot; Alternate Version', base: 'Yevamot', versionTitle: 'Vilna Edition', daf: true, he: 'מהרש״א — חידושי הלכות (מהדורה אחרת)' },
    ...AGADOT.map(t => ({ title: `Chidushei Agadot on ${t}`, base: t, versionTitle: 'Vilna Edition', daf: true, he: 'מהרש״א — חידושי אגדות' })),
  ] },
  { id: 'ramban', he: 'חידושי הרמב״ן', author: 'רמב״ן — רבי משה בן נחמן', rank: 7, works: RAMBAN.map(t => ({ title: `Chiddushei Ramban on ${t}`, base: t, versionTitle: 'Chiddushei HaRamban, Jerusalem 1928-29', daf: true })) },
  { id: 'ritva', he: 'ריטב״א', author: 'רבי יום טוב בן אברהם אשבילי', rank: 8, works: Object.entries(RITVA).map(([t, versionTitle]) => ({ title: `Ritva on ${t}`, base: t, versionTitle, daf: true })) },
];
// Not imported, with the reason (recorded in the coverage and on the sources page).
const NOT_IMPORTED = [
  { commentator: 'rashi', title: 'Rashi on Tamid', he: 'רש״י על תמיד', reason: 'אין בספריא אינדקס "Rashi on Tamid" — הפירוש שבדפוס וילנא על תמיד אינו מופיע שם.' },
  { commentator: 'tosafot', title: 'Tosafot on Tamid', he: 'תוספות על תמיד', reason: 'אין בספריא אינדקס "Tosafot on Tamid".' },
  { commentator: 'rashi', title: 'Rashi on Rosh Hashanah — "Vilna Edition"', he: 'רש״י על ראש השנה (מהדורת וילנא)', reason: 'בספריא הגרסה רשומה ללא רישיון; נכללה במקומה "WikiSource Rashi" (העתקת ויקיטקסט, CC BY-SA 4.0).' },
  { commentator: 'maharsha', title: 'Chidushei Agadot on Rosh Hashanah', he: 'חידושי אגדות על ראש השנה', reason: 'הגרסה היחידה בספריא רשומה ברישיון unknown.' },
  { commentator: 'ramban', title: 'Hilkhot HaRamban on Nedarim', he: 'הלכות הרמב״ן על נדרים', reason: 'הגרסה היחידה בספריא רשומה ברישיון unknown.' },
  { commentator: 'ritva', title: 'Ritva on Nedarim', he: 'ריטב״א על נדרים', reason: 'הגרסה היחידה בספריא רשומה ברישיון unknown.' },
];

// ---------- Structure ----------
// Sefaria's shape of a Talmud text: one entry per amud from 1a (index 0), a count (depth 2) or a list of counts per
// segment (depth 3). Returned as numbers / arrays of numbers.
async function shapeOf(title) {
  const node = (await cachedJson(`shape-${title}`, shapeUrl(title)))[0] || fail(`${title}: no shape`);
  if (!Array.isArray(node.chapters)) fail(`${title}: shape without chapters`);
  return node.chapters;
}
const countOf = entry => (Array.isArray(entry) ? entry.length : Number(entry) || 0);
const LICENCE_TEXT = { 'public-domain': 'נחלת הכלל', 'cc-by': 'CC BY', 'cc-by-sa': 'CC BY-SA 4.0' };

// Emphasis the transcription prints (the opening word of a mishnah or a Gemara, in <big><strong>): kept as character
// ranges beside the plain text (unit.em = [[from, to]]), since pack text carries no markup.
function baseSegment(html, stats) {
  const value = String(html ?? '');
  const em = [];
  let text = '';
  const pieces = value.split(/(<(?:strong|b)>[\s\S]*?<\/(?:strong|b)>)/i);
  for (const piece of pieces) {
    const bold = /^<(?:strong|b)>([\s\S]*?)<\/(?:strong|b)>$/i.exec(piece);
    const clean = cleanText(bold ? bold[1] : piece, stats);
    if (!clean) continue;
    const join = text && !/^[.,:;!?)\]]/.test(clean) ? ' ' : '';
    const from = text.length + join.length;
    text += join + clean;
    if (bold) {
      const last = em.at(-1);
      if (last && last[1] + 1 === from) last[1] = text.length; else em.push([from, text.length]);
    }
  }
  // cleanText collapses whitespace per piece; the joined text must equal the cleaned whole (the words are unchanged).
  if (text !== cleanText(value, {})) { stats.emphasisDropped = (stats.emphasisDropped || 0) + 1; return { text: cleanText(value, stats) }; }
  return em.length ? { text, em } : { text };
}

// Rashi / Tosafot: "opening words - comment" (a hyphen, sometimes an en dash). The dash is Sefaria's separator for the dibbur hamatchil; the opening words
// are kept apart (shown in bold), the comment follows. Without that separator the comment is kept whole.
function splitComment(html, stats) {
  const text = cleanText(html, stats);
  const m = /^(.{1,260}?) [-–] ([\s\S]+)$/.exec(text);
  if (m && m[2].trim()) { stats.dh = (stats.dh || 0) + 1; return { dh: m[1].trim(), text: m[2].trim() }; }
  return { text };
}

// ---------- 1. The Gemara ----------
async function buildBase(tractate) {
  const title = tractate.title;
  const { version, licence, data, exportSha256 } = await loadEdition(title, BASE_VERSION);
  if (licence.license !== 'cc-by-sa') fail(`${title}: the Wikisource transcription must ship as CC BY-SA (got ${licence.license})`);
  const shape = await shapeOf(title);
  const first = amudIndex(tractate.firstAmud);
  const last = amudIndex(tractate.lastAmud);
  // Alignment: the Sefaria shape, the app's catalog and the export agree amud by amud, segment count by segment count.
  shape.forEach((entry, i) => { if (countOf(entry) !== (tractate.segmentsPerAmud[i] || 0)) fail(`${title} ${indexAmud(i)}: shape ${countOf(entry)} ≠ catalog ${tractate.segmentsPerAmud[i]}`); });
  if (depthOf(data.text) !== 2) fail(`${title}: export depth ${depthOf(data.text)}`);
  const workId = `Bavli_${workIdOf(title)}`;
  const stats = {};
  const nodes = new Map();
  const expected = [];
  const missing = [];
  let beyond = 0;
  data.text.forEach((segments, i) => { if ((i < first || i > last) && (segments || []).some(nonEmpty)) fail(`${title} ${indexAmud(i)}: text outside the tractate's pages`); });
  for (let i = first; i <= last; i += 1) {
    const n = i - first + 1;
    const count = countOf(shape[i]);
    const segments = data.text[i] || [];
    if (segments.length > count && segments.slice(count).some(nonEmpty)) { beyond += 1; fail(`${title} ${indexAmud(i)}: ${segments.length} segments, shape ${count}`); }
    const units = [];
    for (let k = 1; k <= count; k += 1) {
      const unitId = `${workId}.${n}.${k}`;
      if (!nonEmpty(segments[k - 1])) { missing.push(unitId); continue; }
      units.push({ id: unitId, n: k, ...baseSegment(segments[k - 1], stats) });
    }
    expected.push(count);
    if (units.length) nodes.set(n, units);
  }
  return { tractate, workId, title, version, licence, exportSha256, stats, nodes, expected, missing, beyond, first, last };
}

// ---------- 2. Rashi and Tosafot, anchored to the segment ----------
async function buildSegmentCommentary(commentator, base) {
  const title = `${commentator.prefix} ${base.title}`;
  const versionTitle = commentator.version(base.title);
  const { version, licence, data, exportSha256 } = await loadEdition(title, versionTitle);
  if (depthOf(data.text) !== 3) fail(`${title}: export depth ${depthOf(data.text)}, expected daf/segment/comment`);
  const shape = await shapeOf(title);
  const workId = workIdOf(title);
  const stats = {};
  const nodes = new Map();
  const expected = [];
  const missing = [];
  const anchors = [];
  let unanchored = 0;
  let beyondShape = 0;
  const outside = [];
  const pages = Math.max(shape.length, data.text.length);
  for (let i = 0; i < pages; i += 1) {
    const hasText = (data.text[i] || []).some(comments => (comments || []).some(nonEmpty));
    const hasShape = Array.isArray(shape[i]) && shape[i].some(Boolean);
    if ((i < base.first || i > base.last) && (hasText || hasShape)) outside.push({ amud: indexAmud(i), text: hasText });
  }
  if (outside.some(item => item.text)) fail(`${title}: comments outside the tractate's pages: ${outside.filter(item => item.text).map(item => item.amud).join(', ')}`);
  for (let i = base.first; i <= base.last; i += 1) {
    const n = i - base.first + 1;
    const lines = Array.isArray(shape[i]) ? shape[i].map(Number) : [];
    const dataLines = data.text[i] || [];
    const lineCount = Math.max(lines.length, dataLines.length);
    const baseSegments = base.expected[n - 1];
    let offset = 0;
    const units = [];
    for (let v = 1; v <= lineCount; v += 1) {
      const comments = dataLines[v - 1] || [];
      let lastText = 0;
      comments.forEach((value, k) => { if (nonEmpty(value)) lastText = k + 1; });
      const slots = Math.max(lines[v - 1] || 0, lastText);
      if (lastText > (lines[v - 1] || 0)) beyondShape += lastText - (lines[v - 1] || 0);
      for (let k = 1; k <= slots; k += 1) {
        const unitNo = offset + k;
        const unitId = `${workId}.${n}.${unitNo}`;
        if (!nonEmpty(comments[k - 1])) { missing.push(unitId); continue; }
        const comment = splitComment(comments[k - 1], stats);
        units.push({ id: unitId, n: unitNo, v, ...(comment.dh ? { dh: comment.dh } : {}), text: comment.text });
        const amud = indexAmud(i);
        if (v <= baseSegments) anchors.push({ unitId, anchorRef: `${base.workId}.${n}.${v}`, canonicalRef: `${title} ${amud}:${v}:${k}`, baseCanonicalRef: `${base.title} ${amud}:${v}` });
        else unanchored += 1;
      }
      offset += slots;
    }
    expected.push(offset);
    if (units.length) nodes.set(n, units);
  }
  return { commentator, title, versionTitle, workId, base, version, licence, exportSha256, stats, nodes, expected, missing, anchors, unanchored, beyondShape };
}

// ---------- 3. The Rif, on his own pages ----------
async function buildRif(tractate) {
  const title = RIF_TITLES[tractate.title];
  const { version, licence, data, exportSha256 } = await loadEdition(title, 'Vilna Edition');
  if (depthOf(data.text) !== 2) fail(`${title}: export depth ${depthOf(data.text)}`);
  const shape = await shapeOf(title);
  const count = i => Math.max(countOf(shape[i]), (() => { let last = 0; (data.text[i] || []).forEach((value, k) => { if (nonEmpty(value)) last = k + 1; }); return last; })());
  const indices = Array.from({ length: Math.max(shape.length, data.text.length) }, (_, i) => i).filter(i => count(i) > 0);
  const first = indices[0];
  const last = indices.at(-1);
  const workId = workIdOf(title);
  const stats = {};
  const nodes = new Map();
  const expected = [];
  const missing = [];
  for (let i = first; i <= last; i += 1) {
    const n = i - first + 1;
    const slots = count(i);
    const units = [];
    for (let k = 1; k <= slots; k += 1) {
      const unitId = `${workId}.${n}.${k}`;
      if (!nonEmpty(data.text[i]?.[k - 1])) { missing.push(unitId); continue; }
      units.push({ id: unitId, n: k, text: cleanText(data.text[i][k - 1], stats) });
    }
    expected.push(slots);
    if (units.length) nodes.set(n, units);
  }
  return { tractate, title, workId, version, licence, exportSha256, stats, nodes, expected, missing, first: indexAmud(first), last: indexAmud(last) };
}

// ---------- 4. Remote layers ----------
async function buildRemote(commentator, item) {
  const { version, licence, data } = await loadEdition(item.title, item.versionTitle);
  if (licence.license !== 'public-domain' || licence.wikisource) fail(`${item.title}: a remote layer must be a public-domain edition not sourced from Wikisource`);
  const tractate = TRACTATES.find(t => t.title === item.base) || fail(`${item.title}: no tractate ${item.base}`);
  const baseWorkId = `Bavli_${workIdOf(tractate.title)}`;
  const first = amudIndex(tractate.firstAmud);
  const count = value => (Array.isArray(value) ? value.reduce((total, entry) => total + count(entry), 0) : nonEmpty(value) ? 1 : 0);
  const units = count(data.text);
  const anchorNodes = [];
  if (item.daf) {
    if (!Array.isArray(data.text)) fail(`${item.title}: not a daf-structured text`);
    data.text.forEach((entry, i) => {
      const c = count(entry);
      if (!c) return;
      if (i < first || i > amudIndex(tractate.lastAmud)) fail(`${item.title}: comments on ${indexAmud(i)}, outside ${tractate.title}`);
      anchorNodes.push([i - first + 1, c]);
    });
  }
  const heBase = tractate.heTitle;
  return {
    workId: workIdOf(item.title), title: item.title, heTitle: `${item.he || commentator.he} על ${heBase}`, layerTitle: item.he || commentator.he, layerRank: commentator.rank, commentator: commentator.id,
    category: 'talmud-commentary', group: commentator.id, authors: [commentator.author], provider: 'sefaria', versionTitle: item.versionTitle,
    heVersion: version.versionTitleInHebrew || item.versionTitle, versionSource: version.versionSource || null, license: 'public-domain', recordedLicense: licence.recordedLicense,
    refPattern: item.daf ? '{title} {amud}' : null, licenseVerifiedAt: RETRIEVED_AT,
    relation: { relationType: item.onRif ? 'supercommentary' : 'commentary', baseWorkId, anchorScheme: item.daf ? 'sefaria-ref' : 'sefaria-links-live', ...(item.onRif ? { on: RIF_TITLES[tractate.title] } : {}) },
    anchorNodes,
    coverage: coverageRecord({ expectedUnits: units, importedUnits: 0, coverageStatus: COVERAGE.REMOTE_ONLY }),
  };
}

// ---------- 5. Pack writing ----------
const packs = new Map();
function packFor(packId, license, category) {
  if (!packs.has(packId)) {
    const staging = join(ROOT, 'public/library/packs', `${packId}.staging`);
    rmSync(staging, { recursive: true, force: true });
    mkdirSync(staging, { recursive: true });
    packs.set(packId, { packId, license, category, staging, files: [], works: [] });
  }
  return packs.get(packId);
}
function writeChunk(pack, workId, nodes, expected, missing) {
  const chunk = { workId, editionId: `${pack.packId}:${workId}`, packId: pack.packId, nodes: [...nodes].sort((a, b) => a[0] - b[0]).map(([n, units]) => ({ id: `${workId}.${n}`, n, units })) };
  const report = validateWorkChunk(chunk, expected.map((units, i) => ({ n: i + 1, units })));
  if (report.duplicateIds.length || report.emptyUnits.length || report.invalidRefs.length || report.unexpectedUnits.length || report.orderErrors.length) fail(`${workId}: ${JSON.stringify({ d: report.duplicateIds.slice(0, 3), e: report.emptyUnits.slice(0, 3), i: report.invalidRefs.slice(0, 3), u: report.unexpectedUnits.slice(0, 3), o: report.orderErrors.slice(0, 3) })}`);
  if (report.missingUnits.length !== missing.length) fail(`${workId}: missing units disagree`);
  const body = JSON.stringify(chunk);
  const packed = gz(body);
  const file = `${workId}.json.gz`;
  writeFileSync(join(pack.staging, file), packed);
  const written = { file, bytes: packed.length, rawBytes: Buffer.byteLength(body), checksum: checksum(body) };
  pack.files.push({ workId, ...written });
  return { report, written };
}
// Anchors of a Talmud layer in compact rows [node, unit, segment, comment] (one record per comment, ~140,000 of them);
// loadAnchors() (src/services/library/relations.mjs) expands them to { unitId, anchorRef, canonicalRef, baseCanonicalRef }.
function writeAnchors(pack, work, relation, license) {
  const rows = work.anchors.map(anchor => [...anchor.unitId.match(/\.(\d+)\.(\d+)$/).slice(1).map(Number), ...anchor.canonicalRef.match(/:(\d+):(\d+)$/).slice(1).map(Number)]);
  const body = JSON.stringify({ workId: work.workId, editionId: `${pack.packId}:${work.workId}`, relationType: relation.relationType, baseWorkId: relation.baseWorkId, anchorScheme: relation.anchorScheme, license, format: 'rows', title: work.title, baseTitle: work.base.title, firstAmud: work.base.tractate.firstAmud, rows });
  const packed = gz(body);
  const file = `${work.workId}.anchors.json.gz`;
  writeFileSync(join(pack.staging, file), packed);
  pack.files.push({ workId: work.workId, role: 'anchors', file, bytes: packed.length, rawBytes: Buffer.byteLength(body), checksum: checksum(body) });
  return { anchorsFile: file, anchorsChecksum: checksum(body) };
}
// Amudim of the tractate the commentary reaches, and the stretches it does not (honest coverage against the Gemara).
function amudCoverage(expected, baseExpected, pagesFirst) {
  const withText = baseExpected.map((count, i) => (count > 0 ? i : -1)).filter(i => i >= 0);
  const reached = withText.filter(i => (expected[i] || 0) > 0);
  const gaps = [];
  for (const i of withText) {
    if ((expected[i] || 0) > 0) continue;
    const last = gaps.at(-1);
    if (last && last.toIndex === i - 1) { last.toIndex = i; last.to = indexAmud(pagesFirst + i); last.amudim += 1; } else gaps.push({ from: indexAmud(pagesFirst + i), to: indexAmud(pagesFirst + i), toIndex: i, amudim: 1 });
  }
  return { baseAmudim: withText.length, amudimReached: reached.length, amudPercent: Math.round((reached.length / withText.length) * 1000) / 10, gaps: gaps.filter(gap => gap.amudim >= 4).map(({ from, to, amudim }) => ({ from, to, amudim })) };
}
// ---------- Run ----------
console.log('Gemara…');
const bases = await pool(TRACTATES, 4, t => buildBase(t).then(result => { process.stdout.write('.'); return result; }));
console.log('\nRashi, Tosafot…');
const segmentJobs = SEGMENT_COMMENTATORS.flatMap(commentator => bases.filter(base => !NO_INDEX[commentator.id].includes(base.title)).map(base => ({ commentator, base })));
const segmentBuilt = await pool(segmentJobs, 4, ({ commentator, base }) => buildSegmentCommentary(commentator, base).then(result => { process.stdout.write('.'); return result; }));
console.log('\nRif…');
const rifBuilt = await pool(TRACTATES.filter(t => RIF_TITLES[t.title]), 4, t => buildRif(t).then(result => { process.stdout.write('.'); return result; }));
console.log('\nRemote layers…');
const remoteJobs = REMOTE.flatMap(commentator => commentator.works.map(item => ({ commentator, item })));
const remoteLayers = await pool(remoteJobs, 4, ({ commentator, item }) => buildRemote(commentator, item).then(result => { process.stdout.write('r'); return result; }));
process.stdout.write('\n');

const reports = [];
const provenanceEditions = [];
const baseById = new Map();
const tractatePagination = tractate => ({ scheme: 'daf', edition: 'דפוס וילנא', volumes: [{ n: 1, title: tractate.heTitle, first: tractate.firstAmud, last: tractate.lastAmud }] });
const record = (item, title, versionTitle, built) => provenanceEditions.push({ workId: item.workId, title, versionTitle, recordedLicense: built.licence.recordedLicense, license: built.licence.license, wikisourceSourced: built.licence.wikisource, versionSource: built.version.versionSource || null, versions: versionsUrl(title), export: exportUrl(title, versionTitle), exportTextSha256: built.exportSha256, licenseVerifiedAt: RETRIEVED_AT, stats: built.stats });

for (const base of bases) {
  const pack = packFor('wikisource-talmud-cc-by-sa', 'cc-by-sa', 'talmud');
  const { report, written } = writeChunk(pack, base.workId, base.nodes, base.expected, base.missing);
  const t = base.tractate;
  const heTitle = `תלמוד בבלי · ${t.heTitle}`;
  const coverage = coverageRecord({ expectedUnits: report.expectedUnits, importedUnits: report.importedUnits, missingUnits: report.missingUnits, basis: 'Sefaria /api/shape (the segmentation of every Sefaria Talmud version and commentary ref)', unit: 'segment', amudim: base.expected.filter(Boolean).length });
  pack.works.push({
    workId: base.workId, title: t.title, heTitle, shortTitle: t.heTitle, group: SEDER_ID[t.seder], aliases: [`מסכת ${t.heTitle}`], authors: ['חכמי התלמוד'], compDate: null,
    editionTitle: BASE_VERSION, editionHeTitle: base.version.versionTitleInHebrew || 'תלמוד בבלי (ויקיטקסט)', provider: 'sefaria', providerUrl: `${SEFARIA}/${encodeURIComponent(t.title)}`,
    versionSource: base.version.versionSource || null, license: 'cc-by-sa', recordedLicense: base.licence.recordedLicense, licenseVerifiedAt: RETRIEVED_AT,
    sourceLine: `גמרא · תלמוד בבלי (ויקיטקסט) · CC BY-SA 4.0 · דרך ספריא`,
    nodeLabel: 'עמוד', unitLabel: 'קטע', pagination: tractatePagination(t), reader: 'talmud', firstAmud: t.firstAmud,
    status: report.status, missingUnits: report.missingUnits, ...written,
    nodes: base.expected.map((_, i) => base.nodes.get(i + 1)?.length || 0), expected: base.expected,
    coverage,
    attribution: { text: `תלמוד בבלי, מסכת ${t.heTitle} — העתקת ויקיטקסט העברי (לפי דפוס וילנא), CC BY-SA 4.0 (דרך ספריא)`, url: base.version.versionSource ? base.version.versionSource.replace(/^http:/, 'https:') : 'https://he.wikisource.org/wiki/%D7%AA%D7%9C%D7%9E%D7%95%D7%93_%D7%91%D7%91%D7%9C%D7%99', licenseUrl: WIKISOURCE_LICENSE.url, modified: 'עיבוד: ניקוי סימון בלבד; ההדגשות שבהעתקה נשמרו. המילים לא שונו.' },
  });
  baseById.set(base.workId, pack.works.at(-1));
  reports.push({ workId: base.workId, expectedUnits: report.expectedUnits, importedUnits: report.importedUnits, status: report.status, checksum: written.checksum, missing: report.missingUnits.length });
  record({ workId: base.workId }, t.title, BASE_VERSION, base);
}

const commentaryWorks = [];
for (const work of segmentBuilt) {
  const license = work.licence.license;
  const pack = packFor(`sefaria-talmud-commentary-${license}`, license, 'talmud-commentary');
  const { report, written } = writeChunk(pack, work.workId, work.nodes, work.expected, work.missing);
  const relation = { relationType: 'commentary', baseWorkId: work.base.workId, anchorScheme: 'sefaria-ref' };
  const anchorFiles = writeAnchors(pack, work, relation, license);
  const anchorNodes = [];
  for (const anchor of work.anchors) {
    const [, node, unit] = anchor.unitId.match(/\.(\d+)\.(\d+)$/).map(Number);
    const last = anchorNodes.at(-1);
    if (last && last[0] === node && last[3] === unit - 1) last[3] = unit; else anchorNodes.push([node, node, unit, unit]);
  }
  const t = work.base.tractate;
  const baseEntry = baseById.get(work.base.workId);
  const coverage = coverageRecord({
    expectedUnits: report.expectedUnits, importedUnits: report.importedUnits, missingUnits: report.missingUnits, basis: 'Sefaria /api/shape', unit: 'comment',
    anchoredUnits: work.anchors.length, unanchoredUnits: report.importedUnits - work.anchors.length,
    ...amudCoverage(work.expected, baseEntry.expected, work.base.first),
    ...(work.beyondShape ? { beyondShape: work.beyondShape } : {}),
  });
  const c = work.commentator;
  const heTitle = `${c.he} על ${t.heTitle}`;
  const sourceLine = `${c.he} · ${work.version.versionTitleInHebrew || work.versionTitle} · ${LICENCE_TEXT[license]} · ספריא`;
  const entry = {
    workId: work.workId, title: work.title, heTitle, shortTitle: t.heTitle, layerTitle: c.he, layerRank: c.rank, linkName: c.linkName,
    group: c.id, aliases: [], authors: [c.author], compDate: null,
    editionTitle: work.versionTitle, editionHeTitle: work.version.versionTitleInHebrew || work.versionTitle, provider: 'sefaria', providerUrl: `${SEFARIA}/${encodeURIComponent(work.title)}`,
    versionSource: work.version.versionSource || null, license, recordedLicense: work.licence.recordedLicense, licenseVerifiedAt: RETRIEVED_AT, sourceLine,
    nodeLabel: 'עמוד', unitLabel: 'דיבור', baseUnitLabel: 'קטע', pagination: tractatePagination(t),
    status: report.status, missingUnits: report.missingUnits, ...written,
    nodes: work.expected.map((_, i) => work.nodes.get(i + 1)?.length || 0), expected: work.expected,
    relation, ...anchorFiles, anchorNodes, coverage,
    ...(license === 'cc-by-sa' ? { attribution: { text: `${heTitle} — ${work.version.versionTitleInHebrew || work.versionTitle}, העתקת ויקיטקסט העברי, CC BY-SA 4.0 (דרך ספריא)`, url: work.version.versionSource, licenseUrl: WIKISOURCE_LICENSE.url, modified: 'עיבוד: ניקוי סימון בלבד; מילות הפתיחה (דיבור המתחיל) הופרדו מגוף הפירוש.' } } : {}),
  };
  pack.works.push(entry);
  commentaryWorks.push({ entry, built: work });
  reports.push({ workId: work.workId, expectedUnits: report.expectedUnits, importedUnits: report.importedUnits, status: report.status, checksum: written.checksum, missing: report.missingUnits.length });
  record({ workId: work.workId }, work.title, work.versionTitle, work);
}
for (const work of rifBuilt) {
  const license = work.licence.license;
  const pack = packFor(`sefaria-talmud-commentary-${license}`, license, 'talmud-commentary');
  const { report, written } = writeChunk(pack, work.workId, work.nodes, work.expected, work.missing);
  const t = work.tractate;
  const heTitle = `רי״ף על ${t.heTitle}`;
  pack.works.push({
    workId: work.workId, title: work.title, heTitle, shortTitle: work.title.includes('Halakhot Ketanot') ? 'הלכות קטנות (מנחות)' : t.heTitle, layerTitle: RIF.he, layerRank: RIF.rank,
    group: RIF.id, aliases: work.title.includes('Halakhot Ketanot') ? ['הלכות קטנות', 'רי״ף הלכות קטנות'] : [], authors: [RIF.author], compDate: null,
    editionTitle: 'Vilna Edition', editionHeTitle: work.version.versionTitleInHebrew || 'Vilna Edition', provider: 'sefaria', providerUrl: `${SEFARIA}/${encodeURIComponent(work.title)}`,
    versionSource: work.version.versionSource || null, license, recordedLicense: work.licence.recordedLicense, licenseVerifiedAt: RETRIEVED_AT,
    sourceLine: `${RIF.he} · ${work.version.versionTitleInHebrew || 'Vilna Edition'} · ${LICENCE_TEXT[license]} · ספריא`,
    nodeLabel: 'עמוד', unitLabel: 'קטע', pagination: { scheme: 'daf', edition: 'דפי הרי״ף, דפוס וילנא', volumes: [{ n: 1, title: 'דפי הרי״ף', first: work.first, last: work.last }] },
    status: report.status, missingUnits: report.missingUnits, ...written,
    nodes: work.expected.map((_, i) => work.nodes.get(i + 1)?.length || 0), expected: work.expected,
    // The Rif keeps his own pages; he is not placed on the Gemara's amud (no openly licensed link data).
    relation: null, onTractate: `Bavli_${workIdOf(t.title)}`,
    coverage: coverageRecord({ expectedUnits: report.expectedUnits, importedUnits: report.importedUnits, missingUnits: report.missingUnits, basis: 'Sefaria /api/shape', unit: 'segment', anchoredUnits: 0, unanchoredUnits: report.importedUnits, note: 'על דפי הרי״ף עצמו; אינו מוצמד לעמודי הגמרא.' }),
  });
  reports.push({ workId: work.workId, expectedUnits: report.expectedUnits, importedUnits: report.importedUnits, status: report.status, checksum: written.checksum, missing: report.missingUnits.length });
  record({ workId: work.workId }, work.title, 'Vilna Edition', work);
}

// Coverage per commentator (bundled): tractates, comments, amudim reached, what is missing and why.
const commentators = [...SEGMENT_COMMENTATORS, RIF].map(c => {
  const mine = c.id === 'rif' ? rifBuilt.map(work => ({ workId: work.workId, nodes: work.nodes, expected: work.expected, missing: work.missing, versionTitle: 'Vilna Edition', licence: work.licence })) : segmentBuilt.filter(work => work.commentator.id === c.id);
  const expectedUnits = mine.reduce((total, work) => total + work.expected.reduce((a, b) => a + b, 0), 0);
  const importedUnits = mine.reduce((total, work) => total + [...work.nodes.values()].reduce((a, units) => a + units.length, 0), 0);
  const expectedBooks = c.id === 'rif' ? Object.keys(RIF_TITLES).length : TRACTATES.length;
  const missingBooks = NOT_IMPORTED.filter(item => item.commentator === c.id && !/—/.test(item.title)).map(({ title, he, reason }) => ({ title, he, reason }));
  const notes = NOT_IMPORTED.filter(item => item.commentator === c.id && /—/.test(item.title)).map(({ title, he, reason }) => ({ title, he, reason }));
  const commentaryEntries = commentaryWorks.filter(item => item.entry.group === c.id).map(item => item.entry);
  return {
    id: c.id, he: c.he, author: c.author, rank: c.rank, expectedBooks, importedBooks: mine.length, bookCoveragePercent: Math.round((mine.length / expectedBooks) * 1000) / 10, missingBooks, notes,
    ...coverageRecord({ expectedUnits, importedUnits, missingUnits: [], coverageStatus: mine.every(work => !work.missing.length) && !missingBooks.length ? COVERAGE.FULL : COVERAGE.PARTIAL }),
    editions: [...new Set(mine.map(work => work.versionTitle))],
    licences: [...new Set(mine.map(work => work.licence.license))],
    partialBooks: mine.filter(work => work.missing.length).map(work => ({ workId: work.workId, missing: work.missing.length })),
    // Tractates where the commentary reaches clearly less than the whole Gemara (fewer than 90% of its amudim).
    thinTractates: commentaryEntries.filter(entry => entry.coverage.amudPercent < 90).map(entry => ({ workId: entry.workId, amudimReached: entry.coverage.amudimReached, baseAmudim: entry.coverage.baseAmudim, amudPercent: entry.coverage.amudPercent, gaps: entry.coverage.gaps })),
  };
});
const baseCoverage = (() => {
  const expectedUnits = bases.reduce((total, base) => total + base.expected.reduce((a, b) => a + b, 0), 0);
  const importedUnits = bases.reduce((total, base) => total + [...base.nodes.values()].reduce((a, units) => a + units.length, 0), 0);
  return { tractates: bases.length, ...coverageRecord({ expectedUnits, importedUnits, missingUnits: [], coverageStatus: bases.every(base => !base.missing.length) ? COVERAGE.FULL : COVERAGE.PARTIAL }), partialTractates: bases.filter(base => base.missing.length).map(base => ({ workId: base.workId, missing: base.missing.length })) };
})();
const remoteCommentators = REMOTE.map(c => ({ id: c.id, he: c.he, author: c.author, rank: c.rank, books: remoteLayers.filter(layer => layer.commentator === c.id).length, onAmud: remoteLayers.filter(layer => layer.commentator === c.id && layer.anchorNodes.length).length, units: remoteLayers.filter(layer => layer.commentator === c.id).reduce((total, layer) => total + layer.coverage.expectedUnits, 0), editions: [...new Set(c.works.map(item => item.versionTitle))], coverageStatus: COVERAGE.REMOTE_ONLY, missingBooks: NOT_IMPORTED.filter(item => item.commentator === c.id).map(({ title, he, reason }) => ({ title, he, reason })) }));
// Held back, recorded, never shown as text.
const blockedLayers = [
  { title: 'Rashba on the Talmud — "Gerlitz edition, published by Oraita"', he: 'חידושי הרשב״א (מהדורת גרליץ)', status: COVERAGE.BLOCKED, reason: 'Sefaria רושמת Public Domain, אך זו מהדורה ביקורתית מודרנית; עד אימות נשאר מחוץ לחבילות ולשכבות הרשומות. בקורא הוא נטען מספריא דרך הקישורים בלבד.' },
  { title: 'Meiri — Beit HaBechirah', he: 'מאירי · בית הבחירה', status: COVERAGE.PERMISSION_REQUIRED, reason: 'Sefaria "Meiri on Shas" ו־"Wikisource": רישיון unknown.' },
];

const packEntries = [];
const EDITION = {
  talmud: { title: 'Talmud Bavli — Hebrew Wikisource transcription (via Sefaria)', heTitle: 'תלמוד בבלי · העתקת ויקיטקסט', editor: 'מתנדבי ויקיטקסט העברי (דרך ספריא: "Wikisource Talmud Bavli")', notes: 'העתקה של דפוס וילנא בחלוקת הקטעים של ספריא. ניקוי סימון בלבד; ההדגשות שבהעתקה נשמרו. רישיון CC BY-SA 4.0 חל על טקסט זה בלבד.' },
  'talmud-commentary': { title: 'Sefaria — Talmud commentaries', heTitle: 'מפרשי הש״ס · ספריא', editor: 'Sefaria (each edition as recorded per tractate)', notes: 'כל מסכת במהדורה אחת מוצמדת (versionTitle), ברישיון שנבדק מול ספריא בעת הבנייה. ניקוי סימון בלבד; מילות הפתיחה (דיבור המתחיל) הופרדו מגוף הפירוש.' },
};
for (const pack of packs.values()) {
  const packDir = join(ROOT, 'public/library/packs', pack.packId);
  const bytes = pack.files.reduce((total, file) => total + file.bytes, 0);
  const edition = EDITION[pack.category];
  const manifest = { packId: pack.packId, contentVersion: `Sefaria exports, licences verified live ${RETRIEVED_AT}`, family: 'corpus', category: pack.category, structure: ['amud', pack.category === 'talmud' ? 'segment' : 'comment'], license: pack.license, ...(pack.license === 'cc-by-sa' ? { licenseUrl: WIKISOURCE_LICENSE.url } : {}), source: 'sefaria', edition, retrievedAt: RETRIEVED_AT, provenance: 'sources/sefaria-talmud/provenance.json', files: pack.files };
  writeFileSync(join(pack.staging, 'manifest.json'), JSON.stringify(manifest, null, 1));
  rmSync(packDir, { recursive: true, force: true });
  renameSync(pack.staging, packDir);
  packEntries.push({
    packId: pack.packId, contentVersion: manifest.contentVersion, family: 'corpus', category: pack.category, structure: manifest.structure, nodeLabel: 'עמוד', unitLabel: pack.category === 'talmud' ? 'קטע' : 'דיבור',
    policy: 'source', source: 'sefaria', license: pack.license, edition, sourceUrl: SEFARIA, retrievedAt: RETRIEVED_AT, bytes, provenance: manifest.provenance, works: pack.works,
  });
}
const ORDER = ['wikisource-talmud-cc-by-sa', 'sefaria-talmud-commentary-public-domain', 'sefaria-talmud-commentary-cc-by-sa'];
packEntries.sort((a, b) => ORDER.indexOf(a.packId) - ORDER.indexOf(b.packId));
const index = { generatedAt: RETRIEVED_AT, packs: packEntries, remoteLayers, heldBack: blockedLayers, reports, base: baseCoverage, commentators, remoteCommentators };
writeFileSync(join(ROOT, 'src/data/library/corpus/talmud.mjs'), `// Generated by scripts/library/build-talmud.mjs. Do not edit by hand.\nexport default ${JSON.stringify(index)};\n`);

mkdirSync(join(ROOT, 'sources/sefaria-talmud'), { recursive: true });
writeFileSync(join(ROOT, 'sources/sefaria-talmud/provenance.json'), `${JSON.stringify({
  work: 'The Babylonian Talmud (Hebrew Wikisource transcription via Sefaria) with Rashi, Tosafot and the Rif (Sefaria exports, one pinned version per tractate)',
  rule: 'Each version is the exact versionTitle named in scripts/library/build-talmud.mjs; its licence is re-read live from /api/texts/versions/<Title> at build time. Only Public Domain / CC0 / CC-BY / CC-BY-SA are accepted; NC and unknown stop the build. A version whose versionSource is he.wikisource.org ships as CC BY-SA 4.0 with attribution; the app itself is not CC BY-SA.',
  alignment: 'The base segmentation is Sefaria\'s canonical one: /api/shape/<Tractate> equals src/data/talmudCatalog.mjs amud by amud (checked at build time), which is also the segmentation of the William Davidson edition, of Steinsaltz and of every "<Commentary> on <Tractate> <amud>:<segment>:<comment>" ref.',
  modifications: 'Markup only: HTML tags, commentator markers and entities removed; bold in the transcription kept as unit.em ranges; the opening words of Rashi and Tosafot (before Sefaria\'s " - " separator) stored apart as unit.dh. The words of the editions were not changed.',
  notUsed: [
    { item: 'William Davidson Edition (Aramaic, Vocalized Aramaic) and Steinsaltz Hebrew', why: 'CC-BY-NC: never packaged. The reader still offers them live from Sefaria (the vocalized text on request, Steinsaltz beside the Gemara).' },
    { item: 'Links from the Rif, the Ran on the Rif and the Rosh to the Gemara', why: 'Sefaria publishes no licence for its link data; the Rif is a book of its own; the Rosh and the Ran are reached through the reader\'s live links.' },
    ...NOT_IMPORTED.map(item => ({ item: item.title, why: item.reason })),
    ...blockedLayers.map(item => ({ item: item.title, why: item.reason })),
  ],
  builtAt: RETRIEVED_AT,
  editions: provenanceEditions,
  remoteLayers: remoteLayers.map(layer => ({ workId: layer.workId, title: layer.title, versionTitle: layer.versionTitle, recordedLicense: layer.recordedLicense, versionSource: layer.versionSource, licenseVerifiedAt: layer.licenseVerifiedAt, remoteOnly: true, onAmud: layer.anchorNodes.length > 0 })),
}, null, 1)}\n`);

console.log(JSON.stringify({
  packs: packEntries.map(pack => [pack.packId, pack.bytes, pack.works.length]),
  base: [baseCoverage.importedUnits, baseCoverage.expectedUnits, baseCoverage.coverageStatus, baseCoverage.partialTractates.length],
  commentators: commentators.map(c => [c.id, `${c.importedBooks}/${c.expectedBooks}`, c.importedUnits, c.expectedUnits, c.coveragePercent, c.coverageStatus, c.thinTractates.map(t => `${t.workId}:${t.amudPercent}`).join(' ')]),
  remote: remoteCommentators.map(c => [c.id, c.books, c.onAmud, c.units]),
  stats: { emphasisDropped: bases.reduce((t, b) => t + (b.stats.emphasisDropped || 0), 0), brackets: [...bases, ...segmentBuilt, ...rifBuilt].reduce((t, b) => t + (b.stats.brackets || 0), 0), dh: segmentBuilt.reduce((t, b) => t + (b.stats.dh || 0), 0) },
}, null, 1));
