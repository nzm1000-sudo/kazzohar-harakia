// Final Siddur QA — Nusach Edot HaMizrach (data/nusach/compositions/edot.mjs). What the final review fixed or decided,
// read from the composed service itself (composeRiteService + the rite's own pack): today's line of the Omer table,
// אתה חוננתנו on Motzaei Yom Tov, the reading of each Chanukah day and of Purim, Hallel full / half / none, the festival
// Amidah by the prayer of the hour, במה מדליקין, צדקתך / יהי שם, Birkat HaChodesh, no truncated Kaddish, no other rite.
// Review log: docs/siddur/review-edot.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import edot, { omerDateLine } from '../src/data/nusach/compositions/edot.mjs';
import { SERVICE_INDEX, COMPLETENESS } from '../src/data/nusach/prayerSchema.mjs';
import { loadSiddur } from '../src/services/nusach.mjs';
import { composeRiteService, compositionConditions } from '../src/services/prayer/riteServiceComposer.mjs';
import { checkService } from '../src/services/prayer/siddurQa.mjs';
import { removeNikud } from '../src/hebrewText.mjs';
import { JewishContextEngine } from '../src/services/jewishContextEngine.mjs';

const pack = await loadSiddur('edot-hamizrach');
const texts = pack.texts;

// The prayer of `date` as the reader builds it: Arvit belongs to the coming night (after sunset).
const context = (date, prayer = 'shacharit', il = true) => {
  const hour = prayer === 'maariv' ? '21:30' : prayer === 'mincha' ? '13:30' : '08:00';
  const settings = { location: { tzid: 'Asia/Jerusalem' }, halachicResidenceStatus: il ? 'israel' : 'diaspora' };
  const now = new Date(`${date}T${hour}:00+03:00`);
  const sunset = new Date(`${date}T18:00:00+03:00`);
  return { ...JewishContextEngine({ now, settings, times: { sunset }, prayerType: prayer === 'mussaf' ? 'shacharit' : prayer }), servicePrayer: prayer };
};
const compose = (serviceId, date, prayer, il = true, mode = 'prayer') => composeRiteService({ composition: edot, serviceId, texts, context: context(date, prayer, il), mode });
const ids = doc => doc.sections.map(section => section.id);
const section = (doc, id) => doc.sections.find(item => item.id === id);
const plain = item => removeNikud((item?.blocks || []).map(block => block.text).join(' '));

test('the QA levels after the final review', () => {
  const expected = {
    'weekday-shacharit': COMPLETENESS.CONDITIONS_PENDING, 'weekday-mincha': COMPLETENESS.VERIFIED, 'weekday-maariv': COMPLETENESS.VERIFIED,
    'bedtime-shema': COMPLETENESS.CONDITIONS_PENDING, 'kabbalat-shabbat': COMPLETENESS.CONDITIONS_PENDING, 'shabbat-maariv': COMPLETENESS.VERIFIED,
    'shabbat-kiddush': COMPLETENESS.CONDITIONS_PENDING, 'shabbat-shacharit': COMPLETENESS.CONDITIONS_PENDING, 'shabbat-musaf': COMPLETENESS.VERIFIED,
    'shabbat-kiddush-day': COMPLETENESS.VERIFIED, 'shabbat-mincha': COMPLETENESS.VERIFIED, havdalah: COMPLETENESS.VERIFIED,
    'birkat-hamazon': COMPLETENESS.VERIFIED, hallel: COMPLETENESS.VERIFIED, 'rosh-chodesh-musaf': COMPLETENESS.VERIFIED,
    omer: COMPLETENESS.VERIFIED, 'festival-amidah': COMPLETENESS.VERIFIED, 'festival-musaf': COMPLETENESS.CONDITIONS_PENDING,
  };
  for (const [serviceId, level] of Object.entries(expected)) {
    const result = checkService(serviceId, edot.services[serviceId], texts);
    assert.deepEqual(result.problems, [], serviceId);
    assert.equal(result.level, level, serviceId);
  }
});

test('Omer: in prayer mode only tonight\'s three lines of the table (days 1, 2, 7, 8, 33, 49); the full edition keeps all 49', () => {
  const nights = { 1: '2026-04-02', 2: '2026-04-03', 7: '2026-04-08', 8: '2026-04-09', 33: '2026-05-04', 49: '2026-05-20' };
  const counts = { 1: 'יום אחד לעמר', 2: 'שני ימים לעמר', 7: 'שבעה ימים לעמר, שהם שבוע אחד', 8: 'שמונה ימים לעמר', 33: 'שלשה ושלשים יום לעמר', 49: 'תשעה וארבעים יום לעמר' };
  for (const [day, date] of Object.entries(nights)) {
    const doc = compose('omer', date, 'maariv');
    assert.equal(compositionConditions(context(date, 'maariv')).omerDay, Number(day), `night of ${date}`);
    const count = section(doc, 'omer-count');
    const lines = count.blocks.map(block => removeNikud(block.text).replace(/[״"]/g, '"'));
    assert.equal(lines[0], omerDateLine(Number(day)), `day ${day}: the date line`);
    assert.ok(lines.some(line => line.includes(counts[day])), `day ${day}: the count`);
    assert.equal(lines.filter(line => /לעמר/.test(line)).length, 1, `day ${day}: one count only`);
    // The weekday Arvit shows the same single day (not on Friday night / Yom Tov night, when this service is not said).
    if (!['2026-04-03'].includes(date)) {
      const arvit = compose('weekday-maariv', date, 'maariv');
      assert.equal(plain(section(arvit, 'omer-count')).match(/לעמר/g)?.length, 1, `weekday Arvit, day ${day}`);
    }
  }
  const edition = compose('omer', '2026-05-04', 'maariv', true, 'edition');
  assert.equal(plain(section(edition, 'omer-count')).match(/לעמר/g).length, 49);
  // Outside the Omer the weekday Arvit has no count at all.
  assert.ok(!ids(compose('weekday-maariv', '2026-11-03', 'maariv')).some(id => id.startsWith('omer-')));
});

test('Arvit: אתה חוננתנו on Motzaei Shabbat and on Motzaei Yom Tov that falls on a weekday, not on an ordinary night', () => {
  assert.ok(compositionConditions(context('2026-04-08', 'maariv')).motzaeiYomTov, 'the night after the 7th of Pesach (Israel)');
  assert.ok(ids(compose('weekday-maariv', '2026-04-08', 'maariv')).includes('ata-chonantanu'));
  assert.ok(ids(compose('weekday-maariv', '2026-10-17', 'maariv')).includes('ata-chonantanu'), 'Motzaei Shabbat');
  assert.ok(!ids(compose('weekday-maariv', '2026-11-03', 'maariv')).includes('ata-chonantanu'));
  assert.match(plain(section(compose('weekday-maariv', '2026-04-08', 'maariv'), 'ata-chonantanu')), /^אתה חוננתנו/);
  // The full edition keeps the edition's rubric with it, labelled.
  const edition = compose('weekday-maariv', '2026-11-03', 'maariv', true, 'edition');
  assert.ok(ids(edition).includes('ata-chonantanu-rubric') && ids(edition).includes('ata-chonantanu'));
  assert.match(section(edition, 'ata-chonantanu').whenLabel, /במוצאי שבת/);
});

test('Chanukah: the Torah reading of the day only; on Rosh Chodesh Tevet after the Rosh Chodesh reading', () => {
  const day1 = compose('weekday-shacharit', '2025-12-15', 'shacharit');
  assert.match(plain(section(day1, 'chanukah-reading')), /נחשון בן ?עמינדב/);
  assert.doesNotMatch(plain(section(day1, 'chanukah-reading')), /נתנאל/);
  const day2 = compose('weekday-shacharit', '2026-12-06', 'shacharit');
  assert.match(plain(section(day2, 'chanukah-reading')), /נתנאל/);
  assert.doesNotMatch(plain(section(day2, 'chanukah-reading')), /נחשון|אליאב/);
  const day8 = plain(section(compose('weekday-shacharit', '2025-12-22', 'shacharit'), 'chanukah-reading'));
  assert.match(day8, /גמליאל/);
  assert.match(day8, /כן עשה את ?המנרה/);
  const rcTevet = ids(compose('weekday-shacharit', '2026-12-10', 'shacharit'));
  assert.ok(rcTevet.indexOf('rc-reading') > 0 && rcTevet.indexOf('chanukah-reading') === rcTevet.indexOf('rc-reading') + 1, 'Rosh Chodesh Tevet: the day\'s reading after Rosh Chodesh');
  assert.match(plain(section(compose('weekday-shacharit', '2026-12-10', 'shacharit'), 'chanukah-reading')), /אליסף/);
  assert.ok(!ids(compose('weekday-shacharit', '2026-11-02', 'shacharit')).includes('chanukah-reading'));
});

test('Purim: ויבא עמלק is read; on other days it is not', () => {
  const purim = compose('weekday-shacharit', '2026-03-03', 'shacharit');
  const order = ids(purim);
  assert.ok(order.indexOf('aliyah-before') < order.indexOf('purim-reading') && order.indexOf('purim-reading') < order.indexOf('aliyah-after'));
  assert.match(plain(section(purim, 'purim-reading')), /^ויבא/);
  assert.ok(!ids(compose('weekday-shacharit', '2026-11-02', 'shacharit')).includes('purim-reading'));
});

test('Hallel: full with its blessing on Sukkot and Chanukah, half on Rosh Chodesh and Chol HaMoed Pesach, none on an ordinary day', () => {
  const full = ids(compose('weekday-shacharit', '2026-09-28', 'shacharit'));
  for (const id of ['hallel-blessing', 'lo-lanu', 'ahavti', 'yehallelucha']) assert.ok(full.includes(id), `Sukkot: ${id}`);
  for (const date of ['2026-04-05', '2026-10-12']) {
    const half = ids(compose('weekday-shacharit', date, 'shacharit'));
    assert.ok(half.includes('hallel') && !half.includes('hallel-blessing') && !half.includes('lo-lanu') && !half.includes('ahavti'), date);
  }
  const chanukah = compose('weekday-shacharit', '2025-12-15', 'shacharit');
  assert.ok(ids(chanukah).includes('hallel-blessing'));
  assert.ok(!ids(chanukah).includes('hallel-titkabal'), 'on Chanukah only half Kaddish after Hallel');
  assert.ok(!ids(compose('weekday-shacharit', '2026-11-03', 'shacharit')).some(id => ['hallel', 'hallel-blessing', 'hallel-kaddish'].includes(id)));
});

test('the festival Amidah takes the prayer of the hour: no Kedusha / Modim deRabbanan at Arvit, Birkat Kohanim only at Shacharit', () => {
  const shacharit = ids(compose('festival-amidah', '2026-09-26', 'shacharit'));
  const mincha = ids(compose('festival-amidah', '2026-09-26', 'mincha'));
  const arvit = ids(compose('festival-amidah', '2026-09-25', 'maariv'));
  for (const id of ['kedusha', 'modim-derabanan', 'birkat-kohanim']) assert.ok(shacharit.includes(id), `Shacharit: ${id}`);
  assert.ok(mincha.includes('kedusha') && mincha.includes('modim-derabanan') && !mincha.includes('birkat-kohanim'), 'Mincha');
  assert.ok(!arvit.includes('kedusha') && !arvit.includes('modim-derabanan') && !arvit.includes('birkat-kohanim'), 'Arvit');
  // Motzaei Shabbat into Yom Tov: ותודיענו.
  assert.ok(ids(compose('festival-amidah', '2026-10-03', 'maariv', false)).includes('vatodienu'));
});

test('Kabbalat Shabbat: במה מדליקין on an ordinary Shabbat only — not after a Friday of Yom Tov, on Erev Yom Tov, Chanukah, Yom Tov or 24 Kislev', () => {
  assert.ok(ids(compose('kabbalat-shabbat', '2026-10-16', 'maariv')).includes('bameh-madlikin'));
  for (const [date, il, why] of [['2026-05-22', true, 'after Shavuot on Friday'], ['2026-05-22', false, 'second day of Shavuot'], ['2025-04-11', true, 'Shabbat Erev Pesach'], ['2026-12-04', true, 'Shabbat Chanukah'], ['2026-10-02', true, 'Shemini Atzeret']]) {
    const doc = compose('kabbalat-shabbat', date, 'maariv', il);
    assert.ok(!ids(doc).includes('bameh-madlikin'), why);
    assert.ok(ids(doc).includes('rabbi-elazar'), `${why}: אמר רבי אלעזר is always said`);
  }
  // 24 Kislev on Shabbat (Chanukah begins on Motzaei Shabbat).
  const erevChanukah = { hebrewDate: { day: 24, month: 9, year: 5790 }, key: '2029-12-01', prayerType: 'maariv', servicePrayer: 'maariv', prayerContext: { type: 'maariv' } };
  assert.ok(compositionConditions(erevChanukah).erevChanukah);
  assert.ok(!ids(composeRiteService({ composition: edot, serviceId: 'kabbalat-shabbat', texts, context: erevChanukah })).includes('bameh-madlikin'));
});

test('Shabbat Mincha: צדקתך on a Shabbat that would have Tachanun, otherwise יהי שם — never both', () => {
  const tachanun = ids(compose('shabbat-mincha', '2026-10-17', 'mincha'));
  assert.ok(tachanun.includes('tzidkatcha') && !tachanun.includes('yehi-shem'));
  const festival = ids(compose('shabbat-mincha', '2026-10-03', 'mincha'));
  assert.ok(festival.includes('yehi-shem') && !festival.includes('tzidkatcha'));
});

test('Shabbat Shacharit: Birkat HaChodesh on Shabbat Mevarchim only', () => {
  assert.ok(ids(compose('shabbat-shacharit', '2026-10-10', 'shacharit')).includes('birkat-hachodesh'));
  assert.ok(!ids(compose('shabbat-shacharit', '2026-10-17', 'shacharit')).includes('birkat-hachodesh'));
});

test('Shabbat Arvit: Kaddish Yehe Shelama is complete (the edition\'s printed one lacks its opening)', () => {
  const kaddish = plain(section(compose('shabbat-maariv', '2026-10-16', 'maariv'), 'kaddish-yehe-shlama'));
  assert.match(kaddish, /יתגדל ויתקדש/);
  assert.match(kaddish, /דאמירן בעלמא/);
  assert.match(kaddish, /עושה שלום/);
  assert.doesNotMatch(kaddish, /תתקבל/);
});

test('weekday Shacharit on Rosh Chodesh: nothing of the weekday ending between Ashrei and ובא לציון', () => {
  const order = ids(compose('weekday-shacharit', '2026-10-12', 'shacharit'));
  assert.equal(order[order.indexOf('rc-ashrei') + 1], 'rc-uva-letzion');
  assert.ok(!order.includes('song-mourners'));
});

test('every service, many days: no truncated Kaddish, no empty section, nothing of another rite', () => {
  const dates = ['2026-11-02', '2026-11-03', '2026-10-23', '2026-10-17', '2026-10-12', '2026-12-20', '2026-07-23', '2025-12-15', '2026-12-10', '2026-03-03', '2026-09-28', '2026-04-05', '2026-04-08', '2026-05-04', '2026-05-22', '2026-10-03', '2026-09-26', '2026-12-05'];
  for (const [serviceId, service] of Object.entries(edot.services)) {
    for (const item of service.sections) assert.ok(item.ref.startsWith('Siddur Edot HaMizrach, '), `${serviceId}/${item.id}: ${item.ref}`);
    const prayer = SERVICE_INDEX[serviceId]?.prayerType || 'shacharit';
    for (const date of dates) for (const il of [true, false]) {
      const doc = compose(serviceId, date, prayer, il);
      doc.sections.forEach((item, index) => {
        assert.ok(item.blocks.length, `${serviceId} ${date}: ${item.id} is empty`);
        if (!/kaddish/.test(item.concept || '') || item.continues) return;
        // A Kaddish may go on in a continuation (Titkabal after Hallel is its own section, for Chanukah).
        const next = doc.sections[index + 1];
        const words = plain(item) + (next?.continues && next.concept === item.concept ? ` ${plain(next)}` : '');
        assert.match(words, /יתגדל ויתקדש/, `${serviceId} ${date}: ${item.id} opens with יתגדל`);
        assert.match(words, /דאמירן בעלמא/, `${serviceId} ${date}: ${item.id} is not cut`);
        // A full Kaddish ends with עושה שלום — except after Hallel on Chanukah ("ובחנוכה אומר רק חצי קדיש").
        if (item.concept !== 'half-kaddish' && !(item.id.endsWith('hallel-kaddish') && compositionConditions(context(date, prayer, il)).chanukah)) {
          assert.match(words, /עושה שלום/, `${serviceId} ${date}: ${item.id} is complete`);
        }
      });
    }
  }
});
