// Commentary corpora: the classical commentaries on the Tanakh and on the Mishnah, each comment anchored to the verse
// or mishnah it explains, on the relation/anchor/coverage model of docs/library/content-model.md (the Zohar stage).
// Run: node scripts/library/build-commentary.mjs [--corpus tanakh|mishnah|all] [--cache /tmp/kz-library-cache/commentary]
//        [--offline] [--retrieved-at YYYY-MM-DD]
//
// - Every edition is the exact Sefaria version named below (docs/library/corpus-gap-report.md §5.2–5.3). Its licence is
//   re-read LIVE from /api/texts/versions/<Title> on every run (never from the cache), and the build stops on anything
//   that is not Public Domain / CC0 / CC-BY / CC-BY-SA. A version whose source is he.wikisource.org is treated
//   conservatively as CC BY-SA 4.0, as the Zohar stage did.
// - Structure: node = chapter (perek), unit = one comment. Units are numbered by their place in Sefaria's shape of the
//   work (/api/shape), so ids are stable and a comment the edition lacks is a listed missing unit, never a renumbering.
//   Each unit carries v (the verse or mishnah it sits on) and, where the edition prints one, dh (the opening words).
// - Anchors: every comment → { unitId, anchorRef: 'Genesis.1.1', canonicalRef: 'Rashi on Genesis 1:1:1',
//   baseCanonicalRef: 'Genesis 1:1' }; the generated index holds the compact per-chapter rows.
// - Packs are split by licence and stored one file per book/tractate, so a chapter loads only its own commentary.
// - The larger commentaries (download tier) are registered as REMOTE_ONLY layers: read live, in the one edition named.
// Markup cleanup only: the words of an edition are never changed.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checksum } from '../../src/services/prayer/checksum.mjs';
import { COVERAGE, coverageRecord, validateWorkChunk } from '../../src/services/library/integrity.mjs';
import { hebrewNumeral } from '../../src/services/hebrewNumerals.mjs';
import PACK_INDEX from '../../src/data/library/packIndex.mjs';
import { cleanText } from './clean.mjs';
import { WIKISOURCE_LICENSE } from './wikisource.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const CACHE = arg('--cache', '/tmp/kz-library-cache/commentary');
const OFFLINE = args.includes('--offline');
const RETRIEVED_AT = arg('--retrieved-at', new Date().toISOString().slice(0, 10));
const ONLY = arg('--corpus', 'all');
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

// Recorded licence → the licence the app ships it under. Wikisource-sourced texts are CC BY-SA whatever Sefaria records.
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

// ---------- Base works (already bundled): Tanakh (UXLC) and Mishnah (Torat Emet 357) ----------
const baseByTitle = new Map();
// Keyed by Sefaria's canonical title (the work id with spaces: the pack's display title may differ, e.g. "Mishnah Ta'anit").
for (const pack of PACK_INDEX) for (const work of pack.works) baseByTitle.set(work.workId.replace(/_/g, ' '), { ...work, packId: pack.packId });
const baseOf = title => baseByTitle.get(title) || fail(`no base work "${title}" in the library`);
const TANAKH = PACK_INDEX.find(pack => pack.packId === 'uxlc-2.5').works.map(work => work.workId.replace(/_/g, ' '));
const MISHNAH = PACK_INDEX.find(pack => pack.packId === 'sefaria-torat-emet-357-mishnah').works.map(work => work.workId.replace(/_/g, ' '));
const TORAH = TANAKH.slice(0, 5);

// ---------- The editions (docs/library/corpus-gap-report.md §5.2–5.3, re-checked live at build time) ----------
const workIdOf = title => title.replace(/['’]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const entry = (title, base, versionTitle, extra = {}) => ({ title, base, versionTitle, ...extra });
const RASHI_NACH_VOCALIZED = new Set(['Joel', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Malachi']);
const IBN_EZRA_DAAT = { Hosea: 'Ibn Ezra on Hosea -- Daat', Joel: 'Ibn Ezra on Joel -- Daat', Amos: 'Ibn Ezra on Amos -- Daat', Obadiah: 'Ibn Ezra on Obadiah -- Daat', Jonah: 'Ibn Ezra on Jonah -- Daat', Micah: 'Ibn Ezra on Micah -- Daat', Nahum: 'Ibn Ezra on Nahum -- Daat', Habakkuk: 'Ibn Ezra on Habakkuk -- Daat', Zephaniah: 'Ibn Ezra on Zephaniah -- Daat', Haggai: 'Ibn Ezra on Haggai -- Daat', Zechariah: 'Ibn Ezra on Zecharia -- Daat', Malachi: 'Ibn Ezra on Malachi -- Daat', Psalms: 'Ibn Ezra on Psalms -- Daat', Proverbs: 'Ibn Ezra on Proverbs -- Daat', Job: 'Ibn Ezra on Job -- Daat', Ruth: 'Ibn Ezra on Ruth -- Daat', Daniel: 'Ibn Ezra on Daniel - Daat', Ezra: 'Ibn Ezra on Ezra -- Daat', Nehemiah: 'Ibn Ezra on Nehemiah -- Daat' };
const RISHON_LETZION = ['Joshua', 'Judges', 'I Samuel', 'II Samuel', 'Isaiah', 'Proverbs', 'Song of Songs', 'Lamentations', 'Esther'];
// Rashbam on the Torah: the Daat transcriptions (recorded PD, as the Ibn Ezra Daat books). Genesis has also a
// Wikisource version, but it holds only 7 segments.
const RASHBAM_DAAT = { Genesis: 'daat', Exodus: 'Rashbam on Torah -- Daat', Leviticus: 'Rashbam on Leviticus - Daat', Numbers: 'Rashbam on Numbers -- Daat', Deuteronomy: 'Rashbam on Deuteronomy -- Daat' };
// Rabbeinu Bahya's parts are named by the parasha books (Bereshit…), the others by the English book names.
const BAHYA_PART = { Genesis: 'Bereshit', Exodus: 'Shemot', Leviticus: 'Vayikra', Numbers: 'Bamidbar', Deuteronomy: 'Devarim' };
// One book of a commentary whose Sefaria index holds the whole Torah as named parts ("Tur HaArokh, Genesis"): the work
// id follows the base book; the commentary's introduction (a named part of the index) opens its Genesis book.
const torahPart = (title, book, versionTitle, { part = book, intro = false } = {}) => entry(title, book, versionTitle, { part, workId: workIdOf(`${title} on ${book}`), ...(intro && book === 'Genesis' ? { introParts: ['Introduction'] } : {}) });

const CORPORA = {
  tanakh: {
    id: 'tanakh', category: 'tanakh-commentary', module: 'tanakhCommentary', packPrefix: 'sefaria-tanakh-commentary', baseUnit: 'פסוק',
    commentators: [
      {
        id: 'rashi', he: 'רש״י', author: 'רש״י — רבי שלמה יצחקי', rank: 1,
        // Torah: "On Your Way" — the Rosenbaum–Silbermann edition (1929–1934) is BLOCKED in the registry: its 1930–1934
        // volumes are not yet US public domain by age (corpus-gap-report §3.3). Nach: the report's choice.
        works: TANAKH.map(book => entry(`Rashi on ${book}`, book, TORAH.includes(book) ? 'On Your Way' : RASHI_NACH_VOCALIZED.has(book) ? 'Sefaria vocalized edition' : ['I Kings', 'II Kings'].includes(book) ? 'On Your Way -- new' : 'On Your Way')),
        expectedBooks: TANAKH.length,
      },
      {
        id: 'ramban', he: 'רמב״ן', author: 'רמב״ן — רבי משה בן נחמן', rank: 2,
        works: [entry('Ramban on Genesis', 'Genesis', 'On Your Way'), entry('Ramban on Leviticus', 'Leviticus', 'On Your Way New'), entry('Ramban on Numbers', 'Numbers', 'Vocalized Edition'), entry('Ramban on Deuteronomy', 'Deuteronomy', 'On Your Way new')],
        expectedBooks: 6,
        notImported: [
          { title: 'Ramban on Exodus', he: 'רמב״ן על שמות', reason: 'ספריא: שתי הגרסאות העבריות ("Sefaria Vocalized Edition", "On Your Way") רשומות ברישיון unknown — אין מהדורה פתוחה.' },
          { title: 'Ramban on Job', he: 'רמב״ן על איוב', reason: 'ספריא: הגרסה היחידה (מוסד הרב קוק, ירושלים תשכ״ג) רשומה CC-BY-NC — אינה פתוחה להפצה.' },
        ],
      },
      {
        id: 'ibn-ezra', he: 'אבן עזרא', author: 'רבי אברהם אבן עזרא', rank: 3,
        works: [
          entry('Ibn Ezra on Genesis', 'Genesis', 'Piotrkow, 1907-1911'),
          entry('Ibn Ezra on Exodus', 'Exodus', 'Piotrkow, 1907-1911'),
          entry('Ibn Ezra HaKatzar on Exodus', 'Exodus', 'Prague, 1840', { he: 'אבן עזרא — הפירוש הקצר', heTitle: 'אבן עזרא הקצר על שמות', shortTitle: 'שמות (הפירוש הקצר)' }),
          ...['Leviticus', 'Numbers', 'Deuteronomy'].map(book => entry(`Ibn Ezra on ${book}`, book, 'On Your Way')),
          entry('Ibn Ezra on Isaiah', 'Isaiah', 'Ibn Ezra on Isaiah, by M. Friedlander; Society of Hebrew Literature, London 1877'),
          ...Object.entries(IBN_EZRA_DAAT).map(([book, version]) => entry(`Ibn Ezra on ${book}`, book, version)),
          entry('Ibn Ezra on Song of Songs', 'Song of Songs', "Ibn Ezra's commentary on the Canticles"),
          entry('Ibn Ezra on Lamentations', 'Lamentations', 'Ibn Ezra on Lamentations -- Wikisource'),
          entry('Ibn Ezra on Ecclesiastes', 'Ecclesiastes', 'Wikisource'),
          entry('Ibn Ezra on Esther', 'Esther', 'Kol Sason, Krotoschin, 1840'),
          entry('Second Version of Ibn Ezra on Esther', 'Esther', "Ibn Ezra's Commentary on the Book of Esther, London, 1850.", { he: 'אבן עזרא — נוסח שני', heTitle: 'אבן עזרא על אסתר (נוסח שני)', shortTitle: 'אסתר (נוסח שני)' }),
        ].sort((a, b) => TANAKH.indexOf(a.base) - TANAKH.indexOf(b.base)),
        expectedBooks: 31,
      },
      {
        id: 'sforno', he: 'ספורנו', author: 'רבי עובדיה ספורנו', rank: 4,
        works: [...TORAH.map(book => entry(`Sforno on ${book}`, book, ['Genesis', 'Exodus'].includes(book) ? 'Vocalized Edition' : 'On Your Way')), entry('Sforno on Song of Songs', 'Song of Songs', 'Chamesh Megillot, Warsaw 1875')],
        expectedBooks: 6,
      },
      {
        id: 'or-hachaim', he: 'אור החיים', author: 'רבי חיים בן עטר (אור החיים הקדוש)', rank: 5,
        works: [
          ...TORAH.map(book => entry(`Or HaChaim on ${book}`, book, 'Vocalized Edition')),
          ...RISHON_LETZION.map(book => entry(`Rishon LeTzion on ${book}`, book, 'Jerusalem, 1915', { he: 'ראשון לציון (לבעל אור החיים)', heTitle: `ראשון לציון לבעל אור החיים על ${baseOf(book).heTitle}`, shortTitle: `ראשון לציון · ${baseOf(book).heTitle}` })),
        ],
        expectedBooks: 14,
      },
      { id: 'kli-yakar', he: 'כלי יקר', author: 'רבי שלמה אפרים מלונטשיץ', rank: 6, works: TORAH.map(book => entry(`Kli Yakar on ${book}`, book, 'Vocalized Edition')), expectedBooks: 5 },
      // Five more commentators on the Torah (licences re-read live; see provenance.notUsed for the candidates set aside).
      { id: 'rashbam', he: 'רשב״ם', author: 'רבי שמואל בן מאיר (רשב״ם)', rank: 7, works: TORAH.map(book => entry(`Rashbam on ${book}`, book, RASHBAM_DAAT[book])), expectedBooks: 5 },
      { id: 'rabbeinu-bahya', he: 'רבינו בחיי', author: 'רבינו בחיי בן אשר', rank: 8, works: TORAH.map(book => torahPart('Rabbeinu Bahya', book, 'Midrash Rabbeinu Bachya [ben Asher]. Warsaw, 1878', { part: BAHYA_PART[book], intro: true })), expectedBooks: 5 },
      { id: 'tur-haarokh', he: 'טור הארוך', author: 'רבי יעקב בן אשר (בעל הטורים)', rank: 9, works: TORAH.map(book => torahPart('Tur HaArokh', book, 'Perush al ha-Torah, Hanover, 1838', { intro: true })), expectedBooks: 5 },
      { id: 'siftei-chakhamim', he: 'שפתי חכמים', author: 'רבי שבתי בס', rank: 10, works: TORAH.map(book => torahPart('Siftei Chakhamim', book, 'Siftei Hakhamim')), expectedBooks: 5 },
      { id: 'haamek-davar', he: 'העמק דבר', author: 'רבי נפתלי צבי יהודה ברלין (הנצי״ב)', rank: 11, works: TORAH.map(book => entry(`Haamek Davar on ${book}`, book, 'Sefer Torat Elohim, Vilna 1879')), expectedBooks: 5 },
    ],
    // Download tier (corpus-gap-report §7.3): read live, one exact PD edition each. Wikisource-sourced versions are left
    // for a bundled Wikisource import (they need attribution and share-alike), so they are not registered here.
    remote: [
      { id: 'malbim', he: 'מלבי״ם', author: 'רבי מאיר לייבוש בן יחיאל מיכל (המלבי״ם)', rank: 12, works: [
        entry('Malbim on Genesis', 'Genesis', 'Malbim, Vilna Romm, 1892.'),
        ...['Exodus', 'Numbers', 'Deuteronomy'].map(book => entry(`Malbim on ${book}`, book, 'Mikraei Kodesh, Vilna, 1891')),
        ...['II Samuel', 'I Kings', 'II Kings', 'Jeremiah', 'Ezekiel', 'Psalms', 'Esther'].map(book => entry(`Malbim on ${book}`, book, 'On Your Way')),
        ...['Isaiah', 'Jeremiah', 'Ezekiel'].map(book => entry(`Malbim Beur Hamilot on ${book}`, book, 'On Your Way', { he: 'מלבי״ם — ביאור המילות', heTitle: `מלבי״ם ביאור המילות על ${baseOf(book).heTitle}` })),
      ] },
      { id: 'ralbag', he: 'רלב״ג', author: 'רבי לוי בן גרשום', rank: 13, works: [
        ...TORAH.map(book => entry('Ralbag on Torah', book, 'Ralbag on Torah, Venice, 1547', { part: book })),
        ...['Joshua', 'Judges', 'I Samuel', 'II Samuel', 'I Kings', 'II Kings', 'Proverbs', 'Job', 'Ezra', 'Nehemiah', 'I Chronicles', 'II Chronicles'].map(book => entry(`Ralbag on ${book}`, book, 'On Your Way')),
        entry('Ralbag on Song of Songs', 'Song of Songs', 'Perush al Hamesh Megillot, Konigsberg, 1860'),
        entry('Ralbag Ruth', 'Ruth', 'Perush al Hamesh Megillot, Konigsberg, 1860'),
        entry('Ralbag on Ecclesiastes', 'Ecclesiastes', 'Perush al Hamesh Megillot, Konigsberg, 1860'),
        entry('Ralbag Esther', 'Esther', 'Perush al Hamesh Megillot, Konigsberg, 1860'),
      ] },
      { id: 'metzudat-david', he: 'מצודת דוד', author: 'רבי דוד אלטשולר', rank: 14, works: TANAKH.slice(5).filter(book => !['Ruth', 'Lamentations', 'Esther'].includes(book)).map(book => entry(`Metzudat David on ${book}`, book, 'On Your Way')) },
      { id: 'metzudat-zion', he: 'מצודת ציון', author: 'רבי יחיאל הלל אלטשולר', rank: 15, works: TANAKH.slice(5).filter(book => !['Ruth', 'Lamentations', 'Esther'].includes(book)).map(book => entry(`Metzudat Zion on ${book}`, book, 'On Your Way')) },
      { id: 'abarbanel', he: 'אברבנאל', author: 'דון יצחק אברבנאל', rank: 16, works: TORAH.map(book => entry('Abarbanel on Torah', book, 'Torah Commentary of Yitzchak Abarbanel, Warsaw 1862', { part: book })) },
      { id: 'radak', he: 'רד״ק', author: 'רבי דוד קמחי', rank: 17, works: [entry('Radak on Genesis', 'Genesis', 'Presburg : A. Schmid, 1842'), entry('Radak on Psalms', 'Psalms', 'Derekh Mesilah, Furth 1843')] },
    ],
  },
  mishnah: {
    id: 'mishnah', category: 'mishnah-commentary', module: 'mishnahCommentary', packPrefix: 'sefaria-mishnah-commentary', baseUnit: 'משנה',
    commentators: [
      {
        id: 'bartenura', he: 'ברטנורא', author: 'רבי עובדיה מברטנורא', rank: 1,
        // "On Your Way" (PD) for 62 tractates; Avot only exists as "ToratEmet", recorded Public Domain (checked live).
        // The "Torat-Emet" versions of the other tractates are CC-BY-NC and are not used.
        works: MISHNAH.map(tractate => entry(`Bartenura on ${tractate}`, tractate, tractate === 'Pirkei Avot' ? 'ToratEmet' : 'On Your Way')),
        expectedBooks: 63,
      },
      {
        id: 'tosafot-yom-tov', he: 'תוספות יום טוב', author: 'רבי יום טוב ליפמן הלר', rank: 2,
        works: [
          entry('Tosafot Yom Tov Introduction to the Mishnah', null, 'Mishnah, ed. Romm, Vilna 1913', { heTitle: 'הקדמת תוספות יום טוב', shortTitle: 'הקדמה' }),
          ...MISHNAH.map(tractate => entry(tractate === 'Mishnah Peah' ? 'Tosefot Yom Tov on Mishnah Peah' : `Tosafot Yom Tov on ${tractate}`, tractate, 'Mishnah, ed. Romm, Vilna 1913')),
        ],
        expectedBooks: 64,
      },
    ],
    remote: [],
  },
};

// Named parts of a complex commentary (outside the chapter/verse body): kept as their own nodes after the chapters.
const PART_TITLE = { Introduction: 'הקדמה', Foreword: 'פתיחה', Prelude: 'פתיחה', Benefits: 'תועלות', "Kidmat Ha'Emek": 'קדמת העמק' };
const partTitle = key => PART_TITLE[key] || (/^Introduction to [A-Z][a-z]+$/.test(key) ? 'הקדמה' : null);
const shortBase = heTitle => heTitle.replace(/^משנה /, '');

// Opening words printed in bold (the dibbur hamatchil) are kept apart from the comment, never merged into it.
function splitComment(html, stats) {
  const value = String(html ?? '');
  const m = /^\s*<b>([\s\S]*?)<\/b>([\s\S]*)$/.exec(value);
  if (m) {
    let dh = cleanText(m[1], stats);
    let rest = cleanText(m[2], stats);
    const lead = /^([.:,;־–—]+)\s*/.exec(rest);
    if (lead) { dh = `${dh}${lead[1]}`; rest = rest.slice(lead[0].length); }
    if (dh && rest) return { dh, text: rest };
  }
  return { text: cleanText(value, stats) };
}

// The body of an export (chapter → verse → comments) and its named parts, whatever the index shape.
function bodyOf(data, part) {
  const text = data.text;
  if (Array.isArray(text)) return depthOf(text) === 1 ? { body: null, parts: [] } : { body: text, parts: [] };
  const scope = part ? text[part] || fail(`${data.title}: no part "${part}"`) : text;
  if (Array.isArray(scope)) return { body: scope, parts: [] };
  const body = scope[''] || null;
  const parts = Object.entries(scope).filter(([key]) => key !== '').map(([key, value]) => ({ key, value }));
  return { body, parts };
}
const depthOf = value => (Array.isArray(value) ? 1 + Math.max(0, ...value.map(depthOf)) : 0);
const nonEmpty = value => typeof value === 'string' && value.trim() !== '';

// Sefaria's shape of the body: per chapter, per verse, how many comments the work has (in any version).
async function shapeOf(title, part) {
  const shape = await cachedJson(`shape-${title}`, shapeUrl(title));
  let node = shape[0];
  if (node?.isComplex) {
    const wanted = part ? `${title}, ${part}` : title;
    node = node.chapters.find(item => item.title === wanted) || fail(`${title}: no shape for ${wanted}`);
  }
  const chapters = Array.isArray(node.chapters) ? node.chapters : [];
  return chapters.map(chapter => (Array.isArray(chapter) ? chapter.map(Number) : []));
}
async function wholeShapeCount(title) {
  const node = (await cachedJson(`shape-${title}`, shapeUrl(title)))[0];
  return Number(Array.isArray(node?.chapters) ? node.chapters.length : node?.chapters) || 0;
}
async function partShapeCount(title, key) {
  const shape = await cachedJson(`shape-${title}, ${key}`, shapeUrl(`${title}, ${key}`));
  const node = shape[0];
  return Number(Array.isArray(node?.chapters) ? node.chapters.length : node?.chapters) || 0;
}

async function loadEdition(item) {
  const versions = await liveVersions(item.title);
  const version = versions.find(v => v.language === 'he' && v.versionTitle === item.versionTitle) || fail(`${item.title}: version "${item.versionTitle}" is not listed by Sefaria`);
  const licence = licenceOf(version, item.title);
  const data = await cachedJson(`export-${item.title}-${item.versionTitle}`, exportUrl(item.title, item.versionTitle));
  if (data.versionTitle !== item.versionTitle) fail(`${item.title}: export is "${data.versionTitle}"`);
  if (String(data.license || '').trim().toLowerCase() !== licence.recordedLicense.toLowerCase()) fail(`${item.title}: export licence "${data.license}" differs from the live record "${licence.recordedLicense}"`);
  return { version, licence, data, exportSha256: sha256(JSON.stringify(data.text)) };
}

// ---------- One bundled commentary work ----------
async function buildWork(corpus, commentator, item) {
  const { version, licence, data, exportSha256 } = await loadEdition(item);
  const workId = item.workId || workIdOf(item.title);
  const stats = {};
  const base = item.base ? baseOf(item.base) : null;
  const nodes = new Map();
  const expected = new Map();
  const anchors = [];
  const missing = [];
  let beyondShape = 0;
  let unanchored = 0;
  let ignoredShape = 0;
  const { body, parts: ownParts } = bodyOf(data, item.part);
  // A book taken from a whole-Torah index may carry the index's own introduction (named in item.introParts).
  const parts = item.introParts ? item.introParts.map(key => ({ key, value: data.text[key] || fail(`${item.title}: no part "${key}"`) })) : ownParts;
  let chapterCount = 0;
  if (body) {
    if (depthOf(body) !== 3) fail(`${item.title}: body depth ${depthOf(body)}, expected chapter/verse/comment`);
    const shape = await shapeOf(item.title, item.part);
    // Shape positions on chapters the base work does not have (a stale shape row, e.g. TYT Avodah Zarah "11:12") are
    // not places in the text: they are ignored unless the edition itself has text there (then kept, unanchored).
    const baseChapters = base ? base.nodes.length : shape.length;
    let lastWithText = 0;
    body.forEach((verses, c) => { if ((verses || []).some(comments => (comments || []).some(nonEmpty))) lastWithText = c + 1; });
    chapterCount = Math.max(Math.min(shape.length, baseChapters), lastWithText);
    for (let c = 1; c <= chapterCount; c += 1) {
      const shapeVerses = c <= baseChapters ? shape[c - 1] || [] : [];
      if (c > baseChapters) ignoredShape += (shape[c - 1] || []).reduce((a, b) => a + b, 0);
      const dataVerses = body[c - 1] || [];
      const verseCount = Math.max(shapeVerses.length, dataVerses.length);
      let offset = 0;
      const units = [];
      for (let v = 1; v <= verseCount; v += 1) {
        const comments = (dataVerses[v - 1] || []);
        let lastText = 0;
        comments.forEach((value, k) => { if (nonEmpty(value)) lastText = k + 1; });
        const slots = Math.max(shapeVerses[v - 1] || 0, lastText);
        if (lastText > (shapeVerses[v - 1] || 0)) beyondShape += lastText - (shapeVerses[v - 1] || 0);
        for (let k = 1; k <= slots; k += 1) {
          const n = offset + k;
          const unitId = `${workId}.${c}.${n}`;
          const value = comments[k - 1];
          const comment = nonEmpty(value) ? splitComment(value, stats) : null;
          if (!comment?.text) { missing.push(unitId); continue; }
          units.push({ id: unitId, n, v, ...(comment.dh ? { dh: comment.dh } : {}), text: comment.text });
          const anchored = base && c <= base.nodes.length && v <= base.nodes[c - 1];
          if (anchored) anchors.push({ unitId, anchorRef: `${base.workId}.${c}.${v}`, canonicalRef: `${item.title}${item.part ? `, ${item.part}` : ''} ${c}:${v}:${k}`, baseCanonicalRef: `${item.base} ${c}:${v}` });
          else unanchored += 1;
        }
        offset += slots;
      }
      expected.set(c, offset);
      if (units.length) nodes.set(c, units);
    }
  }
  // Named parts (introductions…) and whole works of one level (the TYT introduction): their own nodes, not anchored.
  const extraTitles = [];
  const extras = body ? parts : [{ key: 'Introduction', value: data.text, whole: true }];
  for (const part of extras) {
    if (depthOf(part.value) !== 1) fail(`${item.title}: part "${part.key}" has depth ${depthOf(part.value)}`);
    const title = partTitle(part.key.split(', ').at(-1)) || fail(`${item.title}: unknown part "${part.key}"`);
    const shapeCount = part.whole ? await wholeShapeCount(item.title) : await partShapeCount(item.title, part.key);
    let last = 0;
    part.value.forEach((value, i) => { if (nonEmpty(value)) last = i + 1; });
    const slots = Math.max(shapeCount, last);
    if (!slots) continue;
    const n = chapterCount + extraTitles.length + 1;
    extraTitles.push(title);
    const units = [];
    for (let k = 1; k <= slots; k += 1) {
      const unitId = `${workId}.${n}.${k}`;
      const comment = nonEmpty(part.value[k - 1]) ? splitComment(part.value[k - 1], stats) : null;
      if (!comment?.text) { missing.push(unitId); continue; }
      units.push({ id: unitId, n: k, ...(comment.dh ? { dh: comment.dh } : {}), text: comment.text });
      unanchored += 1;
    }
    expected.set(n, slots);
    if (units.length) nodes.set(n, units);
  }
  const total = chapterCount + extraTitles.length;
  return {
    corpus, commentator, item, workId, base, version, licence, exportSha256, stats,
    nodes, expected, anchors, missing, beyondShape, unanchored, total, ignoredShape,
    nodeTitles: extraTitles.length ? [...Array.from({ length: chapterCount }, (_, i) => `פרק ${hebrewNumeral(i + 1)}`), ...extraTitles] : null,
  };
}

// ---------- One remote layer: counts from the edition itself, licence live ----------
async function buildRemote(corpus, commentator, item) {
  const { version, licence, data } = await loadEdition(item);
  if (licence.license !== 'public-domain' || licence.wikisource) fail(`${item.title}: a remote layer must be a public-domain edition not sourced from Wikisource`);
  const { body } = bodyOf(data, item.part);
  if (!body || depthOf(body) !== 3) fail(`${item.title}${item.part ? `, ${item.part}` : ''}: no chapter/verse body`);
  const base = baseOf(item.base);
  const anchorNodes = [];
  let expectedUnits = 0;
  body.forEach((verses, c) => {
    if (c + 1 > base.nodes.length) return;
    const count = (verses || []).reduce((total, comments) => total + (comments || []).filter(nonEmpty).length, 0);
    if (!count) return;
    expectedUnits += count;
    anchorNodes.push([c + 1, count]);
  });
  const workId = workIdOf(item.part ? `${item.title} ${item.part}` : item.title);
  return {
    workId, title: item.title, heTitle: item.heTitle || `${commentator.he} על ${base.heTitle}`, layerTitle: item.he || commentator.he, layerRank: commentator.rank, commentator: commentator.id,
    category: corpus.category, group: commentator.id, authors: [commentator.author], provider: 'sefaria', versionTitle: item.versionTitle,
    heVersion: version.versionTitleInHebrew || item.versionTitle, versionSource: version.versionSource || null, license: 'public-domain', recordedLicense: licence.recordedLicense,
    refPattern: item.part ? `{title}, ${item.part} {chapter}` : '{title} {chapter}', licenseVerifiedAt: RETRIEVED_AT,
    relation: { relationType: 'commentary', baseWorkId: base.workId, anchorScheme: 'sefaria-ref' },
    anchorNodes,
    coverage: coverageRecord({ expectedUnits, importedUnits: 0, coverageStatus: COVERAGE.REMOTE_ONLY, note: 'נטען מספריא בעת הקריאה, במהדורה זו בלבד; אין עותק במכשיר.' }),
  };
}

// ---------- Write one corpus ----------
const gz = body => gzipSync(Buffer.from(body), { level: 9 });
const LICENCE_TEXT = { 'public-domain': 'נחלת הכלל', 'cc-by': 'CC BY', 'cc-by-sa': 'CC BY-SA 4.0' };

async function buildCorpus(corpus) {
  const jobs = corpus.commentators.flatMap(commentator => commentator.works.map(item => ({ commentator, item })));
  const built = await pool(jobs, 4, ({ commentator, item }) => buildWork(corpus, commentator, item).then(result => { process.stdout.write('.'); return result; }));
  const remoteJobs = corpus.remote.flatMap(commentator => commentator.works.map(item => ({ commentator, item })));
  const remoteLayers = await pool(remoteJobs, 4, ({ commentator, item }) => buildRemote(corpus, commentator, item).then(result => { process.stdout.write('r'); return result; }));
  process.stdout.write('\n');

  const packs = new Map();
  const reports = [];
  const provenanceEditions = [];
  for (const work of built) {
    const packId = `${corpus.packPrefix}-${work.licence.license}`;
    if (!packs.has(packId)) {
      const staging = join(ROOT, 'public/library/packs', `${packId}.staging`);
      rmSync(staging, { recursive: true, force: true });
      mkdirSync(staging, { recursive: true });
      packs.set(packId, { packId, license: work.licence.license, staging, files: [], works: [] });
    }
    const pack = packs.get(packId);
    const { item, commentator, base } = work;
    const expected = Array.from({ length: work.total }, (_, i) => ({ n: i + 1, units: work.expected.get(i + 1) || 0 }));
    const chunk = { workId: work.workId, editionId: `${packId}:${work.workId}`, packId, nodes: [...work.nodes].sort((a, b) => a[0] - b[0]).map(([n, units]) => ({ id: `${work.workId}.${n}`, n, units })) };
    const report = validateWorkChunk(chunk, expected);
    if (report.duplicateIds.length || report.emptyUnits.length || report.invalidRefs.length || report.unexpectedUnits.length || report.orderErrors.length) fail(`${work.workId}: ${JSON.stringify({ d: report.duplicateIds.slice(0, 3), e: report.emptyUnits.slice(0, 3), i: report.invalidRefs.slice(0, 3), u: report.unexpectedUnits.slice(0, 3), o: report.orderErrors.slice(0, 3) })}`);
    if (report.missingUnits.length !== work.missing.length) fail(`${work.workId}: missing units disagree`);
    const body = JSON.stringify(chunk);
    const packed = gz(body);
    const file = `${work.workId}.json.gz`;
    writeFileSync(join(pack.staging, file), packed);
    const written = { file, bytes: packed.length, rawBytes: Buffer.byteLength(body), checksum: checksum(body) };
    pack.files.push({ workId: work.workId, ...written });
    const relation = base ? { relationType: 'commentary', baseWorkId: base.workId, anchorScheme: 'sefaria-ref' } : null;
    let anchorFields = {};
    if (relation) {
      const anchorsBody = JSON.stringify({ workId: work.workId, editionId: chunk.editionId, relationType: relation.relationType, baseWorkId: relation.baseWorkId, anchorScheme: relation.anchorScheme, license: work.licence.license, anchors: work.anchors });
      const anchorsPacked = gz(anchorsBody);
      const anchorsFile = `${work.workId}.anchors.json.gz`;
      writeFileSync(join(pack.staging, anchorsFile), anchorsPacked);
      pack.files.push({ workId: work.workId, role: 'anchors', file: anchorsFile, bytes: anchorsPacked.length, rawBytes: Buffer.byteLength(anchorsBody), checksum: checksum(anchorsBody) });
      // Compact rows [chapter, layerNode, firstUnit, lastUnit]: contiguous anchored comments of one chapter.
      const anchorNodes = [];
      for (const anchor of work.anchors) {
        const chapter = Number(anchor.anchorRef.match(/\.(\d+)\.\d+$/)[1]);
        const [, layerNode, unit] = anchor.unitId.match(/\.(\d+)\.(\d+)$/).map(Number);
        const last = anchorNodes.at(-1);
        if (last && last[0] === chapter && last[1] === layerNode && last[3] === unit - 1) last[3] = unit; else anchorNodes.push([chapter, layerNode, unit, unit]);
      }
      anchorFields = { relation, anchorsFile, anchorsChecksum: checksum(anchorsBody), anchorNodes };
    }
    const importedUnits = report.importedUnits;
    const coverage = coverageRecord({
      expectedUnits: report.expectedUnits, importedUnits, missingUnits: report.missingUnits,
      basis: 'Sefaria /api/shape',
      anchoredUnits: work.anchors.length, unanchoredUnits: importedUnits - work.anchors.length,
      ...(work.beyondShape ? { beyondShape: work.beyondShape } : {}),
      ...(work.ignoredShape ? { shapeOutsideBase: work.ignoredShape } : {}),
    });
    const heTitle = item.heTitle || `${commentator.he} על ${base.heTitle}`;
    const provider = 'sefaria';
    const providerUrl = `${SEFARIA}/${encodeURIComponent(item.title)}`;
    // The edition's name is left out when it only repeats the commentator's ("שפתי חכמים · שפתי חכמים").
    const editionName = work.version.versionTitleInHebrew || item.versionTitle;
    const sourceLine = [commentator.he, ...(editionName === commentator.he ? [] : [editionName]), LICENCE_TEXT[work.licence.license], 'ספריא'].join(' · ');
    pack.works.push({
      workId: work.workId, title: item.title, heTitle, shortTitle: item.shortTitle || (base ? shortBase(base.heTitle) : heTitle), layerTitle: item.he || commentator.he, layerRank: commentator.rank,
      group: commentator.id, aliases: [], authors: [commentator.author], compDate: null,
      editionTitle: item.versionTitle, editionHeTitle: work.version.versionTitleInHebrew || item.versionTitle, provider, providerUrl,
      versionSource: work.version.versionSource || null, license: work.licence.license, recordedLicense: work.licence.recordedLicense, licenseVerifiedAt: RETRIEVED_AT,
      sourceLine,
      nodeLabel: 'פרק', unitLabel: 'קטע', baseUnitLabel: corpus.baseUnit, ...(work.nodeTitles ? { nodeTitles: work.nodeTitles } : {}),
      status: report.status, missingUnits: report.missingUnits, ...written,
      nodes: expected.map(({ n }) => work.nodes.get(n)?.length || 0), expected: expected.map(entryItem => entryItem.units),
      ...anchorFields,
      coverage,
      ...(work.licence.license === 'cc-by-sa' ? { attribution: { text: `${heTitle} — ${work.version.versionTitleInHebrew || item.versionTitle}, העתקת ויקיטקסט העברי, CC BY-SA 4.0 (דרך ספריא)`, url: work.version.versionSource, licenseUrl: WIKISOURCE_LICENSE.url, modified: 'עיבוד: ניקוי סימון בלבד; מילות הפתיחה (דיבור המתחיל) הופרדו מגוף הפירוש.' } } : {}),
    });
    reports.push({ workId: work.workId, expectedUnits: report.expectedUnits, importedUnits, status: report.status, checksum: written.checksum, missing: report.missingUnits.length });
    provenanceEditions.push({ workId: work.workId, title: item.title, versionTitle: item.versionTitle, recordedLicense: work.licence.recordedLicense, license: work.licence.license, wikisourceSourced: work.licence.wikisource, versionSource: work.version.versionSource || null, versions: `${SEFARIA}/api/texts/versions/${encodeURIComponent(item.title)}`, export: exportUrl(item.title, item.versionTitle), exportTextSha256: work.exportSha256, licenseVerifiedAt: RETRIEVED_AT, stats: work.stats });
  }

  // Coverage per commentator: books expected (Sefaria's index titles for that commentator on this corpus) and units.
  const commentators = corpus.commentators.map(commentator => {
    const works = built.filter(work => work.commentator.id === commentator.id);
    const expectedUnits = works.reduce((total, work) => total + [...work.expected.values()].reduce((a, b) => a + b, 0), 0);
    const importedUnits = works.reduce((total, work) => total + [...work.nodes.values()].reduce((a, units) => a + units.length, 0), 0);
    const missingBooks = commentator.notImported || [];
    const complete = works.every(work => !work.missing.length) && !missingBooks.length;
    return {
      id: commentator.id, he: commentator.he, author: commentator.author, rank: commentator.rank,
      expectedBooks: commentator.expectedBooks, importedBooks: works.length, bookCoveragePercent: Math.round((works.length / commentator.expectedBooks) * 1000) / 10, missingBooks,
      ...coverageRecord({ expectedUnits, importedUnits, missingUnits: [], coverageStatus: complete ? COVERAGE.FULL : COVERAGE.PARTIAL }),
      editions: [...new Set(works.map(work => work.item.versionTitle))],
      partialBooks: works.filter(work => work.missing.length).map(work => ({ workId: work.workId, missing: work.missing.length })),
    };
  });
  const remoteCommentators = corpus.remote.map(commentator => ({ id: commentator.id, he: commentator.he, author: commentator.author, rank: commentator.rank, books: remoteLayers.filter(layer => layer.commentator === commentator.id).length, editions: [...new Set(commentator.works.map(item => item.versionTitle))], coverageStatus: COVERAGE.REMOTE_ONLY }));

  // Swap every pack in atomically (staging → final), then the index module and the provenance record.
  const packEntries = [];
  for (const pack of packs.values()) {
    const packDir = join(ROOT, 'public/library/packs', pack.packId);
    const bytes = pack.files.reduce((total, file) => total + file.bytes, 0);
    const edition = { title: `Sefaria — ${corpus.id === 'tanakh' ? 'Tanakh' : 'Mishnah'} commentaries (${pack.license})`, heTitle: corpus.id === 'tanakh' ? 'מפרשי המקרא · ספריא' : 'מפרשי המשנה · ספריא', editor: 'Sefaria (each edition as recorded per book)', notes: 'כל ספר במהדורה אחת מוצמדת (versionTitle), ברישיון שנבדק מול ספריא בעת הבנייה. ניקוי סימון בלבד; מילות הפתיחה הודגשו כפי שהן מודגשות במהדורה.' };
    writeFileSync(join(pack.staging, 'manifest.json'), JSON.stringify({ packId: pack.packId, contentVersion: `Sefaria exports, licences verified live ${RETRIEVED_AT}`, family: 'corpus', category: corpus.category, structure: ['chapter', 'comment'], license: pack.license, source: 'sefaria', edition, retrievedAt: RETRIEVED_AT, provenance: 'sources/sefaria-commentaries/provenance.json', files: pack.files }, null, 1));
    rmSync(packDir, { recursive: true, force: true });
    renameSync(pack.staging, packDir);
    packEntries.push({
      packId: pack.packId, contentVersion: `Sefaria exports, licences verified live ${RETRIEVED_AT}`, family: 'corpus', category: corpus.category, structure: ['chapter', 'comment'], nodeLabel: 'פרק', unitLabel: 'קטע',
      policy: 'source', source: 'sefaria', license: pack.license, edition, sourceUrl: SEFARIA, retrievedAt: RETRIEVED_AT, bytes, provenance: 'sources/sefaria-commentaries/provenance.json', works: pack.works,
    });
  }
  packEntries.sort((a, b) => (a.license === 'public-domain' ? -1 : 1) - (b.license === 'public-domain' ? -1 : 1));
  const index = { generatedAt: RETRIEVED_AT, packs: packEntries, remoteLayers, blockedLayers: [], reports, commentators, remoteCommentators };
  const moduleFile = join(ROOT, 'src/data/library/corpus', `${corpus.module}.mjs`);
  writeFileSync(moduleFile, `// Generated by scripts/library/build-commentary.mjs. Do not edit by hand.\nexport default ${JSON.stringify(index)};\n`);
  return {
    editions: provenanceEditions,
    remote: remoteLayers.map(layer => ({ workId: layer.workId, title: layer.title, part: layer.refPattern.includes(',') ? layer.refPattern.split(', ')[1].replace(' {chapter}', '') : null, versionTitle: layer.versionTitle, recordedLicense: layer.recordedLicense, versionSource: layer.versionSource, licenseVerifiedAt: layer.licenseVerifiedAt, remoteOnly: true })),
    summary: { packs: packEntries.map(pack => [pack.packId, pack.bytes, pack.works.length]), commentators: commentators.map(c => [c.id, `${c.importedBooks}/${c.expectedBooks}`, c.importedUnits, c.expectedUnits, c.coveragePercent, c.coverageStatus]), remote: remoteLayers.length },
  };
}

const selected = ONLY === 'all' ? Object.values(CORPORA) : [CORPORA[ONLY] || fail(`unknown corpus ${ONLY}`)];
const provenanceFile = join(ROOT, 'sources/sefaria-commentaries/provenance.json');
const previous = existsSync(provenanceFile) ? JSON.parse(readFileSync(provenanceFile, 'utf8')) : { corpora: {} };
const provenance = {
  work: 'Classical commentaries on the Tanakh and the Mishnah (Sefaria exports, one pinned version per book)',
  rule: 'Each version is the exact versionTitle named in scripts/library/build-commentary.mjs; its licence is re-read live from /api/texts/versions/<Title> at build time. Only Public Domain / CC0 / CC-BY / CC-BY-SA are accepted; NC and unknown stop the build. A version whose versionSource is he.wikisource.org is shipped as CC BY-SA 4.0 with attribution.',
  modifications: 'Markup only: HTML tags, footnote markers and entities removed; the bold opening words (dibbur hamatchil) are stored apart from the comment (unit.dh) and shown in bold. The words of the editions were not changed.',
  notUsed: [
    { item: "Rashi on the Torah — \"Pentateuch with Rashi's commentary by M. Rosenbaum and A.M. Silbermann, 1929-1934\" (and \"-- corrected vocalization\")", why: 'Recorded PD by Sefaria, but the 1930–1934 volumes are not yet US public domain by age; BLOCKED in the registry. "On Your Way" (PD) is used for all five books.' },
    { item: 'Bartenura / Ikar Tosafot Yom Tov "Torat-Emet"', why: 'Recorded CC-BY-NC.' },
    { item: 'Links between texts (Mishnah → Talmud / Mishneh Torah; Tanakh → sources)', why: 'Sefaria publishes no licence for its link data (Sefaria-Export LICENSE.md: "each text is licensed separately" — links are not a text). The מקבילות / מקורות tabs stay off until an open, verifiable link source exists.' },
    { item: 'Wikisource-sourced Malbim versions (most of Nach), Baal HaTurim (he.wikisource), Radak on Nach ("Radak on Nach", unknown), Abarbanel on Nach ("Abarbanel, Tel Aviv 1960", unknown)', why: 'Not remote-registered: the Wikisource texts need a bundled, attributed Wikisource import; the others have no open version.' },
    { item: 'Chizkuni ("Chizkuni") and Daat Zkenim ("daat zekenim")', why: 'Recorded Public Domain, but the versionSource is only "https://www.sefaria.org" and no printed edition is named: the edition cannot be identified, so the PD record cannot be checked (a modern critical edition would not be PD). Set aside until the source is known.' },
    { item: 'Siftei Chakhamim — "Sifsei Chachomim Chumash, Metsudah Publications, 2009" (CC-BY) and "Siftei Chachamim. Frankfurt, 1712" (unknown)', why: 'The 2009 edition is a modern publication (CC-BY would be allowed; the old text in the PD Torat Emet transcription "Siftei Hakhamim" is used instead); the Frankfurt version has no licence.' },
    { item: 'Rashbam on Genesis — "Wikisource Mikraot Gedolot" (CC-BY-SA)', why: 'Holds 7 segments only; the Daat transcription ("daat", PD, 790 comments) is used, as for the other four books.' },
    { item: 'Rabbeinu Bahya — "Rabbeinu Behaye, Rimini, 1524" and "Al alazar hakohen"', why: 'Recorded unknown; the Warsaw 1878 print (PD) is used for all five books.' },
    { item: 'Haamek Davar on Genesis — "Ha\'amek Davar"', why: 'A second PD record; the Vilna 1879 print ("Sefer Torat Elohim, Vilna 1879") is used for all five books, one edition throughout.' },
    { item: 'Alshich, Torat Moshe ("Alshekh on Torah" / "Torat Moshe, Warsaw, 1875", PD)', why: 'Open, but 2.25 MB gz (8.8 MB raw), each book above the 450 KB per-file limit of the bundled packs: left for a download / remote layer.' },
    { item: 'Bekhor Shor (Leipzig 1856, Budapest 1924/1928, Breslau 1890/1900/1914 — PD; London 1959, Jerusalem 1960/1994, MS Munich — unknown)', why: 'Open only as partial scholarly prints split per book, several recorded unknown: not one pinned edition per book yet.' },
    { item: 'Minchat Shai, Toldot Yitzchak', why: 'No Sefaria index under these titles (the versions API answers "Could not find title").' },
  ],
  corpora: { ...previous.corpora },
};
for (const corpus of selected) {
  const result = await buildCorpus(corpus);
  provenance.corpora[corpus.id] = { builtAt: RETRIEVED_AT, editions: result.editions, remoteLayers: result.remote };
  console.log(JSON.stringify({ corpus: corpus.id, ...result.summary }, null, 1));
}
mkdirSync(join(ROOT, 'sources/sefaria-commentaries'), { recursive: true });
writeFileSync(provenanceFile, `${JSON.stringify(provenance, null, 1)}\n`);
