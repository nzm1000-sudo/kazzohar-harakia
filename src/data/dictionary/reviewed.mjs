// Reviewed rules of the word dictionary — hand-checked data, not code, applied by the build
// (scripts/dictionary/build-word-dictionary.mjs). Nothing here invents a meaning: every chosen gloss must be one the
// source itself gives for that very word (the build fails otherwise), and each rule says why.
//
// FAMILIES are the reader families of data-lookup (src/services/wordLookup/engine.mjs › LOOKUP_FAMILIES).
export const ARAMAIC_TEXT_FAMILIES = Object.freeze(['talmud', 'zohar']);
export const TALMUDIC_FAMILIES = Object.freeze(['talmud', 'talmud-commentary']);
export const COMMENTARY_FAMILIES = Object.freeze(['talmud-commentary', 'mishnah-commentary', 'tanakh-commentary', 'halacha', 'rambam', 'responsa', 'chassidut', 'machshava', 'mussar', 'kabbalah', 'midrash', 'torah']);

// 1. Choose one of the source's own senses for an ambiguous word or abbreviation, in the listed families only (in other
//    families the ambiguity stands: two senses "א · ב", or nothing). `gloss` must equal a sense the source gives.
export const CONTEXT_CHOICES = Object.freeze([
  { key: 'ת״ש', gloss: 'תא שמע', families: TALMUDIC_FAMILIES, why: 'In the Gemara ת״ש opens a proof: "come and hear". Wiktionary ת"ש, sense 1; Krupnik s.v. תָּא שְׁמַע cites it as ת״ש (Berakhot 12a). Elsewhere ת״ש is also תקיעת שופר / תפילת שחרית: no gloss.' },
  { key: 'א״ל', gloss: 'אמר לו', families: TALMUDIC_FAMILIES, why: 'Krupnik: אמר לו; איכא למימר; אי לימא. In the Gemara and on its page the running א״ל is "he said to him".' },
  { key: 'ע״ש', gloss: 'עיין שם', families: COMMENTARY_FAMILIES, why: 'Krupnik: עיין שם; על שם; ערב שבת. In a commentary or a halachic work it refers the reader onward.' },
  { key: 'ר״ל', gloss: 'ריש לקיש', families: ['talmud'], why: 'Krupnik: רוצה לומר; רחמנא ליצלן; ריש לקיש. In the Gemara ר״ל is the sage.' },
  { key: 'ר״ל', gloss: 'רוצה לומר', families: COMMENTARY_FAMILIES, why: 'In a commentary ר״ל introduces an explanation.' },
  { key: 'ד״א', gloss: 'דבר אחר', families: ['zohar', 'kabbalah', 'midrash'], why: 'Krupnik: ד׳ אמות; דבר אחר; דרך ארץ. In the Zohar and the Midrash ד״א opens another interpretation; in the Gemara all three are common: no gloss.' },
  { key: 'רש״י', gloss: 'ר׳ שלמה יצחקי', families: null, why: 'Wiktionary רש"י has two headings: the sage (ר\' שלמה יצחקי) and a homograph "רחיים של יד". Only the sage belongs to a Torah text.' },
]);

// 2. Limit a word or abbreviation to some families (its reading elsewhere differs or is unclear).
export const FAMILY_LIMITS = Object.freeze([
  { key: 'יו״ד', families: ['halacha', 'responsa', 'talmud-commentary', 'torah'], why: 'יורה דעה in halachic writing; in the Zohar and Kabbalah יו״ד is the letter yod.' },
]);

// Truncations with a single geresh (כו׳, כר׳, תוס׳) mean different things in different books (תוס׳ is the Tosefta in
// the dictionary, Tosafot in the commentaries; כר׳ is כרבי in the Gemara, כריתות in the dictionary): left out, except.
export const GERESH_ALLOW = Object.freeze(['אפי׳']);

// Words the Gemara uses twenty times or more (and the Zohar twenty, Onkelos ten): glossed only when listed here, after checking the gloss against the Gemara's
// own use of the word (key → the note of the review). Anything frequent and unlisted is left out.
export const FREQUENT_REVIEWED = Object.freeze({
  // true: the source's gloss(es) as they are.  A string: the one sense of the source that is the Gemara's use.
  // Reviewed 2026-09-30 against the Gemara's own use, from the 351 words the Gemara uses fifty times or more that
  // survived the automatic filters; the rest (names, Hebrew words, prefixed forms, senses that are not the Gemara's) are
  // left out by not being listed. Keys are written as in the text; the build normalizes them.
  'מאי': true, 'נמי': true, 'א״ר': true, 'הכא': true, 'סבר': 'חשב', 'איכא': 'יש', 'התם': true, 'האי': true, 'טעמא': true,
  'תניא': true, 'רחמנא': true, 'ת״ל': true, 'היכי': true, 'ת״ר': true, 'קמ״ל': true, 'הני': true, 'אתא': 'בא', 'תנן': 'שנינו במשנה',
  'מ״ט': 'מאי טעמא', 'אילימא': 'אם נאמר', 'אפי׳': true, 'ר״ש': 'ר׳ שמעון', 'חדא': 'אחד', 'פשיטא': 'ודאי, ממילא מובן',
  'סיפא': 'החלק האחרון של המשנה', 'אמאי': true, 'מנא': 'מנין?', 'תרי': 'שנים', 'אית': true, 'נינהו': true, 'ר״מ': 'ר׳ מאיר',
  'מילתא': 'דבר', 'דילמא': 'שמא, אולי', 'ש״מ': 'שמע מינה', 'דרבנן': true, 'ר״א': true, 'מכלל': true, 'לית': true, 'עלמא': true,
  'אע״פ': true, 'גברא': 'איש', 'אלמא': true, 'ר״ע': 'ר׳ עקיבא', 'מנלן': true, 'יומא': 'יום', 'ה״נ': true, 'תרתי': true,
  'ב״ד': 'בית דין', 'כוותיה': true, 'אנן': true, 'דינא': 'דין ומשפט', 'קמא': true, 'אע״ג': true, 'ב״ש': 'בית שמאי', 'אחרינא': true,
  'אליבא': true, 'רשב״ג': true, 'א״כ': 'אם כן', 'תיובתא': 'קושיא ופירכא', 'אידך': true, 'מצי': 'יכול', 'תיקו': true,
  'לאפוקי': true, 'מכדי': true, 'בהדי': 'עם ובמעמד', 'איהו': true, 'איתא': 'יש', 'אזל': 'הלך', 'ארעא': 'אדמה, ארץ', 'טפי': 'יותר',
  'ממאי': true, 'ר״ל': true, 'איסורא': 'איסור', 'לישנא': 'לשון, שפה', 'דומיא': true, 'אדרבה': true, 'איבעית': true, 'מיא': true,
  'אתמר': true, 'מיהא': true, 'ק״ו': true, 'הדדי': true, 'פלגא': 'מחצית', 'איריא': true, 'בעיא': true, 'ה״מ': true, 'ע״י': true,
  'ה״ק': 'הכי קאמר', 'זימנא': 'זמן', 'ניהו': true, 'עדיף': true, 'ר״נ': 'רב נחמן', 'רובא': 'רוב', 'אייתי': true, 'גיסא': 'צד, שכנות',
  'ה״ז': true, 'דידן': true, 'הלכך': true, 'כ״ש': 'כל שכן', 'שמעתא': true, 'איידי': 'מכיון', 'איפכא': true,
  'סד״א': 'סלקא דעתך אמינא', 'סברא': true, 'עובדא': true, 'אגב': true, 'ר״ג': true, 'ע״ז': true, 'רבש״ע': true, 'האידנא': true,
  'מעליא': true, 'ע״ג': 'על גבי', 'ע״פ': 'על פי', 'כמי': true, 'יוה״כ': true, 'לאלתר': true, 'לחוד': true, 'ת״ק': true,
  'אחריתי': true, 'ה״ד': 'היכי דמי', 'פליג': 'היה מחולק בדעות', 'איתתא': true, 'איהי': true, 'הנהו': true, 'שתא': true,
  'ת״ח': 'תלמיד חכם', 'דיעבד': true, 'מ״ד': 'מאן דאמר', 'ה״א': true, 'מ״מ': 'מכל מקום', 'ע״מ': true, 'כ״ג': true, 'גלותא': true,
  'יו״ט': true, 'אלמה': true, 'שכיחא': true, 'ביתא': 'בית', 'ק״ש': 'קריאת שמע', 'מ״ש': 'מאי שנא', 'בתרא': true, 'ל״ש': 'לא שנא',
  'שכיח': true, 'טרח': true, 'מהיכא': true, 'אגרא': true, 'פסידא': true, 'א״ה': 'אי הכי', 'דמא': true, 'קושיא': true, 'כותיה': true,
  'מיטרא': true, 'תינח': true, 'ל״ק': 'לא קשיא', 'ממילא': true, 'קניא': true, 'ר״ה': true, 'כנישתא': 'בית הכנסת', 'אא״כ': true,
  'ל״ל': 'למה לי', 'אתון': true, 'א״נ': 'אי נמי', 'ס״ת': 'ספר תורה', 'רה״ר': true, 'נפיש': true,
  'פלוגתא': 'וכוח, מחלוקת', 'זמנין': true, 'טבא': 'טוב', 'מטי': 'הגיע ובא', 'אדהכי': true, 'כ״ע': 'כולי עלמא', 'מיגו': true,
  'נהרא': 'נהר, נחל', 'דידך': true, 'לחצאין': true, 'שמעתתא': true, 'מחוורתא': true, 'אכתי': true, 'עכו״מ': true, 'ריב״ל': true,
  'ריפתא': true, 'שדר': 'שלח', 'אינש': true, 'ברייתא': true, 'מתא': true, 'חיטי': true, 'קנסא': true,
  // Second pass (2026-09-30): the words the Gemara uses twenty to forty-nine times.
  'אורייתא': 'תורה', 'בישרא': true, 'פירכא': true, 'ינוקא': true, 'נקט': 'החזיק, אחז', 'בשרא': 'בשר, גוף', 'ירחא': true,
  'דעתא': 'דעה, סברא', 'אריא': true, 'זבן': true, 'תעניתא': true, 'בתראי': true, 'נהמא': true, 'בתרייתא': true, 'שיכרא': true,
  'והא״ר': true, 'נטירותא': true, 'פיתחא': true, 'חביתא': true, 'בהדה': 'עם ובמעמד', 'אבראי': true, 'דוכתא': true, 'מנה״מ': true,
  'אורחא': true, 'מציעתא': true, 'אונסא': true, 'זוטא': true, 'כלבא': true, 'אפ״ה': true, 'דיינא': true, 'ידא': true, 'מ״ס': true,
  'יממא': 'יום, שעות היום', 'ריבעא': true, 'דהבא': 'זהב', 'ל״א': true, 'כיתנא': true, 'קא״ל': true, 'בהמ״ק': true, 'חדתא': true,
  'טייעא': true, 'כרעא': true, 'רה״י': true, 'ה״ל': 'הוה ליה', 'אר״ש': true, 'סהדא': true, 'כיסופא': true, 'חולשא': true,
  'משכנתא': true, 'רבותא': 'חדוש, דבר פלא', 'שבק': 'עזב, הניח', 'א״צ': true, 'מודעא': true, 'אומצא': true, 'הילכך': true,
  'זוגא': 'בן זוג, חבר', 'רשב״ל': true, 'ר״ט': true, 'רשב״י': true, 'תתאה': true, 'שיורא': true, 'תותי': true, 'מלכותא': true,
  'טירחא': true, 'חלמא': true, 'עיסקא': true, 'עמא': true, 'היקש': true, 'טבחא': 'קצב', 'ביעתותא': true, 'אוכמא': true,
  'עילאה': true, 'בירא': true, 'דייקא': true, 'שרגא': 'נר, מנורה', 'את״ל': 'אם תמצי לומר', 'א״ד': 'איכא דאמרי', 'י״א': true,
  'י״ט': true, 'ד״ה': 'דבור המתחיל', 'ב״ח': 'בעל חוב', 'ג״ש': 'גזירה שוה', 'אמתא': true, 'סכינא': true, 'דרגא': 'מדרגה',
  // Third pass (2026-09-30): words the Zohar uses twenty times or more, or Onkelos ten times or more.
  'בגין': true, 'לעילא': true, 'קב״ה': true, 'קודשא': true, 'אתר': true, 'נ״א': 'נוסחא אחרינא', 'סטרא': true, 'כחדא': true,
  'זכאה': true, 'דלהון': true, 'רעיא': 'רועה', 'קדמאה': true, 'אוף': true, 'מסאבא': true, 'צלותא': true, 'חולקא': true,
  'שמשא': 'חמה, שמש', 'דיוקנא': true, 'יתהון': true, 'רעותא': true, 'סיהרא': true, 'זמין': true, 'חכמתא': true, 'יו״ד': true,
  'כמא': true, 'עמודא': 'עמוד', 'סטר': 'צד', 'מטרוניתא': true, 'שירתא': true, 'כהאי': true, 'בוצינא': 'נר', 'צפרא': 'בוקר',
  'יחודא': true, 'ארחא': true, 'קדמאי': true, 'נייחא': true, 'נפשא': true, 'רביעאה': true, 'דחיל': true, 'בתראה': true,
  'חובא': 'חטא', 'רוגזא': true, 'ברכתא': true, 'חדוותא': true, 'חיזו': true, 'מוחא': true, 'גוון': 'צבע',
  'מתיבתא': 'ישיבה, בית מדרש', 'פתורא': true, 'מסאב': true, 'תוקפא': 'תוקף, עוז', 'זרעית': true, 'דילהון': true,
  'כלילא': 'זֵר, נזר', 'חושבנא': true, 'שתין': true, 'פולחנא': true, 'לחדא': true, 'רתיכא': true, 'סהדותא': true, 'חכים': true,
  'חדי': 'שמח', 'דיקנא': true, 'דחילו': true, 'עיטא': true, 'שתיתאה': 'ששי', 'אתערותא': true, 'פומא': true, 'מצראי': true,
  'קרתא': 'עיר, קריה', 'תיאובתא': true, 'תננא': true, 'אשתמודע': 'הכיר', 'חקלא': true, 'גניז': 'טמון, שמור', 'דקיק': true,
  'מערתא': true, 'תושבחתא': true, 'בעירא': true, 'דכיא': true, 'חוור': true, 'תרעא': 'שער', 'בטש': true, 'שלימא': true,
  'טמיר': true, 'מאנא': 'כלי', 'חידו': true, 'ענא': true, 'אנפי': true, 'כרוזא': true, 'איבא': true, 'יתיה': 'אותו, ההוא',
  'עלתא': true, 'שלהובא': true, 'שלימותא': true, 'חמישאה': true, 'חרבא': 'חרב', 'תמינאה': true, 'רביא': 'נער', 'דהב': 'זהב',
  'כפנא': true, 'גלגלא': 'אופן', 'גליפא': true, 'יחידאה': true, 'ממלל': true, 'רמשא': true, 'עותרא': true, 'ערסא': 'מטה',
  'אושפיזא': 'אכסניא', 'ירותא': 'ירושה', 'ציורא': true, 'חקל': true, 'כוכבא': true, 'מנרתא': true, 'משכא': true, 'אסיא': 'רופא',
  'דלכון': true, 'כולא': true, 'פסחא': true, 'אומאה': true, 'גיורא': 'גר', 'ה״י': true, 'זהורי': true, 'ח״ו': true, 'קלנא': true,
  'מותנא': 'דֶבר, מגפה', 'מנחתא': true, 'משריתא': true, 'סיומא': true, 'שופרא': 'יופי', 'מדעם': true, 'מלרע': true, 'כבדא': true,
  'לעיל': true, 'נוכראה': true, 'אחסנא': true, 'נונא': true, 'פום': 'פה', 'קוב״ה': true, 'משחתא': true, 'א״ת': true, 'בסרא': true,
  'דרומא': true, 'יתב': 'ישב', 'נחשא': 'נחושת', 'טופנא': true, 'חפי': true, 'יאה': true, 'סגיר': true, 'אוכם': true, 'דה״ב': true,
  'דרתא': true, 'חוטרא': 'מקל', 'מכא': 'מכאן', 'כותלא': true, 'פולחן': true, 'קורבנא': 'קרבן, זבח', 'מתקל': 'משקל', 'סגירו': true,
  'פרוקא': true, 'שזיר': true, 'גליף': true, 'כדנן': true, 'תחומא': true, 'ברדא': true, 'גוא': true, 'מאים': true, 'בבעו': true,
  'קורבן': 'קרבן, זבח', 'סגירותא': true, 'אליון': true, 'סולתא': 'סולת', 'עסרא': true, 'בזיכא': true, 'ארמא': true,
  'מדינחא': true, 'עזקתא': true, 'כיורא': true,
  'הקב״ה': true, 'ליכא': true, 'ש״א': true, 'ל״ג': 'לא גרסינן', 'ע״כ': 'עד כאן',
});

// 3. Words that are also common Biblical Hebrew (three or more times in the Hebrew of the Tanakh) are left out, since
//    a Hebrew homograph would be glossed wrongly. These few are kept in the Aramaic texts only, where the Aramaic
//    reading is the one on the page.
export const HEBREW_HOMOGRAPH_ALLOW = Object.freeze([
  { key: 'איתמר', families: ARAMAIC_TEXT_FAMILIES, why: 'In the Tanakh the name Itamar; in the Gemara "it was said" (Wiktionary אִתְּמַר, כתיב מלא איתמר).' },
]);

// 4. Aramaic senses of Hebrew Wiktionary taken as they are (the category also holds Hebrew words with an Aramaic sense —
//    אמר "lamb", עיר "angel", קרא "gourd" — which would gloss the Hebrew word wrongly; only these are taken).
export const WIKTIONARY_ARAMAIC_ALLOW = Object.freeze(['איתמר', 'שונרא', 'שרגא', 'ארמלתא', 'מתיבתא', 'חוכא', 'אסיא', 'אסותא', 'לית', 'לפום', 'פום', 'קמא', 'חקל', 'אפדנא', 'עזקתא', 'שבק', 'זבן']);

// Prefix forms the Gemara uses often, each checked: the composed gloss is right there (ו + גלוס, ד + פועל = ש־, ד + שם
// = של־, ב/ל/כ + שם). Any other frequent prefix form is left alone (see the build's NOPREFIX).
export const PREFIX_REVIEWED = Object.freeze([
  'והכא', 'והתם', 'דהכא', 'דהתם', 'ואיכא', 'ומאי', 'והני', 'ואידך', 'דאורייתא', 'בעלמא', 'דעלמא', 'לעלמא', 'וסבר', 'וחדא', 'ולית',
  'ואכתי', 'וממאי', 'ופלגא', 'דאיסורא', 'ואנן', 'ואיידי', 'ומנא', 'והיכי', 'ואזל', 'ביומא', 'ותרי', 'ואייתי', 'במיא', 'דגברא', 'דמילתא',
  'דיומא', 'לאיסורא', 'דדהבא', 'דמצי', 'באיסורא', 'באורתא', 'לאורתא', 'ואיתמר', 'למילתא', 'דמלכותא', 'דחיטי', 'ברובא',
  'ותרתי', 'ורחמנא', 'ואיהו', 'דכיתנא', 'ואית', 'דאתא', 'ואתא', 'וא״ל', 'וא״ר', 'ות״ש',
]);

// 5. Entries found wrong or unhelpful in review (key → why). Nothing is shown for them.
export const EXCLUDED = Object.freeze([
  { key: 'דהך', why: 'In the Gemara ד + הך ("of that"), not the Targum\'s "scorn".' },
  { key: 'אניס', why: 'In the Gemara "compelled" (אָנִיס); the source\'s gloss is another word.' },
  { key: 'ותא', why: 'In the Gemara mostly ו + תא ("and come").' },
  { key: 'דנח', why: 'In the Gemara mostly ד + נח ("that rested").' },
  { key: 'יינן', why: 'An alias of another verb; in the Gemara יינן is wine.' },
  { key: 'גדיל', why: 'Two unrelated senses; the Gemara\'s is neither.' },
  { key: 'גרס', why: 'In Rashi "reads (the text so)", not "learned by heart".' },
  { key: 'מקשי', why: 'In the Gemara "asks, raises a difficulty" (verb), not "one who asks".' },
]);
