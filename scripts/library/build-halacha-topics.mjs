// Titled contents for the halacha books: the names of their simanim and of the groups of simanim (הלכות ציצית,
// הלכות שבת…), taken from the provider's own structure of each book — Sefaria's index, alt_structs.Topic — never
// written by hand. Run: node scripts/library/build-halacha-topics.mjs [--cache /tmp/kz-library-cache/topics] [--offline]
//   • Kitzur Shulchan Arukh: every siman is its own topic, titled as printed ("[סימן קלט] הלכות חנכה"): the siman's name.
//     The bracketed numeral is checked against the siman it names.
//   • The Shulchan Arukh (four parts), the Tur and the Beit Yosef (four parts each), Biur Halacha, Chayei Adam, Ben Ish
//     Hai, Shibbolei HaLeket, Sefer HaTerumah: groups of simanim (klalim, parashot) with their names.
//   • Mishnah Berurah, Be'er Heitev and Kaf HaChaim on Orach Chayim carry no structure of their own at the provider;
//     they follow the simanim of the Shulchan Arukh, Orach Chayim, whose groups they are given (recorded as such).
// A topic becomes a range of the book's own nodes only when the provider's structure and the book's parts line up
// (the same leaves in the same order, or one numbered sequence); anything that does not resolve stops the build.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import PACK_INDEX from '../../src/data/library/packIndex.mjs';
import COLLECTION_INDEX from '../../src/data/library/collectionIndex.mjs';
import CORPUS_INDEX from '../../src/data/library/corpusIndex.mjs';
import { hebrewNumeral } from '../../src/services/hebrewNumerals.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const CACHE = arg('--cache', '/tmp/kz-library-cache/topics');
const OFFLINE = args.includes('--offline');
const RETRIEVED_AT = arg('--retrieved-at', new Date().toISOString().slice(0, 10));
const SEFARIA = 'https://www.sefaria.org';
mkdirSync(CACHE, { recursive: true });
const fail = message => { throw new Error(message); };

async function index(title) {
  const file = join(CACHE, `idx-${title.replace(/[^A-Za-z0-9]+/g, '_')}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  if (OFFLINE) fail(`offline and not cached: ${title}`);
  const response = await fetch(`${SEFARIA}/api/v2/raw/index/${encodeURIComponent(title)}`, { headers: { Accept: 'application/json', 'User-Agent': 'kazzohar-library-import/1.0' } });
  if (!response.ok) fail(`${title}: HTTP ${response.status}`);
  const data = await response.json();
  writeFileSync(file, JSON.stringify(data));
  return data;
}

const works = new Map([...CORPUS_INDEX, ...PACK_INDEX, ...COLLECTION_INDEX].flatMap(pack => pack.works.map(work => [work.workId, work])));
const enTitles = node => new Set([node.key, node.title, ...(node.titles || []).filter(t => t.lang === 'en').map(t => t.text)].filter(Boolean).map(t => String(t).trim().toLowerCase()));
const heTitle = node => String((node.titles || []).find(t => t.lang === 'he' && t.primary)?.text || (node.titles || []).find(t => t.lang === 'he')?.text || '').replace(/\s+/g, ' ').trim();
// The leaves of an index schema in reading order (the same walk the pack builders use).
function leavesOf(schema) {
  const leaves = [];
  const walk = node => (node.nodes ? node.nodes.forEach(walk) : leaves.push(node));
  walk(schema);
  return leaves;
}
const LETTER = { א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9, י: 10, כ: 20, ך: 20, ל: 30, מ: 40, ם: 40, נ: 50, ן: 50, ס: 60, ע: 70, פ: 80, ף: 80, צ: 90, ץ: 90, ק: 100, ר: 200, ש: 300, ת: 400 };
const gematria = text => [...String(text).replace(/[^א-ת]/g, '')].reduce((total, letter) => total + LETTER[letter], 0);

// A provider ref ("Tur, Orach Chaim 1-7", "Chayyei Adam.1-35", "Shibbolei HaLeket 55:1-130:11",
// "Ben Ish Hai, Halachot 1st Year, Bereshit") → the book's nodes { from, to }.
function nodesForRef(idx, work, ref) {
  const names = [...enTitles(idx.schema), String(idx.title).toLowerCase()].sort((a, b) => b.length - a.length);
  let rest = String(ref).trim();
  const title = names.find(name => rest.toLowerCase().startsWith(name));
  if (!title) fail(`${ref}: not a ref of ${idx.title}`);
  rest = rest.slice(title.length).replace(/^[.,]?\s*/, '');
  const range = /(?:^|[\s.])(\d+)(?::(\d+))?(?:-(\d+)(?::\d+)?)?$/.exec(rest);
  const path = (range ? rest.slice(0, range.index) : rest).replace(/[,.\s]+$/, '');
  let node = idx.schema;
  for (const segment of path ? path.split(/,\s*/) : []) {
    const child = (node.nodes || []).find(item => enTitles(item).has(segment.trim().toLowerCase())) || fail(`${ref}: no part "${segment}"`);
    node = child;
  }
  if (range && node.nodes) node = node.nodes.find(item => item.default) || fail(`${ref}: a range on a part with no default`);
  let all = leavesOf(idx.schema);
  // A book stored as one numbered sequence is the provider's main (default) leaf; a topic on another leaf (an appendix
  // such as סדר הגט) is not in the book and is left out, recorded.
  if (!work.sections && all.length > 1) {
    const main = all.filter(leaf => leaf.default);
    if (main.length !== 1) fail(`${work.workId}: one sequence in the book, ${all.length} parts at the provider and no default`);
    if (!leavesOf(node).every(leaf => leaf.default)) return null;
    all = main;
  }
  const covered = leavesOf(node).map(leaf => all.indexOf(leaf));
  const sections = work.sections || [{ title: work.heTitle, from: 1, to: work.expected.length }];
  if (sections.length !== all.length) fail(`${work.workId}: ${sections.length} parts in the book, ${all.length} in the provider's structure`);
  if (range) {
    if (covered.length !== 1) fail(`${ref}: a range across parts`);
    const section = sections[covered[0]];
    const a = section.from + Number(range[1]) - 1;
    const b = Math.min(section.from + Number(range[3] || range[1]) - 1, section.to);
    if (a > section.to) fail(`${ref}: beyond the part (${section.title})`);
    // A topic that opens inside a siman ("175:5-175:63") shares that siman with the topic before it (both list it).
    return { from: a, to: b, ...(Number(range[2]) > 1 ? { midSiman: true } : {}) };
  }
  return { from: sections[covered[0]].from, to: sections[covered.at(-1)].to };
}

function topicsOf(idx, work) {
  const struct = idx.alt_structs?.Topic || fail(`${idx.title}: no Topic structure`);
  const topics = [];
  const walk = (node, parent) => {
    if (node.nodes?.length) return node.nodes.forEach(child => walk(child, heTitle(node)));
    const refs = node.wholeRef ? [node.wholeRef] : node.refs || [];
    if (!refs.length) fail(`${idx.title}: topic "${heTitle(node)}" has no ref`);
    const ranges = refs.map(ref => nodesForRef(idx, work, ref));
    if (ranges.some(range => !range)) { skipped.push({ book: idx.title, topic: heTitle(node), refs, why: 'a part the book on the device does not carry' }); return; }
    topics.push({ title: heTitle(node), ...(parent ? { part: parent } : {}), from: Math.min(...ranges.map(r => r.from)), to: Math.max(...ranges.map(r => r.to)), ...(ranges[0].midSiman ? { shared: true } : {}) });
  };
  struct.nodes.forEach(node => walk(node, null));
  topics.sort((a, b) => a.from - b.from);
  // Two topics may share their boundary siman (the Tur prints כלאי זרעים and כלאי בהמה in one siman); nothing else.
  for (let i = 1; i < topics.length; i += 1) if (topics[i].from <= topics[i - 1].to && !(topics[i].from === topics[i - 1].to && topics[i].from >= topics[i - 1].from)) fail(`${idx.title}: topics overlap (${topics[i - 1].title} / ${topics[i].title})`);
  return topics;
}

const source = (title, field = 'alt_structs.Topic') => ({ provider: 'sefaria', title, field, url: `${SEFARIA}/api/v2/raw/index/${encodeURIComponent(title)}`, retrievedAt: RETRIEVED_AT });
const out = {};
const skipped = [];

// Kitzur Shulchan Arukh: the names of its 221 simanim.
{
  const work = works.get('Kitzur_Shulchan_Arukh') || fail('no Kitzur Shulchan Arukh');
  const idx = await index('Kitzur Shulchan Arukh');
  const topics = topicsOf(idx, work);
  const names = topics.map(topic => {
    if (topic.from !== topic.to) fail(`Kitzur: topic ${topic.title} spans several simanim`);
    const m = /^\[סימן\s+([א-ת"׳״']+)\]\s*(.+)$/.exec(topic.title) || fail(`Kitzur: "${topic.title}" is not "[סימן …] name"`);
    if (gematria(m[1]) !== topic.from) fail(`Kitzur: "${topic.title}" names siman ${gematria(m[1])}, not ${topic.from}`);
    return [topic.from, m[2].trim()];
  });
  if (names.length !== work.expected.length) fail(`Kitzur: ${names.length} names for ${work.expected.length} simanim`);
  out.Kitzur_Shulchan_Arukh = { source: source(idx.title), names, nodeTitles: names.map(([n, name]) => `סימן ${hebrewNumeral(n)} · ${name}`) };
}

// Groups of simanim, each from the book's own structure.
const OWN = [
  ['Shulchan_Arukh__Orach_Chayim', 'Shulchan Arukh, Orach Chayim'],
  ['Shulchan_Arukh__Yoreh_Deah', "Shulchan Arukh, Yoreh De'ah"],
  ['Shulchan_Arukh__Even_HaEzer', 'Shulchan Arukh, Even HaEzer'],
  ['Shulchan_Arukh__Choshen_Mishpat', 'Shulchan Arukh, Choshen Mishpat'],
  ['Tur', 'Tur'],
  ['Beit_Yosef', 'Beit Yosef'],
  ['Biur_Halacha', 'Biur Halacha'],
  ['Chayyei_Adam', 'Chayyei Adam'],
  ['Ben_Ish_Hai', 'Ben Ish Hai'],
  ['Shibbolei_HaLeket', 'Shibbolei HaLeket'],
  ['Sefer_HaTerumah', 'Sefer HaTerumah'],
];
for (const [workId, title] of OWN) {
  const work = works.get(workId) || fail(`no ${workId}`);
  const idx = await index(title);
  // A commentary stored with extra nodes after its simanim (introductions): the structure covers the simanim only.
  const simanim = work.nodeTitles && !work.sections ? work.nodeTitles.filter(item => item.startsWith('סימן ')).length || work.expected.length : work.expected.length;
  const topics = topicsOf(idx, { ...work, expected: work.expected.slice(0, simanim) });
  // A topic that names a single part already titled in the book (a parasha "פרשת בראשית - הלכות ציצית") keeps only
  // what the part's title does not say.
  out[workId] = { source: source(idx.title), topics: topics.map(topic => ({ ...topic, title: topic.title.replace(/^פרשת\s+[^-–]+\s+[-–]\s+/, '') })) };
}

// The Shulchan Arukh's commentaries on Orach Chayim follow its simanim: its groups, recorded as its structure.
for (const workId of ['Mishnah_Berurah', 'Baer_Hetev_on_Shulchan_Arukh_Orach_Chayim', 'Kaf_HaChayim_on_Shulchan_Arukh_Orach_Chayim']) {
  const work = works.get(workId) || fail(`no ${workId}`);
  const base = out.Shulchan_Arukh__Orach_Chayim;
  const simanim = Math.min(697, work.expected.length);
  out[workId] = { source: { ...base.source, note: 'the simanim of the Shulchan Arukh, Orach Chayim, which this commentary follows' }, topics: base.topics.filter(topic => topic.from <= simanim).map(topic => ({ ...topic, to: Math.min(topic.to, simanim) })) };
}

const banner = '// Generated by scripts/library/build-halacha-topics.mjs. Do not edit by hand.\n// Titled contents of the halacha books, from each book\'s own structure at the provider (Sefaria index, alt_structs.Topic).\n';
writeFileSync(join(ROOT, 'src/data/library/halachaTopics.mjs'), `${banner}export default ${JSON.stringify({ generatedAt: RETRIEVED_AT, works: out, skipped })};\n`);
console.log(JSON.stringify(skipped));
console.log(Object.entries(out).map(([id, entry]) => `${id}: ${entry.names ? `${entry.names.length} names` : `${entry.topics.length} topics`}`).join('\n'));
