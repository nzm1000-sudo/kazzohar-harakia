import { Fragment, useEffect, useMemo, useState } from 'react';
import { Locale } from '@hebcal/core';
import { useResource, useStudyTimer } from '../hooks.jsx';
import { StudyCompletion } from '../components/CompletionButton.jsx';
import { BackNavigation, Breadcrumbs } from '../components/LocalNavigation.jsx';
import ReaderNavigation, { ReaderDock } from '../components/ReaderNavigation.jsx';
import HeartToggle from '../components/HeartToggle.jsx';
import TextSizeControl, { useReadingFont } from '../components/ui/TextSizeControl.jsx';
import TitleOrnament from '../components/ui/TitleOrnament.jsx';
import { routeFavorite } from '../services/favorites.mjs';
import { calendarIsIsrael } from '../services/calendarAccuracy.mjs';
import { packsBundledWithApp } from '../services/library/packs.mjs';
import { CHOK, CHOK_CREDIT, CHOK_DAYS, CHOK_LICENSE, CHOK_PARTS, CHOK_PRAYERS, CHOK_TITLE, chokNeighbours, chokRoute, chokToday,
  dayDef, dayTitle, displayHeading, inlineRuns, loadChokIntro, loadChokParasha, parashotTitle, parseChokRoute, partsOfDay, warmChokWeek } from '../services/chokLeYisrael.mjs';

// "חק לישראל" in the Siddur: opens on today's learning (the week's parasha by its Shabbat, the day by sunset — ליל שישי
// from Thursday night), one part at a time (תורה, נביאים, כתובים, משנה, גמרא, זוהר, הלכה, מוסר), previous / next day,
// the edition's introductions and its prayer before each kind of learning. Reading is timed like every study text.
const WORK_ID = 'chok-leyisrael';
const goSiddur = go => go('siddur');
const festivalName = name => { try { return Locale.gettext(name, 'he-x-NoNikud'); } catch { return name; } };

// The edition's emphasis (<b>: a dibur hamatchil, a verse number) and small print, as the edition has them.
function Runs({ text }) {
  return inlineRuns(text).map((run, i) => (run.br ? <br key={i} />
    : run.bold ? <b key={i} className={`library-dh${run.small ? ' chok-small' : ''}`}>{run.text}</b>
      : run.small ? <small key={i} className="chok-small">{run.text}</small> : <Fragment key={i}>{run.text}</Fragment>));
}

// A part's heading in the edition ("נביאים - ישעיה - פרק מב", "גמרא ברכות דף י''ב ע''ב") without the part's own name.
function sourceLabel(part, heading) {
  if (!heading) return null;
  const pieces = displayHeading(heading).split(/\s+-\s+/);
  if (pieces[0] === CHOK_PARTS[part]) pieces.shift();
  const label = pieces.join(' · ').replace(/^(משנה|גמרא|זוהר)\s+/, '');
  return label === CHOK_PARTS[part] ? null : label;
}

const LOOKUP = { gemara: 'talmud', zohar: 'zohar', halacha: 'halacha', mussar: 'mussar' };
const COMMENTARY_LOOKUP = { torah: 'tanakh-commentary', neviim: 'tanakh-commentary', ketuvim: 'tanakh-commentary', mishnah: 'mishnah-commentary', gemara: 'talmud-commentary' };
// The commentators the edition prints: Rashi on the Torah and on the Gemara (מעשה רוקח: "גמרא ורש״י"), the Bartenura on the Mishnah.
const COMMENTATOR = { torah: 'רש״י', gemara: 'רש״י', mishnah: 'ברטנורא' };

function Block({ block, part, first }) {
  if (block.t === 'note') return <p className="chok-note"><Runs text={block.x} /></p>;
  if (block.t === 'v') {
    return <div className="chok-verse">
      {block.c && <p className="chok-chapter">פרק {block.c}</p>}
      {block.a && <p className="chok-aliya">{block.a}</p>}
      <p className="chok-mikra"><span className="chok-vn" data-lookup="off">{block.n}</span> <Runs text={block.h} /></p>
      {block.g && <p className="chok-targum" data-lookup="targum"><Runs text={block.g} /></p>}
      {block.r && <div className="chok-commentary" data-lookup={COMMENTARY_LOOKUP[part]}>{COMMENTATOR[part] && <span className="chok-commentator" data-lookup="off">{COMMENTATOR[part]}</span>}{block.r.split('\n').map((line, i) => <p key={i}><Runs text={line} /></p>)}</div>}
    </div>;
  }
  if (block.t === 'c') {
    return <div className="chok-commentary" data-lookup={COMMENTARY_LOOKUP[part]}>{first && COMMENTATOR[part] && <span className="chok-commentator" data-lookup="off">{COMMENTATOR[part]}</span>}<p><Runs text={block.x} /></p></div>;
  }
  if (block.t === 'tr') {
    return <div className="chok-translation">{first && <span className="chok-commentator">בלשון הקודש</span>}<p><Runs text={block.x} /></p></div>;
  }
  return <p className={`chok-text${part === 'haftarah' ? ' is-haftarah' : ''}`} data-lookup={LOOKUP[part]}><Runs text={block.x} /></p>;
}

function PartText({ parasha, day, part, showName }) {
  const dayData = parasha.days.find(item => item.key === day);
  const data = dayData?.parts.find(item => item.key === part);
  return <section className="chok-group" aria-label={showName ? `פרשת ${parasha.he}` : undefined}>
    {showName && <h2 className="chok-parasha-head">פרשת {parasha.he}</h2>}
    {!data ? <p className="chok-none">ב{dayDef(day).he} של פרשת {parasha.he} אין במהדורה {CHOK_PARTS[part]}.</p>
      : data.s.map((section, i) => <div key={i} className="chok-section">
        {sourceLabel(part, section.h) && <p className="chok-source">{sourceLabel(part, section.h)}</p>}
        {section.b.map((block, j) => <Block key={j} block={block} part={part} first={section.b.findIndex(other => other.t === block.t) === j} />)}
      </div>)}
  </section>;
}

// The part tabs: copper text over a thin underline (Rule A, a tab) — never a fill.
function PartTabs({ parts, current, onChange }) {
  const cols = parts.length <= 4 ? parts.length : parts.length <= 6 ? 3 : 4;
  return <div className="chok-parts" role="tablist" aria-label="חלקי הלימוד" style={{ '--chok-cols': cols }}>{parts.map(key => <button key={key} type="button" role="tab" id={`chok-tab-${key}`} aria-selected={key === current} aria-controls="chok-part" className={key === current ? 'is-on' : ''} onClick={() => onChange(key)}>{CHOK_PARTS[key]}</button>)}</div>;
}

function DayStrip({ ids, day, go }) {
  return <div className="chok-days" role="group" aria-label="ימי השבוע">{CHOK_DAYS.map(item => <button key={item.key} type="button" aria-pressed={item.key === day} aria-label={item.he} className={item.key === day ? 'is-on' : ''} onClick={() => go(chokRoute.day(ids, item.key), { replace: true })}>{item.short}</button>)}</div>;
}

function weekNote(today, ids) {
  if (!today) return null;
  if (today.week.kind === 'combined') return 'השבוע קוראים שתי פרשיות: בכל חלק לומדים את סדר היום של שתיהן, זו אחר זו.';
  if (today.week.kind === 'vezot') return `בשבת זו קוראים ${festivalName(today.week.festival)}; עד שמחת תורה לומדים בחק לישראל את פרשת וזאת הברכה, הנקראת אחריה (הקדמת החיד״א, אות ח׳).`;
  if (today.week.kind === 'next') return `בשבת זו קוראים ${festivalName(today.week.festival)}; לומדים את ${parashotTitle(ids)}, הנקראת אחריה (הקדמת החיד״א, אות ח׳).`;
  return null;
}

function DayReader({ ids, day, initialPart, isToday, today, go, tzid }) {
  const font = useReadingFont(22);
  const title = dayTitle(ids, day);
  const parts = partsOfDay(ids, day);
  const [part, setPart] = useState(initialPart && parts.includes(initialPart) ? initialPart : parts[0]);
  useEffect(() => { setPart(initialPart && parts.includes(initialPart) ? initialPart : parts[0]); }, [ids.join('+'), day]);
  useEffect(() => { window.scrollTo(0, 0); }, [ids.join('+'), day, part]);
  const resource = useResource(() => Promise.all(ids.map(id => loadChokParasha(id))), [ids.join('+')]);
  useEffect(() => {
    if (!resource.data || packsBundledWithApp()) return undefined;
    const idle = globalThis.requestIdleCallback || (fn => setTimeout(fn, 1500));
    const handle = idle(() => { warmChokWeek(ids).catch(() => {}); });
    return () => (globalThis.cancelIdleCallback && typeof handle === 'number' ? globalThis.cancelIdleCallback(handle) : clearTimeout(handle));
  }, [resource.data]);
  const { recordInteraction } = useStudyTimer({ workId: WORK_ID, workTitle: CHOK_TITLE, unitId: `${ids.join('+')}/${day}`, unitLabel: title, category: 'torah_study', source: WORK_ID, tzid });
  const { previous, next } = chokNeighbours(ids, day);
  const open = target => go(target.route, { replace: true });
  const choose = key => { setPart(key); if (!isToday) go(chokRoute.day(ids, day, key), { replace: true, quiet: true }); };
  const at = parts.indexOf(part);
  const following = at >= 0 && at < parts.length - 1 ? parts[at + 1] : null;
  const prayer = CHOK_PRAYERS[part];
  const note = isToday ? weekNote(today, ids) : null;
  const dayHe = dayDef(day).he;
  return <section className="shalom-rav sr-reader chok-reader" style={{ '--sr-size': `${font}px` }}>
    <ReaderDock previous={previous} next={next} onSelect={open} label="ניווט בחק לישראל" />
    <Breadcrumbs items={[{ label: 'סידור', onNavigate: () => goSiddur(go) }, { label: CHOK_TITLE, onNavigate: () => go(chokRoute.all()) }, { label: title }]} />
    <BackNavigation label="חזרה לסידור" onClick={() => goSiddur(go)} />
    <header className="sr-head">
      <p className="eyebrow">{isToday ? (today?.shabbat ? `${CHOK_TITLE} · שבת קודש` : `${CHOK_TITLE} · הלימוד של היום`) : CHOK_TITLE}</p>
      <div className="reader-title-row"><h1>{parashotTitle(ids)}</h1><HeartToggle item={routeFavorite(WORK_ID, chokRoute.home(), `${CHOK_TITLE} — הלימוד של היום`, 'סידור')} /></div>
      <p className="chok-day-name">{dayHe}</p>
      <TitleOrnament />
      <div className="reader-tools"><TextSizeControl /></div>
    </header>
    {note && <p className="chok-week-note" role="note">{note}</p>}
    <DayStrip ids={ids} day={day} go={go} />
    {parts.length > 1 && <PartTabs parts={parts} current={part} onChange={choose} />}
    {prayer && <button type="button" className="chok-prayer-link" onClick={() => go(chokRoute.intro(prayer))}>{displayHeading(prayer)}<span aria-hidden="true">←</span></button>}
    {resource.loading && <p className="loading" role="status">פותחים את חק לישראל…</p>}
    {resource.error && <p className="notice" role="alert">{resource.error}</p>}
    {resource.data && <article id="chok-part" className="sr-body chok-body" role={parts.length > 1 ? 'tabpanel' : undefined} aria-labelledby={parts.length > 1 ? `chok-tab-${part}` : undefined} lang="he">
      {resource.data.map(parasha => <PartText key={parasha.id} parasha={parasha} day={day} part={part} showName={ids.length > 1} />)}
    </article>}
    {resource.data && following && <button type="button" className="chok-next-part" onClick={() => choose(following)}><span>להמשך הלימוד</span><strong>{CHOK_PARTS[following]}</strong><b aria-hidden="true">←</b></button>}
    {resource.data && !following && <StudyCompletion workId={WORK_ID} workTitle={CHOK_TITLE} unitId={`${ids.join('+')}/${day}`} unitLabel={title} source={WORK_ID} tzid={tzid} onBeforeRecord={recordInteraction} />}
    <ReaderNavigation previous={previous} next={next} onSelect={open} endLabel={`סוף ${CHOK_TITLE}`} />
    <footer className="sr-about chok-about">
      <button type="button" onClick={() => go(chokRoute.intro())}>הקדמות ותפילות</button>
      <span aria-hidden="true">·</span>
      <button type="button" onClick={() => go(chokRoute.all())}>כל הפרשות</button>
      {!isToday && <><span aria-hidden="true">·</span><button type="button" onClick={() => go(chokRoute.home())}>הלימוד של היום</button></>}
      <p>{CHOK_CREDIT} · <a href={CHOK_LICENSE.url} target="_blank" rel="noreferrer">{CHOK_LICENSE.title}</a> · זמין גם בלי חיבור לרשת.</p>
    </footer>
  </section>;
}

function IntroPage({ anchor, go, tzid }) {
  const font = useReadingFont(22);
  const resource = useResource(() => loadChokIntro(), []);
  useEffect(() => {
    if (!resource.data) return;
    // After the app has focused the page's title (it may scroll to it), the prayer or introduction asked for comes into view.
    const timer = setTimeout(() => {
      const target = anchor ? document.getElementById(`chok-intro-${encodeURIComponent(anchor)}`) : null;
      if (target) target.scrollIntoView({ block: 'start' }); else window.scrollTo(0, 0);
    }, 260);
    return () => clearTimeout(timer);
  }, [resource.data, anchor]);
  useStudyTimer({ workId: WORK_ID, workTitle: CHOK_TITLE, unitId: 'intro', unitLabel: 'הקדמות', category: 'torah_study', source: WORK_ID, tzid });
  return <section className="shalom-rav sr-reader chok-reader chok-intro" style={{ '--sr-size': `${font}px` }}>
    <Breadcrumbs items={[{ label: 'סידור', onNavigate: () => goSiddur(go) }, { label: CHOK_TITLE, onNavigate: () => go(chokRoute.home()) }, { label: 'הקדמות ותפילות' }]} />
    <BackNavigation label="לחק לישראל" onClick={() => go(chokRoute.home())} />
    <header className="sr-head">
      <p className="eyebrow">{CHOK_TITLE}</p>
      <h1>הקדמות ותפילות</h1>
      <TitleOrnament />
      <div className="reader-tools"><TextSizeControl /></div>
    </header>
    {resource.loading && <p className="loading" role="status">פותחים את ההקדמות…</p>}
    {resource.error && <p className="notice" role="alert">{resource.error}</p>}
    {resource.data && <>
      <nav className="chok-intro-index" aria-label="תוכן ההקדמות">{resource.data.sections.map(section => <Fragment key={section.title}>
        <button type="button" onClick={() => go(chokRoute.intro(section.title), { replace: true })}>{displayHeading(section.title)}</button>
        {section.b.filter(block => block.t === 'h').map(block => <button key={block.x} type="button" className="is-sub" onClick={() => go(chokRoute.intro(block.x), { replace: true })}>{displayHeading(block.x)}</button>)}
      </Fragment>)}</nav>
      <article className="sr-body chok-body" lang="he">{resource.data.sections.map(section => <section key={section.title} className="chok-intro-section">
        <h2 id={`chok-intro-${encodeURIComponent(section.title)}`} className="sr-section">{displayHeading(section.title)}</h2>
        {section.b.map((block, i) => (block.t === 'h' ? <h3 key={i} id={`chok-intro-${encodeURIComponent(block.x)}`} className="chok-intro-heading">{displayHeading(block.x)}</h3>
          : block.t === 'note' ? <p key={i} className="chok-note"><Runs text={block.x} /></p>
            : <p key={i} className="chok-text"><Runs text={block.x} /></p>))}
      </section>)}</article>
      <p className="sr-provenance">{CHOK_CREDIT} · <a href={CHOK_LICENSE.url} target="_blank" rel="noreferrer">{CHOK_LICENSE.title}</a></p>
    </>}
  </section>;
}

function AllPage({ go, today }) {
  const books = useMemo(() => CHOK.parashot.reduce((map, parasha) => map.set(parasha.book, [...(map.get(parasha.book) || []), parasha]), new Map()), []);
  return <section className="shalom-rav sr-home chok-all">
    <Breadcrumbs items={[{ label: 'סידור', onNavigate: () => goSiddur(go) }, { label: CHOK_TITLE }]} />
    <BackNavigation label="חזרה לסידור" onClick={() => goSiddur(go)} />
    <header className="sr-head">
      <h1>{CHOK_TITLE}</h1>
      <TitleOrnament />
      <p className="sr-subtitle">סדר הלימוד היומי: תורה, נביאים, כתובים, משנה, גמרא, זוהר, הלכה ומוסר</p>
    </header>
    {today && <div className="siddur-group-rows chok-today-row"><button type="button" className="siddur-entry" onClick={() => go(chokRoute.home())}><span className="siddur-entry-text"><strong>הלימוד של היום</strong><small>{dayTitle(today.ids, today.day)}</small></span><span aria-hidden="true">←</span></button></div>}
    {[...books].map(([book, list]) => <section key={book} className="library-group">
      <h2 className="library-subhead">ספר {book}</h2>
      <div className="siddur-group-rows">{list.map(parasha => <button key={parasha.id} type="button" className="siddur-entry" onClick={() => go(chokRoute.day([parasha.id], 'sun'))}><span className="siddur-entry-text"><strong>פרשת {parasha.he}</strong></span><span aria-hidden="true">←</span></button>)}</div>
    </section>)}
    <footer className="sr-about">
      <button type="button" onClick={() => go(chokRoute.intro())}>הקדמות ותפילות</button>
      <p>{CHOK_CREDIT} · <a href={CHOK_LICENSE.url} target="_blank" rel="noreferrer">{CHOK_LICENSE.title}</a>. {CHOK.parashot.length} פרשות, שבעה ימים לכל פרשה, זמינים גם בלי חיבור לרשת.</p>
    </footer>
  </section>;
}

export default function ChokLeYisraelPage({ route, go, context, settings, times, now, tzid = 'Asia/Jerusalem' }) {
  const parsed = parseChokRoute(route) || { view: 'today' };
  const today = chokToday({ context, times, now: now || new Date(), il: calendarIsIsrael(settings || {}) });
  if (parsed.view === 'intro') return <IntroPage anchor={parsed.anchor} go={go} tzid={tzid} />;
  if (parsed.view === 'all') return <AllPage go={go} today={today} />;
  if (parsed.view === 'day') return <DayReader key={`${parsed.ids.join('+')}/${parsed.day}`} ids={parsed.ids} day={parsed.day} initialPart={parsed.part} isToday={false} go={go} tzid={tzid} />;
  if (parsed.view === 'today' && today) return <DayReader key={`today/${today.ids.join('+')}/${today.day}`} ids={today.ids} day={today.day} isToday today={today} go={go} tzid={tzid} />;
  return <AllPage go={go} today={today} />;
}
