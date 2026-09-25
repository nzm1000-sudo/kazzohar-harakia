// Central library registry: taxonomy, sources, licenses, works/editions and the acquisition queue.
// Works enter the public library only with a known source, edition, license and structure.
import PACK_INDEX from './packIndex.mjs';
import IMPORT_REPORTS from './importReports.mjs';
import LEGACY_METADATA from './legacyMetadata.mjs';
import { BOOK_CATALOG } from '../bookCatalog.mjs';
import talmudCatalog from '../talmudCatalog.mjs';
import { HALACHA_WORKS } from '../halachaLibrary.mjs';
import { COVERAGE } from '../../services/library/integrity.mjs';

export { COVERAGE };
const UNKNOWN = 'UNKNOWN';

export const TAXONOMY = Object.freeze([
  { id: 'tanakh', title: 'תנ״ך', groups: [['torah', 'תורה'], ['neviim-rishonim', 'נביאים ראשונים'], ['neviim-acharonim', 'נביאים אחרונים'], ['ketuvim', 'כתובים']] },
  { id: 'mishnah', title: 'משנה', groups: [['zeraim', 'סדר זרעים'], ['moed', 'סדר מועד'], ['nashim', 'סדר נשים'], ['nezikin', 'סדר נזיקין'], ['kodashim', 'סדר קדשים'], ['tahorot', 'סדר טהרות']] },
  { id: 'talmud', title: 'תלמוד', groups: [['zeraim', 'סדר זרעים'], ['moed', 'סדר מועד'], ['nashim', 'סדר נשים'], ['nezikin', 'סדר נזיקין'], ['kodashim', 'סדר קדשים'], ['tahorot', 'סדר טהרות']] },
  { id: 'midrash', title: 'מדרש', groups: [] },
  { id: 'halacha', title: 'הלכה', groups: [['yesod', 'ספרי יסוד'], ['tur-beit-yosef', 'טור ובית יוסף'], ['shulchan-arukh', 'שולחן ערוך ונושאי כליו'], ['acharonim', 'אחרונים'], ['sephardic-psak', 'פסיקה ספרדית'], ['modern', 'פסיקה בת זמננו']] },
  { id: 'rambam', title: 'משנה תורה לרמב״ם', groups: [['madda', 'ספר המדע'], ['ahavah', 'ספר אהבה'], ['zemanim', 'ספר זמנים'], ['nashim', 'ספר נשים'], ['kedushah', 'ספר קדושה'], ['haflaah', 'ספר הפלאה'], ['zeraim', 'ספר זרעים'], ['avodah', 'ספר עבודה'], ['korbanot', 'ספר קרבנות'], ['taharah', 'ספר טהרה'], ['nezikim', 'ספר נזיקים'], ['kinyan', 'ספר קניין'], ['mishpatim', 'ספר משפטים'], ['shoftim', 'ספר שופטים']] },
  { id: 'responsa', title: 'שו״ת', groups: [] },
  { id: 'tanakh-commentary', title: 'מפרשי המקרא', groups: [] },
  { id: 'mishnah-commentary', title: 'מפרשי המשנה', groups: [] },
  { id: 'talmud-commentary', title: 'מפרשי הש״ס', groups: [] },
  { id: 'rishonim', title: 'ראשונים', groups: [] },
  { id: 'acharonim', title: 'אחרונים', groups: [] },
  { id: 'mitzvot', title: 'ספרי מצוות', groups: [] },
  { id: 'mussar', title: 'מוסר', groups: [] },
  { id: 'machshava', title: 'מחשבה ואמונה', groups: [] },
  { id: 'kabbalah', title: 'קבלה', groups: [] },
  { id: 'chassidut', title: 'חסידות', groups: [] },
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
});

// Sefaria is a provider, not a license: each edition carries its own terms.
export const LICENSES = Object.freeze({
  'uxlc-free': { id: 'uxlc-free', title: 'UXLC — שימוש והעתקה ללא הגבלה', statement: 'All biblical Hebrew text may be viewed or copied without restriction; citation appreciated.', url: 'https://www.tanach.us/License.html', attribution: 'Unicode/XML Leningrad Codex, Tanach.us Inc.', redistributionAllowed: true, offlineAllowed: true, commercialUseAllowed: true, modificationAllowed: UNKNOWN },
  'public-domain': { id: 'public-domain', title: 'נחלת הכלל', statement: 'Public Domain', attribution: 'מקור ומהדורה מצוינים', redistributionAllowed: true, offlineAllowed: true, commercialUseAllowed: true, modificationAllowed: true },
  'cc-by': { id: 'cc-by', title: 'CC-BY', statement: 'Creative Commons Attribution', attribution: 'ייחוס חובה', redistributionAllowed: true, offlineAllowed: true, commercialUseAllowed: true, modificationAllowed: true },
  'cc-by-sa': { id: 'cc-by-sa', title: 'CC-BY-SA', statement: 'Creative Commons Attribution-ShareAlike', attribution: 'ייחוס חובה; שיתוף זהה', redistributionAllowed: true, offlineAllowed: true, commercialUseAllowed: true, modificationAllowed: true },
  'cc-by-nc': { id: 'cc-by-nc', title: 'CC-BY-NC', statement: 'Creative Commons Attribution-NonCommercial', attribution: 'ייחוס חובה; שימוש לא־מסחרי', redistributionAllowed: true, offlineAllowed: true, commercialUseAllowed: false, modificationAllowed: true },
  'cc-by-nc-sa': { id: 'cc-by-nc-sa', title: 'CC BY-NC-SA 2.5', statement: 'Creative Commons Attribution-NonCommercial-ShareAlike 2.5', attribution: 'ייחוס חובה; שימוש לא־מסחרי; שיתוף זהה', redistributionAllowed: true, offlineAllowed: true, commercialUseAllowed: false, modificationAllowed: true },
  unknown: { id: 'unknown', title: 'LICENSE_UNKNOWN', statement: UNKNOWN, attribution: UNKNOWN, redistributionAllowed: UNKNOWN, offlineAllowed: UNKNOWN, commercialUseAllowed: UNKNOWN, modificationAllowed: UNKNOWN },
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

const reportByWork = new Map(IMPORT_REPORTS.reports.map(report => [report.workId, report]));

// ---------- Packaged, integrity-validated works ----------
const packagedWorks = PACK_INDEX.flatMap(pack => pack.works.map(work => ({
  workId: work.workId,
  title: work.heTitle,
  sourceTitle: work.title,
  aliases: work.aliases || [],
  authors: work.authors.length ? work.authors : [],
  primaryCategory: pack.category || pack.family,
  group: work.group,
  secondaryCategories: pack.category === 'rambam' ? ['halacha'] : [],
  tags: pack.family === 'shulchan-arukh' ? ['sephardic'] : [],
  kind: 'pack',
  coverage: work.status,
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
    heTitle: work.editionTitle ? work.editionTitle : pack.edition.heTitle,
    versionSource: work.versionSource || null,
    editor: pack.edition.editor,
    notes: pack.edition.notes,
    language: 'he',
    sourceProvider: pack.source,
    sourceIdentifier: work.title,
    sourceUrl: pack.sourceUrl,
    license: pack.license,
    contentVersion: pack.contentVersion,
    retrievedAt: pack.retrievedAt,
    structure: pack.structure,
    nodeLabel: pack.nodeLabel,
    unitLabel: pack.unitLabel,
    policy: pack.policy,
    coverage: work.status,
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
    group: null,
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
const SEDER_ID = { 'Seder Zeraim': 'zeraim', 'Seder Moed': 'moed', 'Seder Nashim': 'nashim', 'Seder Nezikin': 'nezikin', 'Seder Kodashim': 'kodashim', 'Seder Tahorot': 'tahorot' };
const talmudWorks = talmudCatalog.tractates.filter(tractate => tractate.steinsaltz).map(tractate => ({
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
  secondaryCategories: work.id === 'kaf-hachayim-oc' || work.id === 'ben-ish-hai' ? ['acharonim'] : [],
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

export const WORKS = Object.freeze([...packagedWorks.map(work => ({ ...work, license: work.editions[0].license, public: true })), ...legacyWorks, ...talmudWorks, ...halachaWorks.map(work => ({ ...work, supersededBy: packagedWorks.find(pack => pack.sourceTitle.replace(/'/g, '') === String(work.sourceTitle).replace(/'/g, ''))?.workId || null })).map(work => (work.supersededBy ? { ...work, public: false } : work))]);
export const PUBLIC_WORKS = WORKS.filter(work => work.public);
export const EDITIONS = WORKS.flatMap(work => work.editions.map(edition => ({ ...edition, workId: work.workId })));
export const workById = id => WORKS.find(work => work.workId === id) || null;
export const worksInCategory = id => PUBLIC_WORKS.filter(work => work.primaryCategory === id || work.secondaryCategories.includes(id));

// Evidence from Sefaria API queries (2026-09-25). Nothing here is shown as library content.
export const ACQUISITION_QUEUE = Object.freeze([
  { title: 'שולחן ערוך · ארבעה חלקים (ייבוא מלא ללא אינטרנט)', status: 'AVAILABLE_OPEN', evidence: 'Sefaria: "Torat Emet 363" / "Maginei Eretz, Lemberg 1893" — Public Domain' },
  { title: 'בית יוסף', status: 'AVAILABLE_OPEN', evidence: 'Sefaria: "Tur … Vilna, 1923" — Public Domain' },
  { title: 'טור', status: 'AVAILABLE_OPEN', evidence: 'Sefaria: "Orach Chaim, Vilna, 1923" — Public Domain' },
  { title: 'כף החיים', status: 'AVAILABLE_OPEN', evidence: 'Sefaria: "Kaf Hachayim, Jerusalem 1910-1933" — Public Domain' },
  { title: 'בן איש חי', status: 'AVAILABLE_OPEN', evidence: 'Sefaria: "Ben Ish Chai, Jerusalem, 1898" — Public Domain' },
  { title: 'משנה תורה לרמב״ם', status: 'AVAILABLE_OPEN', evidence: 'Sefaria: "Torat Emet 370" — Public Domain (נבדק: הלכות תפילה)' },
  { title: 'תלמוד בבלי (ללא אינטרנט)', status: 'AVAILABLE_OPEN', evidence: 'Sefaria: William Davidson Edition — CC-BY-NC (לא־מסחרי)' },
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
]);

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
    duplicateWorkIds: works.map(work => work.workId).filter((id, index, all) => all.indexOf(id) !== index),
    discrepancies: IMPORT_REPORTS.discrepancies,
    crossChecks: IMPORT_REPORTS.crossChecks,
  };
}

export { IMPORT_REPORTS, PACK_INDEX };
