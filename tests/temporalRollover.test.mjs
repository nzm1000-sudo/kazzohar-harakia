import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getNextRelevantZman } from '../src/services.mjs';
import { activePreparation } from '../src/services/preparationPlan.mjs';

const times = {
  chatzotNight: '2026-09-21T00:34:00+03:00',
  alotHaShachar: '2026-09-21T05:16:00+03:00',
  sunrise: '2026-09-21T06:28:00+03:00',
  sunset: '2026-09-21T18:42:00+03:00',
  tzeit85deg: '2026-09-21T19:05:00+03:00',
  nextDay: { chatzotNight: '2026-09-22T00:34:00+03:00' },
};

test('next zman advances through daytime, night midpoint, and next-day dawn', () => {
  assert.equal(getNextRelevantZman('2026-09-21T18:50:00+03:00', times).key, 'tzeit85deg');
  assert.equal(getNextRelevantZman('2026-09-21T19:10:00+03:00', times).key, 'chatzotNight');
  assert.equal(getNextRelevantZman('2026-09-22T00:40:00+03:00', { nextDay: { ...times, alotHaShachar: '2026-09-22T05:16:00+03:00' } }).key, 'alotHaShachar');
});

test('preparation does not keep the current holiday as the next event', () => {
  const items = [{ category: 'holiday', date: '2026-09-21', title: 'Yom Kippur', hebrew: 'יום כיפור' }];
  const plan = activePreparation({
    now: new Date('2026-09-21T20:00:00+03:00'),
    tz: 'Asia/Jerusalem',
    currentJewishKey: '2026-09-21',
    items,
  });
  assert.notEqual(plan.templateId, 'yom-kippur');
});

test('preparation does not reopen the next Shabbat after sunset starts Shabbat', () => {
  const plan = activePreparation({
    now: new Date('2026-09-25T19:00:00+03:00'),
    tz: 'Asia/Jerusalem',
    currentJewishKey: '2026-09-26',
    items: [],
  });
  assert.equal(plan.kind, 'none');
});