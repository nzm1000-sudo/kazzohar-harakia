// Headword keys of the raw lexica (Krupnik & Silbermann, Jastrow) — for the audit's work queue only (the suspected
// lemma and the reason a frequent form is unresolved). Never a source of glosses.
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { ROOT } from './corpora.mjs';
import { normalizeLookupToken } from '../../src/services/wordLookup/normalize.mjs';

const read = path => (existsSync(join(ROOT, path)) ? gunzipSync(readFileSync(join(ROOT, path))).toString('utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) : []);
const stripSup = text => text.replace(/[²³⁴⁵⁶⁷⁸⁹¹⁰\s]*(I{1,3}|IV|V)?$/, '').replace(/[*]/g, '').trim();

export function loadHeadwords() {
  const map = new Map(); // key → Set(source)
  const add = (word, source) => { for (const part of String(word).split(/[,/]/)) { const key = normalizeLookupToken(stripSup(part)); if (key && key.length >= 2 && !/\s/.test(stripSup(part))) { if (!map.has(key)) map.set(key, new Set()); map.get(key).add(source); } } };
  for (const entry of read('sources/talmud-dictionary/raw/entries.jsonl.gz')) {
    const html = entry.he.join(' ');
    for (const m of html.matchAll(/<big><big>(.*?)<\/big><\/big>/g)) add(m[1].replace(/<[^>]*>/g, '').replace(/\[.*?\]/g, ''), 'krupnik');
  }
  for (const entry of read('sources/jastrow/raw/entries.jsonl.gz')) {
    add(entry.ref.replace(/^Jastrow, /, ''), 'jastrow');
    const html = entry.text.join(' ');
    const lead = html.match(/^(\s*<strong[^>]*>.*?<\/strong>\s*,?\s*)+/);
    if (lead) for (const m of lead[0].matchAll(/<strong[^>]*>(.*?)<\/strong>/g)) add(m[1].replace(/<[^>]*>/g, ''), 'jastrow');
  }
  return map;
}

const PREFIXES = ['ו', 'ד', 'ב', 'ל', 'כ', 'מ', 'וד', 'וב', 'ול', 'וכ', 'ומ', 'דב', 'דל', 'דכ', 'דמ', 'מד', 'כד', 'לכ', 'ודב', 'ודל', 'קא', 'קמ', 'דקא', 'וקא', 'דקמ', 'ה'];
const SUFFIXES = ['א', 'ה', 'יה', 'יא', 'תא', 'אה', 'נ', 'ינ', 'יננ', 'ננ', 'ו', 'י', 'הו', 'יהו', 'ייהו', 'הונ', 'כונ', 'תונ', 'ת', 'ית', 'נא', 'תיה', 'ינהו', 'והי'];

// The work-queue reason of an unresolved Aramaic form (Phase 9 categories) and a suspected lemma.
export function explainUnresolved(key, headwords) {
  if (headwords.has(key)) return { reason: [...headwords.get(key)].includes('krupnik') ? 'AMBIGUOUS_OR_WITHHELD' : 'SOURCE_GAP', lemma: key };
  for (const p of PREFIXES) if (key.startsWith(p) && headwords.has(key.slice(p.length)) && key.length - p.length >= 2) return { reason: 'PREFIX_NOT_RESOLVED', lemma: key.slice(p.length) };
  for (const s of SUFFIXES) if (key.endsWith(s) && headwords.has(key.slice(0, -s.length)) && key.length - s.length >= 2) return { reason: 'SUFFIX_NOT_RESOLVED', lemma: key.slice(0, -s.length) };
  for (const p of PREFIXES) for (const s of SUFFIXES) { if (!key.startsWith(p) || !key.endsWith(s)) continue; const base = key.slice(p.length, -s.length); if (base.length >= 2 && headwords.has(base)) return { reason: 'INFLECTION_NOT_RESOLVED', lemma: base }; }
  const defective = key.replace(/(?<=.)[וי](?=.)/g, '');
  if (defective !== key && headwords.has(defective)) return { reason: 'SPELLING_VARIANT', lemma: defective };
  return { reason: 'NO_LEXICON_ENTRY', lemma: '' };
}
