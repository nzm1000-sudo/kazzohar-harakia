// accepted.json (mechanically verified) → src/data/halachaEngineEntries.mjs, in the PRACTICAL_HALACHA_QA shape.
import { readFileSync, writeFileSync } from 'node:fs';
const DIR = new URL('.', import.meta.url).pathname;
// HALACHA_STAGE=tracks: accepted-tracks.json → src/data/halachaTrackEntries.mjs (HALACHA_TRACK_ENTRIES), same shape.
const STAGE = process.env.HALACHA_STAGE || '';
const OUT = STAGE === 'tracks' ? '/Users/nitz/.cline/data/workspaces/chat/kazzohar-harakia/src/data/halachaTrackEntries.mjs' : '/Users/nitz/.cline/data/workspaces/chat/kazzohar-harakia/src/data/halachaEngineEntries.mjs';
const EXPORT = STAGE === 'tracks' ? 'HALACHA_TRACK_ENTRIES' : 'HALACHA_ENGINE_ENTRIES';
const editorial = JSON.parse(readFileSync(`${DIR}editorial.json`, 'utf8'));
// Editorial pass: askedOn pages that ask a different case are removed; entries judged misleading are dropped.
const accepted = JSON.parse(readFileSync(`${DIR}accepted${STAGE ? `-${STAGE}` : ''}.json`, 'utf8')).filter(e => !(e.id in editorial.drop))
  .map(e => e.id in editorial.dropAskedOn ? { ...e, askedOn: [] } : e)
  .map(e => editorial.contexts?.[e.id] ? { ...e, contexts: editorial.contexts[e.id] } : e)
  .map(e => ({ ...e, askedOn: e.askedOn.filter(url => !Object.keys(editorial.dropUrls || {}).some(bad => url.includes(bad))) }));
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
// Topic names aligned with the library's existing topics, so one topic page holds old and new entries together.
const TOPIC = {
  'prayer:נטילת ידיים': ['prayer', 'נטילת ידיים שחרית'], 'prayer:תפילת העמידה': ['prayer', 'עמידה'], 'prayer:סיום התפילה': ['prayer', 'עמידה'],
  'prayer:חזרת הש"ץ': ['prayer', 'עמידה'], 'prayer:קדיש': ['prayer', 'קדיש ועניית אמן'], 'prayer:מניין': ['prayer', 'תפילה בציבור'],
  'blessings:נטילת ידים': ['blessings', 'נטילת ידיים'],
  'shabbat:הדלקת נרות שבת': ['shabbat', 'הדלקת נרות'], 'shabbat:מוצאי שבת והבדלה': ['shabbat', 'הבדלה'], 'shabbat:הוצאה ועירוב': ['shabbat', 'עירוב וטלטול'],
  'shabbat:חשמל ומכשירים': ['shabbat', 'חשמל'], 'shabbat:בישול בשבת': ['shabbat', 'בישול'], 'shabbat:סחיטה': ['shabbat', 'מלאכות שבת'],
  'shabbat:טוחן': ['shabbat', 'מלאכות שבת'], 'shabbat:משחקים ופנאי בשבת': ['shabbat', 'מוקצה'],
  'holidays:חמץ שעבר עליו הפסח': ['holidays', 'מאכלים בפסח'], 'holidays:תעניות ציבור': ['holidays', 'תעניות'], 'holidays:יום הכפורים': ['holidays', 'יום הכיפורים'],
  'family:כיבוד אב ואם': ['family', 'כיבוד הורים'], 'family:ברית מילה': ['family', 'ברית ופדיון הבן'], 'family:פדיון הבן': ['family', 'ברית ופדיון הבן'],
  'family:חנוכת הבית': ['family', 'מזוזה וחנוכת בית'], 'daily:מזוזה': ['family', 'מזוזה וחנוכת בית'], 'daily:תלמוד תורה': ['daily', 'לימוד תורה'],
  'money:צדקה': ['money', 'צדקה ומעשר'], 'health:ביקור חולים': ['family', 'ביקור חולים'],
  // Stage 5 (learning tracks): the drafters' topic names, placed in the library's own topic tree.
  'kashrut:הגעלת כלים': ['kashrut', 'הגעלה'], 'prayer:ספירת העומר': ['holidays', 'ספירת העומר'], 'prayer:מנהגי ימי הספירה': ['holidays', 'מנהגי ימי הספירה'],
  'family:ראש חודש': ['holidays', 'ראש חודש'], 'shabbat:ברכת החודש': ['holidays', 'ראש חודש'], 'shabbat:שבת בנופש': ['travel', 'מלון ואירוח'],
  'holidays:שבת בנופש': ['travel', 'מלון ואירוח'], 'family:קידוש': ['shabbat', 'קידוש'], 'family:סעודות שבת': ['shabbat', 'סעודות שבת'],
  'blessings:אורחים': ['travel', 'מלון ואירוח'], 'blessings:תפילת הדרך': ['prayer', 'תפילת הדרך'], 'prayer:בדרך': ['prayer', 'תפילה בעבודה ובנסיעה'],
  'prayer:תפילה בדרך': ['prayer', 'תפילה בעבודה ובנסיעה'], 'blessings:בדרך': ['travel', 'מזון וכלים בנסיעה'], 'shabbat:בדרך': ['travel', 'זמנים בנסיעה'],
  'kashrut:כשרות בדרכים': ['travel', 'מזון וכלים בנסיעה'],
};
for (const e of accepted) { const to = TOPIC[`${e.category}:${clean(e.topic)}`]; if (to) [e.category, e.topic] = to; }
const entries = accepted.map(e => ({
  id: e.id,
  question: clean(e.question),
  shortAnswer: clean(e.shortAnswer),
  variants: [...new Set((e.variants || []).map(clean).filter(Boolean))].slice(0, 6),
  category: e.category,
  topic: clean(e.topic),
  ...(e.subtopic ? { subtopic: clean(e.subtopic) } : {}),
  tags: [...new Set((e.tags || []).map(clean).filter(Boolean))].slice(0, 8),
  ruleType: e.ruleType,
  contexts: e.contexts,
  ...(e.timeOfDay ? { timeOfDay: e.timeOfDay } : {}),
  source: { localSourceId: e.sectionId, citation: e.citation, sectionTitle: e.sectionTitle, excerpt: clean(e.excerpt), ...(e.furtherRefs.length ? { furtherRefs: e.furtherRefs } : {}) },
  ...(e.extraSources?.length ? { supportingSources: e.extraSources.map(extra => ({ localSourceId: extra.sectionId, citation: extra.citation, excerpt: clean(extra.excerpt) })) } : {}),
  ...(e.askedOn.length ? { askedOn: e.askedOn } : {}),
  ...(e.relatedSourceQuestion ? { relatedSourceQuestion: e.relatedSourceQuestion } : {}),
}));
writeFileSync(OUT, `// Halacha Engine entries — practical questions people ask, answered from קיצור שולחן ערוך ילקוט יוסף
// (הרב יצחק יוסף, מהדורת תשס"ז; CC BY-NC-SA 2.5 via תורת אמת). Generated; every entry passed mechanical verification:
// its excerpt is a verbatim span of the cited section, its siman/se'if citation is computed from that section, its
// category comes from the section's place in the book, and it duplicates no existing answer. Questions were collected
// from public Q&A sites as leads only ("askedOn" keeps pages that loaded); no answer text was taken from them.
export const ${EXPORT} = ${JSON.stringify(entries, null, 1)};
`);
console.log('wrote', entries.length);
