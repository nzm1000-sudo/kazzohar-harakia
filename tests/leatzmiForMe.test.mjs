// לעצמי · בשבילי היום (rule-based composition) and ביום הזה (the gentle look back).
import test from 'node:test';
import assert from 'node:assert/strict';
import { AWAY_AFTER_MS, FOR_ME_KEY, REFRESH_AFTER_MS, RECENT_WINDOWS, chooseNewQuestion, composeForMe, decayRecent, markCardDone, openPlan, pickSayingIndex, planForDay, planIsStale, readForMe, replaceCardQuestion, sessionMinutes, touchPlan, verseOfDay } from '../src/services/leatzmi/forMe.mjs';
import { onThisDay, onThisDayReminderLine, yearsAgoSameHebrewDate } from '../src/services/leatzmi/onThisDay.mjs';
import { memoryStorage } from './helpers/memoryStorage.mjs';

const DAY = 86_400_000;
const NOW = Date.parse('2026-10-01T09:00:00Z');
const quizPool = [
  { id: 'tanakh-0001', q: 'מי ראה את הסנה?', options: ['משה', 'אהרן', 'יהושע', 'שמואל'], answer: 0, category: 'tanakh', difficulty: 1 },
  { id: 'tanakh-0002', q: 'כמה ספרים בתורה?', options: ['ארבעה', 'חמישה', 'שישה', 'שבעה'], answer: 1, category: 'tanakh', difficulty: 1 },
  { id: 'halacha-0001', q: 'מה מברכים על מסטיק?', options: ['שהכל', 'האדמה', 'העץ', 'מזונות'], answer: 0, category: 'halacha', difficulty: 2 },
];
const halachaPool = [{ id: 'qa-1', question: 'שאלה א', shortAnswer: 'תשובה א' }, { id: 'qa-2', question: 'שאלה ב', shortAnswer: 'תשובה ב' }];
const verse = { text: 'שִׁיר הַמַּעֲלוֹת', chapter: 121, verse: 1 };
const quizItem = (refId, extra = {}) => ({ id: `quiz:${refId}`, kind: 'quiz', refId, title: '', payload: { questionId: refId, q: 'q', options: ['a', 'b'], category: 'tanakh' }, topic: 'tanakh', due: NOW - DAY, reps: 0, lapses: 1, seen: 1, lastGrade: 1, ease: 2.3, interval: 0, ...extra });

test('a full day: halacha, a missed question (answer read from the bank), a verse, an old chidush, a new question', () => {
  const cards = composeForMe({
    day: '2026-10-01', now: NOW, halachaPool, quizPool, verse,
    reviewItems: [quizItem('tanakh-0001')],
    chidushim: [{ id: 'c-old', title: 'ישן', body: 'גוף', createdAt: new Date(NOW - 30 * DAY).toISOString() }, { id: 'c-new', title: 'חדש', body: 'x', createdAt: new Date(NOW - DAY).toISOString() }],
  });
  assert.deepEqual(cards.map(card => card.type), ['halacha', 'quiz-missed', 'verse', 'chidush', 'quiz-new']);
  assert.equal(cards[1].question.id, 'tanakh-0001', 'the question is read from the bank by id');
  assert.equal(cards[1].question.q, 'מי ראה את הסנה?');
  assert.ok(cards.filter(card => card.type.startsWith('quiz')).every(card => !('answer' in card.question)), 'a card never carries the answer (grading is the bank\'s)');
  assert.equal(cards[3].chidushId, 'c-old', 'only an older chidush returns');
  assert.notEqual(cards[4].question.id, 'tanakh-0001', 'the new question is one not met before');
  assert.ok(cards.length >= 3 && cards.length <= 5);
  const minutes = sessionMinutes(cards);
  assert.ok(minutes >= 3 && minutes <= 5, `three to five minutes (${minutes})`);
});

test('the same day composes the same session; a halacha due again comes before a new one', () => {
  const input = { day: '2026-10-01', now: NOW, halachaPool, quizPool, verse };
  assert.deepEqual(composeForMe(input), composeForMe(input));
  const due = composeForMe({ ...input, learnedHalacha: { 'qa-2': { at: NOW - 10 * DAY, next: NOW - DAY } } });
  assert.equal(due[0].id, 'qa-2');
  assert.equal(due[0].review, true);
});

test('adapts by strength: a strong quiz record shows the missed question only every other day; weak → easier new ones', () => {
  const strong = [quizItem('tanakh-0001', { reps: 5, lapses: 0, lastGrade: 3, seen: 5 }), quizItem('tanakh-0002', { reps: 5, lapses: 0, lastGrade: 5, seen: 5 })];
  const odd = composeForMe({ day: '2026-10-01', now: NOW, quizPool, reviewItems: strong, verse });
  const even = composeForMe({ day: '2026-10-02', now: NOW, quizPool, reviewItems: strong, verse });
  assert.equal(odd.filter(card => card.type === 'quiz-missed').length + even.filter(card => card.type === 'quiz-missed').length, 1);
  const weak = [quizItem('tanakh-0001', { lapses: 3 }), { ...quizItem('halacha-0001', { lapses: 3 }), payload: { questionId: 'halacha-0001', category: 'halacha' } }];
  const cards = composeForMe({ day: '2026-10-01', now: NOW, quizPool, reviewItems: weak, verse });
  const fresh = cards.find(card => card.type === 'quiz-new');
  assert.equal(fresh?.question.id, 'tanakh-0002', 'from the weakest area, at the easier level');
});

test('a cold start still gives a calm session, and nothing breaks without a quiz bank', () => {
  const cards = composeForMe({ day: '2026-10-01', now: NOW, halachaPool, verse, quizPool: [] });
  assert.deepEqual(cards.map(card => card.type), ['halacha', 'verse']);
  assert.deepEqual(composeForMe({}), []);
});

test('a plan is kept while fresh; new questions are remembered as seen; done marks are kept once', () => {
  const storage = memoryStorage();
  let calls = 0;
  const compose = ({ seed }) => { calls += 1; return composeForMe({ day: '2026-10-01', seed, now: NOW, quizPool, verse }); };
  const first = planForDay('2026-10-01', compose, storage, NOW);
  const again = planForDay('2026-10-01', compose, storage, NOW + 60_000);
  assert.equal(calls, 1);
  assert.deepEqual(again.plan, first.plan);
  assert.equal(readForMe(storage).seenQuiz.length, 1);
  markCardDone(0, storage);
  markCardDone(0, storage);
  assert.deepEqual(readForMe(storage).done, [0]);
  planForDay('2026-10-02', ({ seenQuiz }) => { assert.equal(seenQuiz.length, 1); return []; }, storage, NOW + DAY);
  assert.equal(readForMe(memoryStorage({ [FOR_ME_KEY]: 'x' })).plan.length, 0);
});

test('refresh: a new plan after two hours, or on coming back after ten minutes away — never while the screen stays open', () => {
  const storage = memoryStorage();
  let calls = 0;
  const compose = ({ seed }) => { calls += 1; return composeForMe({ day: '2026-10-01', seed, now: NOW, quizPool, halachaPool, verse }); };
  const open = (now, entering = true) => openPlan('2026-10-01', compose, { now, storage, entering });
  const a = open(NOW);
  assert.equal(a.fresh, true);
  assert.equal(calls, 1);
  // Back after five minutes: the same plan, and the visit is noted.
  assert.equal(open(NOW + 5 * 60_000).fresh, false);
  assert.equal(readForMe(storage).lastSeenAt, NOW + 5 * 60_000);
  // On the screen for an hour and a half (the heartbeat keeps the visit current): never reshuffled while there.
  for (let t = 6; t <= 95; t += 1) touchPlan(NOW + t * 60_000, storage);
  assert.equal(planIsStale(readForMe(storage), { day: '2026-10-01', now: NOW + 95 * 60_000, entering: false }), false);
  // Leaving and coming back nine minutes later: kept. Ten minutes later: new.
  assert.equal(open(NOW + 104 * 60_000).fresh, false);
  assert.equal(calls, 1);
  const b = open(NOW + 104 * 60_000 + AWAY_AFTER_MS);
  assert.equal(b.fresh, true);
  assert.equal(calls, 2);
  assert.equal(b.done.length, 0, 'a new plan starts with nothing done');
  // Two hours after it was composed the plan is stale — but only a visit replaces it (the open screen keeps its own).
  const composed = b.composedAt;
  touchPlan(composed + REFRESH_AFTER_MS - 1000, storage);
  assert.equal(planIsStale(readForMe(storage), { day: '2026-10-01', now: composed + REFRESH_AFTER_MS - 1 }), false);
  assert.equal(planIsStale(readForMe(storage), { day: '2026-10-01', now: composed + REFRESH_AFTER_MS }), true);
  assert.equal(open(composed + REFRESH_AFTER_MS + 1000).fresh, true, 'two hours: fresh even after a short absence');
  // A new day is a new plan; an older stored plan (no composedAt) is replaced once.
  assert.equal(planIsStale({ ...readForMe(storage), day: '2026-09-30' }, { day: '2026-10-01', now: NOW }), true);
  assert.equal(planIsStale({ day: '2026-10-01', plan: [{}], done: [] }, { day: '2026-10-01', now: NOW }), true);
});

test('no immediate repeats: each refresh brings a different halacha, verse, chidush, question and saying', () => {
  const storage = memoryStorage();
  const pool = Array.from({ length: 12 }, (_, i) => ({ id: `qa-${i}`, question: `שאלה ${i}`, shortAnswer: `תשובה ${i}` }));
  const quiz = Array.from({ length: 20 }, (_, i) => ({ id: `q-${i}`, q: `שאלה ${i}`, options: ['א', 'ב', 'ג', 'ד'], answer: i % 4, category: 'tanakh', difficulty: 1 }));
  const chapters = Array.from({ length: 30 }, (_, c) => Array.from({ length: 6 }, (_, v) => `פסוק ${c}-${v}`));
  const chidushim = Array.from({ length: 4 }, (_, i) => ({ id: `c-${i}`, title: `חידוש ${i}`, body: 'גוף', createdAt: new Date(NOW - 40 * DAY).toISOString() }));
  const seen = { halacha: [], verse: [], chidush: [], quiz: [], sage: [] };
  let now = NOW;
  for (let round = 0; round < 4; round += 1) {
    const state = openPlan('2026-10-01', ({ seenQuiz, recent, seed }) => composeForMe({ day: '2026-10-01', seed, now, halachaPool: pool, quizPool: quiz, seenQuiz, recent, chidushim, verse: verseOfDay(chapters, seed, recent.verse) }), { now, storage, sayings: 50 });
    assert.equal(state.fresh, true);
    const card = type => state.plan.find(item => item.type === type);
    seen.halacha.push(card('halacha').id);
    seen.verse.push(`${card('verse').chapter}:${card('verse').verse}`);
    seen.chidush.push(card('chidush').chidushId);
    seen.quiz.push(card('quiz-new').question.id);
    seen.sage.push(state.sageIndex);
    now += REFRESH_AFTER_MS;
  }
  for (const [kind, list] of Object.entries(seen)) assert.equal(new Set(list).size, list.length, `${kind}: ${list.join(', ')}`);
  // With fewer items than refreshes, the one shown longest ago comes back (never an empty card).
  const one = [{ id: 'only', title: 'יחיד', body: 'x', createdAt: new Date(NOW - 40 * DAY).toISOString() }];
  assert.equal(composeForMe({ day: 'd', now: NOW, chidushim: one, recent: { chidush: { only: NOW } } }).find(c => c.type === 'chidush')?.chidushId, 'only');
});

test('the recent sets decay by kind; a saying is not one shown lately', () => {
  const recent = decayRecent({ halacha: { a: NOW - RECENT_WINDOWS.halacha - 1, b: NOW - 1000 }, missed: { 'quiz:x': NOW - RECENT_WINDOWS.missed }, sage: { 3: NOW } }, NOW);
  assert.deepEqual(Object.keys(recent.halacha), ['b']);
  assert.deepEqual(recent.missed, {});
  assert.deepEqual(Object.keys(recent.verse), []);
  const recentSage = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [String(i), NOW]));
  assert.equal(pickSayingIndex(10, recentSage, () => 0), 9);
  assert.equal(pickSayingIndex(0, {}), null);
  // A missed question shown lately waits for the next plan.
  const reviewItems = [quizItem('tanakh-0001')];
  const shown = composeForMe({ day: '2026-10-01', now: NOW, quizPool, verse, reviewItems, recent: { missed: { 'quiz:tanakh-0001': NOW } } });
  assert.equal(shown.some(card => card.type === 'quiz-missed'), false);
});

test('the next question: never one excluded or already in review; the quiz record steers it; the card keeps it', () => {
  const exclude = new Set(['tanakh-0001']);
  for (let i = 0; i < 20; i += 1) {
    const next = chooseNewQuestion({ quizPool, reviewItems: [quizItem('tanakh-0002')], exclude, random: Math.random });
    assert.equal(next.id, 'halacha-0001');
  }
  assert.equal(chooseNewQuestion({ quizPool, exclude: new Set(quizPool.map(q => q.id)) }), null);
  // The quiz's own record steers to the weak category when the review queue says nothing.
  const pool = [...quizPool, { id: 'halacha-0002', q: 'x', options: ['a', 'b', 'c', 'd'], answer: 1, category: 'halacha', difficulty: 2 }];
  for (let i = 0; i < 10; i += 1) assert.equal(chooseNewQuestion({ quizPool: pool, categoryStats: { halacha: { answered: 10, correct: 2 }, tanakh: { answered: 10, correct: 10 } } }).category, 'halacha');
  const storage = memoryStorage();
  openPlan('2026-10-01', ({ seed }) => composeForMe({ day: '2026-10-01', seed, now: NOW, quizPool: [quizPool[0]], verse }), { now: NOW, storage });
  const index = readForMe(storage).plan.findIndex(card => card.type === 'quiz-new');
  const after = replaceCardQuestion(index, quizPool[1], storage);
  assert.equal(after.plan[index].question.id, 'tanakh-0002');
  assert.equal('answer' in after.plan[index].question, false);
  assert.ok(after.seenQuiz.includes('tanakh-0002'));
});

test('the verse of the day is a short whole verse, stable for the day', () => {
  const chapters = [['א'.repeat(200), 'קצר'], ['גם קצר']];
  const a = verseOfDay(chapters, '2026-10-01');
  assert.ok(a.text.length <= 90);
  assert.deepEqual(verseOfDay(chapters, '2026-10-01'), a);
  assert.equal(verseOfDay([], 'x'), null);
});

test('ביום הזה: what was written around this Hebrew date in an earlier year, and the journal\'s gentle milestones', () => {
  // 20 Tishrei 5787 (2026-10-01); 20 Tishrei 5786 was 2025-10-12.
  const today = new Date('2026-10-01T09:00:00Z');
  assert.equal(yearsAgoSameHebrewDate('2025-10-12T10:00:00Z', today), 1);
  assert.equal(yearsAgoSameHebrewDate('2025-10-14T10:00:00Z', today), 1, 'within the same Hebrew week');
  assert.equal(yearsAgoSameHebrewDate('2025-11-12T10:00:00Z', today), 0);
  assert.equal(yearsAgoSameHebrewDate('2026-09-30T10:00:00Z', today), 0, 'this year is not a look back');
  assert.equal(yearsAgoSameHebrewDate('2024-10-22T10:00:00Z', today), 2);
  const cards = onThisDay({
    today,
    chidushim: [{ id: 'a', title: 'על הסוכה', body: '', createdAt: '2025-10-12T10:00:00Z', parasha: '' }],
    events: [{ occurredAt: '2025-10-12T07:00:00Z', category: 'prayer' }, { occurredAt: '2025-10-12T08:00:00Z', category: 'torah_study', quantity: 25 }],
  });
  assert.equal(cards[0].kind, 'chidush-anniversary');
  assert.equal(cards[0].title, 'לפני שנה כתבת');
  assert.equal(cards[0].chidushId, 'a');
  const journal = cards.find(card => card.kind === 'journal');
  assert.ok(journal && journal.text.includes('תפילה') && journal.text.includes('לימוד תורה'));
  assert.ok(!/\d/.test(journal.text), 'what was done, never how much');
  assert.ok(cards.length <= 3);
  assert.deepEqual(onThisDay({ today, chidushim: [], events: [] }), []);
  assert.equal(onThisDayReminderLine({ today, chidushim: [{ id: 'a', title: 'x', body: '', createdAt: '2025-10-12T10:00:00Z' }] }), null, 'the reminder hook is off by default');
});
