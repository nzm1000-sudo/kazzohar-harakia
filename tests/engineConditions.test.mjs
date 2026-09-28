// The day engine's condition keys added on 2026-09-29 (docs/siddur/review-<rite>.md, "engine conditions"), each checked
// on concrete dates both ways, composed exactly as the reader composes a service (composeRiteService + loadSiddur).
// Dates come from @hebcal/core (the app's one calendar), never typed by hand as Hebrew dates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HDate } from '@hebcal/core';
import { COMPOSITIONS } from '../src/data/nusach/compositions/index.mjs';
import { loadSiddur } from '../src/services/nusach.mjs';
import { composeRiteService, compositionConditions } from '../src/services/prayer/riteServiceComposer.mjs';
import { JewishContextEngine } from '../src/services/jewishContextEngine.mjs';
import { removeNikud } from '../src/hebrewText.mjs';

const packs = {
  ashkenaz: await loadSiddur('ashkenaz'),
  sefard: await loadSiddur('sefard'),
  chabad: await loadSiddur('chabad'),
  'edot-hamizrach': await loadSiddur('edot'),
};

// Hebrew date → the civil date the prayer belongs to (Arvit: the evening of the day before, as the reader asks it).
const civil = (d, m, y) => {
  const g = new HDate(d, m, y).greg();
  return `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, '0')}-${String(g.getDate()).padStart(2, '0')}`;
};
function contextOf(date, prayer = 'shacharit', place = 'il') {
  const il = place === 'il';
  const settings = { location: { tzid: 'Asia/Jerusalem' }, halachicResidenceStatus: il ? 'israel' : 'diaspora', il };
  const hour = prayer === 'maariv' ? '19:30' : prayer === 'mincha' ? '13:30' : '08:00';
  const now = new Date(`${date}T${hour}:00+02:00`);
  return { ...JewishContextEngine({ now, settings, times: { sunset: new Date(`${date}T17:00:00+02:00`) }, prayerType: prayer === 'mussaf' ? 'shacharit' : prayer }), servicePrayer: prayer };
}
const compose = (nusach, serviceId, date, prayer = 'shacharit', place = 'il') => composeRiteService({ composition: COMPOSITIONS[nusach], serviceId, texts: packs[nusach].texts, context: contextOf(date, prayer, place) });
const ids = doc => doc.sections.map(section => section.id);
const has = (doc, id) => ids(doc).includes(id);
const plain = value => removeNikud(String(value || '')).replace(/[״”“]/g, '"');
const textOf = (doc, id) => plain(doc.sections.filter(section => section.id === id).flatMap(section => section.blocks.map(block => block.text)).join(' '));
const allText = doc => plain(doc.sections.flatMap(section => section.blocks.map(block => block.text)).join(' '));

// 5786 / 5787 (5787 is a leap year).
const D = {
  shekalim5786: civil(27, 11, 5786), zachor5786: civil(11, 12, 5786), parah5786: civil(18, 12, 5786), ordinaryAdarShabbat: civil(4, 12, 5786),
  mevarchimAv5786: civil(26, 4, 5786), mevarchimElul5786: civil(25, 5, 5786),
  shabbatBeforePesach5787: civil(10, 1, 5787), shabbatShuva5787: civil(8, 7, 5787), ordinaryShabbat: '2026-10-17',
  tishaBavMotzaeiShabbat5785: civil(8, 5, 5785),
  rcCheshvan5787: civil(1, 8, 5787), rcTevet5786: civil(1, 10, 5786), rcAdarII5787: civil(1, 13, 5787), rcNisan5787: civil(1, 1, 5787),
  pesach1: civil(15, 1, 5787), pesach2: civil(16, 1, 5787), sheminiAtzeret: civil(22, 7, 5787), simchatTorahDiaspora: civil(23, 7, 5787),
  sukkot1Shabbat: civil(15, 7, 5787), shavuot: civil(6, 3, 5787),
  tishaBav5786: civil(9, 5, 5786), av7: civil(7, 5, 5786),
  chabadShabbatErevRC: civil(29, 11, 5787), chabadOrdinaryShabbat: civil(22, 11, 5787), weekdayErevRC: civil(29, 8, 5787),
  asaraBetevet5787: civil(10, 10, 5787), shabbatBeforeAsaraBetevet: civil(9, 10, 5787),
  purimKatan5787: civil(14, 12, 5787), purim5787: civil(14, 13, 5787), shushanPurim5787: civil(15, 13, 5787),
  mondayChayeiSarah: civil(22, 8, 5787), mondayAfterSimchatTorah: civil(24, 7, 5787),
};

test('keys: the Four Parshiyot, Mevarchim Av, a Yom Tov in the coming week, Purim Katan, the fast announcement', () => {
  const k = (date, prayer = 'shacharit', place = 'il') => compositionConditions(contextOf(date, prayer, place));
  for (const date of [D.shekalim5786, D.zachor5786, D.parah5786]) assert.equal(k(date).arbaParshiyot, true, date);
  assert.equal(k(D.ordinaryAdarShabbat).arbaParshiyot, false);
  assert.equal(k(D.mevarchimAv5786).mevarchimAv, true);
  assert.equal(k(D.mevarchimElul5786).mevarchimAv, false);
  assert.equal(k(D.shabbatBeforePesach5787, 'maariv').yomTovThisWeek, true);
  assert.equal(k(D.shabbatShuva5787, 'maariv').yomTovThisWeek, true); // Yom Kippur on Monday
  assert.equal(k(D.ordinaryShabbat, 'maariv').yomTovThisWeek, false);
  assert.equal(k(D.purimKatan5787).purimKatan, true);
  assert.equal(k(D.purim5787).purimKatan, false);
  assert.equal(k(D.shabbatBeforeAsaraBetevet).fastAnnouncement, true);
  assert.equal(k(D.ordinaryShabbat).fastAnnouncement, false);
  assert.equal(k(D.purim5787).purimDay, true);
  assert.equal(k(D.shushanPurim5787).purimDay, false);
});

test('Ashkenaz and Sefard: אב הרחמים not on the Four Parshiyot, said on Shabbat Mevarchim Av (the editions\' own notes)', () => {
  for (const nusach of ['ashkenaz', 'sefard']) {
    assert.ok(!has(compose(nusach, 'shabbat-shacharit', D.zachor5786), 'av-harachamim'), `${nusach} Zachor`);
    assert.ok(!has(compose(nusach, 'shabbat-shacharit', D.parah5786), 'av-harachamim'), `${nusach} Parah`);
    assert.ok(has(compose(nusach, 'shabbat-shacharit', D.ordinaryAdarShabbat), 'av-harachamim'), `${nusach} ordinary Shabbat`);
    assert.ok(has(compose(nusach, 'shabbat-shacharit', D.mevarchimAv5786), 'av-harachamim'), `${nusach} Mevarchim Av`);
    assert.ok(!has(compose(nusach, 'shabbat-shacharit', D.mevarchimElul5786), 'av-harachamim'), `${nusach} Mevarchim Elul`);
  }
  // Sefard: the memorial prayer goes with אב הרחמים.
  assert.ok(!has(compose('sefard', 'shabbat-shacharit', D.zachor5786), 'hazkarat-neshamot'));
  assert.ok(has(compose('sefard', 'shabbat-shacharit', D.mevarchimAv5786), 'hazkarat-neshamot'));
});

test('Ashkenaz and Sefard: צדקתך not at Mincha of the Four Parshiyot', () => {
  for (const nusach of ['ashkenaz', 'sefard']) {
    assert.ok(!has(compose(nusach, 'shabbat-mincha', D.parah5786, 'mincha'), 'tzidkatcha'), `${nusach} Parah`);
    assert.ok(has(compose(nusach, 'shabbat-mincha', D.ordinaryAdarShabbat, 'mincha'), 'tzidkatcha'), `${nusach} ordinary`);
  }
});

test('Ashkenaz and Sefard: ויהי נועם and ואתה קדוש not on Motzaei Shabbat before a Yom Tov week; ויהי נועם not on Tisha B\'Av', () => {
  for (const nusach of ['ashkenaz', 'sefard']) {
    const beforePesach = compose(nusach, 'weekday-maariv', D.shabbatBeforePesach5787, 'maariv');
    assert.ok(!has(beforePesach, 'vihi-noam') && !has(beforePesach, 'veata-kadosh'), `${nusach} before Pesach`);
    assert.ok(has(beforePesach, 'kaddish-titkabal'), `${nusach} before Pesach: the weekday Kaddish Titkabal`);
    const beforeYomKippur = compose(nusach, 'weekday-maariv', D.shabbatShuva5787, 'maariv');
    assert.ok(!has(beforeYomKippur, 'vihi-noam'), `${nusach} before Yom Kippur`);
    const ordinary = compose(nusach, 'weekday-maariv', D.ordinaryShabbat, 'maariv');
    assert.ok(has(ordinary, 'vihi-noam') && has(ordinary, 'veata-kadosh') && !has(ordinary, 'kaddish-titkabal'), `${nusach} ordinary`);
    const tishaBav = compose(nusach, 'weekday-maariv', D.tishaBavMotzaeiShabbat5785, 'maariv');
    assert.ok(!has(tishaBav, 'vihi-noam') && has(tishaBav, 'veata-kadosh'), `${nusach} Tisha B'Av`);
    assert.ok(!ids(tishaBav).some(id => /veyiten|vayiten/.test(id)), `${nusach} Tisha B'Av: no ויתן לך`);
  }
});

test('Ashkenaz: ולכפרת פשע in a leap year until Nisan (the edition\'s caption "בשנת העיבור עד חודש ניסן")', () => {
  const words = date => allText(compose('ashkenaz', 'rosh-chodesh-musaf', date, 'mussaf'));
  assert.match(words(D.rcCheshvan5787), /ולכפרת פשע/);
  assert.match(words(D.rcAdarII5787), /ולכפרת פשע/);
  assert.doesNotMatch(words(D.rcTevet5786), /ולכפרת פשע/);
  assert.doesNotMatch(words(D.rcNisan5787), /ולכפרת פשע/);
  for (const date of [D.rcCheshvan5787, D.rcTevet5786]) assert.doesNotMatch(words(date), /העיבור/);
  // Edot HaMizrach: its own caption "בשנה מעוברת" — the whole leap year.
  assert.match(allText(compose('edot-hamizrach', 'rosh-chodesh-musaf', D.rcCheshvan5787, 'mussaf')), /ולכפרת פשע/);
  assert.doesNotMatch(allText(compose('edot-hamizrach', 'rosh-chodesh-musaf', D.rcTevet5786, 'mussaf')), /ולכפרת פשע/);
});

test('Ashkenaz Shabbat Musaf / Mincha: the Ten-Days words inside the paragraphs are gone on an ordinary Shabbat, shown on Shabbat Shuva', () => {
  const ordinaryMusaf = allText(compose('ashkenaz', 'shabbat-musaf', D.ordinaryShabbat, 'mussaf'));
  const ordinaryMincha = allText(compose('ashkenaz', 'shabbat-mincha', D.ordinaryShabbat, 'mincha'));
  for (const text of [ordinaryMusaf, ordinaryMincha]) {
    assert.doesNotMatch(text, /בעש"ת|בש"ת|בעשי"ת:|לעלא לעלא מכל/);
    assert.match(text, /האל הקדוש/);
  }
  assert.match(allText(compose('ashkenaz', 'shabbat-musaf', D.shabbatShuva5787, 'mussaf')), /בעש"ת\s+המלך/);
  assert.match(allText(compose('ashkenaz', 'shabbat-mincha', D.shabbatShuva5787, 'mincha')), /לעלא לעלא מכל/);
});

test('Ashkenaz festival Amidah and Musaf: the small-print Shabbat words only on Shabbat; ושני תמידים כהלכתם kept', () => {
  const weekday = allText(compose('ashkenaz', 'festival-amidah', D.pesach1, 'shacharit'));
  const shabbat = allText(compose('ashkenaz', 'festival-amidah', D.sukkot1Shabbat, 'shacharit'));
  assert.doesNotMatch(weekday, /שבתות למנוחה|לשבת/);
  assert.match(shabbat, /שבתות למנוחה/);
  assert.doesNotMatch(shabbat, /לשבת שבתות/); // the caption itself is not shown
  const musafPesach = allText(compose('ashkenaz', 'festival-musaf', D.pesach1, 'mussaf'));
  assert.match(musafPesach, /ושעיר לכפר\. ושני תמידים כהלכתם/);
  assert.doesNotMatch(musafPesach, /שני שעירים|שבתות למנוחה/);
  assert.match(allText(compose('ashkenaz', 'festival-musaf', D.shavuot, 'mussaf')), /ושני תמידים כהלכתם/);
});

test('Tefillat Tal and Tefillat Geshem: the first day of Pesach and 22 Tishrei only (not the diaspora\'s second day, not Simchat Torah)', () => {
  for (const nusach of ['ashkenaz', 'sefard']) {
    assert.ok(has(compose(nusach, 'festival-musaf', D.pesach1, 'mussaf'), 'tefillat-tal'), `${nusach} Tal`);
    assert.ok(!has(compose(nusach, 'festival-musaf', D.pesach2, 'mussaf', 'diaspora'), 'tefillat-tal'), `${nusach} 16 Nisan`);
    for (const place of ['il', 'diaspora']) assert.ok(has(compose(nusach, 'festival-musaf', D.sheminiAtzeret, 'mussaf', place), 'tefillat-geshem'), `${nusach} Geshem ${place}`);
    assert.ok(!has(compose(nusach, 'festival-musaf', D.simchatTorahDiaspora, 'mussaf', 'diaspora'), 'tefillat-geshem'), `${nusach} Simchat Torah`);
    const order = ids(compose(nusach, 'festival-musaf', D.pesach1, 'mussaf'));
    assert.ok(order.indexOf('gevurot') < order.indexOf('tefillat-tal'), `${nusach}: after the individual's Gevurot`);
  }
  assert.ok(has(compose('chabad', 'festival-musaf', D.sheminiAtzeret, 'mussaf', 'diaspora'), 'geshem'));
  assert.ok(!has(compose('chabad', 'festival-musaf', D.simchatTorahDiaspora, 'mussaf', 'diaspora'), 'geshem'));
});

test('Chabad: Nachem on Tisha B\'Av takes the place of the ordinary chatima; not on other days', () => {
  const tishaBav = compose('chabad', 'weekday-mincha', D.tishaBav5786, 'mincha');
  assert.ok(has(tishaBav, 'nachem'));
  assert.doesNotMatch(textOf(tishaBav, 'yerushalayim'), /בונה ירושל|נחם/);
  assert.match(textOf(tishaBav, 'nachem'), /מנחם ציון ובונה ירושלים/);
  const ordinary = compose('chabad', 'weekday-mincha', D.av7, 'mincha');
  assert.ok(!has(ordinary, 'nachem'));
  assert.match(textOf(ordinary, 'yerushalayim'), /ברוך אתה יי, בונה ירושל/);
});

test('Chabad: no Tachanun at Mincha of Erev Rosh Chodesh, and no צדקתך on the Shabbat that is its eve (Torah Or\'s list)', () => {
  assert.ok(!has(compose('chabad', 'weekday-mincha', D.weekdayErevRC, 'mincha'), 'nefilat-apayim'));
  assert.ok(has(compose('chabad', 'weekday-mincha', civil(23, 8, 5787), 'mincha'), 'nefilat-apayim'));
  assert.ok(!has(compose('chabad', 'shabbat-mincha', D.chabadShabbatErevRC, 'mincha'), 'tzidkatcha'));
  assert.ok(has(compose('chabad', 'shabbat-mincha', D.chabadOrdinaryShabbat, 'mincha'), 'tzidkatcha'));
});

test('Edot HaMizrach: the fast is announced only on the Shabbat before 17 Tammuz and 10 Tevet', () => {
  assert.ok(has(compose('edot-hamizrach', 'shabbat-shacharit', D.shabbatBeforeAsaraBetevet), 'fast-announcement'));
  assert.ok(!has(compose('edot-hamizrach', 'shabbat-shacharit', D.ordinaryShabbat), 'fast-announcement'));
});

test('Sefard weekday Shacharit: Purim Katan, the fast\'s Selichot, the weekly portion and the Purim reading', () => {
  const purimKatan = compose('sefard', 'weekday-shacharit', D.purimKatan5787);
  assert.ok(!has(purimKatan, 'lamenatzeach') && !has(purimKatan, 'beit-yaakov'));
  assert.ok(has(compose('sefard', 'weekday-shacharit', D.asaraBetevet5787), 'selichot-asara-betevet'));
  assert.ok(!ids(compose('sefard', 'weekday-shacharit', D.mondayChayeiSarah)).some(id => id.startsWith('selichot')));
  // Monday: the next Shabbat's portion only.
  const monday = textOf(compose('sefard', 'weekday-shacharit', D.mondayChayeiSarah), 'weekly-torah-text');
  assert.match(monday, /^פרשת חיי שרה ויהיו חיי שרה/);
  assert.doesNotMatch(monday, /פרשת תולדות/);
  assert.match(textOf(compose('sefard', 'weekday-shacharit', D.mondayAfterSimchatTorah), 'weekly-torah-text'), /^פרשת בראשית/);
  // Purim (14 Adar II): ויבא עמלק, not the weekly portion; Shushan Purim is not a reading day here.
  const purim = compose('sefard', 'weekday-shacharit', D.purim5787);
  assert.ok(has(purim, 'purim-torah-text') && !has(purim, 'weekly-torah-text'));
  assert.ok(!has(compose('sefard', 'weekday-shacharit', D.shushanPurim5787), 'purim-torah-text'));
});
