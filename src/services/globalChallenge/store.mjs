// האתגר העולמי — what this device keeps (localStorage, one versioned key). Pure transitions plus a thin read/write.
//
// · device — a random anonymous id (crypto.randomUUID), made the first time the server is contacted. Nothing else
//   identifies the player: no name, email, location or tracking. "מחיקת הנתונים שלי מהשרת" erases the server's rows and
//   the id here (the next contact makes a new one, linked to nothing).
// · prefs — participate ("השתתפות באתגר העולמי", on by default; off: no card, no contact with the server), board
//   ("הופעה בטבלת השיאים", off by default; a separate opt-in that needs a nickname), nickname (as the server last
//   accepted it — changeable from the settings), introSeen
//   (the one-time short explanation).
// · days — the player's own result of each day (kept even when the server never hears of it): the five ids, the
//   answers, the score, and where its submission stands: 'pending' (waiting for a connection), 'sent', 'rejected'
//   (with the server's reason), or 'local' (no server configured, or not a scheduled day).
// · token — the server's signed start of the day being played (only while it is played and submitted).
// · stats — the last global numbers seen for a day (shown offline as last seen).
// · progress — the game in the middle: { date, answers, shownAt } (the question on screen is answers.length; its clock
//   keeps running while the player is away — one try a day, so leaving never buys time).
import { GLOBAL_SIZE, scoreAnswers } from './scoring.mjs';

export const GLOBAL_STORAGE_KEY = 'kz-global-challenge-v1';
export const KEEP_DAYS = 60;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ['pending', 'sent', 'rejected', 'local'];
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

export const DEFAULT_PREFS = Object.freeze({ participate: true, board: false, nickname: '', introSeen: false });
export const emptyGlobalState = () => ({ version: 1, device: null, prefs: { ...DEFAULT_PREFS }, days: {}, starts: {}, stats: {}, progress: null });

export function makeDeviceId(cryptoImpl = globalThis.crypto) {
  if (typeof cryptoImpl?.randomUUID === 'function') return cryptoImpl.randomUUID();
  const b = new Uint8Array(16);
  if (typeof cryptoImpl?.getRandomValues === 'function') cryptoImpl.getRandomValues(b); else for (let i = 0; i < 16; i += 1) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export const isDeviceId = v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);

function normalizeDay(v) {
  const d = obj(v);
  const ids = Array.isArray(d.ids) ? d.ids.filter(x => typeof x === 'string').slice(0, GLOBAL_SIZE) : [];
  const answers = Array.isArray(d.answers) ? d.answers.slice(0, GLOBAL_SIZE).map(a => ({ qid: String(a?.qid || ''), choice: Number.isInteger(a?.choice) ? a.choice : null, ms: Number.isInteger(a?.ms) && a.ms >= 0 ? a.ms : 0, correct: a?.correct === true })) : [];
  return { ids, answers, correct: answers.filter(a => a.correct).length, points: Number.isFinite(d.points) ? d.points : 0, at: Number.isFinite(d.at) ? d.at : 0,
    il: d.il !== false, scheduled: d.scheduled !== false, status: STATUSES.includes(d.status) ? d.status : 'local', reason: typeof d.reason === 'string' ? d.reason : null, verified: d.verified === true };
}

export function normalizeGlobalState(raw) {
  const input = obj(raw);
  const out = emptyGlobalState();
  out.device = isDeviceId(input.device) ? input.device : null;
  const prefs = obj(input.prefs);
  out.prefs = { participate: prefs.participate !== false, board: prefs.board === true, nickname: typeof prefs.nickname === 'string' ? prefs.nickname.slice(0, 40) : '', introSeen: prefs.introSeen === true };
  const days = Object.entries(obj(input.days)).filter(([k]) => DATE.test(k)).sort((a, b) => b[0].localeCompare(a[0])).slice(0, KEEP_DAYS);
  out.days = Object.fromEntries(days.map(([k, v]) => [k, normalizeDay(v)]));
  out.starts = Object.fromEntries(Object.entries(obj(input.starts)).filter(([k, v]) => DATE.test(k) && typeof v?.token === 'string').slice(0, 4).map(([k, v]) => [k, { token: v.token, startedAt: Number(v.startedAt) || 0 }]));
  const progress = obj(input.progress);
  out.progress = DATE.test(progress.date) && Array.isArray(progress.answers) && progress.answers.length < GLOBAL_SIZE && (Number.isFinite(progress.shownAt) || progress.shownAt === null)
    ? { date: progress.date, answers: progress.answers.map(a => ({ qid: String(a?.qid || ''), choice: Number.isInteger(a?.choice) ? a.choice : null, ms: Number.isInteger(a?.ms) ? a.ms : 0 })), shownAt: progress.shownAt } : null;
  out.stats = Object.fromEntries(Object.entries(obj(input.stats)).filter(([k, v]) => DATE.test(k) && Number.isFinite(v?.n)).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14));
  return out;
}

const storageOf = storage => { if (storage !== undefined) return storage; try { return globalThis.localStorage || null; } catch { return null; } };
export function readGlobalState(storage) {
  try { const raw = storageOf(storage)?.getItem(GLOBAL_STORAGE_KEY); if (raw) return normalizeGlobalState(JSON.parse(raw)); } catch { /* a broken record reads as new */ }
  return emptyGlobalState();
}
export function writeGlobalState(state, storage) {
  try { storageOf(storage)?.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(state)); return true; } catch { return false; }
}

export const withDevice = (state, cryptoImpl) => (state.device ? state : { ...state, device: makeDeviceId(cryptoImpl) });
export const setPrefs = (state, patch) => ({ ...state, prefs: { ...state.prefs, ...patch } });
export const dayResult = (state, date) => state?.days?.[date] || null;

// The end of the day's game: the result kept (once — the first result of a day stands). `bank` grades on the device;
// `queue` says whether it waits for the server ('pending') or stays here ('local').
export function recordDay(state, { date, ids, answers, bank, key = null, il = true, scheduled = true, queue = true, now = Date.now() }) {
  if (state.days[date]) return state;
  const rows = key || ids.map(id => { const q = bank.byId.get(id); return [id, q?.answer ?? -1, q?.difficulty ?? 1]; });
  const score = scoreAnswers(rows, answers);
  const entry = { ids: [...ids], answers: answers.map((a, i) => ({ qid: a.qid, choice: Number.isInteger(a.choice) ? a.choice : null, ms: Math.max(0, Math.round(a.ms || 0)), correct: score.perQuestion[i] })),
    correct: score.correct, points: score.points, at: now, il, scheduled, status: queue && scheduled ? 'pending' : 'local', reason: null, verified: false };
  return { ...state, days: { ...state.days, [date]: entry }, progress: null };
}
export const markDay = (state, date, patch) => (state.days[date] ? { ...state, days: { ...state.days, [date]: { ...state.days[date], ...patch } } } : state);
export const pendingDays = state => Object.entries(state.days || {}).filter(([, d]) => d.status === 'pending').map(([k]) => k).sort();
export const rememberStats = (state, date, stats) => (stats && Number.isFinite(stats.n) ? { ...state, stats: { ...state.stats, [date]: stats } } : state);
export const rememberStart = (state, date, start) => ({ ...state, starts: { [date]: { token: start.token, startedAt: start.startedAt } } });
// After "מחיקת הנתונים שלי מהשרת": no id, no board, no nickname; the player's own results stay on the device, but none
// waits to be sent any more (it would recreate the deleted rows).
export function forgetServer(state) {
  const days = Object.fromEntries(Object.entries(state.days).map(([k, d]) => [k, d.status === 'pending' ? { ...d, status: 'local' } : d]));
  return { ...state, device: null, starts: {}, prefs: { ...state.prefs, board: false, nickname: '' }, days };
}
