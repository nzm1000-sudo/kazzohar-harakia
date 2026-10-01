// "שליחה למאגר" — sending a chidush to the app's moderated collection.
//
// SharedChidushimRepository is the seam: { kind, submit(chidush, { nameChoice, name }), list(), status(chidushId) }.
// Today's implementation composes an email to the app's public contact address (services/contact.mjs) with the
// formatted text; the user sends it from their own mail app, and the owner moderates by hand. Nothing is sent by the
// app itself, and nothing is sent without the user's explicit tap. A real backend can replace this module's
// implementation later (same three methods, same outbox) with no change to the screens.
//
// Outbox: localStorage 'kz-leatzmi-outbox-v1' = { v: 1, entries: [{ id, chidushId, createdAt, nameChoice, subject, body,
//          state ('queued' | 'handed-off'), attempts, handedOffAt }] } — every submission is recorded locally first,
// then handed to the mail app; an entry that could not be handed off stays 'queued' and can be retried.
import { mailtoHref } from '../contact.mjs';
import { chidushPlainText, markSubmitted } from './chidushim.mjs';
import { defaultStorage, emit, newId, readJSON, toIso, writeJSON } from './storage.mjs';

export const OUTBOX_KEY = 'kz-leatzmi-outbox-v1';
export const SUBMIT_PREFS_KEY = 'kz-leatzmi-submit-prefs-v1';
export const OUTBOX_EVENT = 'kz-leatzmi-outbox-change';
export const SUBMISSION_SUBJECT = 'חידוש למאגר כזוהר הרקיע';
export const NAME_CHOICES = Object.freeze([['full', 'שם מלא'], ['first', 'שם פרטי'], ['anonymous', 'אנונימי']]);
// Mail apps accept a long link, but not an unlimited one: a very long chidush is cut in the email and the screen
// offers to copy the full text.
export const MAX_MAIL_BODY = 6000;

export function attributionLine(nameChoice, name) {
  const clean = String(name || '').trim().slice(0, 80);
  if (nameChoice === 'anonymous' || !clean) return 'נכתב על ידי: בעילום שם';
  if (nameChoice === 'first') return `נכתב על ידי: ${clean.split(/\s+/)[0]}`;
  return `נכתב על ידי: ${clean}`;
}

export function formatSubmission(chidush, { nameChoice = 'anonymous', name = '' } = {}) {
  const text = chidushPlainText(chidush, { attribution: attributionLine(nameChoice, name) });
  const intro = 'חידוש תורה שנשלח מתוך האפליקציה "כזוהר הרקיע", לשיקול צוות המאגר.';
  const full = `${intro}\n\n${text}`;
  const truncated = full.length > MAX_MAIL_BODY;
  const body = truncated ? `${full.slice(0, MAX_MAIL_BODY)}…\n\n(הטקסט קוצר בהודעה זו; המלא יצורף בנפרד)` : full;
  return { subject: SUBMISSION_SUBJECT, body, full, truncated };
}

export function readOutbox(storage = defaultStorage()) {
  const raw = readJSON(storage, OUTBOX_KEY, null);
  const entries = Array.isArray(raw) ? raw : Array.isArray(raw?.entries) ? raw.entries : [];
  return entries.filter(entry => entry && entry.id && entry.chidushId);
}
function writeOutbox(entries, storage) { writeJSON(storage, OUTBOX_KEY, { v: 1, entries }); emit(OUTBOX_EVENT); return entries; }

export function readSubmitPrefs(storage = defaultStorage()) {
  const prefs = readJSON(storage, SUBMIT_PREFS_KEY, {});
  return { nameChoice: NAME_CHOICES.some(([id]) => id === prefs?.nameChoice) ? prefs.nameChoice : 'anonymous', name: typeof prefs?.name === 'string' ? prefs.name : '' };
}
export const saveSubmitPrefs = (prefs, storage = defaultStorage()) => writeJSON(storage, SUBMIT_PREFS_KEY, { nameChoice: prefs.nameChoice, name: String(prefs.name || '').slice(0, 80) });

/** The mailto implementation. `open(href)` hands the composed email to the mail app (injected for tests). */
export function createMailtoRepository({ storage = defaultStorage(), now = () => Date.now(), open = href => { globalThis.location.href = href; } } = {}) {
  const hrefOf = entry => mailtoHref({ subject: entry.subject, body: entry.body });
  function handOff(entry) {
    try { open(hrefOf(entry)); } catch { return { ...entry, attempts: (entry.attempts || 0) + 1 }; }
    return { ...entry, state: 'handed-off', attempts: (entry.attempts || 0) + 1, handedOffAt: toIso(now()) };
  }
  return {
    kind: 'mailto',
    submit(chidush, { nameChoice = 'anonymous', name = '' } = {}) {
      if (!chidush?.id) return { ok: false, reason: 'missing' };
      if (!String(chidush.body || '').trim() && !String(chidush.title || '').trim()) return { ok: false, reason: 'empty' };
      const formatted = formatSubmission(chidush, { nameChoice, name });
      const queued = { id: newId('out'), chidushId: chidush.id, createdAt: toIso(now()), nameChoice, subject: formatted.subject, body: formatted.body, state: 'queued', attempts: 0, handedOffAt: null };
      writeOutbox([...readOutbox(storage), queued], storage);
      const sent = handOff(queued);
      writeOutbox(readOutbox(storage).map(entry => (entry.id === queued.id ? sent : entry)), storage);
      if (sent.state === 'handed-off') markSubmitted(chidush.id, { storage, now: now() });
      return { ok: sent.state === 'handed-off', entry: sent, href: hrefOf(sent), truncated: formatted.truncated, full: formatted.full };
    },
    retry(entryId) {
      const entry = readOutbox(storage).find(item => item.id === entryId);
      if (!entry) return { ok: false, reason: 'missing' };
      const sent = handOff(entry);
      writeOutbox(readOutbox(storage).map(item => (item.id === entryId ? sent : item)), storage);
      if (sent.state === 'handed-off') markSubmitted(entry.chidushId, { storage, now: now() });
      return { ok: sent.state === 'handed-off', entry: sent };
    },
    list() { return readOutbox(storage); },
    status(chidushId) {
      const entries = readOutbox(storage).filter(entry => entry.chidushId === chidushId);
      if (!entries.length) return 'none';
      return entries.some(entry => entry.state === 'handed-off') ? 'handed-off' : 'queued';
    },
  };
}

// The repository the screens use. Replace this one line when a real backend exists.
export const sharedChidushimRepository = (options = {}) => createMailtoRepository(options);
