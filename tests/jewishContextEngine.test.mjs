import test from 'node:test';
import assert from 'node:assert/strict';
import { JewishContextEngine, normalizeJewishProfile } from '../src/services/jewishContextEngine.mjs';
import { dayContext } from '../src/dayContext.mjs';
import { buildSiddurConditionSummary, shouldDisplaySiddurSection } from '../src/services/siddurConditionEngine.mjs';

const settings = (status = 'israel', location = 'תל אביב') => ({
  nusach: 'edot-hamizrach',
  halachicResidenceStatus: status,
  location: { name: location, tzid: 'Asia/Jerusalem', latitude: 32.0853, longitude: 34.7818 },
});
const context = (date, status = 'israel') => JewishContextEngine({ now: new Date(`${date}T12:00:00Z`), settings: settings(status) });
const kinds = value => value.additions.map(item => item.kind);

test('profile residence stays explicit when current location changes', () => {
  const profile = normalizeJewishProfile({ halachicResidenceStatus: 'israel', location: { name: 'לונדון' }, il: false });
  assert.equal(profile.halachicResidenceStatus, 'israel');
  assert.equal(profile.currentLocation.name, 'לונדון');
});

test('Rosh Chodesh adds Yaaleh Veyavo, half Hallel, and omits Tachanun', () => {
  const result = context('2026-02-18');
  assert.equal(result.isRoshChodesh, true);
  assert.ok(kinds(result).includes('yaaleh-veyavo'));
  assert.equal(result.prayerContext.hallel, 'חצי הלל');
  assert.equal(result.prayerContext.omitTachanun, true);
});

test('Chanukah and Purim add Al Hanissim without inventing travel status', () => {
  assert.ok(kinds(context('2026-12-06')).includes('al-hanissim'));
  assert.ok(kinds(context('2026-03-03')).includes('al-hanissim'));
  assert.equal(context('2026-12-06').isIsrael, true);
});

test('ordinary weekday keeps Tachanun and has no holiday additions', () => {
  const result = context('2026-02-13');
  assert.equal(result.prayerContext.omitTachanun, false);
  assert.equal(kinds(result).includes('yaaleh-veyavo'), false);
  assert.equal(kinds(result).includes('al-hanissim'), false);
});

test('Shabbat omits Tachanun', () => {
  assert.equal(context('2026-02-14').prayerContext.omitTachanun, true);
});

test('Veten Tal Umatar differs by explicit Israel or diaspora profile', () => {
  assert.equal(context('2026-11-01', 'israel').seasonal.vetenTalUmatar, true);
  assert.equal(context('2026-11-01', 'diaspora').seasonal.vetenTalUmatar, false);
  assert.equal(context('2026-12-06', 'diaspora').seasonal.vetenTalUmatar, true);
});

test('diaspora Veten Tal Umatar uses local civil date and evening transition', () => {
  const location = { name: 'New York', tzid: 'America/New_York', latitude: 40.7128, longitude: -74.006 };
  const base = { settings: { ...settings('diaspora'), location }, prayerType: 'shacharit' };
  assert.equal(JewishContextEngine({ ...base, now: new Date('2026-12-04T16:00:00Z'), times: { sunset: '2026-12-04T21:00:00Z' } }).seasonal.vetenTalUmatar, false);
  assert.equal(JewishContextEngine({ ...base, now: new Date('2026-12-04T22:00:00Z'), times: { sunset: '2026-12-04T21:00:00Z' } }).seasonal.vetenTalUmatar, true);
  assert.equal(JewishContextEngine({ ...base, now: new Date('2026-12-05T04:00:00Z'), times: { sunset: '2026-12-04T21:00:00Z' } }).seasonal.vetenTalUmatar, true);
  assert.equal(JewishContextEngine({ ...base, now: new Date('2026-12-04T23:30:00Z'), times: { sunset: '2026-12-05T00:00:00Z' } }).seasonal.vetenTalUmatar, false);
  assert.equal(JewishContextEngine({ ...base, now: new Date('2026-12-04T22:00:00Z'), times: { sunset: '2026-12-04T21:00:00Z' }, settings: { ...settings('israel'), location } }).seasonal.vetenTalUmatar, true);
});

test('Mashiv Haruch follows the Shemini Atzeret to Pesach season', () => {
  assert.equal(context('2026-10-03').seasonal.mashivHaruch, false);
  assert.equal(JewishContextEngine({ now: new Date('2026-10-03T12:00:00Z'), settings: settings(), prayerType: 'mussaf' }).seasonal.mashivHaruch, true);
  assert.equal(context('2026-06-01').seasonal.mashivHaruch, false);
});

test('current-day Erev Yom Kippur context stays date-specific', () => {
  const beforeSunset = JewishContextEngine({
    now: new Date('2026-09-20T12:00:00Z'),
    settings: settings(),
    times: { sunset: '2026-09-20T15:20:00Z' },
  });
  const afterSunset = JewishContextEngine({
    now: new Date('2026-09-20T18:30:00Z'),
    settings: settings(),
    times: { sunset: '2026-09-20T15:20:00Z' },
  });
  assert.equal(beforeSunset.hebrewDate.label, 'ט׳ בתשרי תשפ״ז');
  assert.equal(beforeSunset.specialDay.desc, 'Erev Yom Kippur');
  assert.equal(beforeSunset.seasonal.mashivHaruch, false);
  assert.equal(beforeSunset.torahReading, null);
  assert.equal(afterSunset.hebrewDate.label, 'י׳ בתשרי תשפ״ז');
  assert.equal(afterSunset.specialDay.desc, 'Yom Kippur');
});

test('dated parashot distinguish current, previous, and upcoming Shabbat', () => {
  const items = [
    { date: '2026-09-19', category: 'parashat', hebrew: 'פרשת האזינו' },
    { date: '2026-09-26', category: 'parashat', hebrew: 'סוכות א׳' },
    { date: '2026-10-03', category: 'parashat', hebrew: 'פרשת בראשית' },
  ];
  const result = dayContext(new Date('2026-09-20T12:00:00Z'), settings(), { sunset: '2026-09-20T15:20:00Z' }, items);
  assert.equal(result.parasha.hebrew, 'סוכות א׳');
  assert.equal(result.previousShabbat.hebrew, 'פרשת האזינו');
  assert.equal(result.upcomingShabbat.hebrew, 'סוכות א׳');
});

test('rules expose source and review metadata but do not rewrite Siddur automatically', () => {
  const result = context('2026-02-18');
  const rule = result.additions.find(item => item.kind === 'yaaleh-veyavo').rule;
  assert.equal(rule.reviewState, 'source-verified');
  assert.equal(result.prayerContext.productionApproved, false);
  assert.match(rule.source, /422/);
});

test('Siddur condition engine hides Tachanun when omitted and keeps Hallel context visible', () => {
  const onWeekday = buildSiddurConditionSummary(context('2026-02-13'));
  const onRoshChodesh = buildSiddurConditionSummary(context('2026-02-18'));
  const onShabbat = buildSiddurConditionSummary(context('2026-02-14'));
  assert.equal(shouldDisplaySiddurSection('Tachanun', onWeekday), true);
  assert.equal(shouldDisplaySiddurSection('Tachanun', onRoshChodesh), false);
  assert.equal(shouldDisplaySiddurSection('Tachanun', onShabbat), false);
  assert.equal(shouldDisplaySiddurSection('Hallel', onRoshChodesh), true);
  assert.equal(shouldDisplaySiddurSection('Hallel', onWeekday), false);
});

test('fast-day metadata does not invent prayer additions without a reviewed rule', () => {
  const fastDay = context('2026-03-02');
  const summary = buildSiddurConditionSummary(fastDay);
  assert.equal(fastDay.fast, true);
  assert.equal(fastDay.prayerContext.additions.some(item => item.kind === 'aneinu'), false);
  assert.equal(summary.hasAneinu, false);
  assert.equal(shouldDisplaySiddurSection('Aneinu', summary), false);
});

test('structured Hebcal flags distinguish Yom Tov, Chol HaMoed, and Shavuot', () => {
  const sukkot = buildSiddurConditionSummary(context('2026-09-26'));
  const cholHaMoed = buildSiddurConditionSummary(context('2026-09-27'));
  const shavuot = buildSiddurConditionSummary(context('2026-05-22'));
  assert.equal(sukkot.isYomTov, true);
  assert.equal(sukkot.isCholHaMoed, false);
  assert.equal(cholHaMoed.isYomTov, false);
  assert.equal(cholHaMoed.isCholHaMoed, true);
  assert.equal(shavuot.isYomTov, true);
  assert.equal(shouldDisplaySiddurSection('Chol HaMoed', shavuot), false);
});

test('selected date drives the Jewish context instead of the host clock', () => {
  const selected = JewishContextEngine({ now: new Date('2026-09-25T12:00:00Z'), settings: settings(), times: { sunset: '2026-09-25T15:27:00Z' } });
  const afterSunset = JewishContextEngine({ now: new Date('2026-09-25T17:00:00Z'), settings: settings(), times: { sunset: '2026-09-25T15:27:00Z' } });
  assert.equal(selected.key, '2026-09-25');
  assert.equal(afterSunset.key, '2026-09-26');
  assert.equal(buildSiddurConditionSummary(selected).dayLabel, 'Erev Sukkot');
  assert.equal(buildSiddurConditionSummary(afterSunset).dayLabel, 'Sukkot I');
});
