import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
import '@fontsource/heebo/300.css';
import '@fontsource/heebo/500.css';
import '@fontsource/heebo/800.css';
import '../styles/quiz.css';
import { BackLink } from '../components/LocalNavigation.jsx';
import MagenDavid from '../components/quiz/MagenDavid.jsx';
import QuestionView, { publicQuestion } from '../components/quiz/QuestionView.jsx';
import { useStudyTimer } from '../hooks.jsx';
import { CATEGORIES, LEVELS, SESSION_SIZES, TIMER_SECONDS, categoryLabel } from '../services/quiz/catalog.mjs';
import { loadBank, countsByCategory } from '../services/quiz/bank.mjs';
import { createSession, pickNext, answerQuestion, skipQuestion, sessionSummary } from '../services/quiz/session.mjs';
import { readQuizState, writeQuizState, applyAnswer, applySessionEnd, dueMistakes, dayKey, flagQuestion, unflagQuestion, flaggedIds, dailyResult, windowKey } from '../services/quiz/store.mjs';
import { STAGES, VARIANTS, stageOf, variantUnlocked } from '../services/quiz/magenDavid.mjs';
import { ACHIEVEMENTS } from '../services/quiz/achievements.mjs';
import { enterArenaChrome, readQuizLook, writeQuizLook } from '../services/quiz/arenaChrome.mjs';
import { sendMistakeToReview, reportReviewResult } from '../services/quiz/reviewBridge.mjs';
import { explanationFor } from '../services/quiz/clock.mjs';
import { useQuestionClock, useAutoAdvance } from '../components/quiz/QuizClock.jsx';
import { useSessionKeeper } from '../components/quiz/useSessionKeeper.js';
import { readSession, decideResume, entryRoute, clearSession, playState, restorePlay, resumeSeconds } from '../services/quiz/sessionResume.mjs';
import LadderPlay, { QUIZ_NAME, RoundLabel } from '../components/quiz/LadderPlay.jsx';
import { Lozenge, formatPoints } from '../components/quiz/LadderParts.jsx';
import { LADDER_SIZE } from '../services/quiz/ladder.mjs';
import { CategoryGlyph, ComboMeter, CountUp, Medal, NextDaily, RecordsPanel, ShareGrid, AchievementName } from '../components/quiz/ArenaParts.jsx';

// שעשועון טריוויה יהודי (formerly בחן אותי) — the quiz of לעצמי. Routes (kept from בחן אותי): leatzmi/quiz (home) ·
// leatzmi/quiz/ladder (הסולם — the main game, components/quiz/LadderPlay.jsx) · leatzmi/quiz/daily (אתגר יומי) ·
// leatzmi/quiz/play (תרגול חופשי) · leatzmi/quiz/review (the mistakes
// that are due) · leatzmi/quiz/q/<id> (one question, from חזרה אליי) · leatzmi/quiz/journey (the star's stages,
// its forms, the achievements) · leatzmi/quiz/flagged (שאלות שסימנתי — the questions marked "לא מתאימה").
// Progress lives on this device only (services/quiz/store.mjs).
export const QUIZ_BASE = 'leatzmi/quiz';
export const QUIZ_TAGLINE = 'טריוויה, ידע ורוח';
export const REVEAL_LABEL = 'להציג את התשובה הנכונה?';
export const QUIZ_TITLE = QUIZ_NAME;

export function parseQuizRoute(route = '') {
  const parts = String(route || '').split('/').filter(Boolean);
  const view = parts[2] || 'home';
  if (view === 'q' && parts[3]) return { view: 'single', id: decodeURIComponent(parts[3]) };
  return { view: ['play', 'review', 'journey', 'flagged', 'ladder', 'daily'].includes(view) ? view : 'home' };
}

const nf = new Intl.NumberFormat('he-IL');
const backOr = (go, fallback) => () => (Number(globalThis.history?.state?.kzDepth) > 0 ? history.back() : go(fallback));

export default function QuizPage({ route = QUIZ_BASE, go = () => {}, tzid = 'Asia/Jerusalem', initialState = null, initialBank = null }) {
  const parsed = parseQuizRoute(route);
  const [quiz, setQuizRaw] = useState(() => initialState || readQuizState());
  const setQuiz = next => setQuizRaw(prev => { const value = typeof next === 'function' ? next(prev) : next; writeQuizState(value); return value; });
  const [bank, setBank] = useState(initialBank);
  useEffect(() => { if (bank) return; let live = true; loadBank().then(b => { if (live) setBank(b); }); return () => { live = false; }; }, []);
  // The quiz's look (בהיר / כהה, or as the app's theme): this device only, outside the progress record.
  const [look, setLookRaw] = useState(() => readQuizLook());
  const setLook = next => { writeQuizLook(next); setLookRaw(next); };
  const props = { quiz, setQuiz, bank, go, tzid, look, setLook };
  // The page's title while the game is open (restored on leaving).
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const before = document.title;
    document.title = `${QUIZ_NAME} · כזוהר הרקיע`;
    return () => { document.title = before; };
  }, []);
  // The quiz fills the screen and the app's header, tab bar and status bar take its look — the night or the light
  // paper (all restored on leaving; drawn again when the look is changed).
  useArenaChrome(look);
  // Entering the quiz at its home while a game left in the middle is still within its ten minutes: straight back into
  // it (services/quiz/sessionResume.mjs). Only on entering — the quiz's own Back to its home stays there.
  const [entry] = useState(() => (parsed.view === 'home' ? entryRoute(readSession()) : null));
  const [entered, setEntered] = useState(!entry);
  useEffect(() => { if (entry) { setEntered(true); go(entry, { replace: true }); } }, []);
  if (!entered && parsed.view === 'home') return <section className="quiz-page" aria-busy="true"><p className="quiz-loading">טוען שאלות…</p></section>;
  if (parsed.view === 'ladder' || parsed.view === 'daily') return <Resumable key={route} route={route} bank={bank} go={go}
    render={(resume, onExpire) => <LadderPlay {...props} route={route} resume={resume} onExpire={onExpire} daily={parsed.view === 'daily'} onHome={() => go(QUIZ_BASE, { replace: true })} />} />;
  if (parsed.view === 'journey') return <Journey {...props} />;
  if (parsed.view === 'flagged') return <Flagged {...props} />;
  if (parsed.view === 'play' || parsed.view === 'review' || parsed.view === 'single') return <Resumable key={route} route={route} bank={bank} go={go}
    render={(resume, onExpire) => <Play {...props} route={route} resume={resume} onExpire={onExpire} mode={parsed.view} singleId={parsed.id} />} />;
  return <Home {...props} />;
}

// A game's screen opens on the game left there less than ten minutes ago (or afresh): decided once the bank is loaded.
// Away longer while the screen stayed open (the app in the background): afresh — a finished game goes to the home.
function Resumable({ route, bank, go, render }) {
  const [epoch, setEpoch] = useState(0);
  const onExpire = finished => { clearSession(); if (finished) go(QUIZ_BASE, { replace: true }); else setEpoch(n => n + 1); };
  return <ResumeGate key={epoch} route={route} bank={bank} go={go} render={render} onExpire={onExpire} />;
}
function ResumeGate({ route, bank, go, render, onExpire }) {
  const [found] = useState(() => readSession());
  const decision = useMemo(() => (bank ? decideResume(found, { route, bank }) : null), [found, bank]);
  useEffect(() => {
    if (!decision) return;
    if (decision.clear) clearSession();
    if (decision.home) go(QUIZ_BASE, { replace: true });
  }, [decision]);
  if (!decision || decision.home) return <section className="quiz-page" aria-busy="true"><p className="quiz-loading">טוען שאלות…</p></section>;
  return render(decision.resume, finished => onExpire(finished));
}

const useBeforePaint = typeof document === 'undefined' ? useEffect : useLayoutEffect;
function useArenaChrome(look) {
  useBeforePaint(() => {
    if (typeof document === 'undefined') return undefined;
    let native = false;
    try { native = Capacitor.isNativePlatform(); } catch { native = false; }
    return enterArenaChrome({ doc: document, win: window, statusBar: native ? StatusBar : null, look });
  }, [look]);
}

// The quiz's look in its settings: as the app (the default), light or dark.
export const LOOK_OPTIONS = [['auto', 'כמו האפליקציה'], ['light', 'בהיר'], ['dark', 'כהה']];

// A centred small heading between two hairlines.
const Eyebrow = ({ id, children }) => <h2 className="quiz-eyebrow" id={id}><span>{children}</span></h2>;

function StarHeader({ quiz, size = 176, alive = true, children }) {
  const s = stageOf(quiz.points);
  return <header className="quiz-head">
    <div className="quiz-star"><MagenDavid points={quiz.points} size={size} variant={quiz.prefs.variant} alive={alive} /></div>
    {children}
    <p className="quiz-stage">שלב {nf.format(s.stage + 1)} מתוך {STAGES.length} · <span>{s.name}</span></p>
    {s.next !== null ? <div className="quiz-stage-progress">
      <span className="quiz-hairline" aria-hidden="true"><span style={{ transform: `scaleX(${s.toNext})` }} /></span>
      <small>עוד {nf.format(s.nextAt - quiz.points)} נקודות לשלב הבא</small>
    </div> : <small className="quiz-stage-progress">כל השלבים הושלמו</small>}
  </header>;
}

function Home({ quiz, setQuiz, bank, go, look = 'auto', setLook = () => {} }) {
  const prefs = quiz.prefs;
  const setPref = patch => setQuiz(cur => ({ ...cur, prefs: { ...cur.prefs, ...patch } }));
  const counts = useMemo(() => countsByCategory(bank), [bank]);
  const due = dueMistakes(quiz).filter(id => !bank || bank.byId.has(id));
  const streak = quiz.days.last === dayKey() || quiz.days.last === dayKey(Date.now() - 864e5) ? quiz.days.streak : 0;
  const total = bank?.size || 0;
  const flaggedCount = Object.keys(quiz.flagged || {}).length;
  const available = Math.max(0, (prefs.category === 'all' ? total : counts[prefs.category] || 0) - (bank ? Object.keys(quiz.flagged || {}).filter(id => bank.byId.has(id) && (prefs.category === 'all' || bank.byId.get(id).category === prefs.category)).length : 0));
  const [round, setRound] = useState(() => windowKey());
  const daily = dailyResult(quiz, round);
  const rec = quiz.ladder || { best: 0, total: 0 };
  return <section className="quiz-page quiz-home" aria-labelledby="quiz-title">
    <BackLink label="לעצמי" onClick={backOr(go, 'leatzmi')} />
    <StarHeader quiz={quiz}><h1 id="quiz-title" className="quiz-title">{QUIZ_NAME}</h1><p className="quiz-tagline">{QUIZ_TAGLINE}</p></StarHeader>
    <dl className="quiz-stats">
      <div><dt>שיא בסולם</dt><dd>{nf.format(rec.best)}<small aria-label={`מתוך ${LADDER_SIZE}`}>/{LADDER_SIZE}</small></dd></div>
      <div><dt>נקודות סולם</dt><dd>{formatPoints(rec.total)}</dd></div>
      <div className="qz-stat-streak"><dt>ימים ברצף</dt><dd><ComboMeter run={streak} decorative />{nf.format(streak)}</dd></div>
    </dl>
    <div className="qz-home-play">
      <Lozenge as="button" type="button" tip={26} glow className="qz-cta qz-cta-main" disabled={!bank || available === 0} onClick={() => go(`${QUIZ_BASE}/ladder`)}>
        <span className="qz-cta-text">לעלות בסולם</span>
        <small className="qz-cta-sub">ט״ו מעלות · שלושה גלגלי עזרה</small>
      </Lozenge>
      <Lozenge as="button" type="button" tip={16} glow className={`qz-cta qz-cta-daily${daily ? ' is-done' : ''}`} disabled={!bank} onClick={() => go(`${QUIZ_BASE}/daily`)}>
        <span className="qz-cta-text">{daily ? null : <i className="qz-live" aria-hidden="true" />}אתגר יומי</span>
        {daily ? <><ShareGrid marks={daily.marks} className="qz-grid-mini" /><small className="qz-cta-sub"><NextDaily short onDone={() => setRound(windowKey())} /></small></>
          : <small className="qz-cta-sub"><RoundLabel day={round} /></small>}
      </Lozenge>
    </div>
    <section className="quiz-choose" aria-labelledby="quiz-cat-title">
      <Eyebrow id="quiz-cat-title">תחום</Eyebrow>
      <div className="qz-orbs" role="radiogroup" aria-labelledby="quiz-cat-title">
        {CATEGORIES.map((c, i) => {
          const n = c.id === 'all' ? total : counts[c.id] || 0;
          const empty = Boolean(bank) && n === 0;
          return <button key={c.id} type="button" role="radio" aria-checked={prefs.category === c.id} disabled={empty} data-hue={i % 6}
            className={`qz-orb${prefs.category === c.id ? ' is-on' : ''}`} aria-label={c.short ? c.label : undefined} onClick={() => setPref({ category: c.id })}>
            <span className="qz-orb-icon" aria-hidden="true"><CategoryGlyph id={c.id} /></span><span className="qz-orb-label">{c.short || c.label}</span>
          </button>;
        })}
      </div>
    </section>
    <RecordsPanel quiz={quiz} />
    <section className="quiz-choose quiz-practice" aria-labelledby="quiz-level-title">
      <Eyebrow id="quiz-level-title">תרגול חופשי</Eyebrow>
      <div className="quiz-pills quiz-pills-4" role="radiogroup" aria-label="רמה">
        {LEVELS.map(l => <button key={l.id} type="button" role="radio" aria-checked={prefs.level === l.id}
          className={`quiz-pill${prefs.level === l.id ? ' is-on' : ''}`} onClick={() => setPref({ level: l.id })}>{l.label}</button>)}
      </div>
      <p className="quiz-hint">{prefs.level === 'adaptive' ? 'בלי סולם ובלי לחץ: הרמה עולה אחרי רצף של תשובות נכונות ויורדת אחרי טעויות.' : 'בלי סולם ובלי לחץ — שאלות ברמה שבחרת.'}</p>
      <div className="quiz-start quiz-start-practice">
        <button type="button" className="quiz-primary" disabled={!bank || available === 0} onClick={() => go(`${QUIZ_BASE}/play`)}>לתרגול חופשי</button>
        <small>{!bank ? 'טוען שאלות…' : available === 0 ? 'עדיין אין שאלות בתחום הזה' : `${nf.format(Math.min(prefs.size, available))} שאלות${prefs.timer ? ` · ${TIMER_SECONDS} שניות לשאלה` : ''}`}</small>
      </div>
    </section>
    {due.length ? <button type="button" className="quiz-quiet quiz-due" onClick={() => go(`${QUIZ_BASE}/review`)}>{due.length === 1 ? 'שאלה אחת חוזרת אליך' : `${nf.format(due.length)} שאלות חוזרות אליך`}</button> : null}
    <RevealSwitch on={prefs.reveal} onChange={v => setPref({ reveal: v })} />
    <nav className="quiz-foot" aria-label={QUIZ_NAME}>
      <button type="button" className="quiz-quiet" onClick={() => go(`${QUIZ_BASE}/journey`)}>המסע</button>
      <span className="quiz-sep" aria-hidden="true" />
      <details className="quiz-settings">
        <summary className="quiz-quiet">הגדרות</summary>
        <div className="quiz-settings-body">
          <QuizSwitch label="הסבר קצר" on={prefs.explain} onChange={v => setPref({ explain: v })} />
          <QuizSwitch label="״תשובה סופית?״ בסולם" on={prefs.confirm} onChange={v => setPref({ confirm: v })} />
          <QuizSwitch label="צלילים עדינים" on={prefs.sound} onChange={v => setPref({ sound: v })} />
          <div className="quiz-setting" role="radiogroup" aria-label="שאלות בתרגול">
            <span>שאלות בתרגול</span>
            <div className="quiz-pills quiz-pills-inline">{SESSION_SIZES.map(n => <button key={n} type="button" role="radio" aria-checked={prefs.size === n} className={`quiz-pill${prefs.size === n ? ' is-on' : ''}`} onClick={() => setPref({ size: n })}>{n}</button>)}</div>
          </div>
          <div className="quiz-setting qz-look" role="radiogroup" aria-label="מראה השעשועון">
            <span>מראה</span>
            <div className="quiz-pills quiz-pills-inline">{LOOK_OPTIONS.map(([v, label]) => <button key={v} type="button" role="radio" aria-checked={look === v} className={`quiz-pill${look === v ? ' is-on' : ''}`} onClick={() => setLook(v)}>{label}</button>)}</div>
          </div>
          <div className="quiz-setting" role="radiogroup" aria-label="שעון">
            <span>שעון לכל שאלה</span>
            <div className="quiz-pills quiz-pills-inline">{[[false, 'כבוי'], [true, `${TIMER_SECONDS} שניות`]].map(([v, label]) => <button key={label} type="button" role="radio" aria-checked={prefs.timer === v} className={`quiz-pill${prefs.timer === v ? ' is-on' : ''}`} onClick={() => setPref({ timer: v })}>{label}</button>)}</div>
          </div>
          <button type="button" className="quiz-quiet quiz-flagged-link" onClick={() => go(`${QUIZ_BASE}/flagged`)}>
            שאלות שסימנתי{flaggedCount ? <span className="quiz-count-chip">{nf.format(flaggedCount)}</span> : null}
          </button>
        </div>
      </details>
    </nav>
  </section>;
}

function Play({ quiz, setQuiz, bank, go, tzid, mode, singleId, route = '', resume = null, onExpire }) {
  const quizRef = useRef(quiz);
  quizRef.current = quiz;
  // A round left in the middle and resumed (services/quiz/sessionResume.mjs): as it was, once.
  const [back] = useState(() => (resume && bank ? restorePlay(resume.state, bank) : null));
  const [session, setSession] = useState(back?.session || null);
  const [question, setQuestion] = useState(back?.question || null);
  const [selected, setSelected] = useState(back ? back.selected : null);
  const [feedback, setFeedback] = useState(back?.feedback || null);
  const [ended, setEnded] = useState(back?.ended || null); // { summary, earned, stageBefore, stageAfter, notes }
  const correctNotes = useRef(back?.notes || []);
  const playing = Boolean(bank && session && !ended);
  // Study time counts by active time only (the shared study-session mechanism), never by the number of answers.
  useStudyTimer({ workId: 'quiz-bechan-oti', workTitle: QUIZ_NAME, unitId: quiz.prefs.category, unitLabel: categoryLabel(quiz.prefs.category), category: 'torah_study', source: 'quiz', tzid, enabled: playing });

  const begin = () => {
    const q = quizRef.current;
    const ids = mode === 'single' ? [singleId] : mode === 'review' ? dueMistakes(q).filter(id => bank.byId.has(id)).slice(0, 10) : [];
    const s = createSession({ category: mode === 'play' ? q.prefs.category : 'all', level: q.prefs.level, size: q.prefs.size, adaptiveStart: q.adaptive,
      mode: mode === 'play' ? 'play' : 'review', reviewIds: ids, dueIds: mode === 'play' ? dueMistakes(q) : [] });
    correctNotes.current = [];
    setEnded(null); setSelected(null); setFeedback(null);
    const first = pickNext(s, bank, { seen: q.seen, flagged: q.flagged });
    setSession(s); setQuestion(first);
    if (!first) setEnded({ summary: sessionSummary(s), earned: [], stageBefore: stageOf(q.points).stage, stageAfter: stageOf(q.points).stage, empty: true });
  };
  useEffect(() => { if (bank && !back) begin(); }, [bank]);

  const choose = choice => {
    if (!session || !question || feedback) return;
    const { session: next, result } = answerQuestion(session, question, choice);
    const q = quizRef.current;
    const updated = applyAnswer(q, { question, correct: result.correct, points: result.points, adaptive: session.level === 'adaptive' && mode === 'play' ? next.difficulty : undefined });
    const wasMistake = q.mistakes[question.id];
    if (result.correct) {
      if (question.note) correctNotes.current.push({ id: question.id, q: question.q, note: question.note });
      if (wasMistake) reportReviewResult(wasMistake.reviewId || `quiz:${question.id}`, true);
    } else {
      // Into חזרה אליי — without the answer (missed again: it comes back sooner). The review id is kept with the mistake.
      sendMistakeToReview(question).then(reviewId => {
        if (reviewId) setQuiz(cur => (cur.mistakes[question.id] && cur.mistakes[question.id].reviewId !== reviewId ? { ...cur, mistakes: { ...cur.mistakes, [question.id]: { ...cur.mistakes[question.id], reviewId } } } : cur));
      });
    }
    setQuiz(updated);
    setSession(next); setSelected(choice); setFeedback(result.correct ? 'right' : choice === null ? 'timeout' : 'wrong');
  };

  const advance = () => {
    const q = quizRef.current;
    const following = pickNext(session, bank, { seen: q.seen, flagged: q.flagged });
    if (following) { setQuestion(following); setSelected(null); setFeedback(null); return; }
    finish(session);
  };
  // "לא מתאימה": before an answer it is skipped (nothing scored) and another takes its place; after an answer the answer
  // stands and the session moves on. Either way it never comes back, and it is kept in שאלות שסימנתי.
  const flag = () => {
    if (!session || !question) return;
    setQuiz(cur => flagQuestion(cur, question.id));
    quizRef.current = flagQuestion(quizRef.current, question.id);
    const s = feedback ? session : skipQuestion(session, question);
    if (s !== session) setSession(s);
    const q = quizRef.current;
    const following = pickNext(s, bank, { seen: q.seen, flagged: q.flagged });
    if (following) { setQuestion(following); setSelected(null); setFeedback(null); return; }
    if (!s.results.length) { setEnded({ summary: sessionSummary(s), earned: [], stageBefore: stageOf(q.points).stage, stageAfter: stageOf(q.points).stage, empty: true }); return; }
    finish(s);
  };
  const finish = s => {
    const q = quizRef.current;
    const summary = sessionSummary(s);
    const before = stageOf(q.points - summary.points).stage;
    const { state, earned } = applySessionEnd(q, summary);
    setQuiz(state);
    setEnded({ summary, earned, stageBefore: before, stageAfter: stageOf(state.points).stage, notes: correctNotes.current.slice() });
  };

  // The optional clock (services/quiz/clock.mjs): off by default; when time runs out the question counts as missed, and
  // nothing is revealed. In free practice (not in the review of mistakes or a single question from חזרה אליי).
  const timerOn = quiz.prefs.timer && mode === 'play';
  const remaining = useQuestionClock({ enabled: timerOn, initial: back && back.remaining !== null ? resumeSeconds(back.remaining, TIMER_SECONDS) : null, running: playing && Boolean(question) && !feedback, resetKey: question?.id, onTimeout: () => choose(null) });
  // "הסבר קצר": the explanation after the answer (never after a miss unless the answer may be shown), until "לשאלה הבאה";
  // with none, the next question comes by itself after the verdict's beat.
  const explanation = feedback && question ? explanationFor({ note: question.note, correct: feedback === 'right', explain: quiz.prefs.explain, reveal: quiz.prefs.reveal }) : null;
  useAutoAdvance({ active: Boolean(playing && feedback), wait: Boolean(explanation), key: question?.id, onAdvance: advance });
  // The round is kept as it goes, so leaving the quiz and coming back resumes it.
  const abandon = useSessionKeeper({ kind: mode, route, bank, onExpire: () => onExpire?.(Boolean(ended)),
    build: () => playState({ mode, singleId, session, question, selected, feedback, remaining, notes: correctNotes.current, ended }) });

  const exit = () => { abandon(); backOr(go, QUIZ_BASE)(); };
  if (!bank || !session) return <section className="quiz-page" aria-busy="true"><p className="quiz-loading">טוען שאלות…</p></section>;
  if (ended) return <SessionEnd quiz={quiz} ended={ended} mode={mode} onAgain={mode === 'play' ? begin : null} onHome={() => { abandon(); go(QUIZ_BASE, { replace: true }); }} />;
  return <section className="quiz-page quiz-play">
    <div className="qz-hud qz-hud-play">
      <span className="qz-hud-cell qz-hud-score" aria-hidden="true"><CountUp value={session.points} className="qz-hud-pts" /><small>נקודות בסבב</small></span>
      <span className="qz-hud-cell"><ComboMeter run={session.run} /></span>
    </div>
    <QuestionView question={publicQuestion(question)} index={session.asked.length - (feedback ? 1 : 0)} total={session.size}
      categoryText={categoryLabel(question.category)} selected={selected} feedback={feedback} onChoose={choose} onNext={advance} onFlag={flag}
      revealed={quiz.prefs.reveal && feedback && feedback !== 'right' ? question.answer : null}
      last={session.asked.length >= session.size} timer={timerOn ? { remaining, total: TIMER_SECONDS } : null} explanation={explanation}
      onExit={() => (session.results.length ? finish(session) : exit())} />
  </section>;
}

function SessionEnd({ quiz, ended, mode, onAgain, onHome }) {
  const { summary, earned, stageBefore, stageAfter, notes = [], empty } = ended;
  const titleRef = useRef(null);
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }); }, []);
  if (empty) return <section className="quiz-page quiz-end" aria-labelledby="quiz-end-title">
    <header className="quiz-head"><div className="quiz-star"><MagenDavid points={quiz.points} size={120} variant={quiz.prefs.variant} /></div>
      <h1 id="quiz-end-title" ref={titleRef} tabIndex={-1} className="quiz-title quiz-title-sm">{mode === 'play' ? 'אין כרגע שאלות לסבב הזה' : 'אין שאלות לחזרה כרגע'}</h1></header>
    <div className="quiz-start"><button type="button" className="quiz-primary" onClick={onHome}>לשעשועון</button></div>
  </section>;
  return <section className="quiz-page quiz-end" aria-labelledby="quiz-end-title">
    <header className="quiz-head">
      <div className="quiz-star"><MagenDavid points={quiz.points} size={150} variant={quiz.prefs.variant} alive /></div>
      <p className="quiz-kicker">{mode === 'play' ? 'סוף התרגול' : 'סוף החזרה'}</p>
      <h1 id="quiz-end-title" ref={titleRef} tabIndex={-1} className="quiz-score"><b>{nf.format(summary.correct)}</b><span>מתוך {nf.format(summary.answered)}</span></h1>
      <p className="quiz-gain">{summary.points ? `${nf.format(summary.points)}+ נקודות` : 'הנקודות יבואו בסבב הבא'}</p>
      {stageAfter > stageBefore ? <p className="quiz-evolved">המגן התפתח · {STAGES[stageAfter].name}</p> : null}
    </header>
    {earned.length ? <ul className="quiz-earned" aria-label="הישגים חדשים">{earned.map(a => <li key={a.id}><Medal earned n={ACHIEVEMENTS.indexOf(a) + 1} /><AchievementName a={a} /><small>{a.detail}</small></li>)}</ul> : null}
    <div className="quiz-start quiz-end-actions">
      {onAgain ? <button type="button" className="quiz-primary quiz-primary-lg" onClick={onAgain}>תרגול נוסף</button> : null}
      <button type="button" className="quiz-quiet" onClick={onHome}>לשעשועון</button>
    </div>
    {notes.length ? <details className="quiz-notes">
      <summary className="quiz-quiet">להעמקה · {nf.format(notes.length)}</summary>
      <ul>{notes.map(n => <li key={n.id}><p>{n.q}</p><small>{n.note}</small></li>)}</ul>
    </details> : null}
  </section>;
}

function Journey({ quiz, setQuiz, go }) {
  const s = stageOf(quiz.points);
  const choose = id => setQuiz(cur => ({ ...cur, prefs: { ...cur.prefs, variant: id } }));
  return <section className="quiz-page quiz-journey" aria-labelledby="quiz-journey-title">
    <BackLink label={QUIZ_NAME} onClick={backOr(go, QUIZ_BASE)} />
    <StarHeader quiz={quiz} size={132}><h1 id="quiz-journey-title" className="quiz-title quiz-title-sm">המסע</h1></StarHeader>
    <RecordsPanel quiz={quiz} />
    <section aria-labelledby="quiz-stages-title">
      <Eyebrow id="quiz-stages-title">חמישה עשר שלבים</Eyebrow>
      <ol className="quiz-stages">
        {STAGES.map((stage, i) => {
          const reached = i <= s.stage;
          return <li key={i} className={`${reached ? 'is-reached' : 'is-ahead'}${i === s.stage ? ' is-current' : ''}`} aria-current={i === s.stage ? 'step' : undefined}>
            <MagenDavid points={stage.at} size={76} variant="classic" />
            <strong>{stage.name}</strong>
            <small>{reached ? `שלב ${i + 1}` : `${nf.format(stage.at)} נקודות`}</small>
          </li>;
        })}
      </ol>
    </section>
    <section aria-labelledby="quiz-forms-title">
      <Eyebrow id="quiz-forms-title">צורות</Eyebrow>
      <div className="quiz-forms" role="radiogroup" aria-labelledby="quiz-forms-title">
        {VARIANTS.map(v => {
          const open = variantUnlocked(v.id, quiz.points);
          return <button key={v.id} type="button" role="radio" aria-checked={quiz.prefs.variant === v.id} disabled={!open}
            className={`quiz-form${quiz.prefs.variant === v.id ? ' is-on' : ''}`} onClick={() => choose(v.id)}>
            <MagenDavid points={open ? Math.max(quiz.points, STAGES[v.stage].at) : STAGES[v.stage].at} size={64} variant={v.id} />
            <strong>{v.name}</strong>
            <small>{open ? (quiz.prefs.variant === v.id ? 'נבחרה' : 'פתוחה') : `נפתחת בשלב ${v.stage + 1}`}</small>
          </button>;
        })}
      </div>
    </section>
    <section aria-labelledby="quiz-ach-title">
      <Eyebrow id="quiz-ach-title">הישגים · {nf.format(ACHIEVEMENTS.filter(a => quiz.achievements[a.id]).length)} מתוך {nf.format(ACHIEVEMENTS.length)}</Eyebrow>
      <ul className="quiz-achievements">
        {ACHIEVEMENTS.map((a, i) => <li key={a.id} className={quiz.achievements[a.id] ? 'is-earned' : ''}>
          <Medal earned={Boolean(quiz.achievements[a.id])} n={i + 1} />
          <AchievementName a={a} /><small>{a.detail}</small>
          <span className="visually-hidden">{quiz.achievements[a.id] ? 'הושג' : 'עדיין לא'}</span>
        </li>)}
      </ul>
    </section>
  </section>;
}

// The one switch of the home: off by default. Off — a miss never shows the right answer (the quiz's way); on — after a
// miss the correct option is outlined in gold with a check. A real switch (role="switch"), outline only.
function RevealSwitch({ on, onChange }) {
  return <QuizSwitch label={REVEAL_LABEL} on={on} onChange={onChange} />;
}
function QuizSwitch({ label, on, onChange }) {
  return <div className="quiz-switch-row">
    <button type="button" role="switch" aria-checked={Boolean(on)} className={`quiz-switch${on ? ' is-on' : ''}`} onClick={() => onChange(!on)}>
      <span className="quiz-switch-label">{label}</span>
      <span className="quiz-switch-track" aria-hidden="true"><span className="quiz-switch-knob" /></span>
    </button>
  </div>;
}

// שאלות שסימנתי: the questions marked "לא מתאימה" (the most recent first) — the question and its area, never the answer;
// each can be returned to the game.
function Flagged({ quiz, setQuiz, bank, go }) {
  const ids = flaggedIds(quiz);
  return <section className="quiz-page quiz-flagged" aria-labelledby="quiz-flagged-title">
    <BackLink label={QUIZ_NAME} onClick={backOr(go, QUIZ_BASE)} />
    <header className="quiz-head quiz-head-plain">
      <h1 id="quiz-flagged-title" className="quiz-title quiz-title-sm">שאלות שסימנתי</h1>
      <p className="quiz-tagline">{ids.length ? `${nf.format(ids.length)} ${ids.length === 1 ? 'שאלה שלא תוצג שוב' : 'שאלות שלא יוצגו שוב'}` : 'שאלה שתסמנו ״לא מתאימה״ תופיע כאן, ולא תוצג שוב'}</p>
    </header>
    {!bank && ids.length ? <p className="quiz-loading">טוען שאלות…</p> : null}
    {ids.length ? <ul className="quiz-flagged-list">
      {ids.map(id => {
        const q = bank?.byId.get(id);
        return <li key={id}>
          <p>{q ? q.q : 'שאלה שכבר אינה במאגר'}</p>
          <div className="quiz-flagged-meta">
            <small>{q ? categoryLabel(q.category) : id}</small>
            <button type="button" className="quiz-quiet quiz-unflag" onClick={() => setQuiz(cur => unflagQuestion(cur, id))} aria-label={`להחזיר את השאלה למשחק${q ? `: ${q.q}` : ''}`}>להחזיר למשחק</button>
          </div>
        </li>;
      })}
    </ul> : null}
  </section>;
}
