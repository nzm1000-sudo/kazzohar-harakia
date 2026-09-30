// accepted.json (mechanically verified) → src/data/halachaEngineEntries.mjs, in the PRACTICAL_HALACHA_QA shape.
import { readFileSync, writeFileSync } from 'node:fs';
const DIR = new URL('.', import.meta.url).pathname;
// HALACHA_STAGE=tracks: accepted-tracks.json → src/data/halachaTrackEntries.mjs (HALACHA_TRACK_ENTRIES), same shape.
const STAGE = process.env.HALACHA_STAGE || '';
const PRACTICAL = STAGE === 'practical';
const DATA = '/Users/nitz/.cline/data/workspaces/chat/kazzohar-harakia/src/data/';
// HALACHA_STAGE=practical: accepted-practical.json → src/data/halachaPracticalEntries.mjs (HALACHA_PRACTICAL_ENTRIES).
const OUT = PRACTICAL ? `${DATA}halachaPracticalEntries.mjs` : STAGE === 'tracks' ? `${DATA}halachaTrackEntries.mjs` : `${DATA}halachaEngineEntries.mjs`;
const EXPORT = PRACTICAL ? 'HALACHA_PRACTICAL_ENTRIES' : STAGE === 'tracks' ? 'HALACHA_TRACK_ENTRIES' : 'HALACHA_ENGINE_ENTRIES';
const CHECKED_AT = process.env.HALACHA_CHECKED_AT || '2026-09-30';
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
for (const e of accepted) { const to = !e.place && TOPIC[`${e.category}:${clean(e.topic)}`]; if (to) [e.category, e.topic] = to; }
// Stage 6 fields: what changes the law, exceptions, the scenario in plain words, search phrasings beyond the variants,
// related cases, a dispute when there is one, and provenance kept apart — where the question was found (discovery
// only, no text taken), the ruling source, how it was verified, and the licence.
const practicalFields = e => ({
  ...(e.scenario ? { scenario: clean(e.scenario) } : {}),
  conditions: (e.conditions || []).map(clean),
  ...(e.exceptions?.length ? { exceptions: e.exceptions.map(clean) } : {}),
  ...(e.searchTerms?.length ? { searchTerms: [...new Set(e.searchTerms.map(clean))] } : {}),
  ...(e.related?.length ? { related: e.related } : {}),
  ...(e.dispute ? { dispute: clean(e.dispute) } : {}),
  ...(e.personal ? { personal: true } : {}),
  provenance: {
    discovery: e.discovery.map(d => ({ site: clean(d.site), ...(d.url ? { url: d.url } : {}), use: 'question-only' })),
    rulingSource: `קיצור שולחן ערוך ילקוט יוסף (הרב יצחק יוסף, מהדורת תשס"ז), ${e.citation}`,
    verification: 'excerpt-verbatim-in-bundled-section',
    ...(e.extraSources?.length ? { supporting: e.extraSources.map(extra => extra.citation) } : {}),
    licence: 'CC BY-NC-SA 2.5 (תורת אמת)',
    wording: 'independent',
    checkedAt: CHECKED_AT,
  },
});
const entries = accepted.map(e => ({
  id: e.id,
  question: clean(e.question),
  shortAnswer: clean(e.shortAnswer),
  variants: [...new Set((e.variants || []).map(clean).filter(Boolean))].slice(0, PRACTICAL ? 12 : 6),
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
  ...(PRACTICAL ? practicalFields(e) : {}),
}));
const HEADER = PRACTICAL ? `// Practical-gap entries (stage 6) — everyday questions (the kitchen, blessings on the go, prayer mistakes, travel,
// between people) answered from קיצור שולחן ערוך ילקוט יוסף (הרב יצחק יוסף, מהדורת תשס"ז; CC BY-NC-SA 2.5 via תורת
// אמת). Generated by scripts/halacha (HALACHA_STAGE=practical); every entry passed the same mechanical verification as
// the Halacha Engine: a verbatim excerpt of the cited section, a citation computed from it, no duplicate of any
// published answer. The question and answer are worded independently; Q&A sites were used to find questions only.
` : null;
writeFileSync(OUT, HEADER ? `${HEADER}export const ${EXPORT} = ${JSON.stringify(entries, null, 1)};
` : `// Halacha Engine entries — practical questions people ask, answered from קיצור שולחן ערוך ילקוט יוסף
// (הרב יצחק יוסף, מהדורת תשס"ז; CC BY-NC-SA 2.5 via תורת אמת). Generated; every entry passed mechanical verification:
// its excerpt is a verbatim span of the cited section, its siman/se'if citation is computed from that section, its
// category comes from the section's place in the book, and it duplicates no existing answer. Questions were collected
// from public Q&A sites as leads only ("askedOn" keeps pages that loaded); no answer text was taken from them.
export const ${EXPORT} = ${JSON.stringify(entries, null, 1)};
`);
console.log('wrote', entries.length);
