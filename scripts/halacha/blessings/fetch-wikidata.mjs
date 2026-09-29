// מנוע הברכות — breadth source 2: food items with a Hebrew label from Wikidata (CC0), by food class.
// Only names, aliases, the class an item belongs to and what it is "made from" (P186) are kept — never a blessing:
// the blessing is decided later by build.mjs, only through the reviewed class rules of src/data/blessings/rules.mjs.
// Meat, fish, seafood and composite "dish" classes are deliberately not fetched (kashrut, and no deterministic rule).
//
//   node scripts/halacha/blessings/fetch-wikidata.mjs sources/blessings/wikidata-foods.json
import { writeFileSync } from 'node:fs';

const OUT = process.argv[2] || 'sources/blessings/wikidata-foods.json';
// class key → Wikidata class. The key is what build.mjs maps to a rule.
export const WIKIDATA_CLASSES = {
  bread: 'Q7802', flatbread: 'Q666242', cake: 'Q13276', cookie: 'Q13266', biscuit: 'Q13270', pastry: 'Q477248', pie: 'Q13360264',
  cracker: 'Q856330', friedDough: 'Q5503624', dumpling: 'Q1854639', pasta: 'Q178', noodle: 'Q192874', porridge: 'Q186817',
  breakfastCereal: 'Q768267', candy: 'Q185583', confectionery: 'Q5159627', chocolate: 'Q195', iceCream: 'Q13233', dessert: 'Q182940',
  cheese: 'Q10943', yogurt: 'Q13317', dairy: 'Q185217', soup: 'Q41415', vegetable: 'Q11004', leafVegetable: 'Q20134',
  rootVegetable: 'Q20136', fruit: 'Q3314483', berry: 'Q13184', nut: 'Q11009', legume: 'Q145909', juice: 'Q8492', fruitJuice: 'Q20932605',
  softDrink: 'Q147538', wine: 'Q282', beer: 'Q44', liqueur: 'Q178780', tea: 'Q6097', herbalTea: 'Q379932', coffeeDrink: 'Q37756327',
};

const query = cls => `SELECT ?item ?he ?en (GROUP_CONCAT(DISTINCT ?alt; separator="|") AS ?alts) (GROUP_CONCAT(DISTINCT ?mat; separator="|") AS ?mats) WHERE {
  ?item (wdt:P31|wdt:P279)/wdt:P279* wd:${cls} .
  ?item rdfs:label ?he . FILTER(LANG(?he) = "he")
  FILTER NOT EXISTS { ?item wdt:P31 wd:Q16521 }
  FILTER NOT EXISTS { ?item wdt:P31 wd:Q4167410 }
  OPTIONAL { ?item rdfs:label ?en . FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item skos:altLabel ?alt . FILTER(LANG(?alt) = "he") }
  OPTIONAL { ?item wdt:P186 ?mat }
} GROUP BY ?item ?he ?en LIMIT 4000`;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const items = new Map();
for (const [key, cls] of Object.entries(WIKIDATA_CLASSES)) {
  let rows = null;
  for (let attempt = 0; attempt < 4 && !rows; attempt++) {
    try {
      const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query(cls))}`;
      const response = await fetch(url, { headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'KazzoharBlessingsEngine/1.0 (free offline app; build-time snapshot)' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      rows = (await response.json()).results.bindings;
    } catch (error) { console.error(key, error.message); await sleep(8000); }
  }
  for (const row of rows || []) {
    const id = row.item.value.replace(/^.*\//, '');
    const entry = items.get(id) || { id, he: row.he.value, en: row.en?.value || null, alts: [], mats: [], classes: [] };
    entry.alts = [...new Set([...entry.alts, ...(row.alts?.value ? row.alts.value.split('|') : [])])];
    entry.mats = [...new Set([...entry.mats, ...(row.mats?.value ? row.mats.value.split('|').map(uri => uri.replace(/^.*\//, '')) : [])])];
    if (!entry.classes.includes(key)) entry.classes.push(key);
    items.set(id, entry);
  }
  console.log(key, rows ? rows.length : 'failed');
  await sleep(1500);
}
writeFileSync(OUT, JSON.stringify({ source: 'Wikidata', license: 'CC0 1.0', retrieved: new Date().toISOString().slice(0, 10), classes: WIKIDATA_CLASSES, items: [...items.values()].sort((a, b) => a.id.localeCompare(b.id)) }, null, 0));
console.log('items', items.size);
