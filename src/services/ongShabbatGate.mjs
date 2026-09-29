// The quality gate for the עונג שבת question layer (src/data/ongShabbatQa.mjs). Pure, offline, deterministic: the
// drafting script (scripts/halacha/ong-shabbat/verify.mjs) and the tests run the same checks.
//
// Three layers never mix: the book's exact words (excerpt, shown as "לשון הספר"), the derived short answer
// ("תשובה קצרה", which may say nothing the book does not say and never states more certainty than the book), and the
// plain explanation (never shown as a quote). The checks below are lexical: they catch an answer that is stronger than
// its source, an answer that drops the source's conditions, and a technology-dependent item published without its note.
// They do not prove that an answer is right; that is the book's text beside it, and a rabbinic reviewer.

export const CURRENTNESS = Object.freeze({
  STABLE: 'STABLE_CLASSICAL_RULE',
  LIKELY: 'LIKELY_CURRENT',
  TECH: 'TECHNOLOGY_REVIEW_NEEDED',
  REALITY: 'REALITY_DEPENDENT',
  HIGH_STAKES: 'HIGH_STAKES_REVIEW',
});
export const CURRENTNESS_VALUES = Object.freeze(Object.values(CURRENTNESS));

// How a record is shown. A flag, not a ruling.
export const PUBLICATION = Object.freeze({
  FROM_BOOK: 'from-book',                 // short answer beside the book's exact words
  FROM_BOOK_TECH: 'from-book-tech-note',  // the same, with a note that devices may have changed since תשע״ג
  SOURCE_ONLY: 'source-only-rabbi',       // the book's words only; no derived answer; a rabbi for the personal case
});

export const TECH_NOTE = 'הספר נכתב בשנת תשע״ג, וייתכן שהטכנולוגיה או המציאות השתנו מאז. מומלץ לברר עם רב לגבי מכשירים בני זמננו.';
export const HIGH_STAKES_NOTE = 'בשאלות של חולה, יולדת, תרופות ותינוקות אין כאן הכרעה למקרה אישי: לשון הספר מובאת כלשונה, ולהכרעה פונים לרב.';
// The only "short answer" a high-stakes record carries: where to go, never what to do.
export const HIGH_STAKES_ANSWER = 'לשון הספר מובאת כאן כלשונה. במקרה אישי של חולה, יולדת או תרופה — פונים לרב.';

const plain = value => String(value || '').normalize('NFKD').replace(/[֑-ׇ]/g, '').replace(/[״"׳'`’”]/g, '').replace(/\s+/g, ' ').trim();
const H = '[\\u05D0-\\u05EA]';
// A word (with up to two one-letter proclitics) from a family of forms.
const family = forms => new RegExp(`(?<!${H})(?:[והבלמשכ]{0,2})(?:${forms.join('|')})(?!${H})`);

// Strong words: a derived answer may use one only when the book's own words use the same family.
export const STRONG = Object.freeze({
  forbidden: family(['אסור', 'אסורה', 'אסורים', 'אסורות', 'איסור', 'נאסר', 'יאסר', 'ייאסר']),
  obligated: family(['חייב', 'חייבת', 'חייבים', 'חייבות', 'חובה', 'חובת', 'מחויב', 'מחויבת', 'מחוייב', 'מחוייבת']),
  mitzvah: family(['מצוה', 'מצווה', 'מצות', 'מצוות']),
  must: family(['צריך', 'צריכה', 'צריכים', 'צריכות', 'יש לו', 'יש ל[א-ת]+', 'עליו', 'עליה']),
});
// Soft words: when the book says "טוב / ראוי / נכון / יש להחמיר / המחמיר / עדיף / מן המובחר / נוהגים", the answer
// (or its conditions) must keep that level.
export const SOFT = family(['טוב', 'ראוי', 'נכון', 'להחמיר', 'המחמיר', 'מחמיר', 'יחמיר', 'עדיף', 'רצוי', 'מובחר', 'המובחר', 'נוהגים', 'נהגו', 'נוהגות', 'מנהג', 'המנהג', 'נהוג', 'ישתדל', 'יזהר', 'ייזהר', 'יזהרו', 'חסידות', 'תבוא', 'לכתחילה', 'לכתחלה']);
// Condition markers: a source clause with one of these may not disappear from answer + conditions.
const CONDITION_CORE = family(['אם', 'כאשר', 'רק', 'אלא', 'בתנאי', 'ובלבד', 'דווקא', 'דוקא', 'כל עוד', 'כל זמן', 'מלבד', 'חוץ', 'במקום צורך', 'בשעת הצורך', 'בשעת הדחק', 'בדיעבד', 'לכתחילה', 'לכתחלה']);
const count = (pattern, text) => (plain(text).match(new RegExp(pattern.source, 'g')) || []).length;
const has = (pattern, text) => pattern.test(plain(text));

// An answer stronger than its source: a strong word the book's words do not have; "מותר" turned into "מצוה"; a soft
// level ("טוב", "ראוי", "יש להחמיר") dropped.
export function strengthIssues({ shortAnswer = '', conditions = [], excerpt = '', unitText = '' }) {
  const issues = [];
  const answer = [shortAnswer, ...conditions].join(' ');
  for (const [name, pattern] of Object.entries(STRONG)) {
    if (name === 'must') continue;
    if (has(pattern, shortAnswer) && !has(pattern, excerpt) && !has(pattern, unitText)) issues.push(`the answer says "${name}" but the book's words do not`);
    else if (has(pattern, shortAnswer) && !has(pattern, excerpt)) issues.push(`the answer says "${name}"; the quoted excerpt does not (quote the words that do)`);
  }
  if (has(STRONG.mitzvah, shortAnswer) && has(family(['מותר', 'מותרת', 'מותרים']), excerpt) && !has(STRONG.mitzvah, excerpt)) issues.push('"מותר" in the book became "מצוה" in the answer');
  if (has(SOFT, excerpt) && !has(SOFT, answer)) issues.push('the book\'s level (טוב / ראוי / נכון / יש להחמיר / נוהגים / לכתחילה) is missing from the answer and its conditions');
  if (/(?:^|\s)(?:חובה|חייבים|אסור בהחלט|בשום אופן)(?:\s|$)/.test(plain(shortAnswer)) && has(SOFT, excerpt) && !has(STRONG.forbidden, excerpt) && !has(STRONG.obligated, excerpt)) issues.push('a soft source was hardened');
  return issues;
}

// A condition in the book's words that the answer and its conditions both drop.
export function conditionIssues({ shortAnswer = '', conditions = [], excerpt = '' }) {
  const issues = [];
  const answer = [shortAnswer, ...conditions].join(' ');
  const inSource = count(CONDITION_CORE, excerpt);
  if (inSource > 0 && count(CONDITION_CORE, answer) === 0 && !conditions.length) issues.push('the book states a condition (אם / רק / אלא / בתנאי / ובלבד / לכתחילה / בדיעבד…) that the answer and its conditions drop');
  if (inSource >= 3 && !conditions.length && count(CONDITION_CORE, answer) < 2) issues.push('the book states several conditions; list them in "conditions"');
  return issues;
}

// Modern devices: a record about one of these is never published as a stable rule.
export const MODERN_DEVICE = family(['חשמל', 'חשמלי', 'חשמלית', 'חשמליות', 'החשמל', 'מקרר', 'המקרר', 'שעון שבת', 'השעון שבת', 'חיישן', 'אלקטרוני', 'אלקטרונית', 'מזגן', 'המזגן', 'מאוורר', 'מעלית', 'טלפון', 'פלאפון', 'אינטרקום', 'מצלמה', 'מצלמת', 'מצלמות', 'סוללה', 'סוללות', 'טלוויזיה', 'רדיו', 'מכשיר שמיעה', 'כרטיס', 'טביעת אצבע', 'פי אס', 'מכונת כביסה', 'מדיח', 'בוילר', 'דוד שמש', 'אינוורטר', 'אזעקה', 'שלט רחוק', 'מייבש', 'מדרגות נעות', 'פנס', 'פנסים', 'מנורה', 'מנורת', 'נורה', 'נורת', 'אור החשמל', 'סטרטר', 'פלורסנטית', 'רנטגן', 'אמבולנס', 'רכב', 'מונית', 'אוטובוס']);
export function techIssues({ currentness, unitText = '', excerpt = '' }) {
  if (!has(MODERN_DEVICE, excerpt)) return [];
  return [CURRENTNESS.TECH, CURRENTNESS.REALITY, CURRENTNESS.HIGH_STAKES].includes(currentness) ? [] : ['the quoted words are about a modern device; mark TECHNOLOGY_REVIEW_NEEDED (or REALITY_DEPENDENT)'];
}

// Illness, medicine, childbirth, infants' health, danger, travel to a doctor or a hospital.
export const HIGH_STAKES_WORDS = family(['חולה', 'חולים', 'תרופה', 'תרופות', 'רפואה', 'רופא', 'רופאה', 'יולדת', 'לידה', 'צירים', 'צירי', 'סכנה', 'פיקוח נפש', 'בית החולים', 'בית חולים', 'אמבולנס', 'חום גבוה', 'זריקה', 'זריקת', 'גלולה', 'כדורים', 'כדורי', 'משככי', 'אקמול', 'אספירין', 'אנטיביוטיות', 'פצע', 'מכה', 'דם', 'נשך', 'נשכו', 'הכישו', 'נעקץ', 'פג']);
const HIGH_STAKES_CHAPTERS = new Set([20, 21]);
export function highStakesIssues({ currentness, chapter, excerpt = '' }) {
  if (HIGH_STAKES_CHAPTERS.has(chapter) && currentness !== CURRENTNESS.HIGH_STAKES) return ['chapters כ׳ (חולה) and כ״א (יולדת) are HIGH_STAKES_REVIEW'];
  return [];
}
// Outside chapters כ׳–כ״א a medical word is a warning to look again, not an error (a baby's bath is not medical).
export const highStakesWarnings = ({ currentness, chapter, excerpt = '' }) => (!HIGH_STAKES_CHAPTERS.has(chapter) && currentness !== CURRENTNESS.HIGH_STAKES && has(HIGH_STAKES_WORDS, excerpt) ? ['medical or danger words in the excerpt: is this HIGH_STAKES_REVIEW?'] : []);

export function publicationFor(currentness) {
  if (currentness === CURRENTNESS.HIGH_STAKES) return PUBLICATION.SOURCE_ONLY;
  if (currentness === CURRENTNESS.TECH || currentness === CURRENTNESS.REALITY) return PUBLICATION.FROM_BOOK_TECH;
  return PUBLICATION.FROM_BOOK;
}

// Everything the gate says about one record: errors block publication.
export function gate(record, { unitText = '', notesText = '', chapter = null } = {}) {
  const errors = [];
  const excerpt = record.excerpt || '';
  if (!excerpt || !unitText.includes(excerpt)) errors.push('the excerpt is not a verbatim span of the halacha');
  if (!CURRENTNESS_VALUES.includes(record.currentness)) errors.push(`unknown currentness ${record.currentness}`);
  if (record.currentness !== CURRENTNESS.HIGH_STAKES) {
    errors.push(...strengthIssues({ ...record, unitText }), ...conditionIssues(record), ...techIssues({ ...record, unitText, excerpt }));
  }
  errors.push(...highStakesIssues({ ...record, chapter, excerpt }));
  if (record.explanation) {
    for (const [name, pattern] of Object.entries(STRONG)) if (name !== 'must' && has(pattern, record.explanation) && !has(pattern, `${unitText} ${notesText}`)) errors.push(`the explanation says "${name}" but the book's words (halacha and its notes) do not`);
  }
  const warnings = highStakesWarnings({ ...record, chapter, excerpt });
  if (record.currentness !== CURRENTNESS.HIGH_STAKES && has(SOFT, unitText) && !has(SOFT, [record.shortAnswer, ...(record.conditions || [])].join(' '))) warnings.push('the halacha has a soft level (טוב / ראוי / המחמיר…) outside the excerpt: does the answer need it?');
  return { errors, warnings };
}
