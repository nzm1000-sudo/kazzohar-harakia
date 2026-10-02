import { useState, useEffect } from 'react';
import { psalmIndex, matches } from './content.mjs';
import { useLocal, useRouteState } from './hooks.jsx';
import ReaderNavigation, { ReaderDock } from './components/ReaderNavigation.jsx';
import HeartToggle from './components/HeartToggle.jsx';
import { onFavoritesChange, psalmFavorite, readFavorites } from './services/favorites.mjs';
import { completeLearning, rememberLearning } from './services/learningMemory.mjs';
import { formatTehillimChapter, tehillimTitle } from './services/tehillimPresentation.mjs';
import { hebrewNumeral } from './services/hebrewNumerals.mjs';
import { dailyTehillimChapterCount, dailyTehillimLabel, dailyTehillimTitle, getDailyTehillim } from './tehillimDaily.mjs';
import { recordTehillimCompletion } from './services/mitzvotJournal.mjs';
import CompletionButton from './components/CompletionButton.jsx';
import ShareImageButton from './components/ShareImageButton.jsx';
import { tehillimShareSpec } from './services/shareSpecs.mjs';
import AutoScrollControl from './components/AutoScrollControl.jsx';
import TextSizeControl, { useReadingFont } from './components/ui/TextSizeControl.jsx';
import { clayBuildEnabled } from './services/clayExperiment.mjs';

const SOURCE = 'טקסט מנוקד · נחלת הציבור · tanach.us דרך Sefaria · נאסף 2026-09-18';
const btn = (T, on) => ({ minHeight: 44, minWidth: 44, padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid ' + (on ? 'var(--sel-line)' : T.border), cursor: 'pointer', fontSize: 'var(--font-ui-meta)', background: 'transparent', color: on ? 'var(--sel-ink)' : T.muted, fontWeight: on ? 500 : 400, fontFamily: 'inherit' });
// CLAY build: the chrome takes its material from styles/clay/tehillim.css (classes, not inline colours); the ordinary
// build keeps its inline look exactly. The psalm itself stays a flat page in both.
const CLAY = clayBuildEnabled();
const chip = (T, on, extra = {}) => (CLAY ? { className: `tehillim-chip clay-press${on ? ' is-on' : ''}` } : { style: { ...btn(T, on), ...extra } });

export default function Tehillim({ T, initialChapter = 1, dailyDay = null, now, tzid }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [chapter, setChapter] = useLocal('tehillim-position-v1', initialChapter);
  const [, setSavedRevision] = useState(0);
  useEffect(() => onFavoritesChange(() => setSavedRevision(value => value + 1)), []);
  const favorites = readFavorites().filter(item => item.open?.type === 'psalm').map(item => item.open.chapter);
  const font = useReadingFont(22);
  const [q, setQ] = useRouteState('tehillim-query', '');
  const [shareMsg, setShareMsg] = useState('');
  const memoryId = 'tehillim';
  const dailyPortion = getDailyTehillim(dailyDay);
  const safeChapter = Number.isInteger(chapter) && chapter >= 1 && chapter <= 150 ? chapter : 1;
  // Each chapter shows whether it is already in "המצוות שלי" today (the app's one "סיימתי", CompletionButton).
  const completeChapter = () => { completeLearning(memoryId); recordTehillimCompletion(dailyPortion ? dailyTehillimChapterCount(dailyPortion) : 1, { occurredAt: new Date(), tzid: tzid || 'Asia/Jerusalem', source: 'tehillim', sourceId: `chapter-${safeChapter}`, isDailyPortion: !!dailyPortion, storage: globalThis.localStorage }); };
  useEffect(() => {
    let live = true;
    import('./data/tehillim.json').then(m => live && setData(m.default)).catch(() => live && setError('טעינת הטקסט נכשלה'));
    return () => { live = false; };
  }, []);
  useEffect(() => { if (dailyPortion) setChapter(dailyPortion.start); }, [dailyPortion?.day, dailyPortion?.start, setChapter]);
  // An explicit chapter request (search result / resume) must win over the remembered position.
  useEffect(() => { if (!dailyPortion && Number.isInteger(initialChapter) && initialChapter >= 1 && initialChapter <= 150) setChapter(initialChapter); }, [initialChapter]);
  useEffect(() => { if (!dailyPortion && safeChapter !== chapter) setChapter(safeChapter); }, [dailyPortion, safeChapter, chapter, setChapter]);
  const verses = data?.chapters?.[safeChapter - 1];
  const visibleVerses = dailyPortion && safeChapter === 119
    ? verses?.slice(dailyPortion.verseStart - 1, dailyPortion.verseEnd)
    : verses;
  const chapterItem = value => ({ title: tehillimTitle(value), value });
  const changeChapter = value => { setChapter(Math.min(150, Math.max(1, value))); window.scrollTo({ top: 0 }); };
  useEffect(() => { rememberLearning(memoryId, { source: 'tehillim', reference: `chapter/${safeChapter}`, chapter: safeChapter, title: tehillimTitle(safeChapter) }); }, [safeChapter]);
  const hits = q.trim() ? psalmIndex.filter(p => matches(p, q)) : [];
  const share = () => {
    const text = tehillimTitle(safeChapter);
    if (navigator.share) navigator.share({ title: text, text }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => setShareMsg('הועתק'), () => setShareMsg(''));
    else setShareMsg('');
  };
  return (
    <div className="tehillim-page" style={{ padding: 14, direction: 'rtl' }}>
      {/* Previous / next chapter: docked in the header, as in every reading; the cards at the end continue the reading. */}
      <ReaderDock previous={safeChapter > 1 ? chapterItem(safeChapter - 1) : null} next={safeChapter < 150 ? chapterItem(safeChapter + 1) : null} onSelect={item => changeChapter(item.value)} label="ניווט בין פרקי התהילים" />
      {dailyPortion && <header className="tehillim-daily-head" data-testid="daily-tehillim" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: T.text }}>{dailyTehillimTitle(dailyPortion.day)}</h1>
        <p data-testid="daily-range" style={{ margin: '4px 0 0', color: T.muted }}>{dailyTehillimLabel(dailyPortion)}</p>
      </header>}
      <div className="tehillim-head" style={CLAY ? undefined : { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <input className="tehillim-search clay-field" aria-label="חיפוש פרק תהילים" placeholder="חיפוש פרק (לדוגמה: קכא)" value={q} onChange={e => setQ(e.target.value)}
          style={CLAY ? undefined : { flex: '1 1 170px', minWidth: 0, background: T.card, border: '1px solid ' + T.border, color: T.text, padding: '7px 12px', borderRadius: 8, fontFamily: 'inherit' }} />
        <strong className="tehillim-title" role="heading" aria-level={dailyPortion ? 2 : 1} style={CLAY ? undefined : { fontSize: 'var(--font-ui-meta)', color: T.text, minWidth: 110, textAlign: 'center' }}>{tehillimTitle(safeChapter)}</strong>
        <HeartToggle item={psalmFavorite(safeChapter)} />
      </div>
      {/* The reader's tools, in the order of every reader: text size, then auto-scroll. */}
      <div className="reader-tools tehillim-tools">
        <TextSizeControl />
        {verses && <AutoScrollControl />}
      </div>
      {hits.length > 0 && <div className="tehillim-hits" style={CLAY ? undefined : { display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
        {hits.slice(0, 12).map(p => <button key={p.chapter} onClick={() => { changeChapter(p.chapter); setQ(''); }} {...chip(T, p.chapter === safeChapter)}>{p.title}</button>)}
      </div>}
      {favorites.length > 0 && <p className="tehillim-favorites" style={CLAY ? undefined : { color: T.muted, fontSize: 'var(--font-ui-caption)', marginBottom: 10 }}>מועדפים: {favorites.slice().sort((a, b) => a - b).map((c, i) =>
        <button key={i} onClick={() => changeChapter(c)} {...chip(T, false, { marginLeft: 4 })}>{formatTehillimChapter(c)}</button>)}</p>}
      {!data && !error && <p className="notice" role="status">טוען טקסט מנוקד…</p>}
      {error && <p className="notice error" role="alert">{error}</p>}
      {verses && (
        <article className="psalm-text" lang="he" aria-label={tehillimTitle(safeChapter)} style={CLAY ? { fontSize: font, lineHeight: 1.9 } : { fontSize: font, lineHeight: 1.9, color: T.text, background: T.card, border: '1px solid ' + T.border, borderRadius: 12, padding: '18px 16px' }}>
          {visibleVerses.map((v, i) => <p key={i} style={{ margin: '0 0 10px' }}>{v} <span style={{ color: T.gold, fontSize: '0.7em' }}>({hebrewNumeral((dailyPortion && safeChapter === 119 ? dailyPortion.verseStart : 1) + i).replace(/[׳״]/g, '')})</span></p>)}
          <footer className="tehillim-source" style={CLAY ? undefined : { borderTop: '1px solid ' + T.border, marginTop: 12, paddingTop: 8, fontSize: 'var(--font-ui-caption)', color: T.muted, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="tehillim-source-line">{SOURCE}</span>
            <button onClick={share} {...(CLAY ? { className: 'tehillim-action clay-control' } : { style: btn(T, false) })}>שיתוף</button>
            <ShareImageButton className={CLAY ? 'share-image-inline tehillim-action clay-control' : 'share-image-inline'} style={CLAY ? undefined : btn(T, false)} spec={tehillimShareSpec(safeChapter, visibleVerses, { firstVerse: dailyPortion && safeChapter === 119 ? dailyPortion.verseStart : 1 })} />
            <span role="status">{shareMsg}</span>
          </footer>
          <CompletionButton source="tehillim" sourceId={`chapter-${safeChapter}`} tzid={tzid || 'Asia/Jerusalem'} label="סיימתי את הפרק" ariaLabel={`סימון ${tehillimTitle(safeChapter)} כהושלם`} record={completeChapter} />
            <ReaderNavigation previous={safeChapter > 1 ? chapterItem(safeChapter - 1) : null} next={safeChapter < 150 ? chapterItem(safeChapter + 1) : null} onSelect={item => changeChapter(item.value)} endLabel="סיימת את ספר תהילים" />
        </article>
      )}
    </div>
  );
}
