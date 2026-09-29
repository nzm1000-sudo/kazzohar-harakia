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
    note: 'שחרית, מנחה, ערבית ורוב הסדרים מסידור מצודה (ספריא). מה שחסר בו — במה מדליקין, פרקי אבות, שיר המעלות שאחרי ברכי נפשי, על הכל ואב הרחמים הוא ירחם, ויתן לך — מ"הסידור השלם" של בירנבוים (1949), גם הוא נוסח אשכנז, ברישיון נפרד (CC BY-SA 4.0) החל רק על הקטעים האלה.',
    // The second licensed edition of the rite (registry.mjs `extras`), used ONLY for the sections the Metsudah
    // edition lacks. Its CC BY-SA 4.0 licence (attribution + share-alike) applies to those sections and to their
    // pack (siddurAshkenazBirnbaum.mjs) — not to the app, not to the Metsudah text, not to any other rite.
    extraEditions: [{
      index: 'HaSiddur HaShalem Birnbaum',
      work: 'הַסִּדּוּר הַשָּׁלֵם (Daily Prayer Book: Ha-Siddur ha-Shalem) — נוסח אשכנז',
      version: 'פלטיאל בירנבוים (עורך ומתרגם), בית ההוצאה העברי, ניו יורק, 1949 · העתקת ויקיטקסט העברי, עמודי ההגהה (מרחב "עמוד:") בלבד',
      editor: 'Paltiel (Philip) Birnbaum',
      year: 1949,
      provider: 'ויקיטקסט העברי (he.wikisource.org) — מפתח העמודים של הסידור; לא המהדורה המעובדת "הסידור השלם (בירנבוים)/אשכנז"',
      sourceUrl: 'https://he.wikisource.org/wiki/%D7%9E%D7%A4%D7%AA%D7%97:Philip_Birnbaum_-_ha-Siddur_ha-Shalem_(The_Daily_Prayer_Book,1949).pdf',
      indexRevid: 2904888,
      license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', attributionRequired: true, shareAlike: true,
      underlyingWork: 'הספר (1949) בנחלת הכלל בארה״ב (זכויות היוצרים לא חודשו); ההקלדה וההגהה של ויקיטקסט — CC BY-SA 4.0',
      attribution: 'הסידור השלם, פלטיאל בירנבוים (ניו יורק: בית ההוצאה העברי, 1949), נוסח אשכנז — העתקת ויקיטקסט העברי (עמודי ההגהה), CC BY-SA 4.0',
      // Shown beside each section taken from this edition (the reader), so the licence line sits on exactly those sections.
      sectionCredit: 'מתוך הסידור השלם (בירנבוים, 1949), העתקת ויקיטקסט · CC BY-SA 4.0',
      sections: ['במה מדליקין · אמר רבי אלעזר (קבלת שבת)', 'על הכל · אב הרחמים הוא ירחם (שחרית של שבת)', 'שיר המעלות, תהלים קכ–קלד (מנחה לשבת בחורף)', 'פרקי אבות, פרקים א–ו (מנחה לשבת בקיץ)', 'ויתן לך (ערבית למוצאי שבת)'],
      pages: 'עמ׳ 251–255, 367, 467–475, 477–533, 541–549 (43 עמודים, כולם במצב "בוצעה הגהה" או "מאומת") — כל עמוד, הגרסה (revision) והמצב שלו: sources/birnbaum-ashkenaz/provenance.json',
      accessedAt: '2026-09-28',
      modified: true,
      changes: 'docs/siddur/birnbaum-ashkenaz-import.md — markup only (running heads, links, page breaks joined, directions as small print); the words and points are the transcription\'s. The transcription itself differs from the 1949 print where the Wikisource editors say so (verse spelling after Mikra al pi ha-Masorah, maqaf, qamats qatan; each recorded in provenance.json "variants").',
      changesHe: 'סימון בלבד (כותרות רצות, קישורים, איחוד פסקה שנחצתה בין עמודים, הוראות באות קטנה). ההעתקה עצמה שונה מדפוס 1949 במקומות שעורכי ויקיטקסט ציינו (כתיב הפסוקים לפי "מקרא על פי המסורה", מקפים, קמץ קטן) — כל מקום רשום ב־provenance.json.',
    }],
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
    note: 'כל דף מהגרסה שספריא מציגה בו (תורת אמת 357 או מצודה). שלושה דפים שבגרסת מצודה שלהם נשמטו מילים — שורת שבועות ביעלה ויבוא של ברכת המזון, והיה אם שמוע ויאמר בקריאת שמע על המיטה, "הזה, נעשה ונקריב… כאמור" במוסף — נקראים במקומות אלה בלבד מגרסת תורת אמת 357 של אותם דפים (נחלת הכלל). שום קטע לא הושלם מנוסח אחר.',
    // The Torat Emet 357 version of three leaves whose bundled version (Metsudah) lost words — the same Sefaria index,
    // the same rite, a version the main pack already carries for most of its leaves. Used only for what is missing.
    extraEditions: [{
      index: 'Siddur Sefard Torat Emet',
      work: 'סידור ספרד (נוסח ספרד החסידי) — גרסת תורת אמת 357 של אותם דפים',
      version: 'Torat Emet 357 (ספריא, "Siddur Sefard") — ברכת המזון, קריאת שמע על המיטה, מוסף לשלוש רגלים ¶26',
      editor: 'תורת אמת',
      provider: 'Sefaria (index "Siddur Sefard", version "Torat Emet 357")', sourceUrl: 'https://www.sefaria.org/Siddur_Sefard',
      versionSource: 'http://www.toratemetfreeware.com/index.html?downloads',
      license: 'Public Domain', licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/', attributionRequired: false,
      attribution: 'סידור ספרד: תורת אמת 357 (נחלת הכלל), דרך ספריא — שורת שבועות ביעלה ויבוא של ברכת המזון, והיה אם שמוע ויאמר בקריאת שמע על המיטה, "הזה, נעשה ונקריב… כאמור" במוסף',
      sections: ['יעלה ויבוא בברכת המזון — בשבועות', 'והיה אם שמוע · ויאמר (קריאת שמע על המיטה, "יש אומרים")', '"הַזֶּה, נַעֲשֶׂה וְנַקְרִיב… כָּאָמוּר" אחרי שם החג במוסף של פסח, שבועות וסוכות'],
      versions: [{ title: 'Torat Emet 357', license: 'Public Domain' }],
      accessedAt: '2026-09-29',
      modified: true,
      changesHe: 'סימון בלבד: פסקה אחת (מוסף ¶26) חולקה לשתיים בגבול שבמהדורה עצמה — "הַזֶּה, נַעֲשֶׂה וְנַקְרִיב… כָּאָמוּר", המודפס פעם אחת אחרי שורת החג האחרונה וממשיך כל שורה; שאר הפסקאות כפי שהן בספריא, אות באות.',
      changes: 'sources/sefard-torat-emet/provenance.json — markup only: Yom Tov Musaf ¶26 split in two at the edition\'s own boundary ("הַזֶּה, נַעֲשֶׂה…", printed once after the last festival line and continuing every line); every other paragraph is Sefaria\'s, byte for byte.',
    }],
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
    note: 'ימות החול מסידור תורה אור; שבת, מועדים ושאר הסדרים מהעתקת הסידור הפתוח התואמת לסידור תהלת ה׳ — שתיהן נוסח האר״י של אדמו״ר הזקן. שום קטע לא הושלם מנוסח אחר.',
    // The second licensed edition of the rite (registry.mjs `extras`).
    extraEditions: [{
      index: 'Siddur Tehillat Hashem',
      work: 'סידור תהלת ה׳ — נוסח האר״י ז״ל על פי אדמו״ר הזקן (העתקה התואמת לנוסח הסידור)',
      version: 'Open Siddur Project, Nusach Ha-Ari Zal, v3.0 (2010) – v3.82 (2015), transcribed by Shmuel Gonzales',
      editor: 'שמואל גונזלס (הקלדה ועימוד); הוראות באנגלית',
      provider: 'Open Siddur Project (opensiddur.org, post 1260; fetched via the Wayback Machine)', sourceUrl: 'https://opensiddur.org/?p=1260',
      license: 'CC0 (Hebrew) / CC BY 4.0 (instructions)', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', attributionRequired: true,
      attribution: 'סידור תהלת ה׳ (נוסח האר״י): Contributors to the Open Siddur Project, transcribed by Shmuel Gonzales — עברית CC0, הוראות CC BY 4.0',
      modified: true, accessedAt: '2026-09-28',
      changes: 'docs/siddur/chabad-tehillat-hashem-import.md — markup only (headings, instructions, tables, footnote markers); no prayer word changed',
    }, {
      // One passage missing from both open editions (Shabbat Yotzer), typed and pointed by the app's owner. The prayer
      // itself is public domain; the words were checked against the public-domain 1940 Torah Ohr scan. Not CC-licensed.
      index: 'Siddur Chabad Owner Transcription',
      work: 'הכל יודוך … ואין דומה לך מושיענו לתחיית המתים (ברכת יוצר של שבת), נוסח סידור תורה אור',
      version: 'הקלדה וניקוד של בעל האפליקציה, 2026-09-29',
      editor: 'בעל האפליקציה',
      provider: 'הקלדה עצמית; המילים נבדקו מול סריקת סידור תורה אור, שולזינגר 1940 (נחלת הכלל), עמ׳ 125–126 בקובץ',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Siddur_Torah_Ohr_(Schulzinger_Bros._1940).pdf',
      license: 'Owner', attributionRequired: false,
      attribution: 'הכל יודוך (שבת, נוסח חב״ד): הוקלד ונוקד בידי בעל האפליקציה, לפי סידור תורה אור (1940)',
      sectionCredit: 'הוקלד ונוקד בידי בעל האפליקציה · לפי סידור תורה אור (1940)',
      sections: ['הכל יודוך … ואין דומה לך מושיענו לתחיית המתים — שחרית של שבת, בין יוצר אור לאל אדון'],
      versions: [{ title: 'הקלדת בעל האפליקציה', license: 'Owner', verified: true, verifiedAt: '2026-09-29', source: 'sources/chabad-owner-transcription/README.md' }],
      accessedAt: '2026-09-29',
      modified: true,
      changesHe: 'ארבע מילים (בחמישה מקומות) הותאמו לסריקה לבקשת בעל האפליקציה, בניקוד שמסר: "יוֹצֵר הַכֹּל" (במקום "הַיּוֹצֵר אֶת הַכֹּל"), "דַּלְתוֹת" (במקום "דַּלְתֵי"), "אֵין עֲרוֹךְ לְךָ" (פעמיים, במקום "אֵין כְּעֶרְכְּךָ"); סימני התבליט הושמטו וכל שורה היא פסקה.',
      changes: 'sources/chabad-owner-transcription/README.md',
    }],
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
