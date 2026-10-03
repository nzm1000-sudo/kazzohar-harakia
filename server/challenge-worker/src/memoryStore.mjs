// האתגר העולמי — the store in memory: the same contract as d1Store.mjs, for the tests (and nothing else). Every method is
// async, as D1's are.
import { GLOBAL_SIZE } from '../../../src/services/globalChallenge/scoring.mjs';

const order = (a, b) => b.points - a.points || a.reached - b.reached || (a.device < b.device ? -1 : 1);

export function createMemoryStore() {
  const starts = new Map(); // device|date → startedAt
  const submissions = new Map(); // device|date → row
  const days = new Map(); // date → { n, c, h }
  const players = new Map(); // device → { device, nickname, nickKey, board, created }
  const keys = new Map(); // nickKey → device
  const weeks = new Map(); // week → Map(device → { points, days, reached, listed })
  const rate = new Map(); // key → { n, exp }
  const weekOf = w => { if (!weeks.has(w)) weeks.set(w, new Map()); return weeks.get(w); };
  const rows = w => [...weekOf(w).entries()].map(([device, e]) => ({ device, ...e, nickname: players.get(device)?.nickname || null }));
  return {
    _tables: { starts, submissions, days, players, keys, weeks, rate },
    async getStart(device, date) { return starts.get(`${device}|${date}`) ?? null; },
    async putStart(device, date, at) { const k = `${device}|${date}`; if (!starts.has(k)) starts.set(k, at); return starts.get(k); },
    async getSubmission(device, date) { return submissions.get(`${device}|${date}`) || null; },
    async insertSubmission(row) { const k = `${row.device}|${row.date}`; if (submissions.has(k)) return false; submissions.set(k, { ...row }); return true; },
    async addDayStats(date, perQuestion) {
      const s = days.get(date) || { n: 0, c: Array(GLOBAL_SIZE).fill(0), h: Array(GLOBAL_SIZE + 1).fill(0) };
      s.n += 1; perQuestion.forEach((r, i) => { if (r) s.c[i] += 1; }); s.h[perQuestion.filter(Boolean).length] += 1;
      days.set(date, s);
    },
    async getDayStats(date) { const s = days.get(date); return s ? { n: s.n, c: [...s.c], h: [...s.h] } : null; },
    async getPlayer(device) { const p = players.get(device); return p ? { ...p } : null; },
    async putPlayer(p) { if (keys.has(p.nickKey) && keys.get(p.nickKey) !== p.device) return 'taken'; keys.set(p.nickKey, p.device); players.set(p.device, { ...p, board: Boolean(p.board) }); return 'ok'; },
    async setBoard(device, board) {
      const p = players.get(device); if (!p) return;
      p.board = Boolean(board);
      for (const w of weeks.values()) { const e = w.get(device); if (e) e.listed = Boolean(board && p.nickname); }
    },
    async addWeekPoints({ week, device, points, at, listed }) {
      const w = weekOf(week);
      const e = w.get(device) || { points: 0, days: 0, reached: at, listed };
      w.set(device, { points: e.points + points, days: e.days + 1, reached: at, listed });
    },
    async weekEntry(week, device) { const e = weekOf(week).get(device); return e ? { ...e } : null; },
    async weekTop(week, limit) { return rows(week).filter(r => r.listed).sort(order).slice(0, limit); },
    async weekHist(week) {
      const hist = new Map();
      for (const r of rows(week)) if (r.listed) hist.set(r.points, (hist.get(r.points) || 0) + 1);
      return [...hist.entries()].map(([points, n]) => ({ points, n })).sort((a, b) => b.points - a.points);
    },
    async weekAround(week, me, n) {
      const list = rows(week).filter(r => r.listed).sort(order);
      const i = list.findIndex(r => r.device === me.device);
      return { above: i < 0 ? [] : list.slice(Math.max(0, i - n), i), below: i < 0 ? [] : list.slice(i + 1, i + 1 + n) };
    },
    async deleteDevice(device) {
      const p = players.get(device);
      if (p) keys.delete(p.nickKey);
      players.delete(device);
      for (const k of [...starts.keys()]) if (k.startsWith(`${device}|`)) starts.delete(k);
      for (const k of [...submissions.keys()]) if (k.startsWith(`${device}|`)) submissions.delete(k);
      for (const w of weeks.values()) w.delete(device);
      for (const k of [...rate.keys()]) if (k.startsWith(`dev:${device}:`)) rate.delete(k);
    },
    async hit(key, exp) { const r = rate.get(key) || { n: 0, exp }; r.n += 1; rate.set(key, r); return r.n; },
    async cleanup(now) { for (const [k, r] of rate) if (r.exp < now) rate.delete(k); },
  };
}
