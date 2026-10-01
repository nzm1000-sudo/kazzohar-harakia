// The לעצמי home: a centred title, one quiet line, four ways in. Below the fold, only what is relevant now —
// ביום הזה when there is something to look back on, חזרה אליי, the surprise wheels, and דברי חכמים (a new one every two hours).
import { useEffect, useMemo, useState } from 'react';
import { EntryRow, Glyph, Ornament, useStore } from './common.jsx';
import { loadChidushim, onChidushimChange, createFollowUp } from '../../services/leatzmi/chidushim.mjs';
import { dueReviewItems, onReviewChange } from '../../services/leatzmi/review.mjs';
import { onThisDay } from '../../services/leatzmi/onThisDay.mjs';
import { getEvents } from '../../services/mitzvotJournal.mjs';
import { leatzmiRoute } from '../../services/leatzmi/routes.mjs';
import { loadDivreiChachamim, sayingForSlot } from '../../services/leatzmi/divreiChachamim.mjs';

export default function LeatzmiHome({ go, il, tzid }) {
  const chidushim = useStore(() => loadChidushim(), onChidushimChange);
  const due = useStore(() => dueReviewItems().length, onReviewChange);
  const lookBack = useMemo(() => { try { return onThisDay({ chidushim, events: getEvents(), today: new Date(), il, limit: 2 }); } catch { return []; } }, [chidushim, il]);
  const reflect = id => { const note = createFollowUp(id); if (note) go(leatzmiRoute.edit(note.id)); };
  const sage = useSlotSaying(tzid);
  return <div className="lz-home">
    <header className="lz-head lz-home-head">
      <h1 className="lz-title">לעצמי</h1>
      <Ornament />
      <p className="lz-line">מקום שקט ללימוד, למחשבה ולחזרה.</p>
    </header>
    <nav className="lz-entries" aria-label="לעצמי">
      <EntryRow href="#leatzmi/today" glyph={<Glyph.today />} title="בשבילי היום" text="כמה דקות של לימוד אישי" />
      <EntryRow href="#leatzmi/chidushim" glyph={<Glyph.quill />} title="חידושי התורה שלי" text="המחשבות שלך, פרטיות במכשיר" />
      <EntryRow href="#leatzmi/quiz" glyph={<Glyph.quiz />} title="שעשועון טריוויה יהודי" text="טריוויה, ידע ורוח" />
      <EntryRow href="#leatzmi/hitbodedut" glyph={<Glyph.stillness />} title="התבודדות" text="זמן שקט עם עצמך" />
    </nav>

    {lookBack.length > 0 && <section className="lz-lookback" aria-labelledby="lz-lookback-title">
      <h2 id="lz-lookback-title" className="lz-caption">ביום הזה</h2>
      {lookBack.map((card, index) => <figure key={index} className="lz-memory">
        <figcaption>{card.title}</figcaption>
        <blockquote>{card.text}</blockquote>
        {card.chidushId && <div className="lz-memory-actions">
          <button type="button" className="lz-text-button" onClick={() => go(leatzmiRoute.chidush(card.chidushId))}>לקריאה</button>
          <span aria-hidden="true" className="lz-dot">·</span>
          <button type="button" className="lz-text-button" onClick={() => reflect(card.chidushId)}>מה אני חושב על זה היום?</button>
        </div>}
      </figure>)}
    </section>}

    <section className="lz-more" aria-labelledby="lz-more-title">
      <h2 id="lz-more-title" className="lz-caption">עוד בשבילך</h2>
      <div className="lz-entries lz-entries-quiet">
        <EntryRow href="#leatzmi/review" glyph={<Glyph.review />} title="חזרה אליי" text={due ? 'יש דברים שמחכים לך' : 'מה שכדאי לפגוש שוב, בזמן הנכון'} />
        <EntryRow href="#leatzmi/surprise" glyph={<Glyph.wheel />} title="בְּהַפְתָּעָה" text="פרק, פסוק או מילה מן התנ״ך" />
      </div>
    </section>

    {/* דברי חכמים: a short saying, a new one every two hours of local time. */}
    {sage && <figure className="lz-home-sage">
      <figcaption className="lz-caption">דברי חכמים</figcaption>
      <blockquote lang="he">{sage.text}</blockquote>
      {sage.route ? <a href={`#${sage.route}`}>{sage.source}</a> : <span>{sage.source}</span>}
    </figure>}
  </div>;
}

// The saying of this two-hour slot (only the short ones: a quiet line), read after the screen is drawn (its data is a
// separate chunk). It turns at the slot's end while the screen stays open, and is read again on return to the app.
const HOME_SAYING_MAX_LETTERS = 150;
function useSlotSaying(tzid) {
  const [sage, setSage] = useState(null);
  useEffect(() => {
    let live = true;
    let timer = 0;
    let data = null;
    const show = () => {
      if (!live || !data) return;
      const next = sayingForSlot(data, Date.now(), { tzid, maxLetters: HOME_SAYING_MAX_LETTERS });
      setSage(current => (current && next && current.id === next.id ? current : next));
      clearTimeout(timer);
      if (next) timer = setTimeout(show, Math.max(1000, next.until - Date.now() + 500));
    };
    const onVisible = () => { if (document.visibilityState !== 'hidden') show(); };
    loadDivreiChachamim().then(module => { data = module; show(); }).catch(() => {});
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => { live = false; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible); };
  }, [tzid]);
  return sage;
}
