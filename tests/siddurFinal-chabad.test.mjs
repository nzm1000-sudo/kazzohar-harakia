// Final Siddur QA — Nusach Chabad (data/nusach/compositions/chabad.mjs). What the final review fixed or decided, read
// from the composed service itself (composeRiteService + the rite's own pack): the Musaf Kedusha כתר and the long
// Shabbat morning Kedusha, today's line of the Omer table, Hallel full / half / none (weekday and Shabbat), the festival
// Amidah by the prayer of the hour, the Musaf offerings of each festival day, Tal, Av HaRachamim and Birkat HaChodesh,
// Tachanun on Tisha B'Av and at Mincha of Erev Shabbat, no truncated Kaddish, no other rite.
// Review log: docs/siddur/review-chabad.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import chabad from '../src/data/nusach/compositions/chabad.mjs';
import { COMPLETENESS } from '../src/data/nusach/prayerSchema.mjs';
import { loadSiddur } from '../src/services/nusach.mjs';
import { composeRiteService, plainText } from '../src/services/prayer/riteServiceComposer.mjs';
import { checkService } from '../src/services/prayer/siddurQa.mjs';
import { JewishContextEngine } from '../src/services/jewishContextEngine.mjs';

const pack = await loadSiddur('chabad');
const texts = pack.texts;

// The prayer of `date` as the reader builds it: Arvit belongs to the coming night (after sunset).
const context = (date, prayer = 'shacharit', il = true) => {
  const hour = prayer === 'maariv' ? '21:30' : prayer === 'mincha' ? '13:30' : '08:00';
  const settings = { location: { tzid: 'Asia/Jerusalem' }, halachicResidenceStatus: il ? 'israel' : 'diaspora' };
  const now = new Date(`${date}T${hour}:00+03:00`);
  const sunset = new Date(`${date}T18:00:00+03:00`);
  return { ...JewishContextEngine({ now, settings, times: { sunset }, prayerType: prayer === 'mussaf' ? 'shacharit' : prayer }), servicePrayer: prayer };
};
const compose = (serviceId, date, prayer, il = true, mode = 'prayer') => composeRiteService({ composition: chabad, serviceId, texts, context: context(date, prayer, il), mode });
const ids = doc => doc.sections.map(section => section.id);
const section = (doc, id) => doc.sections.find(item => item.id === id);
const plain = item => plainText((item?.blocks || []).map(block => block.text).join(' '));

test('the QA levels after the final review', () => {
  const expected = {
    'weekday-shacharit': COMPLETENESS.VERIFIED, 'weekday-mincha': COMPLETENESS.VERIFIED, 'weekday-maariv': COMPLETENESS.VERIFIED,
    'bedtime-shema': COMPLETENESS.VERIFIED, 'kabbalat-shabbat': COMPLETENESS.VERIFIED, 'shabbat-maariv': COMPLETENESS.VERIFIED,
    'shabbat-kiddush': COMPLETENESS.VERIFIED, 'shabbat-shacharit': COMPLETENESS.SOURCE_GAP, 'shabbat-musaf': COMPLETENESS.VERIFIED,
    'shabbat-kiddush-day': COMPLETENESS.VERIFIED, 'shabbat-mincha': COMPLETENESS.VERIFIED, havdalah: COMPLETENESS.VERIFIED,
    'birkat-hamazon': COMPLETENESS.VERIFIED, hallel: COMPLETENESS.VERIFIED, 'rosh-chodesh-musaf': COMPLETENESS.VERIFIED,
    omer: COMPLETENESS.VERIFIED, 'festival-amidah': COMPLETENESS.VERIFIED, 'festival-musaf': COMPLETENESS.CONDITIONS_PENDING,
  };
  for (const [serviceId, level] of Object.entries(expected)) {
    const result = checkService(serviceId, chabad.services[serviceId], texts);
    assert.deepEqual(result.problems, [], serviceId);
    assert.equal(result.level, level, serviceId);
  }
});

test('Musaf Kedusha is כתר יתנו לך on Shabbat and Shabbat Rosh Chodesh, never the weekday נקדישך', () => {
  for (const date of ['2026-10-17', '2027-01-09']) {
    const kedusha = plain(section(compose('shabbat-musaf', date, 'mussaf'), 'kedusha'));
    assert.match(kedusha, /^.*כתר יתנו לך/, date);
    assert.match(kedusha, /ממקומו הוא יפן/, date);
    assert.match(kedusha, /אני יי אלהיכם/, date);
    assert.doesNotMatch(kedusha, /נקדישך/, date);
  }
  // The weekday Rosh Chodesh Musaf (Torah Or) and the festival Musaf say כתר too.
  assert.match(plain(section(compose('rosh-chodesh-musaf', '2026-11-11', 'mussaf'), 'kedusha')), /כתר יתנו לך/);
  assert.match(plain(section(compose('festival-musaf', '2026-10-03', 'mussaf'), 'kedusha')), /כתר יתנו לך/);
});

test('Shabbat Shacharit: the long morning Kedusha (אז בקול רעש גדול, ממקומך); Shabbat Mincha keeps the short one', () => {
  const kedusha = plain(section(compose('shabbat-shacharit', '2026-10-17', 'shacharit'), 'kedusha'));
  assert.match(kedusha, /נקדישך ונעריצך/);
  assert.match(kedusha, /אז, בקול רעש גדול/);
  assert.match(kedusha, /ממקומך מלכנו תופיע/);
  const mincha = plain(section(compose('shabbat-mincha', '2026-10-17', 'mincha'), 'kedusha'));
  assert.match(mincha, /נקדישך ונעריצך/);
  assert.doesNotMatch(mincha, /ממקומך/);
});

test('Omer: in prayer mode only tonight\'s line (days 1, 2, 7, 8, 33, 49); the full edition keeps all 49', () => {
  const nights = { 1: '2027-04-22', 2: '2027-04-23', 7: '2027-04-28', 8: '2027-04-29', 33: '2027-05-24', 49: '2027-06-09' };
  const counts = { 1: 'היום יום אחד לעמר', 2: 'היום שני ימים לעמר', 7: 'היום שבעה ימים שהם שבוע אחד לעמר', 8: 'היום שמונה ימים שהם שבוע אחד ויום אחד לעמר', 33: 'היום שלשה ושלשים יום', 49: 'היום תשעה וארבעים יום' };
  for (const [day, date] of Object.entries(nights)) {
    for (const [serviceId, id] of [['omer', 'omer-count'], ['weekday-maariv', 'maariv-omer-count']]) {
      const count = section(compose(serviceId, date, 'maariv'), id);
      const lines = count.blocks.map(block => plainText(block.text)).join(' | ');
      assert.ok(lines.includes(counts[day]), `${serviceId} day ${day}: ${lines}`);
      assert.equal((lines.match(/היום /g) || []).length, 1, `${serviceId} day ${day}: one day only — ${lines}`);
    }
  }
  // Tehillat Hashem's chart inside Friday-night Maariv (8 Iyar 5787 = day 23).
  const friday = plain(section(compose('shabbat-maariv', '2027-05-14', 'maariv'), 'omer-count'));
  assert.match(friday, /שלשה ועשרים יום/);
  assert.doesNotMatch(friday, /ארבעה ועשרים יום/);
  const edition = plain(section(compose('omer', '2027-04-22', 'maariv', true, 'edition'), 'omer-count'));
  assert.equal((edition.match(/היום /g) || []).length, 49);
});

test('Hallel: full on Chanukah and Sukkot, half on Rosh Chodesh and Chol HaMoed Pesach, none on an ordinary day', () => {
  const days = { '2026-12-07': 'full', '2026-09-28': 'full', '2026-11-11': 'half', '2027-04-25': 'half', '2026-11-02': 'none' };
  for (const [date, kind] of Object.entries(days)) {
    const doc = compose('weekday-shacharit', date, 'shacharit');
    assert.equal(ids(doc).includes('hallel-hallel'), kind !== 'none', date);
    assert.equal(ids(doc).includes('hallel-lo-lanu') && ids(doc).includes('hallel-ahavti'), kind === 'full', date);
  }
  // Shabbat Rosh Chodesh (half) and Shabbat Chanukah (full): Hallel inside Shabbat Shacharit, before the Kaddish Shalem.
  const rc = ids(compose('shabbat-shacharit', '2027-01-09', 'shacharit'));
  assert.ok(rc.includes('hallel-hallel') && !rc.includes('hallel-lo-lanu') && rc.includes('hallel-veavraham-zaken'));
  assert.ok(rc.indexOf('hallel-ma-ashiv') < rc.indexOf('kaddish-titkabal'));
  const chanukah = ids(compose('shabbat-shacharit', '2026-12-05', 'shacharit'));
  assert.ok(chanukah.includes('hallel-lo-lanu') && chanukah.includes('hallel-ahavti'));
  assert.ok(!ids(compose('shabbat-shacharit', '2026-10-17', 'shacharit')).includes('hallel-hallel'));
});

test('the festival Amidah takes the prayer of the hour: its Kedusha, the chazzan\'s Priestly Blessing, the closing direction', () => {
  const shacharit = ids(compose('festival-amidah', '2026-09-26', 'shacharit'));
  const mincha = ids(compose('festival-amidah', '2026-09-26', 'mincha'));
  const maariv = ids(compose('festival-amidah', '2027-06-10', 'maariv'));
  assert.ok(shacharit.includes('kedusha-shacharit') && !shacharit.includes('kedusha-mincha') && shacharit.includes('birkat-kohanim'));
  assert.ok(mincha.includes('kedusha-mincha') && !mincha.includes('kedusha-shacharit') && !mincha.includes('birkat-kohanim'));
  assert.ok(!maariv.some(id => id.startsWith('kedusha-')) && !maariv.includes('birkat-kohanim') && maariv.includes('after-amidah-maariv'));
  assert.ok(shacharit.includes('after-amidah-shacharit') && !shacharit.includes('after-amidah-maariv'));
});

test('festival Musaf: the offerings and Tal of the day', () => {
  const korbanot = doc => ids(doc).filter(id => id.startsWith('korbanot-') || id === 'tal' || id === 'geshem');
  assert.deepEqual(korbanot(compose('festival-musaf', '2027-04-22', 'mussaf')), ['tal', 'korbanot-pesach-first']);
  assert.deepEqual(korbanot(compose('festival-musaf', '2027-04-22', 'mussaf', false)), ['tal', 'korbanot-pesach-first']);
  assert.deepEqual(korbanot(compose('festival-musaf', '2027-04-23', 'mussaf', false)), ['korbanot-pesach-first']); // 2nd day abroad: no Tal
  assert.deepEqual(korbanot(compose('festival-musaf', '2027-04-25', 'mussaf')), ['korbanot-pesach-rest']);
  assert.deepEqual(korbanot(compose('festival-musaf', '2027-04-28', 'mussaf')), ['korbanot-pesach-rest']); // 7th day
  assert.deepEqual(korbanot(compose('festival-musaf', '2026-09-26', 'mussaf')), ['korbanot-shabbat', 'korbanot-sukkot-first']);
  assert.deepEqual(korbanot(compose('festival-musaf', '2026-10-02', 'mussaf', false)), ['korbanot-hoshana-rabbah']);
  assert.deepEqual(korbanot(compose('festival-musaf', '2026-10-03', 'mussaf')), ['geshem', 'korbanot-shabbat', 'korbanot-shemini-atzeret']);
  // Chol HaMoed Sukkot abroad: today's paragraph of the table only (18 Tishrei = the second day of Chol HaMoed).
  const chm = section(compose('festival-musaf', '2026-09-29', 'mussaf', false), 'korbanot-sukkot-chm');
  assert.match(plain(chm), /וביום השלישי.*וביום הרביעי/);
  assert.doesNotMatch(plain(chm), /וביום השני|וביום החמישי/);
});

test('Shabbat morning: Birkat HaChodesh on Shabbat Mevarchim; Av HaRachamim omitted then (except Mevarchim Sivan) and on festive Shabbatot', () => {
  const has = (date, id) => ids(compose('shabbat-shacharit', date, 'shacharit')).includes(id);
  assert.ok(has('2026-10-17', 'av-harachamim') && !has('2026-10-17', 'birkat-hachodesh')); // ordinary Shabbat
  assert.ok(has('2026-11-07', 'birkat-hachodesh') && !has('2026-11-07', 'av-harachamim')); // Mevarchim Kislev
  assert.ok(has('2027-06-05', 'birkat-hachodesh') && has('2027-06-05', 'av-harachamim')); // Mevarchim Sivan
  assert.ok(!has('2027-01-09', 'av-harachamim')); // Shabbat Rosh Chodesh
  assert.ok(!has('2027-04-10', 'av-harachamim')); // Nisan
  // Tzidkatcha at Shabbat Mincha follows the same day rule.
  assert.ok(ids(compose('shabbat-mincha', '2026-10-17', 'mincha')).includes('tzidkatcha'));
  assert.ok(!ids(compose('shabbat-mincha', '2027-01-09', 'mincha')).includes('tzidkatcha'));
});

test('Tachanun: none on Tisha B\'Av (nor Avinu Malkeinu, the morning Priestly Blessing, תתקבל) and none at Mincha of Erev Shabbat', () => {
  const tishaBav = ids(compose('weekday-shacharit', '2026-07-23', 'shacharit'));
  for (const id of ['vidui', 'nefilat-apayim', 'tachanun-mon-thu', 'avinu-malkeinu', 'lamenatzeach', 'tefila-ledavid', 'el-erech-apayim', 'birkat-kohanim', 'kaddish-titkabal-line', 'tallit', 'tefillin']) {
    assert.ok(!tishaBav.includes(id), `Tisha B'Av Shacharit: ${id}`);
  }
  assert.ok(tishaBav.includes('kaddish-titkabal') && tishaBav.includes('kaddish-titkabal-end'));
  const minchaTishaBav = ids(compose('weekday-mincha', '2026-07-23', 'mincha'));
  assert.ok(minchaTishaBav.includes('nachem') && minchaTishaBav.includes('aneinu') && !minchaTishaBav.includes('vidui') && !minchaTishaBav.includes('avinu-malkeinu'));
  assert.ok(!ids(compose('weekday-mincha', '2026-10-30', 'mincha')).includes('vidui')); // Friday
  const monday = ids(compose('weekday-shacharit', '2026-11-02', 'shacharit'));
  for (const id of ['vidui', 'tachanun-mon-thu', 'el-erech-apayim', 'lamenatzeach', 'birkat-kohanim', 'kaddish-titkabal-line']) assert.ok(monday.includes(id), id);
  assert.ok(ids(compose('weekday-mincha', '2026-12-20', 'mincha')).includes('avinu-malkeinu')); // Asara BeTevet
});

test('Magen Avot: "המלך" only in the Ten Days of Repentance', () => {
  assert.ok(!ids(compose('shabbat-maariv', '2026-10-16', 'maariv')).includes('magen-avot-aseret'));
  assert.ok(ids(compose('shabbat-maariv', '2026-09-18', 'maariv')).includes('magen-avot-aseret'));
});

test('no truncated Kaddish, no duplicated section, nothing of another rite, in any service on sample days', () => {
  const prayerOf = { 'weekday-mincha': 'mincha', 'shabbat-mincha': 'mincha', 'weekday-maariv': 'maariv', 'shabbat-maariv': 'maariv', 'kabbalat-shabbat': 'maariv', omer: 'maariv', 'shabbat-musaf': 'mussaf', 'festival-musaf': 'mussaf', 'rosh-chodesh-musaf': 'mussaf' };
  const dates = ['2026-11-02', '2026-11-11', '2026-12-07', '2026-09-28', '2027-04-25', '2026-07-23', '2026-10-17', '2027-01-09', '2026-10-03', '2027-05-01'];
  for (const serviceId of Object.keys(chabad.services)) {
    for (const date of dates) {
      const doc = compose(serviceId, date, prayerOf[serviceId] || 'shacharit');
      const list = ids(doc);
      assert.equal(new Set(list).size, list.length, `${serviceId} ${date}: duplicated section`);
      for (const [index, item] of doc.sections.entries()) {
        assert.ok(item.ref.startsWith('Weekday Siddur Chabad') || item.ref.startsWith('Siddur Tehillat Hashem'), `${serviceId}/${item.id}: ${item.ref}`);
        if (!/kaddish/.test(item.concept || '') || item.continues) continue;
        let words = plain(item);
        for (let next = index + 1; doc.sections[next]?.continues; next += 1) words += ` ${plain(doc.sections[next])}`;
        const ending = item.concept === 'half-kaddish' ? /דאמירן בעלמא/ : /עשה שלום|עושה שלום/;
        assert.match(words, ending, `${serviceId}/${item.id} on ${date}: a whole Kaddish`);
      }
    }
  }
});
