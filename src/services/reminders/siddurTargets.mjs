// Where המזכיר היהודי's prayer targets open in the Siddur: a row of the rite's own table of contents (services/
// siddurIndex.mjs items: { rootEn, en, … }), found by the edition's English titles. A rite whose edition has no such
// text has none — the reminder's screen says so, and a tap opens the Siddur's home instead (never another rite's text).
const PATTERNS = Object.freeze({
  'bedtime-shema': /bedtime shema/i,
  'tikkun-chatzot': /midnight rite|tikkun chatzot/i,
  'birkot-hashachar': /morning blessings/i,
  levana: /blessing of the moon|kiddush levana|birkat halevana|bircat levana|sanctification of the moon/i,
  ilanot: /blessing of the trees|ilanot/i,
  chanukah: /menorah lighting|lighting chanukah candles|chanukah candles/i,
});
export const SIDDUR_TARGETS = Object.freeze(Object.keys(PATTERNS));

/** The Siddur row for a target among the rite's rows, or null. Tikkun Chatzot opens the start of its root. */
export function siddurTargetItem(target, items = []) {
  const pattern = PATTERNS[target];
  if (!pattern) return null;
  if (target === 'tikkun-chatzot') return items.find(item => pattern.test(item.rootEn)) || items.find(item => pattern.test(item.en)) || null;
  return items.find(item => pattern.test(`${item.rootEn} ${item.en}`)) || null;
}

// Which rites hold each text in the app (checked against the bundled editions in tests/mazkir.test.mjs).
export const SIDDUR_TEXT_AVAILABILITY = Object.freeze({
  'bedtime-shema': ['edot-hamizrach', 'sefard', 'chabad'],
  'tikkun-chatzot': ['edot-hamizrach'],
  'birkot-hashachar': ['edot-hamizrach', 'sefard', 'chabad'],
  levana: ['edot-hamizrach', 'sefard', 'ashkenaz', 'chabad'],
  ilanot: ['edot-hamizrach'],
  chanukah: ['edot-hamizrach', 'sefard', 'ashkenaz'],
});
export const siddurHasText = (target, nusach = 'edot-hamizrach') => (SIDDUR_TEXT_AVAILABILITY[target] || []).includes(nusach || 'edot-hamizrach');
