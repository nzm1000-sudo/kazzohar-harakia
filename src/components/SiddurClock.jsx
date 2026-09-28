import { useEffect, useState } from 'react';

// The hour where the user is (the location's own time zone), in the Siddur header beside the rite and the compass.
export default function SiddurClock({ location }) {
  const tz = location?.tzid || undefined;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    // Aligned to the minute, so the digits change when the minute does.
    const first = setTimeout(() => { tick(); interval = setInterval(tick, 60000); }, 60000 - (Date.now() % 60000) + 50);
    let interval = null;
    return () => { clearTimeout(first); if (interval) clearInterval(interval); };
  }, []);
  let time = '';
  try { time = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(now); } catch { time = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now); }
  const place = location?.name ? String(location.name).split(',')[0].trim() : '';
  return <div className="siddur-tool siddur-clock" role="timer" aria-live="off" aria-label={`השעה עכשיו${place ? ` ב${place}` : ''}: ${time}`}>
    <span className="siddur-tool-label">{place ? `השעה ב${place}` : 'השעה עכשיו'}</span>
    <strong dir="ltr">{time}</strong>
  </div>;
}
