import { YALKUT_YOSEF } from '../data/yalkutYosef.mjs';

export const YALKUT_REFERENCE_PREFIX = 'Yalkut Yosef';
export const yalkutReference = id => `${YALKUT_REFERENCE_PREFIX} ${id}`;
export const yalkutIdFromReference = reference => String(reference || '').replace(`${YALKUT_REFERENCE_PREFIX} `, '');

const normalize = value => String(value || '').replace(/[\u0591-\u05c7]/g, '').replace(/[״”“׳’]/g, '"').replace(/[^\u0590-\u05ff\d\s]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const tokens = value => normalize(value).split(' ').filter(token => token.length > 1);

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
  .map(section => ({ ref: yalkutReference(section.id), label: section.label, size: 1, chapter: chapter }));

export const yalkutText = reference => {
  const section = YALKUT_YOSEF.sections.find(item => item.id === yalkutIdFromReference(reference));
  if (!section) throw new Error('המקור המקומי לא נמצא');
  return {
    ref: yalkutReference(section.id),
    heRef: section.label,
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

export const searchYalkut = (query, limit = 12) => {
  const wanted = tokens(query);
  if (!wanted.length) return [];
  return YALKUT_YOSEF.sections.map(section => {
    const titleText = normalize(`${section.chapter} ${section.section}`);
    const bodyText = normalize(section.text);
    const haystack = `${titleText} ${bodyText}`;
    const titleHits = wanted.filter(token => titleText.includes(token)).length;
    const bodyHits = wanted.filter(token => bodyText.includes(token)).length;
    if (wanted.some(token => !haystack.includes(token))) return null;
    const exactTitle = titleText.includes(normalize(query));
    const exactBody = bodyText.includes(normalize(query));
    let score = bodyHits * 10 + titleHits * 35 + (exactTitle ? 55 : 0) + (exactBody ? 25 : 0);
    const introduction = /^(מבוא|הקדמה)/.test(section.chapter) || /^(מבוא|הקדמה)/.test(section.section);
    const bodyOnly = wanted.filter(token => !titleText.includes(token)).length;
    if (introduction) score -= 80;
    score -= bodyOnly * 4;
    const position = bodyText.indexOf(wanted[0]);
    const start = Math.max(0, position - 70);
    const snippet = section.text.slice(start, start + 180).trim();
    return { id: section.id, ref: yalkutReference(section.id), title: section.section, chapter: section.chapter, section: section.section, snippet, score, introduction, bodyOnly };
  }).filter(Boolean)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .filter((item, index, list) => index === list.findIndex(other => `${other.chapter}|${other.section}` === `${item.chapter}|${item.section}`))
    .slice(0, limit);
};