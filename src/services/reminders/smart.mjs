// תזכורות חכמות — four quiet reminders that follow the Jewish day: ספירת העומר at nightfall, סוף זמן קריאת שמע,
// הדלקת נרות and מנחה before sunset. Pure: the times come from the Jewish alarm's engine (services/jewishAlarm/engine.mjs
// → computeZmanim, @hebcal/core's candle lighting / havdalah / Omer with the app's own settings) — never a second
// zmanim calculator. A reminder never sounds on Shabbat or Yom Tov (restWindowAt: from candle lighting to havdalah).
import { anchorOn, restWindowAt, MINUTE } from '../jewishAlarm/engine.mjs';
import { timeText, minutesText } from '../jewishAlarm/format.mjs';
// המזכיר היהודי's further kinds (Chanukah, bedtime Shema, Tikkun Chatzot…) live in their own module and share the state.
import { isMazkirKind, mazkirOn, normalizeMazkir, defaultMazkir } from './mazkir.mjs';

export const SHMA_OPINIONS = Object.freeze({
  mga: Object.freeze({ id: 'mga', anchor: 'sofZmanShmaMGA', label: 'מגן אברהם', short: 'מג״א' }),
  gra: Object.freeze({ id: 'gra', anchor: 'sofZmanShma', label: 'הגר״א', short: 'גר״א' }),
});

// Each kind: its options (minutes), its default, the screen a tap opens (deep link) and its words.
export const SMART_KINDS = Object.freeze({
  omer: Object.freeze({ id: 'omer', title: 'ספירת העומר', description: 'בלילות הספירה, בצאת הכוכבים, עם המספר של הלילה', options: [0, 15, 30, 60], field: 'offsetMinutes', fallback: 0, route: 'prayer/omer', optionLabel: m => (m === 0 ? 'בצאת' : `+${m}`) }),
  shma: Object.freeze({ id: 'shma', title: 'סוף זמן קריאת שמע', description: 'לפני סוף הזמן, לפי השיטה שתבחרו', options: [15, 30, 45, 60], field: 'minutesBefore', fallback: 30, route: 'prayer/shacharit', optionLabel: m => String(m) }),
  candles: Object.freeze({ id: 'candles', title: 'הדלקת נרות', description: 'לפני הדלקת הנרות של שבת וחג, לפי המיקום', options: [15, 30, 60, 120], field: 'minutesBefore', fallback: 30, route: 'prayer/candles', optionLabel: m => String(m) }),
  mincha: Object.freeze({ id: 'mincha', title: 'מנחה לפני השקיעה', description: 'כדי להספיק להתפלל מנחה לפני השקיעה', options: [15, 30, 45, 60], field: 'minutesBefore', fallback: 30, route: 'prayer/mincha', optionLabel: m => String(m) }),
});
export const SMART_ORDER = Object.freeze(['omer', 'shma', 'mincha', 'candles']);

export function defaultSmart() {
  return {
    omer: { enabled: false, offsetMinutes: 0 },
    shma: { enabled: false, minutesBefore: 30, opinion: 'mga' },
    mincha: { enabled: false, minutesBefore: 30 },
    candles: { enabled: false, minutesBefore: 30, yomTov: true },
    ...defaultMazkir(),
  };
}

export function normalizeSmart(value) {
  const base = defaultSmart();
  const raw = value && typeof value === 'object' ? value : {};
  const out = {};
  for (const id of SMART_ORDER) {
    const kind = SMART_KINDS[id];
    const item = raw[id] && typeof raw[id] === 'object' ? raw[id] : {};
    const minutes = Number(item[kind.field]);
    out[id] = { ...base[id], enabled: item.enabled === true, [kind.field]: kind.options.includes(minutes) ? minutes : kind.fallback };
  }
  out.shma.opinion = SHMA_OPINIONS[raw.shma?.opinion] ? raw.shma.opinion : 'mga';
  out.candles.yomTov = raw.candles?.yomTov !== false;
  return { ...out, ...normalizeMazkir(raw) };
}

// ── The Omer count in words (for the notification; the blessing and the count itself are in the siddur) ──────────────
const DAYS_WORDS = ['', 'יום אחד', 'שני ימים', 'שלושה ימים', 'ארבעה ימים', 'חמישה ימים', 'שישה ימים'];
const WEEKS_WORDS = ['', 'שבוע אחד', 'שני שבועות', 'שלושה שבועות', 'ארבעה שבועות', 'חמישה שבועות', 'שישה שבועות', 'שבעה שבועות'];
// 12 → "שבוע אחד וחמישה ימים"; 7 → "שבוע אחד"; 5 → "חמישה ימים".
export function omerWeeksText(day) {
  const n = Number(day);
  if (!Number.isInteger(n) || n < 1 || n > 49) return '';
  const weeks = Math.floor(n / 7);
  const days = n % 7;
  if (!weeks) return DAYS_WORDS[days];
  return days ? `${WEEKS_WORDS[weeks]} ו${DAYS_WORDS[days]}` : WEEKS_WORDS[weeks];
}
// The notification: "הלילה סופרים 12 לעומר · שבוע אחד וחמישה ימים"; the first nights (under a week) without the weeks.
export function omerNoticeBody(day) {
  const n = Number(day);
  if (!Number.isInteger(n) || n < 1 || n > 49) return 'הגיע זמן ספירת העומר';
  return n < 7 ? `הלילה סופרים ${n} לעומר` : `הלילה סופרים ${n} לעומר · ${omerWeeksText(n)}`;
}

// ── One kind on one civil date → the reminder, or null (none that day, or it would fall on Shabbat / Yom Tov) ─────────
// Returns { kind, date, at: Date, anchorTime: Date, title, body, route, key }.
export function smartOn(kindId, config, dateKey, ctx) {
  if (isMazkirKind(kindId)) return mazkirOn(kindId, config, dateKey, ctx);
  const kind = SMART_KINDS[kindId];
  if (!kind || !config?.enabled || !ctx?.valid) return null;
  const tz = ctx.tz;
  const base = { kind: kindId, date: dateKey, route: kind.route, key: `rem:smart:${kindId}:${dateKey}` };
  if (kindId === 'omer') {
    const found = anchorOn('omer', dateKey, ctx);
    if (!found) return null;
    let at = new Date(found.at.getTime() + (Number(config.offsetMinutes) || 0) * MINUTE);
    const rest = restWindowAt(at, ctx);
    if (rest) {
      // The night Shabbat or Yom Tov ends (Motzaei): the count waits for its end — the app's havdalah time. A night that
      // is itself Shabbat or Yom Tov (Friday night, a festival night): no reminder.
      if (rest.end.getTime() - at.getTime() > 3 * 60 * MINUTE) return null;
      at = new Date(rest.end.getTime());
    }
    const day = found.detail?.omerDay;
    return { ...base, at, anchorTime: found.at, title: 'ספירת העומר', body: omerNoticeBody(day), omerDay: day };
  }
  if (kindId === 'shma') {
    const opinion = SHMA_OPINIONS[config.opinion] || SHMA_OPINIONS.mga;
    const found = anchorOn(opinion.anchor, dateKey, ctx);
    if (!found) return null;
    const at = new Date(found.at.getTime() - config.minutesBefore * MINUTE);
    if (restWindowAt(at, ctx)) return null;
    return { ...base, at, anchorTime: found.at, title: 'קריאת שמע', body: `סוף זמן קריאת שמע ב־${timeText(found.at, tz)} (${opinion.short}) · בעוד ${minutesText(config.minutesBefore)}` };
  }
  if (kindId === 'mincha') {
    const found = anchorOn('sunset', dateKey, ctx);
    if (!found) return null;
    const at = new Date(found.at.getTime() - config.minutesBefore * MINUTE);
    // On a Friday the reminder still comes if it falls before the candle lighting (Mincha before Shabbat).
    if (restWindowAt(at, ctx)) return null;
    return { ...base, at, anchorTime: found.at, title: 'מנחה', body: `השקיעה ב־${timeText(found.at, tz)} · בעוד ${minutesText(config.minutesBefore)}` };
  }
  if (kindId === 'candles') {
    const shabbat = anchorOn('candles-shabbat', dateKey, ctx);
    const yomTov = config.yomTov !== false ? anchorOn('candles-yomtov', dateKey, ctx) : null;
    const found = shabbat || yomTov;
    if (!found) return null;
    const at = new Date(found.at.getTime() - config.minutesBefore * MINUTE);
    // A lighting that is itself inside Shabbat or Yom Tov (the second festival night, a festival after Shabbat) has
    // no reminder: the reminder would fall on the holy day.
    if (restWindowAt(at, ctx)) return null;
    const what = shabbat && yomTov ? 'שבת וחג' : shabbat ? 'שבת' : 'חג';
    return { ...base, at, anchorTime: found.at, title: 'הדלקת נרות', body: `הדלקת נרות ${what} ב־${timeText(found.at, tz)} · בעוד ${minutesText(config.minutesBefore)}` };
  }
  return null;
}
