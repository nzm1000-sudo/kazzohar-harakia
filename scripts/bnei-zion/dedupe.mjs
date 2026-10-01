// Stage 5 — de-duplication at article level. The archive re-sends the same divrei torah year after year (and its
// "שנים קודמות" files collect earlier issues), so one piece appears many times — sometimes pointed, sometimes not.
//   • fingerprint: the unpointed, normalised body (final letters, punctuation and spacing ignored);
//   • similarity: word 5-gram shingles — Jaccard ≥ 0.9 with comparable length is the same article: ONE canonical record,
//     every other printing listed in sourceAppearances[] (file, pages, year, date);
//   • a shorter printing wholly contained (≥ 95% of its shingles) in a longer one joins the longer one (owner's decision);
//   • anything weaker (Jaccard 0.5–0.9, containment 0.8–0.95) is borderline: both are kept and flagged.
// Usage: node scripts/bnei-zion/dedupe.mjs
import { normalizeHebrew } from '../../src/content.mjs';
import { paths, readJson, sha1, stripPoints, writeJson } from './lib.mjs';

const normBody = a => normalizeHebrew(stripPoints(a.paragraphs.join(' '))).replace(/[^א-ת0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
function shingles(words, n = 5) {
  const set = new Set();
  if (words.length < n) { if (words.length) set.add(words.join(' ')); return set; }
  for (let i = 0; i + n <= words.length; i += 1) set.add(words.slice(i, i + n).join(' '));
  return set;
}
const pointedShare = a => { const t = a.paragraphs.join(''); return (t.match(/[ְ-ּ]/g) || []).length / Math.max(1, (t.match(/[א-ת]/g) || []).length); };
const yearRank = y => (y ? y.replace(/[״"]/g, '') : 'תת');

export function dedupeAll() {
  const P = paths();
  const { articles } = readJson(P.stage('classify'));
  const items = articles.map((a, i) => { const norm = normBody(a); const words = norm.split(' ').filter(Boolean); return { i, a, norm, hash: sha1(norm), sh: shingles(words), len: words.length }; });
  // Union–find over exact and near-exact matches.
  const parent = items.map((_, i) => i);
  const find = x => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (x, y) => { const a = find(x), b = find(y); if (a !== b) parent[Math.max(a, b)] = Math.min(a, b); };
  const byHash = new Map();
  for (const it of items) { if (byHash.has(it.hash)) union(byHash.get(it.hash), it.i); else byHash.set(it.hash, it.i); }
  // Candidate pairs through a shingle index (rare shingles only).
  const index = new Map();
  for (const it of items) for (const s of it.sh) { let l = index.get(s); if (!l) index.set(s, (l = [])); l.push(it.i); }
  const pairScore = new Map();
  for (const list of index.values()) {
    if (list.length < 2 || list.length > 60) continue;
    for (let x = 0; x < list.length; x += 1) for (let y = x + 1; y < list.length; y += 1) {
      const key = list[x] * 100000 + list[y];
      pairScore.set(key, (pairScore.get(key) || 0) + 1);
    }
  }
  const borderline = [];
  let containedMerged = 0;
  for (const [key, shared] of pairScore) {
    const x = items[Math.floor(key / 100000)], y = items[key % 100000];
    if (find(x.i) === find(y.i)) continue;
    const jac = shared / (x.sh.size + y.sh.size - shared);
    const cont = shared / Math.min(x.sh.size, y.sh.size);
    const ratio = Math.min(x.len, y.len) / Math.max(x.len, y.len);
    if (jac >= 0.9 && ratio >= 0.85) union(x.i, y.i);
    // Owner's rule: a shorter printing wholly contained in a longer one is that piece — it joins the longer one's
    // appearances and is not shown on its own.
    else if (cont >= 0.95 && Math.min(x.sh.size, y.sh.size) >= 8) { union(x.i, y.i); containedMerged += 1; }
    else if (jac >= 0.5 || cont >= 0.8) borderline.push({ a: x.a.key, b: y.a.key, jaccard: Math.round(jac * 100) / 100, containment: Math.round(cont * 100) / 100, lengthRatio: Math.round(ratio * 100) / 100 });
  }
  const groups = new Map();
  for (const it of items) { const r = find(it.i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(it); }
  const canonical = [];
  for (const members of groups.values()) {
    // The fullest printing leads (a contained shorter one never does); then quality, pointing, a dated issue, the year.
    const maxLen = Math.max(...members.map(m => m.len));
    const eligible = members.filter(m => m.len >= 0.97 * maxLen);
    const sorted = [...eligible].sort((p, q) => (q.a.pagesOk - p.a.pagesOk) || (Boolean(q.a.title) - Boolean(p.a.title)) || ((pointedShare(q.a) > 0.2) - (pointedShare(p.a) > 0.2))
      || ((p.a.manifest.editionNote === 'שנים קודמות') - (q.a.manifest.editionNote === 'שנים קודמות')) || yearRank(p.a.hebrewYear).localeCompare(yearRank(q.a.hebrewYear), 'he') || p.a.key.localeCompare(q.a.key));
    const best = sorted[0].a;
    const appearances = members.map(m => ({ originalPdf: m.a.originalPdf, pageStart: m.a.pageStart, pageEnd: m.a.pageEnd, hebrewYear: m.a.hebrewYear, issueDate: m.a.issueDate, key: m.a.key }))
      .sort((p, q) => yearRank(p.hebrewYear).localeCompare(yearRank(q.hebrewYear), 'he') || p.originalPdf.localeCompare(q.originalPdf) || p.pageStart - q.pageStart);
    // Every printing's occasion counts — except a combined issue's piece filed by the issue alone (no clear signal),
    // which must not undo another printing's clear separation.
    const voters = members.filter(m => !(m.a.separation && !m.a.separation.confident));
    const uniq = (f) => [...new Set((voters.length ? voters : [sorted[0]]).flatMap(m => m.a[f]))];
    // The same piece printed for two occasions belongs to both (the author used it for both).
    const parashot = uniq('parashot'), holidays = uniq('holidays'), specialShabbatot = uniq('specialShabbatot');
    const years = appearances.map(x => x.hebrewYear).filter(Boolean).sort((p, q) => yearRank(p).localeCompare(yearRank(q), 'he'));
    canonical.push({ ...best, parashot, holidays, specialShabbatot, firstYear: years[0] || best.hebrewYear, fingerprint: sha1(normBody(best)), sourceAppearances: appearances, duplicatesMerged: members.length - 1, normText: normBody(best) });
  }
  const keyToCanon = new Map();
  for (const c of canonical) for (const ap of c.sourceAppearances) keyToCanon.set(ap.key, c.key);
  const flagged = borderline.map(b => ({ ...b, a: keyToCanon.get(b.a), b: keyToCanon.get(b.b) })).filter(b => b.a !== b.b);
  const seen = new Set();
  const uniqueFlags = flagged.filter(b => { const k = [b.a, b.b].sort().join('|'); if (seen.has(k)) return false; seen.add(k); return true; });
  for (const c of canonical) c.similarTo = uniqueFlags.filter(b => b.a === c.key || b.b === c.key).map(b => ({ key: b.a === c.key ? b.b : b.a, jaccard: b.jaccard, containment: b.containment }));
  writeJson(P.stage('dedupe'), { generatedAt: new Date().toISOString(), extracted: articles.length, containedMerged, canonical, borderline: uniqueFlags });
  return { extracted: articles.length, canonical: canonical.length, duplicatesMerged: articles.length - canonical.length, containedMerged, borderlinePairs: uniqueFlags.length };
}

if (import.meta.url === `file://${process.argv[1]}`) console.log('dedupe:', JSON.stringify(dedupeAll()));
