// Explicit citations inside a text: "שו"ע או"ח סי' שיח ס"א", "משנה ברורה סימן שיח ס"ק ג", "(בראשית ב, ג)",
// "שבת דף קיח ע"ב". Conservative by design: a citation is linked only when every part is explicit, the book is named
// unambiguously and the place exists in the edition on the device. Anything ambiguous yields nothing — a missing link
// is better than a wrong one. The words of the text are never changed; offsets refer to the original string.
import { WORKS } from '../../data/library/registry.mjs';
import { hebrewToNumber } from '../talmud.mjs';
import { findTractate, validateAmud } from '../talmud.mjs';

const byId = new Map(WORKS.map(work => [work.workId, work]));
const SA_PARTS = [
  [/^(?:או"ח|אורח חיים|אוח"ח)$/, 'Shulchan_Arukh__Orach_Chayim'],
  [/^(?:יו"ד|יורה דעה)$/, 'Shulchan_Arukh__Yoreh_Deah'],
  [/^(?:חו"מ|חושן משפט|חשן משפט)$/, 'Shulchan_Arukh__Choshen_Mishpat'],
  [/^(?:אה"ע|אבן העזר|אבה"ע)$/, 'Shulchan_Arukh__Even_HaEzer'],
];
const TANAKH_BOOKS = WORKS.filter(work => work.kind === 'pack' && work.primaryCategory === 'tanakh');

// Unify quote marks and drop nikud, keeping one character per original character so offsets stay valid.
function plainWithOffsets(text) {
  return String(text ?? '').replace(/[״“”„]/g, '"').replace(/[׳‘’`´]/g, "'").replace(/[֑-ׇ]/g, '\u0000');
}
const NUM = `[א-ת][א-ת"']{0,5}`;
const number = token => {
  const value = hebrewToNumber(String(token || '').replace(/['"]/g, ''));
  return Number.isInteger(value) && value > 0 ? value : null;
};
const nodeExists = (work, node, unit = null) => {
  const edition = work?.editions?.[0];
  if (!edition?.nodes?.[node - 1]) return false;
  return !unit || unit <= (edition.expected?.[node - 1] || 0);
};

const PATTERNS = [
  // Shulchan Arukh, part named explicitly, siman required; seif optional (only a clear "סעיף"/"ס'"/"סע'" or ס"X).
  {
    kind: 'shulchan-arukh',
    re: new RegExp(`(?:שו"ע|שולחן ערוך|שלחן ערוך|ש"ע)\\s*,?\\s*(או"ח|אורח חיים|יו"ד|יורה דעה|חו"מ|חושן משפט|אה"ע|אבן העזר)\\s*,?\\s*(?:סי'|סימן|סי)\\s*(${NUM})(?:\\s*,?\\s*(?:(?:סעיף|סע'|ס')\\s*(${NUM})|ס"(?!ק)([א-ת]{1,2})(?![א-ת])))?`, 'g'),
    resolve(m) {
      const workId = SA_PARTS.find(([re]) => re.test(m[1]))?.[1];
      const node = number(m[2]);
      const unit = number(m[3] || m[4]);
      const work = byId.get(workId);
      if (!work || !node || !nodeExists(work, node)) return null;
      return { workId, node, unit: unit && nodeExists(work, node, unit) ? unit : null };
    },
  },
  // Mishnah Berurah: only with an explicit ס"ק (מ"ב alone is also a number).
  {
    kind: 'mishnah-berurah',
    re: new RegExp(`(?:משנה ברורה|משנ"ב|מ"ב)\\s*,?\\s*(?:(?:סי'|סימן|סי)\\s*)?(${NUM})\\s*,?\\s*(?:ס"ק|סק"|ס''ק)\\s*(${NUM})`, 'g'),
    resolve(m) {
      const work = byId.get('Mishnah_Berurah');
      const node = number(m[1]);
      const unit = number(m[2]);
      if (!node || !unit || !nodeExists(work, node, unit)) return null;
      return { workId: work.workId, node, unit };
    },
  },
  // Tanakh: only inside parentheses, the whole parenthesis being the reference: "(בראשית ב, ג)", "(שמות פרק כ פסוק ב)".
  {
    kind: 'tanakh',
    re: new RegExp(`\\((${TANAKH_BOOKS.map(work => work.title).sort((a, b) => b.length - a.length).join('|')})\\s+(?:פרק\\s+)?(${NUM})\\s*[,:]?\\s*(?:פסוק\\s+)?(${NUM})\\s*\\)`, 'g'),
    resolve(m) {
      const work = TANAKH_BOOKS.find(item => item.title === m[1]);
      const node = number(m[2]);
      const unit = number(m[3]);
      if (!work || !node || !unit || !nodeExists(work, node, unit)) return null;
      return { workId: work.workId, node, unit };
    },
  },
  // The Bavli: tractate, daf and an explicit amud (ע"א / ע"ב); "דף" optional. Without the amud nothing is linked.
  {
    kind: 'bavli',
    re: new RegExp(`(?:מסכת\\s+)?([א-ת]+(?:\\s(?!דף\\s)[א-ת]+)?)\\s+(?:דף\\s+)?(${NUM})\\s*ע"([אב])`, 'g'),
    resolve(m) {
      const words = m[1].split(' ');
      // "בבא מציעא" or a one-word tractate; never a word that merely precedes a number.
      for (const name of [m[1], words.at(-1)]) {
        const tractate = findTractate(name);
        const daf = number(m[2]);
        if (!tractate || !daf) continue;
        const amud = `${daf}${m[3] === 'א' ? 'a' : 'b'}`;
        if (validateAmud(tractate, amud).error) return null;
        return { tractate: tractate.title, amud, workId: `Bavli_${tractate.title.replace(/['’]/g, '').replace(/[^A-Za-z0-9]+/g, '_')}` };
      }
      return null;
    },
  },
];

// → [{ kind, start, end, cited, target }], in text order, non-overlapping (the first, most specific pattern wins).
export function parseCitations(text) {
  const plain = plainWithOffsets(text).replace(/\u0000/g, '');
  // Offsets: map positions in the mark-free copy back to the original.
  const original = String(text ?? '');
  const map = [];
  for (let i = 0; i < original.length; i += 1) if (!/[֑-ׇ]/.test(original[i])) map.push(i);
  map.push(original.length);
  const found = [];
  for (const pattern of PATTERNS) {
    pattern.re.lastIndex = 0;
    let m;
    while ((m = pattern.re.exec(plain))) {
      const target = pattern.resolve(m);
      if (!target) continue;
      const start = map[m.index];
      const end = map[m.index + m[0].length];
      if (found.some(item => start < item.end && end > item.start)) continue;
      found.push({ kind: pattern.kind, start, end, cited: original.slice(start, end), target });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}
