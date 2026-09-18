import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocal, useResource } from '../hooks.jsx';
import { TRACTATES, SEDARIM, SEDER_HE, TRACTATES_WITHOUT_STEINSALTZ, findTractate, parseDafInput, loadAmud, loadCommentary, amudLabel, nextTractate, indexToAmud, getVilnaScan } from '../services/talmud.mjs';
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
  const memoryId = `talmud:${tractate.title}`;
  const data = resource.data;
  useEffect(() => { window.scrollTo({ top: 0 }); setOpen(null); }, [tractate.title, amud]);
  useEffect(() => { setProgress(p => ({ ...p, [tractate.title]: amud, last: { tractate: tractate.title, amud } })); }, [tractate.title, amud]);
  useEffect(() => { rememberLearning(memoryId, { source: 'talmud', reference: `${tractate.title}/${amud}`, tractate: tractate.title, amud, title: `${tractate.heTitle} ${amudLabel(amud)}` }); }, [memoryId, tractate.title, tractate.heTitle, amud]);
  // Prefetch the next amud once the current one is displayed.
  useEffect(() => { if (data?.next) loadAmud(tractate, data.next).catch(() => {}); }, [data?.next]);
  const title = `${tractate.heTitle} ${amudLabel(amud)}`;
  const nav = { previous: data?.prev ? { title: `${tractate.heTitle} ${amudLabel(data.prev)}`, amud: data.prev } : null, next: data?.next ? { title: `${tractate.heTitle} ${amudLabel(data.next)}`, amud: data.next } : null };
  const after = !data?.next ? nextTractate(tractate) : null;
  return <section className="talmud-reader" style={{ '--study-size': `${font}px` }}>
    <BackNavigation label={`חזרה למסכת ${tractate.heTitle}`} onClick={() => go(talmudRoute.tractate(tractate))} />
    <Breadcrumbs items={[{ label: 'תלמוד', onNavigate: () => go('talmud') }, { label: tractate.heTitle, onNavigate: () => go(talmudRoute.tractate(tractate)) }, { label: amudLabel(amud) }]} />
    <header className="talmud-head"><h1>{title}</h1>
      <div className="reader-tools">
        <div className="seg" role="group" aria-label="מצב תצוגה">{[['study', 'עם ביאור'], ['gemara', 'גמרא בלבד'], ['iyun', 'עיון'], ['scan', 'צורת הדף']].map(([id, label]) => <button key={id} className={mode === id ? 'on' : ''} onClick={() => setMode(id)}>{label}</button>)}</div>
        <label>גודל אות <input type="range" min="17" max="30" value={font} onChange={e => setFont(+e.target.value)} /></label>
        <input className="seg-search" value={highlight} onChange={e => setHighlight(e.target.value)} placeholder="חיפוש בדף" aria-label="חיפוש בדף" />
      </div>
    </header>
    {resource.loading && <p className="loading" role="status">טוען את הדף…</p>}
    {resource.error && <p className="notice error" role="alert">{resource.error} <button onClick={resource.retry}>ניסיון נוסף</button></p>}
    {data && !data.steinsaltzVersion && <p className="notice">לעמוד זה לא נמצא ביאור שטיינזלץ במקור; מוצגת הגמרא בלבד.</p>}
    {data && data.steinsaltzVersion && !data.steinsaltzAligned && mode !== 'gemara' && <p className="notice">מבנה הביאור בעמוד זה אינו תואם קטע־לקטע לגמרא; הביאור מוצג בנפרד מתחת לגמרא.</p>}
    {data && mode === 'scan' && <VilnaScan tractate={tractate} amud={amud} />}
    {data && mode !== 'scan' && <div className={`amud mode-${mode}`}>
      {data.segments.map(seg => <Segment key={seg.ref} seg={seg} mode={mode} highlight={highlight} open={open} setOpen={setOpen} />)}
      {data.unalignedSteinsaltz.length > 0 && mode !== 'gemara' && <section className="steinsaltz-block"><h2>ביאור שטיינזלץ</h2>{data.unalignedSteinsaltz.map((h, i) => <p key={i} className="steinsaltz" dangerouslySetInnerHTML={{ __html: h }} />)}</section>}
    </div>}
    {data && <button className="learning-complete" type="button" onClick={() => completeLearning(memoryId)}>סיימתי את הדף</button>}
    {data && <footer className="source-credit"><details><summary>פרטי מקור</summary><p>גמרא: {data.baseVersion.title} · {data.baseVersion.license}</p>{data.steinsaltzVersion && <p>ביאור: {data.steinsaltzVersion.title} · {data.steinsaltzVersion.license} · שימוש לא־מסחרי עם ייחוס. האפליקציה אינה מוצר רשמי של ספריא, קורן או מוסד שטיינזלץ.</p>}</details></footer>}
    {data && <ReaderNavigation previous={nav.previous} next={nav.next} onSelect={item => go(talmudRoute.amud(tractate, item.amud))} endLabel={`סוף מסכת ${tractate.heTitle}`} />}
    {data && !data.next && after && <button className="resume-reading" onClick={() => go(talmudRoute.amud(after, after.firstAmud))}><span>המסכת הבאה</span><strong>{after.heTitle} {amudLabel(after.firstAmud)}</strong><b aria-hidden="true">←</b></button>}
  </section>;
}

function VilnaScan({ tractate, amud }) {
  const scan = getVilnaScan(tractate, amud);
  if (!scan) return <section className="scan-unavailable notice"><strong>צורת הדף אינה זמינה עדיין לדף זה</strong><p>הטקסט והביאור נשארים זמינים במצבי הקריאה האחרים.</p></section>;
  return <figure className="vilna-scan">
    <img src={scan.image} alt={`סריקת דפוס וילנא: ${tractate.heTitle} ${amudLabel(amud)}`} />
    <figcaption>סריקת דפוס וילנא, מהדורת רומם · <a href={scan.source} target="_blank" rel="noreferrer">מקור והצהרת זכויות ב־Wikimedia Commons</a></figcaption>
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
  return <aside className="commentary-panel" aria-label={title}>
    <div className="commentary-head"><strong>{title}</strong><button className="link" onClick={onClose}>סגירה</button></div>
    {resource.loading && <p className="loading">טוען…</p>}
    {resource.error && <p className="notice error">{resource.error}</p>}
    {resource.data?.map(c => <div key={c.ref} className="commentary-item"><small>{c.heRef || c.ref}</small>{c.html.map((h, i) => <p key={i} dangerouslySetInnerHTML={{ __html: h }} />)}</div>)}
    {resource.data && <small className="muted">{resource.data[0]?.version} · {resource.data[0]?.license}</small>}
  </aside>;
}
