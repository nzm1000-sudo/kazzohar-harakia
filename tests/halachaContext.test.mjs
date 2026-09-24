import test from 'node:test';
import assert from 'node:assert/strict';
import { contextualHalachaCategory, holidayTagFor, pickDailyHalacha } from '../src/services/halachaContext.mjs';
import { PRACTICAL_HALACHA_QA } from '../src/data/practicalHalachaQa.mjs';

function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('Wednesday through Friday prioritizes Shabbat halachot', () => {
  assert.equal(contextualHalachaCategory({ weekday: 3 }), 'shabbat');
  assert.equal(contextualHalachaCategory({ weekday: 4 }), 'shabbat');
  assert.equal(contextualHalachaCategory({ weekday: 5 }), 'shabbat');
});

test('Sunday through Tuesday is an ordinary rotation day', () => {
  assert.equal(contextualHalachaCategory({ weekday: 0 }), null);
  assert.equal(contextualHalachaCategory({ weekday: 1 }), null);
  assert.equal(contextualHalachaCategory({ weekday: 2 }), null);
});

test('Rosh Chodesh takes priority and selects the rosh-chodesh tag', () => {
  assert.equal(contextualHalachaCategory({ weekday: 5, isRoshChodesh: true }), 'rosh-chodesh');
});

test('holidayTagFor maps real Hebcal/Hebrew names to semantic tags without guessing', () => {
  assert.equal(holidayTagFor('Sukkot I'), 'sukkot');
  assert.equal(holidayTagFor('סוכות א׳'), 'sukkot');
  assert.equal(holidayTagFor('Pesach VII'), 'pesach');
  assert.equal(holidayTagFor('Erev Rosh Hashana'), 'rosh-hashanah');
  assert.equal(holidayTagFor('Yom Kippur'), 'yom-kippur');
  assert.equal(holidayTagFor('Chanukah: 1 Candle'), 'chanukah');
  assert.equal(holidayTagFor('Purim'), 'purim');
  assert.equal(holidayTagFor('Some unrelated fast'), null);
});

test('a holiday window of about two days before selects THAT holiday, not a generic bucket', () => {
  assert.equal(contextualHalachaCategory({ key: '2026-09-23', upcomingHoliday: { date: '2026-09-25', hebrew: 'סוכות א׳' } }), 'sukkot');
  assert.equal(contextualHalachaCategory({ key: '2026-09-25', upcomingHoliday: { date: '2026-09-25', hebrew: 'סוכות א׳' } }), 'sukkot');
  assert.equal(contextualHalachaCategory({ key: '2026-09-20', upcomingHoliday: { date: '2026-09-25', hebrew: 'סוכות א׳' } }), null);
});

test('the holiday itself and Chol HaMoed select that specific holiday tag', () => {
  assert.equal(contextualHalachaCategory({ isYomTov: true, specialDay: { desc: 'Sukkot I' } }), 'sukkot');
  assert.equal(contextualHalachaCategory({ isCholHaMoed: true, specialDay: { desc: 'Chol HaMoed Sukkot' } }), 'sukkot');
});

test('Aseret Yemei Teshuvah is its own tag, distinct from Rosh Hashana/Yom Kippur day-of', () => {
  assert.equal(contextualHalachaCategory({ isAseretYemeiTeshuvah: true, weekday: 2 }), 'aseret-yemei-teshuvah');
});

test('picking is deterministic per day and filters by the contextual tag', () => {
  const wednesday = { key: '2026-09-23', weekday: 3 };
  const picked = pickDailyHalacha(wednesday, { storage: storage() });
  assert.equal(picked.contextTag, 'shabbat');
  assert.equal(picked.fallback, false);
  const pickedAgain = pickDailyHalacha(wednesday, { storage: storage() });
  assert.equal(picked.id, pickedAgain.id);
});

test('rotation avoids immediately repeating the same halacha', () => {
  const context = { key: '2026-09-23', weekday: 3 };
  const store = storage();
  const first = pickDailyHalacha(context, { storage: store });
  const second = pickDailyHalacha({ ...context, key: '2026-09-24' }, { storage: store });
  assert.notEqual(first.id, second.id);
});

test('does not invent content: every pick comes from the existing verified pool', () => {
  const pool = [
    { id: 'a', category: 'shabbat', tags: ['shabbat'], answerStatus: 'published' },
    { id: 'b', category: 'shabbat', tags: ['shabbat'], answerStatus: 'published' },
  ];
  const picked = pickDailyHalacha({ key: '2026-09-23', weekday: 3 }, { storage: storage(), pool });
  assert.ok(['a', 'b'].includes(picked.id));
});

test('when no verified content matches the requested holiday tag, the fallback is honest (no false label)', () => {
  // Sukkot has no dedicated published entry in the current corpus, so requesting it
  // must fall back to the general pool and report fallback:true / contextTag:null —
  // never silently mislabel unrelated content (e.g. the Omer question) as Sukkot content.
  const hasSukkotContent = PRACTICAL_HALACHA_QA.some(item => (item.tags || []).includes('sukkot'));
  assert.equal(hasSukkotContent, false, 'this test documents the current corpus gap; update it once Sukkot content is added');
  const picked = pickDailyHalacha({ key: '2026-09-23', upcomingHoliday: { date: '2026-09-25', hebrew: 'סוכות א׳' } }, { storage: storage() });
  assert.equal(picked.requestedTag, 'sukkot');
  assert.equal(picked.contextTag, null);
  assert.equal(picked.fallback, true);
  assert.notEqual(picked.id, 'qa-forgot-omer', 'the Omer question must never be shown as if it were Sukkot content');
});

test('REGRESSION 24.9.2026: two days before Sukkot must not surface Sefirat HaOmer content mislabeled as holiday content', () => {
  const context = {
    key: '2026-09-24',
    weekday: 4,
    isRoshChodesh: false,
    isYomTov: false,
    isCholHaMoed: false,
    isAseretYemeiTeshuvah: false,
    upcomingHoliday: { date: '2026-09-26', hebrew: 'סוכות א׳' },
  };
  const tag = contextualHalachaCategory(context);
  assert.equal(tag, 'sukkot');
  const candidatePool = PRACTICAL_HALACHA_QA.filter(item => item.answerStatus === 'published' && (item.tags || []).includes(tag));
  assert.deepEqual(candidatePool, [], 'candidate pool for the specific requested tag is honestly empty');
  const picked = pickDailyHalacha(context, { storage: storage() });
  assert.equal(picked.fallback, true);
  assert.notEqual(picked.id, 'qa-forgot-omer');
});
