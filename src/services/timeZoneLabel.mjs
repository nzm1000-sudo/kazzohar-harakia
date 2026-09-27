// A time zone as people read it ("שעון ישראל"), never the raw IANA id ("Asia/Jerusalem").
export function timeZoneLabel(tzid, { locale = 'he-IL', at = new Date() } = {}) {
  if (!tzid) return '';
  for (const style of ['longGeneric', 'long']) {
    try {
      const part = new Intl.DateTimeFormat(locale, { timeZone: tzid, timeZoneName: style }).formatToParts(at).find(item => item.type === 'timeZoneName');
      if (part?.value && !/^GMT|^UTC/.test(part.value)) return part.value;
    } catch { /* style or zone not supported here */ }
  }
  return String(tzid).split('/').pop().replace(/_/g, ' ');
}
