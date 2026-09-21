import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatTanakhReference } from '../src/services/personalTools.mjs';
import { dayContext } from '../src/dayContext.mjs';

const settings = { il: true, nusach: 'edot-hamizrach', location: { tzid: 'Asia/Jerusalem' } };

test('Tanakh references are rendered in Hebrew while canonical refs remain parseable', () => {
  assert.equal(formatTanakhReference('Deuteronomy 32:1-52'), 'דברים ל״ב, א׳–נ״ב');
  assert.equal(formatTanakhReference('Genesis 1:1'), 'בראשית א׳, א׳');
  assert.equal(formatTanakhReference('I Samuel 15:2-34'), 'שמואל א ט״ו, ב׳–ל״ד');
  assert.equal(formatTanakhReference('II Kings 12:1-17'), 'מלכים ב י״ב, א׳–י״ז');
});

test('day context exposes the canonical upcoming weekly parasha on weekdays', () => {
  const items = [{
    category: 'parashat',
    date: '2026-02-14',
    hebrew: 'משפטים',
    leyning: { torah: 'Exodus 21:1-24:18' },
  }];
  const context = dayContext(new Date('2026-02-13T10:00:00Z'), settings, { sunset: '2026-02-13T16:30:00Z' }, items);
  assert.equal(context.parasha.hebrew, 'משפטים');
  assert.equal(context.parasha.leyning.torah, 'Exodus 21:1-24:18');
  assert.equal(context.shabbatReading, context.parasha);
});

test('a festival on the coming Shabbat replaces the weekly parasha as the Shabbat reading', () => {
  const items = [
    { category: 'holiday', subcat: 'major', date: '2026-09-26', title: 'Sukkot I', hebrew: 'סוכות א׳', leyning: { torah: 'Leviticus 22:26-23:44; Numbers 29:12-16', haftarah: 'Zechariah 14:1-21' } },
    { category: 'parashat', date: '2026-10-10', title: 'Parashat Bereshit', hebrew: 'פרשת בראשית', leyning: { torah: 'Genesis 1:1-6:8', haftarah: 'I Samuel 20:18-42 | Shabbat Machar Chodesh' } },
  ];
  const context = dayContext(new Date('2026-09-22T10:00:00Z'), settings, { sunset: '2026-09-22T15:40:00Z' }, items);
  assert.equal(context.parasha.hebrew, 'פרשת בראשית');
  assert.equal(context.shabbatReading.hebrew, 'סוכות א׳');
  assert.equal(context.shabbatReading.leyning.haftarah, 'Zechariah 14:1-21');
});