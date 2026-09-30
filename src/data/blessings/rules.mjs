// מנוע הברכות החכם — the hand-written, reviewable part: the blessings, the sources a rule may cite, the category rules,
// and what the app's Yalkut Yosef says beside a row of the עונג שבת table.
//
// Nothing here is a ruling on a product. A rule states a category rule of the Shulchan Arukh / Yalkut Yosef / עונג שבת
// with its conditions, and every rule cites the sources it rests on. The words of every source are NOT typed here:
// SOURCE_SPECS only says where the quotation starts and ends; scripts/halacha/blessings/build.mjs cuts it out of the
// text the app already carries (the Shulchan Arukh pack with its niqqud removed, the Mishnah Berurah pack, Yalkut Yosef,
// the עונג שבת pack) and tests/blessingsEngine.test.mjs checks each quotation against that text again.

export const BLESSING = {
  hamotzi: { short: 'המוציא', full: 'המוציא לחם מן הארץ' },
  mezonot: { short: 'מזונות', full: 'בורא מיני מזונות' },
  hagefen: { short: 'הגפן', full: 'בורא פרי הגפן' },
  haetz: { short: 'העץ', full: 'בורא פרי העץ' },
  haadama: { short: 'האדמה', full: 'בורא פרי האדמה' },
  shehakol: { short: 'שהכל', full: 'שהכל נהיה בדברו' },
  none: { short: 'אין מברכים', full: 'אין מברכים' },
};
export const AFTER = {
  birkat: { short: 'ברכת המזון', full: 'ברכת המזון' },
  michya: { short: 'על המחיה', full: 'מעין שלוש · על המחיה' },
  gefen: { short: 'על הגפן', full: 'מעין שלוש · על הגפן' },
  etz: { short: 'על העץ', full: 'מעין שלוש · על העץ ועל פרי העץ' },
  nefashot: { short: 'בורא נפשות', full: 'בורא נפשות' },
  none: { short: 'אין ברכה אחרונה', full: 'אין ברכה אחרונה' },
};

// Rites whose halacha follows the Rema (Nusach Ashkenaz, the Chassidic Nusach Sefard, Chabad). Edot HaMizrach — the
// app's default — follows Maran and Yalkut Yosef, as the עונג שבת table does.
export const ASHKENAZI_RITES = ['ashkenaz', 'sefard', 'chabad'];
export const riteFamily = nusach => (ASHKENAZI_RITES.includes(nusach) ? 'ashkenazi' : 'sephardi');

// Where each quotation is cut from. kind: sa = Shulchan Arukh Orach Chayim (Sefaria, Public Domain; quoted without
// niqqud), mb = Mishnah Berurah (Hebrew Wikisource, CC BY-SA), yy = Kitzur Shulchan Arukh Yalkut Yosef (Torat Emet,
// CC BY-NC-SA 2.5), ong = עונג שבת (by permission of the author).
export const SOURCE_SPECS = {
  'sa-168-6': { kind: 'sa', siman: 168, seif: 6, from: 'פת הבאה בכסנין, מברך עליו', to: 'מברך עליו: המוציא וברכת המזון' },
  'sa-168-7': { kind: 'sa', siman: 168, seif: 7, from: 'ויש אומרים שהיא עסה', to: 'שכמעט הדבש והתבלין הם עקר' },
  'sa-202-1': { kind: 'sa', siman: 202, seif: 1, from: 'על כל פרות האילן', to: 'בורא פרי הגפן' },
  'sa-202-8': { kind: 'sa', siman: 202, seif: 8, from: 'דבש הזב מהתמרים', to: 'חוץ מזיתים וענבים, מברך: שהכל' },
  'sa-202-15': { kind: 'sa', siman: 202, seif: 15, from: 'על הסוקא"ר מברך שהכל', to: 'על הסוקא"ר מברך שהכל' },
  'sa-203-1': { kind: 'sa', siman: 203, seif: 1, from: 'על פרות הארץ', to: 'בורא פרי האדמה' },
  'sa-203-2': { kind: 'sa', siman: 203, seif: 2, from: 'דלא מקרי עץ אלא', to: 'מברכין עליו בורא פרי האדמה' },
  'sa-204-1': { kind: 'sa', siman: 204, seif: 1, from: 'על דבר שאין גדולו מן הארץ', to: 'חלב, גבינה' },
  'sa-204-1-barley-water': { kind: 'sa', siman: 204, seif: 1, from: 'ועל מי שעורים שמבשלים לחולה', to: 'ועל מי שעורים שמבשלים לחולה' },
  'sa-204-7': { kind: 'sa', siman: 204, seif: 7, from: 'השותה מים לצמאו', to: 'אינו מברך לא לפניו ולא לאחריו' },
  'sa-204-12': { kind: 'sa', siman: 204, seif: 12, from: 'כל שהוא עקר ועמו טפלה', to: 'הרי הוא עקר' },
  'sa-205-1': { kind: 'sa', siman: 205, seif: 1, from: 'על הירקות מברך בורא פרי האדמה', to: 'ולאחר בשולם בורא פרי האדמה' },
  'sa-207-1': { kind: 'sa', siman: 207, seif: 1, from: 'פרות האילן חוץ מחמשת המינים', to: 'ברכה אחרונה שלהם בורא נפשות רבות' },
  'sa-208-1': { kind: 'sa', siman: 208, seif: 1, from: 'על חמשת המינים שהם', to: 'ברכה אחת מעין שלש' },
  'sa-208-2': { kind: 'sa', siman: 208, seif: 2, from: 'חמשת מיני דגן ששלקן', to: 'בטל בתבשיל' },
  'sa-208-7': { kind: 'sa', siman: 208, seif: 7, from: 'הכוסס (פי\' האוכל) את הארז', to: 'מברך עליו בורא מיני מזונות ואחריו בורא נפשות' },
  'sa-208-8': { kind: 'sa', siman: 208, seif: 8, from: 'העושה תבשיל משאר מיני קטניות', to: 'מברך שהכל' },
  'sa-212-1': { kind: 'sa', siman: 212, seif: 1, from: 'כל שהוא עקר ועמו טפלה', to: 'בין מברכה שלפניה בין מברכה שלאחריה' },
  'mb-168-33': { kind: 'mb', siman: 168, n: 33, from: 'ר"ל שכ"כ תבלין מעורב בהן', to: 'וטעם העיסה טפל' },
  'mb-168-34': { kind: 'mb', siman: 168, n: 34, from: 'שאופין ללחם משנה', to: 'כפסק הרמ"א' },
  'yy-168-2': { kind: 'yy', id: 'yalkut-yosef-12-3-2', from: 'פת גמור אפילו פחות מכזית', to: 'כל שלא אכל כזית' },
  'yy-168-3': { kind: 'yy', id: 'yalkut-yosef-12-3-3', from: 'פיצה הנאפית בתנור', to: 'אבל פשטידא הנעשית מבצק עלים וכדומה, והעיסה נפרכת, אף שיש בתוכה בשר וכדומה, [הנקרא בורקס בשרי], מברכים עליו בורא מיני מזונות' },
  'yy-168-4': { kind: 'yy', id: 'yalkut-yosef-12-3-4', from: 'הספרדים ובני עדות המזרח נוהגים', to: 'ויש למנהגם זה על מה לסמוך' },
  'yy-168-4-ashkenaz': { kind: 'yy', id: 'yalkut-yosef-12-3-4', from: 'ומנהג האשכנזים', to: 'בכל השנה כמו בפסח' },
  'yy-168-7': { kind: 'yy', id: 'yalkut-yosef-12-3-7', from: 'פת הבאה בכיסנין מברך עליו', to: 'ברך בורא מיני מזונות ולאחריהם על המחיה' },
  'yy-168-10': { kind: 'yy', id: 'yalkut-yosef-12-3-10', from: 'חלות מתובלות בסוכר', to: 'צריכים לברך המוציא וברכת המזון' },
  'yy-168-16': { kind: 'yy', id: 'yalkut-yosef-12-3-16', from: 'עיסה שנילושה בדבש', to: 'ולדעת הרמ\'\'א מברכים עליה המוציא' },
  'yy-202-3': { kind: 'yy', id: 'yalkut-yosef-16-1-3', from: 'כל פרי שהוא מסופק עליו', to: 'יש לברך עליו מספק האדמה' },
  'yy-202-13': { kind: 'yy', id: 'yalkut-yosef-16-1-13', from: 'על המשקים היוצאים מכל מיני פירות', to: 'חוץ מענבים וזיתים' },
  'yy-202-15': { kind: 'yy', id: 'yalkut-yosef-16-1-15', from: 'מיץ ענבים ויין שעוברים', to: 'והוא שיהיה לכל הפחות רובו יין' },
  'yy-202-19': { kind: 'yy', id: 'yalkut-yosef-16-1-19', from: 'כבר פשט המנהג לברך על הערק', to: 'אף אם נעשו מיין' },
  'yy-202-21': { kind: 'yy', id: 'yalkut-yosef-16-1-21', from: 'סוכר הנעשה מקני סוף', to: 'וכן הלכה' },
  'yy-202-22': { kind: 'yy', id: 'yalkut-yosef-16-1-22', from: 'וכן כל שאר מיני פירות או ירקות שנתרסקו', to: 'מברך \'\'בורא פרי האדמה\'\'' },
  'yy-202-24': { kind: 'yy', id: 'yalkut-yosef-16-1-24', from: 'האוכל מישמש מרוסק', to: 'לכן נהגו לברך עליו שהכל' },
  'yy-202-10': { kind: 'yy', id: 'yalkut-yosef-16-1-10', from: 'גרעיני אבטיח', to: 'וכן הדין בגרעיני חמניות' },
  'yy-202-11': { kind: 'yy', id: 'yalkut-yosef-16-1-11', from: 'גרעינים מתוקים של פירות הארץ', to: 'הרשות בידו אפילו שנהגו לברך שהכל' },
  'yy-202-12': { kind: 'yy', id: 'yalkut-yosef-16-1-12', from: 'קליפת אתרוג מרוקחת', to: 'נהגו לברך \'\'בורא פרי העץ\'\'' },
  'yy-202-26': { kind: 'yy', id: 'yalkut-yosef-16-1-26', from: 'האוכל פרי הנקרא', to: 'יברך עליו \'\'בורא פרי העץ\'\'' },
  'yy-202-27': { kind: 'yy', id: 'yalkut-yosef-16-1-27', from: 'האוכל חרובים', to: 'מברך עליהם \'\'בורא פרי העץ\'\'' },
  'yy-202-28': { kind: 'yy', id: 'yalkut-yosef-16-1-28', from: 'לימון חמוץ שאפילו על ידי הדחק', to: 'מברך עליו העץ' },
  'yy-203-2': { kind: 'yy', id: 'yalkut-yosef-16-2-2', from: 'על תות שדה מברך', to: 'מברך: \'\'בורא פרי העץ\'\'' },
  'yy-203-3': { kind: 'yy', id: 'yalkut-yosef-16-2-3', from: 'על הבננה', to: 'וכן פשט המנהג' },
  'yy-203-4': { kind: 'yy', id: 'yalkut-yosef-16-2-4', from: 'פרי הפאפיה דינו כדין ירק', to: 'מברכים עליהם \'\'בורא פרי האדמה\'\'' },
  'yy-203-5': { kind: 'yy', id: 'yalkut-yosef-16-2-5', from: 'על \'\'פופקורן\'\'', to: 'והמברך שהכל יש לו על-מה שיסמוך' },
  'yy-203-6': { kind: 'yy', id: 'yalkut-yosef-16-2-6', from: 'על ה\'\'במבה\'\' מברכים בורא פרי האדמה', to: 'המתנפחים בחום התנור' },
  'yy-203-7': { kind: 'yy', id: 'yalkut-yosef-16-2-7', from: 'ורד מבושל בדבש', to: 'אף שהמנהג לברך עליו שהכל' },
  'yy-203-8': { kind: 'yy', id: 'yalkut-yosef-16-2-8', from: 'שומשמין או בוטנים המודבקים', to: 'ברכתה שהכל נהיה בדברו' },
  'yy-203-10': { kind: 'yy', id: 'yalkut-yosef-16-2-10', from: 'המנהג פשוט לברך על העגבניה', to: 'כשהם חיים \'\'בורא פרי האדמה\'\'' },
  'yy-204-1': { kind: 'yy', id: 'yalkut-yosef-16-3-1', from: 'על כל דבר שאין גידולו מן הארץ', to: 'מברכים \'\'שהכל נהיה בדברו\'\'' },
  'yy-204-2': { kind: 'yy', id: 'yalkut-yosef-16-3-2', from: 'על קציצות בשר', to: 'למראה]' },
  'yy-204-3': { kind: 'yy', id: 'yalkut-yosef-16-3-3', from: 'על כמהין ופטריות', to: 'ברכתם שהכל נהיה בדברו' },
  'yy-204-6': { kind: 'yy', id: 'yalkut-yosef-16-3-6', from: 'על השוקולד המנהג לברך', to: 'אם בירך \'\'בורא פרי העץ\'\', לא הפסיד' },
  'yy-204-7': { kind: 'yy', id: 'yalkut-yosef-16-3-7', from: 'ובוטן מחופה במיני מזונות', to: 'ויברך מזונות' },
  'yy-204-8': { kind: 'yy', id: 'yalkut-yosef-16-3-8', from: 'יין שיש בו תערובת של רוב מים', to: 'לדידן יש לברך עליו שהכל' },
  'yy-204-9': { kind: 'yy', id: 'yalkut-yosef-16-3-9', from: 'השותה מים לצמאו', to: 'לא ברכה ראשונה ולא אחרונה' },
  'yy-204-12': { kind: 'yy', id: 'yalkut-yosef-16-3-12', from: 'האוכל ויטמינים', to: 'אינו מברך' },
  'yy-204-15': { kind: 'yy', id: 'yalkut-yosef-16-3-15', from: 'המנהג פשוט לברך ברכה ראשונה על כוס קפה', to: 'ואבקת הקפה טפלה לרוב מים' },
  'yy-204-16': { kind: 'yy', id: 'yalkut-yosef-16-3-16', from: 'על רחת חלקום', to: 'מברכים בורא מיני מזונות' },
  'yy-204-17': { kind: 'yy', id: 'yalkut-yosef-16-3-17', from: 'על אגוז הקשיו מברכים בורא פרי העץ', to: 'על אגוז הקשיו מברכים בורא פרי העץ' },
  'yy-204-18': { kind: 'yy', id: 'yalkut-yosef-16-3-18', from: 'ולדינא, מאחר שהפלאפל', to: 'לכן נהגו לברך שהכל' },
  'yy-204-21': { kind: 'yy', id: 'yalkut-yosef-16-3-21', from: 'הלועס גומי לעיסה', to: 'אף שאינו בולע מהמסטיק' },
  'yy-204-22': { kind: 'yy', id: 'yalkut-yosef-16-3-22', from: 'האוכל תבשיל של דגן', to: 'אינו מברך המוציא וברכת המזון' },
  'yy-205-1': { kind: 'yy', id: 'yalkut-yosef-16-4-1', from: 'על הירקות שדרך אכילתם', to: 'ואם אוכלם כשהם מבושלים מברך עליהם שהכל' },
  'yy-205-4': { kind: 'yy', id: 'yalkut-yosef-16-4-4', from: 'בישל ירקות ונימוחו כולן במרק', to: 'מברך שהכל' },
  'yy-205-5': { kind: 'yy', id: 'yalkut-yosef-16-4-5', from: 'האוכל סאלט', to: 'אף על- פי שהירקות נחתכו חתיכות קטנות' },
  'yy-205-6': { kind: 'yy', id: 'yalkut-yosef-16-4-6', from: 'האוכל פלפל מבושל', to: 'מברך עליו בורא פרי האדמה' },
  'yy-207-6': { kind: 'yy', id: 'yalkut-yosef-16-6-6', from: 'השותה כוס תה או קפה בעודם חמים', to: 'בורא נפשות רבות' },
  'yy-207-8': { kind: 'yy', id: 'yalkut-yosef-16-6-8', from: 'והוא הדין למי שאוכל גלידה', to: 'שאין לו לברך ברכה אחרונה' },
  'yy-207-9': { kind: 'yy', id: 'yalkut-yosef-16-6-9', from: 'השותה יי\'\'ש', to: 'שבטלה דעתו אצל כל אדם' },
  'yy-207-13': { kind: 'yy', id: 'yalkut-yosef-16-6-13', from: 'האוכל שוקולד ואינו לועס', to: 'מברך ברכה אחרונה' },
  'yy-208-10': { kind: 'yy', id: 'yalkut-yosef-16-7-10', from: 'הכוסס את האורז', to: 'ולבסוף בורא נפשות רבות' },
  'yy-212-4': { kind: 'yy', id: 'yalkut-yosef-16-13-4', from: 'האוכל \'\'קרמבו\'\'', to: 'אינו מברך מזונות' },
  'yy-212-6': { kind: 'yy', id: 'yalkut-yosef-16-13-6', from: 'גלידה שבין שני ביסקויטים', to: 'ואחר כך יברך שהכל על הגלידה' },
  'yy-168-11': { kind: 'yy', id: 'yalkut-yosef-12-3-11', from: 'אבל עיסה שבישלה או טיגנה', to: 'אלא בורא מיני מזונות ועל המחיה' },
  'ong-25-1': { kind: 'ong', chapter: 25, n: 1, from: 'אין לברך ברכה אחרונה על אוכל', to: 'שהוא שיעור זמן של 7.5 דקות]' },
  'ong-25-2': { kind: 'ong', chapter: 25, n: 2, from: 'אין לברך ברכה אחרונה על משקה', to: 'שזהו הזמן שבני אדם שותים 81 מ"ל בבת אחת' },
  'ong-25-3': { kind: 'ong', chapter: 25, n: 3, from: 'ואם רוצה לאכול מזונות בשיעור של קביעת סעודה', to: 'וברכה אחרונה ברכת המזון' },
  'ong-25-4': { kind: 'ong', chapter: 25, n: 4, from: 'מה שמצוי בסעודות מצוה', to: 'וברכה אחרונה ברכת המזון' },
  'ong-25-5': { kind: 'ong', chapter: 25, n: 5, from: 'כל דין זה של הקובע סעודתו על עוגה', to: 'מברך בורא מיני מזונות וברכה אחרונה על המחיה' },
};

// A few items that are not rows of the table but halachot of chapter כ״ה, kept as book entries in their own words.
export const BOOK_HALACHA_ITEMS = [
  { id: 'ong-25-4-item', name: 'לחמניות מתוקות / חלה מתוקה', aliases: ['חלה מתוקה', 'חלות מתוקות', 'לחמניות מתוקות', 'לחמניה מתוקה'], source: 'ong-25-4', unit: 4, page: 275, beforeKey: 'mezonot', afterKey: 'michya', nusach: 'sweet-bread', category: 'bread' },
];

// The shiurim of a last blessing, in one wording everywhere (a condition is attached only where it applies).
// כזית 27 גרם: הלכה יומית (hy-540, לפי חזון עובדיה ברכות); כדי אכילת פרס: עונג שבת כ״ה א (7.5 דקות), and הלכה יומית:
// "נכון להזהר תמיד לאכול שיעור כזית … בתוך ארבע וחצי דקות לצאת ידי חובת כל השיטות". רביעית 81 מ״ל: עונג שבת כ״ה ב.
export const SHIUR = {
  food: 'ברכה אחרונה רק אם אכל כזית (27 גרם) בתוך כדי אכילת פרס (בספר עונג שבת: 7.5 דקות; לכתחילה נכון לאכול את הכזית בתוך 4.5 דקות).',
  drink: 'ברכה אחרונה רק אם שתה רביעית (81 מ״ל) בזמן שתיית רביעית (כדרך ששותים בבת אחת).',
  dough: 'על המחיה רק אם אכל כזית (27 גרם) מן הבצק עצמו בתוך כדי אכילת פרס – המילוי והקרם אינם מצטרפים לבצק. אכל פחות מזה מן הבצק, אך 27 גרם מן המילוי – בורא נפשות.',
};

// Category rules. before/after are keys of BLESSING/AFTER ('cond' = depends on the conditions, shown in full).
// status: 'rule'        one ruling applies to the whole category (the card says "לפי הכלל");
//         'conditional' the ruling depends on a condition the data cannot see — the card asks one short question and lists
//                       the answer for each case;
//         'pending'     no source adequate for this kind of food was found: "טרם אומת" — no blessing is shown.
// sources: quotations the app carries (SOURCE_SPECS); web: rulings read on the sites of WEB_SOURCES (named, dated, linked).
// bookRows: rows of the עונג שבת table about the SAME kind of food (never a merely similar word).
export const RULES = {
  bread: { title: 'לחם מחמשת מיני דגן', status: 'rule', before: 'hamotzi', after: 'birkat', conditions: ['לחם שנילוש במים ונאפה, מחמשת מיני דגן (חיטה, שעורה, כוסמין, שיבולת שועל, שיפון).', 'פחות מכזית (27 גרם) – מברכים המוציא ואין ברכה אחרונה.', 'לחם או חלה שמתיקותם ניכרת – ראו "לחמניות מתוקות / חלה מתוקה": בזה מנהג הספרדים ומנהג אשכנז שונים.'], sources: ['yy-168-2', 'sa-168-6', 'ong-25-4'], bookRows: ['לחם'] },
  sandwich: { title: 'כריך או טוסט על לחם', status: 'rule', before: 'hamotzi', after: 'birkat', conditions: ['הלחם עיקר, והמילוי טפל לו ונפטר בברכתו – לפני ואחרי.', 'כשהלחם מחמשת מיני דגן ונילוש במים; פחות מכזית לחם – אין ברכה אחרונה.'], sources: ['sa-212-1', 'yy-168-2'], bookRows: ['לחם'] },
  tortilla: { title: 'טורטייה (לאפה דקה)', status: 'conditional', before: 'cond', after: 'cond', question: 'האם מורגש בה טעם שמן או מיץ פירות?', conditions: ['רוב הטורטיות היום עשויות מבצק של קמח חיטה שרודד דק, בלי טעם שמן או מיץ – המוציא, ולאחריהן ברכת המזון (הלכה יומית, על פי ילקוט יוסף קס״ח).', 'טורטייה מקמח חיטה שטעם השמן או מיץ הפירות מורגש בה היטב – בורא מיני מזונות, ולאחריה על המחיה.', 'טורטייה מקמח תירס, עדשים או חומוס – שהכל, ולאחריה בורא נפשות.', SHIUR.food], sources: ['sa-168-6', 'yy-168-7'], web: ['hy-6189'] },
  'corn-tortilla': { title: 'טורטייה מקמח תירס, עדשים או חומוס', status: 'rule', before: 'shehakol', after: 'nefashot', conditions: ['אינה מחמשת מיני דגן – שהכל (הלכה יומית).', SHIUR.food], sources: ['sa-208-8'], web: ['hy-6189'] },
  'sweet-bread': { title: 'לחם מתוק, חלה מתוקה, לחמניות מתוקות', status: 'rule', before: 'mezonot', after: 'michya', conditions: ['כשמתיקות הסוכר או הדבש ניכרת בעיסה.', 'הקובע סעודה (216 גרם) – נוטל ידיו, מברך המוציא וברכת המזון.', SHIUR.food], sources: ['ong-25-4', 'yy-168-10', 'sa-168-7'], nusach: 'sweet-bread' },
  kisnin: { title: 'עוגות, עוגיות, ביסקוויטים ומאפים מתוקים מחמשת מיני דגן', status: 'rule', before: 'mezonot', after: 'michya', conditions: ['כשהקמח מחמשת מיני דגן ונותן טעם.', 'על המחיה רק אם אכל כזית (27 גרם) מן המאפה בתוך כדי אכילת פרס (בספר: 7.5 דקות; לכתחילה בתוך 4.5 דקות).', 'עוגה או עוגייה ממולאת (שכבות בצק ומילוי נפרדים) – ' + SHIUR.dough, 'הקובע סעודה (216 גרם) על מאפה אפוי – המוציא וברכת המזון.'], sources: ['yy-168-7', 'ong-25-3', 'ong-25-1'], web: ['hy-4332'], bookRows: ['עוגה [מחיטה או מחמשת מיני דגן]', 'ביסקוויט'] },
  'filled-dough': { title: 'בצק ממולא (בורקס, כיסונים, רביולי, מאפה ממולא)', status: 'rule', before: 'mezonot', after: 'cond', conditions: ['בצק עלים, בצק מטוגן או מבושל, או בצק מתוק – בורא מיני מזונות.', SHIUR.dough, 'בצק של לחם (קמח ומים) שנאפה בתנור, ממולא בשר או גבינה – המוציא וברכת המזון (ראו "בורקס שעשוי מקמח ומים כלחם" בספר).'], sources: ['yy-168-3', 'sa-208-2'], web: ['hy-4332', 'hy-4328'], bookRows: ['בורקס [בצק עלים]', 'סמבוסק מטוגן', 'בורקס שעשוי מקמח ומים כלחם ונאפה בתנור כשממולא בבשר או גבינה או דגים או ירקות'] },
  pizza: { title: 'פיצה', status: 'rule', before: 'hamotzi', after: 'birkat', conditions: ['פיצה שבצקה נילוש במים – המוציא וברכת המזון, גם אם לשו אותה בחלב (הלכה יומית).', 'פיצה מבצק מתוק, או ספוגה בשמן – בורא מיני מזונות ועל המחיה.', 'פחות מכזית (27 גרם) – אין ברכה אחרונה.'], sources: ['yy-168-3'], web: ['hy-4328-qa'], bookRows: ['פיצה שנילושה במים', 'פיצה שנילושה בחלב או עם שמן או בדבש או במי פירות'] },
  'dry-crackers': { title: 'קרקרים, בייגלה וכעכים יבשים', status: 'rule', before: 'mezonot', after: 'michya', conditions: ['כשהקמח מחמשת מיני דגן.', SHIUR.food.replace('ברכה אחרונה', 'על המחיה')], sources: ['yy-168-7', 'ong-25-1'], bookRows: ['כעכים', 'ביגל\'ה', 'קרקר [מציות]'] },
  'grain-cooked': { title: 'תבשיל דגן: פסטה, אטריות, קוסקוס, דייסה, מאפה מטוגן', status: 'rule', before: 'mezonot', after: 'michya', conditions: ['כשהוא מחמשת מיני דגן.', 'גם הקובע עליו סעודה מברך מזונות ועל המחיה.', SHIUR.food.replace('ברכה אחרונה', 'על המחיה')], sources: ['yy-204-22', 'sa-208-2', 'ong-25-5'], bookRows: ['אטריות', 'ספגטי'] },
  'tree-fruit': { title: 'פרי העץ', status: 'rule', before: 'haetz', after: 'nefashot', conditions: ['פרי משבעת המינים (ענבים, תאנים, רימונים, זיתים, תמרים) – לאחריו "על העץ ועל פרי העץ".', SHIUR.food], sources: ['sa-202-1', 'sa-207-1', 'sa-208-1', 'ong-25-1'] },
  'tree-nut': { title: 'אגוזים שגדלים על עץ (אגוז מלך, פקאן, לוז, קשיו, פיסטוק, מקדמיה, ברזיל, שקדים)', status: 'rule', before: 'haetz', after: 'nefashot', conditions: ['כל סוגי האגוזים שגדלים על עץ – בורא פרי העץ, בין חיים בין קלויים או מלוחים.', 'אינם משבעת המינים – לאחריהם בורא נפשות.', SHIUR.food], sources: ['sa-202-1', 'sa-207-1', 'yy-204-17'], web: ['malka-egoz', 'haleluya-egozim'], bookRows: ['פקאן', 'שקדים', 'אגוז קשיו', 'פיסטוק', 'בונדוק', 'צנוברים'] },
  nut: { title: 'אגוזים, גרעינים ותערובות פיצוחים', status: 'conditional', before: 'cond', after: 'nefashot', question: 'איזה אגוז או גרעין – או תערובת?', conditions: ['אגוז שגדל על עץ (אגוז מלך, פקאן, לוז, קשיו, פיסטוק, שקד) – העץ.', 'בוטנים, גרעיני חמנייה וגרעיני אבטיח – האדמה.', 'גרעיני דלעת – בספר: שהכל, והרוצה יברך האדמה.', 'תערובת – מברכים על כל מין כברכתו.', SHIUR.food], sources: ['sa-202-1', 'sa-203-1', 'yy-204-17', 'yy-202-10', 'yy-202-11'], bookRows: ['שקדים', 'בוטנים', 'גרעיני חמניות [שחורים]', 'גרעיני דלעת [לבנים]'] },
  'coated-nut': { title: 'אגוזים מצופים או מסוכרים', status: 'conditional', before: 'cond', after: 'nefashot', question: 'האם האגוז שלם וניכר, והוא עיקר המאכל?', conditions: ['אגוז שלם וניכר בציפוי שוקולד, סוכר או דבש – ברכת האגוז (בספר: "אגוז מצופה שוקולד – העץ / נפשות"; לוח הרב אופיר מלכא: אגוז ממתק שצורתו ניכרת – העץ).', 'אם הציפוי הוא הרוב והאגוזים מיעוט – שהכל (בספר: "בוטנים מצופים בדבש").', 'ציפוי מקמח (בוטן אמריקאי) – מזונות.', 'יש אתרים שמברכים על פקאן מסוכר שהכל (הללויה).', SHIUR.food], sources: ['yy-203-8', 'yy-204-7'], web: ['malka-egoz'], bookRows: ['אגוז מצופה שוקולד', 'בוטנים מצופים בדבש', 'בוטן אמריקאי'] },
  'fruit-plant': { title: 'פרי שלא ידוע אם גדל על עץ', status: 'conditional', before: 'cond', after: 'nefashot', question: 'האם הפרי גדל על עץ שגזעו נשאר משנה לשנה?', conditions: ['פרי שגדל על עץ שגזעו נשאר משנה לשנה ומוציא עלים מגזעו – בורא פרי העץ.', 'פרי של צמח שכלה בחורף ופורח שוב משורשיו – בורא פרי האדמה.', 'פרי שיש ספק אם ברכתו העץ או האדמה – מברכים מספק האדמה.', SHIUR.food], sources: ['sa-203-2', 'yy-202-3', 'sa-207-1'] },
  vegetable: { title: 'ירקות', status: 'rule', before: 'haadama', after: 'nefashot', conditions: ['ירק שנאכל גם חי וגם מבושל – האדמה בשני המצבים.', 'ירק שדרכו להיאכל רק מבושל – כשהוא חי: שהכל.', 'ירק שטוב רק חי – כשהוא מבושל: שהכל.', SHIUR.food], sources: ['sa-205-1', 'yy-205-1', 'sa-207-1'] },
  legume: { title: 'קטניות', status: 'rule', before: 'haadama', after: 'nefashot', conditions: ['כשהקטניות שלמות וטובות מבושלות כמו חיות.', 'אם נתמעכו לגמרי – שהכל.', SHIUR.food], sources: ['sa-208-8', 'sa-205-1'] },
  'meat-substitute': { title: 'תחליף בשר מן הצומח (סויה, אפונה, טופו)', status: 'conditional', before: 'cond', after: 'nefashot', question: 'האם יש עליו ציפוי של פירורי לחם או קמח?', conditions: ['קטניות שנטחנו ונעשו מאכל אחר (כטופו) – שהכל.', 'בציפוי פירורי לחם או קמח שבא להטעים – ראו "שניצל בקמח או בפירורי לחם" בספר.', 'עשוי מגלוטן חיטה (סייטן) – טרם אומת; לשאול רב.', SHIUR.food], sources: ['sa-208-8', 'sa-204-12'], bookRows: ['טופו', 'שניצל בקמח או בפירורי לחם'] },
  animal: { title: 'בשר, עוף, דגים וביצים', status: 'rule', before: 'shehakol', after: 'nefashot', conditions: ['דבר שאין גידולו מן הארץ.', SHIUR.food], sources: ['sa-204-1', 'yy-204-1', 'ong-25-1'], bookRows: ['בשר', 'עוף', 'דגים'] },
  drink: { title: 'משקאות: מים, משקה קל, מיץ פירות', status: 'rule', before: 'shehakol', after: 'nefashot', conditions: ['משקה שיוצא מפירות – שהכל, חוץ ממשקה ענבים וזיתים.', 'מים – רק כשצמא.', SHIUR.drink], sources: ['sa-202-8', 'yy-202-13', 'sa-204-7', 'yy-204-9', 'ong-25-2'], bookRows: ['מים [כשהוא צמא]', 'מי סודה', 'מיץ גזר'] },
  wine: { title: 'יין ומיץ ענבים', status: 'rule', before: 'hagefen', after: 'gefen', conditions: ['כשרובו יין או מיץ ענבים (ולא רובו מים).', 'על הגפן רק אם שתה רביעית (81 מ״ל) בזמן שתיית רביעית.'], sources: ['sa-202-1', 'yy-202-15', 'yy-204-8', 'ong-25-2'], bookRows: ['יין [רובו יין]', 'יין [רובו מים]'] },
  'fruit-wine': { title: 'יין שאינו מענבים (יין פירות, סיידר)', status: 'rule', before: 'shehakol', after: 'nefashot', conditions: ['משקה היוצא מפרי שאינו ענבים – שהכל.', SHIUR.drink], sources: ['sa-202-8', 'yy-202-13'], bookRows: ['יין תפוחים'] },
  'grape-drink': { title: 'משקה ענבים', status: 'conditional', before: 'cond', after: 'cond', question: 'האם רוב המשקה מיץ ענבים?', conditions: ['אם רובו מיץ ענבים – בורא פרי הגפן, ולאחריו על הגפן (כששתה 81 מ״ל).', 'אם רובו מים או מיץ אחר – שהכל, ולאחריו בורא נפשות.', 'מיץ "בטעם ענבים" בלי מיץ ענבים – שהכל.'], sources: ['yy-202-15', 'yy-204-8'], bookRows: ['יין [רובו יין]', 'יין [רובו מים]'] },
  spirits: { title: 'משקאות חריפים וליקרים', status: 'rule', before: 'shehakol', after: 'none', conditions: ['אין מברכים ברכה אחרונה גם אם שתה 81 מ״ל, שאין דרך לשתותם כשיעור רביעית בבת אחת.'], sources: ['yy-202-19', 'yy-207-9'], bookRows: ['ערק', 'קוניאק', 'ויסקי'] },
  'hot-drink': { title: 'קפה, תה ושתייה חמה', status: 'rule', before: 'shehakol', after: 'none', conditions: ['כשהמשקה חם ונשתה לאט – אין ברכה אחרונה.', 'קפה או תה פושר או קר ששתה 81 מ״ל בזמן שתיית רביעית – בורא נפשות.'], sources: ['yy-204-15', 'yy-207-6'], bookRows: ['קפה [עם מים]', 'תה חם', 'תה פושר או קר'] },
  candy: { title: 'סוכריות וממתקי סוכר', status: 'rule', before: 'shehakol', after: 'nefashot', conditions: [SHIUR.food, 'אם יש בו קמח מחמשת מיני דגן, ופל או ביסקוויט – אין זה הכלל הזה (ראו "ממתק עם דגן").'], sources: ['sa-202-15', 'yy-202-21', 'ong-25-1'], bookRows: ['סוכריות', 'טופי', 'מרשמלו'] },
  gum: { title: 'מסטיק', status: 'rule', before: 'shehakol', after: 'none', conditions: ['כשיש בו מתיקות או טעם.'], sources: ['yy-204-21'], bookRows: ['מסטיק מתוק'] },
  chocolate: { title: 'שוקולד', status: 'rule', before: 'shehakol', after: 'nefashot', conditions: ['בורא נפשות רק אם אכל כזית (27 גרם) בתוך כדי אכילת פרס, ולעס אותו בשיניו; מוצץ וממיס בפה – אין ברכה אחרונה (ילקוט יוסף).', 'שוקולד שיש בו ופל, ביסקוויט או דגן – אין זה הכלל הזה (ראו "ממתק עם דגן").'], sources: ['yy-204-6', 'yy-207-13'], bookRows: ['שוקולד'] },
  'sweet-spread': { title: 'ממרח מתוק (שוקולד, אגוזי לוז וקקאו)', status: 'rule', before: 'shehakol', after: 'nefashot', conditions: ['כשנאכל לבדו (בכפית) – שהכל: נשתנה ממראהו וטעמו, ורובו סוכר ושמן.', 'כשנמרח על לחם, עוגה או ביסקוויט – הממרח טפל ונפטר בברכתם, לפני ואחרי.', SHIUR.food], sources: ['yy-204-6', 'yy-202-24', 'sa-212-1'], web: ['malka-mimrach', 'haleluya-nutella'] },
  'nut-butter': { title: 'ממרח אגוזים, שקדים או בוטנים', status: 'conditional', before: 'shehakol', after: 'cond', question: 'האם אוכלים אותו לבדו או על לחם?', conditions: ['כשנאכל לבדו – שהכל (לוח הברכות של הרב אופיר מלכא: "ממרח אגוזים", "ממרח בוטנים", "ממרח שקדים" – שהכל).', 'כשנמרח על לחם או עוגה – נפטר בברכתם.', 'ברכה אחרונה על ממרח שנאכל לבדו – טרם אומת (בספר עונג שבת על טחינה: "לא יברך").'], sources: ['sa-212-1'], web: ['malka-mimrach'], bookRows: ['טחינה'] },
  'grain-sweet': { title: 'ממתק או שוקולד עם ופל, ביסקוויט או דגן', status: 'conditional', before: 'cond', after: 'cond', question: 'האם הדגן (ופל, ביסקוויט, עוגייה) בא לתת טעם, או רק לדבק ולהחזיק?', conditions: ['הדגן בא לתת טעם או להשביע – בורא מיני מזונות.', 'הדגן בא רק לדבק או להעמיד – שהכל.', SHIUR.dough], sources: ['sa-204-12', 'sa-208-2', 'sa-212-1'], web: ['hy-4328', 'hy-4332'], bookRows: ['כדור שוקולד שמעורב בו ביסקוויט שבור'] },
  'coated-wafer': { title: 'ופל מצופה שוקולד (טורטית, כיף כף וכדומה)', status: 'rule', before: 'mezonot', after: 'cond', conditions: ['עלי הוופל מחמשת מיני דגן ונותנים טעם רב – בורא מיני מזונות, גם כשהשוקולד והקרם מרובים מן הבצק (הלכה יומית, על פי פסקי מרן הרב עובדיה יוסף; לוח הרב אופיר מלכא).', SHIUR.dough, 'בחטיף אחד בדרך כלל אין כזית מן הוופל עצמו, ולכן אין אחריו על המחיה; אם אכל 27 גרם מן השוקולד והקרם – בורא נפשות.', 'יש מי שמברכים "שהכל" על חטיף שעיקרו שכבה עבה של שוקולד והוופל רק מחזיק אותו (פניני הלכה; באתר הללויה: טורטית – שהכל). לפי הלכה יומית: מזונות.'], sources: ['sa-208-2', 'sa-204-12'], web: ['hy-4328', 'hy-4332', 'malka-ego', 'ph-10-11-8'], bookRows: ['וופל'] },
  wafer: { title: 'ופלים ובפלות (עלי ופל עם קרם)', status: 'rule', before: 'mezonot', after: 'cond', conditions: ['עלי הוופל נותנים טעם – בורא מיני מזונות.', SHIUR.dough, 'עלי הוופל קלים מאוד ועיקר המשקל הוא הקרם – לכן על המחיה רק באכילה מרובה מאוד (הלכה יומית); בספר עונג שבת: "וופל – מזונות / אין לברך".'], sources: ['sa-208-2'], web: ['hy-4328', 'hy-4332'], bookRows: ['וופל'] },
  'cereal-bar': { title: 'חטיף דגנים', status: 'conditional', before: 'cond', after: 'cond', question: 'האם יש בחטיף חיטה, שיבולת שועל, שעורה, כוסמין או שיפון (ברשימת הרכיבים)?', conditions: ['יש בו פתיתים או חתיכות מחמשת מיני דגן שנותנים טעם – בורא מיני מזונות (לוח הברכות של הרב אופיר מלכא: "אנרג\'י", "קורני" – מזונות).', 'אחריו: בדרך כלל בורא נפשות (אם אכל 27 גרם), כי אין בו כזית מן הדגן עצמו; על המחיה רק אם אכל כזית מחמשת מיני הדגן.', 'חטיף בלי חמשת מיני דגן (אורז, תירס, תמרים, אגוזים) – לפי המין העיקרי; טרם אומת למוצר זה.'], sources: ['sa-208-2', 'sa-204-12'], web: ['malka-energy', 'malka-corny'] },
  'cereal-bar-grain': { title: 'חטיף דגנים עם חמשת מיני דגן (אנרג\'י, קורני)', status: 'rule', before: 'mezonot', after: 'nefashot', conditions: ['פתיתי חיטה או שיבולת שועל נותנים טעם – בורא מיני מזונות.', 'אחריו בורא נפשות, אם אכל 27 גרם בתוך כדי אכילת פרס – כי אחוז הדגן השלם מועט ואין כזית מן הדגן עצמו (לוח הברכות של הרב אופיר מלכא: "אנרג\'י" ו"קורני" – מזונות / נפשות).', 'על המחיה רק אם אכל כזית מחמשת מיני הדגן עצמם.', 'חטיף אנרג\'י טעמי (עם שברי עוגיות) – בלוח: שהכל / נפשות.'], sources: ['sa-208-2', 'sa-204-12'], web: ['malka-energy', 'malka-corny'] },
  dairy: { title: 'מוצרי חלב: יוגורט, גבינה, שמנת, מעדנים', status: 'rule', before: 'shehakol', after: 'nefashot', conditions: ['מאכל (גבינה, יוגורט, מעדן) – ' + SHIUR.food, 'משקה חלב – ' + SHIUR.drink], sources: ['sa-204-1', 'yy-204-1', 'ong-25-1', 'ong-25-2'], bookRows: ['חלב', 'גבינה צהובה\\קשה', 'מעדן חלב', 'שמנת'] },
  'ice-cream': { title: 'גלידה, שלגון וארטיק', status: 'rule', before: 'shehakol', after: 'none', conditions: ['לפני: שהכל – גם על שלגון על מקל עם ציפוי שוקולד.', 'אחרי: אין ברכה אחרונה כלל – לדעת מרן דין הגלידה כמשקה, ואין שותים ממנה רביעית בבת אחת (הלכה יומית, על פי יביע אומר ח״ה סי׳ י״ח וחזון עובדיה ברכות).', 'לבני אשכנז: בורא נפשות אם אכל 27 גרם בתוך כ־4 דקות (לוח הברכות של הרב אופיר מלכא).'], sources: ['yy-207-8'], web: ['hy-5332', 'malka-glida'], bookRows: ['גלידה', 'ארטיק קרח'] },
  'ice-cream-cone': { title: 'גלידה בגביע (טילון)', status: 'rule', before: 'shehakol', after: 'none', conditions: ['הגלידה עיקר והגביע טפל – שהכל בלבד, ואינו מברך על הגביע גם אם אכל את סופו לבדו (ילקוט יוסף).', 'אחרי: אין ברכה אחרונה (דין הגלידה כמשקה).', 'יש אומרים: גביע טעים שאוכלים אותו בשביל עצמו – גם מזונות (לוח הברכות של הרב אופיר מלכא).'], sources: ['yy-212-4', 'yy-207-8'], web: ['hy-5332', 'malka-tilon'], bookRows: ['גלידה כשאוכלה עם גביע'] },
  'ice-cream-grain': { title: 'גלידה עם עוגיות, ופל או ביסקוויט בתוכה', status: 'conditional', before: 'cond', after: 'none', question: 'האם חתיכות העוגייה מעורבות בכל הגלידה, או רק מפוזרות למעלה?', conditions: ['חתיכות עוגייה או ביסקוויט שמעורבות בגלידה – יש שמברכים מזונות (לוח הברכות של הרב אופיר מלכא: "שלגון מגה").', 'העוגיות רק למעלה – מזונות עליהן, ואחר כך שהכל על הגלידה.', 'גלידה בין שני ביסקוויטים (קסטה) – ראו "קסטה" בספר ובילקוט יוסף.', 'אחרי: אין ברכה אחרונה על הגלידה.'], sources: ['yy-212-6', 'yy-212-4'], web: ['malka-shelegon'], bookRows: ['גלידה עם ביסקוויט [קסטה]'] },
  'plant-milk': { title: 'משקה צמחי (סויה, שקדים, קוקוס, אגוזים)', status: 'rule', before: 'shehakol', after: 'nefashot', conditions: ['משקה שיוצא מפרי או מקטנית – שהכל.', SHIUR.drink], sources: ['sa-202-8', 'yy-202-13', 'ong-25-2'], bookRows: ['חלב קוקוס', 'חלב אגוז הודי'] },
  'grain-drink': { title: 'משקה מדגן (שיבולת שועל, אורז)', status: 'conditional', before: 'cond', after: 'cond', question: 'ממה עשוי המשקה?', conditions: ['בשולחן ערוך (ברמ״א) נזכר: "ועל מי שעורים שמבשלים לחולה" – שהכל.', 'משקה דגן מעובד בימינו – טרם אומת במקורות שבאפליקציה; לשאול רב.'], sources: ['sa-204-1-barley-water', 'sa-208-2'] },
  'breakfast-cereal': { title: 'דגני בוקר וגרנולה', status: 'conditional', before: 'cond', after: 'cond', question: 'ממה עשויים הדגנים, ואיך הוכנו?', conditions: ['גרנולה (פתיתי שיבולת שועל קלויים) – האדמה / נפשות (בספר ובלוח הרב אופיר מלכא); גרנולה שעברה תהליך בישול – מזונות / על המחיה.', 'דייסת שיבולת שועל מבושלת – מזונות / על המחיה.', 'מתירס – ראו קורנפלקס בספר; מאורז – ראו אורז ופריכיות אורז.'], sources: ['sa-208-2', 'sa-208-7'], web: ['malka-granola'], bookRows: ['קורנפלקס', 'גרנולה', 'גרנולה שעברה תהליך בישול'] },
  corn: { title: 'מוצרי תירס (חטיפים, פתיתים, קמח תירס)', status: 'conditional', before: 'cond', after: 'nefashot', question: 'האם גרגרי התירס ניכרים, או שנטחנו לקמח?', conditions: ['מגרגרי תירס ניכרים – האדמה; מקמח תירס – שהכל (לפי הספר בקורנפלקס).', SHIUR.food], sources: ['yy-203-5', 'yy-203-6'], bookRows: ['קורנפלקס', 'פופקורן', 'פתיתי תירס'] },
  rice: { title: 'מוצרי אורז', status: 'conditional', before: 'cond', after: 'nefashot', question: 'האם האורז מבושל, או שלם ופריך?', conditions: ['אורז מבושל, ואטריות אורז – מזונות, ולאחריו בורא נפשות.', 'אורז שלם שאינו מבושל ופריכיות אורז – האדמה.', 'מוצר מעובד מקמח אורז – טרם אומת; לשאול רב.', SHIUR.food], sources: ['sa-208-7', 'yy-208-10'], bookRows: ['אורז', 'פריכיות אורז'] },
  potato: { title: 'מוצרי תפוחי אדמה', status: 'conditional', before: 'cond', after: 'nefashot', question: 'האם הוא עשוי מפרוסות תפוח אדמה, או מאבקה?', conditions: ['מפרוסות תפוח אדמה – האדמה (תפוצ\'יפס).', 'מאבקת תפוחי אדמה (פירה אינסטנט, חטיפים מעובדים) – בספר: שהכל.', SHIUR.food], sources: ['yy-202-22'], bookRows: ['תפוצ\'יפס [חטיף]', 'פירה אינסטנט'] },
  soup: { title: 'מרקים', status: 'conditional', before: 'cond', after: 'cond', question: 'מה יש במרק, והאם הוא סמיך?', conditions: ['מרק סמיך או שיש בו חתיכות ירקות – האדמה על הירקות.', 'מרק צלול כמים – שהכל.', 'מרק עם אטריות, גריסים או קניידלך – מזונות.', 'מרק חם שנאכל בכף – אין ברכה אחרונה.'], sources: ['yy-205-4', 'yy-207-6'], bookRows: ['מרק ירקות כשהירקות רבים', 'מרק צח', 'מרק עם אטריות [בין שהמים מרובים מהאטריות ובין שהאטריות מרובים מהמים]'] },
  unverified: { title: 'טרם אומת', status: 'pending', before: 'cond', after: 'cond', conditions: ['לא מצאנו מקור מספיק לברכה על מאכל זה, ולכן אין כאן פסק.'], sources: [] },
  mixture: { title: 'מאכל מורכב', status: 'pending', before: 'cond', after: 'cond', conditions: ['הכללים שלהלן כלליים, ואינם פסק למוצר הזה:', 'עיקר וטפל – מברכים על העיקר ופוטרים את הטפל.', 'דגן מחמשת המינים שבא לתת טעם או להשביע – מזונות; בא רק לדבק – בטל.'], sources: ['sa-212-1', 'sa-208-2'] },
  pickled: { title: 'ירקות כבושים ושימורים', status: 'rule', before: 'haadama', after: 'nefashot', conditions: ['כשהירק ניכר.', SHIUR.food], sources: ['yy-205-6', 'sa-205-1'], bookRows: ['מלפפון חמוץ', 'גמבה'] },
  'dried-fruit': { title: 'פירות יבשים', status: 'rule', before: 'haetz', after: 'nefashot', conditions: ['פרי יבש מברכים עליו כברכת הפרי.', 'פרי משבעת המינים (צימוקים, תאנים, תמרים) – על העץ ועל פרי העץ.', SHIUR.food], sources: ['sa-202-1', 'sa-208-1'], bookRows: ['צימוקים', 'תמרים'] },
  jam: { title: 'ריבות וממרחי פרי', status: 'rule', before: 'shehakol', after: 'nefashot', conditions: ['ריבה שנאכלת עם לחם או עוגה – טפלה להם ואין מברכים עליה.', SHIUR.food], sources: ['sa-212-1'], bookRows: ['ריבה'] },
};

// Rulings read on the sites of rabbis and rabbinic bodies (opened and read in full on the date given, not a search
// snippet). Only what they say is summarised, in our words; their text is not copied. 'posek' is the line they follow.
export const WEB_SOURCES = {
  'hy-540': { work: 'הלכה יומית', posek: 'מרן הרב עובדיה יוסף (חזון עובדיה, ברכות)', citation: 'הלכה יומית: שיעור אכילה כדי להתחייב בברכה אחרונה', url: 'https://halachayomit.co.il/he/default.aspx?HalachaID=540', says: 'כזית – 27 גרם. כדי אכילת פרס: יש אומרים 5 דקות ויש אומרים כ־7.5; נכון לאכול את הכזית בתוך 4.5 דקות לצאת ידי כל השיטות.' },
  'hy-1059': { work: 'הלכה יומית', posek: 'מרן הרב עובדיה יוסף', citation: 'הלכה יומית: שיעור ברכה אחרונה', url: 'https://halachayomit.co.il/he/default.aspx?HalachaID=1059', says: 'כזית – 27 גרם; רביעית – 81 מ״ל.' },
  'hy-5332': { work: 'הלכה יומית', posek: 'מרן הרב עובדיה יוסף (יביע אומר ח״ה סי׳ י״ח; חזון עובדיה ברכות)', citation: 'הלכה יומית: ברכה אחרונה על גלידה', url: 'https://halachayomit.co.il/he/default.aspx?HalachaID=5332', says: 'אין לברך אחרי גלידה ברכה אחרונה כלל, כי לדעת הרבה פוסקים דינה כמשקה ואין שותים ממנה רביעית בבת אחת.' },
  'hy-4328': { work: 'הלכה יומית', posek: 'מרן הרב עובדיה יוסף', citation: 'הלכה יומית: ברכת הוופלים, בקלאווה, עוגות גבינה, בורקס', url: 'https://halachayomit.co.il/he/default.aspx?HalachaID=4328', says: 'מין דגן שנותן טעם הוא תמיד עיקר המאכל: עלי ופל עם ממרח שוקולד – מזונות בלי ספק; בורקס ובקלאווה – מזונות. דגן שבא רק לדבק או להעמיד – בטל, והברכה כמין העיקרי.' },
  'hy-4328-qa': { work: 'הלכה יומית', posek: 'מרן הרב עובדיה יוסף', citation: 'הלכה יומית, שאלות ותשובות על "ברכת הוופלים…": פיצה, מלאווח, ג׳חנון', url: 'https://halachayomit.co.il/he/default.aspx?HalachaID=4328', says: 'פיצה שאינה מתוקה או ספוגה בשמן – המוציא, גם אם לשו אותה בחלב; ג׳חנון, מלאווח, לחוח – מזונות.' },
  'hy-4332': { work: 'הלכה יומית', posek: 'מרן הרב עובדיה יוסף', citation: 'הלכה יומית: ברכה אחרונה על וופלים, בקלאווה, עוגת נפוליאון, בורקס', url: 'https://halachayomit.co.il/he/default.aspx?HalachaID=4332', says: 'כשהבצק עומד בפני עצמו והמילוי בפני עצמו (ופלים, בורקס, בקלאווה), המילוי אינו מצטרף לבצק לכזית: על המחיה רק אם אכל כזית מן הבצק; אם אכל כזית מן הקרם – בורא נפשות. (ובשו״ת שם: חטיף "אגוזי" – אם אכל 27 גרם, בורא נפשות.)' },
  'hy-6189': { work: 'הלכה יומית', posek: 'מרן הרב עובדיה יוסף; ילקוט יוסף קס״ח', citation: 'הלכה יומית: טורטייה', url: 'https://halachayomit.co.il/he/default.aspx?HalachaID=6189', says: 'טורטייה שטעם השמן או מיץ הפירות מורגש בה – מזונות; הטורטייה המצויה היום, מבצק של חיטה שרודד דק – המוציא וברכת המזון (ובבופה באולם – נוטלים ידיים); מקמח תירס, עדשים או חומוס – שהכל. מאפה מבלילה רכה (בלינצ׳ס, פנקייק) – מזונות.' },
  'malka-egoz': { work: 'לוח הברכות – הלכה למעשה', posek: 'הרב אופיר יצחק מלכא (הליכות ברכות), בית ההוראה', citation: 'לוח הברכות של הרב אופיר מלכא: אגוז', url: 'https://hl5047.co.il/luach/%D7%90%D7%92%D7%95%D7%96', says: 'אגוז: העץ / נפשות – כל סוגי האגוזים גדלים בעץ, חיים או קלויים (מלך, פקאן, קשיו, פיסטוק, מקדמיה, ברזיל, לוז).' },
  'malka-ego': { work: 'לוח הברכות – הלכה למעשה', posek: 'הרב אופיר יצחק מלכא', citation: 'לוח הברכות של הרב אופיר מלכא: אגו (וופלים מצופים), אצבעות וופל', url: 'https://hl5047.co.il/luach/%D7%90%D7%92%D7%95', says: 'ופלים מצופים: מזונות; על המחיה רק באכילה של 70–80 גרם, פחות מזה – בורא נפשות.' },
  'malka-mimrach': { work: 'לוח הברכות – הלכה למעשה', posek: 'הרב אופיר יצחק מלכא', citation: 'לוח הברכות של הרב אופיר מלכא: ממרח', url: 'https://hl5047.co.il/luach/%D7%9E%D7%9E%D7%A8%D7%97', says: 'ממרח אגוזים, ממרח בוטנים, ממרח שקדים, ממרח צמחי – שהכל (ממרח לוטוס – מזונות).' },
  'malka-glida': { work: 'לוח הברכות – הלכה למעשה', posek: 'הרב אופיר יצחק מלכא', citation: 'לוח הברכות של הרב אופיר מלכא: ארטיק, גלידה', url: 'https://hl5047.co.il/luach/%D7%92%D7%9C%D7%99%D7%93%D7%94', says: 'שהכל. בני ספרד נוהגים שלא לברך בורא נפשות בשום מצב; בני אשכנז – אם אכל 27 גרם בתוך 4 דקות.' },
  'malka-tilon': { work: 'לוח הברכות – הלכה למעשה', posek: 'הרב אופיר יצחק מלכא', citation: 'לוח הברכות של הרב אופיר מלכא: טילון', url: 'https://hl5047.co.il/luach/%D7%98%D7%99%D7%9C%D7%95%D7%9F', says: 'גביע פשוט שאינו טעים – שהכל; גביע טעים בעצמו – שתי ברכות. האגוזים שבטילון טפלים.' },
  'malka-shelegon': { work: 'לוח הברכות – הלכה למעשה', posek: 'הרב אופיר יצחק מלכא', citation: 'לוח הברכות של הרב אופיר מלכא: שלגון (שלגון מגה)', url: 'https://hl5047.co.il/luach/%D7%A9%D7%9C%D7%92%D7%95%D7%9F', says: 'שלגון עם שברי עוגיות – מזונות; אם העוגיות רק בחלקו העליון – אחרי שסיים אותן, שהכל על השלגון.' },
  'malka-energy': { work: 'לוח הברכות – הלכה למעשה', posek: 'הרב אופיר יצחק מלכא', citation: 'לוח הברכות של הרב אופיר מלכא: אנרג׳י', url: 'https://hl5047.co.il/luach/%D7%90%D7%A0%D7%A8%D7%92%D7%99', says: 'אנרג׳י (חטיף דגנים): מזונות / נפשות. (אנרג׳י טעמי, עם שברי עוגיות: שהכל / נפשות.)' },
  'malka-corny': { work: 'לוח הברכות – הלכה למעשה', posek: 'הרב אופיר יצחק מלכא', citation: 'לוח הברכות של הרב אופיר מלכא: קורני', url: 'https://hl5047.co.il/luach/%D7%A7%D7%95%D7%A8%D7%A0%D7%99', says: 'חטיף דגנים (דגנים, שברי דגנים, אגוזים, קמח אורז ותירס): מזונות / נפשות, כי אחוז הדגן השלם מועט. בלי מיני דגן – העץ או האדמה לפי המרובה.' },
  'malka-granola': { work: 'לוח הברכות – הלכה למעשה', posek: 'הרב אופיר יצחק מלכא', citation: 'לוח הברכות של הרב אופיר מלכא: גרנולה', url: 'https://hl5047.co.il/luach/%D7%92%D7%A8%D7%A0%D7%95%D7%9C%D7%94', says: 'גרנולה (כל הסוגים) וחטיף גרנולה: האדמה / נפשות; עוגיות גרנולה: מזונות / על המחיה.' },
  'haleluya-egozim': { work: 'הללויה – מה מברכים על…', posek: 'לפי מנהג הספרדים', citation: 'הללויה, "מה מברכים על": אגוזי מלך, אגוזי פקאן (קליית גת)', url: 'https://haleluya.co.il/%D7%9E%D7%94-%D7%9E%D7%91%D7%A8%D7%9B%D7%99%D7%9D-%D7%A2%D7%9C/?text=%D7%90%D7%92%D7%95%D7%96%D7%99&eda=sfaradi', says: 'אגוזים, אגוזי מלך, אגוזי פקאן – בורא פרי העץ / בורא נפשות; חטיף "אגוזית אגוזי" – שהכל / בורא נפשות.' },
  'haleluya-nutella': { work: 'הללויה – מה מברכים על…', posek: 'לפי מנהג הספרדים', citation: 'הללויה, "מה מברכים על": ממרח אגוזי לוז (נוטלה), ממרח אגוזי לוז עם קקאו', url: 'https://haleluya.co.il/%D7%9E%D7%94-%D7%9E%D7%91%D7%A8%D7%9B%D7%99%D7%9D-%D7%A2%D7%9C/?text=%D7%A0%D7%95%D7%98%D7%9C%D7%94&eda=sfaradi', says: 'שהכל / בורא נפשות.' },
  'ph-10-11-8': { work: 'פניני הלכה', posek: 'הרב אליעזר מלמד', citation: 'פניני הלכה, ברכות יא, ח (ממתקים)', url: 'https://ph.yhb.org.il/10-11-08/', says: 'ופל שסביבו שכבה עבה של שוקולד: אם הוופל בא לתת טעם – מזונות; אם רק מחזיק את השוקולד – שהכל.' },
};
// When each of these was opened and read.
export const WEB_SOURCES_RETRIEVED = '2026-09-30';

// What Yalkut Yosef (and the app's questions that quote it) say beside a row of the table. relation: 'agrees' — the
// same ruling; 'adds' — the same ruling with a further detail; 'differs' — a different ruling: both are shown, neither
// is hidden. Keys are the row's name exactly as printed.
export const YALKUT_BESIDE = {
  'במבה': [{ source: 'yy-203-6', relation: 'differs' }],
  'קרמבו': [{ source: 'yy-212-4', relation: 'differs' }],
  'שומשום מדובק בסוכר': [{ source: 'yy-203-8', relation: 'adds' }],
  'ורד מרוקח בדבש': [{ source: 'yy-203-7', relation: 'differs' }],
  'אתרוג קליפתו בסוכר': [{ source: 'yy-202-12', relation: 'adds' }],
  'חלקום': [{ source: 'yy-204-16', relation: 'adds' }],
  'שוקולד': [{ source: 'yy-204-6', relation: 'agrees' }, { source: 'yy-207-13', relation: 'adds' }],
  'אגוז קשיו': [{ source: 'yy-204-17', relation: 'agrees' }],
  'בננה': [{ source: 'yy-203-3', relation: 'agrees' }],
  'פופקורן': [{ source: 'yy-203-5', relation: 'agrees' }],
  'שלוה [חיטה מתוקה]': [{ source: 'yy-203-5', relation: 'agrees' }],
  'חלווה': [{ source: 'yy-203-8', relation: 'agrees' }],
  'פלאפל [רובו חומוס]': [{ source: 'yy-204-18', relation: 'agrees' }],
  'מישמש מרוסק [לדר]': [{ source: 'yy-202-24', relation: 'agrees' }],
  'קפה [עם מים]': [{ source: 'yy-204-15', relation: 'agrees' }, { source: 'yy-207-6', relation: 'agrees' }],
  'תה חם': [{ source: 'yy-207-6', relation: 'agrees' }],
  'גלידה': [{ source: 'yy-207-8', relation: 'agrees' }],
  'גלידה עם ביסקוויט [קסטה]': [{ source: 'yy-212-6', relation: 'agrees' }],
  'בוטן אמריקאי': [{ source: 'yy-204-7', relation: 'agrees' }],
  'ערק': [{ source: 'yy-202-19', relation: 'agrees' }, { source: 'yy-207-9', relation: 'agrees' }],
  'קוניאק': [{ source: 'yy-202-19', relation: 'agrees' }, { source: 'yy-207-9', relation: 'agrees' }],
  'יין [רובו מים]': [{ source: 'yy-204-8', relation: 'agrees' }],
  'מים [כשהוא צמא]': [{ source: 'yy-204-9', relation: 'agrees' }],
  'ויטמינים מתוקים': [{ source: 'yy-204-12', relation: 'agrees' }],
  'מסטיק מתוק': [{ source: 'yy-204-21', relation: 'agrees' }],
  'פטריות': [{ source: 'yy-204-3', relation: 'agrees' }],
  'קציצות': [{ source: 'yy-204-2', relation: 'agrees' }],
  'שניצל בקמח או בפירורי לחם': [{ source: 'yy-204-2', relation: 'adds' }],
  'פלפל ממולא באורז': [{ source: 'yy-205-6', relation: 'agrees' }],
  'גמבה': [{ source: 'yy-205-6', relation: 'agrees' }],
  'בצל מטוגן': [{ source: 'yy-205-6', relation: 'agrees' }],
  'סלט ירקות': [{ source: 'yy-205-5', relation: 'agrees' }],
  'מרק ירקות כשהירקות רבים': [{ source: 'yy-205-4', relation: 'agrees' }],
  'פירה [תפו"א מרוסק]': [{ source: 'yy-202-22', relation: 'agrees' }],
  'אורז': [{ source: 'yy-208-10', relation: 'agrees' }],
  'פריכיות אורז': [{ source: 'yy-208-10', relation: 'agrees' }],
  'גרעיני אבטיח': [{ source: 'yy-202-10', relation: 'agrees' }],
  'גרעיני חמניות [שחורים]': [{ source: 'yy-202-10', relation: 'agrees' }],
  'גרעיני דלעת [לבנים]': [{ source: 'yy-202-11', relation: 'agrees' }],
  'לימון': [{ source: 'yy-202-28', relation: 'agrees' }],
  'לימון מתוק': [{ source: 'yy-202-28', relation: 'agrees' }],
  'סברס': [{ source: 'yy-202-26', relation: 'agrees' }],
  'חרובים': [{ source: 'yy-202-27', relation: 'agrees' }],
  'תות שדה': [{ source: 'yy-203-2', relation: 'agrees' }],
  'עגבניות': [{ source: 'yy-203-10', relation: 'agrees' }],
  'פפאיה': [{ source: 'yy-203-4', relation: 'agrees' }],
  'חצילים': [{ source: 'yy-203-4', relation: 'agrees' }],
  'מצה [לא בפסח]': [{ source: 'yy-168-4', relation: 'agrees' }],
  'פיצה שנילושה במים': [{ source: 'yy-168-3', relation: 'agrees' }],
  'פיצה שנילושה בחלב או עם שמן או בדבש או במי פירות': [{ source: 'yy-168-3', relation: 'agrees' }],
  'בורקס [בצק עלים]': [{ source: 'yy-168-3', relation: 'agrees' }],
  'סופגניות': [{ source: 'yy-168-11', relation: 'agrees' }],
  'אטריות': [{ source: 'yy-204-22', relation: 'agrees' }],
  'קוסקוס אפילו עם ירקות או בשר': [{ source: 'yy-204-22', relation: 'agrees' }],
  'סוכר': [{ source: 'yy-202-21', relation: 'agrees' }],
};

// Where the rite changes the ruling. 'sephardi' is the book's own ruling (Yalkut Yosef); 'ashkenazi' comes only from a
// source in the app that states the Ashkenazi practice.
export const NUSACH_RULINGS = {
  matzah: { ashkenazi: { beforeKey: 'hamotzi', afterKey: 'birkat', note: 'לבני אשכנז: המוציא וברכת המזון בכל השנה.', sources: ['yy-168-4-ashkenaz'] } },
  'sweet-bread': { ashkenazi: { beforeKey: 'hamotzi', afterKey: 'birkat', note: 'לבני אשכנז (כרמ״א): המוציא וברכת המזון, אלא אם כן הדבש והתבלין מרובים עד שהם העיקר וטעם העיסה טפל.', sources: ['yy-168-16', 'mb-168-33', 'mb-168-34'] } },
  'milk-dough': { ashkenazi: { beforeKey: 'hamotzi', afterKey: 'birkat', note: 'לבני אשכנז (כרמ״א): עיסה שנילושה במעט חלב, שמן או דבש – המוציא, אלא אם כן הם מרובים עד שהם העיקר.', sources: ['yy-168-16', 'mb-168-33'] } },
};
// Rows of the table whose ruling changes with the rite (the key is the row's name exactly as printed).
export const NUSACH_ROWS = {
  'מצה [לא בפסח]': 'matzah',
  'פיצה שנילושה בחלב או עם שמן או בדבש או במי פירות': 'milk-dough',
};

// Rows that are drinks: their last blessing depends on 81 מ״ל (עונג שבת כ״ה, ב), not on 27 grams.
export const DRINK_ROWS = ['אשל', 'בירה', 'ברד [שתיה קרה]', 'חלב', 'חלב אגוז הודי', 'חלב קוקוס', 'יין [רובו יין]', 'יין [רובו מים]', 'יין [רובו ענבים]', 'יין תפוחים', 'לֶבֶןּ', 'לימונדה', 'מי האגוז', 'מי המילון', 'מי סודה', 'מילק שיק', 'מים [כשהוא צמא]', 'מים [להעביר החנק]', 'מים [לרפואה ולא בכדי להרוות צמאונו]', 'מים מתוקים', 'מיץ אננס', 'מיץ גזר', 'ערק', 'קוניאק', 'קפה [עם מים]', 'תה חם', 'תה פושר או קר', 'ויסקי', 'מרק צח'];

// Rows of the table whose dough and filling stand apart: the book names the last blessing, and the condition shown
// beside it is that the kezayit must be of the dough itself (הלכה יומית hy-4332) — not the general 27 grams of the food.
export const DOUGH_ROWS = ['בורקס [בצק עלים]', 'בורקס שעשוי מקמח ומים כלחם ונאפה בתנור כשממולא שקדים או מיני פירות עם דבש או סוכר', 'בקלאווה', "בלינצ'ס", 'אזני המן', 'סמבוסק מטוגן', 'קובה'];
