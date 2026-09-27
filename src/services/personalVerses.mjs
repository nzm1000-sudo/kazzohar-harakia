// Personal verses ("הפסוק שלי"): up to three Tanakh verses chosen by name (one per name), said at
// the end of every Amidah — after אלהי נצור and before the closing יהיו לרצון. Pure module:
// storage in/out, and a structural insertion that never touches the prayer text itself.
export const MAX_PERSONAL_VERSES = 3;
export const PERSONAL_PROFILE_KEY = 'kz-personal-tools-v1';
export const PERSONAL_VERSE_BLOCK_PREFIX = 'personal.verse.';

const stripMarks = text => String(text || '').replace(/[֑-ׇ]/g, '').replace(/[^א-ת\s,]/g, '').replace(/\s+/g, ' ').trim();
// Structural anchors (nikud-insensitive). The closing verse is the FIRST יהיו לרצון after אלהי נצור.
export const isElohaiNetzor = text => /^אלהי,? נצ[ו]?ר/.test(stripMarks(text));
export const isYihyuLeratzon = text => /^יהיו לרצון/.test(stripMarks(text));

const defaultStorage = () => { try { return globalThis.localStorage || null; } catch { return null; } };
const readProfile = storage => { try { return JSON.parse(storage?.getItem(PERSONAL_PROFILE_KEY) || '{}') || {}; } catch { return {}; } };

export function normalizeVerse(verse) {
  if (!verse || typeof verse !== 'object' || typeof verse.text !== 'string' || !verse.text.trim()) return null;
  return { id: String(verse.id || ''), text: verse.text, reference: String(verse.reference || ''), sourceReference: String(verse.sourceReference || ''), name: String(verse.name || '') };
}

// Reads the profile; migrates the old single `personalVerse` into `personalVerses` (no write).
export function versesFromProfile(profile = {}) {
  const list = Array.isArray(profile.personalVerses) ? profile.personalVerses : profile.personalVerse ? [{ ...profile.personalVerse, name: profile.personalHebrewName || '' }] : [];
  const seen = new Set();
  return list.map(normalizeVerse).filter(Boolean).filter(verse => { const key = verse.id || verse.text; if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, MAX_PERSONAL_VERSES);
}
export const loadPersonalVerses = (storage = defaultStorage()) => versesFromProfile(readProfile(storage));

export function savePersonalVerses(verses, storage = defaultStorage()) {
  const profile = readProfile(storage);
  const next = { ...profile, personalVerses: verses.map(normalizeVerse).filter(Boolean).slice(0, MAX_PERSONAL_VERSES) };
  delete next.personalVerse; // migrated
  delete next.showPersonalVerseInSiddur; // choosing a verse is choosing to say it
  try { storage?.setItem(PERSONAL_PROFILE_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  return next.personalVerses;
}

// Inserts verse blocks before the closing יהיו לרצון that follows אלהי נצור.
// `textOf(block)` reads a block's text; `makeBlock(verse, index)` builds a block in the caller's shape.
// Returns { blocks, inserted, anchorIndex } — the input array is never mutated.
export function insertPersonalVerses(blocks, verses, { textOf, makeBlock }) {
  const list = (verses || []).map(normalizeVerse).filter(Boolean).slice(0, MAX_PERSONAL_VERSES);
  if (!Array.isArray(blocks) || !list.length) return { blocks, inserted: false, anchorIndex: -1 };
  const netzor = blocks.findIndex(block => isElohaiNetzor(textOf(block)));
  if (netzor < 0) return { blocks, inserted: false, anchorIndex: -1 };
  const closing = blocks.findIndex((block, index) => index > netzor && isYihyuLeratzon(textOf(block)));
  if (closing < 0) return { blocks, inserted: false, anchorIndex: -1 };
  const inserted = list.map((verse, index) => makeBlock(verse, index + 1));
  return { blocks: [...blocks.slice(0, closing), ...inserted, ...blocks.slice(closing)], inserted: true, anchorIndex: closing };
}
