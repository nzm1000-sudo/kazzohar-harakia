// Corpus packs: works with printed pagination and the layers that relate to them (translations, commentaries…).
// Each corpus has its own generated module (scripts/library/build-<corpus>.mjs → ./corpus/<corpus>.mjs); add it here.
//   zohar             — scripts/library/build-zohar.mjs
//   tanakhCommentary  — scripts/library/build-commentary.mjs --corpus tanakh  (Rashi, Ramban, Ibn Ezra, Sforno…)
//   mishnahCommentary — scripts/library/build-commentary.mjs --corpus mishnah (Bartenura, Tosafot Yom Tov)
//   ongShabbat        — scripts/library/build-ong-shabbat.mjs (עונג שבת and its "מקורות וטעמים"; author-permission)
//   talmud            — scripts/library/build-talmud.mjs (the Bavli, Wikisource; Rashi, Tosafot, Rif; remote Rishonim)
//   shulchanArukhCommentary — scripts/library/build-shulchan-arukh-commentary.mjs (Mishnah Berurah, Biur Halacha,
//                       Be'er Heitev, Kaf HaChaim on Orach Chayim; the other nosei kelim remote)
//   beitYosef         — scripts/library/build-beit-yosef.mjs (the Beit Yosef, four parts, Vilna 1923; a layer of the Tur)
import ZOHAR from './corpus/zohar.mjs';
import TANAKH_COMMENTARY from './corpus/tanakhCommentary.mjs';
import MISHNAH_COMMENTARY from './corpus/mishnahCommentary.mjs';
import ONG_SHABBAT from './corpus/ongShabbat.mjs';
import TALMUD from './corpus/talmud.mjs';
import SHULCHAN_ARUKH_COMMENTARY from './corpus/shulchanArukhCommentary.mjs';
import BEIT_YOSEF from './corpus/beitYosef.mjs';

const CORPORA = [ZOHAR, TANAKH_COMMENTARY, MISHNAH_COMMENTARY, ONG_SHABBAT, TALMUD, SHULCHAN_ARUKH_COMMENTARY, BEIT_YOSEF];
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
// The Talmud layer: the Gemara's coverage, the bundled commentators (Rashi, Tosafot, Rif) and the remote Rishonim.
export const TALMUD_COVERAGE = Object.freeze({ base: TALMUD.base, bundled: TALMUD.commentators, remote: TALMUD.remoteCommentators, heldBack: TALMUD.heldBack });
// The Shulchan Arukh's commentaries: each bundled work with its honest coverage, and the ones read live.
export const SHULCHAN_ARUKH_COVERAGE = Object.freeze({ bundled: SHULCHAN_ARUKH_COMMENTARY.commentators, remote: SHULCHAN_ARUKH_COMMENTARY.remoteCommentators });
export default CORPUS_INDEX;
