// Builds the offline Shabbat zemirot pack (זמירות לשבת) from Hebrew Wikisource.
//   node scripts/build-zemirot.mjs --fetch     download each page's wikitext into sources/wikisource-zemirot/ (once)
//   node scripts/build-zemirot.mjs             parse the cached wikitext offline and write src/data/liturgy/zemirot.mjs
//   node scripts/build-zemirot.mjs --report <file.json>   also write the per-item transformation counts
//
// Licence: the text comes only from Hebrew Wikisource (CC BY-SA 4.0, attribution "ויקיטקסט העברי"); the poems
// themselves are public domain. Daat and Hamichlol were used only as an index of which zemirot exist and when they
// are sung; no text was taken from them. Provenance: sources/wikisource-zemirot/README.md, docs/siddur/zemirot-import.md.
//
// Deterministic: the parse stage reads only the cache and always writes the same bytes. --fetch pins every page to
// the revision recorded in sources/wikisource-zemirot/manifest.json when one is there, so a re-fetch is identical.
// The words and their nikud are never edited: the parser only removes wiki furniture (templates, links, footnotes,
// verse sources, headers, direction marks) and turns layout (line/stanza breaks, table rows, acrostic letters,
// refrains, alternative readings) into <br>, paragraphs, <b> and <small>.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const SRC_DIR = new URL('sources/wikisource-zemirot/', ROOT);
const MANIFEST = new URL('manifest.json', SRC_DIR);
const OUT = new URL('src/data/liturgy/zemirot.mjs', ROOT);
const API = 'https://he.wikisource.org/w/api.php';
const UA = 'KazzoharSiddurBuilder/1.0 (offline siddur zemirot import; Node.js fetch)';
const ACCESSED = '2026-09-28';
const INDEX_TITLE = 'זמירות לשבת';
const pageUrl = title => `https://he.wikisource.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const option = name => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : null);

// ---------------------------------------------------------------------------------------------------------------
// Pages. `file` is the cache name; `title` is the title requested (redirects are followed and recorded).
const PAGES = [
  { file: 'index', title: INDEX_TITLE },
  { file: 'shalom-aleichem', title: 'שלום עליכם מלאכי השרת' },
  { file: 'ribon-kol-haolamim', title: 'ריבון כל העולמים' },
  { file: 'eshet-chayil', title: 'אשת חיל (זמר)' },
  { file: 'atkinu', title: 'אתקינו סעודתא' },
  { file: 'azamer-bishvachin', title: 'אזמר בשבחין' },
  { file: 'kol-mekadesh', title: 'כל מקדש שביעי' },
  { file: 'menucha-vesimcha', title: 'מנוחה ושמחה' },
  { file: 'ma-yedidut', title: 'מה ידידות' },
  { file: 'ashir-lael', title: 'אשיר לאל' },
  { file: 'ma-yafit', title: 'מה יפית' },
  { file: 'yom-shabbat-kodesh-hu', title: 'יום שבת קדש הוא' },
  { file: 'yah-ribon', title: 'יה ריבון' },
  { file: 'tzur-mishelo', title: 'צור משלו' },
  { file: 'yom-ze-leyisrael', title: 'יום זה לישראל' },
  { file: 'yah-echsof', title: 'י-ה אכסוף' },
  { file: 'asader-lisudata', title: 'אסדר לסעודתא' },
  { file: 'chai-hashem', title: "חי ה'" },
  { file: 'baruch-hashem-yom-yom', title: "ברוך ה' יום יום" },
  { file: 'baruch-el-elyon', title: 'ברוך אל עליון' },
  { file: 'yom-ze-mechubad', title: 'יום זה מכובד' },
  { file: 'yom-shabbaton', title: 'יום שבתון' },
  { file: 'ki-eshmera', title: 'כי אשמרה שבת' },
  { file: 'shimru-shabtotai', title: 'שמרו שבתותי' },
  { file: 'dror-yikra', title: 'דרור יקרא' },
  { file: 'shabbat-hayom-lashem', title: "שבת היום לה'" },
  { file: 'yom-hashabbat-ein-kamohu', title: 'יום השבת אין כמוהו' },
  { file: 'al-ahavatcha', title: 'על אהבתך' },
  { file: 'tzama-nafshi', title: 'צמאה נפשי' },
  { file: 'bnei-heichala', title: 'בני היכלא' },
  { file: 'tehillim-23', title: 'תהלים כג/ניקוד' },
  { file: 'yedid-nefesh', title: 'ידיד נפש' },
  { file: 'el-mistater', title: 'אל מסתתר' },
  { file: 'hamavdil', title: 'המבדיל בין קודש לחול' },
  { file: 'eliyahu-hanavi', title: 'אליהו הנביא' },
  { file: 'melave-malka', title: 'זמירות למלווה מלכה' },
  { file: 'bemotzaei-yom-menucha', title: 'במוצאי יום מנוחה' },
  { file: 'chadesh-sasoni', title: 'חדש ששוני' },
  { file: 'agil-veesmach', title: 'אגיל ואשמח' },
  { file: 'elokim-yisadenu', title: 'אלהים יסעדנו' },
  { file: 'eli-chish-goali', title: 'אלי חיש גואלי' },
  { file: 'adir-ayom-venora', title: 'אדיר איום ונורא' },
  { file: 'ish-chasid', title: 'איש חסיד' },
  { file: 'amar-hashem-leyaakov', title: "אמר ה' ליעקב" },
  { file: 'ribon-haolamim-motzash', title: 'רבון העולמים למוצאי שבת' },
  // Listed by the Daat index (not by the Wikisource index page), present on Wikisource:
  { file: 'bar-yochai', title: 'בר יוחאי' },
  { file: 'beyom-shabbat-ashabeach', title: 'ביום שבת אשבח' },
  { file: 'el-eliyahu', title: 'אל אליהו' },
  { file: 'laner-velivsamim', title: 'לנר ולבשמים' },
  { file: 'al-bayit-ze', title: 'על בית זה ויושביהו' },
];

// ---------------------------------------------------------------------------------------------------------------
// Items, grouped and ordered as in the Wikisource index page (זמירות לשבת); the index's "כללי" entries (יה ריבון,
// צמאה נפשי) are placed where the Daat/Hamichlol indexes put them. Extraction options:
//   section      take the text under this == heading == (to the next heading)
//   kta          take the <קטע התחלה=X/>…<קטע סוף=X/> fragments (each fragment becomes a paragraph if ktaParagraphs)
//   drop kta     remove these named fragments (verse numbers)
//   tableCols    keep only these table columns (0-based)
//   skipRows     drop table rows whose text includes this string (a header row)
//   rowsAsParagraphs / linesAsParagraphs   each table row / each source line is a stanza of its own
//   blankLineIsBreak   one blank line is a line break, two or more are a stanza break
//   keepNotes    keep whole-line {{ק|…}} notes (as <small>) instead of dropping them
//   hiddenLabel  the page's own heading for a {{נוסחי תפילה מוסתר}} block, shown before it in <small>
//   smallPrefix  a leading instruction printed in <small>
//   splitBefore  start a new paragraph before this text (the meal-specific part of אתקינו)
//   dropText     exact source strings removed before parsing (a verse citation printed inside the poem)
// author: only when the Wikisource page states it (header, author link or author category) — see the doc.
const GROUPS = [
  {
    key: 'friday-night', title: 'ליל שבת',
    items: [
      { id: 'shalom-aleichem', page: 'shalom-aleichem', title: 'שלום עליכם', keepNotes: true },
      { id: 'ribon-kol-haolamim', page: 'ribon-kol-haolamim', title: 'ריבון כל העולמים' },
      { id: 'eshet-chayil', page: 'eshet-chayil', title: 'אשת חיל', section: 'השיר מעוצב לפי צורתו הספרותית', rowsAsParagraphs: true },
      { id: 'atkinu-leil-shabbat', page: 'atkinu', title: 'אתקינו סעודתא', kta: 'ליל שבת', ktaParagraphs: true, author: 'האר"י' },
      { id: 'azamer-bishvachin', page: 'azamer-bishvachin', title: 'אזמר בשבחין', kta: 'אזמר בשבחין מנוקד', author: 'האר"י' },
      { id: 'kol-mekadesh', page: 'kol-mekadesh', title: 'כל מקדש שביעי', author: 'משה בן קלונימוס' },
      { id: 'menucha-vesimcha', page: 'menucha-vesimcha', title: 'מנוחה ושמחה' },
      { id: 'ma-yedidut', page: 'ma-yedidut', title: 'מה ידידות' },
      { id: 'ashir-lael', page: 'ashir-lael', title: 'אשיר לאל אשר שבת' },
      { id: 'ma-yafit', page: 'ma-yafit', title: 'מה יפית' },
      { id: 'yom-shabbat-kodesh-hu', page: 'yom-shabbat-kodesh-hu', title: 'יום שבת קדש הוא' },
      { id: 'yah-ribon', page: 'yah-ribon', title: 'יה ריבון', tableCols: [0], skipRows: "'''הפיוט'''", author: "רבי ישראל נג'ארה" },
      { id: 'tzur-mishelo', page: 'tzur-mishelo', title: 'צור משלו', section: 'מנוקד' },
      { id: 'yom-ze-leyisrael', page: 'yom-ze-leyisrael', title: 'יום זה לישראל' },
      { id: 'yah-echsof', page: 'yah-echsof', title: 'יה אכסוף', section: 'יה אכסוף' },
      { id: 'bar-yochai', page: 'bar-yochai', title: 'בר יוחאי', dropText: ['<small>(פסוקים טו-טז)</small>'], author: 'רבי שמעון לביא' },
    ],
  },
  {
    key: 'shabbat-day', title: 'יום שבת',
    items: [
      { id: 'atkinu-yom-shabbat', page: 'atkinu', title: 'אתקינו סעודתא', kta: 'יום שבת', ktaParagraphs: true, author: 'האר"י' },
      { id: 'asader-lisudata', page: 'asader-lisudata', title: 'אסדר לסעודתא', linesAsParagraphs: true, author: 'האר"י' },
      { id: 'chai-hashem', page: 'chai-hashem', title: "חי ה'" },
      { id: 'baruch-hashem-yom-yom', page: 'baruch-hashem-yom-yom', title: "ברוך ה' יום יום", author: 'רבי שמעון הגדול' },
      { id: 'baruch-el-elyon', page: 'baruch-el-elyon', title: 'ברוך אל עליון', author: 'רבי ברוך בר שמואל ממגנצא' },
      { id: 'yom-ze-mechubad', page: 'yom-ze-mechubad', title: 'יום זה מכובד' },
      { id: 'yom-shabbaton', page: 'yom-shabbaton', title: 'יום שבתון', author: 'רבי יהודה הלוי' },
      { id: 'ki-eshmera', page: 'ki-eshmera', title: 'כי אשמרה שבת', author: 'רבי אברהם אבן עזרא' },
      { id: 'shimru-shabtotai', page: 'shimru-shabtotai', title: 'שמרו שבתותי', author: 'רבי שלמה אבן גבירול' },
      { id: 'dror-yikra', page: 'dror-yikra', title: 'דרור יקרא', section: 'דרור יקרא', author: 'דונש בן לברט' },
      { id: 'shabbat-hayom-lashem', page: 'shabbat-hayom-lashem', title: "שבת היום לה'" },
      { id: 'beyom-shabbat-ashabeach', page: 'beyom-shabbat-ashabeach', title: 'ביום שבת אשבח', author: 'רבי שלום שבזי' },
      { id: 'yom-hashabbat-ein-kamohu', page: 'yom-hashabbat-ein-kamohu', title: 'יום השבת אין כמוהו', section: 'הפיוט ללא ביאור', blankLineIsBreak: true },
      { id: 'al-ahavatcha', page: 'al-ahavatcha', title: 'על אהבתך', author: 'רבי יהודה הלוי' },
      { id: 'tzama-nafshi', page: 'tzama-nafshi', title: 'צמאה נפשי', kta: 'א', author: 'רבי אברהם אבן עזרא' },
    ],
  },
  {
    key: 'seudah-shlishit', title: 'סעודה שלישית',
    items: [
      { id: 'atkinu-seudah-shlishit', page: 'atkinu', title: 'אתקינו סעודתא', kta: 'סעודה שלישית', ktaParagraphs: true, author: 'האר"י' },
      { id: 'bnei-heichala', page: 'bnei-heichala', title: 'בני היכלא', section: 'בני היכלא', rowsAsParagraphs: true, author: 'האר"י' },
      { id: 'mizmor-ledavid', page: 'tehillim-23', title: 'מזמור לדוד', kta: 'פרק כג', dropKta: ['סימן'] },
      { id: 'yedid-nefesh', page: 'yedid-nefesh', title: 'ידיד נפש', kta: 'נוסח ב', author: 'רבי אלעזר אזכרי' },
      { id: 'el-mistater', page: 'el-mistater', title: 'אל מסתתר' },
    ],
  },
  {
    key: 'motzaei-shabbat', title: 'מוצאי שבת ומלווה מלכה',
    items: [
      { id: 'hamavdil', page: 'hamavdil', title: 'המבדיל בין קודש לחול', hiddenLabel: 'בסידורי עדות המזרח נוסף:' },
      { id: 'eliyahu-hanavi', page: 'eliyahu-hanavi', title: 'אליהו הנביא' },
      { id: 'atkinu-melave-malka', page: 'melave-malka', title: 'אתקינו סעודתא', section: 'אתקינו סעודתא', smallPrefix: 'ג”פ:', splitBefore: 'דָּא הִיא', author: 'האר"י' },
      { id: 'bemotzaei-yom-menucha', page: 'bemotzaei-yom-menucha', title: 'במוצאי יום מנוחה' },
      { id: 'el-eliyahu', page: 'el-eliyahu', title: 'אל אליהו' },
      { id: 'laner-velivsamim', page: 'laner-velivsamim', title: 'לנר ולבשמים', linesAsParagraphs: true, author: 'רבי סעדיה משתא' },
      { id: 'chadesh-sasoni', page: 'chadesh-sasoni', title: 'חדש ששוני' },
      { id: 'agil-veesmach', page: 'agil-veesmach', title: 'אגיל ואשמח' },
      { id: 'elokim-yisadenu', page: 'elokim-yisadenu', title: 'אלהים יסעדנו' },
      { id: 'eli-chish-goali', page: 'eli-chish-goali', title: 'אלי חיש גואלי' },
      { id: 'adir-ayom-venora', page: 'adir-ayom-venora', title: 'אדיר איום ונורא' },
      { id: 'ish-chasid', page: 'ish-chasid', title: 'איש חסיד', linesAsParagraphs: true },
      { id: 'amar-hashem-leyaakov', page: 'amar-hashem-leyaakov', title: "אמר ה' ליעקב", rowsAsParagraphs: true },
      { id: 'al-bayit-ze', page: 'al-bayit-ze', title: 'על בית זה', author: 'רבי יוסף חיים מבגדד' },
      { id: 'ribon-haolamim-motzaei-shabbat', page: 'ribon-haolamim-motzash', title: 'רבון העולמים' },
    ],
  },
];

// ---------------------------------------------------------------------------------------------------------------
// Fetch stage
async function apiGet(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
    if (res.ok) return res.json();
    if (attempt >= 4) throw new Error(`${res.status} for ${url}`);
    await new Promise(r => setTimeout(r, 1500 * attempt));
  }
}

async function fetchAll() {
  mkdirSync(SRC_DIR, { recursive: true });
  const old = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { pages: {} };
  const manifest = { accessedAt: ACCESSED, api: API, license: 'CC BY-SA 4.0', attribution: 'ויקיטקסט העברי', pages: {} };
  for (const page of PAGES) {
    const pinned = old.pages?.[page.file]?.revid;
    const params = { action: 'query', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main' };
    const data = await apiGet(pinned ? { ...params, revids: String(pinned) } : { ...params, titles: page.title, redirects: '1' });
    const p = data.query.pages[0];
    if (!p || p.missing || !p.revisions) throw new Error(`missing page: ${page.title}`);
    const rev = p.revisions[0];
    writeFileSync(new URL(`${page.file}.wiki`, SRC_DIR), rev.slots.main.content);
    manifest.pages[page.file] = {
      requested: page.title, title: p.title, pageid: p.pageid, revid: rev.revid, timestamp: rev.timestamp,
      url: pageUrl(p.title), oldidUrl: `https://he.wikisource.org/w/index.php?oldid=${rev.revid}`,
    };
    console.log(`${page.file}: ${p.title} @ ${rev.revid}`);
    await new Promise(r => setTimeout(r, 300));
  }
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
}

// ---------------------------------------------------------------------------------------------------------------
// Parse stage: a small brace-matching template expander.
const BR = '\u0001'; // line break inside a stanza
const PB = '\u0002'; // stanza (paragraph) break
const GONE = '\u0008'; // where a dropped template stood (a space left before punctuation is closed up)
const OPEN_B = '\u0003', CLOSE_B = '\u0004', OPEN_S = '\u0005', CLOSE_S = '\u0006'; // <b> </b> <small> </small>

function findClose(text, start) { // start at "{{"; returns index after the matching "}}"
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text.startsWith('{{', i)) { depth++; i++; continue; }
    if (text.startsWith('}}', i)) { depth--; i++; if (depth === 0) return i + 1; }
  }
  throw new Error(`unbalanced template at ${JSON.stringify(text.slice(start, start + 60))}`);
}

function splitParams(inner) { // split on top-level "|" (not inside {{ }} or [[ ]])
  const parts = []; let depth = 0, link = 0, cur = '';
  for (let i = 0; i < inner.length; i++) {
    if (inner.startsWith('{{', i)) { depth++; cur += '{{'; i++; continue; }
    if (inner.startsWith('}}', i)) { depth--; cur += '}}'; i++; continue; }
    if (inner.startsWith('[[', i)) { link++; cur += '[['; i++; continue; }
    if (inner.startsWith(']]', i)) { link--; cur += ']]'; i++; continue; }
    if (inner[i] === '|' && depth === 0 && link === 0) { parts.push(cur); cur = ''; continue; }
    cur += inner[i];
  }
  parts.push(cur);
  const positional = []; const named = {};
  for (const part of parts.slice(1)) {
    const m = part.match(/^\s*([^=|{}\[\]<>]{1,15}?)\s*=([\s\S]*)$/);
    if (m) named[m[1]] = m[2];
    else positional.push(part);
  }
  return { name: parts[0].trim(), positional, named };
}

const NUSACH_LABELS = [ // order and labels of תבנית:נוסחי תפילה קצרים when no nusach is chosen
  ['אשכנז', 'נוסח אשכנז:'], ['אשכנזים', 'נוסח אשכנזים:'], ['מזרחי', 'נוסח אשכנז המזרחי:'], ['מערבי', 'נוסח אשכנז המערבי:'],
  ['ספרד', 'נוסח ספרד:'], ['מזרח', 'נוסח עדות המזרח:'], ['מרוקו', 'נוסח מרוקו:'], ['תימן', 'נוסח תימן:'],
  ['בלדי', 'נוסח תימן בלדי:'], ['שאמי', 'נוסח תימן שאמי:'], ['איטליה', 'נוסח איטליה:'], ['חבד', 'נוסח חב"ד:'], ['אתיופיה', 'נוסח אתיופיה:'],
];
const DROP = new Set(['הור', 'הור2', 'ממס', 'הערה', 'טקסט מנוקד', 'סוף', 'ס', 'רווח', 'רווח קשיח', 'רווחים', 'פפ', 'מ:פסוק',
  'הערות שוליים', 'קישור לשיר', 'מקור', 'רקע אפור', 'מיזמים', 'ויקיפדיה', 'אפור מוקטן']);
const UNWRAP = new Set(['צמל', 'מילת קבע', 'גלגל-2', 'עם-ניקוד', 'שיר מנוקד']);
const BOLD = new Set(['סי', 'אקרוסטיכון', 'מודגש']);

function expand(text, ctx) {
  let out = '';
  for (let i = 0; i < text.length;) {
    if (text.startsWith('{{', i)) {
      const end = findClose(text, i);
      out += template(text.slice(i + 2, end - 2), ctx);
      i = end;
    } else out += text[i++];
  }
  return out;
}

function template(inner, ctx) {
  const { name, positional, named } = splitParams(inner);
  const arg = n => expand(positional[n] ?? '', ctx);
  const count = key => { ctx.counts[key] = (ctx.counts[key] ?? 0) + 1; };
  if (name.startsWith('#קטע:') || name.startsWith('#')) { count(`dropped {{${name.split(':')[0]}}}`); return ''; }
  if (name.startsWith(':')) throw new Error(`transclusion {{${name}}} is not supported`);
  if (DROP.has(name)) { count(`dropped {{${name}}}`); return GONE; }
  if (name === 'ש' || name === 'ר1' || name === 'ר2') { count(`{{${name}}} → line break`); return BR; }
  if (BOLD.has(name)) { count(`{{${name}}} → <b>`); return `${OPEN_B}${arg(0)}${CLOSE_B}`; }
  if (UNWRAP.has(name)) { count(`{{${name}}} → text`); return arg(0); }
  if (name === 'צ') { count('{{צ}} → quoted text'); return `"${expand(named['תוכן'] ?? positional[0] ?? '', ctx)}"`; }
  if (name === 'ק' || name === 'קטן') { count(`{{${name}}} → <small>`); return `${OPEN_S}${expand(named['קטן'] ?? positional[0] ?? '', ctx)}${CLOSE_S}`; }
  if (name === 'נוא') { count('{{נוא}} → <small>[נ"א: …]</small>'); return `${OPEN_S}[נ"א: ${arg(0)}]${CLOSE_S}`; }
  if (name === 'רפרן') {
    count('{{רפרן}} → refrain stanza');
    return `${PB}${positional.map((_, n) => arg(n).trim()).filter(Boolean).join(BR)}\u0007`;
  }
  if (name === 'רן') { count('{{רן}} → lines'); return arg(0); }
  if (name === 'נוסחי תפילה קצרים') {
    count('{{נוסחי תפילה קצרים}} → all variants, labelled');
    return NUSACH_LABELS.filter(([k]) => named[k]).map(([k, label]) => `${OPEN_S}${label}${CLOSE_S} ${expand(named[k], ctx)}`).join(' ');
  }
  if (name === 'נוסחי תפילה מוסתר') {
    count('{{נוסחי תפילה מוסתר}} → shown, under the page\'s own heading');
    const body = NUSACH_LABELS.filter(([k]) => named[k]).map(([k]) => expand(named[k], ctx)).join(PB);
    return `${PB}${ctx.item.hiddenLabel ? `${OPEN_S}${ctx.item.hiddenLabel}${CLOSE_S}${PB}` : ''}${body}${PB}`;
  }
  throw new Error(`unknown template {{${name}}} in ${ctx.item.id}`);
}

function stripNoinclude(text) {
  let out = text.replace(/<noinclude>[\s\S]*?<\/noinclude>/g, '');
  const open = out.indexOf('<noinclude>');
  if (open >= 0) out = out.slice(0, open); // unclosed: runs to the end of the page
  return out;
}

function takeSection(text, heading) {
  const lines = text.split('\n');
  const start = lines.findIndex(l => { const m = l.match(/^(=+)\s*(.*?)\s*\1\s*$/); return m && m[2].replace(/\s*\/.*$/, '') === heading; });
  if (start < 0) throw new Error(`no section "${heading}"`);
  const level = lines[start].match(/^=+/)[0].length;
  let end = lines.findIndex((l, i) => i > start && /^(=+)[^=].*\1\s*$/.test(l) && l.match(/^=+/)[0].length <= level);
  if (end < 0) end = lines.length;
  return lines.slice(start + 1, end).join('\n');
}

function takeKta(text, name) {
  const re = new RegExp(`<קטע התחלה=${name}\\s*/>([\\s\\S]*?)<קטע סוף=${name}\\s*/>`, 'g');
  const parts = [...text.matchAll(re)].map(m => m[1]);
  if (!parts.length) throw new Error(`no fragment "${name}"`);
  return parts;
}

function dropUnmatchedBraces(text, onDrop) { // a <קטע> fragment may start inside {{…| or end before its }}
  let out = '', depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith('{{', i)) { depth++; out += '{{'; i++; continue; }
    if (text.startsWith('}}', i)) { if (depth === 0) { onDrop(); i++; continue; } depth--; out += '}}'; i++; continue; }
    out += text[i];
  }
  if (depth) throw new Error('unclosed template inside a fragment');
  return out;
}

function tables(text, item, ctx) { // wiki tables → lines; empty rows → stanza breaks
  return text.replace(/^:?\{\|[^\n]*\n([\s\S]*?)^\|\}[^\n]*$/gm, (_, body) => {
    ctx.counts['table rows → lines'] = (ctx.counts['table rows → lines'] ?? 0);
    const rows = body.split(/^\|-.*$/m).map(r => r.trim()).filter(r => r.length);
    const out = [];
    for (const row of rows) {
      if (item.skipRows && row.includes(item.skipRows)) { ctx.counts['table header row dropped'] = (ctx.counts['table header row dropped'] ?? 0) + 1; continue; }
      let cells = row.replace(/^\|/, '').split('||').map(c => c.replace(/^\s*\|/, '').trim());
      if (item.tableCols) cells = item.tableCols.map(n => cells[n] ?? '');
      const clean = cells.map(c => c.replace(/&nbsp;/g, ' ').trim()).filter(c => c && !/^\{\{(ס|רווח)\}\}$/.test(c));
      if (!clean.length) { out.push(''); continue; }
      ctx.counts['table rows → lines']++;
      out.push(clean.join(' '));
    }
    return (item.rowsAsParagraphs ? out.filter(Boolean).join('\n\n') : out.join('\n').replace(/\n\n+/g, '\n\n')) + '\n';
  });
}

function parseItem(item, wikitext) {
  const ctx = { item, counts: {} };
  const count = (key, n = 1) => { if (n) ctx.counts[key] = (ctx.counts[key] ?? 0) + n; };
  let t = wikitext.replace(/\r\n/g, '\n');
  // Region
  if (item.kta) {
    let parts = takeKta(t, item.kta);
    count(`kept fragment <קטע ${item.kta}>`, parts.length);
    for (const name of item.dropKta ?? []) parts = parts.map(p => p.replace(new RegExp(`<קטע התחלה=${name}\\s*/>[\\s\\S]*?<קטע סוף=${name}\\s*/>`, 'g'), () => { count(`dropped fragment <קטע ${name}> (verse numbers)`); return ''; }));
    t = parts.join(item.ktaParagraphs ? '\n\n' : '\n');
    t = dropUnmatchedBraces(t, () => count('dropped template brace cut by the fragment boundary'));
  } else {
    t = stripNoinclude(t);
    if (item.section) t = takeSection(t, item.section);
    else { const h = t.search(/^==.*==\s*$/m); if (h >= 0 && t.slice(0, h).trim()) t = t.slice(0, h); else if (h >= 0) throw new Error(`${item.id}: page starts with a heading; set section`); }
  }
  // Furniture
  for (const x of item.dropText ?? []) { if (!t.includes(x)) throw new Error(`${item.id}: dropText not found: ${x}`); t = t.replace(x, () => { count('dropped verse citation'); return ''; }); }
  t = t.replace(/\{\{\{[^{}|]*\|([^{}]*)\}\}\}/g, '$1'); // {{{נוסח|}}} → its default
  t = t.replace(/<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>|<references\s*\/>/g, () => { count('dropped <ref>'); return ''; });
  t = t.replace(/<\/?(noinclude|includeonly|poem|big|center)[^>]*>/g, () => { count('dropped layout tag'); return ''; });
  t = t.replace(/<\/?small>/g, () => { count('dropped raw <small> tag (text kept)'); return ''; });
  t = t.replace(/<קטע (התחלה|סוף)=[^/]*\/>/g, '');
  t = t.replace(/\[\[(קטגוריה|Category|מחבר):[^\]]*\]\]/g, () => { count('dropped category/author link'); return ''; });
  t = t.replace(/__TOC__/g, '');
  t = t.replace(/^[*#].*$/gm, () => { count('dropped list/link line'); return ''; });
  t = t.replace(/^=+.*=+\s*$/gm, () => { count('dropped heading'); return ''; });
  if (!item.keepNotes) t = t.replace(/^\{\{(ק|קטן)\|[\s\S]*?\}\}\s*$/gm, m => { count('dropped whole-line note {{ק}}'); return ''; });
  t = tables(t, item, ctx);
  t = t.replace(/'''([^'\n]+?)'''/g, (_, x) => { count("'''…''' → <b>"); return `${OPEN_B}${x}${CLOSE_B}`; });
  t = t.replace(/\[\[[^\]|]*\|([^\]]*)\]\]|\[\[([^\]]*)\]\]/g, (_, a, b) => { count('[[link]] → text'); return a ?? b; });
  t = expand(t, ctx);
  t = t.replace(/[ \t]+\u0008(?=[\u0008 \t]*(?:[:.,;]|$))/gm, () => { count('closed up the space a dropped template left before punctuation'); return ''; }).replace(/\u0008/g, '');
  t = t.replace(/&nbsp;|\u00a0|\u3000/g, ' ').replace(/&quot;/g, '"');
  t = t.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, () => { count('dropped direction mark'); return ''; });
  if (item.smallPrefix) t = t.replace(item.smallPrefix, () => { count('instruction → <small>'); return `${OPEN_S}${item.smallPrefix}${CLOSE_S}${BR}`; });
  if (item.splitBefore) t = t.replace(item.splitBefore, () => { count('stanza break before the meal-specific line'); return `${PB}${item.splitBefore}`; });
  // Layout → paragraphs of lines
  t = t.replace(/\u0007[^\n]*/g, m => `${m.slice(1)}${PB}`); // a refrain ends its source line's paragraph
  t = t.replace(/^[:;]+/gm, () => { count('dropped indentation colon'); return ''; });
  if (item.blankLineIsBreak) t = t.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, PB).replace(/\n[ \t]*\n/g, '\n');
  else t = t.replace(/\n[ \t]*\n/g, PB);
  if (item.linesAsParagraphs) t = t.replace(new RegExp(`${BR}[ \\t]*\\n|\\n|${BR}`, 'g'), PB);
  const paragraphs = t.split(PB).map(p => p
    .split(new RegExp(`${BR}|\\n`)).map(l => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean)
    .join('<br>'))
    .map(p => p.replaceAll(OPEN_B, '<b>').replaceAll(CLOSE_B, '</b>').replaceAll(OPEN_S, '<small>').replaceAll(CLOSE_S, '</small>')
      .replace(/<b>\s*<\/b>/g, '').trim())
    .filter(p => p.replace(/<[^>]+>/g, '').trim());
  return { paragraphs, counts: ctx.counts };
}

function build() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const report = {};
  const groups = GROUPS.map(group => ({
    key: group.key,
    title: group.title,
    items: group.items.map(item => {
      const meta = manifest.pages[item.page];
      const wikitext = readFileSync(new URL(`${item.page}.wiki`, SRC_DIR), 'utf8');
      const { paragraphs, counts } = parseItem(item, wikitext);
      report[item.id] = { page: meta.title, revid: meta.revid, paragraphs: paragraphs.length, transformations: counts };
      return { id: item.id, title: item.title, ...(item.author ? { author: item.author } : {}), url: meta.url, revid: meta.revid, paragraphs };
    }),
  }));
  const pack = {
    source: {
      provider: 'Hebrew Wikisource', license: 'CC BY-SA 4.0', url: pageUrl(INDEX_TITLE), accessedAt: ACCESSED,
      attribution: 'ויקיטקסט העברי',
      indexRevid: manifest.pages.index.revid,
    },
    groups,
  };
  const header = [
    '// Shabbat zemirot (זמירות לשבת), offline. Generated by scripts/build-zemirot.mjs from the wikitext cached in',
    '// sources/wikisource-zemirot/ — do not edit by hand; see docs/siddur/zemirot-import.md.',
    '// Text: Hebrew Wikisource (ויקיטקסט העברי), CC BY-SA 4.0; each item records its page URL and revision id.',
    '// Share-alike applies to this file. Markup: <br> line breaks, <b> acrostic letters, <small> notes and variants.',
  ].join('\n');
  writeFileSync(OUT, `${header}\nexport default ${JSON.stringify(pack, null, 1)};\n`);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  console.log(`wrote ${OUT.pathname} — ${total} items; ${groups.map(g => `${g.key} ${g.items.length}`).join(', ')}`);
  const reportPath = option('report');
  if (reportPath) writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

if (flag('fetch')) await fetchAll();
else build();
