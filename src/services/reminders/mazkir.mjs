// המזכיר היהודי — the reminders beyond the day's four (smart.mjs): Chanukah lights, Shema at bedtime, Tikkun Chatzot,
// Birkot HaShachar, daily learning, Shnayim Mikra by aliya, daily tzedakah, Birkat HaIlanot and Birkat HaLevana.
// Pure: a kind + its settings + a civil date + the app's context → that day's reminder, or null. Every time comes from
// the app's own engines (jewishAlarm/engine.mjs: computeZmanim, @hebcal/core's candle lighting / havdalah, the Chanukah
// rule of the halacha engine; @hebcal/core's Molad and Sedra) — never a second zmanim calculator. Nothing is ever
// scheduled inside Shabbat or Yom Tov (restWindowAt: from candle lighting to havdalah); the app is not used then.
//
// The rules and their sources (each also shown, in Hebrew, on the reminder's settings screen — MAZKIR_KINDS[…].rule):
//   הדלקת נרות חנוכה — weekday nights: the app's verified time, בצאת הכוכבים ≈ a quarter of an hour after sunset
//     (data/halachaRules.mjs 'chanukah-candles'; שו״ע או״ח תרעב, א; ילקוט יוסף חנוכה תרעב). Friday: before the Shabbat
//     candles (שו״ע או״ח תרעט, א) and not before פלג המנחה (משנה ברורה תרעט, ב) — half an hour before candle lighting,
//     never earlier than plag. Motzaei Shabbat: when Shabbat ends; at home havdalah first, then the Chanukah lights
//     (ילקוט יוסף חנוכה תרפא; in the synagogue the lights come first — שו״ע או״ח תרפא, ב).
//   קריאת שמע על המיטה — close to going to sleep (שו״ע או״ח רלט, א); at the chosen time, never before צאת הכוכבים.
//   תיקון חצות — at חצות הלילה (שו״ע או״ח א, ג; משנה ברורה א, ט). Not on the nights of Shabbat and Yom Tov; on days
//     without Tachanun only תיקון לאה (כף החיים א, ס״ק טז–יז; ילקוט יוסף, השכמת הבוקר א).
//   ברכות השחר — from עלות השחר (שו״ע או״ח מז, יג; מו, ח); by default at sunrise, or a chosen time, never before dawn.
//   שניים מקרא ואחד תרגום — from Sunday of the week (שו״ע או״ח רפה, ג); one aliya a day (Sunday the first … Friday the
//     sixth and the seventh) is a common custom, not an obligation. On Friday no later than two hours before candles.
//   צדקה יומית — "נכון ליתן צדקה קודם תפילה" (שו״ע או״ח צב, י). Weekdays; on Friday no later than two hours before candles.
//   ברכת האילנות — in Nisan, on blossoming fruit trees, once a year (שו״ע או״ח רכו, א); not on Shabbat (כף החיים רכו, ד;
//     ילקוט יוסף רכו). A reminder on the first weekday of Nisan and a second on 17 Nisan (Chol HaMoed), or the day after.
//   ברכת הלבנה — Maran: from seven days after the molad (שו״ע או״ח תכו, ד) until half the month, 14 days 18 hours and
//     22 minutes after it (שו״ע או״ח תכו, ג); at night, after צאת הכוכבים; preferably on Motzaei Shabbat (רמ״א תכו, ב).
//     In Av after Tisha B'Av, in Tishrei after Yom Kippur (רמ״א תכו, ב). Three reminders a month at most: the first
//     night, the first Motzaei Shabbat in the window, and the last night.
import { HDate, Molad, months } from '@hebcal/core';
import { shiftCivilDate } from '../../civilDate.mjs';
import { anchorOn, candleLightingOn, chanukahNightOn, civilKeyOf, havdalahOn, restWindowAt, weekdayOf, zonedInstant, MINUTE, contextSignature } from '../jewishAlarm/engine.mjs';
import { CHANUKAH_RULE } from '../jewishAlarm/anchors.mjs';
import { timeText, minutesText } from '../jewishAlarm/format.mjs';
import { computeZmanim } from '../zmanimLocal.mjs';
import { ALIYA_NAMES, aliyotForWeekday, parashaOfWeek } from '../weeklyParasha.mjs';

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const LEARNING_TRACKS = Object.freeze([['daf-yomi', 'דף יומי'], ['rambam-3', 'רמב״ם · ג׳ פרקים'], ['rambam-1', 'רמב״ם · פרק אחד'], ['mishna-yomit', 'משנה יומית'], ['halacha-yomit', 'הלכה יומית'], ['chok-leyisrael', 'חק לישראל']]);
export const MAZKIR_LEARNING_TRACKS = LEARNING_TRACKS;

// Every kind: title, one line, its defaults, the screen a tap opens (a prayer in the Siddur or a route), and its rule.
export const MAZKIR_KINDS = Object.freeze({
  chanukah: Object.freeze({ id: 'chanukah', title: 'נרות חנוכה', description: 'בכל ליל חנוכה, לפני זמן ההדלקה', defaults: { minutesBefore: 10 }, options: [0, 10, 20, 30], field: 'minutesBefore', route: 'prayer/chanukah', siddur: 'chanukah', rare: true,
    rule: 'בימי החול — בצאת הכוכבים, כרבע שעה אחר השקיעה (שו״ע או״ח תרעב, א; ילקוט יוסף). בערב שבת — חצי שעה לפני הדלקת נרות שבת ולא לפני פלג המנחה, נר חנוכה תחילה (שו״ע או״ח תרעט, א; משנ״ב שם ב). במוצאי שבת — בצאת השבת; בבית מבדילים ואחר כך מדליקים (ילקוט יוסף תרפא).' }),
  bedtime: Object.freeze({ id: 'bedtime', title: 'קריאת שמע על המיטה', description: 'בכל לילה, בשעה שתבחרו', defaults: { time: '22:30' }, field: 'time', route: 'prayer/bedtime-shema', siddur: 'bedtime-shema',
    rule: 'סמוך לשינה (שו״ע או״ח רלט, א). התזכורת בשעה שנבחרה, ולעולם לא לפני צאת הכוכבים. לא בליל שבת וחג.' }),
  tikkun: Object.freeze({ id: 'tikkun', title: 'תיקון חצות', description: 'בחצות הלילה, לפי המיקום', defaults: { minutesBefore: 0 }, options: [0, 10, 20, 30], field: 'minutesBefore', route: 'prayer/tikkun-chatzot', siddur: 'tikkun-chatzot',
    rule: 'בחצות הלילה (שו״ע או״ח א, ג; משנ״ב שם ט). אין אומרים בליל שבת ויום טוב, ולכן אין תזכורת בלילות אלה. בימים שאין אומרים בהם תחנון (ראש חודש, חול המועד, חודש ניסן ועוד) אומרים תיקון לאה בלבד (כף החיים סימן א; ילקוט יוסף).' }),
  shachar: Object.freeze({ id: 'shachar', title: 'ברכות השחר', description: 'בבוקר — בנץ החמה או בשעה קבועה', defaults: { mode: 'sunrise', offsetMinutes: 0, time: '06:30' }, options: [0, 15, 30, 60], field: 'offsetMinutes', route: 'prayer/birkot-hashachar', siddur: 'birkot-hashachar',
    rule: 'מברכים מעלות השחר (שו״ע או״ח מז, יג; מו, ח). ברירת המחדל — בנץ החמה; בשעה קבועה — לעולם לא לפני עלות השחר. לא בשבת ובחג.' }),
  learning: Object.freeze({ id: 'learning', title: 'לימוד יומי', description: 'השיעור של היום במסלול שתבחרו', defaults: { time: '20:00', tracks: ['daf-yomi'] }, field: 'time', route: 'learning',
    rule: 'בכל יום חול, בשעה שנבחרה. הקשה פותחת את הלימוד היומי במסלול שנבחר.' }),
  shnayim: Object.freeze({ id: 'shnayim', title: 'שניים מקרא', description: 'עלייה אחת בכל יום, מראשון עד שישי', defaults: { time: '20:30' }, field: 'time', route: 'shnayim-mikra',
    rule: 'מתחילים מיום ראשון בשבוע (שו״ע או״ח רפה, ג). החלוקה לעלייה בכל יום היא מנהג נפוץ, לא חובה: ראשון — ראשון, שני — שני … חמישי — חמישי, שישי — שישי ושביעי. בשבת אין תזכורת; ביום שישי — לא יאוחר משעתיים לפני הדלקת הנרות.' }),
  tzedaka: Object.freeze({ id: 'tzedaka', title: 'צדקה יומית', description: 'בכל יום חול, בשעה שתבחרו', defaults: { time: '08:00' }, field: 'time', route: 'personal-tools/mazkir/k/tzedaka',
    rule: '״נכון ליתן צדקה קודם תפילה״ (שו״ע או״ח צב, י). תזכורת בלבד — בלי תשלום ובלי קישור החוצה. ביום שישי — לא יאוחר משעתיים לפני הדלקת הנרות.' }),
  ilanot: Object.freeze({ id: 'ilanot', title: 'ברכת האילנות', description: 'בחודש ניסן, על אילנות מאכל שמלבלבים', defaults: { time: '10:00' }, field: 'time', route: 'prayer/ilanot', siddur: 'ilanot', rare: true,
    rule: 'בימי ניסן, על אילנות מאכל שמוציאים פרח — פעם אחת בשנה (שו״ע או״ח רכו, א). אין מברכים בשבת (כף החיים רכו, ד; ילקוט יוסף). תזכורת ביום החול הראשון של ניסן, ועוד אחת בי״ז בניסן (חול המועד) או ביום החול שאחריו.' }),
  levana: Object.freeze({ id: 'levana', title: 'ברכת הלבנה', description: 'בכל חודש, בזמן ברכת הלבנה', defaults: { offsetMinutes: 0 }, options: [0, 15, 30, 60], field: 'offsetMinutes', route: 'prayer/levana', siddur: 'levana', rare: true,
    rule: 'למרן — משבעה ימים אחרי המולד (שו״ע או״ח תכו, ד) ועד חצי החודש: 14 ימים, 18 שעות ו־22 דקות מהמולד (שם, ג). בלילה, אחרי צאת הכוכבים; עדיף במוצאי שבת (רמ״א שם, ב). באב — אחרי תשעה באב, ובתשרי — אחרי יום הכיפורים. תזכורת בלילה הראשון, במוצאי השבת הראשון שבחלון ובלילה האחרון.' }),
});
export const MAZKIR_ORDER = Object.freeze(['shachar', 'bedtime', 'tikkun', 'learning', 'shnayim', 'tzedaka', 'chanukah', 'levana', 'ilanot']);
export const isMazkirKind = id => Object.prototype.hasOwnProperty.call(MAZKIR_KINDS, id);

export function defaultMazkir() {
  return Object.fromEntries(MAZKIR_ORDER.map(id => [id, { enabled: false, ...MAZKIR_KINDS[id].defaults }]));
}

// Any stored value → clean settings for every new kind (all off unless the user turned them on).
export function normalizeMazkir(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const id of MAZKIR_ORDER) {
    const kind = MAZKIR_KINDS[id];
    const item = value[id] && typeof value[id] === 'object' ? value[id] : {};
    const clean = { enabled: item.enabled === true, ...kind.defaults };
    if (kind.options) { const minutes = Number(item[kind.field]); if (kind.options.includes(minutes)) clean[kind.field] = minutes; }
    if ('time' in kind.defaults && TIME.test(String(item.time || ''))) clean.time = item.time;
    if (id === 'shachar') clean.mode = item.mode === 'time' ? 'time' : 'sunrise';
    if (id === 'learning') {
      const tracks = (Array.isArray(item.tracks) ? item.tracks : []).filter(track => LEARNING_TRACKS.some(([known]) => known === track));
      clean.tracks = tracks.length ? [...new Set(tracks)] : [...kind.defaults.tracks];
    }
    out[id] = clean;
  }
  return out;
}

// ── helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────
const at = value => { const date = value ? new Date(value) : null; return date && Number.isFinite(date.getTime()) ? date : null; };
const plus = (date, minutes) => new Date(date.getTime() + minutes * MINUTE);
const zmanCache = new Map();
function zman(ctx, dateKey, key) {
  const cacheKey = `${contextSignature(ctx)}|${dateKey}`;
  if (!zmanCache.has(cacheKey)) { if (zmanCache.size > 600) zmanCache.delete(zmanCache.keys().next().value); zmanCache.set(cacheKey, computeZmanim(dateKey, ctx.location)); }
  return at(zmanCache.get(cacheKey)?.[key]);
}
const hdateOfKey = key => { const [y, m, d] = key.split('-').map(Number); return new HDate(new Date(y, m - 1, d)); };
const keyOfHDate = hd => { const d = hd.greg(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// A wall-clock time of the evening: hours before noon belong to the night after the date (00:30 → the next civil date).
function eveningInstant(dateKey, time, tz) {
  if (!TIME.test(String(time || ''))) return null;
  return zonedInstant(Number(time.slice(0, 2)) < 12 ? shiftCivilDate(dateKey, 1) : dateKey, time, tz);
}
const inRest = (instant, ctx) => Boolean(restWindowAt(instant, ctx));
// Friday: a daytime reminder may not come later than `lead` minutes before the candle lighting.
function beforeCandles(instant, dateKey, ctx, lead = 120) {
  if (weekdayOf(dateKey) !== 5) return instant;
  const candles = candleLightingOn(ctx, dateKey);
  return candles && instant.getTime() > candles.getTime() - lead * MINUTE ? plus(candles, -lead) : instant;
}
// "חצות הלילה" of the night that begins on the evening of a civil date (hebcal's chatzotNight of a date is the
// midnight of the night BEFORE it).
export const chatzotOfEvening = (dateKey, ctx) => zman(ctx, shiftCivilDate(dateKey, 1), 'chatzotNight');

// ── Birkat HaLevana: the month's window and its (at most three) reminders ─────────────────────────────────────────
const levanaCache = new Map();
export function levanaWindow(hyear, hmonth) {
  const molad = new Molad(hyear, hmonth);
  return { molad: new Date(molad.getInstant().epochMilliseconds), start: new Date(molad.getTchilasZmanKidushLevana7Days().epochMilliseconds), end: new Date(molad.getSofZmanKidushLevanaBetweenMoldos().epochMilliseconds) };
}
// The end of a fast or of Yom Kippur that must pass first (Av: Tisha B'Av; Tishrei: Yom Kippur), or null.
function mustFollow(hyear, hmonth, ctx) {
  if (hmonth === months.AV) {
    for (const day of [9, 10]) { const key = keyOfHDate(new HDate(day, months.AV, hyear)); const end = anchorOn('fast-end', key, ctx); if (end) return end.at; }
    return null;
  }
  if (hmonth === months.TISHREI) return havdalahOn(ctx, keyOfHDate(new HDate(10, months.TISHREI, hyear)));
  return null;
}
/** The reminders of Birkat HaLevana in one Hebrew month: [{ at, slot: 'first'|'motzash'|'last', window }]. */
export function levanaReminders(hyear, hmonth, ctx, offsetMinutes = 0) {
  if (!ctx?.valid) return [];
  const cacheKey = `${contextSignature(ctx)}|${hyear}-${hmonth}|${offsetMinutes}`;
  if (levanaCache.has(cacheKey)) return levanaCache.get(cacheKey);
  const window = levanaWindow(hyear, hmonth);
  const after = mustFollow(hyear, hmonth, ctx);
  const from = after && after > window.start ? after : window.start;
  const nights = [];
  for (let key = shiftCivilDate(civilKeyOf(from.getTime(), ctx.tz), -1); key <= civilKeyOf(window.end.getTime(), ctx.tz); key = shiftCivilDate(key, 1)) {
    const tzeit = anchorOn('tzeit85deg', key, ctx)?.at;
    if (!tzeit) continue;
    let when = plus(tzeit, offsetMinutes);
    const rest = restWindowAt(when, ctx);
    if (rest) { if (weekdayOf(civilKeyOf(rest.end.getTime(), ctx.tz)) === 6 && civilKeyOf(rest.end.getTime(), ctx.tz) === key) when = new Date(rest.end.getTime()); else continue; }
    if (when < from) { if (from - when < 6 * 60 * MINUTE && !inRest(from, ctx)) when = new Date(from.getTime()); else continue; }
    // The blessing is said at night: a reminder less than half an hour before the end is no use.
    if (when.getTime() > window.end.getTime() - 30 * MINUTE) continue;
    nights.push({ key, at: when, motzash: weekdayOf(key) === 6 });
  }
  const chosen = [];
  if (nights.length) chosen.push({ ...nights[0], slot: 'first' });
  const motzash = nights.find(night => night.motzash);
  if (motzash && motzash.key !== nights[0].key) chosen.push({ ...motzash, slot: 'motzash' });
  const last = nights.at(-1);
  if (last && !chosen.some(item => item.key === last.key)) chosen.push({ ...last, slot: 'last' });
  const out = chosen.map(item => ({ ...item, window }));
  if (levanaCache.size > 60) levanaCache.delete(levanaCache.keys().next().value);
  levanaCache.set(cacheKey, out);
  return out;
}

// ── Birkat HaIlanot: two days of Nisan ───────────────────────────────────────────────────────────────────────────
/** The two reminder days of a Hebrew year's Nisan: [{ key, slot: 'first'|'again' }] (days that are not Shabbat / Yom Tov). */
export function ilanotDays(hyear, ctx, time = '10:00') {
  const out = [];
  for (const [fromDay, slot] of [[1, 'first'], [17, 'again']]) {
    for (let day = fromDay; day <= 29; day += 1) {
      const key = keyOfHDate(new HDate(day, months.NISAN, hyear));
      const when = zonedInstant(key, time, ctx.tz);
      if (!when || weekdayOf(key) === 6 || inRest(when, ctx)) continue;
      if (!out.some(item => item.key === key)) out.push({ key, at: when, slot });
      break;
    }
  }
  return out;
}

const TIKKUN_NOTE = 'תיקון חצות';
const chanukahNightsText = night => (night === 1 ? 'הלילה מדליקים את הנר הראשון' : `הלילה מדליקים ${night} נרות`);

/** One new kind on one civil date → { kind, date, at, anchorTime, title, body, route, key } or null. */
export function mazkirOn(kindId, config, dateKey, ctx) {
  const kind = MAZKIR_KINDS[kindId];
  if (!kind || !config?.enabled || !ctx?.valid) return null;
  const tz = ctx.tz;
  const weekday = weekdayOf(dateKey);
  const base = { kind: kindId, date: dateKey, route: kind.route, key: `rem:smart:${kindId}:${dateKey}` };
  const done = (when, title, body, extra = {}) => (when && !inRest(when, ctx) ? { ...base, at: when, anchorTime: extra.anchorTime || when, title, body, ...extra } : null);

  if (kindId === 'chanukah') {
    const night = chanukahNightOn(dateKey);
    if (!night || !CHANUKAH_RULE) return null;
    if (weekday === 5) {
      const candles = candleLightingOn(ctx, dateKey);
      if (!candles) return null;
      const plag = anchorOn('plagHaMincha', dateKey, ctx)?.at;
      let when = plus(candles, -30);
      if (plag && when < plag) when = plag;
      return done(when, 'נרות חנוכה', `${chanukahNightsText(night)} · לפני נרות שבת (הדלקת נרות שבת ב־${timeText(candles, tz)})`, { anchorTime: candles, night });
    }
    if (weekday === 6) {
      const end = havdalahOn(ctx, dateKey);
      return end ? done(end, 'נרות חנוכה', `${chanukahNightsText(night)} · במוצאי שבת, אחרי ההבדלה`, { anchorTime: end, night }) : null;
    }
    const sunset = anchorOn('sunset', dateKey, ctx)?.at;
    if (!sunset) return null;
    const lighting = plus(sunset, CHANUKAH_RULE.minutes);
    const when = plus(lighting, -(Number(config.minutesBefore) || 0));
    return done(when, 'נרות חנוכה', `${chanukahNightsText(night)} · זמן ההדלקה ${timeText(lighting, tz)}`, { anchorTime: lighting, night });
  }
  if (kindId === 'bedtime') {
    let when = eveningInstant(dateKey, config.time, tz);
    const tzeit = anchorOn('tzeit85deg', dateKey, ctx)?.at;
    if (!when) return null;
    if (tzeit && when < tzeit) when = tzeit;
    return done(when, 'קריאת שמע על המיטה', 'לפני השינה · קריאת שמע על המיטה');
  }
  if (kindId === 'tikkun') {
    const chatzot = chatzotOfEvening(dateKey, ctx);
    if (!chatzot) return null;
    // The night itself must not be Shabbat or Yom Tov (Friday night: chatzot is inside the span).
    if (inRest(chatzot, ctx)) return null;
    const when = plus(chatzot, -(Number(config.minutesBefore) || 0));
    return done(when, TIKKUN_NOTE, `חצות הלילה ב־${timeText(chatzot, tz)}`, { anchorTime: chatzot });
  }
  if (kindId === 'shachar') {
    if (config.mode === 'time') {
      let when = zonedInstant(dateKey, config.time, tz);
      const dawn = anchorOn('alotHaShachar', dateKey, ctx)?.at;
      if (!when) return null;
      if (dawn && when < dawn) when = dawn;
      return done(when, 'ברכות השחר', 'בוקר טוב · ברכות השחר');
    }
    const sunrise = anchorOn('sunrise', dateKey, ctx)?.at;
    if (!sunrise) return null;
    return done(plus(sunrise, Number(config.offsetMinutes) || 0), 'ברכות השחר', `הנץ החמה ב־${timeText(sunrise, tz)} · ברכות השחר`, { anchorTime: sunrise });
  }
  if (kindId === 'learning') {
    const when = zonedInstant(dateKey, config.time, tz);
    const tracks = (config.tracks || []).map(id => LEARNING_TRACKS.find(([known]) => known === id)).filter(Boolean);
    if (!when || !tracks.length) return null;
    return done(when, 'לימוד יומי', `הלימוד של היום · ${tracks.map(([, label]) => label).join(' · ')}`, { route: tracks.length === 1 ? `learning/${tracks[0][0]}` : 'learning' });
  }
  if (kindId === 'shnayim') {
    const aliyot = aliyotForWeekday(weekday);
    if (!aliyot.length) return null;
    const parasha = parashaOfWeek(dateKey, ctx.il);
    if (!parasha) return null;
    const wanted = zonedInstant(dateKey, config.time, tz);
    if (!wanted) return null;
    const when = beforeCandles(wanted, dateKey, ctx, 120);
    const names = aliyot.map(n => ALIYA_NAMES[n]).join(' ו');
    return done(when, 'שניים מקרא ואחד תרגום', `פרשת ${parasha.he} · היום: ${aliyot.length > 1 ? `${names}` : `עליית ${names}`}`, { route: `shnayim-mikra/${parasha.id}/${aliyot[0]}`, parashaId: parasha.id, aliyot });
  }
  if (kindId === 'tzedaka') {
    if (weekday === 6) return null;
    const wanted = zonedInstant(dateKey, config.time, tz);
    if (!wanted) return null;
    return done(beforeCandles(wanted, dateKey, ctx, 120), 'צדקה יומית', weekday === 5 ? 'צדקה של ערב שבת' : 'צדקה של היום');
  }
  if (kindId === 'ilanot') {
    const hd = hdateOfKey(dateKey);
    if (hd.getMonth() !== months.NISAN) return null;
    const day = ilanotDays(hd.getFullYear(), ctx, config.time).find(item => item.key === dateKey);
    if (!day) return null;
    return done(day.at, 'ברכת האילנות', day.slot === 'first' ? 'חודש ניסן — הזמן לברכת האילנות, על אילנות מאכל שמלבלבים' : 'עוד לא בירכתם ברכת האילנות? אפשר בכל ימי ניסן');
  }
  if (kindId === 'levana') {
    const hd = hdateOfKey(dateKey);
    const found = levanaReminders(hd.getFullYear(), hd.getMonth(), ctx, Number(config.offsetMinutes) || 0).find(item => item.key === dateKey);
    if (!found) return null;
    const endText = `${new Intl.DateTimeFormat('he-IL', { timeZone: tz, day: 'numeric', month: 'numeric' }).format(found.window.end)} בשעה ${timeText(found.window.end, tz)}`;
    const body = found.slot === 'first' ? `מהלילה אפשר לברך ברכת הלבנה · עד ${endText}`
      : found.slot === 'motzash' ? `מוצאי שבת — זמן מובחר לברכת הלבנה · עד ${endText}`
        : `הלילה האחרון לברכת הלבנה · עד ${endText}`;
    return done(found.at, 'ברכת הלבנה', body, { slot: found.slot });
  }
  return null;
}

// A short summary of a kind's settings for its tile ("22:30", "10 דק׳ לפני", "בנץ החמה").
export function mazkirSummary(kindId, config) {
  if (!config) return '';
  const before = minutes => (minutes ? `${minutesText(minutes)} לפני` : 'בזמן');
  switch (kindId) {
    case 'chanukah': return config.minutesBefore ? `${minutesText(config.minutesBefore)} לפני ההדלקה` : 'בזמן ההדלקה';
    case 'tikkun': return config.minutesBefore ? `${before(config.minutesBefore)} חצות` : 'בחצות הלילה';
    case 'shachar': return config.mode === 'time' ? config.time : config.offsetMinutes ? `${minutesText(config.offsetMinutes)} אחרי הנץ` : 'בנץ החמה';
    case 'learning': return `${config.time} · ${(config.tracks || []).length === 1 ? LEARNING_TRACKS.find(([id]) => id === config.tracks[0])?.[1] || '' : `${(config.tracks || []).length} מסלולים`}`;
    case 'levana': return config.offsetMinutes ? `${minutesText(config.offsetMinutes)} אחרי צאת הכוכבים` : 'בצאת הכוכבים';
    default: return config.time || '';
  }
}
