// האתגר העולמי — the server's pure rules: origins, input, dates, the signed start, rate limits, ranks. No I/O here, so
// tests/globalChallengeServer.test.mjs checks each one directly. Shared rules (the calendar, the scoring, the
// nickname) are the app's own files, imported — the server and the app can never disagree on them.
import { isDateKey, isWeekKey, shiftDateKey, keyOfUTC } from '../../../src/services/globalChallenge/calendar.mjs';

export const DEFAULT_ORIGINS = Object.freeze(['https://nzm1000-sudo.github.io', 'capacitor://localhost', 'https://localhost']);
const DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;
export const MAX_BODY = 4096;

// Is this Origin allowed? No Origin (a tool, a test) is allowed: CORS protects browsers, the limits protect the rest.
export function originAllowed(origin, { allowed = DEFAULT_ORIGINS, dev = false } = {}) {
  if (!origin) return true;
  if (allowed.includes(origin)) return true;
  return Boolean(dev && DEV_ORIGIN.test(origin));
}
export function corsHeaders(origin, options) {
  const headers = { 'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400', vary: 'Origin' };
  if (origin && originAllowed(origin, options)) headers['access-control-allow-origin'] = origin;
  return headers;
}

export const isDevice = v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);

// The dates a submission may name: the server's UTC date and one day either side (every time zone on Earth, UTC−12 …
// UTC+14, is then on one of them).
export const utcToday = now => keyOfUTC(new Date(now));
export function dateInWindow(date, now) {
  if (!isDateKey(date)) return false;
  const today = utcToday(now);
  return date >= shiftDateKey(today, -1) && date <= shiftDateKey(today, 1);
}
// A week the board may be asked for: a Sunday, from ten weeks back to next week.
export function weekInRange(week, now) {
  if (!isWeekKey(week)) return false;
  const today = utcToday(now);
  return week >= shiftDateKey(today, -70) && week <= shiftDateKey(today, 7);
}

// ---- The signed start: HMAC-SHA256 over "device|date|startedAt" with the server's secret (TOKEN_SECRET). ----
const enc = new TextEncoder();
const hex = buffer => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}
export async function signStart(secret, { device, date, startedAt }) {
  return `${startedAt}.${await hmac(secret, `${device}|${date}|${startedAt}`)}`;
}
// → the start time (ms) when the token is genuine for this device and date, else null.
export async function verifyStart(secret, token, { device, date }) {
  if (typeof token !== 'string' || token.length > 200) return null;
  const m = /^(\d{10,16})\.([0-9a-f]{64})$/.exec(token);
  if (!m) return null;
  const want = await hmac(secret, `${device}|${date}|${m[1]}`);
  let diff = 0;
  for (let i = 0; i < want.length; i += 1) diff |= want.charCodeAt(i) ^ m[2].charCodeAt(i);
  return diff === 0 ? Number(m[1]) : null;
}
// The rate limits are kept per IP without storing the IP: a keyed hash of it (16 hex), never reversible without the secret.
export async function ipTag(secret, ip) { return (await hmac(secret, `ip|${ip || 'unknown'}`)).slice(0, 16); }

// ---- Rate limits ----
// First line, free: per isolate, in memory (a sliding minute). Second line, for the writes only: counters in the store
// (per IP per hour, per device per day) — or the Workers rate-limit binding, when the deploy adds it.
export const LIMITS = Object.freeze({
  ipPerMinute: 120, devicePerMinute: 60, // every request (memory)
  ipWritesPerHour: 240, deviceWritesPerDay: 40, // start · submit · nickname · delete (store)
});
export function createMemoryLimiter({ windowMs = 60 * 1000, max = 120 } = {}) {
  const hits = new Map();
  return {
    hit(key, now) {
      const list = (hits.get(key) || []).filter(t => now - t < windowMs);
      list.push(now);
      hits.set(key, list);
      if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k);
      return list.length <= max;
    },
  };
}
export const hourBucket = now => Math.floor(now / 3600000);
export const dayBucket = now => Math.floor(now / 86400000);

// ---- Ranks (competition ranking: equal points share a place) from the week's points histogram ----
export function rankFromHist(hist, points) {
  let above = 0;
  for (const row of hist) if (row.points > points) above += row.n;
  return above + 1;
}
export const histTotal = hist => hist.reduce((sum, row) => sum + row.n, 0);

// JSON responses
export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}
