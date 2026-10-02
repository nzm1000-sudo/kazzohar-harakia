import { useMemo, useState } from 'react';
import { useLocal, useResource } from '../hooks.jsx';
import { BackNavigation, Breadcrumbs } from './LocalNavigation.jsx';
import PrayerSectionNav from './PrayerSectionNav.jsx';
import PrayerCompletion from './PrayerCompletion.jsx';
import PrayerText from './PrayerText.jsx';
import { todayInsertionAttrs, todayInsertionClass } from '../services/prayer/todayInsertion.mjs';
import { SIDDUR_HALACHA } from '../data/halachaSiddurLinks.mjs';
import { SIDDUR_SOURCES } from '../data/nusach/manifest.mjs';
import { nusachTitle } from '../data/nusach/registry.mjs';
import { compositionOf } from '../data/nusach/compositions/index.mjs';
import { SERVICE_INDEX } from '../data/nusach/prayerSchema.mjs';
import { loadSiddur } from '../services/nusach.mjs';
import { JewishContextEngine } from '../services/jewishContextEngine.mjs';
import { dayServiceInstant } from '../services/prayer/dayServicePlan.mjs';
import { composeRiteService, parseRiteServiceReference, prayerNavItems } from '../services/prayer/riteServiceComposer.mjs';
import { insertPersonalVerses, loadPersonalVerses } from '../services/personalVerses.mjs';
import { PrayerRoleDescriptions, describedByFor, usePrayerRoleIds } from './PrayerRoleDescriptions.jsx';
import TextSizeControl, { useReadingFont } from './ui/TextSizeControl.jsx';
import AutoScrollControl from './AutoScrollControl.jsx';
import TitleOrnament from './ui/TitleOrnament.jsx';
import ArrowMark from './ui/ArrowMark.jsx';

// Recording in "המצוות שלי": the same service keys in every rite.
export const RITE_SERVICE_COMPLETION = Object.freeze({
  'weekday-shacharit': 'Weekday Shacharit', 'weekday-mincha': 'Weekday Mincha', 'weekday-maariv': 'Weekday Arvit',
  'bedtime-shema': 'Bedtime Shema', havdalah: 'Havdalah', hallel: 'Hallel', 'birkat-hamazon': 'Post Meal Blessing', 'rosh-chodesh-musaf': 'Rosh Hodesh', omer: 'Counting of the Omer',
});
// The Halacha-in-Siddur hints by concept.
const HALACHA_BY_CONCEPT = { amidah: 'amida', musaf: 'mussaf', shema: 'shema', hallel: 'hallel', 'birkat-hamazon': 'birkat-hamazon', tallit: 'talit', omer: 'omer' };

// One presented block, as in the printed reader (the shared block vocabulary of services/siddurBlocks.mjs).
function Block({ block, roleIds }) {
  return <p id={block.id} data-block-id={block.id} aria-describedby={roleIds ? describedByFor(roleIds, block) : undefined} lang={block.lang === 'en' ? 'en' : undefined} dir={block.lang === 'en' ? 'ltr' : undefined} data-siddur-type={block.type} data-display={block.display} data-lookup={block.lang === 'en' ? undefined : 'liturgy'} className={`reading-segment reading-${block.legacyType || block.type} ${block.className || ''} ${todayInsertionClass(block)}`.trim()} {...todayInsertionAttrs(block)}>
    {block.caption && <span className="personal-verse-caption">{block.caption}</span>}
    <PrayerText block={block} />
  </p>;
}

// A composed service: named sections, each with its restrained role label ("בחזרת שליח הציבור") and — in the full
// edition — its condition ("בימים שאומרים תחנון"). The repetition's parts are folded in prayer mode; halachic notes of
// the edition stay out of the prayer unless asked for. Rendering only: every decision was made by the composer.
// A section taken from a rite's second edition under its own licence (Ashkenaz: Birnbaum, CC BY-SA) carries that
// edition's credit line on the section itself — the licence names exactly those sections, never the whole prayer.
const SECTION_CREDITS = Object.values(SIDDUR_SOURCES).flatMap(source => source.extraEditions || []).filter(edition => edition.sectionCredit);
const sectionCredit = ref => SECTION_CREDITS.find(edition => String(ref || '').startsWith(`${edition.index}, `))?.sectionCredit || null;

// The heading of a named part of a prayer (ברכות השחר): centred, with the one ornament under titles. Its id is the
// part's place in the prayer's contents (prayerNavItems).
export function PrayerPartHeading({ id, title }) {
  return <header className="prayer-part-head" id={`prayer-section-part-${id}`} data-part={id}>
    <h3 className="prayer-part-title">{title}</h3>
    <TitleOrnament />
  </header>;
}
export function RiteServiceDocument({ document, font = 25, showNotes = false, onHalacha = null }) {
  const hinted = new Set();
  const roleIds = usePrayerRoleIds();
  return <article className="reading-text siddur-semantic composed-prayer-text rite-service-text" data-policy="siddur" lang="he" style={{ fontSize: font }}>
    {document.sections.map(section => {
      const blocks = showNotes ? section.blocks : section.blocks.filter(block => block.display !== 'commentary');
      if (!blocks.length) return null;
      const hintKey = HALACHA_BY_CONCEPT[section.concept];
      const hint = onHalacha && hintKey && SIDDUR_HALACHA[hintKey] && !hinted.has(hintKey) ? SIDDUR_HALACHA[hintKey] : null;
      if (hint) hinted.add(hintKey);
      const labels = [section.roleLabel, section.whenLabel].filter(Boolean);
      const credit = sectionCredit(section.ref);
      const meta = labels.length || credit ? <p className="rite-section-meta">{labels.map(label => <span key={label}>{label}</span>)}{credit && <span className="rite-section-credit" data-license="CC-BY-SA">{credit}</span>}</p> : null;
      const body = blocks.map(block => <Block key={block.id} block={block} roleIds={roleIds} />);
      // A named part of the service (ברכות השחר) opens with its own centred heading and ornament.
      const partHead = section.partStart ? <PrayerPartHeading key={`part:${section.part}`} id={section.part} title={section.partTitle} /> : null;
      if (section.collapsed) {
        return [partHead, <details key={section.id} id={`prayer-section-${section.id}`} className="rite-section rite-section-folded" data-role={section.role}>
          <summary><span className="rite-section-folded-title">{section.title}</span>{meta}<ArrowMark dir="down" size="inline" className="rite-fold-arrow" clayOnly /></summary>
          {body}
        </details>];
      }
      return [partHead, <section key={section.id} id={`prayer-section-${section.id}`} className={`rite-section${section.title ? '' : ' rite-section-continues'}`} data-role={section.role || undefined} data-when={section.when || undefined} aria-label={section.title || undefined}>
        {section.title && <h3 className="day-service-section-title siddur-display-heading">{section.title}</h3>}
        {meta}
        {hint && <button type="button" className="siddur-halacha-hint" onClick={() => onHalacha(hintKey)}>{hint.short}<ArrowMark size="inline" legacy={'\u00A0←'} /></button>}
        {body}
      </section>];
    })}
    <PrayerRoleDescriptions ids={roleIds} />
  </article>;
}

export default function RiteServiceReader({ reference, navigation, settings = {}, now, times, compass = null, onClose, onHalacha = null }) {
  const parsed = parseRiteServiceReference(reference);
  const { nusach, serviceId } = parsed || {};
  const schema = SERVICE_INDEX[serviceId];
  const font = useReadingFont(25);
  const [focus, setFocus] = useLocal('reading-focus', false);
  const [mode, setMode] = useLocal('siddur-reading-mode', 'prayer');
  const [showNotes, setShowNotes] = useLocal('siddur-show-notes', false);
  const [personalVerses] = useState(loadPersonalVerses);
  const pack = useResource(() => loadSiddur(nusach), [nusach]);
  // A service said at more than one prayer (the festival Amidah) takes the prayer of the hour: Arvit from sunset,
  // Mincha from midday, otherwise Shacharit.
  const byHour = () => {
    const at = now ? new Date(now) : new Date();
    const sunset = times?.sunset ? new Date(times.sunset) : null;
    const midday = times?.chatzot ? new Date(times.chatzot) : null;
    if (sunset && at >= sunset) return 'maariv';
    if (midday && at >= midday) return 'mincha';
    return at.getHours() < 4 ? 'maariv' : at.getHours() >= 13 ? 'mincha' : 'shacharit';
  };
  const prayerType = schema?.prayerType === 'mussaf' ? 'shacharit' : schema?.prayerType || (serviceId === 'festival-amidah' ? byHour() : 'shacharit');
  const servicePrayer = schema?.prayerType === 'mussaf' ? 'mussaf' : prayerType;
  // Arvit belongs to the coming night: opened before sunset it is that night's service.
  const instant = useMemo(() => dayServiceInstant(schema?.prayerType === 'maariv' ? 'maariv' : prayerType, now ? new Date(now) : new Date(), times), [serviceId]);
  const context = useMemo(() => ({ ...JewishContextEngine({ now: instant, settings, times, prayerType }), servicePrayer }), [instant, prayerType, servicePrayer]);
  const document = useMemo(() => {
    if (!pack.data) return null;
    const composed = composeRiteService({ composition: compositionOf(nusach), serviceId, texts: pack.data.texts, context, mode, nusachTitle: nusachTitle(nusach) });
    // The personal verses (up to three) after אלהי נצור, as in every Amidah of the Siddur.
    for (const section of composed.sections) {
      if (section.concept !== 'elokai-netzor') continue;
      section.blocks = insertPersonalVerses(section.blocks, personalVerses, {
        textOf: block => block.text,
        makeBlock: (verse, index) => ({ id: `${section.id}.personal-${index}`, type: 'personalVerse', legacyType: 'prayer', display: 'prayer', className: 'siddur-block-recited prayer-personal-verse siddur-display-prayer', text: verse.text, caption: verse.reference }),
      }).blocks;
    }
    return composed;
  }, [pack.data, mode, context]);
  if (!parsed || !schema) return <p className="notice" role="alert">התפילה לא נמצאה.</p>;
  const titled = document ? prayerNavItems(document.sections) : [];
  const jumpTo = id => globalThis.document?.getElementById(`prayer-section-${id}`)?.scrollIntoView({ block: 'start' });
  const currentIndex = () => {
    let index = 0;
    titled.forEach((item, i) => { const node = globalThis.document?.getElementById(`prayer-section-${item.id}`); if (node && node.getBoundingClientRect().top <= 120) index = i; });
    return index;
  };
  const source = SIDDUR_SOURCES[nusach];
  // A rite may draw on more than one licensed edition (Chabad: Siddur Torah Or for weekdays, Tehillat Hashem for
  // Shabbat and festivals): every edition used on this page is credited.
  const editions = [...new Set((document?.sections || []).map(section => section.ref?.split(', ')[0]).filter(Boolean))];
  const allEditions = Object.values(SIDDUR_SOURCES).flatMap(item => [item, ...(item.extraEditions || [])]);
  const creditEditions = editions.map(index => allEditions.find(item => item.index === index)).filter(item => item?.attribution);
  const credits = creditEditions.map(item => item.attribution);
  // A share-alike licence is named with its terms (CC BY-SA asks for a link to the licence).
  const licenseLinks = Object.fromEntries(creditEditions.filter(item => item.sectionCredit && item.licenseUrl).map(item => [item.attribution, item.licenseUrl]));
  const dayLabel = context?.hebrewDate?.label;
  return <section className={'source-reader composed-prayer rite-service ' + (focus ? 'focused' : '')} aria-label={document?.title || schema.title}>
    {navigation?.breadcrumbs && <Breadcrumbs items={navigation.breadcrumbs} onNavigate={item => { if (item.onNavigate) item.onNavigate(); else navigation.onBack?.(); }}/>}
    {navigation?.backLabel && <BackNavigation label={navigation.backLabel} onClick={navigation.onBack}/>}
    {compass}
    {onClose && !navigation?.backLabel && <BackNavigation label="חזרה לתוכן העניינים" onClick={onClose}/>}
    <div className="reader-tools">
      <TextSizeControl />
      <button onClick={() => setFocus(value => !value)}>{focus ? 'יציאה מקריאה שקטה' : 'קריאה שקטה'}</button>
      <AutoScrollControl />
    </div>
    {(titled.length > 1 || !document) && <PrayerSectionNav pending={!document} title={document?.title || schema.title} items={document ? titled : null} currentIndex={currentIndex} onSelect={item => jumpTo(item.id)} />}
    <h2 className="siddur-heading">{document?.title || schema.title}</h2>
    <p className="composed-status">{[mode === 'prayer' && dayLabel, `נוסח ${nusachTitle(nusach)}`].filter(Boolean).join(' · ')}</p>
    <div className="rite-mode" role="radiogroup" aria-label="אופן ההצגה">
      <button type="button" role="radio" aria-checked={mode === 'prayer'} className={mode === 'prayer' ? 'is-selected' : undefined} onClick={() => setMode('prayer')}>תפילת היום</button>
      <button type="button" role="radio" aria-checked={mode === 'edition'} className={mode === 'edition' ? 'is-selected' : undefined} onClick={() => setMode('edition')}>המהדורה המלאה</button>
    </div>
    <p className="rite-mode-hint">{mode === 'prayer' ? 'התפילה כפי שאומרים אותה היום: רק מה שנאמר היום, במקומו.' : 'כל הנוסח כפי שהוא מודפס במהדורה, עם כל החלופות; ליד כל תוספת כתוב מתי אומרים אותה.'}</p>
    <label className="rite-notes-toggle"><input type="checkbox" checked={showNotes} onChange={event => setShowNotes(event.target.checked)} /> הצגת ההלכות וההערות של המהדורה</label>
    {pack.loading && <p className="loading" role="status">פותחים את הסידור…</p>}
    {pack.error && <p className="notice error" role="alert">{pack.error} <button onClick={pack.retry}>ניסיון נוסף</button></p>}
    {document && <RiteServiceDocument document={document} font={font} showNotes={showNotes || mode === 'edition'} onHalacha={onHalacha ? key => onHalacha(key, prayerType) : null} />}
    {document && RITE_SERVICE_COMPLETION[serviceId] && <PrayerCompletion flowKey={RITE_SERVICE_COMPLETION[serviceId]} tzid={settings?.location?.tzid || 'Asia/Jerusalem'} />}
    {document && <footer className="source-credit">
      <p>התפילה מורכבת מקטעי המהדורה עצמה, בסדר התפילה של נוסח {nusachTitle(nusach)}; שום מילה אינה מוקלדת מחדש. {mode === 'prayer' ? 'הבחירה בין החלופות נעשית לפי תאריך התפילה והמקום.' : ''}</p>
      {(credits.length ? credits : [source?.attribution]).filter(Boolean).map(text => <p key={text}>{text}{licenseLinks[text] && <> · <a href={licenseLinks[text]} target="_blank" rel="noreferrer">תנאי הרישיון ↗</a></>}</p>)}
    </footer>}
  </section>;
}
