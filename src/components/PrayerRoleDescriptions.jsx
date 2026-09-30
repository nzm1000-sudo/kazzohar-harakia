import { useId } from 'react';

// In the Siddur an instruction, an editor's note and a source reference each have their own look; a screen reader hears
// that difference too. The paragraph itself is untouched (its words, its markup, what is copied): it only points
// (aria-describedby) at one hidden word — "הוראה", "הערה" or "מקור" — which is read after it. Nothing here is visible.
const WORDS = { instruction: 'הוראה', note: 'הערה', reference: 'מקור' };

export function prayerRoleOf(block = {}) {
  const { type, display, legacyType } = block;
  if (type === 'instruction' || legacyType === 'instruction' || display === 'instruction') return 'instruction';
  if (type === 'note' || legacyType === 'note' || display === 'commentary' || display === 'minhag') return 'note';
  if (type === 'source' || display === 'reference') return 'reference';
  return null;
}

// One set of ids per rendered document.
export function usePrayerRoleIds() {
  const base = useId().replace(/:/g, '');
  return { instruction: `${base}-instruction`, note: `${base}-note`, reference: `${base}-reference` };
}

export const describedByFor = (ids, block) => { const role = prayerRoleOf(block); return role ? ids[role] : undefined; };

// The hidden words themselves (display:none; still read through aria-describedby).
export function PrayerRoleDescriptions({ ids }) {
  return Object.entries(WORDS).map(([role, word]) => <span key={role} id={ids[role]} hidden>{word}</span>);
}
