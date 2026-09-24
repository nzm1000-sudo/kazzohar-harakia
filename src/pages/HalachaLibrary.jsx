import { useEffect, useMemo, useState } from 'react';
import { routeParts } from '../services/safeRoute.mjs';
import { useLocal, useResource } from '../hooks.jsx';
import { HALACHA_TOPICS, HALACHA_WORKS, workForReference } from '../data/halachaLibrary.mjs';
import { HALACHA_QUESTIONS, HALACHA_QUESTION_INDEX, SOURCE_ROLE_LABELS, questionsForTopic } from '../data/halachaQuestions.mjs';
import { PRACTICAL_HALACHA_QA, PRACTICAL_HALACHA_QA_INDEX } from '../data/practicalHalachaQa.mjs';
import { searchHalacha } from '../services/halachaSearch.mjs';
import { searchYalkut } from '../services/yalkutYosef.mjs';
import { browsableWorks, workById, bookOutline, unitSections } from '../services/halachaBooks.mjs';
import { pickDailyHalacha } from '../services/halachaContext.mjs';
import { BackNavigation, Breadcrumbs } from '../components/LocalNavigation.jsx';
import ReaderNavigation from '../components/ReaderNavigation.jsx';
import { ResourceState } from '../components/SourceReader.jsx';

// Route shapes: halacha | halacha/c/<cat> | halacha/t/<cat>/<topic> | halacha/q/<id> | halacha/b | halacha/b/<work> | halacha/b/<work>/<unit>
export function parseHalachaRoute(mode) {
  const parts = routeParts(mode);
  if (parts[1] === 'c') return { view: 'category', category: parts[2] };
  if (parts[1] === 't') return { view: 'topic', category: parts[2], topic: parts[3] };
  if (parts[1] === 'q') return { view: 'question', id: parts[2] };
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
  .replace('Yalkut Yosef', 'ילקוט יוסף, קיצור שולחן ערוך')
  .replace('Korban HaEdah on Jerusalem Talmud', 'קרבן העדה על תלמוד ירושלמי')
  .replace('Maaseh Rokeach on Mishnah', 'מעשה רוקח על המשנה')
  .replace('Kisse Rahamim on Tractate Soferim', 'כיסא רחמים על מסכת סופרים');
  if (out.startsWith('בן איש חי')) out = out.replace(/, ([^,\d]+?)(?: (\d+)(?:-\d+)?)?$/, (_, p, n, full) => `, פרשת ${PARASHA_HE[p.trim()] || p}${n && !/-/.test(_) ? `, סעיף ${n}` : ''}`);
  else if (/^(שולחן ערוך|כף החיים|בית יוסף)/.test(out)) out = / (\d+):(\d+)$/.test(out) ? out.replace(/ (\d+):(\d+)$/, ' סימן $1, סעיף $2') : out.replace(/ (\d+)$/, ' סימן $1');
  else if (out.startsWith('פניני הלכה')) out = out.replace(/ (\d+):(\d+)$/, ' פרק $1, הלכה $2');
  return out;
};
const heLicense = license => ({ 'Public Domain': 'נחלת הכלל', 'CC-BY-NC': 'רישיון שימוש לא־מסחרי', 'CC BY-NC-SA 2.5': 'רישיון שימוש לא־מסחרי ובשיתוף זהה' }[license] || license || '');
const displayQuestionsForTopic = topic => [
  ...PRACTICAL_HALACHA_QA.filter(item => item.topic === topic && item.answerStatus === 'published'),
  ...questionsForTopic(topic),
];

export default function HalachaLibrary({ route, openSource, go, back, context }) {
  const [storedQ, setStoredQ] = useLocal('halacha-query-v1', '');
  const [q, setQState] = useState(storedQ);
  const [submittedQ, setSubmittedQ] = useState(storedQ);
  const [searchQ, setSearchQ] = useState(storedQ);
  // Sensitive queries (purity, health, personal) stay in memory only.
  const setQ = value => setQState(value);
  const submitQ = () => setSubmittedQ(q);
  const clearQ = () => { setQ(''); setSearchQ(''); setSubmittedQ(''); };
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQ(q);
      setStoredQ(searchHalacha(q).sensitive ? '' : q);
    }, 180);
    return () => clearTimeout(timer);
  }, [q]);
  const cat = HALACHA_TOPICS.find(c => c.id === route.category);
  const question = route.view === 'question' ? PRACTICAL_HALACHA_QA_INDEX[route.id] || HALACHA_QUESTION_INDEX[route.id] : null;
  const qCat = question ? HALACHA_TOPICS.find(c => c.id === question.category) : null;
  const results = useMemo(() => searchHalacha(searchQ), [searchQ]);
  const work = route.work ? workById(route.work) : null;
  const crumbs = [{ label: 'הלכה', onNavigate: () => go('halacha') }];
  if (route.view === 'category' && cat) crumbs.push({ label: cat.title });
  if (route.view === 'topic' && cat) crumbs.push({ label: cat.title, onNavigate: () => go(halachaRoute.category(cat.id)) }, { label: route.topic });
  if (question && qCat) crumbs.push({ label: qCat.title, onNavigate: () => go(halachaRoute.category(qCat.id)) }, { label: question.topic, onNavigate: () => go(halachaRoute.topic(qCat.id, question.topic)) }, { label: question.question });
  if (route.view === 'books') crumbs.push({ label: 'ספרים' });
  if ((route.view === 'work' || route.view === 'unit') && work) crumbs.push({ label: 'ספרים', onNavigate: () => go(halachaRoute.books()) }, route.view === 'unit' ? { label: work.title, onNavigate: () => go(halachaRoute.work(work.id)) } : { label: work.title });
  const backLabel = route.view === 'topic' ? `חזרה ל${cat?.title || 'הלכה'}` : route.view === 'question' ? `חזרה ל${question?.topic || 'הלכה'}` : route.view === 'work' ? 'חזרה לספרים' : route.view === 'unit' ? `חזרה ל${work?.title || 'ספר'}` : 'חזרה להלכה';
  const backTarget = route.view === 'question' && qCat ? halachaRoute.topic(qCat.id, question.topic) : route.view === 'topic' && cat ? halachaRoute.category(cat.id) : route.view === 'work' ? halachaRoute.books() : route.view === 'unit' && work ? halachaRoute.work(work.id) : 'halacha';

  return <section className="halacha-library">
    {route.view !== 'root' && <><BackNavigation label={backLabel} onClick={() => go(backTarget)} /><Breadcrumbs items={crumbs} /></>}
    {route.view === 'root' && <Root q={q} setQ={setQ} submitQ={submitQ} clearQ={clearQ} submittedQ={submittedQ} results={results} go={go} openSource={openSource} context={context} />}
    {route.view === 'category' && cat && <Category cat={cat} go={go} />}
    {route.view === 'topic' && cat && <Topic cat={cat} topic={route.topic} go={go} />}
    {route.view === 'question' && question && <Question question={question} cat={qCat} go={go} openSource={openSource} />}
    {route.view === 'question' && !question && <p className="notice">השאלה לא נמצאה במאגר המקומי.</p>}
    {route.view === 'books' && <Books go={go} />}
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
    {outline.data && <div className="book-index">{outline.data.map(u => <button className="index-row" key={u.key} onClick={() => go(halachaRoute.unit(work.id, u.key))}><span><strong>{u.title}</strong>{u.count ? <small>{u.from ? `סימנים ${u.from}–${u.to} · ` : ''}{u.count} פרקים</small> : null}</span><span aria-hidden="true">←</span></button>)}</div>}
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
    {sections.data && chapters.length > 0 && chapters.map(ch => <section key={ch} className="chapter-block"><h2>פרק {ch}</h2><div className="seif-grid">{list.map((s, i) => s.chapter === ch && <button data-book-reference={s.ref} key={s.ref} onClick={() => open(i)} title={s.label}>{s.label.replace(/^.*הלכה /, '')}</button>)}</div></section>)}
  </>;
}

function SearchBox({ q, setQ, submitQ, clearQ, submittedQ }) {
  const hasQuery = q.trim().length > 0;
  const isSubmitted = hasQuery && q === submittedQ;
  const canSearch = hasQuery && !isSubmitted;
  return <form className="halacha-search" onSubmit={e => { e.preventDefault(); if (canSearch) submitQ(); }}>
    <label htmlFor="halacha-search">חיפוש בהלכה</label>
    <div><div className="search-input-wrap"><input id="halacha-search" value={q} onChange={e => setQ(e.target.value)} placeholder="מותר לחמם מרק בשבת? · שכחתי יעלה ויבוא · יש לי לק לפני המקווה" autoComplete="off" />{hasQuery && <button type="button" className="search-clear-button" aria-label="ניקוי החיפוש" onClick={clearQ}>✕</button>}</div><button type={canSearch ? 'submit' : 'button'} onClick={canSearch ? undefined : clearQ} aria-label={canSearch ? 'חפש' : 'ניקוי'}>{canSearch ? 'חפש' : 'ניקוי'}</button></div>
  </form>;
}

function SearchResults({ results, go, openSource }) {
  if (results.state === 'empty') return null;
  return <section className="halacha-results" aria-live="polite">
    {results.sensitive && <p className="notice sensitive">נושא רגיש: המידע כאן הוא לימודי. בשאלה אישית מומלץ לפנות למורה הוראה או ליועצת הלכה. החיפוש אינו נשמר.</p>}
    {results.state === 'no-match' && <p className="notice">לא נמצאה שאלה מתאימה במאגר המקומי. נסו ניסוח אחר או עברו לפי נושא. אם מדובר במקרה אישי — הכינו שאלה לרב.</p>}
    {results.state === 'topic-only' && <p className="notice">נמצא נושא מתאים אך עדיין אין בו שאלות מוכנות. אפשר לעיין בנושא ובמקורותיו.</p>}
    {(results.unified || results.questions.map(item => ({ kind: 'question', item }))).map(result => result.kind === 'yalkut'
      ? <YalkutRow key={result.item.id} item={result.item} openSource={openSource} />
      : <QuestionRow key={result.item.id} item={result.item} go={go} />)}
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
    <span><strong>{item.question}</strong>{item.shortAnswer && <em>{item.shortAnswer}</em>}<small>{cat?.title} · {item.topic} · {item.quality === 'verified' ? 'תשובה מאומתת' : `${item.sources.length} מקורות`}{item.personal ? ' · דורש בירור אישי' : ''}</small></span><span aria-hidden="true">←</span>
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

function Root({ q, setQ, submitQ, clearQ, submittedQ, results, go, openSource, context }) {
  const daily = useMemo(() => pickDailyHalacha(context || {}), [context?.key]);
  // Only ever label the card with an event name when the shown content actually matches
  // that event — a fallback pick stays a plain, honest "הלכה יומית" instead of a false claim.
  const dailyEyebrow = daily?.contextTag && DAILY_TAG_LABELS[daily.contextTag]
    ? `הלכה יומית · ${DAILY_TAG_LABELS[daily.contextTag]}`
    : 'הלכה יומית';
  return <>
    <p className="eyebrow">בית המדרש · ספרדים ועדות המזרח</p>
    <h1>ספריית הלכה מעשית.</h1>
    <p className="intro">{PRACTICAL_HALACHA_QA.length} תשובות מעשיות מאומתות ועוד {HALACHA_QUESTIONS.length} שאלות לעיון במקורות. הטקסטים נפתחים כאן, בקורא הפנימי. מקור קלאסי אינו פסק אישי; במקרה רגיש פונים לרב.</p>
    {daily && <button type="button" className="halacha-daily-card" onClick={() => go(halachaRoute.question(daily.id))}>
      <span className="eyebrow">{dailyEyebrow}</span>
      <strong>{daily.question}</strong>
      {daily.shortAnswer && <small>{daily.shortAnswer}</small>}
    </button>}
    <SearchBox q={q} setQ={setQ} submitQ={submitQ} clearQ={clearQ} submittedQ={submittedQ} />
    <SearchResults results={results} go={go} openSource={openSource} />
    <div className="topic-grid">
      {HALACHA_TOPICS.map((c, index) => {
        const count = HALACHA_QUESTIONS.filter(x => x.category === c.id).length;
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

function Question({ question, cat, go, openSource }) {
  const published = question.quality === 'verified';
  const siblings = displayQuestionsForTopic(question.topic);
  const index = siblings.findIndex(x => x.id === question.id);
  const grouped = ['foundation', 'sephardic', 'modern', 'commentary'].map(role => [role, question.sources.filter(s => s.role === role)]).filter(([, list]) => list.length);
  const yalkutSources = [...new Map([question.question, ...question.variants].flatMap(query => searchYalkut(query, 3, { requireTitleMatch: true })).map(item => [item.id, item])).values()]
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 2);
  const nav = { backLabel: `חזרה לשאלה`, breadcrumbs: [{ label: 'הלכה', onNavigate: () => go('halacha') }, { label: question.topic, onNavigate: () => go(halachaRoute.topic(cat.id, question.topic)) }, { label: question.question }], onBack: () => history.back() };
  useEffect(() => { window.scrollTo({ top: 0 }); }, [question.id]);
  return <article className="halacha-question">
    <p className="eyebrow">{cat?.title} · {question.topic}</p>
    <h1>{question.question}</h1>
    {published && <section className="practical-answer" aria-label="תשובה מעשית"><p>{question.shortAnswer}</p></section>}
    {question.sensitivity === 'sensitive' && <p className="notice sensitive">מידע לימודי בלבד. בשאלה אישית — מורה הוראה או יועצת הלכה. אפשר להכין טיוטת שאלה לרב מהמקורות שלמטה; היא לא נשלחת אוטומטית.</p>}
    {question.personal && question.sensitivity !== 'sensitive' && <p className="notice">התשובה תלויה בפרטים אישיים (מצב רפואי, מוצר, דגם או נסיבות). המקורות נותנים את העקרונות; להכרעה פונים לרב.</p>}
    <section className="answer-status"><span className="badge">{published ? 'תשובה מאומתת' : 'מקורות מאומתים'}</span>{!published && <span className="badge muted">תקציר: ממתין לבדיקה הלכתית</span>}{question.seasonal && <span className="badge season">{question.seasonal}</span>}</section>
    {(question.conditions || question.factors || []).length > 0 && <section><h2>{published ? 'חשוב לדעת' : 'מה משנה את הדין'}</h2><ul className="factors">{(question.conditions || question.factors).map(f => <li key={f}>{f}</li>)}</ul></section>}
    <section><h2>מקורות</h2>
      {published && <div className="source-group"><h3>לפי פסיקת הרב יצחק יוסף</h3><div className="book-index">{question.sources.map(src => <button className="index-row" key={src.localSourceId} onClick={() => openSource(src.ref, `${src.work} · ${src.citation}`, 'nikud', nav)}><span><strong>{src.work}</strong><small>{src.citation} · פתיחה במקור המקומי</small></span><span aria-hidden="true">←</span></button>)}</div></div>}
      {!published && yalkutSources.length > 0 && <div className="source-group"><h3>מקור ספרדי מרכזי · ילקוט יוסף</h3><div className="book-index">{yalkutSources.map(src => <button className="index-row" key={src.id} onClick={() => openSource(src.ref, `ילקוט יוסף · ${src.title}`, 'nikud', nav)}><span><strong>{src.title}</strong><small>קיצור שו״ע · מהדורת תשס״ז</small></span><span aria-hidden="true">←</span></button>)}</div></div>}
      {!published && grouped.map(([role, list]) => <div className="source-group" key={role}><h3>{SOURCE_ROLE_LABELS[role]}</h3><div className="book-index">{list.map(src => {
        const work = workForReference(src.ref);
        return <button className="index-row" key={src.ref} onClick={() => openSource(src.ref, heRef(src.ref), 'nikud', nav)}><span><strong>{heRef(src.ref)}</strong><small>{work?.author || ''}{work ? ` · ${heLicense(work.license)}` : ''}{src.note ? ` · ${src.note}` : ''}</small></span><span aria-hidden="true">←</span></button>;
      })}</div></div>)}
      {(() => { const works = [...new Set(question.sources.map(s => workForReference(s.ref)).filter(Boolean))]; return works.length ? <p className="browse-books">עיון בספר המלא: {works.map(w => <button key={w.id} className="link" onClick={() => go(halachaRoute.work(w.id))}>{w.title}</button>)}</p> : null; })()}
    </section>
    <ReaderNavigation previous={index > 0 ? { title: siblings[index - 1].question, id: siblings[index - 1].id } : null} next={index < siblings.length - 1 ? { title: siblings[index + 1].question, id: siblings[index + 1].id } : null} onSelect={item => go(halachaRoute.question(item.id))} endLabel={`סיימת את השאלות בנושא ${question.topic}`} />
  </article>;
}
