// The Aramaic corpus registry of the app (Phase 0) — every text the app ships, assigned to one corpus and one dialect
// profile, and a loader that yields its paragraphs with their references. Build-time only (Node): the audit, the
// dictionary build and the corpus-regression test read it; the app never imports it.
//
// Every work file of every library pack must be claimed here (by pack and work pattern). A pack or work the registry
// does not claim fails the regression test as "NEW ARAMAIC CORPUS NOT EVALUATED" — a new text that may carry Aramaic
// is never shipped without its audit. Downloadable search packs (public/torah-packs) carry indexes only, no text
// (textIncluded: false in their manifests): their works are the library packs below.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const PACKS = 'public/library/packs';

// Dialect profiles (docs/dictionary/aramaic-corpus-inventory.md).
export const DIALECTS = Object.freeze({
  JBA: 'Jewish Babylonian Aramaic (Bavli)',
  JPA: 'Jewish Palestinian (Western) Aramaic (Yerushalmi, Midrash)',
  TARGUMIC: 'Targumic Aramaic (Onkelos)',
  ZOHARIC: 'Zoharic Aramaic (Zohar, Tikkunei Zohar, Zohar Chadash)',
  BIBLICAL_ARAMAIC: 'Biblical Aramaic (Daniel, Ezra, Jeremiah 10:11, Genesis 31:47)',
  LITURGICAL_ARAMAIC: 'Liturgical Aramaic (Kaddish, Brikh Shmeh, Yekum Purkan, Kol Chamira, Ha Lachma Anya, …)',
  MIXED_RABBINIC: 'Rabbinic Hebrew with embedded Aramaic (commentaries, halacha, responsa, later works)',
});

// Corpora of the report. `group` is the row of the coverage table; `role: 'hebrew-reference'` marks a corpus used as
// the Hebrew reference of the language classifier (its tokens are not evaluated as Aramaic).
export const CORPORA = Object.freeze([
  { id: 'bavli', group: 'Bavli', dialect: 'JBA', family: 'talmud', title: 'Talmud Bavli (37 tractates, Vilna text via Wikisource)' },
  { id: 'yerushalmi', group: 'Yerushalmi', dialect: 'JPA', family: 'talmud', title: 'Talmud Yerushalmi (Guggenheimer edition, 37 tractates)' },
  { id: 'minor-tractates', group: 'Minor tractates', dialect: 'MIXED_RABBINIC', family: 'talmud', title: 'Minor tractates and Avot DeRabbi Natan' },
  { id: 'zohar', group: 'Zohar', dialect: 'ZOHARIC', family: 'zohar', title: 'Zohar (Wikisource)' },
  { id: 'tikkunei-zohar', group: 'Tikkunei Zohar', dialect: 'ZOHARIC', family: 'kabbalah', title: 'Tikkunei Zohar' },
  { id: 'zohar-chadash', group: 'Zohar', dialect: 'ZOHARIC', family: 'kabbalah', title: 'Zohar Chadash' },
  { id: 'onkelos', group: 'Onkelos/Targum', dialect: 'TARGUMIC', family: 'targum', title: 'Targum Onkelos (Shnayim Mikra)' },
  { id: 'biblical-aramaic', group: 'Biblical Aramaic', dialect: 'BIBLICAL_ARAMAIC', family: 'torah', title: 'Aramaic of the Tanakh (UXLC 2.5)' },
  { id: 'midrash', group: 'Midrash', dialect: 'JPA', family: 'midrash', title: 'Midrash collections (and Ein Yaakov)' },
  { id: 'liturgy', group: 'Liturgical', dialect: 'LITURGICAL_ARAMAIC', family: 'liturgy', title: 'Siddurim, festival liturgy, zemirot, Haggadah' },
  { id: 'talmud-commentary', group: 'Mixed commentaries', dialect: 'MIXED_RABBINIC', family: 'talmud-commentary', title: 'Rashi, Tosafot and Rif on the Talmud' },
  { id: 'other-commentary', group: 'Mixed commentaries', dialect: 'MIXED_RABBINIC', family: 'torah', title: 'Commentaries on the Tanakh, Mishnah, Zohar, Shulchan Arukh and Tur (Beit Yosef)' },
  { id: 'other', group: 'Other', dialect: 'MIXED_RABBINIC', family: 'torah', title: 'Halacha, responsa, Kabbalah, Chassidut, Machshava, Mussar, reference, legacy books' },
  { id: 'hebrew-reference', group: 'Hebrew reference', dialect: null, family: null, role: 'hebrew-reference', title: 'Tanakh (Hebrew chapters), Mishnah, Mishneh Torah — the Hebrew reference of the classifier' },
]);
export const corpusById = id => CORPORA.find(corpus => corpus.id === id);

// Pack/work → corpus. First match wins. `work` is a RegExp on the work id (file name without .json.gz).
export const PACK_RULES = Object.freeze([
  { pack: 'wikisource-talmud-cc-by-sa', work: /^Bavli_/, corpus: 'bavli' },
  { pack: 'sefaria-collection-talmud-cc-by', work: /^Jerusalem_Talmud_/, corpus: 'yerushalmi' },
  { pack: 'sefaria-collection-talmud-public-domain', work: /./, corpus: 'minor-tractates' },
  { pack: 'wikisource-zohar-cc-by-sa', work: /^Zohar$/, corpus: 'zohar' },
  { pack: 'wikisource-zohar-cc-by-sa', work: /./, corpus: 'other-commentary' },
  { pack: 'sefaria-collection-kabbalah-public-domain', work: /^Tikkunei_Zohar$/, corpus: 'tikkunei-zohar' },
  { pack: 'sefaria-collection-kabbalah-public-domain', work: /^Zohar_Chadash$/, corpus: 'zohar-chadash' },
  { pack: 'shnayim-mikra-sefaria-pd', work: /./, corpus: 'onkelos', field: 'targum' },
  // The Tanakh: its Aramaic verses are the Biblical Aramaic corpus, every other verse is Hebrew reference.
  { pack: 'uxlc-2.5', work: /./, corpus: 'hebrew-reference', split: 'biblical-aramaic' },
  { pack: 'sefaria-torat-emet-357-mishnah', work: /./, corpus: 'hebrew-reference' },
  { pack: 'sefaria-mishneh-torah-torat-emet-363', work: /./, corpus: 'hebrew-reference' },
  { pack: /^sefaria-collection-midrash-/, work: /./, corpus: 'midrash' },
  { pack: 'sefaria-collection-tefillah-public-domain', work: /./, corpus: 'liturgy' },
  { pack: /^sefaria-talmud-commentary-/, work: /./, corpus: 'talmud-commentary' },
  { pack: /^sefaria-(tanakh|mishnah|shulchan-arukh)-commentary-|^wikisource-shulchan-arukh-commentary-|^sefaria-beit-yosef-/, work: /./, corpus: 'other-commentary' },
  { pack: /^sefaria-collection-(halacha|responsa|kabbalah|chassidut|machshava|mussar|mitzvot|reference)-|^sefaria-shulchan-arukh-pd$|^author-permission-ong-shabbat$/, work: /./, corpus: 'other' },
]);

// The Aramaic chapters of the Tanakh: [chapter, verse, chapter, verse] inclusive.
export const ARAMAIC_TANAKH = Object.freeze({ Daniel: [[2, 4, 7, 28]], Ezra: [[4, 8, 6, 18], [7, 12, 7, 26]], Jeremiah: [[10, 11, 10, 11]], Genesis: [[31, 47, 31, 47]] });
export const isAramaicVerse = (book, c, v) => (ARAMAIC_TANAKH[book] || []).some(([c1, v1, c2, v2]) => (c > c1 || (c === c1 && v >= v1)) && (c < c2 || (c === c2 && v <= v2)));
// Daniel 2:4 opens in Hebrew ("וַיְדַבְּרוּ הַכַּשְׂדִּים לַמֶּלֶךְ אֲרָמִית") and turns Aramaic at "מַלְכָּא לְעָלְמִין חֱיִי".
const ARAMAIC_FROM = Object.freeze({ 'Daniel.2.4': 'מַלְכָּא', 'Genesis.31.47': 'יְגַר' });

// Liturgy outside the library packs (the siddurim and their compositions are modules of the app).
export const LITURGY_MODULES = Object.freeze([
  'src/data/siddurOffline.mjs', 'src/data/nusach/siddurAshkenaz.mjs', 'src/data/nusach/siddurAshkenazBirnbaum.mjs', 'src/data/nusach/siddurSefard.mjs',
  'src/data/nusach/siddurSefardToratEmet.mjs', 'src/data/nusach/siddurChabad.mjs', 'src/data/nusach/siddurChabadOwner.mjs', 'src/data/nusach/siddurChabadTehillatHashem.mjs',
  'src/data/liturgy/festivalLiturgy.mjs', 'src/data/liturgy/zemirot.mjs', 'src/data/prayerPacks/edotHaMizrachWeekdayMincha.mjs', 'src/data/siddurMoadim.mjs',
]);
export const OTHER_MODULES = Object.freeze(['src/data/booksOffline.mjs']);

export function ruleFor(pack, work) {
  return PACK_RULES.find(rule => (typeof rule.pack === 'string' ? rule.pack === pack : rule.pack.test(pack)) && rule.work.test(work)) || null;
}

// Every work file of the library packs: { pack, work, file, rule }.
export function listPackWorks() {
  const out = [];
  for (const pack of readdirSync(join(ROOT, PACKS)).sort()) {
    const dir = join(ROOT, PACKS, pack);
    if (!existsSync(join(dir, 'manifest.json'))) continue;
    for (const file of readdirSync(dir).filter(name => name.endsWith('.json.gz') && !name.includes('.anchors.')).sort()) {
      const work = file.replace(/\.json\.gz$/, '');
      out.push({ pack, work, file: join(PACKS, pack, file), rule: ruleFor(pack, work) });
    }
  }
  return out;
}

const stripHtml = text => String(text).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ');
const HEBREW = /[א-ת]/;

// Every string with Hebrew letters inside a JSON-like value (liturgy modules), in document order.
function collectStrings(value, path, out) {
  if (typeof value === 'string') { if (HEBREW.test(value) && value.length > 1) out.push({ path, text: value }); return; }
  if (Array.isArray(value)) { value.forEach((item, i) => collectStrings(item, `${path}.${i}`, out)); return; }
  if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) { if (/^(heTitle|title|titles|key|sectionNames|heSectionNames|schema|source|license|url|ref|heRef|id)$/.test(key)) continue; collectStrings(item, `${path}.${key}`, out); }
}

// Paragraphs of one corpus: { corpus, ref, text }. Liturgy paragraphs are de-duplicated (the same Kaddish is printed in
// every siddur and service); pack texts are not (each is its own place in the app).
export async function* corpusParagraphs(corpusId) {
  if (corpusId === 'liturgy' || corpusId === 'other') {
    const modules = corpusId === 'liturgy' ? LITURGY_MODULES : OTHER_MODULES;
    const seen = new Set();
    for (const file of modules) {
      if (!existsSync(join(ROOT, file))) continue;
      const mod = await import(pathToFileURL(join(ROOT, file)).href);
      const strings = [];
      for (const [name, value] of Object.entries(mod)) collectStrings(value, `${file.replace(/^src\/data\//, '')}#${name}`, strings);
      for (const item of strings) {
        const text = stripHtml(item.text).replace(/\s+/g, ' ').trim();
        if (!text || seen.has(text)) continue;
        seen.add(text);
        yield { corpus: corpusId, ref: item.path, text };
      }
    }
  }
  const categories = new Map();
  for (const { pack, work, file, rule } of listPackWorks()) {
    if (!rule || (rule.corpus !== corpusId && rule.split !== corpusId)) continue;
    if (!categories.has(pack)) categories.set(pack, JSON.parse(readFileSync(join(ROOT, PACKS, pack, 'manifest.json'), 'utf8')).category || null);
    const category = categories.get(pack);
    const data = JSON.parse(gunzipSync(readFileSync(join(ROOT, file))).toString('utf8'));
    for (const node of data.nodes || []) for (const unit of node.units || []) {
      let text = unit[rule.field || 'text'];
      if (!text) continue;
      text = stripHtml(text);
      if (rule.split) {
        const [c, v] = String(unit.id).split('.').slice(-2).map(Number);
        const wantAramaic = corpusId === rule.split;
        const from = ARAMAIC_FROM[`${work}.${c}.${v}`];
        const aramaic = isAramaicVerse(work, c, v);
        if (from && aramaic) {
          // A verse that turns Aramaic mid-way: its Hebrew opening is Hebrew reference, the rest Aramaic.
          const at = text.indexOf(from);
          text = wantAramaic ? text.slice(Math.max(0, at)) : text.slice(0, Math.max(0, at));
          if (!text.trim()) continue;
        } else if (wantAramaic !== aramaic) continue;
      }
      yield { corpus: corpusId, ref: unit.id, work, category, text: unit.dh ? `${stripHtml(unit.dh)} ${text}` : text, pack };
    }
  }
}
