import { writeFileSync } from 'node:fs';
const { YALKUT_YOSEF } = await import('/Users/nitz/.cline/data/workspaces/chat/kazzohar-harakia/src/data/yalkutYosef.mjs');
const S = new Map(YALKUT_YOSEF.sections.map(s => [s.id, s]));
const span = (id, from, to) => { const t = S.get(id).text; const a = t.indexOf(from); const b = t.indexOf(to, a); if (a < 0 || b < 0) throw new Error(`${id}: ${from} / ${to}`); return t.slice(a, b + to.length); };
const E = (o) => ({ variants: [], tags: [], askedOn: [], ...o });
const out = [
  E({ id: 'hal-moed-chm-yaale-amida', sectionId: 'yalkut-yosef-25-57-1', excerpt: span('yalkut-yosef-25-57-1', 'ואם לא אמר יעלה ויבא', 'לערבית.'),
    question: 'שכחתי יעלה ויבוא בעמידה בחול המועד – מה עושים?', shortAnswer: "אם אמרת 'ברוך אתה ה'' לפני החתימה – אומרים 'למדני חוקיך' וחוזרים לרצה; אם חתמת 'המחזיר' – אומרים יעלה ויבוא לפני מודים; אם התחלת מודים – חוזרים לרצה; ואם סיימת 'יהיו לרצון' השני – חוזרים לראש.",
    variants: ['יעלה ויבוא חול המועד', 'שכחתי יעלה ויבוא חוה"מ', 'נזכרתי באמצע העמידה יעלה ויבוא'], ruleType: 'din', topic: 'חול המועד', subtopic: 'יעלה ויבוא', tags: ['יעלה ויבוא', 'חול המועד', 'עמידה', 'טעות בתפילה'], contexts: ['chol-hamoed'] }),
  E({ id: 'hal-moed-yt-birkat-yaale', sectionId: 'yalkut-yosef-25-57-3', excerpt: span('yalkut-yosef-25-57-3', 'ביום טוב ובחול המועד מזכירין', '[לאנשים בלבד].'),
    question: 'שכחתי יעלה ויבוא בברכת המזון ביום טוב או בחול המועד – חוזרים?', shortAnswer: 'אינו חוזר, חוץ מליל יום טוב ראשון של פסח (גם לנשים) וליל יום טוב של סוכות (לגברים בלבד).',
    variants: ['יעלה ויבוא ברכת המזון יום טוב', 'שכחתי יעלה ויבוא בברכת המזון בחול המועד', 'ברכת המזון בחג שכחתי'], ruleType: 'din', topic: 'הלכות יום טוב', subtopic: 'ברכת המזון', tags: ['יעלה ויבוא', 'ברכת המזון', 'יום טוב', 'חול המועד'], contexts: ['yom-tov', 'chol-hamoed', 'pesach', 'sukkot', 'meal'] }),
  E({ id: 'hal-brachot-yt-birkat-fix', sectionId: 'yalkut-yosef-15-7-10', excerpt: span('yalkut-yosef-15-7-10', 'טעה ולא אמר יעלה ויבא', 'מקדש ישראל והזמנים.'),
    question: 'איך מתקנים כששכחתי יעלה ויבוא בברכת המזון ביום טוב?', shortAnswer: "אם נזכרת אחרי 'ברוך אתה ה'' ולפני 'בונה ירושלים' – אומרים 'למדני חוקיך' וחוזרים ליעלה ויבוא; ואם כבר סיימת 'בונה ירושלים' – אומרים בשם ומלכות 'אשר נתן ימים טובים לעמו ישראל' וכו'.",
    variants: ['למדני חוקיך ברכת המזון', 'אשר נתן ימים טובים', 'נזכרתי בברכת המזון ביום טוב'], ruleType: 'din', topic: 'ברכת המזון', subtopic: 'טעויות בברכת המזון', tags: ['ברכת המזון', 'יום טוב', 'יעלה ויבוא', 'למדני חוקיך'], contexts: ['yom-tov', 'meal'] }),
  E({ id: 'hal-moed-omer-doubt', sectionId: 'yalkut-yosef-25-56-28', excerpt: span('yalkut-yosef-25-56-28', 'מי שנסתפק אם ספר העומר', 'מכאן ולהבא בברכה'),
    question: 'לא בטוח אם ספרתי ספירת העומר אתמול – ממשיכים בברכה?', shortAnswer: 'מי שמסופק אם ספר אתמול (ולא השלים ביום את הספירה) – ממשיך לספור מכאן והלאה בברכה.',
    variants: ['ספק אם ספרתי עומר', 'לא זוכר אם ספרתי אתמול', 'ספירת העומר ספק'], ruleType: 'din', topic: 'ספירת העומר', subtopic: 'שכחה וספק', tags: ['ספירת העומר', 'ספק', 'ברכה'], contexts: ['omer'], timeOfDay: 'night' }),
  E({ id: 'hal-chag-hamelech-hamishpat', sectionId: 'yalkut-yosef-29-20-10', excerpt: span('yalkut-yosef-29-20-10', 'ואם נזכר לאחר תוך כדי דבור', 'וממשיך כל הברכות שלאחריה'),
    question: "אמרתי 'מלך אוהב צדקה ומשפט' במקום 'המלך המשפט' – מה עושים?", shortAnswer: "אם נזכרת אחרי שעבר 'תוך כדי דיבור', אפילו אחרי כמה ברכות – חוזרים לברכת 'השיבה', חותמים 'המלך המשפט' וממשיכים משם על הסדר.",
    variants: ['שכחתי המלך המשפט', 'מלך אוהב צדקה ומשפט בעשרת ימי תשובה', 'המלך המשפט טעות'], ruleType: 'din', topic: 'עשרת ימי תשובה', subtopic: 'טעויות בתפילה', tags: ['המלך המשפט', 'עשרת ימי תשובה', 'טעות בתפילה'], contexts: ['aseret-yemei-teshuva'] }),
  E({ id: 'hal-chag-finished-without-hamelech', sectionId: 'yalkut-yosef-29-20-11', excerpt: span('yalkut-yosef-29-20-11', 'אם רק לאחר שסיים תפלתו', "תפלת נדבה''."),
    question: "סיימתי את העמידה ורק אז נזכרתי שלא אמרתי 'המלך הקדוש' או 'המלך המשפט' – מה עושים?", shortAnswer: "חוזרים ומתפללים, ומתנים: אם אני חייב – זו תפילת חובה, ואם לא – תהיה תפילת נדבה. כך גם מי שמסופק אם אמר.",
    variants: ['סיימתי תפילה בלי המלך הקדוש', 'ספק אם אמרתי המלך המשפט', 'חוזר ומתפלל בתנאי נדבה'], ruleType: 'din', topic: 'עשרת ימי תשובה', subtopic: 'טעויות בתפילה', tags: ['המלך הקדוש', 'המלך המשפט', 'תפילת נדבה', 'עשרת ימי תשובה'], contexts: ['aseret-yemei-teshuva'] }),
  E({ id: 'hal-brachot-mezonot-on-bread', sectionId: 'yalkut-yosef-12-2-22', excerpt: span('yalkut-yosef-12-2-22', 'מי שטעה ובירך על הלחם', 'וחייב לחזור ולברך.'),
    question: 'בירכתי מזונות על לחם ולא תיקנתי מיד – יצאתי?', shortAnswer: "יש בזה מחלוקת: לדעת הריטב\"א לא יצא, ויש אומרים שיצא. אבל אם בירך על הלחם 'בורא פרי העץ' – לא יצא לכל הדעות, וחוזר ומברך.",
    variants: ['בירכתי מזונות במקום המוציא', 'שהכל על לחם', 'ברכה לא נכונה על לחם'], ruleType: 'machloket', topic: 'ברכת המוציא ומזונות', subtopic: 'טעות בברכה', tags: ['המוציא', 'מזונות', 'טעות בברכה', 'לחם'], contexts: ['meal'] }),
  E({ id: 'hal-bayit-dairy-spoon-old-meat-pot', sectionId: 'yalkut-yosef-41-14-16', excerpt: span('yalkut-yosef-41-14-16', 'קדירה של בשר שאינה בת יומא', 'לאחר שהותר.'),
    question: 'כף חלבית שהשתמשו בה היום נכנסה לסיר בשרי ישן שמבשלים בו מים או ירקות – מה הדין?', shortAnswer: 'לכתחילה צריך להגעיל את הסיר, אבל בערב שבת ובשעת הדחק אפשר להקל ולבשל בו, והתבשיל שנשאר ממנו מותר גם בימי החול.',
    variants: ['כפית חלבית בסיר בשרי', 'כף חלבית נכנסה לסיר של בשר', 'תחבו כף חלבית בקדרה בשרית'], ruleType: 'din', topic: 'בשר וחלב', subtopic: 'כלים', tags: ['בשר וחלב', 'כלים', 'הגעלה', 'בת יומא'], contexts: ['home', 'friday'] }),
];
for (const e of out) if (e.excerpt.length > 400) console.log('LONG', e.id, e.excerpt.length);
writeFileSync(new URL('./out-G.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('wrote', out.length, out.map(e => `${e.id}:${e.excerpt.length}/${e.shortAnswer.length}`).join(' '));
