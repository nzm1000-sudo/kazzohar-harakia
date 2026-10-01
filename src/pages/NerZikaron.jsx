import { useEffect, useMemo, useState } from 'react';
import { HDate } from '@hebcal/core';
import { BackLink } from '../components/LocalNavigation.jsx';
import TitleOrnament from '../components/ui/TitleOrnament.jsx';
import { Candle } from '../components/NerHashem.jsx';
import Selector from '../components/ui/Selector.jsx';
import { hebrewMonthsForYear } from '../services/personalTools.mjs';
import { validHebrewDate, hebrewFromCivilDeath, adarChoiceMatters, defaultAdarRule, nextYahrzeit, sortByNext, memorialName, hebrewDayLabel, daysInMonth } from '../services/memorialYahrzeit.mjs';
import { loadMemorials, saveMemorials, newMemorialId, reconcileMemorialReminders, MEMORIAL_CHANGE_EVENT } from '../services/memorialStore.mjs';
import { deleteEventsOfMemorial, loadReminders, syncReminders, REMINDERS_CHANGE_EVENT } from '../services/reminders/index.mjs';

// "נר זיכרון" — the user's own loved ones: their yahrzeit every year, a reminder before it, and a candle on the
// Today screen from the sunset that begins it. Private: everything stays on this device.
const RELATIONS = ['אבא', 'אמא', 'סבא', 'סבתא', 'בן משפחה', 'רב / מורה', 'חבר / חברה', 'אחר'];
const civilLabel = date => new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
const hebrewFullLabel = parts => new HDate(Number(parts.day), Number(parts.month), Number(parts.year)).renderGematriya(true);
const inDaysLabel = days => (days === 0 ? 'היום' : days === 1 ? 'מחר' : days === 2 ? 'בעוד יומיים' : `בעוד ${days} ימים`);
const todayHDate = () => new HDate(new Date());

const blank = nusach => {
  const today = todayHDate();
  const now = new Date();
  return {
    name: '', gender: 'm', parent: '', relationship: '', inputType: 'hebrew',
    hebrew: { day: today.getDate(), month: today.getMonth(), year: today.getFullYear() },
    civil: { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear(), sunsetRelation: 'before' },
    uncertainChoice: null, adarRule: defaultAdarRule(nusach),
    reminder: { enabled: true, daysBefore: 1, time: '09:00' }, duration: 1,
  };
};

function fromRecord(record, nusach) {
  const base = blank(nusach);
  return {
    ...base,
    name: record.name ?? record.displayName, gender: record.gender, parent: record.parent || '', relationship: record.relationship || '',
    inputType: record.originalInputType || 'hebrew',
    hebrew: record.hebrewDeathDate || base.hebrew,
    civil: record.civilDeathDate || base.civil,
    uncertainChoice: null, adarRule: record.adarRule || base.adarRule,
    reminder: record.reminder || base.reminder, duration: record.homeDisplay?.duration === 3 ? 3 : 1,
  };
}

// The Hebrew date the form stands for: exact, or the two possibilities when the time of death is unknown.
function resolveForm(form) {
  if (form.inputType === 'hebrew') return validHebrewDate(form.hebrew) ? { date: { ...form.hebrew, day: Number(form.hebrew.day), month: Number(form.hebrew.month), year: Number(form.hebrew.year) }, confidence: 'exact' } : { error: 'התאריך העברי אינו קיים בשנה זו' };
  const converted = hebrewFromCivilDeath(form.civil);
  if (!converted) return { error: 'התאריך הלועזי אינו תקין' };
  if (converted.confidence === 'uncertain' && form.uncertainChoice) return { date: converted.candidates[form.uncertainChoice], confidence: 'exact', candidates: converted.candidates };
  return converted;
}

const displayNameOf = form => (form.parent.trim() ? `${form.name.trim()} ${form.gender === 'f' ? 'בת' : 'בן'} ${form.parent.trim()}` : form.name.trim());

function Seg({ value, options, onChange, label }) {
  return <div className="seg nz-seg" role="radiogroup" aria-label={label}>{options.map(([key, text]) => <button type="button" key={key} role="radio" aria-checked={value === key} className={value === key ? 'on' : ''} onClick={() => onChange(key)}>{text}</button>)}</div>;
}

function MemorialForm({ initial, nusach, onCancel, onSaved }) {
  const [form, setForm] = useState(initial);
  const [step, setStep] = useState('edit');
  const [message, setMessage] = useState('');
  const set = patch => setForm(state => ({ ...state, ...patch }));
  const resolved = resolveForm(form);
  const months = hebrewMonthsForYear(Number(form.hebrew.year) || todayHDate().getFullYear());
  const maxDay = validHebrewDate({ ...form.hebrew, day: 1 }) ? daysInMonth(form.hebrew.month, form.hebrew.year) : 30;
  const record = resolved.date ? {
    id: initial.id || newMemorialId(), name: form.name.trim(), parent: form.parent.trim(), displayName: displayNameOf(form), gender: form.gender, relationship: form.relationship,
    originalInputType: form.inputType, civilDeathDate: form.inputType === 'civil' ? { ...form.civil, day: Number(form.civil.day), month: Number(form.civil.month), year: Number(form.civil.year) } : null,
    hebrewDeathDate: resolved.date, dateConfidence: resolved.confidence, adarRule: adarChoiceMatters(resolved.date) ? form.adarRule : null,
    reminder: form.reminder, homeDisplay: { duration: form.duration }, createdAt: initial.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
  } : null;
  const uncertainRecord = !resolved.date && resolved.candidates ? {
    id: initial.id || newMemorialId(), name: form.name.trim(), parent: form.parent.trim(), displayName: displayNameOf(form), gender: form.gender, relationship: form.relationship,
    originalInputType: 'civil', civilDeathDate: { ...form.civil }, hebrewDeathDate: null, dateCandidates: resolved.candidates, dateConfidence: 'uncertain', adarRule: null,
    reminder: { ...form.reminder, enabled: false }, homeDisplay: { duration: form.duration }, createdAt: initial.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
  } : null;
  const next = record ? nextYahrzeit(record, todayHDate()) : null;
  const save = async target => {
    const list = loadMemorials().filter(item => item.id !== target.id);
    saveMemorials([...list, target]);
    const result = await reconcileMemorialReminders({ ask: Boolean(target.reminder?.enabled) });
    const warn = target.reminder?.enabled && result.permission !== 'granted' ? 'נר הזיכרון נשמר, אך ההתראה אינה פעילה.' : '';
    onSaved(target, warn);
  };
  if (step === 'confirm' && (record || uncertainRecord)) {
    const r = record || uncertainRecord;
    return <section className="nz-confirm" aria-live="polite">
      <h2>אישור לפני שמירה</h2>
      <dl>
        <dt>שם</dt><dd>{memorialName(r)}</dd>
        {record ? <><dt>תאריך הפטירה</dt><dd>{hebrewFullLabel(record.hebrewDeathDate)}</dd></> : <><dt>תאריך הפטירה</dt><dd>לא נקבע — תלוי בשעת הפטירה</dd></>}
        {r.civilDeathDate && <><dt>תאריך לועזי</dt><dd>{civilLabel(new Date(r.civilDeathDate.year, r.civilDeathDate.month - 1, r.civilDeathDate.day))}</dd></>}
        {next && <><dt>האזכרה הקרובה</dt><dd>{hebrewFullLabel({ day: next.getDate(), month: next.getMonth(), year: next.getFullYear() })}<br />{civilLabel(next.greg())}<small> · מתחילה בשקיעה של הערב הקודם</small></dd></>}
      </dl>
      {!record && <p className="notice">כדי להפעיל תזכורת שנתית מדויקת יש לבחור את התאריך העברי הנכון. אפשר לשמור עכשיו ולבחור אחר כך.</p>}
      <div className="nz-actions"><button type="button" className="personal-primary" onClick={() => save(r)}>שמירת נר הזיכרון</button><button type="button" className="ghost" onClick={() => setStep('edit')}>חזרה לעריכה</button></div>
    </section>;
  }
  return <form className="personal-form nz-form" onSubmit={event => { event.preventDefault(); if (!form.name.trim()) { setMessage('יש לכתוב את שם הנפטר/ת'); return; } if (resolved.error) { setMessage(resolved.error); return; } setMessage(''); setStep('confirm'); }}>
    <label className="personal-field"><span>שם הנפטר/ת</span><input value={form.name} onChange={e => set({ name: e.target.value })} required /></label>
    <Seg label="נפטר או נפטרת" value={form.gender} onChange={gender => set({ gender })} options={[['m', 'נפטר'], ['f', 'נפטרת']]} />
    <label className="personal-field"><span>שם האב / האם (לא חובה)</span><input value={form.parent} onChange={e => set({ parent: e.target.value })} /></label>
    {form.name.trim() && <p className="personal-hint">יוצג: {displayNameOf(form)} {form.gender === 'f' ? 'ע״ה' : 'ז״ל'}</p>}
    <Selector className="personal-field" label="הקשר אליי (לא חובה)" value={form.relationship || ''} onChange={relationship => set({ relationship })} options={[['', 'לא צוין'], ...RELATIONS]} />
    <Seg label="סוג התאריך" value={form.inputType} onChange={inputType => set({ inputType, uncertainChoice: null })} options={[['hebrew', 'תאריך עברי'], ['civil', 'תאריך לועזי']]} />
    {form.inputType === 'hebrew' ? <div className="date-fields">
      <Selector className="personal-field" label="יום" columns={6} value={form.hebrew.day} onChange={day => set({ hebrew: { ...form.hebrew, day: Number(day) } })} options={Array.from({ length: maxDay }, (_, i) => i + 1).map(d => [d, new HDate(d, 7, 5780).renderGematriya(true).split(' ')[0]])} />
      <Selector className="personal-field" label="חודש" value={form.hebrew.month} onChange={month => set({ hebrew: { ...form.hebrew, month: Number(month) } })} options={months} />
      <label className="personal-field"><span>שנה</span><input type="number" inputMode="numeric" min="5600" max="6000" value={form.hebrew.year} onChange={e => set({ hebrew: { ...form.hebrew, year: Number(e.target.value) } })} /></label>
    </div> : <>
      <div className="date-fields">
        <label className="personal-field"><span>יום</span><input type="number" inputMode="numeric" min="1" max="31" value={form.civil.day} onChange={e => set({ civil: { ...form.civil, day: e.target.value }, uncertainChoice: null })} /></label>
        <label className="personal-field"><span>חודש</span><input type="number" inputMode="numeric" min="1" max="12" value={form.civil.month} onChange={e => set({ civil: { ...form.civil, month: e.target.value }, uncertainChoice: null })} /></label>
        <label className="personal-field"><span>שנה</span><input type="number" inputMode="numeric" min="1850" max="2100" value={form.civil.year} onChange={e => set({ civil: { ...form.civil, year: e.target.value }, uncertainChoice: null })} /></label>
      </div>
      <p className="nz-question">מתי הייתה הפטירה ביחס לשקיעה?</p>
      <Seg label="ביחס לשקיעה" value={form.civil.sunsetRelation} onChange={sunsetRelation => set({ civil: { ...form.civil, sunsetRelation }, uncertainChoice: null })} options={[['before', 'לפני השקיעה'], ['after', 'אחרי השקיעה'], ['unknown', 'לא ידוע']]} />
      {form.civil.sunsetRelation === 'unknown' && (() => { const c = hebrewFromCivilDeath({ ...form.civil, sunsetRelation: 'unknown' }); return c?.candidates ? <div className="nz-uncertain" role="group" aria-label="שתי האפשרויות">
        <p>התאריך העברי תלוי בשעת הפטירה.</p>
        {[['before', 'לפני השקיעה'], ['after', 'אחרי השקיעה']].map(([key, text]) => <button type="button" key={key} className={`nz-choice${form.uncertainChoice === key ? ' on' : ''}`} aria-pressed={form.uncertainChoice === key} onClick={() => set({ uncertainChoice: form.uncertainChoice === key ? null : key })}><span>{text}</span><strong>{hebrewFullLabel(c.candidates[key])}</strong></button>)}
        <small>אם ידוע מרשומות המשפחה — בחרו. אחרת אפשר לשמור בלי תזכורת שנתית.</small>
      </div> : null; })()}
    </>}
    {resolved.date && adarChoiceMatters(resolved.date) && <>
      <p className="nz-question">בשנה מעוברת, מתי האזכרה?</p>
      <Seg label="אדר בשנה מעוברת" value={form.adarRule} onChange={adarRule => set({ adarRule })} options={[['adar1', 'אדר א׳'], ['adar2', 'אדר ב׳'], ['both', 'בשניהם']]} />
      <p className="personal-hint">המנהג חלוק: לרמ״א באדר א׳, למחבר באדר ב׳, ויש הנוהגים בשניהם. ברירת המחדל לפי הנוסח שלך.</p>
    </>}
    <fieldset className="nz-fieldset"><legend>תזכורת</legend>
      <label className="nz-check"><input type="checkbox" checked={form.reminder.enabled} onChange={e => set({ reminder: { ...form.reminder, enabled: e.target.checked } })} /> תזכורת לפני האזכרה</label>
      {form.reminder.enabled && <>
        <Seg label="כמה זמן לפני" value={form.reminder.daysBefore} onChange={daysBefore => set({ reminder: { ...form.reminder, daysBefore } })} options={[[1, 'יום לפני'], [2, 'יומיים לפני'], [3, '3 ימים לפני']]} />
        <label className="personal-field"><span>שעת התזכורת</span><input type="time" value={form.reminder.time} onChange={e => set({ reminder: { ...form.reminder, time: e.target.value || '09:00' } })} /></label>
      </>}
    </fieldset>
    <fieldset className="nz-fieldset"><legend>הצגה במסך הראשי</legend>
      <Seg label="משך ההצגה" value={form.duration} onChange={duration => set({ duration })} options={[[1, 'יום אחד'], [3, '3 ימים']]} />
    </fieldset>
    {message && <p className="notice error" role="alert">{message}</p>}
    <div className="nz-actions"><button type="submit" className="personal-primary">המשך לאישור</button><button type="button" className="ghost" onClick={onCancel}>ביטול</button></div>
  </form>;
}

export default function NerZikaron({ route = '', settings = {} }) {
  const focus = useMemo(() => new Set(String(route).split('/')[2]?.split(',').filter(Boolean) || []), [route]);
  const [memorials, setMemorials] = useState(loadMemorials);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  useEffect(() => { const refresh = () => setMemorials(loadMemorials()); window.addEventListener(MEMORIAL_CHANGE_EVENT, refresh); return () => window.removeEventListener(MEMORIAL_CHANGE_EVENT, refresh); }, []);
  useEffect(() => { if (focus.size) document.querySelector('.nz-row.is-focus')?.scrollIntoView({ block: 'center' }); }, [focus, memorials]);
  const today = todayHDate();
  const sorted = sortByNext(memorials, today);
  const upcoming = sorted.filter(item => item.next && item.inDays <= 120).slice(0, 5);
  // A memorial's reminders by its Hebrew date (תזכורות): the linked ones go with it when it is deleted.
  const [linked, setLinked] = useState(() => loadReminders().events.filter(entry => entry.memorialId));
  useEffect(() => { const refresh = () => setLinked(loadReminders().events.filter(entry => entry.memorialId)); window.addEventListener(REMINDERS_CHANGE_EVENT, refresh); return () => window.removeEventListener(REMINDERS_CHANGE_EVENT, refresh); }, []);
  const reminderOf = id => linked.find(entry => entry.memorialId === id) || null;
  // The reminder by the Hebrew date lives in המזכיר היהודי: its editor opens there.
  const openReminder = record => { const entry = reminderOf(record.id); window.location.hash = entry ? `personal-tools/mazkir/e/${encodeURIComponent(entry.id)}` : `personal-tools/mazkir/new/yahrzeit/${encodeURIComponent(record.id)}`; };
  const remove = async id => { saveMemorials(loadMemorials().filter(item => item.id !== id)); deleteEventsOfMemorial(id); setConfirmDelete(null); await reconcileMemorialReminders(); await syncReminders(settings).catch(() => {}); };
  if (editing) {
    return <section className="personal-tools nz-page"><BackLink label="נר זיכרון" onClick={() => setEditing(null)} /><p className="eyebrow">כלים אישיים · נר זיכרון</p><h1>{editing.id ? 'עריכת אזכרה' : 'הוספת אזכרה'}</h1>
      <MemorialForm initial={editing} nusach={settings.nusach} onCancel={() => setEditing(null)} onSaved={(_, warn) => { setEditing(null); setNotice(warn || 'נר הזיכרון נשמר.'); setMemorials(loadMemorials()); }} />
    </section>;
  }
  return <section className="personal-tools nz-page"><BackLink href="#personal-tools" label="כלים אישיים" /><p className="eyebrow">כלים אישיים · נר זיכרון</p>
    <header className="nz-head"><Candle /><h1>נר זיכרון</h1><TitleOrnament /><p className="intro">זוכרים את יקירינו בכל שנה</p></header>
    <button type="button" className="personal-primary nz-add" onClick={() => setEditing(blank(settings.nusach))}>הוספת אזכרה</button>
    {notice && <p className="notice" role="status">{notice}</p>}
    {upcoming.length > 0 && <section className="nz-upcoming"><h2>האזכרות הקרובות</h2>{upcoming.map(({ record, next, inDays }) => <p key={record.id}><strong>{memorialName(record)}</strong><span>{hebrewDayLabel(next)}</span><small>{inDaysLabel(inDays)}</small></p>)}</section>}
    {!memorials.length && <p className="notice nz-empty">עוד לא נשמרה אזכרה. הפרטים נשמרים במכשיר בלבד.</p>}
    <div className="nz-list">{sorted.map(({ record, next }) => <article key={record.id} className={`nz-row${focus.has(record.id) ? ' is-focus' : ''}`}>
      <div className="nz-row-main">
        <strong>{memorialName(record)}</strong>
        {record.relationship && <small className="nz-rel">{record.relationship}</small>}
        {record.hebrewDeathDate ? <span>{hebrewDayLabel(new HDate(record.hebrewDeathDate.day, record.hebrewDeathDate.month, record.hebrewDeathDate.year))}</span> : <span className="nz-uncertain-line">התאריך העברי תלוי בשעת הפטירה — יש לבחור אותו כדי להפעיל תזכורת</span>}
        {next && <small>האזכרה הקרובה: {civilLabel(next.greg())}</small>}
      </div>
      <div className="nz-row-actions">
        {record.dateConfidence === 'exact' && <button type="button" className="ghost" aria-label={`${reminderOf(record.id) ? 'התזכורת לפי התאריך העברי' : 'הוספת תזכורת לפי התאריך העברי'}: ${memorialName(record)}`} onClick={() => openReminder(record)}>{reminderOf(record.id) ? 'תזכורת' : 'הוספת תזכורת'}</button>}
        <button type="button" className="ghost" aria-label={`עריכה: ${memorialName(record)}`} onClick={() => setEditing({ ...fromRecord(record, settings.nusach), id: record.id, createdAt: record.createdAt })}>עריכה</button>
        {confirmDelete === record.id
          ? <><button type="button" className="ghost nz-danger" onClick={() => remove(record.id)}>למחוק?</button><button type="button" className="ghost" onClick={() => setConfirmDelete(null)}>ביטול</button></>
          : <button type="button" className="ghost" aria-label={`מחיקה: ${memorialName(record)}`} onClick={() => setConfirmDelete(record.id)}>מחיקה</button>}
      </div>
    </article>)}</div>
    <p className="nz-mazkir-link"><a href="#personal-tools/mazkir/d/yahrzeit">תזכורות לאזכרות — במזכיר היהודי</a></p>
    <p className="personal-hint nz-privacy">הפרטים נשמרים במכשיר זה בלבד ואינם נשלחים לשום מקום.</p>
  </section>;
}
