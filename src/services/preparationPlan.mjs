import { civilDateKey, shiftCivilDate } from '../civilDate.mjs';

export const WINDOWS = Object.freeze([30, 7, 3, 1, 0]);

export const WINDOW_LABELS = Object.freeze({
  30: 'חודש מראש · הכנה כללית',
  7: 'שבוע מראש · קניות ואורחים',
  3: 'שלושה ימים · הכנה מעשית',
  1: 'ערב החג · משימות תלויות זמן',
  0: 'היום · מה שנשאר עכשיו',
});

const task = (id, title, window, category = 'general') => ({ id, title, window, category });

export const SHABBAT_TASKS = Object.freeze([
  task('shabbat-candles', 'נרות שבת', 3, 'core'),
  task('shabbat-wine', 'יין או מיץ ענבים', 3, 'core'),
  task('shabbat-challot', 'חלות', 3, 'core'),
  task('shabbat-cooking', 'הכנת אוכל', 3, 'food'),
  task('shabbat-plata', 'פלטה', 1, 'home'),
  task('shabbat-timers', 'שעוני שבת', 1, 'home'),
  task('shabbat-clothes', 'בגדי שבת', 1, 'home'),
  task('shabbat-minyan', 'בית הכנסת / מניין', 1, 'community'),
  task('shabbat-guests', 'אורחים', 7, 'family'),
  task('shabbat-children', 'הכנת הילדים', 1, 'family'),
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

// Eruv Tavshilin is only surfaced when a festival day runs directly into Shabbat.
export function needsEruvTavshilin(dateKey) {
  if (!dateKey) return false;
  const weekday = dayStart(dateKey).getUTCDay();
  return weekday === 4 || weekday === 5;
}

export function nextHoliday(items, todayKey) {
  const candidates = (items || [])
    .filter(item => item.category === 'holiday' && item.date?.slice?.(0, 10) >= todayKey)
    .map(item => ({ item, dateKey: item.date.slice(0, 10), template: templateForEvent(item.title, item.hebrew) }))
    .filter(entry => entry.template);
  candidates.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  return candidates[0] || null;
}

export function activePreparation({ now = new Date(), tz = 'UTC', items = [] } = {}) {
  const todayKey = civilDateKey(now, tz);
  const shabbatKey = upcomingShabbatKey(todayKey);
  const shabbatDays = daysBetween(todayKey, shabbatKey);
  const shabbatWindow = windowFor(shabbatDays, false);
  const holiday = nextHoliday(items, todayKey);
  const holidayDays = holiday ? daysBetween(todayKey, holiday.dateKey) : null;
  const holidayWindow = holiday ? windowFor(holidayDays, holiday.template.major) : null;

  const useHoliday = holiday && holidayWindow !== null
    && (shabbatWindow === null || holidayDays <= shabbatDays);

  if (useHoliday) {
    const candles = timedEvent(items, shiftCivilDate(holiday.dateKey, -1), 'candles') || timedEvent(items, holiday.dateKey, 'candles');
    const havdalah = timedEvent(items, holiday.dateKey, 'havdalah');
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

  if (shabbatWindow === null) {
    return { kind: 'none', eventKey: null, tasks: [], window: null, daysUntil: shabbatDays, dateKey: shabbatKey };
  }

  const candles = timedEvent(items, shiftCivilDate(shabbatKey, -1), 'candles');
  const havdalah = timedEvent(items, shabbatKey, 'havdalah');
  return {
    kind: 'shabbat',
    eventKey: `shabbat:${shabbatKey}`,
    templateId: 'shabbat',
    name: 'שבת',
    dateKey: shabbatKey,
    daysUntil: shabbatDays,
    window: shabbatWindow,
    windowLabel: WINDOW_LABELS[shabbatWindow],
    tasks: tasksForWindow(SHABBAT_TASKS, shabbatWindow),
    candles: candles?.date || null,
    havdalah: havdalah?.date || null,
  };
}

export function visibleTasks(plan, state) {
  const disabled = state?.disabledDefaults || {};
  const defaults = (plan?.tasks || []).filter(item => !disabled[item.id]).map(item => ({ ...item, custom: false }));
  const custom = (state?.customTasks || [])
    .filter(item => item.scope === 'all' || item.scope === plan?.templateId || item.scope === plan?.kind)
    .map(item => ({ ...item, custom: true, category: 'custom', window: 0 }));
  return [...defaults, ...custom];
}

export function remainingCount(plan, state) {
  const tasks = visibleTasks(plan, state);
  const done = state?.tasks?.[plan?.eventKey] || {};
  return tasks.filter(item => !done[item.id]).length;
}
