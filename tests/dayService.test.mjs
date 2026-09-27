// The Smart Siddur's service of the day — Chol HaMoed Sukkot 5787, Jerusalem and New York.
// Expected values come from the Shulchan Arukh (OC 31:2, 644:1, 660:1, 663:1), Kaf HaChaim 660:4 and the
// edition's own instructions — not from the code under test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JewishContextEngine } from '../src/services/jewishContextEngine.mjs';
import { dayServiceSupport, planDayService } from '../src/services/prayer/dayServicePlan.mjs';
import { composeDayService, versesFor } from '../src/services/prayer/dayServiceComposer.mjs';
import { cholHamoedSukkotReading } from '../src/services/prayer/festivalReadings.mjs';
import { removeNikud } from '../src/hebrewText.mjs';

const ISRAEL = { il: true, halachicResidenceStatus: 'israel', location: { tzid: 'Asia/Jerusalem', latitude: 31.778, longitude: 35.235 } };
const NY = { il: false, halachicResidenceStatus: 'diaspora', location: { tzid: 'America/New_York', latitude: 40.71, longitude: -74.0 } };
const at = (iso, settings = ISRAEL, prayer = 'shacharit') => {
  const context = JewishContextEngine({ now: new Date(iso), settings, prayerType: prayer === 'birkat-hamazon' ? 'shacharit' : prayer });
  const plan = planDayService({ prayer, context });
  return { context, plan, doc: plan.status === 'adapted' ? composeDayService(plan, context) : null };
};
const plain = text => removeNikud(text).replace(/[֑-֯]/g, '');
const sectionText = (doc, id) => plain(doc.sections.find(section => section.id === id).blocks.map(block => block.text).join(' '));
// 16–21 Tishrei 5787 = 27 Sep – 2 Oct 2026 (Sunday–Friday).
const CHM = ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'];

test('Chol HaMoed Shacharit, every day in Eretz Yisrael: the order of the service', () => {
  CHM.forEach((day, i) => {
    const { plan, doc } = at(`${day}T08:00:00+03:00`);
    assert.equal(plan.status, 'adapted', day);
    const ids = doc.sections.map(section => section.id);
    const order = ['amida', 'lulav', 'hallel', 'torah-service', 'hoshanot', 'aliyah-blessings', 'torah', 'ashrei', 'uva-lesion', 'song-of-day', 'mussaf', 'yehi-shem', 'festival-psalm', 'kaveh', 'alenu'];
    const positions = order.map(id => ids.indexOf(id));
    assert.ok(positions.every(p => p >= 0), `${day}: ${order.filter((id, k) => positions[k] < 0)}`);
    assert.deepEqual([...positions].sort((a, b) => a - b), positions, `${day}: sections in order`);
    assert.ok(!ids.some(id => /tefillin/.test(id)), 'SA OC 31:2 — no tefillin on Chol HaMoed');
    // SA OC 660:1, Kaf HaChaim 660:4 — after Hallel the Sefer Torah is taken out, the Hoshanot circle it, then Kaddish Titkabal and the reading.
    assert.equal(ids[ids.indexOf('hallel') + 1], 'torah-service');
    assert.equal(ids[ids.indexOf('torah-service') + 1], 'hoshanot');
    const title = doc.sections.find(section => section.id === 'hoshanot').title;
    if (i < 5) assert.match(title, new RegExp(['', 'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'][i + 2]), day);
    else { assert.match(title, /הושענא רבה/); assert.ok(ids.includes('aravah')); }
  });
});

test('Chol HaMoed reading in Eretz Yisrael: all four aliyot read the day\'s offering only (SA OC 663:1)', () => {
  const offerings = ['וביום השני', 'וביום השלישי', 'וביום הרביעי', 'וביום החמישי', 'וביום הששי', 'וביום השביעי'];
  CHM.forEach((day, i) => {
    const { doc } = at(`${day}T08:00:00+03:00`);
    const torah = doc.sections.find(section => section.id === 'torah').blocks.filter(block => block.type === 'torah');
    assert.equal(torah.length, 4, day);
    for (const aliyah of torah) assert.ok(plain(aliyah.text).startsWith(offerings[i]), `${day}: ${plain(aliyah.text).slice(0, 20)}`);
  });
});

test('Chol HaMoed reading abroad (Mechaber): the day of doubt, as the edition lists it', () => {
  assert.deepEqual(cholHamoedSukkotReading(3, { israel: false }).map(a => a.ref), ['Numbers 29:17-29:19', 'Numbers 29:20-29:22', 'Numbers 29:20-29:22', 'Numbers 29:17-29:22']);
  assert.deepEqual(cholHamoedSukkotReading(7, { israel: false }).map(a => a.ref), ['Numbers 29:29-29:31', 'Numbers 29:32-29:34', 'Numbers 29:32-29:34', 'Numbers 29:29-29:34']);
  assert.equal(cholHamoedSukkotReading(2, { israel: false }), null, 'abroad the second day is Yom Tov');
  assert.equal(versesFor('Numbers 29:17-29:19').length, 3);
});

test('inside the service: full Hallel only, no Rosh Chodesh reading, no למנצח, the Chol HaMoed Mussaf', () => {
  const { doc } = at('2026-09-27T08:00:00+03:00');
  const hallel = sectionText(doc, 'hallel');
  assert.match(hallel, /לגמור את ההלל/);
  assert.match(hallel, /לא לנו/);
  assert.doesNotMatch(hallel, /וידבר יהוה אלמשה לאמר צו|אשרי יושבי ביתך|מדלגים/, 'the Rosh Chodesh reading and Ashrei are not part of Hallel');
  assert.doesNotMatch(sectionText(doc, 'ashrei'), /יענך יהוה ביום צרה/, 'no למנצח on a day without Tachanun');
  assert.doesNotMatch(sectionText(doc, 'torah-service'), /אל ארך אפים/);
  assert.match(sectionText(doc, 'torah-service'), /יהי יהוה אלהינו עמנו/);
  const mussaf = sectionText(doc, 'mussaf');
  assert.match(mussaf, /חג הסכות הזה/);
  assert.doesNotMatch(mussaf, /חג המצות הזה|חג השבועות הזה|השבת הזה/);
  assert.match(sectionText(doc, 'amida'), /יעלה ויבא/);
  assert.ok(doc.sections.every(section => section.blocks.every(block => !/<\/?(big|b|small)\b/.test(block.text))), 'no raw markup reaches the screen');
  assert.match(sectionText(doc, 'song-of-day'), /לדוד.{0,40}מזמור ליהוה הארץ ומלואה/, 'Sunday: Psalm 24');
  assert.doesNotMatch(sectionText(doc, 'song-of-day'), /לבניקרח גדול יהוה/);
});

test('Mincha and Arvit of Chol HaMoed; the Motzaei Shabbat additions only on Motzaei Shabbat', () => {
  const mincha = at('2026-09-28T16:00:00+03:00', ISRAEL, 'mincha').doc;
  assert.deepEqual(mincha.sections.map(section => section.id), ['offerings', 'amida', 'alenu']);
  assert.match(sectionText(mincha, 'amida'), /יעלה ויבא/);
  const night = at('2026-09-28T20:30:00+03:00', ISRAEL, 'maariv').doc;
  assert.match(sectionText(night, 'amida'), /יעלה ויבא/);
  assert.ok(!night.sections.some(section => section.id === 'motzaei-shabbat'), 'Monday night');
});

test('days the Smart Siddur does not compose yet keep the printed service', () => {
  for (const [iso, reason] of [['2026-10-06T08:00:00+03:00', 'not-yet'], ['2026-10-10T08:00:00+03:00', 'yom-tov-or-shabbat']]) {
    const { context, plan } = at(iso);
    assert.equal(dayServiceSupport(context).supported, false, iso);
    assert.equal(dayServiceSupport(context).reason, reason, iso);
    assert.equal(plan.status, 'unsupported', iso);
  }
  assert.equal(at('2026-10-06T13:00:00+03:00', ISRAEL, 'birkat-hamazon').plan.status, 'adapted', 'Birkat HaMazon is always the day\'s own');
});

test('abroad: Chol HaMoed begins on 17 Tishrei; every day composes', () => {
  assert.equal(at('2026-09-27T08:00:00-04:00', NY).plan.status, 'unsupported', '16 Tishrei is Yom Tov abroad');
  for (const day of CHM.slice(1)) {
    const { doc } = at(`${day}T08:00:00-04:00`, NY);
    assert.ok(doc.sections.length > 15, day);
  }
});

test('משיב הרוח begins at Mussaf of Shemini Atzeret, not at its Arvit (SA OC 114:1); on Pesach it ends at Mussaf', () => {
  const ctx = (iso, prayerType, times) => JewishContextEngine({ now: new Date(iso), settings: ISRAEL, times, prayerType });
  const friday = { sunset: '2026-10-02T17:52:00+03:00' };
  assert.equal(ctx('2026-10-02T19:00:00+03:00', 'maariv', friday).seasonal.mashivHaruch, false, 'Arvit that opens 22 Tishrei');
  assert.equal(ctx('2026-10-03T08:00:00+03:00', 'shacharit').seasonal.mashivHaruch, false);
  assert.equal(ctx('2026-10-03T11:00:00+03:00', 'mussaf').seasonal.mashivHaruch, true);
  assert.equal(ctx('2026-10-03T15:00:00+03:00', 'mincha').seasonal.mashivHaruch, true);
  const seder = { sunset: '2027-04-21T19:10:00+03:00' };
  assert.equal(ctx('2027-04-21T20:00:00+03:00', 'maariv', seder).seasonal.mashivHaruch, true, 'Arvit of the Seder night still says it');
  assert.equal(ctx('2027-04-22T11:00:00+03:00', 'mussaf').seasonal.mashivHaruch, false);
});

test('Shemini Atzeret on Shabbat (Eretz Yisrael): Arvit, Shacharit with Hakafot, the three readings, Geshem, Mussaf', () => {
  const times = { sunset: '2026-10-02T17:52:00+03:00' };
  const compose = (prayer, iso, t = null) => {
    const contextFor = type => JewishContextEngine({ now: new Date(iso), settings: ISRAEL, times: t, prayerType: type });
    const plan = planDayService({ prayer, context: contextFor(prayer) });
    return { plan, doc: composeDayService(plan, contextFor(prayer), { contextFor }) };
  };
  const night = compose('maariv', '2026-10-02T19:00:00+03:00', times);
  assert.equal(night.plan.title, 'ערבית לשמיני עצרת');
  assert.deepEqual(night.doc.sections.map(section => section.id), ['kabbalat-shabbat', 'festival-psalm', 'barchu', 'shema', 'ele-moadei', 'amida', 'vayechulu', 'psalms', 'alenu', 'torah-out', 'hakafot-night']);
  assert.doesNotMatch(sectionText(night.doc, 'kabbalat-shabbat'), /במה מדליקין ובמה אין מדליקין/, 'the edition: not on Yom Tov that falls on Shabbat');
  assert.doesNotMatch(sectionText(night.doc, 'amida'), /משיב הרוח|נקדישך/, 'Arvit: מוריד הטל, and no Kedusha');
  const day = compose('shacharit', '2026-10-03T08:00:00+03:00');
  const ids = day.doc.sections.map(section => section.id);
  const order = ['festival-psalm', 'amida', 'hallel', 'torah-out', 'hakafot-day', 'torah', 'chatan-bereshit', 'maftir', 'haftarah', 'geshem', 'announcement', 'mussaf', 'yehi-shem'];
  const positions = order.map(id => ids.indexOf(id));
  assert.ok(positions.every(p => p >= 0), order.filter((id, k) => positions[k] < 0).join());
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  const refs = day.plan.steps.filter(step => step.kind === 'torah').flatMap(step => step.aliyot.map(a => a.ref));
  assert.ok(refs.includes('Deuteronomy 33:1-34:12') && refs.includes('Genesis 1:1-2:3') && refs.includes('Numbers 29:35-30:1') && refs.includes('Joshua 1:1-1:9'));
  assert.match(sectionText(day.doc, 'amida'), /שמיני חג עצרת הזה/);
  assert.match(sectionText(day.doc, 'amida'), /מוריד הטל/);
  assert.match(sectionText(day.doc, 'mussaf'), /משיב הרוח ומוריד הגשם/, 'the first Mussaf with משיב הרוח');
  assert.doesNotMatch(sectionText(day.doc, 'mussaf'), /ועמך ישראל קבוצי מטה/, 'Yom Tov: the full Keter');
  const mincha = compose('mincha', '2026-10-03T15:00:00+03:00');
  assert.ok(mincha.plan.steps.some(step => step.kind === 'torah' && step.aliyot[0].ref === 'Genesis 1:1-1:5'), 'KH 668:22 — Bereshit at Mincha');
  assert.doesNotMatch(sectionText(mincha.doc, 'amida'), /יברכך יהוה וישמרך/, 'no Birkat Kohanim at Mincha');
});

test('abroad, Shemini Atzeret is not composed yet (two days, different readings) — the printed service is shown', () => {
  assert.equal(at('2026-10-03T08:00:00-04:00', NY).plan.status, 'unsupported');
});
