// Final QA of Nusach Sefard (Chassidic): what the reviewer fixed, pinned (docs/siddur/review-sefard.md). Each test
// composes a whole service for a real date from the rite's own edition and checks sequence and content.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HDate } from '@hebcal/core';
import sefard from '../src/data/nusach/compositions/sefard.mjs';
import { loadSiddur } from '../src/services/nusach.mjs';
import { composeRiteService } from '../src/services/prayer/riteServiceComposer.mjs';
import { checkRite } from '../src/services/prayer/siddurQa.mjs';
import { JewishContextEngine } from '../src/services/jewishContextEngine.mjs';
import { removeNikud } from '../src/hebrewText.mjs';
import { COMPLETENESS } from '../src/data/nusach/prayerSchema.mjs';

const pack = await loadSiddur('sefard');
const civil = hdate => { const d = hdate.greg(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// The civil day of a Hebrew date; for Maariv the civil day whose evening opens that Hebrew date.
const day = (d, m, y, prayer = 'shacharit') => civil(new HDate(prayer === 'maariv' ? new HDate(d, m, y).abs() - 1 : new HDate(d, m, y).abs()));
const HOUR = { maariv: '19:30', mincha: '13:30' };
function context(date, prayer = 'shacharit', israel = true) {
  const settings = { location: { tzid: 'Asia/Jerusalem' }, halachicResidenceStatus: israel ? 'israel' : 'diaspora', il: israel };
  const now = new Date(`${date}T${HOUR[prayer] || '08:00'}:00+02:00`);
  return { ...JewishContextEngine({ now, settings, times: { sunset: new Date(`${date}T17:00:00+02:00`) }, prayerType: prayer === 'mussaf' ? 'shacharit' : prayer }), servicePrayer: prayer };
}
const compose = (serviceId, date, prayer = 'shacharit', israel = true, mode = 'prayer') => composeRiteService({ composition: sefard, serviceId, texts: pack.texts, context: context(date, prayer, israel), mode });
const ids = doc => doc.sections.map(section => section.id);
const text = doc => removeNikud(doc.sections.flatMap(section => section.blocks.map(block => block.text)).join(' '));
const sectionText = (doc, id) => removeNikud((doc.sections.find(section => section.id === id)?.blocks || []).map(block => block.text).join(' '));
const before = (list, a, b) => list.indexOf(a) >= 0 && list.indexOf(b) >= 0 && list.indexOf(a) < list.indexOf(b);

test('Sefard: every service resolves with no QA problem and every reviewed service keeps its level', () => {
  for (const result of checkRite(sefard, pack.texts)) {
    assert.deepEqual(result.problems, [], result.serviceId);
    assert.deepEqual(result.unknownCaptions, [], result.serviceId);
    assert.notEqual(result.level, COMPLETENESS.UNVERIFIED, result.serviceId);
  }
});

test('Sefard Omer: tonight\'s count only — days 1, 2, 7, 8, 33, 49 — as the edition prints it (date, count, sefira)', () => {
  const nights = { 1: [16, 1], 2: [17, 1], 7: [22, 1], 8: [23, 1], 33: [18, 2], 49: [5, 3] };
  const words = { 1: 'היום יום אחד לעמר', 2: 'היום שני ימים לעמר', 7: 'שבעה ימים שהם שבוע אחד לעמר', 8: 'שמונה ימים שהם שבוע אחד ויום אחד', 33: 'שלשה ושלשים יום', 49: 'תשעה וארבעים יום' };
  for (const [n, [d, m]] of Object.entries(nights)) {
    const doc = compose('omer', day(d, m, 5786, 'maariv'), 'maariv');
    const count = doc.sections.find(section => section.id === 'omer-count');
    const lines = count.blocks.map(block => removeNikud(block.text));
    assert.ok(lines.some(line => line.startsWith(`${n}. `)), `day ${n}: ${lines.join(' | ')}`);
    assert.ok(lines.join(' ').includes(words[n]), `day ${n}`);
    assert.ok(lines.length <= 3, `day ${n}: only its date, count and sefira (${lines.length})`);
    assert.ok(!lines.some(line => new RegExp(`^${Number(n) + 1}\\. `).test(line)), `day ${n}: not the next day`);
    assert.ok(ids(doc).includes('omer') && ids(doc).includes('omer-after'));
    assert.match(sectionText(doc, 'omer'), /וצונו על ספירת העמר/);
  }
  // The full edition keeps the 49 counts.
  const edition = compose('omer', day(16, 1, 5786, 'maariv'), 'maariv', true, 'edition');
  assert.match(sectionText(edition, 'omer-count'), /49\. היום תשעה וארבעים/);
  assert.match(sectionText(edition, 'omer-count'), /1\. היום יום אחד/);
  // Weekday and Friday-night Maariv count the same way.
  assert.match(sectionText(compose('weekday-maariv', day(23, 1, 5786, 'maariv'), 'maariv'), 'omer-count'), /^.*8\. היום שמונה ימים/);
});

test('Sefard Hallel: whole on Chanukah, Sukkot, 15 Nisan, Shavuot, Shemini Atzeret; half on Rosh Chodesh, Chol HaMoed Pesach and its last days', () => {
  const whole = [[27, 9, 5787, true], [17, 7, 5787, true], [15, 1, 5787, true], [16, 1, 5787, false], [6, 3, 5787, true], [22, 7, 5787, false], [30, 9, 5787, true]];
  const half = [[1, 9, 5787, true], [18, 1, 5787, true], [21, 1, 5787, true], [22, 1, 5787, false]];
  for (const [d, m, y, israel] of whole) {
    const list = ids(compose('hallel', day(d, m, y), 'shacharit', israel));
    assert.ok(list.includes('hallel-lo-lanu') && list.includes('hallel-ahavti'), `${d}/${m} whole`);
  }
  for (const [d, m, y, israel] of half) {
    const list = ids(compose('hallel', day(d, m, y), 'shacharit', israel));
    assert.ok(!list.includes('hallel-lo-lanu') && !list.includes('hallel-ahavti'), `${d}/${m} half`);
    assert.ok(list.includes('hallel-ma-ashiv'));
  }
  // Weekday Shacharit: no Hallel on an ordinary day; on Chanukah half Kaddish after it, on Rosh Chodesh Kaddish Titkabal.
  assert.ok(!ids(compose('weekday-shacharit', day(22, 8, 5787))).some(id => id === 'hallel' || id.startsWith('hallel-') || id.includes('after-hallel')));
  const chanukah = ids(compose('weekday-shacharit', day(27, 9, 5787)));
  assert.ok(chanukah.includes('half-kaddish-after-hallel') && !chanukah.includes('kaddish-after-hallel'));
  assert.ok(chanukah.includes('chanukah-torah-text'));
  const tevet = ids(compose('weekday-shacharit', day(30, 9, 5787)));
  assert.ok(tevet.includes('kaddish-after-hallel') && tevet.includes('rc-chanukah-torah-text'));
  // Shabbat Chanukah says Hallel too (not only Shabbat Rosh Chodesh).
  assert.ok(ids(compose('shabbat-shacharit', day(25, 9, 5787))).includes('hallel-lo-lanu'));
});

test('Sefard weekday Shacharit: the day\'s Torah reading only, and the days Lamenatzeach / Mizmor LeToda are left out', () => {
  const chanukah = compose('weekday-shacharit', day(27, 9, 5787));
  const reading = sectionText(chanukah, 'chanukah-torah-text');
  assert.match(reading, /ביום השלישי נשיא לבני זבולן/);
  assert.doesNotMatch(reading, /ביום הרביעי נשיא/);
  const sukkot = sectionText(compose('weekday-shacharit', day(17, 7, 5787)), 'chm-sukkot-torah-text');
  assert.match(sukkot, /^וביום השלישי/);
  assert.doesNotMatch(sukkot, /וביום הרביעי/);
  const erevPesach = ids(compose('weekday-shacharit', day(14, 1, 5787)));
  for (const id of ['mizmor-letoda', 'lamenatzeach', 'aneinu-chazzan', 'fast-torah-text', 'torah-service']) assert.ok(!erevPesach.includes(id), `Erev Pesach: ${id}`);
  const cholHamoedPesach = ids(compose('weekday-shacharit', day(18, 1, 5787)));
  assert.ok(!cholHamoedPesach.includes('mizmor-letoda') && !cholHamoedPesach.includes('lamenatzeach'));
  assert.ok(cholHamoedPesach.includes('chm-pesach-torah-text'));
  const erevYomKippur = ids(compose('weekday-shacharit', day(9, 7, 5787)));
  assert.ok(!erevYomKippur.includes('mizmor-letoda') && !erevYomKippur.includes('lamenatzeach'));
  const monday = ids(compose('weekday-shacharit', day(22, 8, 5787)));
  assert.ok(before(monday, 'nefilat-apayim', 'shomer-yisrael') && before(monday, 'half-kaddish', 'torah-service') && before(monday, 'return-torah', 'ashrei'));
  assert.ok(before(monday, 'ashrei', 'lamenatzeach') && before(monday, 'lamenatzeach', 'uva-letzion'));
  assert.equal(monday.at(-1), 'kaddish-yatom');
  // A public fast still has Aneinu and its reading.
  const fast = ids(compose('weekday-shacharit', day(17, 4, 5787)));
  assert.ok(fast.includes('aneinu-chazzan') && fast.includes('fast-torah-text') && fast.includes('avinu-malkeinu'));
});

test('Sefard Motzaei Yom Tov: Atah Chonantanu at Maariv after a weekday Yom Tov', () => {
  assert.ok(ids(compose('weekday-maariv', day(22, 1, 5787, 'maariv'), 'maariv')).includes('atah-chonantanu'));
  assert.ok(!ids(compose('weekday-maariv', day(24, 8, 5787, 'maariv'), 'maariv')).includes('atah-chonantanu'));
});

test('Sefard Shabbat Shacharit: Birkat HaChodesh on Shabbat Mevarchim, Av HaRachamim by the edition\'s rule', () => {
  const ordinary = ids(compose('shabbat-shacharit', day(20, 8, 5787)));
  assert.ok(!ordinary.includes('birkat-hachodesh') && ordinary.includes('av-harachamim'));
  const mevarchim = ids(compose('shabbat-shacharit', day(27, 8, 5787)));
  assert.ok(mevarchim.includes('birkat-hachodesh') && !mevarchim.includes('av-harachamim'));
  const mevarchimIyar = ids(compose('shabbat-shacharit', day(24, 1, 5787)));
  assert.ok(mevarchimIyar.includes('birkat-hachodesh') && mevarchimIyar.includes('av-harachamim'));
  // Shabbat Rosh Chodesh (the 1st): no Birkat HaChodesh, Hallel and Barchi Nafshi.
  const roshChodesh = ids(compose('shabbat-shacharit', day(1, 11, 5787)));
  assert.ok(!roshChodesh.includes('birkat-hachodesh') && roshChodesh.includes('hallel') && roshChodesh.includes('barchi-nafshi'));
});

test('Sefard Shabbat Mincha: the verses "said three times" are there; Barchi Nafshi in winter, Pirkei Avot in summer', () => {
  const winter = compose('shabbat-mincha', day(20, 8, 5787), 'mincha');
  assert.match(sectionText(winter, 'ketoret-verses'), /יהוה צבאות עמנו/);
  assert.ok(before(ids(winter), 'ketoret', 'ketoret-verses') && before(ids(winter), 'ketoret-verses', 'ana-bekoach'));
  assert.ok(ids(winter).includes('barchi-nafshi') && !ids(winter).includes('pirkei-avot'));
  const summer = ids(compose('shabbat-mincha', day(1, 2, 5787), 'mincha'));
  assert.ok(summer.includes('pirkei-avot') && !summer.includes('barchi-nafshi') && !summer.includes('tzidkatcha'));
});

test('Sefard Birkat HaMazon: only today\'s Al HaNisim and the day\'s own name in Ya\'aleh VeYavo', () => {
  const chanukah = compose('birkat-hamazon', day(27, 9, 5787));
  assert.ok(ids(chanukah).includes('al-hanisim-chanukah') && !ids(chanukah).includes('al-hanisim-purim'));
  assert.doesNotMatch(text(chanukah), /בימי מרדכי ואסתר/);
  const roshChodesh = compose('birkat-hamazon', day(1, 9, 5787));
  const yaale = ['yaale-veyavo', 'yv-rosh-chodesh', 'yv-end'].map(id => sectionText(roshChodesh, id)).join(' ');
  assert.match(yaale, /ראש החדש הזה/);
  assert.doesNotMatch(text(roshChodesh), /שמיני עצרת החג הזה|הזכרון הזה/);
  const sukkot = ids(compose('birkat-hamazon', day(17, 7, 5787)));
  assert.ok(sukkot.includes('yv-sukkot') && !sukkot.includes('yv-rosh-chodesh'));
  // The guest's blessing comes before "אותנו ואת כל אשר לנו", then במרום.
  const list = ids(roshChodesh);
  assert.ok(before(list, 'harachaman-guest', 'harachaman-otanu') && before(list, 'harachaman-otanu', 'bamarom'));
});

test('Sefard festival Amidah: the prayer of the hour, and only the festival\'s own name', () => {
  const maariv = ids(compose('festival-amidah', day(15, 1, 5787, 'maariv'), 'maariv'));
  assert.ok(maariv.includes('vayedaber') && maariv.includes('half-kaddish') && maariv.includes('aleinu'));
  for (const id of ['kedusha', 'kedusha-shacharit', 'kedusha-mincha', 'birkat-kohanim', 'modim-derabanan']) assert.ok(!maariv.includes(id), `maariv: ${id}`);
  const shacharit = ids(compose('festival-amidah', day(15, 1, 5787)));
  assert.ok(shacharit.includes('kedusha-shacharit') && shacharit.includes('birkat-kohanim') && !shacharit.includes('kedusha-mincha'));
  assert.ok(!shacharit.includes('vayedaber') && !shacharit.includes('aleinu') && !shacharit.includes('amidah-opening-mincha'));
  const mincha = ids(compose('festival-amidah', day(15, 1, 5787), 'mincha'));
  assert.ok(mincha.includes('amidah-opening-mincha') && mincha.includes('kedusha-mincha') && !mincha.includes('birkat-kohanim'));
  assert.ok(mincha.includes('vatiten-pesach') && !mincha.some(id => /shavuot|sukkot|shemini/.test(id)));
  const shemini = compose('festival-amidah', day(22, 7, 5787));
  assert.ok(ids(shemini).includes('vatiten-shemini-atzeret') && !ids(shemini).includes('vatiten-sukkot'));
  assert.doesNotMatch(text(shemini), /חג המצות|חג השבועות/);
  // Yom Tov on Shabbat at Maariv: Veshamru before, Vayechulu and Magen Avot after.
  const shabbat = ids(compose('festival-amidah', day(15, 7, 5787, 'maariv'), 'maariv'));
  assert.ok(before(shabbat, 'veshamru', 'vayedaber') && before(shabbat, 'elokai-netzor', 'vayechulu') && before(shabbat, 'magen-avot', 'kaddish-titkabal'));
});

test('Sefard festival Musaf: the offerings of the festival and of the day, in Eretz Yisrael and in the diaspora', () => {
  const offering = (d, m, israel = true) => ids(compose('festival-musaf', day(d, m, 5787), 'mussaf', israel)).filter(id => id.startsWith('musaf-') && !id.startsWith('musaf-name'));
  assert.deepEqual(offering(15, 1), ['musaf-pesach']);
  assert.deepEqual(offering(16, 1, false), ['musaf-pesach']);
  assert.deepEqual(offering(18, 1), ['musaf-pesach-rest']);
  assert.deepEqual(offering(21, 1), ['musaf-pesach-rest']);
  assert.deepEqual(offering(6, 3), ['musaf-shavuot']);
  assert.deepEqual(offering(15, 7), ['musaf-shabbat', 'musaf-sukkot']);
  assert.deepEqual(offering(16, 7, false), ['musaf-sukkot']);
  assert.deepEqual(offering(22, 7), ['musaf-shabbat', 'musaf-shemini-atzeret']);
  const israel = compose('festival-musaf', day(17, 7, 5787), 'mussaf');
  assert.match(sectionText(israel, 'musaf-chm-sukkot'), /וביום השלישי/);
  assert.doesNotMatch(sectionText(israel, 'musaf-chm-sukkot'), /וביום השני|וביום הרביעי/);
  const diaspora = compose('festival-musaf', day(17, 7, 5787), 'mussaf', false);
  const spika = sectionText(diaspora, 'musaf-chm-sukkot-diaspora');
  assert.match(spika, /וביום השני/);
  assert.match(spika, /וביום השלישי/);
  assert.doesNotMatch(spika, /וביום הרביעי\. פרים/);
  assert.match(spika, /וביום השני\. פרים.*וביום השלישי\. פרים/);
  // Keter of Hoshana Rabba is the festival's; Kohanim bless in the diaspora only on Yom Tov.
  const hoshanaRabba = ids(compose('festival-musaf', day(21, 7, 5787), 'mussaf', false));
  assert.ok(hoshanaRabba.includes('keter-yom-tov') && hoshanaRabba.includes('musaf-hoshana-rabba') && hoshanaRabba.includes('birkat-kohanim-chazzan'));
  assert.ok(ids(compose('festival-musaf', day(17, 7, 5787), 'mussaf')).includes('keter-chol-hamoed'));
  assert.ok(ids(compose('festival-musaf', day(16, 7, 5787), 'mussaf', false)).includes('birkat-kohanim'));
  assert.ok(ids(compose('festival-musaf', day(17, 7, 5787), 'mussaf')).includes('birkat-kohanim'));
  assert.ok(ids(compose('festival-musaf', day(17, 7, 5787), 'mussaf')).includes('ledavid'));
});

test('Sefard: fixed captions no longer hide words every day (Psalm 29, כי שם at Rosh Chodesh Musaf)', () => {
  assert.match(sectionText(compose('kabbalat-shabbat', day(20, 8, 5787, 'maariv'), 'maariv'), 'mizmor-ledavid'), /מזמור לדוד הבו ליהוה/);
  assert.match(sectionText(compose('rosh-chodesh-musaf', day(1, 9, 5787), 'mussaf'), 'amidah-opening'), /כי שם יהוה אקרא/);
  assert.ok(ids(compose('rosh-chodesh-musaf', day(1, 6, 5787), 'mussaf')).includes('ledavid'));
});

test('Sefard: no truncated Kaddish — every Kaddish section of the main services ends with its closing words', () => {
  const services = [['weekday-shacharit', day(22, 8, 5787)], ['weekday-mincha', day(22, 8, 5787), 'mincha'], ['shabbat-shacharit', day(20, 8, 5787)], ['shabbat-musaf', day(20, 8, 5787), 'mussaf'], ['rosh-chodesh-musaf', day(1, 9, 5787), 'mussaf'], ['festival-musaf', day(15, 1, 5787), 'mussaf']];
  for (const [serviceId, date, prayer = 'shacharit'] of services) {
    for (const section of compose(serviceId, date, prayer).sections.filter(item => /kaddish/.test(item.concept || ''))) {
      const words = sectionText({ sections: [section] }, section.id);
      if (section.concept === 'half-kaddish') assert.match(words, /דאמירן בעלמא,? ואמרו אמן/, `${serviceId}/${section.id}`);
      else assert.match(words, /(עושה|עשה) שלום/, `${serviceId}/${section.id}`);
    }
  }
});

test('Sefard: no text of another rite — every section comes from the Siddur Sefard edition', () => {
  for (const service of Object.values(sefard.services)) for (const section of service.sections) assert.ok(section.ref.startsWith('Siddur Sefard, '), section.id);
});
