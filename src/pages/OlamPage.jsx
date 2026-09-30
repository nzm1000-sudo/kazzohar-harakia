import { useRef } from 'react';
import CircleSeal from '../components/CircleSeal.jsx';
import { BackNavigation } from '../components/LocalNavigation.jsx';
import { VisuallyHidden } from '../components/a11yPrimitives.jsx';
import { OlamUnlock, useCircleCompletion } from '../components/OlamCircles.jsx';
import { RANKS, WEEK_GOAL, circlesWord, rankFor, remainingLong } from '../services/spiritualCircle.mjs';

// "מעגלי עולם" — the circles completed over a lifetime: the seal, where the count stands, and the path of the fifteen
// ranks (every rank visible: reached, current, still ahead). The count comes from the one derived snapshot (the
// journal → circles, kept by the high-water record); nothing here counts anything.
export default function OlamPage({ ring, onBack }) {
  const lifetime = ring?.lifetime || 0;
  const sealRef = useRef(null);
  const completion = useCircleCompletion(lifetime, { sealRef });
  const shown = completion.shownLifetime;
  const rank = rankFor(shown);
  const circle = ring?.circle || null;
  return <div className="olam-page">
    <BackNavigation label="חזרה" onClick={onBack} />
    <header className="olam-page-head">
      <h1 className="olam-page-title">מעגלי עולם</h1>
      <span className="gold-divider" aria-hidden="true"><i /></span>
    </header>
    <section className="olam-page-hero" aria-label="המעגלים שהושלמו">
      <span className={`olam-page-seal${completion.phase === 'settle' ? ' is-glowing' : ''}`} ref={sealRef}><CircleSeal count={shown} size={196} alive /></span>
      <p className="olam-page-count">{circlesWord(shown)} {shown === 1 ? 'הושלם' : 'הושלמו'}</p>
      {rank.name && <p className="olam-page-rank">דרגת {rank.name}</p>}
      {rank.next ? <p className="olam-page-next">{remainingLong(rank)}</p> : <p className="olam-page-next">המעגלים ממשיכים להימנות</p>}
      {circle && circle.completedThisWeek > 0 && <p className="olam-page-week">השבוע {circle.completedThisWeek === 1 ? 'הושלם מעגל אחד' : `הושלמו ${circle.completedThisWeek} מעגלים`}</p>}
    </section>
    <OlamUnlock unlock={completion.unlock} onClose={completion.dismissUnlock} />
    <section className="olam-about" aria-label="איך נבנה מעגל">
      <p>{WEEK_GOAL} אורות משלימים מעגל — כל תפילה, ברכה, פרק תהילים ולימוד מוסיפים אור.</p>
      <p>המעגל מתאפס במוצ״ש באופן אוטומטי; המעגלים שהושלמו נשמרים לעולם.</p>
    </section>
    <section className="olam-path" aria-labelledby="olam-path-title">
      <h2 id="olam-path-title" className="olam-path-title">דרך הדרגות</h2>
      <ol className="olam-path-list">
        {RANKS.map((item, index) => {
          const status = index < rank.index ? 'reached' : index === rank.index ? 'current' : 'ahead';
          const next = index === rank.index + 1;
          const note = status === 'current' ? 'הדרגה הנוכחית' : next ? `עוד ${circlesWord(item.at - shown)}` : '';
          return <li key={item.name} className={`olam-step is-${status}${next ? ' is-next' : ''}`} aria-current={status === 'current' ? 'step' : undefined}>
            <span className="olam-step-name">{item.name}</span>
            <span className="olam-step-seal" aria-hidden="true"><CircleSeal count={item.at} size={56} alive={status === 'current'} /></span>
            <span className="olam-step-at">{circlesWord(item.at)}</span>
            {note ? <span className="olam-step-note">{note}</span> : <VisuallyHidden>{status === 'reached' ? 'הושגה' : 'לפנינו'}</VisuallyHidden>}
          </li>;
        })}
      </ol>
    </section>
  </div>;
}
