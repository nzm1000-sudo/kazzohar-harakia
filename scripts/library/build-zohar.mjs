// The Zohar corpus pack: the Zohar (Hebrew Wikisource, Mantua pagination) with its commentaries anchored to the page
// they explain, plus the larger commentaries registered as remote layers (fetched live from Sefaria, exact PD edition).
// Run: node scripts/library/build-zohar.mjs [--cache /tmp/kz-library-cache/zohar] [--offline] [--refresh] [--retrieved-at YYYY-MM-DD]
//   default: rebuild from the revisions pinned in sources/wikisource-zohar/provenance.json (reproducible);
//   --refresh: take the latest revision of every page and re-pin them.
// Markup cleanup only: the Aramaic of the transcription is never rewritten. Printed pages are the nodes (Work.node.unit
// with numeric ids; the page names live in the pagination descriptor), parashot are sections, and every commentary unit
// carries an anchor { unitId, anchorRef, canonicalRef } to the Zohar page it comments on.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checksum } from '../../src/services/prayer/checksum.mjs';
import { COVERAGE, coverageRecord, validateWorkChunk } from '../../src/services/library/integrity.mjs';
import { hebrewNumeral } from '../../src/services/hebrewNumerals.mjs';
import { amudIndex, amudLabel, indexAmud, nodeForPage, paginationNodes } from '../../src/services/library/pagination.mjs';
import { fetchPages, listPages, oldidUrl, pageUrl, sectionText, stripWikiResidue, wikitextToParagraphs, WIKISOURCE_LICENSE } from './wikisource.mjs';
import { cleanText } from './clean.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const CACHE = arg('--cache', '/tmp/kz-library-cache/zohar');
const OFFLINE = args.includes('--offline');
const REFRESH = args.includes('--refresh');
const RETRIEVED_AT = arg('--retrieved-at', new Date().toISOString().slice(0, 10));
const PACK_ID = 'wikisource-zohar-cc-by-sa';
const PACK_DIR = join(ROOT, 'public/library/packs', PACK_ID);
const SOURCE_DIR = join(ROOT, 'sources/wikisource-zohar');
const PROVENANCE = join(SOURCE_DIR, 'provenance.json');
const INDEX_FILE = join(ROOT, 'src/data/library/corpus/zohar.mjs');
mkdirSync(CACHE, { recursive: true });
const fail = message => { throw new Error(message); };
const hash = text => createHash('sha256').update(text).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const HEB = { 'א': 1, 'ב': 2, 'ג': 3 };
const hebToNum = s => [...String(s).replace(/[׳״'"]/g, '')].reduce((t, c) => t + ({ א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9, י: 10, כ: 20, ל: 30, מ: 40, נ: 50, ס: 60, ע: 70, פ: 80, צ: 90, ק: 100, ר: 200, ש: 300, ת: 400 }[c] ?? NaN), 0);
const amudOf = (daf, side) => `${hebToNum(daf)}${side === 'א' ? 'a' : 'b'}`;

async function cachedJson(name, url) {
  const file = join(CACHE, `sefaria-${name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 180)}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  if (OFFLINE) fail(`offline and not cached: ${url}`);
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (response.ok) { const data = await response.json(); writeFileSync(file, JSON.stringify(data)); await sleep(150); return data; }
      if (response.status < 500 && response.status !== 429) fail(`${url}: HTTP ${response.status}`);
    } catch (error) { if (attempt === 5) throw error; }
    await sleep(800 * attempt);
  }
  fail(`${url}: unreachable`);
}

// ---------- 1. Pages, pinned ----------
const previous = existsSync(PROVENANCE) ? JSON.parse(readFileSync(PROVENANCE, 'utf8')) : null;
const pinned = REFRESH || !previous ? {} : Object.fromEntries(previous.pages.map(page => [page.title, page.revid]));
const INDEX_PAGES = ['ספר הזהר', 'זהר חלק א', 'זהר חלק ב', 'זהר חלק ג'];
const DAF_TITLE = /^זהר חלק ([אבג]) ([א-ת]+) ([אב])$/;
let dafTitles;
if (REFRESH || !previous) dafTitles = (await listPages('זהר חלק ')).filter(title => DAF_TITLE.test(title));
else dafTitles = previous.pages.filter(page => page.role === 'amud').map(page => page.title);
const indexPages = await fetchPages(INDEX_PAGES, { cache: CACHE, revids: pinned, offline: OFFLINE });
const dafPages = await fetchPages(dafTitles, { cache: CACHE, revids: pinned, offline: OFFLINE });

// Volumes from the page list itself (Mantua: I 1a–251a, II 2a–269a, III 2a–299b).
const volumeAmudim = { 1: [], 2: [], 3: [] };
const dafTitleByRef = new Map();
for (const title of dafTitles) {
  const [, v, daf, side] = title.match(DAF_TITLE);
  const ref = `${HEB[v]}:${amudOf(daf, side)}`;
  if (dafTitleByRef.has(ref)) fail(`two pages for ${ref}: ${dafTitleByRef.get(ref)} / ${title}`);
  dafTitleByRef.set(ref, title);
  volumeAmudim[HEB[v]].push(amudIndex(amudOf(daf, side)));
}
const PAGINATION = {
  scheme: 'daf',
  edition: 'Mantua 1558–1560',
  volumes: [1, 2, 3].map(n => { const list = volumeAmudim[n].sort((a, b) => a - b); return { n, title: `חלק ${['א', 'ב', 'ג'][n - 1]}`, first: indexAmud(list[0]), last: indexAmud(list.at(-1)) }; }),
};
const PAGES = paginationNodes(PAGINATION);
for (const v of [1, 2, 3]) {
  const list = volumeAmudim[v];
  if (list.length !== list.at(-1) - list[0] + 1) fail(`volume ${v}: the amud pages are not continuous`);
}
const nodeOf = (volume, amud) => nodeForPage(PAGINATION, volume, amud);

// ---------- 2. Parashot (sections) from {{דפי הזהר לפרשה|vol|daf|amud|daf|amud}} ----------
const parashaRanges = [];
for (const v of ['א', 'ב', 'ג']) {
  let heading = null;
  for (const line of indexPages[`זהר חלק ${v}`].content.split('\n')) {
    const h = line.match(/^=+\s*(.*?)\s*=+\s*$/);
    if (h) { heading = h[1].replace(/^פרשת\s+/, '').replace(/:$/, '').trim(); continue; }
    for (const m of line.matchAll(/\{\{\s*דפי הזהר לפרשה\s*\|([^}]*)\}\}/g)) {
      const [vol, d1, a1, d2, a2] = m[1].split('|').map(s => s.trim());
      const from = nodeOf(HEB[vol], amudOf(d1, a1));
      const to = nodeOf(HEB[vol], amudOf(d2, a2));
      if (!from || !to || !heading) fail(`parasha range ${m[0]}`);
      const last = parashaRanges.at(-1);
      if (last && last.title === heading && last.volume === HEB[vol]) last.to = Math.max(last.to, to);
      else parashaRanges.push({ title: heading, volume: HEB[vol], from, to });
    }
  }
}
// A page shared by two parashot opens the later one (its beginning is there); a page between two parashot (the
// title pages III 116a–b) goes with the parasha that follows. The sections then tile the book exactly.
parashaRanges.sort((a, b) => a.from - b.from);
const starts = parashaRanges.map((range, i) => (i === 0 ? 1 : parashaRanges[i - 1].to < range.from - 1 ? parashaRanges[i - 1].to + 1 : range.from));
const sections = parashaRanges.map((range, i) => ({
  title: `חלק ${['א', 'ב', 'ג'][range.volume - 1]} · ${range.title.replace(/\s*\(.*\)$/, '').replace(/^הקדמת ספר הזהר$/, 'הקדמת הזהר')}`,
  from: starts[i],
  to: i + 1 < starts.length ? starts[i + 1] - 1 : PAGES.length,
}));
sections.forEach(section => { if (section.from > section.to) fail(`empty section ${section.title}`); });

// ---------- 3. The text of every amud ----------
const TRANSCLUDE = /\{\{\s*קטע זוהר\s*\|([^|}]+)\|([^|}]+)(?:\|[^}]*)?\}\}/g;
const parashaTitles = new Set();
for (const title of dafTitles) for (const m of dafPages[title].content.matchAll(TRANSCLUDE)) parashaTitles.add(m[1].trim());
const parashaPages = await fetchPages([...parashaTitles], { cache: CACHE, revids: pinned, offline: OFFLINE });
// Typing slips in the markup of the pinned revisions (a brace typed as another key, a footnote left open). Each repair
// touches markup only, must match exactly once, and is recorded in the provenance file.
const MARKUP_REPAIRS = [
  { page: 'זוהר חלק כה', find: 'תחת כל בכור - (המתוק מדבש)}} - הא אינון קדישין', replace: 'תחת כל בכור - (המתוק מדבש)}}}} - הא אינון קדישין', why: 'footnote {{הערה| never closed; it ends at "(המתוק מדבש)" and the Zohar text resumes' },
  { find: '{{גמט דגש{גדרי"ה}}', replace: '{{גמט דגש|גדרי"ה}}', why: 'template separator typed as "{"' },
  { find: '{ממ|ויקרא|כה|מט}}', replace: '{{ממ|ויקרא|כה|מט}}', why: 'template opened with a single brace' },
  { find: 'ואכלםPP', replace: 'ואכלם}}', why: '"}}" typed as "PP" (Latin letters) closing a quotation' },
  { find: 'עיי"ש]))', replace: 'עיי"ש]}}', why: '"}}" typed as "))" closing {{קטן|' },
  { find: 'סתרי סתרים ליהוה}.', replace: 'סתרי סתרים ליהוה.', why: 'a lone "}" left from a template' },
];
const repairsApplied = [];
function applyRepairs(records, repairs) {
  for (const repair of repairs) {
    const hits = records.filter(record => (!repair.page || record.title === repair.page) && record.content.includes(repair.find));
    const count = hits.reduce((total, record) => total + record.content.split(repair.find).length - 1, 0);
    if (count !== 1) { if (REFRESH) { console.warn(`repair no longer applies (${count}): ${repair.find}`); continue; } fail(`markup repair must match once, matched ${count}: ${repair.find}`); }
    hits[0].sha256 ||= hash(hits[0].content);
    hits[0].content = hits[0].content.replace(repair.find, repair.replace);
    repairsApplied.push({ page: hits[0].title, revid: hits[0].revid, ...repair });
  }
}
applyRepairs(Object.values(parashaPages), MARKUP_REPAIRS);

const STREAMS = ['סתרי תורה', 'מדרש הנעלם', 'תוספתא', 'מתניתין', 'רזא דרזין'];
function streamOf(label) {
  const prefix = label.replace(/דף [א-ת]+ [אב].*$/, '').trim();
  if (/רע"מ|רעיא מהימנא/.test(prefix)) return 'רעיא מהימנא';
  const named = STREAMS.find(stream => prefix.includes(stream));
  if (named) return named;
  if (/ספרא דצניעותא/.test(prefix)) return 'ספרא דצניעותא';
  if (prefix === 'ד"א') return 'דבר אחר';
  return 'זהר';
}
const NOTE = /אין (?:טקסט|חומר|תוכן)|תרגומו מצוי|__ללא_תוכן__/;
const stats = {};
const nodeStats = new Map();
const problems = [];
const zoharNodes = [];
const noTextInPrint = [];
const unresolved = [];
for (const page of PAGES) {
  const title = dafTitleByRef.get(page.ref) || fail(`no page for ${page.ref}`);
  const record = dafPages[title];
  const content = record.content.replace(/\{\{\s*דף של זהר[^}]*\}\}/, '');
  const pieces = [];
  let last = 0;
  for (const m of content.matchAll(TRANSCLUDE)) {
    pieces.push({ inline: content.slice(last, m.index) });
    pieces.push({ page: m[1].trim(), label: m[2].trim() });
    last = m.index + m[0].length;
  }
  pieces.push({ inline: content.slice(last) });
  const sectionsHere = [];
  const local = {};
  for (const piece of pieces) {
    if (piece.inline !== undefined) {
      if (NOTE.test(piece.inline)) { if (/אין תוכן בדפים/.test(piece.inline)) noTextInPrint.push({ node: page.node, ref: page.ref, note: piece.inline.replace(/'''|\n/g, ' ').trim() }); continue; }
      const { paragraphs } = wikitextToParagraphs(piece.inline, local);
      if (paragraphs.length) sectionsHere.push({ stream: 'זהר', paragraphs, from: title });
      continue;
    }
    const source = parashaPages[piece.page]?.content;
    const raw = source && sectionText(source, piece.label);
    // A named section the parasha page does not define renders as nothing on Wikisource too: noted, not invented.
    if (raw === null || raw === undefined) { unresolved.push({ amud: page.ref, page: piece.page, section: piece.label }); continue; }
    const { paragraphs } = wikitextToParagraphs(raw, local);
    if (!paragraphs.length) { problems.push(`${title}: section "${piece.label}" in ${piece.page} is empty`); continue; }
    sectionsHere.push({ stream: streamOf(piece.label), paragraphs, from: `${piece.page}#${piece.label}` });
  }
  const units = [];
  let previousStream = null;
  for (const section of sectionsHere) {
    section.paragraphs.forEach((text, i) => {
      const head = i === 0 && section.stream !== (previousStream ?? 'זהר') ? section.stream : null;
      units.push({ id: `Zohar.${page.node}.${units.length + 1}`, n: units.length + 1, text, ...(head ? { head } : {}) });
    });
    previousStream = section.stream;
  }
  for (const [key, value] of Object.entries(local)) {
    if (key === 'templates' || key === 'unknownTemplates') { for (const [name, count] of Object.entries(value)) ((stats[key] ||= {})[name] = (stats[key][name] || 0) + count); } else stats[key] = (stats[key] || 0) + value;
  }
  nodeStats.set(page.node, local);
  if (!units.length && !noTextInPrint.some(item => item.node === page.node)) problems.push(`${title}: no text at all`);
  zoharNodes.push({ id: `Zohar.${page.node}`, n: page.node, units });
}
if (stats.unknownTemplates) fail(`unknown templates: ${JSON.stringify(stats.unknownTemplates)}`);
if (problems.length) fail(`section problems:\n${problems.join('\n')}`);

// ---------- 4. Commentaries ----------
const SEFARIA = 'https://www.sefaria.org';
async function sefariaVersion(title, versionTitle) {
  const versions = await cachedJson(`versions-${title}`, `${SEFARIA}/api/texts/versions/${encodeURIComponent(title)}`);
  const version = versions.find(item => item.language === 'he' && item.versionTitle === versionTitle) || fail(`${title}: version "${versionTitle}" not listed`);
  return version;
}
const exportUrl = (title, versionTitle) => `${SEFARIA}/download/version/${encodeURIComponent(`${title} - he - ${versionTitle}`)}.json`;

// Sefaria's Zohar is arranged by parasha; its "Daf" alternate structure maps each parasha range onto the printed pages.
const zoharIndex = await cachedJson('index-Zohar', `${SEFARIA}/api/v2/raw/index/Zohar`);
const dafRanges = [];
const parseRef = ref => { const m = /^Zohar, (.+?) (\d+):(\d+)(?:-(?:(\d+):)?(\d+))?$/.exec(ref); if (!m) return null; const [, part, c1, s1, c2, s2] = m; return { part, from: [Number(c1), Number(s1)], to: [Number(c2 || c1), Number(s2 || s1)] }; };
(function walk(node, volume) {
  if (node.numeric_equivalent) volume = node.numeric_equivalent;
  if (node.refs) {
    let address = node.startingAddress ? amudIndex(node.startingAddress) : 0;
    const skipped = new Set((node.skipped_addresses || []).map(a => a - 1));
    node.refs.forEach((ref, i) => {
      let index;
      if (node.addresses) index = node.addresses[i] - 1;
      else { while (skipped.has(address)) address += 1; index = address; address += 1; }
      const parsed = parseRef(ref);
      if (parsed && ref) dafRanges.push({ ...parsed, volume, amud: indexAmud(index), primary: Boolean(node.default) || !node.match_templates?.length });
    });
  }
  (node.nodes || []).forEach(child => walk(child, volume));
})({ nodes: zoharIndex.alt_structs.Daf.nodes }, null);
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1];
function zoharRefToNode(ref) {
  const m = /^Zohar, (.+?) (\d+):(\d+)/.exec(ref);
  if (!m) return null;
  const point = [Number(m[2]), Number(m[3])];
  const hits = dafRanges.filter(range => range.part === m[1] && cmp(range.from, point) <= 0 && cmp(point, range.to) <= 0);
  const hit = hits.find(range => range.primary) || hits[0];
  return hit ? nodeOf(hit.volume, hit.amud) : null;
}

const commentaries = [];
const anchorsOf = new Map();

// 4a. Yahel Ohr (the Gra) — Sefaria "Vilna 1882", Volume/Daf/Paragraph = the printed page directly.
{
  const title = 'Yahel Ohr on Zohar';
  const versionTitle = 'Vilna 1882';
  const version = await sefariaVersion(title, versionTitle);
  const data = await cachedJson(`export-${title}-${versionTitle}`, exportUrl(title, versionTitle));
  const shape = await cachedJson(`shape-${title}`, `${SEFARIA}/api/shape/${encodeURIComponent(title)}`);
  const volumes = data.text[''];
  const shapeVolumes = shape[0].chapters;
  const workId = 'Yahel_Ohr_on_Zohar';
  const nodes = new Map();
  const expected = new Map();
  const anchors = [];
  const local = {};
  // Pages past the end of a Mantua volume (Vilna's השמטות, I 264b, 266b) have no Zohar page in this pack: they follow
  // the addenda as their own nodes, titled by their Vilna page, and are not anchored.
  const addendaNode = PAGES.length + 1;
  const outside = [];
  shapeVolumes.forEach((dapim, v) => dapim.forEach((count, index) => { if (count && !nodeOf(v + 1, indexAmud(index))) outside.push(`${v + 1}:${indexAmud(index)}`); }));
  const outsideNode = new Map(outside.map((ref, i) => [ref, addendaNode + 1 + i]));
  const extra = ['ליקוטים', ...outside.map(ref => { const [v, amud] = ref.split(':'); return `חלק ${['א', 'ב', 'ג'][v - 1]} · השמטות · ${amudLabel(amud)}`; })];
  const nodeAt = (v, index) => nodeOf(v, indexAmud(index)) || outsideNode.get(`${v}:${indexAmud(index)}`) || null;
  shapeVolumes.forEach((dapim, v) => dapim.forEach((count, index) => { if (count) expected.set(nodeAt(v + 1, index), count); }));
  volumes.forEach((dapim, v) => (dapim || []).forEach((paragraphs, index) => {
    const node = nodeAt(v + 1, index);
    const anchored = Boolean(nodeOf(v + 1, indexAmud(index)));
    (paragraphs || []).forEach((value, p) => {
      const text = typeof value === 'string' ? stripWikiResidue(cleanText(value, local), local) : '';
      if (!text) return;
      if (!node) fail(`Yahel Ohr: text at ${v + 1}:${indexAmud(index)} outside its own structure`);
      if (!nodes.has(node)) nodes.set(node, []);
      const unitId = `${workId}.${node}.${p + 1}`;
      nodes.get(node).push({ id: unitId, n: p + 1, text });
      if (anchored) anchors.push({ unitId, anchorRef: `Zohar.${node}`, canonicalRef: `${title} ${v + 1}:${indexAmud(index)}:${p + 1}`, baseCanonicalRef: `Zohar ${v + 1}:${indexAmud(index)}` });
    });
  }));
  const addendaShape = (await cachedJson(`shape-${title}, Addenda`, `${SEFARIA}/api/shape/${encodeURIComponent(`${title}, Addenda`)}`))[0];
  const addendaCount = Number(Array.isArray(addendaShape.chapters) ? addendaShape.chapters.length : addendaShape.chapters) || 0;
  expected.set(addendaNode, addendaCount);
  (data.text.Addenda || []).forEach((value, p) => {
    const text = typeof value === 'string' ? stripWikiResidue(cleanText(value, local), local) : '';
    if (!text) return;
    if (!nodes.has(addendaNode)) nodes.set(addendaNode, []);
    const unitId = `${workId}.${addendaNode}.${p + 1}`;
    nodes.get(addendaNode).push({ id: unitId, n: p + 1, text });
  });
  commentaries.push({
    workId, title, heTitle: 'יהל אור (הגר״א)', shortTitle: 'יהל אור', authors: ['הגר״א — רבי אליהו מווילנא'], compDate: 'וילנא תרמ״ב (1882)',
    editionTitle: versionTitle, editionHeTitle: 'יהל אור, וילנא תרמ״ב', provider: 'sefaria', providerUrl: `${SEFARIA}/${encodeURIComponent(title)}`,
    versionSource: version.versionSource, recordedLicense: version.license, sourceNote: 'ספריא: "Vilna 1882", מקור ההעתקה: ויקיטקסט (יהל אור). ספריא רושמת PD; ההעתקה בוויקיטקסט ב־CC BY-SA 4.0, ולכן הספר מסומן כך בזהירות.',
    pagination: { ...PAGINATION, extra }, total: addendaNode + outside.length, nodes, expected, anchors, stats: local,
    relation: { relationType: 'commentary', baseWorkId: 'Zohar', anchorScheme: 'mantua-page' },
  });
}

// 4b. Beur HaGra on Sifra DeTzniuta — Sefaria "Wikisource", chapter/paragraph; anchored through Sefaria's links.
{
  const title = 'Beur HaGra on Sifra DeTzniuta';
  const versionTitle = 'Wikisource';
  const version = await sefariaVersion(title, versionTitle);
  const data = await cachedJson(`export-${title}-${versionTitle}`, exportUrl(title, versionTitle));
  const shape = await cachedJson(`shape-${title}`, `${SEFARIA}/api/shape/${encodeURIComponent(title)}`);
  const workId = 'Beur_HaGra_on_Sifra_DeTzniuta';
  const nodes = new Map();
  const expected = new Map();
  const anchors = [];
  const local = {};
  const linkFor = new Map();
  for (let c = 1; c <= shape[0].chapters.length; c += 1) {
    const links = await cachedJson(`links-${title} ${c}`, `${SEFARIA}/api/links/${encodeURIComponent(`${title} ${c}`)}?with_text=0`);
    for (const link of links) {
      if (!/^Zohar, /.test(link.ref)) continue;
      const node = zoharRefToNode(link.ref);
      for (const anchor of link.anchorRefExpanded || [link.anchorRef]) if (node && !linkFor.has(anchor)) linkFor.set(anchor, { node, ref: link.ref });
    }
  }
  const unlinked = [];
  shape[0].chapters.forEach((count, c) => expected.set(c + 1, count));
  data.text.forEach((paragraphs, c) => (paragraphs || []).forEach((value, p) => {
    const text = typeof value === 'string' ? stripWikiResidue(cleanText(value, local), local) : '';
    if (!text) return;
    if (!nodes.has(c + 1)) nodes.set(c + 1, []);
    const unitId = `${workId}.${c + 1}.${p + 1}`;
    nodes.get(c + 1).push({ id: unitId, n: p + 1, text });
    const canonicalRef = `${title} ${c + 1}:${p + 1}`;
    const link = linkFor.get(canonicalRef);
    if (link) anchors.push({ unitId, anchorRef: `Zohar.${link.node}`, canonicalRef, baseCanonicalRef: `Zohar ${PAGES[link.node - 1].ref} (${link.ref})` });
    else unlinked.push(canonicalRef);
  }));
  // A comment without its own link follows the page of the comment before it (Sefaria links the passages, not every note).
  for (const ref of unlinked) {
    const [c, p] = ref.split(' ').at(-1).split(':').map(Number);
    let prior = null;
    for (let q = p - 1; q >= 1 && !prior; q -= 1) prior = anchors.find(a => a.canonicalRef === `${title} ${c}:${q}`);
    for (let q = p + 1; !prior && q <= (expected.get(c) || 0); q += 1) prior = anchors.find(a => a.canonicalRef === `${title} ${c}:${q}`);
    if (prior) anchors.push({ unitId: `${workId}.${c}.${p}`, anchorRef: prior.anchorRef, canonicalRef: ref, baseCanonicalRef: prior.baseCanonicalRef, inferred: true });
  }
  anchors.sort((a, b) => { const [, n1, u1] = a.unitId.split('.').map(Number); const [, n2, u2] = b.unitId.split('.').map(Number); return n1 - n2 || u1 - u2; });
  commentaries.push({
    workId, title, heTitle: 'ביאור הגר״א על ספרא דצניעותא', shortTitle: 'הגר״א על ספרא דצניעותא', authors: ['הגר״א — רבי אליהו מווילנא'], compDate: null,
    editionTitle: versionTitle, editionHeTitle: 'ביאור הגר״א לספרא דצניעותא (העתקת ויקיטקסט)', provider: 'sefaria', providerUrl: `${SEFARIA}/${encodeURIComponent(title)}`,
    versionSource: version.versionSource, recordedLicense: version.license, sourceNote: 'ספריא: "Wikisource", מקור ההעתקה: ויקיטקסט. ספריא רושמת Public Domain; ההעתקה בוויקיטקסט ב־CC BY-SA 4.0, ולכן הספר מסומן כך בזהירות.',
    nodeTitles: shape[0].chapters.map((_, c) => `פרק ${hebrewNumeral(c + 1)}`), nodeLabel: 'פרק', total: shape[0].chapters.length, nodes, expected, anchors, stats: local,
    relation: { relationType: 'commentary', baseWorkId: 'Zohar', anchorScheme: 'sefaria-links' },
    ...(anchors.some(a => a.inferred) ? { anchorNote: `${anchors.filter(a => a.inferred).length} הערות ללא קישור משלהן שויכו לדף של ההערה הסמוכה` } : {}),
  });
}

// 4c. Nefesh David (Radal) — Hebrew Wikisource, every comment under the printed page it names.
const ND_ROOT = 'נפש דוד (רד"ל)';
const ND_PAGES = ['ספר בראשית/חלק א', 'ספר בראשית/חלק ב', 'ספר שמות', 'ספר ויקרא', 'ספר במדבר', 'ספר דברים', 'ליקוטים'].map(p => `${ND_ROOT}/${p}`);
const ndPages = await fetchPages([ND_ROOT, ...ND_PAGES], { cache: CACHE, revids: pinned, offline: OFFLINE });
applyRepairs(Object.values(ndPages), [
  { find: "כד\"א עיני ה' כו'} הן נצח והוד", replace: "כד\"א עיני ה' כו'}} הן נצח והוד", why: 'template closed with a single brace' },
]);
{
  const workId = 'Nefesh_David_on_Zohar';
  const nodes = new Map();
  const anchors = [];
  const local = {};
  const extraTemplates = {
    'הפניה-גמ': a => `(דף ${(a[2] || '').trim()}${(a[3] || '').trim() === 'ב' ? ':' : '.'})`,
    'הפניה-ירושלמי': a => `(פ"${(a[2] || '').trim()} ה"${(a[3] || '').trim()})`,
    'דף ויקיפדיה': a => ((a[2] || a[1]) || '').trim(),
  };
  const addendaNode = PAGES.length + 1;
  const outside = new Map();
  const push = (node, paragraphs, anchor) => {
    if (!nodes.has(node)) nodes.set(node, []);
    for (const text of paragraphs) {
      const list = nodes.get(node);
      const unitId = `${workId}.${node}.${list.length + 1}`;
      list.push({ id: unitId, n: list.length + 1, text });
      if (anchor && node <= PAGES.length) anchors.push({ unitId, anchorRef: `Zohar.${node}`, canonicalRef: `${ND_ROOT} · ${anchor.page} · ${anchor.label}`, baseCanonicalRef: `Zohar ${PAGES[node - 1].ref}` });
    }
  };
  for (const title of ND_PAGES) {
    const raw = ndPages[title].content;
    if (title.endsWith('ליקוטים')) { push(addendaNode, wikitextToParagraphs(raw, local, extraTemplates).paragraphs, null); continue; }
    const volume = /בראשית/.test(title) ? 1 : /שמות/.test(title) ? 2 : 3;
    const HEADING = /^===\s*(?:\[\[זהר חלק ([אבג]) ([א-ת]+) ([אב])(?:\|[^\]]*)?\]\]|דף ([א-ת]+) עמוד ([אב]))\s*===\s*$/gm;
    const marks = [...raw.matchAll(HEADING)];
    marks.forEach((m, i) => {
      const vol = m[1] ? HEB[m[1]] : volume;
      const amud = m[1] ? amudOf(m[2], m[3]) : amudOf(m[4], m[5]);
      // Past the end of a Mantua volume (Vilna's השמטות): its own node after the addenda, unanchored.
      const ref = `${vol}:${amud}`;
      if (!nodeOf(vol, amud) && !outside.has(ref)) outside.set(ref, addendaNode + 1 + outside.size);
      const node = nodeOf(vol, amud) || outside.get(ref);
      const body = raw.slice(m.index + m[0].length, marks[i + 1]?.index ?? raw.length).replace(/^==[^=].*$/gm, '');
      push(node, wikitextToParagraphs(body, local, extraTemplates).paragraphs, { page: title.slice(ND_ROOT.length + 1), label: m[0].replace(/=|\[\[[^|]*\||\]\]/g, '').trim() });
    });
  }
  if (local.unknownTemplates) fail(`Nefesh David: unknown templates ${JSON.stringify(local.unknownTemplates)}`);
  const expected = new Map([...nodes].map(([node, list]) => [node, list.length]));
  commentaries.push({
    workId, title: 'Nefesh David on Zohar', heTitle: 'נפש דוד (הרד״ל)', shortTitle: 'נפש דוד', authors: ['רבי דוד לוריא (הרד״ל)'], compDate: 'וילנא תרמ״ב (1882), נספח ליהל אור',
    editionTitle: 'Hebrew Wikisource transcription (Vilna 1882 appendix to Yahel Ohr)', editionHeTitle: 'נפש דוד, נספח ליהל אור (וילנא תרמ״ב) — העתקת ויקיטקסט', provider: 'wikisource', providerUrl: pageUrl(ND_ROOT),
    versionSource: pageUrl(ND_ROOT), recordedLicense: 'CC BY-SA 4.0', sourceNote: 'ויקיטקסט העברי. גרסת ספריא של הספר רשומה ברישיון לא ידוע ואינה בשימוש.',
    pagination: { ...PAGINATION, extra: ['ליקוטים', ...[...outside.keys()].map(ref => { const [v, amud] = ref.split(':'); return `חלק ${['א', 'ב', 'ג'][v - 1]} · השמטות · ${amudLabel(amud)}`; })] }, total: addendaNode + outside.size, nodes, expected, anchors, stats: local, coverageBasis: `כל ${ND_PAGES.length} דפי ההעתקה בוויקיטקסט`,
    relation: { relationType: 'commentary', baseWorkId: 'Zohar', anchorScheme: 'mantua-page' },
  });
}

// ---------- 5. Remote layers: the larger commentaries, live from Sefaria in their exact public-domain edition ----------
const REMOTE = [
  { workId: 'Ketem_Paz_on_Zohar', title: 'Ketem Paz on Zohar', heTitle: 'כתם פז', author: 'רבי שמעון לביא', versionTitle: 'Livorno, 1795', heVersion: 'ליוורנו תקנ״ה (1795)', refPattern: '{title} {amud}', volumes: [1] },
  { workId: 'Mikdash_Melekh_on_Zohar', title: 'Mikdash Melekh on Zohar', heTitle: 'מקדש מלך', author: 'רבי שלום בוזגלו', versionTitle: 'Zholkva, 1864', heVersion: 'ז׳ולקווא תרכ״ד (1864)', refPattern: '{title} {volume}:{amud}' },
  { workId: 'Mikdash_Melekh_RaMaZ_on_Zohar', title: 'Mikdash Melekh, RaMaZ Commentary on Zohar', heTitle: 'מקדש מלך · פירוש הרמ״ז', author: 'רבי משה זכות (הרמ״ז)', versionTitle: 'Zholkva, 1864', heVersion: 'ז׳ולקווא תרכ״ד (1864)', refPattern: '{title} {volume}:{amud}' },
  { workId: 'Ohr_HaChammah_on_Zohar', title: 'Ohr HaChammah on Zohar', heTitle: 'אור החמה', author: 'רבי אברהם אזולאי', versionTitle: 'Ohr Hachama, Peremyshl, 1896-1898', heVersion: 'פרמישלא תרנ״ו–תרנ״ח (1896–1898)', refPattern: '{title} {volume}:{amud}' },
];
const remoteLayers = [];
for (const layer of REMOTE) {
  const version = await sefariaVersion(layer.title, layer.versionTitle);
  if (version.license !== 'Public Domain') fail(`${layer.title}: licence is "${version.license}", not Public Domain`);
  const shape = await cachedJson(`shape-${layer.title}`, `${SEFARIA}/api/shape/${encodeURIComponent(layer.title)}`);
  const main = shape.find(part => Array.isArray(part.chapters) && (part.chapters.every(Array.isArray) || part.chapters.every(Number.isInteger)) && part.length >= 2) || shape[0];
  const byVolume = layer.volumes ? [main.chapters] : main.chapters;
  const anchorNodes = [];
  let expectedUnits = 0;
  byVolume.forEach((dapim, v) => (dapim || []).forEach((count, index) => {
    if (!count) return;
    const node = nodeOf(layer.volumes ? layer.volumes[v] : v + 1, indexAmud(index));
    if (!node) return;
    expectedUnits += count;
    anchorNodes.push([node, count]);
  }));
  remoteLayers.push({
    workId: layer.workId, title: layer.title, heTitle: layer.heTitle, authors: [layer.author], provider: 'sefaria', versionTitle: layer.versionTitle, heVersion: layer.heVersion,
    versionSource: version.versionSource, license: 'public-domain', recordedLicense: version.license, refPattern: layer.refPattern, licenseVerifiedAt: RETRIEVED_AT,
    relation: { relationType: 'commentary', baseWorkId: 'Zohar', anchorScheme: 'mantua-page' },
    anchorNodes,
    coverage: coverageRecord({ expectedUnits, importedUnits: 0, coverageStatus: COVERAGE.REMOTE_ONLY, note: 'נטען מספריא בעת הקריאה, במהדורה זו בלבד; אין עותק במכשיר.' }),
  });
}

// ---------- 6. Write the pack ----------
const packWorks = [];
const gz = body => gzipSync(Buffer.from(body), { level: 9 });
const toFile = (staging, name, body) => { const packed = gz(body); writeFileSync(join(staging, name), packed); return { file: name, bytes: packed.length, rawBytes: Buffer.byteLength(body), checksum: checksum(body) }; };
const staging = `${PACK_DIR}.staging`;
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });
const manifestFiles = [];

const coverageBlock = ({ status, ...rest }) => coverageRecord({ ...rest, coverageStatus: status });

// The Zohar.
{
  const workId = 'Zohar';
  const chunk = { workId, editionId: `${PACK_ID}:${workId}`, packId: PACK_ID, nodes: zoharNodes.filter(node => node.units.length) };
  const expected = zoharNodes.map(node => ({ n: node.n, units: node.units.length }));
  const report = validateWorkChunk(chunk, expected);
  if (report.status !== COVERAGE.FULL) fail(`Zohar chunk does not validate: ${JSON.stringify({ ...report, missingUnits: report.missingUnits.length })}`);
  const written = toFile(staging, 'Zohar.json.gz', JSON.stringify(chunk));
  manifestFiles.push({ workId, ...written });
  const printedEmpty = new Set(noTextInPrint.map(item => item.node));
  const withoutText = zoharNodes.filter(node => !node.units.length && !printedEmpty.has(node.n)).map(node => PAGES[node.n - 1].ref);
  const incomplete = [...nodeStats].filter(([, s]) => s.incomplete).map(([node, s]) => ({ ref: PAGES[node - 1].ref, markers: s.incomplete }));
  const expectedPages = PAGES.length - printedEmpty.size;
  const importedPages = zoharNodes.filter(node => node.units.length).length;
  packWorks.push({
    workId, title: 'Zohar', heTitle: 'ספר הזהר', group: 'yesod', aliases: ['זוהר', 'הזוהר', 'ספר הזוהר', 'זהר', 'הזהר'], authors: ['רבי שמעון בר יוחאי (מיוחס)'], compDate: null,
    editionTitle: 'Hebrew Wikisource transcription, Mantua pagination', editionHeTitle: 'ספר הזהר · העתקת ויקיטקסט לפי דפי מנטובה', provider: 'wikisource', versionSource: pageUrl('ספר הזהר'),
    license: 'cc-by-sa', recordedLicense: 'CC BY-SA 4.0', nodeLabel: 'עמוד', unitLabel: 'פסקה', pagination: PAGINATION, sections,
    status: report.status, missingUnits: [], ...written,
    nodes: expected.map(item => item.units), expected: expected.map(item => item.units),
    translationSought: true,
    coverage: coverageBlock({
      expectedUnits: expectedPages, importedUnits: importedPages, missingUnits: withoutText,
      status: withoutText.length || incomplete.length ? COVERAGE.PARTIAL : COVERAGE.FULL,
      unit: 'amud', noTextInPrint: noTextInPrint.map(item => item.ref), incompletePassages: incomplete,
      note: incomplete.length ? `${incomplete.length} עמודים שבהם מסמנת ההעתקה בוויקיטקסט קטע חסר ({{להשלים}}); הטקסט לא הושלם ממקור אחר.` : null,
    }),
    attribution: { text: 'ספר הזהר — העתקת ויקיטקסט העברי (דפוס מנטובה שי״ח–שי״ט), CC BY-SA 4.0', url: pageUrl('ספר הזהר'), licenseUrl: WIKISOURCE_LICENSE.url, modified: 'עיבוד: ניקוי סימון בלבד — הערות העורכים, תבניות העיצוב וכותרות המאמרים הוסרו; מראי המקומות נשמרו בסוגריים.' },
    stats: { footnotesRemoved: stats.footnotes || 0, imagesRemoved: stats.images || 0, tablesRemoved: stats.tables || 0, unclosedQuotesOpened: stats.unclosedQuotes || 0, incompleteMarkers: stats.incomplete || 0, emendationsKept: (stats.templates?.['תיקון גירסה'] || 0) + (stats.templates?.['תיקון'] || 0), bracketsReplaced: stats.brackets || 0, templates: stats.templates },
  });
}

// The bundled commentaries.
for (const work of commentaries) {
  const total = work.total;
  const expected = Array.from({ length: total }, (_, i) => ({ n: i + 1, units: work.expected.get(i + 1) || 0 }));
  const chunkNodes = [...work.nodes].sort((a, b) => a[0] - b[0]).map(([n, units]) => ({ id: `${work.workId}.${n}`, n, units }));
  const chunk = { workId: work.workId, editionId: `${PACK_ID}:${work.workId}`, packId: PACK_ID, nodes: chunkNodes };
  const report = validateWorkChunk(chunk, expected);
  const corrupt = report.duplicateIds.length || report.emptyUnits.length || report.invalidRefs.length || report.unexpectedUnits.length || report.orderErrors.length;
  if (corrupt) fail(`${work.workId}: ${JSON.stringify({ d: report.duplicateIds.slice(0, 5), e: report.emptyUnits.slice(0, 5), i: report.invalidRefs.slice(0, 5), u: report.unexpectedUnits.slice(0, 5), o: report.orderErrors.slice(0, 5) })}`);
  const written = toFile(staging, `${work.workId}.json.gz`, JSON.stringify(chunk));
  const anchorsBody = JSON.stringify({ workId: work.workId, editionId: chunk.editionId, relationType: work.relation.relationType, baseWorkId: work.relation.baseWorkId, anchorScheme: work.relation.anchorScheme, license: 'cc-by-sa', anchors: work.anchors });
  const anchorsWritten = toFile(staging, `${work.workId}.anchors.json.gz`, anchorsBody);
  manifestFiles.push({ workId: work.workId, ...written }, { workId: work.workId, role: 'anchors', ...anchorsWritten });
  // Compact page index for the reader: [baseNode, layerNode, firstUnit, lastUnit], so tabs are decided without loading.
  const anchorNodes = [];
  for (const anchor of work.anchors) {
    const base = Number(anchor.anchorRef.split('.')[1]);
    const [, layerNode, unit] = anchor.unitId.split('.').map(Number);
    const lastRow = anchorNodes.at(-1);
    if (lastRow && lastRow[0] === base && lastRow[1] === layerNode && lastRow[3] === unit - 1) lastRow[3] = unit; else anchorNodes.push([base, layerNode, unit, unit]);
  }
  const anchoredUnits = work.anchors.length;
  packWorks.push({
    workId: work.workId, title: work.title, heTitle: work.heTitle, shortTitle: work.shortTitle, group: 'zohar-commentary', aliases: [], authors: work.authors, compDate: work.compDate,
    editionTitle: work.editionTitle, editionHeTitle: work.editionHeTitle, provider: work.provider, providerUrl: work.providerUrl, versionSource: work.versionSource,
    license: 'cc-by-sa', recordedLicense: work.recordedLicense, sourceNote: work.sourceNote, nodeLabel: work.nodeLabel || 'עמוד', unitLabel: 'קטע',
    ...(work.pagination ? { pagination: work.pagination, sections } : { nodeTitles: work.nodeTitles }),
    status: report.status, missingUnits: report.missingUnits, ...written,
    nodes: expected.map(({ n }) => work.nodes.get(n)?.length || 0), expected: expected.map(item => item.units),
    relation: work.relation, anchorsFile: anchorsWritten.file, anchorsChecksum: anchorsWritten.checksum, anchorNodes,
    coverage: coverageBlock({ expectedUnits: report.expectedUnits, importedUnits: report.importedUnits, missingUnits: report.missingUnits, status: report.status, anchoredUnits, unanchoredUnits: report.importedUnits - anchoredUnits, ...(work.coverageBasis ? { basis: work.coverageBasis } : {}), ...(work.anchorNote ? { anchorNote: work.anchorNote } : {}) }),
    attribution: { text: `${work.heTitle} — ${work.editionHeTitle}, העתקת ויקיטקסט העברי, CC BY-SA 4.0${work.provider === 'sefaria' ? ' (דרך ספריא)' : ''}`, url: work.versionSource, licenseUrl: WIKISOURCE_LICENSE.url, modified: 'עיבוד: ניקוי סימון בלבד.' },
    stats: { bracketsReplaced: work.stats.brackets || 0, footnotesRemoved: work.stats.footnotes || 0, wikiResidueRemoved: work.stats.wikiResidue || 0 },
  });
}

const packBytes = manifestFiles.reduce((total, file) => total + file.bytes, 0);
const edition = { title: 'Hebrew Wikisource (CC BY-SA 4.0)', heTitle: 'ויקיטקסט העברי', editor: 'מתנדבי ויקיטקסט', notes: 'העתקות ויקיטקסט, כל אחת בגרסה מוצמדת (oldid). ניקוי סימון בלבד; הטקסט עצמו לא שונה.' };
writeFileSync(join(staging, 'manifest.json'), JSON.stringify({ packId: PACK_ID, contentVersion: `Hebrew Wikisource, pinned revisions (retrieved ${RETRIEVED_AT})`, family: 'corpus', category: 'kabbalah', structure: ['node', 'unit'], license: 'cc-by-sa', licenseUrl: WIKISOURCE_LICENSE.url, source: 'wikisource', edition, retrievedAt: RETRIEVED_AT, provenance: 'sources/wikisource-zohar/provenance.json', files: manifestFiles }, null, 1));
rmSync(PACK_DIR, { recursive: true, force: true });
renameSync(staging, PACK_DIR);

// ---------- 7. Index module and provenance ----------
const pages = [
  ...INDEX_PAGES.map(title => ({ role: 'index', record: indexPages[title] })),
  ...dafTitles.map(title => ({ role: 'amud', record: dafPages[title] })),
  ...[...parashaTitles].map(title => ({ role: 'parasha', record: parashaPages[title] })),
  ...[ND_ROOT, ...ND_PAGES].map(title => ({ role: 'nefesh-david', record: ndPages[title] })),
].map(({ role, record }) => ({ role, title: record.title, url: pageUrl(record.title), revid: record.revid, oldidUrl: oldidUrl(record.revid), timestamp: record.timestamp, sha256: record.sha256 || hash(record.content), proofread: 'not-applicable' }));
// The open Hebrew translation on Wikisource was checked before import (2026-09-29) and is NOT shipped. Recorded so the
// reader can say honestly that no open translation exists yet, and so a later review can reopen it.
const translationDecision = {
  work: 'ביאור:זוהר מתורגם (Hebrew Wikisource)',
  url: pageUrl('ביאור:זוהר מתורגם'),
  revid: 3082602,
  pagesChecked: 139,
  wouldCover: 'Hakdama (I 1a–14b) and I 15a–83a: 165 of 1,630 amudim with text (10.1%)',
  decision: 'BLOCKED — not imported, not shown',
  reasons: [
    'The translator (user תומר פנק, author of 168 of the 227 edits; all 138 content pages) wrote on the project talk page (שיחת ביאור:זוהר מתורגם, oldid 3023269, 3 July 2026): "הרוב הינו תרגום מילולי בין ארמית-לעברית. בחלקים מסויימים התרגום מבוסס על הסולם בהשמטת חלקי הסוד" — parts are based on the Sulam, a protected 20th-century translation (PERMISSION_REQUIRED in this registry).',
    'Measured against Sefaria\'s "Hebrew Translation" of the Zohar (source toratemetfreeware.com, licence unknown, the translation the owner calls R. David Sarig\'s) over the Hakdama: 21.5% of word 4-grams and 6.1% of 8-grams are shared, with 69 identical runs of 12+ words (1,000 words, 6.8% of the text). Literal translations of the same Aramaic converge, so this does not prove copying, but it does not dispel the doubt either.',
    'The whole 289 KB Hakdama translation was added in three days (25–28 June 2026) — no statement of method per page.',
  ],
  reopenWhen: 'The translator confirms in writing which passages are his own and none are copied from the Sulam or another protected translation, or a rights reviewer clears it.',
};
const provenance = {
  work: 'ספר הזהר (with Yahel Ohr, Nefesh David and Beur HaGra on Sifra DeTzniuta)',
  pack: PACK_ID,
  license: WIKISOURCE_LICENSE.title,
  licenseUrl: WIKISOURCE_LICENSE.url,
  attributionRequired: true,
  shareAlike: true,
  attribution: 'ספר הזהר — העתקת ויקיטקסט העברי (https://he.wikisource.org/wiki/ספר_הזהר), CC BY-SA 4.0; יהל אור וביאור הגר״א לספרא דצניעותא — העתקות ויקיטקסט דרך ספריא; נפש דוד — ויקיטקסט העברי',
  underlyingWork: 'The Zohar as printed in Mantua 1558–1560 and the nineteenth-century commentaries (Vilna 1882) are in the public domain; the licence covers the Wikisource transcriptions.',
  accessedAt: RETRIEVED_AT,
  modified: true,
  modifications: 'Markup only. Editors\' footnotes ({{הערה}}), navigation, site headings and images were removed; verse and page references kept in parentheses; editorial emendations ({{תיקון גירסה}}) kept as "(printed) [corrected]"; ketiv/qere as "(ketiv) [qere]". The words of the transcription were not changed.',
  proofreadStatus: 'The Zohar pages are main-namespace transcriptions, not Page: scans, so Wikisource\'s proofread levels do not apply. Every page is pinned by revision id; the category קטגוריה:זהר ללא ניקוד marks the text as unvocalized.',
  textualBasisNote: 'The Wikisource talk page of ביאור:זוהר מתורגם (July 2026) records that the main Zohar text was first typed from hebrew.grimoar.cz and since corrected by volunteers, partly following the Gra and the method of the Matok MiDvash edition; the discussion concluded that it is presented as a Wikisource edition and does not copy a protected edition. Emendations are marked in the text where the editors used {{תיקון גירסה}}. Flagged for a rights reviewer; not a legal clearance.',
  notImported: [
    { item: 'זוהר השמטות', why: 'Vilna additions outside the Mantua pagination; a later step can add them as their own section.' },
    { item: 'זהר חלק ג קעה א - השלמת ווילנא', why: 'Vilna supplement page, not a Mantua page.' },
  ],
  translation: translationDecision,
  pagination: PAGINATION,
  sections,
  noTextInPrint,
  unresolvedSections: unresolved,
  markupRepairs: repairsApplied,
  stats: { amudim: PAGES.length, units: zoharNodes.reduce((t, n) => t + n.units.length, 0), ...packWorks[0].stats },
  sefaria: [
    ...commentaries.filter(work => work.provider === 'sefaria').map(work => ({ title: work.title, versionTitle: work.editionTitle, recordedLicense: work.recordedLicense, versionSource: work.versionSource, export: exportUrl(work.title, work.editionTitle), usedLicense: 'CC BY-SA 4.0 (conservative: the transcription comes from Wikisource)' })),
    ...remoteLayers.map(layer => ({ title: layer.title, versionTitle: layer.versionTitle, recordedLicense: layer.recordedLicense, versionSource: layer.versionSource, remoteOnly: true, licenseVerifiedAt: layer.licenseVerifiedAt })),
    { title: 'Zohar (index only)', use: 'alt_structs.Daf maps Sefaria\'s parasha paragraphs to Mantua pages, used to anchor Beur HaGra on Sifra DeTzniuta', url: `${SEFARIA}/api/v2/raw/index/Zohar` },
  ],
  pages,
};
mkdirSync(SOURCE_DIR, { recursive: true });
writeFileSync(PROVENANCE, `${JSON.stringify(provenance, null, 1)}\n`);

const reports = packWorks.map(work => ({ workId: work.workId, expectedUnits: work.expected.reduce((a, b) => a + b, 0), importedUnits: work.nodes.reduce((a, b) => a + b, 0), status: work.status, checksum: work.checksum, missing: work.missingUnits.length }));
const index = {
  generatedAt: RETRIEVED_AT,
  packs: [{
    packId: PACK_ID, contentVersion: `Hebrew Wikisource, pinned revisions (retrieved ${RETRIEVED_AT})`, family: 'corpus', category: 'kabbalah', structure: ['node', 'unit'], nodeLabel: 'עמוד', unitLabel: 'פסקה',
    policy: 'source', source: 'wikisource', license: 'cc-by-sa', edition, sourceUrl: pageUrl('ספר הזהר'), retrievedAt: RETRIEVED_AT, bytes: packBytes,
    provenance: 'sources/wikisource-zohar/provenance.json', works: packWorks.map(({ stats: workStats, ...work }) => work),
  }],
  remoteLayers,
  blockedLayers: [{ workId: 'Zohar_Hebrew_Translation_Wikisource', heTitle: 'זוהר מתורגם (ויקיטקסט)', relation: { relationType: 'translation', baseWorkId: 'Zohar', anchorScheme: 'mantua-page' }, coverage: { expectedUnits: 1630, importedUnits: 0, missingUnits: [], coveragePercent: 0, coverageStatus: COVERAGE.BLOCKED }, reason: translationDecision.reasons[0], url: translationDecision.url }],
  reports,
};
mkdirSync(join(ROOT, 'src/data/library/corpus'), { recursive: true });
writeFileSync(INDEX_FILE, `// Generated by scripts/library/build-zohar.mjs. Do not edit by hand.\nexport default ${JSON.stringify(index)};\n`);
console.log(JSON.stringify({ packBytes, files: manifestFiles.map(f => `${f.file}:${f.bytes}`), reports, coverage: packWorks.map(w => [w.workId, w.coverage.coverageStatus, w.coverage.importedUnits, w.coverage.expectedUnits]), remote: remoteLayers.map(l => [l.workId, l.anchorNodes.length, l.coverage.expectedUnits]), zoharStats: packWorks[0].stats, noTextInPrint }, null, 1));
