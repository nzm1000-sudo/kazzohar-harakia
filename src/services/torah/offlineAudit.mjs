// The offline audit, computed from the inventory (never typed by hand): for each corpus the owner named, what works
// with Wi-Fi and cellular off — the text, the global search, the in-book search, the commentaries, the deep links —
// what needs the network, its size on the device and its rights. docs/library/torah-engine.md prints this table and
// tests/offlineAudit.test.mjs holds it true.
import { WORKS } from '../../data/library/registry.mjs';
import { BUNDLED_TEXT_WORKS, capabilitiesOf, rightsOf, RIGHTS, isBundledRemote } from './inventory.mjs';

const pubOrLayer = work => work.public || work.layerOnly;
const bytesOf = work => {
  const edition = work.editions?.[0];
  if (BUNDLED_TEXT_WORKS[work.workId]) return BUNDLED_TEXT_WORKS[work.workId].bytes;
  if (work.kind !== 'pack' || !edition) return 0;
  return edition.parts?.length ? edition.parts.reduce((sum, part) => sum + (part.bytes || 0), 0) : edition.bytes || 0;
};
const is = (...ids) => work => ids.includes(work.workId);
const startsWith = prefix => work => work.workId.startsWith(prefix);
const baseOf = id => work => work.relation?.baseWorkId === id;

// The corpora of the audit, in the owner's order. Each: the texts, and the commentaries read beside them.
export const AUDIT_CORPORA = Object.freeze([
  { id: 'tanakh', title: 'תנ״ך', texts: work => work.primaryCategory === 'tanakh', layers: work => work.primaryCategory === 'tanakh-commentary' },
  { id: 'tanakh-commentary', title: 'מפרשי התנ״ך', texts: work => work.primaryCategory === 'tanakh-commentary' },
  { id: 'mishnah', title: 'משנה', texts: work => work.primaryCategory === 'mishnah', layers: work => work.primaryCategory === 'mishnah-commentary' },
  { id: 'mishnah-commentary', title: 'מפרשי המשנה', texts: work => work.primaryCategory === 'mishnah-commentary' },
  { id: 'bavli', title: 'תלמוד בבלי', texts: work => work.primaryCategory === 'talmud' && work.reader === 'talmud' && work.group !== 'yerushalmi' && work.group !== 'minor', layers: work => work.primaryCategory === 'talmud-commentary', scans: true },
  { id: 'rashi', title: 'רש״י על התלמוד', texts: startsWith('Rashi_on_'), filter: work => work.primaryCategory === 'talmud-commentary' },
  { id: 'tosafot', title: 'תוספות', texts: startsWith('Tosafot_on_'), filter: work => work.primaryCategory === 'talmud-commentary' },
  { id: 'rif', title: 'רי״ף', texts: startsWith('Rif_') },
  { id: 'rambam', title: 'רמב״ם', texts: work => work.primaryCategory === 'rambam' },
  { id: 'shulchan-arukh', title: 'שולחן ערוך', texts: work => work.kind === 'pack' && /^Shulchan_Arukh__/.test(work.workId), layers: work => /^Shulchan_Arukh__/.test(work.relation?.baseWorkId || '') },
  { id: 'mishnah-berurah', title: 'משנה ברורה', texts: is('Mishnah_Berurah') },
  { id: 'biur-halacha', title: 'ביאור הלכה', texts: is('Biur_Halacha') },
  { id: 'baer-hetev', title: 'באר היטב', texts: work => /^Baer_Hetev_on_Shulchan_Arukh/.test(work.workId) },
  { id: 'kaf-hachaim', title: 'כף החיים', texts: work => /^Kaf_HaChayim_on_Shulchan_Arukh/.test(work.workId) || work.workId === 'halacha.kaf-hachayim-oc' },
  { id: 'yalkut-yosef', title: 'ילקוט יוסף', texts: is('halacha.yalkut-yosef-tashz') },
  { id: 'oneg-shabbat', title: 'עונג שבת', texts: is('Oneg_Shabbat', 'Oneg_Shabbat_Notes') },
  { id: 'zohar', title: 'זוהר', texts: is('Zohar'), layers: baseOf('Zohar') },
  { id: 'midrash', title: 'מדרש', texts: work => work.primaryCategory === 'midrash' },
  { id: 'chassidut', title: 'חסידות', texts: work => work.primaryCategory === 'chassidut' },
  { id: 'responsa', title: 'שו״ת', texts: work => work.primaryCategory === 'responsa' },
  { id: 'other-shelves', title: 'מחשבה, מוסר, קבלה, מצוות, עיון', texts: work => ['machshava', 'mussar', 'kabbalah', 'mitzvot', 'reference'].includes(work.primaryCategory) && work.workId !== 'Zohar' && work.relation?.baseWorkId !== 'Zohar' },
]);

// One row: counts of works by where their text and search live. search: 'built-in' | 'pack' | 'title' | 'none'.
export function auditCorpus(corpus, works = WORKS) {
  const texts = works.filter(work => pubOrLayer(work) && corpus.texts(work) && (!corpus.filter || corpus.filter(work)));
  const local = texts.filter(work => capabilitiesOf(work).offline);
  const remote = texts.filter(work => work.kind === 'remote' && !isBundledRemote(work));
  const hidden = works.filter(work => !pubOrLayer(work) && corpus.texts(work) && rightsOf(work) === RIGHTS.UNKNOWN);
  const search = texts.map(work => capabilitiesOf(work));
  const layers = corpus.layers ? works.filter(work => work.layerOnly !== undefined && corpus.layers(work) && pubOrLayer(work)) : [];
  const localLayers = layers.filter(work => capabilitiesOf(work).offline);
  const rights = [...new Set(texts.map(rightsOf))].sort();
  return {
    id: corpus.id,
    title: corpus.title,
    works: texts.length,
    textOffline: local.length === texts.length ? 'full' : local.length ? 'partial' : 'none',
    localWorks: local.length,
    onlineOnlyWorks: remote.map(work => work.workId),
    globalSearch: {
      builtIn: search.filter(item => item.globalSearch === 'full-text').length,
      pack: [...new Set(search.map(item => item.fullTextPack).filter(Boolean))],
      packWorks: search.filter(item => item.fullTextPack).length,
      titleOnly: search.filter(item => item.globalSearch === 'title' && !item.fullTextPack).length,
    },
    bookSearchOffline: texts.filter(work => capabilitiesOf(work).bookSearch && capabilitiesOf(work).offline).length,
    commentaries: corpus.layers ? { layers: layers.length, offline: localLayers.length, onlineOnly: layers.length - localLayers.length } : null,
    deepLinkOffline: local.every(work => work.kind === 'pack' || isBundledRemote(work)) ? 'exact' : 'book',
    scansOffline: corpus.scans ? false : null,
    requiresNetwork: [
      ...(remote.length ? [`${remote.length} works read online`] : []),
      ...(corpus.layers && layers.length > localLayers.length ? [`${layers.length - localLayers.length} commentary layers read online`] : []),
      ...(corpus.scans ? ['page scans (צורת הדף)'] : []),
    ],
    bytes: texts.reduce((sum, work) => sum + bytesOf(work), 0),
    rights,
    hiddenForRights: hidden.map(work => work.workId),
  };
}
export const offlineAudit = (works = WORKS) => AUDIT_CORPORA.map(corpus => auditCorpus(corpus, works));

// The whole library on the device, for the offline page.
export function offlineSummary(works = WORKS) {
  const published = works.filter(work => work.public && !work.layerOnly);
  const local = published.filter(work => capabilitiesOf(work).offline);
  return {
    books: published.length,
    localBooks: local.length,
    onlineOnlyBooks: published.length - local.length,
    textBytes: works.reduce((sum, work) => sum + bytesOf(work), 0),
    builtInSearchBooks: published.filter(work => capabilitiesOf(work).globalSearch === 'full-text').length,
    packSearchBooks: published.filter(work => capabilitiesOf(work).fullTextPack).length,
    onlineOnlyLayers: works.filter(work => work.layerOnly && work.kind === 'remote').length,
    // The commentators read from the network only, by name (מלבי״ם, מגן אברהם, ט״ז, רא״ש…), most layers first.
    onlineOnlyNames: Object.entries(works.filter(work => work.layerOnly && work.kind === 'remote').reduce((names, work) => { const name = work.layerTitle || work.title; names[name] = (names[name] || 0) + 1; return names; }, {})).sort((a, b) => b[1] - a[1]).map(([name]) => name),
  };
}
