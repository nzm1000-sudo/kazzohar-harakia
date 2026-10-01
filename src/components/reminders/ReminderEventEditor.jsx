// תזכורות — a Hebrew-date event: a yahrzeit, a Hebrew birthday or a wedding anniversary. The date in Hebrew or in the
// civil calendar (with before / after sunset), the Hebrew date it stands for, the halachic choices where practice
// differs (only when they matter), when to remind, and the coming dates — before saving.
import { useMemo, useState } from 'react';
import { HDate } from '@hebcal/core';
import { BackLink } from '../LocalNavigation.jsx';
import { AlarmSwitch, Segmented } from '../jewishAlarm/AlarmParts.jsx';
import Selector from '../ui/Selector.jsx';
import { alarmContext } from '../../services/jewishAlarm/index.mjs';
import { memorialName } from '../../services/memorialYahrzeit.mjs';
import {
  EVENT_TYPES, FIRST_YEAR_BURIAL_MIN_DAYS, DEFAULT_EVE_TIME, DEFAULT_DAY_TIME, adarChoiceMatters, dateNotes, defaultAdarRule, deleteEvent,
  eventHebrewDate, eventProblem, eventReminders, firstYearStillAhead, hebrewDayLabel, hebrewFullLabel, newEventId, normalizeEvent, daysInMonth,
  syncReminders, upcomingOccurrences, upsertEvent, validHebrewDate, monthsOfYear,
} from '../../services/reminders/index.mjs';

const pad = value => String(value).padStart(2, '0');
const civilValue = civil => (civil ? `${civil.year}-${pad(civil.month)}-${pad(civil.day)}` : '');
const civilLong = date => new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
const dayLetters = day => new HDate(day, 7, 5780).renderGematriya(true).split(' ')[0];

function blankDraft(type, memorialId, nusach) {
  const today = new HDate(new Date());
  const now = new Date();
  return {
    id: newEventId(), type, name: '', enabled: true, memorialId: memorialId || null, inputType: 'hebrew',
    hebrew: { day: today.getDate(), month: today.getMonth(), year: today.getFullYear() - (type === 'yahrzeit' ? 1 : 30) },
    civil: { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() - (type === 'yahrzeit' ? 1 : 30), afterSunset: false },
    adarRule: type === 'yahrzeit' ? defaultAdarRule(nusach) : null, burialDelayDays: 0, firstYear: 'death',
    eve: { enabled: true, time: DEFAULT_EVE_TIME }, day: { enabled: type !== 'yahrzeit', time: DEFAULT_DAY_TIME },
  };
}

export default function ReminderEventEditor({ existing, type, memorialId, memorials = [], settings, now = new Date(), onDone, go }) {
  const isNew = !existing;
  const [draft, setDraft] = useState(() => (existing ? { ...existing, civil: existing.civil || blankDraft(type, null, settings?.nusach).civil } : blankDraft(type, memorialId, settings?.nusach)));
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = patch => { setMessage(''); setDraft(previous => ({ ...previous, ...patch })); };
  const meta = EVENT_TYPES[draft.type] || EVENT_TYPES.birthday;
  const memorial = draft.memorialId ? memorials.find(record => record.id === draft.memorialId) || null : null;
  const eligibleMemorials = memorials.filter(record => record.dateConfidence === 'exact');
  const ctx = useMemo(() => alarmContext(settings), [settings]);
  const date = eventHebrewDate(draft, memorial);
  const today = new HDate(new Date(now));
  const upcoming = useMemo(() => (date ? upcomingOccurrences(draft, today, 3, memorial) : []), [draft, memorial, date?.day, date?.month, date?.year]);
  const planned = useMemo(() => (date ? eventReminders(normalizeEvent({ ...draft, enabled: true }) || draft, ctx, { now: new Date(now), count: 3, memorial }) : []), [draft, memorial, ctx]);
  const notes = date ? dateNotes(draft, memorial) : [];
  const months = monthsOfYear(Number(draft.hebrew?.year) || today.getFullYear());
  const maxDay = validHebrewDate({ ...draft.hebrew, day: 1 }) ? daysInMonth(draft.hebrew.month, draft.hebrew.year) : 30;
  const showAdar = draft.type === 'yahrzeit' && !memorial && date && adarChoiceMatters(date);
  const showFirstYear = draft.type === 'yahrzeit' && date && firstYearStillAhead(draft, today, memorial);
  const longBurial = Number(draft.burialDelayDays) >= FIRST_YEAR_BURIAL_MIN_DAYS;

  const save = async () => {
    const problem = eventProblem(draft, memorial);
    if (problem) { setMessage(problem); return; }
    const snapshot = memorial ? { name: memorialName(memorial), inputType: 'hebrew', hebrew: { ...memorial.hebrewDeathDate } } : {};
    const clean = normalizeEvent({ ...draft, ...snapshot, adarRule: draft.type === 'yahrzeit' && !memorial && date && adarChoiceMatters(date) ? draft.adarRule : null });
    if (!clean) { setMessage('לא ניתן לשמור את התזכורת.'); return; }
    setBusy(true);
    upsertEvent(clean);
    await syncReminders(settings, { ask: true }).catch(() => {});
    setBusy(false);
    onDone();
  };
  const remove = async () => { deleteEvent(draft.id); setConfirmDelete(false); await syncReminders(settings).catch(() => {}); onDone(); };

  const heading = isNew ? meta.newTitle : (memorial ? memorialName(memorial) : draft.name || meta.title);
  return <section className="personal-tools jewish-alarm rm-editor" aria-labelledby="rm-editor-title">
    <BackLink label="תזכורות" onClick={() => history.back()} />
    <header className="ja-editor-head rm-editor-head">
      <h1 id="rm-editor-title">{heading}</h1>
      {!isNew && <p className="rm-editor-kind">{meta.title}</p>}
    </header>

    {draft.type === 'yahrzeit' && isNew && eligibleMemorials.length > 0 && <section className="ja-step-block">
      <Selector className="ja-name" label="מתוך נר זיכרון" value={draft.memorialId || ''} onChange={id => set({ memorialId: id || null })}
        options={[['', 'שם אחר (לא מנר זיכרון)'], ...eligibleMemorials.map(record => [record.id, memorialName(record)])]} />
    </section>}

    {memorial ? <section className="ja-step-block rm-linked" aria-label="מנר זיכרון">
      <p className="ja-label">מנר זיכרון</p>
      <div className="rm-linked-card">
        <strong>{memorialName(memorial)}</strong>
        <span>{hebrewFullLabel(memorial.hebrewDeathDate)}</span>
        <small>התאריך ומנהג אדר נקבעים בנר זיכרון.</small>
        <button type="button" className="ja-link" onClick={() => go(`personal-tools/memorial/${encodeURIComponent(memorial.id)}`)}>פתיחה בנר זיכרון</button>
      </div>
    </section> : <>
      <section className="ja-step-block">
        <label className="ja-name"><span>{meta.nameLabel}</span>
          <input value={draft.name} maxLength={80} autoComplete="off" onChange={event => set({ name: event.currentTarget.value })} />
        </label>
      </section>

      <section className="ja-step-block" aria-labelledby="rm-date-label">
        <p className="ja-label" id="rm-date-label">{draft.type === 'yahrzeit' ? 'תאריך הפטירה' : draft.type === 'anniversary' ? 'תאריך החתונה' : 'תאריך הלידה'}</p>
        <Segmented label="סוג התאריך" value={draft.inputType} onChange={inputType => set({ inputType })} options={[['hebrew', 'תאריך עברי'], ['civil', 'תאריך לועזי']]} />
        {draft.inputType === 'hebrew'
          ? <div className="rm-date-fields">
            <Selector className="ja-name" label="יום" columns={6} value={draft.hebrew.day} onChange={day => set({ hebrew: { ...draft.hebrew, day: Number(day) } })} options={Array.from({ length: maxDay }, (_, index) => index + 1).map(day => [day, dayLetters(day)])} />
            <Selector className="ja-name" label="חודש" value={draft.hebrew.month} onChange={month => set({ hebrew: { ...draft.hebrew, month: Number(month) } })} options={months} />
            <label className="ja-name"><span>שנה</span><input type="number" inputMode="numeric" dir="ltr" min="5600" max="6000" value={draft.hebrew.year} onChange={event => set({ hebrew: { ...draft.hebrew, year: Number(event.currentTarget.value) } })} /></label>
          </div>
          : <div className="rm-civil">
            <label className="ja-name"><span>התאריך הלועזי</span><input type="date" dir="ltr" value={civilValue(draft.civil)} onChange={event => { const [year, month, day] = event.currentTarget.value.split('-').map(Number); if (year && month && day) set({ civil: { ...draft.civil, year, month, day } }); }} /></label>
            <p className="ja-question">{draft.type === 'yahrzeit' ? 'הפטירה הייתה' : draft.type === 'anniversary' ? 'החתונה הייתה' : 'הלידה הייתה'}</p>
            <Segmented label="ביחס לשקיעה" value={draft.civil.afterSunset ? 'after' : 'before'} onChange={value => set({ civil: { ...draft.civil, afterSunset: value === 'after' } })} options={[['before', 'לפני השקיעה'], ['after', 'אחרי השקיעה']]} />
            <p className="rm-hint">היום העברי מתחיל בשקיעה: אחרי השקיעה — כבר התאריך העברי של מחר.</p>
          </div>}
        <p className="rm-resolved" role="status">{date ? <>התאריך העברי: <strong>{hebrewFullLabel(date)}</strong></> : 'התאריך אינו קיים — בחרו תאריך אחר.'}</p>
      </section>
    </>}

    {showAdar && <section className="ja-step-block" aria-labelledby="rm-adar-label">
      <p className="ja-label" id="rm-adar-label">בשנה מעוברת</p>
      <Segmented label="אזכרה באדר בשנה מעוברת" value={draft.adarRule || defaultAdarRule(settings?.nusach)} onChange={adarRule => set({ adarRule })} options={[['adar2', 'אדר ב׳', 'מרן'], ['adar1', 'אדר א׳', 'רמ״א'], ['both', 'בשניהם']]} />
    </section>}
    {notes.length > 0 && <div className="rm-notes">{notes.map(note => <p key={note.id}>{note.text}</p>)}</div>}

    {showFirstYear && <section className="ja-step-block" aria-labelledby="rm-first-label">
      <p className="ja-label" id="rm-first-label">האזכרה הראשונה</p>
      <p className="ja-question">הקבורה הייתה</p>
      <Segmented label="מתי הייתה הקבורה" value={longBurial ? 'long' : 'short'} onChange={value => set(value === 'long' ? { burialDelayDays: Math.max(FIRST_YEAR_BURIAL_MIN_DAYS, Number(draft.burialDelayDays) || 0) } : { burialDelayDays: 0, firstYear: 'death' })} options={[['short', 'ביום הפטירה', 'או למחרת'], ['long', '3 ימים ומעלה', 'אחרי הפטירה']]} />
      {longBurial && <>
        <div className="rm-stepper" role="group" aria-label="כמה ימים אחרי הפטירה">
          <button type="button" className="ja-step" aria-label="יום אחד פחות" disabled={draft.burialDelayDays <= FIRST_YEAR_BURIAL_MIN_DAYS} onClick={() => set({ burialDelayDays: Math.max(FIRST_YEAR_BURIAL_MIN_DAYS, draft.burialDelayDays - 1) })}><span dir="ltr">−</span></button>
          <p aria-live="polite"><strong>{draft.burialDelayDays}</strong> ימים אחרי הפטירה</p>
          <button type="button" className="ja-step" aria-label="יום אחד יותר" disabled={draft.burialDelayDays >= 60} onClick={() => set({ burialDelayDays: Math.min(60, draft.burialDelayDays + 1) })}><span dir="ltr">+</span></button>
        </div>
        <Segmented label="האזכרה הראשונה לפי" value={draft.firstYear} onChange={firstYear => set({ firstYear })} options={[['death', 'יום הפטירה', 'מרן והש״ך'], ['burial', 'יום הקבורה', 'יש נוהגים']]} />
      </>}
      <p className="rm-hint">האזכרה ביום הפטירה, גם בשנה הראשונה (שו״ע או״ח תקסח, ח; ש״ך יו״ד תב, ט; ילקוט יוסף אבלות מ, ד). יש מקהילות אשכנז הנוהגים בשנה הראשונה ביום הקבורה כשהיא הייתה שלושה ימים ומעלה אחרי הפטירה; משנה שנייה — תמיד ביום הפטירה.</p>
    </section>}

    <section className="ja-step-block" aria-labelledby="rm-when-label">
      <p className="ja-label" id="rm-when-label">מתי להזכיר</p>
      <div className="rm-when-rows">
        <TimeRow label="בערב שלפני" note={draft.type === 'yahrzeit' ? 'לפני השקיעה שבה מתחילה האזכרה' : 'ביום שלפני'} value={draft.eve} onChange={eve => set({ eve })} />
        <TimeRow label="ביום עצמו" note="ביום העברי, בשעה שתבחרו" value={draft.day} onChange={day => set({ day })} />
      </div>
    </section>

    {upcoming.length > 0 && <section className="ja-preview rm-preview" aria-labelledby="rm-coming-label">
      <p className="ja-label rm-preview-title" id="rm-coming-label">המועדים הבאים</p>
      <ul>{upcoming.map(item => {
        const moved = planned.find(entry => entry.hd.abs() === item.hd.abs() && entry.moved);
        return <li key={item.hd.abs()}>
          <strong>{hebrewDayLabel(item.hd)}</strong>
          <span>{civilLong(item.hd.greg())}</span>
          {moved && <small>התזכורת תוקדם לפני {moved.moved}</small>}
        </li>;
      })}</ul>
    </section>}

    {draft.type === 'yahrzeit' && <div className="rm-links">
      {!memorial && <button type="button" className="ja-link" onClick={() => go('personal-tools/memorial')}>נר זיכרון</button>}
      <button type="button" className="ja-link" onClick={() => go('books')}>לימוד משניות לעילוי נשמה</button>
    </div>}

    {message && <p className="notice error" role="alert">{message}</p>}
    <div className="ja-actions">
      <button type="button" className="ja-button is-primary" disabled={busy} onClick={save}>{isNew ? 'שמירת התזכורת' : 'שמירת השינויים'}</button>
      {!isNew && (confirmDelete
        ? <div className="ja-sheet-actions"><button type="button" className="ja-button" onClick={() => setConfirmDelete(false)}>ביטול</button><button type="button" className="ja-button is-danger" onClick={remove}>למחוק?</button></div>
        : <button type="button" className="ja-button is-danger" onClick={() => setConfirmDelete(true)}>מחיקת התזכורת</button>)}
      <button type="button" className="ja-button" onClick={onDone}>ביטול</button>
    </div>
  </section>;
}

function TimeRow({ label, note, value, onChange }) {
  const on = Boolean(value?.enabled);
  return <div className={`rm-time-row${on ? ' is-on' : ''}`}>
    <div className="ja-row">
      <span><strong>{label}</strong><small>{note}</small></span>
      <AlarmSwitch checked={on} onChange={enabled => onChange({ ...value, enabled })} label={`${label} — ${on ? 'פעיל' : 'כבוי'}`} />
    </div>
    {on && <label className="ja-time-field rm-time"><span className="visually-hidden">{`${label}: השעה`}</span>
      <input type="time" dir="ltr" value={value.time} onChange={event => { if (event.currentTarget.value) onChange({ ...value, time: event.currentTarget.value }); }} />
    </label>}
  </div>;
}
