// The rite's siddur, offline: Edot HaMizrach is bundled with the app and open at once; the other rites are bundled
// too, each in its own chunk, loaded from the installed package the first time it is asked for (no network). Every
// text is looked up by its full Sefaria address ("Siddur Ashkenaz, Weekday, Shacharit, Amidah, Patriarchs"), so a
// text can only ever come from the edition its address names — a rite never receives another rite's words.
import { NUSACHIM, NUSACH_INDEX, DEFAULT_NUSACH, nusachOf, nusachForReference } from '../data/nusach/registry.mjs';
import siddurOffline from '../data/siddurOffline.mjs';

const loaded = new Map([[DEFAULT_NUSACH, siddurOffline]]);
const pending = new Map();

export { nusachOf, nusachForReference };
export const siddurIndexTitle = nusach => (NUSACH_INDEX[nusach] || NUSACH_INDEX[DEFAULT_NUSACH]).index;
export const nusachForIndexTitle = title => NUSACHIM.find(item => item.index === title)?.id || null;

// The pack when it is already in memory (Edot HaMizrach always), else null.
export const loadedSiddur = nusach => loaded.get(nusach) || null;

export function loadSiddur(nusach) {
  const id = NUSACH_INDEX[nusach] ? nusach : DEFAULT_NUSACH;
  if (loaded.has(id)) return Promise.resolve(loaded.get(id));
  if (!pending.has(id)) {
    // A rite with more than one edition: one pack, the texts of every edition by their own full addresses (the
    // index tree stays the main edition's; the others are reached through the rite's compositions).
    const extras = NUSACH_INDEX[id].extras || [];
    pending.set(id, Promise.all([NUSACH_INDEX[id].load(), ...extras.map(extra => extra.load())]).then(([main, ...more]) => {
      const pack = more.length ? { ...main.default, texts: Object.assign({}, main.default.texts, ...more.map(module => module.default.texts)), editions: [main.default.source, ...more.map(module => module.default.source)], extraSchemas: more.map(module => ({ index: module.default.source.index, nodes: module.default.schema.nodes })) } : main.default;
      loaded.set(id, pack); pending.delete(id); return pack;
    }).catch(error => { pending.delete(id); throw error; }));
  }
  return pending.get(id);
}

// A bundled siddur text by address, from the packs in memory.
export function bundledSiddurText(ref) {
  const id = nusachForReference(ref);
  const pack = id ? loaded.get(id) : null;
  return pack?.texts?.[ref] || null;
}

// The same, loading the rite's pack first when the address names one.
export async function bundledSiddurTextAsync(ref) {
  const id = nusachForReference(ref);
  if (!id) return null;
  const pack = await loadSiddur(id);
  return pack?.texts?.[ref] || null;
}

// The whole pack of the address's rite (for paragraph ranges cut from a leaf).
export async function bundledSiddurFor(ref) {
  const id = nusachForReference(ref);
  return id ? loadSiddur(id) : null;
}
