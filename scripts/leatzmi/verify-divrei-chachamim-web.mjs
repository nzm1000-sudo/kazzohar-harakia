// Re-reads the sayings of scripts/leatzmi/divrei-chachamim-web.mjs from their sources online and checks each, letter for
// letter (nikud, punctuation and bracketed verse references aside), against the text it cites.
//   • source 'sefaria': the exact segment (sefariaRef) in the exact Hebrew version the book names.
//   • source 'bundled': the same place on Sefaria (the amud and the next one for the Talmud, the halacha / mishnah
//     otherwise), in the edition the app bundles — an online check beside the offline one the tests make.
// Network only (nothing is written to the repo). A neutral User-Agent; nothing personal is sent.
// Run: node scripts/leatzmi/verify-divrei-chachamim-web.mjs [--sample 100] [--seed 1]
import { WEB_BOOKS, WEB_SAYINGS } from './divrei-chachamim-web.mjs';
import { workById } from '../../src/data/library/registry.mjs';

const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; text-verification)', Accept: 'application/json' };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const letters = text => String(text).replace(/־/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\([^()]*\)/g, ' ').replace(/[֑-ׇ]/g, '').replace(/[^א-ת]/g, '');

async function fetchText(ref, version) {
  const query = version ? `?version=${encodeURIComponent(`hebrew|${version}`)}&return_format=text_only` : '?version=hebrew&return_format=text_only';
  const url = `https://www.sefaria.org/api/v3/texts/${encodeURIComponent(ref)}${query}`;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: HEADERS });
      if (response.ok) {
        const data = await response.json();
        return (data.versions || []).map(v => [].concat(v.text ?? '').flat(9).join(' ')).join(' ');
      }
      if (response.status < 500 && response.status !== 429) return null;
    } catch { /* retry */ }
    await sleep(700 * attempt);
  }
  return null;
}

// The Sefaria reference (and version) to read for a saying.
function targets(item) {
  const book = WEB_BOOKS[item.book];
  if (book.source === 'sefaria') return [{ ref: item.sefariaRef, version: book.digital.version }];
  const path = decodeURIComponent(new URL(item.provenanceUrl).pathname.slice(1));
  const edition = workById(book.bundled)?.editions[0];
  const version = edition?.title || null;
  const talmud = path.match(/^(.+)\.(\d+)([ab])$/);
  if (talmud) {
    const [, tractate, daf, side] = talmud;
    const next = side === 'a' ? `${daf}b` : `${Number(daf) + 1}a`;
    return [{ ref: `${tractate.replace(/_/g, ' ')} ${daf}${side}-${next}`, version: 'Wikisource Talmud Bavli' }];
  }
  const segment = path.match(/^(.+)\.(\d+)\.(\d+)$/);
  if (segment) return [{ ref: `${segment[1].replace(/_/g, ' ')} ${segment[2]}:${segment[3]}`, version }, { ref: `${segment[1].replace(/_/g, ' ')} ${segment[2]}`, version: null }];
  const numbered = path.match(/^(.+)\.(\d+)$/);
  if (numbered) return [{ ref: `${numbered[1].replace(/_/g, ' ')} ${numbered[2]}`, version }, { ref: `${numbered[1].replace(/_/g, ' ')} ${numbered[2]}`, version: null }];
  return [{ ref: path.replace(/_/g, ' '), version: null }];
}

let pool = WEB_SAYINGS;
const sample = Number(arg('--sample', 0));
if (sample) {
  let seed = Number(arg('--seed', 1)) >>> 0;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  pool = [...WEB_SAYINGS].map(item => [random(), item]).sort((a, b) => a[0] - b[0]).slice(0, sample).map(([, item]) => item);
}
let confirmed = 0;
const failed = [];
for (const item of pool) {
  let ok = false;
  for (const { ref, version } of targets(item)) {
    const text = await fetchText(ref, version);
    await sleep(120);
    if (text && letters(text).includes(letters(item.text))) { ok = true; break; }
  }
  if (ok) confirmed += 1; else failed.push(`${item.id} (${item.ref}) ${item.provenanceUrl}`);
}
console.log(`${pool.length} checked online: ${confirmed} confirmed, ${failed.length} not confirmed (${(100 * failed.length / pool.length).toFixed(1)}%)`);
for (const line of failed) console.log('  not confirmed:', line);
process.exitCode = failed.length ? 1 : 0;
