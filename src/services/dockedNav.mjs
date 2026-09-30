// Which reader navigation is docked in the header right now.
// Every reader with previous / next (a prayer's sections, a Talmud tractate's pages, a Tehillim chapter, a library
// unit…) registers its bar here; the header then gives it the search's place, so previous / next always sit in one
// fixed place at the top instead of floating over the text. When two bars are mounted at once (a prayer flow and its
// end-of-reading links), the one with a contents list wins, and among equals the latest one.
const entries = [];
const listeners = new Set();
let sequence = 0;
const emit = () => { for (const listener of listeners) listener(); };

export function registerDockedNav(priority = 0) {
  const entry = { id: ++sequence, priority };
  entries.push(entry);
  emit();
  return {
    id: entry.id,
    release() {
      const index = entries.indexOf(entry);
      if (index >= 0) { entries.splice(index, 1); emit(); }
    },
  };
}

// The id of the bar that owns the header slot, or 0 when no reader navigation is mounted.
export function dockedNavOwner() {
  let owner = null;
  for (const entry of entries) if (!owner || entry.priority >= owner.priority) owner = entry;
  return owner ? owner.id : 0;
}

export const hasDockedNav = () => entries.length > 0;

export function subscribeDockedNav(listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
