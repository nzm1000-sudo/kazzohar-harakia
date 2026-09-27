import { useMemo } from 'react';
import { useLocal } from '../hooks.jsx';
import { BackNavigation, Breadcrumbs } from './LocalNavigation.jsx';
import PrayerSectionNav from './PrayerSectionNav.jsx';
import PrayerCompletion from './PrayerCompletion.jsx';
import { fixHebrewTypography } from '../services/hebrewTypography.mjs';
import { JewishContextEngine } from '../services/jewishContextEngine.mjs';
import { planDayService, dayServiceInstant, DAY_SERVICE_COMPLETION } from '../services/prayer/dayServicePlan.mjs';
import { composeDayService, DAY_SERVICE_PREFIX } from '../services/prayer/dayServiceComposer.mjs';
import { insertPersonalVerses, loadPersonalVerses } from '../services/personalVerses.mjs';
import { FESTIVAL_LITURGY_LICENSE } from '../data/liturgy/festivalLiturgy.mjs';

const BLOCK_CLASS = {
  heading: 'reading-segment reading-section-heading siddur-block-heading',
  instruction: 'reading-segment reading-instruction siddur-block-instruction',
  note: 'reading-segment day-service-note',
  aliyah: 'reading-segment day-service-aliyah',
  torah: 'reading-segment reading-prayer siddur-block-recited day-service-torah',
  recitedText: 'reading-segment reading-prayer siddur-block-recited',
  personalVerse: 'reading-segment reading-prayer siddur-block-recited prayer-personal-verse',
};

// The Smart Siddur's service for the day: the plan decides what is said and in which order; the
// composer builds it from the bundled editions. Rendering only — no halachic decision lives here.
export function DayServiceDocument({ document, font = 25 }) {
  return <article className="reading-text siddur-semantic composed-prayer-text day-service-text" data-policy="siddur" lang="he" style={{ fontSize: font }}>
    {document.sections.map(section => <section key={section.id} id={`prayer-section-${section.id}`} aria-label={section.title} data-section-kind={section.kind}>
      <h3 className="day-service-section-title">{section.title}</h3>
      {section.blocks.map(block => <p key={block.id} id={block.id} data-block-id={block.id} data-siddur-type={block.type} className={BLOCK_CLASS[block.type] || BLOCK_CLASS.recitedText}>
        {block.caption && <span className={block.type === 'torah' ? 'day-service-verse-ref' : 'personal-verse-caption'}>{block.caption}</span>}
        {fixHebrewTypography(block.text)}
      </p>)}
    </section>)}
  </article>;
}

export default function DayServiceReader({ reference, navigation, settings = {}, now, times, compass = null, onClose }) {
  const [font, setFont] = useLocal('source-font', 25);
  const [focus, setFocus] = useLocal('reading-focus', false);
  const prayer = String(reference || '').slice(DAY_SERVICE_PREFIX.length);
  // Arvit belongs to the coming night: opened before sunset (as on Shabbat and Yom Tov eve), it is that night's service.
  const instant = useMemo(() => dayServiceInstant(prayer, now ? new Date(now) : new Date(), times), [prayer]);
  const composed = useMemo(() => {
    const prayerType = prayer === 'birkat-hamazon' ? 'shacharit' : prayer;
    const contextFor = type => JewishContextEngine({ now: instant, settings, times, prayerType: type });
    const context = contextFor(prayerType);
    const plan = planDayService({ prayer, context });
    const document = composeDayService(plan, context, { contextFor });
    // The personal verses (up to three) go after אלהי נצור in every Amidah, as in the printed reader.
    const verses = loadPersonalVerses();
    for (const section of document.sections) {
      if (!/amid|mussaf/i.test(section.id)) continue;
      section.blocks = insertPersonalVerses(section.blocks, verses, {
        textOf: block => block.text,
        makeBlock: (verse, index) => ({ id: `${section.id}.personal-${index}`, type: 'personalVerse', text: verse.text, caption: verse.reference }),
      }).blocks;
    }
    return { plan, document };
  }, [prayer, instant]);
  const { plan, document } = composed;
  const jumpTo = id => globalThis.document?.getElementById(`prayer-section-${id}`)?.scrollIntoView({ block: 'start' });
  const currentIndex = () => {
    let index = 0;
    document.sections.forEach((section, i) => { const node = globalThis.document?.getElementById(`prayer-section-${section.id}`); if (node && node.getBoundingClientRect().top <= 120) index = i; });
    return index;
  };
  const usesFestivalLiturgy = document.sections.some(section => /^Festival Liturgy/.test(plan.steps.find(step => step.id === section.id)?.ref || ''));
  return <section className={'source-reader composed-prayer day-service ' + (focus ? 'focused' : '')} aria-label={document.title}>
    {navigation?.breadcrumbs && <Breadcrumbs items={navigation.breadcrumbs} onNavigate={item => { if (item.onNavigate) item.onNavigate(); else navigation.onBack?.(); }}/>}
    {navigation?.backLabel && <BackNavigation label={navigation.backLabel} onClick={navigation.onBack}/>}
    {compass}
    <div className="reader-tools">
      {onClose && !navigation?.backLabel && <button onClick={onClose}>חזרה לתוכן העניינים</button>}
      <button onClick={() => setFocus(value => !value)}>{focus ? 'יציאה מקריאה שקטה' : 'קריאה שקטה'}</button>
      <label>גודל אות <input type="range" min="20" max="38" value={font} onChange={event => setFont(+event.target.value)} /></label>
    </div>
    <PrayerSectionNav title={document.title} items={document.sections.map(section => ({ key: section.id, title: section.title, id: section.id }))} currentIndex={currentIndex} onSelect={item => jumpTo(item.id)} />
    <h2 className="siddur-heading">{document.title}</h2>
    <p className="composed-status">{[plan.dayLabel, 'נוסח עדות המזרח'].filter(Boolean).join(' · ')}</p>
    {plan.highlights?.length > 0 && <ul className="day-service-highlights" aria-label="מה מיוחד היום">{plan.highlights.map(item => <li key={item}>{item}</li>)}</ul>}
    {plan.status === 'partial' && <p className="composed-notice" role="note">{plan.partialNote || 'חלק מהתפילה עדיין מוצג כנוסח המהדורה המלא.'}</p>}
    <DayServiceDocument document={document} font={font} />
    <PrayerCompletion flowKey={DAY_SERVICE_COMPLETION[prayer]} tzid={settings?.location?.tzid || 'Asia/Jerusalem'} />
    <footer className="source-credit">
      <p>התפילה מורכבת לפי תאריך היום והמקום, מקטעי המהדורה עצמם (סידור עדות המזרח, מהדורת מרדכי שליח ציבור, ספריא, CC0); קריאת התורה מתוך כתב יד לנינגרד (UXLC).</p>
      {usesFestivalLiturgy && <p>הושענות, הקפות ותפילות גשם וטל: <a href={FESTIVAL_LITURGY_LICENSE.source} target="_blank" rel="noreferrer">{FESTIVAL_LITURGY_LICENSE.attribution}</a> · <a href={FESTIVAL_LITURGY_LICENSE.url} target="_blank" rel="noreferrer">{FESTIVAL_LITURGY_LICENSE.name}</a></p>}
    </footer>
  </section>;
}
