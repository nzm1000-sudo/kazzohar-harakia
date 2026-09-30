// Which reader family a text belongs to, for the word lookup (data-lookup="<family>" on the text container). null: the
// dictionary stays out of that text — the Tanakh (but for Daniel and Ezra, with their Aramaic chapters) and the Mishnah
// themselves (Hebrew the reader reads as it is), reference works. The siddur's readers mark their prayer blocks
// data-lookup="liturgy" themselves: only the Aramaic of the liturgy (Kaddish, Brikh Shmeh …) is glossed there.
const BY_CATEGORY = Object.freeze({
  talmud: 'talmud',
  'talmud-commentary': 'talmud-commentary',
  rishonim: 'talmud-commentary',
  acharonim: 'torah',
  'tanakh-commentary': 'tanakh-commentary',
  'mishnah-commentary': 'mishnah-commentary',
  midrash: 'midrash',
  halacha: 'halacha',
  mitzvot: 'halacha',
  minhagim: 'halacha',
  rambam: 'rambam',
  responsa: 'responsa',
  kabbalah: 'kabbalah',
  chassidut: 'chassidut',
  machshava: 'machshava',
  mussar: 'mussar',
  toldot: 'torah',
  tanakh: null,
  mishnah: null,
  tefillah: 'liturgy', // the Haggadah (הא לחמא עניא); only its Aramaic forms are glossed
  reference: null,
});

const isTargum = work => /onkelos|targum/i.test(`${work?.workId || ''} ${work?.title || ''}`) || /תרגום|אונקלוס/.test(`${work?.title || ''} ${work?.heTitle || ''}`);

// A library work read as a book (its base text).
export function lookupFamilyForWork(work) {
  if (!work) return null;
  if (work.workId === 'Zohar' || /^Zohar/.test(work.workId || '') && !/on_Zohar|Zohar_on/i.test(work.workId || '')) return 'zohar';
  if (isTargum(work)) return 'targum';
  // Daniel and Ezra: their Aramaic chapters (only the Biblical Aramaic forms are glossed; their Hebrew is not).
  if (/^(Daniel|Ezra)$/.test(work.workId || '')) return 'biblical-aramaic';
  const family = BY_CATEGORY[work.primaryCategory];
  return family === undefined ? 'torah' : family;
}

// A layer beside a base text (a commentary, or a translation such as Onkelos).
export function lookupFamilyForLayer(layer) {
  const work = layer?.work || layer;
  if (!work) return null;
  if (layer?.relationType === 'translation' || work.relationType === 'translation') return isTargum(work) ? 'targum' : null;
  return lookupFamilyForWork(work) || 'torah';
}

// A text opened by SourceReader, by its Sefaria-style category (Tanakh and liturgy stay out).
export function lookupFamilyForCategory(category = '') {
  const value = String(category || '');
  if (!value || /^(Tanakh|Liturgy|Mishnah)$/i.test(value)) return null;
  if (/Talmud/i.test(value)) return 'talmud';
  if (/Halakh|Halach/i.test(value)) return 'halacha';
  if (/Kabbal/i.test(value)) return 'kabbalah';
  if (/Midrash/i.test(value)) return 'midrash';
  if (/Chasid/i.test(value)) return 'chassidut';
  if (/Musar/i.test(value)) return 'mussar';
  if (/Responsa/i.test(value)) return 'responsa';
  if (/Jewish Thought|Philosophy/i.test(value)) return 'machshava';
  return 'torah';
}
