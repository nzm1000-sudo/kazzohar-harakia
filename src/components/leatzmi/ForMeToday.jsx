// בשבילי היום — three to five short cards, composed by rules (services/leatzmi/forMe.mjs). The plan is kept while the
// screen is open; it is composed anew after two hours, or when the user comes back after ten minutes away — never under
// the reader's eyes. A question card asks one question after another (services/leatzmi/forMeQuestion.mjs).
import { useCallback, useEffect, useId, useReducer, useRef, useState } from 'react';
import { PageHead, leatzmiBack } from './common.jsx';
import { useStudyTimer } from '../../hooks.jsx';
import { chooseNewQuestion, composeForMe, markCardDone, openPlan, readForMe, replaceCardQuestion, sessionMinutes, touchPlan, verseOfDay } from '../../services/leatzmi/forMe.mjs';
import { advanceDelay, announcement, FEEDBACK, gradeChoice, initialQuestionState, questionReducer, recordAnswer, revealSetting } from '../../services/leatzmi/forMeQuestion.mjs';
import { readReviewItems } from '../../services/leatzmi/review.mjs';
import { createFollowUp, loadChidushim } from '../../services/leatzmi/chidushim.mjs';
import { readLearned } from '../../services/halachaLearning.mjs';
import { civilDateKey } from '../../civilDate.mjs';
import { hebrewNumeral } from '../../services/hebrewNumerals.mjs';
import { leatzmiRoute } from '../../services/leatzmi/routes.mjs';
import { loadDivreiChachamim, sayingAt, sayingForDay } from '../../services/leatzmi/divreiChachamim.mjs';
import { loadBank } from '../../services/quiz/bank.mjs';
import { readQuizState } from '../../services/quiz/store.mjs';

const ORDINAL = ['א', 'ב', 'ג', 'ד', 'ה'];
const OPTION_MARKS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];
const plainNumeral = n => hebrewNumeral(n).replace(/[׳״]/g, '');
const HEARTBEAT_MS = 60 * 1000;
const QUIZ_SEEN_DAYS = 30;
const isQuestionCard = card => card.type === 'quiz-missed' || card.type === 'quiz-new';

async function loadInputs() {
  const [halacha, tehillim, bank, sayings] = await Promise.all([
    import('../../data/practicalHalachaQa.mjs').then(module => module.PRACTICAL_HALACHA_QA).catch(() => []),
    import('../../data/tehillim.json').then(module => module.default?.chapters || []).catch(() => []),
    // בחן אותי's bank (validated, src/data/quiz) — absent or still empty is fine: the question card is simply left out.
    loadBank().catch(() => ({ questions: [], byId: new Map() })),
    loadDivreiChachamim().catch(() => null),
  ]);
  const pool = halacha.filter(item => item.quality === 'verified' && item.answerStatus === 'published' && item.sensitivity === 'public' && !item.personal && item.shortAnswer && !(item.conditions || []).length)
    .map(item => ({ id: item.id, question: item.question, shortAnswer: item.shortAnswer, category: item.category }));
  return { pool, tehillim, bank, sayings };
}

// Questions the quiz itself keeps away: flagged "לא מתאימה", or played there lately.
function quizSkips(now = Date.now()) {
  const quiz = readQuizState();
  const since = now - QUIZ_SEEN_DAYS * 24 * 60 * 60 * 1000;
  return { skip: [...Object.keys(quiz.flagged || {}), ...Object.entries(quiz.seen || {}).filter(([, at]) => at >= since).map(([id]) => id)], categoryStats: quiz.byCategory };
}

export default function ForMeToday({ go, tzid, openPsalm }) {
  const [state, setState] = useState(null);
  const [sayings, setSayings] = useState(null);
  const inputs = useRef(null);
  useStudyTimer({ workId: 'leatzmi-today', workTitle: 'בשבילי היום', category: 'torah_study', source: 'leatzmi', tzid, enabled: Boolean(state?.plan?.length) });
  useEffect(() => {
    let live = true;
    // Entering the screen (opening it, or the app returning to it): the kept plan while fresh, else a new one.
    const enter = async () => {
      const day = civilDateKey(new Date(), tzid);
      if (!inputs.current) inputs.current = await loadInputs();
      if (!live) return;
      const { pool, tehillim, bank, sayings: data } = inputs.current;
      setSayings(data);
      setState(openPlan(day, ({ seenQuiz, recent, seed }) => {
        const { skip, categoryStats } = quizSkips();
        const verse = verseOfDay(tehillim, seed, recent.verse);
        return composeForMe({ day, seed, reviewItems: readReviewItems(), chidushim: loadChidushim(), halachaPool: pool, learnedHalacha: readLearned(), quizPool: bank.questions, seenQuiz, skipQuiz: skip, categoryStats, recent, verse });
      }, { sayings: data?.SAYINGS?.length || 0 }));
    };
    enter();
    const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';
    const beat = setInterval(() => { if (visible()) touchPlan(); }, HEARTBEAT_MS);
    const onVisibility = () => { if (visible()) enter(); else touchPlan(); };
    document.addEventListener?.('visibilitychange', onVisibility);
    return () => { live = false; clearInterval(beat); document.removeEventListener?.('visibilitychange', onVisibility); touchPlan(); };
  }, [tzid]);

  const done = index => setState(current => ({ ...current, ...markCardDone(index) }));
  const grade = useCallback(async (question, choice) => {
    const bank = inputs.current?.bank || await loadBank();
    const result = gradeChoice(bank, question, choice, { reveal: revealSetting() });
    if (result.known) recordAnswer({ question: bank.byId.get(question.id) || question, correct: result.correct });
    return result;
  }, []);
  // The next question for card `index`: adapted to the weak areas, never one shown lately or elsewhere on the screen.
  const nextQuestion = useCallback(index => {
    const bank = inputs.current?.bank;
    if (!bank) return null;
    const kept = readForMe();
    const { skip, categoryStats } = quizSkips();
    const exclude = new Set([...kept.seenQuiz, ...skip, ...kept.plan.map(card => card.question?.id).filter(Boolean)]);
    const chosen = chooseNewQuestion({ quizPool: bank.questions, reviewItems: readReviewItems(), exclude, categoryStats });
    if (!chosen) return null;
    const next = replaceCardQuestion(index, chosen);
    return next.plan[index]?.question || null;
  }, []);

  if (!state) return <div className="lz-forme"><PageHead title="בשבילי היום" onBack={leatzmiBack(go)} /><p className="loading" role="status">מכין את המפגש…</p></div>;
  const day = state.day;
  const sage = sayings ? (Number.isInteger(state.sageIndex) ? sayingAt(sayings, state.sageIndex) : null) || sayingForDay(sayings, day) : null;
  const all = state.plan.length > 0 && state.plan.every((_, index) => state.done.includes(index));
  return <div className="lz-forme">
    <PageHead title="בשבילי היום" line={state.plan.length ? `מפגש קצר, כ־${sessionMinutes(state.plan)} דקות.` : null} onBack={leatzmiBack(go)} />
    {sage && <Sage saying={sage} go={go} />}
    {!state.plan.length && <p className="lz-empty">כרגע אין מה להציע. חזרו מאוחר יותר — או כתבו חידוש ראשון.</p>}
    <ol className="lz-forme-list">
      {state.plan.map((card, index) => {
        const isDone = state.done.includes(index);
        // A question card keeps asking, so it never dims; the others quiet down once done.
        return <li key={`${state.composedAt}:${index}`} className={`lz-forme-card${isDone && !isQuestionCard(card) ? ' is-done' : ''}`}>
          <span className="lz-forme-letter" aria-hidden="true">{ORDINAL[index]}</span>
          {isQuestionCard(card)
            ? <QuestionCard card={card} onGrade={grade} onNext={() => nextQuestion(index)} onAnswered={() => { if (!isDone) done(index); }} />
            : <ForMeCard card={card} go={go} openPsalm={openPsalm} isDone={isDone} onDone={() => done(index)} />}
        </li>;
      })}
    </ol>
    {all && <p className="lz-closing" role="status">זה הכול לעכשיו. יישר כוח.</p>}
  </div>;
}

/**
 * One question after another in the same card. A tap is graded by the bank (never by the view), the result is said once
 * ("נכון" / "לא נכון", and the correct option only when the quiz's reveal setting is on), recorded, and after a short
 * beat — or at once with "לשאלה הבאה" — the next question takes its place. `initialState` is for tests and previews.
 */
export function QuestionCard({ card, onGrade, onNext, onAnswered, initialState = null }) {
  const [quiz, dispatch] = useReducer(questionReducer, initialState || initialQuestionState(card.question));
  const headingId = useId();
  const headingRef = useRef(null);
  const optionRefs = useRef([]);
  const touched = useRef(false);
  const { question, phase } = quiz;
  const answered = phase === 'answered';

  const choose = async choice => {
    if (phase !== 'asking') return;
    touched.current = true;
    dispatch({ type: 'choose', choice });
    let result = { correct: false, revealIndex: null };
    try { result = await onGrade(question, choice); } catch { /* graded as a miss, nothing revealed */ }
    dispatch({ type: 'graded', correct: result.correct, revealIndex: result.revealIndex });
    onAnswered?.();
  };
  const advance = useCallback(() => dispatch({ type: 'next', question: onNext?.() || null }), [onNext]);
  // Both a right and a wrong answer move on by themselves after a short beat.
  useEffect(() => {
    if (!answered) return undefined;
    const timer = setTimeout(advance, advanceDelay(quiz));
    return () => clearTimeout(timer);
  }, [answered, quiz.count]); // eslint-disable-line react-hooks/exhaustive-deps
  // A new question: the reader's focus (if it was in this card) goes to its wording.
  useEffect(() => { if (quiz.count > 0 && touched.current) headingRef.current?.focus({ preventScroll: true }); }, [quiz.count]);

  if (phase === 'empty') return <section aria-label="שאלה"><p className="lz-card-kind">שאלה חדשה</p><p className="lz-muted">אין כרגע שאלה חדשה. יש עוד ב״טריוויה, ידע ורוח״.</p></section>;
  const onKey = (event, index) => {
    const step = { ArrowDown: 1, ArrowLeft: 1, ArrowUp: -1, ArrowRight: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    optionRefs.current[(index + step + question.options.length) % question.options.length]?.focus();
  };
  const kind = card.type === 'quiz-missed' && quiz.count === 0 ? 'שאלה שחוזרת אליך' : 'שאלה חדשה';
  const said = announcement(quiz);
  const right = quiz.outcome === 'right';
  const showNote = answered && question.note && (right || quiz.revealIndex !== null);
  return <section className={`fmq${answered ? (right ? ' is-right' : ' is-wrong') : ''}`} aria-labelledby={headingId}>
    <p className="lz-card-kind">{kind}</p>
    <div className="fmq-body" key={question.id}>
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className="lz-card-title">{question.q}</h2>
      <div className="fmq-options" role="radiogroup" aria-labelledby={headingId}>{question.options.map((option, index) => {
        const chosen = quiz.chosen === index;
        const revealed = quiz.revealIndex === index;
        const cls = `fmq-option${chosen ? ' is-chosen' : ''}${chosen && answered ? (right ? ' is-right' : ' is-wrong') : ''}${revealed ? ' is-revealed' : ''}${answered && !chosen && !revealed ? ' is-faded' : ''}`;
        return <button key={index} ref={el => { optionRefs.current[index] = el; }} type="button" role="radio" className={cls}
          aria-checked={chosen} aria-disabled={phase !== 'asking' || undefined}
          tabIndex={quiz.chosen === null ? (index === 0 ? 0 : -1) : chosen ? 0 : -1}
          onKeyDown={event => onKey(event, index)} onClick={() => choose(index)}>
          <span className="fmq-mark" aria-hidden="true">{OPTION_MARKS[index]}</span>
          <span className="fmq-text">{option}</span>
          {revealed && <span className="lz-visually-hidden"> · התשובה הנכונה</span>}
          <span className="fmq-glyph" aria-hidden="true">{(chosen && answered) || revealed ? <Glyph right={revealed || right} /> : null}</span>
        </button>;
      })}</div>
    </div>
    {/* One polite announcement per answer; the visible line carries the same words. */}
    <p className="fmq-feedback" role="status" aria-live="polite">{said && <>
      <span className={`fmq-word ${right ? 'is-right' : 'is-wrong'}`}>{right ? FEEDBACK.right : FEEDBACK.wrong}</span>
      {quiz.revealIndex !== null && <span className="fmq-answer"><span className="lz-visually-hidden">. </span>התשובה הנכונה: {question.options[quiz.revealIndex]}</span>}
    </>}</p>
    {showNote && <p className="lz-muted fmq-note">{question.note}</p>}
    <div className="fmq-actions">{answered
      ? <button type="button" className="lz-text-button" onClick={advance}>לשאלה הבאה</button>
      : <span className="fmq-spacer" aria-hidden="true" />}</div>
  </section>;
}

// A fine check for a right answer; for a miss a small open ring (as in the quiz — nothing cross-like).
function Glyph({ right }) {
  return <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {right ? <path d="M5 10.5l3.2 3.2L15 6.8" /> : <circle cx="10" cy="10" r="4.2" />}
  </svg>;
}

// דברי חכמים: the words exactly as the book has them, its place, and the edition's licence and attribution.
// (A saying gathered from the web: its unvocalized words, its place, נחלת הכלל and where it was read.)
function Sage({ saying, go }) {
  return <section className="lz-sage" aria-labelledby="lz-sage-title">
    <h2 id="lz-sage-title" className="lz-sage-kind">דברי חכמים</h2>
    <blockquote lang="he">{saying.text}</blockquote>
    <p className="lz-sage-source">{saying.source}</p>
    {/* A saying whose book is in the library opens there; one gathered from the web carries only its citation. */}
    {saying.route && <div className="lz-card-actions"><button type="button" className="lz-text-button" onClick={() => go(saying.route)}>לפתוח במקור</button></div>}
    {/* The attribution in its parts, the edition (often named in English) on a line of its own, so it never scrambles the Hebrew. */}
    <p className="lz-sage-licence" aria-label={saying.attribution}><span><bdi>{saying.licenseTitle}</bdi> · {saying.via}</span><span className="lz-sage-edition" dir="auto">{saying.edition}</span></p>
  </section>;
}

function ForMeCard({ card, go, openPsalm, isDone, onDone }) {
  const [revealed, setRevealed] = useState(isDone);
  const finishedButton = !isDone && <button type="button" className="lz-text-button" onClick={onDone}>סיימתי</button>;
  if (card.type === 'halacha') return <section aria-label="הלכה">
    <p className="lz-card-kind">{card.review ? 'הלכה לחזרה' : 'הלכה אחת'}</p>
    <h2 className="lz-card-title">{card.question}</h2>
    {revealed ? <p className="lz-answer">{card.answer}</p> : <button type="button" className="lz-text-button" onClick={() => setRevealed(true)}>הצגת התשובה</button>}
    <div className="lz-card-actions"><button type="button" className="lz-text-button" onClick={() => go(`halacha/q/${encodeURIComponent(card.id)}`)}>לתשובה המלאה ולמקורות</button>{revealed && finishedButton}</div>
  </section>;
  if (card.type === 'verse') return <section aria-label="פסוק">
    <p className="lz-card-kind">פסוק</p>
    <blockquote className="lz-verse" lang="he">{card.text}</blockquote>
    <p className="lz-muted">תהילים {plainNumeral(card.chapter)}, {plainNumeral(card.verse)}</p>
    <div className="lz-card-actions"><button type="button" className="lz-text-button" onClick={() => openPsalm?.(card.chapter)}>לפרק כולו</button>{finishedButton}</div>
  </section>;
  if (card.type === 'chidush') return <section aria-label="חידוש שלך">
    <p className="lz-card-kind">מן החידושים שלך</p>
    <h2 className="lz-card-title">{card.title || 'ללא כותרת'}</h2>
    {card.excerpt && <p className="lz-card-text">{card.excerpt}</p>}
    <div className="lz-card-actions">
      <button type="button" className="lz-text-button" onClick={() => go(leatzmiRoute.chidush(card.chidushId))}>לקריאה</button>
      <button type="button" className="lz-text-button" onClick={() => { const note = createFollowUp(card.chidushId); onDone(); if (note) go(leatzmiRoute.edit(note.id)); }}>מה אני חושב על זה היום?</button>
      {finishedButton}
    </div>
  </section>;
  if (card.type === 'favorite') return <section aria-label="מן המועדפים">
    <p className="lz-card-kind">מן המועדפים</p>
    <h2 className="lz-card-title">{card.title}</h2>
    <div className="lz-card-actions"><button type="button" className="lz-text-button" onClick={() => go('leatzmi/review')}>לחזרה</button>{finishedButton}</div>
  </section>;
  return null;
}
