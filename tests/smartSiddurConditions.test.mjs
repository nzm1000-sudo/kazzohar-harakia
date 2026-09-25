import test from 'node:test';
import assert from 'node:assert/strict';
import { JewishContextEngine } from '../src/services/jewishContextEngine.mjs';
import { buildSiddurConditionSummary, shouldDisplaySiddurSection } from '../src/services/siddurConditionEngine.mjs';
import { prayerTypeFromFlowKey, resolvePrayerConditions } from '../src/services/prayerConditions.mjs';

const settings = (status = 'israel') => ({
  nusach: 'edot-hamizrach',
  halachicResidenceStatus: status,
  location: { name: 'ירושלים', tzid: 'Asia/Jerusalem', latitude: 31.778, longitude: 35.235 },
});
const ctx = (iso, sunsetIso, prayerType, status = 'israel') => JewishContextEngine({
  now: new Date(iso),
  settings: settings(status),
  times: { sunset: sunsetIso },
  prayerType,
});
const ids = list => list.map(item => item.id);

test('prayerTypeFromFlowKey reads the prayer from a Siddur root key', () => {
  assert.equal(prayerTypeFromFlowKey('Weekday Mincha'), 'mincha');
  assert.equal(prayerTypeFromFlowKey('Shabbat Shacharit'), 'shacharit');
  assert.equal(prayerTypeFromFlowKey('Weekday Arvit'), 'maariv');
  assert.equal(prayerTypeFromFlowKey('Shabbat Mussaf'), 'mussaf');
  assert.equal(prayerTypeFromFlowKey('Hallel'), null);
});

test('REGRESSION 24.9.2026 Mincha: no Vidui, no Aseret Yemei Teshuvah note, no leftover holiday content', () => {
  // 24.9.2026 daytime is 13 Tishrei; after sunset it becomes 14 Tishrei (Erev Sukkot) —
  // both are well after Yom Kippur (10 Tishrei), so nothing from the Ten Days applies.
  const beforeSunset = ctx('2026-09-24T11:00:00Z', '2026-09-24T15:55:00Z', 'mincha');
  const afterSunset = ctx('2026-09-24T16:05:00Z', '2026-09-24T15:55:00Z', 'mincha');
  for (const context of [beforeSunset, afterSunset]) {
    assert.equal(context.isAseretYemeiTeshuvah, false, 'Aseret Yemei Teshuvah must be over by 13-14 Tishrei');
    assert.equal(context.additions.some(item => item.kind === 'vidui'), false, 'the engine adds Vidui only for Erev Yom Kippur Mincha (9 Tishrei)');
    const summary = buildSiddurConditionSummary(context);
    assert.equal(summary.hasVidui, false);
    assert.equal(shouldDisplaySiddurSection('Vidui', summary), false, 'the Vidui TOC entry must stay hidden on an ordinary Mincha');
    const conditions = resolvePrayerConditions(context, 'mincha');
    assert.deepEqual(conditions.inserts, [], 'no insertions apply to this Mincha');
    assert.deepEqual(conditions.omissions.filter(item => item.id !== 'tachanun'), [], 'only the routine Tachanun note (if any) may appear');
    assert.equal(conditions.notes.some(item => item.id === 'aseret-yemei-teshuvah'), false);
    assert.equal(conditions.notes.some(item => item.id === 'hallel'), false, 'Hallel is not a Mincha concern');
  }
});

test('Erev Yom Kippur Mincha (9 Tishrei) is the one real day Vidui belongs in the TOC and the reader panel', () => {
  const context = ctx('2026-09-20T12:00:00Z', '2026-09-20T15:20:00Z', 'mincha');
  assert.equal(context.specialDay?.desc, 'Erev Yom Kippur');
  const summary = buildSiddurConditionSummary(context);
  assert.equal(summary.hasVidui, true);
  assert.equal(shouldDisplaySiddurSection('Vidui', summary), true);
  const conditions = resolvePrayerConditions(context, 'mincha');
  assert.ok(ids(conditions.inserts).includes('vidui'));
});

test('the same Erev Yom Kippur day does not show Vidui when opening Shacharit (the rule is Mincha-specific)', () => {
  const context = ctx('2026-09-20T05:00:00Z', '2026-09-20T15:20:00Z', 'shacharit');
  const conditions = resolvePrayerConditions(context, 'shacharit');
  assert.equal(ids(conditions.inserts).includes('vidui'), false);
});

test('ordinary weekday Shacharit/Mincha/Arvit (dry season, no rain/dew insertions) carry no insertions, omissions, or notes', () => {
  for (const prayerType of ['shacharit', 'mincha', 'maariv']) {
    const context = ctx('2026-07-13T08:00:00Z', '2026-07-13T17:00:00Z', prayerType);
    const conditions = resolvePrayerConditions(context, prayerType);
    assert.deepEqual(conditions.inserts, []);
    assert.deepEqual(conditions.omissions, []);
    assert.deepEqual(conditions.notes, []);
    assert.deepEqual(conditions.review, []);
  }
});

test('Rosh Chodesh: Yaaleh Veyavo visible in every tefillah, half Hallel note only for Shacharit', () => {
  for (const prayerType of ['shacharit', 'mincha', 'maariv']) {
    const context = ctx('2026-02-18T08:00:00Z', '2026-02-18T17:00:00Z', prayerType);
    const conditions = resolvePrayerConditions(context, prayerType);
    assert.ok(ids(conditions.inserts).includes('yaaleh-veyavo'), `${prayerType} should include Yaaleh Veyavo`);
    const summary = buildSiddurConditionSummary(context);
    assert.equal(shouldDisplaySiddurSection('Yaaleh Veyavo', summary), true);
    if (prayerType === 'shacharit') assert.ok(conditions.notes.some(item => item.id === 'hallel' && item.text === 'חצי הלל'));
    else assert.equal(conditions.notes.some(item => item.id === 'hallel'), false, `${prayerType} must not carry the Hallel note`);
  }
});

test('Chanukah: Al Hanissim visible, Hallel note only for Shacharit, irrelevant sections stay hidden', () => {
  const shacharit = ctx('2026-12-06T05:00:00Z', '2026-12-06T16:30:00Z', 'shacharit');
  const mincha = ctx('2026-12-06T12:00:00Z', '2026-12-06T16:30:00Z', 'mincha');
  assert.ok(ids(resolvePrayerConditions(shacharit, 'shacharit').inserts).includes('al-hanissim'));
  assert.ok(resolvePrayerConditions(shacharit, 'shacharit').notes.some(item => item.id === 'hallel' && item.text === 'הלל שלם'));
  const minchaConditions = resolvePrayerConditions(mincha, 'mincha');
  assert.ok(ids(minchaConditions.inserts).includes('al-hanissim'));
  assert.equal(minchaConditions.notes.some(item => item.id === 'hallel'), false);
  assert.equal(ids(minchaConditions.inserts).includes('yaaleh-veyavo'), false, 'Chanukah is not Rosh Chodesh');
});

test('Purim: Al Hanissim visible, no Hallel (Hallel is not said on Purim)', () => {
  const context = ctx('2026-03-03T08:00:00Z', '2026-03-03T17:30:00Z', 'shacharit');
  const conditions = resolvePrayerConditions(context, 'shacharit');
  assert.ok(ids(conditions.inserts).includes('al-hanissim'));
  assert.equal(conditions.notes.some(item => item.id === 'hallel'), false);
});

test('fast day: Tachanun still applies (not omitted), while unresolved Aneinu remains a separate review item', () => {
  const context = ctx('2026-03-02T08:00:00Z', '2026-03-02T17:30:00Z', 'mincha');
  assert.equal(context.fast, true);
  const conditions = resolvePrayerConditions(context, 'mincha');
  assert.equal(conditions.omissions.some(item => item.id === 'tachanun'), false, 'Tachanun is said on an ordinary fast day');
  assert.equal(conditions.inserts.some(item => item.id === 'aneinu'), false, 'Aneinu must never be invented as a confirmed insertion');
  assert.deepEqual(conditions.review, [{ id: 'aneinu', text: 'עננו בתענית' }]);
});

test('Aseret Yemei Teshuvah (2 Tishrei, ordinary weekday inside the Ten Days): the note appears for every Amida prayer', () => {
  const context = ctx('2026-09-13T08:00:00Z', '2026-09-13T17:45:00Z', 'shacharit');
  assert.equal(context.isAseretYemeiTeshuvah, true);
  for (const prayerType of ['shacharit', 'mincha', 'maariv']) {
    const conditions = resolvePrayerConditions(context, prayerType);
    assert.ok(conditions.notes.some(item => item.id === 'aseret-yemei-teshuvah'), `${prayerType} should carry the note`);
  }
});

test('Sukkot (15 Tishrei): full Hallel note for Shacharit, Mussaf note when opening Mussaf', () => {
  const shacharit = ctx('2026-09-26T05:00:00Z', '2026-09-26T18:00:00Z', 'shacharit');
  const conditions = resolvePrayerConditions(shacharit, 'shacharit');
  assert.ok(conditions.notes.some(item => item.id === 'hallel' && item.text === 'הלל שלם'));
  const mussaf = resolvePrayerConditions(shacharit, 'mussaf');
  assert.ok(mussaf.notes.some(item => item.id === 'mussaf'));
});

test('Chol HaMoed Sukkot: still full Hallel, and the TOC section is shown via isCholHaMoed', () => {
  const context = ctx('2026-09-28T08:00:00Z', '2026-09-28T18:00:00Z', 'shacharit');
  assert.equal(context.isCholHaMoed, true);
  const summary = buildSiddurConditionSummary(context);
  assert.equal(shouldDisplaySiddurSection('Hallel', summary), true);
  assert.equal(shouldDisplaySiddurSection('Chol HaMoed', summary), true);
});

test('Pesach (15 Nisan): full Hallel; Chol HaMoed Pesach (17 Nisan): half Hallel', () => {
  const first = ctx('2026-04-02T05:00:00Z', '2026-04-02T18:20:00Z', 'shacharit');
  assert.ok(resolvePrayerConditions(first, 'shacharit').notes.some(item => item.id === 'hallel' && item.text === 'הלל שלם'));
  const cholHaMoed = ctx('2026-04-04T05:00:00Z', '2026-04-04T18:20:00Z', 'shacharit');
  assert.equal(cholHaMoed.isCholHaMoed, true);
  assert.ok(resolvePrayerConditions(cholHaMoed, 'shacharit').notes.some(item => item.id === 'hallel' && item.text === 'חצי הלל'));
});

test('seasonal rain/dew transition surfaces as an insertion, and differs by Israel vs diaspora', () => {
  const israelWinter = ctx('2026-11-01T08:00:00Z', '2026-11-01T17:00:00Z', 'shacharit', 'israel');
  const diasporaEarly = ctx('2026-11-01T08:00:00Z', '2026-11-01T17:00:00Z', 'shacharit', 'diaspora');
  assert.ok(ids(resolvePrayerConditions(israelWinter, 'shacharit').inserts).includes('veten-tal-umatar'));
  assert.equal(ids(resolvePrayerConditions(diasporaEarly, 'shacharit').inserts).includes('veten-tal-umatar'), false);
});

test('before/after sunset boundary flips the Jewish day and therefore the resolved conditions', () => {
  const before = ctx('2026-09-20T12:00:00Z', '2026-09-20T15:20:00Z', 'mincha');
  const after = ctx('2026-09-20T18:30:00Z', '2026-09-20T15:20:00Z', 'mincha');
  assert.equal(before.hebrewDate.label, 'ט׳ בתשרי תשפ״ז');
  assert.equal(after.hebrewDate.label, 'י׳ בתשרי תשפ״ז');
  assert.ok(ids(resolvePrayerConditions(before, 'mincha').inserts).includes('vidui'));
});
