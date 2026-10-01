// How each rite's siddur is gathered on the Siddur home: the same families for every rite, in one order (SIDDUR_HOME_ORDER:
// השעון היהודי (its own route) first, then weekday, חק לישראל (its own route), Rosh Chodesh and fasts, Shabbat, piyyutim and zemirot, festivals, blessings, the smart blessings engine),
// each built from that rite's own table of contents.
// A "root" is a path into the edition's tree (Sefaria's English titles). Its children are the rows of the flow: a leaf
// opens itself; a group (Ashkenaz writes each Amidah blessing as its own leaf) opens as one page made of its leaves.
// Nothing here is text, and no rite borrows a root from another rite's tree.
import { DEFAULT_NUSACH } from './registry.mjs';

const EDOT = {
  groups: [
    { key: 'weekday', title: 'תפילות החול', roots: [['Preparatory Prayers'], ['Weekday Shacharit'], ['Additions for Shacharit'], ['Weekday Mincha'], ['Weekday Arvit'], ['Bedtime Shema'], ['The Midnight Rite']] },
    { key: 'seasons', title: 'ראש חודש ותעניות', roots: [['Rosh Hodesh'], ['Blessing of the Moon'], ['Fast Days and Mourning']] },
    // שיר השירים before Kabbalat Shabbat: the edition's own leaf is not in the bundle, so it reads from the bundled Tanakh, chapter by chapter, offline.
    { key: 'shabbat', title: 'שבת', roots: [['Shabbat Candle Lighting'], { key: 'Song of Songs', title: 'שיר השירים', items: Array.from({ length: 8 }, (_, i) => ({ reference: `Song of Songs ${i + 1}`, title: `שיר השירים · פרק ${['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח'][i]}׳`, mode: 'cantillation' })) }, ['Kabbalat Shabbat'], ['Shabbat Arvit'], ['Shabbat Evening'], ['Shabbat Shacharit'], ['Shabbat Mussaf'], ['Daytime Meal'], ['Shabbat Mincha'], ['Third Meal'], ['Havdalah'], ['Mishna Study for Shabbat']] },
    { key: 'blessings', title: 'ברכות', roots: [['Post Meal Blessing'], ['Al Hamihya'], ['Blessings on Enjoyments'], ['Assorted Blessings and Prayers']] },
  ],
  // The festival shelf of Edot HaMizrach is data/siddurMoadim.mjs (Haggadah, Megillah, Selichot…); these roots feed it.
  moadimRoots: [['Hanukkah'], ['Purim'], ['Prayers for Three Festivals'], ['Counting of the Omer'], ['Nissan']],
  collections: ['Additions for Shacharit', 'Hanukkah', 'Purim', 'Nissan', 'Fast Days and Mourning', 'Assorted Blessings and Prayers', 'Mishna Study for Shabbat'],
  extras: {
    'Weekday Arvit': [[['Counting of the Omer'], 'ספירת העומר'], [['Blessing of the Moon'], 'ברכת הלבנה']],
    'Weekday Mincha': [[['Fast Days and Mourning', 'Torah Reading for Fast Days'], 'קריאת התורה לתענית ציבור']],
  },
  prayerRoots: { weekday: { shacharit: 'Weekday Shacharit', mincha: 'Weekday Mincha', maariv: 'Weekday Arvit' }, shabbat: { shacharit: 'Shabbat Shacharit', mincha: 'Shabbat Mincha', maariv: 'Shabbat Arvit' } },
  flowOrder: {
    'Preparatory Prayers': ['Modeh Ani', 'Morning Blessings', 'Torah Blessings'],
    'Weekday Shacharit': ['Petichat Eliyahu', 'Order of Talit', 'Order of Tefillin', "Hanna's Prayer", 'Incense Offering', 'Hodu', "Pesukei D'Zimra", 'The Shema', 'Amida', 'Vidui', 'Torah Reading', 'Ashrei', 'Uva LeSion', 'Beit Yaakov', 'Song of the Day', 'Kaveh', 'Alenu'],
    'Weekday Mincha': ['Offerings', 'Amida', 'Vidui', 'Alenu'],
    'Weekday Arvit': ['Barchu', 'The Shema', 'Amidah', 'Alenu'],
    'Shabbat Arvit': ['Barchu', 'The Shema', 'Magen Avot', 'Alenu'],
    'Shabbat Evening': ['Shalom Alekhem', 'Eshet Hayil', 'Atkenu Seudata', 'Kiddush', 'Blessing of Children', 'First Meal', 'Zohar', 'Songs for Shabbat'],
    'Shabbat Shacharit': ['Psalms for Shabbat', "Pesukei D'Zimra", 'The Shema', 'Amidah', 'Torah Reading', 'HaGomel', 'Haftarah', 'Birkat HaChodesh', 'Announcement of Fast', 'Mi Sheberach', 'Ashrei'],
    'Shabbat Mussaf': ['Amida', 'Incense Offering', 'Alenu'],
    'Shabbat Mincha': ['Offerings', 'Uva LeSion', 'Amida', 'Alenu'],
    'Havdalah': ['Before Havdalah', 'Havdala', 'Motzei Shabbat Songs', 'Veyiten Lecha', 'Fourth Meal'],
    'Rosh Hodesh': ['Rosh Hodesh', 'Hallel', 'Uva LeSion', 'Song of the Day', 'Mussaf', 'Barchi Nafshi', 'Kaveh', 'Incense Offering', 'Alenu'],
    'Prayers for Three Festivals': ['Prayers for Three Festivals', 'Song for Passover', 'Song for Shavuot', 'Song for Sukkot', 'Song for Shemini Atzeret', 'Amidah', 'Mussaf'],
    'Post Meal Blessing': ['Post Meal Blessing'],
    'Bedtime Shema': ['Bedtime Shema'],
    'Hallel': ['Hallel'],
  },
  hidden: [['Weekday Shacharit', 'Morning Prayer']],
  smartSiddur: true,
};

const ASHKENAZ = {
  groups: [
    { key: 'weekday', title: 'תפילות החול', roots: [['Weekday', 'Shacharit'], ['Weekday', 'Minchah'], ['Weekday', 'Maariv']] },
    { key: 'seasons', title: 'ראש חודש ותעניות', roots: [['Festivals', 'Rosh Chodesh'], ['Festivals', 'Selichot']] },
    { key: 'shabbat', title: 'שבת', roots: [['Shabbat', 'Kabbalat Shabbat'], ['Shabbat', 'Maariv'], ['Shabbat', 'Shabbat Evening'], ['Shabbat', 'Shacharit'], ['Shabbat', 'Musaf LeShabbat'], ['Shabbat', 'Daytime Meal'], ['Shabbat', 'Minchah'], ['Shabbat', 'Third Meal'], ['Shabbat', 'Havdalah']] },
    { key: 'moadim', title: 'מועדים', roots: [['Festivals', 'Shalosh Regalim'], ['Festivals', 'Sukkot'], ['Festivals', 'Chanukah'], ['Festivals', 'Prayer for Dew'], ['Festivals', 'Prayer for Rain']] },
    { key: 'blessings', title: 'ברכות', roots: [['Berachot', 'Birkat HaMazon'], ['Berachot', 'Birkat Hanehenin'], ['Berachot', 'Birkhot Hamitzvot'], ['Berachot', 'Tefillat HaDerech'], ['Berachot', 'Havinenu'], ['Berachot', 'Asher Yatzar Etchem Badin'], ['Kaddish']] },
  ],
  collections: ['Festivals, Selichot', 'Festivals, Sukkot', 'Berachot, Birkat Hanehenin', 'Kaddish'],
  extras: {},
  prayerRoots: { weekday: { shacharit: 'Weekday, Shacharit', mincha: 'Weekday, Minchah', maariv: 'Weekday, Maariv' }, shabbat: { shacharit: 'Shabbat, Shacharit', mincha: 'Shabbat, Minchah', maariv: 'Shabbat, Maariv' } },
  flowOrder: {},
  hidden: [],
  smartSiddur: false,
};

const SEFARD = {
  groups: [
    { key: 'weekday', title: 'תפילות החול', roots: [['Upon Arising'], ['Weekday Shacharit'], ['Additional Prayers '], ['Weekday Mincha'], ['Weekday Maariv'], ['Bedtime Shema'], ['Kiddush Levanah']] },
    { key: 'seasons', title: 'ראש חודש ותעניות', roots: [['Rosh Chodesh'], ['Fast Days'], ['Torah Readings']] },
    { key: 'shabbat', title: 'שבת', roots: [['Shabbat Candle Lighting'], ['Eruv Tavshilin'], ['Shabbat Eve Mincha'], ['Kabbalat Shabbat'], ['Shabbat Eve Maariv'], ['Shabbat Evening Meal'], ['Shabbat Morning Services'], ['Musaf'], ['Shabbat Day Meal'], ['Shabbat Mincha'], ['Third Meal'], ['Motzaei Shabbat ']] },
    { key: 'moadim', title: 'מועדים', roots: [['Holidays'], ['Shaking Lulav'], ['Nissan'], ['Pesach Haggadah'], ['Sukkot'], ['Simchat Torah'], ['Shavuot'], ['Chanukah'], ['Purim'], ['Yotzerot'], ['Lag BaOmer Songs']] },
    { key: 'blessings', title: 'ברכות', roots: [['Birchat HaMazon'], ['Mealtime Blessings'], ['Blessings'], ['Various Blessings'], ['Priestly Blessing'], ['Various Prayers & Segulot']] },
  ],
  collections: ['Additional Prayers ', 'Fast Days', 'Torah Readings', 'Blessings', 'Various Blessings', 'Various Prayers & Segulot', 'Lag BaOmer Songs', 'Yotzerot', 'Nissan', 'Sukkot', 'Purim', 'Chanukah', 'Holidays'],
  extras: {},
  prayerRoots: { weekday: { shacharit: 'Weekday Shacharit', mincha: 'Weekday Mincha', maariv: 'Weekday Maariv' }, shabbat: { shacharit: 'Shabbat Morning Services', mincha: 'Shabbat Mincha', maariv: 'Shabbat Eve Maariv' } },
  flowOrder: {},
  hidden: [],
  smartSiddur: false,
};

const CHABAD = {
  groups: [
    { key: 'weekday', title: 'תפילות החול', roots: [['Shacharit'], ['Mincha'], ['Maariv'], ['Sefirat HaOmer'], ['Bedtime Shema'], ['Kiddush Levanah']] },
    { key: 'seasons', title: 'ראש חודש ותעניות', roots: [['Rosh Chodesh'], ['Hallel']] },
    // The licensed source (Siddur Torah Or, weekday) has no Shabbat services: shown as missing, never filled from another rite.
    { key: 'shabbat', title: 'שבת', roots: [], missing: 'תפילות שבת ומועדים אינן במקור המורשה של נוסח חב״ד (סידור תורה אור לימות החול). הן לא הושלמו מנוסח אחר.' },
    { key: 'moadim', title: 'מועדים', roots: [['Musaf for Festivals'], ['Lulav'], ['Chanukah'], ['Purim'], ['Reading of the Nassi'], ['Annulment of Vows'], ['Kapparot']] },
    { key: 'blessings', title: 'ברכות', roots: [['Blessings'], ['Blessings of Marriage Ceremony'], ['Order of a Circumcision'], ['Pidyon HaBen'], ['Mishnayot for a Mourner']] },
  ],
  collections: ['Blessings'],
  extras: {},
  prayerRoots: { weekday: { shacharit: 'Shacharit', mincha: 'Mincha', maariv: 'Maariv' }, shabbat: null },
  flowOrder: {},
  hidden: [],
  smartSiddur: false,
};

// The top-level categories of the Siddur home, in this order for every rite. The layout's groups carry the rite's own
// roots; "zemirot" (the shared zemirot book), the Edot HaMizrach festival shelf and "brachot" (the engine, its own route)
// are drawn by the page. A category a rite has no content for is not shown (or shows its "missing" note, as Chabad's
// Shabbat does); "עוד בסידור" — whatever of the edition no category places — follows at the very end.
export const SIDDUR_HOME_ORDER = Object.freeze([
  { key: 'weekday', title: 'תפילות החול' },
  // חק לישראל: the daily learning after the morning prayer (מהרח״ו: "בצאתו מבית הכנסת") — a card of its own that opens today.
  { key: 'chok', title: 'חק לישראל', note: 'הלימוד היומי', route: 'chok-leyisrael' },
  { key: 'seasons', title: 'ראש חודש ותעניות' },
  { key: 'shabbat', title: 'שבת' },
  { key: 'zemirot', title: 'פיוטים וזמירות' },
  { key: 'moadim', title: 'מועדים' },
  { key: 'blessings', title: 'ברכות' },
  { key: 'brachot', title: 'מנוע הברכות החכם', note: 'מה מברכים על זה?', route: 'siddur-brachot' },
]);
// Orders any list of home categories by SIDDUR_HOME_ORDER; keys it does not name keep their relative order after it.
export function orderSiddurHome(items, keyOf = item => item.key) {
  const rank = key => { const index = SIDDUR_HOME_ORDER.findIndex(entry => entry.key === key); return index < 0 ? SIDDUR_HOME_ORDER.length : index; };
  return items.map((item, index) => ({ item, index })).sort((a, b) => rank(keyOf(a.item)) - rank(keyOf(b.item)) || a.index - b.index).map(entry => entry.item);
}

export const SIDDUR_LAYOUTS = { 'edot-hamizrach': EDOT, ashkenaz: ASHKENAZ, sefard: SEFARD, chabad: CHABAD };
export const siddurLayout = nusach => SIDDUR_LAYOUTS[nusach] || SIDDUR_LAYOUTS[DEFAULT_NUSACH];
export const rootKey = path => (Array.isArray(path) ? path.join(', ') : path.key);

// The English title of the Siddur root that holds a prayer in this rite ("Weekday, Minchah"), for opening the
// printed prayer directly (Today's smart-prayer card, the fallback of the Smart Siddur).
export function prayerRootFor(nusach, prayerType, { isShabbat = false } = {}) {
  const layout = siddurLayout(nusach);
  const table = isShabbat ? layout.prayerRoots.shabbat || layout.prayerRoots.weekday : layout.prayerRoots.weekday;
  return table?.[prayerType] || layout.prayerRoots.weekday[prayerType] || null;
}

// Concept keys for the Halacha-in-Siddur hints (data/halachaSiddurLinks.mjs), from a section's English title in any
// rite: the link follows the prayer concept, not an Edot HaMizrach text id.
const CONCEPTS = [
  ['mussaf', /musaf|mussaf/i],
  ['amida', /amida|amidah|shemoneh|shmoneh|eighteen/i],
  ['shema', /shema/i],
  ['hallel', /hallel/i],
  ['birkat-hamazon', /birkat hamazon|birchat hamazon|birkas hamazon|post meal/i],
  ['talit', /talit|tallit|tallis|tzitzit|tefillin/i],
  ['omer', /omer/i],
  ['lulav', /lulav/i],
];
export function halachaConceptForTitle(title = '') {
  const text = String(title || '');
  return CONCEPTS.find(([, pattern]) => pattern.test(text))?.[0] || null;
}
