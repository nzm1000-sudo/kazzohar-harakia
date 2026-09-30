import { YALKUT_YOSEF } from '../data/yalkutYosef.mjs';
import { hebrewLocations, hebrewNumeral } from './hebrewNumerals.mjs';

export const YALKUT_REFERENCE_PREFIX = 'Yalkut Yosef';
export const yalkutReference = id => `${YALKUT_REFERENCE_PREFIX} ${id}`;
export const yalkutIdFromReference = reference => String(reference || '').replace(`${YALKUT_REFERENCE_PREFIX} `, '');

const normalize = value => String(value || '').replace(/[\u0591-\u05c7]/g, '').replace(/[״”“׳’]/g, '"').replace(/[^\u0590-\u05ff\d\s]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const tokens = value => normalize(value).split(' ').filter(token => token.length > 1);
const displayTitle = value => String(value || '').replace(/^סימן(?:ים)?\s+[^-]+-\s*/u, '').trim();

export const yalkutBook = () => ({
  id: YALKUT_YOSEF.id,
  title: YALKUT_YOSEF.title,
  author: YALKUT_YOSEF.author,
  edition: YALKUT_YOSEF.edition,
  provider: YALKUT_YOSEF.provider,
  license: YALKUT_YOSEF.license,
  licenseNote: 'שימוש לא־מסחרי בלבד · CC BY-NC-SA 2.5',
  referencePrefix: YALKUT_REFERENCE_PREFIX,
  sourceUrl: YALKUT_YOSEF.sourceUrl,
  contentType: 'ruling',
  copyrightStatus: 'cc-by-nc-sa',
  coverage: ['השכמת הבוקר', 'נטילת ידיים', 'ציצית', 'תפילין', 'תפילה', 'קריאת שמע', 'בית הכנסת', 'ספר תורה', 'ברכות', 'ברכת המזון', 'שבת', 'מועדים', 'כשרות', 'אבלות'],
});

export const yalkutOutline = () => [...new Map(YALKUT_YOSEF.sections.map(section => [section.chapter, section])).values()]
  .map((section, index) => ({ key: section.chapter, title: section.chapter, count: YALKUT_YOSEF.sections.filter(item => item.chapter === section.chapter).length, index }));

export const yalkutSections = chapter => YALKUT_YOSEF.sections.filter(section => section.chapter === chapter)
  .map(section => ({ ref: yalkutReference(section.id), label: hebrewLocations(section.label), size: 1, chapter: chapter }));

export const yalkutText = reference => {
  const section = YALKUT_YOSEF.sections.find(item => item.id === yalkutIdFromReference(reference));
  if (!section) throw new Error('המקור המקומי לא נמצא');
  return {
    ref: yalkutReference(section.id),
    heRef: hebrewLocations(section.label),
    policy: 'source',
    category: 'Halakhah',
    hebrew: [section.text],
    indexes: [0],
    version: `${YALKUT_YOSEF.edition} · ${YALKUT_YOSEF.provider}`,
    license: YALKUT_YOSEF.license,
    sourceUrl: YALKUT_YOSEF.sourceUrl,
    bundledOffline: true,
    localSource: true,
    attribution: YALKUT_YOSEF.attribution,
    rightsNotice: YALKUT_YOSEF.rightsNotice,
  };
};

// A section's normalized text never changes: it is prepared once, not on every search (the search runs as the user types).
const sectionCache = new WeakMap();
let sectionsPrepared = 0;
// Sections normalized so far, and words whose sections are remembered (tests: a search never re-normalizes the book).
export const yalkutSearchStats = () => ({ sectionsPrepared, wordsRemembered: hitsCache.size });
function sectionIndex(section) {
  let index = sectionCache.get(section);
  if (!index) {
    sectionsPrepared++;
    const titleText = normalize(`${section.chapter} ${section.section}`);
    const bodyText = normalize(section.text);
    index = { titleText, bodyText, titleTokens: new Set(tokens(titleText)), haystack: `${titleText} ${bodyText}` };
    sectionCache.set(section, index);
  }
  return index;
}
// Keeps the first (best-scored) result of each section — the same as comparing each with all before it, in one pass.
const firstOfEachSection = () => { const seen = new Set(); return item => { const key = `${item.chapter}|${item.section}`; if (seen.has(key)) return false; seen.add(key); return true; }; };
// Which sections contain a word, remembered for the last words searched. Typing extends a query a letter at a time, and
// a section that contains "יעלה" must contain "יעל": a longer word is looked for only among the sections that held the
// shorter one, so a keystroke's search scans a few sections instead of all 14,000. Scores and order are unchanged.
const hitsCache = new Map();
function sectionsWith(token) {
  let hits = hitsCache.get(token);
  if (hits) return hits;
  let base = null;
  for (const [known, list] of hitsCache) if (token.includes(known) && (!base || list.length < base.length)) base = list;
  const all = YALKUT_YOSEF.sections;
  hits = [];
  if (base) { for (const i of base) if (sectionIndex(all[i]).haystack.includes(token)) hits.push(i); }
  else for (let i = 0; i < all.length; i++) if (sectionIndex(all[i]).haystack.includes(token)) hits.push(i);
  if (hitsCache.size >= 96) hitsCache.delete(hitsCache.keys().next().value);
  hitsCache.set(token, hits);
  return hits;
}
export const searchYalkut = (query, limit = 12, options = {}) => {
  const wanted = tokens(query);
  if (!wanted.length) return [];
  const wholeQuery = normalize(query);
  // Every word must appear in the section: the candidates are the sections holding all of them.
  const lists = [...new Set(wanted)].map(sectionsWith).sort((a, b) => a.length - b.length);
  const others = lists.slice(1).map(list => new Set(list));
  const candidates = lists[0].filter(i => others.every(set => set.has(i))).sort((a, b) => a - b).map(i => YALKUT_YOSEF.sections[i]);
  return candidates.map(section => {
    const { titleText, bodyText, titleTokens } = sectionIndex(section);
    const titleHits = wanted.filter(token => titleTokens.has(token)).length;
    const bodyHits = wanted.filter(token => bodyText.includes(token)).length;
    const exactTitle = titleText.includes(wholeQuery);
    const exactBody = bodyText.includes(wholeQuery);
    if (options.requireTitleMatch && !titleHits && !exactTitle) return null;
    let score = bodyHits * 10 + titleHits * 35 + (exactTitle ? 55 : 0) + (exactBody ? 25 : 0);
    const introduction = /^(מבוא|הקדמה)/.test(section.chapter) || /^(מבוא|הקדמה)/.test(section.section);
    const bodyOnly = wanted.filter(token => !titleText.includes(token)).length;
    if (introduction) score -= 80;
    score -= bodyOnly * 4;
    const position = bodyText.indexOf(wanted[0]);
    const start = Math.max(0, position - 70);
    const snippet = section.text.slice(start, start + 180).trim();
    const halacha = section.label.match(/·\s*הלכה\s+(.+)$/u)?.[1] || section.halachaIndex;
    return { id: section.id, ref: yalkutReference(section.id), title: displayTitle(section.section), citation: `${section.section}, סעיף ${/^\d+$/.test(String(halacha)) ? hebrewNumeral(Number(halacha)) : halacha}`, chapter: section.chapter, section: section.section, snippet, score, introduction, bodyOnly };
  }).filter(Boolean)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .filter(firstOfEachSection())
    .slice(0, limit);
};