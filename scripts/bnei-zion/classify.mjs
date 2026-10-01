// Stage 4 — classification. Every article gets its parashot / festivals / special Shabbatot, conservative topics, a content
// type, a length band, a reading time, the Hebrew year of its issue, the author's full heading and a short title.
//   • The issue's own header ("פרשת השבוע: צו-פסח (שבת הגדול)") is the first witness, the archive folder the second; when
//     they disagree the header wins and the change is recorded (the archive was sorted by file name only).
//   • A combined issue (נשא-שבועות, מקץ (חנוכה), a כי תשא issue filed under פורים …) is SEPARATED article by article: what
//     does this article quote and speak of? Quotations are located in the Torah text (torahLocator.mjs: the parasha's
//     verses, the festival's readings and megillah) and the festival's own vocabulary is counted. Filed under the parasha
//     only, the festival only, or both when it genuinely belongs to both; a piece with no signal follows its issue.
//   • A special Shabbat is added when the article speaks of it; the regular parasha is never removed.
//   • Topics need repeated, specific wording; none is better than a wrong one.
//   • Title: a short title (2–6 words) cut from the author's own words — the key phrase of the heading's quotation, or
//     the heading itself when short, or the opening words; the heading line stays, exact, as `heading`.
// Usage: node scripts/bnei-zion/classify.mjs
import { DOUBLE_PARASHOT, HOLIDAY_FOLDERS, PARASHA_SLUGS, PARASHOT, parashaOf, paths, readJson, readMinutes, stripPoints, wordCount, writeJson } from './lib.mjs';
import { locate, parashaVocabulary } from './torahLocator.mjs';

const HOLIDAY_NAMES = [
  ['seventh-pesach', /שביעי של פסח/], ['pesach-sheni', /פסח שני/], ['pesach', /פסח(?! שני)/], ['shavuot', /שבועות|חג מתן תורה/],
  ['rosh-hashana', /ראש השנה(?! לאילנות)/], ['yom-kippur', /יום הכי?פורים|יום כי?פור/], ['simchat-torah', /שמחת תורה/], ['shmini-atzeret', /שמיני עצרת/],
  ['hoshana-rabba', /הושענא רבה/], ['sukkot', /סוכות|סכות/], ['chanukah', /חנוכה/], ['tu-bishvat', /ט"ו בשבט|טו' בשבט|טו בשבט|ראש השנה לאילנות/], ['purim', /(?<![כי])פורים/],
  ['lag-baomer', /ל"ג בעומר/], ['elul', /חו?דש אלול|ימי אלול|(?<![א-ת])אלול(?![א-ת])/], ['tisha-bav', /תשעה באב|ט' באב/], ['three-weeks', /בין המצרים|שלשת השבועות|י"ז בתמוז/],
];
const SPECIAL_NAMES = [
  ['shabbat-hagadol', /שבת הגדול/], ['shabbat-zachor', /שבת זכור/], ['shabbat-shekalim', /שבת שקלים/], ['shabbat-parah', /שבת פרה/],
  ['shabbat-hachodesh', /שבת החו?דש/], ['shabbat-shuva', /שבת שובה|שבת תשובה/], ['shabbat-chazon', /שבת חזון/], ['shabbat-nachamu', /שבת נחמו/],
];
// What an article about the special Shabbat speaks of.
const SPECIAL_WORDS = {
  'shabbat-zachor': /עמלק|זכור את אשר עשה|מחיית עמלק/g, 'shabbat-shekalim': /שקלים|מחצית השקל|מחצית השקל/g, 'shabbat-parah': /פרה אדומה|פרה/g,
  'shabbat-hachodesh': /החו?דש הזה לכם|ראש חו?דש ניסן|קידוש החו?דש|חו?דש ניסן/g, 'shabbat-hagadol': /שבת הגדול/g,
  'shabbat-shuva': /שובה ישראל|תשובה/g, 'shabbat-chazon': /חזון ישעיהו|חורבן|תשעה באב|איכה/g, 'shabbat-nachamu': /נחמו|נחמה/g,
};
const VEZOT_WORDS = /וזאת הברכה|ברכת משה|ברכותיו של משה|אשר ברך משה|פטירת משה|פטירתו של משה|מיתת משה|וימת שם משה|סיום התורה|מסיימים את התורה|חתן תורה|לעיני כל ישראל|ולא קם נביא עוד/;
const TU_BISHVAT_WEEKS = ['בא', 'בשלח', 'יתרו'];
const TU_BISHVAT_WORDS = /ט"ו בשבט|טו' בשבט|טו בשבט|ט'ו בשבט|חמשה עשר בשבט|ט"ו בשבת|ראש השנה לאילנות|כי האדם עץ השדה|ראש השנה לאילן/;
// Words that show an article speaks of the festival itself.
const HOLIDAY_WORDS = {
  pesach: /פסח|ארבעת הבנים|מה נשתנה|מצה|מצות|חמץ|הגדה|ליל הסדר|יציאת מצרים|ארבע כוסות|אפיקומן|מרור|קרבן פסח|קריעת ים סוף|גאולת מצרים/g,
  'seventh-pesach': /שביעי של פסח|קריעת ים סוף|שירת הים|אז ישיר/g,
  shavuot: /שבועות|מתן תורה|קבלת התורה|מעמד הר סיני|ביכורים|בכורים|מגילת רות|רות המואביה|תיקון ליל|עצרת|ספירת העומר|דוד המלך/g,
  sukkot: /סוכות|סכות|סוכה|ארבעת המינים|ארבעה מינים|לולב|אתרוג|ושמחת בחגך|ענני הכבוד|אושפיזין/g, 'simchat-torah': /שמחת תורה|הקפות|חתן תורה|חתן בראשית|סיום התורה/g,
  'rosh-hashana': /ראש השנה|שופר|יום הדין|תקיעת|מלכויות/g, 'yom-kippur': /יום הכי?פורים|יום כי?פור|כפרה|וידוי|תענית|סליחה ומחילה|נעילה|כהן הגדול|כהן גדול|עבודת הכהן|קודש הקדשים|סליחות|גדולה תשובה|תשובה/g,
  chanukah: /חנוכה|חנכה|חשמונאי|נרות|פך השמן|פך שמן|מתתיה|יוונים|היוונים|יון הרשעה|מלכות יון|ועל הנסים|טמאים ביד טהורים|גבורים ביד חלשים|יוחנן כהן גדול|שמונה ימים|להדליק נר|(?<![א-ת])יון(?![א-ת])|היונים|יונים/g, purim: /(?<![כי])פורים|מגילת אסתר|קריאת המגילה|המגילה|מרדכי|אסתר המלכה|המן הרשע|המן האגגי|משלוח מנות|מתנות לאביונים|ונהפוך הוא/g,
  'tu-bishvat': /ט"ו בשבט|טו בשבט|ראש השנה לאילנות|פירות|אילן/g,
};

// Topics: [name, pattern] — counted on the unpointed text; at least `min` hits, or the topic's words in the title.
const TOPICS = [
  ['אמונה', /אמונה|אמונת|מאמין|להאמין|האמינו/g, 3], ['ביטחון', /בטחון|ביטחון|בוטח|לבטוח|בטח בה|הבוטח/g, 2],
  ['תפילה', /תפילה|תפלה|תפילת|תפלת|תפילות|מתפלל|להתפלל|התפלל|תפלתו|תפילתו/g, 3], ['שבת', /שבת(?! שלום)|שבתות|מחלל שבת|שמירת שבת|קידוש/g, 4],
  ['חינוך ילדים', /חינוך הילדים|חינוך ילד|לחנך את|חינוך הבנים|חינוך צאצא|מחנך את בניו/g, 1], ['שלום בית', /שלום בית/g, 1],
  ['כיבוד הורים', /כיבוד אב|כבוד אב|כבד את אביך|כיבוד הורים|כבוד הורים|את אביו ואת אמו/g, 1], ['חסד', /חסד|גמילות חסדים|גומל חסד|הכנסת אורחים/g, 3],
  ['צדקה', /צדקה|צדקות|לעניים|לעני|תמיכה בלומדי תורה|מעשר/g, 3], ['פרנסה', /פרנסה|פרנסתו|פרנסת|מזונות|עשירות|ממון/g, 3],
  ['מידות', /מידות|מדות|ענוה|ענווה|גאוה|גאווה|כעס|קנאה|גאותו/g, 3], ['שמירת הלשון', /לשון הרע|רכילות|שמירת הלשון|אבק לשון|מוציא שם רע/g, 1],
  ['תשובה', /חזרה בתשובה|חוזר בתשובה|לחזור בתשובה|בעל תשובה|בעלי תשובה|עשרת ימי תשובה|תשובה שלמה|עשה תשובה|לעשות תשובה|שב בתשובה|תשובה מאהבה|תשובה מיראה/g, 1],
  ['שמחה', /שמחה|בשמחה|שמחת|לשמוח|שמח/g, 4], ['אהבת ישראל', /אהבת ישראל|ואהבת לרעך|אחדות|אהבת חברים|אהבת הבריות/g, 1],
  ['תורה', /עסק התורה|לימוד התורה|לימוד תורה|תלמוד תורה|לומדי תורה|ללמוד תורה|בעמלה של תורה|עמל התורה|לומד תורה/g, 2],
  ['מצוות', /קיום המצוות|קיום המצות|תרי"ג מצות|תרי"ג מצוות|מצוה גוררת מצוה|שכר מצוה/g, 1],
  ['יראת שמים', /יראת שמים|יראת ה'|יראת חטא|ירא שמים|יראי ה'/g, 1], ['גאולה', /גאולה|הגאולה|לגאולה|משיח|ביאת המשיח|בית המקדש השלישי/g, 3],
  ['ניסיונות', /נסיון|ניסיון|נסיונות|ניסיונות|יסורים|ייסורים/g, 2], ['הכרת הטוב', /הכרת הטוב|הכרת טובה|כפוי טובה|כפיות טובה|להודות לה'/g, 1],
];

const SINGLE = new Set(PARASHOT);
const isHeb = ch => /[\u05D0-\u05EA]/.test(ch || '');
// The occasion part of a header label: before the motto (the first quotation that is not an acronym's gershayim),
// without the site address and dedications.
export function labelCore(label) {
  let t = stripPoints(label || '').replace(/^\s*["״]+/, '');
  t = t.replace(/(?:bnei-zion|http|www\.|לעילו|לע"נ|לרפואת|להצלחת).*$/, '');
  for (let i = 0; i < t.length; i += 1) if ('"״'.includes(t[i]) && !(isHeb(t[i - 1]) && isHeb(t[i + 1]))) { t = t.slice(0, i); break; }
  return t.trim();
}
export function parseLabel(label) {
  const out = { parashot: [], holidays: [], special: [] };
  const core = labelCore(label);
  if (!core) return out;
  for (const [id, re] of HOLIDAY_NAMES) if (re.test(core) && !out.holidays.includes(id)) out.holidays.push(id);
  if (out.holidays.includes('seventh-pesach') && !out.holidays.includes('pesach')) out.holidays.push('pesach');
  if (out.holidays.includes('simchat-torah') && out.holidays.includes('sukkot')) { /* סוכות-שמחת תורה: both */ }
  for (const [id, re] of SPECIAL_NAMES) if (re.test(core)) out.special.push(id);
  const words = core.replace(/\([^)]*\)/g, ' ').replace(/שבת\s+\S+/g, ' ').split(/[\s\-–־/,]+/).filter(Boolean);
  for (let i = 0; i < words.length; i += 1) {
    const two = i + 1 < words.length ? parashaOf(`${words[i]} ${words[i + 1]}`) : null;
    if (two) { if (!out.parashot.includes(two)) out.parashot.push(two); i += 1; continue; }
    const one = parashaOf(words[i]);
    if (one && SINGLE.has(one)) { if (!out.parashot.includes(one)) out.parashot.push(one); }
  }
  return out;
}

const count = (re, text) => (text.match(new RegExp(re.source, 'g')) || []).length;

// ---- short titles ---------------------------------------------------------------------------------------------------
const FUNCTION_WORDS = new Set(['של', 'את', 'על', 'אל', 'כי', 'אשר', 'עם', 'מן', 'לא', 'הוא', 'היא', 'כל', 'אם', 'גם', 'או', 'זה', 'זו', 'אין', 'יש', 'בין', 'עד', 'לו', 'לה', 'לי', 'לך', 'לכם', 'הם', 'ה\'', 'וכו\'', 'ו', 'ב', 'ל', 'מ', 'כ', 'ש', 'ה', 'אף', 'רק', 'אך', 'כן', 'לפני', 'אחרי', 'תחת', 'אלא', 'שלא', 'מה', 'מי', 'כמו', 'ועל', 'ואת', 'ואל', 'וכל', 'וגם', 'ולא']);
export const cleanTitle = t => t.replace(/(^|\s)['׳]([א-ת"]+)['׳](?=[\s,.:;-]|$)/g, '$1$2').replace(/\([^)]*\)?/g, ' ').replace(/\(=[^)]*\)/g, ' ').replace(/[“”"״]/g, '').replace(/\.{2,}|…/g, ' … ')
  .replace(/\s+/g, ' ').trim();
export function cutPhrase(text, max = 5) {
  // Stop at a clause boundary within the first words, else take `max` words; never end on a function word.
  const parts = text.split(/\s*(?:…|[,;:.!?]|\s-\s|\s–\s)\s*/).map(x => x.trim()).filter(Boolean);
  // A verse's speech formula ("ויאמר ה' אל משה") is not its message: start after it when enough remains.
  const lead = /^(?:ויאמר|ויאמרו|וידבר|ויקרא|ויצו|ויען|ויהי)(?:\s+(?:ה['׳]|יהוה|אלהים|אלקים|משה|אהרן|יעקב|פרעה|יוסף|העם))?(?:\s+אל\s+\S+)?(?:\s+לאמר)?\s+/;
  if (lead.test(parts[0] || '') && (parts[0] || '').replace(lead, '').split(' ').length >= 2) parts[0] = parts[0].replace(lead, '');
  let words = (parts[0] || text).split(' ').filter(Boolean);
  // A one- or two-word opening clause ("גדולה צדקה,", "עמי,", "בני...") reads better with the clause that completes it.
  for (let k = 1; words.length <= 2 && k < parts.length; k += 1) words = [...words, ...parts[k].split(' ').filter(Boolean)];
  words = words.slice(0, words.length <= 6 ? 6 : max);
  const all = (parts[0] || text).split(' ').filter(Boolean);
  while (words.length > 2 && (FUNCTION_WORDS.has(words.at(-1)) || words.at(-1).length < 2)) words.pop();
  // Never cut "הקדוש ברוך הוא" in two.
  if (/^(?:הקדוש|ברוך)$/.test(words.at(-1) || '')) { const k = all.indexOf('הוא', words.length - 1); if (k > 0 && k < 7) words = all.slice(0, k + 1); else while (words.length > 2 && /^(?:הקדוש|ברוך)$/.test(words.at(-1))) words.pop(); }
  return words.join(' ').replace(/^['׳]+|(?<=[^א-ת])['׳]+$|^['׳](?=[א-ת]+['׳]$)/g, '').replace(/^(.+)['׳]$/, (m, w) => (/(?:^|\s)[א-ת]{1,2}$/.test(w) ? m : w)).trim();
}
export function shortTitle(heading, paragraphs) {
  const h = stripPoints(heading || '').trim();
  if (h) {
    // The quotation the heading opens with (closing mark: a quote not inside an acronym).
    let quote = null;
    const open = h.search(/["״“]/);
    if (open >= 0 && open < 4) {
      for (let i = open + 1; i < h.length; i += 1) if ('"״”'.includes(h[i]) && !(isHeb(h[i - 1]) && isHeb(h[i + 1]))) { quote = h.slice(open + 1, i); break; }
    }
    const base = cleanTitle(quote && quote.split(' ').length >= 2 ? quote : h.replace(/\s*\((?:על פי|ע"פ|עפ"י|מתוך)[^)]*\)\s*$/, ''));
    const t = base && cutPhrase(base);
    if (t && /[א-ת]{2}/.test(t)) return { title: t, titleSource: quote ? 'heading-quotation' : 'heading' };
  }
  const first = cleanTitle(stripPoints(paragraphs[0] || ''));
  return { title: cutPhrase(first, 5), titleSource: 'opening-words' };
}

export function classifyArticle(a) {
  const folderName = a.folder.split('/').at(-1);
  const fromFolder = { parashot: [], holidays: [], special: [] };
  if (a.folder.startsWith('01_')) fromFolder.parashot = DOUBLE_PARASHOT[folderName] || [parashaOf(folderName)].filter(Boolean);
  if (a.folder.startsWith('02_')) { const h = HOLIDAY_FOLDERS[folderName] || {}; fromFolder.holidays = h.holidays || []; fromFolder.special = h.special || []; }
  const fromHeader = parseLabel(a.issue.parashaLabel);
  const headerHas = fromHeader.parashot.length || fromHeader.holidays.length;
  const base = headerHas ? { ...fromHeader } : { ...fromFolder };
  const notes = [];
  const sameSet = (x, y) => x.length === y.length && x.every(v => y.includes(v));
  if (headerHas && (!sameSet(fromHeader.parashot, fromFolder.parashot) || !sameSet(fromHeader.holidays, fromFolder.holidays))) notes.push(`header "${labelCore(a.issue.parashaLabel)}" refines folder "${folderName}"`);
  // A weekly issue filed under a festival's folder (a כי תשא issue in פורים): the festival is a candidate too.
  if (headerHas && fromFolder.holidays.length && !fromFolder.holidays.some(h => base.holidays.includes(h))) base.holidays = [...base.holidays, ...fromFolder.holidays];
  base.special = [...new Set([...(fromHeader.special || []), ...fromFolder.special])];
  const title = stripPoints(a.title);
  const body = stripPoints(a.paragraphs.join(' '));
  const all = `${title} ${body}`;
  let parashot = [...base.parashot];
  let holidays = [...base.holidays];
  let separation = null;
  if (parashot.length && holidays.length) {
    const tl = locate(a.title), bl = locate(`${a.title} ${a.paragraphs.join(' ')}`);
    const pScore = parashot.reduce((s, p) => s + 3 * (tl[`p:${PARASHA_SLUGS[p]}`] || 0) + Math.min(6, bl[`p:${PARASHA_SLUGS[p]}`] || 0)
      + 3 * count(new RegExp(`פרשת ${p}|בפרשתנו|פרשתנו|בפרשת השבוע`), all) + (title.includes(p) ? 3 : 0)
      + Math.min(6, parashaVocabulary(`${a.title} ${a.paragraphs.join(' ')}`, PARASHA_SLUGS[p])), 0);
    const hScore = holidays.reduce((s, h) => s + 3 * (tl[`h:${h}`] || 0) + Math.min(6, bl[`h:${h}`] || 0) + Math.min(8, HOLIDAY_WORDS[h] ? count(HOLIDAY_WORDS[h], all) : 0)
      + (HOLIDAY_NAMES.some(([id, re]) => id === h && re.test(title)) ? 6 : 0), 0);
    const holidayFolder = a.folder.startsWith('02_');
    let decision;
    if ((pScore >= 3 && pScore >= 2 * hScore) || (pScore >= 2 && hScore === 0)) decision = 'parasha';
    else if ((hScore >= 5 && hScore >= 2 * pScore) || (hScore >= 2 && pScore === 0)) decision = 'festival';
    else if (pScore >= 3 && hScore >= 5) decision = 'both';
    // No clear signal either way: the piece follows the issue's own occasion (the folder it was filed under).
    else decision = holidayFolder ? 'festival' : 'parasha';
    if (decision === 'parasha') holidays = [];
    if (decision === 'festival') parashot = [];
    const confident = (decision === 'parasha' && pScore >= 2) || (decision === 'festival' && hScore >= 2) || decision === 'both';
    separation = { decision, confident, parashaScore: pScore, festivalScore: hScore };
    notes.push(`combined issue → ${decision} (parasha ${pScore}, festival ${hScore})`);
  }
  for (const [id, re] of HOLIDAY_NAMES) if (!holidays.includes(id) && re.test(title) && !(id === 'pesach' && /פסח שני/.test(title))) { holidays.push(id); notes.push(`title names ${id}`); }
  if (holidays.includes('seventh-pesach') && !holidays.includes('pesach')) holidays.push('pesach');
  // Owner: וזאת הברכה is read on שמחת תורה — a שמחת תורה piece that speaks of the parasha (its verses, Moshe's blessing
  // or passing, finishing the Torah) is also a וזאת הברכה piece. שמחת תורה stays.
  if (holidays.includes('simchat-torah') && !parashot.includes('וזאת הברכה')) {
    const verses = locate(`${a.title} ${a.paragraphs.join(' ')}`)['p:vezot-haberakhah'] || 0;
    if (verses >= 1 || VEZOT_WORDS.test(all)) { parashot.push('וזאת הברכה'); notes.push('שמחת תורה piece about וזאת הברכה'); }
  }
  // Owner: ט״ו בשבט falls in the weeks of בא / בשלח / יתרו — a piece of those weeks that speaks of it carries it too.
  if (!holidays.includes('tu-bishvat') && parashot.some(p => TU_BISHVAT_WEEKS.includes(p)) && TU_BISHVAT_WORDS.test(all)) { holidays.push('tu-bishvat'); notes.push('piece of the ט״ו בשבט weeks about ט״ו בשבט'); }
  if (holidays.includes('pesach') && !holidays.includes('seventh-pesach') && /שביעי של פסח/.test(all)) holidays.push('seventh-pesach');
  // Special Shabbatot: the issue's, when the article speaks of it; any other only when named twice or in the title.
  const special = [];
  for (const [id, re] of SPECIAL_NAMES) {
    const named = count(re, all);
    const about = count(SPECIAL_WORDS[id], all);
    if (base.special.includes(id) ? (named >= 1 || about >= 2 || new RegExp(SPECIAL_WORDS[id].source).test(title)) : (named >= 2 || re.test(title))) special.push(id);
  }
  // Topics.
  const topics = [];
  const scored = TOPICS.map(([name, re, min]) => ({ name, n: count(re, body), inTitle: new RegExp(re.source).test(title), min })).filter(t => t.inTitle || t.n >= t.min);
  scored.sort((x, y) => (y.inTitle - x.inTitle) || (y.n / y.min) - (x.n / x.min));
  for (const t of scored.slice(0, 3)) topics.push(t.name);
  // Content type.
  const opening = body.slice(0, 400);
  const words = wordCount(a.paragraphs.join(' '));
  const minutes = readMinutes(a.paragraphs.join(' '));
  let contentType = 'dvar-torah';
  if (/משל למה הדבר דומה|(?:^|[\s"(])משל ל|והנמשל|הנמשל הוא/.test(body.slice(0, 1500)) && /נמשל/.test(body)) contentType = 'mashal';
  else if (/^(?:מעשה ב|מעשה שהיה|פעם |פעם אחת|מסופר|מספרים|סיפר |סיפור |בספר .{0,40} מסופר|היה זה ב)/.test(opening) || /מעשה ב|מעשה שהיה|סיפור/.test(title)) contentType = 'story';
  else if (/^(?:פירש|פרש|כותב|כתב|מפרש|אומר) (?:רש"י|הרמב"ן|האור החיים|הספורנו|אבן עזרא|בעל הטורים|הכלי יקר)/.test(opening) || /^על הכתוב[^.]{0,120}(?:פירש|פרש|כותב|כתב) (?:רש"י|הרמב"ן|האור החיים)/.test(opening)) contentType = 'commentary';
  else if (/חיזוק|התחזקות|אל תתייאש|אין יאוש|אין ייאוש/.test(title + opening)) contentType = 'chizuk';
  if (!parashot.length && !holidays.length && !special.length) contentType = contentType === 'dvar-torah' ? 'general' : contentType;
  const shabbatTable = (contentType === 'story' || contentType === 'mashal') && minutes <= 3;
  const length = minutes <= 3 ? 'short' : minutes >= 8 ? 'long' : 'medium';
  const year = a.issue.hebrewYearRaw || a.manifest.hebrewYear || null;
  const t = shortTitle(a.title, a.paragraphs);
  return {
    heading: a.title, title: t.title, titleSource: t.titleSource,
    parashot, holidays, specialShabbatot: special, topics, contentType, shabbatTable, length, readMinutes: minutes, words,
    hebrewYear: year ? year.replace(/["״'׳]{1,2}/, '״') : null, issueDate: a.issue.civilDate || null, classificationNotes: notes, separation,
  };
}

export function classifyAll() {
  const P = paths();
  const seg = readJson(P.stage('segment'));
  const out = seg.articles.map(a => ({ ...a, ...classifyArticle(a) }));
  writeJson(P.stage('classify'), { generatedAt: new Date().toISOString(), articles: out });
  const reclassified = out.filter(a => a.classificationNotes.some(n => n.startsWith('header'))).length;
  const sep = {};
  for (const a of out) if (a.separation) sep[a.separation.decision] = (sep[a.separation.decision] || 0) + 1;
  return { articles: out.length, reclassifiedByHeader: reclassified, combinedIssueSeparation: sep, unassigned: out.filter(a => !a.parashot.length && !a.holidays.length && !a.specialShabbatot.length).length };
}

if (import.meta.url === `file://${process.argv[1]}`) console.log('classify:', JSON.stringify(classifyAll()));
