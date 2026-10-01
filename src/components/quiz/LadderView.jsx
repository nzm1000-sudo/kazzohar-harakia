import { useEffect, useRef } from 'react';
import { Lozenge, Lifelines, AudienceChart, formatPoints } from './LadderParts.jsx';
import { OPTION_MARKS, FLAG_TEXT, REVEAL_TEXT } from './QuestionView.jsx';
import { motionReduced } from '../../services/quiz/feel.mjs';

// One question of הסולם. Presentational: like QuestionView it is never given the correct answer — only the player's
// choice and the verdict; `revealed` (the correct index) is passed by the page only after a miss and only when
// "להציג את התשובה הנכונה?" is on. `removed` (חמישים–חמישים) and `audience` come from services/quiz/ladder.mjs.
// Phases: ask → confirm ("תשובה סופית?", when that setting is on) → suspense (a short held breath) → right | wrong.
export const FINAL_TEXT = 'תשובה סופית?';
export const VERDICT_TEXT = { right: 'נכון', wrong: 'לא נכון' };
export const WALK_TEXT = 'לסיים ולשמור';

export default function LadderView({ question, step, phase = 'ask', selected = null, revealed = null, removed = [], audience = null, used = {},
  categoryText = '', verdictLine = '', banked = 0, nextLabel = 'לשאלה הבאה', walkAsk = false,
  onChoose, onConfirm, onCancel, onLifeline, onNext, onFlag, onWalk, onWalkCancel, onWalkConfirm }) {
  const headingRef = useRef(null);
  const nextRef = useRef(null);
  const finalRef = useRef(null);
  const optionRefs = useRef([]);
  const answered = phase === 'right' || phase === 'wrong';
  const locked = answered || phase === 'suspense';
  const shown = phase === 'wrong' && Number.isInteger(revealed) && revealed !== selected ? revealed : null;
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [question.id]);
  // The moment that follows a choice is kept in view on a phone (the question and its answers fill the screen).
  const bring = el => { try { el?.scrollIntoView({ block: 'nearest', behavior: motionReduced() ? 'auto' : 'smooth' }); } catch { /* old browsers */ } };
  useEffect(() => { if (answered) { nextRef.current?.focus({ preventScroll: true }); bring(nextRef.current); } }, [answered]);
  useEffect(() => { if (phase === 'confirm') { finalRef.current?.focus({ preventScroll: true }); bring(finalRef.current); } }, [phase, selected]);
  const live = [0, 1, 2, 3].filter(i => !removed.includes(i));
  const onKey = (event, i) => {
    if (locked) return;
    const dir = { ArrowDown: 1, ArrowLeft: 1, ArrowUp: -1, ArrowRight: -1 }[event.key];
    if (!dir) return;
    event.preventDefault();
    const at = live.indexOf(i);
    optionRefs.current[live[(at + dir + live.length) % live.length]]?.focus();
  };
  const qid = `qz-q-${question.id}`;
  const focusable = selected !== null && live.includes(selected) ? selected : live[0];
  return <section className={`qz-question is-${phase}`} aria-labelledby={qid}>
    <Lifelines used={used} disabled={phase !== 'ask' && phase !== 'confirm'} onUse={onLifeline} />
    <p className="qz-stepline">
      <span>שאלה {step.numeral}</span><i aria-hidden="true" />
      <span>על {formatPoints(step.points)} נקודות</span>
      {categoryText ? <><i aria-hidden="true" /><span>{categoryText}</span></> : null}
    </p>
    <div className="qz-qwrap">
      <Lozenge className="qz-qframe" tip={26}>
        <h2 id={qid} ref={headingRef} tabIndex={-1} className="qz-q-text">{question.q}</h2>
      </Lozenge>
    </div>
    <AudienceChart poll={audience} />
    <div className="qz-options" role="radiogroup" aria-labelledby={qid}>
      {question.options.map((text, i) => {
        const gone = removed.includes(i);
        const chosen = selected === i;
        const reveal = shown === i;
        const cls = `qz-option${chosen ? ' is-chosen' : ''}${reveal ? ' is-revealed' : ''}${gone ? ' is-removed' : ''}${(answered || phase === 'suspense') && !chosen && !reveal && !gone ? ' is-faded' : ''}`;
        return <Lozenge as="button" key={i} innerRef={el => { optionRefs.current[i] = el; }} type="button" role="radio" tip={16} className={cls}
          aria-checked={chosen} aria-disabled={locked || gone || undefined} tabIndex={gone ? -1 : i === focusable ? 0 : -1}
          aria-label={gone ? `${OPTION_MARKS[i]} — הוסרה` : undefined}
          onKeyDown={event => onKey(event, i)} onClick={() => { if (!locked && !gone) onChoose?.(i); }}>
          <span className="qz-option-mark" aria-hidden="true">{OPTION_MARKS[i]}</span>
          <span className="qz-option-text" aria-hidden={gone || undefined}>{gone ? '' : text}</span>
          {reveal ? <span className="visually-hidden">{` · ${REVEAL_TEXT}`}</span> : null}
          <span className="qz-option-glyph" aria-hidden="true">{chosen && answered ? <Glyph right={phase === 'right'} /> : reveal ? <Glyph right /> : null}</span>
        </Lozenge>;
      })}
    </div>
    <div className="qz-final" hidden={phase !== 'confirm' || undefined}>
      {phase === 'confirm' ? <>
        <p className="qz-final-q">{FINAL_TEXT}</p>
        <div className="qz-final-actions">
          <button ref={finalRef} type="button" className="quiz-primary qz-final-yes" onClick={onConfirm}>סופית</button>
          <button type="button" className="quiz-quiet" onClick={onCancel}>עוד רגע</button>
        </div>
      </> : null}
    </div>
    <p className="qz-verdict" role="status" aria-live="polite">
      {answered ? <><b>{VERDICT_TEXT[phase]}</b>{verdictLine ? <small>{verdictLine}</small> : null}</> : phase === 'suspense' ? <span className="visually-hidden">רגע…</span> : ''}
    </p>
    <div className="qz-actions">
      {answered ? <button ref={nextRef} type="button" className="quiz-primary quiz-primary-lg" onClick={onNext}>{nextLabel}</button> : null}
      {walkAsk ? <div className="qz-walk-ask" role="group" aria-label={WALK_TEXT}>
        <p>לסיים כאן ולשמור {formatPoints(banked)} נקודות?</p>
        <div className="qz-final-actions">
          <button type="button" className="quiz-primary" onClick={onWalkConfirm}>כן, לשמור</button>
          <button type="button" className="quiz-quiet" onClick={onWalkCancel}>להמשיך לטפס</button>
        </div>
      </div> : <div className="quiz-actions-quiet">
        {onFlag ? <button type="button" className="quiz-quiet quiz-flag" onClick={onFlag} aria-label={`${FLAG_TEXT} — ${answered ? 'לא להציג שוב' : 'להחליף ולא להציג שוב'}`}>{FLAG_TEXT}</button> : null}
        {onFlag && onWalk && !answered ? <span className="quiz-sep" aria-hidden="true" /> : null}
        {onWalk && !answered ? <button type="button" className="quiz-quiet qz-walk" onClick={onWalk} disabled={phase === 'suspense'}>{WALK_TEXT}<span className="qz-walk-pts">{formatPoints(banked)}</span></button> : null}
      </div>}
    </div>
  </section>;
}

function Glyph({ right }) {
  return <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    {right ? <path d="M5 10.5l3.2 3.2L15 6.8" /> : <circle cx="10" cy="10" r="4.2" />}
  </svg>;
}
