// Builds the offline "Siddur Sefard — Torat Emet 357" pack: a SECOND version of Sefaria's "Siddur Sefard" (Nusach
// Sefard, the Chassidic rite), used ONLY where the version the main pack carries (Sefaria's default for that leaf) lost
// words that this version prints.
//   node scripts/build-sefard-torat-emet.mjs --fetch   download the leaves into sources/sefard-torat-emet/raw/ (once)
//   node scripts/build-sefard-torat-emet.mjs           parse the cache offline; write the pack and provenance.json
//
// Source and licence: Sefaria, index "Siddur Sefard", version "Torat Emet 357" (versionSource
// http://www.toratemetfreeware.com/index.html?downloads), licence recorded by Sefaria on the version: Public Domain.
// The main Sefard pack (siddurSefard.mjs) already carries this same version for most of its leaves; for three leaves
// Sefaria's default is the Metsudah siddur (CC BY), whose text there has lost lines:
//   - Birkat HaMazon, Ya'aleh VeYavo: the Shavuot line is an empty paragraph (Metsudah ¶54) — Torat Emet ¶54 prints it;
//   - Bedtime Shema: the edition's note asks for והיה אם שמוע (and, by Rabbenu Yerucham, ויאמר) but Metsudah prints only
//     the first paragraph — Torat Emet ¶6–7 print both;
//   - Yom Tov Musaf: "…הזה, נעשה ונקריב לפניך … כאמור:" is printed once, at the end of the last festival line (Torat
//     Emet ¶26, Shemini Atzeret) — it continues every festival's line. The pack carries that paragraph split in two at
//     the edition's own boundary (the words of the line | "הַזֶּה, נַעֲשֶׂה…"), so the continuation can follow Pesach,
//     Shavuot and Sukkot too. Markup only: the two parts, joined, are byte-for-byte the source paragraph.
// Deterministic: the parse stage reads only the cache. No word or point is edited.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const SRC_DIR = new URL('sources/sefard-torat-emet/', ROOT);
const RAW_DIR = new URL('raw/', SRC_DIR);
const OUT = new URL('src/data/nusach/siddurSefardToratEmet.mjs', ROOT);
const PROVENANCE = new URL('provenance.json', SRC_DIR);
const ACCESSED = '2026-09-29';
const VERSION = 'Torat Emet 357';
const UA = 'KazzoharSiddurBuilder/1.0 (offline siddur import of a public-domain Sefaria version; Node.js fetch)';

export const INDEX = 'Siddur Sefard Torat Emet';
export const HE_INDEX = 'סידור ספרד (תורת אמת)';
export const LICENSE = 'Public Domain';

// Sefaria ref (index "Siddur Sefard") → the cache file and this pack's leaf.
const LEAVES = [
  { sefaria: 'Siddur Sefard, Birchat HaMazon, Birchat HaMazon', file: 'birchat-hamazon.json', path: ['Birchat HaMazon', 'Birchat HaMazon'], heTitle: 'ברכת המזון' },
  { sefaria: 'Siddur Sefard, Bedtime Shema', file: 'bedtime-shema.json', path: ['Bedtime Shema'], heTitle: 'קריאת שמע על המיטה' },
  // Only its ¶26, split in two at "הַזֶּה, נַעֲשֶׂה" (see above).
  { sefaria: 'Siddur Sefard, Holidays, Yom Tov Musaf Amidah', file: 'yom-tov-musaf-amidah.json', path: ['Holidays', 'Yom Tov Musaf Amidah'], heTitle: 'מוסף לשלוש רגלים', paragraphs: [26], split: { at: 26, before: 'הַזֶּה, נַעֲשֶׂה' } },
];

const apiUrl = ref => `https://www.sefaria.org/api/v3/texts/${encodeURIComponent(ref)}?version=${encodeURIComponent(`hebrew|${VERSION}`)}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (process.argv.includes('--fetch')) {
  mkdirSync(RAW_DIR, { recursive: true });
  for (const leaf of LEAVES) {
    const url = apiUrl(leaf.sefaria);
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`${res.status} for ${url}`);
    const body = await res.text();
    writeFileSync(new URL(leaf.file, RAW_DIR), body);
    console.log(leaf.sefaria, '→', leaf.file, body.length, 'bytes');
    await sleep(1500);
  }
  process.exit(0);
}

const readJson = url => JSON.parse(readFileSync(url, 'utf8'));
const texts = {};
const provenanceLeaves = [];
for (const leaf of LEAVES) {
  const file = new URL(leaf.file, RAW_DIR);
  if (!existsSync(file)) throw new Error(`missing ${leaf.file} — run with --fetch`);
  const data = readJson(file);
  const version = (data.versions || []).find(v => v.versionTitle === VERSION && v.language === 'he');
  if (!version) throw new Error(`${leaf.sefaria}: version "${VERSION}" not in the cache`);
  if (version.license !== LICENSE) throw new Error(`${leaf.sefaria}: licence "${version.license}" — expected "${LICENSE}"`);
  const source = version.text.map(paragraph => (typeof paragraph === 'string' ? paragraph : ''));
  let he = source;
  let sourceParagraphs = source.map((_, i) => i);
  let split = null;
  if (leaf.paragraphs) {
    he = leaf.paragraphs.map(i => source[i]);
    sourceParagraphs = [...leaf.paragraphs];
  }
  if (leaf.split) {
    const at = sourceParagraphs.indexOf(leaf.split.at);
    const paragraph = he[at];
    // The cut is at the start of the word whose letters (points ignored) begin `before` — the point order inside a
    // letter may differ from the constant here, so the words are compared without points.
    const unpointed = text => text.replace(/[֑-ׇ]/g, '');
    const starts = [...paragraph.matchAll(/(?<=\s)\S/g)].map(m => m.index).filter(i => unpointed(paragraph.slice(i)).startsWith(unpointed(leaf.split.before)));
    if (starts.length !== 1) throw new Error(`${leaf.sefaria}: split point found ${starts.length} times`);
    const cut = starts[0];
    // "<small><small>caption</small>  line </small>" + "<small>continuation</small>": the enclosing <small> of the
    // source paragraph is closed before the cut and reopened after it, so each part is balanced markup.
    const openers = paragraph.slice(0, cut).match(/^(?:<small>)+/)?.[0] || '';
    const outer = openers ? '<small>' : '';
    const first = `${paragraph.slice(0, cut)}${outer ? '</small>' : ''}`;
    const second = `${outer}${paragraph.slice(cut)}`;
    if (`${first.slice(0, first.length - (outer ? 8 : 0))}${second.slice(outer.length)}` !== paragraph) throw new Error('split is not lossless');
    he = [...he.slice(0, at), first, second, ...he.slice(at + 1)];
    sourceParagraphs = [...sourceParagraphs.slice(0, at), leaf.split.at, leaf.split.at, ...sourceParagraphs.slice(at + 1)];
    split = { sourceParagraph: leaf.split.at, before: leaf.split.before, markup: outer ? 'the enclosing <small> closed before the cut and reopened after it' : 'none' };
  }
  const ref = `${INDEX}, ${leaf.path.join(', ')}`;
  texts[ref] = {
    ref, heRef: `${HE_INDEX}, ${leaf.heTitle}`, he,
    heVersionTitle: VERSION, heVersionSource: version.versionSource, heLicense: LICENSE, versionTitle: VERSION, license: LICENSE,
    // Where each paragraph is in Sefaria's leaf (the same numbering as the app's docs use: ¶n).
    source: { sefariaRef: data.ref, url: `https://www.sefaria.org/${encodeURIComponent(data.ref.replace(/ /g, '_'))}?vhe=${encodeURIComponent(VERSION.replace(/ /g, '_'))}&lang=he`, paragraphs: sourceParagraphs, ...(split ? { split } : {}) },
  };
  provenanceLeaves.push({ ref, sefariaRef: data.ref, api: apiUrl(leaf.sefaria), cache: `sources/sefard-torat-emet/raw/${leaf.file}`, versionTitle: version.versionTitle, versionSource: version.versionSource, license: version.license, sourceParagraphCount: source.length, paragraphs: sourceParagraphs, ...(split ? { split } : {}) });
}

const nodes = [
  { title: 'Birchat HaMazon', heTitle: 'ברכת המזון', key: 'Birchat HaMazon', titles: [{ text: 'Birchat HaMazon', lang: 'en', primary: true }, { text: 'ברכת המזון', lang: 'he', primary: true }], nodes: [{ depth: 1, title: 'Birchat HaMazon', heTitle: 'ברכת המזון', key: 'Birchat HaMazon', titles: [{ text: 'Birchat HaMazon', lang: 'en', primary: true }, { text: 'ברכת המזון', lang: 'he', primary: true }] }] },
  { depth: 1, title: 'Bedtime Shema', heTitle: 'קריאת שמע על המיטה', key: 'Bedtime Shema', titles: [{ text: 'Bedtime Shema', lang: 'en', primary: true }, { text: 'קריאת שמע על המיטה', lang: 'he', primary: true }] },
  { title: 'Holidays', heTitle: 'מועדים', key: 'Holidays', titles: [{ text: 'Holidays', lang: 'en', primary: true }, { text: 'מועדים', lang: 'he', primary: true }], nodes: [{ depth: 1, title: 'Yom Tov Musaf Amidah', heTitle: 'מוסף לשלוש רגלים', key: 'Yom Tov Musaf Amidah', titles: [{ text: 'Yom Tov Musaf Amidah', lang: 'en', primary: true }, { text: 'מוסף לשלוש רגלים', lang: 'he', primary: true }] }] },
];
const source = {
  index: INDEX, heTitle: HE_INDEX, nusach: 'sefard', edition: 'torat-emet-357',
  work: 'סידור ספרד (נוסח ספרד החסידי)', provider: 'Sefaria', url: 'https://www.sefaria.org/Siddur_Sefard', sefariaIndex: 'Siddur Sefard', versionTitle: VERSION,
  versionSource: 'http://www.toratemetfreeware.com/index.html?downloads', accessedAt: ACCESSED,
  license: LICENSE, attributionRequired: false,
  modified: true, changes: 'Markup only: one paragraph (Yom Tov Musaf ¶26) split in two at the edition\'s own boundary, "הַזֶּה, נַעֲשֶׂה…"; every other paragraph is Sefaria\'s, byte for byte.',
  provenance: 'sources/sefard-torat-emet/provenance.json',
};
const header = `// Generated by scripts/build-sefard-torat-emet.mjs from Sefaria "Siddur Sefard", version "${VERSION}" (Public Domain) —\n// do not edit by hand. Used only where the main Sefard pack's version lost words. Provenance: sources/sefard-torat-emet/provenance.json.\n`;
writeFileSync(OUT, `${header}export default ${JSON.stringify({ source, schema: { nodes }, texts })};\n`);
writeFileSync(PROVENANCE, `${JSON.stringify({ ...source, leaves: provenanceLeaves }, null, 2)}\n`);
console.log(`${Object.keys(texts).length} leaves, ${Object.values(texts).reduce((n, t) => n + t.he.length, 0)} paragraphs → ${OUT.pathname}`);
