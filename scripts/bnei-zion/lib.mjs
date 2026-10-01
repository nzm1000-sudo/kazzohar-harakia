// Shared pieces of the "בני ציון" ingestion pipeline (build time only — never imported by the app).
// Paths, the legacy Hebrew font table, taxonomy helpers and small utilities used by every stage.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOLIDAYS, PARASHOT, SPECIAL_SHABBATOT, canonicalParasha } from '../../src/services/torahTaxonomy.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const COLLECTION = 'בני ציון';
export const AUTHOR = 'משה מזרחי';
export const RIGHTS = Object.freeze({ permission: 'granted', creditRequired: true, note: 'שימוש באישור מפורש של בעל הזכויות' });
export const GENERATED_HEADER = 'Generated from the authorized Bnei Zion source archive. Do not hand-edit generated files. Run the ingestion pipeline instead.';

// The extracted archive and every intermediate file live OUTSIDE the repository (never committed):
//   BNEI_ZION_SRC  — the unzipped bnei_zion_app_library folder (README.txt, manifest.json, 01_…/02_…/03_…)
//   BNEI_ZION_WORK — scratch folder for glyph dumps, page renders, OCR and stage outputs
//   BNEI_ZION_PY   — a python with PyMuPDF + fontTools (default: <work>/../venv/bin/python)
export function paths() {
  const src = process.env.BNEI_ZION_SRC;
  const work = process.env.BNEI_ZION_WORK;
  if (!src || !work) throw new Error('Set BNEI_ZION_SRC (the unzipped archive) and BNEI_ZION_WORK (a scratch folder outside the repo).');
  const py = process.env.BNEI_ZION_PY || join(work, '..', 'venv', 'bin', 'python');
  for (const dir of ['glyphs', 'pages', 'ocr', 'renders', 'stages']) mkdirSync(join(work, dir), { recursive: true });
  return { src, work, py, stage: name => join(work, 'stages', `${name}.json`) };
}

export const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
export const writeJson = (file, value) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(value)); };
export const sha1 = text => createHash('sha1').update(text).digest('hex');
export const exists = existsSync;

// ---------------------------------------------------------------------------------------------------------------------
// The legacy encoding of the Q fonts (QFrank, QDavid, QMiriam, QMantova …) in which every leaflet was typeset.
// Letters sit at their Windows-1255 positions (0xE0–0xFA → א–ת); Latin positions hold letters with a built-in point and
// the vowel points are separate glyphs (0xC0–0xD2). Established glyph by glyph from the archive's own renders
// (contact sheets of every code in context). Text is drawn in visual (left-to-right) order.
const L = cp => String.fromCodePoint(cp);
const DAGESH = 'ּ', SHIN_DOT = 'ׁ', SIN_DOT = 'ׂ', HOLAM = 'ֹ', SHEVA = 'ְ', QAMATS = 'ָ';
export const Q_LETTERS = Object.freeze({
  0x61: 'ב' + DAGESH, 0x62: 'ג' + DAGESH, 0x63: 'ד' + DAGESH, 0x64: 'ה' + DAGESH, 0x65: 'ו' + DAGESH, 0x66: 'ז' + DAGESH,
  0x68: 'ט' + DAGESH, 0x69: 'י' + DAGESH, 0x6a: 'ך' + DAGESH, 0x6b: 'כ' + DAGESH, 0x6c: 'ל' + DAGESH, 0x6e: 'מ' + DAGESH,
  0x70: 'נ' + DAGESH, 0x71: 'ס' + DAGESH, 0x74: 'פ' + DAGESH, 0x76: 'צ' + DAGESH, 0x77: 'ק' + DAGESH,
  0x79: 'ש' + DAGESH + SHIN_DOT, 0x7a: 'ת' + DAGESH,
  0x42: 'ו' + HOLAM, 0x43: 'ך' + SHEVA, 0x45: 'ך' + QAMATS, 0x47: 'ל' + HOLAM, 0x48: 'ל' + HOLAM,
  0x4c: 'ש' + SHIN_DOT, 0x4d: 'ש' + SHIN_DOT, 0x4e: 'ש' + SIN_DOT, 0x4f: 'ש',
});
export const Q_MARKS = Object.freeze({
  0xc0: 'ְ', 0xc1: 'ֱ', 0xc2: 'ֲ', 0xc3: 'ֳ', 0xc4: 'ִ', 0xc5: 'ֵ', 0xc6: 'ֶ', 0xc7: 'ַ',
  0xc8: 'ָ', 0xc9: 'ֹ', 0xcb: 'ֻ', 0xcc: DAGESH, 0xcd: 'ֽ', 0xd1: SHIN_DOT, 0xd2: HOLAM,
});
// Codes that draw nothing meaningful (a stray dot glyph seen twice in the whole pilot): dropped, and counted.
export const Q_IGNORED = new Set([0xd8]);
export const isQFont = name => /^Q[A-Z]/.test(name || '');

// ---------------------------------------------------------------------------------------------------------------------
// Taxonomy. Canonical names come from the app's own taxonomy (src/services/torahTaxonomy.mjs) so the engine and the
// pipeline can never disagree; the owner's extra spelling variants are added here.
export { PARASHOT };
export const HOLIDAY_IDS = new Set(HOLIDAYS.map(h => h.id));
export const SPECIAL_IDS = new Set(SPECIAL_SHABBATOT.map(h => h.id));
const EXTRA_ALIASES = {
  'חי שרה': 'חיי שרה', 'מדבר': 'במדבר', 'כי תבא': 'כי תבוא', 'נצבים': 'ניצבים', 'תצוה': 'תצווה', 'בחקותי': 'בחוקותי', 'בחקתי': 'בחוקותי',
  'קרח': 'קורח', 'חקת': 'חוקת', 'פנחס': 'פינחס', 'שלח לך': 'שלח', 'אחרי מות': 'אחרי מות', 'אחרי-מות': 'אחרי מות', 'לך-לך': 'לך לך',
  'אמר': 'אמור', 'קדשים': 'קדושים', 'תולדת': 'תולדות', 'שפטים': 'שופטים', 'בהעלתך': 'בהעלותך', 'מטת': 'מטות', 'שמת': 'שמות',
  'חיי-שרה': 'חיי שרה', 'כי-תשא': 'כי תשא', 'כי-תצא': 'כי תצא', 'כי-תבוא': 'כי תבוא', 'וזאת-הברכה': 'וזאת הברכה', 'ויקהל-פקודי': null,
};
export function parashaOf(name) {
  const key = String(name || '').replace(/[֑-ׇ]/g, '').replace(/["'׳״]/g, '').replace(/\s+/g, ' ').trim();
  if (!key) return null;
  if (key in EXTRA_ALIASES && EXTRA_ALIASES[key]) return EXTRA_ALIASES[key];
  return canonicalParasha(key);
}
// Combined readings → both parashot.
export const DOUBLE_PARASHOT = Object.freeze({
  'ויקהל פקודי': ['ויקהל', 'פקודי'], 'תזריע מצורע': ['תזריע', 'מצורע'], 'אחרי מות קדושים': ['אחרי מות', 'קדושים'],
  'בהר בחוקותי': ['בהר', 'בחוקותי'], 'בהר בחקותי': ['בהר', 'בחוקותי'], 'חוקת בלק': ['חוקת', 'בלק'], 'חקת בלק': ['חוקת', 'בלק'],
  'מטות מסעי': ['מטות', 'מסעי'], 'ניצבים וילך': ['ניצבים', 'וילך'], 'נצבים וילך': ['ניצבים', 'וילך'],
});
// Archive folder names of the festivals → holiday ids (+ special Shabbat ids).
export const HOLIDAY_FOLDERS = Object.freeze({
  'ראש השנה': { holidays: ['rosh-hashana'] }, 'יום הכיפורים': { holidays: ['yom-kippur'] }, 'סוכות': { holidays: ['sukkot'] },
  'סוכות ושמחת תורה': { holidays: ['sukkot', 'simchat-torah'] }, 'שמחת תורה': { holidays: ['simchat-torah'] }, 'פורים': { holidays: ['purim'] },
  'פסח': { holidays: ['pesach'] }, 'שביעי של פסח': { holidays: ['seventh-pesach', 'pesach'] }, 'שבועות': { holidays: ['shavuot'] },
  'שבת שקלים': { special: ['shabbat-shekalim'] }, 'שבת תשובה': { special: ['shabbat-shuva'] },
});

// ---------------------------------------------------------------------------------------------------------------------
// Text helpers.
export const stripPoints = text => String(text).replace(/[֑-ׇ]/g, '');
export const HEB_LETTER = /[א-ת]/;
export function hebrewStats(text) {
  const plain = stripPoints(text);
  let heb = 0, latin = 0, digit = 0, other = 0, bad = 0;
  for (const ch of plain) {
    if (/[א-ת]/.test(ch)) heb += 1;
    else if (/[A-Za-z]/.test(ch)) latin += 1;
    else if (/[0-9]/.test(ch)) digit += 1;
    else if (/[�\u0080-ÿ-]/.test(ch)) bad += 1;
    else if (!/\s/.test(ch)) other += 1;
  }
  // Final letters belong at the end of a word: misplaced finals betray reversed or scrambled text.
  const words = plain.split(/[^א-ת"'׳״]+/).filter(w => /[א-ת]{2,}/.test(w));
  let finals = 0, misplaced = 0, longWords = 0;
  for (const w of words) {
    const core = w.replace(/["'׳״]/g, '');
    for (let i = 0; i < core.length; i += 1) {
      if ('ךםןףץ'.includes(core[i])) { finals += 1; if (i < core.length - 1) misplaced += 1; }
    }
    if (core.length > 14) longWords += 1;
  }
  const letters = heb + latin;
  return { heb, latin, digit, other, bad, words: words.length, finals, misplaced, longWords,
    hebRatio: letters ? heb / letters : 0, misplacedRatio: finals ? misplaced / finals : 0 };
}
export const wordCount = text => stripPoints(text).split(/\s+/).filter(w => /[א-ת]/.test(w)).length;
// The app's reading pace for pointed Torah text (the engine uses 170 wpm for plain prose; pointed, dense text reads slower).
export const readMinutes = text => Math.max(1, Math.round(wordCount(text) / 150));

// Pack names (ASCII) for the parashot, in Torah order.
export const PARASHA_SLUGS = Object.freeze(Object.fromEntries(PARASHOT.map((name, i) => [name, ['bereshit', 'noach', 'lech-lecha', 'vayera', 'chayei-sara',
  'toldot', 'vayetzei', 'vayishlach', 'vayeshev', 'miketz', 'vayigash', 'vayechi', 'shemot', 'vaera', 'bo', 'beshalach', 'yitro', 'mishpatim', 'terumah',
  'tetzaveh', 'ki-tisa', 'vayakhel', 'pekudei', 'vayikra', 'tzav', 'shmini', 'tazria', 'metzora', 'achrei-mot', 'kedoshim', 'emor', 'behar', 'bechukotai',
  'bamidbar', 'nasso', 'behaalotcha', 'shlach', 'korach', 'chukat', 'balak', 'pinchas', 'matot', 'masei', 'devarim', 'vaetchanan', 'eikev', 'reeh',
  'shoftim', 'ki-teitzei', 'ki-tavo', 'nitzavim', 'vayeilech', 'haazinu', 'vezot-haberakhah'][i]])));
