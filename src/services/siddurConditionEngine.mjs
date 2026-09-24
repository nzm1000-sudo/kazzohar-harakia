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
  const isAseretYemeiTeshuvah = context.isAseretYemeiTeshuvah === true;
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
    isAseretYemeiTeshuvah,
    isFast,
    afterSunset: Boolean(context.afterSunset),
    prayerType,
    hasTachanun,
    // Only the Erev Yom Kippur Mincha rule in JewishContextEngine ever adds 'vidui' —
    // this must never default to "always shown" the way an un-gated TOC entry would.
    hasVidui: additions.has('vidui'),
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

// Single authoritative table for every conditional Siddur TOC section: each rule names
// the aliases it matches and a predicate over the verified context summary. A section
// not listed here (an ordinary, non-conditional prayer component) always shows, same as
// before — but nothing conditional is ever "on by default" the way Vidui used to be.
const SECTION_RULES = [
  { match: ['Tachanun'], showWhen: summary => summary.hasTachanun !== false },
  { match: ['Vidui'], showWhen: summary => summary.hasVidui === true },
  { match: ['Yaaleh Veyavo', 'יעלה ויבוא'], showWhen: summary => summary.isRoshChodesh || summary.hasYaalehVeyavo },
  { match: ['Al Hanissim', 'על הניסים'], showWhen: summary => summary.isChanukah || summary.isPurim || summary.hasAlHanissim },
  { match: ['Hallel', 'הלל'], showWhen: summary => summary.hasHallel || summary.isCholHaMoed },
  { match: ['Musaf', 'מוסף'], showWhen: summary => summary.hasMusaf },
  { match: ['Mashiv Haruach', 'משיב הרוח'], showWhen: summary => summary.hasMashivHaruach },
  { match: ['Veten Tal Umatar', 'ותן טל ומטר', 'Barech Aleinu'], showWhen: summary => summary.hasVetenTalUmatar },
  { match: ['Shabbat', 'שבת'], showWhen: (summary, name) => summary.isShabbat || name.toLowerCase().includes('shabbat') },
  { match: ['Rosh Chodesh', 'ראש חודש'], showWhen: summary => summary.isRoshChodesh },
  { match: ['Chanukah', 'חנוכה'], showWhen: summary => summary.isChanukah },
  { match: ['Purim', 'פורים'], showWhen: summary => summary.isPurim },
  { match: ['Chol HaMoed', 'חול המועד'], showWhen: summary => summary.isCholHaMoed },
  { match: ['Yom Tov', 'יום טוב'], showWhen: summary => summary.isYomTov },
  { match: ['Aneinu', 'עננו'], showWhen: summary => summary.hasAneinu },
];

export function shouldDisplaySiddurSection(sectionName, summary = {}) {
  const name = String(sectionName || '');
  const rule = SECTION_RULES.find(candidate => sectionMatches(name, candidate.match));
  return rule ? rule.showWhen(summary, name) : true;
}

export const SIDDUR_SECTION_RULES = SECTION_RULES;
