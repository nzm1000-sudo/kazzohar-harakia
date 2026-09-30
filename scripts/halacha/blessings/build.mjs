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
import { SOURCE_SPECS, RULES, YALKUT_BESIDE, NUSACH_ROWS, DRINK_ROWS, DOUGH_ROWS, BOOK_HALACHA_ITEMS, SHIUR, WEB_SOURCES } from '../../../src/data/blessings/rules.mjs';
import { WD_TARGET, WD_NAME, NAME_FIXES, OFF_TARGET, BAD_ALIASES } from './curation.mjs';
import { knownIdentity, nameProblem, plainNut } from './identify.mjs';
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
  const mentionsShiur = /27 גרם|81 מ"ל|81 גרם|שיעור|כשאכל|אם אכל|כששתה|אם שתה/.test(rest);
  const dough = DOUGH_ROWS.includes(name);
  // The general rule of the book (כ״ה א–ב), in the app's one wording; for dough with a filling, the kezayit is of the
  // dough itself. Attached only where the row names a last blessing, or says none.
  const shiur = !afterKey && !after
    ? { text: `הברכה האחרונה לא נכתבה בלוח. הכלל: ${drink ? SHIUR.drink : SHIUR.food}`, source: drink ? 'ong-25-2' : 'ong-25-1' }
    : afterKey && afterKey !== 'none' && !mentionsShiur
      ? { text: drink ? SHIUR.drink : dough ? SHIUR.dough : SHIUR.food, source: drink ? 'ong-25-2' : 'ong-25-1', web: dough ? ['hy-4332'] : ['hy-540'] }
      : null;
  return {
    id: `ong-26-${row.n}`, n: row.n, kind: 'book', origin: 'ong-table', name, aliases: rowAliases(name), keywords: rowKeywords(name), en: null, text, before, after, beforeKey, afterKey, afterInText: Boolean(spoken),
    pages: row.pages, letter: row.letter, unit: unit.n, route: `books/r/Oneg_Shabbat/26/${unit.n}`,
    cite: `עונג שבת, פרק כ״ו (לוח ברכות), עמ׳ ${row.pages.join('–')}`,
    drink, shiur, nusach: NUSACH_ROWS[name] || null, yalkut: YALKUT_BESIDE[name] || [],
  };
});
for (const name of Object.keys(YALKUT_BESIDE)) if (!rows.some(row => row.name === name)) throw new Error(`YALKUT_BESIDE: no row "${name}"`);
for (const name of [...Object.keys(NUSACH_ROWS), ...DRINK_ROWS, ...DOUGH_ROWS]) if (!rows.some(row => row.name === name)) throw new Error(`no row "${name}"`);
for (const rule of Object.values(RULES)) for (const name of rule.bookRows || []) if (!rows.some(row => row.name === name)) throw new Error(`rule example: no row "${name}"`);
const halachaItems = BOOK_HALACHA_ITEMS.map(item => {
  const unit = unitOf(ONG, 25, item.unit);
  return { id: item.id, n: 1000 + item.unit, kind: 'book', origin: 'ong-halacha', name: item.name, aliases: item.aliases, keywords: [], en: null, text: unit.text, before: null, after: null, beforeKey: item.beforeKey, afterKey: item.afterKey, pages: unit.p, unit: item.unit, route: `books/r/Oneg_Shabbat/25/${item.unit}`, cite: `עונג שבת, פרק כ״ה, הלכה ${hebrewNumeral(item.unit)} (${unit.title}) · עמ׳ ${unit.p.join('–')}`, drink: false, shiur: null, nusach: item.nusach, yalkut: [] };
});

// ---------------------------------------------------------------------------------------------- Wikidata
const rowByName = new Map();
for (const row of rows) for (const key of [row.name, ...row.aliases]) { const k = normalizeFood(key); if (!rowByName.has(k)) rowByName.set(k, row); }
const report = { excluded: [], mergedIntoRows: [], unusedCuration: [], counts: {} };
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
const rowNamed = name => { const row = rows.find(r => r.name === name); if (!row) throw new Error(`curation: no row "${name}"`); return row; };
const targetOf = value => (value.startsWith('row:') ? `b:${rowNamed(value.slice(4)).n}` : value === 'pending' ? 'r:unverified' : value);
for (const value of Object.values(WD_TARGET)) if (!value.startsWith('exclude:')) { const target = targetOf(value); if (target.startsWith('r:') && !RULES[target.slice(2)]) throw new Error(`curation: no rule ${target}`); }
const usedCuration = new Set();
for (const original of wikidata.items) {
  // A label that names two foods is shown with the word that says which; the label stays searchable.
  const item = WD_NAME[`${original.he}=${original.en || '?'}`] ? { ...original, he: WD_NAME[`${original.he}=${original.en || '?'}`], alts: [original.he, ...original.alts] } : original;
  const why = reason => report.excluded.push({ origin: 'wikidata', id: item.id, name: item.he, reason });
  const key = `${original.he}=${original.en || '?'}`;
  const curated = WD_TARGET[key];
  if (curated) usedCuration.add(key);
  if (curated?.startsWith('exclude:')) { why(curated.slice(8)); continue; }
  if (NON_FOOD.test(item.he)) { why('not a food'); continue; }
  if (NOT_KOSHER.test(`${item.he} ${item.en || ''}`)) { why('not kosher'); continue; }
  if (nameProblem(item.he)) { why(`name needs proofreading: ${nameProblem(item.he)}`); continue; }
  // Other names join the search only when they are a name of this food: not a phrase that is not a food, and not the
  // name of a different row of the table ("פתיתי תירס" is its own row, not another name of קורנפלקס).
  const otherRow = alt => rows.some(r => [r.name, ...r.aliases].some(name => normalizeFood(name) === normalizeFood(alt)));
  const alts = item.alts.filter(alt => !nameProblem(alt) && !BAD_ALIASES.includes(alt) && !otherRow(alt));
  if (curated) {
    const target = targetOf(curated);
    const row = target.startsWith('b:') ? rows.find(r => r.n === Number(target.slice(2))) : null;
    // The same food as a row of the book: its names join the row, no second record.
    if (row && [row.name, ...row.aliases].some(name => normalizeFood(name) === normalizeFood(item.he))) { row.aliases = [...new Set([...row.aliases, ...alts])]; row.en = row.en || item.en; continue; }
    wdRecords.push([item.he, alts.join('|'), item.en || '', '', target, 'w', item.id, 'review']);
    continue;
  }
  const row = (WD_ROW_ALIASES[item.he] && rows.find(r => r.name === WD_ROW_ALIASES[item.he])) || rowByName.get(normalizeFood(item.he)) || rowByName.get(normalizeFood(item.he.replace(/\s*\([^)]*\)\s*/g, ' ')));
  if (row) { // the same food as a row of the book: its names join the row, no second record
    row.aliases = [...new Set([...row.aliases, ...alts])];
    row.en = row.en || item.en;
    report.mergedIntoRows.push({ id: item.id, name: item.he, en: item.en, row: row.name, aliases: alts });
    continue;
  }
  // What the food is, from its whole name, before its class.
  const nut = plainNut(item.he);
  if (nut) { wdRecords.push([item.he, alts.join('|'), item.en || '', '', nut === 'tree' ? 'r:tree-nut' : `b:${rowNamed('בוטנים').n}`, 'w', item.id, 'identity']); continue; }
  const known = knownIdentity(item.he);
  if (known) { wdRecords.push([item.he, alts.join('|'), item.en || '', '', known.target, 'w', item.id, 'identity']); continue; }
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
  if (/מצה/.test(item.he)) { report.excluded.push({ origin: 'wikidata', id: item.id, name: item.he, reason: 'matzah: only the table\'s own row' }); continue; }
  if (target === 'beer') { const beer = rows.find(r => r.name === 'בירה'); wdRecords.push([item.he, alts.join('|'), item.en || '', '', `b:${beer.n}`, 'w', item.id, 'class']); continue; }
  if (!RULES[target]) throw new Error(`wikidata: no rule ${target}`);
  wdRecords.push([item.he, alts.join('|'), item.en || '', '', `r:${target}`, 'w', item.id, 'class']);
}
for (const key of Object.keys(WD_TARGET)) if (!usedCuration.has(key)) report.unusedCuration.push(key);

// ---------------------------------------------------------------------------------------------- Open Food Facts
const OFF_FILE = 'sources/blessings/open-food-facts-israel.json.gz';
const GRAIN_TARGETS = new Set(['r:bread', 'r:sweet-bread', 'r:kisnin', 'r:dry-crackers', 'r:grain-cooked', 'r:filled-dough', 'r:pizza', 'r:wafer', 'r:coated-wafer', 'r:tortilla', 'r:sandwich']);
const offRecords = [];
if (existsSync(ROOT + OFF_FILE)) {
  const off = pack(OFF_FILE);
  const { classifyProduct } = await import('./offRules.mjs');
  const byKey = new Map();
  for (const original of off.products) {
    // The name shown is a proofread name; the name as typed stays searchable as another name.
    const fixed = NAME_FIXES[original.code];
    const product = fixed ? { ...original, name: fixed, aliases: [...new Set([original.name, ...(original.aliases || [])])] } : original;
    if (NOT_KOSHER.test(`${product.name} ${product.nameEn || ''}`)) { report.excluded.push({ origin: 'off', id: product.code, name: product.name, reason: 'not kosher' }); continue; }
    const problem = nameProblem(product.name);
    if (problem) { report.excluded.push({ origin: 'off', id: product.code, name: product.name, reason: `name needs proofreading: ${problem}` }); continue; }
    const curated = OFF_TARGET[original.code];
    if (curated?.startsWith('exclude:')) { report.excluded.push({ origin: 'off', id: product.code, name: product.name, reason: curated.slice(8) }); continue; }
    const result = curated ? { target: targetOf(curated), via: 'review' } : classifyProduct(product, { rows });
    if (!result.target) { report.excluded.push({ origin: 'off', id: product.code, name: product.name, reason: result.reason }); continue; }
    // "ללא גלוטן" / almond flour: a bread, pastry or pasta rule assumes the five grains — not verified for this product.
    if (/(ללא גלוטן|נטול גלוטן|קמח שקדים|קמחי שקדים)/.test(product.name) && GRAIN_TARGETS.has(result.target)) result.target = 'r:unverified';
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
    const aliases = (product.aliases || []).filter(alias => alias !== product.name);
    const record = [product.name, aliases.join('|'), product.nameEn || '', product.brand || '', result.target, 'o', product.code, result.via];
    byKey.set(key, record);
    offRecords.push(record);
  }
  for (const code of Object.keys(OFF_TARGET)) if (!off.products.some(product => product.code === code)) report.unusedCuration.push(`off:${code}`);
  for (const code of Object.keys(NAME_FIXES)) if (!off.products.some(product => product.code === code)) report.unusedCuration.push(`name:${code}`);
}

// ---------------------------------------------------------------------------------------------- write
// Bumped whenever what a record answers changes: the page asks for foods.json.gz?v=<version>, so no cached copy of an
// older answer is ever read.
export const FOODS_VERSION = 2;
const kindOf = target => (target.startsWith("r:") && !RULES[target.slice(2)] ? (() => { throw new Error(`no rule for ${target}`); })() : target.startsWith('r:') ? ({ conditional: 'conditional', pending: 'pending' }[RULES[target.slice(2)].status] || 'rule') : (() => { const row = rows.find(r => r.n === Number(target.slice(2))); return row.beforeKey && row.afterKey ? 'rule' : 'conditional'; })());
// One card per food and answer: the same name with the same answer from both sources is one card (the product's brands
// are kept); the same name with DIFFERENT answers must not happen (a test checks it).
const all = [];
const seenCard = new Map();
const rowNames = new Set(rows.flatMap(row => [row.name, ...row.aliases].map(normalizeFood)));
for (const record of [...offRecords, ...wdRecords]) {
  // A food called exactly as a row of the table: the row (the book's own words) answers — no second card beside it.
  if (rowNames.has(normalizeFood(record[0]))) { report.excluded.push({ origin: record[5] === 'o' ? 'off' : 'wikidata', id: record[6], name: record[0], reason: 'same name as a row of the table' }); continue; }
  const key = `${normalizeFood(record[0])}|${record[4]}`;
  const kept = seenCard.get(key);
  if (kept) { kept[1] = [...new Set([...kept[1].split('|'), ...record[1].split('|')].filter(Boolean))].join('|'); kept[2] = kept[2] || record[2]; report.excluded.push({ origin: record[5] === 'o' ? 'off' : 'wikidata', id: record[6], name: record[0], reason: 'merged with the same food' }); continue; }
  seenCard.set(key, record);
  all.push(record);
}
const wdCount = all.filter(record => record[5] === 'w').length;
const offCount = all.filter(record => record[5] === 'o').length;
const counts = {
  bookRows: rows.length,
  bookRowsSimple: rows.filter(row => row.beforeKey && row.afterKey).length,
  bookRowsWithConditions: rows.filter(row => !(row.beforeKey && row.afterKey)).length,
  bookHalachaItems: halachaItems.length,
  wikidata: wdCount, openFoodFacts: offCount,
  rule: all.filter(row => kindOf(row[4]) === 'rule').length,
  conditional: all.filter(row => kindOf(row[4]) === 'conditional').length,
  pending: all.filter(row => kindOf(row[4]) === 'pending').length,
  viaBookRow: all.filter(row => row[4].startsWith('b:')).length,
  byRule: Object.fromEntries(Object.keys(RULES).map(id => [id, all.filter(row => row[4] === `r:${id}`).length]).filter(([, n]) => n)),
  excluded: report.excluded.length,
};
report.counts = counts;
const header = `// Generated by scripts/halacha/blessings/build.mjs — do not edit by hand.\n// The rows are the words of עונג שבת (הרב ישראל שריקי), chapter כ״ו, used by permission of the author; the quotations are\n// cut from the texts the app carries (see SOURCE_SPECS in rules.mjs).\n`;
mkdirSync(ROOT + 'src/data/blessings', { recursive: true });
writeFileSync(ROOT + 'src/data/blessings/bookTable.mjs', `${header}export const BOOK_ROWS = ${JSON.stringify(rows)};\nexport const BOOK_HALACHA_RECORDS = ${JSON.stringify(halachaItems)};\nexport const BLESSING_SOURCES = ${JSON.stringify(SOURCES)};\nexport const BOOK_TABLE_INFO = ${JSON.stringify({ intro: TABLE.intro.text, introPage: TABLE.intro.pages[0], pdfSha256: TABLE.pdfSha256, rowsSha256: sha(JSON.stringify(TABLE.rows)) })};\nexport const ENGINE_COUNTS = ${JSON.stringify(counts)};\nexport const FOODS_VERSION = ${FOODS_VERSION};\n`);
mkdirSync(ROOT + 'public/blessings', { recursive: true });
const foods = { version: FOODS_VERSION, built: new Date().toISOString().slice(0, 10), attribution: { off: 'Open Food Facts — Open Database License (ODbL) 1.0; product contents: Database Contents License (DbCL) 1.0. https://world.openfoodfacts.org', wikidata: 'Wikidata — CC0 1.0. https://www.wikidata.org' }, fields: ['name', 'aliases', 'en', 'brand', 'target', 'origin', 'id', 'via'], records: all };
const gz = gzipSync(Buffer.from(JSON.stringify(foods)), { level: 9 });
writeFileSync(ROOT + 'public/blessings/foods.json.gz', gz);
mkdirSync(ROOT + 'sources/blessings', { recursive: true });
writeFileSync(ROOT + 'sources/blessings/build-report.json', JSON.stringify(report, null, 1));
console.log(JSON.stringify(counts, null, 1), '\nfoods.json.gz bytes', gz.length);
