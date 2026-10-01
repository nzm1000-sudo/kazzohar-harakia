import { useEffect, useRef } from 'react';
import { QuizClock, Explanation } from './QuizClock.jsx';
import { motionReduced } from '../../services/quiz/feel.mjs';

// One question, four answers. Presentational only: it is never given the correct answer — just the player's choice and
// whether it was right — so a wrong answer cannot reveal the correct option, in the markup or to a screen reader.
// After an answer every unchosen option fades alike (the correct one is not singled out).
// The one exception is the player's own choice: with "להציג את התשובה הנכונה?" on, the page passes `revealed` (the
// correct index) only after a miss, and that option alone takes a fine gold outline and a check.
export const OPTION_MARKS = ['א', 'ב', 'ג', 'ד'];
export const FEEDBACK_TEXT = { right: 'נכון', wrong: 'לא נכון', timeout: 'הזמן עבר' };

// The public face of a question: what the view may see.
export const publicQuestion = q => ({ id: q.id, q: q.q, options: [...q.options], category: q.category });

export const REVEAL_TEXT = 'התשובה הנכונה';
export const FLAG_TEXT = 'לא מתאימה';

// `timer` ({ remaining, total }) shows the question's clock; `explanation` ("הסבר קצר", decided by the page — never after a
// miss unless the answer may be shown) stays under the verdict until "לשאלה הבאה".
export default function QuestionView({ question, index, total, categoryText = '', selected = null, feedback = null, revealed = null, onChoose, onNext, onFlag, timer = null, explanation = null, last = false, onExit }) {
  const headingRef = useRef(null);
  const nextRef = useRef(null);
  const optionRefs = useRef([]);
  const answered = feedback !== null;
  const shown = answered && feedback !== 'right' && Number.isInteger(revealed) && revealed !== selected ? revealed : null;
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [question.id]);
  // After the answer the verdict, the explanation and "לשאלה הבאה" are brought into view on a phone.
  useEffect(() => {
    if (!answered) return;
    nextRef.current?.focus({ preventScroll: true });
    try { nextRef.current?.scrollIntoView({ block: 'nearest', behavior: motionReduced() ? 'auto' : 'smooth' }); } catch { /* old browsers */ }
  }, [answered]);
  // Radio-group keys: arrows move between the answers (RTL: right is "previous"), Enter/Space choose.
  const onKey = (event, i) => {
    if (answered) return;
    const step = { ArrowDown: 1, ArrowLeft: 1, ArrowUp: -1, ArrowRight: -1 }[event.key];
    if (step) { event.preventDefault(); optionRefs.current[(i + step + 4) % 4]?.focus(); }
  };
  const qid = `quiz-q-${question.id}`;
  const state = answered ? (feedback === 'right' ? ' is-right' : ' is-wrong') : '';
  const progress = total ? (index + (answered ? 1 : 0)) / total : 0;
  return <section className={`quiz-question${state}`} aria-labelledby={qid}>
    <div className="quiz-meter">
      <span className="quiz-count" aria-label={`שאלה ${index + 1} מתוך ${total}`}>
        <span aria-hidden="true"><b>{index + 1}</b><i>/</i>{total}</span>
      </span>
      <span className="quiz-track" aria-hidden="true"><span style={{ transform: `scaleX(${progress})` }} /></span>
      {categoryText ? <span className="quiz-cat">{categoryText}</span> : null}
    </div>
    {timer ? <QuizClock remaining={timer.remaining} total={timer.total} className="qz-clock-play" /> : null}
    <h2 id={qid} ref={headingRef} tabIndex={-1} className="quiz-q-text">{question.q}</h2>
    <div className="quiz-options" role="radiogroup" aria-labelledby={qid}>
      {question.options.map((text, i) => {
        const chosen = selected === i;
        const reveal = shown === i;
        const cls = `quiz-option${chosen ? ' is-chosen' : ''}${reveal ? ' is-revealed' : ''}${answered && !chosen && !reveal ? ' is-faded' : ''}`;
        return <button key={i} ref={el => { optionRefs.current[i] = el; }} type="button" role="radio" className={cls}
          aria-checked={chosen} aria-disabled={answered || undefined} tabIndex={answered ? (chosen ? 0 : -1) : (selected === null ? (i === 0 ? 0 : -1) : chosen ? 0 : -1)}
          onKeyDown={event => onKey(event, i)} onClick={() => { if (!answered) onChoose?.(i); }}>
          <span className="quiz-mark" aria-hidden="true">{OPTION_MARKS[i]}</span>
          <span className="quiz-option-text">{text}</span>
          {reveal ? <span className="visually-hidden">{` · ${REVEAL_TEXT}`}</span> : null}
          {chosen && answered ? <FeedbackGlyph right={feedback === 'right'} /> : reveal ? <FeedbackGlyph right /> : <span className="quiz-glyph" aria-hidden="true" />}
        </button>;
      })}
    </div>
    <p className="quiz-feedback" role="status" aria-live="polite">{answered ? FEEDBACK_TEXT[feedback] : ''}</p>
    {answered ? <Explanation text={explanation} /> : null}
    <div className="quiz-actions">
      {answered ? <button ref={nextRef} type="button" className="quiz-primary" onClick={onNext}>{last ? 'לסיכום' : 'לשאלה הבאה'}</button> : <span className="quiz-actions-spacer" aria-hidden="true" />}
      {onExit || onFlag ? <div className="quiz-actions-quiet">
        {onFlag ? <button type="button" className="quiz-quiet quiz-flag" onClick={onFlag} aria-label={`${FLAG_TEXT} — לדלג ולא להציג שוב`}>{FLAG_TEXT}</button> : null}
        {onExit && onFlag ? <span className="quiz-sep" aria-hidden="true" /> : null}
        {onExit ? <button type="button" className="quiz-quiet" onClick={onExit}>סיום הסבב</button> : null}
      </div> : null}
    </div>
  </section>;
}

// A fine check for a correct answer; for a wrong one a small open ring (no "×" — nothing cross-like).
function FeedbackGlyph({ right }) {
  return <span className="quiz-glyph" aria-hidden="true">
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {right ? <path d="M5 10.5l3.2 3.2L15 6.8" /> : <circle cx="10" cy="10" r="4.2" />}
    </svg>
  </span>;
}
