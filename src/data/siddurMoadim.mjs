// The siddur's "מועדים" shelf: every festival's texts in one place, always available — independent of the smart
// siddur and of the season filter. All texts are nusach Edot HaMizrach: the bundled Siddur Edot HaMizrach (whose
// festival "Mussaf" leaf also carries the kiddushim, the Ushpizin, the Zohar for the meals and the Sukkot songs,
// opened here by exact paragraph ranges), Sefaria's Haggadah and Selichot of the same nusach, and Megillat Esther.
// Sefaria's Rosh Hashanah / Yom Kippur machzorim are the Chassidic "Sefard" rite, so they are deliberately absent.

const S = 'Siddur Edot HaMizrach';
const FESTIVAL = `${S}, Prayers for Three Festivals`;
const MUSSAF = `${FESTIVAL}, Mussaf`;
// Paragraph ranges (1-based, inclusive) inside the festival Mussaf leaf, at its own <big><b> headings.
export const FESTIVAL_RANGES = {
  mussaf: `${MUSSAF} 1-59`,
  roshHashanaNight: `${MUSSAF} 60-158`,
  ushpizin: `${MUSSAF} 159-217`,
  festivalNightKiddush: `${MUSSAF} 218-233`,
  zoharSukkah: `${MUSSAF} 234-246`,
  zoharSheminiAtzeret: `${MUSSAF} 247-249`,
  zoharShavuot: `${MUSSAF} 250-262`,
  dayKiddush: `${MUSSAF} 263-276`,
  sukkotSongs: `${MUSSAF} 277-297`,
};

const R = FESTIVAL_RANGES;
const item = (title, reference, mode = 'nikud') => ({ title, reference, mode });
const common = {
  prayer: item('תפילה לשלש רגלים', `${FESTIVAL}, Prayers for Three Festivals`),
  amidah: item('עמידה לשלש רגלים', `${FESTIVAL}, Amidah`),
  mussaf: item('מוסף לשלש רגלים', R.mussaf),
  hallel: item('הלל', `${S}, Rosh Hodesh, Hallel`),
  nightKiddush: item('קידוש לליל החג', R.festivalNightKiddush),
  dayKiddush: item('קידוש היום', R.dayKiddush),
};
const HEBREW_NUMERALS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י'];
// A long text opens at its first part and reads on with "הבא" through the rest, as the Tanakh and siddur flows do.
const flowItem = (title, parts, mode = 'nikud') => ({ title, reference: parts[0].reference, mode, flow: parts.map(part => ({ ...part, mode })) });
const esther = flowItem('מגילת אסתר', HEBREW_NUMERALS.map((numeral, index) => ({ title: `מגילת אסתר · פרק ${numeral}׳`, reference: `Esther ${index + 1}` })), 'cantillation');
const HAGGADAH_PARTS = [['Kadesh', 'קדש'], ['Urchatz', 'ורחץ'], ['Karpas', 'כרפס'], ['Yachatz', 'יחץ'], ['Magid, Ha Lachma Anya', 'הא לחמא עניא'], ['Magid, Four Questions', 'מה נשתנה'], ['Magid, We Were Slaves in Egypt', 'עבדים היינו'], ['Magid, Story of the Five Rabbis', 'מעשה שהיה בבני ברק'], ['Magid, The Four Sons', 'כנגד ארבעה בנים'], ["Magid, Yechol Me'rosh Chodesh", 'יכול מראש חודש'], ['Magid, In the Beginning Our Fathers Were Idol Worshipers', 'מתחילה עובדי עבודה זרה היו אבותינו'], ['Magid, First Fruits Declaration', 'ארמי אבד אבי'], ['Magid, The Ten Plagues', 'עשר המכות'], ['Magid, Dayenu', 'דיינו'], ["Magid, Rabban Gamliel's Three Things", 'פסח מצה ומרור'], ['Magid, First Half of Hallel', 'חצי הלל'], ['Magid, Second Cup of Wine', 'כוס שניה'], ['Rachtzah', 'רחצה'], ['Motzi Matzah', 'מוציא מצה'], ['Maror', 'מרור'], ['Korech', 'כורך'], ['Shulchan Orech', 'שולחן עורך'], ['Tzafun', 'צפון'], ['Barech, Birkat Hamazon', 'ברכת המזון'], ['Barech, Third Cup of Wine', 'כוס שלישית'], ['Barech, Pour Out Thy Wrath', 'שפוך חמתך'], ['Hallel, Second Half of Hallel', 'מסיימים את ההלל'], ['Hallel, Songs of Praise and Thanks', 'מזמורי הודיה'], ['Hallel, Fourth Cup of Wine', 'כוס רביעית'], ['Nirtzah, Chad Gadya', 'חד גדיא'], ['Nirtzah, Echad Mi Yodea', 'אחד מי יודע']];
const haggadah = flowItem('הגדה של פסח', HAGGADAH_PARTS.map(([en, he]) => ({ title: `הגדה · ${he}`, reference: `Haggadah Edot Hamizrah, ${en}` })));

export const MOADIM = [
  { key: 'rosh-hashana', title: 'ראש השנה וימים נוראים', items: [
    item('סליחות', 'Selichot Edot HaMizrach'),
    item('קידוש וסימנים לליל ראש השנה', R.roshHashanaNight),
    common.dayKiddush,
  ] },
  { key: 'sukkot', title: 'סוכות ושמיני עצרת', items: [
    item('סדר שבעה אושפיזין', R.ushpizin),
    common.nightKiddush,
    item('זוהר לסעודת סוכה', R.zoharSukkah),
    item('מזמור לסוכות', `${FESTIVAL}, Song for Sukkot`),
    common.prayer, common.amidah, common.hallel, common.mussaf,
    common.dayKiddush,
    item('שירי סוכות', R.sukkotSongs),
    item('מזמור לשמיני עצרת', `${FESTIVAL}, Song for Shemini Atzeret`),
    item('זוהר לסעודת שמיני עצרת', R.zoharSheminiAtzeret),
  ] },
  { key: 'hanukkah', title: 'חנוכה', items: [
    item('סדר הדלקת נרות חנוכה', `${S}, Hanukkah, Menorah Lighting`),
    item('שחרית לחנוכה', `${S}, Hanukkah, Shacharit`),
    common.hallel,
  ] },
  { key: 'purim', title: 'פורים', items: [
    item('שבת זכור', `${S}, Purim, Shabbat Zachor`),
    item('סליחות לתענית אסתר', `${S}, Fast Days and Mourning, Fast of Esther`),
    item('ברכות קריאת המגילה', `${S}, Purim, Megillah Reading`),
    esther,
    item('סדר יום פורים', `${S}, Purim, Purim Day`),
  ] },
  { key: 'pesach', title: 'פסח', items: [
    haggadah,
    common.nightKiddush,
    item('מזמור לפסח', `${FESTIVAL}, Song for Passover`),
    common.prayer, common.amidah, common.hallel, common.mussaf,
    common.dayKiddush,
    item('ספירת העומר', `${S}, Counting of the Omer`),
    item('ברכת האילנות', `${S}, Nissan, Blessing of the Trees`),
    item('סדר לימוד לחודש ניסן', `${S}, Nissan, Learning of the Day`),
  ] },
  { key: 'shavuot', title: 'שבועות', items: [
    common.nightKiddush,
    item('מזמור לשבועות', `${FESTIVAL}, Song for Shavuot`),
    common.prayer, common.amidah, common.hallel, common.mussaf,
    common.dayKiddush,
    item('זוהר לסעודת שבועות', R.zoharShavuot),
  ] },
];

// Siddur roots whose every text now lives on the shelf above; the general index no longer lists them twice.
export const MOADIM_ROOTS = ['Hanukkah', 'Purim', 'Prayers for Three Festivals', 'Counting of the Omer', 'Nissan'];
