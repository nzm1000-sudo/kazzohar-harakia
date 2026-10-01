// לעצמי · בשבילי היום (rule-based composition) and ביום הזה (the gentle look back).
import test from 'node:test';
import assert from 'node:assert/strict';
import { FOR_ME_KEY, composeForMe, markCardDone, planForDay, readForMe, sessionMinutes, verseOfDay } from '../src/services/leatzmi/forMe.mjs';
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
  assert.equal(cards[1].question.answer, 0, 'the answer comes from the bank, not from the review queue');
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

test('the day\'s plan is kept all day; new questions are remembered as seen', () => {
  const storage = memoryStorage();
  let calls = 0;
  const compose = () => { calls += 1; return composeForMe({ day: '2026-10-01', now: NOW, quizPool, verse }); };
  const first = planForDay('2026-10-01', compose, storage);
  const again = planForDay('2026-10-01', compose, storage);
  assert.equal(calls, 1);
  assert.deepEqual(again.plan, first.plan);
  assert.equal(readForMe(storage).seenQuiz.length, 1);
  markCardDone(0, storage);
  markCardDone(0, storage);
  assert.deepEqual(readForMe(storage).done, [0]);
  planForDay('2026-10-02', ({ seenQuiz }) => { assert.equal(seenQuiz.length, 1); return []; }, storage);
  assert.equal(readForMe(memoryStorage({ [FOR_ME_KEY]: 'x' })).plan.length, 0);
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
