// The person's last choices on the התבודדות screen (this device only), and whether the Focus explainer was seen.
import { clampMinutes, PRESET_MINUTES } from './timer.mjs';
import { isSound } from '../ambientAudio/noise.mjs';
import { clampChapter, clampSpeed, DEFAULT_WHEEL_SPEED, normalizeOrder } from './tehillimFlow.mjs';

export const PREFS_KEY = 'kz-hitbodedut-prefs-v1';
export const FOCUS_SEEN_KEY = 'kz-hitbodedut-focus-seen-v1';

export const DEFAULT_PREFS = Object.freeze({
  minutes: 15,          // 15 | 30 | 60 | 'custom'
  customMinutes: 20,
  ambient: null,        // { sound, volume, pitch, manual: true } once the person chose; null → the time's suggestion
  display: 'timer',     // 'timer' | 'tehillim'
  startChapter: 1,
  tehillimOrder: 'sequential',   // 'sequential' | 'random'
  tehillimSpeed: DEFAULT_WHEEL_SPEED,
  screenOn: true,
  dim: true,
  chime: true,
});

export function normalizePrefs(input) {
  const value = input && typeof input === 'object' ? input : {};
  const minutes = PRESET_MINUTES.includes(value.minutes) || value.minutes === 'custom' ? value.minutes : DEFAULT_PREFS.minutes;
  const ambient = value.ambient && value.ambient.manual === true && isSound(value.ambient.sound)
    ? { sound: value.ambient.sound, volume: Math.min(1, Math.max(0, Number(value.ambient.volume ?? 0.4))), pitch: ['low', 'mid', 'high'].includes(value.ambient.pitch) ? value.ambient.pitch : 'mid', manual: true }
    : null;
  return {
    minutes,
    customMinutes: clampMinutes(value.customMinutes, DEFAULT_PREFS.customMinutes),
    ambient,
    display: value.display === 'tehillim' ? 'tehillim' : 'timer',
    startChapter: clampChapter(value.startChapter),
    tehillimOrder: normalizeOrder(value.tehillimOrder),
    tehillimSpeed: clampSpeed(value.tehillimSpeed ?? DEFAULT_WHEEL_SPEED),
    screenOn: value.screenOn !== false,
    dim: value.dim !== false,
    chime: value.chime !== false,
  };
}

export function loadPrefs(storage = globalThis.localStorage) {
  try { return normalizePrefs(JSON.parse(storage?.getItem(PREFS_KEY) || 'null')); } catch { return normalizePrefs(null); }
}
export function savePrefs(prefs, storage = globalThis.localStorage) {
  const value = normalizePrefs(prefs);
  try { storage?.setItem(PREFS_KEY, JSON.stringify(value)); } catch {}
  return value;
}
export const sessionMinutes = prefs => (prefs.minutes === 'custom' ? clampMinutes(prefs.customMinutes) : prefs.minutes);

export function focusSeen(storage = globalThis.localStorage) { try { return storage?.getItem(FOCUS_SEEN_KEY) === '1'; } catch { return false; } }
export function markFocusSeen(storage = globalThis.localStorage) { try { storage?.setItem(FOCUS_SEEN_KEY, '1'); } catch {} }
