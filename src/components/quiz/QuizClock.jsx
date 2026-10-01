import { useEffect, useRef, useState } from 'react';
import { TIMER_SECONDS, clockUrgent, startCountdown, scheduleAdvance } from '../../services/quiz/clock.mjs';

// The question's clock (services/quiz/clock.mjs): a ring that empties with the seconds and the number at its heart —
// electric while there is time, red in the last ten seconds (blinking only with motion; steady red under reduced
// motion). role="timer": read when asked, never announced each second.
const nf = new Intl.NumberFormat('he-IL');

export function QuizClock({ remaining, total = TIMER_SECONDS, className = '' }) {
  const t = Math.max(0, Math.min(1, remaining / (total || 1)));
  const urgent = clockUrgent(remaining);
  return <div className={`qz-clock${urgent ? ' is-urgent' : ''}${remaining <= 0 ? ' is-out' : ''} ${className}`.trim()} role="timer" aria-label={`נותרו ${nf.format(remaining)} שניות`}>
    <svg className="qz-clock-ring" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="21" className="qz-clock-track" />
      <circle cx="24" cy="24" r="21" pathLength="1" className="qz-clock-left" strokeDasharray={`${t} 1`} transform="rotate(-90 24 24)" />
    </svg>
    <span className="qz-clock-body" aria-hidden="true"><b>{remaining}</b><small>שניות</small></span>
  </div>;
}

// The clock's seconds for the question on screen: from TIMER_SECONDS at each new `resetKey`, counting while `running`
// (paused otherwise, e.g. the ladder's held breath and the verdict), `onTimeout` once at 0.
export function useQuestionClock({ enabled = false, running = false, resetKey, seconds = TIMER_SECONDS, onTimeout }) {
  const [remaining, setRemaining] = useState(seconds);
  const left = useRef(seconds);
  const timeout = useRef(onTimeout);
  timeout.current = onTimeout;
  useEffect(() => { left.current = seconds; setRemaining(seconds); }, [resetKey, seconds]);
  useEffect(() => {
    if (!enabled || !running || left.current <= 0) return undefined;
    return startCountdown({ from: left.current, onTick: v => { left.current = v; setRemaining(v); }, onTimeout: () => timeout.current?.() });
  }, [enabled, running, resetKey]);
  return remaining;
}

// After the verdict: wait for the tap when an explanation is shown; otherwise move on after the beat.
export function useAutoAdvance({ active = false, wait = false, key, onAdvance }) {
  const advance = useRef(onAdvance);
  advance.current = onAdvance;
  useEffect(() => {
    if (!active) return undefined;
    return scheduleAdvance({ wait, onAdvance: () => advance.current?.() });
  }, [active, wait, key]);
}

// "הסבר קצר": the explanation under the verdict, until "לשאלה הבאה".
export function Explanation({ text }) {
  if (!text) return null;
  return <aside className="qz-explain" aria-label="הסבר קצר">
    <p className="qz-explain-eyebrow" aria-hidden="true">הסבר קצר</p>
    <p className="qz-explain-text">{text}</p>
  </aside>;
}
