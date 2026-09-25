import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocal, useResource } from '../hooks.jsx';
import { routeParts } from '../services/safeRoute.mjs';
import { hebrewNumeral } from '../services/hebrewNumerals.mjs';
import { removeTrope } from '../hebrewText.mjs';
import { BackNavigation, Breadcrumbs } from '../components/LocalNavigation.jsx';
import ReaderNavigation from '../components/ReaderNavigation.jsx';
import ClearableInput from '../components/ClearableInput.jsx';
import { ResourceState } from '../components/SourceReader.jsx';
import { ACQUISITION_QUEUE, COVERAGE, IMPORT_REPORTS, LICENSES, PUBLIC_WORKS, TAXONOMY, WORKS, categoryById, registryAudit, workById, worksInCategory } from '../data/library/registry.mjs';
import { resolveLibraryReference, searchChunk, searchWorks } from '../services/library/search.mjs';
import { downloadEdition, downloadState, loadEditionChunk, removeEdition } from '../services/library/packs.mjs';
import { isBookmarked, readPersonal, rememberPosition, toggleBookmark, toggleFavorite } from '../services/library/personal.mjs';
import { validateWorkChunk } from '../services/library/integrity.mjs';

// Routes: books | books/c/<category> | books/w/<work> | books/r/<work>/<node>[/<unit>] | books/lab
export function parseLibraryRoute(mode) {
  const [, view, id, node, unit] = routeParts(mode);
  if (view === 'c') return { view: 'category', id };
  if (view === 'w') return { view: 'work', id };
  if (view === 'r') return { view: 'read', id, node: Number(node) || 1, unit: Number(unit) || null };
  if (view === 'lab') return { view: 'lab' };
  return { view: 'home' };
}
export const libraryRoute = {
  home: () => 'books',
  category: id => `books/c/${encodeURIComponent(id)}`,
  work: id => `books/w/${encodeURIComponent(id)}`,
  read: (id, node, unit) => `books/r/${encodeURIComponent(id)}/${node}${unit ? `/${unit}` : ''}`,
  lab: () => 'books/lab',
};

const STATUS_LABEL = { FULL: 'מלא · נבדק', PARTIAL: 'חלקי', REMOTE_ONLY: 'מקוון', METADATA_ONLY: 'פרטים בלבד', SCAN_ONLY: 'סריקה בלבד', UNAVAILABLE: 'לא זמין' };
const sizeLabel = bytes => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const nodeTitle = (work, node) => `${work.editions[0].nodeLabel || 'חלק'} ${hebrewNumeral(node)}`;
const pointLabel = (work, node, unit) => `${work.title} ${hebrewNumeral(node)}${unit ? `, ${hebrewNumeral(unit)}` : ''}`;

export function readerNeighbors(work, node) {
  const total = work.editions[0].expected.length;
  const step = n => (n >= 1 && n <= total ? { title: nodeTitle(work, n), node: n } : null);
  return { previous: step(node - 1), next: step(node + 1) };
}

function usePersonal() {
  const [state, setState] = useState(() => readPersonal());
  return [state, next => setState(next || readPersonal())];
}

// Shared row: title (start) | metadata (end) | arrow. A number is bound to its word so it never wraps apart.
export function LibraryRow({ title, meta = [], onClick, stacked = false, as: Tag = 'button', ...rest }) {
  const parts = meta.filter(Boolean).map(part => String(part).replace(/(\d+) /g, '$1\u00a0'));
  return <Tag {...(Tag === 'button' ? { type: 'button', onClick } : {})} className={`library-row${stacked ? ' library-row-stacked' : ''}`} {...rest}>
    <span className="library-row-title">{title}</span>
    {parts.length > 0 && <span className="library-row-meta">{parts.map((part, index) => <span key={index}>{part}</span>)}</span>}
    <span className="library-row-arrow" aria-hidden="true">›</span>
  </Tag>;
}

function WorkRow({ work, detail, short = false }) {
  const { openWork, go } = useContext(LibraryNav);
  const edition = work.editions[0];
  const offline = work.kind === 'pack' && downloadState(edition) !== 'none';
  return <div className="library-work">
    <LibraryRow title={short && work.shortTitle ? work.shortTitle : work.title} meta={[detail, work.authors.join(' · '), work.coverage === COVERAGE.REMOTE_ONLY ? 'מקוון' : null, offline ? 'שמור במכשיר' : null]} onClick={() => openWork(work)} />
    <button type="button" className="library-info" aria-label={`פרטי ספר: ${work.title}`} onClick={() => go(libraryRoute.work(work.workId))}>i</button>
  </div>;
}

const LibraryNav = createContext(null);
const goBack = (go, fallback) => (Number(history.state?.kzDepth) > 0 ? history.back() : go(fallback));
const readTalmudProgress = () => { try { return JSON.parse(localStorage.getItem('talmud-progress-v1') || '{}') || {}; } catch { return {}; } };

// Where one tap on a book lands: its last position, otherwise its first canonical unit.
export function openTargetFor(work, personal = readPersonal(), talmudProgress = readTalmudProgress()) {
  const position = personal.positions[work.workId];
  if (work.kind === 'pack') return { route: libraryRoute.read(work.workId, position?.node || 1, position?.unit || null) };
  if (work.kind === 'legacy') return { legacyIndex: Math.min(Math.max((position?.node || 1) - 1, 0), work.editions.length - 1) };
  if (work.primaryCategory === 'talmud') return { route: `talmud/${encodeURIComponent(work.sourceTitle)}/${talmudProgress[work.sourceTitle] || work.firstAmud}` };
  return { route: work.route };
}

function openLegacyEdition(work, index, { go, openSource }) {
  const item = work.editions[index];
  rememberPosition(work.workId, index + 1);
  openSource(item.ref, work.editions.length > 1 ? `${work.title} · חלק ${hebrewNumeral(index + 1)}` : work.title, 'nikud', { backLabel: 'חזרה', onBack: () => history.back(), returnRoute: 'books', breadcrumbs: [{ label: 'ספרים', route: 'books', onNavigate: () => go(libraryRoute.home()) }, { label: work.title }] });
}

export default function LibraryPage({ route, go, openSource }) {
  const openWork = target => {
    const destination = openTargetFor(target);
    if (destination.legacyIndex !== undefined) openLegacyEdition(target, destination.legacyIndex, { go, openSource });
    else go(destination.route);
  };
  return <LibraryNav.Provider value={{ go, openSource, openWork }}><LibraryView route={route} go={go} openSource={openSource} /></LibraryNav.Provider>;
}

function LibraryView({ route, go, openSource }) {
  const work = route.id && route.view !== 'category' ? workById(route.id) : null;
  if (route.view === 'category') return <CategoryPage category={categoryById(route.id)} go={go} />;
  if (route.view === 'lab') return <ValidationLab go={go} />;
  if ((route.view === 'work' || route.view === 'read') && !work?.public) return <section className="library"><BackNavigation label="חזרה לספרים" onClick={() => go(libraryRoute.home())} /><p className="notice">הספר אינו זמין בספרייה.</p></section>;
  if (route.view === 'work') return <BookPage work={work} go={go} openSource={openSource} />;
  if (route.view === 'read') return work.kind === 'pack' ? <LibraryReader work={work} node={route.node} unit={route.unit} go={go} /> : <BookPage work={work} go={go} openSource={openSource} />;
  return <LibraryHome go={go} />;
}

function LibraryHome({ go }) {
  const { openWork } = useContext(LibraryNav);
  const [query, setQuery] = useState('');
  const [personal] = usePersonal();
  const trimmed = query.trim();
  const reference = useMemo(() => resolveLibraryReference(trimmed, PUBLIC_WORKS), [trimmed]);
  const results = useMemo(() => searchWorks(trimmed, PUBLIC_WORKS).slice(0, 40), [trimmed]);
  const recent = personal.history.map(item => ({ ...item, work: workById(item.workId) })).filter(item => item.work?.public);
  const favorites = personal.favorites.map(workById).filter(item => item?.public);
  const downloaded = PUBLIC_WORKS.filter(item => item.kind === 'pack' && downloadState(item.editions[0]) !== 'none');
  const openReference = hit => (hit.kind === 'route' ? go(hit.route) : hit.node ? go(libraryRoute.read(hit.workId, hit.node, hit.unit)) : openWork(workById(hit.workId)));
  const openRecent = item => openWork(item.work);
  return <section className="library library-home">
    <p className="eyebrow">ספריית מקורות</p>
    <h1>ספרים</h1>
    <form className="halacha-search library-search" onSubmit={event => { event.preventDefault(); if (reference) openReference(reference); }}>
      <label htmlFor="library-search">חיפוש בספרייה</label>
      <ClearableInput id="library-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="ספר, מחבר או מראה מקום · בראשית א א · ברכות ב א" autoComplete="off" clearLabel="נקה חיפוש בספרייה" />
    </form>
    {trimmed ? <div className="library-results" aria-live="polite">
      {reference && <section><h2 className="library-subhead">מראה מקום</h2><LibraryRow title={reference.kind === 'pack' && reference.node ? pointLabel(workById(reference.workId), reference.node, reference.unit) : reference.label} meta={['מקום מדויק']} onClick={() => openReference(reference)} /></section>}
      {results.length > 0 && <section><h2 className="library-subhead">ספרים</h2><div className="book-index">{results.map(({ work }) => <WorkRow key={work.workId} work={work} />)}</div></section>}
      {!reference && !results.length && trimmed.length > 1 && <p className="notice">לא נמצא ספר או מראה מקום מתאים בספרייה. חיפוש בתוך טקסט אפשרי מתוך דף הספר.</p>}
    </div> : <>
      {recent.length > 0 && <section><h2 className="library-subhead">המשך לקרוא</h2><div className="book-index">{recent.slice(0, 2).map(item => <button type="button" key={item.workId} className="resume-reading" onClick={() => openRecent(item)}><span>המשך</span><strong>{item.work.kind === 'pack' ? pointLabel(item.work, item.node, personal.positions[item.workId]?.unit) : item.work.title}</strong><b aria-hidden="true">←</b></button>)}</div></section>}
      {favorites.length > 0 && <section><h2 className="library-subhead">מועדפים</h2><div className="book-index">{favorites.map(item => <WorkRow key={item.workId} work={item} />)}</div></section>}
      {recent.length > 2 && <section><h2 className="library-subhead">נפתחו לאחרונה</h2><div className="book-index">{recent.slice(2, 7).map(item => <WorkRow key={item.workId} work={item.work} />)}</div></section>}
      {downloaded.length > 0 && <section><h2 className="library-subhead">שמורים במכשיר</h2><div className="book-index">{downloaded.map(item => <WorkRow key={item.workId} work={item} />)}</div></section>}
      <section><h2 className="library-subhead">קטגוריות</h2><div className="library-categories">{TAXONOMY.map(category => ({ category, count: worksInCategory(category.id).length })).filter(item => item.count).map(({ category, count }) => <button type="button" key={category.id} className="library-category" onClick={() => go(libraryRoute.category(category.id))}><strong>{category.title}</strong><small>{count}</small></button>)}</div></section>
      <details className="source-credit"><summary>על הספרייה</summary><p>ספר מסומן „מלא · נבדק” רק לאחר בדיקה שכל יחידות הטקסט במהדורה קיימות, ייחודיות ואינן ריקות. מידע על המהדורה, המקור והרישיון מופיע בכל ספר באזור המידע על המקור.</p><button type="button" className="link" onClick={() => go(libraryRoute.lab())}>מעבדת אימות הספרייה</button></details>
    </>}
  </section>;
}

function CategoryPage({ category, go }) {
  const [query, setQuery] = useState('');
  const [fullOnly, setFullOnly] = useState(false);
  const [offlineOnly, setOfflineOnly] = useState(false);
  const [sort, setSort] = useState('traditional');
  if (!category) return <section className="library"><BackNavigation label="חזרה לספרים" onClick={() => go(libraryRoute.home())} /><p className="notice">הקטגוריה לא נמצאה.</p></section>;
  let works = worksInCategory(category.id);
  if (query.trim()) works = searchWorks(query, works).map(item => item.work);
  if (fullOnly) works = works.filter(work => work.coverage === COVERAGE.FULL);
  if (offlineOnly) works = works.filter(work => work.kind === 'pack' && downloadState(work.editions[0]) !== 'none');
  if (sort === 'alpha') works = [...works].sort((a, b) => a.title.localeCompare(b.title, 'he'));
  const groups = sort === 'traditional' && category.groups.length && !query.trim()
    ? [...category.groups.map(([id, title]) => ({ id, title, works: works.filter(work => work.primaryCategory === category.id && work.group === id) })), { id: 'other', title: 'נוספים', works: works.filter(work => work.primaryCategory !== category.id || !category.groups.some(([id]) => id === work.group)) }]
    : [{ id: 'all', title: null, works }];
  return <section className="library">
    <BackNavigation label="חזרה לספרים" onClick={() => go(libraryRoute.home())} />
    <Breadcrumbs items={[{ label: 'ספרים', onNavigate: () => go(libraryRoute.home()) }, { label: category.title }]} />
    <h1>{category.title}</h1>
    <div className="library-filters">
      <ClearableInput type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={`חיפוש ב${category.title}`} aria-label={`חיפוש ב${category.title}`} autoComplete="off" clearLabel="נקה חיפוש בקטגוריה" />
      <label><input type="checkbox" checked={fullOnly} onChange={event => setFullOnly(event.target.checked)} /> מלאים בלבד</label>
      <label><input type="checkbox" checked={offlineOnly} onChange={event => setOfflineOnly(event.target.checked)} /> שמורים במכשיר</label>
      <select value={sort} onChange={event => setSort(event.target.value)} aria-label="סדר"><option value="traditional">סדר מסורתי</option><option value="alpha">אלפביתי</option></select>
    </div>
    {groups.filter(group => group.works.length).map(group => <section key={group.id} className="library-group">
      {group.title && <h2 className="library-subhead">{group.title}</h2>}
      <div className="book-index">{group.works.map(work => <WorkRow key={work.workId} work={work} detail={work.structureSummary} short={work.primaryCategory === category.id} />)}</div>
    </section>)}
    {!works.length && <p className="notice">אין ספרים התואמים לסינון.</p>}
  </section>;
}

function completenessLine(work) {
  const edition = work.editions[0];
  if (work.coverage === COVERAGE.FULL) return `שלמות: נבדקה מול מבנה המקור · ${edition.expected.reduce((a, b) => a + b, 0)} ${edition.unitLabel === 'פסוק' ? 'פסוקים' : 'משניות'}`;
  if (work.coverage === COVERAGE.PARTIAL) return `שלמות: ${work.partialReason || `חסרות במהדורה ${work.missingUnits.length} יחידות (${work.missingUnits.join(', ')}); הטקסט לא הושלם ממהדורה אחרת.`}`;
  if (work.coverage === COVERAGE.REMOTE_ONLY) return 'שלמות: הטקסט נטען מהרשת לפי מבנה המקור.';
  return null;
}

function SourceDetails({ work }) {
  const completeness = completenessLine(work);
  return <details className="source-credit">
    <summary>פרטי מקור</summary>
    {completeness && <p>{completeness}</p>}
    {work.editions.map(edition => {
      const license = LICENSES[edition.license] || LICENSES.unknown;
      return <div key={edition.editionId}>
        <p>מהדורה: {edition.heTitle || edition.title}{edition.editor ? ` · ${edition.editor}` : ''}</p>
        <p>מקור: {edition.sourceProvider}{edition.sourceIdentifier ? ` · ${edition.sourceIdentifier}` : ''}{edition.retrievedAt && edition.retrievedAt !== 'UNKNOWN' ? ` · נשלף ${edition.retrievedAt}` : ''}</p>
        <p>רישיון: {license.title}{license.attribution && license.attribution !== 'UNKNOWN' ? ` · ${license.attribution}` : ''}</p>
        {edition.notes && <p>{edition.notes}</p>}
      </div>;
    })}
  </details>;
}

function OfflineControl({ work }) {
  const edition = work.editions[0];
  const [state, setState] = useState(() => downloadState(edition));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const license = LICENSES[edition.license];
  if (license?.offlineAllowed !== true) return <p className="notice">שמירה לקריאה ללא אינטרנט אינה זמינה עד לבירור הרישיון.</p>;
  const run = async action => { setBusy(true); setError(''); try { await action(); } catch (failure) { setError(failure.message); } finally { setState(downloadState(edition)); setBusy(false); } };
  return <div className="library-offline">
    {state === 'none' && <button type="button" disabled={busy} onClick={() => run(() => downloadEdition(edition))}>{busy ? 'מוריד…' : `הורד לקריאה ללא אינטרנט · ${sizeLabel(edition.bytes)}`}</button>}
    {state === 'outdated' && <button type="button" disabled={busy} onClick={() => run(() => downloadEdition(edition))}>עדכון העותק השמור</button>}
    {state !== 'none' && <button type="button" disabled={busy} onClick={() => run(() => removeEdition(edition))}>הסר מהמכשיר</button>}
    {state === 'current' && <small>שמור במכשיר · סימניות ומיקום אינם נמחקים בהסרה</small>}
    {error && <p className="notice error" role="alert">{error}</p>}
  </div>;
}

function BookPage({ work, go, openSource }) {
  const [personal, refresh] = usePersonal();
  const category = categoryById(work.primaryCategory);
  const edition = work.editions[0];
  const position = personal.positions[work.workId];
  const favorite = personal.favorites.includes(work.workId);
  const crumbs = [{ label: 'ספרים', onNavigate: () => go(libraryRoute.home()) }, { label: category?.title, onNavigate: () => go(libraryRoute.category(work.primaryCategory)) }, { label: work.title }];
  const openLegacy = (_, index) => openLegacyEdition(work, index, { go, openSource });
  const missing = new Set((work.missingUnits || []).map(id => Number(id.split('.').at(-2))));
  return <section className="library library-book">
    <BackNavigation label="חזרה" onClick={() => goBack(go, libraryRoute.category(work.primaryCategory))} />
    <Breadcrumbs items={crumbs} />
    <p className="eyebrow">{category?.title}</p>
    <h1>{work.title}</h1>
    <p className="intro">{[work.authors.join(' · '), work.compDate, edition.heTitle || edition.title].filter(Boolean).join(' · ')}</p>
    <div className="library-actions">
      {position && work.kind === 'pack' && <button type="button" className="resume-reading" onClick={() => go(libraryRoute.read(work.workId, position.node, position.unit))}><span>המשך</span><strong>{pointLabel(work, position.node, position.unit)}</strong><b aria-hidden="true">←</b></button>}
      <button type="button" aria-pressed={favorite} onClick={() => refresh(toggleFavorite(work.workId))}>{favorite ? '★ במועדפים' : '☆ הוספה למועדפים'}</button>
    </div>
    {work.kind === 'remote' && <button type="button" className="link" onClick={() => go(openTargetFor(work).route)}>לספר ←</button>}
    {work.kind === 'pack' && <OfflineControl work={work} />}
    {work.kind === 'pack' && <section className="library-toc" aria-label="תוכן עניינים">
      <h2 className="library-subhead">תוכן עניינים</h2>
      {edition.unitLabel === 'פסוק'
        ? <div className="chapter-grid library-chapter-grid">{edition.expected.map((_, index) => <button type="button" key={index} aria-current={position?.node === index + 1 ? 'true' : undefined} onClick={() => go(libraryRoute.read(work.workId, index + 1))}>{nodeTitle(work, index + 1)}</button>)}</div>
        : <div className="book-index">{edition.expected.map((count, index) => missing.has(index + 1) && !edition.nodes[index]
          ? <p key={index} className="library-missing">{nodeTitle(work, index + 1)} · אינו במהדורה זו</p>
          : <details key={index} className="local-book-toc" open={position?.node === index + 1}>
            <summary><LibraryRow as="span" title={nodeTitle(work, index + 1)} meta={[`${count} ${edition.unitLabel === 'משנה' ? 'משניות' : 'יחידות'}`]} /></summary>
            <div className="chapter-grid">{Array.from({ length: edition.nodes[index] }, (_, unit) => <button type="button" key={unit} onClick={() => go(libraryRoute.read(work.workId, index + 1, unit + 1))}>{edition.unitLabel} {hebrewNumeral(unit + 1)}</button>)}</div>
          </details>)}</div>}
    </section>}
    {work.kind === 'legacy' && <section className="library-toc"><h2 className="library-subhead">תוכן עניינים</h2><div className="book-index">{work.editions.map((item, index) => <LibraryRow key={item.editionId} title={work.editions.length > 1 ? `חלק ${hebrewNumeral(index + 1)}` : 'פתיחת הספר'} meta={[`${item.units} פסקאות`]} onClick={() => openLegacy(item, index)} />)}</div></section>}
    {work.kind === 'remote' && work.structureSummary && <p className="intro">{work.structureSummary}</p>}
    <SourceDetails work={work} />
  </section>;
}

function renderUnitText(text) {
  return text.split(/(\{[פס]\})/).map((part, index) => /^\{[פס]\}$/.test(part) ? <span key={index} className="library-break" aria-label={part === '{פ}' ? 'פרשה פתוחה' : 'פרשה סתומה'}>{part}</span> : part);
}

function LibraryReader({ work, node, unit, go }) {
  const edition = work.editions[0];
  const resource = useResource(() => loadEditionChunk(edition), [edition.editionId]);
  const [font, setFont] = useLocal('library-font-v1', 24);
  const [trope, setTrope] = useLocal('library-trope-v1', true);
  const [personal, refresh] = usePersonal();
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const chunk = resource.data;
  const current = chunk?.nodes.find(item => item.n === node) || null;
  const hits = useMemo(() => (chunk && query.trim().length > 1 ? searchChunk(chunk, query) : []), [chunk, query]);
  useEffect(() => { if (current) refresh(rememberPosition(work.workId, node, unit)); }, [work.workId, node, unit, Boolean(current)]);
  useEffect(() => {
    if (!current) return;
    const target = unit ? document.getElementById(`library-unit-${unit}`) : null;
    if (target) target.scrollIntoView({ block: 'center' }); else window.scrollTo({ top: 0 });
  }, [current, unit]);
  const neighbors = readerNeighbors(work, node);
  const category = categoryById(work.primaryCategory);
  const within = (target, targetUnit) => go(libraryRoute.read(work.workId, target, targetUnit), { replace: true });
  const copyReference = async () => { try { await navigator.clipboard.writeText(pointLabel(work, node, unit)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setCopied(false); } };
  return <section className="library library-reader" style={{ '--library-size': `${font}px` }}>
    <BackNavigation label="חזרה" onClick={() => goBack(go, libraryRoute.category(work.primaryCategory))} />
    <Breadcrumbs items={[{ label: 'ספרים', onNavigate: () => go(libraryRoute.home()) }, { label: category?.title, onNavigate: () => go(libraryRoute.category(work.primaryCategory)) }, { label: work.title, onNavigate: () => go(libraryRoute.work(work.workId)) }, { label: nodeTitle(work, node) }]} />
    <header className="library-reader-head">
      <h1>{work.title} · {nodeTitle(work, node)}</h1>
      <div className="reader-tools">
        <button type="button" onClick={() => setFont(size => Math.max(18, size - 2))} aria-label="הקטנת גופן">א−</button>
        <button type="button" onClick={() => setFont(size => Math.min(40, size + 2))} aria-label="הגדלת גופן">א+</button>
        {edition.policy === 'tanakh' && <button type="button" aria-pressed={trope} onClick={() => setTrope(value => !value)}>{trope ? 'טעמים מוצגים' : 'ללא טעמים'}</button>}
        <button type="button" onClick={copyReference}>{copied ? 'הועתק' : 'העתקת מראה מקום'}</button>
        <button type="button" className="link" onClick={() => go(libraryRoute.work(work.workId))}>פרטי ספר</button>
      </div>
      <ClearableInput type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={`חיפוש בתוך ${work.title}`} aria-label={`חיפוש בתוך ${work.title}`} autoComplete="off" clearLabel="נקה חיפוש בספר" />
    </header>
    <ResourceState resource={resource} />
    {query.trim().length > 1 && chunk && <section className="library-hits" aria-live="polite">
      <p className="library-subhead">{hits.length ? `${hits.length}${hits.length >= 60 ? '+' : ''} תוצאות` : 'לא נמצאו תוצאות בספר'}</p>
      {hits.map(hit => <LibraryRow key={hit.id} stacked title={`${hebrewNumeral(hit.node)}, ${hebrewNumeral(hit.unit)}`} meta={[hit.snippet]} onClick={() => { setQuery(''); within(hit.node, hit.unit); }} />)}
    </section>}
    {chunk && !current && <p className="notice">{nodeTitle(work, node)} אינו קיים במהדורה זו.</p>}
    {current && <div className="library-text" dir="rtl">{current.units.map(item => {
      const marked = isBookmarked(personal, work.workId, node, item.n);
      return <p key={item.id} id={`library-unit-${item.n}`} className={`library-unit${item.n === unit ? ' highlighted' : ''}`}>
        <button type="button" className="library-unit-n" aria-pressed={marked} aria-label={`${marked ? 'הסרת סימנייה' : 'סימנייה'} ${hebrewNumeral(item.n)}`} onClick={() => refresh(toggleBookmark(work.workId, node, item.n))}>{hebrewNumeral(item.n)}</button>
        <span>{renderUnitText(trope ? item.text : removeTrope(item.text))}</span>
      </p>;
    })}</div>}
    {current && <ReaderNavigation previous={neighbors.previous} next={neighbors.next} onSelect={item => within(item.node)} endLabel={`סוף ${work.title}`} />}
    <SourceDetails work={work} />
  </section>;
}

function ValidationLab({ go }) {
  const audit = useMemo(() => registryAudit(), []);
  const [selected, setSelected] = useState('');
  const [live, setLive] = useState(null);
  const report = IMPORT_REPORTS.reports.find(item => item.workId === selected);
  const work = selected ? workById(selected) : null;
  const revalidate = async () => {
    setLive({ state: 'running' });
    try {
      const edition = work.editions[0];
      const chunk = await loadEditionChunk(edition);
      setLive({ state: 'done', result: validateWorkChunk(chunk, edition.expected.map((units, index) => ({ n: index + 1, units }))) });
    } catch (error) { setLive({ state: 'error', error: error.message }); }
  };
  const rows = [
    ['יצירות', audit.totalWorks], ['יצירות בספרייה הציבורית', audit.publicWorks], ['מהדורות', audit.totalEditions],
    ...Object.entries(audit.byCoverage).map(([status, count]) => [status, count]),
    ['יחידות טקסט מאומתות', audit.textualUnits], ['פסקאות במאגר הקודם (לא מאומת)', audit.legacyParagraphs],
    ['יחידות חסרות', audit.missingUnits], ['מזהים כפולים', audit.duplicateIds], ['יחידות ריקות', audit.emptyUnits], ['מזהים שבורים', audit.brokenIds],
    ['רישיון לא ידוע', audit.unknownLicenses.length], ['ללא מקור', audit.missingSources.length], ['ללא מחבר רשום', audit.missingAuthors.length], ['ללא קטגוריה', audit.uncategorized.length],
    ['הבדלי מספור בין מקורות', audit.discrepancies.length],
  ];
  return <section className="library library-lab">
    <BackNavigation label="חזרה לספרים" onClick={() => go(libraryRoute.home())} />
    <h1>מעבדת אימות הספרייה</h1>
    <table className="library-lab-table"><tbody>{rows.map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>)}</tbody></table>
    <h2 className="library-subhead">דוח שלמות לספר</h2>
    <select value={selected} onChange={event => { setSelected(event.target.value); setLive(null); }} aria-label="בחירת ספר">
      <option value="">בחרו ספר</option>
      {WORKS.filter(item => item.kind === 'pack').map(item => <option key={item.workId} value={item.workId}>{item.title}</option>)}
    </select>
    {report && <table className="library-lab-table"><tbody>{[['מהדורה', report.editionId], ['צפוי', report.expectedUnits], ['יובא', report.importedUnits], ['חסר', report.missing], ['כפולים', report.duplicates], ['ריקים', report.empty], ['מזהים לא תקינים', report.invalid], ['לא צפויים', report.unexpected], ['חתימה', report.checksum], ['סטטוס', report.status]].map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>)}</tbody></table>}
    {report?.missingUnits?.length > 0 && <p className="notice">חסרים: {report.missingUnits.join(', ')}</p>}
    {work && <button type="button" onClick={revalidate}>אימות מחדש במכשיר</button>}
    {live?.state === 'running' && <p role="status">בודק…</p>}
    {live?.state === 'done' && <p role="status">תוצאה במכשיר: {live.result.status} · {live.result.importedUnits}/{live.result.expectedUnits}</p>}
    {live?.state === 'error' && <p className="notice error" role="alert">{live.error}</p>}
    <details className="source-credit"><summary>הבדלי מספור בין מקורות</summary>{audit.discrepancies.map(item => <p key={`${item.node}-${item.kind}`}>{item.node || item.workId}: {item.primary} פסוקים ב־UXLC, {item.validation} ב־{item.validationSource}. הטקסט לא שונה.</p>)}</details>
    <details className="source-credit"><summary>השוואת המשנה למאגר הקודם</summary><p>זהים: {audit.crossChecks.mishnah.identical} מתוך {audit.crossChecks.mishnah.importedUnits}. קיימים רק במאגר הקודם (ממהדורה אחרת): {audit.crossChecks.mishnah.onlyInBundled.join(', ') || 'אין'}.</p></details>
    <details className="source-credit"><summary>רישיון לא ידוע · מחוץ לספרייה הציבורית</summary><p>{audit.unknownLicenses.join(' · ')}</p></details>
    <details className="source-credit"><summary>תור רכישה והרשאות</summary>{ACQUISITION_QUEUE.map(item => <p key={item.title}><strong>{item.title}</strong> · {item.status} · {item.evidence}</p>)}</details>
  </section>;
}
