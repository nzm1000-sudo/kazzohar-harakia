-- האתגר העולמי — the nickname may be changed at any time (owner, 2026-10-03), up to a few times a day.
--
-- Still one row per device (players.device), and still the UNIQUE index on the normalised nickname (players.nick_key —
-- case, niqqud, final letters and spaces ignored; 0001_init.sql). A change is ONE statement that rewrites the device's
-- row (an upsert, d1Store.mjs setNickname): the old key leaves the index in the same write, so the old name is free the
-- moment it changes, and a name another device holds fails the index ('taken') without touching anything. The board
-- rows (week_points) name the device, never the nickname, so the board and its history show the current nickname and
-- nothing is orphaned.
--
-- New here: the day (UTC days since the epoch) of the device's last nickname write and how many writes that day — the
-- daily limit is checked inside the same upsert. Existing rows start at 0/0 (no change counted yet).
ALTER TABLE players ADD COLUMN nick_day INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN nick_changes INTEGER NOT NULL DEFAULT 0;
