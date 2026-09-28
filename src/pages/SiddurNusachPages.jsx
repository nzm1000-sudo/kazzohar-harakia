import { useEffect, useState } from 'react';
import { NUSACHIM, nusachOf } from '../data/nusach/registry.mjs';
import { SIDDUR_SOURCES } from '../data/nusach/manifest.mjs';
import { siddurLayout, prayerRootFor } from '../data/nusach/siddurLayouts.mjs';
import { loadSiddur } from '../services/nusach.mjs';
import { siddurRoots, buildSiddurFlows } from '../services/siddurIndex.mjs';
import { BackNavigation } from '../components/LocalNavigation.jsx';

// "פרטי מקור": where each rite's text comes from, its version, editors, licence and attribution — away from the
// prayer screen, which stays clean. Every line is read from the manifest, never typed here.
export function SiddurSourcesPage({ settings, onBack }) {
  const current = nusachOf(settings);
  return <section className="siddur-sources">
    <BackNavigation label="חזרה לסידור" onClick={onBack} />
    <p className="eyebrow">סידור · פרטי מקור</p>
    <h1>מקורות ורישיונות.</h1>
    <p className="intro">כל נוסח מוצג מתוך מהדורה מקורית, פסקה אחר פסקה, ללא הקלדה מחדש. האפליקציה בוחרת רק בין החלופות שהמהדורה עצמה מדפיסה, לפי תאריך התפילה והמקום.</p>
    {NUSACHIM.map(item => { const source = SIDDUR_SOURCES[item.id]; return <article key={item.id} className={`siddur-source-card${item.id === current ? ' is-current' : ''}`}>
      <h2>{item.title}{item.id === current ? <small> · הנוסח שנבחר</small> : null}</h2>
      <dl>
        <dt>היצירה</dt><dd>{source.work}</dd>
        <dt>מהדורה</dt><dd>{source.version}</dd>
        <dt>עורכים</dt><dd>{source.editor}</dd>
        <dt>ספק</dt><dd>{source.provider}</dd>
        <dt>רישיון</dt><dd>{source.license}</dd>
        <dt>ייחוס</dt><dd>{source.attribution}</dd>
        {source.underlyingWork && <><dt>היצירה המקורית</dt><dd>{source.underlyingWork}</dd></>}
        <dt>שינויים</dt><dd>{source.modified ? 'כן' : 'ללא שינוי בטקסט'}</dd>
        <dt>נגישות ללא אינטרנט</dt><dd>מצורף לאפליקציה</dd>
        <dt>תאריך גישה</dt><dd>{source.accessedAt}</dd>
      </dl>
      <p className="siddur-source-links"><a href={source.sourceUrl} target="_blank" rel="noreferrer">המקור בספריא ↗</a>{source.provenanceUrl && <a href={source.provenanceUrl} target="_blank" rel="noreferrer">המקור בוויקיטקסט ↗</a>}<a href={source.licenseUrl} target="_blank" rel="noreferrer">תנאי הרישיון ↗</a></p>
      {(source.extraEditions || []).map(extra => <dl key={extra.index} className="siddur-source-extra">
        <dt>מהדורה נוספת</dt><dd>{extra.work}</dd>
        <dt>גרסה</dt><dd>{extra.version}</dd>
        <dt>ספק</dt><dd>{extra.provider}</dd>
        <dt>רישיון</dt><dd>{extra.license}</dd>
        <dt>ייחוס</dt><dd>{extra.attribution}</dd>
        {extra.editor && <><dt>עורך</dt><dd>{extra.editor}</dd></>}
        {extra.underlyingWork && <><dt>היצירה המקורית</dt><dd>{extra.underlyingWork}</dd></>}
        {extra.sections && <><dt>משמש רק ל־</dt><dd>{extra.sections.join(' · ')}</dd></>}
        {extra.pages && <><dt>עמודים</dt><dd>{extra.pages}</dd></>}
        <dt>שינויים</dt><dd>{extra.changesHe || 'סימון בלבד (כותרות, הוראות, טבלאות); שום מילה של תפילה לא שונתה'}</dd>
        <dt>תאריך גישה</dt><dd>{extra.accessedAt}</dd>
        {extra.licenseUrl && <><dt>קישורים</dt><dd className="siddur-source-links"><a href={extra.sourceUrl} target="_blank" rel="noreferrer">המקור ↗</a><a href={extra.licenseUrl} target="_blank" rel="noreferrer">תנאי הרישיון ↗</a></dd></>}
      </dl>)}
      {source.note && <p className="notice">{source.note}</p>}
    </article>; })}
  </section>;
}

// The prayers the study tool compares: the same concept in each rite, opened from its own edition.
const COMPARE = [
  { key: 'amida', title: 'עמידה של חול (שחרית)', prayer: 'shacharit', concept: 'amida' },
  { key: 'shema', title: 'קריאת שמע וברכותיה (שחרית)', prayer: 'shacharit', concept: 'shema' },
  { key: 'mincha-amida', title: 'עמידה של מנחה', prayer: 'mincha', concept: 'amida' },
  { key: 'maariv', title: 'ערבית של חול', prayer: 'maariv', concept: null },
  { key: 'birkat', title: 'ברכת המזון', prayer: null, concept: 'birkat-hamazon' },
  { key: 'hallel', title: 'הלל', prayer: null, concept: 'hallel' },
];

// "הבדלים בין נוסחים": a study tool, apart from prayer. For a chosen prayer it shows, rite by rite, the section of that
// rite's own edition (its title and length) and opens it; it states only what the editions contain — no claim about a
// rite is written here. Wording and order differ between rites; the reader shows each one as printed.
export function NusachComparePage({ settings, openSource, onBack, context }) {
  const [packs, setPacks] = useState({});
  const [chosen, setChosen] = useState(COMPARE[0].key);
  useEffect(() => { let live = true; Promise.all(NUSACHIM.map(item => loadSiddur(item.id).then(pack => [item.id, pack]).catch(() => [item.id, null]))).then(entries => { if (live) setPacks(Object.fromEntries(entries)); }); return () => { live = false; }; }, []);
  const target = COMPARE.find(item => item.key === chosen);
  const rows = NUSACHIM.map(item => {
    const pack = packs[item.id];
    if (!pack) return { item, status: 'loading' };
    const layout = siddurLayout(item.id);
    const roots = siddurRoots(pack.schema.nodes, item.index, layout, () => true, { has: ref => Boolean(pack.texts[ref]) });
    const flows = buildSiddurFlows(roots, openSource);
    const rootKeyFor = target.prayer ? prayerRootFor(item.id, target.prayer) : null;
    const pool = rootKeyFor ? roots.filter(root => root.key === rootKeyFor) : roots;
    const hit = pool.flatMap(root => root.items).find(row => (target.concept ? row.concept === target.concept : true)) || (rootKeyFor && !target.concept ? pool[0]?.items[0] : null);
    if (!hit) return { item, status: 'missing' };
    const paragraphs = hit.reference.split('; ').reduce((sum, ref) => sum + (pack.texts[ref]?.he?.length || 0), 0);
    return { item, status: 'ok', hit, paragraphs, navigation: flows.navigation.get(hit.reference) };
  });
  return <section className="nusach-compare">
    <BackNavigation label="חזרה לסידור" onClick={onBack} />
    <p className="eyebrow">סידור · כלי לימוד</p>
    <h1>הבדלים בין נוסחים.</h1>
    <p className="intro">אותה תפילה, כפי שהיא מודפסת בכל נוסח. הנוסחים נבדלים במילים ובסדר; כאן פותחים כל אחד מהם מתוך המהדורה שלו, זה לצד זה. הנוסח שנבחר לתפילה אינו משתנה.</p>
    <div className="nusach-compare-picker" role="tablist" aria-label="איזו תפילה להשוות">{COMPARE.map(item => <button type="button" role="tab" aria-selected={item.key === chosen} key={item.key} className={item.key === chosen ? 'is-selected' : undefined} onClick={() => setChosen(item.key)}>{item.title}</button>)}</div>
    <div className="book-index">{rows.map(row => <button type="button" key={row.item.id} className="index-row" disabled={row.status !== 'ok'} aria-current={row.item.id === nusachOf(settings) ? 'true' : undefined} onClick={() => row.status === 'ok' && openSource(row.hit.reference, `${row.hit.title} · נוסח ${row.item.title}`, 'nikud', row.navigation)}>
      <span><strong>{row.item.title}</strong><small>{row.status === 'ok' ? `${row.hit.rootHe} · ${row.hit.title} · ${row.paragraphs} פסקאות במהדורה` : row.status === 'loading' ? 'טוען…' : 'אין קטע כזה במקור המורשה של נוסח זה'}</small></span><span aria-hidden="true">{row.status === 'ok' ? '←' : ''}</span>
    </button>)}</div>
    <p className="personal-hint">ההשוואה מוצגת ללא סימונים בתוך התפילה עצמה; היא כלי עיון, לא חלק מהתפילה. {context?.hebrewDate?.label ? `התוספות של ${context.hebrewDate.label} מסומנות בתוך כל נוסח.` : ''}</p>
  </section>;
}
