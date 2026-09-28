// נר ה' נשמת אדם — the yahrzeits of famous tzaddikim on today's Hebrew date, under ממתק הלכתי.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HDate } from '@hebcal/core';
import { YAHRZEITS } from '../src/data/yahrzeits.mjs';
import { yahrzeitsOn, observedMonths, isLeapYear, labelFor, nameWithHonorific, spokenSummary, MONTH } from '../src/services/yahrzeits.mjs';
import { JewishContextEngine } from '../src/services/jewishContextEngine.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const byId = Object.fromEntries(YAHRZEITS.map(r => [r.id, r]));
const onDate = (day, monthName, year) => yahrzeitsOn({ day, month: MONTH[monthName], year }, YAHRZEITS).map(r => r.displayNameHe);
const PLAIN = 5785; const LEAP = 5784;

test('a curated list of famous tzaddikim, each with its date and honorific; no duplicates', () => {
  assert.ok(YAHRZEITS.length >= 300 && YAHRZEITS.length <= 450, `${YAHRZEITS.length}`);
  assert.equal(new Set(YAHRZEITS.map(r => r.id)).size, YAHRZEITS.length);
  for (const r of YAHRZEITS) {
    assert.ok(r.hebrewDate.day >= 1 && r.hebrewDate.day <= 30, r.id);
    assert.ok(r.honorific, `${r.id}: honorific set explicitly`);
    assert.match(r.dateType, /^(documented_death|traditional_yahrzeit|traditional_hilula|owner_verified|disputed)$/, r.id);
  }
  const doc = read('../docs/yahrzeits/famous-tzadikim-research.md');
  assert.match(doc, /candidates researched: \d+/);
  assert.match(doc, /## Rejected/);
});

test('the dates the brief pins, exactly', () => {
  const at = (name, day, month, year = PLAIN) => assert.ok(onDate(day, month, year).some(n => n.includes(name)), `${name} on ${day} ${month}`);
  at('רבי שלום איפרגן', 8, 'Tamuz');
  at('הרבנית זהבית זוהרה ברבי', 29, 'AdarII', LEAP);
  at('הרבנית זהבית זוהרה ברבי', 29, 'Adar', PLAIN);
  at('אהרן הכהן', 1, 'Av');
  at('משה רבנו', 7, 'Adar');
  at('רבי נחמן מברסלב', 18, 'Tishrei');
  at('רבי שמעון בר יוחאי', 18, 'Iyar');
  at('בעל שם טוב', 6, 'Sivan');
  at('בבא סאלי', 4, 'Shevat');
  at('עובדיה יוסף', 3, 'Cheshvan');
  at('אור החיים', 15, 'Tamuz');
  at('בן איש חי', 13, 'Elul');
  at('הרבי מליובאוויטש', 3, 'Tamuz');
  assert.equal(byId['rabbi-shalom-ifergan'].ownerPinned, true);
  assert.equal(byId['rabbanit-zehavit-zohara-barbi'].ownerPinned, true);
  assert.equal(byId['rabbanit-zehavit-zohara-barbi'].dateType, 'owner_verified');
});

test('Adar, Adar I and Adar II each keep their own rule in a leap year', () => {
  assert.equal(isLeapYear(LEAP), true); assert.equal(isLeapYear(PLAIN), false);
  assert.deepEqual(observedMonths({ hebrewDate: { month: 'Adar', leapYearPolicy: 'adar2' } }, LEAP), [13]);
  assert.deepEqual(observedMonths({ hebrewDate: { month: 'Adar', leapYearPolicy: 'adar1' } }, LEAP), [12]);
  assert.deepEqual(observedMonths({ hebrewDate: { month: 'Adar', leapYearPolicy: 'both' } }, LEAP), [12, 13]);
  assert.deepEqual(observedMonths({ hebrewDate: { month: 'AdarI' } }, PLAIN), [12]);
  assert.deepEqual(observedMonths({ hebrewDate: { month: 'AdarII' } }, PLAIN), [12]);
  // משה רבנו: the poskim differ (Mishna Berura Adar I, Sephardi practice Adar II) — shown on both
  assert.ok(onDate(7, 'AdarI', LEAP).includes('משה רבנו'));
  assert.ok(onDate(7, 'AdarII', LEAP).includes('משה רבנו'));
  // the Rabbanit died in Adar II: in a leap year never in Adar I
  assert.ok(!onDate(29, 'AdarI', LEAP).some(n => n.includes('זהבית')));
});

test('a 30th in a 29-day month is kept on the 29th', () => {
  const r = { id: 'x', displayNameHe: 'א', hebrewDate: { day: 30, month: 'Cheshvan' } };
  assert.equal(yahrzeitsOn({ day: 29, month: 8, year: PLAIN }, [r], { monthLengths: { 8: 29 } }).length, 1);
  assert.equal(yahrzeitsOn({ day: 29, month: 8, year: PLAIN }, [r], { monthLengths: { 8: 30 } }).length, 0);
});

test('several on one day: pinned first, then Hebrew alphabetical order — no ranking', () => {
  const list = [{ id: 'b', displayNameHe: 'רבי ב', hebrewDate: { day: 1, month: 'Av' } }, { id: 'a', displayNameHe: 'רבי א', hebrewDate: { day: 1, month: 'Av' } }, { id: 'p', displayNameHe: 'ת', ownerPinned: true, hebrewDate: { day: 1, month: 'Av' } }];
  assert.deepEqual(yahrzeitsOn({ day: 1, month: 5, year: PLAIN }, list).map(r => r.id), ['p', 'a', 'b']);
  const eighth = yahrzeitsOn({ day: 8, month: MONTH.Tamuz, year: PLAIN }, YAHRZEITS);
  assert.equal(eighth[0].id, 'rabbi-shalom-ifergan');
  assert.ok(Object.values(YAHRZEITS.reduce((o, r) => { const k = `${r.hebrewDate.month}${r.hebrewDate.day}`; o[k] = (o[k] || 0) + 1; return o; }, {})).some(n => n > 1), 'some days carry several');
});

test('labels: a tzaddik, a tzaddeket; the honorific each record defines; what VoiceOver says', () => {
  assert.equal(labelFor(byId['rabbanit-zehavit-zohara-barbi']), 'אזכרת הצדקת');
  assert.equal(labelFor(byId['lubavitcher-rebbe']), 'אזכרת הצדיק');
  assert.equal(nameWithHonorific({ displayNameHe: 'רבי א', honorific: 'זיע״א' }), 'רבי א זיע״א');
  assert.equal(spokenSummary([byId['lubavitcher-rebbe']]), "נר ה' נשמת אדם. הרבי מליובאוויטש.");
  const strip = read('../src/components/NerHashem.jsx');
  assert.doesNotMatch(strip, /labelFor|אזכרת הצדיק/, 'the strip shows the name alone');
  assert.match(strip, /<Candle \/><span className="ner-title">נר ה׳ נשמת אדם<\/span><Candle mirror \/>/, 'a candle on each side of the title');
  assert.equal(spokenSummary([byId['lubavitcher-rebbe'], byId['rabbi-shalom-ifergan'], byId['rabbi-shalom-ifergan'], byId['rabbi-shalom-ifergan']]), "נר ה' נשמת אדם. ארבע אזכרות היום. הקש להצגת הרשימה.");
  const women = YAHRZEITS.filter(r => r.gender === 'f');
  assert.ok(women.length >= 3, 'the matriarchs, the prophetess and the rabbaniyot');
});

test('the day turns at sunset: the date comes from the app\'s own Jewish context', () => {
  // 8 Tamuz 5785 begins at sunset on 3 July 2025
  const settings = { location: { tzid: 'Asia/Jerusalem' }, halachicResidenceStatus: 'israel' };
  const sunset = '2025-07-03T16:48:00Z';  // 19:48 in Jerusalem
  const before = JewishContextEngine({ now: new Date('2025-07-03T15:30:00Z'), settings, times: { sunset } });
  const after = JewishContextEngine({ now: new Date('2025-07-03T17:30:00Z'), settings, times: { sunset } });
  const midnight = JewishContextEngine({ now: new Date('2025-07-03T20:59:00Z'), settings, times: { sunset } });
  const names = ctx => yahrzeitsOn(ctx.hebrewDate, YAHRZEITS).map(r => r.id);
  assert.ok(!names(before).includes('rabbi-shalom-ifergan'));
  assert.ok(names(after).includes('rabbi-shalom-ifergan'), 'after sunset, the new day');
  assert.ok(names(midnight).includes('rabbi-shalom-ifergan'), 'still the same day before civil midnight');
  assert.equal(new HDate(new Date(2025, 6, 4)).getDate(), 8);
  assert.match(read('../src/pages/TodayPage.jsx'), /<NerHashem hebrewDate=\{context\?\.hebrewDate\} \/>/);
});

test('placement, candle, frame, motion and offline', () => {
  const today = read('../src/pages/TodayPage.jsx');
  const treat = today.indexOf('להלכה המלאה ←');
  const ner = today.indexOf('<NerHashem');
  assert.ok(treat > 0 && ner > treat, 'right under ממתק הלכתי');
  assert.equal(today.slice(treat, ner).match(/<(button|section|div)\b/g), null, 'nothing between them');
  const component = read('../src/components/NerHashem.jsx');
  assert.match(component, /<svg className={`ner-candle/);
  assert.doesNotMatch(component, /🕯|🔥/u, 'no emoji');
  assert.doesNotMatch(component, /fetch\(|https?:/);
  const css = read('../src/styles/base.css');
  // the frame of ממתק הלכתי exactly: the same border, halo and shadow
  const treatCss = css.match(/\.halacha-treat\{[^}]*\}/)[0];
  const nerCss = [...css.matchAll(/\.ner-hashem\{[^}]*\}/g)].at(-1)[0];
  for (const part of ['border:1.5px solid color-mix(in srgb,#b8912f 70%,var(--accent))', 'box-shadow:0 0 0 4px color-mix(in srgb,#b8912f 10%,transparent),var(--shadow)', 'border-radius:var(--radius)']) {
    assert.ok(treatCss.includes(part) && nerCss.includes(part), part);
  }
  assert.match(css, /animation:ner-flame 3\.4s ease-in-out infinite/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{.*\.ner-flame,\.ner-halo\{animation:none\}/);
  assert.match(css, /\.ner-inner\{[^}]*min-height:44px/);
});
