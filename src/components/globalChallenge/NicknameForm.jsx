import { useId, useState } from 'react';
import { checkNickname, NICKNAME_MESSAGES, NICK_MAX } from '../../services/globalChallenge/nickname.mjs';
import { setPrefs } from '../../services/globalChallenge/store.mjs';
import { challengeApi, ensureDevice, updateGlobal } from './useGlobalChallenge.js';

// The nickname, chosen once, and with it the board's opt-in. Checked here as it is typed (the same rules as the server,
// services/globalChallenge/nickname.mjs); the server decides (and keeps it unique).
export default function NicknameForm({ onDone, submitLabel = 'הצטרפות לטבלה', idPrefix = 'gc-nick' }) {
  const [value, setValue] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const noteId = `${idPrefix}-note`;
  const check = checkNickname(value);
  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    if (!check.ok) { setMessage(NICKNAME_MESSAGES[check.reason]); return; }
    setBusy(true);
    setMessage('');
    const { device } = ensureDevice();
    const res = await challengeApi().nickname({ device, nickname: check.nickname, board: true });
    setBusy(false);
    if (res.ok) {
      updateGlobal(s => setPrefs(s, { nickname: res.data?.nickname || check.nickname, board: Boolean(res.data?.board) }));
      onDone?.(res.data);
      return;
    }
    if (res.offline) { setMessage('אין חיבור כרגע — אפשר לנסות שוב כשתתחבר'); return; }
    setMessage(NICKNAME_MESSAGES[res.data?.reason] || NICKNAME_MESSAGES[res.error] || 'לא ניתן היה לשמור את הכינוי');
  };
  return <form className="gc-nick" onSubmit={submit} noValidate>
    <label className="gc-nick-label" htmlFor={inputId}>כינוי לטבלה</label>
    <input id={inputId} className="gc-nick-input" type="text" inputMode="text" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="done"
      maxLength={NICK_MAX + 4} value={value} onChange={event => { setValue(event.target.value); setMessage(''); }} aria-describedby={noteId} aria-invalid={Boolean(message) || undefined} />
    <p className="gc-nick-note" id={noteId} role="status" aria-live="polite">{message || 'שתיים עד עשרים אותיות, ספרות ורווחים · נבחר פעם אחת · בלי שם אמיתי'}</p>
    <button type="submit" className="gc-button" disabled={busy || !value.trim()}>{busy ? 'שומר…' : submitLabel}</button>
  </form>;
}
