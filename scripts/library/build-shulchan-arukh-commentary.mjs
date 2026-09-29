// The Shulchan Arukh's nosei kelim as relationship layers: every comment (seif katan) anchored to the siman:seif of the
// Shulchan Arukh it explains, on the relation/anchor/coverage model of docs/library/content-model.md.
// Run: node scripts/library/build-shulchan-arukh-commentary.mjs [--cache /tmp/kz-library-cache/shulchan-arukh]
//        [--offline] [--refresh-wikisource] [--retrieved-at YYYY-MM-DD]
//
// Bundled (on the device):
// - משנה ברורה and ביאור הלכה: he.wikisource (CC BY-SA 4.0), a transcription of the author's print (1884–1907, public
//   domain). Every page is pinned to its revision (oldid) in sources/shulchan-arukh-commentaries/provenance.json. The
//   seif comes from the page itself: each section is headed by a link to the seif of the Shulchan Arukh it explains.
// - באר היטב על אורח חיים: Sefaria "Torat Emet 357" (Public Domain). The seif comes from the printed markers of the
//   Shulchan Arukh "Maginei Eretz, Lemberg 1893" (Public Domain), where every seif carries the letters of the
//   commentaries printed on it (<i data-commentator="Ba'er Hetev" data-order="3">).
// - כף החיים על אורח חיים: Sefaria "Kaf Hachayim, Orach Chayim vol. I-IV" + "vol. V-VIII, Jerusalem 1910-1933" —
//   one edition (one NLI record, one print) split in two halves that do not overlap; the build proves both. The seif
//   comes from the print's own "[סעיף …]" at the head of each seif katan.
// Remote (read live, one exact edition each, never stored): Magen Avraham, Taz (4 parts), Shach (YD, CM), Be'er
// Heitev (YD, EH, CM), Kaf HaChaim YD, Aruch HaShulchan (4 parts). Their s"k → seif maps (from the same printed markers)
// ship as small side files so the live text is grouped by seif too.
//
// Licences are re-read LIVE on every run (Sefaria /api/texts/versions/<Title>; Wikisource siteinfo rightsinfo), never
// from the cache; anything not Public Domain / CC0 / CC-BY / CC-BY-SA stops the build. Markup cleanup only: the words of
// an edition are never changed. Nothing missing is filled from another edition.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checksum } from '../../src/services/prayer/checksum.mjs';
import { COVERAGE, coverageRecord, validateWorkChunk } from '../../src/services/library/integrity.mjs';
import PACK_INDEX from '../../src/data/library/packIndex.mjs';
import { cleanText } from './clean.mjs';
import { hebrewNumeral } from '../../src/services/hebrewNumerals.mjs';
import { WIKISOURCE_LICENSE, apiGet, fetchPages, listPages, oldidUrl, pageUrl, wikitextToParagraphs } from './wikisource.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const CACHE = arg('--cache', '/tmp/kz-library-cache/shulchan-arukh');
const OFFLINE = args.includes('--offline');
const REFRESH = args.includes('--refresh-wikisource');
const RETRIEVED_AT = arg('--retrieved-at', new Date().toISOString().slice(0, 10));
const SEFARIA = 'https://www.sefaria.org';
const PROVENANCE = join(ROOT, 'sources/shulchan-arukh-commentaries/provenance.json');
mkdirSync(CACHE, { recursive: true });
const fail = message => { throw new Error(message); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha256 = text => createHash('sha256').update(text).digest('hex');
const safe = name => name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 180);
const previous = existsSync(PROVENANCE) ? JSON.parse(readFileSync(PROVENANCE, 'utf8')) : null;

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
// Licences are read live on every run (the copy kept in the cache is only a record of what was seen).
const liveSeen = new Map();
async function liveVersions(title) {
  if (liveSeen.has(title)) return liveSeen.get(title);
  const file = join(CACHE, `${safe(`versions-${title}`)}.json`);
  if (OFFLINE) { if (!existsSync(file)) fail(`offline: no licence record for ${title}`); return JSON.parse(readFileSync(file, 'utf8')); }
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const data = await getJson(`${SEFARIA}/api/texts/versions/${encodeURIComponent(title)}`);
    if (Array.isArray(data)) { writeFileSync(file, JSON.stringify(data)); liveSeen.set(title, data); return data; }
    if (attempt === 5) fail(`${title}: the versions API answered ${JSON.stringify(data).slice(0, 200)}`);
    await sleep(1500 * attempt);
  }
}
const exportUrl = (title, versionTitle) => `${SEFARIA}/download/version/${encodeURIComponent(`${title} - he - ${versionTitle}`)}.json`;
const shapeUrl = title => `${SEFARIA}/api/shape/${encodeURIComponent(title)}`;
const OPEN = { 'public domain': 'public-domain', pd: 'public-domain', cc0: 'public-domain', 'cc-by': 'cc-by', 'cc-by-sa': 'cc-by-sa' };
function licenceOf(version, title) {
  const recorded = String(version.license || '').trim();
  const id = OPEN[recorded.toLowerCase()];
  if (!id) fail(`${title} / ${version.versionTitle}: licence "${recorded}" is not open (NC and unknown are never imported)`);
  const wikisource = /wikisource\.org/i.test(version.versionSource || '');
  return { license: wikisource ? 'cc-by-sa' : id, recordedLicense: recorded, wikisource };
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
const nonEmpty = value => typeof value === 'string' && value.trim() !== '';

// ---------- Hebrew numerals ----------
const LETTER = { א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9, י: 10, כ: 20, ך: 20, ל: 30, מ: 40, ם: 40, נ: 50, ן: 50, ס: 60, ע: 70, פ: 80, ף: 80, צ: 90, ץ: 90, ק: 100, ר: 200, ש: 300, ת: 400 };
export function gematria(value) {
  let text = String(value || '').replace(/[׳״'"\s.]/g, '');
  if (text === 'יוד') text = 'י';
  if (!/^[א-ת]+$/.test(text)) return null;
  return [...text].reduce((total, letter) => total + LETTER[letter], 0);
}
const HE_DIGITS = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const HE_TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const HE_HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];
const numeralPlain = n => { const h = HE_HUNDREDS[Math.floor(n / 100)]; const rest = n % 100; if (rest === 15) return `${h}טו`; if (rest === 16) return `${h}טז`; return `${h}${HE_TENS[Math.floor(rest / 10)]}${HE_DIGITS[rest % 10]}`; };

// ---------- The base: the Shulchan Arukh already in the library ----------
const SA_PACK = PACK_INDEX.find(pack => pack.packId === 'sefaria-shulchan-arukh-pd') || fail('the Shulchan Arukh pack is missing');
const PARTS = {
  oc: { key: 'oc', he: 'אורח חיים', title: 'Shulchan Arukh, Orach Chayim', wsName: 'אורח חיים', markerVersion: 'Maginei Eretz: Shulchan Aruch Orach Chaim, Lemberg, 1893', ahPart: 'Orach Chaim' },
  yd: { key: 'yd', he: 'יורה דעה', title: "Shulchan Arukh, Yoreh De'ah", markerVersion: 'Ashlei Ravrevei: Shulchan Aruch Yoreh Deah, Lemberg, 1888', ahPart: "Yoreh De'ah" },
  eh: { key: 'eh', he: 'אבן העזר', title: 'Shulchan Arukh, Even HaEzer', markerVersion: 'Apei Ravrevei: Shulchan Aruch Even HaEzer, Lemberg, 1886', ahPart: 'Even HaEzer' },
  cm: { key: 'cm', he: 'חושן משפט', title: 'Shulchan Arukh, Choshen Mishpat', markerVersion: 'Shulhan Arukh, Hoshen ha-Mishpat, Lemberg, 1898', ahPart: 'Choshen Mishpat' },
};
for (const part of Object.values(PARTS)) {
  const base = SA_PACK.works.find(work => work.title === part.title) || fail(`no base work ${part.title}`);
  Object.assign(part, { base, baseWorkId: base.workId, baseHe: base.heTitle, seifim: base.nodes.map((count, i) => Math.max(count, base.expected[i] || 0)) });
}
const baseCanonical = part => part.title;

// The printed commentary markers of a Shulchan Arukh edition: per siman, per commentator, s"k number → seif. Used only
// where the marker edition divides the siman into the same seifim as the edition in the library.
const markerCache = new Map();
async function markersOf(part) {
  if (markerCache.has(part.key)) return markerCache.get(part.key);
  const { version, licence, data, exportSha256 } = await loadEdition(part.title, part.markerVersion);
  if (licence.license !== 'public-domain') fail(`${part.title} / ${part.markerVersion}: the marker edition must be public domain`);
  const text = Array.isArray(data.text) ? data.text : data.text[''] || fail(`${part.title} / ${part.markerVersion}: no default body (${Object.keys(data.text)})`);
  const bySiman = [];
  const seifMismatch = [];
  text.forEach((seifim, s) => {
    const siman = s + 1;
    const map = new Map();
    const same = (seifim || []).length === part.seifim[s];
    if (!same) seifMismatch.push(siman);
    (seifim || []).forEach((html, f) => {
      for (const m of String(html || '').matchAll(/<i\s+data-commentator=["“]?([^">]+?)["”]?\s*((?:data-[a-z]+="[^"]*"\s*)*)><\/i>/g)) {
        const name = m[1].trim();
        const order = /data-order="(\d+)"/.exec(m[2])?.[1];
        const label = /data-label="([^"]+)"/.exec(m[2])?.[1];
        const n = order ? Number(order) : label ? gematria(label) : null;
        if (!n) continue;
        if (!map.has(name)) map.set(name, []);
        map.get(name).push([n, f + 1]);
      }
    });
    bySiman[siman] = same ? map : null;
  });
  const result = { bySiman, seifMismatch, record: { title: part.title, versionTitle: part.markerVersion, recordedLicense: licence.recordedLicense, versionSource: version.versionSource || null, export: exportUrl(part.title, part.markerVersion), exportTextSha256: exportSha256, licenseVerifiedAt: RETRIEVED_AT, simanimWithOtherSeifDivision: seifMismatch } };
  markerCache.set(part.key, result);
  return result;
}
// s"k → seif for one commentator and siman, when the printed markers number exactly the comments the edition has.
function seifMapFor(markers, commentator, siman, count) {
  const rows = markers.bySiman[siman]?.get(commentator);
  if (!rows || !count) return null;
  const map = new Array(count).fill(0);
  for (const [n, seif] of rows) { if (n < 1 || n > count || map[n - 1]) return null; map[n - 1] = seif; }
  return map.every(Boolean) ? map : null;
}

// ---------- Wikisource: משנה ברורה, ביאור הלכה ----------
async function wikisourceRights() {
  const file = join(CACHE, 'wikisource-rightsinfo.json');
  if (OFFLINE) return JSON.parse(readFileSync(file, 'utf8'));
  const data = await apiGet({ action: 'query', meta: 'siteinfo', siprop: 'rightsinfo' });
  writeFileSync(file, JSON.stringify(data));
  return data;
}
const WS_EXTRA_TEMPLATES = {
  'פרשן על שו"ע': null,          // navigation bar (previous / next siman)
  'מח': args => (args[1] ?? '').trim(),  // author's name highlight
  'בוצע': null,
  'ר': args => (args[1] ?? '').trim(),
  'ססס': () => ' ',
  'ש': () => '\n\n',
  'ר0': () => '',
  'עוגן': () => '',
  'עוגן1': () => '',
  'מ:הערה': null,
  'ביאור הלכה': args => (args[1] ?? '').trim(),
  'שם הספר': args => (args[1] ?? '').trim(),
  'קישור כחול': args => (args[2] ?? args[1] ?? '').trim(),
  'תמ': args => (args[1] ?? '').trim(),          // a date as printed, with its reading beside it
  'מ"מ': args => `(${[(args[1] ?? '').trim(), [(args[2] ?? '').trim(), (args[3] ?? '').trim()].filter(Boolean).join(', ')].filter(Boolean).join(' ')})`,
  'ק': args => (args[1] ?? '').trim(),
  'שוליים': null,
  'תוכן עניינים שטוח': null,
  'להשלים': null,
  // Page references, as the site renders them: "(דף כג:)", "(פ"ו ה"ו)".
  'הפניה-גמ': args => `(דף ${(args[2] ?? '').trim()}${(args[3] ?? '').trim() === 'ב' ? ':' : '.'})`,
  'הפניה-ירושלמי': args => `(פ"${(args[2] ?? '').trim()} ה"${(args[3] ?? '').trim()})`,
};

// One page → { sections: [{ seif, heading, comments: [{ n, dh, raw }] }], intro, named, skipped, noComment }.
// The pages mark each seif katan with {{משע|<abbr>|<letter>|<opening words>}}; a few pages keep the printed form
// "(ב) '''opening words''' - …" instead (accepted only for the next letter in order, so a "(ב)" inside the text is never
// taken for a comment). Prose before the first comment of the siman is the author's introduction to it; sections headed
// by a name (משנת סופרים, צורת האותיות…) are the author's named treatises; sections in bold or named "הערות" are the
// site editors' notes and are not imported; a heading "סימן X" for another siman starts text that belongs to that page.
const EDITORIAL_HEADING = /^'''|^הערות/;
function splitWikisourcePage(content, abbrs, title, siman, { parenFallback = false } = {}) {
  const result = { sections: [], intro: [], named: [], skipped: [], noComment: 0, editorNotes: 0 };
  const text = content.replace(/<noinclude>[\s\S]*?<\/noinclude>/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    // Site editors' notes at the foot of a page ("{{שולייםלמטה|1}} …") and their markers ("{{שוליים|1}}").
    .replace(/^\s*\{\{\s*שולייםלמטה\s*\|[^}]*\}\}.*$/gm, () => { result.editorNotes += 1; return ''; })
    .replace(/\{\{\s*שוליים\s*\|[^}]*\}\}/g, '')
    .replace(/^-{4,}\s*$/gm, '')
    // A seif named by a bare link line ("[[שולחן ערוך אורח חיים ד א|סעיף א]]") is a heading like the others.
    .replace(/^\[\[\s*(שולחן ערוך [^|\]]+)\|\s*(סעיף [^\]]+)\]\]\s*$/gm, '===[[$1|$2]]===');
  // Pages that never use the comment template list their comments as bullets ("* '''opening words''' - …"): numbered
  // in order of the page.
  const bullets = !new RegExp(`\\{\\{\\s*משע\\s*\\|\\s*(?:${abbrs.join('|')})\\s*\\|`).test(text);
  const heads = [...text.matchAll(/^={2,4}\s*(.*?)\s*={2,4}\s*$/gm)];
  // Comments before any heading (a page of one seif, or a first seif left without its heading): the section is named by
  // the page's own section marker (<קטע התחלה=א/>), which is the seif.
  const firstHead = heads[0]?.index ?? text.length;
  if (/\{\{\s*משע\s*\|/.test(text.slice(0, firstHead))) {
    const marker = /<קטע\s+התחלה\s*=\s*"?([א-ת"׳״']+)"?\s*\/?>/.exec(text.slice(0, firstHead))?.[1];
    if (!marker) fail(`${title}: comments before the first heading, with no section marker`);
    heads.unshift({ index: 0, 0: '', 1: `סעיף ${marker}`, synthetic: true });
  }
  let foreign = false;
  let last = 0;
  const markerRe = new RegExp(`\\{\\{\\s*משע\\s*\\|\\s*(?:${abbrs.join('|')})\\s*\\|([^|}]*)\\|?([^}]*)\\}\\}`, 'g');
  const parenRe = /^[ \t]*(?:<קטע[^>]*>[ \t]*)?(''')?\s*\(([א-ת]{1,3})\)[ \t]*/gm;
  const clean = value => value.replace(/<קטע[^>]*>/g, '').replace(/\[\[קטגוריה:[^\]]*\]\]/g, '').replace(/\{\{\s*להשלים\s*\}\}/g, '').replace(/\{\{\s*פרשן על שו"ע[^}]*\}\}/g, '').trim();
  heads.forEach((h, i) => {
    const heading = h[1].trim();
    const body = h.synthetic ? text.slice(0, heads[i + 1]?.index ?? text.length) : text.slice(h.index + h[0].length, heads[i + 1]?.index ?? text.length);
    const simanHead = /^סימן\s+([א-ת"׳״']+)$/.exec(heading);
    if (simanHead) { foreign = gematria(simanHead[1]) !== siman; if (foreign) result.skipped.push(`another siman: ${heading}`); return; }
    if (foreign) { if (clean(body)) result.skipped.push(`under another siman: ${heading}`); return; }
    if (EDITORIAL_HEADING.test(heading)) { if (clean(body)) result.skipped.push(`editors: ${heading}`); return; }
    const label = /סעיף\s+([א-ת"׳״']+)/.exec(heading)?.[1];
    const seif = label ? gematria(label) : null;
    if (!seif && !/סעיף/.test(heading)) {
      // A named treatise of the author (siman 36: משנת סופרים, צורת האותיות).
      if (clean(body)) result.named.push({ title: heading.replace(/\[\[[^|\]]*\|([^\]]*)\]\]/g, '$1').replace(/\[\[([^\]]*)\]\]/g, '$1'), raw: clean(body) });
      return;
    }
    const marks = [...body.matchAll(markerRe)].map(m => ({ at: m.index, end: m.index + m[0].length, letter: m[1].trim(), dh: m[2].replace(/\|/g, ' ').trim(), kind: 'template' }));
    if (parenFallback) for (const m of body.matchAll(parenRe)) marks.push({ at: m.index, end: m.index + m[0].length, letter: m[2], dh: '', kind: 'paren', boldLead: Boolean(m[1]) });
    if (bullets) for (const m of body.matchAll(/^[ \t]*(?:<קטע[^>]*>[ \t]*)?\*[ \t]*(?=''')/gm)) marks.push({ at: m.index, end: m.index + m[0].length, letter: null, dh: '', kind: 'bullet' });
    marks.sort((a, b) => a.at - b.at);
    const accepted = [];
    for (const mark of marks) {
      const n = mark.kind === 'bullet' ? last + 1 : gematria(mark.letter);
      if (mark.kind === 'paren' && n !== last + 1) continue;
      if (accepted.length && mark.at < accepted.at(-1).end) continue;
      accepted.push({ ...mark, n });
      if (n) last = n;
    }
    const lead = clean(body.slice(0, accepted[0]?.at ?? body.length));
    if (lead) {
      if (/^אין(?:\s+על\s+סעיף\s+[א-ת"׳״']+)?[.:]?$/.test(lead)) result.noComment += 1;
      else if (!result.sections.some(sec => sec.comments.length) && /[א-ת]/.test(lead)) result.intro.push(lead);
      else if (/[א-ת]/.test(lead)) fail(`${title}: text outside a comment under "${heading}": ${lead.slice(0, 80)}`);
    }
    const comments = accepted.map((mark, k) => ({ n: mark.n, letter: mark.letter, dh: mark.dh, kind: mark.kind, boldLead: mark.boldLead, raw: body.slice(mark.end, accepted[k + 1]?.at ?? body.length) }));
    result.sections.push({ seif, heading, comments });
  });
  return result;
}

// Links first, innermost to outermost, so a label in brackets ("[[טור …|[ב"י]]") or a link inside brackets
// ("[ [[…|ביו"ד]]]") keeps its printed brackets and loses only the link.
const unlink = raw => raw
  .replace(/\[\[([^[\]|]+)\|\[([^[\]]*)\]\](?!\])/g, '[$2]')
  // "[ [[…|ביו"ד סימן ש"צ ס"ו] ]]": a bracket closed inside the link label.
  .replace(/\[\[([^[\]|]+)\|([^[\]]*)\]\s*\]\]/g, '$2]')
  .replace(/\[\[(?:[^[\]|]+)\|([^[\]]*)\]\]/g, '$1')
  .replace(/\[\[(?!קטגוריה:)([^[\]|]+)\]\]/g, (m, target) => target.replace(/#.*$/, ''));
function wikisourceComment(comment, stats) {
  let raw = unlink(comment.raw.replace(/\[\[קטגוריה:[^\]]*\]\]/g, '').replace(/<קטע[^>]*>/g, ''));
  let dh = comment.dh;
  if (comment.kind === 'paren') {
    // "'''(א) opening words -'''", "(ב) '''opening words''' -" or "(ק) opening words - …".
    if (comment.boldLead) { const close = raw.indexOf("'''"); if (close >= 0) { dh = raw.slice(0, close); raw = raw.slice(close + 3); } }
    else if (!/^\s*'''/.test(raw)) { const m = /^(.{1,140}?)\s+[–—-]{1,2}\s/.exec(raw); if (m) { dh = m[1]; raw = raw.slice(m[0].length); } }
    dh = dh.replace(/\s*[–—-]+\s*$/, '');
  }
  // Bold words printed right after the opening words belong to them ("ראוי לכל '''וכו''''").
  const bold = /^\s*'''([^']*(?:'(?!'')[^']*)*)'''/.exec(raw);
  if (bold) { dh = `${dh} ${bold[1].trim()}`.trim(); raw = raw.slice(bold[0].length); }
  // "'''אם הוסקה וכו''''": the fourth quote is the abbreviation's own apostrophe.
  if (/^'(?=[\s:–—-])/.test(raw) && /וכו$/.test(dh)) { dh = `${dh}'`; raw = raw.slice(1); }
  const dhText = dh ? wikitextToParagraphs(dh, stats, WS_EXTRA_TEMPLATES).paragraphs.join(' ') : '';
  const { paragraphs } = wikitextToParagraphs(raw, stats, WS_EXTRA_TEMPLATES);
  if (paragraphs.length) paragraphs[0] = paragraphs[0].replace(/^[:\s]*[–—-]{1,2}\s*/, '');
  // A dash left at the end of a paragraph where the site's footnote marker stood ("…על פיה: - {{שוליים|1}}").
  const text = paragraphs.map(p => (comment.kind === 'paren' ? p.replace(/\s+[–—-]\s*$/, '') : p)).filter(p => p.trim()).join('\n');
  return { dh: dhText.replace(/\s+/g, ' ').replace(/\s*[–—-]+$/, '').trim(), text };
}
const proseOf = (raw, stats) => wikitextToParagraphs(unlink(raw), stats, WS_EXTRA_TEMPLATES).paragraphs.filter(p => p.trim()).join('\n');

async function buildWikisourceWork({ workId, abbrs, parenFallback = false, prefix, indexTitle, shapeTitle, he, heTitle, rank, author, sefariaTitle }) {
  const part = PARTS.oc;
  const titles = (await listPages(prefix)).filter(title => new RegExp(`^${prefix}[א-ת"]+$`).test(title));
  const bySiman = new Map();
  for (const title of titles) {
    const siman = gematria(title.slice(prefix.length));
    if (!siman || siman > part.seifim.length) fail(`${title}: not a siman of ${part.title}`);
    if (bySiman.has(siman)) fail(`${title}: siman ${siman} has two pages`);
    bySiman.set(siman, title);
  }
  const pinned = !REFRESH && previous?.wikisource?.[workId]?.pages ? Object.fromEntries(previous.wikisource[workId].pages.map(page => [page.title, page.revid])) : {};
  const pages = await fetchPages([indexTitle, ...bySiman.values()], { cache: join(CACHE, 'wikisource'), revids: pinned, offline: OFFLINE });
  // Expected: Sefaria's shape of the same work (the count of comments per siman in the printed structure).
  const shapeRaw = await cachedJson(`shape-${shapeTitle}`, shapeUrl(shapeTitle));
  const shape = (shapeRaw[0].chapters || []).map(ch => (Array.isArray(ch) ? ch.reduce((a, b) => a + (Array.isArray(b) ? b.length : Number(b) || 0), 0) : Number(ch) || 0));
  const stats = {};
  const nodes = new Map();
  const expected = new Map();
  const anchors = [];
  const missing = [];
  const problems = { duplicateLetters: [], noSeif: [], seifBeyondBase: [], beyondShape: 0, skippedSections: [], noCommentNotes: 0, editorNotes: 0, parenForm: 0 };
  const pageRecords = [];
  const extras = []; // { siman, title, units: [{ title, text }] } — introductions and named treatises, after the simanim
  for (let siman = 1; siman <= part.seifim.length; siman += 1) {
    const title = bySiman.get(siman);
    const units = [];
    if (title) {
      const page = pages[title];
      pageRecords.push({ title, siman, revid: page.revid, timestamp: page.timestamp, oldidUrl: oldidUrl(page.revid), sha256: sha256(page.content) });
      const seen = new Map();
      const split = splitWikisourcePage(page.content, abbrs, title, siman, { parenFallback });
      problems.skippedSections.push(...split.skipped.map(item => `${siman}: ${item}`));
      problems.noCommentNotes += split.noComment;
      problems.editorNotes += split.editorNotes;
      if (split.intro.length) extras.push({ siman, title: `הקדמה לסימן ${hebrewNumeral(siman)}`, units: [{ title: 'הקדמה', text: split.intro.map(raw => proseOf(raw, stats)).join('\n') }] });
      if (split.named.length) extras.push({ siman, title: split.named[0].title, units: split.named.map(item => ({ title: item.title, text: proseOf(item.raw, stats) })) });
      const unnumbered = [];
      for (const section of split.sections) {
        for (const comment of section.comments) {
          // A comment printed without a letter ("•"): kept, before the numbered comments of the siman.
          if (!comment.n) { if (!/^[•·*]$/.test(comment.letter)) fail(`${title}: comment letter "${comment.letter}" is not a numeral`); const { dh, text } = wikisourceComment(comment, stats); unnumbered.push({ title: 'בלא אות', dh, text }); problems.unnumbered = (problems.unnumbered || 0) + 1; continue; }
          if (comment.kind === 'paren') problems.parenForm += 1;
          const { dh, text } = wikisourceComment(comment, stats);
          if (!text && !dh) continue;
          // A letter printed twice (the print itself repeats it, e.g. MB 219 כ״ח): the second comment is kept, joined to
          // the first under the same number, with its opening words as its first line.
          if (seen.has(comment.n)) { problems.duplicateLetters.push(`${siman}:${comment.letter}`); const first = seen.get(comment.n); first.text = [first.text, [dh, text].filter(Boolean).join(' – ')].join('\n'); continue; }
          let seif = section.seif;
          if (seif && seif > part.seifim[siman - 1]) { problems.seifBeyondBase.push(`${siman}:${seif}`); seif = null; }
          if (!seif) problems.noSeif.push(`${siman}:${comment.letter}`);
          seen.set(comment.n, { n: comment.n, ...(seif ? { v: seif } : {}), ...(dh && text ? { dh } : {}), text: text || dh });
        }
      }
      if (unnumbered.length) extras.push({ siman, title: `הקדמה לסימן ${hebrewNumeral(siman)}`, units: unnumbered });
      units.push(...[...seen.values()].sort((a, b) => a.n - b.n));
    }
    const last = units.at(-1)?.n || 0;
    // Sefaria's shape counts a siman's introduction as one more segment; here the introduction is its own node.
    let shaped = shape[siman - 1] || 0;
    if (extras.some(extra => extra.siman === siman && extra.title.startsWith('הקדמה')) && shaped === last + 1) { shaped = last; problems.shapeCountsIntro = (problems.shapeCountsIntro || 0) + 1; }
    const slots = Math.max(shaped, last);
    if (last > shaped) problems.beyondShape += last - shaped;
    const present = new Set(units.map(unit => unit.n));
    for (let n = 1; n <= slots; n += 1) if (!present.has(n)) missing.push(`${workId}.${siman}.${n}`);
    expected.set(siman, slots);
    if (units.length) nodes.set(siman, units.map(unit => ({ id: `${workId}.${siman}.${unit.n}`, ...unit })));
    for (const unit of units) if (unit.v) anchors.push([siman, unit.n, unit.v]);
  }
  // Introductions and named treatises: their own nodes after the simanim, each shown beside the siman it opens.
  const extraNodes = extras.map((extra, i) => {
    const n = part.seifim.length + i + 1;
    const units = extra.units.filter(unit => unit.text).map((unit, k) => ({ id: `${workId}.${n}.${k + 1}`, n: k + 1, ...(unit.dh ? { dh: unit.dh } : { title: unit.title }), text: unit.text }));
    nodes.set(n, units);
    expected.set(n, units.length);
    return { n, siman: extra.siman, title: extra.title, units: units.length };
  });
  if (stats.unknownTemplates) fail(`${workId}: unknown templates ${JSON.stringify(stats.unknownTemplates)}`);
  const index = pages[indexTitle];
  return {
    workId, title: sefariaTitle, he, heTitle, shortTitle: he, rank, author, part, nodes, expected, anchors, missing, stats, problems, extraNodes,
    license: 'cc-by-sa', recordedLicense: 'CC BY-SA 4.0 (he.wikisource.org)', provider: 'wikisource', editionTitle: `Wikisource — ${indexTitle}`, editionHeTitle: `ויקיטקסט העברי · ${indexTitle}`,
    versionSource: pageUrl(indexTitle), providerUrl: pageUrl(indexTitle), anchorScheme: 'seif-markers', anchorBasis: 'the page\'s seif headings ([[שולחן ערוך אורח חיים <siman> <seif>|סעיף …]])',
    coverageBasis: `Sefaria /api/shape/${shapeTitle} (comments per siman); ${bySiman.size} Wikisource pages`,
    wikisource: { index: { title: indexTitle, revid: index.revid, oldidUrl: oldidUrl(index.revid), sha256: sha256(index.content), statement: /(עפ"י[^|}]*|נדפס[^|}]*)/.exec(index.content)?.[1]?.trim() || null }, pages: pageRecords, pagesExpected: titles.length },
    nodeUnitLabel: 'סעיף קטן',
  };
}

// ---------- Sefaria: באר היטב (OC), כף החיים (OC) ----------
function splitBold(html, stats) {
  const value = String(html ?? '');
  const m = /^\s*<b>([\s\S]*?)<\/b>([\s\S]*)$/.exec(value);
  if (m) {
    const dh = cleanText(m[1], stats);
    const rest = cleanText(m[2], stats);
    if (dh && rest) return { dh, text: rest };
  }
  return { text: cleanText(value, stats) };
}
async function buildBaerHetevOc() {
  const part = PARTS.oc;
  const title = "Ba'er Hetev on Shulchan Arukh, Orach Chayim";
  const versionTitle = 'Torat Emet 357';
  const edition = await loadEdition(title, versionTitle);
  const markers = await markersOf(part);
  const workId = 'Baer_Hetev_on_Shulchan_Arukh_Orach_Chayim';
  const shapeRaw = await cachedJson(`shape-${title}`, shapeUrl(title));
  const shape = shapeRaw[0].chapters.map(Number);
  const stats = {};
  const nodes = new Map(); const expected = new Map(); const anchors = []; const missing = []; const problems = { unmappedSimanim: [], beyondShape: 0 };
  edition.data.text.forEach((comments, s) => {
    const siman = s + 1;
    let last = 0;
    (comments || []).forEach((value, k) => { if (nonEmpty(value)) last = k + 1; });
    const slots = Math.max(shape[s] || 0, last);
    if (last > (shape[s] || 0)) problems.beyondShape += last - (shape[s] || 0);
    const map = seifMapFor(markers, "Ba'er Hetev", siman, (comments || []).length);
    if ((comments || []).some(nonEmpty) && !map) problems.unmappedSimanim.push(siman);
    const units = [];
    for (let n = 1; n <= slots; n += 1) {
      const value = comments?.[n - 1];
      const comment = nonEmpty(value) ? splitBold(value, stats) : null;
      if (!comment?.text) { missing.push(`${workId}.${siman}.${n}`); continue; }
      const v = map?.[n - 1] || null;
      units.push({ id: `${workId}.${siman}.${n}`, n, ...(v ? { v } : {}), ...(comment.dh ? { dh: comment.dh } : {}), text: comment.text });
      if (v) anchors.push([siman, n, v]);
    }
    expected.set(siman, slots);
    if (units.length) nodes.set(siman, units);
  });
  return {
    workId, title, he: 'באר היטב', heTitle: 'באר היטב על שולחן ערוך אורח חיים', shortTitle: 'באר היטב · אורח חיים', rank: 3, author: 'רבי יהודה אשכנזי (באר היטב)', part, nodes, expected, anchors, missing, stats, problems,
    license: edition.licence.license, recordedLicense: edition.licence.recordedLicense, provider: 'sefaria', editionTitle: versionTitle, editionHeTitle: edition.version.versionTitleInHebrew || versionTitle,
    versionSource: edition.version.versionSource || null, providerUrl: `${SEFARIA}/${encodeURIComponent(title)}`, anchorScheme: 'seif-markers',
    anchorBasis: `the printed commentary markers of "${part.markerVersion}" (Public Domain)`, coverageBasis: `Sefaria /api/shape/${title}`,
    sefaria: [{ title, versionTitle, recordedLicense: edition.licence.recordedLicense, versionSource: edition.version.versionSource || null, export: exportUrl(title, versionTitle), exportTextSha256: edition.exportSha256, licenseVerifiedAt: RETRIEVED_AT, versions: `${SEFARIA}/api/texts/versions/${encodeURIComponent(title)}` }],
    nodeUnitLabel: 'סעיף קטן',
  };
}

// "[סעיף א']", "[סעיף יוד']", "[סעיף ך']": the print's own seif marker at the head of a seif katan.
const KH_SEIF = /\[\s*סעי(?:ף|')?\s*([א-ת]{1,3}(?:["״][א-ת])?)\s*['׳"״]?\s*[\]ו ]/;
function khSeifOf(head) {
  const m = KH_SEIF.exec(String(head || '').slice(0, 220));
  return m ? gematria(m[1]) : null;
}
// Kaf HaChaim's seifim follow the print: a seif katan without its own marker ("שם") stays on the seif before it.
function khSeifMap(comments, seifCount) {
  const out = [];
  let current = null;
  let ok = true;
  for (const paragraphs of comments) {
    const head = Array.isArray(paragraphs) ? paragraphs.find(nonEmpty) : paragraphs;
    const seif = khSeifOf(head);
    if (seif) current = seif;
    out.push(current && current <= seifCount ? current : 0);
    if (seif && seif > seifCount) ok = false;
  }
  return { map: out, ok };
}

async function buildKafHaChaimOc() {
  const part = PARTS.oc;
  const title = 'Kaf HaChayim on Shulchan Arukh, Orach Chayim';
  const halves = ['Kaf Hachayim, Orach Chayim vol. I-IV, Jerusalem 1910-1933', 'Kaf Hachayim, Orach Chayim vol. V-VIII, Jerusalem 1910-1933'];
  const editions = [];
  for (const versionTitle of halves) editions.push(await loadEdition(title, versionTitle));
  // One edition split in two: the same provider record and print, both public domain, and no siman in both halves.
  const sources = new Set(editions.map(e => e.version.versionSource));
  if (sources.size !== 1) fail(`${title}: the two halves name different sources ${[...sources]}`);
  if (editions.some(e => e.licence.license !== 'public-domain')) fail(`${title}: a half is not public domain`);
  const has = (e, s) => (e.data.text[s] || []).some(sk => (Array.isArray(sk) ? sk : [sk]).some(nonEmpty));
  const ranges = editions.map(e => { const simanim = e.data.text.map((_, s) => s + 1).filter(siman => has(e, siman - 1)); return { from: simanim[0], to: simanim.at(-1), count: simanim.length }; });
  const overlap = part.seifim.map((_, s) => s).filter(s => editions.every(e => has(e, s))).map(s => s + 1);
  if (overlap.length) fail(`${title}: simanim in both halves ${overlap.slice(0, 10)}`);
  if (!(ranges[0].to < ranges[1].from)) fail(`${title}: the halves are not consecutive ${JSON.stringify(ranges)}`);
  const workId = 'Kaf_HaChayim_on_Shulchan_Arukh_Orach_Chayim';
  const shapeRaw = await cachedJson(`shape-${title}`, shapeUrl(title));
  const shape = shapeRaw[0].chapters.map(ch => (Array.isArray(ch) ? ch.length : 0));
  const stats = {};
  const nodes = new Map(); const expected = new Map(); const anchors = []; const missing = []; const problems = { seifOutOfRange: [], unanchored: 0, beyondShape: 0 };
  for (let s = 0; s < part.seifim.length; s += 1) {
    const siman = s + 1;
    const source = editions.find(e => has(e, s)) || editions[siman >= ranges[1].from ? 1 : 0];
    const comments = source.data.text[s] || [];
    let last = 0;
    comments.forEach((paragraphs, k) => { if ((Array.isArray(paragraphs) ? paragraphs : [paragraphs]).some(nonEmpty)) last = k + 1; });
    const slots = Math.max(shape[s] || 0, last);
    if (last > (shape[s] || 0)) problems.beyondShape += last - (shape[s] || 0);
    const { map, ok } = khSeifMap(comments, part.seifim[s]);
    if (!ok) problems.seifOutOfRange.push(siman);
    const units = [];
    for (let n = 1; n <= slots; n += 1) {
      const paragraphs = (Array.isArray(comments[n - 1]) ? comments[n - 1] : [comments[n - 1]]).filter(nonEmpty);
      if (!paragraphs.length) { missing.push(`${workId}.${siman}.${n}`); continue; }
      const first = splitBold(paragraphs[0], stats);
      // The seif katan's own letter ("א)") opens the bold words in print; it is shown as the unit's number instead.
      const dh = first.dh ? first.dh.replace(new RegExp(`^${numeralPlain(n)}\\)\\s*`), '') : null;
      const text = [first.text, ...paragraphs.slice(1).map(p => cleanText(p, stats))].filter(Boolean).join('\n');
      if (!text) { missing.push(`${workId}.${siman}.${n}`); continue; }
      const v = map[n - 1] || null;
      units.push({ id: `${workId}.${siman}.${n}`, n, ...(v ? { v } : {}), ...(dh ? { dh } : {}), text });
      if (v) anchors.push([siman, n, v]); else problems.unanchored += 1;
    }
    expected.set(siman, slots);
    if (units.length) nodes.set(siman, units);
  }
  return {
    workId, title, he: 'כף החיים', heTitle: 'כף החיים על שולחן ערוך אורח חיים', shortTitle: 'כף החיים · אורח חיים', rank: 4, author: 'רבי יעקב חיים סופר', part, nodes, expected, anchors, missing, stats, problems,
    license: 'public-domain', recordedLicense: editions[0].licence.recordedLicense, provider: 'sefaria', editionTitle: 'Kaf Hachayim, Orach Chayim vol. I-VIII, Jerusalem 1910-1933',
    editionHeTitle: 'כף החיים, אורח חיים חלקים א׳–ח׳, ירושלים תר״ע–תרצ״ג', versionSource: editions[0].version.versionSource || null, providerUrl: `${SEFARIA}/${encodeURIComponent(title)}`,
    anchorScheme: 'seif-markers', anchorBasis: 'the print\'s own "[סעיף …]" at the head of each seif katan', coverageBasis: `Sefaria /api/shape/${title}`,
    halves: halves.map((versionTitle, i) => ({ versionTitle, simanim: ranges[i] })),
    sefaria: halves.map((versionTitle, i) => ({ title, versionTitle, recordedLicense: editions[i].licence.recordedLicense, versionSource: editions[i].version.versionSource || null, versionTitleInHebrew: editions[i].version.versionTitleInHebrew || null, export: exportUrl(title, versionTitle), exportTextSha256: editions[i].exportSha256, licenseVerifiedAt: RETRIEVED_AT, versions: `${SEFARIA}/api/texts/versions/${encodeURIComponent(title)}`, simanim: ranges[i] })),
    oneEditionProof: { sameVersionSource: [...sources][0], bothPublicDomain: true, overlappingSimanim: [], halves: ranges },
    nodeUnitLabel: 'סעיף קטן',
  };
}

// ---------- Remote layers (download tier): read live in the one edition named here ----------
const REMOTE = [
  { id: 'magen-avraham', he: 'מגן אברהם', author: 'רבי אברהם אבלי גומבינר', rank: 6, works: [{ part: 'oc', title: 'Magen Avraham', versionTitle: 'Magen Avraham', markers: 'Magen Avraham' }] },
  { id: 'taz', he: 'ט״ז', author: 'רבי דוד הלוי סגל (טורי זהב)', rank: 7, works: [
    { part: 'oc', title: 'Turei Zahav on Shulchan Arukh, Orach Chayim', versionTitle: 'Maginei Eretz: Shulchan Aruch Orach Chaim, Lemberg, 1893', markers: 'Turei Zahav' },
    { part: 'yd', title: "Turei Zahav on Shulchan Arukh, Yoreh De'ah", versionTitle: 'Ashlei Ravrevei: Shulchan Aruch Yoreh Deah, Lemberg, 1888', markers: 'Turei Zahav' },
    { part: 'eh', title: 'Turei Zahav on Shulchan Arukh, Even HaEzer', versionTitle: 'Apei Ravrevei: Shulchan Aruch Even HaEzer, Lemberg, 1886', markers: 'Turei Zahav' },
    { part: 'cm', title: 'Turei Zahav on Shulchan Arukh, Choshen Mishpat', versionTitle: 'Shulhan Arukh, Hoshen ha-Mishpat, Lemberg, 1898', markers: 'Turei Zahav' },
  ] },
  { id: 'shach', he: 'ש״ך', author: 'רבי שבתי הכהן (שפתי כהן)', rank: 8, works: [
    { part: 'yd', title: "Siftei Kohen on Shulchan Arukh, Yoreh De'ah", versionTitle: 'Ashlei Ravrevei: Shulchan Aruch Yoreh Deah, Lemberg, 1888', markers: 'Siftei Kohen' },
    { part: 'cm', title: 'Siftei Kohen on Shulchan Arukh, Choshen Mishpat', versionTitle: 'Shulhan Arukh, Hoshen ha-Mishpat; Lemberg, 1898', markers: 'Siftei Kohen' },
  ] },
  { id: 'baer-hetev', he: 'באר היטב', author: 'רבי יהודה אשכנזי ורבי זכריה מנדל (באר היטב)', rank: 3, works: [
    { part: 'yd', title: "Ba'er Hetev on Shulchan Arukh, Yoreh De'ah", versionTitle: 'Torat Emet 357', markers: "Ba'er Hetev" },
    { part: 'eh', title: "Ba'er Hetev on Shulchan Arukh, Even HaEzer", versionTitle: 'Torat Emet 357', markers: "Ba'er Hetev" },
    { part: 'cm', title: "Ba'er Hetev on Shulchan Arukh, Choshen Mishpat", versionTitle: 'Torat Emet 357', markers: "Ba'er Hetev" },
  ] },
  { id: 'kaf-hachayim', he: 'כף החיים', author: 'רבי יעקב חיים סופר', rank: 4, works: [{ part: 'yd', title: "Kaf HaChayim on Shulchan Arukh, Yoreh De'ah", versionTitle: 'Kaf Hachayim, Yoreh Deah, Jerusalem 1936-1957', khMarkers: true, join: true }] },
  { id: 'aruch-hashulchan', he: 'ערוך השולחן', author: 'רבי יחיאל מיכל הלוי אפשטיין', rank: 9, works: [
    { part: 'oc', title: 'Arukh HaShulchan', versionTitle: 'Arukh HaShulchan, Orach Chayim -- Wikisource', section: 'Orach Chaim', ownSeifim: true },
    { part: 'yd', title: 'Arukh HaShulchan', versionTitle: 'Aruch HaShulchan, Vilna 1923-29', section: "Yoreh De'ah", ownSeifim: true },
    { part: 'eh', title: 'Arukh HaShulchan', versionTitle: 'Aruch HaShulchan, Vilna 1923-29', section: 'Even HaEzer', ownSeifim: true },
    { part: 'cm', title: 'Arukh HaShulchan', versionTitle: 'Aruch HaShulchan, Choshen Mishpat. Vilna 1923-29', section: 'Choshen Mishpat', ownSeifim: true },
  ] },
];
const workIdOf = text => text.replace(/['’]/g, '').replace(/[^A-Za-z]+/g, '_').replace(/^_+|_+$/g, '');

async function buildRemote(commentator, item) {
  const part = PARTS[item.part];
  const { version, licence, data } = await loadEdition(item.title, item.versionTitle);
  // Only public domain, or a Wikisource transcription (CC BY-SA 4.0, credited where it is read); never NC or unknown.
  if (!['public-domain', 'cc-by-sa'].includes(licence.license)) fail(`${item.title}: licence ${licence.recordedLicense}`);
  let body = data.text;
  if (item.section) body = body[item.section] || fail(`${item.title}: no section ${item.section}`);
  if (!Array.isArray(body)) body = body[''] || fail(`${item.title}: no default body`);
  const markers = item.markers ? await markersOf(part) : null;
  const anchorNodes = [];
  const seifMaps = [];
  const seifCounts = [];
  let expectedUnits = 0;
  let mappedUnits = 0;
  body.forEach((comments, s) => {
    const siman = s + 1;
    if (siman > part.seifim.length) return;
    const list = comments || [];
    const present = list.map(c => (Array.isArray(c) ? c.some(nonEmpty) : nonEmpty(c)));
    const count = present.filter(Boolean).length;
    if (!count) return;
    expectedUnits += count;
    anchorNodes.push([siman, count]);
    let map = null;
    if (markers) map = seifMapFor(markers, item.markers, siman, list.length);
    else if (item.khMarkers) { const r = khSeifMap(list, part.seifim[s]); map = r.map.some(Boolean) ? r.map : null; }
    if (map) {
      seifMaps.push([siman, map]);
      const counts = new Array(part.seifim[s]).fill(0);
      map.forEach((seif, k) => { if (seif && present[k]) { counts[seif - 1] += 1; mappedUnits += 1; } });
      seifCounts.push([siman, counts]);
    }
  });
  const workId = workIdOf(item.section ? `${item.title} ${item.section}` : item.title);
  const heTitle = `${commentator.he} על ${part.baseHe.replace(/,/, '')}`;
  const wikisource = licence.license === 'cc-by-sa';
  return {
    layer: {
      workId, title: item.title, heTitle, layerTitle: commentator.he, layerRank: commentator.rank, commentator: commentator.id,
      category: 'halacha', group: 'shulchan-arukh', authors: [commentator.author], provider: 'sefaria', versionTitle: item.versionTitle,
      heVersion: version.versionTitleInHebrew || item.versionTitle, versionSource: version.versionSource || null, license: licence.license, recordedLicense: licence.recordedLicense,
      refPattern: item.section ? `{title}, ${item.section} {chapter}` : '{title} {chapter}', licenseVerifiedAt: RETRIEVED_AT,
      unitLabel: item.ownSeifim ? 'סעיף' : 'סעיף קטן', ...(item.join ? { joinParagraphs: true } : {}),
      relation: { relationType: 'commentary', baseWorkId: part.baseWorkId, anchorScheme: item.ownSeifim ? 'siman' : 'seif-markers' },
      anchorNodes,
      ...(seifCounts.length ? { seifCounts } : {}),
      ...(wikisource ? { attribution: { text: `${heTitle} — העתקת ויקיטקסט העברי, CC BY-SA 4.0 (דרך ספריא: "${item.versionTitle}")`, url: version.versionSource, licenseUrl: WIKISOURCE_LICENSE.url, modified: 'נטען בעת הקריאה; ניקוי סימון בלבד.' } } : {}),
      coverage: coverageRecord({ expectedUnits, importedUnits: 0, coverageStatus: COVERAGE.REMOTE_ONLY, seifAnchoredUnits: mappedUnits, note: 'נטען מספריא בעת הקריאה, במהדורה זו בלבד; אין עותק במכשיר.' }),
    },
    seifMaps,
    record: { workId, title: item.title, section: item.section || null, versionTitle: item.versionTitle, recordedLicense: licence.recordedLicense, license: licence.license, versionSource: version.versionSource || null, versions: `${SEFARIA}/api/texts/versions/${encodeURIComponent(item.title)}`, export: exportUrl(item.title, item.versionTitle), licenseVerifiedAt: RETRIEVED_AT, remoteOnly: true, units: expectedUnits, seifAnchoredUnits: mappedUnits },
  };
}

// ---------- Write ----------
const gz = body => gzipSync(Buffer.from(body), { level: 9 });
const LICENCE_TEXT = { 'public-domain': 'נחלת הכלל', 'cc-by-sa': 'CC BY-SA 4.0' };
const PART_TARGET = 1_400_000; // raw JSON bytes per file (≈ 300–400 KB gzip): a siman loads only its own range

function splitParts(work) {
  const simanim = [...work.expected.keys()].sort((a, b) => a - b);
  const parts = [];
  let current = null;
  for (const siman of simanim) {
    const units = work.nodes.get(siman) || [];
    const size = Buffer.byteLength(JSON.stringify(units)) + 60;
    if (!current || (current.size + size > PART_TARGET && current.nodes.length)) { current = { from: siman, to: siman, size: 0, nodes: [] }; parts.push(current); }
    current.to = siman;
    current.size += size;
    if (units.length) current.nodes.push({ id: `${work.workId}.${siman}`, n: siman, units });
  }
  return parts;
}

async function main() {
  const rights = await wikisourceRights();
  if (!/by-sa\/4\.0/.test(rights.query.rightsinfo.url)) fail(`Wikisource licence is now ${JSON.stringify(rights.query.rightsinfo)}`);
  const bundled = [];
  bundled.push(await buildWikisourceWork({ workId: 'Mishnah_Berurah', abbrs: ['מב', 'מא'], parenFallback: true, prefix: 'משנה ברורה על אורח חיים ', indexTitle: 'משנה ברורה', shapeTitle: 'Mishnah Berurah', he: 'משנה ברורה', heTitle: 'משנה ברורה', rank: 1, author: 'רבי ישראל מאיר הכהן מראדין (החפץ חיים)', sefariaTitle: 'Mishnah Berurah' }));
  // Two independent sources for the seif of each משנה ברורה comment: the Wikisource page's headings and the printed
  // markers of the Lemberg 1893 Shulchan Arukh. Where they disagree the comment stays on its siman only (no seif is
  // claimed), and the disagreement is recorded.
  {
    const mb = bundled[0];
    const markers = await markersOf(PARTS.oc);
    const disputed = [];
    let confirmed = 0;
    for (const [siman, units] of mb.nodes) {
      if (siman > PARTS.oc.seifim.length) continue;
      const printed = new Map((markers.bySiman[siman]?.get('Mishnah Berurah') || []).map(([n, seif]) => [n, seif]));
      for (const unit of units) {
        if (!unit.v || !printed.has(unit.n)) continue;
        if (printed.get(unit.n) === unit.v) { confirmed += 1; continue; }
        disputed.push(`${siman}:${unit.n} (ויקיטקסט ${unit.v}, דפוס ${printed.get(unit.n)})`);
        delete unit.v;
      }
    }
    mb.anchors = [...mb.nodes].filter(([siman]) => siman <= PARTS.oc.seifim.length).sort((a, b) => a[0] - b[0]).flatMap(([siman, units]) => units.filter(unit => unit.v).map(unit => [siman, unit.n, unit.v]));
    mb.problems.seifDisputed = disputed;
    mb.crossCheck = { confirmedByPrintedMarkers: confirmed, disputed: disputed.length, markerEdition: PARTS.oc.markerVersion };
  }
  process.stdout.write('MB ');
  bundled.push(await buildWikisourceWork({ workId: 'Biur_Halacha', abbrs: ['בהל'], prefix: 'ביאור הלכה על אורח חיים ', indexTitle: 'ביאור הלכה', shapeTitle: 'Biur Halacha', he: 'ביאור הלכה', heTitle: 'ביאור הלכה', rank: 2, author: 'רבי ישראל מאיר הכהן מראדין (החפץ חיים)', sefariaTitle: 'Biur Halacha' }));
  process.stdout.write('BiurH ');
  bundled.push(await buildBaerHetevOc());
  process.stdout.write('BH ');
  bundled.push(await buildKafHaChaimOc());
  process.stdout.write('KH\n');
  const remote = [];
  for (const commentator of REMOTE) for (const item of commentator.works) { remote.push({ commentator, ...(await buildRemote(commentator, item)) }); process.stdout.write('r'); }
  process.stdout.write('\n');

  const packs = new Map();
  const packFor = license => {
    const packId = license === 'cc-by-sa' ? 'wikisource-shulchan-arukh-commentary-cc-by-sa' : 'sefaria-shulchan-arukh-commentary-public-domain';
    if (!packs.has(packId)) {
      const staging = join(ROOT, 'public/library/packs', `${packId}.staging`);
      rmSync(staging, { recursive: true, force: true });
      mkdirSync(staging, { recursive: true });
      packs.set(packId, { packId, license, staging, files: [], works: [] });
    }
    return packs.get(packId);
  };
  const reports = [];
  for (const work of bundled) {
    const pack = packFor(work.license);
    const editionId = `${pack.packId}:${work.workId}`;
    const extraNodes = work.extraNodes || [];
    const total = work.part.seifim.length + extraNodes.length;
    const expected = Array.from({ length: total }, (_, i) => ({ n: i + 1, units: work.expected.get(i + 1) || 0 }));
    const whole = { workId: work.workId, editionId, packId: pack.packId, nodes: [...work.nodes].sort((a, b) => a[0] - b[0]).map(([n, units]) => ({ id: `${work.workId}.${n}`, n, units })) };
    const report = validateWorkChunk(whole, expected);
    if (report.duplicateIds.length || report.emptyUnits.length || report.invalidRefs.length || report.unexpectedUnits.length || report.orderErrors.length) fail(`${work.workId}: ${JSON.stringify({ d: report.duplicateIds.slice(0, 3), e: report.emptyUnits.slice(0, 3), i: report.invalidRefs.slice(0, 3), u: report.unexpectedUnits.slice(0, 3), o: report.orderErrors.slice(0, 3) })}`);
    if (report.missingUnits.length !== work.missing.length) fail(`${work.workId}: missing units disagree (${report.missingUnits.length} vs ${work.missing.length})`);
    // Files by siman range, each a chunk of the same edition (checksum per file).
    const parts = [];
    for (const range of splitParts(work)) {
      const body = JSON.stringify({ workId: work.workId, editionId, packId: pack.packId, range: [range.from, range.to], nodes: range.nodes });
      const file = `${work.workId}.${range.from}-${range.to}.json.gz`;
      const packed = gz(body);
      writeFileSync(join(pack.staging, file), packed);
      const record = { from: range.from, to: range.to, file, bytes: packed.length, rawBytes: Buffer.byteLength(body), checksum: checksum(body) };
      parts.push(record);
      pack.files.push({ workId: work.workId, role: 'part', ...record });
    }
    // Anchors: compact rows [siman, sk, seif] → { unitId, anchorRef, canonicalRef, baseCanonicalRef } (relations.mjs).
    const relation = { relationType: 'commentary', baseWorkId: work.part.baseWorkId, anchorScheme: work.anchorScheme };
    const anchorsBody = JSON.stringify({ format: 'seif-rows', workId: work.workId, editionId, relationType: relation.relationType, baseWorkId: relation.baseWorkId, anchorScheme: relation.anchorScheme, title: work.title, baseTitle: baseCanonical(work.part), license: work.license, rows: work.anchors });
    const anchorsFile = `${work.workId}.anchors.json.gz`;
    const anchorsPacked = gz(anchorsBody);
    writeFileSync(join(pack.staging, anchorsFile), anchorsPacked);
    pack.files.push({ workId: work.workId, role: 'anchors', file: anchorsFile, bytes: anchorsPacked.length, rawBytes: Buffer.byteLength(anchorsBody), checksum: checksum(anchorsBody) });
    // Page index [siman, siman, firstUnit, lastUnit] over every unit of the siman (seif-anchored or not), and the
    // per-seif counts, so the reader knows what exists at a seif without loading anything.
    // An introduction to a siman is shown before its comments; a named treatise (משנת סופרים) after them.
    const anchorNodes = [];
    const seifCounts = [];
    for (const [siman, units] of [...work.nodes].filter(([n]) => n <= work.part.seifim.length).sort((a, b) => a[0] - b[0])) {
      const rows = [];
      for (const unit of units) { const last = rows.at(-1); if (last && last[3] < unit.n) last[3] = unit.n; else rows.push([siman, siman, unit.n, unit.n]); }
      const extraRows = extra => [siman, extra.n, 1, extra.units];
      anchorNodes.push(...extraNodes.filter(extra => extra.siman === siman && extra.title.startsWith('הקדמה')).map(extraRows), ...rows, ...extraNodes.filter(extra => extra.siman === siman && !extra.title.startsWith('הקדמה')).map(extraRows));
      const counts = new Array(work.part.seifim[siman - 1]).fill(0);
      for (const unit of units) if (unit.v) counts[unit.v - 1] += 1;
      if (counts.some(Boolean)) seifCounts.push([siman, counts]);
    }
    for (const extra of extraNodes) if (!work.nodes.get(extra.siman)) anchorNodes.push([extra.siman, extra.n, 1, extra.units]);
    const nodeTitles = extraNodes.length ? [...Array.from({ length: work.part.seifim.length }, (_, i) => `סימן ${hebrewNumeral(i + 1)}`), ...extraNodes.map(extra => extra.title)] : null;
    const importedUnits = report.importedUnits;
    const coverage = coverageRecord({
      expectedUnits: report.expectedUnits, importedUnits, missingUnits: report.missingUnits, basis: work.coverageBasis, unit: 'seif katan',
      anchoredUnits: work.anchors.length, unanchoredUnits: importedUnits - work.anchors.length, anchorBasis: work.anchorBasis,
      simanimWithText: [...work.nodes.keys()].filter(n => n <= work.part.seifim.length).length, simanimInBase: work.part.seifim.length,
      ...(extraNodes.length ? { namedParts: extraNodes.map(extra => ({ node: extra.n, siman: extra.siman, title: extra.title, units: extra.units })) } : {}),
      ...(work.problems.beyondShape ? { beyondShape: work.problems.beyondShape } : {}),
      ...(work.wikisource ? { wikisourcePages: work.wikisource.pages.length } : {}),
      ...(work.crossCheck ? { anchorCrossCheck: work.crossCheck } : {}),
    });
    const sourceLine = work.license === 'cc-by-sa' ? null : `${work.he} · ${work.editionHeTitle} · ${LICENCE_TEXT[work.license]} · ספריא`;
    const combined = checksum(parts.map(p => p.checksum).join('|'));
    pack.works.push({
      workId: work.workId, title: work.title, heTitle: work.heTitle, shortTitle: work.shortTitle, layerTitle: work.he, layerRank: work.rank,
      group: 'shulchan-arukh', aliases: ALIASES[work.workId] || [], authors: [work.author], compDate: null,
      editionTitle: work.editionTitle, editionHeTitle: work.editionHeTitle, provider: work.provider, providerUrl: work.providerUrl,
      versionSource: work.versionSource, license: work.license, recordedLicense: work.recordedLicense, licenseVerifiedAt: RETRIEVED_AT,
      ...(sourceLine ? { sourceLine } : {}),
      nodeLabel: 'סימן', unitLabel: 'סעיף קטן', baseUnitLabel: 'סעיף', ...(nodeTitles ? { nodeTitles } : {}),
      status: report.status, missingUnits: report.missingUnits,
      file: parts[0].file, checksum: combined, bytes: parts.reduce((a, p) => a + p.bytes, 0), rawBytes: parts.reduce((a, p) => a + p.rawBytes, 0), parts,
      nodes: expected.map(({ n }) => work.nodes.get(n)?.length || 0), expected: expected.map(entry => entry.units),
      relation, anchorsFile, anchorsChecksum: checksum(anchorsBody), anchorNodes, seifCounts,
      coverage,
      ...(work.license === 'cc-by-sa' ? { attribution: { text: `${work.heTitle} — העתקת ויקיטקסט העברי (he.wikisource.org, דף "${work.wikisource.index.title}"), CC BY-SA 4.0`, url: pageUrl(work.wikisource.index.title), licenseUrl: WIKISOURCE_LICENSE.url, modified: 'עיבוד: ניקוי סימון בלבד; מילות הפתיחה (דיבור המתחיל) הופרדו מגוף הפירוש; מעברי הפסקאות כבדף.' } } : {}),
    });
    reports.push({ workId: work.workId, expectedUnits: report.expectedUnits, importedUnits, status: report.status, checksum: combined, missing: report.missingUnits.length, anchored: work.anchors.length });
  }

  // Remote seif maps: one side file for all of them, in the public-domain pack.
  const pdPack = packFor('public-domain');
  const mapsBody = JSON.stringify({ format: 'remote-seif-maps', maps: Object.fromEntries(remote.filter(r => r.seifMaps.length).map(r => [r.layer.workId, r.seifMaps])) });
  const mapsFile = 'remote-seif-maps.json.gz';
  const mapsPacked = gz(mapsBody);
  writeFileSync(join(pdPack.staging, mapsFile), mapsPacked);
  pdPack.files.push({ role: 'remote-seif-maps', file: mapsFile, bytes: mapsPacked.length, rawBytes: Buffer.byteLength(mapsBody), checksum: checksum(mapsBody) });
  const remoteLayers = remote.map(r => ({ ...r.layer, ...(r.seifMaps.length ? { seifMap: { packId: pdPack.packId, file: mapsFile, checksum: checksum(mapsBody) } } : {}) }));

  // Coverage per commentator (bundled, then remote).
  const commentators = bundled.map(work => {
    const pack = [...packs.values()].find(p => p.works.some(w => w.workId === work.workId));
    const entry = pack.works.find(w => w.workId === work.workId);
    return { id: work.workId, he: work.he, heTitle: work.heTitle, part: work.part.key, author: work.author, rank: work.rank, edition: work.editionHeTitle, license: work.license, ...entry.coverage, missingUnits: undefined, missingCount: entry.coverage.missingUnits.length };
  });
  const remoteCommentators = REMOTE.map(c => ({ id: c.id, he: c.he, author: c.author, rank: c.rank, parts: remote.filter(r => r.commentator.id === c.id).map(r => PARTS[c.works.find(w => workIdOf(w.section ? `${w.title} ${w.section}` : w.title) === r.layer.workId).part].he), units: remote.filter(r => r.commentator.id === c.id).reduce((t, r) => t + r.layer.coverage.expectedUnits, 0), seifAnchoredUnits: remote.filter(r => r.commentator.id === c.id).reduce((t, r) => t + r.layer.coverage.seifAnchoredUnits, 0), editions: [...new Set(c.works.map(w => w.versionTitle))], coverageStatus: COVERAGE.REMOTE_ONLY }));

  const packEntries = [];
  for (const pack of packs.values()) {
    const packDir = join(ROOT, 'public/library/packs', pack.packId);
    const bytes = pack.files.reduce((total, file) => total + file.bytes, 0);
    const wiki = pack.license === 'cc-by-sa';
    const edition = wiki
      ? { title: 'Hebrew Wikisource — Mishnah Berurah, Biur Halacha', heTitle: 'משנה ברורה וביאור הלכה · ויקיטקסט העברי', editor: 'מתנדבי ויקיטקסט העברי (לפי דפוס המחבר)', notes: 'כל דף מוצמד לגרסה (oldid). ניקוי סימון בלבד; מילות הפתיחה מודגשות כבדף.' }
      : { title: 'Sefaria — Shulchan Arukh commentaries (public domain)', heTitle: 'נושאי כלי השולחן ערוך · ספריא', editor: 'Sefaria (each edition as recorded)', notes: 'כל ספר במהדורה אחת מוצמדת (versionTitle), ברישיון שנבדק מול ספריא בעת הבנייה. ניקוי סימון בלבד.' };
    const source = wiki ? 'wikisource' : 'sefaria';
    writeFileSync(join(pack.staging, 'manifest.json'), JSON.stringify({ packId: pack.packId, contentVersion: `${wiki ? 'Wikisource revisions pinned' : 'Sefaria exports'}, licences verified live ${RETRIEVED_AT}`, family: 'corpus', category: 'halacha', structure: ['siman', 'seif katan'], license: pack.license, source, edition, retrievedAt: RETRIEVED_AT, provenance: 'sources/shulchan-arukh-commentaries/provenance.json', files: pack.files }, null, 1));
    rmSync(packDir, { recursive: true, force: true });
    renameSync(pack.staging, packDir);
    packEntries.push({ packId: pack.packId, contentVersion: `${wiki ? 'Wikisource revisions pinned' : 'Sefaria exports'}, licences verified live ${RETRIEVED_AT}`, family: 'corpus', category: 'halacha', structure: ['siman', 'seif katan'], nodeLabel: 'סימן', unitLabel: 'סעיף קטן', policy: 'source', source, license: pack.license, edition, sourceUrl: wiki ? 'https://he.wikisource.org/' : SEFARIA, retrievedAt: RETRIEVED_AT, bytes, provenance: 'sources/shulchan-arukh-commentaries/provenance.json', works: pack.works });
  }
  packEntries.sort((a, b) => (a.license === 'public-domain' ? 1 : -1) - (b.license === 'public-domain' ? 1 : -1));
  const index = { generatedAt: RETRIEVED_AT, packs: packEntries, remoteLayers, blockedLayers: [], reports, commentators, remoteCommentators };
  writeFileSync(join(ROOT, 'src/data/library/corpus/shulchanArukhCommentary.mjs'), `// Generated by scripts/library/build-shulchan-arukh-commentary.mjs. Do not edit by hand.\nexport default ${JSON.stringify(index)};\n`);

  const markerRecords = [];
  for (const key of Object.keys(PARTS)) if (markerCache.has(key)) markerRecords.push(markerCache.get(key).record);
  const provenance = {
    work: "The Shulchan Arukh's nosei kelim: Mishnah Berurah and Biur Halacha (he.wikisource, CC BY-SA 4.0), Be'er Heitev and Kaf HaChaim on Orach Chayim (Sefaria, Public Domain); remote layers read live",
    rule: 'Sefaria licences are re-read live from /api/texts/versions/<Title> at build time, Wikisource\'s from siteinfo rightsinfo. Only Public Domain / CC0 / CC-BY / CC-BY-SA are accepted; NC and unknown stop the build. Wikisource pages are pinned by revision id.',
    modifications: 'Markup only: templates, links, tags and entities removed; the opening words (dibbur hamatchil) kept apart from the comment (unit.dh); paragraph breaks kept as on the page. The words of the editions were not changed. Kaf HaChaim: the leading seif-katan letter of the bold words ("א)") is shown as the unit number instead.',
    anchors: 'Each comment is anchored to the siman:seif of the Shulchan Arukh it explains: Wikisource — by the page\'s seif headings; Be\'er Heitev and the remote layers — by the printed commentary markers of the public-domain Lemberg editions of the Shulchan Arukh (data-commentator / data-order), used only where that edition divides the siman into the same seifim as the edition in the library and numbers exactly the comments present; Kaf HaChaim — by its own printed "[סעיף …]". Sefaria\'s link data (no published licence) is not used.',
    licence: { wikisource: { rightsinfo: rights.query.rightsinfo, checkedAt: RETRIEVED_AT, underlyingPrint: 'משנה ברורה וביאור הלכה, דפוס המחבר (ורשה/פיוטרקוב, תרמ״ד–תרס״ז, 1884–1907) — public domain; the Wikisource transcription and its editing are CC BY-SA 4.0' } },
    markerEditions: markerRecords,
    wikisource: Object.fromEntries(bundled.filter(w => w.wikisource).map(w => [w.workId, { index: w.wikisource.index, pages: w.wikisource.pages, problems: w.problems, stats: w.stats }])),
    sefaria: bundled.filter(w => w.sefaria).flatMap(w => w.sefaria.map(record => ({ workId: w.workId, ...record }))),
    kafHaChaimOneEdition: bundled.find(w => w.oneEditionProof)?.oneEditionProof || null,
    problems: Object.fromEntries(bundled.map(w => [w.workId, w.problems])),
    remoteLayers: remote.map(r => r.record),
    notUsed: [
      { item: 'Mishnah Berurah, Sefaria "On Your Way" (Public Domain)', why: '74% of the structure; the complete Wikisource transcription is used instead.' },
      { item: "Sha'ar HaTziyun", why: 'Not on Wikisource (the talk page records it as missing); not imported.' },
      { item: 'Links between texts (Sefaria link data)', why: 'No published licence; anchors come from the printed markers instead.' },
    ],
    builtAt: RETRIEVED_AT,
  };
  mkdirSync(join(ROOT, 'sources/shulchan-arukh-commentaries'), { recursive: true });
  writeFileSync(PROVENANCE, `${JSON.stringify(provenance, null, 1)}\n`);
  console.log(JSON.stringify({ packs: packEntries.map(p => [p.packId, p.bytes, p.works.length]), bundled: reports, problems: Object.fromEntries(bundled.map(w => [w.workId, Object.fromEntries(Object.entries(w.problems).map(([k, v]) => [k, Array.isArray(v) ? `${v.length}: ${v.slice(0, 8).join(' ')}` : v]))])), remote: remoteLayers.map(l => [l.workId, l.coverage.expectedUnits, l.coverage.seifAnchoredUnits, l.license]) }, null, 1));
}

const ALIASES = {
  Mishnah_Berurah: ['משנ"ב', 'מ"ב', 'משנה ברורה אורח חיים'],
  Biur_Halacha: ['ביאור הלכה', 'בה"ל', 'ביה"ל'],
  Baer_Hetev_on_Shulchan_Arukh_Orach_Chayim: ['באר היטב', 'באר היטב אורח חיים', 'באה"ט'],
  Kaf_HaChayim_on_Shulchan_Arukh_Orach_Chayim: ['כף החיים', 'כף החיים אורח חיים', 'כה"ח'],
};

await main();
