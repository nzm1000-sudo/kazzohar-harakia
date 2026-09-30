import { useRef, useState } from 'react';
import { BackLink } from '../components/LocalNavigation.jsx';
import { OTIYOT, OTIYOT_AUTHOR, OTIYOT_SIGNATURE, OTIYOT_TITLE } from '../data/otiyot26.mjs';

// "אותיות 26" — verbal ideas, each a card of its own. The app's typography and palette, with the category's own
// signature: a soft tone per idea drawn from the author's slides, its number centred above the words, and the idea's
// first letter as a quiet watermark. Reading: one idea at a time, symmetric previous/next, swipe, share.
const TONES = 9;
const firstLetter = idea => (idea.lines.find(Boolean) || '').replace(/[^א-ת]/g, '').charAt(0);
const toneOf = index => `otiyot-tone-${(index % TONES) + 1}`;

function Signature() {
  return <footer className="otiyot-card-foot">
    <span className="otiyot-author">{OTIYOT_AUTHOR}</span>
    <span className="otiyot-signature" dir="ltr" aria-hidden="true">{OTIYOT_SIGNATURE.map((n, i) => <span key={n}>{i > 0 && <i>|</i>}{n}</span>)}</span>
  </footer>;
}

function IdeaText({ idea }) {
  // Stanzas separated by '' in the data; each line keeps its own break.
  const stanzas = idea.lines.reduce((all, line) => { if (line === '') all.push([]); else all.at(-1).push(line); return all; }, [[]]).filter(stanza => stanza.length);
  return <div className="otiyot-text">{stanzas.map((stanza, i) => <p key={i}>{stanza.map((line, j) => <span key={j}>{line}</span>)}</p>)}</div>;
}

async function shareIdea(idea) {
  const text = `${idea.lines.join('\n').replace(/\n{2,}/g, '\n\n')}\n\n— ${OTIYOT_AUTHOR} · אותיות 26`;
  try {
    if (navigator.share) { await navigator.share({ text }); return 'shared'; }
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch { return null; }
}

function OtiyotReader({ index, go }) {
  const idea = OTIYOT[index];
  const [shared, setShared] = useState(null);
  const touch = useRef(null);
  const open = next => { setShared(null); go(`otiyot/${OTIYOT[next].id}`); };
  const previous = index > 0 ? index - 1 : null;
  const next = index < OTIYOT.length - 1 ? index + 1 : null;
  // Right-to-left: the next idea comes from the left — a swipe to the right turns the page forward.
  // The swipe is a shortcut only: the pager's "הקודם" / "הבא" buttons below do the same for keyboard, switch and
  // screen-reader users.
  const onTouchEnd = event => {
    const start = touch.current; touch.current = null;
    if (!start) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
    if (dx > 0 && next !== null) open(next);
    if (dx < 0 && previous !== null) open(previous);
  };
  return <section className="otiyot otiyot-reader" aria-label={`אותיות 26 — רעיון ${index + 1}`}>
    <BackLink href="#otiyot" label="אותיות 26" />
    <article className={`otiyot-card otiyot-card-full ${toneOf(index)}`} data-letter={firstLetter(idea)}
      onTouchStart={event => { touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }} onTouchEnd={onTouchEnd}>
      <header className="otiyot-card-head"><span className="otiyot-card-number">{index + 1}</span><span>{OTIYOT_TITLE}</span></header>
      <IdeaText idea={idea} />
      <Signature />
    </article>
    <nav className="otiyot-pager" aria-label="מעבר בין הרעיונות">
      <button type="button" onClick={() => previous !== null && open(previous)} disabled={previous === null} aria-label="הרעיון הקודם">→ הקודם</button>
      <span className="otiyot-position">{index + 1} מתוך {OTIYOT.length}</span>
      <button type="button" onClick={() => next !== null && open(next)} disabled={next === null} aria-label="הרעיון הבא">הבא ←</button>
    </nav>
    <div className="otiyot-actions">
      <button type="button" className="ghost" onClick={async () => setShared(await shareIdea(idea))}>שיתוף</button>
      {shared && <span role="status">{shared === 'copied' ? 'הועתק' : 'שותף'}</span>}
    </div>
  </section>;
}

export default function OtiyotPage({ route = 'otiyot', go }) {
  const id = String(route).split('/')[1];
  const index = id ? OTIYOT.findIndex(idea => idea.id === id) : -1;
  if (index >= 0) return <OtiyotReader index={index} go={go} />;
  return <section className="otiyot">
    <header className="otiyot-hero">
      <p className="eyebrow">רעיונות במילים:</p>
      <p className="otiyot-hero-author">{OTIYOT_AUTHOR}</p>
      <h1>אותיות 26</h1>
      <p className="intro">מילים, צלילים ומשמעות.</p>
    </header>
    <section className="otiyot-series" aria-label={OTIYOT_TITLE}>
      <h2>{OTIYOT_TITLE}</h2>
      <div className="otiyot-grid">
        {OTIYOT.map((idea, index) => {
          const preview = idea.lines.filter(Boolean).slice(0, 3);
          return <a key={idea.id} href={`#otiyot/${idea.id}`} className={`otiyot-card otiyot-card-preview ${toneOf(index)}`} data-letter={firstLetter(idea)} aria-label={`רעיון ${index + 1}: ${preview[0]}`}>
            <span className="otiyot-card-number" aria-hidden="true">{index + 1}</span>
            <span className="otiyot-preview">{preview.map((line, i) => <span key={i}>{line}</span>)}{idea.lines.filter(Boolean).length > 3 && <span className="otiyot-more" aria-hidden="true">…</span>}</span>
          </a>;
        })}
      </div>
    </section>
  </section>;
}
