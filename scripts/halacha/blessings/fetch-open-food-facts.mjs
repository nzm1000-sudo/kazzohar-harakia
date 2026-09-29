// מנוע הברכות — breadth source 1: the products Open Food Facts lists as sold in Israel.
// Open Food Facts is a free database: Open Database License (ODbL) 1.0 for the database, Database Contents License
// (DbCL) 1.0 for its contents (https://world.openfoodfacts.org/terms-of-use). What is kept: the barcode, the name, the
// brand, the category tags and the ingredient ids in their order — nothing else, and never a blessing. The derived
// database (public/blessings/foods.json.gz) is offered under the same licence (docs/halacha/blessings-engine.md).
//
// The source is the official daily export (tab-separated, gzip, ~1.3 GB), streamed and filtered on the fly — the search
// API asks bots to use the export instead:
//   node scripts/halacha/blessings/fetch-open-food-facts.mjs sources/blessings/open-food-facts-israel.json.gz
//   node scripts/halacha/blessings/fetch-open-food-facts.mjs sources/blessings/open-food-facts-israel.json.gz --from <israel.tsv>
// (--from reads rows already filtered from the export, header line first.)
import { createReadStream, writeFileSync } from 'node:fs';
import { createGunzip, gzipSync } from 'node:zlib';
import { createInterface } from 'node:readline';
import { get } from 'node:https';
import { Readable } from 'node:stream';

const OUT = process.argv[2] || 'sources/blessings/open-food-facts-israel.json.gz';
const FROM = process.argv.includes('--from') ? process.argv[process.argv.indexOf('--from') + 1] : null;
const EXPORT = 'https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz';
const HEADERS = { 'User-Agent': 'KazzoharBlessingsEngine/1.0 (free offline Jewish app; build-time snapshot)' };

const open = url => new Promise((resolve, reject) => get(url, { headers: HEADERS }, response => {
  if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) { response.resume(); resolve(open(response.headers.location)); return; }
  if (response.statusCode !== 200) { reject(new Error(`HTTP ${response.statusCode}`)); return; }
  resolve(response);
}).on('error', reject));

const input = FROM ? createReadStream(FROM) : (await open(EXPORT)).pipe(createGunzip());
const lines = createInterface({ input: input instanceof Readable ? input : Readable.from(input), crlfDelay: Infinity });
let header = null;
const hebrew = text => /[א-ת]/.test(text || '');
const products = [];
const seen = new Set();
let israeli = 0;
for await (const line of lines) {
  const cells = line.split('\t');
  if (!header) { header = Object.fromEntries(cells.map((name, index) => [name, index])); continue; }
  const cell = name => (cells[header[name]] || '').trim();
  if (!cell('countries_tags').split(',').includes('en:israel')) continue;
  israeli++;
  const code = cell('code');
  const names = [cell('product_name'), cell('generic_name'), cell('abbreviated_product_name')].filter(Boolean);
  const name = names.find(hebrew);
  if (!code || !name || seen.has(code)) continue; // the engine searches in Hebrew; a product with no Hebrew name is not kept
  seen.add(code);
  products.push({
    code, name, aliases: [...new Set(names.filter(value => hebrew(value) && value !== name))], nameEn: names.find(value => !hebrew(value)) || null,
    brand: cell('brands').split(',')[0].trim() || null,
    categories: cell('categories_tags').split(',').filter(tag => tag.startsWith('en:')),
    ingredientTags: cell('ingredients_tags').split(',').filter(Boolean),
    ingredients: cell('ingredients_tags').split(',').filter(Boolean).slice(0, 8),
  });
}
writeFileSync(OUT, gzipSync(Buffer.from(JSON.stringify({ source: 'Open Food Facts', license: 'ODbL 1.0 (database), DbCL 1.0 (contents)', url: 'https://world.openfoodfacts.org', export: EXPORT, filter: 'countries_tags contains en:israel', retrieved: new Date().toISOString().slice(0, 10), israeliProducts: israeli, products })), { level: 9 }));
console.log('products sold in Israel', israeli, '· kept (Hebrew name)', products.length);
