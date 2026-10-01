// The לעצמי home: a centred title, one quiet line, four ways in. Below the fold, only what is relevant now —
// ביום הזה when there is something to look back on, חזרה אליי, and the surprise chapter.
import { useMemo } from 'react';
import { EntryRow, Glyph, Ornament, useStore } from './common.jsx';
import { loadChidushim, onChidushimChange, createFollowUp } from '../../services/leatzmi/chidushim.mjs';
import { dueReviewItems, onReviewChange } from '../../services/leatzmi/review.mjs';
import { onThisDay } from '../../services/leatzmi/onThisDay.mjs';
import { getEvents } from '../../services/mitzvotJournal.mjs';
import { leatzmiRoute } from '../../services/leatzmi/routes.mjs';

export default function LeatzmiHome({ go, il }) {
  const chidushim = useStore(() => loadChidushim(), onChidushimChange);
  const due = useStore(() => dueReviewItems().length, onReviewChange);
  const lookBack = useMemo(() => { try { return onThisDay({ chidushim, events: getEvents(), today: new Date(), il, limit: 2 }); } catch { return []; } }, [chidushim, il]);
  const reflect = id => { const note = createFollowUp(id); if (note) go(leatzmiRoute.edit(note.id)); };
  return <div className="lz-home">
    <header className="lz-head lz-home-head">
      <Ornament />
      <h1 className="lz-title">לעצמי</h1>
      <p className="lz-line">מקום שקט ללימוד, למחשבה ולחזרה.<br />הכול נשמר רק במכשיר שלך.</p>
    </header>
    <nav className="lz-entries" aria-label="לעצמי">
      <EntryRow href="#leatzmi/today" glyph={<Glyph.today />} title="בשבילי היום" text="כמה דקות של לימוד אישי" />
      <EntryRow href="#leatzmi/chidushim" glyph={<Glyph.quill />} title="חידושי התורה שלי" text="המחשבות שלך, פרטיות במכשיר" />
      <EntryRow href="#leatzmi/quiz" glyph={<Glyph.quiz />} title="בחן אותי" text="שאלות קצרות, בקצב שלך" />
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
        <EntryRow href="#leatzmi/surprise" glyph={<Glyph.wheel />} title="פֶּרֶק בְּהַפְתָּעָה" text="פרק שלם מן התנ״ך, בהפתעה" />
      </div>
    </section>
  </div>;
}
