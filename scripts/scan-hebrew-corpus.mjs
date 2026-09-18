// Corpus-wide Hebrew rendering diagnostic.
// Samples live Sefaria text across Torah / Nevi'im / Ketuvim / Siddur / Talmud / Halacha plus the
// bundled Tehillim JSON, runs each through its content-type policy, and reports:
//   - U+FFFD, literal tofu (U+25A1/U+25A0/U+2B1C), private-use, control and bidi/format characters
//   - HTML/entity remnants after normalization
//   - any code point that the reading font stack has no glyph for (real cmap of the shipped fonts)
//   - code points introduced or removed by normalization (beyond HTML/whitespace and policy-defined marks)
// Usage: node scripts/scan-hebrew-corpus.mjs            (exit code 1 on findings)
import { readFileSync } from 'node:fs';
import { normalizeHebrewText, stripHtml } from '../src/hebrewText.mjs';
import { policyFor } from '../src/services/sefaria.mjs';
import { sanitizeHebrewHtml, stripToText } from '../src/hebrewHtml.mjs';
import { woffCodePoints, hex } from './font-cmap.mjs';

const FONTS = {
  reading: ['node_modules/@fontsource/noto-serif-hebrew/files/noto-serif-hebrew-hebrew-400-normal.woff', 'node_modules/@fontsource/noto-serif-hebrew/files/noto-serif-hebrew-latin-400-normal.woff'],
  ui: ['node_modules/@fontsource/heebo/files/heebo-hebrew-400-normal.woff', 'node_modules/@fontsource/heebo/files/heebo-latin-400-normal.woff', 'node_modules/@fontsource/noto-sans-hebrew/files/noto-sans-hebrew-hebrew-400-normal.woff'],
};
const coverage = Object.fromEntries(Object.entries(FONTS).map(([k, files]) => [k, files.map(woffCodePoints).reduce((a, s) => { for (const c of s) a.add(c); return a; }, new Set())]));
coverage.talmud = coverage.ui; // Talmud reader uses the UI stack (Heebo + Noto Sans Hebrew fallback)
// Default-ignorable code points render as nothing even without a glyph (Unicode UAX #44 DI); reported for the record, not as tofu.
const DEFAULT_IGNORABLE = cp => cp === 0x034F || cp === 0x200B || cp === 0x200C || cp === 0x200D || cp === 0x200E || cp === 0x200F || (cp >= 0x2060 && cp <= 0x206F) || cp === 0xFEFF;

// [ref, surface] — surface decides the font stack the app actually uses for that text.
const SAMPLES = [
  ['Genesis 1:1-10', 'reading'], ['Exodus 15:1-19', 'reading'], ['Leviticus 19:1-18', 'reading'], ['Numbers 6:22-27', 'reading'],
  ['Deuteronomy 6:4-9', 'reading'], ['Deuteronomy 11:13-21', 'reading'], ['Deuteronomy 32:1-12', 'reading'],
  ['Joshua 1:1-9', 'reading'], ['Isaiah 6:1-13', 'reading'], ['Jeremiah 1:1-10', 'reading'], ['Ezekiel 1:1-10', 'reading'], ['Hosea 14', 'reading'], ['Habakkuk 3:1-10', 'reading'],
  ['Psalms 1', 'reading'], ['Psalms 23', 'reading'], ['Psalms 119:1-24', 'reading'], ['Job 3:1-12', 'reading'], ['Proverbs 31:10-31', 'reading'], ['Song of Songs 1', 'reading'], ['Lamentations 1:1-6', 'reading'], ['Ecclesiastes 3:1-8', 'reading'], ['Esther 1:1-8', 'reading'], ['Daniel 2:1-10', 'reading'], ['I Chronicles 1:1-10', 'reading'],
  ['Siddur Edot HaMizrach, Weekday Shacharit, The Shema', 'reading'], ['Siddur Edot HaMizrach, Weekday Shacharit, Amida', 'reading'], ['Siddur Edot HaMizrach, Shabbat Evening, Kiddush', 'reading'], ['Siddur Edot HaMizrach, Post Meal Blessing', 'reading'],
  ['Shulchan Arukh, Orach Chayim 208', 'reading'], ['Shulchan Arukh, Orach Chayim 208:7', 'reading'], ["Shulchan Arukh, Yoreh De'ah 89", 'reading'], ['Peninei Halakhah, Berakhot 8:13', 'reading'], ['Ben Ish Hai, Halachot 1st Year, Pinchas 1-22', 'reading'], ['Kitzur Shulchan Arukh 1', 'reading'],
  ['Berakhot 2a', 'talmud'], ['Steinsaltz on Berakhot 2a', 'talmud'], ['Rashi on Berakhot 2a:1:1', 'talmud'], ['Tosafot on Berakhot 2a:1:1', 'talmud'], ['Shabbat 31a', 'talmud'], ['Steinsaltz on Shabbat 31a', 'talmud'], ['Bava Metzia 59b', 'talmud'], ['Chullin 141a', 'talmud'],
];

const isHebrewLetter = cp => cp >= 0x05D0 && cp <= 0x05EA;
const SUSPICIOUS = cp =>
  cp === 0xFFFD || cp === 0x25A1 || cp === 0x25A0 || cp === 0x2B1C || cp === 0x25AF ||
  (cp >= 0xE000 && cp <= 0xF8FF) || (cp >= 0xF0000) ||
  (cp < 0x20 && cp !== 0x0A) || (cp >= 0x7F && cp <= 0x9F) ||
  (cp >= 0x200B && cp <= 0x200F) || (cp >= 0x202A && cp <= 0x202E) || (cp >= 0x2066 && cp <= 0x2069) || cp === 0x034F || cp === 0xFEFF;

function classify(cp) {
  if (cp >= 0x0591 && cp <= 0x05AF) return 'cantillation';
  if ((cp >= 0x05B0 && cp <= 0x05BD) || cp === 0x05BF || cp === 0x05C1 || cp === 0x05C2 || cp === 0x05C4 || cp === 0x05C5 || cp === 0x05C7) return 'nikud';
  if (cp === 0x05BE || cp === 0x05C0 || cp === 0x05C3 || cp === 0x05C6 || cp === 0x05F3 || cp === 0x05F4) return 'hebrew-punct';
  if (isHebrewLetter(cp)) return 'letter';
  if (DEFAULT_IGNORABLE(cp)) return 'ignorable';
  if (SUSPICIOUS(cp)) return 'suspicious';
  return 'other';
}

async function fetchRaw(ref) {
  const d = await (await fetch('https://www.sefaria.org/api/texts/' + encodeURIComponent(ref) + '?context=0&commentary=0')).json();
  if (d.error) throw new Error(d.error);
  const he = (Array.isArray(d.he) ? d.he : [d.he]).flat(Infinity).filter(Boolean);
  return { data: d, raw: he };
}

const findings = [];
const totals = { refs: 0, chars: 0, byClass: {} };
const note = (ref, kind, detail) => findings.push({ ref, kind, ...detail });

function inspect(ref, surface, rawSegments, normalizedSegments) {
  const raw = rawSegments.join('\n'), norm = normalizedSegments.join('\n');
  const rawCps = new Map(), normCps = new Map();
  for (const ch of raw) rawCps.set(ch.codePointAt(0), (rawCps.get(ch.codePointAt(0)) || 0) + 1);
  for (const ch of norm) normCps.set(ch.codePointAt(0), (normCps.get(ch.codePointAt(0)) || 0) + 1);
  totals.refs++; totals.chars += norm.length;
  for (const [cp, n] of normCps) {
    const cls = classify(cp);
    totals.byClass[cls] = (totals.byClass[cls] || 0) + n;
    if (cls === 'suspicious') note(ref, 'suspicious-char', { cp: hex(cp), count: n, inSource: rawCps.has(cp) });
    if (cls === 'ignorable') note(ref, 'default-ignorable-in-source', { cp: hex(cp), count: n, inSource: rawCps.has(cp), severity: 'info' });
    if (cls !== 'ignorable' && cp > 0x20 && !coverage[surface].has(cp) && cp !== 0x0A) note(ref, 'no-glyph-in-font-stack', { cp: hex(cp), char: String.fromCodePoint(cp), count: n, surface, inSource: rawCps.has(cp) });
  }
  if (/&[#a-z0-9]+;|<[a-z]/i.test(norm)) note(ref, 'markup-remnant', { sample: norm.match(/&[#a-z0-9]+;|<[a-z][^>]{0,20}/i)[0] });
  // Introduced code points: anything in the normalized text that the source never had.
  for (const cp of normCps.keys()) if (!rawCps.has(cp) && cp !== 0x20 && cp !== 0x0A) note(ref, 'introduced-by-normalization', { cp: hex(cp), char: String.fromCodePoint(cp) });
}

for (const [ref, surface] of SAMPLES) {
  try {
    const { data, raw } = await fetchRaw(ref);
    let normalized;
    if (surface === 'talmud') normalized = raw.map(s => stripToText(sanitizeHebrewHtml(s)));
    else normalized = raw.map(s => normalizeHebrewText(s, policyFor('nikud', data)));
    inspect(ref, surface, raw.map(stripHtml), normalized);
    // Policy assertions per category.
    const policy = policyFor('nikud', data);
    const hasTrope = /[\u0591-\u05AF]/.test(normalized.join(''));
    const srcTrope = /[\u0591-\u05AF]/.test(raw.join(''));
    if (policy === 'tanakh' && srcTrope && !hasTrope) note(ref, 'policy-violation', { detail: 'tanakh lost cantillation' });
    if (policy === 'siddur' && hasTrope) note(ref, 'policy-violation', { detail: 'siddur kept cantillation' });
    if (policy === 'source' && raw.map(stripHtml).join('\n') !== normalized.join('\n') && surface !== 'talmud') note(ref, 'policy-violation', { detail: 'source text altered beyond HTML removal' });
  } catch (e) { note(ref, 'fetch-error', { detail: e.message }); }
}

// Bundled Tehillim (Ketuvim, nikud-only edition) — rendered with the reading stack.
const tehillim = JSON.parse(readFileSync(new URL('../src/data/tehillim.json', import.meta.url)));
const psalmSegments = Object.values(tehillim.chapters).flat(Infinity).filter(x => typeof x === 'string');
inspect('src/data/tehillim.json', 'reading', psalmSegments, psalmSegments);

const bySeverity = f => (f.severity === 'info' ? 'info' : 'error');
const errors = findings.filter(f => bySeverity(f) === 'error');
console.log(JSON.stringify({ refs: totals.refs, chars: totals.chars, byClass: totals.byClass, fontCoverage: { reading: coverage.reading.size, ui: coverage.ui.size }, errors, info: findings.filter(f => bySeverity(f) === 'info') }, null, 1));
process.exitCode = errors.length ? 1 : 0;
