// The source registry of the word dictionary (מילון בלחיצה) — machine-readable, and the rights gate of its build:
// scripts/dictionary/build-word-dictionary.mjs refuses to build when an imported source misses a field, its licence is
// not cleared for offline redistribution with modification, or its raw file's hash differs from contentHash.
// A source with imported:false was evaluated and left out; it contributes nothing to the app.
//
// Source priority (the order glosses are preferred in, and the order duplicates are merged in):
//   1. krupnik-1927 — a concise Hebrew dictionary of the Talmud, the Midrash and the Targum (Hebrew definitions)
//   2. jastrow-1903 — Jastrow's dictionary: lemmas, spellings, stems, the forms he prints, and only the Hebrew he states
//      (his "ch. same" link to the Hebrew entry, "= h. X", the Hebrew verse word a Targum renders); never his English
//   3. he-wiktionary — Hebrew Wiktionary: its Aramaic senses, idioms and the abbreviations of the Jewish bookshelf
//   morphhb — the Open Scriptures Hebrew Bible: its proper-noun tags only (the token classifier's list of names);
//      it contributes no gloss
// The engine's own reviewed grammar (pronominal prepositions, Hebrew verb conjugation, the Aramaic verb and noun
// paradigms) is code in src/services/wordLookup/aramaic/ and scripts/dictionary/aramaic/ — no third-party data.
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
    // Recorded 2026-09-30 for the owner's decision (not a change of status): the authors' death years. A. M. Silbermann
    // died 1939 (LC authority no95017909; BnF 10635548). Baruch Krupnik (Karu, ברוך קרוא) died 18 April 1972 (he.wikipedia
    // "ברוך קרוא"; Simania author 989054). Under life + 70 (Israel, the UK — the country of first publication — and the
    // EU) the joint work is protected until 31 December 2042 (public domain there on 1 January 2043). Public domain in
    // the United States since 1 January 2023. The build can measure the engine without it: --exclude krupnik-1927.
    authorDeathYears: Object.freeze({ 'A. M. Silbermann': 1939, 'Baruch Krupnik (Karu)': 1972 }),
    jurisdictions: Object.freeze({ US: 'public domain since 2023-01-01 (95 years from 1927 publication)', IL: 'protected until 2042-12-31 (life + 70 of the last co-author, d. 1972)', EU: 'protected until 2042-12-31 (life + 70)', UK: 'protected until 2042-12-31 (life + 70)' }),
    rightsRisk: 'OWNER DECISION REQUIRED: public domain in the US only; protected in Israel, the UK and the EU until the end of 2042.',
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
    priority: 3,
    title: 'Hebrew Wiktionary (ויקימילון) — Aramaic senses and Jewish-bookshelf abbreviations',
    heTitle: 'ויקימילון העברי',
    author: 'Wiktionary contributors',
    heAuthor: 'תורמי ויקימילון',
    edition: 'Pages of nine categories (ערכים בשפה הארמית; ארמית; ניבים, ביטויים ופתגמים בארמית; ראשי תיבות בארמית / בארון הספרים היהודי / אישים / של ברכות / ביהדות / בתורת הקבלה), each pinned by revision id in the raw file',
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
    contentHash: 'sha256:582c100924cda9c6d7cf820dcce0c87b87f975407849ef6f11a1b8f575cf258e',
    useInApp: 'Aramaic senses (marked {{ארמית}}), Aramaic idioms (short senses only) and abbreviations of the Jewish bookshelf; credited with the licence on the sources page.',
  }),
  Object.freeze({
    sourceId: 'jastrow-1903',
    imported: true,
    priority: 2,
    title: 'A Dictionary of the Targumim, the Talmud Babli and Yerushalmi, and the Midrashic Literature',
    heTitle: 'מילון יסטרוב',
    author: 'Marcus Jastrow',
    heAuthor: 'מרקוס יסטרוב',
    edition: 'London, Luzac, 1903 (Sefaria version "London, Luzac, 1903")',
    provider: 'Sefaria (digitized by Sefaria)',
    sourceUrl: 'https://www.sefaria.org/Jastrow',
    licenceId: 'public-domain',
    licenceUrl: 'https://www.sefaria.org/api/texts/versions/Jastrow',
    rightsBasis: 'Sefaria records the version "Public Domain" (re-read live at fetch time). Published 1886–1903; Marcus Jastrow died 1903: public domain everywhere (life + 70 ended 1973; US: published before 1931).',
    authorDeathYears: Object.freeze({ 'Marcus Jastrow': 1903 }),
    redistributionAllowed: true,
    offlineAllowed: true,
    modificationAllowed: true,
    attributionRequired: false,
    shareAlike: false,
    retrievedAt: '2026-09-30',
    rawFile: 'sources/jastrow/raw/entries.jsonl',
    contentHash: 'sha256:dd3ed6a8e68995a3db8e1150fa1c9371a6833914e001418c06f3b6586149b0a9',
    useInApp: 'Lemma detection, spellings, stems, the inflected forms he prints (form → lemma), proper-name marks, and only the Hebrew he states (his "ch. same" link to the Hebrew entry, "= h. X", the Hebrew verse word a Targum renders). His English is never shown and never translated.',
  }),
  Object.freeze({
    sourceId: 'morphhb',
    imported: true,
    priority: 9,
    title: 'Open Scriptures Hebrew Bible (OSHB) — lemma and morphology of the Westminster Leningrad Codex',
    heTitle: 'התנ״ך המתויג של Open Scriptures',
    author: 'Open Scriptures Hebrew Bible Project',
    heAuthor: 'מיזם Open Scriptures Hebrew Bible',
    edition: 'github.com/openscriptures/morphhb, commit 3d15126fb1ef74867fc1434be1942e837932691f (2024-08-27), wlc/*.xml',
    provider: 'Open Scriptures (GitHub)',
    sourceUrl: 'https://github.com/openscriptures/morphhb',
    licenceId: 'cc-by-4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
    rightsBasis: 'The README of the pinned commit (re-read at fetch time): lemma and morphology data CC BY 4.0, "credit the Open Scriptures Hebrew Bible Project"; the WLC text public domain.',
    redistributionAllowed: true,
    offlineAllowed: true,
    modificationAllowed: true,
    attributionRequired: true,
    shareAlike: false,
    retrievedAt: '2026-09-30',
    rawFile: 'sources/morphhb/raw/words.tsv',
    contentHash: 'sha256:c252591040b7e9cafedbffe6cfed2009dc3bd63df9f577a5568c7fb95a972625',
    useInApp: 'Build time only: its proper-noun tags (morph Np) are the token classifier\'s list of biblical names (so the names Onkelos repeats are not counted as unknown Aramaic words). Nothing of it is shipped; credited on the sources page.',
  }),
  Object.freeze({
    sourceId: 'arukh-lublin-1883',
    imported: false,
    title: 'Sefer HeArukh (Rabbi Natan of Rome)',
    edition: 'Sefer HeArukh, Lublin 1883 (Sefaria, recorded Public Domain)',
    provider: 'Sefaria',
    sourceUrl: 'https://www.sefaria.org/Sefer_HeArukh',
    licenceId: 'public-domain',
    reason: 'Rights are clear (Sefaria: Public Domain; medieval author, 1883 edition), but its entries are discursive paragraphs, not short glosses: no deterministic rule yields a 1–4 word Hebrew gloss from them without rewriting. Not imported. (Kohut\'s Arukh HaShalem, Vienna 1878–92, is public domain but exists digitally only as noisy OCR — archive.org "arukh-hashalem-vienna-1892-images".)',
  }),
  Object.freeze({
    sourceId: 'meturgeman',
    imported: false,
    title: 'Sefer Meturgeman (Eliyahu Bachur)',
    reason: 'The 1541 work is public domain, but no digital text exists (scans only: HebrewBooks 6244, Google Books); modern annotated editions are copyrighted. Not imported.',
  }),
  Object.freeze({
    sourceId: 'sefaria-word-form',
    imported: false,
    title: 'Sefaria lexicon WordForm associations (word_form collection behind /api/words)',
    provider: 'Sefaria',
    licenceId: 'unknown',
    reason: 'No licence is stated for this dataset (Sefaria-Export: "each text is licensed separately", no lexicon export; the MongoDB dump carries no licence; the terms forbid commercial exploitation "unless expressly stated otherwise"). Not bundled and not used as a mapping; the engine\'s own form → lemma table is built from public-domain dictionaries and reviewed grammar.',
  }),
  Object.freeze({
    sourceId: 'zohar-lexica',
    imported: false,
    title: 'Zohar lexica (Liebes, פרקים במילון ספר הזוהר; Scholem\'s Zohar card index; Nitzotzei Zohar; Matok MiDvash)',
    licenceId: 'copyright',
    reason: 'All in copyright (living author / Scholem d. 1982 / Margaliot d. 1971 / Frisch d. 2005) or images only. No open-licensed Zoharic Aramaic → Hebrew lexicon was found; the Zohar is served by the general lexica and the reviewed grammar.',
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
