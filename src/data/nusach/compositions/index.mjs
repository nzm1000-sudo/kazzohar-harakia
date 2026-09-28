// The composed services of every rite: nusach id → composition (services by schema id). Small data, bundled with the
// app; the words themselves stay in each rite's own pack.
import ashkenaz from './ashkenaz.mjs';
import sefard from './sefard.mjs';
import chabad from './chabad.mjs';
import edot from './edot.mjs';

export const COMPOSITIONS = { 'edot-hamizrach': edot, ashkenaz, sefard, chabad };
export const compositionOf = nusach => COMPOSITIONS[nusach] || null;
export const composedServiceIds = nusach => Object.keys(COMPOSITIONS[nusach]?.services || {});
