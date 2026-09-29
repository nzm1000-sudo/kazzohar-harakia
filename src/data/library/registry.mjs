// Central library registry: taxonomy, sources, licenses, works/editions and the acquisition queue.
// Works enter the public library only with a known source, edition, license and structure.
import PACK_INDEX from './packIndex.mjs';
import COLLECTION_INDEX from './collectionIndex.mjs';
import CORPUS_INDEX, { BLOCKED_LAYERS, COMMENTATORS, CORPUS_REPORTS, REMOTE_LAYERS } from './corpusIndex.mjs';
import COLLECTION_REPORTS from './collectionReports.mjs';
import IMPORT_REPORTS from './importReports.mjs';
import LEGACY_METADATA from './legacyMetadata.mjs';
import { BOOK_CATALOG } from '../bookCatalog.mjs';
import talmudCatalog from '../talmudCatalog.mjs';
import { HALACHA_WORKS } from '../halachaLibrary.mjs';
import { COVERAGE } from '../../services/library/integrity.mjs';
import { paginationTitles } from '../../services/library/pagination.mjs';

export { COVERAGE };
const UNKNOWN = 'UNKNOWN';

export const TAXONOMY = Object.freeze([
  { id: 'tanakh', title: 'תנ״ך', groups: [['torah', 'תורה'], ['neviim-rishonim', 'נביאים ראשונים'], ['neviim-acharonim', 'נביאים אחרונים'], ['ketuvim', 'כתובים']] },
  { id: 'mishnah', title: 'משנה', groups: [['zeraim', 'סדר זרעים'], ['moed', 'סדר מועד'], ['nashim', 'סדר נשים'], ['nezikin', 'סדר נזיקין'], ['kodashim', 'סדר קדשים'], ['tahorot', 'סדר טהרות']] },
  { id: 'talmud', title: 'תלמוד', groups: [['zeraim', 'סדר זרעים'], ['moed', 'סדר מועד'], ['nashim', 'סדר נשים'], ['nezikin', 'סדר נזיקין'], ['kodashim', 'סדר קדשים'], ['tahorot', 'סדר טהרות'], ['yerushalmi', 'תלמוד ירושלמי'], ['minor', 'מסכתות קטנות']] },
  { id: 'midrash', title: 'מדרש', groups: [['halacha', 'מדרשי הלכה'], ['rabbah', 'מדרש רבה'], ['aggadah', 'מדרשי אגדה']] },
  { id: 'halacha', title: 'הלכה', groups: [['yesod', 'ספרי יסוד'], ['rishonim', 'ראשונים'], ['tur-beit-yosef', 'טור ובית יוסף'], ['shulchan-arukh', 'שולחן ערוך ונושאי כליו'], ['acharonim', 'אחרונים'], ['sephardic-psak', 'פסיקה ספרדית'], ['modern', 'פסיקה בת זמננו']] },
  { id: 'rambam', title: 'משנה תורה לרמב״ם', groups: [['madda', 'ספר המדע'], ['ahavah', 'ספר אהבה'], ['zemanim', 'ספר זמנים'], ['nashim', 'ספר נשים'], ['kedushah', 'ספר קדושה'], ['haflaah', 'ספר הפלאה'], ['zeraim', 'ספר זרעים'], ['avodah', 'ספר עבודה'], ['korbanot', 'ספר קרבנות'], ['taharah', 'ספר טהרה'], ['nezikim', 'ספר נזיקים'], ['kinyan', 'ספר קניין'], ['mishpatim', 'ספר משפטים'], ['shoftim', 'ספר שופטים']] },
  { id: 'responsa', title: 'שו״ת', groups: [['geonim', 'גאונים'], ['rishonim', 'ראשונים'], ['acharonim', 'אחרונים']] },
  { id: 'tanakh-commentary', title: 'מפרשי המקרא', groups: [['rashi', 'רש״י'], ['ramban', 'רמב״ן'], ['ibn-ezra', 'אבן עזרא'], ['sforno', 'ספורנו'], ['or-hachaim', 'אור החיים'], ['kli-yakar', 'כלי יקר']] },
  { id: 'mishnah-commentary', title: 'מפרשי המשנה', groups: [['bartenura', 'ברטנורא'], ['tosafot-yom-tov', 'תוספות יום טוב']] },
  { id: 'talmud-commentary', title: 'מפרשי הש״ס', groups: [['rashi', 'רש״י'], ['tosafot', 'תוספות'], ['rif', 'רי״ף']] },
  { id: 'rishonim', title: 'ראשונים', groups: [] },
  { id: 'acharonim', title: 'אחרונים', groups: [] },
  { id: 'mitzvot', title: 'ספרי מצוות', groups: [] },
  { id: 'mussar', title: 'מוסר', groups: [['rishonim', 'ראשונים'], ['acharonim', 'אחרונים']] },
  { id: 'machshava', title: 'מחשבה ואמונה', groups: [['rishonim', 'ראשונים'], ['maharal', 'ספרי המהר״ל'], ['acharonim', 'אחרונים']] },
  { id: 'kabbalah', title: 'קבלה', groups: [['yesod', 'ספרי יסוד'], ['zohar-commentary', 'מפרשי הזהר'], ['ari', 'כתבי האר״י'], ['others', 'ספרי קבלה נוספים']] },
  { id: 'chassidut', title: 'חסידות', groups: [['early', 'ראשית החסידות'], ['poland', 'חסידות פולין וגליציה'], ['breslov', 'ברסלב'], ['tzadok', 'ר׳ צדוק הכהן מלובלין'], ['piaseczno', 'האדמו״ר מפיאסצנה'], ['chabad', 'חב״ד']] },
  { id: 'minhagim', title: 'מנהגים', groups: [] },
  { id: 'tefillah', title: 'תפילה', groups: [] },
  { id: 'toldot', title: 'תולדות חכמים', groups: [] },
  { id: 'reference', title: 'ספרי עזר ומילונים', groups: [] },
  { id: 'modern', title: 'ספרי זמננו', groups: [] },
]);
export const categoryById = id => TAXONOMY.find(category => category.id === id) || null;

export const SOURCES = Object.freeze({
  'tanach-us': { id: 'tanach-us', title: 'Tanach.us — Unicode/XML Leningrad Codex', url: 'https://www.tanach.us/' },
  sefaria: { id: 'sefaria', title: 'Sefaria', url: 'https://www.sefaria.org/' },
  'torat-emet': { id: 'torat-emet', title: 'תורת אמת', url: 'https://www.toratemetfreeware.com/' },
  wikisource: { id: 'wikisource', title: 'ויקיטקסט העברי', url: 'https://he.wikisource.org/' },
});

// Sefaria is a provider, not a license: each edition carries its own terms.
export const LICENSES = Object.freeze({
  'uxlc-free': { id: 'uxlc-free', title: 'UXLC — שימוש והעתקה ללא הגבלה', statement: 'All biblical Hebrew text may be viewed or copied without restriction; citation appreciated.', url: 'https://www.tanach.us/License.html', attribution: 'Unicode/XML Leningrad Codex, Tanach.us Inc.', redistributionAllowed: true, offlineAllowed: true, commercialUseAllowed: true, modificationAllowed: UNKNOWN },
  'public-domain': { id: 'public-domain', title: 'נחלת הכלל', statement: 'Public Domain', attribution: 'מקור ומהדורה מצוינים', redistributionAllowed: true, offlineAllowed: true, commercialUseAllowed: true, modificationAllowed: true },
  'cc-by': { id: 'cc-by', title: 'CC-BY', statement: 'Creative Commons Attribution', attribution: 'ייחוס חובה', redistributionAllowed: true, offlineAllowed: true, commercialUseAllowed: true, modificationAllowed: true },
  'cc-by-sa': { id: 'cc-by-sa', title: 'CC-BY-SA', statement: 'Creative Commons Attribution-ShareAlike', attribution: 'ייחוס חובה; שיתוף זהה', redistributionAllowed: true, offlineAllowed: true, commercialUseAllowed: true, modificationAllowed: true },
  'cc-by-nc': { id: 'cc-by-nc', title: 'CC-BY-NC', statement: 'Creative Commons Attribution-NonCommercial', attribution: 'ייחוס חובה; שימוש לא־מסחרי', redistributionAllowed: true, offlineAllowed: true, commercialUseAllowed: false, modificationAllowed: true },
  'cc-by-nc-sa': { id: 'cc-by-nc-sa', title: 'CC BY-NC-SA 2.5', statement: 'Creative Commons Attribution-NonCommercial-ShareAlike 2.5', attribution: 'ייחוס חובה; שימוש לא־מסחרי; שיתוף זהה', redistributionAllowed: true, offlineAllowed: true, commercialUseAllowed: false, modificationAllowed: true },
  // Not a public licence: a named work used because its author gave permission (recorded by the owner). Allowed only
  // for the works listed in AUTHOR_PERMISSION_WORKS; the tests refuse it anywhere else.
  'author-permission': { id: 'author-permission', title: 'באישור המחבר', statement: 'באישור המחבר; כל הזכויות שמורות למחבר', attribution: 'שם הספר, המחבר ו"באישור המחבר, כל הזכויות שמורות" מוצגים מתחת לטקסט', redistributionAllowed: true, offlineAllowed: true, commercialUseAllowed: UNKNOWN, modificationAllowed: false, scope: 'this work only, as permitted by its author' },
  unknown: { id: 'unknown', title: 'LICENSE_UNKNOWN', statement: UNKNOWN, attribution: UNKNOWN, redistributionAllowed: UNKNOWN, offlineAllowed: UNKNOWN, commercialUseAllowed: UNKNOWN, modificationAllowed: UNKNOWN },
});

// Works whose text the app carries by their author's permission (rights basis "author-permission"), each named with the
// permission's record. Nothing else may carry that licence.
export const AUTHOR_PERMISSION_WORKS = Object.freeze({
  Oneg_Shabbat: { work: 'עונג שבת', author: 'הרב ישראל שריקי', edition: 'מהדורה ראשונה תשע״ג', copyright: 'כל הזכויות שמורות (בדפוס)', rightsBasis: 'author-permission', permissionStatedBy: 'בעל האפליקציה', permissionEvidence: 'written permission to be kept by the owner — not stored in the repo', provenance: 'sources/ong-shabbat/provenance.json' },
  Oneg_Shabbat_Notes: { work: 'עונג שבת · מקורות וטעמים', author: 'הרב ישראל שריקי', edition: 'מהדורה ראשונה תשע״ג', copyright: 'כל הזכויות שמורות (בדפוס)', rightsBasis: 'author-permission', permissionStatedBy: 'בעל האפליקציה', permissionEvidence: 'written permission to be kept by the owner — not stored in the repo', provenance: 'sources/ong-shabbat/provenance.json' },
});

export function licenseIdFor(value) {
  const text = String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!text || text === 'unknown' || text === 'null') return 'unknown';
  if (text === 'public domain' || text === 'pd') return 'public-domain';
  if (/cc0/.test(text)) return 'public-domain';
  if (/by-nc-sa|by nc sa/.test(text)) return 'cc-by-nc-sa';
  if (/by-nc/.test(text)) return 'cc-by-nc';
  if (/by-sa/.test(text)) return 'cc-by-sa';
  if (/^cc-by$|^cc by$/.test(text)) return 'cc-by';
  return 'unknown';
}

const reportByWork = new Map([...IMPORT_REPORTS.reports, ...COLLECTION_REPORTS.reports].map(report => [report.workId, report]));
const COLLECTION_TAGS = { Oneg_Shabbat: ['sephardic'], Ben_Ish_Hai: ['sephardic'], Responsa_Rav_Pealim: ['sephardic'], Avkat_Rokhel: ['sephardic'], Responsa_Maharashdam: ['sephardic'], Moreh_BeEtzba: ['sephardic'] };

// ---------- Packaged, integrity-validated works ----------
// Corpus packs come first: a work with printed pagination (the Zohar) leads its group, its commentaries follow it.
// A corpus work carries its relation (commentary/translation of which base work), per-page anchors and an honest
// coverage record; its page names come from the pagination descriptor, not from stored titles.
const packagedWorks = [...CORPUS_INDEX, ...PACK_INDEX, ...COLLECTION_INDEX].flatMap(pack => pack.works.map(work => ({
  workId: work.workId,
  title: work.heTitle,
  shortTitle: work.shortTitle || undefined,
  sourceTitle: work.title,
  aliases: work.aliases || [],
  authors: work.authors.length ? work.authors : [],
  compDate: work.compDate || null,
  primaryCategory: pack.category || pack.family,
  group: work.group,
  secondaryCategories: pack.category === 'rambam' ? ['halacha'] : [],
  tags: pack.family === 'shulchan-arukh' ? ['sephardic'] : COLLECTION_TAGS[work.workId] || [],
  kind: 'pack',
  coverage: work.coverage?.coverageStatus || work.status,
  coverageDetail: work.coverage || null,
  relation: work.relation || null,
  // A commentary is named by its commentator where it sits under a verse (רש״י), by its book elsewhere.
  layerTitle: work.layerTitle || null,
  layerRank: work.layerRank || null,
  translationSought: work.translationSought || false,
  // A work may name its own reader tabs (עונג שבת: "לשון הספר" / "מקורות וטעמים"); a layer-only work (a book's notes)
  // is read beside its base work, never listed as a book of its own.
  tabNames: work.tabNames || null,
  layerOnly: Boolean(work.layerOnly),
  // The Talmud: the local text opens in the Talmud reader (its modes: with explanation, Gemara, study, page image).
  reader: work.reader || null,
  firstAmud: work.firstAmud || null,
  route: work.reader === 'talmud' ? `talmud/${encodeURIComponent(work.title)}` : undefined,
  structureSummary: work.reader === 'talmud' ? `${work.nodes.filter(Boolean).length} עמודים` : undefined,
  // A book that belongs to a tractate without being anchored to its pages (the Rif, on his own pages).
  onTractate: work.onTractate || null,
  rights: AUTHOR_PERMISSION_WORKS[work.workId] || null,
  validation: 'VERIFIED',
  missingUnits: work.missingUnits,
  editions: [{
    editionId: `${pack.packId}:${work.workId}`,
    packId: pack.packId,
    file: work.file,
    checksum: work.checksum,
    bytes: work.bytes,
    nodes: work.nodes,
    expected: work.expected,
    title: work.editionTitle || pack.edition.title,
    heTitle: work.editionHeTitle || (work.editionTitle ? work.editionTitle : pack.edition.heTitle),
    versionSource: work.versionSource || null,
    editor: pack.edition.editor,
    notes: pack.edition.notes,
    language: 'he',
    sourceProvider: work.provider || pack.source,
    sourceIdentifier: work.title,
    sourceUrl: pack.sourceUrl,
    license: work.license || pack.license,
    recordedLicense: work.recordedLicense || null,
    attribution: work.attribution || null,
    sourceLine: work.sourceLine || null,
    licenseVerifiedAt: work.licenseVerifiedAt || null,
    contentVersion: pack.contentVersion,
    retrievedAt: pack.retrievedAt,
    structure: pack.structure,
    nodeLabel: work.nodeLabel || pack.nodeLabel,
    unitLabel: work.unitLabel || pack.unitLabel,
    baseUnitLabel: work.baseUnitLabel || null,
    pagination: work.pagination || null,
    nodeTitles: work.pagination ? paginationTitles(work.pagination) : work.nodeTitles || null,
    sections: work.sections || null,
    anchorsFile: work.anchorsFile || null,
    anchorsChecksum: work.anchorsChecksum || null,
    anchorNodes: work.anchorNodes || null,
    // Stored in files by node range (a siman loads only its own file), and what each seif has (the Shulchan Arukh).
    parts: work.parts || null,
    seifCounts: work.seifCounts || null,
    policy: pack.policy,
    coverage: work.coverage?.coverageStatus || work.status,
  }],
})));

// ---------- Previously bundled flat books: text present, completeness not provable (no structure) ----------
const LEGACY_PLACEMENT = {
  'ben-porat-yosef': ['chassidut'], 'noam-elimelech': ['chassidut'], 'tzafnat-paneach': ['chassidut', 'tanakh-commentary'],
  'toldot-yaakov-yosef': ['chassidut'], 'likutei-moharan': ['chassidut'], 'likutei-etzot': ['chassidut'],
  'sippurei-maasiyot': ['chassidut'], 'sefer-hamiddot': ['chassidut'], 'agra-d-kala': ['chassidut'],
  'bnei-yissachar': ['chassidut'], 'chiddushei-harim': ['chassidut', 'tanakh-commentary'], 'keter-shem-tov': ['chassidut'],
  'chovot-halevavot': ['mussar', 'machshava', 'rishonim'], 'orchot-tzadikim': ['mussar'], 'yesod-hateshuvah': ['mussar', 'rishonim'],
  'menorat-hamaor': ['mussar'], 'sefer-hayashar': ['mussar'], 'shaarei-teshuvah': ['mussar', 'rishonim'],
  'tomer-devorah': ['mussar', 'kabbalah'], 'yaarot-devash': ['mussar'], 'mesillat-yesharim': ['mussar'],
  'pele-yoetz': ['mussar'], 'shnei-luchot-habrit': ['mussar', 'kabbalah', 'minhagim'], 'or-hatzafon': ['mussar', 'modern'],
  'chovot-hatalmidim': ['mussar', 'chassidut'], 'sichot-avodat-levi': ['mussar', 'modern'],
  'otzar-laazei-rashi': ['reference'], 'millon-shimushi-latalmud': ['reference'], 'seder-hadorot': ['toldot', 'reference'],
};
const SEPHARDIC = new Set(['pele-yoetz', 'menorat-hamaor']);
const LEGACY_GROUP = {
  'ben-porat-yosef': 'early', 'noam-elimelech': 'early', 'tzafnat-paneach': 'early', 'toldot-yaakov-yosef': 'early', 'keter-shem-tov': 'early',
  'likutei-moharan': 'breslov', 'likutei-etzot': 'breslov', 'sippurei-maasiyot': 'breslov', 'sefer-hamiddot': 'breslov',
  'agra-d-kala': 'poland', 'bnei-yissachar': 'poland', 'chiddushei-harim': 'poland',
  'chovot-halevavot': 'rishonim', 'orchot-tzadikim': 'rishonim', 'yesod-hateshuvah': 'rishonim', 'menorat-hamaor': 'rishonim', 'sefer-hayashar': 'rishonim', 'shaarei-teshuvah': 'rishonim',
  'tomer-devorah': 'acharonim', 'yaarot-devash': 'acharonim', 'mesillat-yesharim': 'acharonim', 'pele-yoetz': 'acharonim', 'shnei-luchot-habrit': 'acharonim', 'or-hatzafon': 'acharonim', 'chovot-hatalmidim': 'acharonim', 'sichot-avodat-levi': 'acharonim',
};

const legacyWorks = BOOK_CATALOG.filter(book => LEGACY_PLACEMENT[book.id]).map(book => {
  const refs = book.reference.split(/\s*;\s*/);
  const meta = refs.map(ref => LEGACY_METADATA[ref] || { ref, authors: [], units: 0 });
  const licenses = [...new Set(meta.map(item => licenseIdFor(item.sourceLicense || item.storedLicense)))];
  const license = licenses.length === 1 ? licenses[0] : 'unknown';
  const [primaryCategory, ...secondaryCategories] = LEGACY_PLACEMENT[book.id];
  return {
    workId: `legacy.${book.id}`,
    title: book.title,
    sourceTitle: refs.join('; '),
    authors: [...new Set(meta.flatMap(item => item.authors))],
    era: meta[0]?.era || null,
    compDate: meta[0]?.compDate || null,
    primaryCategory,
    group: LEGACY_GROUP[book.id] || null,
    secondaryCategories,
    tags: SEPHARDIC.has(book.id) ? ['sephardic'] : [],
    kind: 'legacy',
    coverage: COVERAGE.PARTIAL,
    validation: 'UNVERIFIED',
    partialReason: 'השלמות של המהדורה טרם הוכחה: הטקסט שמור כרצף פסקאות ללא מבנה מאומת.',
    editions: meta.map(item => ({
      editionId: `sefaria:${item.ref}:${item.storedVersion || UNKNOWN}`,
      ref: item.ref,
      title: item.storedVersion || UNKNOWN,
      language: 'he',
      sourceProvider: 'sefaria',
      sourceIdentifier: item.ref,
      sourceUrl: `https://www.sefaria.org/${encodeURIComponent(item.ref)}?lang=he`,
      versionSource: item.versionSource || null,
      license: licenseIdFor(item.sourceLicense || item.storedLicense),
      units: item.units,
      retrievedAt: UNKNOWN,
      coverage: COVERAGE.PARTIAL,
    })),
    license,
    // Unclear rights: kept out of the public library until resolved.
    public: license !== 'unknown' && meta.every(item => item.units > 10),
  };
});

// ---------- Remote readers that already exist in the app ----------
// A tractate whose Gemara is in a local pack (scripts/library/build-talmud.mjs) is listed once, as that pack work.
const LOCAL_TALMUD = new Set(packagedWorks.filter(work => work.reader === 'talmud').map(work => work.workId));
const SEDER_ID = { 'Seder Zeraim': 'zeraim', 'Seder Moed': 'moed', 'Seder Nashim': 'nashim', 'Seder Nezikin': 'nezikin', 'Seder Kodashim': 'kodashim', 'Seder Tahorot': 'tahorot' };
const talmudWorks = talmudCatalog.tractates.filter(tractate => tractate.steinsaltz && !LOCAL_TALMUD.has(`Bavli_${tractate.title.replace(/['’]/g, '').replaceAll(' ', '_')}`)).map(tractate => ({
  workId: `Bavli_${tractate.title.replace(/['’]/g, '').replaceAll(' ', '_')}`,
  title: `תלמוד בבלי · ${tractate.heTitle}`,
  shortTitle: tractate.heTitle,
  sourceTitle: tractate.title,
  authors: [],
  primaryCategory: 'talmud',
  group: SEDER_ID[tractate.seder] || null,
  secondaryCategories: [],
  tags: [],
  kind: 'remote',
  route: `talmud/${encodeURIComponent(tractate.title)}`,
  firstAmud: tractate.firstAmud,
  coverage: COVERAGE.REMOTE_ONLY,
  validation: 'STRUCTURE_FROM_SOURCE',
  structureSummary: `${tractate.amudCount} עמודים`,
  editions: [{ editionId: `sefaria:${tractate.title}:${tractate.baseVersion?.title}`, title: tractate.baseVersion?.title || UNKNOWN, language: 'he', sourceProvider: 'sefaria', sourceIdentifier: tractate.title, license: licenseIdFor(tractate.baseVersion?.license), retrievedAt: talmudCatalog.generated, coverage: COVERAGE.REMOTE_ONLY }],
  license: licenseIdFor(tractate.baseVersion?.license),
  public: true,
}));

const HALACHA_PLACEMENT = {
  'shulchan-arukh-oc': 'shulchan-arukh', 'shulchan-arukh-yd': 'shulchan-arukh', 'shulchan-arukh-cm': 'shulchan-arukh', 'shulchan-arukh-eh': 'shulchan-arukh',
  'beit-yosef-oc': 'tur-beit-yosef', 'kaf-hachayim-oc': 'shulchan-arukh', 'ben-ish-hai': 'acharonim', 'yalkut-yosef-tashz': 'sephardic-psak', 'peninei-halakhah': 'modern',
};
const HALACHA_SEPHARDIC = new Set(['shulchan-arukh-oc', 'shulchan-arukh-yd', 'shulchan-arukh-cm', 'shulchan-arukh-eh', 'beit-yosef-oc', 'kaf-hachayim-oc', 'ben-ish-hai', 'yalkut-yosef-tashz']);
const halachaWorks = HALACHA_WORKS.filter(work => HALACHA_PLACEMENT[work.id]).map(work => ({
  workId: `halacha.${work.id}`,
  title: work.title,
  sourceTitle: work.indexTitle,
  authors: work.author ? [work.author] : [],
  primaryCategory: 'halacha',
  group: HALACHA_PLACEMENT[work.id],
  // The owner's review (2026-09-29): no separate "אחרונים" shelf — כף החיים lives under הלכה › שולחן ערוך ונושאי כליו.
  secondaryCategories: [],
  tags: HALACHA_SEPHARDIC.has(work.id) ? ['sephardic'] : [],
  kind: 'remote',
  route: `halacha/b/${encodeURIComponent(work.id)}`,
  coverage: work.id === 'yalkut-yosef-tashz' ? COVERAGE.PARTIAL : COVERAGE.REMOTE_ONLY,
  validation: 'STRUCTURE_FROM_SOURCE',
  partialReason: work.id === 'yalkut-yosef-tashz' ? 'המהדורה המקומית (תשס״ז, תורת אמת) טרם עברה בדיקת שלמות.' : null,
  editions: [{ editionId: `${work.provider}:${work.indexTitle}`, title: work.indexTitle, language: 'he', sourceProvider: work.provider, sourceIdentifier: work.indexTitle, sourceUrl: work.sourceUrl, license: licenseIdFor(work.license), retrievedAt: UNKNOWN, coverage: work.id === 'yalkut-yosef-tashz' ? COVERAGE.PARTIAL : COVERAGE.REMOTE_ONLY }],
  license: licenseIdFor(work.license),
  public: true,
}));

// ---------- Layers read live from a provider (one exact edition; no copy in the bundle) ----------
// They are reached from the page they explain (the reader's מפרשים tab), not listed as books of their own.
const remoteLayerWorks = REMOTE_LAYERS.map(layer => ({
  workId: layer.workId,
  title: layer.heTitle,
  sourceTitle: layer.title,
  authors: layer.authors || [],
  primaryCategory: layer.category || 'kabbalah',
  group: layer.group || 'zohar-commentary',
  layerTitle: layer.layerTitle || null,
  layerRank: layer.layerRank || null,
  secondaryCategories: [],
  tags: [],
  kind: 'remote',
  layerOnly: true,
  route: null,
  coverage: COVERAGE.REMOTE_ONLY,
  coverageDetail: layer.coverage,
  relation: layer.relation,
  validation: 'STRUCTURE_FROM_SOURCE',
  // A layer of several parts of one index (ערוך השולחן) is told apart by its refPattern, so its edition id names it.
  editions: [{ editionId: `${layer.provider}:${layer.title}:${layer.versionTitle}${layer.refPattern?.includes(',') ? `:${layer.refPattern.split(', ')[1].replace(' {chapter}', '')}` : ''}`, title: layer.versionTitle, heTitle: layer.heVersion || layer.versionTitle, language: 'he', sourceProvider: layer.provider, sourceIdentifier: layer.title, versionTitle: layer.versionTitle, versionSource: layer.versionSource, refPattern: layer.refPattern, anchorNodes: layer.anchorNodes, license: layer.license, recordedLicense: layer.recordedLicense, licenseVerifiedAt: layer.licenseVerifiedAt, retrievedAt: layer.licenseVerifiedAt, coverage: COVERAGE.REMOTE_ONLY, attribution: layer.attribution || null, unitLabel: layer.unitLabel || null, joinParagraphs: Boolean(layer.joinParagraphs), seifMap: layer.seifMap || null, seifCounts: layer.seifCounts || null }],
  license: layer.license,
  public: false,
}));

// The owner's review (2026-09-29): the Haggadah is read in the siddur (מועדים › פסח, nusach Edot HaMizrach), not as a
// book; with it the "תפילה" shelf is empty and disappears. The pack stays (nothing is deleted), it is only not listed.
const HIDDEN_FROM_BOOKS = new Set(['Pesach_Haggadah']);
export const WORKS = Object.freeze([...packagedWorks.map(work => ({ ...work, license: work.editions[0].license, public: !HIDDEN_FROM_BOOKS.has(work.workId) })), ...legacyWorks, ...talmudWorks, ...halachaWorks.map(work => ({ ...work, supersededBy: packagedWorks.find(pack => pack.sourceTitle.replace(/'/g, '') === String(work.sourceTitle).replace(/'/g, ''))?.workId || null })).map(work => (work.supersededBy ? { ...work, public: false } : work)), ...remoteLayerWorks]);
export const PUBLIC_WORKS = WORKS.filter(work => work.public && !work.layerOnly);
export const EDITIONS = WORKS.flatMap(work => work.editions.map(edition => ({ ...edition, workId: work.workId })));
export const workById = id => WORKS.find(work => work.workId === id) || null;
export const worksInCategory = id => PUBLIC_WORKS.filter(work => work.primaryCategory === id || work.secondaryCategories.includes(id));

// Evidence from Sefaria API queries (2026-09-25). Nothing here is shown as library content.
export const ACQUISITION_QUEUE = Object.freeze([
  { title: 'שולחן ערוך · ארבעה חלקים (ייבוא מלא ללא אינטרנט)', status: 'AVAILABLE_OPEN', evidence: 'Sefaria: "Torat Emet 363" / "Maginei Eretz, Lemberg 1893" — Public Domain' },
  { title: 'בית יוסף', status: 'AVAILABLE_OPEN', evidence: 'Sefaria: "Tur … Vilna, 1923" — Public Domain' },
  { title: 'טור', status: 'AVAILABLE_OPEN', evidence: 'Sefaria: "Orach Chaim, Vilna, 1923" — Public Domain' },
  { title: 'כף החיים', status: 'AVAILABLE_OPEN', evidence: 'נארז (2026-09-29): Sefaria "Kaf Hachayim, Orach Chayim vol. I-IV" + "vol. V-VIII, Jerusalem 1910-1933" — מהדורה אחת בשני חצאים, Public Domain (sefaria-shulchan-arukh-commentary-public-domain); יורה דעה נטען ברשת' },
  { title: 'משנה ברורה · ביאור הלכה', status: 'AVAILABLE_OPEN', evidence: 'נארז (2026-09-29): ויקיטקסט העברי, CC BY-SA 4.0, כל דף מוצמד לגרסה (wikisource-shulchan-arukh-commentary-cc-by-sa). גרסת ספריא "On Your Way" (74%) לא שימשה' },
  { title: 'בן איש חי', status: 'AVAILABLE_OPEN', evidence: 'Sefaria: "Ben Ish Chai, Jerusalem, 1898" — Public Domain' },
  { title: 'משנה תורה לרמב״ם', status: 'AVAILABLE_OPEN', evidence: 'Sefaria: "Torat Emet 370" — Public Domain (נבדק: הלכות תפילה)' },
  { title: 'תלמוד בבלי (ללא אינטרנט)', status: 'AVAILABLE_OPEN', evidence: 'נארז (2026-09-29): Sefaria "Wikisource Talmud Bavli" — CC-BY-SA, 37 מסכתות (wikisource-talmud-cc-by-sa), עם רש״י, תוספות ורי״ף. William Davidson Edition — CC-BY-NC: לא נארז, נטען ברשת לפי בחירה' },
  { title: 'שו״ת יביע אומר', status: 'PERMISSION_REQUIRED', evidence: 'יצירה מודרנית מוגנת; לא נמצאה ב־Sefaria' },
  { title: 'שו״ת יחוה דעת', status: 'PERMISSION_REQUIRED', evidence: 'יצירה מודרנית מוגנת; לא נמצאה ב־Sefaria' },
  { title: 'חזון עובדיה', status: 'PERMISSION_REQUIRED', evidence: 'יצירה מודרנית מוגנת; לא נמצאה ב־Sefaria' },
  { title: 'הליכות עולם', status: 'PERMISSION_REQUIRED', evidence: 'יצירה מודרנית מוגנת; לא נמצאה ב־Sefaria' },
  { title: 'ילקוט יוסף (מהדורות עדכניות)', status: 'PERMISSION_REQUIRED', evidence: 'במאגר קיימת רק מהדורת תשס״ז דרך תורת אמת (CC BY-NC-SA 2.5)' },
  { title: 'ברכי יוסף (חיד״א)', status: 'NOT_FOUND', evidence: 'Sefaria: הכותר "Birkei Yosef" לא נמצא; מקורות אחרים טרם נבדקו' },
  { title: 'חיים שאל (חיד״א)', status: 'NOT_FOUND', evidence: 'Sefaria: הכותר "Chaim Sheal" לא נמצא' },
  { title: 'יוסף אומץ (חיד״א)', status: 'NOT_FOUND', evidence: 'Sefaria: הכותר "Yosef Ometz" לא נמצא' },
  { title: 'מועד לכל חי (ר׳ חיים פלאג׳י)', status: 'NOT_FOUND', evidence: 'Sefaria: הכותר "Moed LeKol Chai" לא נמצא' },
  { title: 'כף החיים (ר׳ חיים פלאג׳י)', status: 'NOT_FOUND', evidence: 'Sefaria: הכותר "Kaf HaChaim (Palagi)" לא נמצא' },
  { title: 'שו״ת רב פעלים', status: 'NOT_FOUND', evidence: 'Sefaria: הכותר "Rav Pealim" לא נמצא' },
  // From the corpus gap report (docs/library/corpus-gap-report.md §6, queried 2026-09-29). \`match\` names the exact
  // provider edition, so a test can prove none of these is ever packaged.
  { title: 'זוהר · תרגום עברי ("Hebrew Translation", זוהר בתרגום עברי — תרגום הרב דוד שריג)', status: 'PERMISSION_REQUIRED', evidence: 'Sefaria: רישיון unknown; מקור toratemetfreeware.com', match: { provider: 'sefaria', title: 'Zohar', versionTitle: 'Hebrew Translation' } },
  { title: 'זוהר · מהדורת הסולם (ירושלים תש״ה) ופירוש הסולם', status: 'PERMISSION_REQUIRED', evidence: 'Sefaria "Sulam Edition, Jerusalem 1945": רישיון unknown; יצירה מהמאה העשרים', match: { provider: 'sefaria', title: 'Zohar', versionTitle: 'Sulam Edition, Jerusalem 1945' } },
  { title: 'זוהר מנוקד (ישראל תשע״ג)', status: 'PERMISSION_REQUIRED', evidence: 'Sefaria "Vocalized Zohar, Israel 2013": רישיון unknown', match: { provider: 'sefaria', title: 'Zohar', versionTitle: 'Vocalized Zohar, Israel 2013' } },
  { title: 'אדרא זוטא · זוהר מנוקד / נוסח הסולם / תרגום לפי הסולם', status: 'PERMISSION_REQUIRED', evidence: 'Sefaria: שלוש הגרסאות ברישיון unknown', match: { provider: 'sefaria', title: 'Idra Zuta' } },
  { title: 'זוהר מתורגם (ויקיטקסט, ביאור:זוהר מתורגם)', status: 'BLOCKED', evidence: 'המתרגם כתב בדף השיחה שחלקים מבוססים על הסולם (מוגן); ראו sources/wikisource-zohar/provenance.json › translation', match: { provider: 'wikisource', title: 'ביאור:זוהר מתורגם' } },
  { title: 'אור יקר (רמ״ק)', status: 'PERMISSION_REQUIRED', evidence: 'אין מהדורה פתוחה: לא בספריא; בוויקיטקסט דף ריק; המהדורות מכתב יד הן מהמאה העשרים' },
  { title: 'נפש דוד (רד״ל) · גרסת ספריא', status: 'PERMISSION_REQUIRED', evidence: 'Sefaria "Nefesh David": רישיון unknown — הועתק במקומה מוויקיטקסט (CC BY-SA 4.0)', match: { provider: 'sefaria', title: 'Nefesh David on Zohar' } },
  { title: 'מאירי · בית הבחירה', status: 'PERMISSION_REQUIRED', evidence: 'Sefaria "Meiri on Shas" ו־"Wikisource": רישיון unknown; מקור ההעתקה בוויקיטקסט לא צוין; המהדורות המדעיות מוגנות', match: { provider: 'sefaria', title: 'Meiri on Shas' } },
  { title: 'חידושי הרשב״א · מהדורת גרליץ (אורייתא)', status: 'BLOCKED', evidence: 'Sefaria רושמת Public Domain, אך זו מהדורה ביקורתית מודרנית — עד אימות מול ספריא או המו״ל', match: { provider: 'sefaria', versionTitle: 'Gerlitz edition, published by Oraita' } },
  { title: 'רש״י על התורה · רוזנבאום־זילברמן (1929–1934)', status: 'BLOCKED', evidence: 'Sefaria רושמת Public Domain, אך הכרכים של 1930–1934 אינם נחלת הכלל בארה״ב מכוח גילם; חלופה: "On Your Way" (PD)', match: { provider: 'sefaria', versionTitle: "Pentateuch with Rashi's commentary by M. Rosenbaum and A.M. Silbermann, 1929-1934" } },
  { title: 'רד״ק על נ״ך · רד״ק על דברי הימים (ברגר)', status: 'PERMISSION_REQUIRED', evidence: 'Sefaria "Radak on Nach": unknown; דברי הימים: CC-BY-NC בלבד', match: { provider: 'sefaria', versionTitle: 'Radak on Nach' } },
  { title: 'אברבנאל על נ״ך (תל אביב תש״ך)', status: 'PERMISSION_REQUIRED', evidence: 'Sefaria "Abarbanel, Tel Aviv 1960": unknown', match: { provider: 'sefaria', versionTitle: 'Abarbanel, Tel Aviv 1960' } },
  { title: 'רמב״ן על שמות · רמב״ן על איוב', status: 'PERMISSION_REQUIRED', evidence: 'שמות: כל הגרסאות unknown; איוב: מוסד הרב קוק תשכ״ג, CC-BY-NC בלבד', match: { provider: 'sefaria', title: 'Ramban on Exodus' } },
  { title: 'מלבי״ם על שמואל א, על ישעיהו, אילת השחר, ביאור המילות לתהלים', status: 'PERMISSION_REQUIRED', evidence: 'Sefaria: הגרסאות היחידות ברישיון unknown' },
  { title: 'הלכות הרמב״ן על נדרים · ריטב״א על נדרים · חידושי אגדות על ראש השנה', status: 'PERMISSION_REQUIRED', evidence: 'Sefaria: הגרסאות היחידות ברישיון unknown' },
  { title: 'תקוני הזהר · קושטא תק״ך (מרגליא)', status: 'PERMISSION_REQUIRED', evidence: 'CC-BY-NC; אין צורך — מהדורת תורת אמת (PD) כבר בספרייה', match: { provider: 'sefaria', versionTitle: 'Constantinople, 1740' } },
  { title: 'קיצור ט״ז · קיצור ש״ך על יורה דעה', status: 'NOT_FOUND', evidence: 'Sefaria: אין גרסה עברית רשומה' },
]);
// Recorded for review and never shown as text: which layers were refused and why.
export { BLOCKED_LAYERS };

// Registry health for the Validation Lab.
export function registryAudit(works = WORKS) {
  const count = status => works.filter(work => work.coverage === status).length;
  const packaged = works.filter(work => work.kind === 'pack');
  return {
    totalWorks: works.length,
    publicWorks: works.filter(work => work.public).length,
    totalEditions: works.reduce((total, work) => total + work.editions.length, 0),
    byCoverage: Object.fromEntries(Object.values(COVERAGE).map(status => [status, count(status)])),
    textualUnits: packaged.reduce((total, work) => total + work.editions[0].nodes.reduce((a, b) => a + b, 0), 0),
    legacyParagraphs: works.filter(work => work.kind === 'legacy').reduce((total, work) => total + work.editions.reduce((a, edition) => a + edition.units, 0), 0),
    missingUnits: IMPORT_REPORTS.summary.missingUnits,
    duplicateIds: IMPORT_REPORTS.summary.duplicateIds,
    emptyUnits: IMPORT_REPORTS.summary.emptyUnits,
    brokenIds: IMPORT_REPORTS.summary.invalidRefs,
    unknownLicenses: works.filter(work => work.editions.some(edition => edition.license === 'unknown')).map(work => work.workId),
    missingSources: works.filter(work => work.editions.some(edition => !edition.sourceProvider)).map(work => work.workId),
    missingAuthors: works.filter(work => !work.authors.length && work.primaryCategory !== 'tanakh').map(work => work.workId),
    uncategorized: works.filter(work => !categoryById(work.primaryCategory)).map(work => work.workId),
    layers: works.filter(work => work.relation).map(work => ({ workId: work.workId, relationType: work.relation.relationType, baseWorkId: work.relation.baseWorkId, coverage: work.coverage })),
    acquisitionQueue: Object.fromEntries(['AVAILABLE_OPEN', 'PERMISSION_REQUIRED', 'BLOCKED', 'NOT_FOUND'].map(status => [status, ACQUISITION_QUEUE.filter(item => item.status === status).length])),
    duplicateWorkIds: works.map(work => work.workId).filter((id, index, all) => all.indexOf(id) !== index),
    discrepancies: IMPORT_REPORTS.discrepancies,
    crossChecks: IMPORT_REPORTS.crossChecks,
  };
}

export { COLLECTION_INDEX, COLLECTION_REPORTS, COMMENTATORS, CORPUS_INDEX, CORPUS_REPORTS, IMPORT_REPORTS, PACK_INDEX, REMOTE_LAYERS };
