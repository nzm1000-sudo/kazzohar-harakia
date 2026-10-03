-- האתגר העולמי — the D1 schema. No personal data: a device is a random id made on the phone; a nickname is chosen by
-- the player for the board (opt-in); an IP is never stored (rate counters hold a keyed hash of it, for two hours).
-- Every global number is a counter updated on each submission — the reads are a row or a hundred, never a scan.

-- The server's start of a day's game (one per device and day; the first start stands). Kept 3 days.
CREATE TABLE IF NOT EXISTS starts (
  device TEXT NOT NULL,
  date TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  PRIMARY KEY (device, date)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS starts_by_date ON starts (date);

-- One submission per device and day (the second is refused). Kept 8 days — after that only the day's counters remain.
CREATE TABLE IF NOT EXISTS submissions (
  device TEXT NOT NULL,
  date TEXT NOT NULL,
  correct INTEGER NOT NULL,
  points INTEGER NOT NULL,
  verified INTEGER NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (device, date)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS submissions_by_date ON submissions (date);

-- The day's counters: n answered; c0…c4 right on each of the five questions; h0…h5 answered exactly k right.
CREATE TABLE IF NOT EXISTS day_stats (
  date TEXT PRIMARY KEY,
  n INTEGER NOT NULL DEFAULT 0,
  c0 INTEGER NOT NULL DEFAULT 0, c1 INTEGER NOT NULL DEFAULT 0, c2 INTEGER NOT NULL DEFAULT 0, c3 INTEGER NOT NULL DEFAULT 0, c4 INTEGER NOT NULL DEFAULT 0,
  h0 INTEGER NOT NULL DEFAULT 0, h1 INTEGER NOT NULL DEFAULT 0, h2 INTEGER NOT NULL DEFAULT 0, h3 INTEGER NOT NULL DEFAULT 0, h4 INTEGER NOT NULL DEFAULT 0, h5 INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;

-- A player who chose a nickname (unique by its key: case, final letters and spaces ignored), and the board opt-in.
CREATE TABLE IF NOT EXISTS players (
  device TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  nick_key TEXT NOT NULL UNIQUE,
  board INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL
) WITHOUT ROWID;

-- The week's points (Sunday's date names the week), from verified submissions only. `listed`: on the board.
CREATE TABLE IF NOT EXISTS week_points (
  week TEXT NOT NULL,
  device TEXT NOT NULL,
  points INTEGER NOT NULL,
  days INTEGER NOT NULL,
  reached INTEGER NOT NULL,
  listed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (week, device)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS week_rank ON week_points (week, listed, points DESC, reached, device);
CREATE INDEX IF NOT EXISTS week_by_device ON week_points (device);

-- How many listed players hold each point total in a week — a place is one sum over at most ~85 rows.
CREATE TABLE IF NOT EXISTS week_hist (
  week TEXT NOT NULL,
  points INTEGER NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (week, points)
) WITHOUT ROWID;

-- Write limits (per hashed IP per hour, per device per day). Swept daily.
CREATE TABLE IF NOT EXISTS rate (
  k TEXT PRIMARY KEY,
  n INTEGER NOT NULL,
  exp INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS rate_by_exp ON rate (exp);
