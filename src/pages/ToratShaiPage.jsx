import { useEffect } from 'react';
import { useStudyTimer } from '../hooks.jsx';
import { StudyCompletion } from '../components/CompletionButton.jsx';
import { BackNavigation, Breadcrumbs } from '../components/LocalNavigation.jsx';
import ReaderNavigation, { ReaderDock } from '../components/ReaderNavigation.jsx';
import HeartToggle from '../components/HeartToggle.jsx';
import TextSizeControl, { useReadingFont } from '../components/ui/TextSizeControl.jsx';
import { routeFavorite } from '../services/favorites.mjs';
import { TORAT_SHAI, TORAT_SHAI_GROUPS, toratShaiRoute, parseToratShaiRoute, pieceById, piecesInGroup, pieceNeighbours } from '../data/toratShai/index.mjs';
import TitleOrnament from '../components/ui/TitleOrnament.jsx';

// "תורת ש״י" — דברי תורה מכתביו של הרב שלום יוסף ברבי: a category of the library, listed by occasion,
// read in the same reader look as שלום רב (shared size, heart, the author's credit on every piece).
const goBooks = go => go('books');

function Home({ go }) {
  return <section className="shalom-rav sr-home torat-shai">
    <BackNavigation label="חזרה לספרים" onClick={() => goBooks(go)} />
    <Breadcrumbs items={[{ label: 'ספרים', onNavigate: () => goBooks(go) }, { label: TORAT_SHAI.title }]} />
    <header className="sr-head">
      <h1>{TORAT_SHAI.title}</h1>
      <TitleOrnament />
      <p className="sr-subtitle">{TORAT_SHAI.subtitle}</p>
    </header>
    {TORAT_SHAI_GROUPS.map(group => {
      const pieces = piecesInGroup(group.key);
      if (!pieces.length) return null;
      return <section key={group.key} className="library-group">
        <h2 className="library-subhead">{group.title}</h2>
        <div className="siddur-group-rows">{pieces.map(piece => <button type="button" key={piece.id} className="siddur-entry sr-row" onClick={() => go(toratShaiRoute.piece(piece.id))}>
          <span className="siddur-entry-text"><strong>{piece.title}</strong><small>{piece.occasion}</small></span><span aria-hidden="true">←</span>
        </button>)}</div>
      </section>;
    })}
  </section>;
}

function Reader({ piece, go, tzid }) {
  const font = useReadingFont(22);
  useEffect(() => { window.scrollTo(0, 0); }, [piece.id]);
  const { previous, next } = pieceNeighbours(piece.id);
  const open = target => go(toratShaiRoute.piece(target.id), { replace: true });
  // Reading a piece is Torah study: timed like every study text (recorded in המעגל הרוחני after a real minute).
  const { recordInteraction } = useStudyTimer({ workId: 'torat-shai', workTitle: TORAT_SHAI.title, unitId: piece.id, unitLabel: piece.title, category: 'torah_study', source: 'torat-shai', tzid });
  return <section className="shalom-rav sr-reader torat-shai" style={{ '--sr-size': `${font}px` }}>
    <ReaderDock previous={previous} next={next} onSelect={open} label="ניווט בתורת ש״י" />
    <Breadcrumbs items={[{ label: 'ספרים', onNavigate: () => goBooks(go) }, { label: TORAT_SHAI.title, onNavigate: () => go(toratShaiRoute.home()) }, { label: piece.title }]} />
    <BackNavigation label="לתורת ש״י" onClick={() => go(toratShaiRoute.home())} />
    <header className="sr-head">
      <p className="eyebrow">{piece.occasion}</p>
      <div className="reader-title-row"><h1>{piece.title}</h1><HeartToggle item={routeFavorite('torat-shai', toratShaiRoute.piece(piece.id), piece.title, TORAT_SHAI.title)} /></div>
      {piece.subtitle && <p className="sr-entry-subtitle">{piece.subtitle}</p>}
      {piece.verse && <p className="ts-verse">„{piece.verse.text}” <small>({piece.verse.ref})</small></p>}
      <p className="sr-origin">מאת {TORAT_SHAI.author}</p>
      <TitleOrnament />
      <div className="reader-tools"><TextSizeControl /></div>
    </header>
    <article className={`sr-body${piece.prayer ? ' ts-prayer' : ''}`} lang="he" aria-label={piece.title}>
      {piece.blocks.map((block, i) => {
        if (block.type === 'section') return <h2 key={i} className="sr-section">{block.title}</h2>;
        if (block.type === 'source') return <blockquote key={i} className="sr-source"><p className="sr-text">{block.text}</p><small className="ts-ref">{block.ref}</small></blockquote>;
        if (block.type === 'signature') return <p key={i} className="sr-signature">{block.text}</p>;
        return <p key={i} className="sr-text">{block.text}</p>;
      })}
    </article>
    <StudyCompletion workId="torat-shai" workTitle={TORAT_SHAI.title} unitId={piece.id} unitLabel={piece.title} source="torat-shai" tzid={tzid} onBeforeRecord={recordInteraction} />
    <ReaderNavigation previous={previous} next={next} onSelect={open} endLabel={`סוף ${TORAT_SHAI.title}`} />
    <button type="button" className="sr-toc-link" onClick={() => go(toratShaiRoute.home())}>כל דברי התורה</button>
  </section>;
}

export default function ToratShaiPage({ route, go, tzid = 'Asia/Jerusalem' }) {
  const parsed = parseToratShaiRoute(route) || { view: 'home' };
  const piece = parsed.view === 'piece' ? pieceById(parsed.id) : null;
  if (piece) return <Reader key={piece.id} piece={piece} go={go} tzid={tzid} />;
  return <Home go={go} />;
}
