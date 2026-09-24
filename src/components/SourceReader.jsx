import { useEffect, useState } from 'react';
import { useLocal, useResource } from '../hooks.jsx';
import { getText, sefariaLink } from '../services/sefaria.mjs';
import { semanticHebrewParagraphs } from '../hebrewText.mjs';
import ReaderNavigation from './ReaderNavigation.jsx';
import { BackNavigation, Breadcrumbs } from './LocalNavigation.jsx';
import { completeLearning, rememberLearning } from '../services/learningMemory.mjs';
import { canCacheContent, isContentPinned, pinContent, unpinContent } from '../services/contentCache.mjs';
import { formatVisibleSourceTitle } from '../services/tanakhReferences.mjs';
import { initialBearing, prayerDirectionLabel } from '../services/prayerCompass.mjs';
import { prayerTypeFromFlowKey, resolvePrayerConditions } from '../services/prayerConditions.mjs';

export function ResourceState({ resource }) {
  if (resource.loading) return <p className="loading" role="status">פותחים את המקור…</p>;
  if (resource.error) return <p className="notice error" role="alert">{resource.error} <button onClick={resource.retry}>ניסיון נוסף</button></p>;
  return null;
}
// A small, subtle compass reused from the full prayer-compass logic — no live sensor,
// just the same bearing calculation — shown only when a prayer is opened from Today.
function CompactPrayerCompass({ settings, onOpen }) {
  const bearing = initialBearing(settings?.location);
  if (bearing === null) return null;
  return <button type="button" className="reader-compass-badge" onClick={onOpen} aria-label={`מצפן תפילה · כיוון ${prayerDirectionLabel(bearing)}`}>
    <span aria-hidden="true" className="reader-compass-icon">⌖</span><span>מצפן תפילה</span>
  </button>;
}
// Visually distinct from the prayer text itself: the instruction/rubric LABEL uses the
// muted rust --instruction token; the actual RECITED phrase (real verified nusach
// text) stays in the prayer's own reading-ink color, never confused with an editorial note.
function PrayerConditionPanel({ conditions }) {
  if (!conditions) return null;
  const { inserts, omissions, notes, review } = conditions;
  if (!inserts.length && !omissions.length && !notes.length && !review.length) return null;
  return <aside className="siddur-condition-panel" aria-label="מה חל היום בתפילה זו"><p className="siddur-instruction-label">מה מוסיפים/משמיטים היום</p>
    {inserts.map(item => <p className="siddur-condition-chip insert" key={`insert-${item.id}`}><span className="siddur-instruction-label">אומרים כאן:</span> <span className="siddur-recited-text">{item.text}</span></p>)}
    {omissions.map(item => <p className="siddur-condition-chip omit" key={`omit-${item.id}`}><span className="siddur-instruction-label">לא אומרים היום:</span> <span className="siddur-recited-text">{item.text}</span></p>)}
    {notes.map(item => <p className="siddur-condition-chip note siddur-instruction-label" key={`note-${item.id}`}>{item.text}</p>)}
    {review.map(item => <p className="siddur-condition-chip review" key={`review-${item.id}`}><span className="siddur-instruction-label">לבדיקה (לא מאומת):</span> <span className="siddur-recited-text">{item.text}</span></p>)}
  </aside>;
}
export default function SourceReader({ reference, title, onClose, mode = 'nikud', navigation, settings, showCompass, onOpenCompass, jewishContext }) {
  const [expanded, setExpanded] = useState(false);
  const focused = useResource(() => getText(reference, mode), [reference, mode]);
  // A segment reference (סעיף) may be expanded to its full section (סימן) while keeping the segment highlighted.
  const segment = focused.data?.segmentNumber ? { number: focused.data.segmentNumber, sectionRef: focused.data.sectionRef } : null;
  const context = useResource(() => (expanded && segment ? getText(segment.sectionRef, mode) : Promise.resolve(null)), [expanded, segment?.sectionRef, mode]);
  const resource = expanded && segment ? context : focused;
  const [font, setFont] = useLocal('source-font', 25);
  const [focus, setFocus] = useLocal('reading-focus', false);
  const [favorites, setFavorites] = useLocal('source-favorites', []);
  const [progress, setProgress] = useLocal('reader-progress-v1', {});
  const [, setCacheRevision] = useState(0);
  const amidahLayer = /Amida|Amidah|עמידה/i.test(reference);
  const [personalProfile, setPersonalProfile] = useState(() => { try { return JSON.parse(localStorage.getItem('kz-personal-tools-v1') || '{}'); } catch { return {}; } });
  const personalVerseVisible = amidahLayer && personalProfile.showPersonalVerseInSiddur === true && personalProfile.personalVerse;
  const togglePersonalVerse = () => {
    const next = { ...personalProfile, showPersonalVerseInSiddur: !personalProfile.showPersonalVerseInSiddur };
    setPersonalProfile(next);
    try { localStorage.setItem('kz-personal-tools-v1', JSON.stringify(next)); } catch {}
  };
  const text = resource.data;
  const cacheType = /^Siddur /i.test(reference) ? 'siddur' : 'source';
  const prayerType = cacheType === 'siddur' ? prayerTypeFromFlowKey(navigation?.flowKey) : null;
  const conditions = cacheType === 'siddur' && jewishContext ? resolvePrayerConditions(jewishContext, prayerType) : null;
  const cacheKey = `${reference}|${mode}`;
  const cacheEligible = Boolean(text && !text.bundledOffline && canCacheContent(text));
  const pinned = cacheEligible && isContentPinned(cacheType, cacheKey);
  const memoryId = `source:${navigation?.flowKey || reference}`;
  const displayTitle = formatVisibleSourceTitle(title || text?.ref || reference, reference);
  const paragraphs = text ? semanticHebrewParagraphs(text.hebrew, displayTitle, text.indexes) : [];
  const highlightIndex = expanded && segment ? segment.number - 1 : null;
  useEffect(() => { setExpanded(false); }, [reference]);
  useEffect(() => {
    if (highlightIndex !== null && text) document.getElementById('segment-' + highlightIndex)?.scrollIntoView({ block: 'center' });
  }, [highlightIndex, text]);
  useEffect(() => {
    if (navigation?.flowKey) setProgress(value => ({ ...value, [navigation.flowKey]: reference }));
  }, [navigation?.flowKey, reference]);
  useEffect(() => { rememberLearning(memoryId, { source: 'source', reference, title: displayTitle, flowKey: navigation?.flowKey }); }, [memoryId, reference, displayTitle, navigation?.flowKey]);
  return <section className={'source-reader ' + (focus ? 'focused' : '')} aria-label={displayTitle}>
    {navigation?.breadcrumbs && <Breadcrumbs items={navigation.breadcrumbs} onNavigate={item => { if (item.onNavigate) item.onNavigate(); else navigation.onBack?.(); }}/>}
    {navigation?.backLabel && <BackNavigation label={navigation.backLabel} onClick={navigation.onBack}/>} 
    {showCompass && settings && <CompactPrayerCompass settings={settings} onOpen={onOpenCompass} />}
    <div className="reader-tools">
      {onClose && !navigation?.backLabel && <button onClick={onClose}>חזרה לתוכן העניינים</button>}
      <button onClick={() => setFocus(v => !v)}>{focus ? 'יציאה מקריאה שקטה' : 'קריאה שקטה'}</button>
      <label>גודל אות <input type="range" min="20" max="38" value={font} onChange={e => setFont(+e.target.value)} /></label>
      <button aria-pressed={favorites.includes(reference)} onClick={() => setFavorites(f => f.includes(reference) ? f.filter(r => r !== reference) : [...f, reference])}>{favorites.includes(reference) ? 'נשמר בספרייה' : 'שמירה בספרייה'}</button>
      {cacheEligible && <button aria-pressed={pinned} onClick={() => { const changed = pinned ? unpinContent(cacheType, cacheKey) : pinContent(cacheType, cacheKey, text); if (changed) setCacheRevision(value => value + 1); }}>{pinned ? 'הסר מהשמירה' : 'שמור לשימוש ללא אינטרנט'}</button>}
      {amidahLayer && personalProfile.personalVerse && <button aria-pressed={personalProfile.showPersonalVerseInSiddur === true} onClick={togglePersonalVerse}>{personalProfile.showPersonalVerseInSiddur === true ? 'הסתר את הפסוק האישי' : 'הצג את הפסוק שלי'}</button>}
    </div>
    <h2 className={cacheType === 'siddur' ? 'siddur-heading' : undefined}>{displayTitle}</h2>
    {text?.bundledOffline && <p className="notice" role="status">זמין ללא אינטרנט</p>}
    {text?.offlineCached && <p className="notice" role="status">זמין מהשמירה האחרונה</p>}
    {segment && <p className="segment-scope">{expanded ? <>מוצג הסימן המלא; הסעיף הרלוונטי מודגש. <button onClick={() => setExpanded(false)}>חזרה לסעיף בלבד</button></> : <>מוצג סעיף אחד מתוך הסימן. <button onClick={() => setExpanded(true)}>הרחבה להקשר המלא</button></>}</p>}
    <ResourceState resource={resource}/>
    <PrayerConditionPanel conditions={conditions} />
    {text && <article className="reading-text" data-policy={text.policy} lang="he" style={{fontSize:font}}>{paragraphs.map((part,i) => <p id={'segment-'+part.source} className={'reading-segment reading-'+part.type + (part.source === highlightIndex ? ' highlighted' : '')} aria-current={part.source === highlightIndex ? 'true' : undefined} key={i}>{part.text}</p>)}</article>}
    {personalVerseVisible && <aside className="personal-siddur-layer" aria-label="הפסוק שלי"><p className="eyebrow">הפסוק שלי</p><p className="verse-text">{personalProfile.personalVerse.text}</p><strong>{personalProfile.personalVerse.reference}</strong></aside>}
    {text && <footer className="source-credit"><button className="learning-complete" type="button" onClick={() => completeLearning(memoryId)}>סיימתי את המקור</button><details><summary>פרטי מקור</summary><p>{text.attribution || `${text.version || 'מהדורה עברית'}${text.license ? ` · ${text.license}` : ''}`}</p>{text.rightsNotice && <p>{text.rightsNotice} · שימוש לא־מסחרי בלבד · אין בכך משום תמיכה או אישור.</p>}<p>הטקסט מוצג ללא עיצוב HTML.</p><a href={text.sourceUrl || sefariaLink(text.ref || reference)} target="_blank" rel="noreferrer">פתיחת המקור החיצוני</a></details></footer>}
    {text && navigation && (navigation.previous || navigation.next || navigation.endLabel) && <ReaderNavigation {...navigation} onSelect={navigation.onSelect}/>}
  </section>;
}
