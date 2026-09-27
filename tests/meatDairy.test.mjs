// בשרי · חלבי — the wait, its default, and "I ate at another hour".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MEAT_DAIRY_HOURS, MEAT_DAIRY_DEFAULT_HOURS, mealInstant, meatDairyStatus, formatRemaining } from '../src/services/meatDairy.mjs';

test('six hours by default, three offered', () => {
  assert.equal(MEAT_DAIRY_DEFAULT_HOURS, 6);
  assert.deepEqual([...MEAT_DAIRY_HOURS], [6, 3]);
});

test('ate at 14:00, now 15:00 — five hours are left; dairy from 20:00', () => {
  const now = new Date(2026, 8, 27, 15, 0);
  const meal = mealInstant(now, 14, 0);
  const status = meatDairyStatus({ startedAt: meal.toISOString(), hours: 6 }, now);
  assert.equal(formatRemaining(status.remaining), '5:00');
  assert.equal(status.end.getHours(), 20);
  assert.equal(status.done, false);
  const three = meatDairyStatus({ startedAt: meal.toISOString(), hours: 3 }, now);
  assert.equal(formatRemaining(three.remaining), '2:00');
});

test('a later clock hour means yesterday; a finished wait lingers, then clears', () => {
  const now = new Date(2026, 8, 27, 1, 30);
  assert.equal(mealInstant(now, 23, 0).getDate(), 26);
  const meal = new Date(2026, 8, 27, 8, 0).toISOString();
  assert.equal(meatDairyStatus({ startedAt: meal, hours: 6 }, new Date(2026, 8, 27, 14, 30)).done, true);
  assert.equal(meatDairyStatus({ startedAt: meal, hours: 6 }, new Date(2026, 8, 27, 17, 30)), null);
  assert.equal(meatDairyStatus(null, new Date()), null);
});

test('rounded up: the countdown never shows 0:00 while the wait is still running', () => {
  assert.equal(formatRemaining(30000), '0:01');
  assert.equal(formatRemaining(0), '0:00');
});

test('the card sits beside the smart prayer as a symmetric pair', () => {
  const today = readFileSync(new URL('../src/pages/TodayPage.jsx', import.meta.url), 'utf8');
  assert.match(today, /<\/div>\}\n\s*<MeatDairyTimer \/>/);
  const css = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /\.learning-resume-grid>\.smart-prayer-wrap\{grid-column:1\/-1\}/);
});
