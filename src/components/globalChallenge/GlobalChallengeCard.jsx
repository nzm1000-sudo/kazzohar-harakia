import { useEffect, useMemo } from 'react';
import TitleOrnament from '../ui/TitleOrnament.jsx';
import ArrowMark from '../ui/ArrowMark.jsx';
import { challengeToday, CLOSED_TEXT, countLine } from '../../services/globalChallenge/status.mjs';
import { dayResult } from '../../services/globalChallenge/store.mjs';
import { GLOBAL_SIZE } from '../../services/globalChallenge/scoring.mjs';
import { useGlobalChallenge, useChallengeSync, refreshDay, challengeApi } from './useGlobalChallenge.js';

// האתגר העולמי של היום — the Clay card: on Today (under "להמשיך מהיכן שהפסקת", beside the quiz's own tile) and at the
// top of the quiz. Before the game: the invitation and the day's count; after it: the result's five marks, and the way
// to the full result and to the board. On Today it steps aside entirely when there is no challenge (Shabbat, Yom Tov,
// after candle lighting) or the player turned the challenge off; in the quiz it says why, quietly.
export const GLOBAL_ROUTE = 'leatzmi/quiz/global';
export const BOARD_ROUTE = 'leatzmi/quiz/board';
const timeOf = (ms, tz) => { try { return new Intl.DateTimeFormat('he-IL', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms)); } catch { return ''; } };

export function ResultMarks({ answers, className = '' }) {
  return <span className={`gc-marks${className ? ` ${className}` : ''}`} role="img" aria-label={`${answers.filter(a => a.correct).length} נכונות מתוך ${GLOBAL_SIZE}`}>
    {Array.from({ length: GLOBAL_SIZE }, (_, i) => <i key={i} className={answers[i] ? (answers[i].correct ? 'is-right' : 'is-wrong') : 'is-open'} />)}
  </span>;
}

export default function GlobalChallengeCard({ settings = null, go = () => {}, place = 'today', now = null }) {
  const [state] = useGlobalChallenge();
  const at = now ? new Date(now).getTime() : Date.now();
  const today = useMemo(() => challengeToday({ now: at, settings }), [Math.floor(at / 60000), settings?.location?.tzid, settings?.location?.latitude, settings?.halachicResidenceStatus, settings?.il, settings?.candles]);
  const participate = state.prefs.participate;
  const result = dayResult(state, today.date);
  const online = challengeApi().enabled;
  useChallengeSync(participate);
  useEffect(() => { if (participate && online && (today.open || result)) refreshDay(today.date); }, [participate, online, today.date, Boolean(result)]);
  const stats = state.stats[today.date] || null;
  const inQuiz = place === 'hub';
  if (!participate) {
    if (!inQuiz) return null;
    return <button type="button" className="gc-quiet-line" onClick={() => go('settings/challenge')}>האתגר העולמי כבוי · להפעלה בהגדרות</button>;
  }
  if (!today.open && !result) {
    if (!inQuiz) return null;
    return <section className="gc-card is-closed" aria-labelledby={`gc-card-title-${place}`}>
      <h2 className="gc-card-title" id={`gc-card-title-${place}`}>האתגר העולמי של היום</h2>
      <TitleOrnament />
      <p className="gc-card-note">{CLOSED_TEXT[today.reason] || ''}</p>
    </section>;
  }
  const tz = settings?.location?.tzid || 'Asia/Jerusalem';
  const count = online ? countLine(stats?.n) : '';
  return <section className={`gc-card${result ? ' is-done' : ''}${inQuiz ? ' is-hub' : ''}`} aria-labelledby={`gc-card-title-${place}`}>
    <h2 className="gc-card-title" id={`gc-card-title-${place}`}>האתגר העולמי של היום</h2>
    <TitleOrnament />
    {result ? <>
      <ResultMarks answers={result.answers} />
      <p className="gc-card-lead">{result.correct === 1 ? 'ענית נכון על שאלה אחת' : `ענית נכון על ${result.correct}`} מתוך {GLOBAL_SIZE}</p>
      {count ? <p className="gc-card-count">{count}</p> : null}
      <div className="gc-card-actions">
        <button type="button" className="gc-card-go" onClick={() => go(GLOBAL_ROUTE)}><span>התוצאות</span><ArrowMark size="inline" /></button>
        {online ? <button type="button" className="gc-card-go" onClick={() => go(BOARD_ROUTE)}><span>טבלת השיאים</span><ArrowMark size="inline" /></button> : null}
      </div>
    </> : <>
      <p className="gc-card-lead">חמש שאלות · אותן שאלות לכל הלומדים בעולם</p>
      <button type="button" className="gc-card-play" onClick={() => go(GLOBAL_ROUTE)}><span>לאתגר של היום</span><ArrowMark /></button>
      <p className="gc-card-count">{[count, today.closesAt ? `נסגר בהדלקת הנרות · ${timeOf(today.closesAt, tz)}` : ''].filter(Boolean).join(' · ') || 'הזדמנות אחת ביום · 30 שניות לשאלה'}</p>
    </>}
  </section>;
}
