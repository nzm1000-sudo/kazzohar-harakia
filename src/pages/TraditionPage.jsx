import { useDeferredValue, useMemo, useState } from 'react';
import { useSearchState } from '../hooks.jsx';
import Selector from '../components/ui/Selector.jsx';
import { BackLink } from '../components/LocalNavigation.jsx';
import HeartToggle from '../components/HeartToggle.jsx';
import { routeFavorite } from '../services/favorites.mjs';
import {
  CONTINUITY_LABELS, LICENSE_LABELS, LIFE_CYCLE, NORMATIVE_LABELS, PROFILE_ROLES, PUBLISHED_RECORDS, SOURCE_TYPE_LABELS, THEMES,
  TRADITION_TYPE_LABELS, VERIFICATION_LABELS, YEAR_CYCLE, addFamilyCustom, allowsVerbatim, childrenOf, communityById, communityLabel,
  compareTopics, inYearSection, loadFamilyCustoms, loadTraditionProfile, profileRoots, recordById, recordsForProfile, removeFamilyCustom,
  rootCommunities, saveTraditionProfile, searchTraditions, sourceById, todaysRecords, variantsOf,
} from '../services/tradition.mjs';
import { TRADITION_SOURCES } from '../data/tradition/sources.mjs';
import ArrowMark from '../components/ui/ArrowMark.jsx';

const BASE = '#personal-tools/tradition';
// A broad word ("שבת") can match hundreds of customs: the list shows the first ones and asks for a closer search.
const SEARCH_LIMIT = 60;
const go = path => { window.location.hash = path ? `${BASE}/${path}` : BASE; };
const safe = value => { try { return decodeURIComponent(value || ''); } catch { return ''; } };
// Links read as words, not percent codes: "he.wikipedia.org/wiki/יהדות_מרוקו".
const displayUrl = url => safe(url).replace(/^https?:\/\//, '');

// Routes: personal-tools/tradition | …/setup | …/r/<id> | …/s/<section> | …/c[/<community>] | …/compare[/<topic>] | …/family | …/sources
export default function TraditionPage({ route, todayKey }) {
  const [, , view, arg] = route.split('/');
  const [profile, setProfile] = useState(loadTraditionProfile);
  const save = next => setProfile(saveTraditionProfile(next));
  if (view === 'setup' || (!view && !profile.onboarded)) return <Onboarding profile={profile} onSave={next => { save({ ...next, onboarded: true }); go(''); }} onSkip={() => { save({ ...profile, onboarded: true }); go(''); }} />;
  if (view === 'r') return <RecordView record={recordById(safe(arg))} />;
  if (view === 's') return <SectionView sectionId={safe(arg)} profile={profile} />;
  if (view === 'compare') return <CompareView topic={safe(arg)} />;
  if (view === 'c') return <CommunityBrowser communityId={safe(arg)} />;
  if (view === 'family') return <FamilyView />;
  if (view === 'sources') return <SourcesView />;
  return <Home profile={profile} todayKey={todayKey} />;
}

const Back = ({ to = '', label = 'המסורת שלי' }) => <BackLink onClick={() => go(to)} label={label} />;
const Row = ({ title, meta, onClick, icon }) => <button type="button" className="personal-tool-row tradition-row" onClick={onClick}>{icon && <span className="personal-tool-icon" aria-hidden="true">{icon}</span>}<span><strong>{title}</strong>{meta && <small>{meta}</small>}</span><ArrowMark /></button>;
const RecordRow = ({ record, match }) => <button type="button" className="tradition-record-row" onClick={() => go(`r/${encodeURIComponent(record.id)}`)}><span><strong>{record.title}</strong><small>{[communityById(match?.communityId || record.communityIds[0])?.nameHe, TRADITION_TYPE_LABELS[record.traditionType]].filter(Boolean).join(' · ')}</small></span><ArrowMark /></button>;

// ── Onboarding: several roots, all optional; a city only if known ──────────────────────────────────────────────
function CommunityPicker({ label, value, onChange }) {
  const chosen = communityById(value);
  const family = chosen ? [...(chosen.parentId ? [communityById(chosen.parentId)] : []), chosen].find(c => !c.parentId) || chosen : null;
  const children = family ? childrenOf(family.id) : [];
  return <fieldset className="tradition-picker">
    <legend>{label}</legend>
    <Selector className="personal-field" label={`מסורת, ${label}`} shownLabel="מסורת" title="מסורת" value={family?.id || ''} onChange={id => onChange(id || null)} options={[['', 'לא נבחר'], ...rootCommunities().map(community => [community.id, community.nameHe])]} />
    {children.length > 0 && <Selector className="personal-field" label={`אזור, עיר או קהילה, ${label}`} shownLabel="אזור, עיר או קהילה" title="אזור, עיר או קהילה" value={chosen?.parentId ? chosen.id : ''} onChange={id => onChange(id || family.id)} options={[['', 'לא יודע/ת'], ...children.map(community => [community.id, community.nameHe])]} />}
  </fieldset>;
}
function Onboarding({ profile, onSave, onSkip }) {
  const [roots, setRoots] = useState(profile.roots || {});
  return <section className="personal-tools tradition-page"><BackLink href="#personal-tools" label="כלים אישיים" />
    <p className="eyebrow">כלים אישיים · המסורת שלי</p><h1>מאין מגיעה המסורת שלך?</h1>
    <p className="intro">אפשר לבחור יותר ממסורת אחת. בהמשך ניתן לדייק לפי עיר, אזור ומנהגי המשפחה. לא חובה לענות על הכול.</p>
    <div className="tradition-pickers">{PROFILE_ROLES.map(([role, label]) => <CommunityPicker key={role} label={label} value={roots[role] || null} onChange={id => setRoots(current => { const next = { ...current }; if (id) next[role] = id; else delete next[role]; return next; })} />)}</div>
    <p className="personal-hint">הבחירה מתעדת ומציגה בלבד — היא אינה קובעת איזה מנהג מחייב אותך. בשאלה הלכתית למעשה יש לשאול רב.</p>
    <div className="personal-actions"><button type="button" className="personal-primary" onClick={() => onSave({ ...profile, roots })}>שמירה</button><button type="button" className="ghost" onClick={onSkip}>דילוג</button></div>
  </section>;
}

// ── Home ───────────────────────────────────────────────────────────────────────────────────────────────────────
function Home({ profile, todayKey }) {
  const [query, setQuery] = useSearchState('tradition-query');
  const roots = profileRoots(profile);
  const matched = useMemo(() => recordsForProfile(profile), [profile]);
  const today = useMemo(() => todaysRecords(profile, todayKey), [profile, todayKey]);
  // The results follow the typing as a low-priority render: the field shows each letter at once.
  const searched = useDeferredValue(query);
  const results = useMemo(() => (searched.trim().length >= 2 ? searchTraditions(searched) : []), [searched]);
  const pool = matched.map(match => match.record);
  const count = test => pool.filter(test).length;
  const central = roots.find(([role]) => role === 'central') || roots[0];
  const others = roots.filter(root => root !== central);
  return <section className="personal-tools tradition-page"><BackLink href="#personal-tools" label="כלים אישיים" />
    <h1 className="tradition-title">המסורת שלי</h1>
    {/* One tight bar: the central tradition, the other roots on one line, and an edit link. */}
    <section className="tradition-identity" aria-label="השורשים שלי">
      <div className="tradition-identity-text">
        {central ? <><strong>{communityLabel(central[1])}</strong>{others.length > 0 && <small>{others.map(([role, id]) => `${PROFILE_ROLES.find(([r]) => r === role)[1].replace('משפחת ', '').replace('מסורת ', '')}: ${communityLabel(id)}`).join(' · ')}</small>}</> : <small>עוד לא נבחרה מסורת</small>}
      </div>
      <button type="button" className="tradition-edit" onClick={() => go('setup')}>{roots.length ? 'עריכה' : 'בחירה'}</button>
    </section>
    <label className="tradition-search"><span className="visually-hidden">חיפוש במאגר המנהגים</span><input type="search" value={query} onChange={event => setQuery(event.currentTarget.value)} placeholder={`חיפוש ב־${PUBLISHED_RECORDS.length.toLocaleString('he-IL')} מנהגים: קהילה, חג, מאכל…`} autoComplete="off" /></label>
    {query.trim().length >= 2 ? <section className="tradition-block" aria-live="polite" data-kz-results>
      <h2>{results.length ? `${results.length} תוצאות` : 'לא נמצאו מנהגים'}</h2>
      {results.length > SEARCH_LIMIT && <p className="personal-hint">מוצגות {SEARCH_LIMIT} הראשונות — אפשר לדייק, למשל בשם קהילה.</p>}
      <div className="tradition-list">{results.slice(0, SEARCH_LIMIT).map(record => <RecordRow key={record.id} record={record} />)}</div>
    </section> : <>
      {roots.length > 0 && <section className="tradition-block" aria-label="היום במסורת שלי"><h2>היום במסורת שלי</h2>
        {today.length ? <div className="tradition-list">{today.map(match => <RecordRow key={match.record.id} record={match.record} match={match} />)}</div>
          : <p className="personal-hint">אין היום מנהג מתועד הקשור ליום זה במסורות שבחרת.</p>}
      </section>}
      {roots.length > 0 && !matched.length && <p className="notice">למסורות שבחרת עדיין אין מנהגים מתועדים. אפשר לעיין בכל המאגר לפי קהילה.</p>}
      {pool.length > 0 && <>
        <Tiles title="מעגל השנה" rows={YEAR_CYCLE.map(section => [section.id, section.title, count(record => inYearSection(record, section))])} />
        <Tiles title="מעגל החיים" rows={LIFE_CYCLE.map(([id, title]) => [`life-${id}`, title, count(record => (record.lifecycleTriggers || []).includes(id))])} />
        <Tiles title="נושאים" rows={THEMES.map(([id, title, test]) => [`theme-${id}`, title, count(test)])} />
      </>}
      <div className="tradition-list tradition-more">
        <Row title="כל המנהגים לפי קהילה" meta={`${PUBLISHED_RECORDS.length.toLocaleString('he-IL')} מנהגים · ${rootCommunities().length} מסורות`} onClick={() => go('c')} />
        <Row title="השוואת מסורות" meta="אותו נושא בקהילות שונות" onClick={() => go('compare')} />
        <Row title="מנהגי המשפחה שלי" meta="נשמר במכשיר בלבד" onClick={() => go('family')} />
        <Row title="המקורות" meta={`${TRADITION_SOURCES.length} מקורות · זכויות`} onClick={() => go('sources')} />
      </div>
    </>}
  </section>;
}
// A compact grid: two tiles a row, the label and its count.
function Tiles({ title, rows }) {
  const visible = rows.filter(([, , n]) => n > 0);
  if (!visible.length) return null;
  return <section className="tradition-block"><h2>{title}</h2><div className="tradition-tiles">{visible.map(([id, label, n]) => <button key={id} type="button" className="tradition-tile" onClick={() => go(`s/${id}`)}><strong>{label}</strong><span>{n}</span></button>)}</div></section>;
}
// The whole archive, community by community — not only the reader's own roots.
function CommunityBrowser({ communityId }) {
  const community = communityById(communityId);
  const countFor = id => { const ids = new Set([id, ...childrenOf(id).map(c => c.id)]); return PUBLISHED_RECORDS.filter(record => record.communityIds.some(c => ids.has(c))).length; };
  if (community) {
    const ids = new Set([community.id, ...childrenOf(community.id).map(c => c.id)]);
    const records = PUBLISHED_RECORDS.filter(record => record.communityIds.some(c => ids.has(c)));
    const children = childrenOf(community.id).filter(child => countFor(child.id));
    return <section className="personal-tools tradition-page"><Back to="c" label="כל הקהילות" /><h1 className="tradition-title">{community.nameHe}</h1>
      {children.length > 0 && <div className="tradition-chips">{children.map(child => <button key={child.id} type="button" onClick={() => go(`c/${encodeURIComponent(child.id)}`)}>{child.nameHe} <span>{countFor(child.id)}</span></button>)}</div>}
      <p className="personal-hint">{records.length} מנהגים</p>
      <div className="tradition-list">{records.map(record => <RecordRow key={record.id} record={record} />)}</div>
    </section>;
  }
  const families = rootCommunities().map(c => [c, countFor(c.id)]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  return <section className="personal-tools tradition-page"><Back /><h1 className="tradition-title">כל המנהגים לפי קהילה</h1>
    <div className="tradition-tiles">{families.map(([c, n]) => <button key={c.id} type="button" className="tradition-tile" onClick={() => go(`c/${encodeURIComponent(c.id)}`)}><strong>{c.nameHe}</strong><span>{n}</span></button>)}</div>
  </section>;
}
function SectionView({ sectionId, profile }) {
  const year = YEAR_CYCLE.find(section => section.id === sectionId);
  const life = LIFE_CYCLE.find(([id]) => `life-${id}` === sectionId);
  const theme = THEMES.find(([id]) => `theme-${id}` === sectionId);
  const test = year ? record => inYearSection(record, year) : life ? record => (record.lifecycleTriggers || []).includes(life[0]) : theme ? theme[2] : () => false;
  const title = year?.title || life?.[1] || theme?.[1] || 'מנהגים';
  const matches = recordsForProfile(profile).filter(match => test(match.record));
  return <section className="personal-tools tradition-page"><Back /><p className="eyebrow">המסורת שלי</p><h1>{title}</h1>
    {matches.length ? <div className="tradition-list">{matches.map(match => <RecordRow key={match.record.id} record={match.record} match={match} />)}</div> : <p className="notice">אין כאן מנהגים מתועדים למסורות שבחרת.</p>}
  </section>;
}

// ── One custom: what it is, whose, of what kind, from where exactly ───────────────────────────────────────────
function RecordView({ record }) {
  if (!record) return <section className="personal-tools tradition-page"><Back /><p className="notice">המנהג לא נמצא במאגר.</p></section>;
  const variants = variantsOf(record);
  const notes = [
    record.normativeType !== 'law' && `זהו ${NORMATIVE_LABELS[record.normativeType] || 'מנהג'} ולא דין.`,
    variants.length > 0 && 'קיימות מסורות שונות בנושא זה.',
    record.historicalPeriod?.from && `המנהג מתועד מ${record.historicalPeriod.from}.`,
    record.israelContinuity && CONTINUITY_LABELS[record.israelContinuity] + '.',
    record.practicalHalacha && 'נדרש בירור הלכתי למעשה.',
    record.notes,
  ].filter(Boolean);
  return <section className="personal-tools tradition-page tradition-record"><Back />
    <div className="reader-title-row"><h1 className="tradition-record-title">{record.title}</h1><HeartToggle item={routeFavorite('tradition', `personal-tools/tradition/r/${record.id}`, record.title)} /></div>
    <p className="intro">{record.shortSummary}</p>
    <div className="tradition-tags" role="group" aria-label="פרטי המנהג">
      <span>{record.communityIds.map(communityLabel).join('; ')}</span>
      {record.historicalPeriod?.from && <span>{record.historicalPeriod.from}</span>}
      <span>{NORMATIVE_LABELS[record.normativeType]}</span>
      <span>{VERIFICATION_LABELS[record.verificationStatus]}</span>
    </div>
    <section className="tradition-block"><h2>על המנהג</h2><p className="tradition-body">{record.body}</p></section>
    <section className="tradition-block"><h2>מקור</h2>{record.citations.map(citation => { const source = sourceById(citation.sourceId); return <article key={citation.reference} className="tradition-citation">
      <strong>{citation.reference}</strong>
      {citation.excerpt && allowsVerbatim(source) && <blockquote>״{citation.excerpt}״</blockquote>}
      <p>{source.title}{source.author ? ` · ${source.author}` : ''}{source.publicationYear ? ` · ${source.publicationYear}` : ''}</p>
      <p className="personal-hint">{[SOURCE_TYPE_LABELS[source.sourceType], source.reference, <bdi key="license">{LICENSE_LABELS[source.license] || 'זכויות לא ידועות'}</bdi>].filter(Boolean).reduce((parts, part, index) => (index ? [...parts, ' · ', part] : [part]), [])}</p>
      {source.url && <p className="personal-hint tradition-url" dir="ltr">{displayUrl(source.url)}</p>}
    </article>; })}</section>
    {notes.length > 0 && <section className="tradition-block"><h2>חשוב לדעת</h2><ul className="tradition-notes">{notes.map(note => <li key={note}>{note}</li>)}</ul></section>}
    {variants.length > 0 && <section className="tradition-block"><h2>קיימות מסורות שונות</h2><div className="tradition-list">{variants.map(variant => <RecordRow key={variant.id} record={variant} />)}</div></section>}
  </section>;
}

// ── Compare ──────────────────────────────────────────────────────────────────────────────────────────────────
function CompareView({ topic }) {
  const topics = compareTopics();
  const current = topics.find(item => item.topic === topic);
  if (current) return <section className="personal-tools tradition-page"><Back to="compare" label="השוואת מסורות" /><p className="eyebrow">השוואת מסורות</p><h1>{current.records[0].title}</h1>
    <p className="intro">כל מסורת עם מקורה. אין כאן דירוג ואין הכרעה — המטרה לימוד.</p>
    <div className="tradition-compare">{current.records.map(record => <article key={record.id} className="tradition-citation"><strong>{record.communityIds.map(communityLabel).join('; ')}</strong><p>{record.shortSummary}</p><p className="personal-hint">{record.citations.map(c => c.reference).join(' · ')}</p><button type="button" className="ghost" onClick={() => go(`r/${encodeURIComponent(record.id)}`)}>למנהג המלא</button></article>)}</div>
  </section>;
  return <section className="personal-tools tradition-page"><Back /><p className="eyebrow">המסורת שלי</p><h1>השוואת מסורות</h1>
    <p className="intro">נושאים שיש בהם מנהגים מתועדים של יותר מקהילה אחת.</p>
    <div className="personal-tool-list">{topics.map(item => <Row key={item.topic} title={item.records[0].title} meta={[...new Set(item.records.flatMap(r => r.communityIds))].map(id => communityById(id)?.nameHe).join(' · ')} onClick={() => go(`compare/${encodeURIComponent(item.topic)}`)} />)}</div>
  </section>;
}

// ── Family customs: private, on this device only ─────────────────────────────────────────────────────────────
const FAMILY_FIELDS = [['title', 'כותרת'], ['practice', 'מה נהגו לעשות'], ['who', 'מי במשפחה נהג כך'], ['place', 'מאיזו קהילה או עיר'], ['when', 'מתי'], ['familySource', 'ממי שמענו'], ['note', 'הערה']];
function FamilyView() {
  const [items, setItems] = useState(loadFamilyCustoms);
  const [draft, setDraft] = useState({});
  const [adding, setAdding] = useState(false);
  const submit = event => { event.preventDefault(); setItems(addFamilyCustom(draft)); setDraft({}); setAdding(false); };
  return <section className="personal-tools tradition-page"><Back /><p className="eyebrow">המסורת שלי</p><h1>מנהגי הבית שלנו</h1>
    <p className="intro">מה שנהגו במשפחה — לדורות הבאים. נשמר במכשיר שלך בלבד, ואינו נכנס למאגר הציבורי.</p>
    {!adding && <button type="button" className="personal-primary" onClick={() => setAdding(true)}>הוספת מנהג משפחתי</button>}
    {adding && <form className="personal-form tradition-family-form" onSubmit={submit}>
      {FAMILY_FIELDS.map(([key, label]) => <label key={key} className="personal-field"><span>{label}{key === 'title' || key === 'practice' ? '' : ' (לא חובה)'}</span>{key === 'practice' || key === 'note' ? <textarea rows={key === 'practice' ? 4 : 2} value={draft[key] || ''} onChange={event => setDraft(d => ({ ...d, [key]: event.currentTarget.value }))} placeholder={key === 'practice' ? 'למשל: כך היה נוהג סבא יעקב בכל ליל פסח…' : ''} /> : <input value={draft[key] || ''} onChange={event => setDraft(d => ({ ...d, [key]: event.currentTarget.value }))} autoComplete="off" />}</label>)}
      <div className="personal-actions"><button type="submit" className="personal-primary" disabled={!draft.title?.trim() || !draft.practice?.trim()}>שמירה</button><button type="button" className="ghost" onClick={() => setAdding(false)}>ביטול</button></div>
    </form>}
    {items.length > 0 ? <div className="tradition-family-list">{items.map(item => <article key={item.id} className="tradition-citation">
      <strong>{item.title}</strong><p>{item.practice}</p>
      {[['מי', item.who], ['קהילה', item.place], ['מתי', item.when], ['ממי שמענו', item.familySource], ['הערה', item.note]].filter(([, v]) => v).map(([k, v]) => <p key={k} className="personal-hint">{k}: {v}</p>)}
      <button type="button" className="ghost" aria-label={`מחיקה: ${item.title}`} onClick={() => { if (window.confirm('למחוק את המנהג הזה מהמכשיר?')) setItems(removeFamilyCustom(item.id)); }}>מחיקה</button>
    </article>)}</div> : !adding && <p className="personal-hint">עוד לא נשמרו מנהגים משפחתיים.</p>}
  </section>;
}

// ── Sources ──────────────────────────────────────────────────────────────────────────────────────────────────
function SourcesView() {
  return <section className="personal-tools tradition-page"><Back /><p className="eyebrow">המסורת שלי</p><h1>כל המקורות</h1>
    <p className="intro">כל מנהג במאגר מפנה למקום מדויק באחד המקורות האלה. ציטוט מלא מובא רק ממקור שהוא נחלת הכלל או ברישיון פתוח.</p>
    {TRADITION_SOURCES.map(source => <article key={source.id} className="tradition-citation">
      <strong>{source.title}</strong><p>{[source.author, source.publisher, source.publicationYear].filter(Boolean).join(' · ')}</p>
      <p className="personal-hint">{SOURCE_TYPE_LABELS[source.sourceType]} · {LICENSE_LABELS[source.license]} · {PUBLISHED_RECORDS.filter(r => r.citations.some(c => c.sourceId === source.id)).length} מנהגים</p>
      {source.notes && <p className="personal-hint">{source.notes}</p>}
      {source.url && <p className="personal-hint tradition-url" dir="ltr">{displayUrl(source.url)}</p>}
    </article>)}
  </section>;
}
