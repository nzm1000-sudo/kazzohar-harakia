// Corpus packs: works with printed pagination and the layers that relate to them (translations, commentaries…).
// Each corpus has its own generated module (scripts/library/build-<corpus>.mjs → ./corpus/<corpus>.mjs); add it here.
//   zohar             — scripts/library/build-zohar.mjs
//   tanakhCommentary  — scripts/library/build-commentary.mjs --corpus tanakh  (Rashi, Ramban, Ibn Ezra, Sforno…)
//   mishnahCommentary — scripts/library/build-commentary.mjs --corpus mishnah (Bartenura, Tosafot Yom Tov)
import ZOHAR from './corpus/zohar.mjs';
import TANAKH_COMMENTARY from './corpus/tanakhCommentary.mjs';
import MISHNAH_COMMENTARY from './corpus/mishnahCommentary.mjs';

const CORPORA = [ZOHAR, TANAKH_COMMENTARY, MISHNAH_COMMENTARY];
export const CORPUS_INDEX = CORPORA.flatMap(corpus => corpus.packs);
// Layers read live from a provider in one exact edition (no copy in the bundle).
export const REMOTE_LAYERS = CORPORA.flatMap(corpus => corpus.remoteLayers || []);
// Layers that exist somewhere but are held back (BLOCKED / PERMISSION_REQUIRED): recorded, never shown as text.
export const BLOCKED_LAYERS = CORPORA.flatMap(corpus => corpus.blockedLayers || []);
export const CORPUS_REPORTS = CORPORA.flatMap(corpus => corpus.reports || []);
// Honest coverage per commentator (books and comments), bundled and remote, for the sources page and the lab.
export const COMMENTATORS = Object.freeze({
  tanakh: { bundled: TANAKH_COMMENTARY.commentators, remote: TANAKH_COMMENTARY.remoteCommentators },
  mishnah: { bundled: MISHNAH_COMMENTARY.commentators, remote: MISHNAH_COMMENTARY.remoteCommentators },
});
export default CORPUS_INDEX;
