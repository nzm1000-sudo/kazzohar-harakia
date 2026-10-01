import { Component, Fragment, useEffect, useRef, useState } from 'react';
import PrayerSectionNav from './PrayerSectionNav.jsx';
import HeartToggle from './HeartToggle.jsx';
import TanakhRefText from './TanakhRefText.jsx';
import { isTanakhReference } from '../services/tanakhReferences.mjs';
import { sourceFavorite } from '../services/favorites.mjs';
import PrayerCompletion from './PrayerCompletion.jsx';
import { StudyCompletion } from './CompletionButton.jsx';
import { useLocal, useResource, useStudyTimer } from '../hooks.jsx';
import { getText, isSiddurReference } from '../services/sefaria.mjs';
import { readingParagraphs } from '../hebrewText.mjs';
import { hebrewNumeral } from '../services/hebrewNumerals.mjs';
import ReaderNavigation, { ReaderDock } from './ReaderNavigation.jsx';
import { BackNavigation, Breadcrumbs } from './LocalNavigation.jsx';
import { rememberLearning } from '../services/learningMemory.mjs';
import { fixHebrewTypography } from '../services/hebrewTypography.mjs';
import { canCacheContent, isContentPinned, pinContent, unpinContent } from '../services/contentCache.mjs';
import { formatVisibleSourceTitle } from '../services/tanakhReferences.mjs';
import { initialBearing, prayerDirectionLabel } from '../services/prayerCompass.mjs';
import { normalizeSiddurBlocks } from '../services/siddurBlocks.mjs';
import ComposedPrayerReader from './ComposedPrayerReader.jsx';
import DayServiceReader from './DayServiceReader.jsx';
import RiteServiceReader from './RiteServiceReader.jsx';
import { isRiteServiceReference, parseRiteServiceReference } from '../services/prayer/riteServiceComposer.mjs';
import { isDayServiceReference } from '../services/prayer/dayServiceComposer.mjs';
import { isWeekdayMinchaReference, WEEKDAY_MINCHA_PACK } from '../services/prayer/weekdayMinchaComposer.mjs';
import { engineEnabled } from '../services/prayer/composition.mjs';
import { insertPersonalVerses, loadPersonalVerses } from '../services/personalVerses.mjs';
import PrayerText from './PrayerText.jsx';
import { SIDDUR_HALACHA } from '../data/halachaSiddurLinks.mjs';
import { halachaConceptForTitle, siddurLayout } from '../data/nusach/siddurLayouts.mjs';
import { nusachForReference } from '../data/nusach/registry.mjs';
import { SIDDUR_SOURCES } from '../data/nusach/manifest.mjs';
import { parseTanakhRef } from '../services/localTanakh.mjs';
import { commentatorsOnVerse, hasVerseCommentaries } from '../services/torah/commentaries.mjs';
import { PassageCommentaries, VerseLayersLine, useCommentatorChoice } from './CommentaryPanel.jsx';
import { lookupFamilyForCategory } from '../services/wordLookup/families.mjs';
import { PrayerRoleDescriptions, describedByFor, usePrayerRoleIds } from './PrayerRoleDescriptions.jsx';
import AutoScrollControl from './AutoScrollControl.jsx';

export function ResourceState({ resource }) {
  if (resource.loading) return <p className="loading" role="status">פותחים את המקור…</p>;
  if (resource.error) return <p className="notice error" role="alert">{resource.error} <button onClick={resource.retry}>ניסיון נוסף</button></p>;
  return null;
}
export function SiddurBlockRenderer({ blocks, font, policy, highlightIndex = null }) {
  const roleIds = usePrayerRoleIds();
  return <article className="reading-text siddur-semantic" data-policy={policy} lang="he" style={{fontSize:font}}>
    <PrayerRoleDescriptions ids={roleIds} />
    {blocks.map((block, index) => <p id={'segment-'+block.source} className={`reading-segment reading-${block.legacyType}${block.source === highlightIndex ? ' highlighted' : ''} ${block.className}`} data-siddur-type={block.type} data-prayer-role={block.role} aria-describedby={describedByFor(roleIds, block)} aria-current={block.source === highlightIndex ? 'true' : undefined} key={`${block.type}-${index}`}>{block.caption && <span className="personal-verse-caption">{block.caption}</span>}<PrayerText block={block} /></p>)}
  </article>;
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
// A composer failure (bad pack, stale session, thrown error) falls back to the printed edition with a note —
// the Siddur must never go blank. (The previous Smart Maariv crashed the whole screen this way.)
export class ReaderErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { try { console.error('prayer reader fell back to the printed edition:', error); } catch { /* no console */ } }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

// A verse that opens its commentators on a tap is reachable by keyboard and switch too: the paragraph stays a paragraph
// (same look, same text) but is focusable, answers Enter / Space, and says whether its commentators are shown.
const verseTapA11y = (expanded, toggle) => ({
  role: 'button', tabIndex: 0, 'aria-expanded': expanded,
  onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); } },
});

const prayerTypeOf = flowKey => (/mussaf|musaf/i.test(flowKey || '') ? 'mussaf' : /mincha/i.test(flowKey || '') ? 'mincha' : /arvit|maariv/i.test(flowKey || '') ? 'maariv' : 'shacharit');

export default function SourceReader(props) {
  if (isRiteServiceReference(props.reference)) {
    // A composed service of a rite; if composing ever fails, the rite's printed edition is shown instead.
    const compass = props.showCompass && props.settings ? <CompactPrayerCompass settings={props.settings} onOpen={props.onOpenCompass} /> : null;
    const fallbackRef = props.navigation?.fallbackReference || null;
    const printed = fallbackRef
      ? <><p className="notice" role="status">התפילה המסודרת אינה זמינה כרגע; מוצג נוסח המהדורה.</p><LegacySourceReader {...props} reference={fallbackRef} /></>
      : <p className="notice" role="alert">התפילה {parseRiteServiceReference(props.reference)?.serviceId || ''} אינה זמינה כרגע.</p>;
    return <ReaderErrorBoundary fallback={printed}><RiteServiceReader {...props} compass={compass} /></ReaderErrorBoundary>;
  }
  if (isDayServiceReference(props.reference)) {
    // The day's service; if composing ever fails, the printed weekday service is shown instead.
    const compass = props.showCompass && props.settings ? <CompactPrayerCompass settings={props.settings} onOpen={props.onOpenCompass} /> : null;
    const prayer = props.reference.split(', ').pop();
    const fallbackRef = { shacharit: 'Siddur Edot HaMizrach, Weekday Shacharit, Petichat Eliyahu', mincha: 'Siddur Edot HaMizrach, Weekday Mincha, Offerings', maariv: 'Siddur Edot HaMizrach, Weekday Arvit, Barchu', 'birkat-hamazon': 'Siddur Edot HaMizrach, Post Meal Blessing' }[prayer];
    const printed = <><p className="notice" role="status">התפילה המותאמת ליום אינה זמינה כרגע; מוצג נוסח המהדורה.</p><LegacySourceReader {...props} reference={fallbackRef} /></>;
    return <ReaderErrorBoundary fallback={printed}><DayServiceReader {...props} compass={compass} /></ReaderErrorBoundary>;
  }
  if (!isWeekdayMinchaReference(props.reference) || !engineEnabled(WEEKDAY_MINCHA_PACK.id)) return <LegacySourceReader {...props} />;
  const compass = props.showCompass && props.settings ? <CompactPrayerCompass settings={props.settings} onOpen={props.onOpenCompass} /> : null;
  const printed = <><p className="notice" role="status">הנוסח המותאם אינו זמין כרגע; מוצג נוסח המהדורה המלא.</p><LegacySourceReader {...props} /></>;
  return <ReaderErrorBoundary fallback={printed}><ComposedPrayerReader {...props} compass={compass} /></ReaderErrorBoundary>;
}
function LegacySourceReader({ reference, title, onClose, mode = 'nikud', navigation, settings, showCompass, onOpenCompass, jewishContext, onHalacha = null }) {
  const [expanded, setExpanded] = useState(false);
  const focused = useResource(() => getText(reference, mode), [reference, mode]);
  // A segment reference (סעיף) may be expanded to its full section (סימן) while keeping the segment highlighted.
  const segment = focused.data?.segmentNumber ? { number: focused.data.segmentNumber, sectionRef: focused.data.sectionRef } : null;
  const context = useResource(() => (expanded && segment ? getText(segment.sectionRef, mode) : Promise.resolve(null)), [expanded, segment?.sectionRef, mode]);
  const resource = expanded && segment ? context : focused;
  const [font, setFont] = useLocal('source-font', 25);
  const [focus, setFocus] = useLocal('reading-focus', false);
  const [progress, setProgress] = useLocal('reader-progress-v1', {});
  const [, setCacheRevision] = useState(0);
  const [personalVerses] = useState(loadPersonalVerses);
  const text = resource.data;
  const cacheType = isSiddurReference(reference) ? 'siddur' : 'source';
  const cacheKey = `${reference}|${mode}`;
  const cacheEligible = Boolean(text && !text.bundledOffline && canCacheContent(text));
  const pinned = cacheEligible && isContentPinned(cacheType, cacheKey);
  const memoryId = `source:${navigation?.flowKey || reference}`;
  const displayTitle = formatVisibleSourceTitle(title || text?.ref || reference, reference);
  // Halacha reads at one size (hebrewText.mjs readingParagraphs); the siddur's paragraph roles apply to other texts only.
  const paragraphs = readingParagraphs(text, displayTitle, reference);
  const siddurParagraphs = cacheType === 'siddur' && text
    ? text.hebrew.map((value, index) => ({ text: value, source: text.indexes?.[index] ?? index }))
    : [];
  const siddurBlocks = cacheType === 'siddur'
    ? insertPersonalVerses(normalizeSiddurBlocks(siddurParagraphs, {
      title: displayTitle,
      markup: siddurParagraphs.map(part => text?.siddurMarkup?.[part.source] || part.text),
      context: jewishContext,
    }), personalVerses, {
      // Any Amidah: after אלהי נצור, before the closing יהיו לרצון (structural anchor, prayer text untouched).
      textOf: block => block.text,
      makeBlock: (verse, index) => ({ text: verse.text, caption: verse.reference, source: `personal-verse-${index}`, type: 'personal-verse', legacyType: 'personal-verse', role: 'personal-verse', className: 'personal-verse' }),
    }).blocks
    : null;
  const highlightIndex = expanded && segment ? segment.number - 1 : null;
  // A Tanakh reading opened from the weekly portion, a holiday or a haftarah: a tap on a verse shows the commentators
  // with a comment on it, one tap from their text in the library (the same data as the library's reader).
  const tanakhBook = text?.bundledOffline && text.category === 'Tanakh' && text.indexes ? parseTanakhRef(reference)?.workId : null;
  const verseCommentaries = Boolean(tanakhBook && hasVerseCommentaries(tanakhBook));
  const [pickedVerse, setPickedVerse] = useState(null);
  // Its מפרשים tab, as in the library's chapter view: the whole reading, or one verse from the line under it.
  const [readerTab, setReaderTab] = useState('source');
  const [commentaryFocus, setCommentaryFocus] = useState(null);
  const [commentator, chooseCommentator] = useCommentatorChoice('tanakh');
  const passage = verseCommentaries ? parseTanakhRef(reference) : null;
  useEffect(() => { setPickedVerse(null); setReaderTab('source'); setCommentaryFocus(null); }, [reference]);
  const openVerseCommentary = (verse, name) => {
    chooseCommentator(name); setCommentaryFocus(verse); setReaderTab('commentary');
    requestAnimationFrame(() => document.querySelector('.source-reader-tabs')?.scrollIntoView({ block: 'start' }));
  };
  const showReading = () => {
    const back = commentaryFocus; setReaderTab('source');
    if (back) requestAnimationFrame(() => document.getElementById(`segment-${back.c * 1000 + back.v}`)?.scrollIntoView({ block: 'center' }));
  };

  // Study timer for Torah content (not Siddur)
  const isTorahContent = cacheType !== 'siddur' && text;
  const workId = isTorahContent ? text.ref || reference : null;
  const workTitle = isTorahContent ? displayTitle : null;
  // Try to extract unit info from reference
  const unitMatch = reference.match(/(?:chapter|daf|perek|mishnah)\/(\d+)/i);
  const unitId = unitMatch ? unitMatch[1] : null;
  const unitLabel = unitId ? `${reference.includes('daf') ? 'דף' : reference.includes('mishnah') ? 'משנה' : 'פרק'} ${hebrewNumeral(Number(unitId) || 1)}` : null;

  const { recordInteraction } = useStudyTimer({
    workId,
    workTitle,
    unitId,
    unitLabel,
    category: 'torah_study',
    source: 'source-reader',
    tzid: settings?.location?.tzid || 'Asia/Jerusalem',
    enabled: isTorahContent,
  });

  // Record interaction on scroll
  useEffect(() => {
    if (!isTorahContent) return;
    const handleScroll = () => recordInteraction();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isTorahContent, recordInteraction]);

  useEffect(() => { setExpanded(false); }, [reference]);
  useEffect(() => {
    if (highlightIndex !== null && text) document.getElementById('segment-' + highlightIndex)?.scrollIntoView({ block: 'center' });
  }, [highlightIndex, text]);
  useEffect(() => {
    if (navigation?.flowKey) setProgress(value => ({ ...value, [navigation.flowKey]: reference }));
  }, [navigation?.flowKey, reference]);
  useEffect(() => { rememberLearning(memoryId, { source: 'source', reference, title: displayTitle, flowKey: navigation?.flowKey }); }, [memoryId, reference, displayTitle, navigation?.flowKey]);
  // Opening a section moves keyboard / VoiceOver focus to its title, so the reading order starts at the prayer.
  const titleRef = useRef(null);
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }); }, [reference]);
  // The Halacha of this prayer section, by concept (Amidah, Shema, Hallel…) in whichever rite the text is.
  const siddurRite = cacheType === 'siddur' ? nusachForReference(reference) : null;
  const halachaConcept = cacheType === 'siddur' ? halachaConceptForTitle(`${navigation?.itemEn || ''} ${navigation?.flowKey || ''} ${reference.split(', ').slice(-2).join(' ')}`) : null;
  const halachaLink = onHalacha && halachaConcept && SIDDUR_HALACHA[halachaConcept] ? SIDDUR_HALACHA[halachaConcept] : null;
  const riteSource = siddurRite ? SIDDUR_SOURCES[siddurRite] : null;
  return <section className={'source-reader ' + (focus ? 'focused' : '')} aria-label={displayTitle}>
    {/* Previous / next of a reading flow (a festival's readings, a book's chapters…), docked in the header; a Siddur
        flow's "הקודם | תוכן | הבא" below outranks it there (services/dockedNav.mjs). */}
    {navigation?.onSelect && (navigation.previous || navigation.next) && <ReaderDock previous={navigation.previous} next={navigation.next} onSelect={navigation.onSelect} />}
    {navigation?.breadcrumbs && <Breadcrumbs items={navigation.breadcrumbs} onNavigate={item => { if (item.onNavigate) item.onNavigate(); else navigation.onBack?.(); }}/>}
    {navigation?.backLabel && <BackNavigation label={navigation.backLabel} onClick={navigation.onBack}/>} 
    {showCompass && settings && <CompactPrayerCompass settings={settings} onOpen={onOpenCompass} />}
    <div className="reader-tools">
      {onClose && !navigation?.backLabel && <button onClick={onClose}>חזרה לתוכן העניינים</button>}
      <button onClick={() => setFocus(v => !v)}>{focus ? 'יציאה מקריאה שקטה' : 'קריאה שקטה'}</button>
      <label>גודל אות <input type="range" min="20" max="38" value={font} onChange={e => setFont(+e.target.value)} /></label>
      <AutoScrollControl />
      {cacheEligible && <button aria-pressed={pinned} onClick={() => { const changed = pinned ? unpinContent(cacheType, cacheKey) : pinContent(cacheType, cacheKey, text); if (changed) setCacheRevision(value => value + 1); }}>{pinned ? 'הסר מהשמירה' : 'שמור לשימוש ללא אינטרנט'}</button>}
    </div>
    {navigation?.returnRoute === 'siddur' && navigation.flow?.length > 1 && navigation.onSelect && <PrayerSectionNav title={navigation.flowTitle || displayTitle} items={navigation.flow.map(item => ({ ...item, key: item.reference }))} currentIndex={navigation.index} onSelect={navigation.onSelect} />}
    {/* The title with its heart: saving here is a favourite and a bookmark at once. */}
    <div className="reader-title-row"><h2 ref={titleRef} tabIndex={-1} className={cacheType === 'siddur' ? 'siddur-heading' : undefined}>{isTanakhReference(reference) ? <TanakhRefText text={displayTitle} /> : displayTitle}</h2><HeartToggle item={sourceFavorite(reference, displayTitle, mode)} /></div>
    {halachaLink && <button type="button" className="siddur-halacha-hint" onClick={() => onHalacha(halachaConcept, prayerTypeOf(navigation?.flowKey))}>{halachaLink.short}<span aria-hidden="true">{'\u00A0'}←</span></button>}
    {text?.bundledOffline && <p className="notice" role="status">זמין ללא אינטרנט</p>}
    {text?.offlineCached && <p className="notice" role="status">זמין מהשמירה האחרונה</p>}
    {segment && <p className="segment-scope">{expanded ? <>מוצג הסימן המלא; הסעיף הרלוונטי מודגש. <button onClick={() => setExpanded(false)}>חזרה לסעיף בלבד</button></> : <>מוצג סעיף אחד מתוך הסימן. <button onClick={() => setExpanded(true)}>הרחבה להקשר המלא</button></>}</p>}
    <ResourceState resource={resource}/>
    {text && cacheType === 'siddur' && <SiddurBlockRenderer blocks={siddurBlocks} font={font} policy={text.policy} highlightIndex={highlightIndex} />}
    {verseCommentaries && passage && <div className="seg library-layer-tabs source-reader-tabs" role="tablist" aria-label="מקרא, מפרשים">
      <button type="button" role="tab" aria-selected={readerTab === 'source'} className={readerTab === 'source' ? 'on' : ''} onClick={showReading}>מקרא</button>
      <button type="button" role="tab" aria-selected={readerTab === 'commentary'} className={readerTab === 'commentary' ? 'on' : ''} onClick={() => setReaderTab('commentary')}>מפרשים</button>
    </div>}
    {verseCommentaries && passage && readerTab === 'commentary' && <PassageCommentaries baseWorkId={tanakhBook} passage={{ from: [passage.startChapter, passage.startVerse], to: [passage.endChapter, passage.endVerse] }} focusVerse={commentaryFocus} onClearFocus={() => setCommentaryFocus(null)} clearLabel="כל הקריאה" choice={commentator} onChoose={chooseCommentator} />}
    {verseCommentaries && readerTab === 'source' && pickedVerse === null && <p className="library-layer-note">הקשה על פסוק מציגה את המפרשים עליו</p>}
    {text && cacheType !== 'siddur' && readerTab === 'source' && <article className="reading-text" aria-label={displayTitle} data-policy={text.policy} data-lookup={lookupFamilyForCategory(text.category) || undefined} lang="he" style={{fontSize:font}}>{paragraphs.map((part,i) => {
      const verse = verseCommentaries ? { c: Math.floor(part.source / 1000), v: part.source % 1000 } : null;
      const layers = verse ? commentatorsOnVerse(tanakhBook, verse.c, verse.v) : [];
      const picked = verse && pickedVerse === part.source;
      const lastOfVerse = !paragraphs[i + 1] || paragraphs[i + 1].source !== part.source;
      return <Fragment key={i}>
        <p id={'segment-'+part.source} className={'reading-segment reading-'+part.type + (part.source === highlightIndex || picked ? ' highlighted' : '') + (layers.length ? ' library-verse-tap' : '')} aria-current={part.source === highlightIndex ? 'true' : undefined} onClick={layers.length ? () => setPickedVerse(picked ? null : part.source) : undefined} {...(layers.length ? verseTapA11y(picked, () => setPickedVerse(picked ? null : part.source)) : {})}>{fixHebrewTypography(part.text)}</p>
        {picked && lastOfVerse && layers.length > 0 && <VerseLayersLine layers={layers} label="מפרשים" unitLabel="פסוק" verse={verse.v} onOpen={name => openVerseCommentary(verse, name)} />}
      </Fragment>;
    })}</article>}
    {text && cacheType !== 'siddur' && <footer className="source-credit"><p>{text.attribution || `${text.version || 'מהדורה עברית'}${text.license ? ` · ${text.license}` : ''}`}</p>{text.rightsNotice && <p>{text.rightsNotice} · שימוש לא־מסחרי בלבד · אין בכך משום תמיכה או אישור.</p>}<p>הטקסט מוצג ללא עיצוב HTML.</p></footer>}

    {text && cacheType === 'siddur' && <footer className="source-credit"><p>הנוסח מורכב מקטעי המהדורה עצמם; הבחירה בין החלופות נעשית לפי תאריך התפילה והמקום.</p>{riteSource && <p>{riteSource.attribution}</p>}</footer>}
    {text && navigation?.returnRoute === 'siddur' && navigation.flowKey && <PrayerCompletion flowKey={navigation.flowKey} tzid={settings?.location?.tzid} itemEn={navigation.itemEn || ''} title={displayTitle} flowTitle={navigation.flowTitle || ''} perItem={Boolean(siddurRite && siddurLayout(siddurRite).collections.includes(navigation.flowKey))} />}
    {isTorahContent && navigation?.returnRoute !== 'siddur' && <StudyCompletion workId={workId} workTitle={workTitle} unitId={unitId} unitLabel={unitLabel} source="source-reader" tzid={settings?.location?.tzid || 'Asia/Jerusalem'} onBeforeRecord={recordInteraction} />}
    {text && navigation && (navigation.previous || navigation.next || navigation.endLabel) && <ReaderNavigation {...navigation} onSelect={navigation.onSelect}/>}
  </section>;
}
