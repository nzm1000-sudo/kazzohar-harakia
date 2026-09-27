const CBS_SOURCE = Object.freeze({ label: 'הלמ״ס · שמות פרטיים שניתנו לילידי 2024', url: 'https://www.cbs.gov.il/he/mediarelease/DocLib/2025/391/11_25_391b.pdf', license: 'נתוני שימוש רשמיים; אינם משמשים לבדם כהוכחת תקינות של כתיב.' });
const TANAKH_SOURCE = Object.freeze({ label: 'התנ״ך המקומי · Tanach.us UXLC 2.5', url: 'https://www.tanach.us/License.html', license: 'המקור משמש לאימות מופעים והקשרים; לא מועתק כאן טקסט פרשני.' });
const ACADEMY_SOURCE = Object.freeze({ label: 'האקדמיה ללשון העברית', url: 'https://hebrew-academy.org.il/', license: 'תיאור לשוני מקורי המבוסס על עובדות מילוניות.' });
const BABYNAMES_IL_SOURCE = Object.freeze({ label: 'babynamesIL · שמות תינוקות בישראל 1949–2024, מנתוני הלמ״ס', url: 'https://github.com/aviezerl/babynamesIL/tree/63b88aac07e49a81bec5da9b9303b39439f7604c', license: 'CC0 · גרסה 0.2.3; מגזר יהודי בלבד, סכום השימושים בכל השנים. נתוני שימוש בלבד, לא ראיה למשמעות או לכתיב.' });
const BDB_SOURCE = Object.freeze({ label: 'מילון BDB (Brown-Driver-Briggs) · ספריא', url: 'https://www.sefaria.org/BDB', license: 'מילון אקדמי לעברית המקראית; הפירוש מנוסח כאן מחדש, וכל רשומה מפנה לערך המסוים.' });
const JEWISH_SOURCE = Object.freeze({ label: 'מקורות יהודיים מסורתיים · ספריא', url: 'https://www.sefaria.org/', license: 'המקור משמש לזיהוי מסורת יהודית ושימוש היסטורי; אין העתקת פירושים.' });

const biblicalBoys = 'אדם|אברהם|אבנר|אבישי|אבשלום|אהרן|איתן|אליהו|אלעזר|אלישע|אלקנה|אמנון|אסף|אפרים|אריאל|ארי|אריה|בועז|בנימין|ברוך|ברק|גד|גדעון|דוד|דניאל|דן|יואב|יואל|יוחנן|יונתן|יוסף|יחזקאל|יעקב|יצחק|ישראל|יהודה|יהושע|ירמיהו|מאיר|מנחם|מרדכי|משה|נח|נחום|נפתלי|נתן|נתנאל|נחמיה|עמוס|עמינדב|עמרי|עזרא|עוזיהו|פנחס|ראובן|רפאל|שאול|שלמה|שמואל|שמעון|שמשון'.split('|');
const biblicalGirls = 'אביגיל|אבישג|אסנת|אסתר|בתיה|דבורה|דינה|הגר|הדסה|חנה|חיה|יוכבד|יעל|לאה|מיכל|מרים|נעמי|נועה|רבקה|רחב|רחל|רות|שרה|שפרה|ציפורה|תמר|תרצה|אפרת|איילה'.split('|');
const traditionalBoys = 'אלי|אליה|אורי|אוריאל|אוריה|אשר|גבריאל|הלל|חיים|טוביה|ידידיה|יהונתן|מאיר|מנחם|מתתיהו|מיכאל|נחמן|נועם|עובדיה|עוז|שלום|שי|שמעיה|שמחה|ציון'.split('|');
const traditionalGirls = 'אביטל|אדינה|אהובה|אלישבע|אמונה|ברוריה|גאולה|חביבה|יהודית|ליבי|מרגלית|נחמה|שולמית|שושנה|שמחה|תהילה'.split('|');
const modernBoys = 'אביעד|אבישי|אביתר|אדיר|אופק|אור|אוראל|אורון|אושר|אלעד|אלון|אמיר|ארז|ארנון|גיא|גיל|גלעד|גל|דגן|דקל|דרור|הדר|זוהר|חן|חגי|חנן|טל|יובל|יעד|יקיר|יריב|כפיר|כרם|לביא|להב|ליאור|לוטם|מאור|מגן|מטר|מתן|מעיין|מרום|ניר|ניצן|עומר|עמית|עידן|עוזי|פלג|צוף|קדם|רועי|רום|רז|סער|שגיא|שחר|שקד|שלו|תמיר|תומר|תבור'.split('|');
const modernGirls = 'אדוה|אדווה|אודליה|אורית|אורלי|אושרת|איילת|אילנה|אלונה|אמירה|אריאל|גאיה|גילה|גלית|גפן|דפנה|הדר|הילה|טל|טליה|יהלי|לילך|לימור|מאיה|מיכאלה|מוריה|מיכל|נוגה|נופר|עדי|ענת|פנינה|רוני|רעות|שירה|שיר|שקד|תמרה|תמרי|תהל'.split('|');
const modernUnisex = 'אביב|אור|אופק|אלמוג|אפיק|אריאל|בר|גפן|גל|טל|ים|ירדן|כרמל|לב|ליאור|מאור|מגן|נועם|עומר|עמית|עדי|רום|רוני|רעות|שחר|שקד|שילה|תום|תמיר|זוהר'.split('|');

const references = Object.freeze({ אדם: 'בראשית ב׳, ז׳', אברהם: 'בראשית י״ז, ה׳', אבנר: 'שמואל א׳ י״ד, נ׳', אבישי: 'שמואל א׳ כ״ו, ו׳', אבשלום: 'שמואל ב׳ ג׳, ג׳', אהרן: 'שמות ד׳, י״ד', איתן: 'מלכים א׳ ה׳, י״א', אליהו: 'מלכים א׳ י״ז, א׳', אלעזר: 'שמות ו׳, כ״ג', אלישע: 'מלכים א׳ י״ט, ט״ז', אלקנה: 'שמואל א׳ א׳, א׳', אמנון: 'שמואל ב׳ י״ג, א׳', אסף: 'דברי הימים א׳ ו׳, כ״ד', אפרים: 'בראשית מ״א, נ״ב', אריאל: 'עזרא ח׳, ט״ז', בועז: 'רות ב׳, א׳', בנימין: 'בראשית ל״ה, י״ח', ברוך: 'ירמיהו ל״ו, ד׳', ברק: 'שופטים ד׳, ו׳', גד: 'בראשית ל׳, י״א', גדעון: 'שופטים ו׳, י״א', דוד: 'שמואל א׳ ט״ז, י״ג', דניאל: 'דניאל א׳, ו׳', דן: 'בראשית ל׳, ו׳', יואב: 'שמואל ב׳ ב׳, י״ג', יואל: 'שמואל א׳ ח׳, ב׳', יוחנן: 'מלכים ב׳ כ״ה, כ״ג', יונתן: 'שמואל א׳ י״ג, ב׳', יוסף: 'בראשית ל׳, כ״ד', יחזקאל: 'יחזקאל א׳, ג׳', יעקב: 'בראשית כ״ה, כ״ו', יצחק: 'בראשית י״ז, י״ט', ישראל: 'בראשית ל״ב, כ״ט', יהודה: 'בראשית כ״ט, ל״ה', יהושע: 'שמות י״ז, ט׳', ירמיהו: 'ירמיהו א׳, א׳', מנחם: 'מלכים ב׳ ט״ו, י״ד', מרדכי: 'אסתר ב׳, ה׳', משה: 'שמות ב׳, י׳', נח: 'בראשית ה׳, כ״ט', נחום: 'נחום א׳, א׳', נתן: 'שמואל ב׳ ז׳, ב׳', נתנאל: 'במדבר א׳, ח׳', עזרא: 'עזרא ז׳, ו׳', עוזיהו: 'מלכים ב׳ ט״ו, י״ג', פנחס: 'שמות ו׳, כ״ה', שאול: 'שמואל א׳ ט׳, ב׳', שלמה: 'שמואל ב׳ י״ב, כ״ד', שמואל: 'שמואל א׳ א׳, כ׳', שמעון: 'בראשית כ״ט, ל״ג', שמשון: 'שופטים י״ג, כ״ד', אביגיל: 'שמואל א׳ כ״ה, ג׳', אבישג: 'מלכים א׳ א׳, ג׳', אסנת: 'בראשית מ״א, מ״ה', אסתר: 'אסתר ב׳, ז׳', בתיה: 'דברי הימים א׳ ד׳, י״ח', דבורה: 'שופטים ד׳, ד׳', דינה: 'בראשית ל׳, כ״א', הגר: 'בראשית ט״ז, א׳', הדסה: 'אסתר ב׳, ז׳', חנה: 'שמואל א׳ א׳, ב׳', יוכבד: 'שמות ו׳, כ׳', יעל: 'שופטים ד׳, י״ז', לאה: 'בראשית כ״ט, ט״ז', מיכל: 'שמואל א׳ י״ח, כ׳', מרים: 'שמות ט״ו, כ׳', נעמי: 'רות א׳, ב׳', נועה: 'במדבר כ״ו, ל״ג', רבקה: 'בראשית כ״ד, ט״ו', רחל: 'בראשית כ״ט, ו׳', רות: 'רות א׳, ד׳', שרה: 'בראשית י״ז, ט״ו', תמר: 'בראשית ל״ח, ו׳', תרצה: 'במדבר כ״ו, ל״ג', אפרת: 'בראשית ל״ה, ט״ז', שלום: 'תהילים קכ״ב, ו׳', ידידיה: 'שמואל ב׳ י״ב, כ״ה', אליה: 'מלכים ב׳ א׳, ג׳' });
const meanings = Object.freeze({ ברק: 'אור חזק וקצר הנראה בשמים בזמן סערה.', שלום: 'שלווה, פיוס והיעדר מלחמה; מילה עברית ותיקה ושם יהודי מבוסס.', אברהם: 'השם המקראי של אבי האומה; פירושו המסורתי קשור לאב המון.', יצחק: 'שם מקראי הקשור לצחוק ולשמחה.', יעקב: 'שם מקראי; פירושו קשור לעקב ולשורש עק״ב.', משה: 'שם מקראי של המנהיג שהוציא את ישראל ממצרים; המשמעות המדויקת של השם אינה ודאית.', דוד: 'שם מקראי; בעברית דּוֹד הוא אהוב או דוד משפחתי.', שלמה: 'שם מקראי הקשור לשלום ולשלמות.', יוסף: 'שם מקראי מן השורש יס״ף, במשמעות הוספה.', אליהו: 'שם תאופורי שפירושו אלי הוא ה׳.', אליה: 'צורה מקראית נשית של אליהו, המופיעה במלכים ב׳.', רפאל: 'שם תאופורי שפירושו האל ריפא.', שרה: 'שם מקראי שפירושו גבירה או נסיכה.', רבקה: 'שם מקראי; המשמעות המדויקת אינה ודאית.', רחל: 'שם מקראי; רחל היא כבשה בעברית המקראית.', לאה: 'שם מקראי; המשמעות המדויקת אינה ודאית.', אביגיל: 'שם מקראי שפירושו אבי הוא שמחה.', תמר: 'שם מקראי; תמר הוא גם עץ התמר.', יעל: 'שם מקראי; יעל הוא בעל חיים הררי.', נועה: 'שם מקראי; משמעות השם קשורה לתנועה או לנוע.', איילה: 'שם עברי לבת האייל; השימוש כשם מודרני מבוסס.', חיה: 'שם יהודי מסורתי הקשור לחיים ולחיוניות.', ליבי: 'שם עברי מודרני מן המילה לב, במשמעות לבי.', מאיר: 'שם עברי מסורתי מן השורש אור, במשמעות מאיר.', מנחם: 'שם מקראי ומסורתי מן השורש נח״ם, במשמעות מנחם ומעודד.', מרדכי: 'שם יהודי מסורתי של גיבור מגילת אסתר; משמעותו הקדומה אינה ודאית.', ידידיה: 'שם מקראי שפירושו ידיד ה׳.', ארי: 'שם עברי הקשור לאריה; שם מבוסס בשימוש יהודי.', אורי: 'שם עברי מן המילה אור, במשמעות האור שלי.', נועם: 'מילה עברית של נעימות, חן ורוך; שם יהודי מבוסס.', לביא: 'שם עברי לאריה צעיר, ושם מודרני מבוסס.', נתנאל: 'שם תאופורי שפירושו האל נתן.', הלל: 'שם יהודי מסורתי מן השורש הל״ל, הקשור לשבח.' });
// Meanings stated in BDB for a personal name (n.pr.), each cited to its own entry on Sefaria. Only where BDB states a
// meaning without a question mark, for the same gender; where BDB gives alternatives, so does the wording. Names with
// no such entry keep the safe default. For ישראל, יהודה, נח and אפרים the wording is the verse's own explanation.
const BDB_HEADWORDS = Object.freeze({ אבישי: 'אֲבִישַׁי', אלעזר: 'אֶלְעָזָר', אלישע: 'אֱלִישָׁע', אלקנה: 'אֶלְקָנָה', אמנון: 'אַמְנוֹן', אסף: 'אָסָף', אפרים: 'אֶפְרַ֫יִם', ברוך: 'בָּרוּךְ', דן: 'דָּן', יואב: 'יוֹאָב', יחזקאל: 'יְחֶזְקֵאל', ישראל: 'יִשְׂרָאֵל²', יהודה: 'יְהוּדָה', נח: 'נֹחַ', נחום: 'נַחוּם', נפתלי: 'נַפְתָּלִי', נחמיה: 'נְחֶמְיָה', עמינדב: 'עַמִּינָדָב', ראובן: 'רְאוּבֵן', שאול: 'שָׁאוּל', שמואל: 'שְׁמוּאֵל', אסנת: 'אָֽסְנַת', אסתר: 'אֶסְתֵּר', דבורה: 'דְּבוֹרָה²', הדסה: 'הֲדַסָּה', יוכבד: 'יוֹכֶ֫בֶד', רות: 'רוּת²', תרצה: 'תִּרְצָה', אוריאל: 'אוּרִיאֵל', אוריה: 'אוּרִיָּה', אשר: 'אָשֵׁר', גבריאל: 'גַּבְרִיאֵל', אביטל: 'אֲבִיטָ֑ל', אלישבע: 'אֱלִישֶׁ֫בַע', אלון: 'אַלּוֹן²', חן: 'חֵן³', חגי: 'חַגַּי', חנן: 'חָנָן', יריב: 'יָרִיב²', יאיר: 'יָאִיר', נדב: 'נָדָב', חוה: 'חַוָּה', חגית: 'חַגִּית', יגאל: 'יִגְאָל', אלחנן: 'אֶלְחָנָן', יחיאל: 'יְחִיאֵל', אביאל: 'אֲבִיאֵל', יותם: 'יוֹתָם', לוי: 'לֵוִי', בארי: 'בְּאֵרִי', צביה: 'צִבְיָה', אליאב: 'אֱלִיאָב', מנשה: 'מְנַשֶּׁה', עדיאל: 'עֲדִיאֵל', אלדד: 'אֶלְדָּד', בצלאל: 'בְּצַלְאֵל', ישעיהו: 'יְשַׁעְיָ֫הוּ' });
const BDB_MEANINGS = Object.freeze({ אבישי: 'שם מקראי; לפי מילון BDB: "אבי הוא ישי" (מוצעת גם גזירה אחרת).', אלעזר: 'שם מקראי שפירושו האל עזר.', אלישע: 'שם מקראי שפירושו האל ישועה.', אלקנה: 'שם מקראי שפירושו האל קנה — ברא, או לקח לו לקניין.', אמנון: 'שם מקראי שפירושו נאמן.', אסף: 'שם מקראי שפירושו אוסף, מאסף.', אפרים: 'שם מקראי; בכתוב (בראשית מ״א, נ״ב) השם נקשר לפריון: "כי הפרני אלהים".', ברוך: 'שם מקראי שפירושו מבורך.', דן: 'שם מקראי שפירושו שופט, דן.', יואב: 'שם מקראי שפירושו ה׳ הוא אב.', יחזקאל: 'שם מקראי שפירושו האל מחזק.', ישראל: 'שם מקראי; בכתוב (בראשית ל״ב, כ״ט) השם מוסבר "כי שרית עם אלהים ועם אנשים ותוכל".', יהודה: 'שם מקראי; בכתוב (בראשית כ״ט, ל״ה) השם נקשר להודיה: "הפעם אודה את ה׳".', נח: 'שם מקראי; בכתוב (בראשית ה׳, כ״ט) השם נקשר לנחמה: "זה ינחמנו".', נחום: 'שם מקראי שפירושו נחמה.', נפתלי: 'שם מסורתי; בכתוב (בראשית ל׳, ח׳) השם מוסבר מלשון מאבק: "נפתולי אלהים נפתלתי".', נחמיה: 'שם מסורתי שפירושו ה׳ מנחם.', עמינדב: 'שם מסורתי שפירושו עמי (קרובי) נדיב.', ראובן: 'שם מסורתי שפירושו "ראו, בן!"; בכתוב (בראשית כ״ט, ל״ב) נקשר ל"ראה ה׳ בעניי".', שאול: 'שם מקראי שפירושו שאול (מאת ה׳).', שמואל: 'שם מקראי שפירושו שם האל, או: שמו אל.', אסנת: 'שם מקראי ממקור מצרי; לפי הצעות שמביא מילון BDB: השייכת לאלה המצרית נית.', אסתר: 'שם מקראי ממקור פרסי שפירושו כוכב.', דבורה: 'שם מקראי שפירושו דבורה (החרק).', הדסה: 'שם מקראי — שמה העברי של אסתר — שפירושו הדס.', יוכבד: 'שם מקראי שפירושו ה׳ כבוד.', רות: 'שם מקראי שפירושו רעות, חברות.', תרצה: 'שם מקראי שפירושו נועם ויופי.', אוריאל: 'שם מסורתי שפירושו אורי הוא האל, או: שלהבת האל.', אוריה: 'שם מסורתי שפירושו אורי הוא ה׳, או: שלהבת ה׳.', אשר: 'שם מסורתי שפירושו מאושר.', גבריאל: 'שם מסורתי שפירושו איש האל.', אביטל: 'שם מסורתי שפירושו אבי הוא טל.', אלישבע: 'שם מסורתי שפירושו האל הוא שבועה (שבו נשבעים).', אלון: 'שם שמופיע במקרא; פירושו אלון (העץ).', חן: 'שם שמופיע במקרא; פירושו חן, חסד.', חגי: 'שם שמופיע במקרא; פירושו חגיגי.', חנן: 'שם שמופיע במקרא; פירושו חונן, נדיב בחסד.', יריב: 'שם שמופיע במקרא; פירושו הוא ייאבק, או: ילחם את ריבנו.', יאיר: 'שם מסורתי שפירושו הוא יאיר, או: מאיר.', נדב: 'שם מסורתי שפירושו נדיב, אציל.', חוה: 'שם מסורתי שפירושו חיים (כך בבראשית ג׳, כ׳: "כי הוא היתה אם כל חי"); מוצעות גם גזירות אחרות.', חגית: 'שם מסורתי שפירושו חגיגית.', יגאל: 'שם מסורתי שפירושו הוא יגאל.', אלחנן: 'שם מסורתי שפירושו האל חנן.', יחיאל: 'שם מסורתי שפירושו יחי האל.', אביאל: 'שם מסורתי שפירושו האל הוא אבי.', יותם: 'שם מסורתי שפירושו ה׳ תם (שלם).', לוי: 'שם מסורתי; בכתוב (בראשית כ״ט, ל״ד) השם נקשר להתלוות: "ילוה אישי אלי"; משמעותו המקורית מסופקת.', בארי: 'שם מסורתי שפירושו בארי, הבאר שלי.', צביה: 'שם מסורתי שפירושו צבייה.', אליאב: 'שם מסורתי שפירושו האל הוא אב.', מנשה: 'שם מסורתי; בכתוב (בראשית מ״א, נ״א) השם נקשר לשכחה: "כי נשני אלהים את כל עמלי".', עדיאל: 'שם מסורתי שפירושו האל הוא עדי (תכשיט).', אלדד: 'שם מסורתי שפירושו האל אהב.', בצלאל: 'שם מסורתי שפירושו בצל האל, בחסותו.', ישעיהו: 'שם מסורתי שפירושו ישועת ה׳.' });
const bdbUrl = headword => `https://www.sefaria.org/BDB,_${encodeURIComponent(headword)}`;
const meaningEvidence = name => BDB_HEADWORDS[name] ? [{ kind: 'Dictionary', label: BDB_SOURCE.label, url: bdbUrl(BDB_HEADWORDS[name]), reference: `BDB, ${BDB_HEADWORDS[name]}` }] : [];

const slug = value => value.normalize('NFKD').replace(/[\u0591-\u05C7]/g, '').replace(/[^א-ת]/g, '');
const GEMATRIA = Object.freeze({ א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9, י: 10, כ: 20, ך: 20, ל: 30, מ: 40, ם: 40, נ: 50, ן: 50, ס: 60, ע: 70, פ: 80, ף: 80, צ: 90, ץ: 90, ק: 100, ר: 200, ש: 300, ת: 400 });
const gematriaFor = name => { const breakdown = [...name].filter(letter => GEMATRIA[letter]).map(letter => ({ letter, value: GEMATRIA[letter] })); const total = breakdown.reduce((sum, item) => sum + item.value, 0); let reduced = total; while (reduced > 9) reduced = [...String(reduced)].reduce((sum, digit) => sum + Number(digit), 0); return { total, reduced, breakdown }; };
const sourceFor = sourceType => sourceType === 'biblical' ? TANAKH_SOURCE : sourceType === 'traditional' || sourceType === 'rabbinic' ? JEWISH_SOURCE : sourceType === 'modern-hebrew' || sourceType === 'modern-israeli' ? ACADEMY_SOURCE : CBS_SOURCE;
const usageFor = gender => ({ male: 'בנים', female: 'בנות', unisex: 'לשניהם' }[gender]);
const typeFor = sourceType => ({ biblical: 'מקראי', rabbinic: 'רבני', traditional: 'מסורתי', 'modern-hebrew': 'עברי מודרני', 'modern-israeli': 'ישראלי מודרני' }[sourceType]);
const oldId = name => `baby-name-${slug(name)}-legacy`;
const legacyIds = Object.freeze({ ברק: ['baby-name-בארק-27'] });
// Alternative spellings seen in the CBS registrations, attached to the existing record rather than listed as new names.
const aliasesFor = Object.freeze({ איילה: ['אילה'], נועם: ['נעם'], אהרן: ['אהרון'], ציפורה: ['צפורה'], נוגה: ['נגה'], איילת: ['אילת'], אסנת: ['אוסנת'], שולמית: ['שלומית'] });

const PLAIN_MEANING = 'שם עברי בשימוש יהודי ישראלי.';
function makeRecord(canonicalHebrew, gender, sourceType, aliases = [], extra = {}) {
  const biblicalReference = references[canonicalHebrew] || null;
  const verifiedSourceType = sourceType === 'biblical' && !biblicalReference ? 'traditional' : sourceType;
  // No sourced meaning: the record says only this, with no origin line beneath (user's wording, 2026-09-27).
  const sourcedMeaning = meanings[canonicalHebrew] || BDB_MEANINGS[canonicalHebrew];
  const plain = !sourcedMeaning || sourcedMeaning.includes('המשמעות המדויקת אינה ודאית');
  const literalMeaning = plain ? PLAIN_MEANING : sourcedMeaning;
  const origin = plain ? null : verifiedSourceType === 'biblical' ? 'עברית מקראית; אומת מול הקשר המקראי המקומי.' : verifiedSourceType === 'traditional' || verifiedSourceType === 'rabbinic' ? 'שם יהודי מסורתי המתועד במקורות ובשימוש קהילתי.' : 'שם עברי בשימוש ישראלי מודרני; אינו מוצג כשם מקראי ללא ראיה.';
  const source = sourceFor(verifiedSourceType);
  const evidence = [...meaningEvidence(canonicalHebrew), { kind: verifiedSourceType === 'biblical' ? 'Tanakh' : verifiedSourceType === 'traditional' || verifiedSourceType === 'rabbinic' ? 'Jewish reference' : 'Academy', label: source.label, url: source.url, reference: biblicalReference || 'שימוש ושם מתועד' }];
  if (verifiedSourceType === 'modern-israeli' || verifiedSourceType === 'modern-hebrew') evidence.push({ kind: 'CBS', label: CBS_SOURCE.label, url: CBS_SOURCE.url, reference: 'מקור עזר לשימוש; לא אישור אוטומטי של כל כתיב' });
  evidence.push(...(extra.evidence || []));
  const gematria = gematriaFor(canonicalHebrew);
  return Object.freeze({ id: oldId(canonicalHebrew), canonicalHebrew, name: canonicalHebrew, aliases: Object.freeze(aliases), relatedSpellings: Object.freeze(aliases), gender, usage: usageFor(gender), sourceType: verifiedSourceType, type: typeFor(verifiedSourceType), literalMeaning, origin, biblicalReference, meaning: plain ? literalMeaning : `${literalMeaning} ${origin}`, evidence: Object.freeze(evidence), gematria: Object.freeze(gematria), reducedNumber: gematria.reduced, quality: 'verified', qualityReason: 'רשומה שנבחרה מתוך שם יהודי או עברי מבוסס ונקשרה לראיית מקור.', source: Object.freeze({ ...source, reference: biblicalReference || 'שימוש ומקור מתועד', sourceReference: biblicalReference || verifiedSourceType }), status: 'published', popularity: null, ...(extra.usageCount ? { usageCount: Object.freeze(extra.usageCount) } : {}), legacyIds: Object.freeze([...(legacyIds[canonicalHebrew] || []), oldId(canonicalHebrew)]) });
}

// A name may sit in several lists (אריאל is biblical and also a modern unisex name). It becomes ONE record — the
// strongest evidence wins (biblical › traditional › modern), and a name listed for boys and for girls is unisex —
// instead of several records with the same id silently collapsing to whichever list came last. The id stays
// oldId(name), so saved favourites keep resolving.
const LISTS = [[biblicalBoys, 'male', 'biblical'], [biblicalGirls, 'female', 'biblical'], [traditionalBoys, 'male', 'traditional'], [traditionalGirls, 'female', 'traditional'], [modernBoys, 'male', 'modern-israeli'], [modernGirls, 'female', 'modern-israeli'], [modernUnisex, 'unisex', 'modern-israeli']];
const EVIDENCE_RANK = Object.freeze({ biblical: 0, traditional: 1, 'modern-israeli': 2 });
const merged = new Map();
for (const [names, gender, sourceType] of LISTS) for (const name of names) {
  const entry = merged.get(name) || { genders: new Set(), sourceType };
  entry.genders.add(gender);
  if (EVIDENCE_RANK[sourceType] < EVIDENCE_RANK[entry.sourceType]) entry.sourceType = sourceType;
  merged.set(name, entry);
}
const mergedGender = genders => genders.has('unisex') || (genders.has('male') && genders.has('female')) ? 'unisex' : [...genders][0];
// Removed by the user (2026-09-27); CBS names among them return to review.
const REMOVED_BY_USER = new Set('אלכסנדרה|אלכסיי|אנה|אנסטסיה|דיאנה|דמיטרי|ולדימיר|יקטרינה|לאוניד|לורן|מרגריטה|ניקול|סמיון|פולינה|רחב'.split('|'));
const published = [...merged].filter(([name]) => !REMOVED_BY_USER.has(name)).map(([name, entry]) => makeRecord(name, mergedGender(entry.genders), entry.sourceType, aliasesFor[name] || []));
const reviewNames = 'בארק|אחוזה|אלמוגית|ארזית|אשירה|גולדה|גיתאי|דולביה|יובב|יועדיה|יובלית|יחד|ינאי|כרמלית|מישר|נביעה|נוגית|סלעית|עיינה|פלגית|רביבית|שוהם|שלהב|תקומה|תשבי|אורח|חופית|יערה|כחל|מכבים|שיזף|תירוש|כרמליה|ארבלית|הדריה|זמר|חניתה|מאורית|שירז|תניא|תקווה|אדרת'.split('|');
// New CBS candidates, NOT published: babynamesIL (CBS registrations, CC0), Jewish sector only, total n ≥ 2,000 over
// 1949–2024 and still given in 2015 or later; names already in the catalog (or its aliases) excluded. One entry per
// name: [name, gender m/f/u (u when the smaller sex is ≥ 10% of the total), boys n, girls n, ...flags]. Flags are
// hints for the manual review only — 'variant:X' matches an existing name once ו/י are dropped; 'hyphen' is kept as
// written. No meaning is attached: every candidate stays at the safe default until a source is found.
const cbsCandidates = [
  ['איתי','m',40041,30], ['יאיר','m',27290,0,'variant:אור'], ['אלכסנדר','m',27258,0], ['עידו','m',27033,0,'variant:עדי'], ['אלה','f',0,26159,'variant:אליה'], ['אייל','m',23009,26,'variant:אלי'], ['עדן','u',4345,17976,'variant:עידן'], ['אופיר','u',13951,7662],
  ['איתמר','m',21523,0], ['בן','m',21439,0], ['הודיה','f',0,21056,'variant:יהודה'], ['שרון','u',7213,13656], ['שני','f',452,19782], ['מלכה','f',0,19245], ['רון','u',16996,2127], ['רותם','u',6268,12617],
  ['קרן','f',22,18387], ['נדב','m',16696,0], ['צבי','m',16585,0], ['נטע','u',2162,13905], ['אורן','m',14826,1124,'variant:אורון'], ['אילן','m',15852,68,'variant:אלון'], ['נעמה','f',0,15647], ['דנה','f',0,15587,'variant:דינה'],
  ['אדל','f',0,15426], ['ליה','f',0,15397], ['נויה','f',0,15214], ['אנה','f',0,15172], ['הדס','f',0,15167], ['עומרי','m',14497,198,'variant:עומר'], ['הראל','m',14110,420], ['יניב','m',13982,0],
  ['מירב','f',44,13321], ['לירון','u',4769,8494], ['רומי','f',283,12977], ['ליאל','u',3513,9720], ['ליאת','f',0,13133], ['רונית','f',0,13070], ['אגם','f',737,12201], ['ליאם','u',9739,3127],
  ['ישי','m',12747,0,'variant:שי'], ['עופר','m',12300,286], ['דור','u',11090,1268], ['יפה','f',0,12323], ['נהוראי','m',12193,0], ['מור','u',2933,9223], ['זיו','u',8636,3462], ['מורן','u',1441,10547],
  ['ניסים','m',11862,0], ['נטלי','f',0,11781], ['דורון','u',10353,1151], ['אבי','m',11456,5,'variant:יואב'], ['מיטל','f',0,11267], ['ברכה','f',0,11185], ['מזל','f',0,10983], ['ספיר','f',365,10579],
  ['סיון','f',418,10446], ['רונן','m',10861,0], ['איריס','f',0,10812], ['אליעזר','m',10787,0,'variant:אלעזר'], ['ליאן','f',65,10617], ['ערן','m',10635,0], ['עילאי','m',10444,60], ['עלמה','f',0,10375],
  ['ירון','m',10197,0], ['חוה','f',0,10066,'variant:חיה'], ['מאי','f',332,9593], ['רן','m',9732,5], ['בוריס','m',9718,0], ['דליה','f',0,9542], ['שרית','f',0,9520], ['טלי','f',0,9520,'variant:טל'],
  ['ירין','u',7060,2435], ['אמה','f',0,9457], ['עופרי','u',1937,7510], ['דניאלה','f',0,9267], ['חגית','f',0,9226], ['ענבל','f',0,9198], ['שירן','f',301,8597], ['טוהר','u',1251,7613],
  ['מיקה','f',0,8790], ['ורד','f',0,8758], ['ענבר','u',999,7743], ['עליזה','f',0,8658], ['יגאל','m',8438,0], ['שלי','f',0,8404,'variant:שלו'], ['אורטל','f',5,8370], ['דביר','m',8313,42],
  ['ניתאי','m',8291,0], ['ניב','u',6279,1969], ['אביה','f',750,7323], ['לינוי','f',0,8049], ['רויטל','f',0,7978], ['נוי','f',600,7372], ['טובה','f',0,7874,'variant:טוביה'], ['בת שבע','f',0,7865],
  ['נורית','f',0,7847], ['דמיטרי','m',7841,0], ['ולדימיר','m',7821,0], ['עמנואל','u',5321,2480], ['זהבה','f',0,7768], ['אלחנן','m',7611,0], ['אוהד','m',7592,0], ['יחיאל','m',7491,0],
  ['רינה','f',0,7473], ['לירן','u',6053,1304], ['גילי','u',898,6411,'variant:גל'], ['ויקטוריה','f',0,7237], ['סתיו','u',2391,4810], ['מרק','m',7119,0], ['סופיה','f',0,7087], ['יוליה','f',0,7078],
  ['ליטל','f',0,7065], ['ינון','m',7053,0], ['לאוניד','m',6863,0], ['שיראל','f',59,6770,'variant:ישראל'], ['זאב','m',6796,0], ['ינאי','m',6748,12], ['אמילי','f',0,6736], ['מישל','u',2167,4529],
  ['אלירן','m',6635,0], ['אביאל','m',6618,0], ['יורם','m',6604,0,'variant:רום'], ['יוסי','m',6582,0], ['אורנה','f',0,6495], ['נריה','m',5982,495], ['אביבה','f',0,6466], ['יותם','m',6462,0,'variant:תום'],
  ['עודד','m',6446,0], ['ארבל','u',2468,3948], ['יהב','u',4629,1768], ['גלי','f',286,6078,'variant:גל'], ['יפעת','f',0,6267], ['סהר','u',4515,1709], ['עינת','f',0,6186,'variant:ענת'], ['סימה','f',0,6139],
  ['אימרי','m',5983,141,'variant:אמיר'], ['סיגל','f',0,6066], ['דב','m',6065,0], ['שי-לי','f',78,5910,'hyphen'], ['ליאורה','f',0,5961], ['שוהם','u',2119,3769], ['שירלי','f',0,5832], ['אורה','f',0,5635,'variant:אוריה'],
  ['מריה','f',0,5603,'variant:מוריה'], ['סמדר','f',0,5584], ['שירי','f',0,5525,'variant:שיר'], ['רינת','f',0,5517], ['אהוד','m',5491,0], ['בניה','m',5485,0], ['אורין','u',1039,4434,'variant:אורון'], ['נוה','m',5296,171],
  ['נאוה','f',0,5453], ['ליעד','u',4293,1140], ['אתי','f',155,5265], ['בת אל','f',0,5403], ['שילת','f',0,5351], ['ליהי','f',0,5321], ['שלומי','m',5304,0], ['אלינור','f',0,5299],
  ['אמיתי','m',5294,0], ['לי','u',830,4461], ['דני','u',4569,684], ['איליה','m',5244,0,'variant:אליה'], ['לוי','m',5183,0], ['אילנית','f',0,5160], ['ויקטור','m',5113,0], ['בארי','u',4595,518],
  ['נבו','m',5101,6], ['דיאנה','f',0,5080], ['יערה','f',0,5071], ['יסמין','f',0,5068], ['נאור','m',5035,16], ['רומן','m',4968,0], ['עינב','f',217,4694], ['אביחי','m',4861,0],
  ['בלה','f',0,4859], ['רמי','m',4849,0], ['צביה','f',0,4789], ['ניקול','f',0,4786], ['פיגא','f',0,4785], ['אליאב','m',4774,0], ['רוי','m',4692,36], ['יפית','f',0,4725],
  ['יהל','u',2042,2603,'variant:יהלי'], ['יונה','u',2363,2277], ['מקסים','m',4535,0], ['רחמים','m',4465,0], ['אריק','m',4449,0], ['לידור','u',3591,851], ['אלין','f',27,4388,'variant:אלון'], ['אלכסנדרה','f',0,4397],
  ['אריאלה','f',0,4360], ['עילי','m',4353,5,'variant:יעל'], ['לירז','f',378,3944], ['רני','u',2208,2112,'variant:רוני'], ['ליאב','m',3999,321], ['קארין','f',0,4292], ['גליה','f',0,4282,'variant:גילה'], ['שון','m',4151,101],
  ['תאיר','f',116,4017], ['אוריאן','u',685,3436], ['מירי','f',0,4107], ['אושרי','m',3840,260,'variant:אושר'], ['אלמה','f',0,4098], ['אלינה','f',0,4029,'variant:אלונה'], ['רחלי','f',0,4022,'variant:רחל'], ['ריף','u',2637,1362],
  ['אדר','u',2001,1996,'variant:אדיר'], ['איליי','m',3822,171,'variant:אלי'], ['נינה','f',0,3954], ['קורל','f',0,3948], ['שליו','m',3702,242,'variant:שלו'], ['שובל','u',683,3260], ['לני','u',1523,2364], ['הילי','f',0,3849,'variant:יהלי'],
  ['מנשה','m',3844,0], ['מלאכי','m',3828,0], ['עדינה','f',0,3807], ['גיטל','f',0,3768], ['רואי','m',3747,10], ['אווה','f',0,3745], ['אודל','f',0,3668], ['אליאור','m',3344,269],
  ['יוחאי','m',3577,0], ['רונה','f',0,3573], ['נילי','f',0,3562], ['דריה','f',0,3553], ['בת','f',0,3526], ['יסכה','f',0,3525], ['אלרואי','m',3478,0], ['נמרוד','m',3447,0],
  ['עמיחי','m',3435,0], ['רותי','f',0,3403,'variant:רות'], ['ראם','m',3390,11], ['אנאל','f',0,3382], ['יולי','f',301,3079], ['עקיבא','m',3342,0], ['שניאור','m',3320,0], ['איה','f',0,3311],
  ['מירה','f',0,3303,'variant:מוריה'], ['אלכסיי','m',3262,0], ['ליהיא','f',0,3247], ['הללי','f',0,3244,'variant:הלל'], ['מרגריטה','f',0,3197], ['אילון','m',3178,18,'variant:אלון'], ['צופיה','f',0,3185], ['אלכס','u',2039,1087],
  ['יגל','m',3088,26,'variant:גל'], ['שרונה','f',0,3106], ['דין','m',2934,142,'variant:דן'], ['רננה','f',0,3047], ['לילי','f',0,2950], ['דולב','u',2450,496], ['רוזה','f',0,2921], ['חדוה','f',0,2911],
  ['מלי','f',0,2893], ['לורן','f',259,2631], ['קרין','f',0,2884], ['רוברט','m',2873,0], ['מיאל','f',225,2640], ['ליאו','m',2862,0], ['גולן','m',2820,29], ['אלן','u',2206,642,'variant:אלון'],
  ['בני','m',2818,0], ['יפתח','m',2794,0], ['סימון','u',2308,481], ['עמרם','m',2775,0], ['אלימלך','m',2774,0], ['אליס','f',5,2755], ['רוחמה','f',0,2738], ['יקטרינה','f',0,2733],
  ['פולינה','f',0,2721], ['מוטי','m',2713,0], ['עמליה','f',0,2658], ['עדיאל','u',2251,407], ['יאנה','f',0,2657], ['פרידה','f',0,2635], ['רם','m',2634,0,'variant:רום'], ['אודיה','f',0,2575,'variant:אדווה'],
  ['אן','f',0,2500], ['סמיון','m',2486,0], ['קורן','m',2264,222], ['שרי','f',0,2477,'variant:שיר'], ['חנוך','m',2475,0], ['בלומה','f',0,2470], ['יוגב','m',2461,0], ['אלדד','m',2453,0],
  ['לירוי','m',2431,17], ['ליב','f',155,2292,'variant:לב'], ['יאן','m',2422,17], ['טום','m',2366,62], ['שניר','m',2342,52], ['אליאן','f',11,2380], ['קובי','m',2386,0], ['ניסן','m',2385,0],
  ['ריי','u',2053,274], ['תקוה','f',0,2308], ['לין','f',0,2298], ['ליליה','f',0,2236], ['גולדה','f',0,2232], ['שירז','f',5,2217], ['רעיה','f',0,2219], ['גבריאלה','f',0,2216],
  ['אליזבט','f',0,2211], ['שיינא','f',0,2203], ['אמיליה','f',0,2200], ['דורין','f',0,2193], ['אחיה','m',2192,0], ['ליבא','f',0,2174,'variant:לביא'], ['עפרה','f',0,2172], ['אנסטסיה','f',0,2165],
  ['עטרה','f',0,2160], ['נאיה','f',0,2156], ['חי','m',2141,0], ['גרשון','m',2135,0], ['בצלאל','m',2112,0], ['יעלה','f',0,2110], ['ציונה','f',0,2105], ['צליל','f',97,2001],
  ['ישעיהו','m',2091,0], ['ליזה','f',0,2081], ['צילה','f',0,2079], ['הינדא','f',0,2079], ['משי','f',0,2076], ['אחינועם','f',0,2073], ['לבנה','f',0,2060], ['מילה','f',0,2049],
  ['ולדיסלב','m',2046,0], ['חני','f',0,2036], ['חנניה','m',2024,0], ['אבינועם','m',2014,0],
];
const CBS_GENDER = Object.freeze({ m: 'male', f: 'female', u: 'unisex' });
const cbsByName = new Map(cbsCandidates.map(([name, g, male, female, ...flags]) => [name, { gender: CBS_GENDER[g], male, female, total: male + female, flags }]));
const babynamesIlEvidence = cbs => ({ kind: 'CBS', label: BABYNAMES_IL_SOURCE.label, url: BABYNAMES_IL_SOURCE.url, reference: `מגזר יהודי, 1949–2024: ${cbs.total} (בנים ${cbs.male} · בנות ${cbs.female})` });
// Reviewed by hand (2026-09-27): these 54 stay in review; so does every candidate carrying a flag (hyphen, or a
// possible variant of an existing name — a separate pass). Every other candidate is published: with a BDB meaning
// as a traditional name, otherwise as modern Israeli with the default meaning. Nothing else about them is inferred.
const CBS_KEPT_IN_REVIEW = new Set('מקסים|שון|רוברט|ליאו|יאן|טום|רוי|אדל|נטלי|איריס|ויקטוריה|סופיה|אמילי|שירלי|קרין|נינה|אן|אמיליה|ליזה|אמה|דורין|אלן|סימון|ריי|ליאם|ריף|גולדה|פיגא|גיטל|בלומה|שיינא|הינדא|פרידה|רוזה|בלה|אלה|מאי|ליה|רומי|מיקה|יסמין|אווה|לין|דריה|אלין|אריק|לירוי|דין|לני|יולי|אודל|גבריאלה|מלי|נאיה'.split('|'));
// Variant hints checked by hand and found false (יאיר≠אור, חוה≠חיה, יותם≠תום): published despite the hint.
const CBS_NOT_VARIANTS = new Set(['יאיר', 'חוה', 'יותם']);
for (const [name, cbs] of cbsByName) {
  if (REMOVED_BY_USER.has(name) || CBS_KEPT_IN_REVIEW.has(name) || (cbs.flags.length && !CBS_NOT_VARIANTS.has(name)) || merged.has(name)) continue;
  published.push(makeRecord(name, cbs.gender, BDB_MEANINGS[name] ? 'traditional' : 'modern-israeli', [], { evidence: [babynamesIlEvidence(cbs)], usageCount: { total: cbs.total, male: cbs.male, female: cbs.female } }));
}
// Added by the user as checked (2026-09-27). Names in review publish with their CBS data; new names carry their
// Jewish-sector counts from babynamesIL where the registrations have them. Six have no registration row: דויד, עלמא,
// אילאי take the gender of their other spelling in the data (דוד, עלמה, עילאי), קציעה of its biblical bearer (Job
// 42:14); האני and אושיר are listed for both. Hyphens are kept as written.
const USER_ADDED = 'גולדה|פיגא|גיטל|בלומה|שיינא|פרידה|רוזה|ריי|ליאם|ריף|אלה|מאי|ליה|רומי|מיקה|אווה|לין|אלין|דריה|אריק|לירוי|לני|יולי|אודל|אדל|מלי|נאיה|הילי|אליעזר|שי-לי|דורין|אודיה|הודיה|ישי|עידו|עדן|אורן|שרי|רחלי|יורם|עומרי|אייל'.split('|');
const USER_ADDED_NEW = [['עלמא','f',0,0], ['שייה','f',0,1148], ['הלני','f',0,777], ['האני','u',0,0], ['קציעה','f',0,0], ['מילכה','f',0,573], ['נוריאל','m',852,0], ['נורי','u',308,124], ['מאירה','f',0,1587], ['בן-ציון','m',281,0], ['דויד','m',0,0], ['אלדר','m',1511,11], ['עוזיאל','m',814,0], ['חזי','m',621,0], ['צחי','m',2786,0], ['פרי','u',163,218], ['פרח','f',0,708], ['חלי','f',0,1184], ['לאון','m',1836,0], ['אושיר','u',0,0], ['נוריה','f',0,11], ['גואל','u',142,21], ['אביגדור','m',1330,0], ['ימית','f',0,1841], ['עברי','m',1766,0], ['אברי','m',35,0], ['מתניה','m',1333,0], ['אושרה','f',0,1040], ['אושרית','f',0,2127], ['עמיר','m',1745,0], ['עמירן','m',16,0], ['עמירם','m',851,0], ['חושן','u',199,863], ['עופרה','f',0,2144], ['דקלה','f',0,1934], ['זיוה','f',0,3191], ['עזר','m',272,0], ['אילאי','m',0,0], ['יתיר','m',18,0]];
for (const name of USER_ADDED) {
  const cbs = cbsByName.get(name);
  if (!cbs || merged.has(name) || published.some(item => item.canonicalHebrew === name)) continue;
  published.push(makeRecord(name, cbs.gender, BDB_MEANINGS[name] ? 'traditional' : 'modern-israeli', [], { evidence: [babynamesIlEvidence(cbs)], usageCount: { total: cbs.total, male: cbs.male, female: cbs.female } }));
}
for (const [name, g, male, female] of USER_ADDED_NEW) {
  const cbs = { male, female, total: male + female };
  published.push(makeRecord(name, CBS_GENDER[g], 'modern-israeli', [], cbs.total ? { evidence: [babynamesIlEvidence(cbs)], usageCount: cbs } : {}));
}
const isPublished = name => published.some(item => item.canonicalHebrew === name);
// A review record; when the name is a CBS candidate it carries its gender, usage counts, flags and both citations.
function reviewRecord(name, id) {
  const cbs = cbsByName.get(name);
  const gender = cbs?.gender || 'unisex';
  const sourced = BDB_MEANINGS[name];
  return Object.freeze({ id, canonicalHebrew: name, name, aliases: [], relatedSpellings: [], gender, usage: usageFor(gender), sourceType: 'uncertain', type: 'מועמד לבדיקה', literalMeaning: sourced || 'המשמעות המדויקת אינה ודאית.', origin: 'נדרשת בדיקה של כתיב, שימוש ומקור.', biblicalReference: null, meaning: sourced ? `${sourced} נדרשת בדיקה של כתיב, שימוש ומקור.` : 'המשמעות המדויקת אינה ודאית; נדרשת בדיקה של כתיב, שימוש ומקור.',
    evidence: cbs ? Object.freeze([...meaningEvidence(name), { kind: 'CBS', label: CBS_SOURCE.label, url: CBS_SOURCE.url, reference: 'מקור עזר לשימוש; לא אישור אוטומטי של כל כתיב' }, babynamesIlEvidence(cbs)]) : [],
    usageCount: cbs ? Object.freeze({ total: cbs.total, male: cbs.male, female: cbs.female }) : null, reviewFlags: Object.freeze(cbs?.flags || []),
    quality: 'needs-review', qualityReason: 'לא פורסם ללא ראיה מספקת.', status: 'review', source: Object.freeze(cbs ? { ...BABYNAMES_IL_SOURCE, reference: 'בדיקת מקור נדרשת' } : { ...CBS_SOURCE, reference: 'בדיקת מקור נדרשת' }), gematria: null, reducedNumber: null, legacyIds: [] });
}
const review = [
  // Numbered by position among the original review names, so an id does not shift when an earlier one is published.
  ...reviewNames.filter(name => !merged.has(name)).map((name, index) => [name, index]).filter(([name]) => !isPublished(name)).map(([name, index]) => reviewRecord(name, `baby-name-review-${slug(name)}-${index + 1}`)),
  ...[...cbsByName.keys()].filter(name => !isPublished(name) && !reviewNames.includes(name)).map(name => reviewRecord(name, `baby-name-review-${slug(name)}-cbs`)),
];

export const BABY_NAMES_META = Object.freeze({ version: 3, publishedAt: '2026-09-21', publishedCount: published.length, reviewCount: review.length, sources: [CBS_SOURCE, BABYNAMES_IL_SOURCE, BDB_SOURCE, TANAKH_SOURCE, ACADEMY_SOURCE, JEWISH_SOURCE], licenseNote: 'תיאורים קצרים אלה הם ניסוח מקורי; נתוני שימוש וקשרים מקראיים נשענים על המקורות המוצהרים.' });
export const BABY_NAMES = Object.freeze([...published, ...review]);
export const PUBLISHED_BABY_NAMES = Object.freeze(published);
export const REVIEW_BABY_NAMES = Object.freeze(review);
