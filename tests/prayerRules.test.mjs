// Stage 4 — first rule slice over PrayerDayFacts: Tachanun, Gevurot season, Birkat HaShanim season.
// Expected values are literals derived from the cited Yalkut Yosef text, not from the code under test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { computePrayerDayFacts } from '../src/services/prayer/prayerDayFacts.mjs';
import { resolvePrayerRules, resolveTachanun, resolveGevurotSeason, resolveBirkatHashanimSeason, diasporaRainRequestStart, explainRule, SOURCE_REFS, RULE_STATUS } from '../src/services/prayer/prayerRules.mjs';
import { YALKUT_YOSEF } from '../src/data/yalkutYosef.mjs';

const JLM = { tzid: 'Asia/Jerusalem', latitude: 31.778, longitude: 35.235, source: 'manual' };
const NYC = { tzid: 'America/New_York', latitude: 40.7128, longitude: -74.006, source: 'manual' };
const SYD = { tzid: 'Australia/Sydney', latitude: -33.87, longitude: 151.21, source: 'manual' };
const IL = { location: JLM, halachicResidenceStatus: 'israel' };
const DIA = { location: NYC, halachicResidenceStatus: 'diaspora' };
const offset = tz => ({ 'Asia/Jerusalem': '+03:00', 'America/New_York': '-05:00', 'Australia/Sydney': '+10:00' }[tz]);
const noon = (date, settings) => computePrayerDayFacts({ instant: `${date}T12:00:00${offset(settings.location.tzid)}`, settings });
const evening = (date, settings) => computePrayerDayFacts({ instant: `${date}T21:30:00${offset(settings.location.tzid)}`, settings });
const BEFORE = { state: 'before', zmaniyotMinutesAfterSunset: null };
const rules = (facts, type, sun = BEFORE) => resolvePrayerRules({ facts, prayer: { type }, sun }).rules;
const tachanun = (facts, type, sun = BEFORE) => resolveTachanun({ facts, prayer: { type }, sun });

test('every rule returns the explainable envelope, frozen, with machine ids only', () => {
  const out = resolvePrayerRules({ facts: noon('2026-11-24', IL), prayer: { type: 'mincha' }, sun: BEFORE });
  assert.equal(out.factsSchemaVersion, 1);
  for (const r of Object.values(out.rules)) {
    assert.deepEqual(Object.keys(r).sort(), ['inputFacts', 'kind', 'reasonCode', 'review', 'ruleId', 'sourceRefs', 'status', 'value', 'warnings']);
    assert.ok(Object.isFrozen(r));
    assert.equal(r.review, 'not-reviewed');
    assert.ok(Object.values(RULE_STATUS).includes(r.status));
    assert.match(r.ruleId, /^[a-z.-]+$/);
    if (r.reasonCode) assert.match(r.reasonCode, /^[a-z0-9-]+$/);
  }
  assert.match(explainRule(out.rules.tachanun), /^tachanun: resolved → said \[ordinary-day\] sources=yalkut-yosef-8-7-1/);
});

test('source traceability: every citation used anywhere resolves to a real section of the bundled corpus', () => {
  const ids = new Set(YALKUT_YOSEF.sections.map(section => section.id));
  for (const [key, ref] of Object.entries(SOURCE_REFS)) {
    if (key === 'edition') continue;
    assert.equal(ref.corpus, 'yalkut-yosef-tashz');
    assert.ok(ids.has(ref.ref), `${key} → ${ref.ref} missing from corpus`);
  }
  // and the cited text really is about the topic it is cited for
  const text = id => YALKUT_YOSEF.sections.find(section => section.id === id).text;
  assert.match(text(SOURCE_REFS.yy114_1.ref), /משיב הרוח ומוריד הגשם/);
  assert.match(text(SOURCE_REFS.yy117_1.ref), /שבעה בחשון/);
  assert.match(text(SOURCE_REFS.yy117_4.ref), /יום הששים/);
  assert.match(text(SOURCE_REFS.yy131_39.ref), /במנחה שלפניו/);
  assert.match(text(SOURCE_REFS.yy267_1.ref), /ערב שבת אין אומרים וידוי/);
});

test('facts carry no rulings: the words tachanun/hallel/mashiv never appear in the facts object', () => {
  const facts = noon('2026-12-10', IL);
  assert.doesNotMatch(JSON.stringify(facts), /tachanun|hallel|mashiv|veten|yaaleh|hanissim/i);
});

// ---- Gevurot (משיב הרוח / מוריד הטל) --------------------------------------------------------
test('13 Tishrei: dew; 2 Cheshvan: rain (YY 114:1)', () => {
  assert.equal(rules(noon('2026-09-24', IL), 'shacharit')['gevurot.season'].value, 'morid-hatal');
  assert.equal(rules(noon('2026-10-13', IL), 'shacharit')['gevurot.season'].value, 'mashiv-haruach');
});

test('Shemini Atzeret: Arvit and Shacharit still dew, from Mussaf rain — service order within the day matters', () => {
  const facts = noon('2026-10-03', IL); // 22 Tishrei 5787
  assert.equal(facts.jewishDay.hebrew.day, 22);
  assert.deepEqual(['arvit', 'shacharit', 'musaf', 'mincha'].map(type => resolveGevurotSeason({ facts, prayer: { type } }).value), ['morid-hatal', 'morid-hatal', 'mashiv-haruach', 'mashiv-haruach']);
});

test('first day of Pesach: rain until Shacharit, dew from Mussaf (YY 114:4)', () => {
  const facts = noon('2027-04-22', IL); // 15 Nisan 5787
  assert.deepEqual(['arvit', 'shacharit', 'musaf', 'mincha'].map(type => resolveGevurotSeason({ facts, prayer: { type } }).value), ['mashiv-haruach', 'mashiv-haruach', 'morid-hatal', 'morid-hatal']);
  assert.equal(resolveGevurotSeason({ facts: noon('2027-04-21', IL), prayer: { type: 'mincha' } }).value, 'mashiv-haruach');
});

// ---- Birkat HaShanim (ברך עלינו / ברכנו) -----------------------------------------------------
test('Israel: request starts at Arvit of 7 Cheshvan; Mincha of 6 Cheshvan is still ברכנו (YY 117:1)', () => {
  const arvit7 = evening('2026-10-17', IL); // after sunset of 6 Cheshvan → 7 Cheshvan
  assert.equal(arvit7.jewishDay.hebrew.day, 7);
  assert.equal(resolveBirkatHashanimSeason({ facts: arvit7, prayer: { type: 'arvit' } }).value, 'barech-aleinu');
  assert.equal(resolveBirkatHashanimSeason({ facts: noon('2026-10-17', IL), prayer: { type: 'mincha' } }).value, 'barchenu');
  assert.equal(resolveBirkatHashanimSeason({ facts: noon('2026-10-18', IL), prayer: { type: 'shacharit' } }).value, 'barech-aleinu');
});

test('11 Cheshvan: Israel ברך עלינו, New York still ברכנו; 2 Cheshvan the two seasons are independent', () => {
  assert.equal(rules(noon('2026-10-22', IL), 'shacharit')['birkat-hashanim.season'].value, 'barech-aleinu');
  assert.equal(rules(noon('2026-10-22', DIA), 'shacharit')['birkat-hashanim.season'].value, 'barchenu');
  const cheshvan2 = rules(noon('2026-10-13', IL), 'shacharit');
  assert.deepEqual([cheshvan2['gevurot.season'].value, cheshvan2['birkat-hashanim.season'].value], ['mashiv-haruach', 'barchenu']);
});

test('Israel: ברך עלינו until Mincha of 14 Nisan inclusive; ברכנו from Motzaei first day (YY 117:1, 117:18)', () => {
  assert.equal(resolveBirkatHashanimSeason({ facts: noon('2027-04-21', IL), prayer: { type: 'mincha' } }).value, 'barech-aleinu');
  assert.equal(resolveBirkatHashanimSeason({ facts: evening('2027-04-22', IL), prayer: { type: 'arvit' } }).value, 'barchenu'); // 16 Nisan
  assert.equal(resolveBirkatHashanimSeason({ facts: noon('2027-04-23', IL), prayer: { type: 'shacharit' } }).value, 'barchenu');
});

test('diaspora: request starts at Arvit of 4 December, or 5 December before a Gregorian leap year (YY 117:4)', () => {
  assert.equal(diasporaRainRequestStart(2025), '2025-12-04');
  assert.equal(diasporaRainRequestStart(2027), '2027-12-05');
  assert.equal(resolveBirkatHashanimSeason({ facts: noon('2025-12-04', DIA), prayer: { type: 'mincha' } }).value, 'barchenu');
  assert.equal(resolveBirkatHashanimSeason({ facts: evening('2025-12-04', DIA), prayer: { type: 'arvit' } }).value, 'barech-aleinu');
  assert.equal(resolveBirkatHashanimSeason({ facts: noon('2025-12-05', DIA), prayer: { type: 'shacharit' } }).value, 'barech-aleinu');
  assert.equal(resolveBirkatHashanimSeason({ facts: evening('2027-12-04', DIA), prayer: { type: 'arvit' } }).value, 'barchenu');
  assert.equal(resolveBirkatHashanimSeason({ facts: noon('2027-12-05', DIA), prayer: { type: 'mincha' } }).value, 'barchenu');
  assert.equal(resolveBirkatHashanimSeason({ facts: evening('2027-12-05', DIA), prayer: { type: 'arvit' } }).value, 'barech-aleinu');
  assert.equal(resolveBirkatHashanimSeason({ facts: noon('2027-12-06', DIA), prayer: { type: 'shacharit' } }).value, 'barech-aleinu');
  assert.equal(resolveBirkatHashanimSeason({ facts: noon('2026-01-05', DIA), prayer: { type: 'shacharit' } }).value, 'barech-aleinu', 'Tevet in January stays in the request season');
});

test('diaspora transition day without a sunset boundary → needs-input, not a guess', () => {
  const facts = computePrayerDayFacts({ instant: '2025-12-04T20:00:00-05:00', settings: { location: { tzid: 'America/New_York' }, halachicResidenceStatus: 'diaspora' } });
  assert.equal(facts.dayBoundary.afterSunset, null);
  assert.equal(resolveBirkatHashanimSeason({ facts, prayer: { type: 'mincha' } }).status, 'needs-input');
  assert.equal(resolveBirkatHashanimSeason({ facts, prayer: { type: 'arvit' } }).value, 'barech-aleinu', 'Arvit is the start regardless of sunset');
});

test('regime unknown: resolved where Israel and diaspora agree, unresolved where they differ', () => {
  const unknown = { location: JLM };
  assert.equal(resolveBirkatHashanimSeason({ facts: noon('2027-01-15', unknown), prayer: { type: 'shacharit' } }).value, 'barech-aleinu');
  const differs = resolveBirkatHashanimSeason({ facts: noon('2026-11-11', unknown), prayer: { type: 'shacharit' } });
  assert.equal(differs.status, 'unresolved');
  assert.equal(differs.reasonCode, 'geo-regime-unknown');
});

test('southern hemisphere: both seasons unresolved (YY 117:20), never silently the northern rule', () => {
  const facts = noon('2027-01-15', { location: SYD, halachicResidenceStatus: 'diaspora' });
  assert.equal(resolveGevurotSeason({ facts, prayer: { type: 'shacharit' } }).status, 'unresolved');
  assert.equal(resolveBirkatHashanimSeason({ facts, prayer: { type: 'shacharit' } }).reasonCode, 'southern-hemisphere');
});

test('provisional day (no coordinates): fine far from a transition, needs-input next to one', () => {
  const noCoords = { location: { tzid: 'Asia/Jerusalem' }, halachicResidenceStatus: 'israel' };
  const ordinary = resolveGevurotSeason({ facts: computePrayerDayFacts({ instant: '2027-01-15T12:00:00+02:00', settings: noCoords }), prayer: { type: 'shacharit' } });
  assert.equal(ordinary.status, 'resolved');
  assert.ok(ordinary.warnings.includes('jewish-day-provisional'));
  const edge = resolveBirkatHashanimSeason({ facts: computePrayerDayFacts({ instant: '2026-10-18T12:00:00+03:00', settings: noCoords }), prayer: { type: 'shacharit' } });
  assert.equal(edge.status, 'needs-input');
});

// ---- Tachanun -------------------------------------------------------------------------------
test('Arvit and Mussaf never carry Tachanun (structural)', () => {
  const facts = noon('2026-11-24', IL);
  for (const type of ['arvit', 'musaf']) assert.deepEqual([tachanun(facts, type).value, tachanun(facts, type).kind], ['not-said', 'structure']);
});

test('ordinary weekday: said in Shacharit and Mincha, with the personal-exceptions warning (YY 131:1)', () => {
  const facts = noon('2026-11-24', IL); // 14 Kislev
  for (const type of ['shacharit', 'mincha']) {
    const r = tachanun(facts, type);
    assert.equal(r.value, 'said');
    assert.ok(r.warnings.includes('personal-exceptions-not-asked'));
  }
});

test('days without Vidui (YY 131:37) — both services; each reason carries its own verified citation', () => {
  const cases = [
    ['2026-09-24', 'tishrei-cheshvan'], ['2026-10-13', 'tishrei-cheshvan'], ['2026-10-12', 'tishrei-cheshvan'], ['2026-11-10', 'rosh-chodesh'], ['2026-12-09', 'chanukah'],
    ['2027-02-21', 'purim'], ['2027-03-23', 'purim'], ['2027-04-12', 'nisan'], ['2027-05-21', 'pesach-sheni'], ['2027-05-25', 'lag-baomer'],
    ['2027-06-16', 'sivan-1-12'], ['2027-08-12', 'tisha-beav'], ['2027-08-18', 'tu-beav'], ['2026-02-02', 'tu-bishvat'], ['2026-09-11', 'erev-rosh-hashana'], ['2026-09-20', 'erev-yom-kippur'],
  ];
  for (const [date, reason] of cases) {
    for (const type of ['shacharit', 'mincha']) {
      const r = tachanun(noon(date, IL), type);
      assert.equal(r.value, 'not-said', `${date} ${type}`);
      assert.equal(r.reasonCode, reason, `${date} ${type}`);
      assert.ok(r.sourceRefs.some(s => s.ref === SOURCE_REFS.yy131_37.ref), `${date} cites 131:37`);
    }
  }
  assert.ok(tachanun(noon('2027-04-12', IL), 'shacharit').sourceRefs.some(s => s.ref === SOURCE_REFS.yy429_2.ref), 'Nisan also cites 429:2');
  assert.ok(tachanun(noon('2026-09-11', IL), 'shacharit').sourceRefs.some(s => s.ref === SOURCE_REFS.yyErevRH_4.ref));
});

test('the day after: 3 Cheshvan Shacharit says Tachanun again', () => {
  assert.equal(tachanun(noon('2026-10-14', IL), 'shacharit').value, 'said');
});

test('Mincha of Erev Shabbat: not said (YY 267:1); Friday Shacharit: said', () => {
  const friday = noon('2026-10-16', IL);
  assert.equal(friday.jewishDay.weekday, 5);
  assert.equal(tachanun(friday, 'mincha').reasonCode, 'erev-shabbat');
  assert.equal(tachanun(friday, 'shacharit').value, 'said');
});

test('Mincha before a day without Vidui: not said (YY 131:39); Shacharit that day: said', () => {
  for (const [date, reason] of [['2026-11-09', 'eve-of-rosh-chodesh'], ['2025-12-14', 'eve-of-chanukah'], ['2027-05-24', 'eve-of-lag-baomer'], ['2026-02-01', 'eve-of-tu-bishvat']]) {
    assert.equal(tachanun(noon(date, IL), 'mincha').reasonCode, reason, date);
    assert.equal(tachanun(noon(date, IL), 'shacharit').value, 'said', date);
  }
  assert.ok(tachanun(noon('2026-02-01', IL), 'mincha').sourceRefs.some(s => s.ref === SOURCE_REFS.yyTuBishvat_3.ref), 'Mincha of 14 Shvat also cites the Tu BiShvat halacha');
});

test('exceptions to the eve rule: Mincha before Erev Rosh Hashanah is said (YY 131:39)', () => {
  assert.equal(tachanun(noon('2026-09-10', IL), 'mincha').value, 'said'); // 28 Elul
});

test('undecided by the source: Erev Pesach Sheni Mincha and Yom HaAtzmaut stay unresolved', () => {
  const erevPesachSheni = tachanun(noon('2027-05-20', IL), 'mincha');
  assert.equal(erevPesachSheni.status, 'unresolved');
  assert.equal(erevPesachSheni.reasonCode, 'erev-pesach-sheni-see-note');
  assert.equal(tachanun(noon('2027-05-20', IL), 'shacharit').value, 'said');
  const atzmaut = tachanun(noon('2027-05-12', IL), 'shacharit');
  assert.equal(atzmaut.status, 'unresolved');
  assert.equal(atzmaut.kind, 'minhag');
});

test('Mincha after sunset: within 13.5 seasonal minutes said, later "night"; unknown sunset asks (YY 131:19)', () => {
  const facts = noon('2026-11-24', IL);
  assert.equal(tachanun(facts, 'mincha', { state: 'after', zmaniyotMinutesAfterSunset: 5 }).value, 'said');
  assert.equal(tachanun(facts, 'mincha', { state: 'after', zmaniyotMinutesAfterSunset: 30 }).reasonCode, 'night');
  assert.equal(tachanun(facts, 'mincha', { state: 'after', zmaniyotMinutesAfterSunset: null }).status, 'unresolved');
  assert.equal(tachanun(facts, 'mincha', { state: 'unknown' }).status, 'needs-input');
  assert.equal(tachanun(facts, 'mincha', null).status, 'needs-input');
  assert.equal(tachanun(facts, 'shacharit', null).value, 'said', 'Shacharit does not depend on the sunset window');
});

test('Shabbat and Yom Tov services are outside this slice: unsupported, not asserted', () => {
  assert.equal(tachanun(noon('2026-11-07', IL), 'shacharit').status, 'unsupported');
  assert.equal(tachanun(noon('2027-04-22', IL), 'mincha').status, 'unsupported');
});

test('unresolved facts propagate: no time zone → every rule unresolved', () => {
  const facts = computePrayerDayFacts({ instant: '2026-11-24T10:00:00Z', settings: { location: {}, halachicResidenceStatus: 'israel' } });
  for (const r of Object.values(rules(facts, 'shacharit'))) assert.equal(r.status, 'unresolved');
});

test('determinism and no fake support: only the three rules of this slice are produced', () => {
  const a = resolvePrayerRules({ facts: noon('2026-12-10', IL), prayer: { type: 'mincha' }, sun: BEFORE });
  const b = resolvePrayerRules({ facts: noon('2026-12-10', IL), prayer: { type: 'mincha' }, sun: BEFORE });
  assert.deepEqual(a, b);
  assert.deepEqual(Object.keys(a.rules).sort(), ['birkat-hashanim.season', 'gevurot.season', 'tachanun']);
});

test('two-year sweep: every result is a valid envelope, seasons are contiguous, and the two seasons flip in the right order', () => {
  for (const settings of [IL, DIA]) {
    let previous = null;
    let gevurotFlips = 0;
    let hashanimFlips = 0;
    for (let t = Date.UTC(2025, 9, 1); t <= Date.UTC(2027, 9, 10); t += 864e5) {
      const date = new Date(t).toISOString().slice(0, 10);
      const out = rules(noon(date, settings), 'shacharit');
      for (const r of Object.values(out)) assert.ok(Object.values(RULE_STATUS).includes(r.status), `${date} ${r.ruleId}`);
      const g = out['gevurot.season'].value;
      const h = out['birkat-hashanim.season'].value;
      assert.ok(g && h, `${date} seasons resolved`);
      if (previous && previous.g !== g) gevurotFlips += 1;
      if (previous && previous.h !== h) hashanimFlips += 1;
      // Rain is never requested while dew is being mentioned.
      if (h === 'barech-aleinu') assert.equal(g, 'mashiv-haruach', `${date} rain request without rain mention`);
      previous = { g, h };
    }
    assert.equal(gevurotFlips, 4, `${settings.halachicResidenceStatus}: two winters in two years`);
    assert.equal(hashanimFlips, 4, `${settings.halachicResidenceStatus}: two request seasons in two years`);
  }
});
