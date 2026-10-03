import { useEffect, useRef, useState } from 'react';
import TitleOrnament from '../ui/TitleOrnament.jsx';
import { hebrewDateLabel } from '../quiz/LadderPlay.jsx';
import { challengeToday } from '../../services/globalChallenge/status.mjs';
import { weekDays } from '../../services/globalChallenge/calendar.mjs';
import { useGlobalChallenge, challengeApi, useChallengeSync } from './useGlobalChallenge.js';
import NicknameForm from './NicknameForm.jsx';

// טבלת השיאים העולמית (leatzmi/quiz/board): the week's points from the days' challenges — Sunday to Friday, new at
// motzaei Shabbat. The top hundred, and "המקום שלך" with five above and five below. Only nicknames; joining is a
// separate choice (here or in the settings), and a player who has not joined sees the board without a place.
const nf = new Intl.NumberFormat('he-IL');
export const BOARD_TITLE = 'טבלת השיאים העולמית';

// The week in Hebrew dates: 'כ״ג–כ״ח תשרי תשפ״ז' (one month), else both ends with their months.
export function weekLabel(days) {
  const parts = key => { const words = hebrewDateLabel(key).split(' '); return { day: words[0], month: words.slice(1, -1).join(' '), year: words[words.length - 1] }; };
  const a = parts(days[0]);
  const b = parts(days[days.length - 1]);
  if (a.year !== b.year) return `${hebrewDateLabel(days[0])} – ${hebrewDateLabel(days[days.length - 1])}`;
  if (a.month !== b.month) return `${a.day} ${a.month} – ${b.day} ${b.month} ${a.year}`;
  return `${a.day}–${b.day} ${a.month} ${a.year}`;
}

function Row({ row, me = false }) {
  return <li className={`gc-row${me || row.me ? ' is-me' : ''}`} aria-current={me || row.me ? 'true' : undefined}>
    <span className="gc-row-rank">{nf.format(row.rank)}</span>
    <span className="gc-row-name"><bdi>{row.nickname}</bdi></span>
    <span className="gc-row-points">{nf.format(row.points)}<small> נק׳</small></span>
  </li>;
}

export default function Leaderboard({ settings = null, onHome, go }) {
  const [state] = useGlobalChallenge();
  const [today] = useState(() => challengeToday({ now: Date.now(), settings }));
  const week = today.week;
  const [board, setBoard] = useState(null);
  const [status, setStatus] = useState('loading'); // loading · ready · offline · disabled
  const [epoch, setEpoch] = useState(0);
  const titleRef = useRef(null);
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }); }, []);
  useChallengeSync(state.prefs.participate);
  const client = challengeApi();
  useEffect(() => {
    if (!client.enabled) { setStatus('disabled'); return undefined; }
    let live = true;
    setStatus(s => (s === 'ready' ? s : 'loading'));
    client.board({ week, device: state.device }).then(res => {
      if (!live) return;
      if (res.ok) { setBoard(res.data); setStatus('ready'); } else setStatus('offline');
    });
    return () => { live = false; };
  }, [week, state.device, state.prefs.board, epoch]);
  const days = weekDays(week);
  const me = board?.me;
  const joined = state.prefs.board && state.prefs.nickname;
  return <section className="quiz-page gc-page gc-board" aria-labelledby="gc-board-title">
    <button type="button" className="local-back quiz-quiet qz-back" onClick={onHome}>שעשועון טריוויה יהודי</button>
    <header className="quiz-head quiz-head-plain">
      <p className="quiz-kicker">{weekLabel(days)}</p>
      <h1 id="gc-board-title" ref={titleRef} tabIndex={-1} className="quiz-title quiz-title-sm">{BOARD_TITLE}</h1>
      <TitleOrnament />
      <p className="quiz-tagline gc-board-tagline"><span>נקודות האתגר, מראשון עד שישי</span><span>מתחילים מחדש במוצאי שבת</span></p>
    </header>
    {status === 'disabled' ? <p className="gc-board-note">טבלת השיאים תיפתח כשהשרת של האתגר יהיה פעיל</p> : null}
    {status === 'offline' ? <div className="gc-board-note"><p>טבלת השיאים תופיע כשתתחבר</p><button type="button" className="quiz-quiet" onClick={() => setEpoch(n => n + 1)}>לנסות שוב</button></div> : null}
    {status === 'loading' ? <p className="quiz-loading">טוען את הטבלה…</p> : null}
    {status === 'ready' ? <>
      {me?.listed ? <section className="gc-me" aria-labelledby="gc-me-title">
        <h2 id="gc-me-title" className="gc-section-title">המקום שלך</h2>
        <TitleOrnament />
        <p className="gc-me-rank"><b>{nf.format(me.rank)}</b><span>מתוך {nf.format(board.total)} · {nf.format(me.points)} נקודות</span></p>
        <ol className="gc-rows gc-rows-around">
          {me.above.map((row, i) => <Row key={`a${i}`} row={row} />)}
          <Row row={{ rank: me.rank, nickname: me.nickname, points: me.points }} me />
          {me.below.map((row, i) => <Row key={`b${i}`} row={row} />)}
        </ol>
      </section> : <section className="gc-join" aria-labelledby="gc-join-title">
        <h2 id="gc-join-title" className="gc-section-title">{joined ? 'עוד אין לך נקודות השבוע' : 'להופיע בטבלה'}</h2>
        <TitleOrnament />
        {joined ? <p className="gc-join-text">הנקודות מגיעות מהאתגר העולמי של כל יום חול. {me && me.points ? '' : 'האתגר של היום מחכה.'}</p>
          : state.prefs.nickname ? <p className="gc-join-text">הכינוי שלך, <bdi>{state.prefs.nickname}</bdi>, שמור. ההופעה בטבלה נפרדת — להפעלה בהגדרות.</p>
            : <>
              <p className="gc-join-text">אפשר לשחק בלי להופיע. מי שרוצה להופיע בוחר כינוי — בלי שם אמיתי, בלי פרטים.{me?.points ? ` הנקודות שצברת השבוע (${nf.format(me.points)}) ייכנסו לטבלה.` : ''}</p>
              <NicknameForm onDone={() => setEpoch(n => n + 1)} />
            </>}
        {state.prefs.nickname && !state.prefs.board ? <button type="button" className="quiz-quiet" onClick={() => go('settings/challenge')}>להגדרות האתגר</button> : null}
      </section>}
      <section className="gc-top" aria-labelledby="gc-top-title">
        <h2 id="gc-top-title" className="gc-section-title">{board.total > 100 ? 'מאה הראשונים' : 'השבוע'}</h2>
        <TitleOrnament />
        {board.top.length ? <ol className="gc-rows">{board.top.map((row, i) => <Row key={i} row={row} />)}</ol>
          : <p className="gc-board-note">עדיין אין נקודות השבוע. הראשונים יופיעו כאן אחרי האתגר הבא.</p>}
      </section>
    </> : null}
  </section>;
}
