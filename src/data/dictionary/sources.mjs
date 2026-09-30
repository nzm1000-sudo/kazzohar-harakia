// The source registry of the word dictionary (מילון בלחיצה) — machine-readable, and the rights gate of its build:
// scripts/dictionary/build-word-dictionary.mjs refuses to build when an imported source misses a field, its licence is
// not cleared for offline redistribution with modification, or its raw file's hash differs from contentHash.
// A source with imported:false was evaluated and left out; it contributes nothing to the app.
//
// Source priority (the order glosses are preferred in, and the order duplicates are merged in):
//   1. krupnik-1927 — a concise Hebrew dictionary of the Talmud, the Midrash and the Targum (Hebrew definitions)
//   2. he-wiktionary — Hebrew Wiktionary: its Aramaic senses and the abbreviations of the Jewish bookshelf
//   (validation and morphology use the same two sources; no other source adds or changes a gloss)
export const DICTIONARY_SOURCES = Object.freeze([
  Object.freeze({
    sourceId: 'krupnik-1927',
    imported: true,
    priority: 1,
    title: 'A Dictionary of the Talmud, the Midrash and the Targum (מילון שימושי לתלמוד)',
    heTitle: 'מילון שימושי לתלמוד',
    author: 'Baruch Krupnik and A. M. Silbermann',
    heAuthor: 'ברוך קרופניק וא״מ זילברמן',
    edition: 'A dictionary of the Talmud, London, 1927',
    provider: 'Sefaria (digitized by Sefaria; version record "A dictionary of the Talmud, London, 1927")',
    sourceUrl: 'https://www.sefaria.org/A_Dictionary_of_the_Talmud',
    editionUrl: 'https://www.nli.org.il/he/books/NNL_ALEPH990026160720205171/NLI',
    licenceId: 'public-domain',
    licenceUrl: 'https://www.sefaria.org/api/texts/versions/A_Dictionary_of_the_Talmud',
    rightsBasis: 'Sefaria records the version "Public Domain" (re-read live at fetch time). Published London 1927: in the United States its term ended with 2022 (95 years from publication) — the same rule this app applies to every edition (compare the 1929–34 Rosenbaum–Silbermann Rashi, which is blocked for failing it). Only the Hebrew definitions are used; Sefaria\'s own markup is dropped.',
    redistributionAllowed: true,
    offlineAllowed: true,
    modificationAllowed: true,
    attributionRequired: false,
    shareAlike: false,
    retrievedAt: '2026-09-30',
    rawFile: 'sources/talmud-dictionary/raw/entries.jsonl',
    contentHash: 'sha256:1ee1f4e97c60a306b983ee0533dfb16bacb71ac434e6566dd91fb92877764890',
    useInApp: 'Short Hebrew definitions of Aramaic words, idioms and abbreviations, cut by fixed rules (see the build script); never shown with the source name in the bubble; credited on the sources page.',
  }),
  Object.freeze({
    sourceId: 'he-wiktionary',
    imported: true,
    priority: 2,
    title: 'Hebrew Wiktionary (ויקימילון) — Aramaic senses and Jewish-bookshelf abbreviations',
    heTitle: 'ויקימילון העברי',
    author: 'Wiktionary contributors',
    heAuthor: 'תורמי ויקימילון',
    edition: 'Pages of seven categories (ערכים בשפה הארמית; ראשי תיבות בארמית / בארון הספרים היהודי / אישים / של ברכות / ביהדות / בתורת הקבלה), each pinned by revision id in the raw file',
    provider: 'Wikimedia Foundation, he.wiktionary.org (MediaWiki API)',
    sourceUrl: 'https://he.wiktionary.org/',
    licenceId: 'cc-by-sa-4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/deed.he',
    rightsBasis: 'Site licence re-read live at fetch time (siteinfo rightsinfo: Creative Commons Attribution-Share Alike 4.0). The glosses taken from it are adapted (markup removed, first alternative kept, context rules) and are therefore shared under CC BY-SA 4.0 as a separate data file (src/data/dictionary/wordDictionary.mjs, the lines whose source is he-wiktionary); the licence covers that data only, not the app.',
    redistributionAllowed: true,
    offlineAllowed: true,
    modificationAllowed: true,
    attributionRequired: true,
    shareAlike: true,
    retrievedAt: '2026-09-30',
    rawFile: 'sources/hebrew-wiktionary/raw/pages.jsonl',
    contentHash: 'sha256:4ca73c38c35a6d86df014e1ffa26679063f09ca5bcde3a333a4783dbcf958fc9',
    useInApp: 'Aramaic senses (marked {{ארמית}}) and abbreviations of the Jewish bookshelf; credited with the licence on the sources page.',
  }),
  Object.freeze({
    sourceId: 'jastrow-1903',
    imported: false,
    title: 'A Dictionary of the Targumim, the Talmud Babli and Yerushalmi, and the Midrashic Literature',
    author: 'Marcus Jastrow',
    edition: 'London, Luzac, 1903 (Sefaria "Jastrow", recorded Public Domain)',
    provider: 'Sefaria',
    sourceUrl: 'https://www.sefaria.org/Jastrow',
    licenceId: 'public-domain',
    reason: 'Rights are clear, but its definitions are English: nothing of it can be shown, and lemma cross-checking was not needed for the entries kept (both imported sources give their own Hebrew headword). Not imported.',
  }),
  Object.freeze({
    sourceId: 'arukh-lublin-1883',
    imported: false,
    title: 'Sefer HeArukh (Rabbi Natan of Rome)',
    edition: 'Sefer HeArukh, Lublin 1883 (Sefaria, recorded Public Domain)',
    provider: 'Sefaria',
    sourceUrl: 'https://www.sefaria.org/Sefer_HeArukh',
    licenceId: 'public-domain',
    reason: 'Rights are clear, but its entries are discursive paragraphs, not short glosses: no deterministic rule yields a 1–4 word Hebrew gloss from them without rewriting. Not imported.',
  }),
  Object.freeze({
    sourceId: 'meturgeman',
    imported: false,
    title: 'Sefer Meturgeman (Eliyahu Bachur)',
    reason: 'No digitized edition with a verifiable licence was found (not on Sefaria; no open transcription with recorded rights). Rights unverified — not imported.',
  }),
  Object.freeze({
    sourceId: 'klein-1987',
    imported: false,
    title: 'Klein Dictionary',
    provider: 'Sefaria',
    licenceId: 'cc-by-nc',
    reason: 'CC-BY-NC (non-commercial) and English definitions. Not imported.',
  }),
]);

export const REQUIRED_SOURCE_FIELDS = Object.freeze(['sourceId', 'title', 'author', 'edition', 'provider', 'sourceUrl', 'licenceId', 'licenceUrl', 'rightsBasis', 'redistributionAllowed', 'offlineAllowed', 'modificationAllowed', 'attributionRequired', 'shareAlike', 'retrievedAt', 'contentHash']);
export const CLEARED_LICENCES = Object.freeze(['public-domain', 'cc0', 'cc-by-4.0', 'cc-by-sa-4.0']);

// The rights gate: every imported source complete and cleared. Returns a list of problems (empty = cleared).
export function auditDictionarySources(sources = DICTIONARY_SOURCES) {
  const problems = [];
  for (const source of sources.filter(item => item.imported)) {
    for (const field of REQUIRED_SOURCE_FIELDS) if (source[field] === undefined || source[field] === null || source[field] === '') problems.push(`${source.sourceId}: missing ${field}`);
    if (!CLEARED_LICENCES.includes(source.licenceId)) problems.push(`${source.sourceId}: licence ${source.licenceId} is not cleared`);
    if (source.redistributionAllowed !== true || source.offlineAllowed !== true || source.modificationAllowed !== true) problems.push(`${source.sourceId}: redistribution, offline use and modification must all be allowed`);
    if (!/^sha256:[0-9a-f]{64}$/.test(source.contentHash || '')) problems.push(`${source.sourceId}: contentHash is not a sha256 of its raw file`);
    if (source.shareAlike && !source.attributionRequired) problems.push(`${source.sourceId}: share-alike without attribution`);
  }
  return problems;
}
export const importedSources = () => DICTIONARY_SOURCES.filter(item => item.imported).sort((a, b) => a.priority - b.priority);
