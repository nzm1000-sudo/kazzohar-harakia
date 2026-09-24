import { buildSiddurConditionSummary } from './siddurConditionEngine.mjs';
import { SIDDUR_ADDITION_ANCHORS } from './siddurBlocks.mjs';

// Which Amida-bearing prayers Hallel/Mussaf/Aseret-Yemei-Teshuvah notes are relevant to.
const AMIDA_PRAYERS = new Set(['shacharit', 'mincha', 'maariv', 'mussaf']);

// Reads which prayer (shacharit/mincha/maariv/mussaf) a Siddur flow key refers to,
// e.g. "Weekday Mincha" -> 'mincha'. Returns null for non-prayer flows (Hallel, etc.).
export function prayerTypeFromFlowKey(flowKey = '') {
  const key = String(flowKey || '');
  if (/mussaf/i.test(key)) return 'mussaf';
  if (/mincha/i.test(key)) return 'mincha';
  if (/arvit|maariv/i.test(key)) return 'maariv';
  if (/shacharit/i.test(key)) return 'shacharit';
  return null;
}

// The single authoritative resolver: everything the Siddur reader shows about "what
// applies today" for a specific prayer is computed here, from the already-verified
// JewishContextEngine output only — nothing here invents halachic content. Sections
// that don't apply to the given prayerType (e.g. Hallel when opening Mincha) are
// filtered out here, once, instead of being re-checked ad hoc in every component.
export function resolvePrayerConditions(context = {}, prayerType = null) {
  const summary = buildSiddurConditionSummary(context);
  const relevantToPrayer = item => !item.prayer || item.prayer === prayerType;
  const inserts = (context.additions || [])
    .filter(relevantToPrayer)
    .map(item => ({ id: item.kind, text: item.text, source: item.rule?.source || null }));
  const omissions = (context.prayerContext?.omissions || [])
    .filter(relevantToPrayer)
    .map(item => ({ id: item.kind, text: item.text, source: item.rule?.source || null }));
  const notes = [];
  if (summary.hasHallel && (prayerType === 'shacharit' || prayerType === 'mussaf' || prayerType === null)) {
    notes.push({ id: 'hallel', text: summary.parallelKind, source: 'Shulchan Arukh, Orach Chayim 422, 683' });
  }
  if (summary.hasMusaf && (prayerType === 'mussaf' || prayerType === null)) {
    notes.push({ id: 'mussaf', text: 'יש להתפלל מוסף היום', source: null });
  }
  if (summary.isAseretYemeiTeshuvah && (prayerType === null || AMIDA_PRAYERS.has(prayerType))) {
    notes.push({ id: 'aseret-yemei-teshuvah', text: 'בעשרת ימי תשובה יש שינויים בעמידה', source: 'ילקוט יוסף, סימן תקפ״ב–תר״ב, סעיף ב', questionId: 'qa-hamelech-hakadosh' });
  }
  // A genuine, unresolved gap: existing sources do not give this app a reviewed rule for
  // Aneinu, so it is flagged for review rather than guessed — see the fast-day tests.
  const review = [];
  if (summary.isFast && (prayerType === 'shacharit' || prayerType === 'mincha' || prayerType === null)) {
    review.push({ id: 'aneinu', text: 'עננו בתענית', reviewState: 'NOT_VERIFIED' });
  }
  // Only phrases whose exact nusach is already verified are eligible for inline insertion.
  // Names alone ("יעלה ויבוא") stay in the rubric list — inventing the full paragraph is forbidden.
  const inline = [];
  if (summary.hasMashivHaruach && (prayerType === null || AMIDA_PRAYERS.has(prayerType))) {
    inline.push({
      id: 'mashiv-haruach',
      anchor: SIDDUR_ADDITION_ANCHORS['mashiv-haruach'],
      rubric: 'בחורף, בברכת גבורות, אומרים:',
      verifiedText: 'מַשִּׁיב הָרוּחַ וּמוֹרִיד הַגֶּשֶׁם',
      source: 'Yalkut Yosef, Tefillah, siman 114',
    });
  } else if (context.seasonal?.mashivHaruch === false && (prayerType === null || AMIDA_PRAYERS.has(prayerType))) {
    inline.push({
      id: 'morid-hatal',
      anchor: SIDDUR_ADDITION_ANCHORS['morid-hatal'],
      rubric: 'בקיץ, בברכת גבורות, אומרים:',
      verifiedText: 'מוֹרִיד הַטַּל',
      source: 'Yalkut Yosef, Tefillah, siman 114',
    });
  }
  if (summary.hasVetenTalUmatar && (prayerType === null || AMIDA_PRAYERS.has(prayerType))) {
    inline.push({
      id: 'veten-tal-umatar',
      anchor: SIDDUR_ADDITION_ANCHORS['veten-tal-umatar'],
      rubric: 'בברכת השנים, במקום ברכנו, אומרים:',
      verifiedText: 'וְתֵן טַל וּמָטָר לִבְרָכָה',
      source: 'Yalkut Yosef, Tefillah, siman 117',
    });
  }
  if (summary.isAseretYemeiTeshuvah && (prayerType === null || AMIDA_PRAYERS.has(prayerType))) {
    inline.push({
      id: 'hamelech-hakadosh',
      anchor: SIDDUR_ADDITION_ANCHORS['hamelech-hakadosh'],
      rubric: 'בעשרת ימי תשובה, בסיום ברכת קדושת השם, אומרים:',
      verifiedText: 'הַמֶּלֶךְ הַקָּדוֹשׁ',
      source: 'ילקוט יוסף, סימן תקפ״ב–תר״ב, סעיף ב',
    });
  }
  const anchored = new Set(inline.map(item => item.id));
  const unanchored = inserts.filter(item => !anchored.has(item.id));
  return { prayerType, dayLabel: summary.dayLabel, inserts, omissions, notes, review, inline, unanchored };
}
