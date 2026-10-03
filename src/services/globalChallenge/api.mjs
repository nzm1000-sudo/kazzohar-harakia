// האתגר העולמי — the client of the challenge server (server/challenge-worker). The server's address comes from the
// build: VITE_CHALLENGE_API. Without it the feature is wholly local (the personal result only; every global part is
// hidden), so the app can ship before the server is live.
//
// Every call resolves (never throws): { ok, status, data, error, offline }. `offline` — no answer at all (no network, a
// timeout, the server down): the caller keeps what it has and tries again later. A refusal (4xx) carries the server's
// reason in `error` ('already', 'late', 'closed', 'taken' …) and is not retried.
import { pendingDays, markDay, rememberStats } from './store.mjs';

export function challengeApiBase() {
  try { return String(import.meta.env?.VITE_CHALLENGE_API || '').trim().replace(/\/+$/, ''); } catch { return ''; }
}

export function createChallengeApi({ base: rawBase = challengeApiBase(), fetchImpl = globalThis.fetch?.bind(globalThis), timeoutMs = 8000 } = {}) {
  const base = String(rawBase || '').trim().replace(/\/+$/, '');
  const enabled = Boolean(base && fetchImpl);
  async function call(method, path, body) {
    if (!enabled) return { ok: false, status: 0, data: null, error: 'disabled', offline: false };
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const response = await fetchImpl(`${base}${path}`, {
        method, signal: controller?.signal, credentials: 'omit', cache: 'no-store',
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      let data = null;
      try { data = await response.json(); } catch { data = null; }
      if (response.ok) return { ok: true, status: response.status, data, error: null, offline: false };
      // 429 and 5xx: the server is busy or failing — like offline, try again later.
      const busy = response.status === 429 || response.status >= 500;
      return { ok: false, status: response.status, data, error: data?.error || `http-${response.status}`, offline: busy };
    } catch {
      return { ok: false, status: 0, data: null, error: 'network', offline: true };
    } finally { if (timer) clearTimeout(timer); }
  }
  const enc = encodeURIComponent;
  return {
    enabled,
    day: date => call('GET', `/v1/day/${enc(date)}`),
    start: ({ device, date, il }) => call('POST', '/v1/start', { device, date, il }),
    submit: ({ device, date, il, token, answers }) => call('POST', '/v1/submit', { device, date, il, token: token || null, answers: answers.map(({ qid, choice, ms }) => ({ qid, choice: Number.isInteger(choice) ? choice : null, ms: Math.max(0, Math.round(ms || 0)) })) }),
    board: ({ week, device }) => call('GET', `/v1/board/${enc(week)}${device ? `?device=${enc(device)}` : ''}`),
    nickname: ({ device, nickname, board }) => call('POST', '/v1/nickname', { device, ...(nickname !== undefined ? { nickname } : {}), ...(board !== undefined ? { board: Boolean(board) } : {}) }),
    deleteMe: ({ device }) => call('DELETE', '/v1/me', { device }),
  };
}

// Sends every result waiting for a connection, oldest first. Returns the new state (each day 'sent' with its global
// numbers, 'rejected' with the reason, or still 'pending' when the server could not be reached — then it stops).
export async function flushPending(state, api) {
  if (!api?.enabled || !state.device || !state.prefs.participate) return state;
  let next = state;
  for (const date of pendingDays(state)) {
    const day = next.days[date];
    const token = next.starts?.[date]?.token || null;
    const res = await api.submit({ device: next.device, date, il: day.il, token, answers: day.answers.map(({ qid, choice, ms }) => ({ qid, choice, ms })) });
    if (res.offline) break;
    if (res.ok) {
      next = markDay(next, date, { status: 'sent', reason: null, verified: res.data?.verified === true });
      next = rememberStats(next, date, res.data?.day);
    } else if (res.error === 'already') {
      next = markDay(next, date, { status: 'sent', reason: null });
    } else {
      next = markDay(next, date, { status: 'rejected', reason: res.error || 'rejected' });
    }
  }
  return next;
}
