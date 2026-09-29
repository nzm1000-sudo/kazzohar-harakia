// Text gaps of the siddur editions (2026-09-29): what was filled, from which open source of the same rite, on which
// days it shows, that it is byte-exact to the source and credited; and the "gaps" that turned out to be the rite's own
// nusach. Docs: docs/siddur/review-<rite>.md, docs/siddur/open-siddur-sources.md; sources/sefard-torat-emet/README.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMPOSITIONS } from '../src/data/nusach/compositions/index.mjs';
import { NUSACHIM, nusachForReference } from '../src/data/nusach/registry.mjs';
import { SIDDUR_SOURCES, licenseAllowed } from '../src/data/nusach/manifest.mjs';
import { loadSiddur } from '../src/services/nusach.mjs';
import { composeRiteService } from '../src/services/prayer/riteServiceComposer.mjs';
import { checkRite } from '../src/services/prayer/siddurQa.mjs';
import { JewishContextEngine } from '../src/services/jewishContextEngine.mjs';
import { removeNikud } from '../src/hebrewText.mjs';
import toratEmet from '../src/data/nusach/siddurSefardToratEmet.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const TE = 'Siddur Sefard Torat Emet';
const raw = file => JSON.parse(read(`../sources/sefard-torat-emet/raw/${file}`)).versions.find(v => v.versionTitle === 'Torat Emet 357' && v.language === 'he');
const provenance = JSON.parse(read('../sources/sefard-torat-emet/provenance.json'));

function composer(nusach, pack) {
  return (serviceId, date, prayer = 'shacharit', { il = true, mode = 'prayer' } = {}) => {
    const settings = { location: { tzid: 'Asia/Jerusalem' }, halachicResidenceStatus: il ? 'israel' : 'diaspora', il };
    const hour = prayer === 'maariv' ? '19:30' : prayer === 'mincha' ? '13:30' : '08:00';
    const now = new Date(`${date}T${hour}:00+02:00`);
    const context = { ...JewishContextEngine({ now, settings, times: { sunset: new Date(`${date}T17:00:00+02:00`) }, prayerType: prayer === 'mussaf' ? 'shacharit' : prayer }), servicePrayer: prayer };
    return composeRiteService({ composition: COMPOSITIONS[nusach], serviceId, texts: pack.texts, context, mode });
  };
}
const ids = doc => doc.sections.map(section => section.id);
const textOf = (doc, id) => removeNikud(doc.sections.filter(section => section.id === id).flatMap(section => section.blocks.map(block => block.text)).join(' ')).replace(/<[^>]+>/g, '');
const all = doc => removeNikud(doc.sections.flatMap(section => section.blocks.map(block => block.text)).join(' ')).replace(/<[^>]+>/g, '');

const sefardPack = await loadSiddur('sefard');
const sefard = composer('sefard', sefardPack);
// 5787: 15 Nisan (Thu), 17 Nisan (Shabbat Chol HaMoed), 6 Sivan, 17 Tishrei (Chol HaMoed Sukkot), 22 Tishrei, 1 Cheshvan, a weekday.
const D = { pesach: '2027-04-22', pesachShabbat: '2027-04-24', shavuot: '2027-06-11', sukkot3: '2026-09-28', sheminiAtzeret: '2026-10-03', simchatTorahDiaspora: '2026-10-04', roshChodesh: '2026-10-12', weekday: '2026-10-14', shabbat: '2026-10-17' };

// ── Sefard: the Torat Emet 357 version of three leaves ─────────────────────────────────────────────────────────────
test('Sefard Torat Emet pack: Public Domain Sefaria version, registered as the rite\'s second edition, in the manifest', () => {
  assert.equal(toratEmet.source.index, TE);
  assert.equal(toratEmet.source.license, 'Public Domain');
  assert.equal(toratEmet.source.sefariaIndex, 'Siddur Sefard');
  assert.equal(toratEmet.source.versionTitle, 'Torat Emet 357');
  assert.deepEqual(NUSACHIM.find(item => item.id === 'sefard').extras.map(extra => extra.index), [TE]);
  assert.equal(nusachForReference(`${TE}, Bedtime Shema`), 'sefard');
  const extra = SIDDUR_SOURCES.sefard.extraEditions.find(edition => edition.index === TE);
  assert.ok(extra && extra.attribution && extra.changesHe && extra.sourceUrl);
  assert.equal(extra.license, 'Public Domain');
  assert.ok(!extra.sectionCredit, 'no per-section credit line: the licence asks for none (the footer still names the version)');
  for (const [ref, text] of Object.entries(toratEmet.texts)) {
    assert.ok(ref.startsWith(`${TE}, `), ref);
    assert.ok(licenseAllowed(extra, text.heVersionTitle, text.heLicense).ok, ref);
    assert.ok(ref in sefardPack.texts, `${ref} is loaded with the Sefard pack`);
  }
});

test('Sefard Torat Emet pack: every paragraph is Sefaria\'s, byte for byte; the one split joins back to ¶26 exactly', () => {
  for (const [ref, file] of [[`${TE}, Birchat HaMazon, Birchat HaMazon`, 'birchat-hamazon.json'], [`${TE}, Bedtime Shema`, 'bedtime-shema.json']]) {
    const source = raw(file);
    assert.equal(source.license, 'Public Domain');
    assert.deepEqual(toratEmet.texts[ref].he, source.text, ref);
  }
  const musaf = toratEmet.texts[`${TE}, Holidays, Yom Tov Musaf Amidah`];
  const p26 = raw('yom-tov-musaf-amidah.json').text[26];
  assert.equal(musaf.he.length, 2);
  assert.deepEqual(musaf.source.paragraphs, [26, 26]);
  // Markup only: the enclosing <small> closed before the cut and reopened after it.
  assert.equal(musaf.he[0].replace(/<\/small>$/, '') + musaf.he[1].replace(/^<small>/, ''), p26);
  assert.match(removeNikud(musaf.he[1]), /^<small>הזה, נעשה ונקריב לפניך באהבה.*כאמור:<\/small>$/);
  // Provenance: API URL, cache, version, licence per leaf.
  assert.equal(provenance.leaves.length, 3);
  for (const leaf of provenance.leaves) {
    assert.match(leaf.api, /^https:\/\/www\.sefaria\.org\/api\/v3\/texts\//);
    assert.equal(leaf.license, 'Public Domain');
    assert.equal(leaf.versionTitle, 'Torat Emet 357');
  }
});

test('Sefard Birkat HaMazon: on Shavuot Ya\'aleh VeYavo names the day (Torat Emet ¶51, ¶54, ¶59); other days as before', () => {
  const shavuot = sefard('birkat-hamazon', D.shavuot);
  assert.deepEqual(ids(shavuot).filter(id => /^yv-|^yaale/.test(id)), ['yv-shavuot-opening', 'yv-shavuot', 'yv-shavuot-end']);
  assert.match(textOf(shavuot, 'yv-shavuot'), /חג השבעות/);
  assert.match(textOf(shavuot, 'yv-shavuot-end'), /^הזה\. זכרנו/);
  for (const id of ['yv-shavuot-opening', 'yv-shavuot', 'yv-shavuot-end']) assert.ok(shavuot.sections.find(section => section.id === id).ref.startsWith(`${TE}, `), id);
  assert.doesNotMatch(all(shavuot), /חג המצות|חג הסכות|ראש החדש הזה/);
  const roshChodesh = sefard('birkat-hamazon', D.roshChodesh);
  assert.deepEqual(ids(roshChodesh).filter(id => /^yv-|^yaale/.test(id)), ['yaale-veyavo', 'yv-rosh-chodesh', 'yv-end']);
  const sukkot = sefard('birkat-hamazon', D.sukkot3);
  assert.deepEqual(ids(sukkot).filter(id => /^yv-|^yaale/.test(id)), ['yaale-veyavo', 'yv-sukkot', 'yv-end']);
  assert.ok(!ids(sefard('birkat-hamazon', D.weekday)).some(id => /^yv-|^yaale/.test(id)));
});

test('Sefard festival Musaf: "…הזה, נעשה ונקריב… כאמור" follows the festival\'s name on Pesach, Shavuot, Sukkot — once on Shemini Atzeret', () => {
  for (const [date, name] of [[D.pesach, 'חג המצות'], [D.shavuot, 'חג השבועות'], [D.sukkot3, 'חג הסכות']]) {
    const doc = sefard('festival-musaf', date, 'mussaf');
    const list = ids(doc);
    const nameId = list.find(id => id.startsWith('musaf-name-') && id !== 'musaf-name-continuation');
    assert.equal(list[list.indexOf(nameId) + 1], 'musaf-name-continuation', date);
    assert.match(textOf(doc, nameId), new RegExp(name));
    assert.match(textOf(doc, 'musaf-name-continuation'), /^הזה, נעשה ונקריב לפניך באהבה כמצות רצונך.*מפי כבודך כאמור:$/);
  }
  // Shabbat Chol HaMoed: the Shabbat verses follow "כאמור:".
  const shabbat = ids(sefard('festival-musaf', D.pesachShabbat, 'mussaf'));
  assert.ok(shabbat.indexOf('musaf-name-continuation') + 1 === shabbat.indexOf('musaf-shabbat'));
  for (const [date, il] of [[D.sheminiAtzeret, true], [D.simchatTorahDiaspora, false]]) {
    const doc = sefard('festival-musaf', date, 'mussaf', { il });
    assert.ok(!ids(doc).includes('musaf-name-continuation'), date);
    assert.equal((all(doc).match(/נעשה ונקריב לפניך באהבה/g) || []).length, 1, `${date}: the continuation once`);
  }
});

test('Sefard Bedtime Shema: והיה אם שמוע and ויאמר, as "some say", after the first paragraph (Torat Emet ¶6–7)', () => {
  const doc = sefard('bedtime-shema', D.weekday, 'maariv');
  const list = ids(doc);
  assert.equal(list[list.indexOf('shema') + 1], 'vehaya-vayomer');
  const section = doc.sections.find(item => item.id === 'vehaya-vayomer');
  assert.equal(section.role, 'optional');
  assert.match(textOf(doc, 'vehaya-vayomer'), /^והיה אם שמע תשמעו.*ויאמר יהוה אל משה לאמר/);
});

test('Sefard: QA clean with the second version; the two source gaps are no longer pending', () => {
  for (const result of checkRite(COMPOSITIONS.sefard, sefardPack.texts)) assert.deepEqual(result.problems, [], result.serviceId);
  const pending = Object.values(COMPOSITIONS.sefard.services).flatMap(service => service.conditionsPending || []);
  assert.ok(!pending.some(item => /שורת שבועות|נעשה ונקריב/.test(item)), pending.filter(item => /שורת שבועות|נעשה ונקריב/.test(item)).join(' | '));
});

// ── Ashkenaz: the whole איזהו מקומן on Shabbat ────────────────────────────────────────────────────────────────────
test('Ashkenaz Shabbat Shacharit: איזהו מקומן has all eight mishnayot (the Metsudah leaf of the same edition)', async () => {
  const pack = await loadSiddur('ashkenaz');
  const doc = composer('ashkenaz', pack)('shabbat-shacharit', D.shabbat, 'shacharit', { mode: 'edition' });
  const section = doc.sections.find(item => item.id === 'eizehu-mekoman');
  assert.equal(section.ref, 'Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Korbanot, Laws of Sacrifices');
  const words = textOf(doc, 'eizehu-mekoman');
  for (const opening of ['איזהו מקומן', 'פרים הנשרפים', 'חטאת הצבור', 'העולה קדש קדשים', 'זבחי שלמי צבור', 'התודה ואיל נזיר', 'שלמים קדשים קלים', 'הבכור והמעשר והפסח']) assert.ok(words.replace(/[־]/g, ' ').includes(opening), opening);
  assert.match(words, /ואינו נאכל אלא צלי/);
});

// ── Edot HaMizrach: the edition's own nusach, not gaps ────────────────────────────────────────────────────────────
test('Edot HaMizrach: Kiddush, Psalm 30 and the festival Musaf are the rite\'s own text — recorded as notes, no longer as gaps', async () => {
  const pack = await loadSiddur('edot-hamizrach');
  const edot = COMPOSITIONS['edot-hamizrach'];
  const pending = Object.values(edot.services).flatMap(service => service.conditionsPending || []);
  assert.ok(!pending.some(item => /חסר בטקסט המהדורה|אינם מודפסים במהדורה: ¶26/.test(item)), 'no false text gap left pending');
  assert.ok(edot.services['shabbat-kiddush'].notes.some(note => /מגן אברהם/.test(note)));
  assert.ok(edot.services['festival-musaf'].notes.some(note => /אינו חסר/.test(note)));
  // What the notes rely on, in the edition itself: the Kiddush as printed …
  const kiddush = removeNikud(pack.texts['Siddur Edot HaMizrach, Shabbat Evening, Kiddush'].he.join(' ')).replace(/<[^>]+>/g, '');
  assert.match(kiddush, /זכר ליציאת מצרים,? ושבת קדשך/);
  assert.doesNotMatch(kiddush, /כי בנו בחרת/);
  // … the heading verse of Psalm 30 said on Chanukah (Rosh Hodesh Song of the Day) …
  const roshHodeshSong = removeNikud(pack.texts['Siddur Edot HaMizrach, Rosh Hodesh, Song of the Day'].he.join(' ')).replace(/<[^>]+>/g, '');
  assert.match(roshHodeshSong, /בחנוכה אומרים/);
  // … and "כאמור" with the verses in the Shabbat and Rosh Chodesh Musaf, none in the festival Musaf.
  const festivalMusaf = composer('edot-hamizrach', pack)('festival-musaf', D.sukkot3, 'mussaf');
  assert.doesNotMatch(all(festivalMusaf), /על ידי משה עבדך,? (מפי כבודך )?כאמור/);
});

// ── Chabad: the Shabbat Yotzer, typed and pointed by the owner, checked against the 1940 Torah Ohr scan ──────────
test('Chabad Shabbat Shacharit: הכל יודוך is the owner\'s text with the four scan words, on Shabbat only, credited', async () => {
  const { readFileSync } = await import('node:fs');
  const service = COMPOSITIONS.chabad.services['shabbat-shacharit'];
  assert.equal(service.sourceGap, undefined);
  const pack = await loadSiddur('chabad');
  const he = pack.texts['Siddur Chabad Owner Transcription, Shabbat, Yotzer'].he;
  const original = readFileSync(new URL('../sources/chabad-owner-transcription/owner-original.txt', import.meta.url), 'utf8').trim().split('\n').map(line => line.replace(/^• /, ''));
  const fixed = original.join('\n').replace('הַיּוֹצֵר אֶת הַכֹּל', 'יוֹצֵר הַכֹּל').replace('דַּלְתֵי', 'דַּלְתוֹת').replaceAll('אֵין כְּעֶרְכְּךָ', 'אֵין עֲרוֹךְ לְךָ');
  assert.deepEqual(he, fixed.split('\n'), 'the owner\'s text; only the four words aligned to the scan');
  const words = removeNikud(he.join(' '));
  for (const phrase of ['ירוממוך סלה, יוצר הכל', 'דלתות שערי מזרח', 'מה רבו מעשיך', 'אין ערוך לך ואין זולתך', 'אין ערוך לך יהוה אלהינו', 'ואין דומה לך מושיענו לתחית המתים']) assert.ok(words.includes(phrase), phrase);
  assert.doesNotMatch(words, /כערכך|דלתי |היוצר את הכל/);
  // placed between יוצר אור and אל אדון, on Shabbat only; the section carries its own credit line
  const ids = service.sections.map(section => section.id);
  assert.ok(ids.indexOf('yotzer') < ids.indexOf('hakol-yoducha') && ids.indexOf('hakol-yoducha') === ids.indexOf('el-adon') - 1);
  assert.equal(service.sections.find(section => section.id === 'hakol-yoducha').when, 'shabbat');
  const { SIDDUR_SOURCES } = await import('../src/data/nusach/manifest.mjs');
  const owner = SIDDUR_SOURCES.chabad.extraEditions.find(edition => edition.index === 'Siddur Chabad Owner Transcription');
  assert.match(owner.sectionCredit, /בעל האפליקציה.*תורה אור \(1940\)/);
  assert.equal(owner.license, 'Owner');
});
