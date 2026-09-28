import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRACTICAL_HALACHA_QA_INDEX } from '../src/data/practicalHalachaQa.mjs';
import { HALACHA_FLOW_INDEX } from '../src/data/halachaFlows.mjs';
import { SIDDUR_HALACHA, SIDDUR_PRAYER } from '../src/data/halachaSiddurLinks.mjs';
import { HALACHA_TRACKS } from '../src/data/halachaTracks.mjs';
import { HALACHA_GLOSSARY } from '../src/data/halachaGlossary.mjs';
import { HALACHA_SOURCE_MAP } from '../src/data/halachaSourceMap.mjs';
import { relatedWithReasons } from '../src/services/halachaEngine.mjs';
import { walkFlow } from '../src/services/halachaDecision.mjs';
import { newConversation, respond } from '../src/services/ai/halachaConversation.mjs';
import { buildHalachaGraph, danglingEdges, graphStats } from '../src/services/halachaGraph.mjs';
import { splitGlossary } from '../src/services/halachaGlossaryText.mjs';
import { createCollection, renameCollection, deleteCollection, toggleInCollection, readCollections, collectionsFor } from '../src/services/collections.mjs';
import { readFavorites, toggleFavorite, routeFavorite } from '../src/services/favorites.mjs';
import { toggleLearned, isLearned, dueRecall, recalled, trackProgress, RECALL_INTERVALS } from '../src/services/halachaLearning.mjs';
import { recordSearchOutcome, recordRabbiRoute, readGapStats } from '../src/services/halachaGaps.mjs';
import { routeHalachaQuery } from '../src/services/halachaIntent.mjs';

const memory = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) }; };
const DAY = 86400000;
const plainDay = { key: '2026-11-03', hebrewDate: { day: 22, month: 8, year: 5787 }, weekday: 2, isIsrael: true };
const roshChodesh = { key: '2026-11-10', hebrewDate: { day: 1, month: 9, year: 5787 }, weekday: 2, isIsrael: true, isRoshChodesh: true };
const sukkot = { key: '2026-09-28', hebrewDate: { day: 17, month: 7, year: 5787 }, weekday: 1, isIsrael: true, isCholHaMoed: true };

test('siddur → halacha: every section link points to published entries and real flows', () => {
  for (const [key, info] of Object.entries(SIDDUR_HALACHA)) {
    assert.ok(info.title && info.short, key);
    for (const id of info.entryIds) assert.equal(PRACTICAL_HALACHA_QA_INDEX[id]?.answerStatus, 'published', `${key}: ${id}`);
    for (const id of [...info.flows, ...Object.values(info.today || {}).flat()]) assert.ok(HALACHA_FLOW_INDEX[id], `${key}: flow ${id}`);
  }
  assert.equal(SIDDUR_PRAYER.maariv, 'arvit');
});

test('siddur → halacha: the reader shows a hint only under sections that have halachot', () => {
  const source = readFileSync(new URL('../src/components/DayServiceReader.jsx', import.meta.url), 'utf8');
  assert.match(source, /onHalacha && SIDDUR_HALACHA\[section\.id\]/);
});

test('prayer context: in Mincha on Rosh Chodesh, "שכחתי" asks only when it was noticed', async () => {
  const env = { context: roshChodesh, activity: { area: 'siddur', prayer: 'mincha', title: 'מנחה' } };
  const { response } = await respond(newConversation(), 'שכחתי', env);
  assert.equal(response.clarification?.question, 'מתי שמת לב?');
  assert.ok(response.notes.some(note => /מנחה/.test(note)));
  const winter = await respond(newConversation(), 'שכחתי', { ...env, context: { ...roshChodesh, seasonal: { vetenTalUmatar: true } } });
  assert.deepEqual(winter.response.clarification.options, ['יעלה ויבוא', 'ותן טל ומטר']);
  const next = await respond(winter.conversation, 'יעלה ויבוא', { ...env, context: { ...roshChodesh, seasonal: { vetenTalUmatar: true } } });
  assert.equal(next.response.clarification?.question, 'מתי שמת לב?');
  const birkat = await respond(newConversation(), 'שכחתי', { context: roshChodesh, activity: { area: 'siddur', section: 'birkat-hamazon', title: 'ברכת המזון' } });
  assert.equal(birkat.response.type, 'answer');
  assert.ok(birkat.response.entryIds.includes('hal-brachot-forgot-yaale-rc'));
  const plain = await respond(newConversation(), 'שכחתי', { context: plainDay, activity: { area: 'siddur', prayer: 'mincha', title: 'מנחה' } });
  assert.equal(plain.response.clarification?.question, 'מה שכחת?');
});

test('the Rosh Chodesh mid-Amidah gap is closed with verified entries', () => {
  const before = walkFlow('yaaleh-veyavo', [0, 0, 1, 3, 0]).outcome;
  const after = walkFlow('yaaleh-veyavo', [0, 0, 1, 3, 1]).outcome;
  assert.deepEqual(before.entries.map(entry => entry.id), ['hal-prayer-rc-yaale-before-modim']);
  assert.deepEqual(after.entries.map(entry => entry.id), ['hal-prayer-rc-yaale-from-modim']);
  assert.equal(before.rabbi, false);
  assert.ok(PRACTICAL_HALACHA_QA_INDEX['hal-prayer-rc-yaale-before-modim'].sources.length === 2, 'the Mincha case rests on a supporting section');
});

test('related halachot respect the season, and each carries a reason', () => {
  const chm = PRACTICAL_HALACHA_QA_INDEX['hal-moed-chm-yaale-amida'];
  const onSukkot = relatedWithReasons(chm, { context: sukkot, limit: 12 });
  assert.ok(onSukkot.length);
  for (const { entry, reason } of onSukkot) {
    assert.ok(reason, entry.id);
    const contexts = entry.contexts || [];
    assert.ok(!((contexts.includes('pesach') || contexts.includes('seder-night')) && !contexts.includes('sukkot') && !contexts.includes('chol-hamoed')), `${entry.id} is a Pesach-only entry shown on Sukkot`);
  }
  const reheat = relatedWithReasons(PRACTICAL_HALACHA_QA_INDEX['qa-reheat-food-shabbat'], { context: plainDay, limit: 20 });
  for (const { entry } of reheat) assert.ok(!(entry.contexts || []).some(key => ['sukkot', 'pesach', 'chanukah', 'purim', 'omer'].includes(key)), entry.id);
});

test('source graph: real ids only, no dangling edges', () => {
  const graph = buildHalachaGraph();
  assert.deepEqual(danglingEdges(graph), []);
  const stats = graphStats(graph);
  for (const type of ['sourcedFrom', 'parallelOf', 'decisionOutcome', 'appearsInSiddur', 'partOfTrack', 'relatedTo', 'usesConcept', 'differsWhen']) assert.ok(stats.edgeTypes[type] > 0, type);
  for (const edge of graph.edges.filter(item => item.type === 'relatedTo')) assert.ok(edge.reason, `${edge.from} → ${edge.to}`);
  for (const edge of graph.edges.filter(item => item.type === 'parallelOf')) assert.equal(edge.verifiedBy, 'wording');
});

test('source map: every parallel is a real se\'if of the bundled Shulchan Arukh, verified by rank', () => {
  const books = {};
  for (const [id, parallel] of Object.entries(HALACHA_SOURCE_MAP)) {
    assert.ok(PRACTICAL_HALACHA_QA_INDEX[id], id);
    assert.ok(parallel.rank >= 1 && parallel.rank <= 3, id);
    books[parallel.book] ||= JSON.parse(readFileSync(new URL(`../public/library/packs/sefaria-shulchan-arukh-pd/Shulchan_Arukh__${parallel.book}.json`, import.meta.url), 'utf8'));
    const node = books[parallel.book].nodes.find(item => item.n === parallel.siman);
    const unit = node?.units.find(item => item.n === parallel.seif);
    assert.equal(unit?.text, parallel.text, `${id}: stored passage differs from the edition`);
  }
  assert.ok(Object.keys(HALACHA_SOURCE_MAP).length > 250);
});

test('glossary: terms are unique, explained, and marking never changes the text', () => {
  const ids = new Set(HALACHA_GLOSSARY.map(term => term.id));
  assert.equal(ids.size, HALACHA_GLOSSARY.length);
  for (const term of HALACHA_GLOSSARY) assert.ok(term.text.length > 10 && term.forms.length, term.id);
  const long = 'לכתחילה צריך להגעיל את הסיר, אבל בדיעבד אם לא הגעיל – התבשיל מותר; ספק ברכות להקל, ובין השמשות יש ספק. '.repeat(6);
  const parts = splitGlossary(long);
  assert.equal(parts.map(part => part.text).join(''), long);
  assert.equal(new Set(parts.filter(part => part.term).map(part => part.term.id)).size, parts.filter(part => part.term).length, 'one mark per term');
  assert.ok(!splitGlossary('המוקצהים').some(part => part.term), 'inside a longer word nothing is marked');
});

test('collections: create, add to several, rename, delete — favorites untouched', () => {
  const storage = memory();
  const favorite = routeFavorite('halacha', 'halacha/q/qa-banana-blessing', 'מה מברכים על בננה?');
  toggleFavorite(favorite, storage);
  const shabbat = createCollection('שבת', storage);
  const learn = createCollection('ללמוד', storage);
  assert.equal(createCollection('שבת', storage).id, shabbat.id, 'same name → same collection');
  assert.equal(createCollection('   ', storage), null);
  toggleInCollection(shabbat.id, favorite, storage);
  toggleInCollection(learn.id, favorite, storage);
  assert.deepEqual(collectionsFor(favorite.key, storage).map(item => item.name).sort(), ['ללמוד', 'שבת']);
  renameCollection(learn.id, 'לזכור', storage);
  assert.ok(readCollections(storage).some(item => item.name === 'לזכור'));
  toggleInCollection(shabbat.id, favorite, storage);
  assert.equal(readCollections(storage).find(item => item.id === shabbat.id).items.length, 0);
  deleteCollection(learn.id, storage);
  assert.equal(readCollections(storage).length, 1);
  assert.deepEqual(readFavorites(storage).map(item => item.key), [favorite.key], 'favorites are not changed by collections');
});

test('learning tracks: published, ordered, no duplicates; progress and gentle recall', () => {
  for (const track of HALACHA_TRACKS) {
    assert.equal(new Set(track.entryIds).size, track.entryIds.length, track.id);
    for (const id of track.entryIds) assert.equal(PRACTICAL_HALACHA_QA_INDEX[id]?.answerStatus, 'published', `${track.id}: ${id}`);
  }
  const storage = memory();
  const track = HALACHA_TRACKS[0];
  toggleLearned(track.entryIds[0], storage, 0);
  assert.deepEqual(trackProgress(track, storage), { done: 1, total: track.entryIds.length, nextId: track.entryIds[1] });
  assert.equal(dueRecall(storage, DAY), null, 'not due yet');
  assert.equal(dueRecall(storage, RECALL_INTERVALS[0] * DAY), track.entryIds[0]);
  recalled(track.entryIds[0], storage, RECALL_INTERVALS[0] * DAY);
  assert.equal(dueRecall(storage, RECALL_INTERVALS[0] * DAY + DAY), null, 'the next recall is later');
  toggleLearned(track.entryIds[0], storage, 0);
  assert.equal(isLearned(track.entryIds[0], storage), false);
});

test('search gaps: counted locally, never the question text', () => {
  const storage = memory();
  const secret = 'שאלה אישית מאוד על מקווה וחציצה';
  recordSearchOutcome(routeHalachaQuery(secret), { storage, now: 0 });
  recordSearchOutcome(routeHalachaQuery('קקקק זזזז'), { storage, now: 1000 });
  recordSearchOutcome(routeHalachaQuery('מה מברכים על בננה'), { storage, now: 2000 });
  recordRabbiRoute('meat-dairy', 'spoon-in-pot', { storage, now: 3000 });
  const raw = JSON.stringify(readGapStats(storage));
  assert.ok(!raw.includes('מקווה') && !raw.includes('בננה') && !raw.includes('קקקק'));
  const day = Object.values(readGapStats(storage))[0];
  assert.equal(day.sensitive, 1);
  assert.equal(day.noMatch, 1);
  assert.equal(day.answered, 1);
  assert.equal(day.rabbiRoutes['meat-dairy/spoon-in-pot'], 1);
});
