import { useEffect, useMemo, useState } from 'react';
import { useLocal, useResource, useStudyTimer } from '../hooks.jsx';
import CompletionButton from '../components/CompletionButton.jsx';
import { ACTIVITY_CATEGORY, ACTIVITY_TYPE, recordReadingCompletion } from '../services/mitzvotJournal.mjs';
import { routeParts } from '../services/safeRoute.mjs';
import { ResourceState } from '../components/SourceReader.jsx';
import { BackNavigation } from '../components/LocalNavigation.jsx';
import { hebrewNumeral } from '../services/hebrewNumerals.mjs';
import { formatTanakhReference } from '../services/tanakhReferences.mjs';
import TanakhRefText from '../components/TanakhRefText.jsx';
import { loadEditionChunk } from '../services/library/packs.mjs';
import { commentatorsOnVerse } from '../services/torah/commentaries.mjs';
import { hasVerseCommentaries } from '../services/torah/commentaries.mjs';
import { PassageCommentaries, VerseLayersLine, useCommentatorChoice } from '../components/CommentaryPanel.jsx';
import { ALIYA_NAMES, aliyaStartId, aliyotOf } from '../services/weeklyParasha.mjs';
import { SHNAYIM_PACK, SHNAYIM_PROGRESS_V2, shnayimEdition, shnayimParashaById, shnayimParashaForContext, shnayimParashot, shnayimVerses, weeklyParashaForShnayimMikra } from '../services/shnayimMikra.mjs';
import AutoScrollControl from '../components/AutoScrollControl.jsx';
import TextSizeControl, { useReadingScale } from '../components/ui/TextSizeControl.jsx';

// shnayim-mikra/<parasha>[/<aliya 1–7>] — an aliya opens the reader at its first verse (המזכיר היהודי's daily portion).
export const shnayimRoute = { list: () => 'shnayim-mikra', parasha: (id, aliya = null) => `shnayim-mikra/${encodeURIComponent(id)}${aliya ? `/${aliya}` : ''}` };
const rangeLabel = parasha => formatTanakhReference(parasha.reference);

export default function ShnayimMikra({ route = 'shnayim-mikra', context, go, onBack, tzid = 'Asia/Jerusalem' }) {
  const [, id, aliyaPart] = routeParts(route);
  const parasha = id ? shnayimParashaById(id) : null;
  const aliya = /^[1-7]$/.test(aliyaPart || '') ? Number(aliyaPart) : null;
  if (id && parasha) return <ShnayimReader key={`${parasha.id}/${aliya || ''}`} parasha={parasha} aliya={aliya} go={go} tzid={tzid} />;
  return <ShnayimList context={context} go={go} onBack={onBack} unknown={id && !parasha} />;
}

function ShnayimList({ context, go, onBack, unknown }) {
  const [progress] = useLocal(SHNAYIM_PROGRESS_V2, {});
  const current = shnayimParashaForContext(context);
  const weekly = weeklyParashaForShnayimMikra(context);
  const books = useMemo(() => {
    const groups = new Map();
    shnayimParashot().filter(item => !item.combined).forEach(item => { if (!groups.has(item.bookHe)) groups.set(item.bookHe, []); groups.get(item.bookHe).push(item); });
    return [...groups];
  }, []);
  const combined = shnayimParashot().filter(item => item.combined);
  const meta = item => {
    const saved = progress[item.id];
    const at = saved ? item.verseIds.indexOf(saved.verseId) : -1;
    return [rangeLabel(item), at >= 0 ? `${at + 1} מתוך ${item.verseIds.length}` : null];
  };
  const Row = ({ item }) => <button type="button" className="library-row" onClick={() => go(shnayimRoute.parasha(item.id))}>
    <span className="library-row-title">{item.he}</span>
    <span className="library-row-meta">{meta(item).filter(Boolean).map(part => <span key={part}>{part}</span>)}</span>
    <span className="library-row-arrow" aria-hidden="true">›</span>
  </button>;
  return <section className="shnayim-mikra" aria-label="שניים מקרא ואחד תרגום">
    {onBack && <BackNavigation label="חזרה לפרשה" onClick={onBack} />}
    <p className="eyebrow">שניים מקרא ואחד תרגום</p>
    <h1>פרשות השבוע</h1>
    {unknown && <p className="notice">הפרשה המבוקשת לא נמצאה.</p>}
    {current && <section><h2 className="library-subhead">השבוע</h2><Row item={current} />{weekly.festivalOverride && <p className="shnayim-note">בשבת זו קוראים קריאת חג; שניים מקרא נשאר על הפרשה הקבועה.</p>}</section>}
    {books.map(([book, items]) => <section key={book}><h2 className="library-subhead">ספר {book}</h2><div className="book-index">{items.map(item => <Row key={item.id} item={item} />)}</div></section>)}
    <section><h2 className="library-subhead">פרשות מחוברות</h2><div className="book-index">{combined.map(item => <Row key={item.id} item={item} />)}</div></section>
  </section>;
}

function ShnayimReader({ parasha, aliya = null, go, tzid = 'Asia/Jerusalem' }) {
  const [readingScale] = useReadingScale();
  const edition = shnayimEdition(parasha.range.book);
  const resource = useResource(() => loadEditionChunk(edition), [edition.editionId]);
  const [progress, setProgress] = useLocal(SHNAYIM_PROGRESS_V2, {});
  const verses = resource.data ? shnayimVerses(parasha, resource.data) : null;
  const saved = progress[parasha.id]?.verseId || null;
  useEffect(() => {
    if (!verses?.length) return;
    const target = aliya ? aliyaStartId(parasha.id, aliya) : saved;
    const node = target ? document.getElementById(`shnayim-${target}`) : null;
    if (node) node.scrollIntoView({ block: 'start' }); else window.scrollTo({ top: 0 });
  }, [Boolean(verses), parasha.id]);
  // Reading the portion is study (the same 60-second timer as every reader); finishing it is "שניים מקרא" — one entry
  // per parasha per day in the journal.
  const { recordInteraction } = useStudyTimer({ workId: `shnayim-mikra:${parasha.id}`, workTitle: `שניים מקרא · פרשת ${parasha.he}`, unitId: parasha.id, unitLabel: `פרשת ${parasha.he}`, category: 'torah_study', source: 'shnayim-mikra', tzid, enabled: Boolean(verses?.length) });
  useEffect(() => {
    if (!verses?.length) return undefined;
    const onScroll = () => recordInteraction();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [Boolean(verses?.length), recordInteraction]);
  // The portion's מפרשים tab, as in the library: the whole portion, or one verse from the chips under it.
  const [tab, setTab] = useState('text');
  const [focusVerse, setFocusVerse] = useState(null);
  const [commentator, chooseCommentator] = useCommentatorChoice('tanakh');
  useEffect(() => { setTab('text'); setFocusVerse(null); }, [parasha.id]);
  const layered = hasVerseCommentaries(parasha.range.book);
  const openCommentary = (verse, name) => {
    chooseCommentator(name); setFocusVerse({ c: verse.chapter, v: verse.verse, id: verse.id }); setTab('commentary');
    requestAnimationFrame(() => document.querySelector('.shnayim-tabs')?.scrollIntoView({ block: 'start' }));
  };
  const showText = () => {
    const back = focusVerse; setTab('text');
    if (back) requestAnimationFrame(() => document.getElementById(`shnayim-${back.id}`)?.scrollIntoView({ block: 'start' }));
  };
  // Where each of the seven aliyot begins (data/torahAliyot.mjs), marked in the text.
  const aliyaStarts = useMemo(() => new Map((aliyotOf(parasha.id) || []).map((_, index) => [aliyaStartId(parasha.id, index + 1), index + 1])), [parasha.id]);
  const remember = verseId => setProgress(value => ({ ...value, [parasha.id]: { verseId, at: new Date().toISOString() } }));
  const back = () => (Number(history.state?.kzDepth) > 0 ? history.back() : go(shnayimRoute.list()));
  return <section className="shnayim-mikra shnayim-reader" aria-label={`שניים מקרא · ${parasha.he}`} style={{ '--reading-scale': readingScale }}>
    <BackNavigation label="חזרה לפרשות" onClick={back} />
    <p className="eyebrow">שניים מקרא ואחד תרגום</p>
    <h1>פרשת {parasha.he}</h1>
    <p className="shnayim-range"><TanakhRefText text={rangeLabel(parasha)} /> · {parasha.verseIds.length} פסוקים</p>
    {tab === 'text' && verses?.length > 0 && <div className="reader-tools shnayim-tools"><TextSizeControl /><AutoScrollControl /></div>}
    <ResourceState resource={resource} />
    {resource.data && !verses && <p className="notice">לא ניתן להציג את הפרשה במלואה.</p>}
    {layered && verses?.length > 0 && <div className="seg library-layer-tabs shnayim-tabs" role="tablist" aria-label="שניים מקרא, מפרשים">
      <button type="button" role="tab" aria-selected={tab === 'text'} className={tab === 'text' ? 'on' : ''} onClick={showText}>מקרא ותרגום</button>
      <button type="button" role="tab" aria-selected={tab === 'commentary'} className={tab === 'commentary' ? 'on' : ''} onClick={() => setTab('commentary')}>מפרשים</button>
    </div>}
    {layered && verses?.length > 0 && tab === 'commentary' && <PassageCommentaries baseWorkId={parasha.range.book} passage={{ from: [parasha.range.startChapter, parasha.range.startVerse], to: [parasha.range.endChapter, parasha.range.endVerse] }} focusVerse={focusVerse} onClearFocus={() => setFocusVerse(null)} clearLabel="כל הפרשה" choice={commentator} onChoose={chooseCommentator} />}
    {tab === 'text' && verses?.map(verse => <article className="shnayim-verse" id={`shnayim-${verse.id}`} key={verse.id}>
      {verse.chapterStart && <p className="shnayim-chapter">פרק {hebrewNumeral(verse.chapter)}</p>}
      {aliyaStarts.has(verse.id) && <p className={`shnayim-aliya${aliyaStarts.get(verse.id) === aliya ? ' is-target' : ''}`}>עליית {ALIYA_NAMES[aliyaStarts.get(verse.id)]}</p>}
      <header><strong><TanakhRefText text={verse.label} /></strong>{verse.id === saved && <small>המשך מכאן</small>}</header>
      <p className="shnayim-mikra-text">{verse.mikra}</p>
      <p className="shnayim-mikra-text">{verse.mikra}</p>
      <p className="shnayim-targum" data-lookup="targum"><span data-lookup="off">תרגום אונקלוס</span>{verse.targum}</p>
      <button type="button" className="link shnayim-save" aria-pressed={verse.id === saved} onClick={() => remember(verse.id)}>{verse.id === saved ? 'המקום נשמר' : 'שמירת מקום'}</button>
      <VerseCommentaries book={parasha.range.book} verse={verse} onOpen={openCommentary} />
    </article>)}
    {verses?.length > 0 && <CompletionButton key={parasha.id} source="shnayim-mikra" sourceId={parasha.id} tzid={tzid} label="סיימתי את הפרשה" ariaLabel={`סימון שניים מקרא של פרשת ${parasha.he} כהושלם`} record={() => { recordInteraction(); recordReadingCompletion({ category: ACTIVITY_CATEGORY.SHNAYIM_MIKRA, type: ACTIVITY_TYPE.SHNAYIM_MIKRA_PORTION, source: 'shnayim-mikra', sourceId: parasha.id, title: `פרשת ${parasha.he}`, tzid }); }} />}
    {verses && <div className="source-credit"><p>מקרא: {SHNAYIM_PACK.mikra.heTitle} · נחלת הכלל</p><p>תרגום: {SHNAYIM_PACK.targum.heTitle} · נחלת הכלל</p><p>כל פסוק מוצג עם התרגום של אותו פסוק בדיוק (לפי ספר, פרק ופסוק).</p></div>}
  </section>;
}

// The commentators with a comment on this verse (on the device), each one tap from its own text in the portion's מפרשים
// tab. A verse no bundled commentator explains shows nothing.
function VerseCommentaries({ book, verse, onOpen }) {
  const layers = commentatorsOnVerse(book, verse.chapter, verse.verse);
  if (!layers.length) return null;
  return <VerseLayersLine layers={layers} label="מפרשים" unitLabel="פסוק" verse={verse.verse} onOpen={name => onOpen(verse, name)} />;
}
