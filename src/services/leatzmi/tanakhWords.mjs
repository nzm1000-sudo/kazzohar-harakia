// מילה בהפתעה — how a verse of the bundled Tanakh (UXLC 2.5) is read into words, and which words are "meaningful".
// Shared by the generator (scripts/leatzmi/build-tanakh-surprise.mjs), the tests and the screen, so the word shown is
// always one that the verse itself contains: the letters and the nikud exactly as the text has them, only the
// te'amim (cantillation) removed.
const TEAMIM = /[֑-֯]/g;
const MARKS = /[‌‍]/g; // zero-width joiners the transcription keeps inside a few words
const LETTER = /[א-ת]/g;
const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

/** A verse as the reader shows it without te'amim: the paragraph marks {פ} {ס} and the paseq removed. */
export const verseDisplay = text => String(text || '')
  .replace(TEAMIM, '')
  .replace(/\{[פס]\}/g, '')
  .replace(/ ?׀ ?/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/** The words of a verse, te'amim removed, split at spaces and at the maqaf. Ketiv/qere words (in ( ) or [ ]) are
 *  left out: their letters and their reading differ, so neither is "the word as written and read". */
export function verseWords(text) {
  const words = [];
  for (const raw of verseDisplay(text).replace(/\((?:[^)]*)\)|\[(?:[^\]]*)\]/g, ' ').split(/[\s־]+/)) {
    const word = raw.replace(MARKS, '').replace(/[׃׃,.;:!?"'״׳]/g, '');
    if (word && /^[ְ-ׇא-ת]+$/.test(word)) words.push(word);
  }
  return words;
}

export const consonantsOf = word => (String(word).match(LETTER) || []).join('');
export const baseLetters = word => consonantsOf(word).replace(/[ךםןףץ]/g, letter => FINALS[letter]);

// Particles, pronouns, prepositions with their suffixes, and the most common verbs of speech and being — never a
// "word of the wheel" (compared on the plain letters, final forms folded).
const STOP = new Set(`אשר כי את על אל לא כל גם אם הנה עתה אתה אתם אתן אנכי אני אנחנו נחנו הוא היא הם המה הנה זאת אלה אלו לכן למה מדוע
איך איכה אין יש עוד בין תחת אחר אחרי לפני לפנים עד עם אצל מאד היה היו היתה תהיה יהיה יהיו נהיה להיות ויהי אמר לאמר אמרו אמרה
נא אף אך רק פן בלי בלתי כן ככה כה פה שם אז מה מי אלי אליו אליה אליהם אליך אליכם אלינו עלי עליו עליה עליהם עליך עליכם עלינו
לו לה להם להן לך לכם לנו לי בו בה בם בהם בך בכם בנו בי אתו אתה אותו אותה אותם אותן אתם אתך אתכם אותך אותי אתי אותנו
ממנו ממנה מהם ממך מכם ממני כמו כמוך כמוני למען יען הזה הזאת ההוא ההיא האלה ההם ההמה זה זו אשר כאשר באשר מאשר לאשר עמו עמי
עמך עמם עמהם עמנו לפניו לפניך לפני לפניהם אחריו אחריך אחריהם ביום כי אנה אנא הלא הן לולא לולי אילו אולי אפס טרם בטרם
מאת לבד לבדו אפוא איפה איפוא הלאה אחור בעבור עבור תוך בתוך מתוך כדי מפני אמרת ויאמר ותאמר ויאמרו לאמור דבר וידבר ידבר דברו ויהיו ותהי`.split(/\s+/).filter(Boolean).map(baseLetters));

const isDivineName = base => base.includes('יהוה') || /אלהי|אלוה|אלהימ/.test(base) || ['שדי', 'אדני', 'צבאות', 'יה', 'יהו', 'אל'].includes(base);

const POINT = { sheva: 'ְ', hiriq: 'ִ', tsere: 'ֵ', segol: 'ֶ', patach: 'ַ', qamats: 'ָ', dagesh: 'ּ' };
// The vowel under the first letter, and whether the second letter carries a dagesh (the signs of a prefixed letter).
function firstMarks(word) {
  const chars = [...word];
  const second = chars.findIndex((ch, index) => index > 0 && /[א-ת]/.test(ch));
  const first = chars.slice(1, second < 0 ? undefined : second).join('');
  const next = second < 0 ? '' : chars.slice(second + 1).join('').match(/^[ְ-ׇ]*/)[0];
  return { vowel: first, nextDagesh: next.includes(POINT.dagesh), nextLetter: chars[second] || '' };
}
// A word that is a shorter word with a prefixed article or preposition (הָאָרֶץ, בַּבַּיִת, לַמֶּלֶךְ, מֵהָעִיר, שֶׁ…):
// recognised by the prefix's own vowel, and only when the shorter word exists by itself.
export function looksPrefixed(word, knownBases) {
  const base = baseLetters(word);
  if (base.length < 3) return false;
  const rest = base.slice(1);
  if (!knownBases.has(rest)) return false;
  const { vowel, nextDagesh, nextLetter } = firstMarks(word);
  const has = point => vowel.includes(point);
  switch (base[0]) {
    case 'ה': return (has(POINT.patach) || has(POINT.qamats) || has(POINT.segol)) && (nextDagesh || /[אהחער]/.test(nextLetter));
    case 'ב': case 'כ': case 'ל': return has(POINT.sheva) || has(POINT.patach) || has(POINT.qamats) || has(POINT.hiriq) || has(POINT.segol) || has(POINT.tsere);
    case 'מ': return (has(POINT.hiriq) && nextDagesh) || has(POINT.tsere);
    case 'ש': return has(POINT.segol) && nextDagesh;
    default: return false;
  }
}

/** Is this word (as it stands in the verse) a candidate for מילה בהפתעה? Frequency rules are the generator's. */
export function isMeaningfulShape(word) {
  const base = baseLetters(word);
  if (base.length < 3 || base.length > 7) return false;
  if (base[0] === 'ו') return false; // "and …" — the vav-consecutive verbs and joined words
  if (STOP.has(base) || isDivineName(base)) return false;
  // Pronoun suffixes and personal endings (יָדְךָ, אַחֲרֵינוּ, שָׁכַבְתִּי, בָּתֵּיהֶם …): the wheel shows words, not inflections.
  if (/(?:\u05DA\u05B8|\u05DB\u05B6\u05DD|\u05D4\u05B6\u05DD|\u05D4\u05B6\u05DF|\u05EA\u05BC?\u05B4\u05D9|\u05E0\u05D5\u05BC|\u05EA\u05BC?\u05B6\u05DD|\u05EA\u05BC?\u05B8|\u05B8\u05D9\u05D5|\u05B6\u05D9\u05D4\u05B8|\u05B5\u05D9\u05D4\u05B6\u05DD|\u05B5\u05D9\u05DB\u05B6\u05DD|\u05B5\u05D9\u05E0\u05D5\u05BC|\u05B7\u05D9\u05D9\u05DA)$/.test(word.replace(/\u05BD/g, ''))) return false;
  return true;
}
