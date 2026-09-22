import { useEffect, useState } from 'react';
import { useLocal, useResource } from '../hooks.jsx';
import { BOOK_CATEGORIES } from '../data/bookCatalog.mjs';
import booksOffline from '../data/booksOffline.mjs';
import { normalizeHebrew } from '../content.mjs';
import { getIndex } from '../services/sefaria.mjs';
import { ResourceState } from '../components/SourceReader.jsx';
import { formatTanakhReferences } from '../services/tanakhReferences.mjs';
import { formatGregorianDate } from '../civilDate.mjs';
import { hebrewDate } from '../dayContext.mjs';
import { TANAKH_SECTIONS } from '../data/tanakhCatalog.mjs';

export function BooksCatalog({ openSource, returnToBooks = () => { window.location.hash = 'books'; } }) {
  const [query, setQuery] = useState('');
  const normalized = query.trim();
  return <section className="books-page">
    <p className="eyebrow">ספריית מקורות</p>
    <h1>ספרים</h1>
    <p className="intro">ספרים שנשמרו במאגר המקומי. פתח ספר כדי להתחיל לקרוא.</p>
    <label className="halacha-search"><span>חיפוש בספרים</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="חיפוש לפי שם הספר…" /></label>
    {BOOK_CATEGORIES.map(category => {
      const books = category.books
        .map(([id, title, reference]) => ({ id, title, reference }))
        .filter(book => !normalized || `${book.title} ${book.reference}`.toLowerCase().includes(normalized.toLowerCase()));
      if (!books.length) return null;
      return <section className="source-catalog" key={category.id}>
        <div className="section-heading"><h2>{category.title}</h2><span>{books.length} ספרים</span></div>
        <div className="book-index">{books.map(book => {
          if (book.id === 'tanakh') return <TanakhCatalog key={book.id} query={normalized} openSource={openSource} returnToBooks={returnToBooks} />;
          const available = book.reference.split(/\s*;\s*/).every(reference => booksOffline[reference]);
          return <button className="index-row" key={book.id} disabled={!available} onClick={() => openSource(book.reference, book.title, 'nikud')}>
            <span><strong>{book.title}</strong><small>{available ? 'פתיחה מיידית · זמין ללא אינטרנט' : 'הספר עדיין בהכנה'}</small></span><span aria-hidden="true">{available ? '←' : '…'}</span>
          </button>;
        })}</div>
      </section>;
    })}
  </section>;
}

function TanakhCatalog({ query, openSource, returnToBooks }) {
  const [activeBook, setActiveBook] = useLocal('tanakh-active-book-v1', '');
  const matches = value => !query || normalizeHebrew(value).includes(normalizeHebrew(query));
  useEffect(() => {
    if (!activeBook) return undefined;
    const timer = setTimeout(() => document.getElementById(`tanakh-book-${activeBook}`)?.scrollIntoView({ block: 'start' }), 0);
    return () => clearTimeout(timer);
  }, [activeBook]);
  const returnToChapters = () => returnToBooks();
  const openChapter = (book, chapter, sourceTitle = `פרק ${chapter}`) => {
    setActiveBook(book.ref);
    openSource(`${book.ref} ${chapter}`, `${book.title} · ${sourceTitle}`, 'cantillation', {
      flowKey: `tanakh:${book.ref}`,
      backLabel: `חזרה ל${book.title} · פרקים`,
      onBack: returnToChapters,
      breadcrumbs: [{ label: 'ספרים', onNavigate: returnToChapters }, { label: book.title, onNavigate: returnToChapters }, { label: `פרק ${chapter}` }],
      previous: chapter > 1 ? { chapter: chapter - 1, title: `פרק ${chapter - 1}` } : null,
      next: chapter < book.chapters ? { chapter: chapter + 1, title: `פרק ${chapter + 1}` } : null,
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
        <div className="tanakh-books">{books.map(([ref, title, chapters, portions]) => {
          const book = { ref, title, chapters };
          return <details id={`tanakh-book-${ref}`} key={ref} open={activeBook === ref} onToggle={event => setActiveBook(event.currentTarget.open ? ref : '')}>
          <summary>{title}<small>{chapters} פרקים</small></summary>
          {portions && <div className="portion-grid">{portions.map(([portion, chapter]) => <button key={`${ref}-${portion}`} onClick={() => openChapter(book, chapter, `פרשת ${portion}`)}>{portion}<small>פרק {chapter}</small></button>)}</div>}
          <div className="chapter-grid">{Array.from({ length: chapters }, (_, index) => <button key={`${ref}-${index + 1}`} onClick={() => openChapter(book, index + 1)}>פרק {index + 1}</button>)}</div>
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

function createSiddurFlows(nodes, openSource) {
  const allItems = [];
  nodes.forEach(root => {
    const rootEn = siddurTitle(root, 'en');
    const rootHe = siddurTitle(root, 'he');
    const leaves = collectSiddurLeaves(root.nodes || [root], rootEn, rootHe, [rootEn]);
    const preferred = SIDDUR_FLOW_ORDER[rootEn] || leaves.map(item => item.en);
    const ordered = [...preferred.map(name => leaves.find(item => item.en === name)).filter(Boolean), ...leaves.filter(item => !preferred.includes(item.en))];
    allItems.push(...ordered);
  });
  const byReference = new Map(allItems.map(item => [item.reference, item]));
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
        backLabel: 'חזרה לסידור',
        breadcrumbs: [{ label: 'סידור' }],
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

export function SiddurPage({context,openSource,onOpenCompass}) {
  const resource=useResource(()=>getIndex('Siddur Edot HaMizrach'),[]);
  const [q,setQ]=useState('');
  const [progress] = useLocal('reader-progress-v1', {});
  const nodes=resource.data?.schema?.nodes||[];
  const flowData = createSiddurFlows(nodes, openSource);
  const resume = flowData.allItems.find(item => Object.values(progress).includes(item.reference));
  const matchesQuery=(next,he)=>!q||normalizeHebrew(next.join(' ')+' '+he).includes(normalizeHebrew(q));
  const hasMatch=(node,path=[])=>{const en=siddurTitle(node,'en');const he=siddurTitle(node,'he');const next=[...path,en];if(node.nodes)return node.nodes.some(n=>hasMatch(n,next));return !isSiddurNavigationItemHidden(path[0],en)&&matchesQuery(next,he);};
  function render(node,path=[]) {
    const en=siddurTitle(node,'en'); const he=siddurTitle(node,'he'); const next=[...path,en];
    // While filtering, hide groups with no matching leaf instead of rendering empty open headers.
    if(node.nodes) return q&&!hasMatch(node,path)?null:<details key={next.join(',')} open={Boolean(q)}><summary>{he}</summary>{node.nodes.map(n=>render(n,next))}</details>;
    if(isSiddurNavigationItemHidden(path[0],en))return null;
    if(!matchesQuery(next,he))return null;
    const reference=['Siddur Edot HaMizrach',...next].join(', ');
    return <button className="prayer-link" key={next.join(',')} onClick={()=>openSource(reference,he,'nikud',flowData.navigation.get(reference))}>{he}<span aria-hidden="true">←</span></button>;
  }
  const noResults=Boolean(q)&&nodes.length>0&&!nodes.some(n=>hasMatch(n));
  return <section><div className="siddur-toolbar"><div><p className="eyebrow">סידור · נוסח עדות המזרח</p><h1>עת תפילה.</h1></div><button type="button" className="siddur-compass-entry" onClick={onOpenCompass} aria-label="פתיחת מצפן תפילה"><span aria-hidden="true">⌖</span><strong>מצפן תפילה</strong></button></div><p className="intro">תוכן עניינים מסודר לתפילות היום. הוראות וחלופות נשמרות כפי שהן מופיעות במהדורה.</p><a className="prayer-link forgotten-entry" href="#forgotten-addition"><strong>שכחתי תוספת — מה עושים?</strong><span aria-hidden="true">←</span></a>{resume && <button className="resume-reading" onClick={()=>openSource(resume.reference,resume.title,'nikud',flowData.navigation.get(resume.reference))}><span>המשך קריאה</span><strong>{resume.title}</strong><b aria-hidden="true">←</b></button>}{context.additions.map(a=><p className="prayer-note" key={a.text}>{a.text} · <button className="link" onClick={()=>openSource(a.ref,'תוספת בתפילה')}>לקריאה</button></p>)}<input className="book-search" aria-label="חיפוש תפילה" placeholder="מצאו תפילה או ברכה" value={q} onChange={e=>setQ(e.target.value)}/><ResourceState resource={resource}/>{noResults&&<p className="notice" role="status">לא נמצאה תפילה בשם הזה. נסו ניסוח אחר או עיינו בתוכן העניינים.</p>}<div className="siddur-index">{nodes.map(n=>render(n))}</div></section>;
}
export function ParashaPage({context,settings,openSource}) {
  const p=context.shabbatReading||context.parasha;
  const isHoliday=p?.category==='holiday';
  const reading=p?.leyning;
  // Sephardic haftarah when Hebcal distinguishes one; otherwise the common reading.
  const haftarah=reading?.haftarah_sephardic||reading?.haftarah;
  const dateKey=p?.date?.slice?.(0,10);
  const hebrewLabel=dateKey?hebrewDate(dateKey)?.label:null;
  const displayReference = reference => formatTanakhReferences(reference);
  return <section><p className="eyebrow">קריאת התורה · {settings.il?'ארץ ישראל':'חוץ לארץ'}</p><h1>{p?.hebrew||'פרשת השבוע'}</h1>{!p?<p className="notice">קריאת השבוע תוצג כשנתוני הלוח יהיו זמינים.</p>:<><p className="intro">{dateKey?formatGregorianDate(dateKey):''}{hebrewLabel?` · ${hebrewLabel}`:''}{isHoliday&&context.parasha?` · בשבת זו קוראים בקריאת החג; פרשת ${context.parasha.hebrew?.replace(/^פרשת /,'')} תיקרא בשבת הבאה`:''}</p>{reading?.torah&&<button className="index-row" onClick={()=>openSource(reading.torah,p.hebrew,'cantillation')}><strong>{isHoliday?'לקריאת התורה של החג':'לקריאת הפרשה'}</strong><span>{displayReference(reading.torah)}</span><span aria-hidden="true">←</span></button>}{haftarah?<div className="reading-section"><h2>{reading?.haftarah_sephardic?'הפטרה · ספרדים':'הפטרה'}</h2>{haftarah.split(' | ')[0].split(';').map(ref=><button key={ref} className="prayer-link" onClick={()=>openSource(ref.trim(),undefined,'cantillation')}><span>{displayReference(ref.trim())}</span><span aria-hidden="true">←</span></button>)}</div>:<p className="notice">לא התקבל מראה מקום להפטרה.</p>}<details><summary>עליות ומפטיר · לפי Hebcal</summary>{Object.entries(reading||{}).filter(([key])=>/^\d$/.test(key)||key==='maftir').map(([key,ref])=><button className="prayer-link" key={key} onClick={()=>openSource(ref,undefined,'cantillation')}><span>{key==='maftir'?'מפטיר':'עלייה '+key}</span><span>{displayReference(ref)}</span></button>)}</details></>}</section>;
}
