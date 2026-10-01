// המזכיר היהודי and the round of 2026-10-01: the new reminders' timing (Chanukah, bedtime Shema, Tikkun Chatzot,
// Birkot HaShachar, learning, Shnayim Mikra by aliya, tzedakah, Birkat HaIlanot, Birkat HaLevana), never on Shabbat or
// Yom Tov, the shared budget, the deep links and the Siddur texts; the preparations' Shnayim Mikra link and sunset; the
// dvar Torah excerpts (exact, attributed); the gematria letter-swap type.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { HDate, Molad, months } from '@hebcal/core';
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/services.mjs';
import { alarmContext, anchorOn, candleLightingOn, civilKeyOf, havdalahOn, restWindowAt, weekdayOf } from '../src/services/jewishAlarm/engine.mjs';
import { computeZmanim } from '../src/services/zmanimLocal.mjs';
import { shiftCivilDate } from '../src/civilDate.mjs';
import { normalizeSmart, smartOn } from '../src/services/reminders/smart.mjs';
import { planReminders, smartReminders } from '../src/services/reminders/plan.mjs';
import { parseDeepLink, PRAYER_TARGETS } from '../src/services/reminders/deepLinks.mjs';
import { MAZKIR_KINDS, MAZKIR_ORDER, chatzotOfEvening, ilanotDays, levanaReminders, levanaWindow, mazkirOn, normalizeMazkir } from '../src/services/reminders/mazkir.mjs';
import { SIDDUR_TEXT_AVAILABILITY, siddurTargetItem } from '../src/services/reminders/siddurTargets.mjs';
import { ALIYA_NAMES, aliyaStartId, aliyotForWeekday, parashaOfWeek } from '../src/services/weeklyParasha.mjs';
import { TORAH_ALIYOT } from '../src/data/torahAliyot.mjs';
import { SHNAYIM_MIKRA_CANONICAL_RANGES } from '../src/data/shnayimMikraRanges.mjs';
import { shabbatPreparation } from '../src/services/preparationPlan.mjs';
import { DVAR_TORAH_EXCERPTS } from '../src/data/dvarTorahExcerpts.mjs';
import COMMENTARY from '../src/data/library/corpus/tanakhCommentary.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const ctx = alarmContext(normalizeSettings(DEFAULT_SETTINGS));
const diaspora = alarmContext(normalizeSettings({ ...DEFAULT_SETTINGS, halachicResidenceStatus: 'diaspora', location: { name: 'New York', latitude: 40.7128, longitude: -74.006, tzid: 'America/New_York', il: false } }));
const on = (kind, extra = {}) => ({ ...normalizeMazkir({})[kind], enabled: true, ...extra });
const MIN = 60000;

test('the new kinds: off by default, cleaned on load, kept beside the four of the day', () => {
  const smart = normalizeSmart({ bedtime: { enabled: true, time: '23:15' }, learning: { enabled: true, tracks: ['nonsense', 'mishna-yomit'] }, chanukah: { minutesBefore: 7 } });
  for (const kind of MAZKIR_ORDER) assert.ok(smart[kind], kind);
  assert.equal(smart.bedtime.enabled, true);
  assert.equal(smart.bedtime.time, '23:15');
  assert.deepEqual(smart.learning.tracks, ['mishna-yomit']);
  assert.equal(smart.chanukah.minutesBefore, MAZKIR_KINDS.chanukah.defaults.minutesBefore, 'an unknown option falls back');
  assert.ok(MAZKIR_ORDER.every(kind => normalizeSmart({})[kind].enabled === false), 'every new reminder starts off');
  assert.equal(normalizeSmart({}).omer.enabled, false);
});

test('Chanukah 5787: weekday nights at the verified time, Friday before the Shabbat candles (not before plag), Motzaei Shabbat after havdalah', () => {
  // Chanukah 5787: the first light on Friday 2026-12-04, the eighth on Friday 2026-12-11.
  const friday = mazkirOn('chanukah', on('chanukah'), '2026-12-04', ctx);
  const candles = candleLightingOn(ctx, '2026-12-04');
  const plag = anchorOn('plagHaMincha', '2026-12-04', ctx).at;
  assert.equal(friday.night, 1);
  assert.equal(friday.at.getTime(), Math.max(candles.getTime() - 30 * MIN, plag.getTime()));
  assert.ok(friday.at < candles && !restWindowAt(friday.at, ctx));
  const motzash = mazkirOn('chanukah', on('chanukah'), '2026-12-05', ctx);
  assert.equal(motzash.night, 2);
  assert.equal(motzash.at.getTime(), havdalahOn(ctx, '2026-12-05').getTime());
  assert.match(motzash.body, /אחרי ההבדלה/);
  const sunday = mazkirOn('chanukah', on('chanukah', { minutesBefore: 10 }), '2026-12-06', ctx);
  const sunset = anchorOn('sunset', '2026-12-06', ctx).at;
  assert.equal(sunday.night, 3);
  assert.equal(sunday.anchorTime.getTime(), sunset.getTime() + 15 * MIN, 'בצאת הכוכבים — a quarter of an hour after sunset');
  assert.equal(sunday.at.getTime(), sunday.anchorTime.getTime() - 10 * MIN);
  assert.equal(mazkirOn('chanukah', on('chanukah'), '2026-12-12', ctx), null, 'after the eighth night');
  assert.equal(mazkirOn('chanukah', on('chanukah'), '2026-12-03', ctx), null, 'before the first');
  assert.equal(sunday.route, 'prayer/chanukah');
});

test('Shema at bedtime: the chosen time, never before nightfall, never on Shabbat or Yom Tov', () => {
  const wed = mazkirOn('bedtime', on('bedtime', { time: '22:30' }), '2026-10-07', ctx);
  assert.equal(civilKeyOf(wed.at.getTime(), ctx.tz), '2026-10-07');
  const early = mazkirOn('bedtime', on('bedtime', { time: '17:00' }), '2026-10-07', ctx);
  assert.equal(early.at.getTime(), anchorOn('tzeit85deg', '2026-10-07', ctx).at.getTime());
  const late = mazkirOn('bedtime', on('bedtime', { time: '00:30' }), '2026-10-07', ctx);
  assert.equal(civilKeyOf(late.at.getTime(), ctx.tz), '2026-10-08', 'after midnight belongs to the same night');
  assert.equal(mazkirOn('bedtime', on('bedtime'), '2026-10-09', ctx), null, 'Friday night');
});

test('Tikkun Chatzot: at midnight of the night, none on the nights of Shabbat and Yom Tov', () => {
  const chatzot = chatzotOfEvening('2026-10-07', ctx);
  const sunset = anchorOn('sunset', '2026-10-07', ctx).at;
  const sunrise = anchorOn('sunrise', '2026-10-08', ctx).at;
  assert.ok(chatzot > sunset && chatzot < sunrise);
  assert.ok(Math.abs(chatzot.getTime() - (sunset.getTime() + sunrise.getTime()) / 2) < 2 * MIN, 'the middle of the night');
  assert.equal(mazkirOn('tikkun', on('tikkun'), '2026-10-07', ctx).at.getTime(), chatzot.getTime());
  assert.equal(mazkirOn('tikkun', on('tikkun'), '2026-10-09', ctx), null, 'Friday night (Shabbat)');
  assert.ok(mazkirOn('tikkun', on('tikkun'), '2026-10-10', ctx), 'Motzaei Shabbat is a weekday night');
  assert.equal(mazkirOn('tikkun', on('tikkun'), '2027-04-21', ctx), null, 'the first night of Pesach 5787');
  assert.equal(mazkirOn('tikkun', on('tikkun'), '2027-06-10', ctx), null, 'the night of Shavuot');
  assert.match(MAZKIR_KINDS.tikkun.rule, /תיקון לאה/);
});

test('Birkot HaShachar: at sunrise (+offset) or a fixed time never before dawn', () => {
  const sunrise = anchorOn('sunrise', '2026-10-07', ctx).at;
  assert.equal(mazkirOn('shachar', on('shachar', { offsetMinutes: 15 }), '2026-10-07', ctx).at.getTime(), sunrise.getTime() + 15 * MIN);
  const dawn = anchorOn('alotHaShachar', '2026-10-07', ctx).at;
  assert.equal(mazkirOn('shachar', on('shachar', { mode: 'time', time: '03:00' }), '2026-10-07', ctx).at.getTime(), dawn.getTime());
  assert.equal(mazkirOn('shachar', on('shachar'), '2026-10-10', ctx), null, 'Shabbat morning');
});

test('Shnayim Mikra: Sunday the first aliya … Friday the sixth and seventh, never on Shabbat; the parasha of the week', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(aliyotForWeekday), [[1], [2], [3], [4], [5], [6, 7], []]);
  assert.equal(ALIYA_NAMES[7], 'שביעי');
  // The week of Shabbat Bereshit 5787 (2026-10-10) in Israel; the week before is Shemini Atzeret — it already prepares Bereshit.
  assert.equal(parashaOfWeek('2026-10-05', true).id, 'bereshit');
  assert.equal(parashaOfWeek('2026-09-29', true).id, 'bereshit');
  assert.equal(parashaOfWeek('2026-10-12', true).id, 'noach');
  const keys = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'];
  const items = keys.map(key => mazkirOn('shnayim', on('shnayim', { time: '20:30' }), key, ctx));
  assert.deepEqual(items.map(item => item?.aliyot || null), [[1], [2], [3], [4], [5], [6, 7], null]);
  assert.equal(items[2].route, 'shnayim-mikra/bereshit/3');
  assert.match(items[5].body, /שישי ושביעי/);
  assert.match(items[0].body, /פרשת בראשית/);
  const candles = candleLightingOn(ctx, '2026-10-09');
  assert.ok(items[5].at.getTime() <= candles.getTime() - 120 * MIN, 'Friday: two hours before candles at the latest');
  assert.equal(aliyaStartId('bereshit', 3), 'Genesis.2.20');
  assert.ok(parseDeepLink(items[2].route));
});

test('the aliyot table covers every reading, contiguous, from its first verse to its last', () => {
  for (const reading of SHNAYIM_MIKRA_CANONICAL_RANGES) {
    const aliyot = TORAH_ALIYOT[reading.id];
    assert.equal(aliyot?.length, 7, reading.id);
    const [, range] = reading.reference.split(' ');
    const [from, to] = range.split('-');
    assert.equal(aliyot[0][0], from, `${reading.id} begins`);
    assert.equal(aliyot[6][1], to.includes(':') ? to : `${from.split(':')[0]}:${to}`, `${reading.id} ends`);
    const value = ref => { const [c, v] = ref.split(':').map(Number); return c * 1000 + v; };
    for (let i = 1; i < 7; i += 1) assert.ok(value(aliyot[i][0]) > value(aliyot[i - 1][1]) - 1, `${reading.id} aliya ${i + 1} follows`);
  }
});

test('daily tzedakah: weekdays only, Friday before Shabbat, never on Shabbat or Yom Tov (a whole year)', () => {
  let count = 0;
  for (let key = '2026-10-01'; key < '2027-10-01'; key = shiftCivilDate(key, 1)) {
    const item = mazkirOn('tzedaka', on('tzedaka', { time: '15:30' }), key, ctx);
    if (weekdayOf(key) === 6) assert.equal(item, null);
    if (!item) continue;
    count += 1;
    assert.equal(restWindowAt(item.at, ctx), null, key);
    if (weekdayOf(key) === 5) assert.ok(item.at.getTime() <= candleLightingOn(ctx, key).getTime() - 120 * MIN, key);
  }
  assert.ok(count > 280 && count < 313, `weekdays without Yom Tov: ${count}`);
});

test('Birkat HaIlanot: the first weekday of Nisan and 17 Nisan (or the next weekday), never Shabbat or Yom Tov', () => {
  for (const hyear of [5787, 5788, 5789, 5790]) {
    const days = ilanotDays(hyear, ctx);
    assert.equal(days.length, 2, String(hyear));
    for (const day of days) {
      const hd = new HDate(new Date(`${day.key}T12:00:00`));
      assert.equal(hd.getMonth(), months.NISAN);
      assert.notEqual(weekdayOf(day.key), 6);
      assert.equal(restWindowAt(day.at, ctx), null);
    }
    const first = new HDate(new Date(`${days[0].key}T12:00:00`)).getDate();
    assert.ok(first <= 2, `the first weekday of Nisan ${hyear}`);
    assert.ok(new HDate(new Date(`${days[1].key}T12:00:00`)).getDate() >= 17);
  }
  const key = ilanotDays(5787, ctx)[0].key;
  assert.ok(mazkirOn('ilanot', on('ilanot'), key, ctx));
  assert.equal(mazkirOn('ilanot', on('ilanot'), shiftCivilDate(key, 40), ctx), null);
});

test('Birkat HaLevana: from 7 days after the molad until half the month (14d 18h 22m), at night, never on Shabbat', () => {
  const window = levanaWindow(5787, months.CHESHVAN);
  assert.equal(window.start - window.molad, 7 * 24 * 60 * MIN);
  const half = window.end - window.molad;
  assert.ok(Math.abs(half - ((14 * 24 + 18) * 60 + 22) * MIN) < MIN, 'שו״ע או״ח תכו, ג');
  for (let m = 0; m < 13; m += 1) {
    const hd = new HDate(1, months.TISHREI, 5787);
    const month = new HDate(hd.abs() + m * 29.6).getMonth();
    const year = new HDate(hd.abs() + m * 29.6).getFullYear();
    const list = levanaReminders(year, month, ctx);
    assert.ok(list.length >= 1 && list.length <= 3, `${year}-${month}`);
    for (const item of list) {
      assert.ok(item.at >= item.window.start && item.at.getTime() <= item.window.end.getTime() - 30 * MIN, `${year}-${month} ${item.slot}`);
      assert.equal(restWindowAt(item.at, ctx), null);
      assert.ok(item.at >= anchorOn('tzeit85deg', item.key, ctx).at, 'at night');
    }
    assert.equal(list[0].slot, 'first');
    const motzash = list.find(item => item.slot === 'motzash');
    if (motzash) assert.equal(weekdayOf(motzash.key), 6);
  }
  // Av: only after Tisha B'Av; Tishrei: only after Yom Kippur.
  const av = levanaReminders(5787, months.AV, ctx);
  const fastEnd = anchorOn('fast-end', civilKeyOf(new HDate(9, months.AV, 5787).greg().getTime(), ctx.tz), ctx)?.at || anchorOn('fast-end', civilKeyOf(new HDate(10, months.AV, 5787).greg().getTime(), ctx.tz), ctx).at;
  assert.ok(av.every(item => item.at >= fastEnd));
  const tishrei = levanaReminders(5788, months.TISHREI, ctx);
  const yk = havdalahOn(ctx, civilKeyOf(new HDate(10, months.TISHREI, 5788).greg().getTime() + 12 * 3600000, ctx.tz));
  assert.ok(tishrei.every(item => item.at >= yk));
  assert.ok(new Molad(5787, months.CHESHVAN).getTchilasZmanKidushLevana7Days());
});

test('a whole year with every reminder on: nothing ever falls on Shabbat or Yom Tov (Israel and the Diaspora)', () => {
  const smart = Object.fromEntries(Object.entries(normalizeSmart({})).map(([kind, value]) => [kind, { ...value, enabled: true }]));
  for (const context of [ctx, diaspora]) {
    const items = smartReminders(smart, context, { now: new Date('2026-10-01T00:00:00Z'), days: 366 });
    assert.ok(items.length > 2000);
    const bad = items.filter(item => restWindowAt(item.at, context));
    assert.deepEqual(bad.map(item => `${item.kind} ${item.at.toISOString()}`), []);
    for (const kind of MAZKIR_ORDER) assert.ok(items.some(item => item.kind === kind), `${kind} occurs in a year`);
  }
});

test('the budget: rolling, nearest first, and the rare reminders reserved', () => {
  const smart = Object.fromEntries(Object.entries(normalizeSmart({})).map(([kind, value]) => [kind, { ...value, enabled: true }]));
  // 2026-10-17: Birkat HaLevana of Cheshvan begins the next night — reserved although the daily ones fill the budget.
  const plan = planReminders({ smart, events: [] }, ctx, { now: new Date('2026-10-14T08:00:00Z'), budget: 18 });
  assert.equal(plan.length, 18);
  assert.ok(plan.some(item => item.key.startsWith('rem:smart:levana:')), 'levana reserved');
  const times = plan.map(item => item.at);
  assert.deepEqual([...times].sort(), times, 'nearest first');
  assert.equal(new Set(plan.map(item => item.key)).size, 18);
  assert.equal(planReminders({ smart, events: [] }, ctx, { budget: 0 }).length, 0);
});

test('deep links: every target is whitelisted, nothing else opens', () => {
  for (const target of ['chanukah', 'bedtime-shema', 'tikkun-chatzot', 'birkot-hashachar', 'levana', 'ilanot']) {
    assert.ok(PRAYER_TARGETS.includes(target));
    assert.deepEqual(parseDeepLink(`prayer/${target}`), { kind: 'prayer', prayer: target });
  }
  for (const kind of MAZKIR_ORDER) assert.ok(parseDeepLink(MAZKIR_KINDS[kind].route), kind);
  for (const route of ['shnayim-mikra/bereshit/3', 'learning/daf-yomi', 'personal-tools/mazkir/k/tzedaka', 'personal-tools/mazkir/e/ev-1']) assert.deepEqual(parseDeepLink(route), { kind: 'route', route });
  for (const bad of ['prayer/levana2', 'https://example.com', 'learning/../x', 'personal-tools/verse']) assert.equal(parseDeepLink(bad), null, bad);
  // The Siddur opens them (BooksPage), and the app passes in-app requests through the same validation.
  assert.match(read('../src/pages/BooksPage.jsx'), /siddurTargetItem\(autoOpenPrayer/);
  assert.match(read('../src/NewApp.jsx'), /parseDeepLink\(event\?\.detail\)/);
});

test('the Siddur texts: each target found exactly in the rites the hub says have it', async () => {
  const { siddurLayout } = await import('../src/data/nusach/siddurLayouts.mjs');
  const { siddurRoots } = await import('../src/services/siddurIndex.mjs');
  const trees = { 'edot-hamizrach': '../src/data/siddurOffline.mjs', sefard: '../src/data/nusach/siddurSefard.mjs', ashkenaz: '../src/data/nusach/siddurAshkenaz.mjs', chabad: '../src/data/nusach/siddurChabad.mjs' };
  for (const [nusach, path] of Object.entries(trees)) {
    const tree = (await import(path)).default;
    const items = siddurRoots(tree.schema.nodes, 'X', siddurLayout(nusach), () => true).flatMap(root => root.items);
    for (const [target, rites] of Object.entries(SIDDUR_TEXT_AVAILABILITY)) {
      assert.equal(Boolean(siddurTargetItem(target, items)), rites.includes(nusach), `${target} in ${nusach}`);
    }
  }
});

test('preparations: Shnayim Mikra opens the reader of the week (not "הפרשה שלי"); דבר תורה opens its own view', () => {
  const hub = read('../src/pages/PreparationHub.jsx');
  const spiritual = hub.slice(hub.indexOf('function SpiritualPreparation'), hub.indexOf('function DvarTorahForShabbat'));
  assert.doesNotMatch(spiritual, /personal-tools\/parasha/);
  assert.match(spiritual, /`shnayim-mikra\/\$\{parasha\.id\}`/);
  assert.match(spiritual, /'preparation\/dvar-torah'/);
  assert.match(hub, /section === 'dvar-torah'/);
});

test('preparations: Friday sunset comes from the app zmanim (the calendar has none) — default and chosen location', () => {
  const items = JSON.parse(read('./fixtures/hebcalCalendarJerusalem.json')).items || JSON.parse(read('./fixtures/hebcalCalendarJerusalem.json'));
  const list = Array.isArray(items) ? items : [];
  assert.ok(!list.some(item => item.category === 'sunset'), 'the Hebcal calendar has no sunset item');
  const now = new Date('2026-10-07T09:00:00Z');
  assert.equal(shabbatPreparation({ now, tz: 'Asia/Jerusalem', items: list }).sunset, null, 'the bug: no sunset without the zmanim');
  for (const settings of [normalizeSettings(DEFAULT_SETTINGS), normalizeSettings({ ...DEFAULT_SETTINGS, location: { name: 'Haifa', latitude: 32.794, longitude: 34.9896, tzid: 'Asia/Jerusalem', il: true } })]) {
    const plan = shabbatPreparation({ now, tz: settings.location.tzid, items: list, location: settings.location });
    assert.equal(plan.dateKey, '2026-10-10');
    assert.equal(plan.sunset, computeZmanim('2026-10-09', settings.location).sunset);
    assert.equal(civilKeyOf(new Date(plan.sunset).getTime(), settings.location.tzid), '2026-10-09');
  }
  assert.match(read('../src/pages/PreparationHub.jsx'), /shabbatPreparation\(\{ now, tz, items, location: settings\?\.location \}\)/);
});

test('דבר תורה: every excerpt is the exact beginning of a bundled public-domain comment, attributed to its commentator', () => {
  const pack = COMMENTARY.packs.find(item => item.packId === 'sefaria-tanakh-commentary-public-domain');
  const works = new Map(pack.works.map(work => [work.workId, work]));
  const cache = new Map();
  const units = workId => {
    if (!cache.has(workId)) {
      const json = JSON.parse(gunzipSync(readFileSync(new URL(`../public/library/packs/${pack.packId}/${workId}.json.gz`, import.meta.url))).toString('utf8'));
      cache.set(workId, new Map(json.nodes.flatMap(node => node.units.map(unit => [unit.id, { ...unit, chapter: node.n }]))));
    }
    return cache.get(workId);
  };
  let count = 0;
  for (const reading of SHNAYIM_MIKRA_CANONICAL_RANGES.filter(item => !item.combined)) {
    const list = DVAR_TORAH_EXCERPTS[reading.id];
    assert.ok(list?.length >= 4, `${reading.id} has excerpts`);
    assert.equal(new Set(list.map(item => item.commentator)).size, list.length, `${reading.id}: each commentator once`);
    for (const item of list) {
      const work = works.get(item.workId);
      assert.ok(work && work.license === 'public-domain', item.workId);
      assert.equal(item.commentator, work.layerTitle);
      assert.equal(item.sourceLine, work.sourceLine);
      const unit = units(item.workId).get(item.unitId);
      assert.ok(unit, item.unitId);
      assert.ok(unit.text.startsWith(item.text), `${item.unitId} is exact`);
      assert.equal(item.complete, unit.text === item.text);
      assert.equal(unit.v, item.verse);
      assert.equal(unit.chapter, item.chapter);
      if (item.dh) assert.equal(item.dh, unit.dh);
      assert.ok(item.workId.endsWith(reading.reference.split(' ')[0]));
      count += 1;
    }
  }
  assert.ok(count >= 250);
});

test('gematria: the letter-swap words are refined — at most 26px, weight 500–600, centred and balanced', () => {
  const css = read('../src/styles/jewish-reminder.css');
  const rule = css.match(/\.gematria-calc \.gematria-ciphers \.gematria-card strong\.gematria-word\{([^}]+)\}/)?.[1] || '';
  const sizes = [...(rule.match(/font-size:clamp\((\d+)px,[^,]+,(\d+)px\)/) || [])].slice(1).map(Number);
  assert.equal(sizes.length, 2);
  assert.ok(sizes[1] <= 26 && sizes[0] >= 18);
  const weight = Number(rule.match(/font-weight:(\d+)/)?.[1]);
  assert.ok(weight >= 500 && weight <= 600);
  assert.match(rule, /text-wrap:balance/);
  assert.match(read('../src/NewApp.jsx'), /import '\.\/styles\/jewish-reminder\.css';/);
});

test('the hub: a tile for every reminder, the entry in personal tools, Ner Zikaron points to it', () => {
  const page = read('../src/pages/MazkirPage.jsx');
  for (const kind of [...MAZKIR_ORDER, 'shma', 'mincha', 'candles', 'omer']) assert.match(page, new RegExp(`'${kind}'`), kind);
  assert.match(read('../src/pages/PersonalTools.jsx'), /'#personal-tools\/mazkir', 'המזכיר היהודי'/);
  const ner = read('../src/pages/NerZikaron.jsx');
  assert.match(ner, /תזכורות לאזכרות — במזכיר היהודי/);
  assert.doesNotMatch(ner, /nz-reminders/);
  assert.match(ner, /personal-tools\/mazkir\/new\/yahrzeit\//);
});
