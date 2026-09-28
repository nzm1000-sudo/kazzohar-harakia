// "אפשר להתפלל עכשיו?" — time-aware prayer questions. The clock comes from the app's own zmanim (the same times
// dayContext shows on the Today screen); the rulings come only from verified entries. This module compares the two:
// it says which verified window "now" falls in, shows the relevant times, and never states a ruling of its own.
import { PRACTICAL_HALACHA_QA_INDEX } from '../data/practicalHalachaQa.mjs';
import { normalizeQuery } from './halachaSearch.mjs';

export const PRAYERS = {
  shacharit: { label: 'שחרית', words: ['שחרית', 'תפילת בוקר', 'בבוקר'] },
  mincha: { label: 'מנחה', words: ['מנחה'] },
  arvit: { label: 'ערבית', words: ['ערבית', 'מעריב'] },
  shema: { label: 'קריאת שמע', words: ['שמע', 'קריאת שמע', 'קש'] },
  tefillin: { label: 'תפילין', words: ['תפילין', 'להניח תפילין'] },
};

const TIME_WORDS = /(?:^|\s)(עכשיו|עדיין|כבר|עוד|מאוחר|הספקתי|עד מתי|זמן|השעה)(?:\s|$)/;
const PRAY_WORDS = /(?:^|\s)(להתפלל|תפילה|התפללתי|מתפללים|שחרית|מנחה|ערבית|מעריב|שמע|תפילין|להניח)(?:\s|$)/;

// Is this a question about whether a prayer fits the time now? Returns { prayer|null } or null.
export function detectPrayerTimeQuestion(query) {
  const text = normalizeQuery(query);
  if (!text || !PRAY_WORDS.test(text) || !TIME_WORDS.test(text)) return null;
  return { prayer: prayerNamed(text) };
}

export function prayerNamed(query) {
  const text = ` ${normalizeQuery(query)} `;
  for (const [key, prayer] of Object.entries(PRAYERS)) if (prayer.words.some(word => text.includes(` ${normalizeQuery(word)} `) || text.includes(` ב${normalizeQuery(word)} `) || text.includes(` ו${normalizeQuery(word)} `))) return key;
  return null;
}

// The zmanim the app already computed for the current Jewish day (dayContext.timeline), as { key: Date }.
export function timesFromContext(context = {}) {
  const times = {};
  for (const item of context.timeline || []) if (item?.key && item.at && !times[item.key]) times[item.key] = new Date(item.at);
  return times;
}

const hhmm = date => date ? new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date) : null;
const entries = ids => ids.map(id => PRACTICAL_HALACHA_QA_INDEX[id]).filter(Boolean);
const MIN = 60000;

// Which verified window "now" is in, for one prayer. status: 'open' | 'limited' | 'closed' | 'not-yet' | 'unknown'.
export function prayerTimeStatus(prayer, now = new Date(), times = {}) {
  const t = key => times[key] instanceof Date && Number.isFinite(times[key].getTime()) ? times[key] : null;
  const at = now.getTime();
  const row = (key, label) => t(key) ? { key, label, time: hhmm(t(key)) } : null;
  const result = (status, summary, ids, rows) => ({ prayer, label: PRAYERS[prayer].label, status, summary, entries: entries(ids), times: rows.filter(Boolean), now: hhmm(now) });
  const need = keys => keys.every(key => t(key));
  if (prayer === 'shacharit') {
    if (!need(['sunrise', 'sofZmanTfilla', 'chatzot'])) return result('unknown', 'אין כרגע זמני היום לחישוב.', ['hal-prayer-shacharit-deadline'], []);
    const rows = [row('sunrise', 'הנץ החמה'), row('sofZmanTfilla', 'סוף זמן תפילה'), row('chatzot', 'חצות היום')];
    if (at < t('sunrise').getTime()) return result('not-yet', 'עוד לפני הנץ החמה.', ['hal-prayer-shacharit-deadline'], rows);
    if (at <= t('sofZmanTfilla').getTime()) return result('open', 'עכשיו בתוך זמן תפילת שחרית.', ['hal-prayer-shacharit-deadline'], rows);
    if (at <= t('chatzot').getTime()) return result('limited', 'עבר סוף זמן תפילה, ועדיין לפני חצות היום.', ['hal-prayer-shacharit-until-midday', 'hal-prayer-shacharit-deadline'], rows);
    return result('closed', 'עבר חצות היום.', ['hal-prayer-tashlumin-missed-shacharit'], rows);
  }
  if (prayer === 'shema') {
    if (!need(['sofZmanShma', 'sofZmanTfilla'])) return result('unknown', 'אין כרגע זמני היום לחישוב.', ['hal-prayer-shema-morning-deadline'], []);
    const rows = [row('sofZmanShmaMGA', 'סוף זמן שמע · מגן אברהם'), row('sofZmanShma', 'סוף זמן שמע · גר״א'), row('sofZmanTfilla', 'סוף השעה הרביעית')];
    if ((t('sunset') && at > t('sunset').getTime()) || now.getHours() < 4) return result('open', 'עכשיו לילה – זה זמן קריאת שמע של ערבית.', ['hal-prayer-arvit-shema-midnight'], [row('chatzotNight', 'חצות הלילה')]);
    if (t('sofZmanShmaMGA') && at <= t('sofZmanShmaMGA').getTime()) return result('open', 'עכשיו בתוך זמן קריאת שמע, גם לשיטת המגן אברהם.', ['hal-prayer-shema-morning-deadline'], rows);
    if (at <= t('sofZmanShma').getTime()) return result('open', 'עכשיו בתוך זמן קריאת שמע לשיטת הגר״א; זמן המגן אברהם כבר עבר.', ['hal-prayer-shema-morning-deadline'], rows);
    if (at <= t('sofZmanTfilla').getTime()) return result('limited', 'עבר סוף זמן קריאת שמע, ועדיין בשעה הרביעית.', ['hal-prayer-shema-after-deadline'], rows);
    return result('limited', 'עברה השעה הרביעית.', ['hal-prayer-shema-after-deadline'], rows);
  }
  if (prayer === 'mincha') {
    if (!need(['minchaGedola', 'sunset'])) return result('unknown', 'אין כרגע זמני היום לחישוב.', ['hal-prayer-mincha-after-tzeit'], []);
    const rows = [row('minchaGedola', 'מנחה גדולה'), row('sunset', 'שקיעת החמה')];
    if (at < t('minchaGedola').getTime()) return result('not-yet', 'עוד לפני מנחה גדולה.', [], rows);
    if (at <= t('sunset').getTime()) return result('open', 'עכשיו בזמן מנחה, לפני השקיעה.', ['hal-prayer-mincha-minyan-after-sunset'], rows);
    const afterSunset = (at - t('sunset').getTime()) / MIN;
    if (afterSunset <= 13.5) return result('limited', `עברה השקיעה לפני ${Math.max(1, Math.round(afterSunset))} דקות.`, ['hal-prayer-mincha-minyan-after-sunset', 'hal-prayer-mincha-after-tzeit'], rows);
    return result('closed', 'עבר זמן צאת הכוכבים.', ['hal-prayer-mincha-after-tzeit'], rows);
  }
  if (prayer === 'arvit') {
    if (!need(['plagHaMincha', 'sunset'])) return result('unknown', 'אין כרגע זמני היום לחישוב.', ['hal-prayer-arvit-before-sunset'], []);
    const rows = [row('plagHaMincha', 'פלג המנחה'), row('tzeit85deg', 'צאת הכוכבים'), row('chatzotNight', 'חצות הלילה')];
    if (now.getHours() < 12 && t('alotHaShachar') && at < t('alotHaShachar').getTime()) return result('open', 'עכשיו בלילה, לפני עלות השחר.', ['hal-prayer-arvit-shema-midnight'], [row('alotHaShachar', 'עלות השחר')]);
    if (at < t('plagHaMincha').getTime()) return result('not-yet', 'עוד לפני פלג המנחה.', ['hal-prayer-arvit-before-sunset'], rows);
    const tzeit = t('tzeit85deg') || new Date(t('sunset').getTime() + 18 * MIN);
    if (at < tzeit.getTime()) return result('limited', 'אחרי פלג המנחה ולפני צאת הכוכבים.', ['hal-prayer-arvit-before-sunset'], rows);
    return result('open', 'עכשיו אחרי צאת הכוכבים.', ['hal-prayer-arvit-shema-midnight'], rows);
  }
  if (prayer === 'tefillin') {
    if (!need(['sunset'])) return result('unknown', 'אין כרגע זמני היום לחישוב.', ['qa-tefillin-until-when'], []);
    const rows = [row('misheyakir', 'משיכיר · טלית ותפילין'), row('sunset', 'שקיעת החמה')];
    if (t('misheyakir') && at < t('misheyakir').getTime() && now.getHours() < 12) return result('not-yet', 'עוד לפני זמן משיכיר.', ['hal-prayer-tallit-earliest-time'], rows);
    if (at <= t('sunset').getTime()) return result('open', 'עכשיו לפני השקיעה.', ['qa-tefillin-until-when'], rows);
    const afterSunset = (at - t('sunset').getTime()) / MIN;
    if (afterSunset <= 13.5) return result('limited', `עברה השקיעה לפני ${Math.max(1, Math.round(afterSunset))} דקות – בין השמשות.`, ['hal-prayer-tefillin-sunset-deadline'], rows);
    return result('closed', 'עבר בין השמשות.', ['qa-tefillin-until-when'], rows);
  }
  return null;
}
