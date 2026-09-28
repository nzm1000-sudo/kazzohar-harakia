import { useEffect, useState } from 'react';
import { useLocal, useResource, useRouteState } from '../hooks.jsx';
import { BOOK_CATEGORIES } from '../data/bookCatalog.mjs';
import { loadBookCorpus } from '../services/bookCorpus.mjs';
import { normalizeHebrew } from '../content.mjs';
import { getIndex, splitReference } from '../services/sefaria.mjs';
import { ResourceState } from '../components/SourceReader.jsx';
import { formatTanakhReferences } from '../services/tanakhReferences.mjs';
import TanakhRefText from '../components/TanakhRefText.jsx';
import { parseTanakhRef } from '../services/localTanakh.mjs';
import { SHNAYIM_MIKRA_CANONICAL_RANGES } from '../data/shnayimMikraRanges.mjs';
import { formatGregorianDate } from '../civilDate.mjs';
import { hebrewDate } from '../dayContext.mjs';
import { TANAKH_SECTIONS } from '../data/tanakhCatalog.mjs';
import { buildLocalBookToc, buildMishnahToc } from '../services/localBookToc.mjs';
import { hebrewNumeral } from '../services/hebrewNumerals.mjs';
import { calendarIsIsrael } from '../services/calendarAccuracy.mjs';
import { choosePrayerType, prayerRootKey } from '../services/smartPrayer.mjs';
import { nusachLabel } from '../data/nusach/registry.mjs';
import { saveScrollPosition } from '../services/scrollRestoration.mjs';
import { hebrewEventLabel } from '../services/hebrewCalendarLabels.mjs';
import LtrDate from '../components/LtrDate.jsx';
import ClearableInput from '../components/ClearableInput.jsx';

export function getTanakhAccordionState(activeBook, targetBook) {
  return targetBook || activeBook;
}

export function BooksCatalog({ openSource, returnToBooks = () => { window.location.hash = 'books'; } }) {
  const [query, setQuery] = useRouteState('books-query', '');
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
    <label className="halacha-search"><span>חיפוש בספרים</span><ClearableInput value={query} onChange={event => setQuery(event.target.value)} placeholder="חיפוש לפי שם הספר…" autoComplete="off" clearLabel="נקה חיפוש בספרים" type="search" /></label>
    {BOOK_CATEGORIES.map(category => {
      const books = category.books
        .map(([id, title, reference]) => ({ id, title, reference }))
        // Tanakh/Mishnah are umbrella catalog entries (e.g. "כל התנאך") whose own
        // title never contains an individual book name like ויקרא — they always stay in
        // the list so their own accurate per-book/per-masechet search below can run.
        .filter(book => book.id === 'mishnah' || book.id === 'tanakh' || !normalized || normalizeHebrew(`${book.title} ${book.reference}`).includes(normalizeHebrew(normalized)));
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
// The Siddur home is built from the chosen rite's own table of contents, read through the rite's layout
// (data/nusach/siddurLayouts.mjs): the same four families for every rite, the festival shelf, and the reading flows.
// Edot HaMizrach keeps its groups exactly as before; the other rites bring their own trees — never each other's text.
export const SIDDUR_GROUPS = [...siddurLayout('edot-hamizrach').groups];
// The section of the printed Siddur that duplicates a whole prayer already listed under its own name.
export const isSiddurNavigationItemHidden = (rootEn, itemEn) => rootEn === 'Weekday Shacharit' && itemEn === 'Morning Prayer';

import { buildSiddurConditionSummary, shouldDisplaySiddurSection } from '../services/siddurConditionEngine.mjs';
import { composeWeekdayMincha } from '../services/prayer/weekdayMinchaComposer.mjs';
import { dayServiceInstant, dayServiceSupport, DAY_SERVICE_TITLES } from '../services/prayer/dayServicePlan.mjs';
import { DAY_SERVICE_PREFIX } from '../services/prayer/dayServiceComposer.mjs';
import { JewishContextEngine } from '../services/jewishContextEngine.mjs';
import { MOADIM, MOADIM_ROOTS } from '../data/siddurMoadim.mjs';
import { siddurLayout, rootKey } from '../data/nusach/siddurLayouts.mjs';
import { nusachOf, siddurIndexTitle } from '../services/nusach.mjs';
import { siddurRoots, buildSiddurFlows, siddurTitle } from '../services/siddurIndex.mjs';
import NusachSelector, { NusachOnboarding } from '../components/NusachSelector.jsx';
import { SIDDUR_SOURCES } from '../data/nusach/manifest.mjs';

const MINCHA_SECTION_IDS = { Offerings: 'offerings', Amida: 'amida', Vidui: 'vidui', Alenu: 'alenu' };

export function SiddurPage({context,settings,now,times,openSource,onOpenCompass,autoOpenPrayer,onAutoOpenHandled,go,onNusachChange,askNusach=false,onNusachAsked}) {
  const nusach = nusachOf(settings);
  const layout = siddurLayout(nusach);
  const indexTitle = siddurIndexTitle(nusach);
  const resource=useResource(()=>getIndex(indexTitle),[indexTitle]);
  const [q,setQ]=useRouteState('siddur-query','');
  // Which groups are open belongs to this history entry: Back restores it, a fresh visit starts collapsed.
  const [expanded,setExpanded]=useRouteState('siddur-expanded',[]);
  const toggleGroup=(key,isOpen)=>{if(q)return;setExpanded(list=>isOpen?(list.includes(key)?list:[...list,key]):list.filter(item=>item!==key));};
  const [progress] = useLocal('reader-progress-v1', {});
  const nodes=resource.data?.schema?.nodes||[];
  const summary = buildSiddurConditionSummary(context);
  // Weekday Mincha of Edot HaMizrach is composed by the prayer engine; its list shows a section only where the composed prayer has a titled part.
  const minchaSections = layout.smartSiddur && settings ? new Set(composeWeekdayMincha({ now: now || new Date(), settings, times }).document.sections.filter(section => section.blocks.some(block => block.type === 'heading')).map(section => section.id)) : null;
  const sectionVisible = (root, name) => (root === 'Weekday Mincha' && minchaSections && MINCHA_SECTION_IDS[name] ? minchaSections.has(MINCHA_SECTION_IDS[name]) : shouldDisplaySiddurSection(name, summary));
  const hiddenItem = (rootEn, itemEn) => isSiddurNavigationItemHidden(rootEn, itemEn) || (layout.hidden || []).some(path => rootKey(path.slice(0, -1)) === rootEn && path.at(-1) === itemEn);
  const has = resource.data?.has || (() => true);
  const roots = siddurRoots(nodes, indexTitle, layout, (root, name) => !hiddenItem(root, name) && sectionVisible(root, name), { has });
  const rootsByKey = new Map(roots.map(root => [root.key, root]));
  const flowData = buildSiddurFlows(roots, openSource);
  const resume = flowData.allItems.find(item => Object.values(progress).includes(item.reference));
  // The Smart Siddur composes the whole service on days it supports — for the rite whose day plan is verified (Edot HaMizrach).
  // The other rites read the printed service, with the same day conditions applied inside the text.
  const smart = layout.smartSiddur;
  const dayContext = smart && settings ? JewishContextEngine({ now: now || new Date(), settings, times, prayerType: 'shacharit' }) : null;
  // Each prayer on its own day: Arvit is the coming night's (Shemini Atzeret tonight while today is still Hoshana Rabbah).
  const supportFor = prayer => {
    if (!smart || !settings) return false;
    if (prayer === 'birkat-hamazon') return true;
    return dayServiceSupport(JewishContextEngine({ now: dayServiceInstant(prayer, now || new Date(), times), settings, times, prayerType: prayer }), { nusach }).supported;
  };
  const daySupport = { supported: ['shacharit', 'mincha', 'maariv'].some(supportFor) };
  // The prayer of this hour wears the living gold frame; it moves on by itself as the day turns.
  const nowPrayer = choosePrayerType(now || new Date(), times);
  const dayNavigation = prayer => ({ flowKey: `smart:${prayer}`, flowTitle: DAY_SERVICE_TITLES[prayer], flow: [], index: 0, returnRoute: 'siddur', backLabel: 'חזרה לסידור', breadcrumbs: [{ label: 'סידור', route: 'siddur' }], onBack: () => history.back() });
  const printedTarget = prayer => {
    const key = prayerRootKey(prayer, { isShabbat: summary.isShabbat, nusach });
    return flowData.allItems.find(item => item.rootEn === key) || flowData.allItems.find(item => item.rootEn === prayerRootKey(prayer, { nusach })) || null;
  };
  const openPrintedPrayer = (prayer, extra = {}) => {
    const target = printedTarget(prayer);
    if (target) openSource(target.reference, target.title, target.mode, flowData.navigation.get(target.reference), extra);
  };
  const openDayService = (prayer, extra = {}) => openSource(`${DAY_SERVICE_PREFIX}${prayer}`, DAY_SERVICE_TITLES[prayer], 'nikud', dayNavigation(prayer), extra);
  useEffect(() => {
    if (!autoOpenPrayer) return;
    if (supportFor(autoOpenPrayer)) { openDayService(autoOpenPrayer, { showCompass: true }); onAutoOpenHandled?.(); return; }
    if (!flowData.allItems.length) return;
    openPrintedPrayer(autoOpenPrayer, { showCompass: true });
    onAutoOpenHandled?.();
  }, [autoOpenPrayer, flowData.allItems.length]);
  const matchesQuery=(next,he)=>!q||normalizeHebrew(next.join(' ')+' '+he).includes(normalizeHebrew(q));
  const hasMatch=(node,path=[])=>{const en=siddurTitle(node,'en');const he=siddurTitle(node,'he');const next=[...path,en];if(node.nodes)return node.nodes.some(n=>hasMatch(n,next));return !hiddenItem(rootKey(path),en)&&matchesQuery(next,he);};
  function render(node,path=[]) {
    const en=siddurTitle(node,'en'); const he=siddurTitle(node,'he'); const next=[...path,en];
    if (node.nodes) {
      const children = node.nodes.filter(child => {
        const childEn = siddurTitle(child, 'en');
        const childHe = siddurTitle(child, 'he');
        const childName = childEn || childHe || '';
        return sectionVisible(rootKey(next), childName) && (!q || hasMatch(child, next));
      });
      if (!children.length && q) return null;
      const groupKey=next.join(',');
      return <details key={groupKey} open={Boolean(q)||expanded.includes(groupKey)} onToggle={event=>toggleGroup(groupKey,event.currentTarget.open)}><summary>{he}</summary>{children.map(n=>render(n,next))}</details>;
    }
    if(hiddenItem(rootKey(path),en))return null;
    if(!sectionVisible(rootKey(path), en))return null;
    if(!matchesQuery(next,he))return null;
    const reference=[indexTitle,...next].join(', ');
    return <button className="prayer-link" key={next.join(',')} onClick={()=>openSource(reference,he,'nikud',flowData.navigation.get(reference))}>{he}<span aria-hidden="true">←</span></button>;
  }
  const noResults=Boolean(q)&&nodes.length>0&&!nodes.some(n=>hasMatch(n));
  // A group's open state is its default, flipped by the reader's own toggles (kept per history entry).
  const isOpen=(key,byDefault=false)=>byDefault!==expanded.includes(key);
  const setOpen=(key,byDefault,open)=>setExpanded(list=>{const flipped=open!==byDefault;const has=list.includes(key);return flipped===has?list:flipped?[...list,key]:list.filter(item=>item!==key);});
  const openItem=item=>openSource(item.reference,item.title,item.mode,flowData.navigation.get(item.reference));
  const SIDDUR_COLLECTIONS = new Set(layout.collections);
  // Roots of the edition that the layout does not place (nothing of the printed siddur is ever lost).
  const covered = new Set([...layout.groups.flatMap(group => group.roots), ...(layout.moadimRoots || []), ...(layout.smartSiddur ? MOADIM_ROOTS.map(root => [root]) : [])].map(path => (Array.isArray(path) ? path[0] : path.key)));
  const leftover = nodes.map(node => siddurTitle(node, 'en')).filter(title => !covered.has(title)).map(title => rootKey([title]));
  const leftoverRoots = leftover.length ? siddurRoots(nodes, indexTitle, { ...layout, groups: [{ key: 'more', title: 'עוד בסידור', roots: leftover.map(title => [title]) }], moadimRoots: [] }, (root, name) => !hiddenItem(root, name) && sectionVisible(root, name), { has }) : [];
  for (const root of leftoverRoots) if (!rootsByKey.has(root.key)) { rootsByKey.set(root.key, root); flowData.allItems.push(...root.items); }
  const groups=[...layout.groups.map(group=>({...group,roots:group.roots.map(path=>rootKey(path)).filter(key=>rootsByKey.has(key))})),{key:'more',title:'עוד בסידור',roots:leftoverRoots.map(root=>root.key)}]
    .filter(group=>group.roots.length||group.missing);
  const siddurEntry=rootEn=>{
    const root=rootsByKey.get(rootEn);const items=root.items;const title=root.title;
    if(SIDDUR_COLLECTIONS.has(rootEn)&&items.length>1){const key=`collection:${rootEn}`;return <details key={rootEn} className="siddur-collection" open={isOpen(key)} onToggle={event=>setOpen(key,false,event.currentTarget.open)}>
      <summary><span className="siddur-entry-text"><strong>{title}</strong></span><span className="siddur-chevron" aria-hidden="true">›</span></summary>
      <div className="siddur-chips">{items.map(item=><button key={item.reference} type="button" onClick={()=>openItem(item)}>{item.title.trim()}</button>)}</div>
    </details>;}
    // Always offered, whatever the season: built from their address, not from the day's filtered list.
    const extras=(layout.extras[rootEn]||[]).map(([path,label])=>{const reference=[indexTitle,...path].join(', ');return {reference,title:label,mode:'nikud'};});
    const entry=<button key={rootEn} type="button" className="siddur-entry" onClick={()=>openItem(items[0])}><span className="siddur-entry-text"><strong>{title}</strong></span><span aria-hidden="true">←</span></button>;
    if(!extras.length)return entry;
    return <div key={rootEn} className="siddur-entry-with-extras">{entry}<div className="siddur-extras" aria-label={`נוסף ל${title}`}>{extras.map(item=><button key={item.reference} type="button" onClick={()=>openItem(item)}>{item.title.trim()}</button>)}</div></div>;
  };
  // The festivals shelf of Edot HaMizrach is always complete (no season filter). Nothing opens by itself: every group waits for a tap.
  const openMoedList=(moed,list,index,endLabel)=>{const item=list[index];openSource(item.reference,item.title,item.mode,{flowKey:`moadim:${moed.key}:${endLabel}`,flowTitle:moed.title,flow:list.map(({reference,title,mode})=>({reference,title,mode})),index,returnRoute:'siddur',backLabel:'חזרה לסידור',breadcrumbs:[{label:'סידור',route:'siddur'},{label:moed.title}],onBack:()=>history.back(),previous:list[index-1]||null,next:list[index+1]||null,endLabel,onSelect:target=>openMoedTarget(moed,list,target,endLabel)});};
  const openMoedItem=(moed,item)=>item.flow?openMoedList(moed,item.flow,0,`סוף ${item.title}`):openMoedList(moed,moed.items,moed.items.indexOf(item),`סיימת את ${moed.title}`);
  const openMoedTarget=(moed,list,target,endLabel)=>{const index=list.findIndex(entry=>entry.reference===target.reference);const shelfItem=list===moed.items&&moed.items[index];if(shelfItem?.flow)return openMoedItem(moed,shelfItem);openMoedList(moed,list,index,endLabel);};
  const moadimGroup=layout.smartSiddur?<details key="moadim" className="siddur-group" open={isOpen('group:moadim')} onToggle={event=>setOpen('group:moadim',false,event.currentTarget.open)}>
    <summary><strong>מועדים</strong><span className="siddur-chevron" aria-hidden="true">›</span></summary>
    <div className="siddur-group-rows">{MOADIM.map(moed=>{const key=`moed:${moed.key}`;return <details key={moed.key} className="siddur-collection" open={isOpen(key)} onToggle={event=>setOpen(key,false,event.currentTarget.open)}>
      <summary><span className="siddur-entry-text"><strong>{moed.title}</strong></span><span className="siddur-chevron" aria-hidden="true">›</span></summary>
      <div className="siddur-chips">{moed.items.map(item=><button key={item.reference} type="button" onClick={()=>openMoedItem(moed,item)}>{item.title}</button>)}</div>
    </details>;})}</div>
  </details>:null;
  const moadimMatches=q&&layout.smartSiddur?MOADIM.flatMap(moed=>moed.items.filter(item=>normalizeHebrew(`${item.title} ${moed.title}`).includes(normalizeHebrew(q))).map(item=>({moed,item}))).filter((match,index,all)=>all.findIndex(other=>other.item.reference===match.item.reference)===index):[];
  const source = SIDDUR_SOURCES[nusach];
  return <section><div className="siddur-toolbar"><div><p className="eyebrow">סידור</p><h1>עת תפילה.</h1></div><div className="siddur-toolbar-actions"><NusachSelector value={nusach} onChange={onNusachChange} /><button type="button" className="siddur-compass-entry" onClick={onOpenCompass} aria-label="פתיחת מצפן תפילה"><span aria-hidden="true">⌖</span><strong>מצפן תפילה</strong></button></div></div>
  {askNusach && <NusachOnboarding value={nusach} onChoose={id => { onNusachChange?.(id); onNusachAsked?.(); }} onDismiss={onNusachAsked} />}
  {daySupport.supported && <section className="day-service-card" aria-label="תפילות היום"><p className="eyebrow">הסידור החכם · {dayContext?.hebrewDate?.label}</p><h2>תפילות היום</h2><div className="day-service-buttons">{['shacharit', 'mincha', 'maariv', 'birkat-hamazon'].map(prayer => { const isNow = prayer === nowPrayer; return <button key={prayer} type="button" className={isNow ? 'is-now' : undefined} aria-current={isNow ? 'time' : undefined} aria-label={isNow ? `${DAY_SERVICE_TITLES[prayer]} — התפילה של השעה הזו` : undefined} onClick={() => (supportFor(prayer) ? openDayService(prayer) : openPrintedPrayer(prayer))}>{DAY_SERVICE_TITLES[prayer]}</button>; })}</div><p>התפילה המלאה לפי היום, עם כל התוספות במקומן.</p></section>}
  {!daySupport.supported && flowData.allItems.length > 0 && <section className="day-service-card" aria-label="תפילות היום"><p className="eyebrow">{context?.hebrewDate?.label || 'היום'}</p><h2>תפילות היום</h2><div className="day-service-buttons">{['shacharit', 'mincha', 'maariv'].filter(prayer => printedTarget(prayer)).map(prayer => { const isNow = prayer === nowPrayer; return <button key={prayer} type="button" className={isNow ? 'is-now' : undefined} aria-current={isNow ? 'time' : undefined} aria-label={isNow ? `${DAY_SERVICE_TITLES[prayer]} — התפילה של השעה הזו` : undefined} onClick={() => openPrintedPrayer(prayer)}>{DAY_SERVICE_TITLES[prayer]}</button>; })}</div><p>{summary.isShabbat ? 'תפילות השבת' : 'תפילות החול'} בנוסח {source ? nusachTitleOf(nusach) : ''}; התוספות של היום מסומנות בתוך התפילה.</p></section>}
  <a className="prayer-link forgotten-entry" href="#forgotten-addition"><strong>שכחתי תוספת — מה עושים?</strong><span aria-hidden="true">←</span></a>{resume && <button className="resume-reading" onClick={()=>openSource(resume.reference,resume.title,'nikud',flowData.navigation.get(resume.reference))}><span>המשך קריאה</span><strong>{resume.title}</strong><b aria-hidden="true">←</b></button>}<ClearableInput className="book-search" aria-label="חיפוש תפילה" placeholder="מצאו תפילה או ברכה" value={q} onChange={e=>setQ(e.target.value)} clearLabel="נקה חיפוש תפילה" type="search"/><ResourceState resource={resource}/>{noResults&&!moadimMatches.length&&<p className="notice" role="status">לא נמצאה תפילה בשם הזה. נסו ניסוח אחר או עיינו בתוכן העניינים.</p>}{q?<div className="siddur-index">{moadimMatches.map(({moed,item})=><button className="prayer-link" key={`moadim:${item.reference}`} onClick={()=>openMoedItem(moed,item)}>{item.title}<span aria-hidden="true">←</span></button>)}{nodes.map(n=>render(n))}</div>:<div className="siddur-groups">{groups.flatMap((group,groupIndex)=>{const key=`group:${group.key}`;return [<details key={group.key} className="siddur-group" open={isOpen(key,Boolean(group.open))} onToggle={event=>setOpen(key,Boolean(group.open),event.currentTarget.open)}>
    <summary><strong>{group.title}</strong><span className="siddur-chevron" aria-hidden="true">›</span></summary>
    <div className="siddur-group-rows">{group.roots.map(siddurEntry)}{group.missing&&<p className="siddur-missing" role="note">{group.missing}</p>}</div>
  </details>,group.key==='seasons'&&moadimGroup];}).filter(Boolean)}</div>}
  <div className="siddur-home-links"><button type="button" className="link" onClick={()=>go?.('siddur-sources')}>פרטי מקור ורישיון</button><button type="button" className="link" onClick={()=>go?.('siddur-compare')}>הבדלים בין נוסחים</button></div>
  </section>;
}
function nusachTitleOf(id) { return nusachLabel(id).replace(/^נוסח /, ''); }
// A reading of several parts, one row each: the parasha it belongs to (or its book) in bold, its range beneath, one
// arrow; a tap opens that part alone. Rows share one card, parted by hairlines.
function readingName(ref) {
  const range = parseTanakhRef(ref);
  if (!range) return null;
  const at = range.startChapter * 1000 + range.startVerse;
  const parasha = SHNAYIM_MIKRA_CANONICAL_RANGES.find(item => {
    if (item.combined) return false;
    const r = parseTanakhRef(item.reference);
    return r && r.workId === range.workId && at >= r.startChapter * 1000 + r.startVerse && at <= r.endChapter * 1000 + r.endVerse;
  });
  return parasha ? `פרשת ${parasha.he}` : formatTanakhReferences(ref).replace(/\s+[^\s]+,.*$/, '');
}
function ReadingList({ refs, openSource }) {
  return <div className="reading-list">{refs.map(ref => { const name = readingName(ref); const full = formatTanakhReferences(ref); return <button key={ref} type="button" className="reading-item" onClick={() => openSource(ref, name ? `${name} · ${full}` : full, 'cantillation')}>
    <span className="reading-item-text">{name && <strong>{name}</strong>}<span className="reading-item-ref"><TanakhRefText text={full} /></span></span><span className="reading-item-arrow" aria-hidden="true">←</span>
  </button>; })}</div>;
}

export function ParashaPage({context,settings,openSource,onOpenShnayim}) {
  const p=context.shabbatReading;
  const isHoliday=p?.category==='holiday';
  const reading=p?.leyning;
  // Sephardic haftarah when Hebcal distinguishes one; otherwise the common reading.
  const haftarah=reading?.haftarah_sephardic||reading?.haftarah;
  const dateKey=p?.date?.slice?.(0,10);
  const hebrewLabel=dateKey?hebrewDate(dateKey)?.label:null;
  const displayReference = reference => <TanakhRefText text={formatTanakhReferences(reference)} />;
  const holidayParashaDate = context?.parasha?.date?.slice?.(0, 10);
  return <section><p className="eyebrow">קריאת התורה · {calendarIsIsrael(settings)?'ארץ ישראל':'חוץ לארץ'}</p><h1>{p?.hebrew||'פרשת השבוע'}</h1>{context.parasha && <button type="button" className="index-row shnayim-entry" onClick={onOpenShnayim}><strong>שניים מקרא ואחד תרגום</strong><span>{context.parasha.hebrew}</span><span aria-hidden="true">←</span></button>}{!p?<p className="notice">קריאת השבוע תוצג כשנתוני הלוח יהיו זמינים.</p>:<><p className="intro">{dateKey ? <LtrDate value={dateKey} /> : ''}{hebrewLabel?` · ${hebrewLabel}`:''}{isHoliday && context.parasha ? <> · בשבת זו קוראים בקריאת החג; פרשת {context.parasha.hebrew?.replace(/^פרשת /,'')} תיקרא בתאריך <LtrDate value={holidayParashaDate} /></> : null}</p>{reading?.torah&&<section className="reading-section"><h2>{isHoliday?'קריאת התורה של החג':'קריאת הפרשה'}</h2><ReadingList refs={splitReference(reading.torah)} openSource={openSource}/></section>}{haftarah?<section className="reading-section"><h2>{reading?.haftarah_sephardic?'הפטרה · ספרדים':'הפטרה'}</h2><ReadingList refs={haftarah.split(' | ')[0].split(';').map(ref=>ref.trim()).filter(Boolean)} openSource={openSource}/></section>:<p className="notice">לא התקבל מראה מקום להפטרה.</p>}<details><summary>עליות ומפטיר · לפי Hebcal</summary>{Object.entries(reading||{}).filter(([key])=>/^\d$/.test(key)||key==='maftir').map(([key,ref])=><button className="prayer-link" key={key} onClick={()=>openSource(ref,undefined,'cantillation')}><span>{key==='maftir'?'מפטיר':'עלייה '+key}</span><span>{displayReference(ref)}</span></button>)}</details></>}</section>;
}
