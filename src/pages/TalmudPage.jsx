import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocal, useResource } from '../hooks.jsx';
import { TRACTATES, SEDARIM, SEDER_HE, TRACTATES_WITHOUT_STEINSALTZ, findTractate, parseDafInput, loadAmud, loadCommentary, loadVilnaScan, pinTalmudDaf, unpinTalmudDaf, amudLabel, nextTractate, indexToAmud } from '../services/talmud.mjs';
import { canCacheContent, isContentPinned } from '../services/contentCache.mjs';
import { BackNavigation, Breadcrumbs } from '../components/LocalNavigation.jsx';
import ReaderNavigation from '../components/ReaderNavigation.jsx';
import { completeLearning, rememberLearning } from '../services/learningMemory.mjs';

// Routes: talmud | talmud/<Tractate> | talmud/<Tractate>/<amud>
export function parseTalmudRoute(mode) {
  const [, tractate, amud] = mode.split('/').map(decodeURIComponent);
  return { tractate: tractate ? findTractate(tractate) : null, amud: amud || null, raw: tractate };
}
export const talmudRoute = { tractate: t => `talmud/${encodeURIComponent(t.title)}`, amud: (t, a) => `talmud/${encodeURIComponent(t.title)}/${a}` };

export default function TalmudPage({ route, go }) {
  const [progress, setProgress] = useLocal('talmud-progress-v1', {});
  if (route.amud && route.tractate) return <AmudReader tractate={route.tractate} amud={route.amud} go={go} progress={progress} setProgress={setProgress} />;
  if (route.tractate) return <TractateIndex tractate={route.tractate} go={go} progress={progress} />;
  return <TalmudHome go={go} progress={progress} unknown={route.raw} />;
}

function TalmudHome({ go, progress, unknown }) {
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState('');
  const last = progress.last;
  const submit = e => {
    e.preventDefault();
    const r = parseDafInput(input);
    if (r.error) return setMsg(r.error);
    if (r.needsSide) return setMsg(`${r.tractate.heTitle} דף ${amudLabel(`${r.daf}a`).split(' ')[0]} — בחרו עמוד: `), setPending(r);
    go(talmudRoute.amud(r.tractate, r.amud));
  };
  const [pending, setPending] = useState(null);
  return <section className="talmud-home">
    <p className="eyebrow">בית המדרש</p>
    <h1>תלמוד בבלי עם ביאור שטיינזלץ.</h1>
    <p className="intro">{TRACTATES.length} מסכתות עם ביאור עברי, רש"י ותוספות מקושרים לקטע. הטקסט נטען לפי עמוד ונפתח כאן. מהדורת ויליאם דוידסון (CC-BY-NC), ביאור הרב עדין אבן־ישראל שטיינזלץ.</p>
    {unknown && <p className="notice">מסכת "{unknown}" לא נמצאה בקטלוג.</p>}
    {last && <button className="resume-reading" onClick={() => go(talmudRoute.amud(findTractate(last.tractate), last.amud))}><span>המשך מהיכן שעצרתי</span><strong>{findTractate(last.tractate)?.heTitle} {amudLabel(last.amud)}</strong><b aria-hidden="true">←</b></button>}
    <form className="halacha-search" onSubmit={submit}><label htmlFor="daf-input">פתיחת דף</label><div><input id="daf-input" value={input} onChange={e => { setInput(e.target.value); setMsg(''); setPending(null); }} placeholder="ברכות ב ע״א · שבת לא ב · בבא מציעא נט" autoComplete="off" /><button type="submit">פתיחה</button></div></form>
    {msg && <p className="notice" role="status">{msg}{pending && <> <button className="link" onClick={() => go(talmudRoute.amud(pending.tractate, `${pending.daf}a`))}>ע״א</button> · <button className="link" onClick={() => go(talmudRoute.amud(pending.tractate, `${pending.daf}b`))}>ע״ב</button></>}</p>}
    {SEDARIM.map(seder => <section key={seder} className="seder-block"><h2>סדר {SEDER_HE[seder] || seder}</h2><div className="tractate-grid">{TRACTATES.filter(t => t.seder === seder).map(t => <button key={t.title} className="tractate-card" onClick={() => go(talmudRoute.tractate(t))}><strong>{t.heTitle}</strong><small>{amudLabel(t.firstAmud)} – {amudLabel(t.lastAmud)} · {t.amudCount} עמודים</small>{progress[t.title] && <em>נפתח לאחרונה: {amudLabel(progress[t.title])}</em>}</button>)}</div></section>)}
    <details className="source-credit"><summary>מה כלול בקורא</summary><p>כל {TRACTATES.length} מסכתות התלמוד הבבלי בשישה הסדרים, כל אחת עם ביאור שטיינזלץ בעברית. {TRACTATES_WITHOUT_STEINSALTZ.length ? `ללא ביאור במקור: ${TRACTATES_WITHOUT_STEINSALTZ.map(t => t.heTitle).join(' · ')}.` : ''} מסכתות קטנות ופירושים נלווים אינם חלק מהקורא. מסכת שקלים שבדף היומי היא מן הירושלמי ואינה כלולה.</p></details>
  </section>;
}

function TractateIndex({ tractate, go, progress }) {
  const amudim = tractate.segmentsPerAmud.map((n, i) => n > 0 ? indexToAmud(i) : null).filter(Boolean);
  const dafim = [...new Set(amudim.map(a => a.slice(0, -1)))];
  return <section>
    <BackNavigation label="חזרה לתלמוד" onClick={() => go('talmud')} />
    <Breadcrumbs items={[{ label: 'תלמוד', onNavigate: () => go('talmud') }, { label: tractate.heTitle }]} />
    <p className="eyebrow">סדר {SEDER_HE[tractate.seder]}</p><h1>מסכת {tractate.heTitle}</h1>
    <p className="intro">{tractate.amudCount} עמודים · ביאור: {tractate.steinsaltz.version} · גמרא: {tractate.baseVersion?.title}</p>
    {progress[tractate.title] && <button className="resume-reading" onClick={() => go(talmudRoute.amud(tractate, progress[tractate.title]))}><span>המשך</span><strong>{amudLabel(progress[tractate.title])}</strong><b aria-hidden="true">←</b></button>}
    <div className="daf-grid">{dafim.map(d => <div key={d} className="daf-cell"><span>{amudLabel(d + 'a').split(' ')[0]}</span>{amudim.includes(d + 'a') && <button onClick={() => go(talmudRoute.amud(tractate, d + 'a'))}>ע״א</button>}{amudim.includes(d + 'b') && <button onClick={() => go(talmudRoute.amud(tractate, d + 'b'))}>ע״ב</button>}</div>)}</div>
  </section>;
}

function AmudReader({ tractate, amud, go, progress, setProgress }) {
  const resource = useResource(signal => loadAmud(tractate, amud, signal), [tractate.title, amud]);
  const [mode, setMode] = useLocal('talmud-mode-v1', 'study'); // study | gemara | iyun
  const [font, setFont] = useLocal('talmud-font-v1', 21);
  const [open, setOpen] = useState(null); // {segment, ref}
  const [highlight, setHighlight] = useState('');
  const [iyunSegment, setIyunSegment] = useState(null);
  const [iyunCommentator, setIyunCommentator] = useState(null);
  const [compare, setCompare] = useState(false);
  const [pinError, setPinError] = useState('');
  const cacheKey = `${tractate.title}|${amud}`;
  const memoryId = `talmud:${tractate.title}`;
  const data = resource.data;
  const cacheEligible = Boolean(data && canCacheContent(data));
  const pinned = cacheEligible && isContentPinned('talmud', cacheKey);
  useEffect(() => { window.scrollTo({ top: 0 }); setOpen(null); setIyunSegment(null); setIyunCommentator(null); setCompare(false); }, [tractate.title, amud]);
  useEffect(() => {
    if (mode !== 'iyun' || !data) return;
    const first = data.segments.find(seg => seg.commentaries.length) || data.segments[0];
    setIyunSegment(first?.ref || null);
    setIyunCommentator(first?.commentaries[0]?.commentator || null);
    setCompare(false);
  }, [mode, data]);
  useEffect(() => { setProgress(p => ({ ...p, [tractate.title]: amud, last: { tractate: tractate.title, amud } })); }, [tractate.title, amud]);
  useEffect(() => { rememberLearning(memoryId, { source: 'talmud', reference: `${tractate.title}/${amud}`, tractate: tractate.title, amud, title: `${tractate.heTitle} ${amudLabel(amud)}` }); }, [memoryId, tractate.title, tractate.heTitle, amud]);
  // Prefetch the next amud once the current one is displayed.
  useEffect(() => { if (data?.next) loadAmud(tractate, data.next).catch(() => {}); }, [data?.next]);
  const title = `${tractate.heTitle} ${amudLabel(amud)}`;
  const nav = { previous: data?.prev ? { title: `${tractate.heTitle} ${amudLabel(data.prev)}`, amud: data.prev } : null, next: data?.next ? { title: `${tractate.heTitle} ${amudLabel(data.next)}`, amud: data.next } : null };
  const after = !data?.next ? nextTractate(tractate) : null;
  return <section className={`talmud-reader ${mode === 'iyun' ? 'iyun-reader' : ''}`} style={{ '--study-size': `${font}px` }}>
    <BackNavigation label={`חזרה למסכת ${tractate.heTitle}`} onClick={() => go(talmudRoute.tractate(tractate))} />
    <Breadcrumbs items={[{ label: 'תלמוד', onNavigate: () => go('talmud') }, { label: tractate.heTitle, onNavigate: () => go(talmudRoute.tractate(tractate)) }, { label: amudLabel(amud) }]} />
    <header className="talmud-head"><h1>{title}</h1>
      <div className="reader-tools">
        <div className="seg" role="group" aria-label="מצב תצוגה">{[['study', 'עם ביאור'], ['gemara', 'גמרא בלבד'], ['iyun', 'עיון'], ['scan', 'צורת הדף']].map(([id, label]) => <button key={id} className={mode === id ? 'on' : ''} onClick={() => setMode(id)}>{label}</button>)}</div>
        <label>גודל אות <input type="range" min="17" max="30" value={font} onChange={e => setFont(+e.target.value)} /></label>
        <input className="seg-search" value={highlight} onChange={e => setHighlight(e.target.value)} placeholder="חיפוש בדף" aria-label="חיפוש בדף" />
        {cacheEligible && <button aria-pressed={pinned} onClick={async () => { setPinError(''); try { if (pinned) unpinTalmudDaf(tractate, amud); else await pinTalmudDaf(tractate, amud, data); window.dispatchEvent(new Event('kz-cache-changed')); } catch (error) { setPinError(error.message); } }}>{pinned ? 'הסר מהשמירה' : 'שמור לשימוש ללא אינטרנט'}</button>}
      </div>
    </header>
    {resource.loading && <p className="loading" role="status">טוען את הדף…</p>}
    {resource.error && <p className="notice error" role="alert">{resource.error} <button onClick={resource.retry}>ניסיון נוסף</button></p>}
    {data?.offlineCached && <p className="notice" role="status">זמין מהשמירה האחרונה</p>}
    {pinError && <p className="notice error" role="alert">{pinError}</p>}
    {data && !data.steinsaltzVersion && <p className="notice">לעמוד זה לא נמצא ביאור שטיינזלץ במקור; מוצגת הגמרא בלבד.</p>}
    {data && data.steinsaltzVersion && !data.steinsaltzAligned && mode !== 'gemara' && <p className="notice">מבנה הביאור בעמוד זה אינו תואם קטע־לקטע לגמרא; הביאור מוצג בנפרד מתחת לגמרא.</p>}
    {mode === 'scan' && <VilnaScan tractate={tractate} amud={amud} />}
    {data && mode !== 'scan' && mode !== 'iyun' && <div className={`amud mode-${mode}`}>
      {data.segments.map(seg => <Segment key={seg.ref} seg={seg} mode={mode} highlight={highlight} open={open} setOpen={setOpen} />)}
      {data.unalignedSteinsaltz.length > 0 && mode !== 'gemara' && <section className="steinsaltz-block"><h2>ביאור שטיינזלץ</h2>{data.unalignedSteinsaltz.map((h, i) => <p key={i} className="steinsaltz" dangerouslySetInnerHTML={{ __html: h }} />)}</section>}
    </div>}
    {data && mode === 'iyun' && <IyunStudy data={data} highlight={highlight} selectedRef={iyunSegment} setSelectedRef={setIyunSegment} commentator={iyunCommentator} setCommentator={setIyunCommentator} compare={compare} setCompare={setCompare} />}
    {data && <button className="learning-complete" type="button" onClick={() => completeLearning(memoryId)}>סיימתי את הדף</button>}
    {data && <footer className="source-credit"><details><summary>פרטי מקור</summary><p>גמרא: {data.baseVersion.title} · {data.baseVersion.license}</p>{data.steinsaltzVersion && <p>ביאור: {data.steinsaltzVersion.title} · {data.steinsaltzVersion.license} · שימוש לא־מסחרי עם ייחוס. האפליקציה אינה מוצר רשמי של ספריא, קורן או מוסד שטיינזלץ.</p>}</details></footer>}
    {data && <ReaderNavigation previous={nav.previous} next={nav.next} onSelect={item => go(talmudRoute.amud(tractate, item.amud))} endLabel={`סוף מסכת ${tractate.heTitle}`} />}
    {data && !data.next && after && <button className="resume-reading" onClick={() => go(talmudRoute.amud(after, after.firstAmud))}><span>המסכת הבאה</span><strong>{after.heTitle} {amudLabel(after.firstAmud)}</strong><b aria-hidden="true">←</b></button>}
  </section>;
}

function IyunStudy({ data, highlight, selectedRef, setSelectedRef, commentator, setCommentator, compare, setCompare }) {
  const selected = data.segments.find(seg => seg.ref === selectedRef) || data.segments[0];
  const priority = ['רש"י', 'תוספות', 'מהרש"א', 'מהר"ם', 'רשב"א', 'ריטב"א', 'רמב"ן', 'ר"ן', 'מאירי', 'פני יהושע'];
  const available = [...new Set((selected?.commentaries || []).map(c => c.commentator))].sort((a, b) => {
    const ai = priority.indexOf(a); const bi = priority.indexOf(b);
    return (ai < 0 ? priority.length : ai) - (bi < 0 ? priority.length : bi) || a.localeCompare(b, 'he');
  });
  const selectedRefs = (selected?.commentaries || []).filter(c => c.commentator === commentator).map(c => c.ref);
  const second = available.find(name => name !== commentator);
  return <div className="iyun-study">
    <div className="iyun-main amud">
      {data.segments.map(seg => <button key={seg.ref} className={`iyun-segment ${seg.ref === selected?.ref ? 'selected' : ''}`} onClick={() => { setSelectedRef(seg.ref); setCommentator(seg.commentaries[0]?.commentator || null); }}>
        <span className="gemara" dangerouslySetInnerHTML={{ __html: mark(seg.gemara, highlight) }} />
        {seg.commentaries.length > 0 && <small>{seg.commentaries.length} קטעי מפרשים · {new Set(seg.commentaries.map(c => c.commentator)).size} מפרשים</small>}
      </button>)}
    </div>
    <IyunPanel segment={selected} available={available} commentator={commentator} setCommentator={setCommentator} refs={selectedRefs} compare={compare} setCompare={setCompare} second={second} />
  </div>;
}

function IyunPanel({ segment, available, commentator, setCommentator, refs, compare, setCompare, second }) {
  const visible = available.slice(0, 5);
  const extra = available.slice(5);
  const secondRefs = (segment?.commentaries || []).filter(c => c.commentator === second).map(c => c.ref);
  return <aside className="iyun-panel" aria-label="מפרשי הקטע">
    <div className="iyun-panel-head"><div><p className="eyebrow">עיון בקטע הנבחר</p><strong>{segment?.ref || 'אין קטע נבחר'}</strong></div>{segment?.commentaries.length > 0 && <span>{available.length} מפרשים זמינים</span>}</div>
    {segment?.commentaries.length > 0 ? <>
      <div className="commentary-selector" role="group" aria-label="בחירת מפרש">
        {visible.map(name => <button key={name} className={commentator === name ? 'on' : ''} onClick={() => setCommentator(name)}>{name}</button>)}
        {extra.length > 0 && <select value={extra.includes(commentator) ? commentator : ''} onChange={e => e.target.value && setCommentator(e.target.value)} aria-label="מפרשים נוספים"><option value="">עוד ({extra.length})</option>{extra.map(name => <option key={name} value={name}>{name}</option>)}</select>}
      </div>
      <label className="compare-toggle"><input type="checkbox" checked={compare} disabled={!second} onChange={e => setCompare(e.target.checked)} /> השווה מפרשים</label>
      {compare && second ? <div className="commentary-compare"><CommentaryPanel refs={refs} title={commentator} /><CommentaryPanel refs={secondRefs} title={second} /></div> : <CommentaryPanel refs={refs} title={commentator} />}
    </> : <p className="iyun-empty">אין פירוש מקושר לקטע זה</p>}
  </aside>;
}

function VilnaScan({ tractate, amud }) {
  const resource = useResource(signal => loadVilnaScan(tractate, amud, signal), [tractate.title, amud]);
  const scan = resource.data?.primary || resource.data?.fallback;
  const [image, setImage] = useState('');
  useEffect(() => { setImage(scan?.image || ''); }, [scan?.image]);
  if (resource.loading) return <p className="loading" role="status">טוען את צורת הדף…</p>;
  if (resource.error) return <p className="notice error" role="alert">{resource.error} <button onClick={resource.retry}>ניסיון נוסף</button></p>;
  if (!scan) return <section className="scan-unavailable notice"><strong>צורת הדף אינה זמינה עדיין לדף זה</strong><p>הטקסט והביאור נשארים זמינים במצבי הקריאה האחרים.</p></section>;
  const isPrimary = Boolean(resource.data?.primary);
  return <figure className="vilna-scan">
    <img src={image} onError={() => { if (isPrimary && scan.thumbnail && image !== scan.thumbnail) setImage(scan.thumbnail); }} alt={`סריקת דפוס וילנא: ${tractate.heTitle} ${amudLabel(amud)}`} />
    <figcaption>{isPrimary ? `${scan.heTitle || scan.title} · ${scan.ref || resource.data.ref} · ` : 'סריקת דפוס וילנא · '}<a href={scan.source} target="_blank" rel="noreferrer">{isPrimary ? 'מקור ב־NLI' : 'מקור והצהרת זכויות ב־Wikimedia Commons'}</a></figcaption>
  </figure>;
}

function mark(html, needle) {
  if (!needle || needle.length < 2) return html;
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.replace(new RegExp(`(?![^<]*>)(${esc})`, 'g'), '<mark>$1</mark>');
}

function Segment({ seg, mode, highlight, open, setOpen }) {
  const has = seg.commentaries.length > 0;
  const rashi = seg.commentaries.filter(c => c.commentator === 'רש"י');
  const tosafot = seg.commentaries.filter(c => c.commentator === 'תוספות');
  const isOpen = open?.segment === seg.ref;
  return <article className="segment" id={`seg-${seg.n}`}>
    <p className="gemara" dangerouslySetInnerHTML={{ __html: mark(seg.gemara, highlight) }} />
    {mode !== 'gemara' && seg.steinsaltz && <p className="steinsaltz" dangerouslySetInnerHTML={{ __html: mark(seg.steinsaltz, highlight) }} />}
    {has && <div className="commentary-bar">
      {rashi.length > 0 && <button className={isOpen && open.kind === 'rashi' ? 'on' : ''} onClick={() => setOpen(isOpen && open.kind === 'rashi' ? null : { segment: seg.ref, kind: 'rashi', refs: rashi.map(c => c.ref) })}>רש"י ({rashi.length})</button>}
      {tosafot.length > 0 && <button className={isOpen && open.kind === 'tosafot' ? 'on' : ''} onClick={() => setOpen(isOpen && open.kind === 'tosafot' ? null : { segment: seg.ref, kind: 'tosafot', refs: tosafot.map(c => c.ref) })}>תוספות ({tosafot.length})</button>}
    </div>}
    {isOpen && <CommentaryPanel refs={open.refs} title={open.kind === 'rashi' ? 'רש"י' : 'תוספות'} onClose={() => setOpen(null)} />}
  </article>;
}

function CommentaryPanel({ refs, title, onClose }) {
  const resource = useResource(signal => Promise.all(refs.map(r => loadCommentary(r, signal))), [refs.join('|')]);
  const [query, setQuery] = useState('');
  return <section className="commentary-panel" aria-label={title}>
    <div className="commentary-head"><strong>{title}</strong>{onClose && <button className="link" onClick={onClose}>סגירה</button>}</div>
    <input className="commentary-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="חיפוש בפירוש" aria-label="חיפוש בפירוש" />
    {resource.loading && <p className="loading">טוען…</p>}
    {resource.error && <p className="notice error">{resource.error}</p>}
    {resource.data?.map(c => <div key={c.ref} className="commentary-item"><small>{c.heRef || c.ref}</small>{c.html.map((h, i) => <p key={i} dangerouslySetInnerHTML={{ __html: mark(h, query) }} />)}<details><summary>פרטי מקור</summary><small>{c.version} · {c.license}</small></details></div>)}
  </section>;
}
