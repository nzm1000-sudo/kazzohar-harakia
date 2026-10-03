import { useState } from 'react';
import { AlarmSwitch } from '../jewishAlarm/AlarmParts.jsx';
import { setPrefs, forgetServer } from '../../services/globalChallenge/store.mjs';
import { useGlobalChallenge, challengeApi, ensureDevice } from './useGlobalChallenge.js';
import NicknameForm from './NicknameForm.jsx';

// הגדרות › האתגר העולמי: the participation (on by default), the board (off by default — turning it on asks for a
// nickname), the nickname (chosen, and changed at any time — up to five times a day; the server keeps it unique), and
// the erasure of this device's rows on the server. Every row is a
// data-setting target of the settings search (services/settingsSearch.mjs).
export default function ChallengeSettings() {
  const [state, update] = useGlobalChallenge();
  const client = challengeApi();
  const { participate, board, nickname } = state.prefs;
  const [asking, setAsking] = useState(false);
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const setBoard = async on => {
    setNote('');
    if (on && !nickname) { setAsking(true); return; }
    if (!client.enabled) return;
    setBusy(true);
    const { device } = ensureDevice();
    const res = await client.nickname({ device, board: on });
    setBusy(false);
    if (res.ok) update(s => setPrefs(s, { board: Boolean(res.data?.board) }));
    else setNote(res.offline ? 'אין חיבור כרגע — אפשר לנסות שוב כשתתחבר' : 'לא ניתן היה לשנות כרגע');
  };
  const erase = async () => {
    setNote('');
    if (!state.device) { update(forgetServer); setConfirmDelete(false); setNote('אין נתונים של המכשיר הזה בשרת'); return; }
    setBusy(true);
    const res = await client.deleteMe({ device: state.device });
    setBusy(false);
    setConfirmDelete(false);
    if (res.ok) { update(forgetServer); setNote('הנתונים שלך נמחקו מהשרת. התוצאות שלך נשארו במכשיר בלבד.'); }
    else setNote(res.offline ? 'אין חיבור כרגע — המחיקה לא בוצעה. אפשר לנסות שוב כשתתחבר' : 'המחיקה לא הצליחה, אפשר לנסות שוב');
  };
  return <>
    <div className="settings-rows">
      <div className={`settings-row${participate ? ' is-on' : ''}`} data-setting="challenge-participate">
        <div className="settings-row-text gc-set-text"><strong>השתתפות באתגר העולמי</strong><small>חמש שאלות בכל יום חול, לכל הלומדים. כבוי — בלי קשר לשרת</small></div>
        <AlarmSwitch checked={participate} onChange={on => update(s => setPrefs(s, { participate: on }))} label={`השתתפות באתגר העולמי — ${participate ? 'פעילה' : 'כבויה'}`} />
      </div>
      <div className={`settings-row${board ? ' is-on' : ''}`} data-setting="challenge-board">
        <div className="settings-row-text gc-set-text"><strong>הופעה בטבלת השיאים</strong><small>{client.enabled ? 'בחירה נפרדת. בטבלה מופיע רק הכינוי' : 'תיפתח כשהשרת של האתגר יהיה פעיל'}</small></div>
        <AlarmSwitch checked={board} onChange={on => (client.enabled && participate && !busy ? setBoard(on) : null)} label={`הופעה בטבלת השיאים — ${board ? 'פעילה' : 'כבויה'}`} />
      </div>
      <div className="settings-row gc-set-nick" data-setting="challenge-nickname">
        <div className="settings-row-text gc-set-text"><strong>הכינוי</strong><small>{nickname ? <bdi>{nickname}</bdi> : 'עדיין לא נבחר'}</small></div>
        {client.enabled && participate && !asking && !changing ? <button type="button" className="gc-button gc-button-small" aria-label={nickname ? `שינוי הכינוי ${nickname}` : 'בחירת כינוי'} onClick={() => { setNote(''); if (nickname) setChanging(true); else setAsking(true); }}>{nickname ? 'שינוי' : 'בחירה'}</button> : null}
      </div>
      {asking && !nickname && client.enabled ? <div className="gc-set-form"><NicknameForm idPrefix="gc-set-nick" onDone={() => setAsking(false)} onCancel={() => setAsking(false)} /></div> : null}
      {changing && nickname && client.enabled ? <div className="gc-set-form"><NicknameForm mode="change" current={nickname} idPrefix="gc-set-nick" onDone={() => { setChanging(false); setNote('הכינוי עודכן — גם בטבלת השיאים'); }} onCancel={() => setChanging(false)} /></div> : null}
    </div>
    <div className="gc-set-delete" data-setting="challenge-delete">
      {confirmDelete ? <div className="gc-set-confirm" role="group" aria-label="מחיקת הנתונים שלי מהשרת">
        <p>למחוק מהשרת את התוצאות, הנקודות והכינוי של המכשיר הזה?</p>
        <div className="gc-set-confirm-actions">
          <button type="button" className="gc-button gc-button-danger" disabled={busy} onClick={erase}>{busy ? 'מוחק…' : 'כן, למחוק'}</button>
          <button type="button" className="gc-button gc-button-quiet" onClick={() => setConfirmDelete(false)}>ביטול</button>
        </div>
      </div> : <button type="button" className="index-row gc-set-delete-btn" disabled={!client.enabled} onClick={() => { setNote(''); setConfirmDelete(true); }}><span>מחיקת הנתונים שלי מהשרת</span></button>}
      <p className="zman-note" role="status">{note || (client.enabled ? 'נשמרים בשרת רק מזהה אקראי של המכשיר, התוצאות והכינוי — בלי שם, מייל או מיקום.' : 'השרת של האתגר עדיין לא פעיל: התוצאות נשמרות במכשיר זה בלבד.')}</p>
    </div>
  </>;
}
