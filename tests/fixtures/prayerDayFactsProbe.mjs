// Prints prayer-day facts for fixed inputs; run under different host TZ values by prayerDayFacts.test.mjs.
import { computePrayerDayFacts } from '../../src/services/prayer/prayerDayFacts.mjs';
const JLM = { tzid: 'Asia/Jerusalem', latitude: 31.778, longitude: 35.235 };
const NYC = { tzid: 'America/New_York', latitude: 40.7128, longitude: -74.006 };
const cases = [
  ['2026-09-27T16:00:00Z', JLM, 'israel'], ['2026-09-27T16:00:00Z', NYC, 'diaspora'],
  ['2026-12-10T10:00:00Z', JLM, 'israel'], ['2027-04-24T10:00:00Z', JLM, 'israel'],
  ['2027-03-23T10:00:00Z', JLM, 'israel'], ['2026-11-01T05:30:00Z', NYC, 'diaspora'],
];
process.stdout.write(JSON.stringify(cases.map(([instant, location, halachicResidenceStatus]) => computePrayerDayFacts({ instant, settings: { location, halachicResidenceStatus } }))));
