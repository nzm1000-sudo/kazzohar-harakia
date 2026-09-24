const normalize = value => String(value || '').trim().toLowerCase();

export function buildSiddurConditionSummary(context = {}) {
  const additions = new Set((context.additions || []).map(item => String(item?.kind || '')).filter(Boolean));
  const omissions = new Set((context.prayerContext?.omissions || []).map(item => String(item?.kind || '')).filter(Boolean));
  const specialDesc = String(context.specialDay?.desc || context.specialDay?.getDesc?.() || context.specialDay?.title || context.specialDay?.hebrew || '').trim();
  const isShabbat = Boolean(context.shabbat || context.weekday === 6);
  const isRoshChodesh = Boolean(context.isRoshChodesh);
  const isChanukah = Boolean(context.chanukah);
  const isPurim = Boolean(context.purim);
  const isFast = Boolean(context.fast || context.prayerContext?.fast || context.fastDay);
  const isYomTov = context.isYomTov === true;
  const isCholHaMoed = context.isCholHaMoed === true;
  const prayerType = context.prayerContext?.type || context.prayerType || 'shacharit';
  const hasHallel = Boolean(context.prayerContext?.hallel);
  const parallelKind = context.prayerContext?.hallel || (isRoshChodesh ? 'חצי הלל' : isChanukah ? 'הלל שלם' : null);
  const hasTachanun = !context.prayerContext?.omitTachanun;
  return {
    dayLabel: specialDesc || (isRoshChodesh ? 'Rosh Chodesh' : isShabbat ? 'Shabbat' : isFast ? 'Fast Day' : 'Weekday'),
    isShabbat,
    isRoshChodesh,
    isChanukah,
    isPurim,
    isYomTov,
    isCholHaMoed,
    isFast,
    afterSunset: Boolean(context.afterSunset),
    prayerType,
    hasTachanun,
    hasYaalehVeyavo: additions.has('yaaleh-veyavo') || context.additions?.some(item => /yaaleh/i.test(item?.text || '')),
    hasAlHanissim: additions.has('al-hanissim') || context.additions?.some(item => /al hanissim|על הניסים/i.test(item?.text || '')),
    hasHallel,
    parallelKind,
    hasMashivHaruach: Boolean(context.seasonal?.mashivHaruch),
    hasVetenTalUmatar: Boolean(context.seasonal?.vetenTalUmatar),
    hasMusaf: prayerType === 'mussaf' || isShabbat || isYomTov || isRoshChodesh,
    hasAneinu: additions.has('aneinu'),
    omitTachanun: Boolean(context.prayerContext?.omitTachanun),
    expressions: {
      additions: [...additions],
      omissions: [...omissions],
    },
  };
}

function sectionMatches(sectionName, aliases) {
  const label = normalize(sectionName);
  return aliases.some(alias => label.includes(normalize(alias)) || normalize(alias).includes(label));
}

export function shouldDisplaySiddurSection(sectionName, summary = {}) {
  const name = String(sectionName || '');
  if (sectionMatches(name, ['Tachanun'])) return summary.hasTachanun !== false;
  if (sectionMatches(name, ['Yaaleh Veyavo', 'יעלה ויבוא'])) return summary.isRoshChodesh || summary.hasYaalehVeyavo;
  if (sectionMatches(name, ['Al Hanissim', 'על הניסים'])) return summary.isChanukah || summary.isPurim || summary.hasAlHanissim;
  if (sectionMatches(name, ['Hallel', 'הלל'])) return summary.hasHallel || summary.isCholHaMoed;
  if (sectionMatches(name, ['Musaf', 'מוסף'])) return summary.hasMusaf;
  if (sectionMatches(name, ['Mashiv Haruach', 'משיב הרוח'])) return summary.hasMashivHaruach;
  if (sectionMatches(name, ['Veten Tal Umatar', 'ותן טל ומטר', 'Barech Aleinu'])) return summary.hasVetenTalUmatar;
  if (sectionMatches(name, ['Shabbat', 'שבת'])) return summary.isShabbat || name.toLowerCase().includes('shabbat');
  if (sectionMatches(name, ['Rosh Chodesh', 'ראש חודש'])) return summary.isRoshChodesh;
  if (sectionMatches(name, ['Chanukah', 'חנוכה'])) return summary.isChanukah;
  if (sectionMatches(name, ['Purim', 'פורים'])) return summary.isPurim;
  if (sectionMatches(name, ['Chol HaMoed', 'חול המועד'])) return summary.isCholHaMoed;
  if (sectionMatches(name, ['Yom Tov', 'יום טוב'])) return summary.isYomTov;
  if (sectionMatches(name, ['Aneinu', 'עננו'])) return summary.hasAneinu;
  return true;
}
