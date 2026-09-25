import { HDate, flags } from '@hebcal/core';
import { shiftCivilDate } from '../../civilDate.mjs';
import { calendarIsIsrael, civilKeyAsLocalDate } from '../calendarAccuracy.mjs';
import { JewishContextEngine } from '../jewishContextEngine.mjs';

const PUBLIC_FASTS = new Set(['Tzom Gedaliah', "Asara B'Tevet", "Ta'anit Esther", 'Tzom Tammuz', "Tish'a B'Av", 'Yom Kippur']);

// The instant at local noon of a civil date in a zone, so every zone resolves the same date.
function localNoon(dateKey, tzid) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const guess = Date.UTC(year, month - 1, day, 12);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tzid, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(guess)).map(part => [part.type, part.value]));
  const shown = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return new Date(guess - (shown - guess));
}

const hebrewParts = dateKey => {
  const hdate = new HDate(civilKeyAsLocalDate(dateKey));
  return { hdate, day: hdate.getDate(), month: hdate.getMonth(), year: hdate.getFullYear(), weekday: hdate.getDay(), leapYear: hdate.isLeapYear() };
};

// Calendar facts for the date the prayer belongs to. Adapter over the existing engine,
// asked explicitly for Mincha instead of its Shacharit default; every event is kept.
export function buildCalendarContext({ prayerDate, tzid = 'Asia/Jerusalem', settings = {} }) {
  const isIsrael = calendarIsIsrael(settings);
  const engine = JewishContextEngine({
    now: localNoon(prayerDate, tzid),
    settings: { ...settings, location: { ...(settings.location || {}), tzid } },
    times: {},
    prayerType: 'mincha',
  });
  const today = hebrewParts(prayerDate);
  const tomorrowKey = shiftCivilDate(prayerDate, 1);
  const tomorrow = hebrewParts(tomorrowKey);
  const tomorrowEngine = JewishContextEngine({ now: localNoon(tomorrowKey, tzid), settings: { ...settings, location: { ...(settings.location || {}), tzid } }, times: {}, prayerType: 'mincha' });
  const events = (engine.holidays || []).map(event => ({ desc: event.getDesc(), flags: Number(event.getFlags?.() || 0), hebrew: event.render?.('he') || event.getDesc() }));
  return {
    date: prayerDate,
    isIsrael,
    weekday: today.weekday,
    hebrew: { day: today.day, month: today.month, year: today.year, leapYear: today.leapYear, label: engine.hebrewDate?.label || null },
    tomorrow: { day: tomorrow.day, month: tomorrow.month, chanukah: Boolean(tomorrowEngine.chanukah) },
    events,
    facts: {
      shabbat: today.weekday === 6,
      roshChodesh: Boolean(engine.isRoshChodesh),
      yomTov: Boolean(engine.isYomTov),
      cholHamoed: Boolean(engine.isCholHaMoed),
      aseret: Boolean(engine.isAseretYemeiTeshuvah),
      chanukah: Boolean(engine.chanukah),
      purim: Boolean(engine.purim),
      publicFast: events.some(event => PUBLIC_FASTS.has(event.desc)),
      tishaBeAv: events.some(event => event.desc === "Tish'a B'Av"),
      modernObservances: events.filter(event => event.flags & flags.MODERN_HOLIDAY).map(event => event.desc),
    },
    seasonal: { ...engine.seasonal },
  };
}
