import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { createRequire, Module } from 'node:module';
import { HDate, months } from '@hebcal/core';
import siddurOffline from '../src/data/siddurOffline.mjs';
import PACK from '../src/data/prayerPacks/edotHaMizrachWeekdayMincha.mjs';
import { normalizeForSearch, normalizeHebrewText } from '../src/hebrewText.mjs';
import { composeWeekdayMincha, validatePrayerDocument, verifyPackIntegrity } from '../src/services/prayer/weekdayMinchaComposer.mjs';
import { CONDITIONS } from '../src/services/prayer/weekdayMinchaRules.mjs';
import { createPrayerSession, documentForSession, firstChangedSection, loadOpenSession, saveSession, sessionInputs } from '../src/services/prayer/prayerSession.mjs';
import { normalizeSiddurBlocks } from '../src/services/siddurBlocks.mjs';
import { normalizeText } from '../src/services/sefaria.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const css = readFileSync(fileURLToPath(new URL('../src/styles/base.css', import.meta.url)), 'utf8');

const JERUSALEM = { il: true, halachicResidenceStatus: 'israel', nusach: 'edot-hamizrach', location: { name: 'ירושלים', tzid: 'Asia/Jerusalem', latitude: 31.77, longitude: 35.21, source: 'manual' } };
const NEW_YORK = { il: false, halachicResidenceStatus: 'diaspora', nusach: 'edot-hamizrach', location: { name: 'New York', tzid: 'America/New_York', latitude: 40.71, longitude: -74.0, source: 'manual' } };

// Local-afternoon Mincha with same-day zmanim (UTC instants).
function mincha(date, settings = JERUSALEM, { at = '12:00', sunrise = '03:40', sunset = '15:30', preferences, answers, times } = {}) {
  return composeWeekdayMincha({
    now: new Date(`${date}T${at}:00Z`),
    settings,
    times: times === undefined ? { sunrise: `${date}T${sunrise}:00Z`, sunset: `${date}T${sunset}:00Z` } : times,
    preferences,
    answers,
  });
}
const has = (composed, sourceId) => composed.document.sections.some(section => section.blocks.some(block => block.sourceId === sourceId));
const block = (composed, sourceId) => composed.document.sections.flatMap(section => section.blocks).find(item => item.sourceId === sourceId);

const MORID = 'amida.4.1';
const MASHIV = 'amida.4.3';
const BARCHENU = 'amida.18';
const BARECH_ALEINU = 'amida.20';
const VIDUI = 'vidui.1';

test('pack: every Weekday Mincha source segment is covered exactly, checksums match, conditions are known', () => {
  assert.deepEqual(verifyPackIntegrity(), { ok: true, problems: [] });
  for (const section of PACK.sections) {
    const he = siddurOffline.texts[section.ref].he;
    const bySegment = new Map();
    section.blocks.forEach(item => bySegment.set(item.segment, [...(bySegment.get(item.segment) || []), item]));
    assert.equal(bySegment.size, he.length, `${section.id}: every segment mapped`);
    he.forEach((markup, segment) => {
      const joined = bySegment.get(segment).map(item => normalizeHebrewText(markup.slice(item.start, item.end), 'siddur')).join('');
      const squash = value => normalizeForSearch(value).replace(/\s+/g, '');
      assert.equal(squash(joined), squash(normalizeHebrewText(markup, 'siddur')), `${section.id}.${segment}: no text dropped`);
    });
    section.blocks.filter(item => item.when).forEach(item => assert.ok(CONDITIONS[item.when], `${item.id}: unknown condition ${item.when}`));
  }
  const ids = PACK.sections.flatMap(section => section.blocks.map(item => item.id));
  assert.equal(new Set(ids).size, ids.length);
});

test('13 Tishrei (24.9.2026, Jerusalem): dew and ברכנו, no Vidui (YY 131:37), and the unverified "יהי שם" stays open', () => {
  const result = mincha('2026-09-24');
  assert.equal(result.calendar.hebrew.label, 'י״ג בתשרי תשפ״ז');
  assert.deepEqual([has(result, MORID), has(result, MASHIV), has(result, BARCHENU), has(result, BARECH_ALEINU)], [true, false, true, false]);
  assert.equal(has(result, VIDUI), false);
  assert.equal(has(result, 'vidui.11'), true, 'Kaddish Titkabal is said in a minyan');
  assert.equal(result.document.status, 'partial');
  assert.deepEqual(result.document.openRules.map(rule => rule.id), ['yehi-shem']);
  assert.equal(block(result, 'amida.106.0').undecided, true);
  assert.deepEqual(validatePrayerDocument(result.document), []);
});

test('2 Cheshvan: משיב הרוח already, but still ברכנו — the two seasons are independent (YY 114:1, 117:1)', () => {
  const result = mincha('2026-10-13');
  assert.deepEqual([has(result, MORID), has(result, MASHIV), has(result, BARCHENU), has(result, BARECH_ALEINU)], [false, true, true, false]);
  assert.equal(has(result, VIDUI), false, '2 Cheshvan is the last day without Vidui');
});

test('Friday 5 Cheshvan: no Vidui (YY 267:1), and "ה׳ מלך" replaces "למנצח" per the edition', () => {
  const result = mincha('2026-10-16');
  assert.equal(result.calendar.weekday, 5);
  assert.equal(has(result, VIDUI), false);
  assert.equal(has(result, 'vidui.16'), false);
  assert.equal(has(result, 'vidui.18.1'), true);
  assert.equal(has(result, 'vidui.15'), false, 'the selection caption is not shown once the selection is made');
});

test('11 Cheshvan: Israel says ברך עלינו with Vidui; New York still says ברכנו (YY 117:1, 117:4)', () => {
  const israel = mincha('2026-10-22');
  assert.equal(israel.document.status, 'adapted');
  assert.deepEqual([has(israel, MASHIV), has(israel, BARECH_ALEINU), has(israel, BARCHENU), has(israel, VIDUI)], [true, true, false, true]);
  assert.equal(has(israel, 'amida.106.0'), false, '"יהי שם" belongs only to days without Tachanun');
  const diaspora = mincha('2026-10-22', NEW_YORK, { at: '19:00', sunrise: '11:10', sunset: '22:10' });
  assert.equal(diaspora.calendar.hebrew.label, 'י״א בחשון תשפ״ז');
  assert.deepEqual([has(diaspora, MASHIV), has(diaspora, BARCHENU), has(diaspora, BARECH_ALEINU), has(diaspora, VIDUI)], [true, true, false, true]);
});

test('Rosh Chodesh (1 Cheshvan): Yaaleh Veyavo with "ראש חדש הזה" only, no festival lines, no Vidui', () => {
  const result = mincha('2026-10-12');
  assert.equal(result.calendar.facts.roshChodesh, true);
  assert.deepEqual(['amida.35', 'amida.36', 'amida.37.1', 'amida.40'].map(id => has(result, id)), [true, true, true, true]);
  assert.deepEqual(['amida.37.0', 'amida.38.1', 'amida.39.1'].map(id => has(result, id)), [false, false, false]);
  assert.equal(has(result, VIDUI), false);
  assert.equal(has(mincha('2026-10-22'), 'amida.36'), false, 'no Yaaleh Veyavo on an ordinary weekday');
});

test('erev Rosh Chodesh (29 Cheshvan) Mincha: no Vidui (YY 131:39); ordinary 14 Kislev: Vidui', () => {
  assert.equal(has(mincha('2026-11-09'), VIDUI), false);
  const ordinary = mincha('2026-11-24');
  assert.equal(has(ordinary, VIDUI), true);
  assert.equal(ordinary.document.status, 'adapted');
});

test('diaspora rain request starts at Maariv of 4 December, or 5 December before a Gregorian leap year', () => {
  const at = { at: '18:00', sunrise: '12:00', sunset: '21:30' };
  assert.equal(has(mincha('2025-12-04', NEW_YORK, at), BARCHENU), true);
  assert.equal(has(mincha('2025-12-05', NEW_YORK, at), BARECH_ALEINU), true);
  assert.equal(has(mincha('2027-12-05', NEW_YORK, at), BARCHENU), true);
  assert.equal(has(mincha('2027-12-06', NEW_YORK, at), BARECH_ALEINU), true);
});

test('outside the supported days the full edition is shown unadapted, never presented as adapted', () => {
  const chanukah = mincha('2026-12-09');
  assert.equal(chanukah.document.status, 'unsupported');
  assert.ok(chanukah.document.unsupportedReasons.includes('חנוכה'));
  assert.deepEqual([has(chanukah, MORID), has(chanukah, MASHIV), has(chanukah, 'amida.46'), has(chanukah, 'amida.4.0')], [true, true, true, true]);
  const fast = mincha('2026-09-14');
  assert.equal(fast.document.status, 'unsupported');
  assert.ok(fast.document.unsupportedReasons.includes('תענית ציבור'));
  assert.ok(fast.document.unsupportedReasons.includes('עשרת ימי תשובה'));
});

test('Purim Katan: no Al HaNissim and no Vidui; erev Pesach Sheni and Yom HaAtzmaut keep Vidui undecided', () => {
  const purimKatan = mincha('2027-02-21');
  assert.notEqual(purimKatan.document.status, 'unsupported');
  assert.equal(has(purimKatan, 'amida.46'), false);
  assert.equal(has(purimKatan, VIDUI), false);
  for (const date of ['2027-05-20', '2027-05-12']) {
    const result = mincha(date);
    assert.equal(result.rules.tachanun.status, 'unresolved', date);
    assert.equal(block(result, VIDUI).undecided, true, date);
    assert.equal(result.document.status, 'partial', date);
  }
});

test('Mincha after sunset keeps the day; Vidui only within 13.5 seasonal minutes (YY 131:19)', () => {
  const zmanim = { sunrise: '04:20', sunset: '14:37' };
  const early = mincha('2026-11-24', JERUSALEM, { ...zmanim, at: '14:42' });
  const late = mincha('2026-11-24', JERUSALEM, { ...zmanim, at: '15:07' });
  assert.equal(early.time.prayerDate, '2026-11-24');
  assert.equal(late.time.prayerDate, '2026-11-24');
  assert.equal(has(early, VIDUI), true);
  assert.equal(has(late, VIDUI), false);
  assert.equal(late.rules.tachanun.reason, 'night');
});

test('missing or stale zmanim become a question, not a guess; the answer resolves it', () => {
  const missing = mincha('2026-11-24', JERUSALEM, { times: null });
  assert.equal(missing.document.status, 'needs-input');
  assert.equal(missing.rules.tachanun.status, 'needs-input');
  assert.equal(block(missing, VIDUI).undecided, true);
  const stale = mincha('2026-11-24', JERUSALEM, { times: { sunrise: '2026-11-23T04:20:00Z', sunset: '2026-11-23T14:37:00Z' } });
  assert.equal(stale.time.sun.state, 'unknown', 'yesterday\'s sunset is not reused for today');
  const answered = mincha('2026-11-24', JERUSALEM, { times: null, answers: { sunset: 'before' } });
  assert.equal(answered.document.status, 'adapted');
  assert.equal(block(answered, VIDUI).undecided, false);
});

test('praying alone omits the parts said only with a minyan', () => {
  const minyanOnly = ['offerings.15', 'amida.7', 'amida.44.2', 'vidui.11', 'vidui.22'];
  const withMinyan = mincha('2026-11-24');
  const alone = mincha('2026-11-24', JERUSALEM, { preferences: { setting: 'individual' } });
  assert.deepEqual(minyanOnly.map(id => has(withMinyan, id)), minyanOnly.map(() => true));
  assert.deepEqual(minyanOnly.map(id => has(alone, id)), minyanOnly.map(() => false));
  assert.equal(has(alone, 'amida.8.0'), true, 'אתה קדוש stays');
});

test('session: the open prayer stays fixed across sunset; the change is reported at the Vidui section', () => {
  const zmanim = { sunrise: '2026-11-24T04:20:00Z', sunset: '2026-11-24T14:37:00Z' };
  const inputs = sessionInputs({ now: new Date('2026-11-24T14:42:00Z'), settings: JERUSALEM, times: zmanim });
  const session = createPrayerSession(inputs);
  const frozen = documentForSession(session);
  assert.ok(frozen);
  assert.equal(frozen.document.sections.find(section => section.id === 'vidui').blocks.some(item => item.sourceId === VIDUI), true);
  const fresh = composeWeekdayMincha({ now: new Date('2026-11-24T15:07:00Z'), settings: JERUSALEM, times: zmanim });
  assert.equal(firstChangedSection(frozen.document, fresh.document), 'vidui');
  assert.deepEqual(documentForSession(session).document.sections.map(section => section.blocks.length), frozen.document.sections.map(section => section.blocks.length));
  const memory = new Map();
  const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  saveSession(session, storage);
  assert.equal(loadOpenSession({ prayerDate: '2026-11-24', now: new Date('2026-11-24T15:30:00Z'), storage })?.id, session.id);
  assert.equal(loadOpenSession({ prayerDate: '2026-11-25', now: new Date('2026-11-25T12:00:00Z'), storage }), null, 'yesterday\'s prayer is not continued as today\'s');
  assert.equal(documentForSession({ ...session, rulesVersion: 'old' }), null);
  const again = createPrayerSession(sessionInputs({ now: new Date('2026-11-24T14:42:00Z'), settings: JERUSALEM, times: zmanim, preferences: { setting: 'individual' } }));
  const back = createPrayerSession(inputs);
  assert.notEqual(again.id, session.id, 'a different choice at the same instant is a new session');
  assert.notEqual(back.id, session.id, 'reopening at the same instant still yields a fresh session');
  assert.equal(documentForSession(back).document.sections.flatMap(section => section.blocks).some(item => item.sourceId === 'amida.7'), true, 'switching back to a minyan restores Kedusha');
});

test('19-year sweep: invariants hold every day and the seasonal choice matches an independent calendar oracle', () => {
  const settings = { ...JERUSALEM, location: { ...JERUSALEM.location, tzid: 'UTC' } };
  const winterGevurot = (m, d) => (m === months.TISHREI && d >= 22) || [months.CHESHVAN, months.KISLEV, months.TEVET, months.SHVAT, months.ADAR_I, months.ADAR_II].includes(m) || (m === months.NISAN && d < 15);
  const winterHashanimIsrael = (m, d) => (m === months.CHESHVAN && d >= 7) || [months.KISLEV, months.TEVET, months.SHVAT, months.ADAR_I, months.ADAR_II].includes(m) || (m === months.NISAN && d < 15);
  const start = Date.UTC(2026, 0, 1);
  let adapted = 0;
  for (let day = 0; day < 19 * 366; day += 1) {
    const date = new Date(start + day * 86400000).toISOString().slice(0, 10);
    const result = composeWeekdayMincha({ now: new Date(`${date}T12:00:00Z`), settings, times: { sunrise: `${date}T06:00:00Z`, sunset: `${date}T18:00:00Z` } });
    assert.deepEqual(validatePrayerDocument(result.document), [], date);
    if (result.document.status === 'unsupported') continue;
    adapted += 1;
    const hdate = new HDate(new Date(`${date}T12:00:00`));
    const [m, d] = [hdate.getMonth(), hdate.getDate()];
    assert.equal(has(result, MASHIV), winterGevurot(m, d), `${date} gevurot`);
    assert.equal(has(result, BARECH_ALEINU), winterHashanimIsrael(m, d), `${date} birkat hashanim`);
    if (result.document.status !== 'adapted') assert.ok(result.document.openRules.length > 0, `${date}: partial without an open rule`);
  }
  assert.ok(adapted > 3000, `adapted days: ${adapted}`);
});

function loadJsx(relativePath) {
  const source = fileURLToPath(new URL(`../src/${relativePath}`, import.meta.url));
  const compiled = buildSync({ entryPoints: [source], bundle: true, platform: 'node', format: 'cjs', write: false, loader: { '.jsx': 'jsx' }, jsx: 'automatic', define: { 'import.meta.env.BASE_URL': '"/"' }, external: ['react', 'react/jsx-runtime', 'react-dom/server'] }).outputFiles[0].text;
  const loaded = new Module(source);
  loaded.filename = source;
  loaded.paths = Module._nodeModulePaths(root);
  loaded._compile(compiled, source);
  return loaded.exports;
}

test('rendered document: prayer keeps its reading class, guidance is distinct, and no internal wording leaks', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { PrayerDocumentView } = loadJsx('components/ComposedPrayerReader.jsx');
  const html = renderToStaticMarkup(React.createElement(PrayerDocumentView, { composed: mincha('2026-09-24'), font: 25 }));
  assert.match(html, /class="reading-segment reading-prayer siddur-block-recited"/);
  assert.match(html, /class="reading-segment reading-section-heading siddur-block-heading"/);
  assert.match(html, /prayer-undecided-note/);
  assert.doesNotMatch(html, /עוגן|NOT_VERIFIED|fallback|resolver|parser|unresolved|needs-input|data-anchor/);
  const instruction = css.match(/\.reading-text\.siddur-semantic \.siddur-block-instruction\{[^}]*\}/)[0];
  assert.match(instruction, /font-size:max\(16px,/);
  assert.match(instruction, /color:var\(--ink-2\)/);
  assert.doesNotMatch(instruction, /siddur-editorial|--danger|--accent/);
});

test('legacy weekday Shacharit: standalone season captions follow the rain-request season, not משיב הרוח', () => {
  const text = normalizeText(siddurOffline.texts['Siddur Edot HaMizrach, Weekday Shacharit, Amida']);
  const paragraphs = text.hebrew.map((value, index) => ({ text: value, source: text.indexes[index] }));
  const render = seasonal => normalizeForSearch(normalizeSiddurBlocks(paragraphs, { title: 'עמידה', markup: paragraphs.map(part => text.siddurMarkup[part.source]), context: { seasonal } }).map(item => item.text).join(' '));
  const phrase = value => new RegExp(normalizeForSearch(value));
  const betweenSeasons = render({ mashivHaruch: true, vetenTalUmatar: false });
  assert.match(betweenSeasons, phrase('מַשִּׁיב הָרֽוּחַ'));
  assert.match(betweenSeasons, phrase('בָּֽרְכֵֽנוּ יְהֹוָה'));
  assert.doesNotMatch(betweenSeasons, phrase('בָּרֵךְ עָלֵינוּ'));
  const winter = render({ mashivHaruch: true, vetenTalUmatar: true });
  assert.match(winter, phrase('בָּרֵךְ עָלֵינוּ'));
  assert.doesNotMatch(winter, phrase('בָּֽרְכֵֽנוּ יְהֹוָה'));
});

test('switching מניין/יחידות keeps the reading position instead of jumping', () => {
  const { anchorAfterRecompose } = loadJsx('components/ComposedPrayerReader.jsx');
  const order = ['a.1', 'a.2', 'kedusha.1', 'kedusha.2', 'a.3'];
  const present = ids => id => ids.includes(id);
  assert.equal(anchorAfterRecompose(order, 'a.2', present(order)), 'a.2', 'same block when it survives');
  assert.equal(anchorAfterRecompose(order, 'kedusha.2', present(['a.1', 'a.2', 'a.3'])), 'a.3', 'removed block → nearest surviving block (the text that follows)');
  assert.equal(anchorAfterRecompose(order, 'kedusha.1', present(['a.1', 'a.2', 'a.3'])), 'a.2', 'removed block → nearest surviving block before it when that is closer');
  assert.equal(anchorAfterRecompose(order, 'a.1', present(['a.3'])), 'a.3', 'falls forward when nothing precedes it');
  assert.equal(anchorAfterRecompose(order, 'missing', present(order)), null);
  const reader = readFileSync(fileURLToPath(new URL('../src/components/ComposedPrayerReader.jsx', import.meta.url)), 'utf8');
  assert.match(reader, /renew\(\{ preferences: \{ setting: value \} \}, \{ stayInPlace: true \}\)/);
  assert.match(reader, /if \(keepPlace\.current\) keepPlace\.current = null;\s*else \{/, 'no automatic scrollIntoView after a practice switch');
  assert.match(reader, /useLayoutEffect\(\(\) => \{\s*const anchor = keepPlace\.current;/);
  assert.match(reader, /if \(setting === value\) return;/, 'tapping the active option does nothing');
});
