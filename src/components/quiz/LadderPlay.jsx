import { useEffect, useRef, useState } from 'react';
import { HDate } from '@hebcal/core';
import MagenDavid from './MagenDavid.jsx';
import LadderView from './LadderView.jsx';
import { publicQuestion } from './QuestionView.jsx';
import { Lozenge, LadderColumn, LadderRail, SafeMark, LifelineGlyph, LivesMarks, formatPoints } from './LadderParts.jsx';
import ShareImageButton from '../ShareImageButton.jsx';
import { useStudyTimer } from '../../hooks.jsx';
import { categoryLabel } from '../../services/quiz/catalog.mjs';
import { LADDER_SIZE, LADDER_STEPS, LADDER_TOP, LIFELINES, SAFE_STEPS, createLadder, ladderPick, answerLadder, walkAway, applyFifty, applyAudience, applySwap,
  setAside, clearAids, ladderSummary, dailyPlan, seededRandom, pointsAt, safeFloor, nextSafeStep, currentStep, dailyShareText, TRACKS, BEGINNER_LIVES, trackOf, livesLeft, livesTotal, runOf } from '../../services/quiz/ladder.mjs';
import { applyAnswer, applySessionEnd, applyLadderEnd, dailyResult, windowKey, windowOf, windowLabel, flagQuestion, readLadderTrack, writeLadderTrack } from '../../services/quiz/store.mjs';
import { TIMER_SECONDS, explanationFor } from '../../services/quiz/clock.mjs';
import { useQuestionClock, useAutoAdvance } from './QuizClock.jsx';
import { useSessionKeeper } from './useSessionKeeper.js';
import { ladderState, restoreLadder, resumeSeconds } from '../../services/quiz/sessionResume.mjs';
import { sendMistakeToReview, reportReviewResult } from '../../services/quiz/reviewBridge.mjs';
import { playSound, lightHaptic, motionReduced } from '../../services/quiz/feel.mjs';
import { levelUpOf } from '../../services/quiz/records.mjs';
import { CountUp, ProgressRing, ComboMeter, ShareGrid, NextDaily, Medal, AchievementName } from './ArenaParts.jsx';
import { ACHIEVEMENTS } from '../../services/quiz/achievements.mjs';

// הסולם and the challenge (אתגר יומי — renewed every four hours: store.mjs windowKey). The game's rules are
// services/quiz/ladder.mjs; this keeps the flow: intro → a question (with its clock, when on) → (תשובה סופית?) → a held
// breath → the verdict (and "הסבר קצר", waiting for the tap; else on by itself after the beat) → the next step … → the end.
export const QUIZ_NAME = 'שעשועון טריוויה יהודי';
export const SUSPENSE_MS = 1500;
const nf = new Intl.NumberFormat('he-IL');

// The Hebrew date of a day ('2026-10-01') or of a round ('2026-10-01@12').
export function hebrewDateLabel(day) {
  try { const [y, m, d] = String(day).split('@')[0].split('-').map(Number); return new HDate(new Date(y, m - 1, d, 12)).renderGematriya(true); } catch { return day; }
}

export function dailyShareSpec({ day, result }) {
  const dateLabel = hebrewDateLabel(day);
  const marks = result.marks.map(m => (m === 'right' ? '◆' : m === 'wrong' ? '◇' : '·')).join(' ');
  const round = windowLabel(day);
  return {
    kind: 'quiz', eyebrow: `${QUIZ_NAME} · אתגר יומי`, title: dateLabel,
    lines: [...(round ? [round] : []), result.status === 'won' ? 'סיימתי את הסולם — ט״ו מעלות' : `עליתי ${result.climbed} מתוך ${LADDER_SIZE} מעלות`, marks, `${nf.format(result.banked)} נקודות`],
    source: 'אותן חמש עשרה שאלות לכולם בסבב — בלי תשובות, רק הדרך',
  };
}
// The round in words for the screen: 'סבב 4 · 12:00–16:00' (the hours kept left-to-right).
export function RoundLabel({ day }) {
  const w = windowOf(day);
  if (!w) return null;
  return <span className="qz-round">סבב {w.round} · <bdi dir="ltr">{w.hours}</bdi></span>;
}

export default function LadderPlay({ quiz, setQuiz, bank, go, tzid, daily = false, onHome: leaveHome, day: dayProp = null, initialPhase = null, route = '', resume = null, onExpire }) {
  // A game left in the middle and resumed (services/quiz/sessionResume.mjs): its state as it was, once.
  const [back] = useState(() => (resume && bank ? restoreLadder(resume.state, bank) : null));
  // The challenge's round is fixed when the screen opens and again when a game starts (a game keeps its round to the end).
  const [day, setDay] = useState(() => back?.day || dayProp || windowKey());
  const quizRef = useRef(quiz);
  quizRef.current = quiz;
  const prefs = quiz.prefs;
  const done = daily ? dailyResult(quiz, day) : null;
  const [ladder, setLadderRaw] = useState(back?.ladder || null);
  const ladderRef = useRef(back?.ladder || null);
  const setLadder = l => { ladderRef.current = l; setLadderRaw(l); };
  const [question, setQuestion] = useState(back?.question || null);
  const [phase, setPhase] = useState(back?.phase || initialPhase || 'intro');
  const [selected, setSelected] = useState(back ? back.selected : null);
  const [walkAsk, setWalkAsk] = useState(back?.walkAsk || false);
  const [ended, setEnded] = useState(back?.ended || null);
  const [lastResult, setLastResult] = useState(back?.lastResult || null);
  const [timedOut, setTimedOut] = useState(back?.timedOut || false);
  // The track chosen at the way in (מסלול אלוף · מסלול למתחילים), remembered on this device (never chosen: a new player
  // starts on the beginner's, one who has played the champion's stays on it); the challenge is always the champion's.
  const [track, setTrackRaw] = useState(() => readLadderTrack(undefined, quiz));
  const setTrack = t => { setTrackRaw(t); writeLadderTrack(t); };
  const timers = useRef([]);
  const later = (fn, ms) => { const h = setTimeout(fn, ms); timers.current.push(h); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const playing = Boolean(ladder && question && !ended && phase !== 'intro');
  useStudyTimer({ workId: 'quiz-bechan-oti', workTitle: QUIZ_NAME, unitId: daily ? 'daily' : prefs.category, unitLabel: daily ? 'אתגר יומי' : categoryLabel(prefs.category) || 'הסולם', category: 'torah_study', source: 'quiz', tzid, enabled: playing });

  const pickFor = l => { const q = quizRef.current; return ladderPick(l, bank, { seen: q.seen, flagged: q.flagged }); };
  const begin = () => {
    const q = quizRef.current;
    const key = dayProp || windowKey();
    if (daily && dailyResult(q, key)) { setDay(key); setPhase('intro'); return; }
    setDay(key);
    const l = createLadder({ category: q.prefs.category, skill: q.adaptive, daily: daily ? key : null, plan: daily ? dailyPlan(bank, key) : null, track: daily ? 'champion' : track });
    const first = pickFor(l);
    setLadder(l); setQuestion(first); setSelected(null); setWalkAsk(false); setEnded(null); setLastResult(null); setTimedOut(false);
    setPhase(first ? 'ask' : 'empty');
  };
  // Lifelines in the daily challenge are seeded too: everyone who asks the audience at a step sees the same.
  const rngFor = id => (daily ? seededRandom(`kz-daily:${day}:${ladderRef.current?.climbed}:${question?.id}:${id}`) : Math.random);

  const lockIn = choice => {
    setSelected(choice);
    setPhase('suspense');
    const quiet = motionReduced();
    if (prefs.sound && !quiet) [0, 380, 760, 1140].forEach(ms => later(() => playSound('tick', true), ms));
    later(() => verdict(choice), quiet ? 0 : SUSPENSE_MS);
  };
  const choose = i => {
    if (!(phase === 'ask' || phase === 'confirm')) return;
    if (prefs.confirm) { setSelected(i); setPhase('confirm'); return; }
    lockIn(i);
  };
  const verdict = (choice, { late = false } = {}) => {
    const current = ladderRef.current;
    const { ladder: next, result } = answerLadder(current, question, choice);
    if (!result) return;
    const q = quizRef.current;
    const updated = applyAnswer(q, { question, correct: result.correct, points: result.points });
    const wasMistake = q.mistakes[question.id];
    if (result.correct) { if (wasMistake) reportReviewResult(wasMistake.reviewId || `quiz:${question.id}`, true); }
    else sendMistakeToReview(question).then(reviewId => {
      if (reviewId) setQuiz(cur => (cur.mistakes[question.id] && cur.mistakes[question.id].reviewId !== reviewId ? { ...cur, mistakes: { ...cur.mistakes, [question.id]: { ...cur.mistakes[question.id], reviewId } } } : cur));
    });
    quizRef.current = updated;
    setQuiz(updated);
    setLadder(next);
    setLastResult(result);
    setTimedOut(late);
    setWalkAsk(false);
    setPhase(result.correct ? 'right' : 'wrong');
    const up = result.correct ? levelUpOf({ run: runOf(next), safe: result.safe, won: next.status === 'won' }) : null;
    if (!result.correct) playSound('low', prefs.sound);
    else if (next.status === 'won') playSound('rise', prefs.sound);
    else if (up) playSound('levelup', prefs.sound);
    else playSound(next.climbed >= 2 ? 'combo' : 'chime', prefs.sound, next.climbed);
    lightHaptic();
    if (up) later(lightHaptic, 140);
  };
  const advance = () => {
    const l = clearAids(ladderRef.current);
    if (l.status !== 'playing') { finish(l); return; }
    const following = pickFor(l);
    if (!following) { finish(walkAway(l)); return; }
    setLadder(l); setQuestion(following); setSelected(null); setTimedOut(false); setPhase('ask');
  };
  const lifeline = id => {
    const l = ladderRef.current;
    if (!l || !question || !(phase === 'ask' || phase === 'confirm')) return;
    if (id === 'fifty') { const next = applyFifty(l, question, rngFor(id)); setLadder(next); if (next.removed.includes(selected)) { setSelected(null); setPhase('ask'); } }
    if (id === 'audience') setLadder(applyAudience(l, question, rngFor(id)));
    if (id === 'swap') {
      const next = applySwap(l, question);
      const following = pickFor(next);
      if (!following) return;
      setLadder(next); setQuestion(following); setSelected(null); setPhase('ask');
    }
  };
  // "לא מתאימה": before the answer — set aside (no lifeline spent) and another of the same step takes its place; after
  // it — the answer stands. Either way it never comes back (שאלות שסימנתי).
  const flag = () => {
    if (!question) return;
    const id = question.id;
    quizRef.current = flagQuestion(quizRef.current, id);
    setQuiz(cur => flagQuestion(cur, id));
    if (phase === 'ask' || phase === 'confirm') {
      const next = setAside(ladderRef.current, question);
      const following = pickFor(next);
      setLadder(next);
      if (following) { setQuestion(following); setSelected(null); setPhase('ask'); } else finish(walkAway(next));
    }
  };
  const finish = l => {
    const summary = ladderSummary(l);
    const q = quizRef.current;
    if (!summary.answered) { setLadder(l); setEnded({ summary, earned: [], newBest: false }); setPhase('end'); return; }
    const beginner = summary.track === 'beginner';
    const before = (beginner ? q.ladder?.beginner?.best : q.ladder?.best) || 0;
    const withLadder = applyLadderEnd(q, summary);
    const { state, earned } = applySessionEnd(withLadder, summary);
    quizRef.current = state;
    setQuiz(state);
    setLadder(l);
    setEnded({ summary, earned, newBest: summary.climbed > before && summary.climbed > 0, best: Math.max(before, summary.climbed), beginner });
    setPhase('end');
  };

  // Left during the held breath: the answer was locked in — its verdict comes now (nothing was counted yet).
  useEffect(() => { if (back?.phase === 'suspense' && Number.isInteger(back.selected)) later(() => verdict(back.selected), SUSPENSE_MS); }, []);

  // The clock (when on): from 30 at each question, counting while it waits for an answer (ask / תשובה סופית?); at 0 the
  // question is lost as not answered — no held breath, nothing revealed (as a miss, per the game's rules).
  const remaining = useQuestionClock({ enabled: Boolean(prefs.timer), initial: back && back.remaining !== null ? resumeSeconds(back.remaining, TIMER_SECONDS) : null, running: Boolean(ladder && question && !ended) && (phase === 'ask' || phase === 'confirm'),
    resetKey: question?.id, onTimeout: () => { if (phase === 'ask' || phase === 'confirm') { setSelected(null); verdict(null, { late: true }); } } });
  // "הסבר קצר" after the verdict: waits for the tap; without one the game moves on by itself after the beat.
  const answeredNow = phase === 'right' || phase === 'wrong';
  const explanation = answeredNow && question ? explanationFor({ note: question.note, correct: phase === 'right', explain: prefs.explain, reveal: prefs.reveal }) : null;
  useAutoAdvance({ active: Boolean(ladder && question && !ended) && answeredNow && !walkAsk, wait: Boolean(explanation), key: question?.id, onAdvance: advance });
  // The game is kept as it goes, so leaving the quiz and coming back resumes it (services/quiz/sessionResume.mjs).
  const abandon = useSessionKeeper({ kind: daily ? 'daily' : 'ladder', route, bank, onExpire: () => onExpire?.(Boolean(ended)),
    build: () => ladderState({ day, ladder, question, phase, selected, walkAsk, lastResult, timedOut, remaining, ended }) });
  // Back to the quiz's home on purpose: the game is not kept.
  const onHome = () => { abandon(); leaveHome?.(); };

  if (!bank) return <section className="quiz-page" aria-busy="true"><p className="quiz-loading">טוען שאלות…</p></section>;
  if (daily && done && phase !== 'end') return <DailyDone quiz={quiz} day={day} result={done} onHome={leaveHome} go={go} onRoundOver={() => { if (!dayProp) setDay(windowKey()); setPhase('intro'); }} />;
  if (phase === 'intro') return <Intro daily={daily} day={day} quiz={quiz} track={track} onTrack={setTrack} onStart={begin} onHome={leaveHome} />;
  if (phase === 'empty') return <section className="quiz-page quiz-end" aria-labelledby="qz-empty-title">
    <header className="quiz-head quiz-head-plain"><h1 id="qz-empty-title" className="quiz-title quiz-title-sm">אין כרגע שאלות לסולם בתחום הזה</h1></header>
    <div className="quiz-start"><button type="button" className="quiz-primary" onClick={leaveHome}>לשעשועון</button></div>
  </section>;
  if (phase === 'end' && ended) return <LadderEnd quiz={quiz} ended={ended} daily={daily} day={day} onAgain={daily ? null : begin} onHome={onHome} go={go} />;
  if (!ladder || !question) return <section className="quiz-page" aria-busy="true"><p className="quiz-loading">טוען שאלות…</p></section>;

  const step = currentStep({ climbed: lastResult && (phase === 'right' || phase === 'wrong') ? lastResult.step - 1 : ladder.climbed });
  const climbedShown = ladder.climbed;
  const currentShown = ladder.status === 'playing' ? (phase === 'right' ? null : ladder.climbed + 1) : null;
  const just = phase === 'right' && lastResult ? lastResult.step : null;
  const verdictLine = lastResult && (phase === 'right' || phase === 'wrong') ? verdictWords(lastResult) : '';
  const verdictText = phase === 'wrong' && timedOut ? 'הזמן עבר' : null;
  const levelUp = phase === 'right' && lastResult ? levelUpOf({ run: runOf(ladder), safe: lastResult.safe, won: ladder.status === 'won' }) : null;
  const run = phase === 'wrong' ? 0 : runOf(ladder);
  // מסלול למתחילים: after a mistake with lives left, the same step again with another question.
  const again = phase === 'wrong' && ladder.status === 'playing';
  const nextLabel = ladder.status === 'won' ? 'לסיום הסולם' : again ? `לשאלה אחרת במדרגה ${LADDER_STEPS[ladder.climbed].numeral}` : ladder.status === 'playing' ? `למדרגה ${LADDER_STEPS[ladder.climbed].numeral}` : 'לסיכום';
  const lives = trackOf(ladder) === 'beginner' ? { left: livesLeft(ladder), total: livesTotal(ladder) } : null;
  return <section className={`quiz-page quiz-ladder${daily ? ' is-daily' : ''}`} aria-label={daily ? `${QUIZ_NAME} — אתגר יומי` : `${QUIZ_NAME} — הסולם`}>
    <div className="qz-layout">
      <div className="qz-main">
        <RailBar climbed={climbedShown} current={currentShown} just={just} daily={daily} day={day} run={run} lives={lives} />
        <LadderView question={publicQuestion(question)} step={step} phase={phase} selected={selected}
          revealed={prefs.reveal && phase === 'wrong' ? question.answer : null}
          removed={ladder.removed} audience={ladder.audience} used={ladder.used} categoryText={categoryLabel(question.category)}
          verdictLine={verdictLine} verdictText={verdictText} levelUp={levelUp} banked={pointsAt(ladder.climbed)} nextLabel={nextLabel} walkAsk={walkAsk}
          timer={prefs.timer ? { remaining, total: TIMER_SECONDS } : null} explanation={explanation}
          onChoose={choose} onConfirm={() => lockIn(selected)} onCancel={() => { setSelected(null); setPhase('ask'); }}
          onLifeline={lifeline} onNext={advance} onFlag={flag}
          onWalk={ladder.climbed > 0 || daily ? () => setWalkAsk(true) : onHome} onWalkCancel={() => setWalkAsk(false)} onWalkConfirm={() => { setWalkAsk(false); finish(walkAway(ladderRef.current)); }} />
      </div>
      <aside className="qz-side" aria-label="הסולם">
        <LadderColumn climbed={climbedShown} current={currentShown} just={just} />
      </aside>
    </div>
  </section>;
}

function verdictWords(r) {
  // מסלול למתחילים: a mistake with lives left — the lives left said at once (the verdict is a polite live region).
  if (!r.correct && r.status === 'playing') return `${r.lives === 1 ? 'נותרה עוד טעות אחת' : r.lives === 2 ? 'נותרו עוד שתי טעויות' : `נותרו עוד ${nf.format(r.lives)} טעויות`} · ממשיכים באותה מדרגה`;
  if (!r.correct && r.track === 'beginner') return `שלוש הטעויות נוצלו · ${r.banked ? `נשארות לך ${nf.format(r.banked)} נקודות — מדרגת הביטחון` : 'הסולם מתחיל מחדש בפעם הבאה'}`;
  if (!r.correct) return r.banked ? `נשארות לך ${nf.format(r.banked)} נקודות — מדרגת הביטחון` : 'הסולם מתחיל מחדש בפעם הבאה';
  if (r.status === 'won') return `ט״ו מעלות · ${nf.format(LADDER_TOP)} נקודות`;
  if (r.safe) return `מדרגת ביטחון — ${nf.format(r.banked)} נקודות שמורות`;
  return `עלית למדרגה ${LADDER_STEPS[r.step - 1].numeral} · ${nf.format(r.banked)} נקודות`;
}

// The phone's view of the ladder: the rail and one line; a tap opens the full ladder.
// Above it the HUD: the step in a ring of progress, the points counting up (with the step's gain flying off), the combo.
function RailBar({ climbed, current, just, daily, day, run = 0, lives = null }) {
  const [open, setOpen] = useState(false);
  const safe = safeFloor(climbed);
  const toSafe = nextSafeStep(climbed);
  const gain = just ? pointsAt(just) - pointsAt(just - 1) : 0;
  return <div className="qz-railbar">
    {daily ? <p className="qz-daily-tag">אתגר יומי · <RoundLabel day={day} /></p> : null}
    <div className="qz-hud">
      <span className="qz-hud-cell" aria-hidden="true">
        <ProgressRing value={climbed / LADDER_SIZE} className={just ? 'is-just' : ''}><b>{nf.format(current || climbed || 1)}</b></ProgressRing>
        <small>מדרגה</small>
      </span>
      <span className="qz-hud-cell qz-hud-score" aria-hidden="true">
        <CountUp value={pointsAt(climbed)} className="qz-hud-pts" />
        <small>נקודות</small>
        {gain ? <span key={just} className="qz-plus" dir="ltr">+{nf.format(gain)}</span> : null}
      </span>
      <span className="qz-hud-cell"><ComboMeter run={run} /></span>
    </div>
    {lives ? <LivesMarks left={lives.left} total={lives.total} /> : null}
    <button type="button" className="qz-railbtn" aria-expanded={open} aria-controls="qz-rail-ladder" onClick={() => setOpen(v => !v)}
      aria-label={`הסולם: ${climbed} מתוך ${LADDER_SIZE} מעלות, ${nf.format(pointsAt(climbed))} נקודות. ${open ? 'להסתיר' : 'להציג'} את הסולם`}>
      <LadderRail climbed={climbed} current={current} just={just} />
      <span className="qz-railtext" aria-hidden="true">
        <span>{safe ? <>בטוחות <b>{nf.format(safe)}</b></> : toSafe ? `ביטחון במדרגה ${LADDER_STEPS[toSafe - 1].numeral}` : ''}</span>
      </span>
    </button>
    {open ? <div id="qz-rail-ladder" className="qz-rail-ladder"><LadderColumn climbed={climbed} current={current} just={just} /></div> : null}
  </div>;
}

// The way in: the title, then at once the button that starts the climb ("לעלות בסולם") — first, in sight on entering —
// and below it the ladder with its fifteen steps' points and the rules.
function Intro({ daily, day, quiz, track = 'champion', onTrack, onStart, onHome }) {
  const titleRef = useRef(null);
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }); }, []);
  const cat = categoryLabel(quiz.prefs.category);
  return <section className="quiz-page quiz-ladder qz-intro" aria-labelledby="qz-intro-title">
    <button type="button" className="local-back quiz-quiet qz-back" onClick={onHome}>{QUIZ_NAME}</button>
    <header className="quiz-head qz-intro-head">
      <p className="quiz-kicker">{daily ? <>{hebrewDateLabel(day)} · <RoundLabel day={day} /></> : 'ט״ו המעלות'}</p>
      <h1 id="qz-intro-title" ref={titleRef} tabIndex={-1} className="quiz-title">{daily ? 'אתגר יומי' : 'הסולם'}</h1>
      <p className="quiz-tagline">{daily ? 'אותן חמש עשרה שאלות לכולם בסבב — הזדמנות אחת בכל ארבע שעות' : `חמש עשרה שאלות, מן הקלה אל הקשה${cat && quiz.prefs.category !== 'all' ? ` · ${cat}` : ''}`}</p>
    </header>
    <div className="quiz-start qz-intro-start">
      <Lozenge as="button" type="button" tip={22} glow className="qz-cta qz-cta-main" onClick={onStart}><span className="qz-cta-text">{daily ? 'לאתגר של הסבב' : 'לעלות בסולם'}</span></Lozenge>
      <small>{quiz.prefs.confirm ? 'כל תשובה נשאלת: ״תשובה סופית?״' : 'התשובה נבדקת מיד'}{quiz.prefs.timer ? ` · ${TIMER_SECONDS} שניות לשאלה` : ''}</small>
    </div>
    {daily ? null : <TrackChoice track={track} onTrack={onTrack} />}
    <div className="qz-intro-grid">
      <LadderColumn climbed={0} current={1} className="qz-ladder-intro" />
      <ul className="qz-rules">
        {!daily && track === 'beginner' ? <li><span className="qz-rule-glyph"><LivesMarks left={BEGINNER_LIVES} total={BEGINNER_LIVES} className="qz-lives-rule" /></span><span><b>מסלול למתחילים</b> — שלוש טעויות מותרות: אחרי טעות ממשיכים באותה מדרגה בשאלה אחרת; בטעות השלישית הסולם נעצר.</span></li> : null}
        <li><SafeMark size={16} /><span><b>מדרגות ביטחון</b> במדרגה {SAFE_STEPS[0]} ובמדרגה {SAFE_STEPS[1]}: טעות אחריהן משאירה את הנקודות שלהן.</span></li>
        {LIFELINES.map(l => <li key={l.id}><span className="qz-rule-glyph"><LifelineGlyph id={l.id} /></span><span><b>{l.label}</b> — {l.detail}. פעם אחת במשחק.</span></li>)}
        <li><span className="qz-rule-glyph" aria-hidden="true">◆</span><span><b>{'לסיים ולשמור'}</b> בכל רגע — הנקודות שצברת נשמרות.</span></li>
      </ul>
    </div>
  </section>;
}

// The two tracks: one compact, centred segmented choice (the app's SegmentedControl — the chosen sinks with a thin
// copper outline and copper words, never filled). A radio group: the arrows move between the two.
function TrackChoice({ track, onTrack }) {
  const refs = useRef([]);
  const onKey = (event, i) => {
    const dir = { ArrowLeft: 1, ArrowDown: 1, ArrowRight: -1, ArrowUp: -1 }[event.key];
    if (!dir) return;
    event.preventDefault();
    const j = (i + dir + TRACKS.length) % TRACKS.length;
    onTrack?.(TRACKS[j].id);
    refs.current[j]?.focus();
  };
  return <div className="seg qz-track" role="radiogroup" aria-label="מסלול">
    {TRACKS.map((t, i) => {
      const on = track === t.id;
      return <button key={t.id} ref={el => { refs.current[i] = el; }} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1}
        className={on ? 'is-on' : undefined} onClick={() => onTrack?.(t.id)} onKeyDown={event => onKey(event, i)}>
        <b>{t.name}</b><span className="visually-hidden"> · </span><small>{t.detail}</small>
      </button>;
    })}
  </div>;
}

function LadderEnd({ quiz, ended, daily, day, onAgain, onHome, go }) {
  const { summary, earned, newBest, best } = ended;
  const beginner = summary.track === 'beginner';
  const titleRef = useRef(null);
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }); }, []);
  const won = summary.status === 'won';
  const kicker = won ? 'סיום הסולם' : summary.status === 'walked' ? 'סיימת ושמרת' : 'הסולם נעצר';
  const result = daily ? dailyResult(quiz, day) : null;
  return <section className={`quiz-page quiz-end qz-end${won ? ' is-won' : ''}`} aria-labelledby="qz-end-title">
    <header className="quiz-head">
      <div className={`quiz-star${won ? ' qz-crown' : ''}`}>
        {won ? <svg className="qz-rays" viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">{Array.from({ length: 12 }, (_, i) => <line key={i} x1="0" y1="-64" x2="0" y2="-97" transform={`rotate(${i * 30})`} />)}</svg> : null}
        <MagenDavid points={quiz.points} size={won ? 168 : 132} variant={quiz.prefs.variant} alive />
      </div>
      <p className="quiz-kicker">{beginner ? `${kicker} · מסלול למתחילים` : kicker}</p>
      <h1 id="qz-end-title" ref={titleRef} tabIndex={-1} className="quiz-score">
        {won ? <b className="qz-won-title">ט״ו מעלות</b> : <><b>{nf.format(summary.climbed)}</b><span>{summary.climbed === 1 ? 'מעלה אחת' : 'מעלות'} מתוך {LADDER_SIZE}</span></>}
      </h1>
      <p className="quiz-gain qz-banked">{summary.banked ? <><CountUp from={0} value={summary.banked} ms={1100} className="qz-banked-n" /> נקודות{summary.status === 'lost' ? ' · מדרגת הביטחון' : ''}</> : 'מדרגת הביטחון הראשונה מחכה במדרגה ה׳'}</p>
      {won ? <p className="qz-verse">״מִי יַעֲלֶה בְהַר ה׳ וּמִי יָקוּם בִּמְקוֹם קָדְשׁוֹ״</p> : null}
      {newBest && !won ? <p className="quiz-evolved">{beginner ? 'שיא חדש למתחילים' : 'שיא חדש'} · {nf.format(best)} מעלות</p> : null}
    </header>
    <LadderRail marks={summary.marks} className="qz-rail-end" />
    {daily && result ? <DailyCard day={day} result={result} /> : null}
    {earned.length ? <ul className="quiz-earned" aria-label="הישגים חדשים">{earned.map(a => <li key={a.id}><Medal earned n={ACHIEVEMENTS.findIndex(x => x.id === a.id) + 1} /><AchievementName a={a} /><small>{a.detail}</small></li>)}</ul> : null}
    <div className="quiz-start quiz-end-actions">
      {onAgain ? <button type="button" className="quiz-primary quiz-primary-lg" onClick={onAgain}>סולם חדש</button> : <button type="button" className="quiz-primary" onClick={() => go('leatzmi/quiz/ladder', { replace: true })}>לסולם</button>}
      <button type="button" className="quiz-quiet" onClick={onHome}>לשעשועון</button>
    </div>
  </section>;
}

// The day's result: a clean card that can be shared (as an image or as words) — steps, points and marks; never a
// question or an answer.
export function DailyCard({ day, result, onRoundOver }) {
  const [said, setSaid] = useState('');
  const text = dailyShareText({ dateLabel: hebrewDateLabel(day), roundLabel: windowLabel(day), climbed: result.climbed, banked: result.banked, marks: result.marks, status: result.status });
  const shareWords = async () => {
    try {
      const { shareText } = await import('../leatzmi/common.jsx');
      const r = await shareText({ title: `${QUIZ_NAME} · אתגר יומי`, text });
      setSaid(r === 'copied' ? 'התוצאה הועתקה' : r === 'failed' ? 'לא ניתן היה לשתף' : '');
    } catch { setSaid('לא ניתן היה לשתף'); }
  };
  return <section className="qz-card" aria-labelledby="qz-card-title">
    <Lozenge className="qz-card-frame" tip={30}>
      <div className="qz-card-body">
        <p className="qz-card-eyebrow">אתגר יומי</p>
        <p className="qz-card-round"><RoundLabel day={day} /></p>
        <h2 id="qz-card-title" className="qz-card-date">{hebrewDateLabel(day)}</h2>
        <ShareGrid marks={result.marks} className="qz-grid-card" />
        <p className="qz-card-line">{result.status === 'won' ? 'כל ט״ו המעלות' : `${nf.format(result.climbed)} מתוך ${LADDER_SIZE} מעלות`}</p>
        <p className="qz-card-pts"><b>{nf.format(result.banked)}</b> נקודות</p>
      </div>
    </Lozenge>
    <div className="qz-card-actions">
      <ShareImageButton spec={() => dailyShareSpec({ day, result })} className="quiz-quiet qz-share" label="שיתוף כתמונה" />
      <span className="quiz-sep" aria-hidden="true" />
      <button type="button" className="quiz-quiet qz-share" onClick={shareWords}>שיתוף כטקסט</button>
    </div>
    <p className="qz-card-note" role="status">{said || 'התוצאה בלבד — בלי שאלות ובלי תשובות'}</p>
    <NextDaily className="qz-card-next" onDone={onRoundOver} />
  </section>;
}

function DailyDone({ quiz, day, result, onHome, go, onRoundOver }) {
  const titleRef = useRef(null);
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }); }, []);
  return <section className="quiz-page quiz-end qz-end" aria-labelledby="qz-daily-title">
    <button type="button" className="local-back quiz-quiet qz-back" onClick={onHome}>{QUIZ_NAME}</button>
    <header className="quiz-head quiz-head-plain">
      <p className="quiz-kicker">אתגר יומי</p>
      <h1 id="qz-daily-title" ref={titleRef} tabIndex={-1} className="quiz-title quiz-title-sm">האתגר של הסבב הושלם</h1>
      <p className="quiz-tagline">אתגר חדש נפתח בכל ארבע שעות</p>
    </header>
    <DailyCard day={day} result={result} onRoundOver={onRoundOver} />
    <div className="quiz-start quiz-end-actions">
      <button type="button" className="quiz-primary" onClick={() => go('leatzmi/quiz/ladder')}>לסולם</button>
      <button type="button" className="quiz-quiet" onClick={onHome}>לשעשועון</button>
    </div>
  </section>;
}
