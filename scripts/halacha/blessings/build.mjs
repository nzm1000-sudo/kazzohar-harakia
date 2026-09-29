// מנוע הברכות — build. Inputs (all in the repository or the app's own packs):
//   sources/ong-shabbat/blessing-table.json      the table of עונג שבת (extract_table.py, verified page by page)
//   public/library/packs/…                       the book (chapter כ״ה), the Shulchan Arukh, the Mishnah Berurah
//   src/data/yalkutYosef.mjs                     Kitzur Shulchan Arukh Yalkut Yosef
//   sources/blessings/wikidata-foods.json        Wikidata food names (fetch-wikidata.mjs, CC0)
//   sources/blessings/open-food-facts-israel.json.gz   Open Food Facts, products sold in Israel (fetch-open-food-facts.mjs, ODbL)
// Outputs:
//   src/data/blessings/bookTable.mjs             the table rows, the chapter-כ״ה items, every quoted source (verbatim)
//   public/blessings/foods.json.gz               open-data foods, each pointing to ONE rule or ONE book row
//   sources/blessings/build-report.json          counts and every food left out, with the reason
//
//   node scripts/halacha/blessings/build.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { SOURCE_SPECS, RULES, YALKUT_BESIDE, NUSACH_ROWS, DRINK_ROWS, BOOK_HALACHA_ITEMS } from '../../../src/data/blessings/rules.mjs';
import { normalizeFood } from '../../../src/services/blessingsEngine.mjs';
import { hebrewNumeral } from '../../../src/services/hebrewNumerals.mjs';
import { YALKUT_YOSEF } from '../../../src/data/yalkutYosef.mjs';
import { PRACTICAL_HALACHA_QA } from '../../../src/data/practicalHalachaQa.mjs';

const ROOT = new URL('../../../', import.meta.url).pathname;
const read = path => readFileSync(ROOT + path);
const pack = path => JSON.parse(gunzipSync(read(path)).toString('utf8'));
const stripNiqqud = text => text.replace(/[֑-ׇ]/g, '');
const sha = text => createHash('sha256').update(text).digest('hex');

// ---------------------------------------------------------------------------------------------- the texts quoted
const ONG = pack('public/library/packs/author-permission-ong-shabbat/Oneg_Shabbat.json.gz');
const SA = pack('public/library/packs/sefaria-shulchan-arukh-pd/Shulchan_Arukh__Orach_Chayim.json.gz');
const MB = pack('public/library/packs/wikisource-shulchan-arukh-commentary-cc-by-sa/Mishnah_Berurah.137-262.json.gz');
const YY = new Map(YALKUT_YOSEF.sections.map(section => [section.id, section]));
const unitOf = (work, node, n) => work.nodes.find(item => item.n === node)?.units.find(unit => unit.n === n);

// The text a source spec is cut from, exactly as the app shows it (the Shulchan Arukh without its niqqud).
export function sourceText(spec) {
  if (spec.kind === 'sa') return stripNiqqud(unitOf(SA, spec.siman, spec.seif)?.text || '');
  if (spec.kind === 'mb') return unitOf(MB, spec.siman, spec.n)?.text || '';
  if (spec.kind === 'yy') return YY.get(spec.id)?.text || '';
  if (spec.kind === 'ong') return unitOf(ONG, spec.chapter, spec.n)?.text || '';
  return '';
}
const QA_BY_YALKUT = new Map();
for (const item of PRACTICAL_HALACHA_QA) {
  const first = item.sources?.[0];
  if (item.answerStatus !== 'published' || first?.sourceType !== 'local-yalkut-yosef') continue;
  if (!QA_BY_YALKUT.has(first.localSourceId)) QA_BY_YALKUT.set(first.localSourceId, []);
  QA_BY_YALKUT.get(first.localSourceId).push({ id: item.id, question: item.question });
}
const SOURCES = {};
for (const [id, spec] of Object.entries(SOURCE_SPECS)) {
  const text = sourceText(spec);
  const start = text.indexOf(spec.from);
  const end = start < 0 ? -1 : text.indexOf(spec.to, start);
  if (start < 0 || end < 0) throw new Error(`source ${id}: quotation anchors not found`);
  const excerpt = text.slice(start, end + spec.to.length);
  let source;
  if (spec.kind === 'sa') source = { work: 'שולחן ערוך', citation: `שולחן ערוך, אורח חיים ${hebrewNumeral(spec.siman)}, ${hebrewNumeral(spec.seif)}`, route: `books/r/Shulchan_Arukh__Orach_Chayim/${spec.siman}/${spec.seif}`, license: 'Public Domain (Sefaria)' };
  if (spec.kind === 'mb') {
    const unit = unitOf(MB, spec.siman, spec.n);
    source = { work: 'משנה ברורה', citation: `משנה ברורה ${hebrewNumeral(spec.siman)}, ס״ק ${hebrewNumeral(spec.n)}`, route: `books/r/Shulchan_Arukh__Orach_Chayim/${spec.siman}/${unit.v}`, license: 'CC BY-SA (ויקיטקסט)' };
  }
  if (spec.kind === 'yy') {
    const section = YY.get(spec.id);
    source = { work: 'ילקוט יוסף', citation: `ילקוט יוסף (קיצור שו״ע), ${section.label}`, open: { ref: `Yalkut Yosef ${spec.id}`, title: `ילקוט יוסף · ${section.label}` }, license: 'CC BY-NC-SA 2.5 (תורת אמת)', questions: QA_BY_YALKUT.get(spec.id) || [] };
  }
  if (spec.kind === 'ong') {
    const unit = unitOf(ONG, spec.chapter, spec.n);
    source = { work: 'עונג שבת', citation: `עונג שבת, פרק ${hebrewNumeral(spec.chapter)}, הלכה ${hebrewNumeral(spec.n)} (${unit.title}) · עמ׳ ${unit.p.join('–')}`, route: `books/r/Oneg_Shabbat/${spec.chapter}/${spec.n}`, license: 'באישור המחבר, כל הזכויות שמורות' };
  }
  SOURCES[id] = { id, ...source, excerpt };
}

// ---------------------------------------------------------------------------------------------- the table
const TABLE = JSON.parse(read('sources/ong-shabbat/blessing-table.json'));
const PACK_TABLE = ONG.nodes.find(node => node.n === 26).units;
const squash = text => text.replace(/\s+/g, ' ').trim();
const FIRST = { 'העץ': 'haetz', 'האדמה': 'haadama', 'שהכל': 'shehakol', 'מזונות': 'mezonot', 'המוציא': 'hamotzi', 'הגפן': 'hagefen', 'לא מברך': 'none', 'אינו מברך': 'none' };
const LAST = { 'נפשות': 'nefashot', 'על המחיה': 'michya', 'על העץ ועל פרי העץ': 'etz', 'ברכת המזון': 'birkat', 'לא יברך': 'none', 'לא מברך': 'none', 'אינו מברך': 'none', 'אין לברך': 'none' };
const bare = (segment, table) => {
  const match = segment && squash(segment).match(/^(.+?)\.?\s*(\[[^\]]*\]\.?)?$/);
  return match && table[match[1].trim()] ? table[match[1].trim()] : null;
};
// The last blessing named inside the book's words ("כשאכל 27 גרם … יברך על המחיה"): only when exactly one blessing is
// named. Words that only say "no blessing" count only when the row does not begin with a condition ("אם …").
const POSITIVE = [['על המחיה', 'michya'], ['על הגפן', 'gefen'], ['על העץ ועל פרי העץ', 'etz'], ['ברכת המזון', 'birkat'], ['נפשות', 'nefashot']];
function spokenAfter(after) {
  if (!after) return null;
  const found = [...new Set(POSITIVE.filter(([words]) => after.includes(words)).map(([, key]) => key))];
  if (found.length === 1) return found[0];
  if (found.length === 0 && /(לא יברך|אינו מברך|אין לברך|לא מברך)/.test(after) && !/^אם /.test(after)) return 'none';
  return null;
}
const expandAbbreviations = name => name.replace(/תפו"א/g, 'תפוחי אדמה');
// Other names of a row: the name without its bracket, with תפו"א written out. What the bracket holds is a keyword only
// ("קוגל [אטריות]" must not answer a search for אטריות as if it were its name).
const rowAliases = name => {
  const base = squash(name.replace(/\[[^\]]*\]/g, ' ')).replace(/[“"]/g, '');
  return [...new Set([base, expandAbbreviations(base)])].filter(alias => alias && alias !== name);
};
const rowKeywords = name => [...name.matchAll(/\[([^\]]*)\]/g)].map(match => expandAbbreviations(match[1])).filter(text => text.length <= 40);

const rows = TABLE.rows.map(row => {
  const text = squash(row.text);
  const split = text.match(/^(.*?)\s*[–-]\s*(.*)$/);
  const name = squash(split[1]);
  const rest = split[2];
  const slashes = (rest.match(/\//g) || []).length;
  const before = slashes <= 1 ? squash(rest.split('/')[0]) : null;
  const after = slashes === 1 ? squash(rest.split('/')[1]) : null;
  const unit = PACK_TABLE.find(item => squash(item.text).includes(text));
  if (!unit) throw new Error(`row ${row.n} not found in the library pack`);
  const beforeKey = bare(before, FIRST);
  const bareAfter = slashes === 0 && beforeKey === 'none' ? 'none' : bare(after, LAST);
  // A blessing named inside a condition is taken only when the first blessing itself is certain.
  const spoken = !bareAfter && beforeKey ? spokenAfter(after) : null;
  const afterKey = bareAfter || spoken;
  const drink = DRINK_ROWS.includes(name);
  const mentionsShiur = /27 גרם|81 מ"ל|81 גרם|שיעור/.test(rest);
  const shiur = !afterKey && !after
    ? { text: `הברכה האחרונה לא נכתבה בלוח. הכלל בספר: ברכה אחרונה רק כש${drink ? 'שתה 81 מ״ל בזמן שתיית רביעית' : 'אכל 27 גרם בתוך 7.5 דקות'}.`, source: drink ? 'ong-25-2' : 'ong-25-1' }
    : afterKey && afterKey !== 'none' && !mentionsShiur
      ? { text: drink ? 'ברכה אחרונה רק כששתה 81 מ״ל בזמן שתיית רביעית.' : 'ברכה אחרונה רק כשאכל 27 גרם בתוך 7.5 דקות.', source: drink ? 'ong-25-2' : 'ong-25-1' }
      : null;
  return {
    id: `ong-26-${row.n}`, n: row.n, kind: 'book', origin: 'ong-table', name, aliases: rowAliases(name), keywords: rowKeywords(name), en: null, text, before, after, beforeKey, afterKey, afterInText: Boolean(spoken),
    pages: row.pages, letter: row.letter, unit: unit.n, route: `books/r/Oneg_Shabbat/26/${unit.n}`,
    cite: `עונג שבת, פרק כ״ו (לוח ברכות), עמ׳ ${row.pages.join('–')}`,
    drink, shiur, nusach: NUSACH_ROWS[name] || null, yalkut: YALKUT_BESIDE[name] || [],
  };
});
for (const name of Object.keys(YALKUT_BESIDE)) if (!rows.some(row => row.name === name)) throw new Error(`YALKUT_BESIDE: no row "${name}"`);
for (const name of [...Object.keys(NUSACH_ROWS), ...DRINK_ROWS]) if (!rows.some(row => row.name === name)) throw new Error(`no row "${name}"`);
for (const rule of Object.values(RULES)) for (const name of rule.bookRows || []) if (!rows.some(row => row.name === name)) throw new Error(`rule example: no row "${name}"`);
const halachaItems = BOOK_HALACHA_ITEMS.map(item => {
  const unit = unitOf(ONG, 25, item.unit);
  return { id: item.id, n: 1000 + item.unit, kind: 'book', origin: 'ong-halacha', name: item.name, aliases: item.aliases, keywords: [], en: null, text: unit.text, before: null, after: null, beforeKey: item.beforeKey, afterKey: item.afterKey, pages: unit.p, unit: item.unit, route: `books/r/Oneg_Shabbat/25/${item.unit}`, cite: `עונג שבת, פרק כ״ה, הלכה ${hebrewNumeral(item.unit)} (${unit.title}) · עמ׳ ${unit.p.join('–')}`, drink: false, shiur: null, nusach: item.nusach, yalkut: [] };
});

// ---------------------------------------------------------------------------------------------- Wikidata
const rowByName = new Map();
for (const row of rows) for (const key of [row.name, ...row.aliases]) { const k = normalizeFood(key); if (!rowByName.has(k)) rowByName.set(k, row); }
const report = { excluded: [], counts: {} };
const WD_CLASS_RULE = {
  bread: 'bread', flatbread: 'bread', cake: 'kisnin', cookie: 'kisnin', biscuit: 'kisnin', pastry: 'mixture', pie: 'mixture', cracker: 'dry-crackers',
  friedDough: 'grain-cooked', dumpling: 'mixture', pasta: 'grain-cooked', noodle: 'grain-cooked', porridge: 'breakfast-cereal', breakfastCereal: 'breakfast-cereal',
  candy: 'candy', confectionery: 'candy', chocolate: 'chocolate', iceCream: 'ice-cream', dessert: 'mixture', cheese: 'dairy', yogurt: 'dairy', dairy: 'dairy',
  soup: 'soup', vegetable: 'vegetable', leafVegetable: 'vegetable', rootVegetable: 'vegetable', fruit: 'fruit-plant', berry: 'fruit-plant', nut: 'nut', legume: 'legume',
  juice: 'drink', fruitJuice: 'drink', softDrink: 'drink', wine: 'wine', beer: 'beer', liqueur: 'spirits', tea: 'hot-drink', herbalTea: 'hot-drink', coffeeDrink: 'hot-drink',
};
// Materials (P186) that are not one of the five grains: a bread or pasta made of them is not "bread" by the rule.
const NON_GRAIN_MATERIALS = new Set([
  'Q5090', 'Q115443', 'Q154092', 'Q523224', 'Q1269205', 'Q15149436', 'Q470519', // rice, glutinous/puffed/cooked rice, rice flour, rice cake, mochi
  'Q11575', 'Q25618328', 'Q18966', 'Q10286140', 'Q1006089', // maize, sweet corn, cornmeal, masa
  'Q10998', 'Q16587531', 'Q322787', 'Q37937', 'Q43304555', // potato, mashed potato, sweet potato, cassava
  'Q843942', 'Q4536337', 'Q11621982', 'Q651829', 'Q21156930', 'Q1140464', // teff, buckwheat, besan, chickpea, red bean paste
]);
const NON_FOOD = /תעשיית|בקליפורניה|^הבירה ב|מכניקה|אנזים|^רוח$|^אום /;
// Foods that are not kosher are not listed at all (a blessing is not looked up for them).
export const NOT_KOSHER = /חזיר|שרימפ|סרטנ|לובסטר|צדפ|קלמרי|תמנון|פירות ים|מאכלי ים|בייקון|בקון|ארנב|צפרדע|\b(pork|bacon|ham|shrimps?|prawns?|lobster|crab|oysters?|clams?|mussels?|squid|octopus|shellfish|scallops?)\b/i;
// A sweet or dairy class does not decide a food whose name says it is made of fruit, nuts or grain.
const MADE_OF = /שקד|אגוז|פרי|פירות|תמר|ענב|תפוח|ריבת|ירקות|אורז|דגן|דגנים|שיבולת|חיט|ביסקוויט|עוגי|ופל/;
const WD_ROW_ALIASES = { 'מלוואח': 'מלאווח' };
const wikidata = JSON.parse(read('sources/blessings/wikidata-foods.json'));
const wdRecords = [];
for (const item of wikidata.items) {
  const why = reason => report.excluded.push({ origin: 'wikidata', id: item.id, name: item.he, reason });
  if (NON_FOOD.test(item.he)) { why('not a food'); continue; }
  if (NOT_KOSHER.test(`${item.he} ${item.en || ''}`)) { why('not kosher'); continue; }
  const row = (WD_ROW_ALIASES[item.he] && rows.find(r => r.name === WD_ROW_ALIASES[item.he])) || rowByName.get(normalizeFood(item.he)) || rowByName.get(normalizeFood(item.he.replace(/\s*\([^)]*\)\s*/g, ' ')));
  if (row) { // the same food as a row of the book: its names join the row, no second record
    row.aliases = [...new Set([...row.aliases, ...item.alts])];
    row.en = row.en || item.en;
    continue;
  }
  let targets = [...new Set(item.classes.map(key => WD_CLASS_RULE[key]))];
  // A class that also falls under a narrower rule (a chocolate that is also a candy) takes the narrower rule.
  if (targets.includes('chocolate')) targets = targets.filter(t => t !== 'candy' && t !== 'mixture');
  if (targets.includes('ice-cream')) targets = targets.filter(t => !['candy', 'mixture', 'dairy'].includes(t));
  if (targets.includes('kisnin')) targets = targets.filter(t => t !== 'candy' && t !== 'mixture');
  if (targets.includes('hot-drink')) targets = targets.filter(t => t !== 'drink');
  if (targets.includes('wine') || targets.includes('beer') || targets.includes('spirits')) targets = targets.filter(t => t !== 'drink' && t !== 'fruit-plant');
  if (targets.length > 1 && targets.includes('dairy') && targets.includes('drink')) targets = ['dairy'];
  let target;
  if (targets.length === 1) target = targets[0];
  else { target = 'mixture'; }
  if ((target === 'bread' || target === 'grain-cooked' || target === 'kisnin' || target === 'dry-crackers') && item.mats.some(mat => NON_GRAIN_MATERIALS.has(mat))) target = 'mixture';
  if (['candy', 'chocolate', 'dairy', 'ice-cream'].includes(target) && MADE_OF.test(item.he)) target = 'mixture';
  if (/מצה/.test(item.he)) { const matzah = rows.find(r => r.name === 'מצה [לא בפסח]'); target = null; wdRecords.push([item.he, item.alts.join('|'), item.en || '', '', `b:${matzah.n}`, 'w', item.id, 'class']); continue; }
  if (target === 'beer') { const beer = rows.find(r => r.name === 'בירה'); wdRecords.push([item.he, item.alts.join('|'), item.en || '', '', `b:${beer.n}`, 'w', item.id, 'class']); continue; }
  if (!RULES[target]) throw new Error(`wikidata: no rule ${target}`);
  wdRecords.push([item.he, item.alts.join('|'), item.en || '', '', `r:${target}`, 'w', item.id, 'class']);
}

// ---------------------------------------------------------------------------------------------- Open Food Facts
const OFF_FILE = 'sources/blessings/open-food-facts-israel.json.gz';
const offRecords = [];
if (existsSync(ROOT + OFF_FILE)) {
  const off = pack(OFF_FILE);
  const { classifyProduct } = await import('./offRules.mjs');
  const byKey = new Map();
  for (const product of off.products) {
    if (NOT_KOSHER.test(`${product.name} ${product.nameEn || ''}`)) { report.excluded.push({ origin: 'off', id: product.code, name: product.name, reason: 'not kosher' }); continue; }
    const result = classifyProduct(product, { rows });
    if (!result.target) { report.excluded.push({ origin: 'off', id: product.code, name: product.name, reason: result.reason }); continue; }
    // The same food as its row of the book (a product called just "במבה"): the row answers, no second card.
    const row = result.target.startsWith('b:') ? rows.find(r => r.n === Number(result.target.slice(2))) : null;
    if (row && [row.name, ...row.aliases].some(name => normalizeFood(name) === normalizeFood(product.name))) { report.excluded.push({ origin: 'off', id: product.code, name: product.name, reason: 'same as its book row' }); continue; }
    // One card per name and answer; the brands that sell it are listed on it.
    const key = `${normalizeFood(product.name)}|${result.target}`;
    const existing = byKey.get(key);
    if (existing) {
      if (product.brand && !existing[3].split(', ').includes(product.brand)) existing[3] = [existing[3], product.brand].filter(Boolean).join(', ');
      report.excluded.push({ origin: 'off', id: product.code, name: product.name, reason: 'merged with the same name' });
      continue;
    }
    const record = [product.name, (product.aliases || []).join('|'), product.nameEn || '', product.brand || '', result.target, 'o', product.code, result.via];
    byKey.set(key, record);
    offRecords.push(record);
  }
}

// ---------------------------------------------------------------------------------------------- write
const kindOf = target => (target.startsWith('r:') ? (RULES[target.slice(2)].status === 'conditional' ? 'conditional' : 'rule') : (() => { const row = rows.find(r => r.n === Number(target.slice(2))); return row.beforeKey && row.afterKey ? 'rule' : 'conditional'; })());
const all = [...wdRecords, ...offRecords];
const counts = {
  bookRows: rows.length,
  bookRowsSimple: rows.filter(row => row.beforeKey && row.afterKey).length,
  bookRowsWithConditions: rows.filter(row => !(row.beforeKey && row.afterKey)).length,
  bookHalachaItems: halachaItems.length,
  wikidata: wdRecords.length, openFoodFacts: offRecords.length,
  rule: all.filter(row => kindOf(row[4]) === 'rule').length,
  conditional: all.filter(row => kindOf(row[4]) === 'conditional').length,
  viaBookRow: all.filter(row => row[4].startsWith('b:')).length,
  byRule: Object.fromEntries(Object.keys(RULES).map(id => [id, all.filter(row => row[4] === `r:${id}`).length]).filter(([, n]) => n)),
  excluded: report.excluded.length,
};
report.counts = counts;
const header = `// Generated by scripts/halacha/blessings/build.mjs — do not edit by hand.\n// The rows are the words of עונג שבת (הרב ישראל שריקי), chapter כ״ו, used by permission of the author; the quotations are\n// cut from the texts the app carries (see SOURCE_SPECS in rules.mjs).\n`;
mkdirSync(ROOT + 'src/data/blessings', { recursive: true });
writeFileSync(ROOT + 'src/data/blessings/bookTable.mjs', `${header}export const BOOK_ROWS = ${JSON.stringify(rows)};\nexport const BOOK_HALACHA_RECORDS = ${JSON.stringify(halachaItems)};\nexport const BLESSING_SOURCES = ${JSON.stringify(SOURCES)};\nexport const BOOK_TABLE_INFO = ${JSON.stringify({ intro: TABLE.intro.text, introPage: TABLE.intro.pages[0], pdfSha256: TABLE.pdfSha256, rowsSha256: sha(JSON.stringify(TABLE.rows)) })};\nexport const ENGINE_COUNTS = ${JSON.stringify(counts)};\n`);
mkdirSync(ROOT + 'public/blessings', { recursive: true });
const foods = { version: 1, built: new Date().toISOString().slice(0, 10), attribution: { off: 'Open Food Facts — Open Database License (ODbL) 1.0; product contents: Database Contents License (DbCL) 1.0. https://world.openfoodfacts.org', wikidata: 'Wikidata — CC0 1.0. https://www.wikidata.org' }, fields: ['name', 'aliases', 'en', 'brand', 'target', 'origin', 'id', 'via'], records: all };
const gz = gzipSync(Buffer.from(JSON.stringify(foods)), { level: 9 });
writeFileSync(ROOT + 'public/blessings/foods.json.gz', gz);
mkdirSync(ROOT + 'sources/blessings', { recursive: true });
writeFileSync(ROOT + 'sources/blessings/build-report.json', JSON.stringify(report, null, 1));
console.log(JSON.stringify(counts, null, 1), '\nfoods.json.gz bytes', gz.length);
