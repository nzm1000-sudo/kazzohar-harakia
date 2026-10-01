// שעשועון טריוויה יהודי — a game left in the middle comes back where it was. Leaving the quiz (another screen of the
// app, another app, the phone locked, even the WebView reclaimed by iOS) and returning within RESUME_WINDOW_MS resumes the
// same game: the same mode, step, question, answers so far, lifelines, the clock's seconds as they were when he left (the
// clock never runs while he is away), the verdict and "הסבר קצר" if they were on screen, and a finished game's results.
// After the window the game starts afresh, cleanly.
//
// One snapshot on this device (QUIZ_SESSION_KEY, localStorage): plain serialisable state — question ids, never the
// question objects, and never anything about the progress record (kz-quiz-v1). The progress record is written as each
// answer is given, so a resumed game re-applies nothing: no answer, no game end and no daily-round result counts twice.
// A snapshot from another version of this format, from a different question bank, broken, or naming a question that is
// no longer in the bank, is discarded. Every read and write is guarded (a storage that throws is a game that simply does
// not resume).
import { ACHIEVEMENTS } from './achievements.mjs';
import { hashString } from './ladder.mjs';

export const QUIZ_SESSION_KEY = 'kz-quiz-session-v1';
export const SESSION_SNAPSHOT_VERSION = 1;
export const RESUME_WINDOW_MS = 10 * 60 * 1000;
export const LADDER_KINDS = ['ladder', 'daily'];
export const PLAY_KINDS = ['play', 'review', 'single'];
export const SESSION_KINDS = [...LADDER_KINDS, ...PLAY_KINDS];
// The ladder's phases that are a game in progress or finished (the intro and "no questions" are never kept).
export const LADDER_PHASES = ['ask', 'confirm', 'suspense', 'right', 'wrong', 'end'];
const LADDER_STATUSES = ['playing', 'won', 'lost', 'walked'];
const FEEDBACKS = ['right', 'wrong', 'timeout'];

const storageOf = storage => { if (storage !== undefined) return storage; try { return globalThis.localStorage || null; } catch { return null; } };
const isObj = v => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const isIds = v => Array.isArray(v) && v.every(x => typeof x === 'string');
const isCount = v => Number.isInteger(v) && v >= 0;

// The bank a snapshot was made with: its size and a hash of its ids, in order (computed once per loaded bank).
const signatures = new WeakMap();
export function bankSignature(bank) {
  if (!bank || !Array.isArray(bank.questions)) return '';
  if (signatures.has(bank)) return signatures.get(bank);
  const sig = `${bank.questions.length}:${hashString(bank.questions.map(q => q.id).join('|')).toString(36)}`;
  signatures.set(bank, sig);
  return sig;
}

// The snapshot of a game on screen. `state` is the view's own (see ladderState / playState below).
export function makeSnapshot({ kind, route, bank, state, now = Date.now() }) {
  return { v: SESSION_SNAPSHOT_VERSION, kind, route, bank: bankSignature(bank), leftAt: now, state };
}

export function saveSession(snapshot, storage) {
  const s = storageOf(storage);
  try { s?.setItem(QUIZ_SESSION_KEY, JSON.stringify(snapshot)); return true; } catch { return false; }
}
export function clearSession(storage) {
  const s = storageOf(storage);
  try { s?.removeItem(QUIZ_SESSION_KEY); return true; } catch { return false; }
}

// The kept snapshot and what it is: 'none' (nothing, broken, another version) · 'resume' (left less than
// RESUME_WINDOW_MS ago) · 'expired' (left longer ago, or a clock that went backwards). Pure: nothing is removed here
// (decideResume says when to clear).
export function readSession({ storage, now = Date.now() } = {}) {
  let snapshot = null;
  let raw = null;
  try {
    raw = storageOf(storage)?.getItem(QUIZ_SESSION_KEY) ?? null;
    snapshot = raw ? JSON.parse(raw) : null;
  } catch { snapshot = null; }
  if (!isObj(snapshot)) return { status: 'none', snapshot: null, stale: Boolean(raw) };
  if (snapshot.v !== SESSION_SNAPSHOT_VERSION || !SESSION_KINDS.includes(snapshot.kind) || typeof snapshot.route !== 'string' || !isObj(snapshot.state)
    || !Number.isFinite(snapshot.leftAt)) return { status: 'none', snapshot: null, stale: true };
  const away = now - snapshot.leftAt;
  if (away < 0 || away >= RESUME_WINDOW_MS) return { status: 'expired', snapshot, stale: true };
  return { status: 'resume', snapshot, stale: false };
}

export const isFinished = snapshot => Boolean(snapshot?.state?.ended);

// Whether a snapshot can be played on this bank: the same bank, and every question it names is in it.
export function validForBank(snapshot, bank) {
  if (!snapshot || !bank?.byId || snapshot.bank !== bankSignature(bank)) return false;
  const st = snapshot.state;
  const has = id => typeof id === 'string' && bank.byId.has(id);
  if (LADDER_KINDS.includes(snapshot.kind)) {
    const l = st.ladder;
    if (!LADDER_PHASES.includes(st.phase) || !isObj(l) || !LADDER_STATUSES.includes(l.status) || !isCount(l.climbed) || l.climbed > 15
      || !isIds(l.asked) || !isIds(l.skipped) || !Array.isArray(l.results) || !isObj(l.used) || !Array.isArray(l.removed)) return false;
    if (l.kind !== snapshot.kind) return false;
    if (snapshot.kind === 'daily' && typeof st.day !== 'string') return false;
    if (st.phase === 'end') return isObj(st.ended) && isObj(st.ended.summary);
    if (!has(st.questionId)) return false;
    // Waiting for (or holding) the answer: a game still on, the question not asked yet. After the verdict: it was asked.
    if (st.phase === 'right' || st.phase === 'wrong') return l.asked.includes(st.questionId);
    return l.status === 'playing' && !l.asked.includes(st.questionId);
  }
  const s = st.session;
  if (!isObj(s) || !isIds(s.asked) || !Array.isArray(s.results) || !isCount(s.size) || !Number.isFinite(s.points)) return false;
  if (st.ended) return isObj(st.ended.summary);
  if (!has(st.questionId)) return false;
  if (st.feedback !== null && !FEEDBACKS.includes(st.feedback)) return false;
  // Answered: the question is the session's last asked; waiting: it is not asked yet.
  return st.feedback ? s.asked[s.asked.length - 1] === st.questionId : !s.asked.includes(st.questionId);
}

// On opening a game route with the bank loaded: resume (the snapshot), or start fresh — and whether the kept snapshot
// should be cleared, and whether to go to the quiz's home instead (a finished game whose window has passed).
export function decideResume(found, { route, bank }) {
  const snap = found?.snapshot || null;
  if (!found || found.status === 'none') return { resume: null, clear: Boolean(found?.stale), home: false };
  if (snap.route !== route) return { resume: null, clear: found.status === 'expired', home: false };
  if (found.status === 'expired') return { resume: null, clear: true, home: isFinished(snap) };
  if (!validForBank(snap, bank)) return { resume: null, clear: true, home: false };
  return { resume: snap, clear: false, home: false };
}

// Entering the quiz at its home with a game still in progress (left less than the window ago): the game's route.
export function entryRoute(found) {
  return found?.status === 'resume' && !isFinished(found.snapshot) ? found.snapshot.route : null;
}

// The clock's seconds on return: as they were (at least one, so a question left at its last second can still be met).
export function resumeSeconds(remaining, total) {
  if (remaining === null || remaining === undefined) return total;
  const n = Math.floor(Number(remaining));
  return Number.isFinite(n) ? Math.min(total, Math.max(1, n)) : total;
}

// Achievements are kept by id (their tests are functions) and found again on return.
export const earnedIds = earned => (earned || []).map(a => a?.id).filter(Boolean);
export const earnedFromIds = ids => (Array.isArray(ids) ? ids.map(id => ACHIEVEMENTS.find(a => a.id === id)).filter(Boolean) : []);

// The ladder's (and the challenge's) game as kept, and back.
export function ladderState({ day, ladder, question, phase, selected, walkAsk, lastResult, timedOut, remaining, ended }) {
  if (!ladder || !LADDER_PHASES.includes(phase)) return null;
  if (phase === 'end' && !ended) return null;
  if (phase !== 'end' && !question) return null;
  return {
    day, ladder, questionId: question?.id || null, phase, selected: Number.isInteger(selected) ? selected : null, walkAsk: Boolean(walkAsk),
    lastResult: lastResult || null, timedOut: Boolean(timedOut), remaining: Number.isFinite(remaining) ? remaining : null,
    ended: ended ? { summary: ended.summary, earned: earnedIds(ended.earned), newBest: Boolean(ended.newBest), best: ended.best ?? null } : null,
  };
}
export function restoreLadder(state, bank) {
  return {
    day: state.day, ladder: state.ladder, question: state.questionId ? bank.byId.get(state.questionId) || null : null, phase: state.phase,
    selected: state.selected, walkAsk: state.walkAsk, lastResult: state.lastResult, timedOut: state.timedOut, remaining: state.remaining,
    ended: state.ended ? { ...state.ended, earned: earnedFromIds(state.ended.earned) } : null,
  };
}

// Free practice, the review of mistakes and a single question, as kept, and back. An empty end ("no questions") is
// never kept.
export function playState({ mode, singleId, session, question, selected, feedback, remaining, notes, ended }) {
  if (!session || ended?.empty) return null;
  if (!ended && !question) return null;
  return {
    mode, singleId: singleId ?? null, session, questionId: question?.id || null, selected: Number.isInteger(selected) ? selected : null,
    feedback: FEEDBACKS.includes(feedback) ? feedback : null, remaining: Number.isFinite(remaining) ? remaining : null, notes: notes || [],
    ended: ended ? { ...ended, earned: earnedIds(ended.earned) } : null,
  };
}
export function restorePlay(state, bank) {
  return {
    session: state.session, question: state.questionId ? bank.byId.get(state.questionId) || null : null, selected: state.selected,
    feedback: state.feedback, remaining: state.remaining, notes: Array.isArray(state.notes) ? state.notes : [],
    ended: state.ended ? { ...state.ended, earned: earnedFromIds(state.ended.earned) } : null,
  };
}
