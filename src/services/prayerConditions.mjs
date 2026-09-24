import { buildSiddurConditionSummary } from './siddurConditionEngine.mjs';

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
  return { prayerType, dayLabel: summary.dayLabel, inserts, omissions, notes, review };
}
