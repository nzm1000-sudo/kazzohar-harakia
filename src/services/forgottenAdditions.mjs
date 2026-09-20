// Structured decision trees. Source metadata is stored apart from display text and
// nothing below production-approved is rendered as a final practical ruling.
export const REVIEW_STATES = Object.freeze({
  DRAFT: 'draft',
  SOURCE_VERIFIED: 'source-verified',
  HALACHICALLY_REVIEWED: 'halachically-reviewed',
  PRODUCTION_APPROVED: 'production-approved',
});

export const REVIEW_LABELS = Object.freeze({
  [REVIEW_STATES.DRAFT]: 'טיוטה',
  [REVIEW_STATES.SOURCE_VERIFIED]: 'מידע מקורות לבדיקה',
  [REVIEW_STATES.HALACHICALLY_REVIEWED]: 'מידע מקורות לבדיקה',
  [REVIEW_STATES.PRODUCTION_APPROVED]: 'הנחיה מעשית',
});

export function isPractical(reviewState) {
  return reviewState === REVIEW_STATES.PRODUCTION_APPROVED;
}

const SOURCES = Object.freeze({
  yaalehVeyavo: { primary: 'שולחן ערוך אורח חיים תכ״ב', secondary: 'ילקוט יוסף, תפילה ב׳, דיני יעלה ויבוא' },
  alHanissim: { primary: 'שולחן ערוך אורח חיים תרפ״ב', secondary: 'ילקוט יוסף, מועדים, חנוכה' },
  mashivHaruach: { primary: 'שולחן ערוך אורח חיים קי״ד', secondary: 'ילקוט יוסף, תפילה א׳, סימן קי״ד' },
  vetenTalUmatar: { primary: 'שולחן ערוך אורח חיים קי״ז', secondary: 'ילקוט יוסף, תפילה א׳, סימן קי״ז' },
  aneinu: { primary: 'שולחן ערוך אורח חיים תקס״ה', secondary: 'ילקוט יוסף, מועדים, תעניות' },
});

const NEEDS_DETAIL = 'המצב הזה תלוי בפרטים נוספים. יש לברר מול מורה הוראה לפני מעשה.';

function outcome(summary, sourceKey, extra = {}) {
  return {
    kind: 'outcome',
    summary,
    source: SOURCES[sourceKey],
    reviewState: extra.reviewState || REVIEW_STATES.SOURCE_VERIFIED,
    needsRav: extra.needsRav === true,
    detail: extra.detail || '',
  };
}

function question(text, options) {
  return { kind: 'question', text, options };
}

export const FORGOTTEN_ADDITIONS = Object.freeze({
  'yaaleh-veyavo': {
    id: 'yaaleh-veyavo',
    title: 'שכחתי יעלה ויבוא',
    context: 'ראש חודש, חול המועד ומועדים',
    sourceKey: 'yaalehVeyavo',
    start: 'prayer',
    nodes: {
      prayer: question('באיזו תפילה שכחת?', [
        { label: 'ערבית', next: 'arvit-day' },
        { label: 'שחרית', next: 'position' },
        { label: 'מנחה', next: 'position' },
        { label: 'ברכת המזון', next: 'birkat' },
      ]),
      'arvit-day': question('באיזה יום מדובר?', [
        { label: 'ראש חודש', outcome: outcome('במקורות מובא שבערבית של ראש חודש אין חוזרים על התפילה.', 'yaalehVeyavo', { detail: 'הטעם: אין מקדשים את החודש בלילה.' }) },
        { label: 'חול המועד או יום טוב', outcome: outcome('במועדים הדין שונה מראש חודש ותלוי בפרטי היום.', 'yaalehVeyavo', { needsRav: true, detail: NEEDS_DETAIL }) },
      ]),
      position: question('היכן נזכרת?', [
        { label: 'לפני שסיימתי את ברכת רצה', next: 'before-seal' },
        { label: 'אחרי רצה, לפני סיום העמידה', next: 'after-retzei' },
        { label: 'אחרי שסיימתי את כל העמידה', outcome: outcome('לאחר סיום העמידה המקורות דנים בחזרה על התפילה בשחרית ובמנחה.', 'yaalehVeyavo', { needsRav: true, detail: NEEDS_DETAIL }) },
      ]),
      'before-seal': question('האם כבר אמרת את שם ה׳ בחתימת הברכה?', [
        { label: 'לא, עוד לא הגעתי לחתימה', outcome: outcome('כל עוד לא נאמרה החתימה, המקורות מדברים על אמירת יעלה ויבוא במקומה.', 'yaalehVeyavo') },
        { label: 'כן, כבר אמרתי שם ה׳', outcome: outcome('לאחר אמירת שם ה׳ בחתימה יש דינים נפרדים לפי מקום העצירה.', 'yaalehVeyavo', { needsRav: true, detail: NEEDS_DETAIL }) },
      ]),
      'after-retzei': question('האם כבר התחלת מודים?', [
        { label: 'עוד לא התחלתי מודים', outcome: outcome('המקורות דנים באמירת יעלה ויבוא קודם שממשיכים.', 'yaalehVeyavo', { needsRav: true, detail: NEEDS_DETAIL }) },
        { label: 'כבר התחלתי מודים', outcome: outcome('לאחר שהתחילו מודים הדין תלוי בהמשך התפילה.', 'yaalehVeyavo', { needsRav: true, detail: NEEDS_DETAIL }) },
      ]),
      birkat: question('באיזה יום מדובר?', [
        { label: 'ראש חודש', outcome: outcome('בברכת המזון של ראש חודש יש דין נפרד מהתפילה.', 'yaalehVeyavo', { needsRav: true, detail: NEEDS_DETAIL }) },
        { label: 'חול המועד או יום טוב', outcome: outcome('ביום טוב ובחול המועד דיני ברכת המזון שונים זה מזה.', 'yaalehVeyavo', { needsRav: true, detail: NEEDS_DETAIL }) },
      ]),
    },
  },
  'al-hanissim': {
    id: 'al-hanissim',
    title: 'שכחתי על הניסים',
    context: 'חנוכה ופורים',
    sourceKey: 'alHanissim',
    start: 'where',
    nodes: {
      where: question('היכן שכחת?', [
        { label: 'בתפילת העמידה', next: 'amida' },
        { label: 'בברכת המזון', next: 'birkat' },
      ]),
      amida: question('האם כבר סיימת את ברכת מודים?', [
        { label: 'עדיין בברכת מודים', outcome: outcome('כל עוד לא נחתמה הברכה, המקורות מדברים על אמירת על הניסים במקומה.', 'alHanissim') },
        { label: 'כבר סיימתי את הברכה', outcome: outcome('לפי המקורות על הניסים אינו מעכב ואין חוזרים על התפילה בשבילו.', 'alHanissim', { detail: 'יש מקורות המזכירים אמירה בסוף התפילה בדרך בקשה.' }) },
      ]),
      birkat: question('האם כבר סיימת את ברכת הארץ?', [
        { label: 'עדיין בברכת הארץ', outcome: outcome('כל עוד לא נחתמה הברכה, המקורות מדברים על אמירה במקומה.', 'alHanissim') },
        { label: 'כבר סיימתי', outcome: outcome('לפי המקורות אין חוזרים על ברכת המזון בשביל על הניסים.', 'alHanissim') },
      ]),
    },
  },
  'mashiv-haruach': {
    id: 'mashiv-haruach',
    title: 'שכחתי משיב הרוח',
    context: 'מברכת גשם ועד פסח',
    sourceKey: 'mashivHaruach',
    start: 'what',
    nodes: {
      what: question('מה קרה בפועל?', [
        { label: 'שכחתי לומר משיב הרוח בימות הגשמים', next: 'winter' },
        { label: 'אמרתי משיב הרוח בימות הקיץ', next: 'summer' },
      ]),
      winter: question('היכן נזכרת?', [
        { label: 'לפני שסיימתי את ברכת מחיה המתים', outcome: outcome('כל עוד לא נחתמה הברכה, המקורות מדברים על אמירה במקומה.', 'mashivHaruach') },
        { label: 'אחרי סיום הברכה, לפני סיום העמידה', outcome: outcome('המקורות דנים בהבדל בין הזכרת גשם להזכרת טל ובהשלכותיה.', 'mashivHaruach', { needsRav: true, detail: NEEDS_DETAIL }) },
        { label: 'אחרי סיום כל העמידה', outcome: outcome('לאחר סיום העמידה יש דיון במקורות על חזרה לתפילה.', 'mashivHaruach', { needsRav: true, detail: NEEDS_DETAIL }) },
      ]),
      summer: question('האם סיימת את העמידה?', [
        { label: 'עוד לא סיימתי', outcome: outcome('המקורות דנים בתיקון במקום לפי שלב התפילה.', 'mashivHaruach', { needsRav: true, detail: NEEDS_DETAIL }) },
        { label: 'כבר סיימתי', outcome: outcome('הזכרת גשם בימות הקיץ נדונה במקורות כשינוי המצריך בירור.', 'mashivHaruach', { needsRav: true, detail: NEEDS_DETAIL }) },
      ]),
    },
  },
  'veten-tal-umatar': {
    id: 'veten-tal-umatar',
    title: 'שכחתי ותן טל ומטר',
    context: 'ברכת השנים בימות הגשמים',
    sourceKey: 'vetenTalUmatar',
    start: 'where',
    nodes: {
      where: question('היכן נזכרת?', [
        { label: 'עדיין בברכת השנים', outcome: outcome('כל עוד לא נחתמה הברכה, המקורות מדברים על אמירה במקומה.', 'vetenTalUmatar') },
        { label: 'אחרי ברכת השנים, לפני שומע תפילה', outcome: outcome('המקורות מזכירים אפשרות לבקש בשומע תפילה.', 'vetenTalUmatar', { detail: 'יש לברר את הנוסח המדויק לפי המנהג.' }) },
        { label: 'אחרי שומע תפילה, לפני סיום העמידה', outcome: outcome('המקורות דנים בחזרה לברכת השנים לפי מקום העצירה.', 'vetenTalUmatar', { needsRav: true, detail: NEEDS_DETAIL }) },
        { label: 'אחרי סיום העמידה', outcome: outcome('לאחר סיום העמידה יש דיון במקורות על חזרה על התפילה.', 'vetenTalUmatar', { needsRav: true, detail: NEEDS_DETAIL }) },
      ]),
    },
  },
  aneinu: {
    id: 'aneinu',
    title: 'שכחתי עננו',
    context: 'תעניות ציבור',
    sourceKey: 'aneinu',
    start: 'who',
    nodes: {
      who: question('מי אתה בתפילה?', [
        { label: 'מתפלל יחיד', next: 'individual' },
        { label: 'שליח ציבור', outcome: outcome('לשליח ציבור יש דין נפרד באמירת עננו כברכה בפני עצמה.', 'aneinu', { needsRav: true, detail: NEEDS_DETAIL }) },
      ]),
      individual: question('היכן נזכרת?', [
        { label: 'עדיין בשומע תפילה', outcome: outcome('כל עוד לא נחתמה הברכה, המקורות מדברים על אמירה במקומה.', 'aneinu') },
        { label: 'אחרי שומע תפילה, לפני סיום העמידה', outcome: outcome('המקורות מזכירים אמירה בסוף התפילה בדרך בקשה.', 'aneinu', { detail: 'יש לברר את המקום המדויק לפי המנהג.' }) },
        { label: 'אחרי סיום העמידה', outcome: outcome('לפי המקורות אין חוזרים על התפילה בשביל עננו.', 'aneinu') },
      ]),
    },
  },
});

export function listForgottenTopics() {
  return Object.values(FORGOTTEN_ADDITIONS).map(topic => ({
    id: topic.id,
    title: topic.title,
    context: topic.context,
  }));
}

export function getTopic(topicId) {
  return FORGOTTEN_ADDITIONS[topicId] || null;
}

export function getNode(topicId, nodeId) {
  const topic = getTopic(topicId);
  if (!topic) return null;
  return topic.nodes[nodeId || topic.start] || null;
}

// Replays an answer path so the flow stays a pure function of the selected options.
export function resolvePath(topicId, path = []) {
  const topic = getTopic(topicId);
  if (!topic) return { topic: null, steps: [], current: null, outcome: null };
  const steps = [];
  let nodeId = topic.start;
  for (const choice of path) {
    const node = topic.nodes[nodeId];
    if (!node || node.kind !== 'question') break;
    const option = node.options[choice];
    if (!option) break;
    steps.push({ nodeId, question: node.text, answer: option.label });
    if (option.outcome) return { topic, steps, current: null, outcome: option.outcome };
    nodeId = option.next;
  }
  const current = topic.nodes[nodeId] || null;
  return { topic, steps, current: current && current.kind === 'question' ? current : null, outcome: null };
}
