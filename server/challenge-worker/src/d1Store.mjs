// האתגר העולמי — the store on Cloudflare D1 (schema: migrations/0001_init.sql, 0002_nickname_changes.sql). The same contract as memoryStore.mjs.
// Cost (D1 free plan: 5M rows read, 100k rows written a day): a submission writes the submission, the day's counters and
// (when verified) the week's row and two histogram rows; a board read is the top 100 rows, the histogram (≤ ~85) and a
// handful around the player.
import { GLOBAL_SIZE } from '../../../src/services/globalChallenge/scoring.mjs';

const C = Array.from({ length: GLOBAL_SIZE }, (_, i) => `c${i}`);
const H = Array.from({ length: GLOBAL_SIZE + 1 }, (_, i) => `h${i}`);
const DAY = 86400000;
const dateKeyOf = ms => new Date(ms).toISOString().slice(0, 10);

export function createD1Store(db) {
  const histStep = (week, points, delta) => db.prepare('INSERT INTO week_hist (week, points, n) VALUES (?1, ?2, ?3) ON CONFLICT(week, points) DO UPDATE SET n = n + ?3').bind(week, points, delta);
  const histClean = week => db.prepare('DELETE FROM week_hist WHERE week = ?1 AND n <= 0').bind(week);
  return {
    async getStart(device, date) {
      const row = await db.prepare('SELECT started_at FROM starts WHERE device = ?1 AND date = ?2').bind(device, date).first();
      return row ? row.started_at : null;
    },
    async putStart(device, date, at) {
      const [, read] = await db.batch([
        db.prepare('INSERT OR IGNORE INTO starts (device, date, started_at) VALUES (?1, ?2, ?3)').bind(device, date, at),
        db.prepare('SELECT started_at FROM starts WHERE device = ?1 AND date = ?2').bind(device, date),
      ]);
      return read.results[0]?.started_at ?? at;
    },
    async getSubmission(device, date) {
      return (await db.prepare('SELECT correct, points, verified FROM submissions WHERE device = ?1 AND date = ?2').bind(device, date).first()) || null;
    },
    async insertSubmission({ device, date, correct, points, verified, at }) {
      const res = await db.prepare('INSERT OR IGNORE INTO submissions (device, date, correct, points, verified, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(device, date, correct, points, verified ? 1 : 0, at).run();
      return (res.meta?.changes || 0) > 0;
    },
    async addDayStats(date, perQuestion) {
      const k = perQuestion.filter(Boolean).length;
      const cs = C.map((_, i) => (perQuestion[i] ? 1 : 0));
      const hs = H.map((_, i) => (i === k ? 1 : 0));
      const cols = ['date', 'n', ...C, ...H];
      const sql = `INSERT INTO day_stats (${cols.join(', ')}) VALUES (${cols.map((_, i) => `?${i + 1}`).join(', ')}) ON CONFLICT(date) DO UPDATE SET n = n + 1, ${[...C, ...H].map(c => `${c} = ${c} + excluded.${c}`).join(', ')}`;
      await db.prepare(sql).bind(date, 1, ...cs, ...hs).run();
    },
    async getDayStats(date) {
      const row = await db.prepare('SELECT * FROM day_stats WHERE date = ?1').bind(date).first();
      return row ? { n: row.n, c: C.map(c => row[c]), h: H.map(h => row[h]) } : null;
    },
    async getPlayer(device) {
      const row = await db.prepare('SELECT device, nickname, nick_key, board, created FROM players WHERE device = ?1').bind(device).first();
      return row ? { device: row.device, nickname: row.nickname, nickKey: row.nick_key, board: Boolean(row.board), created: row.created } : null;
    },
    // The device's nickname, chosen or changed — one atomic upsert of its one row (migrations/0002): 'ok'; 'taken' (the
    // UNIQUE index on nick_key: another device holds the name — nothing written); 'limit' (already `max` writes on
    // this day — nothing written). The old key leaves the index in the same statement.
    async setNickname({ device, nickname, nickKey, day, max, at }) {
      try {
        const row = await db.prepare(`INSERT INTO players (device, nickname, nick_key, board, created, nick_day, nick_changes) VALUES (?1, ?2, ?3, 0, ?4, ?5, 1)
          ON CONFLICT(device) DO UPDATE SET nickname = excluded.nickname, nick_key = excluded.nick_key,
            nick_changes = CASE WHEN players.nick_day = excluded.nick_day THEN players.nick_changes + 1 ELSE 1 END, nick_day = excluded.nick_day
          WHERE players.nick_day <> excluded.nick_day OR players.nick_changes < ?6
          RETURNING nick_changes`).bind(device, nickname, nickKey, at, day, max).first();
        return row ? 'ok' : 'limit';
      } catch (error) {
        if (/UNIQUE/i.test(String(error?.message || error))) return 'taken';
        throw error;
      }
    },
    async setBoard(device, board) {
      const player = await this.getPlayer(device);
      if (!player) return;
      const listed = board && player.nickname ? 1 : 0;
      const { results = [] } = await db.prepare('SELECT week, points, listed FROM week_points WHERE device = ?1').bind(device).all();
      const statements = [db.prepare('UPDATE players SET board = ?2 WHERE device = ?1').bind(device, board ? 1 : 0)];
      for (const row of results) {
        if (row.listed === listed) continue;
        statements.push(db.prepare('UPDATE week_points SET listed = ?3 WHERE week = ?1 AND device = ?2').bind(row.week, device, listed));
        statements.push(histStep(row.week, row.points, listed ? 1 : -1), histClean(row.week));
      }
      await db.batch(statements);
    },
    async addWeekPoints({ week, device, points, at, listed }) {
      const old = await db.prepare('SELECT points, listed FROM week_points WHERE week = ?1 AND device = ?2').bind(week, device).first();
      const total = (old?.points || 0) + points;
      const statements = [db.prepare(`INSERT INTO week_points (week, device, points, days, reached, listed) VALUES (?1, ?2, ?3, 1, ?4, ?5)
        ON CONFLICT(week, device) DO UPDATE SET points = points + ?3, days = days + 1, reached = ?4, listed = ?5`).bind(week, device, points, at, listed ? 1 : 0)];
      if (old?.listed) statements.push(histStep(week, old.points, -1));
      if (listed) statements.push(histStep(week, total, 1));
      statements.push(histClean(week));
      await db.batch(statements);
    },
    async weekEntry(week, device) {
      const row = await db.prepare('SELECT points, days, reached, listed FROM week_points WHERE week = ?1 AND device = ?2').bind(week, device).first();
      return row ? { points: row.points, days: row.days, reached: row.reached, listed: Boolean(row.listed) } : null;
    },
    async weekTop(week, limit) {
      const { results = [] } = await db.prepare(`SELECT w.device, w.points, w.reached, p.nickname FROM week_points w JOIN players p ON p.device = w.device
        WHERE w.week = ?1 AND w.listed = 1 ORDER BY w.points DESC, w.reached ASC, w.device ASC LIMIT ?2`).bind(week, limit).all();
      return results;
    },
    async weekHist(week) {
      const { results = [] } = await db.prepare('SELECT points, n FROM week_hist WHERE week = ?1 AND n > 0 ORDER BY points DESC').bind(week).all();
      return results;
    },
    async weekAround(week, me, n) {
      const [above, below] = await db.batch([
        db.prepare(`SELECT w.device, w.points, w.reached, p.nickname FROM week_points w JOIN players p ON p.device = w.device
          WHERE w.week = ?1 AND w.listed = 1 AND (w.points > ?2 OR (w.points = ?2 AND (w.reached < ?3 OR (w.reached = ?3 AND w.device < ?4))))
          ORDER BY w.points ASC, w.reached DESC, w.device DESC LIMIT ?5`).bind(week, me.points, me.reached, me.device, n),
        db.prepare(`SELECT w.device, w.points, w.reached, p.nickname FROM week_points w JOIN players p ON p.device = w.device
          WHERE w.week = ?1 AND w.listed = 1 AND (w.points < ?2 OR (w.points = ?2 AND (w.reached > ?3 OR (w.reached = ?3 AND w.device > ?4))))
          ORDER BY w.points DESC, w.reached ASC, w.device ASC LIMIT ?5`).bind(week, me.points, me.reached, me.device, n),
      ]);
      return { above: [...(above.results || [])].reverse(), below: below.results || [] };
    },
    async deleteDevice(device) {
      const { results = [] } = await db.prepare('SELECT week, points, listed FROM week_points WHERE device = ?1').bind(device).all();
      const statements = [];
      for (const row of results) if (row.listed) statements.push(histStep(row.week, row.points, -1), histClean(row.week));
      statements.push(
        db.prepare('DELETE FROM week_points WHERE device = ?1').bind(device),
        db.prepare('DELETE FROM players WHERE device = ?1').bind(device),
        db.prepare('DELETE FROM submissions WHERE device = ?1').bind(device),
        db.prepare('DELETE FROM starts WHERE device = ?1').bind(device),
        db.prepare("DELETE FROM rate WHERE k LIKE 'dev:' || ?1 || ':%'").bind(device),
      );
      await db.batch(statements);
    },
    async hit(key, exp) {
      const row = await db.prepare('INSERT INTO rate (k, n, exp) VALUES (?1, 1, ?2) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n').bind(key, exp).first();
      return row?.n ?? 1;
    },
    // Daily: the counters past their hour, starts older than 3 days, submissions older than 8, weeks older than 10.
    async cleanup(now) {
      await db.batch([
        db.prepare('DELETE FROM rate WHERE exp < ?1').bind(now),
        db.prepare('DELETE FROM starts WHERE date < ?1').bind(dateKeyOf(now - 3 * DAY)),
        db.prepare('DELETE FROM submissions WHERE date < ?1').bind(dateKeyOf(now - 8 * DAY)),
        db.prepare('DELETE FROM week_points WHERE week < ?1').bind(dateKeyOf(now - 70 * DAY)),
        db.prepare('DELETE FROM week_hist WHERE week < ?1').bind(dateKeyOf(now - 70 * DAY)),
      ]);
    },
  };
}
