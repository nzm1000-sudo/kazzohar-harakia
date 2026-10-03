// האתגר העולמי — the device's state shared by every screen that shows it (the cards on Today and in the quiz, the game,
// the board, the settings): one store (services/globalChallenge/store.mjs), one change event, and the quiet network
// work — the results waiting for a connection are sent when the app is online again, the day's numbers are fetched at
// most once a minute.
import { useCallback, useEffect, useState } from 'react';
import { readGlobalState, writeGlobalState, withDevice, rememberStats, pendingDays } from '../../services/globalChallenge/store.mjs';
import { createChallengeApi, flushPending } from '../../services/globalChallenge/api.mjs';

export const CHANGE_EVENT = 'kz-global-challenge';
let api = null;
export const challengeApi = () => (api ||= createChallengeApi());
// Tests and the QA mock replace the client.
export function setChallengeApi(next) { api = next; }

export function saveGlobal(next) {
  writeGlobalState(next);
  try { globalThis.dispatchEvent?.(new CustomEvent(CHANGE_EVENT)); } catch { /* no window (tests) */ }
  return next;
}
// Applies a change to the stored state (read fresh, so two screens never overwrite each other).
export const updateGlobal = fn => saveGlobal(fn(readGlobalState()));

export function useGlobalChallenge() {
  const [state, setState] = useState(() => readGlobalState());
  useEffect(() => {
    const sync = () => setState(readGlobalState());
    globalThis.addEventListener?.(CHANGE_EVENT, sync);
    globalThis.addEventListener?.('storage', sync);
    return () => { globalThis.removeEventListener?.(CHANGE_EVENT, sync); globalThis.removeEventListener?.('storage', sync); };
  }, []);
  const update = useCallback(fn => setState(saveGlobal(fn(readGlobalState()))), []);
  return [state, update];
}

let flushing = null;
// Sends what waits (once at a time). Resolves to the state after it.
export function flushNow() {
  const client = challengeApi();
  const current = readGlobalState();
  if (!client.enabled || !current.prefs.participate || !current.device || !pendingDays(current).length) return Promise.resolve(current);
  flushing ||= flushPending(current, client).then(next => {
    // merge: only the days and the stats it touched (the player may have changed a setting meanwhile)
    const latest = readGlobalState();
    return saveGlobal({ ...latest, days: { ...latest.days, ...Object.fromEntries(Object.entries(next.days).filter(([k]) => current.days[k]?.status === 'pending')) }, stats: { ...latest.stats, ...next.stats } });
  }).finally(() => { flushing = null; });
  return flushing;
}

const fetchedAt = new Map();
// The day's global numbers, fetched when stale (a minute), remembered for offline. Resolves to them or null.
export async function refreshDay(date, { force = false } = {}) {
  const client = challengeApi();
  const current = readGlobalState();
  if (!client.enabled || !current.prefs.participate) return null;
  const last = fetchedAt.get(date) || 0;
  if (!force && Date.now() - last < 60000) return current.stats[date] || null;
  fetchedAt.set(date, Date.now());
  const res = await client.day(date);
  if (!res.ok) return current.stats[date] || null;
  updateGlobal(s => rememberStats(s, date, res.data));
  return res.data;
}

// While a screen that shows the challenge is open: send what waits now and whenever the device comes back online.
export function useChallengeSync(enabled = true) {
  useEffect(() => {
    if (!enabled || !challengeApi().enabled) return undefined;
    flushNow();
    const online = () => flushNow();
    globalThis.addEventListener?.('online', online);
    return () => globalThis.removeEventListener?.('online', online);
  }, [enabled]);
}

// The device id, made on first need (only when the server is contacted).
export function ensureDevice() {
  const current = readGlobalState();
  if (current.device) return current;
  return saveGlobal(withDevice(current));
}
