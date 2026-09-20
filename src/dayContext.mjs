import { civilDateKey, jewishDateKey } from './civilDate.mjs';
import { ZMANIM, onDate } from './services.mjs';
import { JewishContextEngine } from './services/jewishContextEngine.mjs';

// Intl uses the maintained ICU Hebrew calendar; a civil noon labels a cell,
// never the current Jewish day (which requires a verified sunset).
export function hebrewDate(key) {
  if (!key) return null;
  const date = new Date(key + 'T12:00:00Z');
  const parts = new Intl.DateTimeFormat('en-u-ca-hebrew', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(date);
  const value = type => parts.find(p => p.type === type)?.value;
  return { day: Number(value('day')), month: value('month'), year: Number(value('year')),
    label: new Intl.DateTimeFormat('he-u-ca-hebrew', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(date) };
}
export function dayContext(now, settings, times, items = []) {
  const civil = civilDateKey(now, settings.location.tzid);
  const key = jewishDateKey(now, times?.sunset, settings.location.tzid);
  const date = hebrewDate(key);
  const events = key ? onDate(items, key).filter(e => e.category !== 'hebdate') : [];
  const civilEvents = onDate(items, civil);
  const weekday = key ? new Date(key + 'T12:00:00Z').getUTCDay() : null;
  const timed = civilEvents.filter(e => ['candles', 'havdalah'].includes(e.category))
    .map(e => ({ key: e.category, name: e.category === 'candles' ? 'הדלקת נרות' : 'צאת שבת / חג', at: e.date }));
  const timeline = [...ZMANIM.filter(([k]) => k !== 'tzeit72min' || settings.showRT).map(([key, name, method]) => ({key, name, method, at: times?.[key]})), ...timed]
    .filter(e => e.at && Number.isFinite(new Date(e.at).getTime())).sort((a,b) => new Date(a.at)-new Date(b.at));
  const next = timeline.find(e => new Date(e.at) > now) || null;
  const engine = JewishContextEngine({ now, settings, times, items });
  const isRoshChodesh = engine.isRoshChodesh;
  const fast = events.find(e => e.subcat === 'fast' && !/^Erev /.test(e.title));
  const omer = events.find(e => e.category === 'omer');
  const additions = engine.additions.map(addition => ({ ...addition, ref: addition.rule.source }));
  if (fast) additions.push({text:'יום תענית · עיינו בדיני עננו לפי התפילה והמנהג', ref:'Shulchan Arukh, Orach Chayim 565'});
  return { ...engine, civil, key, date, weekday, events, civilEvents, timeline, next, isRoshChodesh, fast, omer, additions,
    afterSunset: Boolean(key && key !== civil), shabbat: weekday === 6,
    parasha: items.find(e => e.category === 'parashat' && e.date.slice(0,10) >= (key || civil)),
    upcomingHoliday: items.find(e => e.category === 'holiday' && e.subcat === 'major' && e.date.slice(0,10) > (key || civil)) };
}
