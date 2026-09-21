import { civilDateKey, shiftCivilDate } from '../civilDate.mjs';

export const WINDOWS = Object.freeze([30, 7, 3, 1, 0]);

export const WINDOW_LABELS = Object.freeze({
  30: 'חודש מראש · הכנה כללית',
  7: 'שבוע מראש · קניות ואורחים',
  3: 'שלושה ימים · הכנה מעשית',
  1: 'ערב החג · משימות תלויות זמן',
  0: 'היום · מה שנשאר עכשיו',
});

const task = (id, title, window, category = 'general', options = {}) => ({ id, title, window, category, ...options });

export const SHABBAT_GROUPS = Object.freeze([
  { id: 'before', label: 'לפני שבת' },
  { id: 'home', label: 'בית וסעודות' },
  { id: 'family', label: 'אישי ומשפחה' },
  { id: 'spiritual', label: 'הכנה רוחנית' },
]);

export const SHABBAT_TASKS = Object.freeze([
  task('shabbat-candles', 'נרות שבת', 7, 'core', { group: 'before', priority: 1, reminderEligible: true }),
  task('shabbat-plata', 'פלטה ומיחם', 7, 'home', { group: 'before', priority: 2, reminderEligible: true, details: ['פלטה', 'מיחם או מים חמים'] }),
  task('shabbat-electricity', 'חשמל ומכשירים', 7, 'home', { group: 'before', priority: 3, reminderEligible: true, details: ['שעוני שבת', 'תאורה', 'מזגן או חימום', 'מקרר', 'מכשירים שאינם נצרכים'] }),
  task('shabbat-personal-devices', 'כיסים ומכשירים אישיים', 7, 'home', { group: 'before', priority: 4 }),
  task('shabbat-cooking', 'הכנת האוכל', 7, 'food', { group: 'home', priority: 5 }),
  task('shabbat-challot', 'חלות', 7, 'food', { group: 'home', priority: 6 }),
  task('shabbat-wine', 'יין או מיץ ענבים', 7, 'food', { group: 'home', priority: 7 }),
  task('shabbat-table', 'שולחן שבת', 7, 'home', { group: 'home', priority: 8, details: ['מפה', 'כלים', 'שתייה', 'דברים שדורשים הכנה מראש'] }),
  task('shabbat-washing', 'רחצה והכנה אישית', 7, 'family', { group: 'family', priority: 9 }),
  task('shabbat-clothes', 'בגדי שבת ונעליים', 7, 'family', { group: 'family', priority: 10 }),
  task('shabbat-children', 'הכנת הילדים', 7, 'family', { group: 'family', priority: 11 }),
  task('shabbat-personal-needs', 'צרכים אישיים לפני שבת', 7, 'family', { group: 'family', priority: 12 }),
  task('shabbat-shnayim-mikra', 'שניים מקרא ואחד תרגום', 7, 'learning', { group: 'spiritual', priority: 13, action: 'personal-tools/parasha' }),
  task('shabbat-parasha', 'פרשת השבוע', 7, 'learning', { group: 'spiritual', priority: 14, action: 'parasha' }),
  task('shabbat-dvar-torah', 'הכנת דבר תורה', 7, 'learning', { group: 'spiritual', priority: 15, action: 'shabbat-table' }),
  task('shabbat-prayer-times', 'זמני תפילות והכנה לקבלת שבת', 7, 'prayer', { group: 'spiritual', priority: 16, action: 'times' }),
]);

export const HOLIDAY_TEMPLATES = Object.freeze({
  pesach: {
    id: 'pesach',
    label: 'פסח',
    major: true,
    tasks: [
      task('pesach-cleaning', 'ניקיונות', 30, 'home'),
      task('pesach-sale', 'מכירת חמץ — לתאם מול הרב המקומי', 30, 'core'),
      task('pesach-matzot', 'מצות', 7, 'core'),
      task('pesach-wine', 'יין לארבע כוסות', 7, 'core'),
      task('pesach-shopping', 'קניות לחג', 7, 'food'),
      task('pesach-simanim', 'סימני הסדר', 3, 'core'),
      task('pesach-cooking', 'בישול לסדר', 3, 'food'),
      task('pesach-bedika', 'בדיקת חמץ', 1, 'core'),
      task('pesach-biur', 'ביעור חמץ', 0, 'core'),
    ],
  },
  sukkot: {
    id: 'sukkot',
    label: 'סוכות',
    major: true,
    tasks: [
      task('sukkot-sukkah', 'הקמת סוכה', 30, 'home'),
      task('sukkot-schach', 'סכך', 7, 'core'),
      task('sukkot-minim', 'ארבעת המינים', 7, 'core'),
      task('sukkot-decor', 'קישוטים', 3, 'family'),
      task('sukkot-meals', 'סעודות', 3, 'food'),
    ],
  },
  'rosh-hashana': {
    id: 'rosh-hashana',
    label: 'ראש השנה',
    major: true,
    tasks: [
      task('rh-shofar', 'תכנון שמיעת שופר', 30, 'community'),
      task('rh-simanim', 'סימנים', 7, 'core'),
      task('rh-candles', 'נרות', 3, 'core'),
      task('rh-meals', 'סעודות', 3, 'food'),
    ],
  },
  'yom-kippur': {
    id: 'yom-kippur',
    label: 'יום כיפור',
    major: true,
    tasks: [
      task('yk-fast-prep', 'הכנה לצום', 7, 'core'),
      task('yk-candles', 'נרות', 3, 'core'),
      task('yk-seuda', 'סעודה מפסקת', 1, 'food'),
    ],
  },
  'shmini-atzeret': {
    id: 'shmini-atzeret',
    label: 'שמיני עצרת ושמחת תורה',
    major: true,
    tasks: [
      task('sa-meals', 'סעודות החג', 7, 'food'),
      task('sa-candles', 'נרות', 3, 'core'),
      task('sa-hakafot', 'תכנון הקפות', 3, 'community'),
    ],
  },
  chanukah: {
    id: 'chanukah',
    label: 'חנוכה',
    major: false,
    tasks: [
      task('chanukah-oil', 'נרות או שמן', 7, 'core'),
      task('chanukah-time', 'זמן הדלקה', 1, 'core'),
      task('chanukah-travel', 'נסיעה או אירוח בחנוכה — לברר היכן מדליקים', 3, 'family'),
    ],
  },
  purim: {
    id: 'purim',
    label: 'פורים',
    major: false,
    tasks: [
      task('purim-megillah', 'מגילה', 7, 'core'),
      task('purim-mishloach', 'משלוח מנות', 3, 'family'),
      task('purim-matanot', 'מתנות לאביונים', 3, 'core'),
      task('purim-seuda', 'סעודה', 1, 'food'),
    ],
  },
  shavuot: {
    id: 'shavuot',
    label: 'שבועות',
    major: true,
    tasks: [
      task('shavuot-meals', 'סעודות החג', 7, 'food'),
      task('shavuot-candles', 'נרות', 3, 'core'),
      task('shavuot-learning', 'הכנת לימוד ליל שבועות', 3, 'learning'),
    ],
  },
});

const MATCHERS = [
  [/rosh hashana|ראש השנה/i, 'rosh-hashana'],
  [/yom kippur|יום כיפור/i, 'yom-kippur'],
  [/shmini atzeret|simchat torah|שמיני עצרת|שמחת תורה/i, 'shmini-atzeret'],
  [/sukkot|סוכות/i, 'sukkot'],
  [/chanukah|hanukkah|חנוכה/i, 'chanukah'],
  [/purim/i, 'purim'],
  [/pesach|passover|פסח/i, 'pesach'],
  [/shavuot|שבועות/i, 'shavuot'],
];

export function templateForEvent(title = '', hebrew = '') {
  const text = `${title} ${hebrew}`;
  if (/erev/i.test(title) && !/chanukah/i.test(title)) {
    // Erev entries point at the same festival template.
  }
  for (const [pattern, id] of MATCHERS) {
    if (pattern.test(text)) return HOLIDAY_TEMPLATES[id];
  }
  return null;
}

const dayStart = key => new Date(`${key}T00:00:00Z`);

export function daysBetween(fromKey, toKey) {
  if (!fromKey || !toKey) return null;
  const diff = dayStart(toKey).getTime() - dayStart(fromKey).getTime();
  if (!Number.isFinite(diff)) return null;
  return Math.round(diff / 86400000);
}

export function windowFor(daysUntil, major) {
  if (daysUntil === null || daysUntil < 0) return null;
  if (daysUntil === 0) return 0;
  if (daysUntil === 1) return 1;
  if (daysUntil <= 3) return 3;
  if (daysUntil <= 7) return 7;
  if (major && daysUntil <= 30) return 30;
  return null;
}

export function tasksForWindow(tasks, activeWindow) {
  if (activeWindow === null) return [];
  return tasks.filter(item => item.window >= activeWindow);
}

function upcomingShabbatKey(todayKey) {
  const weekday = dayStart(todayKey).getUTCDay();
  const offset = weekday === 6 ? 0 : (6 - weekday);
  return shiftCivilDate(todayKey, offset);
}

function timedEvent(items, dateKey, category) {
  return (items || []).find(item => item.category === category && item.date?.slice?.(0, 10) === dateKey) || null;
}

// Festival templates key on the Erev day and Yom Tov may span two days; take the first havdalah after candle lighting within 3 days.
function havdalahAfter(items, fromKey, candlesAt) {
  const limit = shiftCivilDate(fromKey, 3);
  return (items || [])
    .filter(item => item.category === 'havdalah' && item.date?.slice?.(0, 10) >= fromKey && item.date.slice(0, 10) <= limit && (!candlesAt || new Date(item.date) > new Date(candlesAt)))
    .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}

export function shabbatPreparation({ now = new Date(), tz = 'UTC', currentJewishKey = null, items = [] } = {}) {
  const todayKey = currentJewishKey || civilDateKey(now, tz);
  const dateKey = dayStart(todayKey).getUTCDay() === 6 ? shiftCivilDate(todayKey, 7) : upcomingShabbatKey(todayKey);
  const daysUntil = daysBetween(todayKey, dateKey);
  const window = windowFor(daysUntil, false);
  const candles = timedEvent(items, shiftCivilDate(dateKey, -1), 'candles');
  const havdalah = timedEvent(items, dateKey, 'havdalah');
  const sunset = timedEvent(items, shiftCivilDate(dateKey, -1), 'sunset');
  const rabbeinuTam = timedEvent(items, dateKey, 'tzeit72min');
  return {
    kind: 'shabbat', eventKey: `shabbat:${dateKey}`, templateId: 'shabbat', name: 'שבת', dateKey,
    daysUntil, window, windowLabel: WINDOW_LABELS[window], tasks: SHABBAT_TASKS,
    candles: candles?.date || null, havdalah: havdalah?.date || null,
    sunset: sunset?.date || null, rabbeinuTam: rabbeinuTam?.date || null,
  };
}

export function upcomingShabbatContext(items = [], dateKey = null) {
  const events = (items || []).filter(item => item.date?.slice?.(0, 10) === dateKey);
  const parasha = events.find(item => item.category === 'parashat' || item.t === 'parashat') || null;
  const special = events.find(item => /Shkalim|Shekalim|Parah|Hachodesh|Zachor|Shabbat/i.test(item.title || item.desc || '')) || null;
  const roshChodesh = events.find(item => /Rosh Chodesh|ראש חודש/i.test(`${item.title || ''} ${item.hebrew || ''}`)) || null;
  return {
    parasha,
    parashaName: parasha?.hebrew || parasha?.title || null,
    reading: parasha?.leyning || null,
    special,
    roshChodesh,
  };
}

export function timeUntilCandles(now, candles) {
  const difference = new Date(candles).getTime() - new Date(now).getTime();
  if (!Number.isFinite(difference) || difference <= 0) return null;
  const totalMinutes = Math.floor(difference / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days) return `${days === 1 ? 'יום אחד' : `${days} ימים`} ו־${hours} שעות`;
  if (hours) return `${hours} שעות ו־${minutes} דקות`;
  return `${minutes} דקות`;
}

// Eruv Tavshilin is only surfaced when a festival day runs directly into Shabbat.
export function needsEruvTavshilin(dateKey) {
  if (!dateKey) return false;
  const weekday = dayStart(dateKey).getUTCDay();
  return weekday === 4 || weekday === 5;
}

export function nextHoliday(items, todayKey) {
  const candidates = (items || [])
    .filter(item => item.category === 'holiday' && item.date?.slice?.(0, 10) > todayKey)
    .map(item => ({ item, dateKey: item.date.slice(0, 10), template: templateForEvent(item.title, item.hebrew) }))
    .filter(entry => entry.template);
  candidates.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  return candidates[0] || null;
}

export function eventLifecycle(items = [], currentKey) {
  const holidays = (items || []).filter(item => item.category === 'holiday' && item.date?.slice?.(0, 10));
  const currentEvent = holidays.find(item => item.date.slice(0, 10) === currentKey) || null;
  const upcomingEvent = holidays
    .filter(item => item.date.slice(0, 10) > currentKey)
    .sort((a, b) => a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)))[0] || null;
  const recentlyEndedEvent = holidays
    .filter(item => item.date.slice(0, 10) < currentKey)
    .sort((a, b) => b.date.slice(0, 10).localeCompare(a.date.slice(0, 10)))[0] || null;
  return { upcomingEvent, currentEvent, recentlyEndedEvent };
}

export function activePreparation({ now = new Date(), tz = 'UTC', currentJewishKey = null, items = [] } = {}) {
  const todayKey = civilDateKey(now, tz);
  const eventKey = currentJewishKey || todayKey;
  const shabbatKey = upcomingShabbatKey(eventKey);
  const shabbatDays = daysBetween(eventKey, shabbatKey);
  const shabbatWindow = windowFor(shabbatDays, false);
  const holiday = nextHoliday(items, eventKey);
  const holidayDays = holiday ? daysBetween(eventKey, holiday.dateKey) : null;
  const holidayWindow = holiday ? windowFor(holidayDays, holiday.template.major) : null;

  const useHoliday = holiday && holidayWindow !== null
    && (shabbatWindow === null || holidayDays <= shabbatDays);

  if (useHoliday) {
    const candles = timedEvent(items, shiftCivilDate(holiday.dateKey, -1), 'candles') || timedEvent(items, holiday.dateKey, 'candles');
    const havdalah = timedEvent(items, holiday.dateKey, 'havdalah') || havdalahAfter(items, holiday.dateKey, candles?.date);
    const tasks = tasksForWindow(holiday.template.tasks, holidayWindow);
    if (needsEruvTavshilin(holiday.dateKey)) {
      tasks.push(task('eruv-tavshilin', 'עירוב תבשילין', holidayWindow, 'core'));
    }
    return {
      kind: 'holiday',
      eventKey: `holiday:${holiday.template.id}:${holiday.dateKey}`,
      templateId: holiday.template.id,
      name: holiday.item.hebrew || holiday.item.title,
      dateKey: holiday.dateKey,
      daysUntil: holidayDays,
      window: holidayWindow,
      windowLabel: WINDOW_LABELS[holidayWindow],
      tasks,
      candles: candles?.date || null,
      havdalah: havdalah?.date || null,
    };
  }

  if (shabbatWindow === null || dayStart(eventKey).getUTCDay() === 6) {
    return { kind: 'none', eventKey: null, tasks: [], window: null, daysUntil: shabbatDays, dateKey: shabbatKey };
  }

  return shabbatPreparation({ now, tz, currentJewishKey: eventKey, items });
}

export function visibleTasks(plan, state) {
  const disabled = state?.disabledDefaults || {};
  const defaults = (plan?.tasks || []).filter(item => !disabled[item.id]).map(item => ({ ...item, custom: false }));
  const custom = (state?.customTasks || [])
    .filter(item => item.scope === 'all' || item.scope === plan?.templateId || item.scope === plan?.kind)
    .map(item => ({ ...item, custom: true, category: 'custom', group: item.group || 'family', window: 0 }));
  return [...defaults, ...custom];
}

export function remainingCount(plan, state) {
  const tasks = visibleTasks(plan, state);
  const done = state?.tasks?.[plan?.eventKey] || {};
  return tasks.filter(item => !done[item.id]).length;
}
