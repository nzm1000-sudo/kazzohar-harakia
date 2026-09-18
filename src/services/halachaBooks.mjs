// Book-browsing outline for approved Halacha works: ספר → חלק/הלכות → סימן/פרק → סעיף.
// Structure is taken from Sefaria's shape + index (never from array positions alone).
import { getIndex, getShape } from './sefaria.mjs';
import { HALACHA_WORKS } from '../data/halachaLibrary.mjs';

// Peninei Halakhah is a family of separate indices; only the books cited by the question layer are browsable.
export const PENINEI_BOOKS = [
  ['Berakhot', 'ברכות'], ['Prayer', 'תפילה'], ["Women's Prayer", 'תפילת נשים'], ['Shabbat', 'שבת'], ['Kashrut', 'כשרות'],
  ['Family Purity', 'טהרת המשפחה'], ['Zemanim', 'זמנים'], ['Festivals', 'מועדים'], ['Pesach', 'פסח'], ['Sukkot', 'סוכות'],
  ['Likkutim I', 'ליקוטים א'], ['Likkutim II', 'ליקוטים ב'],
];

export const browsableWorks = () => HALACHA_WORKS.filter(w => w.referencePrefix);
export const workById = id => HALACHA_WORKS.find(w => w.id === id);

const heTitleOf = node => node.titles?.find(t => t.lang === 'he' && t.primary)?.text || node.titles?.find(t => t.lang === 'he')?.text || '';
const lastPart = title => String(title).split(', ').pop();
const sizeOf = size => (Array.isArray(size) ? size.length : size);
// Non-halachic parts of otherwise approved works are not browsed here.
const EXCLUDED = { 'ben-ish-hai': /^Ben Ish Hai, (Drashot|Introduction)/ };

// Resolves the shape root for a work: for a complex index whose approved prefix is itself a simple leaf (Beit Yosef, Orach Chayim), use that leaf.
async function shapeRoot(work) {
  const shape = await getShape(work.indexTitle);
  const root = Array.isArray(shape) ? shape[0] : shape;
  if (!root) throw new Error('מבנה הספר אינו זמין');
  if (root.isComplex) {
    const leaf = root.chapters.find(c => c.title === work.referencePrefix && Array.isArray(c.chapters));
    if (leaf) return { ...leaf, isComplex: false, length: leaf.length ?? leaf.chapters.length };
  }
  return root;
}
const leafAllowed = (work, leaf) => leaf.title.startsWith(work.referencePrefix) && !/, Introduction$/.test(leaf.title) && typeof leaf.length === 'number' && !(EXCLUDED[work.id]?.test(leaf.title));

// Returns [{ key, title, count, group }] — units a reader can open a table of contents for.
export async function bookOutline(work) {
  if (work.id === 'peninei-halakhah') {
    return PENINEI_BOOKS.map(([en, he]) => ({ key: en, title: he, group: null }));
  }
  const root = await shapeRoot(work);
  if (root.isComplex) {
    // Complex work: leaves are full section refs. Keep only leaves under the approved prefix, grouped by parent path.
    const leaves = root.chapters.filter(leaf => leafAllowed(work, leaf));
    const groups = new Map();
    for (const leaf of leaves) {
      const parent = leaf.title.split(', ').slice(0, -1).join(', ');
      if (!groups.has(parent)) groups.set(parent, { key: parent, title: leaf.heTitle.split(', ').slice(0, -1).join(', '), count: 0 });
      groups.get(parent).count++;
    }
    return [...groups.values()];
  }
  // Simple work (e.g. Shulchan Arukh): try the "Topic" alt-struct for named הלכות groups; otherwise blocks of 50 simanim.
  const total = root.length;
  const index = await getIndex(work.indexTitle).catch(() => null);
  const topics = (index?.alt_structs?.Topic?.nodes || []).filter(node => String(node.wholeRef || '').startsWith(work.referencePrefix + ' '));
  if (topics.length) {
    return topics.map(node => {
      const m = /(\d+)(?:-(\d+))?$/.exec(node.wholeRef || '');
      const from = m ? Number(m[1]) : 1, to = m ? Number(m[2] || m[1]) : from;
      return { key: `${from}-${to}`, title: heTitleOf(node), count: to - from + 1, from, to };
    }).filter(u => u.from <= total);
  }
  const units = [];
  for (let from = 1; from <= total; from += 50) { const to = Math.min(from + 49, total); units.push({ key: `${from}-${to}`, title: `סימנים ${from}–${to}`, count: to - from + 1, from, to }); }
  return units;
}

// Returns [{ ref, label, size }] — sections inside a unit; each ref opens directly in the reader.
export async function unitSections(work, key) {
  if (work.id === 'peninei-halakhah') {
    const book = PENINEI_BOOKS.find(([en]) => en === key);
    if (!book) throw new Error('הספר לא נמצא');
    const shape = await getShape(`Peninei Halakhah, ${book[0]}`);
    const root = Array.isArray(shape) ? shape[0] : shape;
    // textDepth 3 (Chapter › Section › Paragraph): a chapter request returns only its first section, so we list sections explicitly.
    return root.chapters.flatMap((chapter, ci) => Array.isArray(chapter)
      ? chapter.map((paragraphs, si) => ({ ref: `Peninei Halakhah, ${book[0]} ${ci + 1}:${si + 1}`, label: `פרק ${ci + 1}, הלכה ${si + 1}`, size: sizeOf(paragraphs), chapter: ci + 1 }))
      : [{ ref: `Peninei Halakhah, ${book[0]} ${ci + 1}`, label: `פרק ${ci + 1}`, size: chapter, chapter: ci + 1 }]);
  }
  const root = await shapeRoot(work);
  if (root.isComplex) {
    return root.chapters
      .filter(leaf => leafAllowed(work, leaf) && leaf.title.startsWith(key + ', ') && leaf.title.split(', ').length === key.split(', ').length + 1)
      // A depth-2 leaf (e.g. Ben Ish Hai parasha: Seif › Paragraph) answers a bare request with its first seif only, so open the full range explicitly.
      .map(leaf => ({ ref: Array.isArray(leaf.chapters) && leaf.length > 1 ? `${leaf.title} 1-${leaf.length}` : leaf.title, label: lastPart(leaf.heTitle), size: leaf.length }));
  }
  const m = /^(\d+)-(\d+)$/.exec(key);
  if (!m) throw new Error('טווח סימנים אינו תקין');
  const from = Number(m[1]), to = Math.min(Number(m[2]), root.length);
  const out = [];
  for (let n = from; n <= to; n++) out.push({ ref: `${work.referencePrefix} ${n}`, label: `סימן ${n}`, size: sizeOf(root.chapters[n - 1]) });
  return out;
}
