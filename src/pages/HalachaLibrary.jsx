import { Suspense, lazy, startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { backTo, currentEntryKey, entryRecord } from '../services/scrollRestoration.mjs';
import { openedFromIndex, parseHalachaIndexRoute } from '../services/halachaIndexRoute.mjs';
import { routeParts } from '../services/safeRoute.mjs';
import { useLocal, useResource, useStudyTimer } from '../hooks.jsx';
import { StudyCompletion } from '../components/CompletionButton.jsx';
import { HALACHA_TOPICS, HALACHA_WORKS, workForReference } from '../data/halachaLibrary.mjs';
import { localLibraryRoute } from '../services/library/localRefs.mjs';
import { hebrewLocations, hebrewNumeral } from '../services/hebrewNumerals.mjs';
import { HALACHA_QUESTIONS, HALACHA_QUESTION_INDEX, SOURCE_ROLE_LABELS, questionsForTopic } from '../data/halachaQuestions.mjs';
import { PRACTICAL_HALACHA_QA, PRACTICAL_HALACHA_QA_INDEX } from '../data/practicalHalachaQa.mjs';
import { searchHalacha, questionKeyTerms, entryRelevance, isRelevantSection } from '../services/halachaSearch.mjs';
import { conceptFor } from '../data/halachaConcepts.mjs';
import { searchYalkut } from '../services/yalkutYosef.mjs';
import { browsableWorks, workById, bookOutline, unitSections } from '../services/halachaBooks.mjs';
import { pickDailyHalacha } from '../services/halachaContext.mjs';
import { halachotForNow, guideForNow, relatedWithReasons, readRecentHalachot, recordHalachaOpened, RULE_TYPE_LABELS } from '../services/halachaEngine.mjs';
import { readFavorites, onFavoritesChange, routeFavorite } from '../services/favorites.mjs';
import HeartToggle from '../components/HeartToggle.jsx';
import { ContextGuide, FlowView, QuickSituations, RoutedLead, ConceptLead, RabbiDraft, flowRoute, SiddurHalachaPage } from '../components/halacha/HalachaHubParts.jsx';
import { SIDDUR_HALACHA } from '../data/halachaSiddurLinks.mjs';
import { HALACHA_TRACKS, HALACHA_TRACK_INDEX } from '../data/halachaTracks.mjs';
import GlossaryText from '../components/halacha/GlossaryText.jsx';
import { PersonalActions, CollectionsPage, CollectionPage, TracksList, TrackPage, RecallCard, collectionsRoute, trackRoute } from '../components/halacha/HalachaPersonal.jsx';
import { readCollections } from '../services/collections.mjs';
import { recordSearchOutcome } from '../services/halachaGaps.mjs';
// Source map and comparison load only when a question page asks for them.
const SourceDepth = lazy(() => import('../components/halacha/SourceDepth.jsx'));
// A question answered from עונג שבת: its three layers, the book's notes and the Yalkut Yosef parallels.
const OngShabbatAnswer = lazy(() => import('../components/halacha/OngShabbatParts.jsx'));
import { flowsForEntry } from '../services/halachaDecision.mjs';
import { routeHalachaQuery } from '../services/halachaIntent.mjs';
import { detectPrayerTimeQuestion } from '../services/halachaTime.mjs';
import { HALACHA_FLOW_INDEX } from '../data/halachaFlows.mjs';
// The conversational assistant and its model layer load only when opened.
const HalachaChat = lazy(() => import('../components/halacha/HalachaChat.jsx'));
const HalachaIndex = lazy(() => import('../components/halacha/HalachaIndex.jsx'));
import { BackNavigation, Breadcrumbs } from '../components/LocalNavigation.jsx';
import ReaderNavigation from '../components/ReaderNavigation.jsx';
import { ResourceState } from '../components/SourceReader.jsx';
import ClearableInput from '../components/ClearableInput.jsx';
import OfflineInvite from '../components/OfflineInvite.jsx';

// Route shapes: halacha | halacha/all[/<group>[/<topic>]] | halacha/f/<flow>[/<answers>] | halacha/c/<cat> | halacha/t/<cat>/<topic> | halacha/q/<id> | halacha/b | halacha/b/<work> | halacha/b/<work>/<unit>
export function parseHalachaRoute(mode) {
  const parts = routeParts(mode);
  if (parts[1] === 'c') return { view: 'category', category: parts[2] };
  if (parts[1] === 't') return { view: 'topic', category: parts[2], topic: parts[3] };
  if (parts[1] === 'q') return { view: 'question', id: parts[2] };
  if (parts[1] === 'chat') return { view: 'chat' };
  if (parts[1] === 'all') return parseHalachaIndexRoute(mode);
  if (parts[1] === 'topics') return { view: 'topics' };
  if (parts[1] === 'collections') return parts[2] ? { view: 'collection', id: parts[2] } : { view: 'collections' };
  if (parts[1] === 'track') return { view: 'track', id: parts[2] };
  if (parts[1] === 'ctx') return { view: 'siddur', section: parts[2], prayer: parts[3] || null };
  if (parts[1] === 'f') return { view: 'flow', flow: parts[2], path: parts[3] ? parts[3].split('-').map(Number).filter(Number.isInteger) : [] };
  if (parts[1] === 'b') return parts[3] ? { view: 'unit', work: parts[2], unit: parts.slice(3).join('/') } : parts[2] ? { view: 'work', work: parts[2] } : { view: 'books' };
  return { view: 'root' };
}
export const halachaRoute = {
  category: id => `halacha/c/${encodeURIComponent(id)}`,
  topic: (cat, topic) => `halacha/t/${encodeURIComponent(cat)}/${encodeURIComponent(topic)}`,
  question: id => `halacha/q/${encodeURIComponent(id)}`,
  books: () => 'halacha/b',
  work: id => `halacha/b/${encodeURIComponent(id)}`,
  unit: (id, key) => `halacha/b/${encodeURIComponent(id)}/${encodeURIComponent(key)}`,
};

const PARASHA_HE = { Bereshit: 'בראשית', Noach: 'נח', 'Lech Lecha': 'לך לך', Vayera: 'וירא', 'Chayei Sara': 'חיי שרה', Toldot: 'תולדות', Vayetzei: 'ויצא', Vayishlach: 'וישלח', Vayeshev: 'וישב', Miketz: 'מקץ', Vayigash: 'ויגש', Vayechi: 'ויחי', Shemot: 'שמות', Vaera: 'וארא', Bo: 'בא', Beshalach: 'בשלח', Yitro: 'יתרו', Mishpatim: 'משפטים', Terumah: 'תרומה', Tetzaveh: 'תצוה', 'Ki Tisa': 'כי תשא', Vayakhel: 'ויקהל', Pekudei: 'פקודי', Vayikra: 'ויקרא', Tzav: 'צו', Shmini: 'שמיני', Tazria: 'תזריע', Metzora: 'מצורע', 'Tazria Metzora': 'תזריע־מצורע', 'Achrei Mot': 'אחרי מות', Kedoshim: 'קדושים', 'Achrei Mot Kedoshim': 'אחרי מות־קדושים', Emor: 'אמור', 'Behar Bechukotai': 'בהר־בחוקותי', Bamidbar: 'במדבר', Nasso: 'נשא', "Beha'alotcha": 'בהעלותך', "Sh'lach": 'שלח', Korach: 'קרח', Chukat: 'חוקת', Balak: 'בלק', Pinchas: 'פינחס', Matot: 'מטות', Masei: 'מסעי', Devarim: 'דברים', Vaetchanan: 'ואתחנן', Eikev: 'עקב', "Re'eh": 'ראה', Shoftim: 'שופטים', 'Ki Teitzei': 'כי תצא', 'Ki Tavo': 'כי תבוא', Nitzavim: 'נצבים', Vayeilech: 'וילך', "Ha'Azinu": 'האזינו', "V'Zot HaBerachah": 'וזאת הברכה', Chanukah: 'חנוכה' };
const heRef = ref => {
  let out = ref
  .replace('Shulchan Arukh, Orach Chayim', 'שולחן ערוך, אורח חיים').replace("Shulchan Arukh, Yoreh De'ah", 'שולחן ערוך, יורה דעה')
  .replace('Shulchan Arukh, Choshen Mishpat', 'שולחן ערוך, חושן משפט').replace('Shulchan Arukh, Even HaEzer', 'שולחן ערוך, אבן העזר')
  .replace('Peninei Halakhah, Women\'s Prayer', 'פניני הלכה, תפילת נשים').replace('Peninei Halakhah, Family Purity', 'פניני הלכה, טהרת המשפחה')
  .replace('Peninei Halakhah, Berakhot', 'פניני הלכה, ברכות').replace('Peninei Halakhah, Shabbat', 'פניני הלכה, שבת').replace('Peninei Halakhah, Prayer', 'פניני הלכה, תפילה')
  .replace('Peninei Halakhah, Kashrut', 'פניני הלכה, כשרות').replace('Peninei Halakhah, Zemanim', 'פניני הלכה, זמנים').replace('Peninei Halakhah, Festivals', 'פניני הלכה, מועדים')
  .replace('Peninei Halakhah, Pesach', 'פניני הלכה, פסח').replace('Peninei Halakhah, Sukkot', 'פניני הלכה, סוכות').replace('Peninei Halakhah, Likkutim II', 'פניני הלכה, ליקוטים ב').replace('Peninei Halakhah, Likkutim I', 'פניני הלכה, ליקוטים א')
  .replace('Ben Ish Hai, Halachot 1st Year', 'בן איש חי, שנה ראשונה').replace('Ben Ish Hai, Halachot 2nd Year', 'בן איש חי, שנה שנייה')
  .replace('Kaf HaChayim on Shulchan Arukh, Orach Chayim', 'כף החיים, אורח חיים').replace('Beit Yosef, Orach Chayim', 'בית יוסף, אורח חיים')
  .replace("Beit Yosef, Yoreh De'ah", 'בית יוסף, יורה דעה').replace('Beit Yosef, Even HaEzer', 'בית יוסף, אבן העזר').replace('Beit Yosef, Choshen Mishpat', 'בית יוסף, חושן משפט')
  .replace(/^Tur, Orach Chay?im/, 'טור, אורח חיים').replace(/^Tur, Yoreh De'?ah/, 'טור, יורה דעה').replace(/^Tur, Even HaEzer/, 'טור, אבן העזר').replace(/^Tur, Choshen Mishpat/, 'טור, חושן משפט')
  .replace('Yalkut Yosef', 'ילקוט יוסף, קיצור שולחן ערוך')
  .replace('Korban HaEdah on Jerusalem Talmud', 'קרבן העדה על תלמוד ירושלמי')
  .replace('Maaseh Rokeach on Mishnah', 'מעשה רוקח על המשנה')
  .replace('Kisse Rahamim on Tractate Soferim', 'כיסא רחמים על מסכת סופרים');
  // Simanim, seifim, chapters and halachot in Hebrew numerals, as they are learnt ("סימן רס״ג, סעיף א׳").
  const he = n => hebrewNumeral(Number(n));
  if (out.startsWith('בן איש חי')) out = out.replace(/, ([^,\d]+?)(?: (\d+)(?:-\d+)?)?$/, (_, p, n, full) => `, פרשת ${PARASHA_HE[p.trim()] || p}${n && !/-/.test(_) ? `, סעיף ${he(n)}` : ''}`);
  else if (/^(שולחן ערוך|כף החיים|בית יוסף|טור)/.test(out)) out = / (\d+):(\d+)$/.test(out) ? out.replace(/ (\d+):(\d+)$/, (_, a, b) => ` סימן ${he(a)}, סעיף ${he(b)}`) : out.replace(/ (\d+)$/, (_, a) => ` סימן ${he(a)}`);
  else if (out.startsWith('פניני הלכה')) out = / (\d+):(\d+)$/.test(out) ? out.replace(/ (\d+):(\d+)$/, (_, a, b) => ` פרק ${he(a)}, הלכה ${he(b)}`) : out.replace(/ (\d+)$/, (_, a) => ` פרק ${he(a)}`);
  return hebrewLocations(out);
};
const heLicense = license => ({ 'Public Domain': 'נחלת הכלל', 'CC-BY-NC': 'רישיון שימוש לא־מסחרי', 'CC BY-NC-SA 2.5': 'רישיון שימוש לא־מסחרי ובשיתוף זהה' }[license] || license || '');
const ONG_COUNT = PRACTICAL_HALACHA_QA.filter(item => item.sourceBook === 'ong-shabbat').length;
const displayQuestionsForTopic = topic => [
  ...PRACTICAL_HALACHA_QA.filter(item => item.topic === topic && item.answerStatus === 'published'),
  ...questionsForTopic(topic),
];

export default function HalachaLibrary({ route, openSource, go, back, context, tzid = 'Asia/Jerusalem' }) {
  const [storedQ, setStoredQ] = useLocal('halacha-query-v1', '');
  // The field keeps its own text (SearchBox): a keystroke renders only the field, never this page. The page hears
  // the query once typing pauses, and searches it as a low-priority update that never blocks the keyboard.
  const [submittedQ, setSubmittedQ] = useState(storedQ);
  const [searchQ, setSearchQ] = useState(storedQ);
  const setQ = value => startTransition(() => setSearchQ(value));
  const submitQ = value => startTransition(() => { setSearchQ(value); setSubmittedQ(value); });
  const clearQ = () => { setSearchQ(''); setSubmittedQ(''); };
  const q = searchQ;
  const cat = HALACHA_TOPICS.find(c => c.id === route.category);
  const question = route.view === 'question' ? PRACTICAL_HALACHA_QA_INDEX[route.id] || HALACHA_QUESTION_INDEX[route.id] : null;
  const qCat = question ? HALACHA_TOPICS.find(c => c.id === question.category) : null;
  const results = useMemo(() => searchHalacha(searchQ), [searchQ]);
  // Sensitive questions (purity, health, personal) are never kept, however they are worded — decided from the one search.
  useEffect(() => { setStoredQ(results.sensitive || routeHalachaQuery(searchQ).intent === 'personal-case' ? '' : searchQ); }, [results]);
  const work = route.work ? workById(route.work) : null;
  // A question tapped in "מאגר השאלות השלם" opens the chat; its Back returns to that same group, opened, in place.
  const chatFromIndex = route.view === 'chat' && openedFromIndex(entryRecord(currentEntryKey())?.prevHash);
  const crumbs = [{ label: 'הלכה', onNavigate: () => go('halacha') }];
  if (route.view === 'category' && cat) crumbs.push({ label: cat.title });
  if (route.view === 'topic' && cat) crumbs.push({ label: cat.title, onNavigate: () => go(halachaRoute.category(cat.id)) }, { label: route.topic });
  if (question && qCat) crumbs.push({ label: qCat.title, onNavigate: () => go(halachaRoute.category(qCat.id)) }, { label: question.topic, onNavigate: () => go(halachaRoute.topic(qCat.id, question.topic)) }, { label: question.question });
  if (route.view === 'books') crumbs.push({ label: 'ספרים' });
  if (route.view === 'chat') crumbs.push(...(chatFromIndex ? [{ label: 'מאגר השאלות השלם', onNavigate: () => history.back() }] : []), { label: 'הלכה חכמה' });
  if (route.view === 'all') crumbs.push({ label: 'מאגר השאלות השלם' });
  if (route.view === 'topics') crumbs.push({ label: 'כל הנושאים' });
  if (route.view === 'collections') crumbs.push({ label: 'האוספים שלי' });
  if (route.view === 'collection') crumbs.push({ label: 'האוספים שלי', onNavigate: () => go(collectionsRoute()) }, { label: 'אוסף' });
  if (route.view === 'track') crumbs.push({ label: HALACHA_TRACK_INDEX[route.id]?.title || 'מסלול' });
  if (route.view === 'siddur') crumbs.push({ label: SIDDUR_HALACHA[route.section]?.title || 'הלכה לתפילה' });
  if (route.view === 'flow') crumbs.push({ label: 'בירור מהיר' }, { label: HALACHA_FLOW_INDEX[route.flow]?.title || '' });
  if ((route.view === 'work' || route.view === 'unit') && work) crumbs.push({ label: 'ספרים', onNavigate: () => go(halachaRoute.books()) }, route.view === 'unit' ? { label: work.title, onNavigate: () => go(halachaRoute.work(work.id)) } : { label: work.title });
  const backLabel = chatFromIndex ? 'חזרה למאגר השאלות' : route.view === 'collection' ? 'חזרה לאוספים' : route.view === 'siddur' ? 'חזרה לתפילה' : route.view === 'flow' ? (route.path.length ? 'לשאלה הקודמת' : 'חזרה להלכה') : route.view === 'topic' ? `חזרה ל${cat?.title || 'הלכה'}` : route.view === 'question' ? `חזרה ל${question?.topic || 'הלכה'}` : route.view === 'work' ? 'חזרה לספרים' : route.view === 'unit' ? `חזרה ל${work?.title || 'ספר'}` : 'חזרה להלכה';
  const backTarget = chatFromIndex ? null : route.view === 'collection' ? collectionsRoute() : route.view === 'siddur' ? null : route.view === 'flow' ? (route.path.length ? `halacha/f/${encodeURIComponent(route.flow)}${route.path.length > 1 ? `/${route.path.slice(0, -1).join('-')}` : ''}` : 'halacha') : route.view === 'question' && qCat ? halachaRoute.topic(qCat.id, question.topic) : route.view === 'topic' && cat ? halachaRoute.category(cat.id) : route.view === 'work' ? halachaRoute.books() : route.view === 'unit' && work ? halachaRoute.work(work.id) : 'halacha';

  return <section className="halacha-library">
    {route.view !== 'root' && <><BackNavigation label={backLabel} onClick={() => (backTarget ? backTo(backTarget, () => go(backTarget)) : history.back())} /><Breadcrumbs items={crumbs} /></>}
    {route.view === 'root' && <Root q={q} searchQ={searchQ} setQ={setQ} submitQ={submitQ} clearQ={clearQ} submittedQ={submittedQ} results={results} go={go} openSource={openSource} context={context} />}
    {route.view === 'category' && cat && <Category cat={cat} go={go} />}
    {route.view === 'topic' && cat && <Topic cat={cat} topic={route.topic} go={go} />}
    {route.view === 'question' && question && <Question question={question} cat={qCat} go={go} openSource={openSource} context={context} tzid={tzid} />}
    {route.view === 'question' && !question && <p className="notice">השאלה לא נמצאה במאגר המקומי.</p>}
    {route.view === 'books' && <Books go={go} />}
    {route.view === 'chat' && <Suspense fallback={<p className="notice">טוען…</p>}><HalachaChat go={go} openSource={openSource} context={context} /></Suspense>}
    {route.view === 'topics' && <TopicsPage go={go} />}
    {route.view === 'all' && <Suspense fallback={<p className="notice">טוען…</p>}><HalachaIndex go={go} route={route} /></Suspense>}
    {route.view === 'collections' && <CollectionsPage go={go} />}
    {route.view === 'collection' && <CollectionPage id={route.id} go={go} />}
    {route.view === 'track' && <TrackPage id={route.id} go={go} />}
    {route.view === 'siddur' && <SiddurHalachaPage sectionKey={route.section} prayer={route.prayer} context={context} go={go} />}
    {route.view === 'flow' && <FlowView flowId={route.flow} path={route.path} go={go} openSource={openSource} />}
    {route.view === 'work' && work && <Work work={work} go={go} />}
    {route.view === 'unit' && work && <Unit work={work} unitKey={route.unit} go={go} openSource={openSource} />}
    {(route.view === 'work' || route.view === 'unit') && !work && <p className="notice">הספר אינו ברשימת המקורות המאושרים.</p>}
  </section>;
}

function Books({ go }) {
  return <>
    <p className="eyebrow">עיון לפי ספר</p><h1>ספרי ההלכה בספרייה</h1>
    <p className="intro">ספר ← חלק ← סימן ← סעיף. המבנה נטען מספריא לפי הסכמת הספר (schema), לא לפי מיקום במערך.</p>
    <div className="book-index">{browsableWorks().map(w => <button className="index-row" key={w.id} onClick={() => go(halachaRoute.work(w.id))}><span><strong>{w.title}</strong><small>{w.author} · {w.license}{w.licenseNote ? ` · ${w.licenseNote}` : ''}</small></span><span aria-hidden="true">←</span></button>)}</div>
  </>;
}

function Work({ work, go }) {
  const outline = useResource(() => bookOutline(work), [work.id]);
  return <>
    <p className="eyebrow">{work.tradition}</p><h1>{work.title}</h1>
    <p className="intro">{work.author} · {work.license}</p>
    <ResourceState resource={outline} />
    {outline.data && <div className="book-index">{outline.data.map(u => <button className="index-row" key={u.key} onClick={() => go(halachaRoute.unit(work.id, u.key))}><span><strong>{u.title}</strong>{u.count ? <small>{u.from ? `סימנים ${hebrewNumeral(u.from)}–${hebrewNumeral(u.to)} · ` : ''}{u.count} פרקים</small> : null}</span><span aria-hidden="true">←</span></button>)}</div>}
  </>;
}

function Unit({ work, unitKey, go, openSource }) {
  const outline = useResource(() => bookOutline(work), [work.id]);
  const sections = useResource(() => unitSections(work, unitKey), [work.id, unitKey]);
  const [readingProgress] = useLocal('reader-progress-v1', {});
  const unit = outline.data?.find(u => u.key === unitKey);
  const list = sections.data || [];
  const flowKey = `halacha-book:${work.id}:${unitKey}`;
  const lastReference = readingProgress[flowKey];
  useEffect(() => {
    if (!lastReference || !list.length) return;
    const timer = setTimeout(() => {
      [...document.querySelectorAll('[data-book-reference]')]
        .find(element => element.dataset.bookReference === lastReference)
        ?.scrollIntoView({ block: 'center' });
    }, 0);
    return () => clearTimeout(timer);
  }, [lastReference, list.length]);
  const open = i => {
    const item = list[i];
    const nav = {
      backLabel: `חזרה לתוכן העניינים`, onBack: () => history.back(),
      breadcrumbs: [{ label: 'הלכה', route: 'halacha', onNavigate: () => go('halacha') }, { label: work.title, route: halachaRoute.work(work.id), onNavigate: () => go(halachaRoute.work(work.id)) }, { label: unit?.title || unitKey, route: halachaRoute.unit(work.id, unitKey), onNavigate: () => go(halachaRoute.unit(work.id, unitKey)) }, { label: item.label }],
      previous: i > 0 ? { title: list[i - 1].label, index: i - 1 } : null,
      next: i < list.length - 1 ? { title: list[i + 1].label, index: i + 1 } : null,
      endLabel: `סוף ${unit?.title || 'החלק'}`,
      onSelect: target => open(target.index),
      flowKey,
      flow: list.map(entry => ({ reference: entry.ref, title: heRef(entry.ref), mode: 'nikud' })),
      index: i, returnRoute: halachaRoute.unit(work.id, unitKey),
    };
    openSource(item.ref, `${heRef(item.ref)}`, 'nikud', nav);
  };
  const chapters = [...new Set(list.map(s => s.chapter).filter(Boolean))];
  return <>
    <p className="eyebrow">{work.title}</p><h1>{unit?.title || unitKey}</h1>
    <ResourceState resource={sections} />
    {sections.data && chapters.length === 0 && <div className="book-index">{list.map((s, i) => <button className="index-row" data-book-reference={s.ref} key={s.ref} onClick={() => open(i)}><span><strong>{s.label}</strong><small>{s.size === 1 ? 'סעיף אחד' : s.size ? `${s.size} סעיפים` : ''}</small></span><span aria-hidden="true">←</span></button>)}</div>}
    {sections.data && chapters.length > 0 && chapters.map(ch => <section key={ch} className="chapter-block"><h2>פרק {typeof ch === 'number' ? hebrewNumeral(ch) : ch}</h2><div className="seif-grid">{list.map((s, i) => s.chapter === ch && <button data-book-reference={s.ref} key={s.ref} onClick={() => open(i)} title={s.label}>{s.label.replace(/^.*הלכה /, '')}</button>)}</div></section>)}
  </>;
}

// The search field owns its text: typing re-renders this small form only. The page is told the query 320 ms after
// typing pauses (or at once on "חפש"), so the search never runs between two keystrokes.
function SearchBox({ q, setQ, submitQ, clearQ, submittedQ }) {
  const [text, setText] = useState(q);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const change = value => {
    setText(value);
    clearTimeout(timer.current);
    if (!value) { clearQ(); return; }
    timer.current = setTimeout(() => setQ(value), 320);
  };
  const hasQuery = text.trim().length > 0;
  const isSubmitted = hasQuery && text === submittedQ;
  const canSearch = hasQuery && !isSubmitted;
  const clear = () => { clearTimeout(timer.current); setText(''); clearQ(); };
  return <form className="halacha-search" onSubmit={e => { e.preventDefault(); if (canSearch) { clearTimeout(timer.current); submitQ(text); } }}>
    <label htmlFor="halacha-search">שאל שאלה בהלכה</label>
    <div><ClearableInput id="halacha-search" value={text} onChange={e => change(e.target.value)} placeholder="מה קרה? למשל: שכחתי יעלה ויבוא · אכלתי בשר, מתי חלבי" autoComplete="off" clearLabel="נקה חיפוש בהלכה" /><button type={canSearch ? 'submit' : 'button'} onClick={canSearch ? undefined : clear} aria-label={canSearch ? 'חפש' : 'ניקוי'}>{canSearch ? 'חפש' : 'ניקוי'}</button></div>
  </form>;
}

// Three different things, shown apart: verified answers about the question, sources that are about its subject, and
// results that only share words with it (collapsed — a word match is not an answer).
function SearchResults({ results, query = '', go, openSource, leadIds = [], sensitive = false }) {
  const groups = useMemo(() => {
    const list = (results.unified || results.questions.map(item => ({ kind: 'question', item }))).filter(result => !leadIds.includes(result.item.id));
    const terms = questionKeyTerms(query);
    const about = [], sources = [], matches = [];
    for (const result of list) {
      if (result.kind === 'yalkut') (isRelevantSection(query, result.item, terms) ? sources : matches).push(result);
      else (entryRelevance(query, result.item, terms) ? about : matches).push(result);
    }
    return { about, sources, matches };
  }, [results, query, leadIds]);
  if (results.state === 'empty') return null;
  const row = result => result.kind === 'yalkut' ? <YalkutRow key={result.item.id} item={result.item} openSource={openSource} /> : <QuestionRow key={result.item.id} item={result.item} go={go} />;
  return <section className="halacha-results" aria-live="polite">
    {(results.sensitive || sensitive) && <p className="notice sensitive">נושא רגיש: המידע כאן הוא לימודי. בשאלה אישית מומלץ לפנות למורה הוראה או ליועצת הלכה. החיפוש אינו נשמר.</p>}
    {results.state === 'no-match' && <p className="notice">לא נמצאה שאלה מתאימה במאגר המקומי. נסו ניסוח אחר או עברו לפי נושא. אם מדובר במקרה אישי — הכינו שאלה לרב.</p>}
    {results.state === 'topic-only' && <p className="notice">נמצא נושא מתאים אך עדיין אין בו שאלות מוכנות. אפשר לעיין בנושא ובמקורותיו.</p>}
    {groups.about.length > 0 && <><h2 className="halacha-results-label">תשובות מאומתות בנושא</h2>{groups.about.map(row)}</>}
    {groups.sources.length > 0 && <><h2 className="halacha-results-label">מקורות לעיון</h2>{groups.sources.map(row)}</>}
    {groups.matches.length > 0 && (groups.about.length || groups.sources.length || leadIds.length
      ? <details className="halacha-word-matches"><summary>תוצאות שרק חולקות מילים עם השאלה ({groups.matches.length})</summary>{groups.matches.map(row)}</details>
      : <><p className="notice">אין במאגר תשובה מאומתת לשאלה הזו. אלה תוצאות שחולקות איתה מילים – לא בהכרח על אותו נושא.</p>{groups.matches.map(row)}</>)}
    {results.categories.map(c => <button key={c.id} className="index-row" onClick={() => go(halachaRoute.category(c.id))}><span><strong>{c.title}</strong><small>קטגוריה · {c.children.length} נושאים</small></span><span aria-hidden="true">←</span></button>)}
  </section>;
}

function YalkutRow({ item, openSource }) {
  return <button className="index-row" onClick={() => openSource(item.ref, `ילקוט יוסף · ${item.citation || item.title}`, 'nikud')}>
    <span><strong>ילקוט יוסף · {item.citation || item.title}</strong><small>מהדורת תשס״ז · {item.snippet}</small></span>
    <span aria-hidden="true">←</span>
  </button>;
}

function QuestionRow({ item, go }) {
  const cat = HALACHA_TOPICS.find(c => c.id === item.category);
  return <button className="index-row" onClick={() => go(halachaRoute.question(item.id))}>
    <span><strong>{item.question}</strong>{item.shortAnswer && <em>{item.shortAnswer}</em>}<small>{cat?.title} · {item.topic} · {item.sourceBook === 'ong-shabbat' ? `עונג שבת · עמ׳ ${item.bookPlace.pages[0]}` : item.quality === 'verified' ? 'תשובה מאומתת' : `${item.sources.length} מקורות`}{item.personal ? ' · דורש בירור אישי' : ''}</small></span><span aria-hidden="true">←</span>
  </button>;
}

const DAILY_TAG_LABELS = {
  shabbat: 'לקראת שבת',
  'rosh-chodesh': 'ראש חודש',
  'aseret-yemei-teshuvah': 'עשרת ימי תשובה',
  'rosh-hashanah': 'לקראת ראש השנה',
  'yom-kippur': 'לקראת יום הכיפורים',
  sukkot: 'לקראת סוכות',
  pesach: 'לקראת פסח',
  shavuot: 'לקראת שבועות',
  chanukah: 'לקראת חנוכה',
  purim: 'לקראת פורים',
  omer: 'ספירת העומר',
};

function Root({ q, searchQ, setQ, submitQ, clearQ, submittedQ, results, go, openSource, context }) {
  // The hub, in the order a person needs it: ask; what matters now; quick situations; continue; topics; sources.
  const hour = new Date().getHours();
  const guide = useMemo(() => guideForNow(context || {}), [context?.key, context?.afterSunset, context?.weekday]);
  // Without a curated guide for today, "רלוונטי עכשיו" comes from the day's context, or the daily rotation.
  const forNow = useMemo(() => halachotForNow(context || {}), [context?.key, context?.afterSunset, hour]);
  const daily = useMemo(() => forNow.now?.reason ? null : pickDailyHalacha(context || {}), [context?.key, forNow.now?.reason]);
  const nowItem = forNow.now?.reason ? forNow.now.entry : daily;
  const dailyEyebrow = forNow.now?.reason ? `רלוונטי עכשיו · ${forNow.now.reason}`
    : daily?.contextTag && DAILY_TAG_LABELS[daily.contextTag] ? `הלכה יומית · ${DAILY_TAG_LABELS[daily.contextTag]}` : 'הלכה יומית';
  const todayList = (forNow.now?.reason ? forNow.today : forNow.today.filter(item => item.entry.id !== daily?.id)).slice(0, 3);
  const [favorites, setFavorites] = useState(() => readFavorites().filter(item => item.kind === 'halacha'));
  useEffect(() => onFavoritesChange(() => setFavorites(readFavorites().filter(item => item.kind === 'halacha'))), []);
  const recent = useMemo(() => readRecentHalachot().map(id => PRACTICAL_HALACHA_QA_INDEX[id] || HALACHA_QUESTION_INDEX[id]).filter(Boolean).slice(0, 3), []);
  const route = useMemo(() => results.state === 'empty' ? null : routeHalachaQuery(searchQ, { results }), [results, searchQ]);
  const concept = useMemo(() => (searchQ.trim() ? conceptFor(searchQ) : null), [searchQ]);
  const timeQuestion = useMemo(() => Boolean(detectPrayerTimeQuestion(searchQ)), [searchQ]);
  // Local, privacy-safe gap counters (outcome class only; the text is never stored).
  useEffect(() => { if (route) recordSearchOutcome(route); }, [route]);
  const collectionsCount = useMemo(() => readCollections().length, []);
  // The conversation picks up the question typed here (kept for this session only).
  const openChatWith = text => { try { sessionStorage.setItem('kz-halacha-chat-seed', String(text || '').slice(0, 300)); } catch { /* ignore */ } go('halacha/chat'); };
  return <>
    <p className="eyebrow">בית המדרש · ספרדים ועדות המזרח</p>
    <h1>הלכה.</h1>
    <SearchBox q={q} setQ={setQ} submitQ={submitQ} clearQ={clearQ} submittedQ={submittedQ} />
    {!searchQ.trim() && <div className="halacha-feature-row">
      <FeatureCard title="הלכה חכמה" subtitle="העוזר שלך להלכה" onClick={() => go('halacha/chat')} />
      <FeatureCard title="מאגר השאלות השלם" subtitle={`${PRACTICAL_HALACHA_QA.length} שאלות ובירורים`} onClick={() => go('halacha/all')} />
    </div>}
    {timeQuestion && <button type="button" className="halacha-routed-flow" onClick={() => openChatWith(searchQ)}><span className="eyebrow">לפי זמני היום</span><strong>{searchQ}</strong><small>בדיקה לפי השעה עכשיו והזמנים במקום שלך ←</small></button>}
    {concept && !timeQuestion && <ConceptLead concept={concept} go={go} />}
    {route && !timeQuestion && !concept && <RoutedLead route={route} go={go} />}
    {route && !timeQuestion && <button type="button" className="link halacha-continue-chat" onClick={() => openChatWith(searchQ)}>להמשיך את השאלה בשיחה ←</button>}
    <SearchResults results={results} query={searchQ} go={go} openSource={openSource} leadIds={concept ? [concept.overview, ...concept.occasions] : route?.answer ? [route.answer.id] : []} sensitive={route?.intent === 'personal-case'} />
    {results.state === 'empty' && <>
      {guide ? <ContextGuide guide={guide} go={go} /> : <>
        {nowItem && <button type="button" className="halacha-daily-card" onClick={() => go(halachaRoute.question(nowItem.id))}>
          <span className="eyebrow">{dailyEyebrow}</span>
          <strong>{nowItem.question}</strong>
          {nowItem.shortAnswer && <small>{nowItem.shortAnswer}</small>}
        </button>}
        {todayList.length > 0 && <HubList title="הלכות היום" items={todayList.map(item => ({ ...item.entry, note: item.reason }))} go={go} />}
      </>}
      <QuickSituations go={go} />
      <RecallCard go={go} />
      {recent.length > 0 && <HubList title="המשך קריאה" items={recent} go={go} />}
      <TracksList go={go} />
      <button type="button" className="halacha-chat-entry halacha-hub-link" onClick={() => go(collectionsRoute())}><span><strong>האוספים שלי</strong><small>{collectionsCount ? `${collectionsCount} אוספים` : 'שבת, תפילה, ללמוד, לזכור… נשמר במכשיר'}</small></span><span aria-hidden="true">←</span></button>
      {favorites.length > 0 && <section className="halacha-hub-list"><h2>המועדפים שלי</h2><div className="book-index">{favorites.slice(0, 4).map(item => <button className="index-row" key={item.key} onClick={() => go(item.open.route)}><span><strong>{item.title}</strong>{item.subtitle && <small>{item.subtitle}</small>}</span><span aria-hidden="true">←</span></button>)}</div></section>}
    </>}
    <FeatureCard className="halacha-feature-single" title="כל הנושאים" subtitle="שאלות, הלכות ועיון" onClick={() => go('halacha/topics')} />
    {/* The last line of the hub: the optional full-text download, quiet (see OfflineInvite). */}
    {!searchQ.trim() && <OfflineInvite variant="search" go={go} />}
  </>;
}

// "כל הנושאים": every subject with its topics, and the works the library draws on — on its own page, so the hub stays short.
function TopicsPage({ go }) {
  return <>
    <p className="eyebrow">הלכה</p>
    <h1>כל הנושאים.</h1>
    <p className="intro">{PRACTICAL_HALACHA_QA.length - ONG_COUNT} תשובות מעשיות מאומתות מילקוט יוסף, {ONG_COUNT} הלכות מתוך הספר עונג שבת, ועוד {HALACHA_QUESTIONS.length} שאלות לעיון במקורות. מקור קלאסי אינו פסק אישי; במקרה רגיש פונים לרב.</p>
    <div className="topic-grid">
      {HALACHA_TOPICS.map((c, index) => {
        const count = [...PRACTICAL_HALACHA_QA, ...HALACHA_QUESTIONS].filter(x => x.category === c.id).length;
        return <article className={`topic-card tone-${index % 6}`} key={c.id}>
          <h3><button className="link" onClick={() => go(halachaRoute.category(c.id))}>{c.title}</button></h3>
          <p>{c.aliases.slice(0, 3).join(' · ')}</p>
          <div>{c.children.map(child => <button key={child} onClick={() => go(halachaRoute.topic(c.id, child))}>{child}</button>)}</div>
          <small className="topic-count">{c.children.length} נושאים · {count} שאלות</small>
        </article>;
      })}
    </div>
    <section className="source-catalog">
      <div className="section-heading"><h2>מקורות שבהם הספרייה משתמשת</h2><button className="link" onClick={() => go(halachaRoute.books())}>עיון לפי ספר ←</button></div>
      <div className="source-work-grid">{HALACHA_WORKS.filter(w => w.referencePrefix).map(w => <article className="source-work" key={w.id}><p className="eyebrow">{w.tradition}</p><h3><button className="link" onClick={() => go(halachaRoute.work(w.id))}>{w.title}</button></h3><p>{w.author}</p><small>{w.license}{w.licenseNote ? ` · ${w.licenseNote}` : ''}</small></article>)}</div>
    </section>
  </>;
}

// A centred entry card: the name in the middle, a short line beneath.
function FeatureCard({ title, subtitle, onClick, className = '' }) {
  return <button type="button" className={`halacha-feature-card ${className}`.trim()} onClick={onClick}><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</button>;
}

function HubList({ title, items, go }) {
  return <section className="halacha-hub-list"><h2>{title}</h2><div className="book-index">{items.map(item => <button className="index-row" key={item.id} onClick={() => go(halachaRoute.question(item.id))}>
    <span><strong>{item.question}</strong><small>{item.note ? `${item.note} · ` : ''}{item.topic}</small></span><span aria-hidden="true">←</span>
  </button>)}</div></section>;
}

function Category({ cat, go }) {
  const items = [...PRACTICAL_HALACHA_QA, ...HALACHA_QUESTIONS].filter(x => x.category === cat.id);
  return <>
    <p className="eyebrow">קטגוריה</p><h1>{cat.title}</h1>
    {cat.sensitive && <p className="notice sensitive">מדור לימודי ודיסקרטי. אין כאן פסיקה אוטומטית על מקרה אישי; החיפוש במדור אינו נשמר.</p>}
    <p className="intro">{cat.children.length} נושאים · {items.length} שאלות</p>
    <div className="topic-grid">{cat.children.map(topic => {
      const qs = displayQuestionsForTopic(topic);
      return <article className="topic-card" key={topic}><h3><button className="link" onClick={() => go(halachaRoute.topic(cat.id, topic))}>{topic}</button></h3><div>{qs.slice(0, 4).map(x => <button key={x.id} onClick={() => go(halachaRoute.question(x.id))}>{x.question}</button>)}</div><small className="topic-count">{qs.length} שאלות</small></article>;
    })}</div>
  </>;
}

function Topic({ cat, topic, go }) {
  const items = displayQuestionsForTopic(topic);
  const related = cat.children.filter(t => t !== topic).slice(0, 6);
  return <>
    <p className="eyebrow">{cat.title}</p><h1>{topic}</h1>
    <p className="intro">{items.length} שאלות · לחיצה פותחת עמוד שאלה עם התנאים והמקורות.</p>
    <div className="book-index">{items.map(item => <QuestionRow key={item.id} item={item} go={go} />)}</div>
    {related.length > 0 && <section className="related-topics"><h2>נושאים קשורים</h2><div>{related.map(t => <button key={t} onClick={() => go(halachaRoute.topic(cat.id, t))}>{t}</button>)}</div></section>}
  </>;
}

function Question({ question, cat, go, openSource, context, tzid = 'Asia/Jerusalem' }) {
  const published = question.quality === 'verified';
  const siblings = displayQuestionsForTopic(question.topic);
  const index = siblings.findIndex(x => x.id === question.id);
  const grouped = ['foundation', 'sephardic', 'modern', 'commentary'].map(role => [role, question.sources.filter(s => s.role === role)]).filter(([, list]) => list.length);
  const yalkutSources = [...new Map([question.question, ...question.variants].flatMap(query => searchYalkut(query, 3, { requireTitleMatch: true })).map(item => [item.id, item])).values()]
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 2);
  const nav = { backLabel: `חזרה לשאלה`, breadcrumbs: [{ label: 'הלכה', onNavigate: () => go('halacha') }, { label: question.topic, onNavigate: () => go(halachaRoute.topic(cat.id, question.topic)) }, { label: question.question }], onBack: () => history.back() };
  useEffect(() => { window.scrollTo({ top: 0 }); recordHalachaOpened(question.id); }, [question.id]);
  const ong = question.sourceBook === 'ong-shabbat';
  // Reading a question is study: the same invisible timer as every Torah reader (60 seconds and up → the journal, one
  // entry a day for the Halacha questions), and "סיימתי את הלימוד" for the question itself.
  const studyWork = ong ? { workId: 'ong-shabbat-questions', workTitle: 'עונג שבת · שאלות ותשובות' } : { workId: 'halacha-questions', workTitle: 'הלכה · שאלות ותשובות' };
  const { recordInteraction } = useStudyTimer({ ...studyWork, unitId: question.id, unitLabel: question.question, category: 'torah_study', source: 'halacha-question', tzid });
  useEffect(() => {
    const onScroll = () => recordInteraction();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [recordInteraction]);
  const related = useMemo(() => relatedWithReasons(question, { context }), [question.id, context?.key]);
  const excerpts = question.sources.filter(source => source.excerpt);
  const followUps = useMemo(() => flowsForEntry(question.id), [question.id]);
  const tracks = useMemo(() => HALACHA_TRACKS.filter(track => track.entryIds.includes(question.id)), [question.id]);
  // The same question in עונג שבת, beside a Yalkut Yosef answer (side by side, never merged).
  const ongParallels = useMemo(() => (ong ? [] : PRACTICAL_HALACHA_QA.filter(item => item.sourceBook === 'ong-shabbat' && item.answerStatus === 'published' && item.yalkutParallels.includes(question.id)).slice(0, 2)), [question.id]);
  return <article className="halacha-question">
    <p className="eyebrow">{cat?.title} · {question.topic}</p>
    <div className="reader-title-row"><h1>{question.question}</h1><HeartToggle item={routeFavorite('halacha', halachaRoute.question(question.id), question.question, question.topic)} /></div>
    {published && !ong && <section className="practical-answer" aria-label="תשובה מעשית"><GlossaryText as="p" text={question.shortAnswer} /></section>}
    {question.sensitivity === 'sensitive' && <p className="notice sensitive">מידע לימודי בלבד. בשאלה אישית — מורה הוראה או יועצת הלכה. אפשר להכין טיוטת שאלה לרב מהמקורות שלמטה; היא לא נשלחת אוטומטית.</p>}
    {question.personal && question.sensitivity !== 'sensitive' && !ong && <p className="notice">התשובה תלויה בפרטים אישיים (מצב רפואי, מוצר, דגם או נסיבות). המקורות נותנים את העקרונות; להכרעה פונים לרב.</p>}
    <section className="answer-status"><span className="badge">{ong ? (question.highStakes ? 'לשון הספר · עונג שבת' : 'מתוך הספר עונג שבת') : published ? 'תשובה מאומתת' : 'מקורות מאומתים'}</span>{!published && <span className="badge muted">תקציר: ממתין לבדיקה הלכתית</span>}{question.ruleType && RULE_TYPE_LABELS[question.ruleType] && <span className="badge muted">{RULE_TYPE_LABELS[question.ruleType]}</span>}{question.seasonal && <span className="badge season">{question.seasonal}</span>}</section>
    {(question.conditions || question.factors || []).length > 0 && <section><h2>מה משנה את הדין?</h2><ul className="factors">{(question.conditions || question.factors).map(f => <li key={f}><GlossaryText text={f} /></li>)}</ul></section>}
    {ong && <Suspense fallback={<p className="notice">טוען…</p>}><OngShabbatAnswer entry={question} go={go} openSource={openSource} nav={nav} /></Suspense>}
    {published && <PersonalActions item={routeFavorite('halacha', halachaRoute.question(question.id), question.question, question.topic)} entryId={question.id} />}
    {!ong && excerpts.length > 0 && <section><h2>המקור</h2>{excerpts.map(source => <figure className="halacha-excerpt" key={source.localSourceId}><blockquote>{source.excerpt}</blockquote><figcaption>ילקוט יוסף, {source.citation}{source.sectionTitle ? ` · ${source.sectionTitle}` : ''}</figcaption></figure>)}</section>}
    {!ong && published && question.sources?.[0]?.localSourceId && <Suspense fallback={null}><SourceDepth entry={question} openSource={openSource} nav={nav} /></Suspense>}
    {ongParallels.length > 0 && <details className="halacha-more ong-parallels"><summary>באותו עניין בספר עונג שבת</summary><p className="source-map-note">כל ספר בלשונו, זה לצד זה. ההשוואה ללימוד; אין כאן הכרעה ביניהם.</p>{ongParallels.map(other => <section className="compare-block" key={other.id}><p className="compare-kind">עונג שבת · {other.sources[0].citation}</p><h3>{other.question}</h3><blockquote>{other.sources[0].excerpt}</blockquote><button type="button" className="link" onClick={() => go(halachaRoute.question(other.id))}>לדף השאלה בעונג שבת ←</button></section>)}</details>}
    {related.length > 0 && <section className="halacha-hub-list"><h2>מקרים דומים</h2><div className="book-index">{related.map(({ entry, reason }) => <button className="index-row" key={entry.id} onClick={() => go(halachaRoute.question(entry.id))}><span><strong>{entry.question}</strong><em>{entry.shortAnswer}</em><small>{reason}</small></span><span aria-hidden="true">←</span></button>)}</div></section>}
    {(followUps.length > 0 || tracks.length > 0) && <section className="halacha-followups"><h2>שאלות המשך</h2><div className="halacha-followup-list">{followUps.map(flow => <button type="button" key={flow.id} className="halacha-guide-flow" onClick={() => go(flowRoute(flow.id))}>בירור מהיר: {flow.title} ←</button>)}{tracks.map(track => <button type="button" key={track.id} className="halacha-guide-flow" onClick={() => go(trackRoute(track.id))}>במסלול: {track.title} ←</button>)}</div></section>}
    {!ong && <section><h2>עיין במקור</h2>
      {published && <div className="source-group"><h3>לפי פסיקת הרב יצחק יוסף</h3><div className="book-index">{question.sources.map(src => <button className="index-row" key={src.localSourceId} onClick={() => openSource(src.ref, `${src.work} · ${src.citation}`, 'nikud', nav)}><span><strong>{src.work}</strong><small>{src.citation} · פתיחה במקור המקומי</small></span><span aria-hidden="true">←</span></button>)}</div>
        {question.sources.some(src => src.furtherRefs?.length) && <p className="halacha-further">הרחבה: {[...new Set(question.sources.flatMap(src => src.furtherRefs || []))].join(' · ')}</p>}</div>}
      {!published && yalkutSources.length > 0 && <div className="source-group"><h3>מקור ספרדי מרכזי · ילקוט יוסף</h3><div className="book-index">{yalkutSources.map(src => <button className="index-row" key={src.id} onClick={() => openSource(src.ref, `ילקוט יוסף · ${src.title}`, 'nikud', nav)}><span><strong>{src.title}</strong><small>קיצור שו״ע · מהדורת תשס״ז</small></span><span aria-hidden="true">←</span></button>)}</div></div>}
      {!published && grouped.map(([role, list]) => <div className="source-group" key={role}><h3>{SOURCE_ROLE_LABELS[role]}</h3><div className="book-index">{list.map(src => {
        const work = workForReference(src.ref);
        // The Shulchan Arukh (and its commentaries) on the device open there, at the seif, with its מפרשים tab.
        const local = localLibraryRoute(src.ref);
        return <button className="index-row" key={src.ref} onClick={() => (local ? go(local) : openSource(src.ref, heRef(src.ref), 'nikud', nav))}><span><strong>{heRef(src.ref)}</strong><small>{work?.author || ''}{work ? ` · ${heLicense(work.license)}` : ''}{local ? ' · בספרייה שבמכשיר' : ''}{src.note ? ` · ${src.note}` : ''}</small></span><span aria-hidden="true">←</span></button>;
      })}</div></div>)}
      {(() => { const works = [...new Set(question.sources.map(s => workForReference(s.ref)).filter(Boolean))]; return works.length ? <p className="browse-books">עיון בספר המלא: {works.map(w => <button key={w.id} className="link" onClick={() => go(halachaRoute.work(w.id))}>{w.title}</button>)}</p> : null; })()}
    </section>}
    {published && <RabbiDraft topic={question.question} trail={[]} entries={[question]} sources={[]} />}
    <StudyCompletion {...studyWork} unitId={question.id} unitLabel={question.question} source="halacha-question" tzid={tzid} onBeforeRecord={recordInteraction} />
    <ReaderNavigation previous={index > 0 ? { title: siblings[index - 1].question, id: siblings[index - 1].id } : null} next={index < siblings.length - 1 ? { title: siblings[index + 1].question, id: siblings[index + 1].id } : null} onSelect={item => go(halachaRoute.question(item.id))} endLabel={`סיימת את השאלות בנושא ${question.topic}`} />
  </article>;
}
