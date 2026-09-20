import test from 'node:test';
import assert from 'node:assert/strict';
import { JewishContextEngine, normalizeJewishProfile } from '../src/services/jewishContextEngine.mjs';

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

test('Mashiv Haruch follows the Shemini Atzeret to Pesach season', () => {
  assert.equal(context('2026-10-03').seasonal.mashivHaruch, true);
  assert.equal(context('2026-06-01').seasonal.mashivHaruch, false);
});

test('rules expose source and review metadata but do not rewrite Siddur automatically', () => {
  const result = context('2026-02-18');
  const rule = result.additions.find(item => item.kind === 'yaaleh-veyavo').rule;
  assert.equal(rule.reviewState, 'source-verified');
  assert.equal(result.prayerContext.productionApproved, false);
  assert.match(rule.source, /422/);
});