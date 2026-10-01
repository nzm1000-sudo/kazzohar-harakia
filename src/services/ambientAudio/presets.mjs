// AdaptiveAmbientAudio — an optional suggestion of a background sound by the time of day. Only ever a suggestion:
// once the person has chosen a sound themselves (manual), that choice is used, every time, until they change it.
//   morning (05–11) — clean and soft: pink noise, low
//   day     (11–17) — steady: brown noise
//   evening (17–22) — calmer: brown noise, lower
//   night   (22–05) — the quietest: the low tone, very low
// Presented as background sound for focus only — no claim of any effect.

export const PRESETS = Object.freeze({
  morning: { id: 'morning', title: 'בוקר', sound: 'pink', volume: 0.35, pitch: 'mid' },
  day: { id: 'day', title: 'יום', sound: 'brown', volume: 0.45, pitch: 'mid' },
  evening: { id: 'evening', title: 'ערב', sound: 'brown', volume: 0.3, pitch: 'low' },
  night: { id: 'night', title: 'לילה', sound: 'tone', volume: 0.2, pitch: 'low' },
});

const hourOf = (date, tzid) => {
  const at = date instanceof Date ? date : new Date(date);
  if (tzid) {
    try {
      const text = new Intl.DateTimeFormat('en-US', { timeZone: tzid, hour: 'numeric', hourCycle: 'h23' }).format(at);
      const hour = Number(text);
      if (Number.isFinite(hour)) return hour % 24;
    } catch {}
  }
  return at.getHours();
};

export function presetForHour(hour) {
  const h = ((Number(hour) % 24) + 24) % 24;
  if (h >= 5 && h < 11) return PRESETS.morning;
  if (h >= 11 && h < 17) return PRESETS.day;
  if (h >= 17 && h < 22) return PRESETS.evening;
  return PRESETS.night;
}

export function suggestPreset(now = new Date(), tzid = null) {
  return presetForHour(hourOf(now, tzid));
}

// The sound to use: the person's own choice when there is one; otherwise the time's suggestion (marked so the screen
// can say "מוצע לשעה זו"). A manual choice is never replaced by a suggestion.
export function resolveAmbientChoice(saved, now = new Date(), tzid = null) {
  if (saved && saved.manual === true && typeof saved.sound === 'string') {
    return { sound: saved.sound, volume: saved.volume ?? 0.4, pitch: saved.pitch || 'mid', suggested: false, preset: null };
  }
  const preset = suggestPreset(now, tzid);
  return { sound: preset.sound, volume: preset.volume, pitch: preset.pitch, suggested: true, preset: preset.id };
}

// A choice the person made (a tap on a sound, a pitch or the volume) — from now on it is manual.
export function manualChoice(previous, patch) {
  return { sound: 'silence', volume: 0.4, pitch: 'mid', ...(previous || {}), ...patch, manual: true };
}
