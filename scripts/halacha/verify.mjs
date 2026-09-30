// Mechanical verification of drafted halacha entries. Nothing enters the app unless it passes.
// Usage: node verify.mjs [--skip-urls]  (reads out-*.json; writes accepted.json, rejected.json, report.json)
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
const REPO = '/Users/nitz/.cline/data/workspaces/chat/kazzohar-harakia/';
const { YALKUT_YOSEF } = await import(`${REPO}src/data/yalkutYosef.mjs`);
const { hebrewNumeral } = await import(`${REPO}src/services/hebrewNumerals.mjs`);
const { PRACTICAL_HALACHA_QA } = await import(`${REPO}src/data/practicalHalachaQa.mjs`);
const { HALACHA_QUESTIONS } = await import(`${REPO}src/data/halachaQuestions.mjs`);
const { normalizeQuery } = await import(`${REPO}src/services/halachaSearch.mjs`);

const DIR = new URL('.', import.meta.url).pathname;
const SKIP_URLS = process.argv.includes('--skip-urls');
const norm = s => String(s || '').replace(/[֑-ׇ]/g, '').replace(/[״“”„]/g, '"').replace(/''/g, '"').replace(/[׳‘’`]/g, "'").replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
const words = s => new Set(norm(s).replace(/[^א-ת ]/g, ' ').split(' ').filter(w => w.length > 1 && !/^(מה|האם|מותר|אסור|צריך|אפשר|של|על|את|עם|יש|זה|או|אם|מתי|איך|לא|כן)$/.test(w)));
const jaccard = (a, b) => { const x = words(a), y = words(b); const i = [...x].filter(w => y.has(w)).length; return i / Math.max(1, x.size + y.size - i); };

const CONTEXTS = new Set('daily weekday-morning friday shabbat motzei-shabbat erev-rosh-chodesh rosh-chodesh kiddush-levana pesach-prep pesach chol-hamoed omer lag-baomer shavuot three-weeks nine-days tisha-bav fast-day elul rosh-hashana aseret-yemei-teshuva yom-kippur pre-sukkot sukkot hoshana-raba simchat-torah chanukah tu-bishvat adar purim yom-tov meal travel home life-cycle seder-night sukkot-first-night'.split(' '));
const RULE_TYPES = new Set(['din', 'minhag', 'chumra', 'machloket']);
const TIMES = new Set(['morning', 'afternoon', 'evening', 'night']);
const sections = new Map(YALKUT_YOSEF.sections.map(s => [s.id, s]));

// The app's category comes from where the section sits in the book, never from the drafter.
const categoryForPart = part => part <= 10 || part === 21 || part === 22 ? 'prayer' : part <= 20 ? 'blessings' : part === 23 ? 'shabbat'
  : part <= 36 ? 'holidays' : part <= 44 ? 'kashrut' : part === 56 ? 'money' : part === 65 ? 'health' : part === 55 || part === 58 ? 'daily' : 'family';

// Further references the section itself names in brackets (the full Yalkut Yosef volume), extracted, not written.
const furtherRefs = text => [...new Set((text.match(/\[(ילקוט יוסף|ילקו"?'?'?י)[^\]]{3,90}\]/g) || []).map(r => r.slice(1, -1).replace(/''/g, '"')))].slice(0, 2);

// Stage 5 (learning tracks): HALACHA_STAGE=tracks reads out-T*.json, checks against EVERY published entry (the Halacha
// Engine entries included) and writes accepted-tracks.json / rejected-tracks.json / report-tracks.json.
const STAGE = process.env.HALACHA_STAGE || '';
const suffix = STAGE ? `-${STAGE}` : '';
// Stage 6 (practical gaps): HALACHA_STAGE=practical reads practical/out-P-*.json and checks against every published entry
// except the practical entries themselves (so a re-run after conversion does not find each entry a duplicate of itself).
const PRACTICAL = STAGE === 'practical';
const existing = PRACTICAL_HALACHA_QA.filter(q => (STAGE || !q.engine) && !(PRACTICAL && q.practicalTier)).map(q => ({ id: q.id, question: q.question, sectionId: q.sources?.[0]?.localSourceId }));
const publishedIds = new Set(PRACTICAL_HALACHA_QA.filter(q => !(PRACTICAL && q.practicalTier)).map(q => q.id));
const files = PRACTICAL
  ? readdirSync(`${DIR}practical`).filter(f => /^out-P-.*\.json$/.test(f)).sort().map(f => `practical/${f}`)
  : STAGE === 'tracks'
  ? readdirSync(DIR).filter(f => /^out-T.*\.json$/.test(f)).sort()
  : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H1', 'H2', 'H3'].map(k => `out-${k}.json`).filter(f => existsSync(`${DIR}${f}`));
const accepted = [], rejected = [], overlapsWithSourceQuestions = [];
const reject = (e, why) => rejected.push({ id: e.id, file: e._file, question: e.question, why });
const urlChecks = [];
// Editorial rule-type corrections: the source states these as plain rulings (or as a hiddur), not as a custom.
const editorial = existsSync(`${DIR}editorial.json`) ? JSON.parse(readFileSync(`${DIR}editorial.json`, 'utf8')) : {};

for (const file of files) {
  let list;
  try { list = JSON.parse(readFileSync(`${DIR}${file}`, 'utf8')); } catch (err) { console.log(file, 'invalid JSON', err.message); continue; }
  for (const raw of list) {
    const e = { ...raw, _file: file };
    if (editorial.ruleType?.[e.id]) e.ruleType = editorial.ruleType[e.id];
    const section = sections.get(e.sectionId);
    if (!e.id || !e.question || !e.shortAnswer) { reject(e, 'missing fields'); continue; }
    if (!section) { reject(e, 'section not found'); continue; }
    const excerpt = norm(e.excerpt);
    if (excerpt.length < 30 || excerpt.length > 420 || /\.\.\.|…/.test(excerpt)) { reject(e, 'excerpt length or elided'); continue; }
    if (!norm(section.text).includes(excerpt)) { reject(e, 'excerpt not verbatim in the section'); continue; }
    // Supporting sections (for a claim the main section states for one case only) are verified the same way.
    const extras = Array.isArray(e.extraSources) ? e.extraSources : [];
    if (extras.some(extra => !sections.get(extra.sectionId) || norm(extra.excerpt).length < 30 || !norm(sections.get(extra.sectionId).text).includes(norm(extra.excerpt)))) { reject(e, 'supporting excerpt not verbatim'); continue; }
    e.extraSources = extras.map(extra => { const sec = sections.get(extra.sectionId); return { sectionId: extra.sectionId, excerpt: extra.excerpt, citation: `${sec.section.split(/\s*-\s*/)[0].trim()}, סעיף ${hebrewNumeral(sec.halachaIndex)}` }; });
    if (String(e.shortAnswer).length > 240) { reject(e, 'answer too long'); continue; }
    if (!RULE_TYPES.has(e.ruleType)) { reject(e, 'bad ruleType'); continue; }
    // A custom or stringency must be visible in the words quoted, so the answer cannot overstate it.
    if (e.ruleType === 'minhag' && !/נהג|מנהג|נוהג/.test(excerpt)) { reject(e, 'minhag without custom wording in excerpt'); continue; }
    if (!Array.isArray(e.contexts) || !e.contexts.length || e.contexts.some(c => !CONTEXTS.has(c))) { reject(e, `bad contexts ${e.contexts}`); continue; }
    if (e.timeOfDay && !TIMES.has(e.timeOfDay)) { reject(e, 'bad timeOfDay'); continue; }
    // A practical-gap entry carries what changes the law, its search phrasings and where the question was found.
    if (PRACTICAL) {
      if (!Array.isArray(e.variants) || e.variants.length < 3) { reject(e, 'fewer than 3 phrasings'); continue; }
      if (!Array.isArray(e.conditions) || e.conditions.some(c => typeof c !== 'string' || c.length > 200)) { reject(e, 'bad conditions'); continue; }
      if (e.ruleType === 'machloket' && !e.dispute) { reject(e, 'dispute without its description'); continue; }
      if (e.ruleType === 'chumra' && !/טוב|ראוי|נכון|המחמיר|יש להחמיר|נהגו|להחמיר|לכתחל/.test(excerpt)) { reject(e, 'stringency without its wording in excerpt'); continue; }
      if (!Array.isArray(e.discovery) || !e.discovery.length) { reject(e, 'no discovery record'); continue; }
    }
    const dupExisting = existing.find(x => (x.sectionId === e.sectionId && jaccard(x.question, e.question) >= 0.34) || normalizeQuery(x.question) === normalizeQuery(e.question));
    if (dupExisting) { reject(e, `duplicate of existing ${dupExisting.id}`); continue; }
    // Two entries from one section are distinct rulings only if they quote separate parts of it.
    const spansOverlap = x => { const t = norm(section.text); const a = t.indexOf(norm(x.excerpt)); const b = t.indexOf(excerpt); return a < 0 || b < 0 || !(a + norm(x.excerpt).length <= b || b + excerpt.length <= a); };
    const dupNew = accepted.find(x => (x.sectionId === e.sectionId && (norm(x.excerpt).includes(excerpt) || excerpt.includes(norm(x.excerpt)) || (jaccard(x.question, e.question) >= 0.5 && spansOverlap(x)))) || jaccard(x.question, e.question) >= 0.8 || normalizeQuery(x.question) === normalizeQuery(e.question));
    if (dupNew) { reject(e, `duplicate of ${dupNew.id}`); continue; }
    const sourceTwin = HALACHA_QUESTIONS.find(q => jaccard(q.question, e.question) >= 0.6);
    if (sourceTwin) overlapsWithSourceQuestions.push({ id: e.id, sourceQuestion: sourceTwin.id });
    const [siman, title] = section.section.split(/\s*-\s*/);
    e.citation = `${siman.trim()}, סעיף ${hebrewNumeral(section.halachaIndex)}`;
    e.sectionTitle = (title || section.section).trim();
    // A practical-gap entry may be filed under a category of the app's own taxonomy (e.g. a business-honesty ruling from
    // the book's Orach Chayim part belongs under "כסף, עבודה ועסקים"); the override is kept visible on the entry.
    const PLACES = new Set(['prayer', 'blessings', 'kashrut', 'shabbat', 'women', 'holidays', 'family', 'health', 'ethics', 'money', 'daily', 'travel', 'tech']);
    if (PRACTICAL && e.place && !PLACES.has(e.place)) { reject(e, `bad place ${e.place}`); continue; }
    e.category = PRACTICAL && e.place ? e.place : categoryForPart(section.part);
    e.furtherRefs = furtherRefs(section.text);
    e.relatedSourceQuestion = sourceTwin?.id || null;
    e.askedOn = (Array.isArray(e.askedOn) ? e.askedOn : []).filter(u => /^https:\/\/[^\s]+$/.test(u)).slice(0, 2);
    urlChecks.push(...e.askedOn.map(u => ({ e, u })));
    accepted.push(e);
  }
}

// Q&A-site pages recorded as "where this is asked" are kept only if they actually load.
if (!SKIP_URLS) {
  const cache = existsSync(`${DIR}urls.json`) ? JSON.parse(readFileSync(`${DIR}urls.json`, 'utf8')) : {};
  for (const { u } of urlChecks) {
    if (u in cache) continue;
    try {
      const r = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'Accept-Language': 'he,en' } });
      cache[u] = r.status;
    } catch { cache[u] = 0; }
  }
  writeFileSync(`${DIR}urls.json`, JSON.stringify(cache, null, 1));
  for (const e of accepted) e.askedOn = e.askedOn.filter(u => cache[u] >= 200 && cache[u] < 400);
}

const ids = new Set(PRACTICAL_HALACHA_QA.filter(q => (STAGE || !q.engine) && !(PRACTICAL && q.practicalTier)).map(q => q.id));
// Related cases must resolve to a published entry or to an entry accepted in this run.
if (PRACTICAL) {
  const acceptedIds = new Set(accepted.map(e => e.id));
  for (const e of accepted) {
    const missing = (e.related || []).filter(id => !publishedIds.has(id) && !acceptedIds.has(id));
    if (missing.length) console.log('unresolved related', e.id, missing.join(','));
    e.related = (e.related || []).filter(id => publishedIds.has(id) || acceptedIds.has(id));
  }
}
for (const e of accepted) { let id = e.id, n = 2; while (ids.has(id)) id = `${e.id}-${n++}`; e.id = id; ids.add(id); }
writeFileSync(`${DIR}accepted${suffix}.json`, JSON.stringify(accepted, null, 1));
writeFileSync(`${DIR}rejected${suffix}.json`, JSON.stringify(rejected, null, 1));
const count = (list, key) => list.reduce((m, x) => (m[key(x)] = (m[key(x)] || 0) + 1, m), {});
const report = {
  accepted: accepted.length, byFile: count(accepted, x => x._file), byCategory: count(accepted, x => x.category), byRuleType: count(accepted, x => x.ruleType),
  rejected: rejected.length, rejectedWhy: count(rejected, x => x.why.replace(/ (of|existing) .*| \S+$/, '')),
  askedOnKept: accepted.reduce((n, e) => n + e.askedOn.length, 0), askedOnChecked: urlChecks.length,
  overlapsWithSourceQuestions: overlapsWithSourceQuestions.length,
};
writeFileSync(`${DIR}report${suffix}.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
