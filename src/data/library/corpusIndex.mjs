// Corpus packs: works with printed pagination and the layers that relate to them (translations, commentaries…).
// Each corpus has its own generated module (scripts/library/build-<corpus>.mjs → ./corpus/<corpus>.mjs); add it here.
import ZOHAR from './corpus/zohar.mjs';

const CORPORA = [ZOHAR];
export const CORPUS_INDEX = CORPORA.flatMap(corpus => corpus.packs);
// Layers read live from a provider in one exact edition (no copy in the bundle).
export const REMOTE_LAYERS = CORPORA.flatMap(corpus => corpus.remoteLayers || []);
// Layers that exist somewhere but are held back (BLOCKED / PERMISSION_REQUIRED): recorded, never shown as text.
export const BLOCKED_LAYERS = CORPORA.flatMap(corpus => corpus.blockedLayers || []);
export const CORPUS_REPORTS = CORPORA.flatMap(corpus => corpus.reports || []);
export default CORPUS_INDEX;
