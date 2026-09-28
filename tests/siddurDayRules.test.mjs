// The day rules every rite relies on: Tachanun days, Hallel full/half/none, public fasts, the rain wording at Musaf,
// Motzaei Yom Tov, and conditions with a key the app cannot know.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HDate } from '@hebcal/core';
import { JewishContextEngine, tachanunOmitted } from '../src/services/jewishContextEngine.mjs';
import { compositionConditions, undecidable, whenHolds, dayNumbers } from '../src/services/prayer/riteServiceComposer.mjs';

const ctx = (hd, prayerType = 'shacharit', il = true) => {
  const g = new HDate(...hd).greg();
  const now = new Date(Date.UTC(g.getFullYear(), g.getMonth(), g.getDate(), prayerType === 'mincha' ? 11 : 6));
  return JewishContextEngine({ now, prayerType, settings: { location: { tzid: 'Asia/Jerusalem' }, halachicResidenceStatus: il ? 'israel' : 'diaspora', il } });
};
const NISAN = 1, IYAR = 2, SIVAN = 3, AV = 5, TISHREI = 7, SHEVAT = 11;

test('Tachanun: said in the Ten Days, not from Erev Yom Kippur to the end of Tishrei, 1–12 Sivan, Pesach Sheni, Lag BaOmer, Tisha B\'Av, 15 Av, 15 Shevat', () => {
  const omitted = (month, day) => tachanunOmitted({ month, day }, false, false, false, false, 'shacharit');
  assert.equal(omitted(TISHREI, 5), false, 'between Rosh HaShanah and Yom Kippur');
  for (const [m, d] of [[TISHREI, 1], [TISHREI, 9], [TISHREI, 25], [SIVAN, 3], [SIVAN, 12], [IYAR, 14], [IYAR, 18], [AV, 9], [AV, 15], [SHEVAT, 15]]) assert.equal(omitted(m, d), true, `${m}/${d}`);
  assert.equal(omitted(SIVAN, 13), false);
});

test('Mincha of Erev Shabbat has no Tachanun', () => {
  // the first Friday after 5 Cheshvan 5786 (an ordinary week: Tachanun at its Shacharit)
  let day = 5; while (new HDate(day, 8, 5786).getDay() !== 5) day += 1;
  assert.equal(ctx([day, 8, 5786], 'mincha').prayerContext.omitTachanun, true);
  assert.equal(ctx([day, 8, 5786], 'shacharit').prayerContext.omitTachanun, false);
});

test('Hallel: full on Shemini Atzeret and the diaspora\'s second days, half on Rosh Chodesh and the rest of Pesach', () => {
  assert.equal(ctx([22, TISHREI, 5786]).prayerContext.hallel, 'הלל שלם');
  assert.equal(ctx([16, NISAN, 5786], 'shacharit', false).prayerContext.hallel, 'הלל שלם');
  assert.equal(ctx([16, NISAN, 5786], 'shacharit', true).prayerContext.hallel, 'חצי הלל');
  assert.equal(ctx([7, SIVAN, 5786], 'shacharit', false).prayerContext.hallel, 'הלל שלם');
  assert.equal(ctx([22, NISAN, 5786], 'shacharit', false).prayerContext.hallel, 'חצי הלל');
  assert.equal(ctx([1, IYAR, 5786]).prayerContext.hallel, 'חצי הלל');
  assert.equal(ctx([5, IYAR, 5786]).prayerContext.hallel, null);
});

test('only a public fast is a fast: not the fast of the firstborn', () => {
  assert.equal(ctx([14, NISAN, 5786]).prayerContext.fast, false, 'תענית בכורות');
  assert.equal(ctx([17, 4, 5786]).prayerContext.fast || ctx([18, 4, 5786]).prayerContext.fast, true, 'י״ז בתמוז (or its postponement)');
});

test('the rain wording turns at Musaf', () => {
  const at = (hd, servicePrayer) => compositionConditions({ ...ctx(hd), servicePrayer });
  assert.equal(at([15, NISAN, 5786], 'mussaf').summer, true);
  assert.equal(at([22, TISHREI, 5786], 'mussaf').winter, true);
});

test('Motzaei Yom Tov is its own key', () => {
  const n = dayNumbers({ day: 23, month: TISHREI, year: 5786 }, true);
  assert.equal(n.yomTovYesterday && !n.yomTovToday, true);
  const c = compositionConditions({ ...ctx([23, TISHREI, 5786]), prayerType: 'maariv', servicePrayer: 'maariv' });
  assert.equal(c.motzaeiYomTov, true);
});

test('a condition naming a key the app cannot know is hidden when its known part rules it out', () => {
  const c = { roshChodesh: true };
  assert.equal(undecidable('houseOfMourning&!roshChodesh', c), false);
  assert.equal(whenHolds('houseOfMourning&!roshChodesh', c), false);
  assert.equal(undecidable('houseOfMourning&!roshChodesh', { roshChodesh: false }), true);
  assert.equal(undecidable('houseOfMourning|roshChodesh', c), false, 'a true branch decides it');
});

test('30 Tishrei is Rosh Chodesh Cheshvan; 1 Tishrei is not Rosh Chodesh', () => {
  assert.equal(ctx([30, TISHREI, 5786]).additions.some(item => item.kind === 'yaaleh-veyavo'), true);
  assert.equal(ctx([1, TISHREI, 5786]).additions.some(item => item.kind === 'yaaleh-veyavo'), false);
});

test('the seasonal line: winter wording on the first day of Pesach at Shacharit, winter from Musaf of Shemini Atzeret', async () => {
  const { loadSiddur } = await import('../src/services/nusach.mjs');
  const { COMPOSITIONS } = await import('../src/data/nusach/compositions/index.mjs');
  const { composeRiteService } = await import('../src/services/prayer/riteServiceComposer.mjs');
  const pack = await loadSiddur('sefard');
  const gevurot = (hd, serviceId, prayer) => {
    const context = { ...ctx(hd, prayer === 'mussaf' ? 'shacharit' : prayer), servicePrayer: prayer };
    const doc = composeRiteService({ composition: COMPOSITIONS.sefard, serviceId, texts: pack.texts, context });
    return doc.sections.find(section => section.id === 'gevurot').blocks.map(block => block.text).join(' ').replace(/[\u0591-\u05C7]/g, '');
  };
  assert.match(gevurot([15, NISAN, 5786], 'festival-amidah', 'shacharit'), /משיב הרוח/);
  assert.match(gevurot([22, TISHREI, 5786], 'festival-musaf', 'mussaf'), /משיב הרוח/);
  assert.doesNotMatch(gevurot([22, TISHREI, 5786], 'festival-musaf', 'mussaf'), /מוריד הטל/);
  assert.match(gevurot([6, SIVAN, 5786], 'festival-amidah', 'shacharit'), /מוריד הטל/);
});
