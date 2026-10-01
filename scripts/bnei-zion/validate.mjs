// Stage 6 — the quality gate. Every canonical article is checked before it may be published:
//   readable Hebrew (ratio of Hebrew letters, no unknown glyphs, final letters where they belong), a title, its source
//   file and pages, a valid assignment, no clear duplicate, no header/footer/contact line inside, no stray page number,
//   no sign of a cut (an ending without any sentence end), no fragment.
// States: published (all checks pass) · review (a real doubt — kept out of the app until a person looks) · rejected
// (nothing readable, or — owner's decision — cut off mid-sentence in the source itself). The owner wants everything readable in, so "review" is used only for the reasons listed here.
// Usage: node scripts/bnei-zion/validate.mjs
import { HOLIDAY_IDS, PARASHOT, SPECIAL_IDS, hebrewStats, paths, readJson, stripPoints, writeJson } from './lib.mjs';

const MARKERS = /(?<![בלה])פרשת השבוע\s*:|כניסת השבת\s*:|יציאת השבת\s*:|bnei-zion\.com|moshe45|לקבלת העלון|קדושת הגי?ליון|הזמנים לפי העיר/;
const PHONE = /(?<!\d)0\d{1,2}-?\d{3}-?\d{4}(?!\d)|(?<!\d)05\d-?\d{7}(?!\d)/;
const EMAIL = /[\w.-]+@[\w-]+\.[\w.]+/;
const ENDING = /[.!?:;"״'׳)\]…]\s*$/;

// Owner: pieces in the general folder that are statements or announcements, not Torah — never published.
export const NOT_TORAH = new Map([
  ['03_דברי_תורה_כלליים/חילול הקודש בקבר דוד המלך.pdf', 'protest statement (2016), not a dvar Torah'],
  ['03_דברי_תורה_כלליים/ספר התורה של דוד המלך- הרעיון.pdf', 'project announcement / appeal, not a dvar Torah'],
  ['03_דברי_תורה_כלליים/ספר תורה לכבוד דוד המלך.pdf', 'project poster / appeal, not a dvar Torah'],
]);

export function gate(a) {
  const reasons = [];
  if (NOT_TORAH.has(a.originalPdf)) return { status: 'rejected', reasons: ['not-torah: ' + NOT_TORAH.get(a.originalPdf)], stats: hebrewStats(a.paragraphs.join('\n')) };
  const text = a.paragraphs.join('\n');
  const plain = stripPoints(text);
  const h = hebrewStats(text);
  if (!a.paragraphs.length || h.heb < 20) return { status: 'rejected', reasons: ['no-readable-text'], stats: h };
  if (h.hebRatio < 0.85) reasons.push('low-hebrew-ratio');
  if (h.bad > 0) reasons.push('unknown-glyphs');
  // Reversed/scrambled text shows final letters inside words everywhere; a handful (the author's "אלקיךךךך", a list of
  // the final letters "םןץףך", or a missing space) is the text itself.
  if (h.finals >= 10 && h.misplacedRatio > 0.08 && h.misplaced >= 4) reasons.push('misplaced-final-letters');
  if (!a.pagesOk) reasons.push('source-page-failed-check');
  if (a.method === 'ocr-heb') reasons.push('hebrew-ocr-needs-review');
  if (!a.title || !stripPoints(a.title).trim()) reasons.push('no-title');
  if (!a.originalPdf || !(a.pageStart >= 1) || !(a.pageEnd >= a.pageStart)) reasons.push('no-source');
  const validAssign = a.parashot.every(p => PARASHOT.includes(p)) && a.holidays.every(x => HOLIDAY_IDS.has(x)) && a.specialShabbatot.every(x => SPECIAL_IDS.has(x));
  if (!validAssign) reasons.push('invalid-assignment');
  if (!a.parashot.length && !a.holidays.length && !a.specialShabbatot.length && a.contentType !== 'general') reasons.push('no-assignment');
  if (MARKERS.test(stripPoints(`${a.title} ${text}`))) reasons.push('header-or-footer-inside');
  if (a.paragraphs.some(p => /^\s*\d{1,3}\s*$/.test(p))) reasons.push('stray-page-number');
  if (!ENDING.test(stripPoints(a.paragraphs.at(-1)))) reasons.push('possibly-cut');
  if (a.words < 12) reasons.push('fragment');
  if (PHONE.test(plain)) reasons.push('contains-phone-number');
  if (EMAIL.test(plain)) reasons.push('contains-email');
  // Owner's rule: a piece the source itself cuts off mid-sentence is not published at all.
  if (reasons.includes('possibly-cut')) return { status: 'rejected', reasons, stats: h };
  return { status: reasons.length ? 'review' : 'published', reasons, stats: h };
}

export function validateAll() {
  const P = paths();
  const { canonical, borderline } = readJson(P.stage('dedupe'));
  const words = new Map(canonical.map(c => [c.key, c.words]));
  const out = canonical.map(c => {
    const withLen = { ...c, similarTo: (c.similarTo || []).map(s => ({ ...s, otherWords: words.get(s.key) || 0 })) };
    const g = gate(withLen);
    const confidence = Math.round(Math.min(1, g.stats.hebRatio) * (1 - g.stats.misplacedRatio) * (c.pagesOk ? 1 : 0.5) * 1000) / 1000;
    return { ...withLen, status: g.status, reviewReasons: g.reasons, quality: { hebRatio: Math.round(g.stats.hebRatio * 1000) / 1000, misplacedRatio: Math.round(g.stats.misplacedRatio * 1000) / 1000 }, confidence };
  });
  writeJson(P.stage('validate'), { generatedAt: new Date().toISOString(), articles: out, borderline });
  const by = s => out.filter(a => a.status === s).length;
  const reasons = {};
  for (const a of out) for (const r of a.reviewReasons) reasons[r] = (reasons[r] || 0) + 1;
  return { published: by('published'), review: by('review'), rejected: by('rejected'), reasons };
}

if (import.meta.url === `file://${process.argv[1]}`) console.log('validate:', JSON.stringify(validateAll()));
