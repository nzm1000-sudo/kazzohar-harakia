// Today's weather line: Open-Meteo, only rounded coordinates leave the device, a 30-minute cache, the last reading
// offline, and the header layout (weather first, the date centred under it, no after-sunset disclaimer line).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describeWeatherCode, loadWeather, summarizeWeather, weatherURL, WEATHER_FRESH_MS, WEATHER_STALE_MS } from '../src/services/weather.mjs';

const sample = {
  current: { time: '2026-09-27T22:15', temperature_2m: 20.6, apparent_temperature: 19.7, relative_humidity_2m: 54, weather_code: 0, wind_speed_10m: 7.6, is_day: 0 },
  hourly: {
    time: Array.from({ length: 30 }, (_, hour) => `2026-09-${27 + Math.floor(hour / 24)}T${String(hour % 24).padStart(2, '0')}:00`),
    temperature_2m: Array.from({ length: 30 }, (_, hour) => 18 + (hour % 12)),
    precipitation_probability: Array.from({ length: 30 }, () => 0),
  },
  daily: { temperature_2m_max: [27.4], temperature_2m_min: [17.6], precipitation_probability_max: [5] },
};
const memoryStorage = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)) }; };
const okFetch = (calls = []) => async url => { calls.push(url); return { ok: true, json: async () => sample }; };
const place = { latitude: 31.778345, longitude: 35.235611, name: 'ירושלים' };

test('only the rounded coordinates of the chosen place are sent', () => {
  const url = new URL(weatherURL(place));
  assert.equal(url.origin + url.pathname, 'https://api.open-meteo.com/v1/forecast');
  assert.equal(url.searchParams.get('latitude'), '31.78');
  assert.equal(url.searchParams.get('longitude'), '35.24');
  assert.doesNotMatch(url.search, /ירושלים|name|key|id=/);
});

test('WMO codes read as Hebrew words, and a clear night draws the moon', () => {
  assert.deepEqual(describeWeatherCode(0), { kind: 'clear', label: 'בהיר' });
  assert.equal(describeWeatherCode(63).label, 'גשם');
  assert.equal(describeWeatherCode(95).kind, 'storm');
  const w = summarizeWeather(sample);
  assert.equal(w.kind, 'night');
  assert.equal(w.temperature, 21);
  assert.equal(w.feelsLike, 20);
  assert.deepEqual([w.high, w.low], [27, 18]);
  assert.equal(w.hours[0].hour, 22, 'the line starts at the current hour');
  assert.equal(w.hours.length, 8, 'as many of the next twelve hours as the forecast has');
});

test('a reading is reused for 30 minutes, then refreshed', async () => {
  const storage = memoryStorage();
  const calls = [];
  const now = Date.UTC(2026, 8, 27, 19);
  await loadWeather(place, { fetchImpl: okFetch(calls), storage, now });
  await loadWeather(place, { fetchImpl: okFetch(calls), storage, now: now + WEATHER_FRESH_MS - 1 });
  assert.equal(calls.length, 1);
  await loadWeather(place, { fetchImpl: okFetch(calls), storage, now: now + WEATHER_FRESH_MS + 1 });
  assert.equal(calls.length, 2);
});

test('offline, the last reading is shown as stale for up to 12 hours; after that the line hides', async () => {
  const storage = memoryStorage();
  const now = Date.UTC(2026, 8, 27, 19);
  await loadWeather(place, { fetchImpl: okFetch(), storage, now });
  const offline = async () => { throw new TypeError('Failed to fetch'); };
  const stale = await loadWeather(place, { fetchImpl: offline, storage, now: now + 2 * 60 * 60 * 1000 });
  assert.equal(stale.stale, true);
  assert.equal(stale.savedAt, now);
  await assert.rejects(loadWeather(place, { fetchImpl: offline, storage, now: now + WEATHER_STALE_MS + 1 }));
  await assert.rejects(loadWeather({ name: 'no coordinates' }, { fetchImpl: okFetch(), storage, now }));
});

test('Today: weather first, the date centred under it, and no after-sunset disclaimer line', () => {
  const page = readFileSync(new URL('../src/pages/TodayPage.jsx', import.meta.url), 'utf8');
  const hero = page.slice(page.indexOf('<section className="today-hero">'), page.indexOf('{ring && <section'));
  assert.ok(hero.indexOf('<WeatherStrip location={settings?.location} />') < hero.indexOf('className="today-dateline"'));
  assert.doesNotMatch(page, /בין השמשות הוא זמן ספק/);
  const css = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8');
  assert.match(css, /\.today-hero\{[^}]*justify-items:center;text-align:center\}/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.weather-strip \*,\.weather-strip::before,\.weather-strip::after\{animation:none!important\}\}/);
});

test('Open-Meteo is credited in About and disclosed in the privacy policy', () => {
  const about = readFileSync(new URL('../src/pages/AboutPage.jsx', import.meta.url), 'utf8');
  const privacy = readFileSync(new URL('../public/privacy.html', import.meta.url), 'utf8');
  assert.match(about, /מזג אוויר: Open-Meteo/);
  assert.match(about, /WEATHER_ATTRIBUTION\.license/);
  assert.match(privacy, /Open-Meteo<\/a><\/td><td>מזג האוויר במסך ״היום״/);
});

test('a stalled first request is retried before the line gives up', () => {
  const strip = readFileSync(new URL('../src/components/WeatherStrip.jsx', import.meta.url), 'utf8');
  assert.match(strip, /const WEATHER_RETRIES = 3;/);
  assert.match(strip, /if \(retries < WEATHER_RETRIES\) \{ retries \+= 1; retryTimer = setTimeout\(load, WEATHER_RETRY_MS\); \}/);
  assert.match(strip, /clearTimeout\(retryTimer\)/);
});

test('the strip names the place its weather is for, and its pulse travels the twelve-hour line unless motion is reduced', () => {
  const strip = readFileSync(new URL('../src/components/WeatherStrip.jsx', import.meta.url), 'utf8');
  assert.match(strip, /const place = String\(location\?\.name \|\| ''\)\.split\(\/\[,،\]\/\)\[0\]\.trim\(\);/);
  assert.match(strip, /<span className="weather-place">/);
  assert.match(strip, /\{!reducedMotion\(\) && <g className="wt-pulse">/);
  assert.match(strip, /<animateMotion dur="36s" repeatCount="indefinite" path=\{line\} keyPoints="0;1;0" keyTimes="0;\.5;1" calcMode="spline"/);
  const css = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8');
  assert.match(css, /grid-template-columns:minmax\(0,1fr\) auto minmax\(0,1fr\);[^}]*width:min\(calc\(100% - 40px\),440px\)/);
  assert.match(css, /animation:wx-wander 140s/);
  assert.match(css, /\.weather-place\{[^}]*padding-inline-end:16px;/);
});
