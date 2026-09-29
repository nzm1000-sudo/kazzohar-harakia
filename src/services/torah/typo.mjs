// Typo tolerance as a last, penalized fallback: used only when a search found nothing at all and a typed word is
// unknown to every index. The candidates are the words one edit away (a letter missing, added, swapped with its
// neighbour, or replaced by a letter that sounds or looks alike) that the corpus itself has; the most common wins,
// and only if it is common enough to be a word (not another typo). The result is labelled ("חיפשת: …").
import { findTerm, handleShard } from './searchIndex.mjs';
import { shardOf } from './hebrew.mjs';

export const TYPO_WEIGHT = 0.6;
const LETTERS = 'אבגדהוזחטיכלמנסעפצקרשת';
const MIN_DF = 5;

export function editsOf(word) {
  const out = new Set();
  for (let i = 0; i < word.length; i += 1) {
    out.add(word.slice(0, i) + word.slice(i + 1));
    if (i < word.length - 1) out.add(word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2));
    for (const letter of LETTERS) out.add(word.slice(0, i) + letter + word.slice(i + 1));
  }
  for (let i = 0; i <= word.length; i += 1) for (const letter of LETTERS) out.add(word.slice(0, i) + letter + word.slice(i));
  out.delete(word);
  return [...out].filter(candidate => candidate.length >= 2);
}

async function dfOf(term, indexes) {
  let df = 0;
  for (const index of indexes) {
    const shard = await handleShard(index.handle, shardOf(term));
    const at = findTerm(shard, term);
    if (at >= 0) df += shard.df[at];
  }
  return df;
}

// The best correction of one word, or null. A word's shard is its last two letters, so edits before them are looked up
// in the one shard already open; edits in the last two letters open at most SHARD_BUDGET more shards (the phone never
// loads the whole index to fix one word).
const SHARD_BUDGET = 12;
export async function correctWord(word, indexes) {
  if (word.length < 3) return null;
  const home = shardOf(word);
  const byShard = new Map();
  for (const candidate of editsOf(word)) {
    const shard = shardOf(candidate);
    if (!byShard.has(shard)) byShard.set(shard, []);
    byShard.get(shard).push(candidate);
  }
  const order = [...byShard.keys()].sort((a, b) => (b === home) - (a === home) || byShard.get(b).length - byShard.get(a).length).slice(0, SHARD_BUDGET + 1);
  let best = null;
  for (const shard of order) for (const candidate of byShard.get(shard)) {
    const df = await dfOf(candidate, indexes);
    if (df >= MIN_DF && (!best || df > best.df)) best = { word: candidate, df };
  }
  return best;
}

// outcome: the typed variant's outcome (its groups say which words no index has). → a variant or null.
export async function typoVariant(outcome, indexes) {
  if (!outcome?.groups?.length || outcome.onlyStop) return null;
  const tokens = [];
  const fixes = [];
  for (const group of outcome.groups) {
    if (group.stop || group.df) { if (!group.optional) tokens.push(group.token); continue; }
    const fix = await correctWord(group.token, indexes);
    if (!fix) return null;
    tokens.push(fix.word);
    fixes.push(`${group.token} → ${fix.word}`);
  }
  return fixes.length ? { tokens, weight: TYPO_WEIGHT, via: fixes.join(' · '), kind: 'typo' } : null;
}
