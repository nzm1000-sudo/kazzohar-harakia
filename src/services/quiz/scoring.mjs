// בחן אותי — points and the adaptive level. Pure. Points are only the quiz's own measure of progress (they grow the
// Magen David); they have no money value, buy nothing, and never touch the spiritual circle (the ring).

export const BASE_POINTS = { 1: 10, 2: 15, 3: 20 };
export const RUN_BONUS_STEP = 2; // a quiet bonus for a run of correct answers within one session …
export const RUN_BONUS_CAP = 6; // … never more than this
export const RAISE_AFTER = 3; // משתנה: three correct in a row at a level → one step up
export const LOWER_AFTER = 2; // two misses in a row → one step down

// Points for one answer: nothing for a miss (never a penalty), the level's base for a correct answer, plus the run bonus
// from the third consecutive correct answer on.
export function pointsFor({ correct, difficulty, run = 0 }) {
  if (!correct) return 0;
  const base = BASE_POINTS[difficulty] || BASE_POINTS[1];
  const bonus = Math.min(RUN_BONUS_CAP, Math.max(0, run - 2) * RUN_BONUS_STEP);
  return base + bonus;
}

// The adaptive level after an answer: { difficulty, up, down } where up/down count the current streaks.
export function adaptAfter(state, correct) {
  const difficulty = Math.min(3, Math.max(1, Number(state?.difficulty) || 1));
  let up = Number(state?.up) || 0;
  let down = Number(state?.down) || 0;
  if (correct) { up += 1; down = 0; } else { down += 1; up = 0; }
  if (up >= RAISE_AFTER && difficulty < 3) return { difficulty: difficulty + 1, up: 0, down: 0 };
  if (up >= RAISE_AFTER) return { difficulty, up: RAISE_AFTER, down: 0 };
  if (down >= LOWER_AFTER && difficulty > 1) return { difficulty: difficulty - 1, up: 0, down: 0 };
  return { difficulty, up, down };
}
