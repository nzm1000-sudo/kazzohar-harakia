// Verified app answers beside the sources, for a natural question — never a generated answer.
//   halacha  the Halacha Engine's published answers found among the first results (they are in the index already)
//   blessing מנוע הברכות החכם: a food named in a blessing question, matched by exact name or alias to a row of the
//            עונג שבת blessing table — the book's own words and its citation; nothing is decided here
// Only an exact name matches: "מה מברכים על מאכל שעשוי מאורז" → אורז; a word the table does not name gives nothing.
import { normalizeFood } from '../blessingsEngine.mjs';
import { QUESTION_SCAFFOLDING } from '../../data/torah/semanticLexicon.mjs';
import { tokenize } from './hebrew.mjs';

const BLESSING_QUESTION = /(מברכ|ברכה|ברכת|לברך|מברך|ברכתו|ברכות)/;
const NOT_FOOD = new Set(['מברכים', 'מברכין', 'מברך', 'לברך', 'ברכה', 'ברכת', 'ברכתו', 'ברכות', 'אחרונה', 'ראשונה', 'לפני', 'אחרי', 'אכילה', 'שתייה', ...QUESTION_SCAFFOLDING].map(word => tokenize(word).join('')));
const PREFIXES = ['', 'מ', 'ב', 'ל', 'ה', 'ו', 'וה', 'מה', 'בה', 'לה'];

let table = null;
async function bookRows() {
  table ||= import('../../data/blessings/bookTable.mjs').then(module => {
    const byName = new Map();
    for (const row of module.BOOK_ROWS) for (const name of [row.name, ...(row.aliases || [])]) {
      const key = normalizeFood(name);
      if (key && !byName.has(key)) byName.set(key, row);
    }
    return byName;
  }).catch(error => { table = null; throw error; });
  return table;
}

export async function blessingAnswer(text) {
  const raw = String(text || '');
  if (!BLESSING_QUESTION.test(raw.replace(/[֑-ׇ]/g, ''))) return null;
  const words = tokenize(raw).filter(word => !NOT_FOOD.has(word) && word.length >= 2);
  if (!words.length) return null;
  const byName = await bookRows();
  const tryKey = key => byName.get(normalizeFood(key)) || null;
  // Two words first (פת הבאה בכיסנין, תפוח אדמה), then one; each with a leading prefix letter removed if needed.
  for (const size of [3, 2, 1]) {
    for (let i = 0; i + size <= words.length; i += 1) {
      const phrase = words.slice(i, i + size);
      // A name followed by another word of the food is a different food: "אגוזי מלך" is walnuts, not the "אגוזי" bar;
      // "במבה נוגט" is not plain במבה. The longer name was tried first; no row, no answer — never the shorter row.
      if (i + size < words.length) continue;
      for (const prefix of PREFIXES) {
        if (prefix && !phrase[0].startsWith(prefix)) continue;
        const row = tryKey([phrase[0].slice(prefix.length), ...phrase.slice(1)].join(' '));
        if (row) return { kind: 'blessing', name: row.name, text: row.text, cite: row.cite, route: row.route, engineRoute: 'siddur-brachot', rowId: row.id };
      }
    }
  }
  return null;
}
