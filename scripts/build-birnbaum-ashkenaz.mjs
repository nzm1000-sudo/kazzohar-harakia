// Builds the offline "HaSiddur HaShalem" pack (Paltiel Birnbaum, 1949, Nusach Ashkenaz) — a SECOND edition of the
// Ashkenaz rite, beside the Metsudah pack — from the Hebrew Wikisource page-by-page transcription of the book.
//   node scripts/build-birnbaum-ashkenaz.mjs --fetch     download the pages into sources/birnbaum-ashkenaz/raw/ (once)
//   node scripts/build-birnbaum-ashkenaz.mjs             parse the cache offline; write the pack and provenance.json
//   node scripts/build-birnbaum-ashkenaz.mjs --report <file.json>   also write every change made on the way
//
// Source and licence: only the `עמוד:` (Page:) namespace of
//   https://he.wikisource.org/wiki/מפתח:Philip_Birnbaum_-_ha-Siddur_ha-Shalem_(The_Daily_Prayer_Book,1949).pdf
// is read — each page as the proofreaders rendered and checked it against the scan (action=parse of that revision).
// Wikisource's assembled edition (הסידור השלם (בירנבוים)/אשכנז) is NOT used: it translates the instructions, adds Land
// of Israel customs and "improves" the text. The transcription is CC BY-SA 4.0 (Wikisource terms of use); the book
// itself (1949) is in the public domain in the US by non-renewal. Attribution and share-alike are required — see
// sources/birnbaum-ashkenaz/README.md, provenance.json and src/data/nusach/manifest.mjs.
//
// Only pages whose proofreading status is "proofread" (3) or "validated" (4) are imported; any other page stops the
// build. Deterministic: the parse stage reads only the cache and always writes the same bytes. The words and their
// points are never edited: the parser keeps the rendered text of each page and removes only page furniture (running
// heads, links, spacing templates), joins a paragraph that runs over a page break, and marks the Wikisource editors'
// Hebrew renderings of Birnbaum's English directions (and his source lines) as small print.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const SRC_DIR = new URL('sources/birnbaum-ashkenaz/', ROOT);
const RAW_DIR = new URL('raw/', SRC_DIR);
const OUT = new URL('src/data/nusach/siddurAshkenazBirnbaum.mjs', ROOT);
const PROVENANCE = new URL('provenance.json', SRC_DIR);
const API = 'https://he.wikisource.org/w/api.php';
const UA = 'KazzoharSiddurBuilder/1.0 (offline siddur import of a CC BY-SA transcription; Node.js fetch)';
const ACCESSED = '2026-09-28';
const FILE_NAME = 'Philip Birnbaum - ha-Siddur ha-Shalem (The Daily Prayer Book,1949).pdf';
const INDEX_TITLE = `מפתח:${FILE_NAME}`;
const PAGE_TITLE = filePage => `עמוד:${FILE_NAME}/${filePage}`;
// The Index's pagelist: file page 26 is printed page 1 (every Hebrew page is odd, its English facing page even).
const FILE_OFFSET = 25;
const fileOf = bookPage => bookPage + FILE_OFFSET;
const pageUrl = title => `https://he.wikisource.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
const oldidUrl = revid => `https://he.wikisource.org/w/index.php?oldid=${revid}`;
const QUALITY = { 0: 'without text', 1: 'not proofread', 2: 'problematic', 3: 'proofread', 4: 'validated' };
const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const option = name => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : null);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export const INDEX = 'HaSiddur HaShalem Birnbaum';
export const HE_INDEX = 'הסידור השלם (בירנבוים)';
export const LICENSE = 'CC BY-SA 4.0';
export const LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';
export const ATTRIBUTION = 'הסידור השלם, פלטיאל בירנבוים (ניו יורק: בית ההוצאה העברי, 1949), נוסח אשכנז — העתקת ויקיטקסט העברי (עמודי ההגהה), CC BY-SA 4.0';

// ---------------------------------------------------------------------------------------------------------------
// What is imported: printed (book) pages, Hebrew side. Only what Nusach Ashkenaz lacks in the Metsudah pack
// (docs/siddur/notes-ashkenaz.md, review-ashkenaz.md).
const PAGES = [251, 253, 255, 367, 467, 469, 471, 473, 475, ...Array.from({ length: 29 }, (_, i) => 477 + i * 2), 541, 543, 545, 547, 549];

// Cache names (ASCII) of the base pages (דפי יסוד) whose sections the pages transclude.
const BASE_SLUGS = { 'כניסת שבת ויום טוב': 'kenisat-shabbat', 'סוף התפילה': 'sof-hatefilah', 'קדיש': 'kaddish', 'קריאת התורה': 'keriat-hatorah' };

// ---------------------------------------------------------------------------------------------------------------
// Fetch stage
async function apiGet(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params })}`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
    const body = await res.text();
    let data = null;
    try { data = JSON.parse(body); } catch { /* rate limit page */ }
    if (res.ok && data && !data.error) return data;
    if (attempt >= 6) throw new Error(`${res.status} ${data?.error?.code || body.slice(0, 80)} for ${url}`);
    await sleep(10000 * attempt); // polite back-off (the API answers "too many requests" to bursts)
  }
}
const writeJson = (url, value) => writeFileSync(url, `${JSON.stringify(value, null, 2)}\n`);

async function fetchAll() {
  mkdirSync(RAW_DIR, { recursive: true });
  // The Index page and the proofreading level of every page of the book (815).
  const index = (await apiGet({ action: 'query', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', titles: INDEX_TITLE })).query.pages[0];
  writeJson(new URL('index.json', RAW_DIR), { title: index.title, pageid: index.pageid, revid: index.revisions[0].revid, timestamp: index.revisions[0].timestamp, url: pageUrl(index.title), wikitext: index.revisions[0].slots.main.content });
  const status = {};
  for (let start = 1; start <= 815; start += 50) {
    const titles = Array.from({ length: Math.min(50, 816 - start) }, (_, i) => PAGE_TITLE(start + i));
    const data = await apiGet({ action: 'query', prop: 'proofread|info', titles: titles.join('|') });
    for (const page of data.query.pages) {
      const file = Number(page.title.split('/').pop());
      status[file] = { bookPage: file - FILE_OFFSET, quality: page.proofread?.quality ?? null, status: QUALITY[page.proofread?.quality] ?? 'missing', lastrevid: page.lastrevid ?? null };
    }
    await sleep(3000);
  }
  writeJson(new URL('status.json', RAW_DIR), { accessedAt: ACCESSED, index: INDEX_TITLE, pages: status });
  // Each imported page: its wikitext and its rendering, pinned to one revision.
  const base = new Map();
  for (const bookPage of PAGES) {
    const file = new URL(`page-${bookPage}.json`, RAW_DIR);
    if (existsSync(file)) { for (const t of JSON.parse(readFileSync(file, 'utf8')).transcludes) base.set(t.title, null); continue; }
    const title = PAGE_TITLE(fileOf(bookPage));
    const q = (await apiGet({ action: 'query', prop: 'revisions|proofread', rvprop: 'ids|timestamp|content', rvslots: 'main', titles: title })).query.pages[0];
    const rev = q.revisions[0];
    await sleep(2500);
    const parsed = (await apiGet({ action: 'parse', oldid: String(rev.revid), prop: 'text|templates', disablelimitreport: '1' })).parse;
    const transcludes = parsed.templates.map(t => t.title).filter(t => t.startsWith('הסידור השלם (בירנבוים)/'));
    for (const t of transcludes) base.set(t, null);
    writeJson(file, {
      bookPage, filePage: fileOf(bookPage), title: q.title, pageid: q.pageid, revid: rev.revid, timestamp: rev.timestamp,
      url: pageUrl(q.title), oldidUrl: oldidUrl(rev.revid), quality: q.proofread?.quality ?? null, status: QUALITY[q.proofread?.quality] ?? 'missing',
      templates: parsed.templates.map(t => t.title), transcludes: transcludes.map(t => ({ title: t })),
      wikitext: rev.slots.main.content, html: parsed.text,
    });
    console.log(`page ${bookPage} (file ${fileOf(bookPage)}) @ ${rev.revid} — ${QUALITY[q.proofread?.quality]}`);
    await sleep(2500);
  }
  // The base pages (דפי יסוד) the pages transclude their sections from: wikitext at the revision rendered.
  for (const title of base.keys()) {
    const slug = BASE_SLUGS[title.split('/').pop()] || title.split('/').pop().replace(/[^\p{L}\p{N}]+/gu, '-');
    const file = new URL(`base-${slug}.json`, RAW_DIR);
    if (existsSync(file)) continue;
    const q = (await apiGet({ action: 'query', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', titles: title })).query.pages[0];
    writeJson(file, { title: q.title, pageid: q.pageid, revid: q.revisions[0].revid, timestamp: q.revisions[0].timestamp, url: pageUrl(q.title), oldidUrl: oldidUrl(q.revisions[0].revid), wikitext: q.revisions[0].slots.main.content });
    console.log(`base ${title} @ ${q.revisions[0].revid}`);
    await sleep(2500);
  }
  // Record which base revision each page was rendered with.
  const baseRev = Object.fromEntries(readdirSync(RAW_DIR).filter(name => name.startsWith('base-')).map(name => JSON.parse(readFileSync(new URL(name, RAW_DIR), 'utf8'))).map(b => [b.title, b.revid]));
  for (const bookPage of PAGES) {
    const file = new URL(`page-${bookPage}.json`, RAW_DIR);
    const page = JSON.parse(readFileSync(file, 'utf8'));
    page.transcludes = page.transcludes.map(t => ({ title: t.title, revid: t.revid ?? baseRev[t.title] ?? null }));
    writeJson(file, page);
  }
}

if (flag('fetch')) { await fetchAll(); process.exit(0); }

// ---------------------------------------------------------------------------------------------------------------
// Parse stage: the rendered page → typed blocks.
const readJson = url => JSON.parse(readFileSync(url, 'utf8'));
const changes = []; // every change the build makes, for --report and docs
const change = (page, kind, detail) => changes.push({ page, kind, detail });

// The inner HTML of the first <div …> whose opening tag matches `open`, with nested divs balanced.
function innerDiv(html, open) {
  const at = html.search(open);
  if (at < 0) return null;
  const start = html.indexOf('>', at) + 1;
  const tag = /<div\b[^>]*>|<\/div>/g;
  tag.lastIndex = start;
  let depth = 1; let m;
  while ((m = tag.exec(html))) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return { inner: html.slice(start, m.index), before: html.slice(0, at), after: html.slice(tag.lastIndex) };
  }
  throw new Error('unbalanced div');
}

const decode = text => text.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
// Inline markup kept: <b> (Birnbaum's bold mishnah numbers). Links are unwrapped, spacing spans dropped.
function inline(html, page) {
  let out = html;
  if (/<a\b/.test(out)) { change(page, 'link unwrapped', (out.match(/<a\b[^>]*>[^<]*<\/a>/g) || []).map(a => a.replace(/<[^>]+>/g, '')).join(' · ')); out = out.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/g, '$1'); }
  if (/[\u200e\u200f]/.test(out)) change(page, 'direction mark removed', `${(out.match(/[\u200e\u200f]/g) || []).length} × U+200E/U+200F`);
  if (/<sup\b[^>]*class="reference"/.test(out)) throw new Error(`page ${page}: a footnote reference inside the text — review by hand`);
  // A direction printed inside a paragraph ("(ש״ץ)", {{סידור בירנבוים ש"ץ}}): small print marked as the editors'.
  out = out.replace(/<span style="font-size:\s*83%;?">([\s\S]*?)<\/span>/g, (_, text) => { change(page, 'inline direction marked', text.replace(/<[^>]+>/g, '')); return `\u0001${text}\u0002`; });
  out = out.replace(/<(?!\/?b>)[^>]+>/g, '');
  return decode(out).replace(/[‎‏]/g, '').replace(/\s+/g, ' ').trim()
    .replace(/\u0001\s*/g, '<small class="direction">').replace(/\s*\u0002/g, '</small>');
}

// Top-level blocks of the page body: {kind: 'text'|'direction'|'source'|'title'|'heading'|'chazzan', text, bare}.
export function pageBlocks(record) {
  const page = record.bookPage;
  const html = record.html;
  if (/<hr\b/.test(html)) throw new Error(`page ${page}: a double-rule addition (Land of Israel custom) — not Birnbaum's text`);
  const body = innerDiv(html, /<div style="font-family:/);
  if (!body) throw new Error(`page ${page}: no page body`);
  const blocks = [];
  const re = /<p>([\s\S]*?)<\/p>|<div\b([^>]*)>([\s\S]*?)<\/div>|([^<]+|<(?!p>|div\b)[^>]*>)/g;
  let m; let bare = '';
  const flushBare = () => {
    for (const piece of bare.split(/\n\s*\n/)) { const text = inline(piece, page); if (text) blocks.push({ kind: 'text', text, bare: true }); }
    bare = '';
  };
  while ((m = re.exec(body.inner))) {
    if (m[4] !== undefined) { bare += m[4]; continue; }
    flushBare();
    if (m[1] !== undefined) { const text = inline(m[1], page); if (text) blocks.push({ kind: 'text', text }); continue; }
    const attrs = m[2]; const inner = m[3];
    // {{פסקה חדשה בתחילת העמוד}}: the page opens a new paragraph (it does not continue the previous page's).
    if (!attrs.trim() && !inner.trim()) { blocks.push({ kind: 'newParagraph' }); continue; }
    if (!/text-align:\s*center/.test(attrs)) throw new Error(`page ${page}: unexpected block <div${attrs}>`);
    const text = inline(inner, page).replace(/<\/?(?:b|small)\b[^>]*>/g, '').trim();
    if (!text) { change(page, 'empty direction dropped', 'a direction the Wikisource base page does not (yet) supply'); continue; }
    if (/font-size:\s*83%/.test(inner)) blocks.push({ kind: /^ש"ץ:?$/.test(text) ? 'chazzan' : 'direction', text });
    else if (/<small>/.test(inner)) blocks.push({ kind: 'source', text });
    else if (/<big>/.test(inner)) blocks.push({ kind: 'title', text });
    else blocks.push({ kind: 'heading', text });
  }
  flushBare();
  return blocks;
}


// ---------------------------------------------------------------------------------------------------------------
// The leaves: runs of paragraphs cut out of the joined pages.
const NIKUD = /[֑-ׇ]/g;
const plain = markup => String(markup).replace(/<[^>]+>/g, ' ').replace(/[־]/g, ' ').replace(NIKUD, '').replace(/[״”“]/g, '"').replace(/[׳’‘]/g, "'").replace(/\s+/g, ' ').trim();
// Paragraph markup: Birnbaum's words as rendered; the editors' Hebrew renderings of his English directions, his
// small source lines and the Reader marks as small print of class "direction" (shown as the edition's notes).
const markupOf = block => (block.kind === 'text' ? block.text : `<small class="direction">${block.text}</small>`);

// The pages of a run, in order; a paragraph that runs over a page break is joined (the next page neither opens a new
// paragraph nor starts with a heading or source line, and its first section is the numbered continuation).
function stream(bookPages) {
  const out = [];
  let previous = null;
  for (const bookPage of bookPages) {
    const record = readJson(new URL(`page-${bookPage}.json`, RAW_DIR));
    if (![3, 4].includes(record.quality)) throw new Error(`page ${bookPage} is "${record.status}" — only proofread or validated pages are imported`);
    const blocks = pageBlocks(record).map(block => ({ ...block, page: bookPage }));
    const first = blocks[0];
    const last = out.at(-1);
    if (previous === bookPage - 2 && last?.kind === 'text' && last.bare && first?.kind === 'text') {
      const opening = (record.wikitext.match(/#קטע:[^|]+\|([^}]+)\}\}/) || [])[1] || '';
      if (!/ ([2-9])$/.test(opening.trim())) throw new Error(`page ${bookPage}: joins the previous page but its first section is "${opening}"`);
      last.text = `${last.text} ${first.text}`; last.bare = first.bare; last.pages = [...(last.pages || [last.page]), bookPage];
      change(bookPage, 'paragraph joined across the page break', `${plain(first.text).split(' ').slice(0, 4).join(' ')}…`);
      blocks.shift();
    }
    out.push(...blocks.filter(block => block.kind !== 'newParagraph'));
    previous = bookPage;
  }
  return out;
}

function cut(blocks, start, end, label) {
  const from = start ? blocks.findIndex(block => start.test(plain(block.text))) : 0;
  if (from < 0) throw new Error(`${label}: start not found ${start}`);
  const to = end ? blocks.findIndex((block, i) => i >= from && end.test(plain(block.text))) : blocks.length - 1;
  if (to < 0) throw new Error(`${label}: end not found ${end}`);
  return blocks.slice(from, to + 1);
}

const range = (a, b) => Array.from({ length: (b - a) / 2 + 1 }, (_, i) => a + i * 2);
const GROUPS = [
  { title: 'Kabbalat Shabbat', heTitle: 'קַבָּלַת שַׁבָּת' },
  { title: 'Shabbat Shacharit', heTitle: 'שַׁחֲרִית לְשַׁבָּת וְיוֹם טוֹב' },
  { title: 'Shabbat Mincha', heTitle: 'מִנְחָה לְשַׁבָּת וְיוֹם טוֹב' },
  { title: 'Pirkei Avot', heTitle: 'פִּרְקֵי אָבוֹת' },
  { title: 'Motzaei Shabbat', heTitle: 'לְמוֹצָאֵי שַׁבָּת' },
];
const CHAPTERS = ['רִאשׁוֹן', 'שֵׁנִי', 'שְׁלִישִׁי', 'רְבִיעִי', 'חֲמִישִׁי', 'שִׁשִּׁי'];

function buildLeaves() {
  const leaves = [];
  const add = (group, title, heTitle, blocks, notImported = []) => leaves.push({ group, title, heTitle, blocks, notImported });
  const shabbatEve = stream([251, 253, 255]);
  add('Kabbalat Shabbat', 'Bameh Madlikin', 'בַּמֶּה מַדְלִיקִין', cut(shabbatEve, /^אין אומרים "במה מדליקין"/, /^ז\. שלשה דברים/, 'bameh'));
  add('Kabbalat Shabbat', 'Amar Rabbi Elazar', 'אָמַר רַבִּי אֶלְעָזָר', cut(shabbatEve, /^מסכת ברכות/, /יברך את עמו בשלום\.$/, 'rabbi elazar'));
  const torah = stream([367]);
  add('Shabbat Shacharit', 'Torah Service, Al HaKol', 'עַל הַכֹּל · אָב הָרַחֲמִים הוּא יְרַחֵם', cut(torah, /^על הכל יתגדל/, /^אב הרחמים, הוא ירחם/, 'al hakol'));
  const mincha = stream(range(467, 475));
  add('Shabbat Mincha', 'Shir HaMaalot', 'שִׁיר הַמַּעֲלוֹת (תְּהִלִּים קכ–קלד)', cut(mincha, /^תהלים קכ$/, null, 'shir hamaalot'));
  // Pirkei Avot: one leaf per chapter, from its heading (the first chapter with the direction and the כל ישראל
  // printed before its heading) to the next heading; the headings become the leaves' titles.
  const avot = stream(range(477, 533));
  if (avot[0].kind !== 'title') throw new Error('avot: title expected');
  const headings = avot.map((block, i) => (block.kind === 'heading' ? i : -1)).filter(i => i >= 0);
  if (headings.length !== 6) throw new Error(`avot: ${headings.length} chapter headings`);
  headings.forEach((at, k) => {
    if (plain(avot[at].text) !== plain(`פֶּרֶק ${CHAPTERS[k]}`)) throw new Error(`avot: heading ${avot[at].text}`);
    const from = k === 0 ? 1 : at + 1;
    const blocks = avot.slice(from, headings[k + 1] ?? avot.length).filter(block => block.kind !== 'heading');
    add('Pirkei Avot', `Chapter ${k + 1}`, `פֶּֽרֶק ${CHAPTERS[k]}`, blocks);
  });
  const motzaei = stream(range(541, 549));
  add('Motzaei Shabbat', 'Veyiten Lecha', 'וְיִתֶּן לְךָ', cut(motzaei, /^ויתן לך האלהים/, null, 'veyiten lecha'));
  return leaves;
}

// ---------------------------------------------------------------------------------------------------------------
// The Wikisource editors' textual notes ({{נוסח|shown|…|בירנבוים=printed}}) inside the sections the pages transclude:
// every place where the transcription records a reading other than the one shown, and what Birnbaum printed.
function templateEnd(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text.startsWith('{{', i)) { depth++; i++; continue; }
    if (text.startsWith('}}', i)) { depth--; i++; if (depth === 0) return i + 1; }
  }
  return text.length;
}
function variantsIn(wikitext) {
  const out = [];
  let at = wikitext.indexOf('{{נוסח|');
  while (at >= 0) {
    const endAt = templateEnd(wikitext, at);
    const params = wikitext.slice(at + 2, endAt - 2).split('|').slice(1);
    const named = Object.fromEntries(params.filter(p => /^[^=]*=/.test(p) && !p.startsWith('=')).map(p => [p.slice(0, p.indexOf('=')).trim(), p.slice(p.indexOf('=') + 1).trim()]));
    const basis = params.find(p => p.startsWith('='))?.slice(1).trim() || null;
    out.push({ shown: params[0], basis, birnbaum: named['בירנבוים'] ?? named['בירונבוים'] ?? null, others: Object.fromEntries(Object.entries(named).filter(([k]) => !/^בירו?נבוים$/.test(k))), positional: params.slice(1).filter(p => !p.includes('=')) });
    at = wikitext.indexOf('{{נוסח|', endAt);
  }
  return out;
}
function sectionText(base, name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`<קטע התחלה=${esc}/>([\\s\\S]*?)<קטע סוף=${esc}/>`).exec(base.wikitext);
  return m ? m[1] : '';
}

// ---------------------------------------------------------------------------------------------------------------
// Output
function build() {
  const bases = Object.fromEntries(readdirSync(RAW_DIR).filter(name => name.startsWith('base-')).map(name => readJson(new URL(name, RAW_DIR))).map(b => [b.title, b]));
  const status = readJson(new URL('status.json', RAW_DIR));
  const index = readJson(new URL('index.json', RAW_DIR));
  const records = Object.fromEntries(PAGES.map(bookPage => [bookPage, readJson(new URL(`page-${bookPage}.json`, RAW_DIR))]));
  const leaves = buildLeaves();
  const versionTitle = 'HaSiddur HaShalem (Paltiel Birnbaum, 1949), Hebrew Wikisource page transcription';
  const refOf = leaf => `${INDEX}, ${leaf.group}, ${leaf.title}`;
  const heRefOf = leaf => `${HE_INDEX}, ${GROUPS.find(g => g.title === leaf.group).heTitle}, ${leaf.heTitle}`;
  const pageSource = bookPage => ({ bookPage, url: records[bookPage].url, revid: records[bookPage].revid, status: records[bookPage].status });
  const texts = {};
  for (const leaf of leaves) {
    const ref = refOf(leaf);
    const pages = [...new Set(leaf.blocks.flatMap(block => block.pages || [block.page]))].sort((a, b) => a - b);
    texts[ref] = {
      ref, heRef: heRefOf(leaf), he: leaf.blocks.map(markupOf), versionTitle, license: LICENSE,
      heVersionTitle: versionTitle, heVersionSource: records[pages[0]].url, heLicense: LICENSE,
      // Each leaf carries its own source: the printed pages, their Wikisource revision and proofreading status.
      pages: pages.map(pageSource),
    };
  }
  const nodes = GROUPS.map(group => ({
    title: group.title, heTitle: group.heTitle, key: group.title,
    titles: [{ text: group.title, lang: 'en', primary: true }, { text: group.heTitle, lang: 'he', primary: true }],
    nodes: leaves.filter(leaf => leaf.group === group.title).map(leaf => ({ depth: 1, title: leaf.title, heTitle: leaf.heTitle, key: leaf.title, titles: [{ text: leaf.title, lang: 'en', primary: true }, { text: leaf.heTitle, lang: 'he', primary: true }] })),
  }));
  const source = {
    index: INDEX, heTitle: HE_INDEX, nusach: 'ashkenaz', edition: 'birnbaum-1949',
    work: 'הַסִּדּוּר הַשָּׁלֵם (Daily Prayer Book: Ha-Siddur ha-Shalem)', editor: 'Paltiel (Philip) Birnbaum', publisher: 'Hebrew Publishing Company, New York', year: 1949,
    provider: 'Hebrew Wikisource (he.wikisource.org), Page: namespace transcription', url: index.url, indexRevid: index.revid, accessedAt: ACCESSED,
    license: LICENSE, licenseUrl: LICENSE_URL, attributionRequired: true, shareAlike: true, attribution: ATTRIBUTION,
    underlyingWork: 'The 1949 book is in the public domain in the United States (copyright not renewed).',
    modified: true,
    changes: 'Markup only: page furniture removed, paragraphs joined across page breaks, directions marked as small print; the words, points and punctuation are the transcription\'s (which itself follows Birnbaum except where the Wikisource editors record otherwise — see sources/birnbaum-ashkenaz/provenance.json "variants").',
    provenance: 'sources/birnbaum-ashkenaz/provenance.json',
  };
  const header = `// Generated by scripts/build-birnbaum-ashkenaz.mjs from the Hebrew Wikisource page transcription of Paltiel Birnbaum's\n// HaSiddur HaShalem (1949, Nusach Ashkenaz) — do not edit by hand. Licence: ${LICENSE} (${LICENSE_URL}); attribution:\n// ${ATTRIBUTION}. Share-alike applies to this file. Provenance per page: sources/birnbaum-ashkenaz/provenance.json.\n`;
  writeFileSync(OUT, `${header}export default ${JSON.stringify({ source, schema: { nodes }, texts })};\n`);

  // Provenance: page → URL, revision, status, the leaves that use it, what on it was not imported.
  const used = new Map();
  for (const [ref, text] of Object.entries(texts)) for (const p of text.pages) used.set(p.bookPage, [...(used.get(p.bookPage) || []), ref]);
  const importedPlain = new Map();
  for (const leaf of leaves) for (const block of leaf.blocks) for (const p of block.pages || [block.page]) importedPlain.set(p, `${importedPlain.get(p) || ''} ${plain(block.text)}`);
  const pages = PAGES.map(bookPage => {
    const record = records[bookPage];
    const imported = importedPlain.get(bookPage) || '';
    const notImported = pageBlocks(record).filter(block => block.text && !imported.includes(plain(block.text).slice(0, 40))).map(block => `${block.kind}: ${plain(block.text).slice(0, 60)}`);
    const sections = [...record.wikitext.matchAll(/\{\{#קטע:([^|]+)\|([^}]+)\}\}/g)].map(m => ({ base: m[1], name: m[2] }));
    const variants = sections.flatMap(section => variantsIn(bases[section.base] ? sectionText(bases[section.base], section.name) : '').map(v => ({ section: section.name, ...v })))
      .concat(variantsIn(record.wikitext).map(v => ({ section: '(page)', ...v })))
      .map(v => ({ ...v, inImportedText: imported.includes(plain(v.shown)) && plain(v.shown).length > 1 }));
    return {
      bookPage, filePage: record.filePage, title: record.title, url: record.url, oldidUrl: record.oldidUrl, revid: record.revid, timestamp: record.timestamp,
      status: record.status, quality: record.quality, transcludes: record.transcludes, usedIn: used.get(bookPage) || [], notImported, variants,
    };
  });
  const counts = {};
  for (const page of Object.values(status.pages)) counts[page.status] = (counts[page.status] || 0) + 1;
  const provenance = {
    work: source.work, editor: source.editor, publisher: source.publisher, year: source.year, nusach: 'Ashkenaz',
    license: LICENSE, licenseUrl: LICENSE_URL, attributionRequired: true, shareAlike: true, attribution: ATTRIBUTION,
    underlyingWork: source.underlyingWork, accessedAt: ACCESSED, modified: true, modifications: source.changes,
    index: { title: index.title, url: index.url, revid: index.revid, oldidUrl: oldidUrl(index.revid) },
    bookStatus: { pages: Object.keys(status.pages).length, byStatus: counts, note: 'All Hebrew (odd) printed pages are proofread or validated; the "without text" pages are the English facing pages.' },
    notUsed: 'Wikisource\'s assembled edition (הסידור השלם (בירנבוים)/אשכנז) — adapted: translated directions, Land of Israel customs, textual "improvements".',
    basePages: Object.values(bases).map(b => ({ title: b.title, url: b.url, revid: b.revid, oldidUrl: b.oldidUrl })),
    pack: 'src/data/nusach/siddurAshkenazBirnbaum.mjs',
    leaves: Object.values(texts).map(text => ({ ref: text.ref, heRef: text.heRef, paragraphs: text.he.length, pages: text.pages.map(p => p.bookPage) })),
    pages,
  };
  writeJson(PROVENANCE, provenance);
  const uniqueChanges = [...new Map(changes.map(c => [JSON.stringify(c), c])).values()];
  if (option('report')) writeJson(new URL(option('report'), `file://${process.cwd()}/`), { changes: uniqueChanges, variants: pages.flatMap(p => p.variants.filter(v => v.inImportedText).map(v => ({ page: p.bookPage, ...v }))) });
  console.log(`${Object.keys(texts).length} leaves, ${Object.values(texts).reduce((n, t) => n + t.he.length, 0)} paragraphs from ${PAGES.length} pages → ${OUT.pathname}`);
}

build();
