import { useEffect, useState } from 'react';
import { useLocal, useResource } from '../hooks.jsx';
import { BOOK_CATEGORIES } from '../data/bookCatalog.mjs';
import { loadBookCorpus } from '../services/bookCorpus.mjs';
import { normalizeHebrew } from '../content.mjs';
import { getIndex } from '../services/sefaria.mjs';
import { ResourceState } from '../components/SourceReader.jsx';
import { formatTanakhReferences } from '../services/tanakhReferences.mjs';
import { formatGregorianDate } from '../civilDate.mjs';
import { hebrewDate } from '../dayContext.mjs';
import { TANAKH_SECTIONS } from '../data/tanakhCatalog.mjs';
import { buildLocalBookToc, buildMishnahToc } from '../services/localBookToc.mjs';
import { hebrewNumeral } from '../services/hebrewNumerals.mjs';
import { calendarIsIsrael } from '../services/calendarAccuracy.mjs';
import { prayerRootKey } from '../services/smartPrayer.mjs';
import { saveScrollPosition } from '../services/scrollRestoration.mjs';
import { hebrewEventLabel } from '../services/hebrewCalendarLabels.mjs';
import LtrDate from '../components/LtrDate.jsx';

export function getTanakhAccordionState(activeBook, targetBook) {
  return targetBook || activeBook;
}

export function BooksCatalog({ openSource, returnToBooks = () => { window.location.hash = 'books'; } }) {
  const [query, setQuery] = useState('');
  const normalized = query.trim();
  const booksResource = useResource(loadBookCorpus, []);
  const booksOffline = booksResource.data || {};
  // Every "open a book/section" action from this list saves the current scroll
  // position first, so returning here (Back) restores exactly where the user was.
  const openFromBooks = (...args) => { saveScrollPosition('books'); return openSource(...args); };
  return <section className="books-page">
    <p className="eyebrow">ספריית מקורות</p>
    <h1>ספרים</h1>
    <p className="intro">ספרים מהמאגר המקומי. בגרסת האתר יש לפתוח את הספרייה בחיבור פעיל לפני שימוש ללא רשת.</p>
    <ResourceState resource={booksResource}/>
    <label className="halacha-search"><span>חיפוש בספרים</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="חיפוש לפי שם הספר…" /></label>
    {BOOK_CATEGORIES.map(category => {
      const books = category.books
        .map(([id, title, reference]) => ({ id, title, reference }))
        .filter(book => !normalized || `${book.title} ${book.reference}`.toLowerCase().includes(normalized.toLowerCase()));
      if (!books.length) return null;
      return <section className="source-catalog" key={category.id}>
        <div className="section-heading"><h2>{category.title}</h2><span>{books.length} ספרים</span></div>
        <div className="book-index">{books.map(book => {
          if (book.id === 'mishnah') return <MishnahCatalog key={book.id} query={normalized} openSource={openFromBooks} returnToBooks={returnToBooks} />;
          if (book.id === 'tanakh') return <TanakhCatalog key={book.id} query={normalized} openSource={openFromBooks} returnToBooks={returnToBooks} />;
          const toc = buildLocalBookToc(book, booksOffline);
          const flow = toc.sections.map(section => ({ reference: section.ref, title: section.label, mode: section.mode }));
          const openBook = (section, index) => openFromBooks(section.ref, toc.fallback ? book.title : section.label, section.mode, {
            flowKey: `book:${book.id}`,
            flow,
            index,
            returnRoute: 'books',
            backLabel: 'חזרה לספרים',
            breadcrumbs: [{ label: 'ספרים', route: 'books' }],
            endLabel: `סוף ${book.title}`,
          });
          // A single-section book has no real sub-hierarchy: the title itself is the
          // only control, opened directly — never repeated as a nested row underneath.
          if (toc.fallback) return <button type="button" key={book.id} className="index-row book-row-single" onClick={() => openBook(toc.sections[0], 0)}>
            <span className="book-row-main"><strong>{book.title}</strong></span>
            <span className="book-row-arrow" aria-hidden="true">›</span>
          </button>;
          return <details className="local-book-toc" key={book.id} open={!normalized}>
            <summary><span className="book-row-main"><strong>{book.title}</strong></span><span className="book-row-arrow" aria-hidden="true">›</span></summary>
            <div className="book-index nested-row">{toc.sections.map((section, index) => <button key={section.key} className="index-row" onClick={() => openBook(section, index)}><span>{section.label}</span><span aria-hidden="true">→</span></button>)}</div>
          </details>;
        })}</div>
      </section>;
    })}
  </section>;
}

// Groups a masechet's flat perek/mishnah sections into perek headings with their
// nested mishnayot, so the two levels can be styled with distinct visual weight.
export function groupMishnahPerakim(items) {
  const groups = [];
  let current = null;
  for (const item of items) {
    if (item.kind === 'perek') { current = { perek: item, mishnayot: [] }; groups.push(current); }
    else if (item.kind === 'mishnah' && current) current.mishnayot.push(item);
  }
  return groups;
}

function MishnahCatalog({ query, openSource, returnToBooks }) {
  const hierarchy = buildMishnahToc({ id: 'mishnah', title: 'כל המשניות עם פירוש', reference: 'Mishnah' }, {});
  const entries = hierarchy.sections.filter(section => !query || `${section.seder} ${section.masechet} ${section.label}`.includes(query));
  const groups = new Map();
  entries.forEach(section => {
    const seder = section.seder || 'משנה';
    const masechet = section.masechet || 'כל המשניות';
    if (!groups.has(seder)) groups.set(seder, new Map());
    const sederMap = groups.get(seder);
    if (!sederMap.has(masechet)) sederMap.set(masechet, []);
    sederMap.get(masechet).push(section);
  });
  const [activeSeder, setActiveSeder] = useLocal('mishnah-active-seder-v1', '');
  const [activeMasechet, setActiveMasechet] = useLocal('mishnah-active-masechet-v1', '');
  const toggle = (setter, current, next) => setter(current === next ? '' : getTanakhAccordionState(current, next));
  const openMishnah = (ref, label) => openSource(ref, label, 'source', {
    flowKey: `book:mishnah:${ref}`,
    flow: [{ reference: ref, title: label, mode: 'source' }],
    index: 0,
    returnRoute: 'books',
    backLabel: 'חזרה לספרים',
    breadcrumbs: [{ label: 'ספרים', route: 'books' }],
    endLabel: 'סוף כל המשניות',
  });
  return <div className="mishnah-catalog">{[...groups.entries()].map(([seder, masechot]) => <details key={seder} className="local-book-toc mishnah-seder" open={Boolean(query) || activeSeder === seder}>
    <summary onClick={event => { event.preventDefault(); toggle(setActiveSeder, activeSeder, seder); }}><span className="book-row-main"><strong>{seder}</strong></span><span className="book-row-arrow" aria-hidden="true">›</span></summary>
    <div className="book-index nested-row">{[...masechot.entries()].map(([masechet, items]) => <details key={masechet} className="mishnah-masechet" open={Boolean(query) || activeMasechet === masechet}>
      <summary onClick={event => { event.preventDefault(); toggle(setActiveMasechet, activeMasechet, masechet); }}><span className="book-row-main"><strong>{masechet.replace(/^משנה\s+/, '')}</strong></span><span className="book-row-arrow" aria-hidden="true">›</span></summary>
      <div className="mishnah-perek-list">{groupMishnahPerakim(items).map(group => <div className="mishnah-perek-group" key={group.perek.key}>
        <button type="button" className="mishnah-perek-heading" onClick={() => openMishnah(group.perek.ref, group.perek.label)}><strong>{group.perek.label}</strong><span aria-hidden="true">›</span></button>
        <div className="mishnah-row-list">{group.mishnayot.map(item => <button key={item.key} className="index-row mishnah-row" onClick={() => openMishnah(item.ref, item.label)}><span>{item.label}</span><span aria-hidden="true">→</span></button>)}</div>
      </div>)}</div>
    </details>)}</div>
  </details>)}</div>;
}

function TanakhCatalog({ query, openSource, returnToBooks }) {
  const [activeBook, setActiveBook] = useLocal('tanakh-active-book-v1', '');
  const matches = value => !query || normalizeHebrew(value).includes(normalizeHebrew(query));
  const returnToChapters = () => returnToBooks();
  const chapterLabel = chapter => `פרק ${hebrewNumeral(chapter)}`;
  const openChapter = (book, chapter, sourceTitle = chapterLabel(chapter)) => {
    setActiveBook(book.ref);
    openSource(`${book.ref} ${chapter}`, `${book.title} · ${sourceTitle}`, 'cantillation', {
      flowKey: `tanakh:${book.ref}`,
      flow: Array.from({ length: book.chapters }, (_, i) => ({ reference: `${book.ref} ${i + 1}`, title: `${book.title} · ${chapterLabel(i + 1)}`, mode: 'cantillation' })),
      index: chapter - 1, returnRoute: 'books',
      backLabel: `חזרה ל${book.title} · פרקים`,
      onBack: returnToChapters,
      breadcrumbs: [{ label: 'ספרים', route: 'books', onNavigate: returnToChapters }, { label: book.title, route: 'books', onNavigate: returnToChapters }, { label: chapterLabel(chapter) }],
      previous: chapter > 1 ? { chapter: chapter - 1, title: chapterLabel(chapter - 1) } : null,
      next: chapter < book.chapters ? { chapter: chapter + 1, title: chapterLabel(chapter + 1) } : null,
      endLabel: `סוף ספר ${book.title}`,
      onSelect: target => openChapter(book, target.chapter),
    });
  };
  return <div className="tanakh-catalog">
    {TANAKH_SECTIONS.map(section => {
      const books = section.books.filter(([, title]) => matches(`${section.title} ${title}`));
      if (!books.length) return null;
      return <section className="tanakh-section" key={section.id}>
        <div className="section-heading"><h3>{section.title}</h3><span>{books.length} ספרים</span></div>
        <div className="tanakh-books">{books.map(([ref, title, chapters]) => {
          const book = { ref, title, chapters };
          return <details id={`tanakh-book-${ref}`} key={ref} open={activeBook === ref}>
          <summary onClick={event => { event.preventDefault(); setActiveBook(current => current === ref ? '' : getTanakhAccordionState(current, ref)); }}>{title}<small>{hebrewNumeral(chapters)} פרקים</small></summary>
          <div className="chapter-grid">{Array.from({ length: chapters }, (_, index) => <button key={`${ref}-${index + 1}`} onClick={() => openChapter(book, index + 1)}>{chapterLabel(index + 1)}</button>)}</div>
        </details>;
        })}</div>
      </section>;
    })}
  </div>;
}
const SIDDUR_FLOW_ORDER = {
  'Preparatory Prayers': ['Modeh Ani', 'Morning Blessings', 'Torah Blessings'],
  'Weekday Shacharit': ['Petichat Eliyahu', 'Order of Talit', 'Order of Tefillin', "Hanna's Prayer", 'Incense Offering', 'Hodu', "Pesukei D'Zimra", 'The Shema', 'Amida', 'Vidui', 'Torah Reading', 'Ashrei', 'Uva LeSion', 'Beit Yaakov', 'Song of the Day', 'Kaveh', 'Alenu'],
  'Weekday Mincha': ['Offerings', 'Amida', 'Vidui', 'Alenu'],
  'Weekday Arvit': ['Barchu', 'The Shema', 'Amidah', 'Alenu'],
  'Shabbat Arvit': ['Barchu', 'The Shema', 'Magen Avot', 'Alenu'],
  'Shabbat Evening': ['Shalom Alekhem', 'Eshet Hayil', 'Atkenu Seudata', 'Kiddush', 'Blessing of Children', 'First Meal', 'Zohar', 'Songs for Shabbat'],
  'Shabbat Shacharit': ['Psalms for Shabbat', "Pesukei D'Zimra", 'The Shema', 'Amidah', 'Torah Reading', 'HaGomel', 'Haftarah', 'Birkat HaChodesh', 'Announcement of Fast', 'Mi Sheberach', 'Ashrei'],
  'Shabbat Mussaf': ['Amida', 'Incense Offering', 'Alenu'],
  'Shabbat Mincha': ['Offerings', 'Uva LeSion', 'Amida', 'Alenu'],
  'Havdalah': ['Before Havdalah', 'Havdala', 'Motzei Shabbat Songs', 'Veyiten Lecha', 'Fourth Meal'],
  'Rosh Hodesh': ['Rosh Hodesh', 'Hallel', 'Uva LeSion', 'Song of the Day', 'Mussaf', 'Barchi Nafshi', 'Kaveh', 'Incense Offering', 'Alenu'],
  'Prayers for Three Festivals': ['Prayers for Three Festivals', 'Song for Passover', 'Song for Shavuot', 'Song for Sukkot', 'Song for Shemini Atzeret', 'Amidah', 'Mussaf'],
  'Post Meal Blessing': ['Post Meal Blessing'],
  'Bedtime Shema': ['Bedtime Shema'],
  'Hallel': ['Hallel'],
};

function siddurTitle(node, lang) {
  return node.titles?.find(t => t.lang === lang && t.primary)?.text || node.key;
}

export const isSiddurNavigationItemHidden = (rootEn, itemEn) => rootEn === 'Weekday Shacharit' && itemEn === 'Morning Prayer';

function collectSiddurLeaves(nodes, rootEn, rootHe, path = []) {
  return nodes.flatMap(node => {
    const en = siddurTitle(node, 'en');
    const he = siddurTitle(node, 'he');
    const nextPath = [...path, en];
    if (node.nodes) return collectSiddurLeaves(node.nodes, rootEn, rootHe, nextPath);
    if (isSiddurNavigationItemHidden(rootEn, en)) return [];
    return [{ reference: ['Siddur Edot HaMizrach', ...nextPath].join(', '), title: he, en, rootEn, rootHe, mode: 'nikud' }];
  });
}

function createSiddurFlows(nodes, openSource, summary = {}) {
  const allItems = [];
  nodes.forEach(root => {
    const rootEn = siddurTitle(root, 'en');
    const rootHe = siddurTitle(root, 'he');
    const leaves = collectSiddurLeaves(root.nodes || [root], rootEn, rootHe, [rootEn])
      .filter(item => shouldDisplaySiddurSection(item.en, summary));
    const preferred = SIDDUR_FLOW_ORDER[rootEn] || leaves.map(item => item.en);
    const ordered = [...preferred.map(name => leaves.find(item => item.en === name)).filter(Boolean), ...leaves.filter(item => !preferred.includes(item.en))];
    allItems.push(...ordered);
  });
  const navigation = new Map();
  let offset = 0;
  nodes.forEach(root => {
    const rootEn = siddurTitle(root, 'en');
    const rootHe = siddurTitle(root, 'he');
    const count = allItems.filter(item => item.rootEn === rootEn).length;
    const flow = allItems.slice(offset, offset + count);
    offset += count;
    flow.forEach((item, index) => {
      const descriptor = {
        flowKey: rootEn,
        flow: flow.map(({ reference, title, mode }) => ({ reference, title, mode })),
        index, returnRoute: 'siddur',
        backLabel: 'חזרה לסידור',
        breadcrumbs: [{ label: 'סידור', route: 'siddur' }],
        onBack: () => history.back(),
        previous: flow[index - 1] || null,
        next: flow[index + 1] || null,
        endLabel: `סיימת את ${rootHe}`,
        onSelect: target => openSource(target.reference, target.title, target.mode, navigation.get(target.reference)),
      };
      navigation.set(item.reference, descriptor);
    });
  });
  return { allItems, navigation };
}

import { buildSiddurConditionSummary, shouldDisplaySiddurSection } from '../services/siddurConditionEngine.mjs';

export function SiddurPage({context,openSource,onOpenCompass,autoOpenPrayer,onAutoOpenHandled}) {
  const resource=useResource(()=>getIndex('Siddur Edot HaMizrach'),[]);
  const [q,setQ]=useState('');
  const [progress] = useLocal('reader-progress-v1', {});
  const nodes=resource.data?.schema?.nodes||[];
  const summary = buildSiddurConditionSummary(context);
  const flowData = createSiddurFlows(nodes, openSource, summary);
  const resume = flowData.allItems.find(item => Object.values(progress).includes(item.reference));
  // The Today "smart prayer" card asks to open a prayer directly; once the real Siddur
  // index has loaded, forward straight into its existing flow instead of a new one.
  useEffect(() => {
    if (!autoOpenPrayer || !flowData.allItems.length) return;
    const rootKey = prayerRootKey(autoOpenPrayer, { isShabbat: summary.isShabbat });
    const target = flowData.allItems.find(item => item.rootEn === rootKey) || flowData.allItems.find(item => item.rootEn === `Weekday ${rootKey.split(' ')[1]}`);
    if (target) openSource(target.reference, target.title, target.mode, flowData.navigation.get(target.reference), { showCompass: true });
    onAutoOpenHandled?.();
  }, [autoOpenPrayer, flowData.allItems.length]);
  const matchesQuery=(next,he)=>!q||normalizeHebrew(next.join(' ')+' '+he).includes(normalizeHebrew(q));
  const hasMatch=(node,path=[])=>{const en=siddurTitle(node,'en');const he=siddurTitle(node,'he');const next=[...path,en];if(node.nodes)return node.nodes.some(n=>hasMatch(n,next));return !isSiddurNavigationItemHidden(path[0],en)&&matchesQuery(next,he);};
  function render(node,path=[]) {
    const en=siddurTitle(node,'en'); const he=siddurTitle(node,'he'); const next=[...path,en];
    if (node.nodes) {
      const children = node.nodes.filter(child => {
        const childEn = siddurTitle(child, 'en');
        const childHe = siddurTitle(child, 'he');
        const childName = childEn || childHe || '';
        return shouldDisplaySiddurSection(childName, summary) && (!q || hasMatch(child, next));
      });
      if (!children.length && q) return null;
      return <details key={next.join(',')} open={Boolean(q)}><summary>{he}</summary>{children.map(n=>render(n,next))}</details>;
    }
    if(isSiddurNavigationItemHidden(path[0],en))return null;
    if(!shouldDisplaySiddurSection(en, summary))return null;
    if(!matchesQuery(next,he))return null;
    const reference=['Siddur Edot HaMizrach',...next].join(', ');
    return <button className="prayer-link" key={next.join(',')} onClick={()=>openSource(reference,he,'nikud',flowData.navigation.get(reference))}>{he}<span aria-hidden="true">←</span></button>;
  }
  const noResults=Boolean(q)&&nodes.length>0&&!nodes.some(n=>hasMatch(n));
  return <section><div className="siddur-toolbar"><div><p className="eyebrow">סידור · נוסח עדות המזרח</p><h1>עת תפילה.</h1></div><button type="button" className="siddur-compass-entry" onClick={onOpenCompass} aria-label="פתיחת מצפן תפילה"><span aria-hidden="true">⌖</span><strong>מצפן תפילה</strong></button></div><p className="intro">תוכן עניינים מסודר לתפילות היום. הוראות וחלופות נשמרות כפי שהן מופיעות במהדורה.</p><p className="prayer-note">{hebrewEventLabel(summary.dayLabel)} · {summary.hasTachanun ? 'תפילת תחנון נכללת' : 'תחנון לא נאמר'} · {summary.hasHallel ? summary.parallelKind : 'אין הלל'} </p><a className="prayer-link forgotten-entry" href="#forgotten-addition"><strong>שכחתי תוספת — מה עושים?</strong><span aria-hidden="true">←</span></a>{resume && <button className="resume-reading" onClick={()=>openSource(resume.reference,resume.title,'nikud',flowData.navigation.get(resume.reference))}><span>המשך קריאה</span><strong>{resume.title}</strong><b aria-hidden="true">←</b></button>}{context.additions.map(a=><p className="prayer-note" key={a.text}>{a.text} · <button className="link" onClick={()=>openSource(a.ref,'תוספת בתפילה')}>לקריאה</button></p>)}<input className="book-search" aria-label="חיפוש תפילה" placeholder="מצאו תפילה או ברכה" value={q} onChange={e=>setQ(e.target.value)}/><ResourceState resource={resource}/>{noResults&&<p className="notice" role="status">לא נמצאה תפילה בשם הזה. נסו ניסוח אחר או עיינו בתוכן העניינים.</p>}<div className="siddur-index">{nodes.map(n=>render(n))}</div></section>;
}
export function ParashaPage({context,settings,openSource}) {
  const p=context.shabbatReading;
  const isHoliday=p?.category==='holiday';
  const reading=p?.leyning;
  // Sephardic haftarah when Hebcal distinguishes one; otherwise the common reading.
  const haftarah=reading?.haftarah_sephardic||reading?.haftarah;
  const dateKey=p?.date?.slice?.(0,10);
  const hebrewLabel=dateKey?hebrewDate(dateKey)?.label:null;
  const displayReference = reference => formatTanakhReferences(reference);
  const holidayParashaDate = context?.parasha?.date?.slice?.(0, 10);
  return <section><p className="eyebrow">קריאת התורה · {calendarIsIsrael(settings)?'ארץ ישראל':'חוץ לארץ'}</p><h1>{p?.hebrew||'פרשת השבוע'}</h1>{!p?<p className="notice">קריאת השבוע תוצג כשנתוני הלוח יהיו זמינים.</p>:<><p className="intro">{dateKey ? <LtrDate value={dateKey} /> : ''}{hebrewLabel?` · ${hebrewLabel}`:''}{isHoliday && context.parasha ? <> · בשבת זו קוראים בקריאת החג; פרשת {context.parasha.hebrew?.replace(/^פרשת /,'')} תיקרא בתאריך <LtrDate value={holidayParashaDate} /></> : null}</p>{reading?.torah&&<button className="index-row" onClick={()=>openSource(reading.torah,p.hebrew,'cantillation')}><strong>{isHoliday?'לקריאת התורה של החג':'לקריאת הפרשה'}</strong><span>{displayReference(reading.torah)}</span><span aria-hidden="true">←</span></button>}{haftarah?<div className="reading-section"><h2>{reading?.haftarah_sephardic?'הפטרה · ספרדים':'הפטרה'}</h2>{haftarah.split(' | ')[0].split(';').map(ref=><button key={ref} className="prayer-link" onClick={()=>openSource(ref.trim(),undefined,'cantillation')}><span>{displayReference(ref.trim())}</span><span aria-hidden="true">←</span></button>)}</div>:<p className="notice">לא התקבל מראה מקום להפטרה.</p>}<details><summary>עליות ומפטיר · לפי Hebcal</summary>{Object.entries(reading||{}).filter(([key])=>/^\d$/.test(key)||key==='maftir').map(([key,ref])=><button className="prayer-link" key={key} onClick={()=>openSource(ref,undefined,'cantillation')}><span>{key==='maftir'?'מפטיר':'עלייה '+key}</span><span>{displayReference(ref)}</span></button>)}</details></>}</section>;
}
