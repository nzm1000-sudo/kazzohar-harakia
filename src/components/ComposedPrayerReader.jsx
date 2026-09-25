import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocal } from '../hooks.jsx';
import { BackNavigation, Breadcrumbs } from './LocalNavigation.jsx';
import PrayerTableOfContents from './PrayerTableOfContents.jsx';
import { rememberLearning } from '../services/learningMemory.mjs';
import { composeWeekdayMincha } from '../services/prayer/weekdayMinchaComposer.mjs';
import { buildTimeContext } from '../services/prayer/timeContext.mjs';
import { generatePrayerNavigation } from '../services/prayer/prayerNavigation.mjs';
import { createPrayerSession, documentForSession, firstChangedSection, loadOpenSession, saveSession, sessionInputs } from '../services/prayer/prayerSession.mjs';

const BLOCK_CLASS = {
  heading: 'reading-segment reading-section-heading siddur-block-heading',
  instruction: 'reading-segment reading-instruction siddur-block-instruction',
  source: 'reading-segment reading-source siddur-block-source',
  recitedText: 'reading-segment reading-prayer siddur-block-recited',
};

const UNDECIDED_NOTE = {
  'yehi-shem': 'הקטע הבא מופיע במהדורה לימים שאין בהם תחנון; מקומו בתפילת מנחה עדיין לא אומת.',
  tachanun: 'לא הוכרע כאן אם אומרים וידוי היום; הקטע מוצג כפי שהוא במהדורה.',
  'season.gevurot': 'בחירת הנוסח העונתי למקום הזה לא הוכרעה; מוצגות שתי החלופות.',
  'season.birkat-hashanim': 'בחירת הנוסח העונתי למקום הזה לא הוכרעה; מוצגות שתי החלופות.',
};
const NEEDS_SUNSET_NOTE = 'אמירת הוידוי תלויה בשעת השקיעה — ראו את השאלה בראש התפילה.';

function timeOfDay(instant, tzid) {
  try { return new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: tzid }).format(new Date(instant)); } catch { return ''; }
}

// Pure view of a composed document, so it can be rendered and tested without a session.
export function PrayerDocumentView({ composed, font = 25, changedSectionId = null, onReopen }) {
  const { document, rules } = composed;
  let lastNote = null;
  return <article className="reading-text siddur-semantic composed-prayer-text" data-policy="siddur" lang="he" style={{ fontSize: font }}>
    {document.sections.map(section => <section key={section.id} id={`prayer-section-${section.id}`} aria-label={section.title}>
      {changedSectionId === section.id && <p className="composed-notice" role="note">מאז שנפתחה התפילה השתנו נתוני הזמן. הנוסח שכבר מוצג לא שונה. {onReopen && <button type="button" className="link" onClick={onReopen}>פתיחה מחדש לפי השעה הנוכחית</button>}</p>}
      {section.blocks.map(block => {
        let note = null;
        if (block.undecided) {
          const ruleId = block.rules.find(id => rules[id]?.status === 'needs-input' || rules[id]?.status === 'unresolved');
          const text = rules[ruleId]?.status === 'needs-input' ? NEEDS_SUNSET_NOTE : UNDECIDED_NOTE[ruleId];
          if (text && text !== lastNote) note = <p className="prayer-undecided-note" role="note">{text}</p>;
          lastNote = text || lastNote;
        } else lastNote = null;
        return <Fragment key={block.id}>{note}<p id={block.id} data-block-id={block.id} data-siddur-type={block.type} className={BLOCK_CLASS[block.type]}>{block.text}</p></Fragment>;
      })}
    </section>)}
  </article>;
}

// The block to realign after a recompose: the same block, else the nearest surviving one before it, else after it.
export function anchorAfterRecompose(order, anchorId, exists) {
  if (exists(anchorId)) return anchorId;
  const index = order.indexOf(anchorId);
  if (index < 0) return null;
  for (let distance = 1; distance < order.length; distance += 1) {
    if (index - distance >= 0 && exists(order[index - distance])) return order[index - distance];
    if (index + distance < order.length && exists(order[index + distance])) return order[index + distance];
  }
  return null;
}

export default function ComposedPrayerReader({ reference, navigation, settings = {}, now, times, compass = null, onClose }) {
  const [font, setFont] = useLocal('source-font', 25);
  const [focus, setFocus] = useLocal('reading-focus', false);
  const [practice, setPractice] = useLocal('kz-prayer-practice-v1', { setting: 'minyan' });
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [currentBlockId, setCurrentBlockId] = useState(null);
  const openedAt = useRef(now ? new Date(now) : new Date());
  const [session, setSession] = useState(() => {
    const inputs = sessionInputs({ now: openedAt.current, settings, times, preferences: practice });
    const prayerDate = buildTimeContext({ now: openedAt.current, settings }).prayerDate;
    const open = loadOpenSession({ prayerDate, now: openedAt.current });
    return open ? { ...open, continued: true } : createPrayerSession(inputs);
  });
  const composed = useMemo(() => documentForSession(session) || composeWeekdayMincha({ ...session.inputs, now: new Date(session.inputs.instant) }), [session.id]);
  const current = useMemo(() => composeWeekdayMincha({ now: now || new Date(), settings, times, preferences: session.inputs.preferences, answers: session.inputs.answers }), [now, settings, times, session.id]);
  const position = useRef(session.position);
  const keepPlace = useRef(null);
  const changedSectionId = current.time.prayerDate === composed.time.prayerDate ? firstChangedSection(composed.document, current.document) : composed.document.sections[0]?.id;
  const renew = (overrides, { stayInPlace = false } = {}) => {
    if (stayInPlace && typeof document !== 'undefined') {
      const visible = [...document.querySelectorAll('[data-block-id]')].find(node => node.getBoundingClientRect().bottom > 0);
      keepPlace.current = visible ? { id: visible.id, top: visible.getBoundingClientRect().top, order: composed.document.sections.flatMap(section => section.blocks.map(block => block.id)) } : null;
    }
    const inputs = sessionInputs({ now: now || new Date(), settings, times, preferences: overrides.preferences || session.inputs.preferences, answers: overrides.answers || session.inputs.answers });
    setSession({ ...createPrayerSession(inputs), position: position.current });
  };
  useLayoutEffect(() => {
    const anchor = keepPlace.current;
    if (!anchor) return;
    const id = anchorAfterRecompose(anchor.order, anchor.id, candidate => Boolean(document.getElementById(candidate)));
    const node = id && document.getElementById(id);
    if (node) window.scrollBy(0, node.getBoundingClientRect().top - anchor.top);
  }, [session.id]);
  useEffect(() => { saveSession({ ...session, position: position.current }); }, [session.id]);
  useEffect(() => { rememberLearning(`source:${navigation?.flowKey || 'Weekday Mincha'}`, { source: 'source', reference, title: composed.document.title, flowKey: navigation?.flowKey }); }, [reference]);
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (keepPlace.current) keepPlace.current = null;
    else {
      const target = (session.continued && session.position && document.getElementById(session.position))
        || document.getElementById(`prayer-section-${String(reference).split(', ').pop()?.toLowerCase()}`);
      target?.scrollIntoView?.({ block: 'start' });
    }
    let idle = 0;
    const track = () => {
      clearTimeout(idle);
      idle = setTimeout(() => {
        const visible = [...document.querySelectorAll('[data-block-id]')].find(node => node.getBoundingClientRect().bottom > 80);
        if (!visible || visible.id === position.current) return;
        position.current = visible.id;
        setCurrentBlockId(visible.id);
        saveSession({ ...session, position: visible.id });
      }, 400);
    };
    window.addEventListener('scroll', track, { passive: true });
    return () => { window.removeEventListener('scroll', track); clearTimeout(idle); };
  }, [session.id]);
  const { document: doc, time, calendar, rules } = composed;
  const setting = session.inputs.preferences.setting;
  const needsSunset = rules.tachanun?.status === 'needs-input';
  const headings = doc.sections.filter(section => section.blocks.some(block => block.type === 'heading'));
  const locationLabel = time.location.name ? `${time.location.name}${time.location.isDefault ? ' (מיקום ברירת מחדל)' : ''}` : 'מיקום לא נבחר';
  const navigationItems = useMemo(() => generatePrayerNavigation(doc), [doc.id]);
  const handleNavigate = (navItem) => {
    setIsTocOpen(false);
    const anchor = navItem?.blockId || navItem?.id;
    if (anchor) {
      setTimeout(() => {
        document.getElementById(anchor)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
      }, 50);
    }
  };
  return <section className={'source-reader composed-prayer ' + (focus ? 'focused' : '')} aria-label={doc.title}>
    {navigation?.breadcrumbs && <Breadcrumbs items={navigation.breadcrumbs} onNavigate={item => { if (item.onNavigate) item.onNavigate(); else navigation.onBack?.(); }}/>}
    {navigation?.backLabel && <BackNavigation label={navigation.backLabel} onClick={navigation.onBack}/>}
    {compass}
    <PrayerTableOfContents
      prayerDocument={doc}
      currentBlockId={currentBlockId}
      navigationItems={navigationItems}
      isOpen={isTocOpen}
      onToggle={() => setIsTocOpen(!isTocOpen)}
      onNavigate={handleNavigate}
    />
    <div className="reader-tools">
      {onClose && !navigation?.backLabel && <button onClick={onClose}>חזרה לתוכן העניינים</button>}
      <button onClick={() => setFocus(value => !value)}>{focus ? 'יציאה מקריאה שקטה' : 'קריאה שקטה'}</button>
      <label>גודל אות <input type="range" min="20" max="38" value={font} onChange={event => setFont(+event.target.value)} /></label>
    </div>
    <h2 className="siddur-heading">{doc.title}</h2>
    <p className="composed-status">{[calendar.hebrew.label, locationLabel, 'נוסח עדות המזרח'].filter(Boolean).join(' · ')}</p>
    <div className="personal-switch composed-setting" role="group" aria-label="אופן התפילה">
      {[['minyan', 'במניין'], ['individual', 'ביחידות']].map(([value, label]) => <button key={value} type="button" className={setting === value ? 'selected' : ''} aria-pressed={setting === value} onClick={() => { if (setting === value) return; setPractice({ setting: value }); renew({ preferences: { setting: value } }, { stayInPlace: true }); }}>{label}</button>)}
    </div>
    {session.continued && <p className="composed-notice" role="note">ממשיכים את התפילה שנפתחה בשעה {timeOfDay(session.createdAt, time.tzid)}. <button type="button" className="link" onClick={() => renew({})}>פתיחה מחדש להיום</button></p>}
    {doc.status === 'unsupported' && <p className="composed-notice" role="note">ההתאמה האוטומטית של מנחה עדיין אינה חלה על היום ({doc.unsupportedReasons.join(', ')}). מוצג נוסח המהדורה המלא, עם כל ההוראות והחלופות.</p>}
    {doc.status === 'partial' && <p className="composed-notice" role="note">רוב התפילה הותאם ליום. קטע שעדיין לא הוכרע מסומן במקומו.</p>}
    {needsSunset && <div className="composed-notice" role="group" aria-label="שאלה לפני התפילה"><p>לא התקבלו זמני היום למקום הזה. האם השקיעה כבר עברה?</p><div className="personal-switch"><button type="button" onClick={() => renew({ answers: { sunset: 'before' } })}>עדיין לא</button><button type="button" onClick={() => renew({ answers: { sunset: 'after' } })}>כבר עברה</button></div></div>}
    {headings.length > 1 && <nav className="composed-toc" aria-label="חלקי התפילה">{headings.map(section => <button key={section.id} type="button" onClick={() => document.getElementById(`prayer-section-${section.id}`)?.scrollIntoView({ block: 'start' })}>{section.title}</button>)}</nav>}
    <PrayerDocumentView composed={composed} font={font} changedSectionId={changedSectionId} onReopen={() => renew({})} />
    <footer className="source-credit"><p>{`${doc.source.work} · ${doc.source.edition} · ${doc.source.provider} · ${doc.source.license}`}</p><p>הנוסח מורכב מקטעי המהדורה עצמם; הבחירה בין החלופות נעשית לפי תאריך התפילה והמקום.</p><a href={doc.source.url} target="_blank" rel="noreferrer">פתיחת המקור החיצוני</a></footer>
  </section>;
}
