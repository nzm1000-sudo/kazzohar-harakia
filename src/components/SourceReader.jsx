import { useEffect, useState } from 'react';
import { useLocal, useResource } from '../hooks.jsx';
import { getText, sefariaLink } from '../services/sefaria.mjs';
import { semanticHebrewParagraphs } from '../hebrewText.mjs';
import ReaderNavigation from './ReaderNavigation.jsx';
import { BackNavigation, Breadcrumbs } from './LocalNavigation.jsx';

export function ResourceState({ resource }) {
  if (resource.loading) return <p className="loading" role="status">פותחים את המקור…</p>;
  if (resource.error) return <p className="notice error" role="alert">{resource.error} <button onClick={resource.retry}>ניסיון נוסף</button></p>;
  return null;
}
export default function SourceReader({ reference, title, onClose, mode = 'nikud', navigation }) {
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
  const text = resource.data;
  const paragraphs = text ? semanticHebrewParagraphs(text.hebrew, title || text.ref || reference, text.indexes) : [];
  const highlightIndex = expanded && segment ? segment.number - 1 : null;
  useEffect(() => { setExpanded(false); }, [reference]);
  useEffect(() => {
    if (highlightIndex !== null && text) document.getElementById('segment-' + highlightIndex)?.scrollIntoView({ block: 'center' });
  }, [highlightIndex, text]);
  useEffect(() => {
    if (navigation?.flowKey) setProgress(value => ({ ...value, [navigation.flowKey]: reference }));
  }, [navigation?.flowKey, reference]);
  return <section className={'source-reader ' + (focus ? 'focused' : '')} aria-label={title || reference}>
    {navigation?.breadcrumbs && <Breadcrumbs items={navigation.breadcrumbs} onNavigate={item => item.onNavigate?.() || navigation.onBack?.()}/>} 
    {navigation?.backLabel && <BackNavigation label={navigation.backLabel} onClick={navigation.onBack}/>} 
    <div className="reader-tools">
      {onClose && !navigation?.backLabel && <button onClick={onClose}>חזרה לתוכן העניינים</button>}
      <button onClick={() => setFocus(v => !v)}>{focus ? 'יציאה מקריאה שקטה' : 'קריאה שקטה'}</button>
      <label>גודל אות <input type="range" min="20" max="38" value={font} onChange={e => setFont(+e.target.value)} /></label>
      <button aria-pressed={favorites.includes(reference)} onClick={() => setFavorites(f => f.includes(reference) ? f.filter(r => r !== reference) : [...f, reference])}>{favorites.includes(reference) ? 'נשמר בספרייה' : 'שמירה בספרייה'}</button>
    </div>
    <h2>{title || text?.ref || reference}</h2>
    {segment && <p className="segment-scope">{expanded ? <>מוצג הסימן המלא; הסעיף הרלוונטי מודגש. <button onClick={() => setExpanded(false)}>חזרה לסעיף בלבד</button></> : <>מוצג סעיף אחד מתוך הסימן. <button onClick={() => setExpanded(true)}>הרחבה להקשר המלא</button></>}</p>}
    <ResourceState resource={resource}/>
    {text && <article className="reading-text" data-policy={text.policy} lang="he" style={{fontSize:font}}>{paragraphs.map((part,i) => <p id={'segment-'+part.source} className={'reading-segment reading-'+part.type + (part.source === highlightIndex ? ' highlighted' : '')} aria-current={part.source === highlightIndex ? 'true' : undefined} key={i}>{part.text}</p>)}</article>}
    {text && <footer className="source-credit"><details><summary>פרטי מקור</summary><p>{text.version || 'מהדורה עברית'}{text.license ? ` · ${text.license}` : ''} · הטקסט מוצג ללא עיצוב HTML.</p><a href={sefariaLink(text.ref || reference)} target="_blank" rel="noreferrer">פתיחת המקור החיצוני</a></details></footer>}
    {text && navigation && (navigation.previous || navigation.next || navigation.endLabel) && <ReaderNavigation {...navigation} onSelect={navigation.onSelect}/>}
  </section>;
}
