// מנוע הברכות החכם — search and presentation over three kinds of records:
//   book        a row of the עונג שבת blessing table (chapter כ״ו), or a halacha of chapter כ״ה, in the book's own words;
//   rule        a food named by open data (Wikidata, Open Food Facts) to which ONE category rule applies;
//   conditional a food whose blessing depends on conditions or opinions the data cannot decide ("יש בזה דעות — לשאול רב").
// Nothing here decides a blessing: book rows carry the book's words; rules come from data/blessings/rules.mjs, each
// with its sources; the build (scripts/halacha/blessings/build.mjs) only chose which rule a food falls under.
import { AFTER, BLESSING, NUSACH_RULINGS, RULES, riteFamily } from '../data/blessings/rules.mjs';

const FINALS = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
// Spelling variants that change nothing in the word: niqqud, final letters, geresh/gershayim, doubled vav/yod
// (ביסקוויט / ביסקויט), punctuation and brackets. Latin is lower-cased.
export function normalizeFood(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[֑-ׇ]/g, '')
    .replace(/[ךםןףץ]/g, c => FINALS[c])
    .replace(/[׳״'"`’‘“”„]/g, '')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/וו/g, 'ו')
    .replace(/יי/g, 'י')
    .replace(/[^0-9a-zא-ת%]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
// A Hebrew word without its plural or feminine ending (תפוחים → תפוח, עוגיות/עוגיה → עוגי, בוטנים/בוטן → בוטנ).
// Words arrive normalized (final letters written as ordinary letters: ים → ימ).
export function stem(value) {
  const word = normalizeFood(value);
  if (!/^[א-ת]+$/.test(word) || word.length <= 3) return word;
  if (/(ימ|ות)$/.test(word) && word.length > 4) return word.slice(0, -2);
  if (/[הת]$/.test(word) && word.length > 3) return word.slice(0, -1);
  return word;
}
export const foodTokens = value => normalizeFood(value).split(' ').filter(Boolean).map(stem);

// One search entry per record: the stems of its name, of its other names, and the whole normalized name.
export function indexRecord(record) {
  const names = [record.name, ...(record.aliases || []), record.en || ''].filter(Boolean);
  const words = [...names, ...(record.keywords || []), record.brand || ''].filter(Boolean);
  return { record, full: normalizeFood(record.name), names: names.map(normalizeFood), nameTokens: foodTokens(record.name), allTokens: [...new Set(words.flatMap(foodTokens))] };
}

const KIND_WEIGHT = { book: 30, rule: 8, conditional: 8 };
const ORIGIN_WEIGHT = { 'ong-table': 0, 'ong-halacha': 0, wikidata: 6, off: 0 };
// Every word of the query must begin a word of the food (its name or another name). Exact names first, then names
// that begin with the query, then the book before open data, then shorter names.
export function scoreEntry(entry, query) {
  const q = normalizeFood(query);
  if (!q) return 0;
  const qTokens = foodTokens(query);
  const hit = tokens => qTokens.every(t => tokens.some(token => token.startsWith(t) || (t.length > 2 && token === stem(t))));
  if (!hit(entry.allTokens)) return 0;
  let score = 10;
  const qStem = qTokens.join(' ');
  if (entry.full === q || entry.names.includes(q) || entry.nameTokens.join(' ') === qStem) score += 100;
  else if (entry.full.startsWith(q) || entry.nameTokens.join(' ').startsWith(qStem)) score += 60;
  else if (entry.names.some(name => name.startsWith(q))) score += 45;
  if (hit(entry.nameTokens)) score += 20;
  if (entry.nameTokens[0] && qTokens[0] && entry.nameTokens[0].startsWith(qTokens[0])) score += 12;
  score += KIND_WEIGHT[entry.record.kind] || 0;
  score += ORIGIN_WEIGHT[entry.record.origin] || 0;
  score -= Math.min(20, entry.full.length / 4);
  return score;
}
export function searchFoods(index, query, limit = 40) {
  const scored = [];
  for (const entry of index) {
    const score = scoreEntry(entry, query);
    if (score > 0) scored.push([score, entry.record]);
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name, 'he'));
  return { total: scored.length, results: scored.slice(0, limit).map(([, record]) => record) };
}

// ---------------------------------------------------------------------------------------------------------------
// Records of the compact open-data file (public/blessings/foods.json.gz): [name, aliases, en, brand, target, origin,
// externalId, via]. target is "r:<rule>" or "b:<book row n>"; via says how the build chose it (see VIA_LABEL).
export const VIA_LABEL = {
  category: 'לפי הקטגוריה של המוצר',
  ingredients: 'לפי רכיבי המוצר',
  name: 'לפי שם המוצר',
  class: 'לפי סוג המאכל בוויקינתונים',
};
export function openDataRecord(row, bookRows) {
  const [name, aliases, en, brand, target, origin, extId, via] = row;
  const bookRow = target.startsWith('b:') ? bookRows.find(item => item.n === Number(target.slice(2))) : null;
  const ruleId = target.startsWith('r:') ? target.slice(2) : null;
  const rule = ruleId ? RULES[ruleId] : null;
  const conditional = rule ? rule.status === 'conditional' : Boolean(bookRow && (!bookRow.beforeKey || !bookRow.afterKey));
  return {
    id: `${origin === 'o' ? 'off' : 'wd'}:${extId}`,
    kind: conditional ? 'conditional' : 'rule',
    origin: origin === 'o' ? 'off' : 'wikidata',
    name, aliases: aliases ? aliases.split('|') : [], en: en || null, brand: brand || null,
    ruleId, bookRow: bookRow || null, extId, via,
  };
}

export const RELATION_LABEL = { agrees: 'מסכים', adds: 'מוסיף פרט', differs: 'פוסק אחרת' };
export const KIND_LABEL = { book: 'מן הספר', rule: 'לפי הכלל', conditional: 'יש בזה דעות' };

const blessingLabel = key => (key && BLESSING[key] ? BLESSING[key].full : null);
const afterLabel = key => (key && AFTER[key] ? AFTER[key].full : null);

// What a card shows for a record, for the reader's rite. Every line that is a ruling carries the source it came from.
export function presentRecord(record, { nusach, sources }) {
  const family = riteFamily(nusach);
  const cite = id => sources[id] || null;
  const view = { id: record.id, otherRite: null, ruleTitle: null, ruleSources: [], examples: [], name: record.name, brand: record.brand || null, kind: record.kind, kindLabel: KIND_LABEL[record.kind], before: null, after: null, bookText: null, conditions: [], nusachNote: null, yalkut: [], sources: [], note: null, via: record.via ? VIA_LABEL[record.via] : null };
  const book = record.kind === 'book' ? record : record.bookRow;
  if (book) {
    view.bookText = book.text;
    view.before = { label: blessingLabel(book.beforeKey), text: book.before };
    view.after = { label: afterLabel(book.afterKey), text: book.after };
    if (book.shiur) view.conditions.push({ text: book.shiur.text, source: cite(book.shiur.source) });
    view.sources.push(book.cite);
    view.yalkut = (book.yalkut || []).map(item => ({ relation: item.relation, relationLabel: RELATION_LABEL[item.relation], source: cite(item.source) })).filter(item => item.source);
    const ruling = book.nusach && NUSACH_RULINGS[book.nusach]?.[family];
    if (ruling) {
      view.nusachNote = { text: ruling.note, sources: ruling.sources.map(cite).filter(Boolean) };
      view.before = { label: blessingLabel(ruling.beforeKey), text: null, byNusach: true };
      view.after = { label: afterLabel(ruling.afterKey), text: null, byNusach: true };
    } else if (book.nusach && NUSACH_RULINGS[book.nusach]?.ashkenazi) {
      const other = NUSACH_RULINGS[book.nusach].ashkenazi;
      view.otherRite = { text: other.note, sources: other.sources.map(cite).filter(Boolean) };
    }
  }
  if (record.kind !== 'book') {
    const rule = record.ruleId ? RULES[record.ruleId] : null;
    if (rule) {
      view.ruleTitle = `לפי הכלל: ${rule.title}`;
      view.before = { label: rule.before === 'cond' ? null : blessingLabel(rule.before), text: null };
      view.after = { label: rule.after === 'cond' ? null : afterLabel(rule.after), text: null };
      view.conditions = rule.conditions.map(text => ({ text, source: null }));
      view.ruleSources = rule.sources.map(cite).filter(Boolean);
      const ruling = rule.nusach && NUSACH_RULINGS[rule.nusach]?.[family];
      if (ruling) {
        view.nusachNote = { text: ruling.note, sources: ruling.sources.map(cite).filter(Boolean) };
        view.before = { label: blessingLabel(ruling.beforeKey), text: null, byNusach: true };
        view.after = { label: afterLabel(ruling.afterKey), text: null, byNusach: true };
      } else if (rule.nusach && NUSACH_RULINGS[rule.nusach]?.ashkenazi) {
        const other = NUSACH_RULINGS[rule.nusach].ashkenazi;
        view.otherRite = { text: other.note, sources: other.sources.map(cite).filter(Boolean) };
      }
      view.examples = rule.bookRows || [];
    } else if (record.bookRow) {
      view.ruleTitle = `לפי הערך בספר: ${record.bookRow.name}`;
    }
    view.note = record.kind === 'conditional' ? 'יש בזה דעות או תנאים שהנתונים אינם מכריעים — לשאול רב.' : 'נקבע לפי כלל — מומלץ לברר במקרה של ספק.';
    view.sources.push(record.origin === 'off' ? 'Open Food Facts (ODbL) · שם המוצר, רכיביו וקטגוריה' : 'ויקינתונים (CC0) · שם המאכל וסוגו');
  }
  return view;
}
