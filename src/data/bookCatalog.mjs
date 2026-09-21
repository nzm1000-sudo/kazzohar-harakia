// Curated Hebrew catalog of Sefaria books. References stay canonical and internal;
// visible labels are Hebrew so the library remains readable on a small screen.
export const BOOK_CATEGORIES = [
  {
    id: 'chassidut', title: 'חסידות', books: [
      ['ben-porat-yosef', 'בן פורת יוסף', 'Ben Porat Yosef'],
      ['noam-elimelech', 'נועם אלימלך', 'Noam Elimelech'],
      ['tzafnat-paneach', 'צפנת פענח', "Tzafnat Pa'neach on Torah"],
      ['toldot-yaakov-yosef', 'תולדות יעקב יוסף', 'Toldot Yaakov Yosef'],
      ['likutei-moharan', 'ליקוטי מוהר״ן', 'Likutei Moharan'],
      ['likutei-etzot', 'ליקוטי עצות', 'Likkutei Etzot'],
      ['sippurei-maasiyot', 'סיפורי מעשיות', 'Sippurei Maasiyot'],
      ['sefer-hamiddot', 'ספר המידות', 'Sefer HaMiddot'],
      ['agra-d-kala', 'אגרא דכלה', 'Agra DeKala'],
      ['bnei-yissachar', 'בני יששכר', 'Bnei Yissaschar'],
      ['chiddushei-harim', 'חידושי הרי״מ על התורה', 'Chiddushei HaRim on Torah'],
      ['keter-shem-tov', 'כתר שם טוב', 'Keter Shem Tov'],
    ],
  },
  {
    id: 'mishnah', title: 'משנה ומפרשים', books: [
      ['mishnah', 'כל המשניות עם פירוש', 'Mishnah'],
    ],
  },
  {
    id: 'mussar', title: 'מוסר ותשובה', books: [
      ['chovot-halevavot', 'חובות הלבבות', 'Duties of the Heart'],
      ['orchot-tzadikim', 'אורחות צדיקים', 'Orchot Tzadikim'],
      ['yesod-hateshuvah', 'יסוד התשובה', 'Yesod HaTeshuvah'],
      ['menorat-hamaor', 'מנורת המאור', 'Menorat HaMaor'],
      ['sefer-hayashar', 'ספר הישר', 'Sefer HaYashar'],
      ['shaarei-teshuvah', 'שערי תשובה', 'Shaarei Teshuvah'],
      ['tomer-devorah', 'תומר דבורה', 'Tomer Devorah'],
      ['yaarot-devash', 'יערות דבש · שני חלקים', "Ya'arot Devash I; Ya'arot Devash II"],
      ['mesillat-yesharim', 'מסילת ישרים', 'Mesillat Yesharim'],
      ['pele-yoetz', 'פלא יועץ', 'Pele Yoetz'],
      ['shnei-luchot-habrit', 'שני לוחות הברית', 'Shenei Luchot HaBerit'],
      ['or-hatzafon', 'אור הצפון', 'Ohr HaTzafun'],
      ['chovot-hatalmidim', 'חובת התלמידים', 'Chovat HaTalmidim'],
      ['sichot-avodat-levi', 'שיחות עבודת לוי', 'Sichot Avodat Levi'],
    ],
  },
  {
    id: 'reference', title: 'כלי עזר ומקורות', books: [
      ['otzar-laazei-rashi', 'אוצר לעזי רש״י', "Otzar La'azei Rashi"],
      ['millon-shimushi-latalmud', 'מילון שימושי לתלמוד', 'A Dictionary of the Talmud'],
      ['seder-hadorot', 'סדר הדורות', 'Seder HaDorot'],
      ['tanakh', 'כל התנ״ך', 'Tanakh'],
    ],
  },
];

export const BOOK_CATALOG = BOOK_CATEGORIES.flatMap(category => category.books.map(([id, title, reference]) => ({
  id, title, reference, category: category.title, categoryId: category.id,
})));

export const bookById = id => BOOK_CATALOG.find(book => book.id === id);