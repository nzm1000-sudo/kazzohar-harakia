// Dialect profiles of the resolver — shared by the build and the app. A profile is where a word is read: its corpus
// decides which of a lemma's senses fits (by the corpora the dictionary cites for each sense), which forms are Hebrew
// there (never glossed), and which phrases apply.
export const PROFILES = Object.freeze({
  J: { id: 'J', name: 'bavli', dialect: 'JBA', corpora: ['bavli'], evidence: ['bavli', 'mishnah', 'tosefta'] },
  Y: { id: 'Y', name: 'yerushalmi', dialect: 'JPA', corpora: ['yerushalmi'], evidence: ['yerushalmi', 'midrash', 'targum'] },
  M: { id: 'M', name: 'midrash', dialect: 'JPA', corpora: ['midrash'], evidence: ['midrash', 'yerushalmi', 'targum', 'bavli'] },
  T: { id: 'T', name: 'onkelos', dialect: 'TARGUMIC', corpora: ['onkelos'], evidence: ['targum', 'tanakh'] },
  Z: { id: 'Z', name: 'zohar', dialect: 'ZOHARIC', corpora: ['zohar', 'tikkunei-zohar', 'zohar-chadash'], evidence: ['zohar', 'targum', 'bavli', 'midrash'] },
  B: { id: 'B', name: 'biblical-aramaic', dialect: 'BIBLICAL_ARAMAIC', corpora: ['biblical-aramaic'], evidence: ['tanakh', 'targum'] },
  L: { id: 'L', name: 'liturgy', dialect: 'LITURGICAL_ARAMAIC', corpora: ['liturgy'], evidence: ['targum', 'bavli', 'zohar'] },
  X: { id: 'X', name: 'mixed', dialect: 'MIXED_RABBINIC', corpora: ['talmud-commentary', 'other-commentary', 'other', 'minor-tractates'], evidence: ['bavli', 'yerushalmi', 'midrash'] },
});
export const PROFILE_IDS = Object.freeze(Object.keys(PROFILES));
export const profileOfCorpus = corpusId => PROFILE_IDS.find(id => PROFILES[id].corpora.includes(corpusId)) || 'X';

// The profile of a tap: the reader family (data-lookup) and, where it says more, the work (data-lookup-work).
export function profileOf(family = '', workId = '') {
  const work = String(workId || '');
  switch (family) {
    case 'talmud': return /^Jerusalem_Talmud_/.test(work) ? 'Y' : !work || /^Bavli_/.test(work) ? 'J' : 'X';
    case 'zohar': return 'Z';
    case 'kabbalah': return /^(Tikkunei_Zohar|Zohar_Chadash|Zohar)$/.test(work) ? 'Z' : 'X';
    case 'targum': return 'T';
    case 'biblical-aramaic': return 'B';
    case 'liturgy': return 'L';
    case 'midrash': return 'M';
    default: return 'X';
  }
}

// Reader groups of the abbreviation layer (the build decides an abbreviation per group; the data module names a group
// "@talmud", "@kabbalah", "@rabbinic" — expanded to its reader families when the dictionary is parsed).
export const READER_GROUPS = Object.freeze({
  talmud: Object.freeze(['talmud', 'talmud-commentary']),
  kabbalah: Object.freeze(['zohar', 'kabbalah', 'chassidut']),
  rabbinic: Object.freeze(['mishnah-commentary', 'tanakh-commentary', 'targum', 'midrash', 'halacha', 'rambam', 'responsa', 'machshava', 'mussar', 'torah', 'liturgy', 'biblical-aramaic']),
});
export const expandReaderGroups = profiles => (String(profiles).includes('@') ? String(profiles).split(',').flatMap(p => (p[0] === '@' ? READER_GROUPS[p.slice(1)] || [] : [p])).join(',') : profiles);
