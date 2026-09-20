import { useEffect, useState } from 'react';
import { timeLabel } from '../services.mjs';
import {
  NOTIFICATION_CATEGORIES, addCustomTask, addGuest, addHouseholdMember, addMenuItem, addShoppingItem,
  assignTask, clearPurchased, isTaskComplete, loadPreparation, markPermissionRequested, moveCustomTask,
  removeCustomTask, removeGuest, removeHouseholdMember, removeMenuItem, removeShoppingItem, restoreDefaults,
  savePreparation, setDefaultTaskDisabled, setNotificationCategory, setNotificationsEnabled, setQuietMode,
  setTaskCompletion, toggleShoppingItem,
} from '../services/preparationStorage.mjs';
import { activePreparation, remainingCount, visibleTasks } from '../services/preparationPlan.mjs';
import { buildNotifications } from '../services/notificationEngine.mjs';
import { applySchedule, cancelAllScheduled, requestNotificationPermission, sendTestNotification } from '../services/notifications.mjs';

const MENU_SECTIONS = [
  ['friday-night', 'ליל שבת / ערב חג'],
  ['day', 'שבת בבוקר / יום חג'],
  ['third-meal', 'סעודה שלישית'],
  ['extras', 'קינוחים ותוספות'],
];

const MEALS = ['ליל שבת', 'שבת בבוקר', 'סעודה שלישית', 'סעודת חג'];

export function usePreparation() {
  const [state, setState] = useState(() => loadPreparation());
  const update = updater => setState(current => savePreparation(typeof updater === 'function' ? updater(current) : updater));
  return [state, update];
}

function BackLink({ to = 'preparation', label = 'חזרה להכנה' }) {
  return <a className="link back-link" href={`#${to}`}>← {label}</a>;
}

function Field({ label, value, onChange, ...props }) {
  return <label className="personal-field"><span>{label}</span>
    <input value={value} onChange={event => onChange(event.currentTarget.value)} {...props} />
  </label>;
}

export default function PreparationHub({ route = 'preparation', now, settings, items, onNav }) {
  const [state, update] = usePreparation();
  const tz = settings?.location?.tzid || 'UTC';
  const plan = activePreparation({ now, tz, items });
  const section = route.split('/')[1] || 'home';
  const shared = { state, update, plan, tz, now, items, onNav };
  if (section === 'tasks') return <TasksPage {...shared} />;
  if (section === 'shopping') return <ShoppingPage {...shared} />;
  if (section === 'guests') return <GuestsPage {...shared} />;
  if (section === 'menu') return <MenuPage {...shared} />;
  if (section === 'reminders') return <RemindersPage {...shared} />;
  return <HubHome {...shared} />;
}

function HubHome({ state, plan, tz }) {
  const remaining = plan.eventKey ? remainingCount(plan, state) : 0;
  const rows = [
    ['preparation/tasks', 'משימות הכנה', `${remaining} משימות פתוחות`],
    ['preparation/shopping', 'רשימת קניות', `${(state.shopping || []).filter(item => !item.purchased).length} פריטים לקנות`],
    ['preparation/guests', 'אורחים', `${(state.guests || []).length} אורחים ברשימה`],
    ['preparation/menu', 'תפריט', `${Object.values(state.menu || {}).flat().length} מנות`],
    ['preparation/reminders', 'תזכורות', state.notifications.enabled ? 'פעילות' : 'כבויות'],
  ];
  return <section className="preparation">
    <p className="eyebrow">הכנה לשבת ולחג</p>
    <h1>{plan.kind === 'none' ? 'הכנה לשבת ולחג' : `הכנה ל${plan.name}`}</h1>
    {plan.kind === 'none'
      ? <p className="intro">אין כרגע אירוע בטווח ההכנה. הרשימות נשמרות וממתינות.</p>
      : <p className="intro">{plan.windowLabel} · {plan.daysUntil === 0 ? 'היום' : `בעוד ${plan.daysUntil} ימים`}</p>}
    {plan.candles && <p className="prep-time">הדלקת נרות · <strong>{timeLabel(plan.candles, tz)}</strong></p>}
    {plan.havdalah && <p className="prep-time">צאת החג/השבת · <strong>{timeLabel(plan.havdalah, tz)}</strong></p>}
    <div className="personal-tool-list">
      {rows.map(([route, title, description]) => <a className="personal-tool-row" href={`#${route}`} key={route}>
        <span><strong>{title}</strong><small>{description}</small></span><span aria-hidden="true">←</span>
      </a>)}
    </div>
    <div className="prep-links">
      <a className="link" href="#shabbat-page">דף שבת</a>
      <a className="link" href="#shabbat-table">שולחן שבת</a>
      <a className="link" href="#forgotten-addition">שכחתי תוספת</a>
    </div>
  </section>;
}

function TasksPage({ state, update, plan }) {
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [memberName, setMemberName] = useState('');
  if (plan.kind === 'none') {
    return <section className="preparation"><BackLink /><h1>משימות הכנה</h1><p className="intro">אין כרגע אירוע פעיל בטווח ההכנה.</p></section>;
  }
  const tasks = visibleTasks(plan, state);
  const add = event => {
    event.preventDefault();
    if (!title.trim()) return;
    update(current => addCustomTask(current, { title, assignee: assignee || null, scope: plan.templateId }));
    setTitle(''); setAssignee('');
  };
  return <section className="preparation">
    <BackLink />
    <p className="eyebrow">הכנה · {plan.name}</p>
    <h1>משימות הכנה</h1>
    <p className="intro">{plan.windowLabel}</p>
    <ul className="prep-task-list">
      {tasks.map(item => {
        const done = isTaskComplete(state, plan.eventKey, item.id);
        const member = (state.household || []).find(entry => entry.id === item.assignee);
        return <li key={item.id} className={`prep-task${done ? ' done' : ''}`}>
          <label className="prep-task-main">
            <input type="checkbox" checked={done} onChange={() => update(current => setTaskCompletion(current, plan.eventKey, item.id, !done))} />
            <span className="prep-task-title">{item.title}</span>
            <span className="prep-task-state">{done ? '✓ הושלם' : 'פתוח'}</span>
          </label>
          {member && <span className="prep-task-assignee">{member.name}</span>}
          {item.custom
            ? <span className="prep-task-actions">
              <select aria-label={`שיוך ${item.title}`} value={item.assignee || ''} onChange={event => update(current => assignTask(current, item.id, event.currentTarget.value))}>
                <option value="">ללא שיוך</option>
                {(state.household || []).map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
              </select>
              <button type="button" className="ghost" aria-label={`העלה ${item.title}`} onClick={() => update(current => moveCustomTask(current, item.id, -1))}>↑</button>
              <button type="button" className="ghost" aria-label={`הורד ${item.title}`} onClick={() => update(current => moveCustomTask(current, item.id, 1))}>↓</button>
              <button type="button" className="ghost" onClick={() => update(current => removeCustomTask(current, item.id))}>מחיקה</button>
            </span>
            : <button type="button" className="ghost" onClick={() => update(current => setDefaultTaskDisabled(current, item.id, true))}>הסתרה</button>}
        </li>;
      })}
    </ul>
    <form className="personal-form" onSubmit={add}>
      <Field label="משימה חדשה" value={title} onChange={setTitle} />
      <label className="personal-field"><span>שיוך</span>
        <select value={assignee} onChange={event => setAssignee(event.currentTarget.value)}>
          <option value="">ללא שיוך</option>
          {(state.household || []).map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
      </label>
      <button className="personal-primary" type="submit" disabled={!title.trim()}>הוספת משימה</button>
    </form>
    <button type="button" className="ghost" onClick={() => update(restoreDefaults)}>החזרת משימות ברירת מחדל</button>
    <section className="prep-household">
      <h2>בני הבית</h2>
      <ul className="prep-inline-list">
        {(state.household || []).map(member => <li key={member.id}>{member.name}
          <button type="button" className="ghost" aria-label={`מחיקת ${member.name}`} onClick={() => update(current => removeHouseholdMember(current, member.id))}>×</button>
        </li>)}
      </ul>
      <form className="personal-form" onSubmit={event => { event.preventDefault(); update(current => addHouseholdMember(current, memberName)); setMemberName(''); }}>
        <Field label="הוספת בן/בת בית" value={memberName} onChange={setMemberName} />
        <button className="personal-primary" type="submit" disabled={!memberName.trim()}>הוספה</button>
      </form>
      <p className="personal-hint">השמות נשמרים במכשיר בלבד ואינם נשלחים לשום שירות.</p>
    </section>
  </section>;
}

function ShoppingPage({ state, update, plan }) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const suggestions = (plan.tasks || []).filter(task => task.category === 'food' || task.category === 'core');
  return <section className="preparation">
    <BackLink />
    <p className="eyebrow">הכנה · קניות</p>
    <h1>רשימת קניות</h1>
    <ul className="prep-task-list">
      {(state.shopping || []).map(item => <li key={item.id} className={`prep-task${item.purchased ? ' done' : ''}`}>
        <label className="prep-task-main">
          <input type="checkbox" checked={item.purchased} onChange={() => update(current => toggleShoppingItem(current, item.id))} />
          <span className="prep-task-title">{item.name}{item.note ? ` · ${item.note}` : ''}</span>
          <span className="prep-task-state">{item.purchased ? '✓ נקנה' : 'לקנות'}</span>
        </label>
        <button type="button" className="ghost" onClick={() => update(current => removeShoppingItem(current, item.id))}>מחיקה</button>
      </li>)}
    </ul>
    <form className="personal-form" onSubmit={event => { event.preventDefault(); update(current => addShoppingItem(current, { name, note })); setName(''); setNote(''); }}>
      <Field label="פריט" value={name} onChange={setName} />
      <Field label="כמות או הערה" value={note} onChange={setNote} />
      <button className="personal-primary" type="submit" disabled={!name.trim()}>הוספה לרשימה</button>
    </form>
    {suggestions.length > 0 && <section className="prep-suggestions">
      <h2>הצעות מתבנית {plan.name}</h2>
      <p className="personal-hint">ההצעות נוספות רק בלחיצה.</p>
      <div className="prep-chip-row">
        {suggestions.map(task => <button type="button" className="ghost" key={task.id} onClick={() => update(current => addShoppingItem(current, { name: task.title }))}>+ {task.title}</button>)}
      </div>
    </section>}
    <button type="button" className="ghost" onClick={() => update(clearPurchased)}>ניקוי פריטים שנקנו</button>
  </section>;
}

function GuestsPage({ state, update }) {
  const [name, setName] = useState('');
  const [meal, setMeal] = useState(MEALS[0]);
  const [note, setNote] = useState('');
  return <section className="preparation">
    <BackLink />
    <p className="eyebrow">הכנה · אורחים</p>
    <h1>אורחים</h1>
    <ul className="prep-task-list">
      {(state.guests || []).map(guest => <li key={guest.id} className="prep-task">
        <span className="prep-task-main"><span className="prep-task-title">{guest.name}</span><span className="prep-task-state">{guest.meal}</span></span>
        {guest.note && <span className="prep-task-assignee">{guest.note}</span>}
        <button type="button" className="ghost" onClick={() => update(current => removeGuest(current, guest.id))}>מחיקה</button>
      </li>)}
    </ul>
    <form className="personal-form" onSubmit={event => { event.preventDefault(); update(current => addGuest(current, { name, meal, note })); setName(''); setNote(''); }}>
      <Field label="שם" value={name} onChange={setName} />
      <label className="personal-field"><span>סעודה</span>
        <select value={meal} onChange={event => setMeal(event.currentTarget.value)}>{MEALS.map(option => <option key={option}>{option}</option>)}</select>
      </label>
      <Field label="הערה" value={note} onChange={setNote} />
      <button className="personal-primary" type="submit" disabled={!name.trim()}>הוספת אורח</button>
    </form>
    <p className="personal-hint">הרשימה מקומית בלבד. האפליקציה אינה ניגשת לאנשי הקשר.</p>
  </section>;
}

function MenuPage({ state, update }) {
  const [drafts, setDrafts] = useState({});
  return <section className="preparation">
    <BackLink />
    <p className="eyebrow">הכנה · תפריט</p>
    <h1>תפריט</h1>
    {MENU_SECTIONS.map(([id, label]) => <section className="prep-menu-section" key={id}>
      <h2>{label}</h2>
      <ul className="prep-inline-list">
        {(state.menu?.[id] || []).map((item, index) => <li key={`${id}-${index}`}>{item}
          <button type="button" className="ghost" aria-label={`מחיקת ${item}`} onClick={() => update(current => removeMenuItem(current, id, index))}>×</button>
        </li>)}
      </ul>
      <form className="personal-form" onSubmit={event => { event.preventDefault(); update(current => addMenuItem(current, id, drafts[id])); setDrafts(previous => ({ ...previous, [id]: '' })); }}>
        <Field label={`הוספה ל${label}`} value={drafts[id] || ''} onChange={value => setDrafts(previous => ({ ...previous, [id]: value }))} />
        <button className="personal-primary" type="submit" disabled={!(drafts[id] || '').trim()}>הוספה</button>
      </form>
    </section>)}
  </section>;
}

function RemindersPage({ state, update, plan, tz, now, items }) {
  const [status, setStatus] = useState('');
  const remaining = plan.eventKey ? remainingCount(plan, state) : 0;
  const planned = buildNotifications({ now, tz, plan, items, state, remaining });

  useEffect(() => {
    if (!state.notifications.enabled) return;
    let active = true;
    applySchedule(state.scheduled || {}, planned).then(result => {
      if (active && result.applied) update(current => ({ ...current, scheduled: result.scheduled }));
    });
    return () => { active = false; };
    // Rescheduling is keyed on the computed plan, so location and calendar changes refresh it.
  }, [state.notifications.enabled, state.notifications.quietMode, JSON.stringify(planned)]);

  const enable = async () => {
    const permission = await requestNotificationPermission();
    update(current => markPermissionRequested(current));
    if (permission === 'granted') {
      update(current => setNotificationsEnabled(current, true));
      setStatus('התזכורות הופעלו');
    } else {
      setStatus(permission === 'unsupported' ? 'התראות נייטיביות אינן זמינות בדפדפן' : 'ההרשאה נדחתה');
    }
  };

  const disable = async () => {
    await cancelAllScheduled(state.scheduled || {});
    update(current => ({ ...setNotificationsEnabled(current, false), scheduled: {} }));
    setStatus('התזכורות כובו');
  };

  return <section className="preparation">
    <BackLink />
    <p className="eyebrow">הכנה · תזכורות</p>
    <h1>תזכורות חכמות</h1>
    <p className="intro">הרשאת ההתראות מתבקשת רק כאן, ורק בהפעלה יזומה.</p>
    {state.notifications.enabled
      ? <button type="button" className="ghost" onClick={disable}>כיבוי כל התזכורות</button>
      : <button type="button" className="personal-primary" onClick={enable}>הפעלת תזכורות</button>}
    {status && <p role="status" className="notice">{status}</p>}
    <label className="prep-toggle">
      <input type="checkbox" checked={state.notifications.quietMode} onChange={event => update(current => setQuietMode(current, event.currentTarget.checked))} />
      <span>מצב שקט · השהיית כל התזכורות</span>
    </label>
    <h2>קטגוריות</h2>
    <ul className="prep-inline-list prep-category-list">
      {NOTIFICATION_CATEGORIES.map(category => <li key={category.id}>
        <label className="prep-toggle">
          <input type="checkbox" checked={state.notifications.categories[category.id] === true}
            onChange={event => update(current => setNotificationCategory(current, category.id, event.currentTarget.checked))} />
          <span><strong>{category.label}</strong><small>{category.description}</small></span>
        </label>
      </li>)}
    </ul>
    <h2>מתוזמן כעת</h2>
    {planned.length === 0
      ? <p className="personal-hint">אין תזכורות מתוזמנות. תזכורות אינן נשלחות משכניסת שבת או חג ועד צאתם.</p>
      : <ul className="prep-inline-list">{planned.map(item => <li key={item.key}><strong>{item.title}</strong><small>{timeLabel(item.at, tz)} · {item.body}</small></li>)}</ul>}
    {state.notifications.enabled && <button type="button" className="ghost" onClick={async () => setStatus(await sendTestNotification() ? 'נשלחה תזכורת בדיקה' : 'לא ניתן לשלוח תזכורת בדפדפן')}>שליחת תזכורת בדיקה</button>}
    <p className="personal-hint">האפליקציה משתיקה רק את ההתראות שלה. היא אינה משנה את הגדרות המכשיר.</p>
  </section>;
}
