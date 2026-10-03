import { useEffect, useMemo, useRef, useState } from 'react';
import QuestionView, { publicQuestion } from '../quiz/QuestionView.jsx';
import { useQuestionClock, useAutoAdvance } from '../quiz/QuizClock.jsx';
import { hebrewDateLabel } from '../quiz/LadderPlay.jsx';
import TitleOrnament from '../ui/TitleOrnament.jsx';
import ArrowMark from '../ui/ArrowMark.jsx';
import { useStudyTimer } from '../../hooks.jsx';
import { categoryLabel } from '../../services/quiz/catalog.mjs';
import { explanationFor } from '../../services/quiz/clock.mjs';
import { applyAnswer } from '../../services/quiz/store.mjs';
import { BASE_POINTS } from '../../services/quiz/scoring.mjs';
import { sendMistakeToReview } from '../../services/quiz/reviewBridge.mjs';
import { dailySet } from '../../services/globalChallenge/select.mjs';
import { GLOBAL_SIZE, QUESTION_SECONDS, correctPercents } from '../../services/globalChallenge/scoring.mjs';
import { challengeToday, CLOSED_TEXT, resultLine, resultParts, countLine } from '../../services/globalChallenge/status.mjs';
import { setPrefs, recordDay, dayResult, rememberStart } from '../../services/globalChallenge/store.mjs';
import { useGlobalChallenge, useChallengeSync, challengeApi, ensureDevice, updateGlobal, flushNow, refreshDay } from './useGlobalChallenge.js';
import { ResultMarks, BOARD_ROUTE } from './GlobalChallengeCard.jsx';

// האתגר העולמי של היום — the game (leatzmi/quiz/global): the way in (with the one-time short explanation), the five
// questions with the ladder's clock (30 seconds each, always on), and the day's result with the world's numbers.
// One try a day: a game left in the middle continues where it was, and its clock kept running while the player was
// away (store.mjs progress). The answers also count in the quiz's own progress (the star, the mistakes that come back).
export const CHALLENGE_TITLE = 'האתגר העולמי של היום';
const nf = new Intl.NumberFormat('he-IL');
const loadSchedule = () => import('../../data/globalChallenge/schedule.mjs').then(m => m.default).catch(() => null);

export default function GlobalChallengePlay({ quiz, setQuiz, bank, go, tzid, settings = null, onHome }) {
  const [state, update] = useGlobalChallenge();
  const [today] = useState(() => challengeToday({ now: Date.now(), settings }));
  const date = today.date;
  const [schedule, setSchedule] = useState(undefined);
  useEffect(() => { let live = true; loadSchedule().then(s => { if (live) setSchedule(s); }); return () => { live = false; }; }, []);
  const set = useMemo(() => (bank && schedule !== undefined ? dailySet(bank, date, schedule) : null), [bank, schedule, date]);
  const result = dayResult(state, date);
  const progress = state.progress?.date === date ? state.progress : null;
  const [phase, setPhase] = useState(() => (result ? 'result' : progress ? 'play' : 'intro'));
  useChallengeSync(state.prefs.participate);

  if (!state.prefs.participate) return <Notice title={CHALLENGE_TITLE} text="האתגר העולמי כבוי בהגדרות" action={['להגדרות', () => go('settings/challenge')]} onHome={onHome} />;
  if (phase === 'result' || (result && phase !== 'play')) return <GlobalResult date={date} state={state} bank={bank} go={go} onHome={onHome} />;
  if (!today.open && !progress) return <Notice title={CHALLENGE_TITLE} text={CLOSED_TEXT[today.reason] || ''} onHome={onHome} />;
  if (!bank || !set) return <section className="quiz-page" aria-busy="true"><p className="quiz-loading">טוען שאלות…</p></section>;
  if (phase === 'intro') {
    const begin = () => {
      update(s => ({ ...setPrefs(s, { introSeen: true }), progress: { date, answers: [], shownAt: Date.now() } }));
      // The server's start, in the background (the token arrives during the first question); without a connection
      // the game is played all the same and its result is sent later (counted in the day's numbers, not the board).
      const client = challengeApi();
      if (client.enabled && set.scheduled) {
        const { device } = ensureDevice();
        client.start({ device, date, il: today.il }).then(res => { if (res.ok) updateGlobal(s => rememberStart(s, date, res.data)); });
      }
      setPhase('play');
    };
    return <Intro date={date} firstTime={!state.prefs.introSeen} online={challengeApi().enabled} onStart={begin} onHome={onHome} go={go} />;
  }
  return <Game key={date} date={date} il={today.il} set={set} bank={bank} quiz={quiz} setQuiz={setQuiz} tzid={tzid} progress={progress} onDone={() => setPhase('result')} />;
}

function Notice({ title, text, action = null, onHome }) {
  return <section className="quiz-page quiz-end gc-page" aria-labelledby="gc-notice-title">
    <header className="quiz-head quiz-head-plain">
      <h1 id="gc-notice-title" className="quiz-title quiz-title-sm">{title}</h1>
      <TitleOrnament />
      <p className="quiz-tagline">{text}</p>
    </header>
    <div className="quiz-start quiz-end-actions">
      {action ? <button type="button" className="quiz-primary" onClick={action[1]}>{action[0]}</button> : null}
      <button type="button" className="quiz-quiet" onClick={onHome}>לשעשועון</button>
    </div>
  </section>;
}

function Intro({ date, firstTime, online, onStart, onHome, go }) {
  const titleRef = useRef(null);
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }); }, []);
  return <section className="quiz-page gc-page gc-intro" aria-labelledby="gc-intro-title">
    <button type="button" className="local-back quiz-quiet qz-back" onClick={onHome}>שעשועון טריוויה יהודי</button>
    <header className="quiz-head quiz-head-plain">
      <p className="quiz-kicker">{hebrewDateLabel(date)}</p>
      <h1 id="gc-intro-title" ref={titleRef} tabIndex={-1} className="quiz-title">{CHALLENGE_TITLE}</h1>
      <TitleOrnament />
      <p className="quiz-tagline">אותן חמש שאלות לכל הלומדים בעולם</p>
    </header>
    {firstTime ? <aside className="gc-explain" aria-labelledby="gc-explain-title">
      <h2 id="gc-explain-title" className="gc-explain-title">בפעם הראשונה</h2>
      <p>בכל יום חול חמש שאלות — אותן שאלות לכולם. אחרי שתענו תראו כמה ענו נכון על כל שאלה, ואיפה אתם ביחס לכולם.</p>
      {online ? <p>נשלחת רק התוצאה, עם מזהה אקראי של המכשיר — בלי שם, מייל או מיקום. ההופעה בטבלת השיאים נפרדת ובחירה בלבד. אפשר לכבות הכול בהגדרות.</p>
        : <p>התוצאה נשמרת במכשיר בלבד.</p>}
    </aside> : null}
    <ul className="gc-rules">
      <li><b>{nf.format(GLOBAL_SIZE)}</b><span>שאלות</span></li>
      <li><b>{nf.format(QUESTION_SECONDS)}</b><span>שניות לשאלה</span></li>
      <li><b>{nf.format(1)}</b><span>הזדמנות ביום</span></li>
    </ul>
    <div className="quiz-start gc-start">
      <button type="button" className="quiz-primary quiz-primary-lg" onClick={onStart}>{firstTime ? 'הבנתי, להתחיל' : 'להתחיל'}</button>
      <small>שאלה שנפתחה נספרת — גם אם יוצאים באמצע</small>
    </div>
    {online ? <button type="button" className="quiz-quiet gc-board-link" onClick={() => go(BOARD_ROUTE)}>טבלת השיאים העולמית</button> : null}
  </section>;
}

function Game({ date, il, set, bank, quiz, setQuiz, tzid, progress, onDone }) {
  const questions = set.ids.map(id => bank.byId.get(id)).filter(Boolean);
  const [answers, setAnswers] = useState(() => progress?.answers || []);
  // When the question on screen was first shown (null: answered, the next not yet shown — it starts now).
  const shownAt = useRef(Number.isFinite(progress?.shownAt) ? Math.min(progress.shownAt, Date.now()) : Date.now());
  const index = Math.min(answers.length, questions.length - 1);
  const [feedback, setFeedback] = useState(null);
  const [selected, setSelected] = useState(null);
  const question = questions[answers.length - (feedback ? 1 : 0)] || questions[index];
  const quizRef = useRef(quiz);
  quizRef.current = quiz;
  useStudyTimer({ workId: 'quiz-bechan-oti', workTitle: 'שעשועון טריוויה יהודי', unitId: 'global', unitLabel: CHALLENGE_TITLE, category: 'torah_study', source: 'quiz', tzid, enabled: !feedback });
  // A game resumed: the clock of the question on screen kept running while the player was away (a clock that ran out
  // meanwhile is a question not answered).
  const [initial] = useState(() => Math.max(0, QUESTION_SECONDS - Math.floor((Date.now() - shownAt.current) / 1000)));
  useEffect(() => { if (initial === 0) choose(null); }, []);
  // The fifth answer keeps the day's result at once (and sends it); "לסיכום" then opens it.
  const record = list => {
    updateGlobal(s => recordDay(s, { date, ids: set.ids, answers: list, bank, il, scheduled: set.scheduled, queue: challengeApi().enabled }));
    flushNow();
  };
  const choose = choice => {
    if (feedback || !question) return;
    const ms = Math.min((QUESTION_SECONDS + 4) * 1000, Math.max(0, Date.now() - shownAt.current));
    const correct = Number.isInteger(choice) && choice === question.answer;
    const list = [...answers, { qid: question.id, choice: Number.isInteger(choice) ? choice : null, ms }];
    setAnswers(list);
    setSelected(choice);
    setFeedback(correct ? 'right' : choice === null ? 'timeout' : 'wrong');
    if (list.length >= questions.length) record(list);
    else updateGlobal(s => ({ ...s, progress: { date, answers: list, shownAt: null } }));
    // the quiz's own progress (the star's points, the mistakes that come back — never with the answer)
    setQuiz(applyAnswer(quizRef.current, { question, correct, points: correct ? BASE_POINTS[question.difficulty] || BASE_POINTS[1] : 0 }));
    if (!correct) sendMistakeToReview(question).catch?.(() => {});
  };
  const next = () => {
    if (answers.length >= questions.length) { onDone(); return; }
    shownAt.current = Date.now();
    updateGlobal(s => ({ ...s, progress: { date, answers, shownAt: shownAt.current } }));
    setFeedback(null); setSelected(null);
  };
  const remaining = useQuestionClock({ enabled: true, running: !feedback, resetKey: question?.id, initial, onTimeout: () => choose(null) });
  const explanation = feedback && question ? explanationFor({ note: question.note, correct: feedback === 'right', explain: quiz.prefs.explain, reveal: false }) : null;
  useAutoAdvance({ active: Boolean(feedback), wait: Boolean(explanation), key: question?.id, onAdvance: next });
  if (!question) return null;
  const shownIndex = answers.length - (feedback ? 1 : 0);
  return <section className="quiz-page quiz-play gc-play" aria-label={CHALLENGE_TITLE}>
    <p className="gc-play-tag">{CHALLENGE_TITLE}</p>
    <QuestionView question={publicQuestion(question)} index={shownIndex} total={questions.length} categoryText={categoryLabel(question.category)}
      selected={selected} feedback={feedback} onChoose={choose} onNext={next} timer={{ remaining, total: QUESTION_SECONDS }} explanation={explanation}
      last={answers.length >= questions.length} />
  </section>;
}

// The day's result: the player's own (always), and the world's (when the server has answered).
export function GlobalResult({ date, state, bank, go, onHome }) {
  const result = dayResult(state, date);
  const online = challengeApi().enabled;
  const stats = state.stats[date] || null;
  const titleRef = useRef(null);
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => { if (online && result?.status === 'sent') refreshDay(date, { force: true }); }, [online, result?.status]);
  if (!result) return null;
  const percents = stats ? correctPercents(stats) : null;
  const showWorld = online && result.scheduled && stats && stats.n > 0;
  const waiting = online && result.scheduled && !showWorld;
  const note = !online || !result.scheduled ? '' : result.status === 'pending' ? 'התוצאות העולמיות יופיעו כשתתחבר'
    : result.status === 'rejected' ? (result.reason === 'late' ? 'התוצאה נשמרה במכשיר; היא נשלחה אחרי שהזמן של המשחק עבר ולכן לא נספרה'
      : 'התוצאה נשמרה במכשיר; השרת לא קיבל אותה')
      : result.status === 'sent' && !result.verified ? 'שוחק בלי חיבור: נספר בתוצאות היום, לא בטבלה' : waiting ? 'התוצאות העולמיות יופיעו כשתתחבר' : '';
  const maxH = stats ? Math.max(1, ...stats.h) : 1;
  const parts = resultParts(result.correct, showWorld ? stats : null);
  return <section className="quiz-page quiz-end gc-page gc-result" aria-labelledby="gc-result-title">
    <button type="button" className="local-back quiz-quiet qz-back" onClick={onHome}>שעשועון טריוויה יהודי</button>
    <header className="quiz-head quiz-head-plain">
      <p className="quiz-kicker">האתגר העולמי · {hebrewDateLabel(date).split(' ').slice(0, -1).join(' ')}</p>
      <h1 id="gc-result-title" ref={titleRef} tabIndex={-1} className="quiz-score"><b>{nf.format(result.correct)}</b><span>מתוך {nf.format(GLOBAL_SIZE)}</span></h1>
      <TitleOrnament />
      <ResultMarks answers={result.answers} className="gc-marks-lg" />
      <p className="gc-result-line"><span className="visually-hidden">{resultLine(result.correct, showWorld ? stats : null)}</span>
        <span aria-hidden="true">{parts.head}</span>{parts.compare ? <span className="gc-result-compare" aria-hidden="true">{parts.compare}</span> : null}</p>
      {showWorld ? <p className="gc-result-count">{countLine(stats.n)}</p> : null}
      {note ? <p className="gc-result-note" role="status">{note}</p> : null}
    </header>
    {showWorld ? <section className="gc-dist" aria-labelledby="gc-dist-title">
      <h2 id="gc-dist-title" className="gc-section-title">כמה ענו נכון היום</h2>
      <TitleOrnament />
      <ol className="gc-dist-bars">
        {stats.h.map((n, k) => <li key={k} className={k === result.correct ? 'is-me' : undefined} aria-label={`${k} נכונות: ${n === 1 ? 'לומד אחד' : `${nf.format(n)} לומדים`}${k === result.correct ? ' · את/ה כאן' : ''}`}>
          <span className="gc-dist-bar" aria-hidden="true"><i style={{ height: `${Math.round((100 * n) / maxH)}%` }} /></span>
          <span className="gc-dist-k" aria-hidden="true">{k}</span>
        </li>)}
      </ol>
    </section> : null}
    <section className="gc-questions" aria-labelledby="gc-questions-title">
      <h2 id="gc-questions-title" className="gc-section-title">השאלות של היום</h2>
      <TitleOrnament />
      <ol className="gc-q-list">
        {result.ids.map((id, i) => {
          const q = bank?.byId.get(id);
          const right = result.answers[i]?.correct;
          return <li key={id} className={right ? 'is-right' : 'is-wrong'}>
            <span className="gc-q-mark" aria-hidden="true">{right ? <svg viewBox="0 0 20 20"><path d="M5 10.5l3.2 3.2L15 6.8" /></svg> : <svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="4.2" /></svg>}</span>
            <span className="gc-q-body">
              <span className="gc-q-text">{q ? q.q : 'שאלה'}<span className="visually-hidden">{right ? ' · ענית נכון' : ' · לא נכון'}</span></span>
              {showWorld && percents ? <span className="gc-q-world">
                <span className="gc-q-bar" aria-hidden="true"><i style={{ transform: `scaleX(${percents[i] / 100})` }} /></span>
                <small>{percents[i]}% ענו נכון</small>
              </span> : null}
            </span>
          </li>;
        })}
      </ol>
    </section>
    <div className="quiz-start quiz-end-actions">
      {online ? <button type="button" className="quiz-primary" onClick={() => go(BOARD_ROUTE)}>טבלת השיאים העולמית</button> : null}
      <button type="button" className="quiz-quiet" onClick={onHome}>לשעשועון</button>
    </div>
  </section>;
}
