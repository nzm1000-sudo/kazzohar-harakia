import { Fragment, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { backTo } from '../services/scrollRestoration.mjs';
import { useLocal, useResource, useRouteState, useStudyTimer } from '../hooks.jsx';
import { routeParts } from '../services/safeRoute.mjs';
import { hebrewNumeral } from '../services/hebrewNumerals.mjs';
import { removeTrope } from '../hebrewText.mjs';
import { fixHebrewTypography } from '../services/hebrewTypography.mjs';
import { BackNavigation, Breadcrumbs } from '../components/LocalNavigation.jsx';
import ReaderNavigation from '../components/ReaderNavigation.jsx';
import ClearableInput from '../components/ClearableInput.jsx';
import { ResourceState } from '../components/SourceReader.jsx';
import { ACQUISITION_QUEUE, COVERAGE, IMPORT_REPORTS, LICENSES, PUBLIC_WORKS, TAXONOMY, WORKS, categoryById, registryAudit, workById, worksInCategory } from '../data/library/registry.mjs';
import { resolveLibraryReference, searchChunk, searchWorks } from '../services/library/search.mjs';
import { downloadEdition, downloadState, loadEditionChunk, packsBundledWithApp, removeEdition } from '../services/library/packs.mjs';
import { isBookmarked, readPersonal, rememberPosition, toggleBookmark, toggleFavorite } from '../services/library/personal.mjs';
import { validateWorkChunk } from '../services/library/integrity.mjs';
import { tocGroups } from '../services/library/toc.mjs';
import HeartToggle, { HeartIcon } from '../components/HeartToggle.jsx';
import { routeFavorite } from '../services/favorites.mjs';
import { parashotOf } from '../services/parashot.mjs';
import { amudCell, paginationNodes } from '../services/library/pagination.mjs';
import { NO_TRANSLATION_NOTICE, groupByVerse, isParallel, layerTabNames, layersAt, layersOf, loadLayerUnits, loadRemoteLayerUnits } from '../services/library/relations.mjs';

// Routes: books | books/c/<category> | books/w/<work> | books/r/<work>/<node>[/<unit>] | books/lab
export function parseLibraryRoute(mode) {
  const [, view, id, node, unit] = routeParts(mode);
  if (view === 'c') return { view: 'category', id };
  if (view === 'w') return { view: 'work', id };
  if (view === 'r') return { view: 'read', id, node: Number(node) || 1, unit: Number(unit) || null };
  if (view === 'p') return { view: 'parasha', id, parasha: node };
  if (view === 'lab') return { view: 'lab' };
  return { view: 'home' };
}
export const libraryRoute = {
  home: () => 'books',
  category: id => `books/c/${encodeURIComponent(id)}`,
  work: id => `books/w/${encodeURIComponent(id)}`,
  read: (id, node, unit) => `books/r/${encodeURIComponent(id)}/${node}${unit ? `/${unit}` : ''}`,
  parasha: (id, parasha) => `books/p/${encodeURIComponent(id)}/${encodeURIComponent(parasha)}`,
  lab: () => 'books/lab',
};

const rangeLabel = parasha => `${hebrewNumeral(parasha.from[0])}, ${hebrewNumeral(parasha.from[1])} – ${hebrewNumeral(parasha.to[0])}, ${hebrewNumeral(parasha.to[1])}`;

const STATUS_LABEL = { FULL: 'מלא · נבדק', PARTIAL: 'חלקי', REMOTE_ONLY: 'מקוון', METADATA_ONLY: 'פרטים בלבד', SCAN_ONLY: 'סריקה בלבד', UNAVAILABLE: 'לא זמין' };
const sizeLabel = bytes => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
// Books with named parts (הקדמה, שער, פרשה…) carry a title for every node; others number their chapters.
export const nodeTitle = (work, node) => work.editions[0].nodeTitles?.[node - 1] || `${work.editions[0].nodeLabel || 'חלק'} ${hebrewNumeral(node)}`;
export const pointLabel = (work, node, unit) => (work.editions[0].nodeTitles
  ? `${work.title} · ${nodeTitle(work, node)}${unit ? `, ${hebrewNumeral(unit)}` : ''}`
  : `${work.title} ${hebrewNumeral(node)}${unit ? `, ${hebrewNumeral(unit)}` : ''}`);
const UNIT_PLURAL = { משנה: 'משניות', פסקה: 'פסקאות', סעיף: 'סעיפים', 'סעיף קטן': 'סעיפים קטנים', הלכה: 'הלכות', פסוק: 'פסוקים', סימן: 'סימנים', אות: 'אותיות', מצוה: 'מצוות', תשובה: 'תשובות', קטע: 'קטעים', ערך: 'ערכים', מאמר: 'מאמרים', ענין: 'ענינים', מדרש: 'מדרשים' };
const unitCount = (count, label) => `${count} ${UNIT_PLURAL[label] || 'יחידות'}`;

const rowTitle = (work, node, heading) => { const title = nodeTitle(work, node); return heading && title.startsWith(`${heading} · `) ? title.slice(heading.length + 3) : title; };

export function readerNeighbors(work, node) {
  const edition = work.editions[0];
  const total = edition.expected.length;
  const step = n => (n >= 1 && n <= total ? { title: nodeTitle(work, n), node: n } : null);
  if (!edition.pagination) return { previous: step(node - 1), next: step(node + 1) };
  // A book by printed pages steps over pages with no text (title pages; pages a commentary does not reach).
  const find = (from, by) => { for (let n = from; n >= 1 && n <= total; n += by) if (edition.nodes[n - 1]) return step(n); return null; };
  return { previous: find(node - 1, -1), next: find(node + 1, 1) };
}

// The part (parasha) a printed page belongs to: "חלק א · בראשית" → "פרשת בראשית".
export function sectionLabel(work, node) {
  const section = work.editions[0].sections?.find(item => node >= item.from && node <= item.to);
  const name = section?.title.split(' · ').at(-1);
  if (!name) return null;
  return /^(?:הקדמ|ספרא|אדרא|השמטות)/.test(name) ? name : `פרשת ${name}`;
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

// One tap: books with chapters open their chapter list; other books open directly.
function WorkRow({ work, short = false }) {
  const { openWork, go } = useContext(LibraryNav);
  return <LibraryRow title={short && work.shortTitle ? work.shortTitle : work.title} onClick={() => (work.kind === 'pack' ? go(libraryRoute.work(work.workId)) : openWork(work))} />;
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

export default function LibraryPage({ route, go, openSource, tzid = 'Asia/Jerusalem' }) {
  const openWork = target => {
    const destination = openTargetFor(target);
    if (destination.legacyIndex !== undefined) openLegacyEdition(target, destination.legacyIndex, { go, openSource });
    else go(destination.route);
  };
  return <LibraryNav.Provider value={{ go, openSource, openWork, tzid }}><LibraryView route={route} go={go} openSource={openSource} /></LibraryNav.Provider>;
}

function LibraryView({ route, go, openSource }) {
  const work = route.id && route.view !== 'category' ? workById(route.id) : null;
  if (route.view === 'category') return <CategoryPage category={categoryById(route.id)} go={go} />;
  if (import.meta.env?.DEV && route.view === 'lab') return <ValidationLab go={go} />;
  if ((route.view === 'work' || route.view === 'read' || route.view === 'parasha') && !work?.public) return <section className="library"><BackNavigation label="חזרה לספרים" onClick={() => go(libraryRoute.home())} /><p className="notice">הספר אינו זמין בספרייה.</p></section>;
  if (route.view === 'work') return <BookPage work={work} go={go} openSource={openSource} />;
  if (route.view === 'read') return work.kind === 'pack' ? <LibraryReader work={work} node={route.node} unit={route.unit} go={go} /> : <BookPage work={work} go={go} openSource={openSource} />;
  if (route.view === 'parasha') { const parasha = parashotOf(work.workId).find(item => item.id === route.parasha); return work.kind === 'pack' && parasha ? <LibraryReader work={work} node={parasha.from[0]} parasha={parasha} go={go} /> : <BookPage work={work} go={go} openSource={openSource} />; }
  return <LibraryHome go={go} />;
}

function LibraryHome({ go }) {
  const { openWork } = useContext(LibraryNav);
  const [query, setQuery] = useRouteState('library-query', '');
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
      {recent.length > 0 && <section><h2 className="library-subhead">המשך לקרוא</h2><div className="book-index">{recent.slice(0, 1).map(item => <button type="button" key={item.workId} className="resume-reading" onClick={() => openRecent(item)}><span>המשך</span><strong>{item.work.kind === 'pack' ? pointLabel(item.work, item.node, personal.positions[item.workId]?.unit) : item.work.title}</strong><b aria-hidden="true">←</b></button>)}</div></section>}
      <section><h2 className="library-subhead">קטגוריות</h2><div className="library-categories">{TAXONOMY.map(category => ({ category, count: worksInCategory(category.id).length })).filter(item => item.count).map(({ category, count }) => <button type="button" key={category.id} className="library-category" onClick={() => go(libraryRoute.category(category.id))}><strong>{category.title}</strong><small>{count}</small></button>)}</div></section>
      {favorites.length > 0 && <section><h2 className="library-subhead">מועדפים</h2><div className="book-index">{favorites.map(item => <WorkRow key={item.workId} work={item} />)}</div></section>}
      {!packsBundledWithApp() && downloaded.length > 0 && <section><h2 className="library-subhead">שמורים במכשיר</h2><div className="book-index">{downloaded.map(item => <WorkRow key={item.workId} work={item} />)}</div></section>}
      {import.meta.env?.DEV && <details className="source-credit"><summary>על הספרייה</summary><p>ספר מסומן „מלא · נבדק” רק לאחר בדיקה שכל יחידות הטקסט במהדורה קיימות, ייחודיות ואינן ריקות. מידע על המהדורה, המקור והרישיון מופיע בכל ספר באזור המידע על המקור.</p><button type="button" className="link" onClick={() => go(libraryRoute.lab())}>מעבדת אימות הספרייה</button></details>}
    </>}
  </section>;
}

function CategoryPage({ category, go }) {
  const [query, setQuery] = useRouteState('category-query', '');
  if (!category) return <section className="library"><BackNavigation label="חזרה לספרים" onClick={() => go(libraryRoute.home())} /><p className="notice">הקטגוריה לא נמצאה.</p></section>;
  let works = worksInCategory(category.id);
  if (query.trim()) works = searchWorks(query, works).map(item => item.work);
  const groups = category.groups.length && !query.trim()
    ? [...category.groups.map(([id, title]) => ({ id, title, works: works.filter(work => work.primaryCategory === category.id && work.group === id) })), { id: 'other', title: 'נוספים', works: works.filter(work => work.primaryCategory !== category.id || !category.groups.some(([id]) => id === work.group)) }]
    : [{ id: 'all', title: null, works }];
  return <section className="library">
    <BackNavigation label="חזרה לספרים" onClick={() => backTo(libraryRoute.home(), () => go(libraryRoute.home()))} />
    <Breadcrumbs items={[{ label: 'ספרים', onNavigate: () => backTo(libraryRoute.home(), () => go(libraryRoute.home())) }, { label: category.title }]} />
    <h1>{category.title}</h1>
    <div className="library-filters">
      <ClearableInput type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={`חיפוש ב${category.title}`} aria-label={`חיפוש ב${category.title}`} autoComplete="off" clearLabel="נקה חיפוש בקטגוריה" />
    </div>
    {groups.filter(group => group.works.length).map(group => <section key={group.id} className="library-group">
      {group.title && <h2 className="library-subhead">{group.title}</h2>}
      <div className="book-index">{group.works.map(work => <WorkRow key={work.workId} work={work} short={work.primaryCategory === category.id} />)}</div>
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
  // Metadata is preserved internally for future use; user-facing details hidden per policy
  return null;
}

function OfflineControl({ work }) {
  const edition = work.editions[0];
  const [state, setState] = useState(() => downloadState(edition));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const license = LICENSES[edition.license];
  if (license?.offlineAllowed !== true) return <p className="notice">שמירה לקריאה ללא אינטרנט אינה זמינה עד לבירור הרישיון.</p>;
  if (packsBundledWithApp()) return <div className="library-offline"><small>זמין במכשיר גם ללא אינטרנט</small></div>;
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
  const edition = work.editions[0];
  const position = personal.positions[work.workId];
  const favorite = personal.favorites.includes(work.workId);
  const openLegacy = (_, index) => openLegacyEdition(work, index, { go, openSource });
  const missing = new Set((work.missingUnits || []).map(id => Number(id.split('.').at(-2))));
  return <section className="library library-book">
    <BackNavigation label="חזרה" onClick={() => goBack(go, libraryRoute.category(work.primaryCategory))} />
    <h1>{work.title}</h1>
    <div className="library-actions">
      {position && work.kind === 'pack' && <button type="button" className="resume-reading" onClick={() => go(libraryRoute.read(work.workId, position.node, position.unit))}><span>המשך</span><strong>{pointLabel(work, position.node, position.unit)}</strong><b aria-hidden="true">←</b></button>}
      <button type="button" className="library-favorite" aria-pressed={favorite} onClick={() => refresh(toggleFavorite(work.workId))}><HeartIcon filled={favorite} />{favorite ? 'בספרים המועדפים' : 'הוספה לספרים המועדפים'}</button>
    </div>
    {work.kind === 'remote' && <button type="button" className="link" onClick={() => go(openTargetFor(work).route)}>לספר ←</button>}
    {work.kind === 'pack' && (work.editions[0].pagination ? <PageToc work={work} position={position} go={go} /> : <TorahDivision work={work} position={position} missing={missing} go={go} />)}
    {work.kind === 'legacy' && <section className="library-toc"><h2 className="library-subhead">תוכן עניינים</h2><div className="book-index">{work.editions.map((item, index) => <LibraryRow key={item.editionId} title={work.editions.length > 1 ? `חלק ${hebrewNumeral(index + 1)}` : 'פתיחת הספר'} meta={[`${item.units} פסקאות`]} onClick={() => openLegacy(item, index)} />)}</div></section>}
    {work.kind === 'remote' && work.structureSummary && <p className="intro">{work.structureSummary}</p>}
    <SourceDetails work={work} />
  </section>;
}

const NODE_PLURAL = { פרק: 'פרקים', סימן: 'סימנים', דף: 'דפים', כלל: 'כללים', שער: 'שערים', מאמר: 'מאמרים', נהר: 'נהרות', פרשה: 'פרשיות', ערך: 'ערכים', מצוה: 'מצוות', הלכה: 'הלכות', משנה: 'משניות', תשובה: 'תשובות', חלק: 'חלקים', אות: 'אותיות', עיקר: 'עיקרים', מזמור: 'מזמורים', קטע: 'קטעים', שורש: 'שורשים', מדרש: 'מדרשים' };
// "סימן א׳", "פרק קכ״ג": a numbered node, shown in a grid by its numeral alone. Named nodes (הקדמה, נח) stay rows.
function numberedTitle(title) {
  const cut = title.lastIndexOf(' ');
  const numeral = cut < 0 ? '' : title.slice(cut + 1);
  return /^[א-ת]{1,4}[׳״][א-ת]?$/.test(numeral) ? { name: title.slice(0, cut), numeral } : null;
}
// Consecutive numbered nodes form one grid; named nodes form one list — so a part reads "הקדמה" then its סימנים.
function tocRuns(items) {
  const runs = [];
  for (const item of items) {
    const kind = item.numbered ? 'grid' : 'list';
    const last = runs.at(-1);
    if (last && last.kind === kind && (kind === 'list' || last.name === item.numbered.name)) last.items.push(item);
    else runs.push({ kind, name: item.numbered?.name || null, items: [item] });
  }
  return runs;
}

// "סימנים · 697" for a plain run; a run nested under a named part ("הסכמות · פרק") is captioned by that part alone.
function runCaption(run) {
  const cut = run.name.lastIndexOf(' · ');
  if (cut >= 0) return run.name.slice(0, cut);
  return `${NODE_PLURAL[run.name] || run.name} · ${run.items.length}`;
}

// A book's contents, the same for every book: numbered sections as an even grid, named ones as a list, a book in
// several parts as folding cards (the part being read opens by itself). Parts missing from the edition stay visible
// but quiet: a faded cell in a grid, one line under a list.
function BookToc({ work, position, missing, go }) {
  const edition = work.editions[0];
  const open = node => go(libraryRoute.read(work.workId, node));
  const groups = tocGroups(edition).map(group => {
    const items = group.nodes.map(node => {
      const title = rowTitle(work, node, group.heading);
      return { node, title, numbered: numberedTitle(title), missing: missing.has(node) && !edition.nodes[node - 1], count: edition.expected[node - 1] };
    });
    return { ...group, items, runs: tocRuns(items) };
  });
  const renderRuns = runs => runs.map((run, i) => {
    if (run.kind === 'grid') return <div key={i} className="library-toc-run">
      {(run.name && (runs.length > 1 || groups.length === 1)) && <p className="library-toc-caption">{runCaption(run)}</p>}
      <div className="library-grid">{run.items.map(item => <button type="button" key={item.node} disabled={item.missing} aria-current={position?.node === item.node ? 'true' : undefined} aria-label={item.missing ? `${item.title} · אינו במהדורה זו` : item.title} onClick={() => open(item.node)}>{item.numbered.numeral}</button>)}</div>
    </div>;
    const present = run.items.filter(item => !item.missing);
    const absent = run.items.filter(item => item.missing);
    return <div key={i} className="library-toc-run">
      {present.length > 0 && <div className="library-list">{present.map(item => <LibraryRow key={item.node} title={item.title} meta={[item.count > 1 ? unitCount(item.count, edition.unitLabel) : null]} aria-current={position?.node === item.node ? 'true' : undefined} onClick={() => open(item.node)} />)}</div>}
      {absent.length > 0 && <p className="library-toc-absent">לא במהדורה זו: {absent.map(item => item.title).join(' · ')}</p>}
    </div>;
  });
  if (groups.length === 1) return <section className="library-toc" aria-label="תוכן עניינים">{renderRuns(groups[0].runs)}</section>;
  const current = groups.findIndex(group => group.nodes.includes(position?.node));
  return <section className="library-toc" aria-label="תוכן עניינים">{groups.map((group, g) => group.heading
    ? <details key={g} className="library-part" open={current >= 0 ? current === g : groups.findIndex(item => item.heading) === g}>
      <summary><strong>{group.heading}</strong>{group.runs.some(run => run.kind === 'grid') && <small>{group.items.filter(item => !item.missing).length}</small>}<span className="library-part-chevron" aria-hidden="true">›</span></summary>
      <div className="library-part-body">{renderRuns(group.runs)}</div>
    </details>
    : <div key={g} className="library-part-loose">{renderRuns(group.runs)}</div>)}</section>;
}

// A book by printed pages (the Zohar and its commentaries): each volume folds open to its parashot, each parasha an
// even grid of pages (ט״ו. = amud a, ט״ו: = amud b). A commentary lists only the pages it reaches; pages without text
// in the print stay visible but quiet. Addenda follow as rows.
function PageToc({ work, position, go }) {
  const edition = work.editions[0];
  const pages = paginationNodes(edition.pagination);
  const counts = edition.nodes;
  const sparse = Boolean(work.relation);
  const open = node => go(libraryRoute.read(work.workId, node));
  const currentVolume = pages[(position?.node || 1) - 1]?.volume || 1;
  const volumes = edition.pagination.volumes.map(volume => {
    const groups = (edition.sections || [])
      .filter(section => section.title.startsWith(`${volume.title} · `))
      .map(section => ({ title: section.title.slice(volume.title.length + 3), items: pages.slice(section.from - 1, section.to).filter(page => !sparse || counts[page.node - 1]) }))
      .filter(group => group.items.length);
    return { volume, groups, total: groups.reduce((sum, group) => sum + group.items.filter(page => counts[page.node - 1]).length, 0) };
  }).filter(item => item.groups.length);
  const extras = pages.filter(page => !page.volume && counts[page.node - 1]);
  return <section className="library-toc library-page-toc" aria-label="תוכן עניינים">
    {volumes.map(({ volume, groups, total }) => <details key={volume.n} className="library-part" open={volume.n === currentVolume}>
      <summary><strong>{volume.title}</strong><small>{total}</small><span className="library-part-chevron" aria-hidden="true">›</span></summary>
      <div className="library-part-body">{groups.map(group => <div key={group.title} className="library-toc-run">
        <p className="library-toc-caption">{group.title}</p>
        <div className="library-grid library-page-grid">{group.items.map(page => <button type="button" key={page.node} disabled={!counts[page.node - 1]} aria-current={position?.node === page.node ? 'true' : undefined} aria-label={counts[page.node - 1] ? page.title : `${page.title} · אין בו טקסט`} onClick={() => open(page.node)}>{amudCell(page)}</button>)}</div>
      </div>)}</div>
    </details>)}
    {extras.length > 0 && <div className="library-part-loose"><div className="library-list">{extras.map(page => <LibraryRow key={page.node} title={page.title} meta={[unitCount(counts[page.node - 1], edition.unitLabel)]} onClick={() => open(page.node)} />)}</div></div>}
  </section>;
}

// A book of the Torah can be read by chapters or by the weekly portions: one quiet switch above the contents.
function TorahDivision({ work, position, missing, go }) {
  const parashot = parashotOf(work.workId);
  const [mode, setMode] = useLocal('torah-division-v1', 'chapters');
  if (!parashot.length) return <BookToc work={work} position={position} missing={missing} go={go} />;
  return <>
    <div className="seg library-division" role="tablist" aria-label="חלוקת הספר">
      <button type="button" role="tab" aria-selected={mode === 'chapters'} className={mode === 'chapters' ? 'on' : ''} onClick={() => setMode('chapters')}>לפי פרקים</button>
      <button type="button" role="tab" aria-selected={mode === 'parashot'} className={mode === 'parashot' ? 'on' : ''} onClick={() => setMode('parashot')}>לפי פרשות</button>
    </div>
    {mode === 'parashot'
      ? <section className="library-toc" aria-label="פרשות"><div className="parasha-grid">{parashot.map(parasha => <button type="button" key={parasha.id} aria-label={`${parasha.title}, ${rangeLabel(parasha)}`} onClick={() => go(libraryRoute.parasha(work.workId, parasha.id))}><strong>{parasha.he}</strong><small>{rangeLabel(parasha)}</small></button>)}</div></section>
      : <BookToc work={work} position={position} missing={missing} go={go} />}
  </>;
}

// Te'amim shown in their own colour: the verse is drawn twice in the same place — with its te'amim in the accent colour
// underneath, and without them in the text colour on top — so letters and nikud keep the ink and only the te'amim change.
function TropeText({ text, trope, tinted }) {
  if (!trope) return renderUnitText(removeTrope(text));
  if (!tinted) return renderUnitText(text);
  return <span className="trope-duo"><span className="trope-duo-marks" aria-hidden="true">{renderUnitText(text)}</span><span className="trope-duo-letters">{renderUnitText(removeTrope(text))}</span></span>;
}

// A book printed with titled, multi-paragraph halachot and footnote numbers (עונג שבת): the halacha's title on its own
// line, the printed page beside it, its paragraphs as printed (sub-headings in bold, emphasised lines semi-bold), and each
// footnote number where the book prints it — the note itself is in the "מקורות וטעמים" tab.
export const isRichUnit = item => Boolean(item.title || item.fn || item.sh || item.em || item.text.includes('\n'));
export function unitParagraphs(item) {
  const marks = [...(item.fn || [])].sort((a, b) => a[1] - b[1]);
  const out = [];
  let start = 0;
  item.text.split('\n').forEach((text, index) => {
    const end = start + text.length;
    const parts = [];
    let cursor = start;
    // Offsets count the whole text (paragraph breaks included); a number printed at a paragraph's end stays with it.
    for (const [n, at] of marks.filter(([, at]) => at >= start && at <= end)) { parts.push({ text: item.text.slice(cursor, at) }, { note: n }); cursor = at; }
    parts.push({ text: item.text.slice(cursor, end) });
    out.push({ kind: (item.sh || []).includes(index) ? 'sub' : (item.em || []).includes(index) ? 'em' : 'p', parts: parts.filter(part => part.note || part.text) });
    start = end + 1;
  });
  return out;
}
const labelNumeral = label => label ? label.replace(/'/g, '׳').replace(/"/g, '״') : null;
function RichUnitText({ item }) {
  return <>
    {item.title && <span className="library-unit-title">{fixHebrewTypography(item.title)}{item.p?.length ? <small className="library-unit-page" aria-label={`עמוד ${item.p[0]} בספר`}>עמ׳ {item.p[0]}</small> : null}</span>}
    {unitParagraphs(item).map((para, index) => <span key={index} className={`library-para library-para-${para.kind}`}>{para.parts.map((part, k) => part.note ? <sup key={k} className="library-fn" aria-label={`הערה ${part.note}`}>{part.note}</sup> : <Fragment key={k}>{fixHebrewTypography(part.text)}</Fragment>)}</span>)}
  </>;
}

function renderUnitText(text) {
  return fixHebrewTypography(text).split(/(\{[פס]\})/).map((part, index) => /^\{[פס]\}$/.test(part) ? <span key={index} className="library-break" aria-label={part === '{פ}' ? 'פרשה פתוחה' : 'פרשה סתומה'}>{part}</span> : part);
}

function LibraryReader({ work, node, unit, go, parasha = null }) {
  const edition = work.editions[0];
  const resource = useResource(() => loadEditionChunk(edition), [edition.editionId]);
  const [font, setFont] = useLocal('library-font-v1', 24);
  const [trope, setTrope] = useLocal('library-trope-v1', true);
  const [tinted, setTinted] = useLocal('library-trope-tint-v1', false);
  const [personal, refresh] = usePersonal();
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [layerTab, setLayerTab] = useState('source');
  const chunk = resource.data;
  // Translation and commentaries of this page, known from the registry's page index (nothing is loaded to decide).
  const layered = useMemo(() => Boolean(work.translationSought) || layersOf(work.workId).length > 0, [work.workId]);
  const here = useMemo(() => (layered && !parasha ? layersAt(work.workId, node) : []), [layered, work.workId, node, parasha]);
  const translations = here.filter(layer => layer.relationType === 'translation');
  const parallels = here.filter(isParallel);
  const commentaries = here.filter(layer => layer.relationType !== 'translation' && !isParallel(layer));
  const tab = (layerTab === 'translation' && translations.length) || (layerTab === 'commentary' && commentaries.length) || (layerTab === 'parallel' && parallels.length) ? layerTab : 'source';
  const tabNames = layerTabNames(work);
  // A verse (mishnah) in the address narrows the commentaries to it; the whole chapter is one tap away.
  const verseFocus = unit && here.some(layer => layer.work.relation.anchorScheme === 'sefaria-ref') ? unit : null;
  const baseUnitLabel = edition.unitLabel || 'פסוק';
  // Reading a commentary as a book: its comments sit under the verse they explain, which opens in the base text.
  const commentaryOf = work.relation?.anchorScheme === 'sefaria-ref' ? workById(work.relation.baseWorkId) : null;
  const onPage = !parasha && node >= 1 && node <= edition.expected.length;
  const current = chunk?.nodes.find(item => item.n === node) || null;
  // A weekly portion: its verses across chapters, from its first verse to its last.
  const portion = useMemo(() => {
    if (!parasha || !chunk) return null;
    const [fromNode, fromUnit] = parasha.from; const [toNode, toUnit] = parasha.to;
    return chunk.nodes.filter(item => item.n >= fromNode && item.n <= toNode).map(item => ({ n: item.n, units: item.units.filter(u => (item.n > fromNode || u.n >= fromUnit) && (item.n < toNode || u.n <= toUnit)) }));
  }, [parasha, chunk]);
  // Invisible study time (60s minimum, pauses in background/idle) — the same timer SourceReader uses.
  const { tzid } = useContext(LibraryNav) || {};
  const { recordInteraction } = useStudyTimer({ workId: work.workId, workTitle: work.title, unitId: String(node), unitLabel: nodeTitle(work, node), category: 'torah_study', source: 'library-reader', tzid: tzid || 'Asia/Jerusalem', enabled: Boolean(current) });
  useEffect(() => {
    if (!current) return undefined;
    const onScroll = () => recordInteraction();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [Boolean(current), recordInteraction]);
  const hits = useMemo(() => (chunk && query.trim().length > 1 ? searchChunk(chunk, query) : []), [chunk, query]);
  useEffect(() => { if (current && !parasha) refresh(rememberPosition(work.workId, node, unit)); }, [work.workId, node, unit, Boolean(current)]);
  useEffect(() => {
    if (!current) return;
    const target = unit ? document.getElementById(`library-unit-${unit}`) : null;
    if (target) target.scrollIntoView({ block: 'center' }); else window.scrollTo({ top: 0 });
  }, [current, unit]);
  const parashot = parasha ? parashotOf(work.workId) : [];
  const parashaIndex = parasha ? parashot.findIndex(item => item.id === parasha.id) : -1;
  const neighbors = parasha
    ? { previous: parashot[parashaIndex - 1] ? { ...parashot[parashaIndex - 1], label: parashot[parashaIndex - 1].title } : null, next: parashot[parashaIndex + 1] ? { ...parashot[parashaIndex + 1], label: parashot[parashaIndex + 1].title } : null }
    : readerNeighbors(work, node);
  const heading = parasha ? parasha.title : nodeTitle(work, node);
  const category = categoryById(work.primaryCategory);
  const within = (target, targetUnit) => go(libraryRoute.read(work.workId, target, targetUnit), { replace: true });
  const copyReference = async () => { try { await navigator.clipboard.writeText(pointLabel(work, node, unit)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setCopied(false); } };
  return <section className="library library-reader" style={{ '--library-size': `${font}px` }}>
    <BackNavigation label="חזרה" onClick={() => goBack(go, libraryRoute.category(work.primaryCategory))} />
    <Breadcrumbs items={[{ label: 'ספרים', onNavigate: () => go(libraryRoute.home()) }, { label: category?.title, onNavigate: () => go(libraryRoute.category(work.primaryCategory)) }, { label: work.title, onNavigate: () => go(libraryRoute.work(work.workId)) }, { label: heading }]} />
    <header className="library-reader-head">
      <div className="reader-title-row"><h1>{parasha ? heading : `${work.title} · ${heading}`}</h1><HeartToggle item={routeFavorite('library', parasha ? libraryRoute.parasha(work.workId, parasha.id) : libraryRoute.read(work.workId, node), parasha ? `${heading} · ${work.title}` : `${work.title} · ${heading}`)} /></div>
      {parasha && <p className="library-parasha-range">{work.title} {rangeLabel(parasha)}</p>}
      {!parasha && edition.pagination && sectionLabel(work, node) && <p className="library-parasha-range">{sectionLabel(work, node)}</p>}
      <div className="reader-tools">
        <button type="button" onClick={() => setFont(size => Math.max(18, size - 2))} aria-label="הקטנת גופן">א−</button>
        <button type="button" onClick={() => setFont(size => Math.min(40, size + 2))} aria-label="הגדלת גופן">א+</button>
        {edition.policy === 'tanakh' && <span className="seg trope-seg" role="radiogroup" aria-label="טעמי המקרא">
          <button type="button" role="radio" aria-checked={trope} className={trope ? 'on' : ''} onClick={() => setTrope(true)}>עם טעמים</button>
          <button type="button" role="radio" aria-checked={!trope} className={!trope ? 'on' : ''} onClick={() => setTrope(false)}>ללא טעמים</button>
        </span>}
        {edition.policy === 'tanakh' && trope && <button type="button" className="trope-tint-toggle" aria-pressed={tinted} onClick={() => setTinted(value => !value)}><span className="trope-tint-dot" aria-hidden="true" />גוון נוסף</button>}
        <button type="button" onClick={copyReference}>{copied ? 'הועתק' : 'העתקת מראה מקום'}</button>
      </div>
      <ClearableInput type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={`חיפוש בתוך ${work.title}`} aria-label={`חיפוש בתוך ${work.title}`} autoComplete="off" clearLabel="נקה חיפוש בספר" />
    </header>
    <ResourceState resource={resource} />
    {query.trim().length > 1 && chunk && <section className="library-hits" aria-live="polite">
      <p className="library-subhead">{hits.length ? `${hits.length}${hits.length >= 60 ? '+' : ''} תוצאות` : 'לא נמצאו תוצאות בספר'}</p>
      {hits.map(hit => <LibraryRow key={hit.id} stacked title={edition.pagination ? `${nodeTitle(work, hit.node)}, ${hebrewNumeral(hit.unit)}` : `${hebrewNumeral(hit.node)}, ${hebrewNumeral(hit.unit)}`} meta={[hit.snippet]} onClick={() => { setQuery(''); within(hit.node, hit.unit); }} />)}
    </section>}
    {chunk && !current && !parasha && <p className="notice">{nodeTitle(work, node)} אינו קיים במהדורה זו.</p>}
    {portion && <div className="library-text library-portion" dir="rtl">{portion.map(chapter => <div key={chapter.n} className="library-portion-chapter">
      <p className="library-chapter-mark" aria-label={`פרק ${hebrewNumeral(chapter.n)}`}><span>פרק {hebrewNumeral(chapter.n)}</span></p>
      {chapter.units.map(item => <p key={item.id} id={`library-unit-${chapter.n}-${item.n}`} className="library-unit">
        <span className="library-unit-n library-unit-n--static">{hebrewNumeral(item.n)}</span>
        <span><TropeText text={item.text} trope={trope} tinted={tinted} /></span>
      </p>)}
    </div>)}</div>}
    {portion && <ReaderNavigation previous={neighbors.previous} next={neighbors.next} onSelect={item => go(libraryRoute.parasha(work.workId, item.id), { replace: true })} endLabel={`סוף ${work.title}`} />}
    {onPage && (translations.length > 0 || commentaries.length > 0 || parallels.length > 0) && <div className="seg library-layer-tabs" role="tablist" aria-label={[tabNames.source, translations.length && tabNames.translation, commentaries.length && tabNames.commentary, parallels.length && tabNames.parallel].filter(Boolean).join(', ')}>
      <button type="button" role="tab" aria-selected={tab === 'source'} className={tab === 'source' ? 'on' : ''} onClick={() => setLayerTab('source')}>{tabNames.source}</button>
      {translations.length > 0 && <button type="button" role="tab" aria-selected={tab === 'translation'} className={tab === 'translation' ? 'on' : ''} onClick={() => setLayerTab('translation')}>{tabNames.translation}</button>}
      {commentaries.length > 0 && <button type="button" role="tab" aria-selected={tab === 'commentary'} className={tab === 'commentary' ? 'on' : ''} onClick={() => setLayerTab('commentary')}>{tabNames.commentary}</button>}
      {parallels.length > 0 && <button type="button" role="tab" aria-selected={tab === 'parallel'} className={tab === 'parallel' ? 'on' : ''} onClick={() => setLayerTab('parallel')}>{tabNames.parallel}</button>}
    </div>}
    {onPage && work.translationSought && !translations.length && <p className="library-layer-note">{NO_TRANSLATION_NOTICE}</p>}
    {!parasha && current && tab === 'source' && <div className="library-text" dir="rtl">{current.units.map((item, index) => {
      const marked = isBookmarked(personal, work.workId, node, item.n);
      const verseHead = commentaryOf && item.v && item.v !== current.units[index - 1]?.v;
      return <Fragment key={item.id}>
        {item.head && <p className="library-stream-head">{item.head}</p>}
        {verseHead && <p className="library-stream-head library-verse-head"><button type="button" onClick={() => go(libraryRoute.read(commentaryOf.workId, node, item.v))} aria-label={`${commentaryOf.title} ${hebrewNumeral(node)}, ${hebrewNumeral(item.v)}`}>{edition.baseUnitLabel || 'פסוק'} {hebrewNumeral(item.v)}</button></p>}
        <p id={`library-unit-${item.n}`} className={`library-unit${item.n === unit ? ' highlighted' : ''}${isRichUnit(item) ? ' library-unit-rich' : ''}`}>
          <button type="button" className="library-unit-n" aria-pressed={marked} aria-label={`${marked ? 'הסרת סימנייה' : 'סימנייה'} ${labelNumeral(item.label) || hebrewNumeral(item.n)}`} onClick={() => refresh(toggleBookmark(work.workId, node, item.n))}>{labelNumeral(item.label) || hebrewNumeral(item.n)}</button>
          <span>{isRichUnit(item) ? <RichUnitText item={item} /> : <>{item.dh && <><strong className="library-dh">{fixHebrewTypography(item.dh)}</strong> </>}<TropeText text={item.text} trope={trope} tinted={tinted} /></>}</span>
        </p>
      </Fragment>;
    })}</div>}
    {onPage && tab === 'commentary' && verseFocus && <p className="library-verse-focus">{tabNames.commentary} על {baseUnitLabel} {hebrewNumeral(verseFocus)} · <button type="button" onClick={() => within(node)}>כל הפרק</button></p>}
    {onPage && tab !== 'source' && <div className="library-layers">{(tab === 'translation' ? translations : tab === 'parallel' ? parallels : commentaries).map(layer => <LayerSection key={layer.work.workId} layer={layer} node={node} verse={tab === 'commentary' ? verseFocus : null} unitLabel={baseUnitLabel} />)}</div>}
    {!parasha && current && <ReaderNavigation previous={neighbors.previous} next={neighbors.next} onSelect={item => within(item.node)} endLabel={`סוף ${work.title}`} />}
    {edition.attribution && <AttributionLine edition={edition} />}
    <SourceDetails work={work} />
  </section>;
}

// Share-alike texts name their source and licence where they are read (the licence covers these texts only). A work
// used by its author's permission carries its credit line alone ("באישור המחבר, כל הזכויות שמורות"): no licence link.
function AttributionLine({ edition }) {
  const { text, licenseUrl, url } = edition.attribution;
  return <p className="source-credit library-credit">{text}{licenseUrl && <> · <a href={licenseUrl} target="_blank" rel="noreferrer">תנאי הרישיון</a></>}{url && <> · <a href={url} target="_blank" rel="noreferrer">המקור</a></>}</p>;
}

// One translation or commentary on the page being read: bundled layers from their pack, remote ones live from the
// provider in their registered edition. The text is shown as the edition has it; nothing is filled in. A commentary on
// a verse text is grouped under the verse (mishnah) it explains; with a verse in focus only that verse is shown, and a
// commentator with nothing on it steps aside.
export function LayerSection({ layer, node, verse = null, unitLabel = 'פסוק' }) {
  const work = layer.work;
  const resource = useResource(() => (layer.remote ? loadRemoteLayerUnits(layer, node) : loadLayerUnits(layer)), [work.workId, node]);
  const edition = work.editions[0];
  const units = resource.data && verse ? resource.data.filter(item => item.v === verse) : resource.data;
  if (units && !units.length && verse) return null;
  const groups = units ? groupByVerse(units) : [];
  const byVerse = groups.some(group => group.v);
  return <section className="library-layer" aria-label={work.title}>
    <h2 className="library-layer-title">{work.layerTitle || work.shortTitle || work.title}</h2>
    <ResourceState resource={resource} />
    {units && <div className="library-text library-layer-text" dir="rtl">{groups.map(group => <Fragment key={`${group.v}-${group.units[0].id}`}>
      {byVerse && !verse && group.v && <p className="library-layer-verse" aria-label={`${unitLabel} ${labelNumeral(group.units[0].vl) || hebrewNumeral(group.v)}`}><span>{group.units[0].vl ? `${unitLabel} ${labelNumeral(group.units[0].vl)}` : hebrewNumeral(group.v)}</span></p>}
      {group.units.map(item => <p key={item.id} className="library-unit">{item.fn && <sup className="library-fn library-fn-lead" aria-label={`הערה ${item.fn}`}>{item.fn}</sup>}<span>{item.dh && <><strong className="library-dh">{fixHebrewTypography(item.dh)}</strong> </>}{renderUnitText(item.text)}</span></p>)}
    </Fragment>)}</div>}
    <p className="library-layer-source">{layer.remote ? `${work.layerTitle ? `${work.title} · ` : `${work.title}, `}${edition.heTitle} · נחלת הכלל · נטען מספריא בעת הקריאה` : edition.attribution?.text || edition.sourceLine || edition.heTitle}</p>
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
