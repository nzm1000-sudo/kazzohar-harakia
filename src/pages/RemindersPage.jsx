// תזכורות — beside השעון היהודי: quiet reminders (notifications, not alarms) that follow the Jewish day and the Hebrew
// calendar. Never on Shabbat or Yom Tov. Everything stays on this device. Routes:
//   #jewish-alarm/reminders (המזכיר היהודי's hub) · #jewish-alarm/reminders/new/<yahrzeit|birthday|anniversary>[/<memorialId>]
//   #jewish-alarm/reminders/e/<id>
import { useEffect, useState } from 'react';
import ReminderEventEditor from '../components/reminders/ReminderEventEditor.jsx';
import MazkirPage from './MazkirPage.jsx';
import { loadMemorials, MEMORIAL_CHANGE_EVENT } from '../services/memorialStore.mjs';
import { EVENT_TYPES, REMINDERS_CHANGE_EVENT, loadReminders } from '../services/reminders/index.mjs';

export function useReminders() {
  const [state, setState] = useState(loadReminders);
  useEffect(() => { const update = () => setState(loadReminders()); window.addEventListener(REMINDERS_CHANGE_EVENT, update); return () => window.removeEventListener(REMINDERS_CHANGE_EVENT, update); }, []);
  return state;
}
export function useMemorials() {
  const [memorials, setMemorials] = useState(loadMemorials);
  useEffect(() => { const update = () => setMemorials(loadMemorials()); window.addEventListener(MEMORIAL_CHANGE_EVENT, update); return () => window.removeEventListener(MEMORIAL_CHANGE_EVENT, update); }, []);
  return memorials;
}

export function BellIcon({ size = 30, strokeWidth = 1.3 }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5z" /><path d="M10 20.5a2 2 0 0 0 4 0" /><path d="M12 3v2" />
  </svg>;
}

export default function RemindersPage({ route = 'jewish-alarm/reminders', settings, now = new Date(), go }) {
  const parts = route.split('/');
  const state = useReminders();
  const memorials = useMemorials();
  if (parts[2] === 'new' || parts[2] === 'e') {
    const decode = value => { try { return decodeURIComponent(value || ''); } catch { return ''; } };
    const existing = parts[2] === 'e' ? state.events.find(entry => entry.id === decode(parts[3])) || null : null;
    const type = existing?.type || (EVENT_TYPES[parts[3]] ? parts[3] : 'birthday');
    const memorialId = existing ? existing.memorialId : (type === 'yahrzeit' ? decode(parts[4]) || null : null);
    return <ReminderEventEditor key={route} existing={existing} type={type} memorialId={memorialId} memorials={memorials} settings={settings} now={now} onDone={() => history.back()} go={go} />;
  }
  // All the reminders are gathered in המזכיר היהודי (pages/MazkirPage.jsx); from the Jewish alarm it opens the same hub.
  return <MazkirPage route="personal-tools/mazkir" settings={settings} backLabel="השעון היהודי" backHref="#jewish-alarm" />;
}
