// Smart Maariv — Weekday Maariv composition rules
// Based on TfilonEdotMizrach.jar analysis + Edot HaMizrach halacha
// Reuses same RuleResolution pattern as Smart Mincha

export const RULES_VERSION = '1.0.0';

export const STATUS = {
  APPLICABLE: 'applicable',
  NOT_APPLICABLE: 'not-applicable',
  NEEDS_INPUT: 'needs-input',
  UNRESOLVED: 'unresolved',
  UNSUPPORTED: 'unsupported',
};

/**
 * Condition functions for Maariv.
 * Each returns { include: boolean|null, rules: [id1, id2, ...] }
 * null = needs input or unresolved
 */
export const CONDITIONS = {
  // Day-of-week conditions
  'day.ordinary-weekday': (rules) => ({
    include: !rules['calendar.rosh-chodesh']?.value && !rules['calendar.special-day']?.value,
    rules: ['calendar.rosh-chodesh', 'calendar.special-day'],
  }),

  'day.rosh-chodesh': (rules) => ({
    include: rules['calendar.rosh-chodesh']?.value === true,
    rules: ['calendar.rosh-chodesh'],
  }),

  // Seasonal variants for Amidah (Gevurot, Hashanim)
  'season.gevurot-summer': (rules) => ({
    include: rules['season.branch']?.value === 'summer',
    rules: ['season.branch'],
  }),

  'season.gevurot-winter': (rules) => ({
    include: rules['season.branch']?.value === 'winter',
    rules: ['season.branch'],
  }),

  'season.hashanim-summer': (rules) => ({
    include: rules['season.branch']?.value === 'summer',
    rules: ['season.branch'],
  }),

  'season.hashanim-winter': (rules) => ({
    include: rules['season.branch']?.value === 'winter',
    rules: ['season.branch'],
  }),

  // Holiday conditions
  'holiday.al-hanissim-chanukah': (rules) => ({
    include: rules['calendar.chanukah']?.value === true,
    rules: ['calendar.chanukah'],
  }),

  'holiday.al-hanissim-purim': (rules) => ({
    include: rules['calendar.purim']?.value === true,
    rules: ['calendar.purim'],
  }),

  'holiday.yaaleh-veyavo-rosh-chodesh': (rules) => ({
    include: rules['calendar.rosh-chodesh']?.value === true,
    rules: ['calendar.rosh-chodesh'],
  }),

  'holiday.yaaleh-veyavo-pesach': (rules) => ({
    include: rules['calendar.pesach']?.value === true,
    rules: ['calendar.pesach'],
  }),

  'holiday.yaaleh-veyavo-shavuot': (rules) => ({
    include: rules['calendar.shavuot']?.value === true,
    rules: ['calendar.shavuot'],
  }),

  'holiday.yaaleh-veyavo-sukkot': (rules) => ({
    include: rules['calendar.sukkot']?.value === true,
    rules: ['calendar.sukkot'],
  }),

  // Aseret Yemei Teshuva (Ten Days of Repentance)
  'ayt.zochreinu': (rules) => ({
    include: rules['calendar.ayt']?.value === true,
    rules: ['calendar.ayt'],
  }),

  'ayt.mi-kamocha': (rules) => ({
    include: rules['calendar.ayt']?.value === true,
    rules: ['calendar.ayt'],
  }),

  'ayt.hammelech-hakadosh': (rules) => ({
    include: rules['calendar.ayt']?.value === true && rules['halacha.ayt-kingship']?.status === STATUS.APPLICABLE,
    rules: ['calendar.ayt', 'halacha.ayt-kingship'],
  }),

  'ayt.hammelech-hamishpat': (rules) => ({
    include: rules['calendar.ayt']?.value === true,
    rules: ['calendar.ayt'],
  }),

  'ayt.vetchtov': (rules) => ({
    include: rules['calendar.ayt']?.value === true,
    rules: ['calendar.ayt'],
  }),

  'ayt.bessefer': (rules) => ({
    include: rules['calendar.ayt']?.value === true,
    rules: ['calendar.ayt'],
  }),

  // Omer counting
  'omer.count': (rules) => ({
    include: rules['calendar.omer-period']?.value === true,
    rules: ['calendar.omer-period'],
  }),

  // Motzaei Shabbat (Saturday night) additions
  'motzaei-shabbat.additions': (rules) => ({
    include: rules['calendar.motzaei-shabbat']?.value === true,
    rules: ['calendar.motzaei-shabbat'],
  }),

  // Havdalah (end of Shabbat prayer)
  // Note: This is typically NOT part of Maariv; it's standalone
  // Included for completeness per JAR analysis
  'havdalah.full': (rules) => ({
    include: rules['calendar.motzaei-shabbat']?.value === true && rules['preference.havdalah-mode']?.value !== 'skip',
    rules: ['calendar.motzaei-shabbat', 'preference.havdalah-mode'],
  }),

  // Scope check — ensures this is actually a Maariv request
  'scope.weekday-maariv': (rules) => ({
    include: true,
    rules: [],
  }),
};

/**
 * Resolves Maariv rules based on time, calendar, profile, and location.
 * Returns a map of rule IDs to resolved values.
 */
export function resolveWeekdayMaarivRules({ time, calendar, profile, location }) {
  const rules = {};

  // Scope: always applicable for weekday Maariv
  rules['scope.weekday-maariv'] = {
    id: 'scope.weekday-maariv',
    status: STATUS.APPLICABLE,
    value: true,
  };

  // Calendar conditions
  rules['calendar.rosh-chodesh'] = {
    id: 'calendar.rosh-chodesh',
    status: calendar.isRoshChodesh ? STATUS.APPLICABLE : STATUS.NOT_APPLICABLE,
    value: calendar.isRoshChodesh,
  };

  rules['calendar.special-day'] = {
    id: 'calendar.special-day',
    status: STATUS.APPLICABLE,
    value: calendar.isChag,
  };

  rules['calendar.chanukah'] = {
    id: 'calendar.chanukah',
    status: calendar.isChanukah ? STATUS.APPLICABLE : STATUS.NOT_APPLICABLE,
    value: calendar.isChanukah,
  };

  rules['calendar.purim'] = {
    id: 'calendar.purim',
    status: calendar.isPurim ? STATUS.APPLICABLE : STATUS.NOT_APPLICABLE,
    value: calendar.isPurim,
  };

  rules['calendar.pesach'] = {
    id: 'calendar.pesach',
    status: calendar.isPesach ? STATUS.APPLICABLE : STATUS.NOT_APPLICABLE,
    value: calendar.isPesach,
  };

  rules['calendar.shavuot'] = {
    id: 'calendar.shavuot',
    status: calendar.isShavuot ? STATUS.APPLICABLE : STATUS.NOT_APPLICABLE,
    value: calendar.isShavuot,
  };

  rules['calendar.sukkot'] = {
    id: 'calendar.sukkot',
    status: calendar.isSukkot ? STATUS.APPLICABLE : STATUS.NOT_APPLICABLE,
    value: calendar.isSukkot,
  };

  rules['calendar.ayt'] = {
    id: 'calendar.ayt',
    status: calendar.isAYT ? STATUS.APPLICABLE : STATUS.NOT_APPLICABLE,
    value: calendar.isAYT,
  };

  rules['calendar.omer-period'] = {
    id: 'calendar.omer-period',
    status: calendar.isOmerPeriod ? STATUS.APPLICABLE : STATUS.NOT_APPLICABLE,
    value: calendar.isOmerPeriod,
  };

  rules['calendar.motzaei-shabbat'] = {
    id: 'calendar.motzaei-shabbat',
    status: calendar.isMotzaeiShabbat ? STATUS.APPLICABLE : STATUS.NOT_APPLICABLE,
    value: calendar.isMotzaeiShabbat,
  };

  // Seasonal branch: Shemittat HaTal (winter) or Birkat HaGefen (summer)
  // Transition: BIRKAT_HASHANIM_START (typically 15 Shevat)
  rules['season.branch'] = {
    id: 'season.branch',
    status: STATUS.APPLICABLE,
    value: calendar.isWinterTal ? 'winter' : 'summer',
  };

  // AYT kingship verses: "HaMelech HaKadosh" (RH/YK) vs "HaMelech HaMishpat" (other AYT days)
  rules['halacha.ayt-kingship'] = {
    id: 'halacha.ayt-kingship',
    status: calendar.isRH || calendar.isYomKippur ? STATUS.APPLICABLE : STATUS.NOT_APPLICABLE,
    value: calendar.isRH || calendar.isYomKippur,
  };

  // Omer counting specifics
  if (calendar.isOmerPeriod && calendar.omerDay !== null) {
    rules['omer.day-number'] = {
      id: 'omer.day-number',
      status: STATUS.APPLICABLE,
      value: calendar.omerDay,
    };
  }

  // Motzaei Shabbat: Havdalah preference (full, skip, separate)
  rules['preference.havdalah-mode'] = {
    id: 'preference.havdalah-mode',
    status: STATUS.APPLICABLE,
    value: profile.havdalahMode || 'full', // 'full' | 'skip' | 'separate'
  };

  // Geography: Israel or Diaspora (affects Yaaleh Veyavo)
  rules['geography.israel'] = {
    id: 'geography.israel',
    status: STATUS.APPLICABLE,
    value: profile.nusach === 'edot-hamizrach' && location?.tzid?.includes('Asia/Jerusalem'),
  };

  return rules;
}
