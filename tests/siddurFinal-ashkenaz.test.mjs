// Final Siddur QA — Nusach Ashkenaz (review log: docs/siddur/review-ashkenaz.md). Regression tests for what the final
// review fixed: the festival Amidah per prayer, the festival Musaf per festival / day / place, Hallel full or half,
// the Omer (only tonight's count), the Ten Days, Erev Pesach and the eves, the Shabbat Shuva lines, no truncated
// Kaddish, no text of another rite. Composed exactly as the reader does (composeRiteService + loadSiddur).
import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPOSITIONS } from '../src/data/nusach/compositions/index.mjs';
import { COMPLETENESS } from '../src/data/nusach/prayerSchema.mjs';
import { loadSiddur } from '../src/services/nusach.mjs';
import { composeRiteService, resolveService } from '../src/services/prayer/riteServiceComposer.mjs';
import { checkService } from '../src/services/prayer/siddurQa.mjs';
import { JewishContextEngine } from '../src/services/jewishContextEngine.mjs';
import { removeNikud } from '../src/hebrewText.mjs';

const pack = await loadSiddur('ashkenaz');
const composition = COMPOSITIONS.ashkenaz;

// The day as the reader builds it (scripts/print-rite-service.mjs): the civil date the prayer belongs to (Arvit: the
// evening of that date), the prayer of the service, Israel or the diaspora.
function compose(serviceId, date, prayer = 'shacharit', { place = 'il', mode = 'prayer' } = {}) {
  const il = place === 'il';
  const settings = { location: { tzid: 'Asia/Jerusalem' }, halachicResidenceStatus: il ? 'israel' : 'diaspora', il };
  const hour = prayer === 'maariv' ? '19:30' : prayer === 'mincha' ? '13:30' : '08:00';
  const now = new Date(`${date}T${hour}:00+02:00`);
  const context = { ...JewishContextEngine({ now, settings, times: { sunset: new Date(`${date}T17:00:00+02:00`) }, prayerType: prayer === 'mussaf' ? 'shacharit' : prayer }), servicePrayer: prayer };
  return composeRiteService({ composition, serviceId, texts: pack.texts, context, mode });
}
const ids = doc => doc.sections.map(section => section.id);
const has = (doc, id) => ids(doc).includes(id);
const textOf = (doc, id) => removeNikud(doc.sections.filter(section => section.id === id).flatMap(section => section.blocks.map(block => block.text)).join(' '));
const allText = doc => removeNikud(doc.sections.flatMap(section => section.blocks.map(block => block.text)).join(' '));

// Dates (5787 / 5788).
const D = {
  pesach1: '2027-04-22', pesach2: '2027-04-23', cholHamoedPesach: '2027-04-26', shabbatCholHamoedPesach: '2027-04-24', pesach7: '2027-04-28', pesach8: '2027-04-29',
  sukkot1Shabbat: '2026-09-26', sukkot2: '2026-09-27', cholHamoedSukkot3: '2026-09-28', sukkot6: '2026-10-01', hoshanaRabbah: '2026-10-02', sheminiAtzeret: '2026-10-03', simchatTorah: '2026-10-04',
  shavuot: '2027-06-11', shavuot2: '2027-06-12',
  roshChodesh: '2026-11-10', roshChodeshTevet: '2026-12-11', chanukah: '2026-12-06', ordinaryShabbat: '2026-10-17', shabbatShuva: '2027-10-09', ordinaryTuesday: '2026-11-03',
  erevPesach: '2027-04-21', asaraBetevet: '2026-12-20', tzomGedaliah: '2027-10-04', aseretWednesday: '2027-10-06', aseretFriday: '2027-10-08', erevYomKippur: '2027-10-10', erevRoshHashana: '2027-10-01',
  friday: '2026-10-16', erevShavuot: '2027-06-10', erevChanukah: '2026-12-04',
  shabbatMevarchimKislev: '2026-11-07', shabbatMevarchimIyar: '2027-05-01', shabbatChanukah: '2026-12-05',
};

test('ashkenaz: every service resolves, and the levels of the final review', () => {
  const levels = Object.fromEntries(Object.entries(composition.services).map(([id, service]) => [id, checkService(id, service, pack.texts)]));
  for (const [id, result] of Object.entries(levels)) assert.deepEqual(result.problems, [], id);
  // 2026-09-29: the engine items of weekday Shacharit / Maariv, Shabbat Shacharit / Musaf / Mincha, the Rosh Chodesh
  // Musaf and the festival Amidah are decided (tests/engineConditions.test.mjs).
  for (const id of ['weekday-shacharit', 'weekday-mincha', 'weekday-maariv', 'bedtime-shema', 'kabbalat-shabbat', 'shabbat-maariv', 'shabbat-kiddush', 'shabbat-shacharit', 'shabbat-musaf', 'shabbat-kiddush-day', 'shabbat-mincha', 'havdalah', 'birkat-hamazon', 'hallel', 'rosh-chodesh-musaf', 'omer', 'festival-amidah']) {
    assert.equal(levels[id].level, COMPLETENESS.VERIFIED, id);
  }
  // Reviewed end to end; what remains is named in conditionsPending (engine items), never silent.
  for (const id of ['festival-musaf']) {
    assert.equal(levels[id].level, COMPLETENESS.CONDITIONS_PENDING, id);
    assert.ok(levels[id].conditionsPending.length > 0, id);
  }
});

test('ashkenaz festival Amidah: the prayer of the hour decides Kedusha, כי שם, Birkat Kohanim and the last blessing', () => {
  const maariv = compose('festival-amidah', '2027-04-21', 'maariv');
  const shacharit = compose('festival-amidah', D.pesach1, 'shacharit');
  const mincha = compose('festival-amidah', D.pesach1, 'mincha');
  // Maariv: no Kedusha, no Modim DeRabbanan, no Birkat Kohanim; שלום רב.
  for (const id of ['kedusha-shacharit', 'kedusha-mincha', 'kedusha-ledor', 'modim-derabanan', 'birkat-kohanim', 'sim-shalom', 'ki-shem']) assert.ok(!has(maariv, id), `maariv ${id}`);
  assert.ok(has(maariv, 'shalom-rav'));
  assert.match(textOf(maariv, 'shalom-rav'), /שלום רב על ישראל עמך/);
  // Shacharit: the Shacharit Kedusha (אז בקול רעש) and its closing לדור ודור, Birkat Kohanim, שים שלום.
  assert.ok(has(shacharit, 'kedusha-shacharit') && !has(shacharit, 'kedusha-mincha'));
  assert.match(textOf(shacharit, 'kedusha-shacharit'), /אז בקול רעש/);
  assert.match(textOf(shacharit, 'kedusha-ledor'), /לדור ודור נגיד גדלך/);
  assert.ok(has(shacharit, 'birkat-kohanim') && has(shacharit, 'sim-shalom') && !has(shacharit, 'shalom-rav'));
  assert.ok(!has(shacharit, 'ki-shem'));
  // Mincha: כי שם ה׳ אקרא, the Mincha Kedusha, no Birkat Kohanim; a weekday Yom Tov Mincha says שלום רב.
  assert.ok(has(mincha, 'ki-shem') && has(mincha, 'kedusha-mincha') && !has(mincha, 'kedusha-shacharit'));
  assert.ok(!has(mincha, 'birkat-kohanim') && has(mincha, 'shalom-rav') && !has(mincha, 'sim-shalom'));
  // Mincha of Yom Tov on Shabbat (the Torah is read): שים שלום, and the Shabbat lines.
  const shabbatMincha = compose('festival-amidah', D.sukkot1Shabbat, 'mincha');
  assert.ok(has(shabbatMincha, 'sim-shalom') && !has(shabbatMincha, 'shalom-rav'));
  assert.ok(has(shabbatMincha, 'day-shabbat') && has(shabbatMincha, 'retze-bimnuchatenu'));
});

test('ashkenaz festival Amidah: the festival\'s own name, the season, ותודיענו', () => {
  const name = (date, prayer = 'shacharit', place = 'il') => ids(compose('festival-amidah', date, prayer, { place })).filter(id => /^(day|yaale)-(pesach|shavuot|sukkot|shemini)$/.test(id));
  assert.deepEqual(name(D.pesach1), ['day-pesach', 'yaale-pesach']);
  assert.deepEqual(name(D.shavuot), ['day-shavuot', 'yaale-shavuot']);
  assert.deepEqual(name(D.sukkot2), ['day-sukkot', 'yaale-sukkot']);
  assert.deepEqual(name(D.sheminiAtzeret), ['day-shemini', 'yaale-shemini']);
  assert.deepEqual(name(D.simchatTorah, 'shacharit', 'diaspora'), ['day-shemini', 'yaale-shemini']);
  // משיב הרוח until Shacharit of the first day of Pesach; from its Mincha, מוריד הטל.
  assert.ok(has(compose('festival-amidah', D.pesach1, 'shacharit'), 'mashiv-haruach'));
  assert.ok(has(compose('festival-amidah', D.pesach1, 'mincha'), 'morid-hatal'));
  // Yom Tov on Motzaei Shabbat (Simchat Torah abroad, 5787): ותודיענו.
  assert.ok(has(compose('festival-amidah', D.sheminiAtzeret, 'maariv', { place: 'diaspora' }), 'vatodienu'));
  assert.ok(!has(compose('festival-amidah', '2027-04-21', 'maariv'), 'vatodienu'));
});

test('ashkenaz festival Musaf: the offerings of the day — Pesach first / Chol HaMoed / last days', () => {
  const korbanot = (date, place = 'il') => ids(compose('festival-musaf', date, 'mussaf', { place })).filter(id => /^korban|^uminchatam/.test(id));
  assert.deepEqual(korbanot(D.pesach1), ['korban-pesach', 'uminchatam']);
  assert.deepEqual(korbanot(D.pesach2, 'diaspora'), ['korban-pesach', 'uminchatam']);
  assert.deepEqual(korbanot(D.cholHamoedPesach), ['korban-pesach-late', 'uminchatam-after']);
  assert.deepEqual(korbanot(D.shabbatCholHamoedPesach, 'diaspora'), ['korban-shabbat', 'korban-pesach-late', 'uminchatam-after']);
  assert.deepEqual(korbanot(D.pesach7), ['korban-pesach-late', 'uminchatam-after']);
  assert.deepEqual(korbanot(D.pesach8, 'diaspora'), ['korban-pesach-late', 'uminchatam-after']);
  // The last days say the verse itself (the edition's caption, read as "Chol HaMoed" only, no longer hides it).
  assert.match(textOf(compose('festival-musaf', D.pesach7, 'mussaf'), 'korban-pesach-late'), /והקרבתם אשה עלה/);
  assert.deepEqual(korbanot(D.shavuot), ['korban-shavuot', 'uminchatam']);
});

test('ashkenaz festival Musaf: Sukkot day by day — the Land of Israel one verse, the diaspora two (ספיקא דיומא)', () => {
  const verses = (date, place) => {
    const doc = compose('festival-musaf', date, 'mussaf', { place });
    return (allText(doc).match(/וביום ה(?:שני|שלישי|רביעי|חמישי|ששי|שביעי)/g) || []);
  };
  assert.deepEqual(verses(D.sukkot2, 'il'), ['וביום השני']);
  assert.deepEqual(verses(D.cholHamoedSukkot3, 'il'), ['וביום השלישי']);
  assert.deepEqual(verses(D.cholHamoedSukkot3, 'diaspora'), ['וביום השני', 'וביום השלישי']);
  assert.deepEqual(verses(D.sukkot6, 'il'), ['וביום הששי']);
  assert.deepEqual(verses(D.hoshanaRabbah, 'il'), ['וביום השביעי']);
  assert.deepEqual(verses(D.hoshanaRabbah, 'diaspora'), ['וביום הששי', 'וביום השביעי']);
  // The first days of Sukkot abroad (16 Tishrei) are Yom Tov: ובחמשה עשר, not a Chol HaMoed verse.
  const second = compose('festival-musaf', D.sukkot2, 'mussaf', { place: 'diaspora' });
  assert.ok(has(second, 'korban-sukkot') && !has(second, 'korban-sukkot-chm'));
  // Shemini Atzeret: ביום השמיני, then ומנחתם ונסכיהם.
  const shemini = ids(compose('festival-musaf', D.sheminiAtzeret, 'mussaf'));
  assert.ok(shemini.indexOf('korban-shemini') < shemini.indexOf('uminchatam-after'));
  // The edition prints each day's table in full (once for the diaspora section, once for the Land of Israel's).
  const edition = compose('festival-musaf', D.sukkot2, 'mussaf', { mode: 'edition' });
  for (const id of ['korban-sukkot-chm', 'korban-sukkot-chm-il']) {
    const table = textOf(edition, id);
    for (const day of ['השני', 'השלישי', 'הרביעי', 'החמישי', 'הששי', 'השביעי']) assert.match(table, new RegExp(`וביום ${day}[. ]+פרים`), `${id} ${day}`);
  }
});

test('ashkenaz festival Musaf: the season is fixed by the festival, the priests\' blessing by the place', () => {
  assert.ok(has(compose('festival-musaf', D.sheminiAtzeret, 'mussaf'), 'mashiv-haruach'));
  assert.ok(!has(compose('festival-musaf', D.sheminiAtzeret, 'mussaf'), 'morid-hatal'));
  assert.ok(has(compose('festival-musaf', D.pesach1, 'mussaf'), 'morid-hatal'));
  assert.ok(!has(compose('festival-musaf', D.pesach1, 'mussaf'), 'mashiv-haruach'));
  // Diaspora Yom Tov: the priests go up; ותערב ends "שאותך לבדך ביראה נעבוד".
  const diasporaYomTov = compose('festival-musaf', D.sukkot1Shabbat, 'mussaf', { place: 'diaspora' });
  assert.ok(has(diasporaYomTov, 'vetearev') && has(diasporaYomTov, 'vetearev-end-diaspora') && has(diasporaYomTov, 'birkat-kohanim'));
  assert.ok(!has(diasporaYomTov, 'vetearev-end-israel'));
  // Diaspora Chol HaMoed: no priests — the chazzan's אלהינו ואלהי אבותינו ברכנו, no ותערב.
  const diasporaChm = compose('festival-musaf', D.cholHamoedSukkot3, 'mussaf', { place: 'diaspora' });
  assert.ok(has(diasporaChm, 'birkat-kohanim-chazzan') && !has(diasporaChm, 'birkat-kohanim') && !has(diasporaChm, 'vetearev'));
  // The Land of Israel: the priests every day (Gra / Land-of-Israel ending).
  const israelChm = compose('festival-musaf', D.cholHamoedSukkot3, 'mussaf');
  assert.ok(has(israelChm, 'birkat-kohanim') && has(israelChm, 'vetearev-end-israel') && !has(israelChm, 'birkat-kohanim-chazzan'));
  // ותערב comes inside רצה (before ותחזינה), not after Modim.
  const order = ids(israelChm);
  assert.ok(order.indexOf('vetearev') < order.indexOf('retze-end') && order.indexOf('retze-end') < order.indexOf('modim'));
  // The Chol HaMoed Kedusha (נקדש) on a weekday of Chol HaMoed, נעריצך with אדיר אדירנו on Hoshana Rabba, and no
  // אדיר אדירנו on Shabbat Chol HaMoed.
  assert.ok(has(israelChm, 'kedusha-chm') && !has(israelChm, 'kedusha'));
  const hoshanaRabbah = compose('festival-musaf', D.hoshanaRabbah, 'mussaf');
  assert.ok(has(hoshanaRabbah, 'kedusha') && has(hoshanaRabbah, 'adir-adirenu'));
  const shabbatChm = compose('festival-musaf', D.shabbatCholHamoedPesach, 'mussaf');
  assert.ok(has(shabbatChm, 'kedusha') && !has(shabbatChm, 'adir-adirenu'));
});

test('ashkenaz Hallel: full on Chanukah (Rosh Chodesh Tevet too), Sukkot, Shemini Atzeret, Shavuot and the first days of Pesach; half on Rosh Chodesh and the rest of Pesach', () => {
  const full = (date, place = 'il') => {
    const doc = compose('hallel', date, 'shacharit', { place });
    return has(doc, 'lo-lanu') && has(doc, 'ahavti');
  };
  for (const [date, place] of [[D.chanukah], [D.roshChodeshTevet], [D.cholHamoedSukkot3], [D.sheminiAtzeret], [D.simchatTorah, 'diaspora'], [D.shavuot], [D.shavuot2, 'diaspora'], [D.pesach1], [D.pesach2, 'diaspora']]) {
    assert.ok(full(date, place), `full Hallel ${date} ${place || 'il'}`);
  }
  for (const [date, place] of [[D.roshChodesh], [D.cholHamoedPesach], [D.pesach7], [D.pesach8, 'diaspora']]) {
    assert.ok(!full(date, place), `half Hallel ${date} ${place || 'il'}`);
    assert.ok(has(compose('hallel', date, 'shacharit', { place }), 'ps115'));
  }
  // None on an ordinary day in the weekday Shacharit.
  assert.ok(!ids(compose('weekday-shacharit', D.ordinaryTuesday)).some(id => id.startsWith('hallel-')));
  assert.ok(has(compose('weekday-shacharit', D.chanukah), 'hallel-lo-lanu'));
  assert.ok(!has(compose('weekday-shacharit', D.roshChodesh), 'hallel-lo-lanu') && has(compose('weekday-shacharit', D.roshChodesh), 'hallel-ps113'));
});

test('ashkenaz Omer: only tonight\'s count — days 1, 2, 7, 8, 33, 49 — in the Omer, weekday and Friday-night Maariv', () => {
  const nights = { 1: '2027-04-22', 2: '2027-04-23', 7: '2027-04-28', 8: '2027-04-29', 33: '2027-05-24', 49: '2027-06-09' };
  const counts = doc => (allText(doc).match(/\d+\. היום [^:]*בעמר/g) || []);
  for (const [n, date] of Object.entries(nights)) {
    const omer = counts(compose('omer', date, 'maariv'));
    assert.equal(omer.length, 1, `omer ${n}`);
    assert.ok(omer[0].startsWith(`${n}. היום`), `omer ${n}: ${omer[0]}`);
    const maariv = counts(compose('weekday-maariv', date, 'maariv'));
    assert.equal(maariv.length, 1, `maariv ${n}`);
    assert.ok(maariv[0].startsWith(`${n}. היום`));
  }
  assert.match(counts(compose('omer', '2027-04-22', 'maariv'))[0], /היום יום אחד בעמר/);
  assert.match(counts(compose('omer', '2027-06-09', 'maariv'))[0], /תשעה וארבעים יום שהם שבעה שבועות/);
  // Motzaei Shabbat (day 10): the count after half Kaddish, before ויהי נועם — once.
  const motzaei = compose('weekday-maariv', '2027-05-01', 'maariv');
  assert.equal(counts(motzaei).length, 1);
  assert.ok(ids(motzaei).indexOf('omer-ms-count') < ids(motzaei).indexOf('vihi-noam'));
  // Friday night (day 9): the Shabbat leaf's placeholder "היום [...]" is replaced by the night's line.
  const friday = compose('shabbat-maariv', '2027-04-30', 'maariv');
  assert.deepEqual(counts(friday).map(line => line.split('.')[0]), ['9']);
  assert.ok(!/היום \[/.test(allText(friday)));
  // The edition prints all 49.
  assert.equal(counts(compose('omer', '2027-04-22', 'maariv', { mode: 'edition' })).length, 49);
});

test('ashkenaz weekday Maariv: אתה חוננתנו on Motzaei Shabbat and on Motzaei Yom Tov', () => {
  assert.ok(has(compose('weekday-maariv', '2027-05-01', 'maariv'), 'ata-chonantanu'));
  assert.ok(has(compose('weekday-maariv', D.pesach1, 'maariv'), 'ata-chonantanu')); // night of 16 Nisan, Israel
  assert.ok(has(compose('weekday-maariv', D.pesach8, 'maariv', { place: 'diaspora' }), 'ata-chonantanu'));
  assert.ok(!has(compose('weekday-maariv', D.ordinaryTuesday, 'maariv'), 'ata-chonantanu'));
});

test('ashkenaz weekday Shacharit: Erev Pesach and Erev Yom Kippur (מזמור לתודה, למנצח), no fast of the firstborn as a public fast', () => {
  const erevPesach = compose('weekday-shacharit', D.erevPesach);
  for (const id of ['mizmor-letoda', 'lamenatzeach', 'aneinu-chazzan', 'torah-reading', 'nefilat-apayim']) assert.ok(!has(erevPesach, id), `Erev Pesach ${id}`);
  const erevYomKippur = compose('weekday-shacharit', D.erevYomKippur);
  for (const id of ['mizmor-letoda', 'lamenatzeach', 'avinu-malkeinu', 'nefilat-apayim']) assert.ok(!has(erevYomKippur, id), `Erev YK ${id}`);
  assert.ok(!has(compose('weekday-shacharit', D.cholHamoedPesach), 'mizmor-letoda'));
  assert.ok(has(compose('weekday-shacharit', D.ordinaryTuesday), 'mizmor-letoda'));
  // A real public fast keeps everything.
  const fast = compose('weekday-mincha', D.asaraBetevet, 'mincha');
  for (const id of ['aneinu-chazzan', 'aneinu', 'birkat-kohanim', 'sim-shalom', 'avinu-malkeinu']) assert.ok(has(fast, id), `10 Tevet ${id}`);
  const erevPesachMincha = compose('weekday-mincha', D.erevPesach, 'mincha');
  for (const id of ['aneinu-chazzan', 'aneinu', 'birkat-kohanim', 'sim-shalom']) assert.ok(!has(erevPesachMincha, id), `Erev Pesach Mincha ${id}`);
  assert.ok(has(erevPesachMincha, 'shalom-rav'));
});

test('ashkenaz the Ten Days: Tachanun and Avinu Malkeinu on their weekdays, not on Erev Yom Kippur; Av HaRachamim and צדקתך on Shabbat Shuva', () => {
  for (const date of [D.tzomGedaliah, D.aseretWednesday, D.aseretFriday]) {
    const doc = compose('weekday-shacharit', date);
    assert.ok(has(doc, 'avinu-malkeinu') && has(doc, 'nefilat-apayim'), date);
  }
  assert.ok(has(compose('weekday-mincha', D.aseretWednesday, 'mincha'), 'avinu-malkeinu'));
  // Mincha of Friday: neither Avinu Malkeinu nor Tachanun.
  const fridayMincha = compose('weekday-mincha', D.aseretFriday, 'mincha');
  assert.ok(!has(fridayMincha, 'avinu-malkeinu') && !has(fridayMincha, 'nefilat-apayim'));
  assert.ok(has(compose('shabbat-shacharit', D.shabbatShuva), 'av-harachamim'));
  assert.ok(has(compose('shabbat-mincha', D.shabbatShuva, 'mincha'), 'tzidkatcha'));
  // Birkat HaMazon: על נהרות בבל on a weekday of the Ten Days.
  assert.ok(has(compose('birkat-hamazon', D.aseretWednesday), 'al-naharot'));
});

test('ashkenaz Tachanun at the eves: not at Mincha of Erev Shabbat, Erev Yom Tov, Erev Chanukah; not on Erev Rosh Hashana', () => {
  for (const date of [D.friday, D.erevShavuot, D.erevChanukah]) assert.ok(!has(compose('weekday-mincha', date, 'mincha'), 'nefilat-apayim'), date);
  assert.ok(has(compose('weekday-mincha', D.ordinaryTuesday, 'mincha'), 'nefilat-apayim'));
  assert.ok(!has(compose('weekday-shacharit', D.erevRoshHashana), 'nefilat-apayim'));
  assert.ok(has(compose('weekday-shacharit', D.friday), 'nefilat-apayim'));
});

test('ashkenaz Shabbat Shacharit: ברכת החודש and אב הרחמים by the edition\'s rule', () => {
  const mevarchim = compose('shabbat-shacharit', D.shabbatMevarchimKislev);
  assert.ok(has(mevarchim, 'birkat-hachodesh') && !has(mevarchim, 'av-harachamim'));
  const iyar = compose('shabbat-shacharit', D.shabbatMevarchimIyar); // Mevarchim of Iyar: said, as the edition says
  assert.ok(has(iyar, 'birkat-hachodesh') && has(iyar, 'av-harachamim'));
  const ordinary = compose('shabbat-shacharit', D.ordinaryShabbat);
  assert.ok(!has(ordinary, 'birkat-hachodesh') && has(ordinary, 'av-harachamim'));
  const chanukah = compose('shabbat-shacharit', D.shabbatChanukah);
  assert.ok(!has(chanukah, 'av-harachamim') && has(chanukah, 'hallel-lo-lanu'));
  // שוכן עד: האל בתעצומות is said every Shabbat.
  assert.match(textOf(ordinary, 'shochen-ad'), /האל בתעצ[ו]?מות עזך/);
});

test('ashkenaz Shabbat Musaf and Mincha: the Shabbat Shuva paragraphs only on Shabbat Shuva', () => {
  const ordinaryMusaf = compose('shabbat-musaf', D.ordinaryShabbat, 'mussaf');
  const shuvaMusaf = compose('shabbat-musaf', D.shabbatShuva, 'mussaf');
  for (const id of ['uchtov', 'besefer-chayim', 'zachreinu', 'mi-chamocha']) {
    assert.ok(!has(ordinaryMusaf, id), `ordinary ${id}`);
    assert.ok(has(shuvaMusaf, id), `Shuva ${id}`);
  }
  assert.ok(!/וכתב לחיים טובים|בספר חיים ברכה/.test(allText(ordinaryMusaf).replace(/\s+/g, ' ')));
  const ordinaryMincha = compose('shabbat-mincha', D.ordinaryShabbat, 'mincha');
  assert.ok(!has(ordinaryMincha, 'uchtov') && !has(ordinaryMincha, 'besefer-chayim'));
  assert.ok(has(compose('shabbat-mincha', D.shabbatShuva, 'mincha'), 'uchtov'));
});

test('ashkenaz: no truncated Kaddish, and no text of another rite', () => {
  const services = [
    ['weekday-shacharit', D.roshChodeshTevet], ['weekday-shacharit', D.cholHamoedSukkot3], ['weekday-maariv', '2027-05-01', 'maariv'], ['weekday-mincha', D.ordinaryTuesday, 'mincha'],
    ['shabbat-musaf', D.ordinaryShabbat, 'mussaf'], ['shabbat-mincha', D.ordinaryShabbat, 'mincha'], ['rosh-chodesh-musaf', D.roshChodesh, 'mussaf'], ['festival-musaf', D.pesach1, 'mussaf'],
  ];
  for (const [serviceId, date, prayer = 'shacharit'] of services) {
    const doc = compose(serviceId, date, prayer);
    for (const section of doc.sections.filter(item => /kaddish/.test(item.concept || ''))) {
      const text = removeNikud(section.blocks.map(block => block.text).join(' '));
      assert.match(text, /יתגדל ויתקדש/, `${serviceId}/${section.id}`);
      assert.match(text, /ואמרו אמן[:.\]\s]*$|אמן\]?\s*$/, `${serviceId}/${section.id} ends`);
      if (/titkabal|yatom|derabanan/.test(section.concept)) assert.match(text, /עושה שלום|עשה שלום/, `${serviceId}/${section.id} עושה שלום`);
    }
  }
  // Every section of every Ashkenaz service is cut from an Ashkenaz edition only: the Metsudah edition, or — for what
  // it lacks — Birnbaum's HaSiddur HaShalem (tests/birnbaumAshkenaz.test.mjs).
  for (const [serviceId, service] of Object.entries(composition.services)) {
    for (const section of resolveService(service, pack.texts)) assert.ok(section.ref.startsWith('Siddur Ashkenaz, ') || section.ref.startsWith('HaSiddur HaShalem Birnbaum, '), `${serviceId}/${section.id}`);
  }
});
