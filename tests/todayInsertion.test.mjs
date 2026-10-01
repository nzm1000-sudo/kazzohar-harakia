// "התוספת של היום מודגשת בעדינות" and the day labels of every insertion (owner, 2026-10-01): in ברכה מעין שלוש,
// ברכת המזון and the Amidah, the insertion the day takes keeps its label ("בסוכות") and is framed as today's; the
// insertions it does not take, listed beside it, are dimmed; alone they are not shown, as before. The decision is the
// day engine's — place (Israel / abroad) and the sunset day change included — and the words never change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import siddurOffline from '../src/data/siddurOffline.mjs';
import siddurAshkenaz from '../src/data/nusach/siddurAshkenaz.mjs';
import siddurSefard from '../src/data/nusach/siddurSefard.mjs';
import siddurChabad from '../src/data/nusach/siddurChabad.mjs';
import { JewishContextEngine } from '../src/services/jewishContextEngine.mjs';
import { normalizeSiddurBlocks } from '../src/services/siddurBlocks.mjs';
import { dayConditionsFromContext, evaluateRubric, todayVerdict } from '../src/services/prayer/rubricConditions.mjs';
import { composeRiteService } from '../src/services/prayer/riteServiceComposer.mjs';
import { compositionOf } from '../src/data/nusach/compositions/index.mjs';
import { TODAY_MARK, todayInsertionAttrs, todayInsertionClass, todayInsertionFields } from '../src/services/prayer/todayInsertion.mjs';
import { removeNikud } from '../src/hebrewText.mjs';

const ISRAEL = { il: true, halachicResidenceStatus: 'israel', location: { tzid: 'Asia/Jerusalem', latitude: 31.778, longitude: 35.235 } };
const ABROAD = { il: false, halachicResidenceStatus: 'diaspora', location: { tzid: 'America/New_York', latitude: 40.71, longitude: -74.0 } };
const DAY = {
  sukkotChm: '2026-10-01T12:00:00+03:00', // 20 Tishrei 5787, Thursday — Chol HaMoed Sukkot
  weekday: '2026-10-06T12:00:00+03:00', // 25 Tishrei, Tuesday
  shabbat: '2026-10-10T12:00:00+03:00', // 29 Tishrei, Shabbat Bereshit
  roshChodesh: '2026-10-12T12:00:00+03:00', // 1 Cheshvan, Monday
  roshHashana: '2026-09-13T12:00:00+03:00', // 2 Tishrei, Sunday
  pesachChm: '2027-04-25T12:00:00+03:00', // 18 Nisan, Sunday
  chanukah: '2026-12-07T12:00:00+02:00',
};
const contextAt = (iso, settings = ISRAEL, extra = {}) => JewishContextEngine({ now: new Date(iso), settings, ...extra });
// Display typography (״ for ", maqaf) is not a change of words.
const plain = text => removeNikud(String(text || '')).replace(/[֑-֯]/g, '').replace(/״/g, '"').replace(/\s+/g, ' ').trim();
const blocksOf = (pack, ref, context) => {
  const he = pack.texts[ref].he.flat(Infinity);
  return normalizeSiddurBlocks(he.map((text, source) => ({ text, source })), { title: ref, markup: he, context });
};
const MEEIN = {
  edot: [siddurOffline, 'Siddur Edot HaMizrach, Al Hamihya'],
  ashkenaz: [siddurAshkenaz, 'Siddur Ashkenaz, Berachot, Birkat Hanehenin, Eating, Brachot Achronot, Al Hamichyah'],
  sefard: [siddurSefard, "Siddur Sefard, Blessings, Me'ein Shalosh"],
  chabad: [siddurChabad, 'Weekday Siddur Chabad, Blessings, Berakha Acharona'],
};
const meein = (rite, iso, settings) => blocksOf(...MEEIN[rite], contextAt(iso, settings));
// The insertion that follows a label block.
const after = (blocks, label) => {
  const at = blocks.findIndex(block => block.dayLabel && plain(block.text).replace(/[:—\s]+$/, '') === label);
  return at < 0 ? null : { label: blocks[at], words: blocks[at + 1] };
};
// What is said today: neither the dimmed insertions nor the labels.
const said = blocks => plain(blocks.filter(block => block.day !== 'other' && !block.dayLabel).map(block => block.text).join(' '));

test('מעין שלוש (עדות המזרח), Chol HaMoed Sukkot in Israel: "בסוכות" labels its line, framed as today; Rosh HaShana and the rest dimmed', () => {
  const blocks = meein('edot', DAY.sukkotChm);
  const sukkot = after(blocks, 'בסוכות');
  assert.ok(sukkot, 'the Sukkot insertion carries its label');
  assert.equal(sukkot.label.day, 'today');
  assert.equal(sukkot.words.day, 'today');
  assert.match(plain(sukkot.words.text), /ושמחנו ביום הסכות הזה, ביום מקרא קדש הזה/);
  assert.ok(sukkot.label.todayMark, 'the tiny "היום" sits on the frame');
  for (const label of ['בשבת', 'בראש חודש', 'בראש השנה', 'בפסח', 'בשבועות', 'בשמיני עצרת']) {
    const other = after(blocks.map(block => ({ ...block, text: block.text.replace(/־/g, ' ') })), label);
    assert.ok(other, `"${label}" is labelled`);
    assert.equal(other.label.day, 'other', `${label}: dimmed`);
    assert.equal(other.words.day, 'other', `${label}: its words dimmed`);
    assert.ok(!other.words.frame, `${label}: not framed`);
  }
  // What is said today: the Sukkot line, not Rosh HaShana's.
  assert.match(said(blocks), /ושמחנו ביום הסכות הזה/);
  assert.doesNotMatch(said(blocks), /ביום הזכרון הזה|ראש חדש הזה/);
});

test('every insertion of מעין שלוש carries its day label in every rite', () => {
  // Shabbat Chol HaMoed-free Shabbat, Rosh Chodesh, Rosh HaShana, Sukkot, Pesach: whichever line the day takes is labelled.
  const cases = [
    ['edot', DAY.shabbat, 'בשבת', /ורצה והחליצנו ביום השבת הזה/], ['edot', DAY.roshChodesh, 'בראש חודש', /וזכרנו לטובה ביום ראש חדש הזה/],
    ['edot', DAY.roshHashana, 'בראש השנה', /ביום הזכרון הזה/], ['edot', DAY.pesachChm, 'בפסח', /חג המצות הזה/],
    ['ashkenaz', DAY.shabbat, 'בשבת', /ורצה והחליצנו/], ['ashkenaz', DAY.roshChodesh, 'בר"ח', /ראש החדש הזה/],
    ['ashkenaz', DAY.sukkotChm, 'בסוכות', /חג הסכות הזה/], ['ashkenaz', DAY.pesachChm, 'בפסח', /חג המצות הזה/],
    ['chabad', DAY.sukkotChm, 'בחוה"מ סוכות', /ביום חג הסכות הזה/], ['chabad', DAY.roshChodesh, 'בראש חודש', /ביום ראש החדש הזה/],
  ];
  for (const [rite, iso, label, words] of cases) {
    const blocks = meein(rite, iso).map(block => ({ ...block, text: block.text.replace(/־/g, ' ').replace(/״/g, '"') }));
    const found = after(blocks, label);
    assert.ok(found, `${rite} ${iso}: "${label}"`);
    assert.equal(found.label.day, 'today', `${rite} ${iso}: "${label}" is today's`);
    assert.match(plain(found.words.text), words, `${rite} ${iso}`);
  }
});

test('an ordinary weekday: no insertion of מעין שלוש is shown at all, in any rite (as before)', () => {
  for (const rite of ['edot', 'ashkenaz', 'chabad']) {
    const text = said(meein(rite, DAY.weekday));
    assert.doesNotMatch(text, /והחליצנו|ראש חדש הזה|ראש החדש הזה|הזכרון הזה|חג המצות|חג השבועות|הסכות הזה|שמיני חג עצרת|מקרא קדש|וזכרנו לטובה/, rite);
    assert.ok(!meein(rite, DAY.weekday).some(block => block.day && !block.printed), `${rite}: nothing marked`);
  }
});

test('Ashkenaz מעין שלוש on Sukkot: "ושמחנו ביום" opens the festival sentence and the Sukkot line completes it — no Shemini Atzeret as today\'s', () => {
  const blocks = meein('ashkenaz', DAY.sukkotChm);
  const text = said(blocks);
  assert.match(text, /ושמחנו ביום חג הסכות הזה, ביום \(טוב\) מקרא קדש הזה\. כי אתה/);
  assert.doesNotMatch(text, /שמיני, חג עצרת/);
  const opener = after(blocks.map(block => ({ ...block, text: block.text.replace(/״/g, '"') })), 'ביום טוב ובחוה"מ');
  assert.equal(opener.label.day, 'today');
  assert.match(plain(opener.words.text), /^ושמחנו ביום$/);
});

test('Chabad מעין שלוש on Chol HaMoed: "וזכרנו לטובה" (בראש חודש ובחוה״מ) is said and marked', () => {
  const blocks = meein('chabad', DAY.sukkotChm);
  assert.match(said(blocks), /ובטהרה\. וזכרנו לטובה ביום חג הסכות הזה\. כי אתה/);
  assert.match(said(meein('chabad', DAY.pesachChm)), /וזכרנו לטובה ביום חג המצות הזה/);
});

test('Sefard מעין שלוש prints its captions in brackets: they are marked for the day, never hidden; Yom Tov on Chol HaMoed is left unmarked', () => {
  const shabbat = meein('sefard', DAY.shabbat);
  const label = shabbat.find(block => plain(block.text) === '(בשבת:)');
  assert.equal(label.day, 'today');
  assert.equal(shabbat[shabbat.indexOf(label) + 1].day, 'today');
  assert.equal(shabbat.find(block => plain(block.text) === '(בר"ה:)').day, 'other');
  const chm = meein('sefard', DAY.sukkotChm);
  assert.equal(chm.find(block => plain(block.text) === '(ביו"ט:)').day, undefined, 'no determination: no mark');
  assert.equal(chm.find(block => plain(block.text) === '(בשבת:)').day, 'other');
});

test('the place decides: 23 Tishrei is Shemini Atzeret abroad (marked), an ordinary day in Israel (nothing shown)', () => {
  const abroad = meein('edot', '2026-10-04T12:00:00-04:00', ABROAD);
  assert.equal(after(abroad, 'בשמיני עצרת')?.label.day, 'today');
  assert.ok(!meein('edot', '2026-10-04T12:00:00+03:00').some(block => block.day));
});

test('the day changes at sunset: the evening after Hoshana Rabba is Shemini Atzeret', () => {
  const he = siddurOffline.texts['Siddur Edot HaMizrach, Al Hamihya'].he;
  const at = (iso, sunset) => normalizeSiddurBlocks(he.map((text, source) => ({ text, source })), { title: 'x', markup: he, context: contextAt(iso, ISRAEL, { times: { sunset } }) });
  const noon = at('2026-10-02T12:00:00+03:00', '2026-10-02T17:38:00+03:00');
  assert.equal(after(noon, 'בסוכות')?.label.day, 'today');
  const evening = at('2026-10-02T19:30:00+03:00', '2026-10-02T17:38:00+03:00');
  assert.equal(after(evening, 'בשמיני עצרת')?.label.day, 'today');
  assert.equal(after(evening, 'בסוכות')?.label.day, 'other');
});

test('ברכת המזון (עדות המזרח) on Chol HaMoed Sukkot: יעלה ויבוא framed with its caption, the Sukkot name today, the other names dimmed inside it', () => {
  const blocks = blocksOf(siddurOffline, 'Siddur Edot HaMizrach, Post Meal Blessing', contextAt(DAY.sukkotChm));
  const opening = blocks.find(block => block.dayLabel && /בראש חודש ביום טוב ובחול המועד/.test(plain(block.text)));
  assert.equal(opening.day, 'today');
  assert.ok(opening.todayMark);
  const sukkot = after(blocks.map(block => ({ ...block, text: block.text.replace(/:$/, '') })), 'בסוכות');
  assert.equal(sukkot.words.day, 'today');
  assert.ok(sukkot.words.frame);
  const pesach = after(blocks.map(block => ({ ...block, text: block.text.replace(/:$/, '') })), 'בפסח');
  assert.equal(pesach.words.day, 'other');
  assert.ok(pesach.words.frame, 'dimmed inside the frame of יעלה ויבוא');
  // The "if one forgot" passage is not today's insertion.
  assert.ok(!blocks.some(block => block.todayMark && /אם שכח/.test(plain(block.text))));
  // Chanukah: על הניסים is today's, the Purim paragraph is not shown.
  const chanukah = blocksOf(siddurOffline, 'Siddur Edot HaMizrach, Post Meal Blessing', contextAt(DAY.chanukah));
  assert.ok(chanukah.some(block => block.day === 'today' && /על הנסים ועל הפרקן/.test(plain(block.text))));
  assert.doesNotMatch(said(chanukah), /בימי מרדכי/);
});

test('the Amidah: משיב הרוח / מוריד הטל, ברך עלינו, יעלה ויבוא and על הניסים are marked as the day takes them', () => {
  const amida = iso => blocksOf(siddurOffline, 'Siddur Edot HaMizrach, Weekday Shacharit, Amida', contextAt(iso));
  const chm = amida(DAY.sukkotChm);
  const tal = chm.find(block => plain(block.text) === 'מוריד הטל.');
  assert.equal(tal.day, 'today', 'summer: מוריד הטל');
  assert.ok(!chm.some(block => /משיב הרוח/.test(plain(block.text))), 'the other season is not shown');
  assert.equal(chm.find(block => /^ברכנו יהוה/.test(plain(block.text))).day, 'today', 'ברכנו (summer) is today\'s');
  assert.equal(chm.find(block => /יעלה ויבא/.test(plain(block.text))).day, 'today');
  assert.equal(chm.find(block => plain(block.text).startsWith('חג הסכות הזה')).day, 'today');
  assert.equal(chm.find(block => plain(block.text).startsWith('חג המצות הזה')).day, 'other');
  const chanukah = amida(DAY.chanukah);
  assert.ok(chanukah.some(block => block.day === 'today' && /^על הנסים/.test(plain(block.text))));
  const weekday = amida(DAY.weekday);
  assert.ok(!weekday.some(block => /יעלה ויבא|על הנסים/.test(plain(block.text))));
});

test('Ashkenaz Ya\'ale Veyavo (one sentence, the day\'s names in it): each name up to its ":", and "זכרנו…" is said on every day it is said', () => {
  const service = iso => composeRiteService({ composition: compositionOf('ashkenaz'), serviceId: 'weekday-shacharit', texts: siddurAshkenaz.texts, context: { ...contextAt(iso), servicePrayer: 'shacharit' } });
  for (const [iso, name, others] of [[DAY.sukkotChm, 'חג הסכות הזה', ['ראש החדש הזה', 'חג המצות הזה']], [DAY.pesachChm, 'חג המצות הזה', ['ראש החדש הזה', 'חג הסכות הזה']], [DAY.roshChodesh, 'ראש החדש הזה', ['חג המצות הזה', 'חג הסכות הזה']]]) {
    const section = service(iso).sections.find(entry => entry.id === 'yaale-veyavo');
    const today = plain(section.blocks.filter(block => block.day !== 'other' && !block.dayLabel && block.display !== 'commentary').map(block => block.text).join(' '));
    assert.match(today, new RegExp(`ביום ${name}: זכרנו יהוה אלהינו בו לטובה`), iso);
    for (const other of others) assert.ok(section.blocks.some(block => block.day === 'other' && plain(block.text).startsWith(other)), `${iso}: ${other} dimmed`);
    assert.ok(section.blocks.every(block => block.frame), `${iso}: one frame around יעלה ויבוא`);
    assert.equal(section.blocks.filter(block => block.todayMark).length, 1);
  }
});

test('words unchanged: every marked block is the edition\'s own words', () => {
  for (const [rite, [pack, ref]] of Object.entries(MEEIN)) {
    const source = plain(pack.texts[ref].he.flat(Infinity).join(' ').replace(/<[^>]+>/g, ' '));
    for (const iso of Object.values(DAY)) {
      // Word by word (a word the day drops inside a line, "ביום [טוב] מקרא קדש", joins the words around it).
      const words = new Set(source.split(/\s+/).map(word => word.replace(/[:.,;׃—]+$/, '')));
      for (const block of meein(rite, iso).filter(entry => entry.day)) {
        for (const word of plain(block.text).split(/\s+/).map(entry => entry.replace(/[:.,;׃—]+$/, '')).filter(Boolean)) assert.ok(words.has(word), `${rite} ${iso}: "${word}" in "${plain(block.text)}"`);
      }
    }
  }
});

test('no determination, no mark: an unknown date or the full printed edition marks nothing', () => {
  const he = siddurOffline.texts['Siddur Edot HaMizrach, Al Hamihya'].he;
  const paragraphs = he.map((text, source) => ({ text, source }));
  assert.ok(!normalizeSiddurBlocks(paragraphs, { title: 'x', markup: he, context: {} }).some(block => block.day));
  assert.ok(!normalizeSiddurBlocks(paragraphs, { title: 'x', markup: he, context: contextAt(DAY.sukkotChm), asPrinted: true }).some(block => block.day));
  assert.equal(todayVerdict('(בשבת:)', dayConditionsFromContext({})), null);
});

test('the "applies today" decision (todayVerdict) and the captions it reads', () => {
  const chm = dayConditionsFromContext(contextAt(DAY.sukkotChm));
  assert.equal(todayVerdict('בסוכות', chm), 'today');
  assert.equal(todayVerdict('בראש־השנה', chm), 'other', 'a maqaf caption is read like its spaced form');
  assert.equal(todayVerdict('(בר״ח:)', chm), 'other');
  assert.equal(todayVerdict('(ביו״ט:)', chm), null, 'Yom Tov on Chol HaMoed: undecided');
  assert.equal(todayVerdict('על היין:', chm), null, 'not a day caption');
  assert.ok(evaluateRubric('בראש־חודש', chm).known);
  assert.ok(evaluateRubric('בר"ה:', chm).known);
  assert.equal(evaluateRubric('ביום טוב ובחוה"מ:', chm).applies, true, 'the festival line of מעין שלוש is said on Chol HaMoed');
  assert.equal(evaluateRubric('בראש חודש ובחוה״מ—', chm).applies, true);
  const rh = dayConditionsFromContext(contextAt(DAY.roshHashana));
  assert.equal(todayVerdict('בראש־השנה', rh), 'today');
  assert.equal(todayVerdict('בסוכות', rh), 'other');
});

test('presentation: a thin copper frame with a tiny "היום", dimming for the rest — classes and attributes, never words', () => {
  assert.equal(TODAY_MARK, 'היום');
  assert.equal(todayInsertionClass({}), '');
  assert.deepEqual(todayInsertionAttrs({}), {});
  assert.equal(todayInsertionClass({ day: 'today', frame: true, framePos: 'start', dayLabel: true }), 'today-insertion is-frame-start today-insertion-label');
  assert.equal(todayInsertionClass({ day: 'other' }), 'today-insertion-other');
  assert.equal(todayInsertionClass({ day: 'other', frame: true, framePos: 'middle' }), 'today-insertion is-frame-middle today-insertion-other');
  assert.equal(todayInsertionAttrs({ day: 'today', frame: true, todayMark: true })['data-today-mark'], 'היום');
  assert.deepEqual(todayInsertionFields({ day: 'today', frame: true, framePos: 'end', text: 'x' }), { day: 'today', frame: true, framePos: 'end' });
  const css = readFileSync(new URL('../src/styles/today-insertion.css', import.meta.url), 'utf8');
  assert.match(css, /var\(--sel-line/);
  assert.match(css, /content:attr\(data-today-mark\)/);
  assert.match(css, /\.today-insertion-other\{opacity:\.55\}/);
  assert.doesNotMatch(css, /animation|@keyframes|background:var\(--accent\)/, 'Rule A: an outline, never a fill or motion');
  const app = readFileSync(new URL('../src/NewApp.jsx', import.meta.url), 'utf8');
  assert.ok(app.indexOf("import './styles/today-insertion.css'") > app.indexOf("import './styles/ui.css'"), 'loaded after ui.css (its tokens)');
  for (const file of ['SourceReader.jsx', 'DayServiceReader.jsx', 'RiteServiceReader.jsx']) {
    const source = readFileSync(new URL(`../src/components/${file}`, import.meta.url), 'utf8');
    assert.match(source, /todayInsertionClass\(block\)/, file);
    assert.match(source, /\{\.\.\.todayInsertionAttrs\(block\)\}/, file);
  }
});
