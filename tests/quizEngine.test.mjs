// בחן אותי — the engine: the loader's validation, scoring, the adaptive level, no repeats, mistakes coming back,
// persistence and migration, the review hand-off (never the answer), and that points never touch the ring.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { CATEGORY_IDS, CATEGORIES, LEVELS } from '../src/services/quiz/catalog.mjs';
import { validateBank, indexBank, questionProblems, isCorrect, loadBank, checkAnswer } from '../src/services/quiz/bank.mjs';
import { loadQuizFiles } from '../src/data/quiz/index.mjs';
import { pointsFor, adaptAfter, BASE_POINTS, RUN_BONUS_CAP } from '../src/services/quiz/scoring.mjs';
import { createSession, pickNext, answerQuestion, skipQuestion, sessionSummary, recencyBand } from '../src/services/quiz/session.mjs';
import { QUIZ_STORAGE_KEY, emptyState, normalizeState, readQuizState, writeQuizState, applyAnswer, applySessionEnd, dueMistakes, pruneSeen, dayKey, quizSummary, SEEN_LIMIT, flagQuestion, unflagQuestion, flaggedIds } from '../src/services/quiz/store.mjs';
import { reviewItemFor, quizRoute } from '../src/services/quiz/reviewBridge.mjs';
import { SAMPLE } from './fixtures/quizSample.mjs';

const DAY = 864e5;
const memory = (init = {}) => { const map = new Map(Object.entries(init)); return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k), keys: () => [...map.keys()], map }; };
const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const sampleBank = () => indexBank(validateBank({ 'sample.mjs': SAMPLE }).questions);

// ---------- loader & validation ----------
test('validation: exactly four distinct options, a valid answer index, known category and difficulty, unique ids', () => {
  const good = SAMPLE[0];
  assert.deepEqual(questionProblems(good), []);
  assert.ok(questionProblems({ ...good, options: ['a', 'b', 'c'] }).includes('needs exactly 4 options'));
  assert.ok(questionProblems({ ...good, options: ['a', 'b', 'c', 'd', 'e'] }).includes('needs exactly 4 options'));
  assert.ok(questionProblems({ ...good, options: ['a', 'b', 'a ', 'd'] }).includes('options are not distinct'));
  assert.ok(questionProblems({ ...good, options: ['a', '', 'c', 'd'] }).includes('an empty option'));
  for (const answer of [-1, 4, 1.5, '0', undefined]) assert.ok(questionProblems({ ...good, answer }).includes('answer index out of range'), String(answer));
  assert.ok(questionProblems({ ...good, category: 'sports' }).some(p => p.startsWith('unknown category')));
  for (const difficulty of [0, 4, '2']) assert.ok(questionProblems({ ...good, difficulty }).some(p => p.startsWith('bad difficulty')));
  assert.ok(questionProblems({ ...good, q: ' ' }).includes('missing question'));
  const { questions, errors } = validateBank({ 'a.mjs': [good, { ...good, q: 'אחרת' }], 'b.mjs': [{ ...good, id: 'x-1', answer: 9 }], 'c.mjs': 'nope' });
  assert.equal(questions.length, 1);
  assert.deepEqual(errors.map(e => [e.file, e.id, e.problems[0]]), [['a.mjs', good.id, 'duplicate id'], ['b.mjs', 'x-1', 'answer index out of range'], ['c.mjs', null, 'the file does not export a list']]);
  assert.ok(Object.isFrozen(questions[0]) && Object.isFrozen(questions[0].options));
});

test('catalog: eleven areas + הכול (a 3 × 4 grid), four levels', () => {
  assert.equal(CATEGORY_IDS.length, 11);
  assert.equal(CATEGORIES.length, 12);
  assert.deepEqual(LEVELS.map(l => l.label), ['מתחיל', 'בינוני', 'מתקדם', 'משתנה']);
  const schema = readFileSync(new URL('../src/data/quiz/SCHEMA.md', import.meta.url), 'utf8');
  for (const id of CATEGORY_IDS) assert.ok(schema.includes(id), id);
});

test('the loader finds every content file in src/data/quiz (Node fallback), and every question in them is valid', async () => {
  const files = await loadQuizFiles();
  const onDisk = readdirSync(new URL('../src/data/quiz/', import.meta.url)).filter(n => n.endsWith('.mjs') && n !== 'index.mjs').sort();
  assert.deepEqual(Object.keys(files).sort(), onDisk);
  const { questions, errors } = validateBank(files);
  assert.deepEqual(errors.map(e => `${e.file} ${e.id}: ${e.problems.join(', ')}`), []);
  const bank = await loadBank(async () => files);
  assert.equal(bank.size, questions.length);
  // The bank is loaded lazily: the index uses import.meta.glob (lazy chunks), not eager imports.
  const index = readFileSync(new URL('../src/data/quiz/index.mjs', import.meta.url), 'utf8');
  assert.match(index, /import\.meta\.glob\(\['\.\/\*\.mjs', '!\.\/index\.mjs'\]\)/);
  assert.doesNotMatch(index, /eager:\s*true/);
  const page = readFileSync(new URL('../src/pages/QuizPage.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /from '\.\.\/data\/quiz/);
});

test('checkAnswer grades for another screen without returning the answer', async () => {
  const bank = Promise.resolve(sampleBank());
  const q = SAMPLE[5];
  assert.deepEqual(await checkAnswer(q.id, q.answer, bank), { known: true, correct: true });
  assert.deepEqual(await checkAnswer(q.id, (q.answer + 1) % 4, bank), { known: true, correct: false });
  assert.deepEqual(await checkAnswer('nope', 0, bank), { known: false, correct: false });
});

// ---------- scoring & adaptive ----------
test('scoring: nothing for a miss, the level base for a hit, a quiet capped run bonus', () => {
  assert.equal(pointsFor({ correct: false, difficulty: 3, run: 9 }), 0);
  assert.equal(pointsFor({ correct: true, difficulty: 1, run: 1 }), BASE_POINTS[1]);
  assert.equal(pointsFor({ correct: true, difficulty: 2, run: 2 }), BASE_POINTS[2]);
  assert.equal(pointsFor({ correct: true, difficulty: 3, run: 3 }), BASE_POINTS[3] + 2);
  assert.equal(pointsFor({ correct: true, difficulty: 3, run: 50 }), BASE_POINTS[3] + RUN_BONUS_CAP);
  const bank = sampleBank();
  let s = createSession({ category: 'tanakh', level: 'easy', size: 3 });
  for (let i = 0; i < 3; i += 1) { const q = pickNext(s, bank, { rng: seeded(i + 1) }); s = answerQuestion(s, q, q.answer).session; }
  assert.deepEqual(sessionSummary(s), { answered: 3, correct: 3, points: 10 + 10 + 12, bestRun: 3, maxDifficultyRun: 0 });
  assert.ok(isCorrect(SAMPLE[0], SAMPLE[0].answer) && !isCorrect(SAMPLE[0], null));
});

test('adaptive (משתנה): up after three in a row, down after two misses, within 1–3', () => {
  let a = { difficulty: 1 };
  for (const hit of [true, true]) a = adaptAfter(a, hit);
  assert.equal(a.difficulty, 1);
  a = adaptAfter(a, true);
  assert.equal(a.difficulty, 2);
  a = adaptAfter(adaptAfter(adaptAfter(a, true), true), true);
  assert.equal(a.difficulty, 3);
  a = adaptAfter(adaptAfter(adaptAfter(a, true), true), true);
  assert.equal(a.difficulty, 3);
  a = adaptAfter(a, false);
  assert.equal(a.difficulty, 3);
  a = adaptAfter(a, false);
  assert.equal(a.difficulty, 2);
  a = adaptAfter(adaptAfter(adaptAfter(adaptAfter(a, false), false), false), false);
  assert.equal(a.difficulty, 1);
  // In a session the next question follows the new level.
  const bank = sampleBank();
  let s = createSession({ level: 'adaptive', size: 10, adaptiveStart: 1 });
  const rng = seeded(3);
  for (let i = 0; i < 3; i += 1) { const q = pickNext(s, bank, { rng }); assert.equal(q.difficulty, 1); s = answerQuestion(s, q, q.answer).session; }
  assert.equal(pickNext(s, bank, { rng }).difficulty, 2);
  // A fixed level never moves.
  let f = createSession({ level: 'hard', size: 10 });
  for (let i = 0; i < 4; i += 1) { const q = pickNext(f, bank, { rng }); assert.equal(q.difficulty, 3); f = answerQuestion(f, q, (q.answer + 1) % 4).session; }
});

// ---------- no repeats ----------
test('no repeats: never twice in a session; recently seen questions wait; the seen set decays (oldest first)', () => {
  const bank = sampleBank();
  const now = Date.UTC(2026, 9, 1);
  let s = createSession({ category: 'shabbat', level: 'adaptive', size: 12 });
  const rng = seeded(11);
  const ids = [];
  for (let i = 0; i < 12; i += 1) { const q = pickNext(s, bank, { rng, now }); ids.push(q.id); s = answerQuestion(s, q, i % 2 ? q.answer : (q.answer + 1) % 4).session; }
  assert.equal(new Set(ids).size, 12);
  assert.equal(pickNext(s, bank, { rng, now }), null);
  // Seen today → only when nothing else of the area is left.
  const shabbat = bank.questions.filter(q => q.category === 'shabbat');
  const seen = Object.fromEntries(shabbat.slice(0, 11).map(q => [q.id, now - 3600e3]));
  const first = pickNext(createSession({ category: 'shabbat', level: 'adaptive', size: 5 }), bank, { seen, rng, now });
  assert.equal(first.id, shabbat[11].id);
  // All seen: the ones seen longest ago come first.
  const all = Object.fromEntries(shabbat.map((q, i) => [q.id, now - (i + 1) * DAY * 40]));
  const fixed = createSession({ category: 'shabbat', level: 'adaptive', size: 5, adaptiveStart: 1 });
  for (let k = 0; k < 20; k += 1) {
    const q = pickNext(fixed, bank, { seen: all, rng: seeded(k + 1), now });
    const ofLevel = shabbat.filter(x => x.difficulty === 1).map(x => all[x.id]).sort((a, b) => a - b);
    assert.ok(all[q.id] <= ofLevel[Math.ceil(ofLevel.length / 2) - 1], 'from the older half');
  }
  assert.deepEqual([undefined, now - 40 * DAY, now - 8 * DAY, now - 2 * DAY, now - 60e3].map(at => recencyBand(at, now)), [0, 1, 2, 3, 4]);
});

test('mistakes come back later (1, 3, 7 days), at most twice a session, and a correct answer clears them', () => {
  const bank = sampleBank();
  const now = Date.UTC(2026, 9, 1);
  const q = bank.questions.find(x => x.category === 'tanakh' && x.difficulty === 3);
  let state = applyAnswer(emptyState(), { question: q, correct: false, now });
  assert.deepEqual(state.mistakes[q.id], { at: now, misses: 1 });
  assert.deepEqual(dueMistakes(state, now + DAY / 2), []);
  assert.deepEqual(dueMistakes(state, now + DAY), [q.id]);
  state = applyAnswer(state, { question: q, correct: false, now });
  assert.deepEqual(dueMistakes(state, now + 2 * DAY), []);
  assert.deepEqual(dueMistakes(state, now + 3 * DAY), [q.id]);
  let s = createSession({ category: 'tanakh', level: 'easy', size: 10, dueIds: [q.id] });
  const order = [];
  const rng = seeded(5);
  for (let i = 0; i < 10; i += 1) { const next = pickNext(s, bank, { rng, now }); if (!next) break; order.push(next.id); s = answerQuestion(s, next, next.answer).session; }
  assert.equal(order[3], q.id, 'the 4th question is the mistake');
  assert.equal(order.filter(id => id === q.id).length, 1);
  state = applyAnswer(state, { question: q, correct: true, points: 20, now });
  assert.equal(state.mistakes[q.id], undefined);
  assert.equal(state.points, 20);
});

// ---------- persistence ----------
test('persistence: one versioned key, garbage reads as fresh, the v0 record migrates, a newer record keeps its fields', () => {
  const store = memory();
  assert.deepEqual(readQuizState(store), emptyState());
  store.setItem(QUIZ_STORAGE_KEY, '{not json');
  assert.deepEqual(readQuizState(store), emptyState());
  const legacy = memory({ 'kz-quiz': JSON.stringify({ score: 340, seenIds: ['a', 'b', 7] }) });
  const migrated = readQuizState(legacy);
  assert.equal(migrated.points, 340);
  assert.deepEqual(Object.keys(migrated.seen), ['a', 'b']);
  assert.ok(legacy.getItem(QUIZ_STORAGE_KEY), 'migrated into the versioned key');
  assert.equal(legacy.getItem('kz-quiz') !== null, true, 'the old record is left in place (never destroyed)');
  const future = normalizeState({ schemaVersion: 3, points: 12, extra: { keep: true }, prefs: { level: 'nonsense', size: 7, timer: 'yes', variant: 'woven' }, adaptive: 9, achievements: { first: 5, bogus: 1 } });
  assert.equal(future.schemaVersion, 3);
  assert.deepEqual(future.extra, { keep: true });
  assert.deepEqual(future.prefs, { category: 'all', level: 'adaptive', size: 10, timer: false, variant: 'woven', reveal: false, confirm: true, sound: false });
  assert.equal(future.adaptive, 3);
  assert.deepEqual(future.achievements, { first: 5 });
  const round = memory();
  writeQuizState({ ...emptyState(), points: 77 }, round);
  assert.equal(readQuizState(round).points, 77);
  assert.deepEqual(round.keys(), [QUIZ_STORAGE_KEY]);
  // The seen set never grows without bound.
  const now = Date.now();
  const big = { ...emptyState(), seen: Object.fromEntries(Array.from({ length: SEEN_LIMIT + 500 }, (_, i) => [`q${i}`, now - i * 1000])) };
  big.seen.ancient = now - 400 * DAY;
  const pruned = pruneSeen(big, now);
  assert.equal(Object.keys(pruned.seen).length, SEEN_LIMIT);
  assert.equal(pruned.seen.ancient, undefined);
  assert.ok(pruned.seen.q0);
});

test('the daily streak counts days with a completed session; achievements are earned once', () => {
  const day1 = new Date(2026, 9, 1, 20).getTime();
  let { state, earned } = applySessionEnd(emptyState(), { answered: 10, correct: 10, bestRun: 10 }, day1);
  assert.deepEqual(state.days, { last: dayKey(day1), streak: 1, best: 1, count: 1 });
  assert.deepEqual(earned.map(a => a.id).sort(), ['first', 'perfect']);
  ({ state, earned } = applySessionEnd(state, { answered: 5, correct: 1 }, day1 + 3600e3));
  assert.equal(state.days.streak, 1);
  assert.deepEqual(earned, []);
  ({ state } = applySessionEnd(state, { answered: 5, correct: 1 }, day1 + DAY));
  ({ state, earned } = applySessionEnd(state, { answered: 5, correct: 1 }, day1 + 2 * DAY));
  assert.equal(state.days.streak, 3);
  assert.deepEqual(earned.map(a => a.id), ['days-3']);
  ({ state } = applySessionEnd(state, { answered: 5, correct: 1 }, day1 + 5 * DAY));
  assert.deepEqual([state.days.streak, state.days.best, state.days.count], [1, 3, 4]);
  assert.equal(applySessionEnd(state, { answered: 0, correct: 0 }, day1 + 6 * DAY).state, state, 'an empty session changes nothing');
  const summary = quizSummary(state, day1 + 5 * DAY);
  assert.deepEqual(Object.keys(summary).sort(), ['answered', 'dailyDone', 'dueMistakes', 'ladderBest', 'playedToday', 'points', 'stage', 'stageName', 'streakDays']);
});

// ---------- review hand-off and the ring ----------
test('a missed question goes to חזרה אליי without its answer, and opens again in the quiz', () => {
  for (const q of SAMPLE.slice(0, 20)) {
    const item = reviewItemFor(q);
    assert.equal(item.kind, 'quiz');
    assert.equal(item.refId, q.id);
    assert.equal(item.payload.route, quizRoute(q.id));
    assert.ok(!('answer' in item.payload) && !('answer' in item));
    assert.ok(!JSON.stringify(item).includes('"answer"'));
    assert.ok(!('note' in item.payload), 'no explanation for a missed question');
  }
});

test('points never fill the ring: the quiz never writes the journal or the circle, and study time counts by active time only', () => {
  const dir = new URL('../src/services/quiz/', import.meta.url);
  for (const name of readdirSync(dir)) {
    const src = readFileSync(new URL(name, dir), 'utf8');
    assert.doesNotMatch(src, /spiritualCircle|mitzvotJournal|studySession|presenceGlow/, name);
  }
  const page = readFileSync(new URL('../src/pages/QuizPage.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /spiritualCircle|mitzvotJournal|upsertTorahStudyMinutes|SpiritualRing/);
  assert.match(page, /useStudyTimer\(\{ workId: 'quiz-bechan-oti'.*enabled: playing \}\)/);
  // Answering and finishing touch only the quiz's own key.
  const store = memory();
  let state = emptyState();
  for (const q of SAMPLE.slice(0, 10)) state = applyAnswer(state, { question: q, correct: true, points: 10 });
  writeQuizState(applySessionEnd(state, { answered: 10, correct: 10 }).state, store);
  assert.deepEqual(store.keys(), [QUIZ_STORAGE_KEY]);
});

// ---------- "להציג את התשובה הנכונה?" and "לא מתאימה" ----------
test('the reveal preference is off by default, persists, and only a real true turns it on', () => {
  assert.equal(emptyState().prefs.reveal, false);
  assert.equal(normalizeState({ prefs: { reveal: 'yes' } }).prefs.reveal, false);
  assert.equal(normalizeState({ prefs: { reveal: true } }).prefs.reveal, true);
  const store = memory();
  writeQuizState({ ...emptyState(), prefs: { ...emptyState().prefs, reveal: true } }, store);
  assert.equal(readQuizState(store).prefs.reveal, true);
});

test('לא מתאימה: skipped without a score change, never asked again, kept in the list (and can be returned)', () => {
  const bank = sampleBank();
  const now = Date.UTC(2026, 9, 1);
  const rng = seeded(9);
  let s = createSession({ category: 'brachot', level: 'adaptive', size: 5 });
  const q = pickNext(s, bank, { rng, now });
  let state = applyAnswer(emptyState(), { question: q, correct: false, now: now - 10 * DAY });
  const before = { ...s };
  s = skipQuestion(s, q);
  state = flagQuestion(state, q.id, now);
  // Nothing scored, nothing counted, the level and run untouched; the session still asks five.
  assert.deepEqual([s.results.length, s.points, s.run, s.difficulty, s.asked.length, s.size], [0, 0, before.run, before.difficulty, 0, 5]);
  assert.deepEqual(skipQuestion(s, q), s, 'skipping twice changes nothing');
  assert.equal(state.points, 0);
  assert.equal(state.mistakes[q.id], undefined, 'a pending mistake of it is dropped');
  assert.deepEqual(dueMistakes(applyAnswer(state, { question: q, correct: false, now: now - 10 * DAY }), now), [], 'a flagged question is never due');
  // Never again — in this session, in a new one, or as a review.
  const asked = [];
  for (let i = 0; i < 5; i += 1) { const next = pickNext(s, bank, { rng, now, flagged: state.flagged }); asked.push(next.id); s = answerQuestion(s, next, next.answer).session; }
  assert.ok(!asked.includes(q.id));
  const all = bank.questions.filter(x => x.category === 'brachot');
  let fresh = createSession({ category: 'brachot', level: 'adaptive', size: all.length });
  const seenIds = [];
  for (;;) { const next = pickNext(fresh, bank, { rng, now, flagged: state.flagged }); if (!next) break; seenIds.push(next.id); fresh = answerQuestion(fresh, next, next.answer).session; }
  assert.equal(seenIds.length, all.length - 1);
  assert.ok(!seenIds.includes(q.id));
  const review = createSession({ mode: 'review', reviewIds: [q.id], size: 10 });
  assert.equal(pickNext(review, bank, { flagged: state.flagged }), null);
  // In a review, a skipped question leaves one fewer to ask.
  assert.equal(skipQuestion(createSession({ mode: 'review', reviewIds: ['a', 'b'], size: 10 }), { id: 'a' }).size, 1);
  // The list, newest first; un-flagging returns it to the pool.
  const other = all.find(x => x.id !== q.id);
  state = flagQuestion(state, other.id, now + 1000);
  assert.deepEqual(flaggedIds(state), [other.id, q.id]);
  const store = memory();
  writeQuizState(state, store);
  assert.deepEqual(flaggedIds(readQuizState(store)), [other.id, q.id], 'the list persists');
  state = unflagQuestion(state, q.id);
  assert.deepEqual(flaggedIds(state), [other.id]);
  assert.equal(unflagQuestion(state, 'nope'), state);
  assert.deepEqual(normalizeState({ flagged: { x: 5, y: 'bad' } }).flagged, { x: 5 });
});

test('the bank holds only religious questions: no State/Zionist/secular-culture figures or civic facts remain', async () => {
  const files = await loadQuizFiles();
  const all = Object.values(files).flat();
  const banned = /הרצל|בן-גוריון|דוד בן גוריון|הנרייטה סולד|ז׳בוטינסקי|ויצמן|אליעזר בן יהודה|ביאליק|עגנון|חנה סנש|הכנסת הראשונה|צה״ל|צה"ל|פלמ״ח|הקונגרס הציוני|מגילת העצמאות|יום העצמאות|נשיא המדינה|ראש הממשלה|גולדה|מנחם בגין|אונסק״ו/;
  for (const q of all) assert.doesNotMatch(`${q.q} ${q.options.join(' ')}`, banned, q.id);
});
