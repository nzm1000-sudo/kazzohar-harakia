// The siddur source and licence manifest: where every rite's prayer text comes from, under which licence, and what
// attribution it needs. Machine-readable; tests read it (tests/nusachSiddur.test.mjs) and refuse any bundled leaf whose
// licence is not on the allowlist. Nothing here is prayer text. `modified: false` everywhere: the editions are quoted
// paragraph by paragraph, never retyped; the app only chooses which of the edition's own alternatives to show.

// Licences the app may redistribute inside the offline bundle (Sefaria's own licence strings, normalized).
export const LICENSE_ALLOWLIST = ['CC0', 'Public Domain', 'CC-BY', 'CC-BY-SA'];

export function normalizeLicense(value) {
  const text = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!text || text === 'unknown') return null;
  if (/^cc0/.test(text) || /cc-0/.test(text)) return 'CC0';
  if (/public domain/.test(text)) return 'Public Domain';
  if (/cc[- ]by[- ]sa/.test(text)) return 'CC-BY-SA';
  if (/cc[- ]by/.test(text)) return 'CC-BY';
  return null;
}

export const SIDDUR_SOURCES = {
  'edot-hamizrach': {
    index: 'Siddur Edot HaMizrach', file: null, // bundled statically: src/data/siddurOffline.mjs (opens on app start)
    work: 'סידור נוסח עדות המזרח', version: 'מהדורת מרדכי שליח ציבור (Shaliehsaboo Edition)', editor: 'מרדכי שליח ציבור',
    provider: 'Sefaria', sourceUrl: 'https://www.sefaria.org/Siddur_Edot_HaMizrach',
    license: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', attributionRequired: false,
    attribution: 'סידור עדות המזרח, מהדורת מרדכי שליח ציבור, ספריא, CC0', modified: false, accessedAt: '2026-09-26',
    versions: [{ title: ' Shaliehsaboo Edition', license: 'CC0' }],
  },
  ashkenaz: {
    index: 'Siddur Ashkenaz', file: 'siddurAshkenaz.mjs',
    work: 'סידור אשכנז', version: 'The Metsudah Siddur (Metsudah Publications, 1981) · סידור דעת (מכללת הרצוג)', editor: 'Metsudah Publications; דעת — מכללת הרצוג',
    provider: 'Sefaria', sourceUrl: 'https://www.sefaria.org/Siddur_Ashkenaz',
    license: 'CC-BY / Public Domain (per leaf, recorded on each text)', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', attributionRequired: true,
    attribution: 'סידור אשכנז: The Metsudah Siddur, 1981 (CC BY, הספרייה הלאומית) ו־Daat Siddur Ashkenaz (נחלת הכלל), דרך ספריא', modified: false, accessedAt: '2026-09-28',
    versions: [
      { title: 'The Metsudah siddur, 1981', license: 'CC-BY', source: 'https://www.nli.org.il/he/books/NNL_ALEPH002211687' },
      { title: 'The Metsudah siddur: a new linear siddur with English translation by Avrohom Davis, 1981', license: 'CC-BY', source: 'https://www.nli.org.il/he/books/NNL_ALEPH002211687' },
      { title: 'Daat Siddur Ashkenaz', license: 'Public Domain' },
    ],
  },
  sefard: {
    index: 'Siddur Sefard', file: 'siddurSefard.mjs',
    work: 'סידור ספרד (נוסח ספרד החסידי — לא נוסח עדות המזרח)', version: 'תורת אמת 357 (נחלת הכלל) · The Metsudah Siddur (1981)', editor: 'תורת אמת; Metsudah Publications',
    provider: 'Sefaria', sourceUrl: 'https://www.sefaria.org/Siddur_Sefard',
    license: 'Public Domain / CC-BY (per leaf, recorded on each text)', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', attributionRequired: true,
    attribution: 'סידור ספרד: תורת אמת 357 (נחלת הכלל) ו־The Metsudah Siddur, 1981 (CC BY), דרך ספריא', modified: false, accessedAt: '2026-09-28',
    versions: [
      { title: 'Torat Emet 357', license: 'Public Domain' },
      { title: 'The Metsudah siddur, 1981', license: 'CC-BY', source: 'https://www.nli.org.il/he/books/NNL_ALEPH002211687' },
    ],
  },
  chabad: {
    index: 'Weekday Siddur Chabad', file: 'siddurChabad.mjs',
    work: 'סידור תורה אור — נוסח האר״י ז״ל כפי שסידרו אדמו״ר הזקן, רבי שניאור זלמן מלאדי (1803)', version: 'העתקת ויקיטקסט מדפוס שולזינגר, ניו יורק 1940 (Siddur Torah Ohr, Schulzinger Bros.)', editor: 'ויקיטקסט העברי (הקלדה והגהה מהסריקה); הסריקה מפרויקט הסידור הפתוח',
    provider: 'Sefaria (copy of the Hebrew Wikisource text, version "Wikisource")', sourceUrl: 'https://www.sefaria.org/Weekday_Siddur_Chabad',
    provenanceUrl: 'https://he.wikisource.org/wiki/סידור_תורה_אור', scanUrl: 'https://he.wikisource.org/wiki/מפתח:Siddur_Torah_Ohr_(Schulzinger_Bros._1940).pdf',
    license: 'CC-BY-SA', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/', attributionRequired: true, shareAlike: true,
    underlyingWork: 'נחלת הכלל: הסידור נדפס לראשונה ב־1803; הדפוס המועתק — 1940',
    attribution: 'סידור תורה אור (נוסח האר״י, אדמו״ר הזקן), העתקת ויקיטקסט מדפוס 1940, CC BY-SA 3.0, דרך ספריא', modified: false, accessedAt: '2026-09-28',
    // Sefaria records this version's licence as "unknown"; its provenance was checked by hand on 2026-09-28: the text
    // is the Hebrew Wikisource transcription (pages transcluded from the 1940 scan), released under Wikisource's
    // CC BY-SA 3.0 terms, of a public-domain siddur. Modern Chabad editions (Tehillat Hashem, Kehot) are NOT used.
    versions: [{ title: 'Wikisource', license: 'CC-BY-SA', verified: true, verifiedAt: '2026-09-28', source: 'https://he.wikisource.org/wiki/סידור_תורה_אור' }],
    note: 'סידור ימות החול (שחרית, מנחה, ערבית, ברכות, הלל, ראש חודש, מוסף לרגלים). תפילות שבת ומועדים אינן במקור המורשה — מוצגות כחסרות, לא מולאו מנוסח אחר.',
  },
};

// A leaf may be bundled when its own licence is allowed, or when the manifest vouches for that exact version.
export function licenseAllowed(entry, versionTitle, license) {
  const normalized = normalizeLicense(license);
  if (normalized && LICENSE_ALLOWLIST.includes(normalized)) return { ok: true, license: normalized };
  const vouched = (entry.versions || []).find(version => version.verified && version.title === String(versionTitle || '').trim());
  if (vouched) return { ok: true, license: vouched.license };
  return { ok: false, license: null };
}
