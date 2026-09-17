export const categories = [...new Set('תפילה,ברכות,שבת,יום טוב,כשרות,בשר וחלב,תפילין,ציצית,בית הכנסת,נטילת ידיים,ברכת המזון,ברכות הנהנין,מוקצה,הבדלה,קידוש,חגים ומועדים,ספירת העומר,בין המצרים,תשעה באב,ראש השנה,יום הכיפורים,סוכות,חנוכה,פורים,פסח,בין אדם לחברו,לשון הרע,כיבוד אב ואם,צדקה,תפילת הדרך'.split(','))];
// Source links are a reading index, NOT newly authored practical rulings.
const sourceRecord = (id, title, category, reference, keywords) => ({
  id, title, category, subcategory: '', shortRuling: null, explanation: null,
  status: 'source-link', minhag: 'sephardic', distinction: 'requires-review',
  opinions: [], keywords, related: [],
  sources: [{ title: 'שולחן ערוך · אורח חיים', reference, url: `https://www.sefaria.org/Shulchan_Arukh%2C_Orach_Chayim.${reference}?lang=he`, license: 'link-only' }],
});
export const halachot = [
  sourceRecord('berachot', 'ברכות על מאכלים ומשקים', 'ברכות הנהנין', '204', ['קפה', 'מים', 'שהכל', 'ברכות']),
  sourceRecord('nefashot', 'ברכה אחרונה · בורא נפשות', 'ברכות', '207', ['בורא נפשות', 'שתייה', 'קפה']),
  sourceRecord('fruit', 'ברכות הפירות', 'ברכות הנהנין', '203', ['בננה', 'מה מברכים על בננה', 'האדמה', 'פרי']),
  sourceRecord('travel', 'תפילת הדרך', 'תפילת הדרך', '110', ['נסיעה', 'תפילת הדרך']),
  sourceRecord('muktzeh', 'דיני מוקצה', 'מוקצה', '308', ['שבת', 'מוקצה', 'טלטול']),
  sourceRecord('candles', 'הדלקת נרות שבת', 'שבת', '263', ['נרות', 'מתי נכנסת שבת']),
  sourceRecord('yaaleh', 'יעלה ויבוא בתפילת ראש חודש', 'תפילה', '422', ['יעלה ויבוא', 'ראש חודש']),
  sourceRecord('omer', 'ספירת העומר', 'ספירת העומר', '489', ['עומר', 'ברכה']),
  sourceRecord('hands', 'נטילת ידיים בשחרית', 'נטילת ידיים', '4', ['בוקר', 'ידיים']),
];
export const prayers = 'שחרית,מנחה,ערבית,קריאת שמע שעל המיטה,ברכות השחר,פסוקי דזמרה,קריאת שמע,עמידה,תחנון,הלל,מוסף,קבלת שבת,ערבית של שבת,קידוש,הבדלה,ברכת המזון,ברכות,תפילת הדרך,תפילות לאירועים מיוחדים'.split(',').map((title, i) => ({
  id: `prayer-${i}`, title, category: 'סידור', status: 'awaiting-verification', text: null,
  nusach: 'עדות המזרח', sources: [], keywords: [title, ...(title === 'עמידה' ? ['יעלה ויבוא', 'משיב הרוח', 'מוריד הטל', 'ותן טל ומטר', 'על הנסים', 'עננו'] : [])],
  additions: ['משיב הרוח ומוריד הגשם', 'מוריד הטל', 'ותן טל ומטר לברכה', 'יעלה ויבוא', 'על הנסים', 'עננו'].map(text => ({ text, rule: null, status: 'awaiting-verification' })),
}));
export function normalizeHebrew(value) {
  return String(value).normalize('NFKD').replace(/[\u0591-\u05BD\u05BF-\u05C7]/g, '').replace(/[ךםןףץ]/g, c => ({ך:'כ',ם:'מ',ן:'נ',ף:'פ',ץ:'צ'}[c])).replace(/[״׳"'־–-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}
export function matches(record, query) {
  const haystack = normalizeHebrew([record.title, record.category, ...(record.keywords || [])].join(' '));
  return normalizeHebrew(query).split(' ').filter(Boolean).every(word => haystack.includes(word));
}
export function hebrewNumber(n) {
  if (!Number.isInteger(n) || n < 1 || n > 999) return String(n);
  let result = '';
  const values = [[400,'ת'],[300,'ש'],[200,'ר'],[100,'ק'],[90,'צ'],[80,'פ'],[70,'ע'],[60,'ס'],[50,'נ'],[40,'מ'],[30,'ל'],[20,'כ']];
  for (const [value, letter] of values) while (n >= value) { result += letter; n -= value; }
  if (n === 15) return result + 'טו';
  if (n === 16) return result + 'טז';
  if (n >= 10) { result += 'י'; n -= 10; }
  return result + (n ? 'אבגדהוזחט'[n - 1] : '');
}
export const psalmIndex = Array.from({length:150}, (_, i) => ({ id: `psalm-${i+1}`, chapter: i+1, title: `תהילים ${hebrewNumber(i+1)}`, category: 'תהילים', keywords: [String(i+1), 'תהלים', 'פרק '+hebrewNumber(i+1)] }));
export const learning = [
  { title: 'הלכה יומית', description: 'לימוד באתר הלכה יומית; אין העתקת תוכן מוגן.', url: 'https://halachayomit.co.il/' },
  { title: 'דף יומי', description: 'מראה מקום לפי לוח Hebcal, כאשר זמין.', url: 'https://www.sefaria.org/topics/daf-yomi?lang=he' },
  ...['משנה יומית','רמב״ם יומי','חוק לישראל'].map(title => ({ title, description: 'מסלול בהכנה · ממתין למקור מאומת של סדר הלימוד.', url: null })),
];
