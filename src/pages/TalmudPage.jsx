import { useEffect, useRef, useState } from 'react';
import { backTo } from '../services/scrollRestoration.mjs';
import { routeParts } from '../services/safeRoute.mjs';
import { useLocal, useResource, useRouteState, useStudyTimer } from '../hooks.jsx';
import { StudyCompletion } from '../components/CompletionButton.jsx';
import { TRACTATES, SEDARIM, SEDER_HE, TRACTATES_WITHOUT_STEINSALTZ, BASE_TEXTS, findTractate, parseDafInput, loadAmud, loadCommentary, loadVilnaScan, pinTalmudDaf, unpinTalmudDaf, amudLabel, nextTractate, indexToAmud, chaptersOf, chapterOfAmud, amudimOfChapter } from '../services/talmud.mjs';
import PrayerSectionNav from '../components/PrayerSectionNav.jsx';
import OfflineInvite from '../components/OfflineInvite.jsx';
import { hebrewNumeral } from '../services/hebrewNumerals.mjs';
import { canCacheContent, isContentPinned } from '../services/contentCache.mjs';
import { BackNavigation, Breadcrumbs } from '../components/LocalNavigation.jsx';
import ReaderNavigation from '../components/ReaderNavigation.jsx';
import { rememberLearning } from '../services/learningMemory.mjs';
import HeartToggle from '../components/HeartToggle.jsx';
import { routeFavorite } from '../services/favorites.mjs';

// Routes: talmud | talmud/<Tractate> | talmud/<Tractate>/<amud>[/<segment>[/<rashi|tosafot>]]
// A segment (and a commentator) is the search's deep link: the segment is brought into view and marked, the
// commentator's comments on it open beside it.
export function parseTalmudRoute(mode) {
  const [, tractate, amud, segment, layer] = routeParts(mode);
  return { tractate: tractate ? findTractate(tractate) : null, amud: amud || null, raw: tractate, segment: Number(segment) || null, layer: layer === 'rashi' || layer === 'tosafot' ? layer : null };
}
const LAYER_NAME = { rashi: 'רש"י', tosafot: 'תוספות' };
// Tractates are counted in dafim, as learners count them: the last daf's number (Bava Batra: קע״ו).
export const dafCount = tractate => Number(String(tractate.lastAmud).slice(0, -1));
export const talmudRoute = { tractate: t => `talmud/${encodeURIComponent(t.title)}`, amud: (t, a) => `talmud/${encodeURIComponent(t.title)}/${a}` };

export default function TalmudPage({ route, go, tzid = 'Asia/Jerusalem' }) {
  const [progress, setProgress] = useLocal('talmud-progress-v1', {});
  if (route.amud && route.tractate) return <AmudReader tractate={route.tractate} amud={route.amud} segment={route.segment} layer={route.layer} go={go} progress={progress} setProgress={setProgress} tzid={tzid} />;
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
    <p className="intro">{TRACTATES.length} מסכתות. הגמרא, רש"י ותוספות שמורים במכשיר ונקראים גם בלי רשת, כל פירוש ליד הקטע שהוא מפרש; ביאור הרב עדין אבן־ישראל שטיינזלץ ושאר המפרשים נטענים מספריא כשיש רשת.</p>
    <a className="personal-tool-row talmud-daily-entry" href="#learning"><span className="personal-tool-icon" aria-hidden="true">י</span><span><strong>הלימוד היומי</strong><small>דף יומי, הלכה, משנה ותהילים של היום</small></span><span aria-hidden="true">←</span></a>
    {unknown && <p className="notice">מסכת "{unknown}" לא נמצאה בקטלוג.</p>}
    {last && <button className="resume-reading" onClick={() => go(talmudRoute.amud(findTractate(last.tractate), last.amud))}><span>המשך מהיכן שעצרתי</span><strong>{findTractate(last.tractate)?.heTitle} {amudLabel(last.amud)}</strong><b aria-hidden="true">←</b></button>}
    <form className="halacha-search" onSubmit={submit}><label htmlFor="daf-input">פתיחת דף</label><div><input id="daf-input" value={input} onChange={e => { setInput(e.target.value); setMsg(''); setPending(null); }} placeholder="ברכות ב ע״א · שבת לא ב · בבא מציעא נט" autoComplete="off" /><button type="submit">פתיחה</button></div></form>
    {msg && <p className="notice" role="status">{msg}{pending && <> <button className="link" onClick={() => go(talmudRoute.amud(pending.tractate, `${pending.daf}a`))}>ע״א</button> · <button className="link" onClick={() => go(talmudRoute.amud(pending.tractate, `${pending.daf}b`))}>ע״ב</button></>}</p>}
    {SEDARIM.map(seder => <section key={seder} className="seder-block"><h2>סדר {SEDER_HE[seder] || seder}</h2><div className="tractate-grid">{TRACTATES.filter(t => t.seder === seder).map(t => <button key={t.title} className="tractate-card" onClick={() => go(talmudRoute.tractate(t))}><strong>{t.heTitle}</strong><small>{hebrewNumeral(dafCount(t))} ({dafCount(t)}) דפים</small>{progress[t.title] && <em>נפתח לאחרונה: {amudLabel(progress[t.title])}</em>}</button>)}</div></section>)}
    <details className="source-credit"><summary>מה כלול בקורא</summary><p>כל {TRACTATES.length} מסכתות התלמוד הבבלי בשישה הסדרים, כל אחת עם ביאור שטיינזלץ בעברית. {TRACTATES_WITHOUT_STEINSALTZ.length ? `ללא ביאור במקור: ${TRACTATES_WITHOUT_STEINSALTZ.map(t => t.heTitle).join(' · ')}.` : ''} מסכתות קטנות ופירושים נלווים אינם חלק מהקורא. מסכת שקלים שבדף היומי היא מן הירושלמי ואינה כלולה.</p><p>במכשיר: הגמרא בהעתקת ויקיטקסט העברי של דפוס וילנא (CC BY-SA 4.0), ורש"י ותוספות במהדורת וילנא (נחלת הכלל; בכמה מסכתות העתקת ויקיטקסט, CC BY-SA 4.0). על מסכת תמיד אין רש"י ותוספות במקור, ורש"י על בבא בתרא מסתיים בדף כ״ט (משם ממשיך הרשב״ם, מספריא). הנוסח המנוקד של ויליאם דוידסון (CC-BY-NC) זמין לבחירה בעמוד, מספריא ברשת.</p></details>
    {/* The last line of the home: the full-text search packs, quiet (the Talmud itself is already on the device). */}
    <OfflineInvite variant="search" go={go} />
  </section>;
}

// The tractate: where you stopped, then its chapters in order — name, range and pages. The chapter you are in is
// marked and open; any other opens with a tap. Every amud sits under exactly one chapter.
function TractateIndex({ tractate, go, progress }) {
  const chapters = chaptersOf(tractate);
  const current = progress[tractate.title];
  const currentChapter = current ? chapterOfAmud(tractate, current) : null;
  const [opened, setOpened] = useRouteState(`talmud-chapters:${tractate.title}`, currentChapter ? [currentChapter.n] : []);
  // One chapter open at a time: opening another folds the previous one away.
  const toggle = (n, isOpen) => setOpened(list => (isOpen ? [n] : list.filter(item => item !== n)));
  const range = chapter => `${amudLabel(chapter.start)} – ${amudLabel(chapter.end)}`;
  return <section className="tractate-page">
    <BackNavigation label="חזרה לתלמוד" onClick={() => backTo('talmud', () => go('talmud'))} />
    <Breadcrumbs items={[{ label: 'תלמוד', onNavigate: () => go('talmud') }, { label: tractate.heTitle }]} />
    <p className="eyebrow">סדר {SEDER_HE[tractate.seder]}</p><h1>מסכת {tractate.heTitle}</h1>
    <p className="tractate-meta">{hebrewNumeral(chapters.length)} פרקים · {hebrewNumeral(dafCount(tractate))} ({dafCount(tractate)}) דפים</p>
    {current ? <button className="resume-reading" onClick={() => go(talmudRoute.amud(tractate, current))}><span>המשך מהיכן שעצרתי</span><strong>{amudLabel(current)}{currentChapter ? ` · פרק ${currentChapter.name}` : ''}</strong><b aria-hidden="true">←</b></button>
      : <button className="resume-reading" onClick={() => go(talmudRoute.amud(tractate, tractate.firstAmud))}><span>התחלת המסכת</span><strong>{amudLabel(tractate.firstAmud)}</strong><b aria-hidden="true">←</b></button>}
    <ol className="chapter-list" aria-label={`פרקי מסכת ${tractate.heTitle}`}>
      {chapters.map(chapter => {
        const isOpen = opened.includes(chapter.n);
        const here = currentChapter?.n === chapter.n;
        const amudim = amudimOfChapter(tractate, chapter);
        const dafim = [...new Set(amudim.map(a => a.slice(0, -1)))];
        return <li key={chapter.n} className={`chapter-item${here ? ' is-current' : ''}`}>
          <details open={isOpen} onToggle={event => toggle(chapter.n, event.currentTarget.open)}>
            <summary><span className="chapter-number">{hebrewNumeral(chapter.n)}</span><span className="chapter-text"><strong>פרק {chapter.name}</strong><small>{range(chapter)}{here ? ' · כאן עצרת' : ''}</small></span><span className="siddur-chevron" aria-hidden="true">›</span></summary>
            <div className="chapter-dafim">{dafim.map(d => <div key={d} className="daf-cell"><span>{amudLabel(d + 'a').split(' ')[0]}</span>{['a', 'b'].map(side => amudim.includes(d + side) && <button key={side} aria-current={current === d + side ? 'page' : undefined} onClick={() => go(talmudRoute.amud(tractate, d + side))}>{side === 'a' ? 'ע״א' : 'ע״ב'}</button>)}</div>)}</div>
          </details>
        </li>;
      })}
    </ol>
  </section>;
}

// "הגמרא מוצגת" / "הגמרא ורש"י מוצגים" / "הגמרא, רש"י ותוספות מוצגים": what the device shows on this amud.
export function localLayersLine(commentators = []) {
  const names = ['הגמרא', ...commentators];
  return names.length === 1 ? 'הגמרא מוצגת' : `${names.slice(0, -1).join(', ')} ו${names.at(-1)} מוצגים`;
}

// Commentators in the order a learner reaches for them; the rest follow alphabetically.
const COMMENTATOR_PRIORITY = ['רש"י', 'תוספות', 'מהרש"א', 'מהר"ם', 'רשב"א', 'ריטב"א', 'רמב"ן', 'ר"ן', 'מאירי', 'פני יהושע'];
const BIUR = 'ביאור';
export function sortCommentators(names) {
  return [...new Set(names)].sort((a, b) => {
    const ai = COMMENTATOR_PRIORITY.indexOf(a); const bi = COMMENTATOR_PRIORITY.indexOf(b);
    return (ai < 0 ? COMMENTATOR_PRIORITY.length : ai) - (bi < 0 ? COMMENTATOR_PRIORITY.length : bi) || a.localeCompare(b, 'he');
  });
}
const firstTab = seg => sortCommentators((seg?.commentaries || []).map(c => c.commentator))[0] || (seg?.steinsaltz ? BIUR : null);

function AmudReader({ tractate, amud, segment = null, layer = null, go, progress, setProgress, tzid = 'Asia/Jerusalem' }) {
  // The Gemara's text: the open Wikisource transcription on the device (default), or the vocalized William Davidson
  // text read live from Sefaria.
  const [baseText, setBaseText] = useLocal('talmud-text-v1', 'wikisource');
  const resource = useResource(signal => loadAmud(tractate, amud, signal, { text: baseText }), [tractate.title, amud, baseText]);
  // Invisible study time (60s minimum, pauses in background/idle) — the same timer SourceReader uses.
  const { recordInteraction } = useStudyTimer({ workId: `Bavli_${tractate.title}`, workTitle: `תלמוד בבלי, ${tractate.heTitle}`, unitId: String(amud), unitLabel: `דף ${amud}`, category: 'torah_study', source: 'talmud-reader', tzid, enabled: Boolean(resource.data) });
  useEffect(() => {
    if (!resource.data) return undefined;
    const onScroll = () => recordInteraction();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [Boolean(resource.data), recordInteraction]);
  const [mode, setMode] = useLocal('talmud-mode-v1', 'study'); // study | gemara | iyun | scan
  const [font, setFont] = useLocal('talmud-font-v1', 21);
  const [open, setOpen] = useState(null); // {segment, ref}
  const [highlight, setHighlight] = useState('');
  const [iyunSegment, setIyunSegment] = useState(null);
  const [iyunCommentator, setIyunCommentator] = useState(null);
  const [compare, setCompare] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pinError, setPinError] = useState('');
  const cacheKey = `${tractate.title}|${amud}`;
  const memoryId = `talmud:${tractate.title}`;
  const data = resource.data;
  // A tractate on the device saves only its live layers (Steinsaltz and the other commentaries) for reading offline.
  const pinRecord = data?.local ? data.remoteRecord : data;
  const cacheEligible = Boolean(pinRecord && canCacheContent(pinRecord));
  const pinned = cacheEligible && isContentPinned('talmud', cacheKey);
  useEffect(() => { window.scrollTo({ top: 0 }); setOpen(null); setIyunSegment(null); setIyunCommentator(null); setCompare(false); setSheetOpen(false); }, [tractate.title, amud]);
  useEffect(() => {
    if (mode !== 'iyun' || !data || data.segments.some(seg => seg.ref === iyunSegment)) return;
    const first = data.segments.find(seg => seg.commentaries.length) || data.segments[0];
    setIyunSegment(first?.ref || null);
    setIyunCommentator(firstTab(first));
    setCompare(false);
  }, [mode, data]);
  useEffect(() => { if (mode !== 'iyun') setSheetOpen(false); }, [mode]);
  // A deep link to a segment (and a commentator): shown in every reading mode the learner keeps.
  useEffect(() => {
    const seg = segment && data?.segments.find(item => item.n === segment);
    if (!seg) return undefined;
    const name = LAYER_NAME[layer];
    const refs = name ? seg.commentaries.filter(c => c.commentator === name).map(c => c.ref) : [];
    if (mode === 'iyun') {
      setIyunSegment(seg.ref);
      if (refs.length) { setIyunCommentator(name); setSheetOpen(true); }
      return undefined;
    }
    if (refs.length) setOpen({ segment: seg.ref, kind: layer, refs });
    const frame = requestAnimationFrame(() => document.getElementById(`seg-${segment}`)?.scrollIntoView({ block: 'center' }));
    return () => cancelAnimationFrame(frame);
  }, [data, segment, layer, mode]);
  useEffect(() => { setProgress(p => ({ ...p, [tractate.title]: amud, last: { tractate: tractate.title, amud } })); }, [tractate.title, amud]);
  useEffect(() => { rememberLearning(memoryId, { source: 'talmud', reference: `${tractate.title}/${amud}`, tractate: tractate.title, amud, title: `${tractate.heTitle} ${amudLabel(amud)}` }); }, [memoryId, tractate.title, tractate.heTitle, amud]);
  // Prefetch the next amud once the current one is displayed.
  useEffect(() => { if (data?.next) loadAmud(tractate, data.next, undefined, { text: baseText }).catch(() => {}); }, [data?.next]);
  const title = `${tractate.heTitle} ${amudLabel(amud)}`;
  const chapter = chapterOfAmud(tractate, amud);
  // "הקודם | תוכן | הבא" in the header, as in the siddur: every amud of the tractate, grouped under its chapter.
  const pages = chaptersOf(tractate).flatMap(item => amudimOfChapter(tractate, item).map(a => ({ key: a, amud: a, title: amudLabel(a), group: `פרק ${hebrewNumeral(item.n)} · ${item.name}` })));
  const nav = { previous: data?.prev ? { title: `${tractate.heTitle} ${amudLabel(data.prev)}`, amud: data.prev } : null, next: data?.next ? { title: `${tractate.heTitle} ${amudLabel(data.next)}`, amud: data.next } : null };
  const after = !data?.next ? nextTractate(tractate) : null;
  return <section className={`talmud-reader ${mode === 'iyun' ? 'iyun-reader' : ''}`} style={{ '--study-size': `${font}px` }}>
    <PrayerSectionNav title={`מסכת ${tractate.heTitle}`} items={pages} currentIndex={pages.findIndex(page => page.amud === amud)} onSelect={item => go(talmudRoute.amud(tractate, item.amud))} label="ניווט בעמודי המסכת" previousLabel="לעמוד הקודם" nextLabel="לעמוד הבא" />
    <BackNavigation label={`חזרה למסכת ${tractate.heTitle}`} onClick={() => backTo(talmudRoute.tractate(tractate), () => go(talmudRoute.tractate(tractate)))} />
    <header className="talmud-head">
      <div className="reader-title-row"><div><h1>{title}</h1>{chapter && <p className="talmud-chapter">פרק {hebrewNumeral(chapter.n)} · {chapter.name}</p>}</div><HeartToggle item={routeFavorite('talmud', talmudRoute.amud(tractate, amud), title)} /></div>
      <div className="talmud-tools">
        <div className="talmud-tool-row">
          <div className="font-steps" role="group" aria-label="גודל אות"><button type="button" aria-label="הקטנת האות" disabled={font <= 17} onClick={() => setFont(size => Math.max(17, size - 2))}>א−</button><button type="button" aria-label="הגדלת האות" disabled={font >= 31} onClick={() => setFont(size => Math.min(31, size + 2))}>א+</button></div>
          {mode !== 'scan' && <input className="seg-search" type="search" value={highlight} onChange={e => setHighlight(e.target.value)} placeholder="חיפוש בדף" aria-label="חיפוש בדף" />}
          {cacheEligible && <button type="button" className="talmud-offline" aria-pressed={pinned} onClick={async () => { setPinError(''); try { if (pinned) unpinTalmudDaf(tractate, amud); else await pinTalmudDaf(tractate, amud, data); window.dispatchEvent(new Event('kz-cache-changed')); } catch (error) { setPinError(error.message); } }}>{data?.local ? (pinned ? 'הביאור שמור ✓' : 'שמירת הביאור ללא רשת') : (pinned ? 'שמור במכשיר ✓' : 'שמירה ללא רשת')}</button>}
        </div>
        <div className="talmud-text-row">
          <div className="seg talmud-text-choice" role="group" aria-label="נוסח הגמרא">{Object.values(BASE_TEXTS).map(item => <button key={item.id} type="button" className={baseText === item.id ? 'on' : ''} aria-pressed={baseText === item.id} title={item.note} onClick={() => setBaseText(item.id)}>{item.label}</button>)}</div>
          {data?.local && <span className="talmud-local-badge" title="נקרא מן המכשיר, גם בלי רשת">במכשיר: {['גמרא', ...data.localCommentatorsOfTractate].join(' · ')}</span>}
        </div>
      </div>
    </header>
    {/* The four ways to read stay pinned under the app header, reachable anywhere on the daf. */}
    <div className="talmud-modes-bar">
      <div className="seg talmud-modes" role="group" aria-label="מצב תצוגה">{[['study', 'עם ביאור'], ['gemara', 'גמרא'], ['iyun', 'עיון'], ['scan', 'צורת הדף']].map(([id, label]) => <button key={id} className={mode === id ? 'on' : ''} aria-pressed={mode === id} onClick={() => { setMode(id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{label}</button>)}</div>
    </div>
    {resource.loading && <p className="loading" role="status">טוען את הדף…</p>}
    {resource.error && <p className="notice error" role="alert">{resource.error} <button onClick={resource.retry}>ניסיון נוסף</button></p>}
    {data?.offlineCached && <p className="notice" role="status">זמין מהשמירה האחרונה</p>}
    {data?.local && data.remoteError && <p className="notice" role="status">אין כרגע חיבור לספריא: {localLayersLine(data.localCommentators)} מן המכשיר. ביאור שטיינזלץ ושאר המפרשים ייטענו כשהרשת תחזור.</p>}
    {data?.local && data.remoteFromCache && <p className="notice" role="status">ביאור שטיינזלץ והמפרשים הנוספים — מהשמירה במכשיר.</p>}
    {data?.davidsonNote && <p className="notice" role="status">{data.davidsonNote}</p>}
    {pinError && <p className="notice error" role="alert">{pinError}</p>}
    {data && !data.steinsaltzVersion && !data.remoteError && <p className="notice">לעמוד זה לא נמצא ביאור שטיינזלץ במקור; מוצגת הגמרא בלבד.</p>}
    {data && data.steinsaltzVersion && !data.steinsaltzAligned && mode !== 'gemara' && <p className="notice">מבנה הביאור בעמוד זה אינו תואם קטע־לקטע לגמרא; הביאור מוצג בנפרד מתחת לגמרא.</p>}
    {mode === 'scan' && <VilnaScan tractate={tractate} amud={amud} />}
    {data && mode !== 'scan' && mode !== 'iyun' && <div className={`amud mode-${mode}`}>
      {data.segments.map(seg => <Segment key={seg.ref} seg={seg} mode={mode} highlight={highlight} open={open} setOpen={setOpen} focused={seg.n === segment} />)}
      {data.unalignedSteinsaltz.length > 0 && mode !== 'gemara' && <section className="steinsaltz-block"><h2>ביאור שטיינזלץ</h2>{data.unalignedSteinsaltz.map((h, i) => <p key={i} className="steinsaltz" dangerouslySetInnerHTML={{ __html: h }} />)}</section>}
    </div>}
    {data && mode === 'iyun' && <IyunStudy data={data} highlight={highlight} selectedRef={iyunSegment} setSelectedRef={setIyunSegment} commentator={iyunCommentator} setCommentator={setIyunCommentator} compare={compare} setCompare={setCompare} sheetOpen={sheetOpen} setSheetOpen={setSheetOpen} />}
    {data && (
      <footer className="source-credit">
        {data.baseVersion.local && data.baseVersion.attribution
          ? <p>גמרא: {data.baseVersion.attribution.text}. הרישיון חל על טקסט הגמרא בלבד, לא על האפליקציה. {data.baseVersion.attribution.modified} <button type="button" className="link" onClick={() => go('about')}>המקור ותנאי הרישיון</button></p>
          : <p>גמרא: {data.baseVersion.title} · {data.baseVersion.license}{/NC/i.test(data.baseVersion.license || '') ? ' · שימוש לא־מסחרי עם ייחוס' : ''}</p>}
        {data.localCredits?.commentaries.map(item => <p key={item.name}>{item.name}: {item.attribution ? item.attribution.text : `${item.edition} · ${item.licenseLabel}`} · במכשיר</p>)}
        {data.steinsaltzVersion && (
          <p>ביאור: {data.steinsaltzVersion.title} · {data.steinsaltzVersion.license} · שימוש לא־מסחרי עם ייחוס. האפליקציה אינה מוצר רשמי של ספריא, קורן או מוסד שטיינזלץ.</p>
        )}
      </footer>
    )}
    {data && <StudyCompletion workId={`Bavli_${tractate.title}`} workTitle={`תלמוד בבלי, ${tractate.heTitle}`} unitId={String(amud)} unitLabel={amudLabel(amud)} source="talmud-reader" tzid={tzid || 'Asia/Jerusalem'} onBeforeRecord={recordInteraction} />}
    {data && <ReaderNavigation previous={nav.previous} next={nav.next} onSelect={item => go(talmudRoute.amud(tractate, item.amud))} endLabel={`סוף מסכת ${tractate.heTitle}`} />}
    {data && !data.next && after && <button className="resume-reading" onClick={() => go(talmudRoute.amud(after, after.firstAmud))}><span>המסכת הבאה</span><strong>{after.heTitle} {amudLabel(after.firstAmud)}</strong><b aria-hidden="true">←</b></button>}
  </section>
}

// עיון: tap a passage and its commentators open right there — a panel rising from the bottom on phones and upright
// iPads (the passage scrolls up above it), a fixed side panel on wide screens. The panel steps passage to passage
// and keeps the chosen commentator when the next passage has him.
function IyunStudy({ data, highlight, selectedRef, setSelectedRef, commentator, setCommentator, compare, setCompare, sheetOpen, setSheetOpen }) {
  const index = Math.max(0, data.segments.findIndex(seg => seg.ref === selectedRef));
  // A commentator carries over from passage to passage only once the learner has chosen one; until then each passage
  // opens on its first commentator (רש"י where there is one).
  const [chosen, setChosen] = useState(false);
  const choose = name => { setChosen(true); setCommentator(name); };
  const selected = data.segments[index];
  const narrow = () => { try { return window.matchMedia('(max-width: 1099px)').matches; } catch { return false; } };
  const pick = (seg, { reveal = false } = {}) => {
    setSelectedRef(seg.ref);
    const names = seg.commentaries.map(c => c.commentator);
    setCommentator(chosen && commentator && (names.includes(commentator) || (commentator === BIUR && seg.steinsaltz)) ? commentator : firstTab(seg));
    if (reveal && narrow()) requestAnimationFrame(() => document.getElementById(`iyun-${seg.n}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  };
  useEffect(() => {
    if (!sheetOpen) return undefined;
    const onKey = event => { if (event.key === 'Escape') setSheetOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetOpen]);
  const step = delta => { const target = data.segments[index + delta]; if (target) pick(target, { reveal: true }); };
  return <div className={`iyun-study${sheetOpen ? ' sheet-open' : ''}`}>
    <div className="iyun-main amud">
      {data.segments.map(seg => {
        const names = sortCommentators(seg.commentaries.map(c => c.commentator));
        return <button key={seg.ref} id={`iyun-${seg.n}`} className={`iyun-segment ${seg.ref === selected?.ref ? 'selected' : ''}`} aria-pressed={seg.ref === selected?.ref} onClick={() => { pick(seg, { reveal: true }); setSheetOpen(true); }}>
          <span className="gemara" data-lookup="talmud" dangerouslySetInnerHTML={{ __html: mark(seg.gemara, highlight) }} />
          {names.length > 0 && <span className="iyun-badges" aria-label={`${names.length} מפרשים`}>{names.slice(0, 3).map(name => <span key={name}>{name}</span>)}{names.length > 3 && <span>+{names.length - 3}</span>}</span>}
        </button>;
      })}
    </div>
    <IyunPanel segment={selected} index={index} total={data.segments.length} commentator={commentator} setCommentator={choose} compare={compare} setCompare={setCompare} onStep={step} onClose={() => setSheetOpen(false)} open={sheetOpen} highlight={highlight} />
  </div>;
}

function IyunPanel({ segment, index, total, commentator, setCommentator, compare, setCompare, onStep, onClose, open, highlight }) {
  const names = sortCommentators((segment?.commentaries || []).map(c => c.commentator));
  const tabs = [...(segment?.steinsaltz ? [BIUR] : []), ...names];
  const visible = tabs.slice(0, 6);
  const extra = tabs.slice(6);
  const refsOf = name => (segment?.commentaries || []).filter(c => c.commentator === name).map(c => c.ref);
  const second = names.find(name => name !== commentator);
  // The sheet follows the finger: drag its top down to lower it (from full to half, from half to closed), up to take
  // the whole screen; a tap on the handle toggles half and full. Wide screens keep the fixed side panel.
  const [full, setFull] = useState(false);
  const [dy, setDy] = useState(0);
  const drag = useRef(null);
  useEffect(() => { if (!open) { setFull(false); setDy(0); } }, [open]);
  const sheetMode = () => { try { return window.matchMedia('(max-width: 1099px)').matches; } catch { return false; } };
  const grip = {
    onPointerDown: event => { if (sheetMode()) drag.current = { y: event.clientY, moved: false, delta: 0 }; },
    onPointerMove: event => {
      const state = drag.current;
      if (!state) return;
      const delta = event.clientY - state.y;
      if (!state.moved && Math.abs(delta) < 6) return;
      if (!state.moved) { state.moved = true; event.currentTarget.setPointerCapture?.(event.pointerId); }
      state.delta = delta;
      setDy(delta);
    },
    onPointerUp: () => {
      const state = drag.current;
      drag.current = null;
      if (!state?.moved) return;
      setDy(0);
      if (state.delta > 90) { if (full) setFull(false); else onClose(); } else if (state.delta < -50) setFull(true);
    },
    onPointerCancel: () => { drag.current = null; setDy(0); },
  };
  const sheetStyle = dy > 0 ? { transform: `translateY(${dy}px)` } : dy < 0 && !full ? { maxHeight: `calc(min(64dvh, 560px) + ${-dy}px)` } : undefined;
  const body = name => (name === BIUR
    ? <section className="commentary-panel" aria-label="ביאור שטיינזלץ"><div className="commentary-head"><strong>ביאור שטיינזלץ</strong></div><p className="steinsaltz" dangerouslySetInnerHTML={{ __html: mark(segment.steinsaltz, highlight) }} /></section>
    : <CommentaryPanel refs={refsOf(name)} title={name} />);
  return <aside className={`iyun-panel${open ? ' is-open' : ''}${full ? ' is-full' : ''}${dy ? ' is-dragging' : ''}`} style={sheetStyle} aria-label="מפרשי הקטע">
    <div className="iyun-grip" {...grip}>
    <button type="button" className="iyun-sheet-handle" onClick={() => setFull(value => !value)} aria-label={full ? 'הקטנת חלון המפרשים' : 'הגדלת חלון המפרשים למסך מלא'} />
    <div className="iyun-panel-head">
      <button type="button" className="iyun-step" onClick={() => onStep(-1)} disabled={index <= 0} aria-label="לקטע הקודם">›</button>
      <div className="iyun-where"><strong>קטע {hebrewNumeral(index + 1)}</strong><span>מתוך {hebrewNumeral(total)}{names.length ? ` · ${names.length} מפרשים` : ''}</span></div>
      <button type="button" className="iyun-step" onClick={() => onStep(1)} disabled={index >= total - 1} aria-label="לקטע הבא">‹</button>
      <button type="button" className="iyun-close" onClick={onClose} aria-label="סגירת המפרשים">✕</button>
    </div>
    </div>
    {tabs.length > 0 ? <>
      <div className="commentary-selector" role="tablist" aria-label="בחירת מפרש">
        {visible.map(name => <button key={name} role="tab" aria-selected={commentator === name} className={commentator === name ? 'on' : ''} onClick={() => setCommentator(name)}>{name}</button>)}
        {extra.length > 0 && <select value={extra.includes(commentator) ? commentator : ''} onChange={e => e.target.value && setCommentator(e.target.value)} aria-label="מפרשים נוספים"><option value="">עוד ({extra.length})</option>{extra.map(name => <option key={name} value={name}>{name}</option>)}</select>}
      </div>
      {second && commentator !== BIUR && <label className="compare-toggle"><input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} /> השוואה עם {second}</label>}
      <div className="iyun-panel-body">{compare && second && commentator !== BIUR ? <div className="commentary-compare">{body(commentator)}{body(second)}</div> : commentator && body(commentator)}</div>
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
  const label = isPrimary ? scan.heTitle : 'דפוס וילנא';
  return <figure className="vilna-scan">
    {isPrimary && scan.note && <p className="scan-edition-note">{scan.note}</p>}
    <img src={image} onError={() => { if (isPrimary && scan.thumbnail && image !== scan.thumbnail) setImage(scan.thumbnail); }} alt={`${label}: ${tractate.heTitle} ${amudLabel(amud)}`} />
    <figcaption>{isPrimary ? `${scan.heTitle} · ${scan.ref || resource.data.ref} · ${scan.holder} · דרך ספריא` : 'סריקת דפוס וילנא · Wikimedia Commons'}</figcaption>
  </figure>;
}

function mark(html, needle) {
  // Markup characters in the needle could split tags/entities inside sanitized HTML; highlight plain text only.
  if (!needle || needle.length < 2 || /[<>&]/.test(needle)) return html;
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.replace(new RegExp(`(?![^<]*>)(${esc})`, 'g'), '<mark>$1</mark>');
}

function Segment({ seg, mode, highlight, open, setOpen, focused = false }) {
  const has = seg.commentaries.length > 0;
  const rashi = seg.commentaries.filter(c => c.commentator === 'רש"י');
  const tosafot = seg.commentaries.filter(c => c.commentator === 'תוספות');
  const isOpen = open?.segment === seg.ref;
  return <article className={`segment${focused ? ' is-focus' : ''}`} id={`seg-${seg.n}`} aria-current={focused ? 'true' : undefined}>
    <p className="gemara" data-lookup="talmud" dangerouslySetInnerHTML={{ __html: mark(seg.gemara, highlight) }} />
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
    {resource.data?.map(c => <div key={c.ref} className="commentary-item"><small>{c.heRef || c.ref}</small>{c.html.map((h, i) => <p key={i} data-lookup="talmud-commentary" dangerouslySetInnerHTML={{ __html: mark(h, query) }} />)}<small>{c.version} · {c.license}{c.local ? ' · במכשיר' : ''}</small></div>)}
  </section>;
}
