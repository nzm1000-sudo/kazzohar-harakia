// חידושי התורה שלי — the list, one chidush, the editor (autosaved), and "שליחה למאגר" (a clear preview, the name
// the user chooses, and an email the user sends from their own mail app).
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import ClearableInput from '../ClearableInput.jsx';
import Selector from '../ui/Selector.jsx';
import { HeartIcon } from '../HeartToggle.jsx';
import { PageHead, leatzmiBack, shareText, useStore } from './common.jsx';
import { useStudyTimer } from '../../hooks.jsx';
import {
  CATEGORIES, SORTS, STATUS, STATUS_LABEL, buildChidushIndex, categoryLabel, chidushPlainText, createChidush, createFollowUp, deleteChidush,
  filterChidushim, followUpsOf, getChidush, loadChidushim, onChidushimChange, searchChidushim, sortChidushim, toggleChidushFavorite,
  toggleChidushPinned, updateChidush,
} from '../../services/leatzmi/chidushim.mjs';
import { NAME_CHOICES, formatSubmission, readSubmitPrefs, saveSubmitPrefs, sharedChidushimRepository } from '../../services/leatzmi/sharedRepository.mjs';
import { mailtoHref } from '../../services/contact.mjs';
import { parashaOfWeek } from '../../services/weeklyParasha.mjs';
import { civilDateKey } from '../../civilDate.mjs';
import { leatzmiRoute } from '../../services/leatzmi/routes.mjs';

const useChidushim = () => useStore(() => loadChidushim(), onChidushimChange);
const timeLabel = iso => { try { return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); } catch { return ''; } };
const civilLabel = iso => { try { return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return ''; } };
const excerpt = text => { const plain = String(text || '').replace(/\s+/g, ' ').trim(); return plain.length > 140 ? `${plain.slice(0, 137)}…` : plain; };

// Writing and re-reading one's chidushim is Torah study: counted by active time only (services/studySession.mjs —
// a minute or more of real engagement, recorded once per day in "המצוות שלי"; never by the number of notes).
function useChidushStudy(tzid, enabled = true) {
  return useStudyTimer({ workId: 'leatzmi-chidushim', workTitle: 'חידושי התורה שלי', category: 'torah_study', source: 'leatzmi', tzid, enabled });
}

export function ChidushimList({ go }) {
  const items = useChidushim();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const [sort, setSort] = useState('updated');
  // One quiet filter: all, the favourites, or a subject the user has written in.
  const [filter, setFilter] = useState('');
  const favorite = filter === 'favorite';
  const category = favorite ? '' : filter;
  const index = useMemo(() => buildChidushIndex(items), [items]);
  const shown = useMemo(() => sortChidushim(filterChidushim(items, { ids: searchChidushim(index, deferred), category, favorite }), sort), [items, index, deferred, category, favorite, sort]);
  const usedCategories = useMemo(() => CATEGORIES.filter(([id]) => items.some(item => item.category === id)), [items]);
  return <div className="lz-chidushim">
    <PageHead title="חידושי התורה שלי" line="פרטיים, ושמורים רק במכשיר הזה." onBack={leatzmiBack(go)} />
    <div className="lz-center"><button type="button" className="lz-outline" onClick={() => go(leatzmiRoute.newChidush())}>חידוש חדש</button></div>
    {items.length > 0 && <div className="lz-tools">
      <ClearableInput type="search" deferred value={query} onChange={event => setQuery(event.target.value)} placeholder="חיפוש בחידושים" aria-label="חיפוש בחידושים שלי" clearLabel="נקה חיפוש" className="lz-search" />
      <div className="lz-filters">
        <Selector variant="chip" className="lz-select" label="סדר" value={sort} defaultValue={SORTS[0][0]} onChange={setSort} options={SORTS} />
        <Selector variant="chip" className="lz-select" label="הצגה" value={filter} defaultValue="" onChange={setFilter} options={[['', 'כל החידושים'], ['favorite', 'המועדפים'], ...(usedCategories.length > 1 ? usedCategories : [])]} />
      </div>
    </div>}
    {items.length === 0 && <p className="lz-empty">עוד לא נכתב כאן דבר.<br />החידוש הראשון מחכה לך.</p>}
    {items.length > 0 && shown.length === 0 && <p className="lz-empty" role="status">לא נמצאו חידושים מתאימים.</p>}
    <ul className="lz-list" aria-label="החידושים שלי">
      {shown.map(item => <li key={item.id}>
        <a className="lz-list-row" href={`#${leatzmiRoute.chidush(item.id)}`}>
          <span className="lz-list-title">{item.title || 'ללא כותרת'}{item.favorite && <span className="lz-fav" role="img" aria-label="מועדף"><HeartIcon filled /></span>}</span>
          {item.body && <span className="lz-list-excerpt">{excerpt(item.body)}</span>}
          <span className="lz-list-meta">{[item.pinned ? 'נעוץ' : '', item.hebrewDate, categoryLabel(item.category), item.status !== STATUS.PRIVATE ? STATUS_LABEL[item.status] : '', item.followUpOf ? 'מחשבה נוספת' : ''].filter(Boolean).join(' · ')}</span>
        </a>
      </li>)}
    </ul>
  </div>;
}

export function ChidushView({ id, go, tzid }) {
  const items = useChidushim();
  const item = items.find(entry => entry.id === id) || null;
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(null);
  useChidushStudy(tzid, Boolean(item));
  if (!item) return <div><PageHead title="החידוש לא נמצא" line="ייתכן שנמחק." onBack={leatzmiBack(go, leatzmiRoute.chidushim())} backLabel="החידושים שלי" /></div>;
  const original = item.followUpOf ? items.find(entry => entry.id === item.followUpOf) : null;
  const later = followUpsOf(item.id, items);
  const share = async () => {
    const result = await shareText({ title: item.title || 'חידוש תורה', text: chidushPlainText(item) });
    setMessage(result === 'copied' ? 'הטקסט הועתק' : '');
  };
  const reflect = () => { const note = createFollowUp(item.id); if (note) go(leatzmiRoute.edit(note.id)); };
  const remove = () => { deleteChidush(item.id); go(leatzmiRoute.chidushim(), { replace: true }); };
  return <article className="lz-chidush">
    <PageHead title={item.title || 'ללא כותרת'} line={[item.hebrewDate, categoryLabel(item.category), STATUS_LABEL[item.status]].filter(Boolean).join(' · ')} onBack={leatzmiBack(go, leatzmiRoute.chidushim())} backLabel="החידושים שלי" />
    {original && <p className="lz-context">מחשבה נוספת על <button type="button" className="lz-text-button" onClick={() => go(leatzmiRoute.chidush(original.id))}>{original.title || 'חידוש קודם'}</button></p>}
    <div className="lz-body" lang="he">{item.body ? item.body.split(/\n{2,}/).map((para, index) => <p key={index}>{para}</p>) : <p className="lz-muted">אין עדיין תוכן.</p>}</div>
    {(item.parasha || item.topic || item.sources.length > 0 || item.tags.length > 0) && <dl className="lz-facts">
      {item.parasha && <><dt>פרשה</dt><dd>{item.parasha}</dd></>}
      {item.topic && <><dt>ספר או נושא</dt><dd>{item.topic}</dd></>}
      {item.sources.length > 0 && <><dt>מקורות</dt><dd>{item.sources.join(' · ')}</dd></>}
      {item.tags.length > 0 && <><dt>תגיות</dt><dd>{item.tags.join(' · ')}</dd></>}
    </dl>}
    {item.status === STATUS.SUBMITTED && item.submittedAt && <p className="lz-status">נשלח למאגר ב־{civilLabel(item.submittedAt)}</p>}

    <div className="lz-center"><button type="button" className="lz-outline" onClick={reflect}>מה אני חושב על זה היום?</button></div>

    <div className="lz-actions" role="group" aria-label="פעולות">
      <button type="button" className="lz-text-button" onClick={() => go(leatzmiRoute.edit(item.id))}>עריכה</button>
      <button type="button" className="lz-text-button" onClick={share}>שיתוף</button>
      <button type="button" className="lz-text-button" onClick={() => go(leatzmiRoute.send(item.id))}>שליחה למאגר</button>
    </div>
    <div className="lz-actions lz-actions-quiet" role="group" aria-label="סימון ומחיקה">
      <button type="button" className="lz-text-button" aria-pressed={item.favorite} onClick={() => toggleChidushFavorite(item.id)}><HeartIcon filled={item.favorite} />{item.favorite ? 'במועדפים' : 'למועדפים'}</button>
      <button type="button" className="lz-text-button" aria-pressed={item.pinned} onClick={() => toggleChidushPinned(item.id)}>{item.pinned ? 'נעוץ בראש הרשימה' : 'נעיצה בראש הרשימה'}</button>
      <button type="button" className="lz-text-button" onClick={() => setConfirming(true)}>מחיקה</button>
    </div>
    <p className="lz-message" role="status">{message}</p>
    {confirming && <div className="lz-confirm" role="alertdialog" aria-labelledby="lz-confirm-text">
      <p id="lz-confirm-text">למחוק את החידוש? אי אפשר לשחזר אותו.</p>
      <div className="lz-confirm-actions"><button type="button" className="lz-outline lz-danger" onClick={remove} autoFocus>מחיקה</button><button type="button" className="lz-outline" onClick={() => setConfirming(false)}>ביטול</button></div>
    </div>}

    {later.length > 0 && <section className="lz-subsection" aria-labelledby="lz-later"><h2 id="lz-later" className="lz-caption">מחשבות מאוחרות יותר</h2>
      <ul className="lz-list">{later.map(note => <li key={note.id}><a className="lz-list-row" href={`#${leatzmiRoute.chidush(note.id)}`}><span className="lz-list-title">{note.title || 'ללא כותרת'}</span><span className="lz-list-meta">{note.hebrewDate}</span></a></li>)}</ul>
    </section>}
    {item.revisions.length > 0 && <details className="lz-revisions">
      <summary>גרסאות קודמות</summary>
      <ul>{[...item.revisions].reverse().map((rev, index) => <li key={index}><button type="button" className="lz-text-button" aria-expanded={revision === index} onClick={() => setRevision(revision === index ? null : index)}>{civilLabel(rev.at)} · {timeLabel(rev.at)}</button>{revision === index && <div className="lz-revision-text"><strong>{rev.title}</strong>{rev.body.split(/\n{2,}/).map((para, k) => <p key={k}>{para}</p>)}</div>}</li>)}</ul>
    </details>}
  </article>;
}

const listText = value => (Array.isArray(value) ? value.join('\n') : String(value || ''));
const toList = text => String(text || '').split(/\n|,/).map(part => part.trim()).filter(Boolean);

export function ChidushEditor({ id, go, tzid, il }) {
  const [existing] = useState(() => (id ? getChidush(id) : null));
  const [currentId, setCurrentId] = useState(existing?.id || null);
  const [form, setForm] = useState(() => ({
    title: existing?.title || '', body: existing?.body || '', category: existing?.category || 'torah', parasha: existing?.parasha || '',
    topic: existing?.topic || '', sources: listText(existing?.sources), tags: (existing?.tags || []).join(', '), status: existing?.status === STATUS.READY ? STATUS.READY : STATUS.PRIVATE,
  }));
  const [savedAt, setSavedAt] = useState(existing?.updatedAt || null);
  const [details, setDetails] = useState(Boolean(existing?.parasha || existing?.topic || existing?.sources?.length));
  const weekly = useMemo(() => { try { return parashaOfWeek(civilDateKey(new Date(), tzid), il); } catch { return null; } }, [tzid, il]);
  const bodyRef = useRef(null);
  const timer = useRef(0);
  const currentIdRef = useRef(currentId);
  const mounted = useRef(true);
  const latest = useRef(form);
  latest.current = form;
  useChidushStudy(tzid);
  // Autosave: shortly after typing stops, and when leaving. A new chidush becomes a saved one with its first words.
  const persist = () => {
    const value = latest.current;
    const fields = { title: value.title.trim(), body: value.body, category: value.category, parasha: value.parasha.trim(), topic: value.topic.trim(), sources: toList(value.sources), tags: toList(value.tags) };
    const keepStatus = existing?.status === STATUS.SUBMITTED ? {} : { status: value.status };
    if (!fields.title && !fields.body.trim()) return;
    if (currentIdRef.current) { const saved = updateChidush(currentIdRef.current, { ...fields, ...keepStatus }); if (saved) setSavedAt(saved.updatedAt); }
    else {
      const created = createChidush({ ...fields, ...keepStatus });
      currentIdRef.current = created.id; setCurrentId(created.id); setSavedAt(created.updatedAt);
      // This history entry now opens the saved chidush (Back, or a relaunch, never makes a second one).
      if (mounted.current) go(leatzmiRoute.edit(created.id), { replace: true, quiet: true });
    }
  };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearTimeout(timer.current); persist(); }; }, []);
  const change = (key, value) => { setForm(previous => ({ ...previous, [key]: value })); clearTimeout(timer.current); timer.current = setTimeout(persist, 600); };
  useEffect(() => { const area = bodyRef.current; if (!area) return; area.style.height = 'auto'; area.style.height = `${Math.max(220, area.scrollHeight + 2)}px`; }, [form.body]);
  const finish = () => { clearTimeout(timer.current); persist(); const target = currentIdRef.current; if (target) go(leatzmiRoute.chidush(target), { replace: true }); else leatzmiBack(go, leatzmiRoute.chidushim())(); };
  return <div className="lz-editor">
    <PageHead title={existing ? 'עריכת חידוש' : 'חידוש חדש'} line="נשמר מעצמו, רק במכשיר הזה." onBack={finish} backLabel="סיום" />
    <label className="lz-field"><span>כותרת</span><input value={form.title} onChange={event => change('title', event.target.value)} placeholder="במה מדובר, בכמה מילים" maxLength={300} enterKeyHint="next" /></label>
    <label className="lz-field"><span>החידוש</span><textarea ref={bodyRef} value={form.body} onChange={event => change('body', event.target.value)} placeholder="כתבו בחופשיות…" rows={9} /></label>
    <div className="lz-field-row">
      <Selector className="lz-field" label="נושא" value={form.category} onChange={value => change('category', value)} options={CATEGORIES} />
      <Selector className="lz-field" label="פרטיות" value={existing?.status === STATUS.SUBMITTED ? STATUS.SUBMITTED : form.status} disabled={existing?.status === STATUS.SUBMITTED} onChange={value => change('status', value)}
        options={[[STATUS.PRIVATE, STATUS_LABEL.private], [STATUS.READY, STATUS_LABEL.ready], ...(existing?.status === STATUS.SUBMITTED ? [[STATUS.SUBMITTED, STATUS_LABEL.submitted]] : [])]} />
    </div>
    <details className="lz-details" open={details} onToggle={event => setDetails(event.currentTarget.open)}>
      <summary>פרשה, מקורות ותגיות</summary>
      <label className="lz-field"><span>פרשה</span><input value={form.parasha} onChange={event => change('parasha', event.target.value)} placeholder={weekly ? weekly.he : ''} /></label>
      {weekly && !form.parasha && <button type="button" className="lz-text-button lz-suggest" onClick={() => change('parasha', weekly.he)}>פרשת השבוע: {weekly.he}</button>}
      <label className="lz-field"><span>ספר, מסכת או נושא</span><input value={form.topic} onChange={event => change('topic', event.target.value)} placeholder="למשל: ברכות, פרק ראשון" /></label>
      <label className="lz-field"><span>מקורות ופסוקים</span><textarea value={form.sources} onChange={event => change('sources', event.target.value)} rows={3} placeholder={'מקור בכל שורה\nלמשל: בראשית א, א'} /></label>
      <label className="lz-field"><span>תגיות</span><input value={form.tags} onChange={event => change('tags', event.target.value)} placeholder="מופרדות בפסיק" /></label>
    </details>
    <p className="lz-saved" aria-live="off">{savedAt && currentId ? `נשמר במכשיר · ${timeLabel(savedAt)}` : 'יישמר עם המילים הראשונות'}</p>
    <div className="lz-center"><button type="button" className="lz-outline" onClick={finish}>סיום</button></div>
  </div>;
}

export function ChidushSend({ id, go }) {
  const item = useChidushim().find(entry => entry.id === id) || null;
  const [prefs, setPrefs] = useState(readSubmitPrefs);
  const [done, setDone] = useState(null);
  const [copied, setCopied] = useState(false);
  if (!item) return <div><PageHead title="החידוש לא נמצא" onBack={leatzmiBack(go, leatzmiRoute.chidushim())} backLabel="החידושים שלי" /></div>;
  const formatted = formatSubmission(item, prefs);
  const empty = !item.title.trim() && !item.body.trim();
  const repository = sharedChidushimRepository({ open: () => {} }); // the link below opens the mail app itself
  const send = () => { saveSubmitPrefs(prefs); const result = repository.submit(item, prefs); setDone(result); };
  const copy = async () => { try { await navigator.clipboard.writeText(formatted.full); setCopied(true); } catch { setCopied(false); } };
  const undo = () => { updateChidush(item.id, { status: STATUS.READY }); setDone(null); };
  return <div className="lz-send">
    <PageHead title="שליחה למאגר" line="שיתוף החידוש עם צוות כזוהר הרקיע, לשיקול פרסום במאגר." onBack={leatzmiBack(go, leatzmiRoute.chidush(item.id))} backLabel="לחידוש" />
    {!done && <>
      <ol className="lz-steps">
        <li>בודקים את הנוסח שיישלח.</li>
        <li>בוחרים איך יופיע השם.</li>
        <li>תוכנת הדואר שלך נפתחת עם ההודעה מוכנה — והשליחה בידיך.</li>
      </ol>
      <fieldset className="lz-names"><legend>איך יופיע השם</legend>
        {NAME_CHOICES.map(([value, label]) => <label key={value} className="lz-radio"><input type="radio" name="lz-name" value={value} checked={prefs.nameChoice === value} onChange={() => setPrefs(previous => ({ ...previous, nameChoice: value }))} /><span>{label}</span></label>)}
      </fieldset>
      {prefs.nameChoice !== 'anonymous' && <label className="lz-field"><span>{prefs.nameChoice === 'first' ? 'השם הפרטי' : 'השם המלא'}</span><input value={prefs.name} onChange={event => setPrefs(previous => ({ ...previous, name: event.target.value }))} autoComplete="name" maxLength={80} /></label>}
      <section className="lz-preview" aria-labelledby="lz-preview-title">
        <h2 id="lz-preview-title" className="lz-caption">כך תיראה ההודעה</h2>
        <p className="lz-preview-subject">נושא: {formatted.subject}</p>
        <div className="lz-preview-body" lang="he">{formatted.body.split('\n').map((line, index) => (line ? <p key={index}>{line}</p> : <br key={index} />))}</div>
      </section>
      {formatted.truncated && <p className="lz-note">החידוש ארוך, וההודעה קוצרה. אפשר להעתיק את הנוסח המלא ולהדביק אותו בהודעה. <button type="button" className="lz-text-button" onClick={copy}>{copied ? 'הועתק' : 'העתקת הנוסח המלא'}</button></p>}
      <p className="lz-note">שום דבר לא נשלח מעצמו. ההחלטה אם ואיך לפרסם — בידי צוות המאגר. העותק שלך נשאר כפי שהוא.</p>
      <div className="lz-center">{empty ? <p className="lz-muted">אין עדיין מה לשלוח.</p> : <a className="lz-outline" href={mailtoHref({ subject: formatted.subject, body: formatted.body })} onClick={send}>פתיחת הודעת הדואר</a>}</div>
    </>}
    {done && <div className="lz-done" role="status">
      <p>ההודעה הוכנה בתוכנת הדואר.</p>
      <p className="lz-muted">החידוש סומן „{STATUS_LABEL.submitted}״. תודה על השיתוף.</p>
      <div className="lz-actions"><button type="button" className="lz-text-button" onClick={() => go(leatzmiRoute.chidush(item.id), { replace: true })}>חזרה לחידוש</button><button type="button" className="lz-text-button" onClick={undo}>לא נשלח בסוף? לבטל את הסימון</button></div>
    </div>}
  </div>;
}
