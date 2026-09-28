// Every source is its own entity, with its rights. A record cites these ids and the exact place inside them.
// Only sources whose edition is public domain may lend their words verbatim (excerpts); for anything else the
// record keeps a citation and an original, brief description.

export const TRADITION_SOURCES = [
  {
    id: 'ben-ish-hai',
    title: 'בן איש חי — הלכות (שנה ראשונה ושנה שנייה)',
    author: 'רבי יוסף חיים מבגדאד',
    publisher: 'ירושלים',
    publicationYear: '1898',
    sourceType: 'rabbinic_work',
    url: 'https://www.sefaria.org/Ben_Ish_Hai',
    license: 'public_domain',
    commercialReuseAllowed: true,
    attributionRequired: false,
    retrievedAt: '2026-09-28',
    notes: 'נוסח ויקיטקסט ("Ben Ish Hai -- Wikisource"), נחלת הכלל, דרך ספריא. המחבר, רבה של בגדאד, מתעד בו את מנהגי עירו.',
  },
  {
    id: 'shulchan-arukh-oc',
    title: 'שולחן ערוך, אורח חיים, עם הגהות הרמ"א',
    author: 'רבי יוסף קארו; הגהות: רבי משה איסרליש (הרמ"א)',
    sourceType: 'rabbinic_work',
    url: 'https://www.sefaria.org/Shulchan_Arukh,_Orach_Chayim',
    license: 'public_domain',
    commercialReuseAllowed: true,
    attributionRequired: false,
    retrievedAt: '2026-09-28',
    notes: 'מהדורת תורת אמת, נחלת הכלל (הטקסט שמצורף לספריית האפליקציה). בהגהותיו רשם הרמ"א את מנהגי אשכנז ("במדינות אלו").',
  },
];
