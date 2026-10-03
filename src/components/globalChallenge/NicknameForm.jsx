import { useId, useState } from 'react';
import { checkNickname, NICKNAME_MESSAGES, NICK_MAX, NICK_CHANGES_PER_DAY } from '../../services/globalChallenge/nickname.mjs';
import { setPrefs } from '../../services/globalChallenge/store.mjs';
import { challengeApi, ensureDevice, updateGlobal } from './useGlobalChallenge.js';

// The nickname: chosen with the board's opt-in (mode "join"), or changed at any time from the settings (mode "change" —
// the board's choice stays as it is). Checked here as it is typed (the same rules as the server,
// services/globalChallenge/nickname.mjs); the server decides: unique (case and niqqud ignored), and at most
// NICK_CHANGES_PER_DAY writes a day.
export default function NicknameForm({ onDone, onCancel = null, mode = 'join', current = '', submitLabel = mode === 'change' ? 'שמירת הכינוי' : 'הצטרפות לטבלה', idPrefix = 'gc-nick' }) {
  const [value, setValue] = useState(current || '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const noteId = `${idPrefix}-note`;
  const check = checkNickname(value);
  const unchanged = mode === 'change' && check.ok && check.nickname === current;
  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    if (!check.ok) { setMessage(NICKNAME_MESSAGES[check.reason]); return; }
    if (unchanged) { setMessage(NICKNAME_MESSAGES.same); return; }
    setBusy(true);
    setMessage('');
    const { device } = ensureDevice();
    const res = await challengeApi().nickname(mode === 'change' ? { device, nickname: check.nickname } : { device, nickname: check.nickname, board: true });
    setBusy(false);
    if (res.ok) {
      updateGlobal(s => setPrefs(s, { nickname: res.data?.nickname || check.nickname, board: Boolean(res.data?.board) }));
      onDone?.(res.data);
      return;
    }
    if (res.offline) { setMessage('אין חיבור כרגע — אפשר לנסות שוב כשתתחבר'); return; }
    setMessage(NICKNAME_MESSAGES[res.data?.reason] || NICKNAME_MESSAGES[res.error] || 'לא ניתן היה לשמור את הכינוי');
  };
  const hint = mode === 'change'
    ? `אותיות, ספרות ורווחים · עד ${NICK_CHANGES_PER_DAY} שינויים ביום`
    : 'שתיים עד עשרים אותיות, ספרות ורווחים · אפשר לשנות בהגדרות · בלי שם אמיתי';
  return <form className={`gc-nick${mode === 'change' ? ' gc-nick-change' : ''}`} onSubmit={submit} noValidate>
    <label className="gc-nick-label" htmlFor={inputId}>{mode === 'change' ? 'כינוי חדש' : 'כינוי לטבלה'}</label>
    <input id={inputId} className="gc-nick-input" type="text" inputMode="text" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="done"
      maxLength={NICK_MAX + 4} value={value} onChange={event => { setValue(event.target.value); setMessage(''); }} aria-describedby={noteId} aria-invalid={Boolean(message) || undefined} />
    <p className="gc-nick-note" id={noteId} role="status" aria-live="polite">{message || hint}</p>
    <div className="gc-nick-actions">
      <button type="submit" className="gc-button" disabled={busy || !value.trim() || unchanged}>{busy ? 'שומר…' : submitLabel}</button>
      {onCancel ? <button type="button" className="gc-button gc-button-quiet" disabled={busy} onClick={onCancel}>ביטול</button> : null}
    </div>
  </form>;
}
