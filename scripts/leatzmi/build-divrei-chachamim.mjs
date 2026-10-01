// Generates src/data/divreiChachamim.mjs — דברי חכמים for בשבילי היום: short, whole sayings taken word for word from
// the library's bundled packs (public/library/packs). Nothing is written or edited: every saying is an exact substring
// of one unit of its pack, cut only at the edges of whole sentences (or the whole unit). Each carries its work, its
// place (chapter / mishnah / daf …), its licence and the edition's attribution, as the library records them.
//
// How a saying is chosen (deterministic — the same packs give the same file):
//   1. Pirkei Avot: all of it. Every mishnah; a long one in consecutive whole sentences of up to ~420 characters.
//   2. Every other work: candidate passages of one to three whole sentences (or the whole unit after its "ואמר." /
//      numbering), 45–280 characters, that open a thought (not "ולכן…", "וזהו…", a question, a citation), carry no
//      apparatus (parentheses, verse references, "וכו׳", "הנ״ל", "לעיל"), no halachic technicality, nothing polemical or
//      sensitive, and speak of the inner life (a list of guiding words). They are ranked by plain rules, the best
//      window of each unit (a unit gives at most one saying).
//   3. Rules alone are not enough: every candidate outside Avot was read one by one, and only the passages kept in
//      scripts/leatzmi/divrei-chachamim-curation.mjs (APPROVED, by id) are taken — fragments, passages that lean on
//      what came before, halachic detail, harsh or sensitive passages were left out there.
//   4. Then the sayings gathered from the web (scripts/leatzmi/divrei-chachamim-web.mjs — the owner's decision of 2026-10:
//      the words of Chazal and the classic sages are everyone's; a modern edition's nikud, punctuation and notes are not).
//      Each carries its book, its place, a link to it and the date it was read. One whose book the app bundles is found
//      here, letter for letter, in that pack (and placed at its unit, so the card opens it in the library); one that
//      cannot be found stops the build. None repeats a saying already taken (compared letter for letter).
// The result: src/data/divreiChachamim.mjs, checked by tests/leatzmiDivreiChachamim.test.mjs against the packs.
// Run: node scripts/leatzmi/build-divrei-chachamim.mjs  (writes the module and a review listing in /tmp unless --quiet)
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { workById } from '../../src/data/library/registry.mjs';
import { hebrewNumeral } from '../../src/services/hebrewNumerals.mjs';
import { APPROVED, EXCLUDE_IDS, EXCLUDE_PHRASES } from './divrei-chachamim-curation.mjs';
import { WEB_BOOKS, WEB_SAYINGS } from './divrei-chachamim-web.mjs';

const PACKS = new URL('../../public/library/packs/', import.meta.url);
const OUT = new URL('../../src/data/divreiChachamim.mjs', import.meta.url);

// group: the shelf the card names. mode: how candidates are cut. approved: only the passages kept after reading.
export const SOURCES = [
  { workId: 'Pirkei_Avot', group: 'משנה', mode: 'avot' },
  { workId: 'Avot_DeRabbi_Natan', group: 'מסכתות קטנות', sayingsOnly: true },
  { workId: 'Tractate_Derekh_Eretz_Zuta', group: 'מסכתות קטנות' },
  { workId: 'Tractate_Derekh_Eretz_Rabbah', group: 'מסכתות קטנות', sayingsOnly: true },
  // The Talmud's aggadot as Ein Yaakov gathers them (punctuated, by tractate and chapter): the Gemara's own words.
  { workId: 'Ein_Yaakov', group: 'גמרא', mode: 'gemara' },
  { workId: 'Mivchar_HaPeninim', group: 'מוסר', mode: 'unit' },
  { workId: 'Orchot_Chaim_LHaRosh', group: 'מוסר', mode: 'unit' },
  { workId: 'Iggeret_HaRamban', group: 'מוסר' },
  { workId: 'Maalot_HaMiddot', group: 'מוסר' },
  { workId: 'Kad_HaKemach', group: 'מוסר' },
  { workId: 'Ohr_Yisrael', group: 'מוסר' },
  { workId: 'Kav_HaYashar', group: 'מוסר' },
  { workId: 'Reshit_Chokhmah', group: 'מוסר' },
  { workId: 'Sefer_Chasidim', group: 'מוסר' },
  { workId: 'Moreh_BeEtzba', group: 'מוסר' },
  { workId: 'Tzavaat_HaRivash', group: 'חסידות' },
  { workId: 'Meor_Einayim', group: 'חסידות' },
  { workId: 'Kedushat_Levi', group: 'חסידות' },
  { workId: 'Sefat_Emet', group: 'חסידות' },
  { workId: 'Tzav_VeZeruz', group: 'חסידות' },
  { workId: 'Hakhsharat_HaAvrekhim', group: 'חסידות' },
  { workId: 'Mevo_HaShearim', group: 'חסידות' },
  { workId: 'Eight_Chapters', group: 'מחשבה' },
  { workId: 'Netivot_Olam', group: 'מחשבה' },
].map(source => (source.mode === 'avot' ? source : { approved: true, ...source }));

export const LICENSE_TITLE = { 'public-domain': 'נחלת הכלל', 'cc-by': 'CC BY', 'cc-by-sa': 'CC BY-SA', 'cc-by-nc': 'CC BY-NC', 'cc-by-nc-sa': 'CC BY-NC-SA' };

// ---------- text helpers ----------
const plain = text => String(text).replace(/[֑-ׇ]/g, '');
// Whole sentences: each ends at . : ! ? (or the end of the unit). Offsets are kept, so a window is an exact slice.
export function sentencesOf(text) {
  const out = [];
  const re = /[^.:!?]+(?:[.:!?]+|$)/g;
  let match;
  while ((match = re.exec(text))) {
    const lead = match[0].length - match[0].trimStart().length;
    const start = match.index + lead;
    const end = match.index + match[0].trimEnd().length;
    if (end > start) out.push({ start, end });
    if (match[0].length === 0) re.lastIndex += 1;
  }
  return out;
}

const OPENERS_BANNED = new Set(`ולכן לכן לפיכך וזהו זהו וזה זה וזו זו והנה ונראה ועוד עוד אבל אך אלא כי וכי ולפי לפי והוא הוא והיא היא וכן כן גם וגם ואף אף
ובזה בזה וזש"ה וזש״ה וע"ז וע״ז ע"כ ע״כ עכ"ל עכ״ל וכמו כמו כמ"ש כמ״ש וכמ"ש וכמ״ש שם ושם ומה מה ולמה למה ואז אז ואח"כ ואח״כ אח"כ אח״כ
ולזה לזה ועל ולכך לכך ובכן בכן ועתה עתה והם הם והמה המה אלו ואלו אלה ואלה ומזה מזה וזאת זאת והיינו היינו ר"ל ר״ל פירוש פי' פי׳ ופירוש
דהיינו וזהו שאמרו שאמרו וזש"כ ומ"מ מ"מ מ״מ ומ״מ ובאמת באמת והטעם הטעם וטעם טעם שנאמר ונאמר כמאמר ואמרו אמרו ואמר אמר ממילא וממילא
וכאשר כאשר וכשם וגם ואולם אולם ואמנם אמנם ואם אם אמנם ולא ואין ובלי ובכל ובפרט בפרט וביותר ביותר ואחר אחר ושוב שוב וכיון כיון ואילו`.split(/\s+/));
// Inside a saying: apparatus and back-references that make it lean on its surroundings.
const APPARATUS = /[()[\]{}<>/\\0-9;*]|(?:^|\s)[אבגדוזחטיכלמנסעפצקשת]['׳](?=\s|$)|אמר ל[וה](?=\s|$)|אמרו לו|א["״]ל|פעם אחת|וכו['׳]|וגו['׳]|(?:^|\s)כו['׳]|(?:^|\s)גו['׳]|הנ["״]ל|כנ["״]ל|ע["״]ש|עיין|כמ["״]ש|כמש["״]כ|לעיל|להלן|לקמן|כדלעיל|כדלקמן|כנזכר|הנזכר|זה לשונו|עכ["״]ל|כנודע|כידוע|כמבואר|כמו שכתבנו|כמו שאמרנו|כאמור|הנ"ל|פסוק|הפסוק|כתיב|דכתיב|וכתיב|כדכתיב|\?/;
// Halachic technicalities, harshness and sensitive subjects (matched on words, with or without prefixed letters).
const BANNED_WORDS = `אסור אסורה אסורים אסורין מותר מותרת מותרים מותרין חייב חייבת חייבים חייבין פטור פטורה פטורים פטורין כשר כשרה פסול פסולה
טמא טמאה טמאים טהור טהורה טומאה טהרה מקוה נדה זבה זב קרבן קרבנות שחיטה טריפה נבלה ממזר ממזרים גט גיטין קידושין יבם יבמה חליצה נזיר כלאים ערלה
מעשר מעשרות תרומה תרומות עירוב ריבית כרת מיתה מיתות סקילה שריפה הרג הרגו נהרג הורגים חרב דם דמים מלקות קבר קברים מת מתים מות המות גיהנם גיהנום גהנם גיהנום
פורענות קללה קללות ייסורים יסורים שדים שד מזיקין מזיקים כשפים מכשפה לילית עכו"ם עכו״ם עובדי גוים גוי גויים נכרי נכרים נכרית ישמעאלים נוצרים מינים מין
אפיקורס אפיקורסים כותים כותי צדוקים עמי עם-הארץ ערלים אשה האשה נשים נשי אשתו אשת נקבה בתולה בתולות ערוה עריות זנות זנונים נאוף ניאוף קרי זרע משכב
זונה זונות פריצות ספירות ספירה ז"א ז״א זו"ן זו״ן נוקבא פרצוף פרצופים אצילות קליפה קליפות קליפין ס"מ ס״מ סטרא סמאל גימטריא בגימטריא צירוף צירופים יחודים
עבירה עבירות עונש עונשים נידוי חרם מלשינים מוסרים רשעים רשע הרשע הרשעים שונא שונאי שנאה נקמה אכזרי אכזריות עבד עבדים שפחה ממון
מעשה הלך הלכו נכנס הנכנס נכנסין יצא היוצא רוכב ספינה מרחץ הכסא ערומים ערום קוף ריבה כהונה פלוסופוס רבית לוקה לוקין נודר נודרין שטרותיו בהמה
חולי חולה חוליה מלחמה משיח שבן לסטים גזל גזלן גנב גנבה שכור יין שיכור דין דינו בדין לדין שופט משפט ממונו כיס כסף זהב זוז זוזים דינרים
ד"א ד״א אחרת`.split(/\s+/);
const BANNED = new RegExp(`(?:^|[\\s,.:!?"״'׳-])[ובכלמשה]{0,3}(?:${BANNED_WORDS.map(word => word.replace(/["״]/g, '["״]')).join('|')})(?=$|[\\s,.:!?"״'׳-])`);
// The inner life: a passage speaks of one of these (letters only, any prefix).
const GUIDING = `אדם לב לבו לבך שמחה שמח תורה חסד חסדים ענוה ענו ענוותנות אמת שלום תפלה תפילה תשובה אהבה אוהב יראה ירא יראת טוב טובה חכם חכמה חכמים דרך נפש נפשו
בטחון ביטחון אמונה צדקה מדות מדה מידות מידה נשמה עבודה הבורא השם הקב"ה הקב״ה הקדוש מחשבה מחשבתו מעשים מעשיו מעשה דיבור דבריו כבוד גאוה כעס רצון רצונו עולם
חיים מוסר ישר ישרה צדיק צדיקים חסיד חסידים זריז זריזות שתיקה סבלנות בושה תמים תמימות ענוותן לימוד ללמוד למד לומד תלמיד שכינה מצוה מצות מצוות קדושה טהרת
ביטול בטל דביקות דבקות יחיד רחמים רחמנות חן נחת שלוה מנוחה תקוה תקווה הודאה שבח שבחו תודה ברכה אור ענוותנותו נדיבות נדיב צניעות זוכה זכות`.split(/\s+/);
const STRONG_OPENERS = /^(?:כל|אין|אל|הוי|טוב|טובה|גדול|גדולה|אשרי|דע|זכור|עיקר|לעולם|יהא|יהי|איזהו|איזה|הרוצה|צריך|ראוי|תמיד|הנה|אהוב|אהבת|כשם|חביב|חביבה|יפה|השמר|הזהר|הסתכל|התרחק|לא)$/;

const GUIDING_RE = new RegExp(GUIDING.map(word => word.replace(/["״]/g, '["״]')).join('|'), 'g');
const firstWord = text => plain(text).trim().split(/[\s,.:]+/)[0].replace(/["״'׳]+$/, '');
// A quotation mark that is not inside an abbreviation (between two letters) opens or closes a quotation.
const quoteMarks = text => (plain(text).match(/(?<![א-ת])["״“”„]|["״“”„](?![א-ת])/g) || []).length;

const SPEECH = new Set(['אמר', 'ואמר', 'אומר', 'ואומר', 'שנאמר', 'ונאמר', 'דכתיב', 'כתיב', 'שכתוב', 'הכתוב', 'שנא׳', "שנא'", 'אמרו', 'רבנן', 'תניא', 'תנא', 'לומר', 'שאמר', 'שאמרו', 'כמאמר', 'במאמר', 'אמרם', 'ז"ל', 'ז״ל', 'זצ"ל', 'זצ״ל', 'בזה"ל', 'בזה״ל', 'לשונו']);
// The Gemara's sayings open with their teller: "אמר רבי …:", "תנו רבנן:", "דרש …".
const GEMARA_OPENERS = new Set(['אמר', 'ואמר', 'תנו', 'תניא', 'דרש', 'ודרש', 'תנא', 'מרגלא']);
export function acceptable(text, { gemara = false } = {}) {
  const bare = plain(text);
  if (APPARATUS.test(bare) || BANNED.test(bare)) return false;
  const first = firstWord(text);
  if (gemara && BAVLI_DIALECTIC.test(bare)) return false;
  if (!(gemara && GEMARA_OPENERS.has(first)) && (OPENERS_BANNED.has(first) || /^ו/.test(first))) return false;
  if (quoteMarks(text) % 2) return false;
  // Not a passage that ends by introducing what follows ("…שֶׁנֶּאֱמַר:", "אָמַר רַבִּי יוֹחָנָן:").
  const sentences = sentencesOf(text);
  const last = text.slice(sentences.at(-1).start, sentences.at(-1).end);
  const lastWord = plain(last).replace(/[.:!?,\s]+$/, '').split(/\s+/).pop();
  if (SPEECH.has(lastWord) || (/:\s*$/.test(text) && plain(last).split(/\s+/).length <= 5 && sentences.length > 1)) return false;
  if (EXCLUDE_PHRASES.some(phrase => bare.includes(phrase))) return false;
  return true;
}
export function score(text) {
  const bare = plain(text);
  const guiding = new Set(bare.match(GUIDING_RE) || []).size;
  let value = Math.min(guiding, 4) * 2;
  if (STRONG_OPENERS.test(firstWord(text))) value += 3;
  if (bare.length >= 60 && bare.length <= 200) value += 2;
  value -= Math.max(0, sentencesOf(text).length - 1);
  return { value, guiding };
}
const hash = text => createHash('sha1').update(text).digest('hex');

// ---------- candidates ----------
function readChunk(edition) {
  return JSON.parse(gunzipSync(readFileSync(new URL(`${edition.packId}/${edition.file}`, PACKS))).toString('utf8'));
}

// A unit's own opening — "ואמר", "אמר החכם.", a numbering "א." — is left out: the saying begins after it (the words
// that only introduce the speaker; nothing of the saying itself is cut).
const tolerant = word => [...word].map(ch => `${ch}[\u0591-\u05C7]*`).join('');
const INTRO = new RegExp(`^\\s*(?:${tolerant('ו')}?${tolerant('אמר')}(?:\\s+${tolerant('החכם')}|\\s+${tolerant('המחבר')})?[.:,]?\\s+|[א-ת]{1,3}[.)]\\s+)`);
function unitCandidates(text, { mode, minLen = 45, maxLen = 280 }) {
  const out = [];
  const intro = text.match(INTRO);
  const from = intro ? intro[0].length : 0;
  if (mode === 'unit') {
    const start = from + (text.slice(from).length - text.slice(from).trimStart().length);
    const end = text.trimEnd().length;
    const length = plain(text.slice(start, end)).length;
    return length >= minLen && length <= maxLen ? [{ start, end }] : [];
  }
  const sentences = sentencesOf(text).filter(sentence => sentence.start >= from);
  for (let i = 0; i < sentences.length; i += 1) {
    for (let j = i; j < Math.min(sentences.length, i + 3); j += 1) {
      const start = sentences[i].start;
      const end = sentences[j].end;
      const length = plain(text.slice(start, end)).length;
      if (length > maxLen) break;
      if (length >= minLen) out.push({ start, end });
    }
  }
  return out;
}

const BAVLI_DIALECTIC = /(?:^|\s)(?:מאי|מנא|היכי|היכא|איבעיא|מתיב|תיובתא|קשיא|ולטעמיך|הכא|התם|והא|ורמינהו|ורמינהי|איתיביה|פשיטא|לימא|מיתיבי|בעי|אמרי|איכא|ליכא|דתנן|דתניא|תנן|כדתניא|מתני['׳]|גמ['׳]|ההוא|ליה|להו|ת["״]ש|ש["״]מ|מינה|אי|מר|ומר|וכי|למימרא|א["״]ל|אמר ליה|אמרו לו|ושמואל|וחד|חד|ואיתימא|איתימא|לישנא|במערבא|מתקיף|כתנאי|תנאי|ורבנן|מחלוקת|הלכה|והלכתא|הלכתא|ואמרי|דאמרי|קמ["״]ל|קא|תרגמה|לאו|מיהו|נמי)(?=\s|$|[.,:])/;
// Pirkei Avot, all of it: a mishnah whole, or a long one in whole sentences of up to ~420 characters.
function avotCandidates(text) {
  const limit = 420;
  if (plain(text).length <= limit) return [{ start: text.length - text.trimStart().length, end: text.trimEnd().length }];
  const out = [];
  let current = null;
  for (const sentence of sentencesOf(text)) {
    if (current && plain(text.slice(current.start, sentence.end)).length <= limit) current.end = sentence.end;
    else { if (current) out.push(current); current = { ...sentence }; }
  }
  if (current) out.push(current);
  return out;
}

// ---------- the work's facts ----------
const nodeTitleOf = (edition, node) => edition.nodeTitles?.[node - 1] || `${edition.nodeLabel || 'חלק'} ${hebrewNumeral(node)}`;
function placeOf(work, edition, node, unit) {
  const single = edition.nodes.length === 1;
  const nodePart = single ? '' : nodeTitleOf(edition, node);
  return [nodePart, `${edition.unitLabel || 'פסקה'} ${hebrewNumeral(unit)}`].filter(Boolean).join(', ');
}
function workFacts(work, group) {
  const edition = work.editions[0];
  const license = edition.license;
  if (!LICENSE_TITLE[license]) throw new Error(`${work.workId}: unknown licence ${license}`);
  const editionName = edition.heTitle || edition.title;
  const attribution = edition.attribution?.text
    || (license === 'public-domain' ? `${work.title} · ${editionName} · נחלת הכלל (דרך ספריא)` : `${work.title} · ${editionName} · ${LICENSE_TITLE[license]} · דרך ספריא (Sefaria)`);
  return {
    workId: work.workId, title: work.title, group, packId: edition.packId, editionId: edition.editionId, file: edition.file, checksum: edition.checksum,
    license, licenseTitle: LICENSE_TITLE[license], licenseUrl: edition.attribution?.licenseUrl || null, attribution,
    edition: editionName, versionSource: edition.versionSource || null, sourceUrl: edition.sourceUrl || null,
    nonCommercial: license.includes('-nc'), shareAlike: license.includes('-sa'),
  };
}

// ---------- build ----------
export function build() {
  const works = [];
  const sayings = [];
  const seen = new Set();
  for (const source of SOURCES) {
    const work = workById(source.workId);
    if (!work) throw new Error(`${source.workId} is not in the library registry`);
    const edition = work.editions[0];
    const chunk = readChunk(edition);
    const facts = workFacts(work, source.group);
    const workIndex = works.length;
    const picked = [];
    for (const node of chunk.nodes) {
      for (const unit of node.units || []) {
        const text = String(unit.text || '');
        if (!text || /<[^>]+>/.test(text)) continue;
        const raw = source.mode === 'avot' ? avotCandidates(text) : unitCandidates(text, { mode: source.mode });
        const options = [];
        for (const { start, end } of raw) {
          const saying = text.slice(start, end);
          const id = `${source.workId}:${node.n}:${unit.n}:${start}`;
          if (EXCLUDE_IDS.has(id)) continue;
          if (source.mode !== 'avot') {
            if (!acceptable(saying, { gemara: source.mode === 'gemara' })) continue;
            // Not a passage whose last words open a quotation that follows it in the unit.
            if (/:\s*$/.test(saying) && /^\s*["״'׳(]/.test(text.slice(end))) continue;
            const rank = score(saying);
            if (rank.guiding < 1) continue;
            // A collection of teachings and stories: only a saying in its own words — "X אומר …" or an opening like "כל", "הוי".
            if (source.sayingsOnly && !(STRONG_OPENERS.test(firstWord(saying)) || /^(?:\S+\s+){0,6}אומר\s/.test(plain(saying)))) continue;
            options.push({ id, node: node.n, unit: unit.n, start, text: saying, rank: rank.value });
          } else options.push({ id, node: node.n, unit: unit.n, start, text: saying, rank: 100 });
        }
        if (source.mode === 'avot') picked.push(...options);
        // A work read passage by passage: only what the reading approved (scripts/leatzmi/divrei-chachamim-curation.mjs).
        // (A window is named by where it starts; of the windows starting there, the best-ranked one is the one read.)
        else if (source.approved) {
          const ranked = options.filter(option => APPROVED.has(option.id)).sort((a, b) => b.rank - a.rank || hash(a.id).localeCompare(hash(b.id)));
          picked.push(...ranked.filter((option, index) => ranked.findIndex(other => other.id === option.id) === index));
        }
        else if (options.length) picked.push(options.sort((a, b) => b.rank - a.rank || hash(a.id).localeCompare(hash(b.id)))[0]);
      }
    }
    const chosen = source.mode === 'avot' || source.approved ? picked : picked.sort((a, b) => b.rank - a.rank || hash(a.id).localeCompare(hash(b.id))).slice(0, source.cap);
    chosen.sort((a, b) => a.node - b.node || a.unit - b.unit || a.start - b.start);
    let count = 0;
    for (const item of chosen) {
      const key = plain(item.text).replace(/[^א-ת]/g, '');
      if (seen.has(key)) continue;
      seen.add(key);
      sayings.push({ ...item, work: workIndex, place: placeOf(work, edition, item.node, item.unit) });
      count += 1;
    }
    works.push({ ...facts, count });
  }
  addWebSayings(works, sayings, seen);
  return { works, sayings };
}

// ---------- the sayings gathered from the web ----------
/** Letters only (no nikud, no punctuation, no spaces) — how a saying is compared with its source and with the others. */
export const lettersOf = text => String(text).replace(/[\u0591-\u05C7]/g, '').replace(/[^א-ת]/g, '');
/** A bundled work as one run of letters (verse references in parentheses left out), with the unit each letter is in. */
export function bundledLetters(edition) {
  const chunk = readChunk(edition);
  let letters = '';
  const starts = [];
  for (const node of chunk.nodes) {
    for (const unit of node.units || []) {
      starts.push({ at: letters.length, node: node.n, unit: unit.n });
      letters += lettersOf(String(unit.text || '').replace(/\([^()]*\)/g, ' '));
    }
  }
  return { letters, starts };
}
/** Where a saying's letters begin in a bundled work: { node, unit } of that unit, or null. */
export function locateInBundled(bundled, text) {
  const at = bundled.letters.indexOf(lettersOf(text));
  if (at < 0) return null;
  let found = bundled.starts[0];
  for (const start of bundled.starts) { if (start.at > at) break; found = start; }
  return { node: found.node, unit: found.unit };
}
function webWorkFacts(key, book) {
  const common = {
    title: book.title, group: book.group, origin: 'web', author: book.author || null, basis: book.basis,
    license: 'public-domain', licenseTitle: LICENSE_TITLE['public-domain'], licenseUrl: null,
    edition: book.basis, digitalVersion: book.digital.version, digitalLicense: book.digital.licence, punctuation: book.punctuation,
    nonCommercial: false, shareAlike: false,
  };
  if (book.source === 'bundled') {
    const work = workById(book.bundled);
    if (!work) throw new Error(`${book.bundled} is not in the library registry`);
    const edition = work.editions[0];
    return {
      workId: work.workId, ...common, title: work.title, via: 'מן הספרייה',
      attribution: `${work.title} · ${book.basis} · נחלת הכלל (נבדק מול ${edition.heTitle || edition.title} שבספרייה)`,
      packId: edition.packId, editionId: edition.editionId, file: edition.file, checksum: edition.checksum,
      sourceUrl: edition.sourceUrl || null, versionSource: edition.versionSource || null,
    };
  }
  return {
    workId: `web:${book.key || key}`, ...common, via: 'דרך ספריא',
    attribution: `${book.title}${book.author ? ` · ${book.author}` : ''} · ${book.basis} · נחלת הכלל (${book.digital.site}: ${book.digital.version})`,
    packId: null, editionId: null, file: null, checksum: null,
    sourceUrl: 'https://www.sefaria.org', versionSource: book.digital.versionSource || null,
  };
}
function addWebSayings(works, sayings, seen) {
  const index = new Map();
  const bundledCache = new Map();
  for (const item of WEB_SAYINGS) {
    const book = WEB_BOOKS[item.book];
    if (!book) throw new Error(`${item.id}: unknown book ${item.book}`);
    if (!index.has(item.book)) {
      index.set(item.book, works.length);
      works.push({ ...webWorkFacts(item.book, book), count: 0 });
    }
    const workIndex = index.get(item.book);
    const work = works[workIndex];
    let node = null;
    let unit = null;
    if (book.source === 'bundled') {
      if (!bundledCache.has(book.bundled)) bundledCache.set(book.bundled, bundledLetters(workById(book.bundled).editions[0]));
      const place = locateInBundled(bundledCache.get(book.bundled), item.text);
      if (!place) throw new Error(`${item.id}: not found in the bundled ${book.bundled}`);
      ({ node, unit } = place);
    }
    const key = lettersOf(item.text);
    if (seen.has(key)) continue;
    seen.add(key);
    sayings.push({ id: item.id, work: workIndex, node, unit, place: item.ref, text: item.text, url: item.provenanceUrl });
    work.count += 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { works, sayings } = build();
  const fromWeb = sayings.filter(item => works[item.work].origin === 'web').length;
  const header = `// Generated by scripts/leatzmi/build-divrei-chachamim.mjs — do not edit.
// ${sayings.length} sayings from ${works.length} works. ${sayings.length - fromWeb} are exact substrings of their unit in the library's bundled packs
// (WORKS[w].packId/file, node, unit; licence and attribution as the library records the edition). ${fromWeb} were gathered from
// the web (WORKS[w].origin 'web', scripts/leatzmi/divrei-chachamim-web.mjs): public-domain words, unvocalized, each with its
// place and a link (the row's 7th field); those whose book the app bundles are placed at their unit. Lazy-loaded by בשבילי היום.
`;
  const body = `export const WORKS = ${JSON.stringify(works.map(({ count, ...work }) => work), null, 0)};
// [id, workIndex, node, unit, place, text] — and, for a saying gathered from the web, its link: [… , provenanceUrl]
// (node and unit are null when its book is not in the library).
export const SAYINGS = ${JSON.stringify(sayings.map(item => (item.url ? [item.id, item.work, item.node, item.unit, item.place, item.text, item.url] : [item.id, item.work, item.node, item.unit, item.place, item.text])))};
`;
  writeFileSync(OUT, header + body.replace(/\],\[/g, '],\n['));
  const byGroup = {};
  const byLicense = {};
  for (const item of sayings) { const work = works[item.work]; byGroup[work.group] = (byGroup[work.group] || 0) + 1; byLicense[work.license] = (byLicense[work.license] || 0) + 1; }
  console.log(`divreiChachamim.mjs: ${sayings.length} sayings`);
  console.log('by group:', byGroup);
  console.log('by licence:', byLicense);
  console.log('by work:', works.map(work => `${work.workId} ${work.count}`).join(' · '));
  if (!process.argv.includes('--quiet')) {
    const review = sayings.map(item => `${item.id}\t${works[item.work].title} · ${item.place}\n${item.text}\n`).join('\n');
    writeFileSync(process.env.REVIEW_OUT || '/tmp/divrei-chachamim-review.txt', review);
  }
}
