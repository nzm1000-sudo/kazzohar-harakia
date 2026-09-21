import { useEffect, useState } from 'react';
import { halachot, categories, matches, normalizeHebrew } from '../content.mjs';
import { useLocal, useResource } from '../hooks.jsx';
import { getIndex, searchHalachaTopic, sefariaLink } from '../services/sefaria.mjs';
import { HALACHA_CONTENT_TYPES, HALACHA_TOPIC_REFERENCES, HALACHA_TOPICS, HALACHA_WORKS, topicDefinition, topicMatches } from '../data/halachaLibrary.mjs';
import { ResourceState } from '../components/SourceReader.jsx';
import { BackNavigation, Breadcrumbs } from '../components/LocalNavigation.jsx';

const countIndexLeaves = node => node?.nodes ? node.nodes.reduce((total, child) => total + countIndexLeaves(child), 0) : (node ? 1 : 0);

export function HalachaPage({openSource, initialTopic = '', parentTopic = '', onOpenTopic, onBack}) {
  const [q,setQ]=useState('');
  const [submitted,setSubmitted]=useState(initialTopic);
  const [topic,setTopic]=useState('');
  const [saved]=useLocal('source-favorites',[]);
  const sourceIndexes=useResource(()=>Promise.all(HALACHA_WORKS.filter(work=>work.copyrightStatus==='public-domain').map(work=>getIndex(work.indexTitle))),[]);
  const activeTopic=topicDefinition(submitted);
  const searchResults=useResource(()=>submitted?searchHalachaTopic(submitted,activeTopic.queries):Promise.resolve([]),[submitted]);
  const visibleTopics=HALACHA_TOPICS.map(item=>({...item, children:item.children.filter(child=>HALACHA_TOPIC_REFERENCES[child])})).filter(item=>!topic||item.id===topic||topicMatches(item,topic));
  const sourceWorks=HALACHA_WORKS.filter(work=>work.copyrightStatus==='public-domain');
  useEffect(() => { setSubmitted(initialTopic); setQ(''); }, [initialTopic]);
  const goBackToTopic = () => history.back();
  return <section className="halacha-library">{initialTopic&&<><BackNavigation label="חזרה להלכה" onClick={onBack}/><Breadcrumbs items={[{label:'הלכה',onNavigate:onBack},...(parentTopic&&parentTopic!=='הלכה'?[{label:parentTopic}]:[]),{label:activeTopic.title}]} onNavigate={item=>item.onNavigate?.()}/></>}<p className="eyebrow">בית המדרש · ספרדים ועדות המזרח</p><h1>{initialTopic?activeTopic.title:'ספריית הלכה ספרדית.'}</h1><p className="intro">מקורות פתוחים ומאומתים לעיון. מקור קלאסי אינו מוצג כאן כפסק מעשי של פוסק בן זמננו.</p><form className="halacha-search" onSubmit={e=>{e.preventDefault();setSubmitted(q.trim());}}><label htmlFor="halacha-search">חיפוש בהלכה</label><div><input id="halacha-search" value={q} onChange={e=>setQ(e.target.value)} placeholder="מותר לחמם מרק בשבת? · שכח יעלה ויבוא · ברכה אחרונה על אורז"/><button type="submit">חיפוש</button></div></form>{submitted&&<section className="halacha-results"><div className="section-heading"><div><p className="eyebrow">נושא / חיפוש</p><h2>{activeTopic.title}</h2></div><button className="link" type="button" onClick={()=>{setSubmitted('');setQ('');}}>ניקוי</button></div><p className="topic-description">{activeTopic.description}</p>{searchResults.loading&&<p className="notice">מחפש במקורות…</p>}{searchResults.error&&<p className="notice error">{searchResults.error}</p>}{!searchResults.loading&&!searchResults.error&&!searchResults.data?.length&&<p className="notice">לא נמצא מקור מאומת במקורות הפתוחים עבור השאלה הזו.</p>}<div className="book-index">{searchResults.data?.map(result=><button className="index-row" key={result.ref} onClick={()=>openSource(result.ref,result.title,'nikud',{backLabel:`חזרה ל${activeTopic.title}`,breadcrumbs:[{label:'הלכה',onNavigate:onBack},...(parentTopic&&parentTopic!=='הלכה'?[{label:parentTopic}]:[]),{label:activeTopic.title}],onBack:goBackToTopic})}><span><strong>{result.title}</strong><small>{result.ref} · מקור פתוח לפי מטא־דאטה של המהדורה</small>{result.snippet&&<em>{result.snippet}</em>}</span><span aria-hidden="true">←</span></button>)}</div></section>}{saved.length>0&&<details className="saved-sources"><summary>המקורות ששמרתי</summary>{saved.map(ref=><button className="index-row" key={ref} onClick={()=>openSource(ref)}>{ref}</button>)}</details>}<div className="halacha-layout"><aside className="topic-panel"><h2>נושאים</h2><button className={!topic?'topic-button active':'topic-button'} onClick={()=>setTopic('')}>כל הנושאים</button>{HALACHA_TOPICS.map(item=><button className={topic===item.id?'topic-button active':'topic-button'} key={item.id} onClick={()=>setTopic(item.id)}>{item.title}<small>{item.children.filter(child=>HALACHA_TOPIC_REFERENCES[child]).length} תתי־נושאים · {item.children.reduce((total, child) => total + (HALACHA_TOPIC_REFERENCES[child]?.length || 0), 0)} מקורות</small></button>)}</aside><div className="topic-content"><section><div className="section-heading"><h2>{topic?HALACHA_TOPICS.find(item=>item.id===topic)?.title:'מפת הספרייה'}</h2><span>{HALACHA_CONTENT_TYPES.map(([,label])=>label).join(' · ')}</span></div><div className="topic-grid">{visibleTopics.map(item=><article className="topic-card" key={item.id}><h3>{item.title}</h3><p>{item.aliases.join(' · ')}</p><div>{item.children.map(child=><button key={child} onClick={()=>onOpenTopic?.(child,item.title)}>{child}</button>)}</div><small className="topic-count">{item.children.reduce((total, child) => total + (HALACHA_TOPIC_REFERENCES[child]?.length || 0), 0)} מקורות ממופים</small></article>)}</div></section><section className="source-catalog"><div className="section-heading"><h2>מקורות פתוחים</h2><span>{sourceWorks.length} סדרות מאומתות · {sourceIndexes.data?.reduce((total, index) => total + countIndexLeaves(index.schema), 0) || '…'} יחידות במפתח</span></div><div className="source-work-grid">{sourceWorks.map((work,index)=><article className="source-work" key={work.id}><p className="eyebrow">{work.tradition}</p><h3>{work.title}</h3><p>{work.author}</p><small>{work.license} · {work.provider}</small><span>{sourceIndexes.data?.[index] ? `${countIndexLeaves(sourceIndexes.data[index].schema)} יחידות במפתח` : 'טוען מפתח…'}</span><a href={work.sourceUrl} target="_blank" rel="noreferrer">פרטי המקור ↗</a></article>)}</div></section></div></div></section>;
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
  function render(node,path=[]) {
    const en=siddurTitle(node,'en'); const he=siddurTitle(node,'he'); const next=[...path,en];
    if(node.nodes) return <details key={next.join(',')} open={Boolean(q)}><summary>{he}</summary>{node.nodes.map(n=>render(n,next))}</details>;
    if(isSiddurNavigationItemHidden(path[0],en))return null;
    if(q&&!normalizeHebrew(next.join(' ')+' '+he).includes(normalizeHebrew(q)))return null;
    const reference=['Siddur Edot HaMizrach',...next].join(', ');
    const item=flowData.allItems.find(entry => entry.reference === reference);
    return <button className="prayer-link" key={next.join(',')} onClick={()=>openSource(reference,he,'nikud',flowData.navigation.get(reference))}>{he}<span aria-hidden="true">←</span></button>;
  }
  return <section><div className="siddur-toolbar"><div><p className="eyebrow">סידור · נוסח עדות המזרח</p><h1>עת תפילה.</h1></div><button type="button" className="siddur-compass-entry" onClick={onOpenCompass} aria-label="פתיחת מצפן תפילה"><span aria-hidden="true">⌖</span><strong>מצפן תפילה</strong></button></div><p className="intro">תוכן עניינים מסודר לתפילות היום. הוראות וחלופות נשמרות כפי שהן מופיעות במהדורה.</p><a className="prayer-link forgotten-entry" href="#forgotten-addition"><strong>שכחתי תוספת — מה עושים?</strong><span aria-hidden="true">←</span></a>{resume && <button className="resume-reading" onClick={()=>openSource(resume.reference,resume.title,'nikud',flowData.navigation.get(resume.reference))}><span>המשך קריאה</span><strong>{resume.title}</strong><b aria-hidden="true">←</b></button>}{context.additions.map(a=><p className="prayer-note" key={a.text}>{a.text} · <button className="link" onClick={()=>openSource(a.ref,'תוספת בתפילה')}>לקריאה</button></p>)}<input className="book-search" aria-label="חיפוש תפילה" placeholder="מצאו תפילה או ברכה" value={q} onChange={e=>setQ(e.target.value)}/><ResourceState resource={resource}/><div className="siddur-index">{nodes.map(n=>render(n))}</div></section>;
}
export function ParashaPage({context,settings,openSource}) {
  const p=context.parasha;
  const reading=p?.leyning;
  const haftarah=reading?.haftarah_sephardic;
  return <section><p className="eyebrow">קריאת התורה · {settings.il?'ארץ ישראל':'חוץ לארץ'}</p><h1>{p?.hebrew||'פרשת השבוע'}</h1>{!p?<p className="notice">קריאת השבוע תוצג כשנתוני הלוח יהיו זמינים.</p>:<><p className="intro">{p.date} · {p.hdate}</p>{reading?.torah&&<button className="index-row" onClick={()=>openSource(reading.torah,p.hebrew,'cantillation')}><strong>לקריאת הפרשה</strong><span className="reference-ltr" dir="ltr">{reading.torah}</span><span aria-hidden="true">←</span></button>}{haftarah?<div className="reading-section"><h2>הפטרה · ספרדים</h2>{haftarah.split(' | ')[0].split(';').map(ref=><button key={ref} className="prayer-link" onClick={()=>openSource(ref.trim(),undefined,'cantillation')}><span className="reference-ltr" dir="ltr">{ref.trim()}</span><span aria-hidden="true">←</span></button>)}</div>:<p className="notice">לא התקבל מראה מקום מובחן להפטרה הספרדית.</p>}<details><summary>עליות ומפטיר · לפי Hebcal</summary>{Object.entries(reading||{}).filter(([key])=>/^\d$/.test(key)||key==='maftir').map(([key,ref])=><button className="prayer-link" key={key} onClick={()=>openSource(ref,undefined,'cantillation')}><span>{key==='maftir'?'מפטיר':'עלייה '+key}</span><span className="reference-ltr" dir="ltr">{ref}</span></button>)}</details></>}</section>;
}
