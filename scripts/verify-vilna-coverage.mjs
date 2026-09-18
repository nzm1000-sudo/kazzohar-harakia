const refs = [
  'Berakhot 2a', 'Berakhot 64a', 'Shabbat 31a', 'Eruvin 13b', 'Pesachim 2a',
  'Yoma 85b', 'Sukkah 5a', 'Beitzah 2a', 'Rosh Hashanah 2a', 'Taanit 2a',
  'Megillah 2a', 'Moed Katan 27b', 'Chagigah 2a', 'Yevamot 2a', 'Ketubot 2a',
  'Nedarim 2a', 'Nazir 2a', 'Sotah 48b', 'Gittin 2a', 'Kiddushin 2a',
  'Bava Kamma 2a', 'Bava Metzia 59b', 'Bava Batra 2a', 'Sanhedrin 13b', 'Makkot 2a',
  'Shevuot 2a', 'Avodah Zarah 2a', 'Horayot 2a', 'Zevachim 2a', 'Menachot 2a',
  'Chullin 141a', 'Bekhorot 2a', 'Arakhin 2a', 'Temurah 2a', 'Keritot 2a',
  'Meilah 2a', 'Tamid 25b',
];

const endpoint = ref => `https://www.sefaria.org/api/manuscripts/${encodeURIComponent(ref)}`;
const isRomm = record => [record.manuscript_slug, record.manuscript?.slug, record.manuscript?.title, record.manuscript?.he_title]
  .filter(Boolean).join(' ').toLowerCase().match(/romm[ -]vilna|vilna[ -]romm|דפוס וילנא/);
const exact = (records, ref) => records.find(r => isRomm(r) && r.page_id === ref)
  || records.find(r => isRomm(r) && r.anchorRef === ref)
  || records.find(r => isRomm(r) && r.anchorRefExpanded?.includes(ref));

async function imageLoads(url) {
  if (!url) return false;
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

const results = [];
for (const ref of refs) {
  const result = { ref, api: false, romm: false, image: false, exact: false, fallback: false };
  try {
    const response = await fetch(endpoint(ref));
    result.api = response.ok;
    const records = response.ok ? await response.json() : [];
    const record = exact(records, ref);
    result.romm = Boolean(record);
    result.image = await imageLoads(record?.image_url);
    result.exact = Boolean(record && (record.page_id === ref || record.anchorRef === ref || record.anchorRefExpanded?.includes(ref)));
  } catch (error) {
    result.error = error.message;
  }
  results.push(result);
  console.log(`${result.ref}\tAPI ${result.api ? 'yes' : 'no'}\tRomm ${result.romm ? 'yes' : 'no'}\timage ${result.image ? 'yes' : 'no'}\texact ${result.exact ? 'yes' : 'no'}`);
}

const count = key => results.filter(result => result[key]).length;
console.log('\nSummary');
console.log(`tested: ${results.length}`);
console.log(`API responses: ${count('api')}`);
console.log(`Romm Vilna records: ${count('romm')}`);
console.log(`usable images: ${count('image')}`);
console.log(`exact refs/locations: ${count('exact')}`);
console.log('Commons fallbacks: 0 in this API coverage run (fallbacks remain in the app for verified mapped dapim).');
console.log(`unavailable: ${results.length - count('romm')}`);