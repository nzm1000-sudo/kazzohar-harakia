import { useEffect, useMemo, useState } from 'react';
import { StudyCompletion } from './CompletionButton.jsx';
import { BackNavigation } from './LocalNavigation.jsx';
import { formatGregorianDate } from '../civilDate.mjs';
import { JOURNAL_CHANGE_EVENT } from '../services/mitzvotJournal.mjs';
import { DAILY_LEARNING_SOURCE, DAILY_TRACKS, PENDING_TRACKS, dailyPortions, dailyWorkId, isPortionDone } from '../services/dailyLearningSchedule.mjs';

// לימוד יומי: today's portions of the recognised cycles (services/dailyLearningSchedule.mjs), each opening straight in
// the app's reader, each with the app's one "סיימתי" (a light in the spiritual circle). Styles: styles/daily-share-travel.css.

// Today's portions and whether each is done; refreshed whenever the journal changes (a "סיימתי" here or in a reader).
export function useDailyPortions(context, tzid) {
  const portions = useMemo(() => dailyPortions(context || {}), [context?.civil, context?.key]);
  const probe = () => Object.fromEntries(portions.map(portion => [portion.trackId, isPortionDone(portion, { tzid })]));
  const [done, setDone] = useState(probe);
  useEffect(() => {
    setDone(probe());
    const refresh = () => setDone(probe());
    try { window.addEventListener(JOURNAL_CHANGE_EVENT, refresh); window.addEventListener('focus', refresh); } catch { return undefined; }
    return () => { window.removeEventListener(JOURNAL_CHANGE_EVENT, refresh); window.removeEventListener('focus', refresh); };
  }, [portions, tzid]);
  return { portions, done };
}

export const dailyLearningDateLine = context => [context?.civil ? formatGregorianDate(context.civil) : null, context?.date?.label || null].filter(Boolean).join(' · ');

// One part of a portion: in the reader when it is on the device; online (Sefaria) only when it is not, and said so.
function PartButton({ part, go, openSource, single = false }) {
  const open = part.route ? () => go?.(part.route) : part.sefariaRef && openSource ? () => openSource(part.sefariaRef, part.label) : null;
  return <button type="button" className="dl-part" onClick={open || undefined} disabled={!open}>
    <span className="dl-part-text"><strong>{single ? (part.route ? 'פתיחה לקריאה' : part.sefariaRef ? 'פתיחה מספריא' : part.label) : part.label}</strong><small>{part.note}</small></span>
    {open && <span className="dl-part-arrow" aria-hidden="true">←</span>}
  </button>;
}

// A track's own page (route learning/<track>): the portion, where to read it, and "סיימתי".
export function DailyLearningTrack({ trackId, context, tzid = 'Asia/Jerusalem', go, openSource }) {
  const { portions, done } = useDailyPortions(context, tzid);
  const pending = PENDING_TRACKS.find(track => track.id === trackId);
  const portion = portions.find(item => item.trackId === trackId);
  const track = portion?.track || DAILY_TRACKS.find(item => item.id === trackId) || pending;
  const back = () => (Number(history.state?.kzDepth) > 0 ? history.back() : go?.('learning'));
  return <section className="dl-page dl-track-page">
    <BackNavigation label="חזרה ללימוד היומי" onClick={back} />
    <header className="dl-head">
      <p className="eyebrow">לימוד יומי · {dailyLearningDateLine(context)}</p>
      <h1>{track?.title || 'לימוד יומי'}</h1>
      <span className="gold-divider" aria-hidden="true"><i /></span>
      {track?.about && <p className="dl-about">{track.about}</p>}
    </header>
    {pending && <p className="notice dl-pending-note">{pending.reason}</p>}
    {!pending && !portion && <p className="notice">לא ניתן לחשב את הלימוד לתאריך הזה.</p>}
    {portion && <>
      <p className={`dl-portion${done[trackId] ? ' is-done' : ''}`} aria-label={`הלימוד היום: ${portion.label}`}>{portion.label}</p>
      <div className="dl-parts">{portion.parts.map(part => <PartButton key={part.label} part={part} go={go} openSource={openSource} single={portion.parts.length === 1} />)}</div>
      <StudyCompletion workId={dailyWorkId(trackId)} workTitle={track.title} unitId={portion.unitId} unitLabel={portion.label} source={DAILY_LEARNING_SOURCE} tzid={tzid} />
    </>}
  </section>;
}

// The compact card for a hub (בית המדרש): today's portions in one frame, each opening its reader; the frame's foot
// leads to every track. Never on Today.
export function DailyLearningCard({ context, tzid = 'Asia/Jerusalem', go }) {
  const { portions, done } = useDailyPortions(context, tzid);
  if (!portions.length) return null;
  const count = portions.filter(portion => done[portion.trackId]).length;
  return <section className="dl-card" aria-labelledby="dl-card-title">
    <header className="dl-card-head">
      <h2 id="dl-card-title">לימוד יומי</h2>
      <small>{count ? `${count} מתוך ${portions.length} הושלמו היום` : dailyLearningDateLine(context)}</small>
    </header>
    <ul className="dl-card-list">
      {portions.map(portion => <li key={portion.trackId}>
        <button type="button" className={`dl-card-row${done[portion.trackId] ? ' is-done' : ''}`} onClick={() => go?.(`learning/${portion.trackId}`)}>
          <span className="dl-card-name">{portion.track.short || portion.track.title}</span>
          <strong className="dl-card-portion">{portion.label}</strong>
          <span className="dl-card-state">{done[portion.trackId] ? 'הושלם' : ''}</span>
        </button>
      </li>)}
    </ul>
    <a className="dl-card-foot" href="#learning">כל מסלולי הלימוד היומי<span aria-hidden="true">{' '}←</span></a>
  </section>;
}
