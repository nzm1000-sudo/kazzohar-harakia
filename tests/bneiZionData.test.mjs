// The generated "בני ציון" data (scripts/bnei-zion/ → src/data/torahContent/, public/torah-content/packs/) honours its
// contract (docs/bnei-zion/SCHEMA.md): unique ids, full source and rights on every article, the author, canonical
// parashot and known festival ids only, readable Hebrew with no leaflet header/footer inside, and packs that match
// their checksums. Run: npx -y node@20 --test tests/bneiZionData.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { checksum } from '../src/services/prayer/checksum.mjs';
import { HOLIDAYS, PARASHOT, SPECIAL_SHABBATOT } from '../src/services/torahTaxonomy.mjs';

const root = new URL('../', import.meta.url);
const indexFile = new URL('src/data/torahContent/index.mjs', root);
const searchFile = new URL('public/torah-content/search.json.gz', root);
const packDir = new URL('public/torah-content/packs/', root);
const HEADER = 'Generated from the authorized Bnei Zion source archive. Do not hand-edit generated files. Run the ingestion pipeline instead.';
const present = existsSync(indexFile);
const CONTENT_TYPES = new Set(['dvar-torah', 'story', 'mashal', 'chizuk', 'commentary', 'family', 'general']);
const TOPICS = new Set(['אמונה', 'ביטחון', 'תפילה', 'שבת', 'חינוך ילדים', 'שלום בית', 'כיבוד הורים', 'חסד', 'צדקה', 'פרנסה', 'מידות', 'שמירת הלשון', 'תשובה', 'שמחה', 'אהבת ישראל', 'תורה', 'מצוות', 'יראת שמים', 'גאולה', 'ניסיונות', 'הכרת הטוב']);
const strip = s => String(s).replace(/[֑-ׇ]/g, '');

const load = async () => {
  const index = (await import(indexFile)).default;
  const searchGz = readFileSync(searchFile);
  const searchText = gunzipSync(searchGz).toString('utf8');
  const search = JSON.parse(searchText);
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', packDir), 'utf8'));
  const packs = {};
  const raw = {};
  for (const [name, info] of Object.entries(manifest.packs)) {
    const gz = readFileSync(new URL(info.file, packDir));
    raw[name] = { gz, text: gunzipSync(gz).toString('utf8') };
    packs[name] = JSON.parse(raw[name].text);
  }
  return { index, search, searchGz, searchText, manifest, packs, raw };
};

test('bnei zion: generated data present with its header', { skip: !present && 'not generated yet' }, () => {
  assert.ok(readFileSync(indexFile, 'utf8').includes(HEADER), 'index.mjs lacks the generated-file header');
  assert.equal(JSON.parse(readFileSync(new URL('manifest.json', packDir), 'utf8')).generated, HEADER);
  assert.equal(JSON.parse(gunzipSync(readFileSync(searchFile)).toString('utf8')).generated, HEADER);
  assert.ok(!existsSync(new URL('src/data/torahContent/search.mjs', root)), 'the search fields ship as a gzip, not a module');
});

test('bnei zion: ids unique, every article has a body in its pack', { skip: !present && 'not generated yet' }, async () => {
  const { index, packs } = await load();
  assert.ok(index.articles.length > 0);
  const ids = index.articles.map(a => a.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate ids');
  for (const a of index.articles) {
    assert.match(a.id, /^bz-[0-9a-f]{10}$/);
    assert.ok(packs[a.pack]?.articles?.[a.id], `${a.id} missing from pack ${a.pack}`);
    assert.ok(index.packs[a.pack], `${a.pack} not in the index pack table`);
  }
  const packIds = Object.values(packs).flatMap(p => Object.keys(p.articles));
  assert.equal(packIds.length, ids.length, 'packs hold articles the index does not list');
});

test('bnei zion: source, author and permission on every article', { skip: !present && 'not generated yet' }, async () => {
  const { packs } = await load();
  for (const pack of Object.values(packs)) for (const [id, body] of Object.entries(pack.articles)) {
    assert.equal(body.source.collection, 'בני ציון', id);
    assert.equal(body.source.author, 'משה מזרחי', id);
    assert.ok(body.source.originalPdf && /\.pdf$/.test(body.source.originalPdf), `${id} originalPdf`);
    assert.ok(Number.isInteger(body.source.pageStart) && body.source.pageStart >= 1 && body.source.pageEnd >= body.source.pageStart, `${id} pages`);
    assert.equal(body.rights.permission, 'granted', id);
    assert.equal(body.rights.creditRequired, true, id);
    assert.equal(body.status, 'published', id);
    assert.ok(Array.isArray(body.sourceAppearances) && body.sourceAppearances.length >= 1, `${id} appearances`);
    for (const ap of body.sourceAppearances) assert.ok(ap.originalPdf && ap.pageStart >= 1, `${id} appearance`);
    assert.ok(!/nzm1000|@gmail\.com/.test(JSON.stringify(body)), `${id} carries a private address`);
  }
});

test('bnei zion: canonical parashot, known festivals, special Shabbatot, types and topics only', { skip: !present && 'not generated yet' }, async () => {
  const { index } = await load();
  const holidayIds = new Set(HOLIDAYS.map(h => h.id));
  const specialIds = new Set(SPECIAL_SHABBATOT.map(s => s.id));
  for (const a of index.articles) {
    for (const p of a.parashot) assert.ok(PARASHOT.includes(p), `${a.id}: "${p}" is not a canonical parasha`);
    for (const h of a.holidays) assert.ok(holidayIds.has(h), `${a.id}: unknown festival ${h}`);
    for (const s of a.specialShabbatot) assert.ok(specialIds.has(s), `${a.id}: unknown special Shabbat ${s}`);
    for (const t of a.topics) assert.ok(TOPICS.has(t), `${a.id}: unknown topic ${t}`);
    assert.ok(CONTENT_TYPES.has(a.contentType), `${a.id}: contentType ${a.contentType}`);
    assert.ok(a.parashot.length || a.holidays.length || a.specialShabbatot.length || a.contentType === 'general', `${a.id}: no assignment`);
    assert.ok(Number.isInteger(a.readMinutes) && a.readMinutes >= 1, `${a.id}: readMinutes`);
    assert.ok(strip(a.title).trim().length > 1, `${a.id}: title`);
    // Short titles (owner's decision): a few of the author's words; the full heading line rides along exactly.
    assert.ok(a.title.split(/\s+/).length <= 8, `${a.id}: title too long "${a.title}"`);
    assert.ok(!/[\u0591-\u05C7]/.test(a.title), `${a.id}: short title is unpointed`);
    if (a.heading) assert.ok(strip(a.heading).trim().length > 0);
    assert.ok(['short', 'medium', 'long'].includes(a.length), `${a.id}: length`);
  }
  for (const [name, n] of Object.entries(index.parashot)) { assert.ok(PARASHOT.includes(name)); assert.equal(n, index.articles.filter(a => a.parashot.includes(name)).length); }
  for (const [id] of Object.entries(index.holidays)) assert.ok(holidayIds.has(id));
});

test('bnei zion: published text is readable Hebrew, never gibberish or leaflet chrome', { skip: !present && 'not generated yet' }, async () => {
  const { packs } = await load();
  for (const pack of Object.values(packs)) for (const [id, body] of Object.entries(pack.articles)) {
    assert.ok(body.paragraphs.length > 0 && body.paragraphs.every(p => typeof p === 'string' && p.trim()), `${id}: empty paragraph`);
    const text = strip(body.paragraphs.join(' '));
    const heb = (text.match(/[א-ת]/g) || []).length;
    const latin = (text.match(/[A-Za-z]/g) || []).length;
    assert.ok(heb >= 40, `${id}: too little Hebrew`);
    assert.ok(heb / (heb + latin) > 0.9, `${id}: Hebrew ratio`);
    assert.ok(!/[�À-ÿ]/.test(text), `${id}: undecoded glyphs`);
    // Final letters in mid-word betray reversed or scrambled text.
    const words = text.split(/[^א-ת]+/).filter(w => w.length > 1);
    const misplaced = words.filter(w => /[ךםןףץ]./.test(w)).length;
    // (a few are the author's own spelling: "אלקיךךךך", a list of the final letters, two words printed together)
    assert.ok(misplaced <= 3 || misplaced / words.length < 0.01, `${id}: ${misplaced} words with misplaced final letters`);
    assert.ok(!/(?<![בלה])פרשת השבוע\s*:|כניסת השבת\s*:|bnei-zion\.com|moshe45|לקבלת העלון|קדושת הגי?ליון/.test(text), `${id}: leaflet header/footer inside`);
    assert.ok(!body.paragraphs.some(p => /^\s*\d{1,3}\s*$/.test(p)), `${id}: stray page number`);
    // Owner's decision: no private contact details.
    assert.ok(!/(?<!\d)0\d{1,2}-?\d{3}-?\d{4}(?!\d)|(?<!\d)05\d-?\d{7}(?!\d)/.test(text), `${id}: phone number`);
    assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(text), `${id}: e-mail address`);
  }
});

test('bnei zion: packs and search match their checksums; search fields cover the index', { skip: !present && 'not generated yet' }, async () => {
  const { index, search, searchGz, searchText, manifest, raw } = await load();
  assert.equal(checksum(searchText), manifest.search.checksum, 'search checksum');
  assert.equal(createHash('sha256').update(searchGz).digest('hex'), manifest.search.sha256, 'search sha256');
  assert.equal(index.search.checksum, manifest.search.checksum);
  assert.equal(index.search.file, manifest.search.file);
  assert.equal(index.version, manifest.version);
  for (const [name, info] of Object.entries(manifest.packs)) {
    assert.equal(checksum(raw[name].text), info.checksum, `${name}: checksum`);
    assert.equal(createHash('sha256').update(raw[name].gz).digest('hex'), info.sha256, `${name}: sha256`);
    assert.equal(raw[name].gz.length, info.bytes, `${name}: size`);
    assert.equal(index.packs[name].checksum, info.checksum);
    assert.equal(index.packs[name].file, info.file);
  }
  const ids = new Set(index.articles.map(a => a.id));
  assert.equal(search.docs.length, ids.size);
  for (const doc of search.docs) {
    assert.ok(ids.has(doc.id));
    for (const f of ['t', 'm', 'x']) assert.equal(typeof doc[f], 'string');
    assert.ok(!/[֑-ׇ]/.test(doc.x + doc.t), `${doc.id}: search fields must be unpointed`);
  }
});
