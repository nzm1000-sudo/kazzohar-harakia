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
    rightsBasis: 'Public Domain, confirmed in writing by Sefaria for this exact version (Team Sefaria / Rachel Lieberman Buckman, 2026-10-01, in reply to our permission request of 1 October 2026): Text: A Dictionary of the Talmud; Authors: Baruch Krupnik / A. M. Silbermann; London, 1927; Source: National Library of Israel — nli.org.il; Digitization: Sefaria; License: Public Domain. Sefaria\'s licences are per version: the clearance covers clearedVersion only (see below). Sefaria\'s version record is also re-read live at fetch time. Only the Hebrew definitions are used; Sefaria\'s own markup is dropped.',
    authorDeathYears: Object.freeze({ 'A. M. Silbermann': 1939, 'Baruch Krupnik (Karu)': 1972 }),
    // CLEARED (2026-10-01) — VERSION-SPECIFIC. The clearance applies ONLY to the version below ("Krupnik / Silbermann,
    // London 1927, digitized by Sefaria, source NLI"). It is NOT extended to any other version, edition, translation or
    // reprint of the dictionary, nor to any other Sefaria text (each Sefaria text is licensed per version). The build
    // (build-aramaic-engine.mjs) and the fetcher (fetch-krupnik.mjs) check the fetched version's record
    // (fetchMetaFile) against clearedVersion field by field, and its hash against contentHash; any difference stops them.
    rightsStatus: 'CLEARED',
    clearedVersion: Object.freeze({
      index: 'A Dictionary of the Talmud',
      versionTitle: 'A dictionary of the Talmud, London, 1927',
      language: 'he',
      authors: 'Baruch Krupnik / A. M. Silbermann',
      published: 'London, 1927',
      versionSource: 'https://www.nli.org.il/he/books/NNL_ALEPH990026160720205171/NLI',
      sourceInstitution: 'National Library of Israel (nli.org.il)',
      digitizer: 'Sefaria',
      digitizedBySefaria: true,
      license: 'Public Domain',
    }),
    fetchMetaFile: 'sources/talmud-dictionary/raw/fetch.json',
    releaseConfirmation: Object.freeze({
      kind: 'sefaria-written-confirmation',
      receivedAt: '2026-10-01',
      from: 'Team Sefaria (Rachel Lieberman Buckman), an official reply',
      inReplyTo: 'our permission request of 1 October 2026',
      statement: 'Each text\'s licence on Sefaria is per version. The version: Text: A Dictionary of the Talmud; Authors: Baruch Krupnik / A. M. Silbermann; London, 1927; Source: National Library of Israel — nli.org.il; Digitization: Sefaria; License: Public Domain.',
      scope: 'version-specific: clearedVersion only',
      permits: Object.freeze(['offline storage', 'indexing', 'search', 'entry extraction', 'normalisation', 'short Hebrew glosses', 'UI adaptation', 'release builds']),
    }),
    // The earlier status, kept for the record (docs/dictionary/krupnik-impact.md has the full history).
    rightsStatusHistory: Object.freeze([
      Object.freeze({ status: 'DEVELOPMENT_ALLOWED_PENDING_RELEASE_RIGHTS_CONFIRMATION', from: '2026-09-30', until: '2026-10-01', note: 'The owner\'s decision of 2026-09-30 (pass 2): kept for development, not cleared for a store release. Sefaria recorded the version "Public Domain" and lists it among its "Texts Digitized by Sefaria", but by the authors\' death years (Silbermann 1939; Krupnik (Karu, ברוך קרוא) 18 April 1972) the joint work was then judged possibly protected under life + 70 in Israel, the UK and the EU until 2042-12-31 (US: public domain since 2023-01-01). The release build (--release) refused it until a written Sefaria confirmation or the rights holders\' permission was recorded, or the source removed (--exclude krupnik-1927).' }),
      Object.freeze({ status: 'CLEARED', from: '2026-10-01', note: 'Sefaria\'s written confirmation (releaseConfirmation) for this exact version; the --release blocker removed for clearedVersion only.' }),
    ]),
    attribution: 'A Dictionary of the Talmud — Baruch Krupnik & A. M. Silbermann, London 1927. Digitization: Sefaria. Source: National Library of Israel. Public Domain.',
    // Data layers (kept apart; every Krupnik-derived item stays traceable to this source):
    dataLayers: Object.freeze({
      original: 'rawFile: Sefaria\'s entries of clearedVersion stored unaltered ({ref, he}), pinned by contentHash; never edited.',
      normalised: 'Build time only (scripts/dictionary/lexica/krupnik.mjs): headword keys and each sense\'s Hebrew definition (def) with markup stripped and spacing tidied; not shipped.',
      adapted: 'Shipped rows with source code 0 (SENSES, PHRASES, ABBREVIATIONS of wordDictionary.mjs): short glosses cut from def by fixed rules (cleanGloss) or an expansion as printed, with a proclitic (ב ד ו ל מ כ) added by rule — never rewritten.',
      appGenerated: 'Source code 3 (the engine\'s grammar) and 4 (reviewed): the app\'s own glosses; a reviewed gloss records its basis (reviewedAramaic.mjs), and krupnikOnlyBasis traces the ones that rest on Krupnik.',
    }),
    redistributionAllowed: true,
    offlineAllowed: true,
    modificationAllowed: true,
    attributionRequired: false,
    shareAlike: false,
    retrievedAt: '2026-09-30',
    rawFile: 'sources/talmud-dictionary/raw/entries.jsonl',
    contentHash: 'sha256:1ee1f4e97c60a306b983ee0533dfb16bacb71ac434e6566dd91fb92877764890',
    role: 'FINAL_HEBREW_GLOSS',
    useInApp: 'Short Hebrew definitions of Aramaic words, idioms and abbreviations, cut by fixed rules (see the build script); never shown with the source name in the bubble; credited on the sources page (attribution, AboutPage).',
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
    role: 'FINAL_HEBREW_GLOSS',
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
    role: 'FINAL_HEBREW_GLOSS',
    useInApp: 'Lemma detection, spellings, stems, the inflected forms he prints (form → lemma), the abbreviations he prints ("PHRASE (abbr. X)"), proper-name marks, and only the Hebrew he states (his "ch. same" link to the Hebrew entry, "= h. X", the Hebrew verse word a Targum renders). His English is never shown and never translated.',
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
    role: 'PROPER_NAME',
    useInApp: 'Build time only: its proper-noun tags (morph Np) are the token classifier\'s list of biblical names (so the names Onkelos repeats are not counted as unknown Aramaic words). Nothing of it is shipped; credited on the sources page.',
  }),
  Object.freeze({
    sourceId: 'oshb-lexicon',
    imported: false,
    title: 'Open Scriptures Hebrew Lexicon — augmented Strong index and lexical index (Biblical Aramaic part)',
    author: 'Open Scriptures Hebrew Bible Project (from Brown–Driver–Briggs and Strong, public domain)',
    edition: 'github.com/openscriptures/HebrewLexicon, commit 21c9add13bc727d3a951361778e97e3ff7afd1ce: AugIndex.xml and LexicalIndex.xml (xml:lang="arc"), 710 rows (sources/oshb-lexicon/raw/aramaic-index.tsv.gz, sha256:6e5f94bdc8b8e56992fb91fcd58f2330169c244c89f1456be386892c7cbb0b22)',
    provider: 'Open Scriptures (GitHub)',
    sourceUrl: 'https://github.com/openscriptures/HebrewLexicon',
    licenceId: 'cc-by-4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
    role: 'EVIDENCE_ONLY',
    reason: 'Rights are clear (CC BY 4.0). Benchmarked 2026-09-30 as a confirmation of the engine\'s own Daniel/Ezra analyses by OSHB\'s annotated lemma (docs/dictionary/source-benchmarks/biblical-aramaic.md): by the lemma\'s letters, 179 forms (354 tokens) but about a third wrong; with part of speech and single-sense lemmas, 18 forms and 8 of them wrong — the letters do not tell homographs apart (מרא "lord" / "hoe"), and the dictionaries\' Hebrew senses are not the Biblical ones. Not imported: its lemma and BDB English feed the review queue of Daniel/Ezra (docs/dictionary/review/biblical-aramaic-oshb.tsv) as evidence only.',
  }),
  Object.freeze({
    sourceId: 'ben-yehuda-rt',
    imported: true,
    priority: 4,
    title: 'Sefer Rashei Teivot (ספר ראשי תיבות) — Project Ben-Yehuda work 37578',
    heTitle: 'ספר ראשי תיבות',
    author: 'Meir Halperin (as identified by Project Ben-Yehuda); published under the name of Avraham Yitzhak Stern',
    heAuthor: 'מאיר הלפרין (לפי פרויקט בן־יהודה); נדפס בשם אברהם יצחק שטרן',
    edition: 'Sighet: Avraham Kaufmann, 1926 (a reissue of Halperin, הנוטריקון, הסימנים והכינויים, Vilna 1912); volunteers\' transcription, Project Ben-Yehuda public-domain dump commit 5e4277fead7b565f32cc4b352abd3565023a77d8 (version 2026-03), txt/p1950/m37578.txt',
    provider: 'Project Ben-Yehuda (benyehuda.org), public_domain_dump on GitHub',
    sourceUrl: 'https://benyehuda.org/read/37578',
    licenceId: 'public-domain',
    licenceUrl: 'https://github.com/projectbenyehuda/public_domain_dump/blob/5e4277fead7b565f32cc4b352abd3565023a77d8/LICENSE',
    rightsBasis: 'The dump\'s LICENSE (re-read at fetch time): "Public domain … free to make any use of them"; credit to "Project Ben-Yehuda volunteers" requested, not required. Project Ben-Yehuda identifies the work as Meir Halperin\'s (1850–1923: life + 70 ended 1993); published 1926 (US: public domain since 2022). Recorded for the owner: the name printed on the 1926 title page, Avraham Yitzhak Stern, has no recorded death year; the provider\'s attribution to Halperin is the basis.',
    authorDeathYears: Object.freeze({ 'Meir Halperin': 1923 }),
    jurisdictions: Object.freeze({ IL: 'public domain (provider: Project Ben-Yehuda public-domain dump; author d. 1923)', US: 'public domain (published 1926; 95 years ended 2021)' }),
    rightsStatus: 'CLEARED',
    redistributionAllowed: true,
    offlineAllowed: true,
    modificationAllowed: true,
    attributionRequired: false,
    shareAlike: false,
    retrievedAt: '2026-09-30',
    rawFile: 'sources/ben-yehuda/raw/abbreviations.txt',
    contentHash: 'sha256:8a3af69c7a2a8fa0495abf646b2b202756c5cf1421be23b4ebcca9d394de291b',
    role: 'ABBREVIATION_EXPANSION',
    useInApp: 'Abbreviation expansions only (every reading kept as a candidate; published by the fusion rules — agreement with another source or a single reading confirmed by the texts, per reader family). Credited on the sources page with "Project Ben-Yehuda volunteers".',
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
    role: 'FINAL_HEBREW_GLOSS (if ever transcribed)',
    reason: 'The 1541 work is public domain, but no digital text exists (scans only: HebrewBooks 6244, Google Books 9zVGAAAAYAAJ; not on Sefaria, Wikisource or archive.org — rechecked 2026-09-30); modern annotated editions are copyrighted. Not imported; the Onkelos gaps it could fill are listed for a manual lookup (docs/dictionary/source-benchmarks/meturgeman.md).',
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
  // ---------- The open-sources pass (2026-09-30): evaluated, not imported (docs/dictionary/source-benchmarks/) ----------
  Object.freeze({ sourceId: 'panlex', imported: false, title: 'PanLex (panlex.org)', licenceId: 'cc0', role: 'EVIDENCE_ONLY', reason: 'CC0, but the API is gone and the archived dumps (archive.org "panlex-database", 1.27 GB) return HTTP 403; the ACoLi per-language export (2019, CC0) has 184 arc→heb pairs (a third Syriac script, many place names) and 1–2 pairs for jpa/tmr; pair lineage cannot be traced. No gain for the texts of the app (panlex.md).' }),
  Object.freeze({ sourceId: 'wikidata-lexemes', imported: false, title: 'Wikidata Lexemes (Aramaic languages)', licenceId: 'cc0', role: 'EVIDENCE_ONLY', reason: 'CC0; 8 Aramaic, 8 Imperial Aramaic, 2 Jewish Babylonian Aramaic, 0 Jewish Palestinian/Biblical lexemes, no Hebrew glosses (2026-09-30). Nothing to import.' }),
  Object.freeze({ sourceId: 'kaikki-en-wiktionary-aramaic', imported: false, title: 'English Wiktionary via kaikki.org — Aramaic', licenceId: 'cc-by-sa-4.0', role: 'LEMMA_ONLY', reason: 'CC BY-SA 4.0/GFDL; 2,383 entries with lemmas, pointed forms and dialect tags, English glosses only; editors\' work citing Jastrow and Sokoloff (not independent of Jastrow; Sokoloff is copyrighted). Benchmarked as a lemma layer (open-source-pass.md); not imported in this pass.' }),
  Object.freeze({ sourceId: 'cal', imported: false, title: 'Comprehensive Aramaic Lexicon (cal.huc.edu)', licenceId: 'copyright', role: 'RESEARCH_ONLY', reason: 'No licence or terms grant; all rights reserved by default. CAL_EVIDENCE_ONLY: manual consultation only, never scraped or bundled.' }),
  Object.freeze({ sourceId: 'talmudlab-word-translation', imported: false, title: 'TalmudLab/talmud-word-translation (GitHub)', licenceId: 'none', role: 'RESEARCH_ONLY', reason: 'No licence; built on Sefaria\'s Jastrow database and Dicta\'s Talmudic Aramaic lexicon under private access, and CAL-aligned data (nsantacruz/PSHAT, no licence). Architecture notes only; no data used.' }),
  Object.freeze({ sourceId: 'tishbi-1541', imported: false, title: 'Sefer HaTishbi (Elijah Levita, Isny 1541)', licenceId: 'cc-by-sa-4.0', role: 'EVIDENCE_ONLY', reason: 'The work is public domain; Hebrew Wikisource\'s typed text (CC BY-SA 4.0 for its additions) is in progress (introductions and letters א–ד only); archive.org has NLI scans (images). Not imported.' }),
  Object.freeze({ sourceId: 'arukh-hashalem-kohut', imported: false, title: 'Arukh HaShalem (ed. Alexander Kohut, Vienna 1878–92)', licenceId: 'public-domain', role: 'EVIDENCE_ONLY', reason: 'Public domain; archive.org volumes with Tesseract OCR (fair body text, noisy headwords). Evidence only, frequency-targeted and checked against the scan; nothing enters the dictionary automatically.' }),
  Object.freeze({ sourceId: 'heilprin-erkhei-hakinuyim', imported: false, title: 'Erkhei HaKinuyim (Yechiel Heilprin, d. 1746)', licenceId: 'public-domain', role: 'ABBREVIATION_EXPANSION', reason: 'Public domain, but scans only (HebrewBooks); no text. Not imported.' }),
  Object.freeze({ sourceId: 'ben-yehuda-assaf-sigla', imported: false, title: 'Simcha Assaf, קיצורים וראשי תיבות (Project Ben-Yehuda 43775)', licenceId: 'public-domain', role: 'ABBREVIATION_EXPANSION', reason: 'Public domain (Ben-Yehuda dump), but a list of about 40 bibliographic sigla of the Geonic literature (תשובות גאוני מזרח ומערב …), not abbreviations of the words of the texts. Not imported.' }),
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

// Rights status of an imported source. CLEARED: usable in any build. DEVELOPMENT_ALLOWED_PENDING_RELEASE_RIGHTS_
// CONFIRMATION: usable in development builds; a release build refuses it until releaseConfirmation records one of:
export const RIGHTS_STATUSES = Object.freeze(['CLEARED', 'DEVELOPMENT_ALLOWED_PENDING_RELEASE_RIGHTS_CONFIRMATION']);
export const RELEASE_CONFIRMATIONS = Object.freeze([
  'sefaria-written-confirmation', // written Sefaria confirmation covering this exact digitization (version-specific)
  'rights-holder-permission', // permission of the rights holders
]);
export const rightsStatusOf = source => source.rightsStatus || 'CLEARED';
// The release gate: the imported sources a store release may not ship (removal is the third way out).
export function releaseBlockers(sources = DICTIONARY_SOURCES, { excluded = [] } = {}) {
  return sources.filter(s => s.imported && !excluded.includes(s.sourceId) && rightsStatusOf(s) !== 'CLEARED' && !RELEASE_CONFIRMATIONS.includes(s.releaseConfirmation?.kind))
    .map(s => `${s.sourceId}: ${rightsStatusOf(s)} — a release needs ${RELEASE_CONFIRMATIONS.join(' or ')} recorded in releaseConfirmation, or the source removed`);
}

// Version-specific clearance: a source cleared for one version (clearedVersion) is usable only when the version it was
// fetched from (the fetcher's record, fetchMetaFile) is that version, field by field, and the raw file is the one
// fetched (its hash). Nothing is inferred for another version, translation or text. Returns problems (empty = match).
export const VERSION_FIELDS = Object.freeze(['index', 'versionTitle', 'versionSource', 'digitizedBySefaria', 'license']);
export function versionClearanceProblems(source, fetchMeta) {
  if (!source.clearedVersion) return [];
  if (!fetchMeta) return [`${source.sourceId}: cleared for one version only, but its fetch record (${source.fetchMetaFile}) is missing`];
  const problems = VERSION_FIELDS.filter(field => fetchMeta[field] !== source.clearedVersion[field])
    .map(field => `${source.sourceId}: fetched version ${field} ${JSON.stringify(fetchMeta[field])} ≠ cleared version ${JSON.stringify(source.clearedVersion[field])} — the clearance does not extend to another version`);
  if (`sha256:${fetchMeta.sha256}` !== source.contentHash) problems.push(`${source.sourceId}: the fetch record's hash sha256:${fetchMeta.sha256} ≠ contentHash ${source.contentHash}`);
  return problems;
}

// The rights gate: every imported source complete and cleared. Returns a list of problems (empty = cleared).
// fetchMetas ({ sourceId: fetch record }): when given, version-cleared sources are checked against it (the build always
// passes it; a release build requires it).
export function auditDictionarySources(sources = DICTIONARY_SOURCES, { release = false, excluded = [], fetchMetas } = {}) {
  const problems = [];
  for (const source of sources.filter(item => item.imported && !excluded.includes(item.sourceId))) {
    // A written confirmation clears one version: it must name that version (clearedVersion) and its fetch record.
    if (source.releaseConfirmation?.kind === 'sefaria-written-confirmation' && (!source.clearedVersion || !source.fetchMetaFile)) problems.push(`${source.sourceId}: a Sefaria confirmation is version-specific — clearedVersion and fetchMetaFile are required`);
    if (fetchMetas || (release && source.clearedVersion)) problems.push(...versionClearanceProblems(source, fetchMetas?.[source.sourceId]));
  }
  for (const source of sources.filter(item => item.imported)) if (!RIGHTS_STATUSES.includes(rightsStatusOf(source))) problems.push(`${source.sourceId}: unknown rightsStatus ${source.rightsStatus}`);
  if (release) problems.push(...releaseBlockers(sources, { excluded }));
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
