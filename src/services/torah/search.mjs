// The Torah search engine: full text of every indexed corpus, offline, deterministic, no model and no network.
// A query runs in layers, each weaker than the one before, and a weak layer never outranks a strong one:
//   1 an exact canonical reference ("בראשית א:א", "ברכות ב ע״א", "שו״ע או״ח שיח א") — shown first
//   2–3 the exact phrase (in a heading / opening words, in the text)
//   4 every word close together (proximity window)      5 every word in the same unit, any order
//   6 prefixed and plene forms (ודגים, בחלב, שלחן)       7 plural / singular (דג ↔ דגים), a query word's own prefix
//   8 curated abbreviations and word families (data files, penalized)
//   9 partial matches (most of the words) — shown only when no unit has them all, and marked as partial
// The snippet is the unit's own text, cut around the best match; highlighting is computed on the normalized form and
// mapped back to the original characters, so an unpointed query marks a pointed verse without altering it.
import { WORKS, workById } from '../../data/library/registry.mjs';
import { ABBREVIATIONS } from '../../data/torah/abbreviations.mjs';
import { WORD_FAMILIES } from '../../data/torah/topics.mjs';
import { loadEditionChunk } from '../library/packs.mjs';
import { mergeRanges, normalizeText, normalizeWord, prefixSplits, isPrefixOf, scanTokens, shardOf, skeleton, tokenize } from './hebrew.mjs';
import { bucketLength, decodePostings } from './indexFormat.mjs';
import { activeHandles, coreHandle, handleDocs, handleShard, handlesSignature } from './searchIndex.mjs';
import { restoreInstalledPacks } from './packManager.mjs';
import { analyzeQuery } from './queryIntent.mjs';
import { typoVariant } from './typo.mjs';
import { blessingAnswer } from './verifiedAnswers.mjs';
import { answerTarget, displayRef, resolveTorahRef, targetFor, yalkutTarget } from './refs.mjs';
import { FAMILIES, PACK_FAMILIES } from './inventory.mjs';
import { answerText, packUnitText, yalkutSectionText } from './documents.mjs';

export const WEIGHTS = Object.freeze({ exact: 1, prefixed: 0.92, plene: 0.88, conjunction: 0.96, stripped: 0.8, morph: 0.7, family: 0.6, abbreviation: 0.9, ambiguous: 0.65 });
const MAX_TOKENS = 10;
const RERANK = 80;

// ---------- Query analysis ----------
const ABBR = ABBREVIATIONS.map(item => ({ ...item, key: normalizeWord(item.abbr), words: tokenize(item.full), contextKeys: (item.context || []).map(normalizeWord) }));
const FAMILY_OF = new Map();
for (const family of WORD_FAMILIES) for (const word of family.words) FAMILY_OF.set(normalizeWord(word), family.words.map(normalizeWord));

function morphForms(term) {
  const forms = new Set();
  if (term.length >= 2) { forms.add(`${term}ימ`); forms.add(`${term}ות`); forms.add(`${term}ינ`); }
  for (const suffix of ['ימ', 'ות', 'ינ']) if (term.endsWith(suffix) && term.length - 2 >= 2) forms.add(term.slice(0, -2));
  if (term.endsWith('ה') && term.length >= 3) forms.add(`${term.slice(0, -1)}ות`);
  if (term.endsWith('ות') && term.length >= 4) forms.add(`${term.slice(0, -2)}ה`);
  forms.delete(term);
  return [...forms];
}

// Query variants: the words as typed, then each abbreviation written out (or a written-out phrase abbreviated).
export function queryVariants(query) {
  const tokens = tokenize(query).filter(token => token.length >= 2).slice(0, MAX_TOKENS);
  if (!tokens.length) return [];
  const variants = [{ tokens, weight: 1, via: null }];
  const has = key => tokens.includes(key);
  tokens.forEach((token, i) => {
    const hit = ABBR.find(item => item.key === token);
    if (!hit) return;
    if (hit.contextKeys.length && !hit.contextKeys.some(has)) return;
    variants.push({ tokens: [...tokens.slice(0, i), ...hit.words, ...tokens.slice(i + 1)], weight: hit.ambiguous ? WEIGHTS.ambiguous : WEIGHTS.abbreviation, via: `${hit.abbr} = ${hit.full}` });
  });
  // Every abbreviation of the query written out at once (שו"ע או"ח → שולחן ערוך אורח חיים).
  const expandable = tokens.map(token => ABBR.find(item => item.key === token && (!item.contextKeys.length || item.contextKeys.some(has))) || null);
  if (expandable.filter(Boolean).length > 1) variants.splice(1, 0, { tokens: tokens.flatMap((token, i) => (expandable[i] ? expandable[i].words : [token])), weight: expandable.some(item => item?.ambiguous) ? WEIGHTS.ambiguous : WEIGHTS.abbreviation, via: expandable.filter(Boolean).map(item => `${item.abbr} = ${item.full}`).join(' · ') });
  for (const item of ABBR) {
    if (item.words.length < 2 || item.contextKeys.length) continue;
    const at = tokens.findIndex((_, i) => item.words.every((word, k) => tokens[i + k] === word));
    if (at >= 0) variants.push({ tokens: [...tokens.slice(0, at), item.key, ...tokens.slice(at + item.words.length)], weight: item.ambiguous ? WEIGHTS.ambiguous : WEIGHTS.abbreviation, via: `${item.full} = ${item.abbr}` });
  }
  return variants.slice(0, 4);
}

// The variants a search runs: Stage 0's (the words as typed, abbreviations written out) — alone in 'lexical' mode —
// and, in the hybrid engine, the same with question scaffolding optional plus the rewrites of queryIntent.mjs.
const MAX_VARIANTS = 7;
export function searchVariants(query, understood = null) {
  const lexical = queryVariants(query).map((variant, i) => ({ ...variant, kind: i ? 'abbreviation' : 'typed' }));
  if (!understood) return lexical;
  const optional = understood.optional.size ? understood.optional : null;
  return [...lexical.map(variant => ({ ...variant, optional })), ...understood.rewrites].slice(0, MAX_VARIANTS);
}

// Every index term that stands for one query word, with its weight, in every active index:
// → { token, stop, forms: Map(term → { weight }) (all indexes), byHandle: [Map(term → { weight, shard, index, df, origin })] }
async function termGroup(slot, stopTerms, handles, optional = null) {
  // A slot is a query word, or (a rewrite) one concept's alternatives: { label, alts: [[word, weight]] }.
  const token = typeof slot === 'string' ? slot : slot.label;
  const alts = typeof slot === 'string' ? [[slot, WEIGHTS.exact]] : slot.alts;
  const seeds = new Map();
  const addSeed = (term, weight) => { if (term.length >= 2 && (seeds.get(term) || 0) < weight) seeds.set(term, weight); };
  const splits = [];
  for (const [word, base] of alts) {
    addSeed(word, base);
    for (const form of morphForms(word)) addSeed(form, base * WEIGHTS.morph);
    for (const other of FAMILY_OF.get(word) || []) if (other !== word) addSeed(other, base * WEIGHTS.family);
    for (const [prefix, core] of prefixSplits(word)) {
      splits.push([prefix, core]);
      // A leading ו on a query word is almost always "and" (חלב ודגים): nearly the word itself. Other prefixes weigh less.
      const strip = base * (prefix === 'ו' ? WEIGHTS.conjunction : WEIGHTS.stripped);
      addSeed(core, strip);
      for (const form of morphForms(core)) addSeed(form, strip * WEIGHTS.morph);
      for (const other of FAMILY_OF.get(core) || []) addSeed(other, strip * WEIGHTS.family);
    }
  }
  const shardIds = [...new Set([...seeds.keys()].map(shardOf))];
  const byHandle = await Promise.all(handles.map(async handle => {
    const loaded = new Map(await Promise.all(shardIds.map(async id => [id, await handleShard(handle, id)])));
    const forms = new Map();
    const put = (shard, index, weight, origin) => {
      const term = shard.terms[index];
      const current = forms.get(term);
      if (!current || current.weight < weight) forms.set(term, { weight, shard, index, df: shard.df[index], origin });
    };
    for (const [seed, weight] of seeds) {
      const shard = loaded.get(shardOf(seed));
      const seedSkeleton = skeleton(seed);
      for (let i = 0; i < shard.terms.length; i += 1) {
        const term = shard.terms[i];
        if (term === seed) { put(shard, i, weight, seed); continue; }
        if (term.length > seed.length && term.endsWith(seed) && isPrefixOf(term.slice(0, term.length - seed.length))) { put(shard, i, weight * WEIGHTS.prefixed, seed); continue; }
        // Plene / defective spelling of the same word (or of it with a prefix); only for words of four letters or more.
        if (seed.length >= 4 && Math.abs(term.length - seed.length) <= 3) {
          if (skeleton(term) === seedSkeleton) { put(shard, i, weight * WEIGHTS.plene, seed); continue; }
          for (let n = 1; n <= 3 && n < term.length; n += 1) if (isPrefixOf(term.slice(0, n)) && skeleton(term.slice(n)) === seedSkeleton) { put(shard, i, weight * WEIGHTS.plene * WEIGHTS.prefixed, seed); break; }
        }
      }
    }
    return forms;
  }));
  // A query word's own prefix is dropped only when the corpus says so: the bare word must be far more common than the
  // word as typed (ודגים → דגים: yes; ברכה → רכה: no; משנה → שנה: no). Counted over every active index together.
  const dfWhere = predicate => byHandle.reduce((sum, forms) => sum + [...forms.values()].filter(predicate).reduce((total, form) => total + form.df, 0), 0);
  const altWords = new Set(alts.map(([word]) => word));
  const typedDf = dfWhere(form => altWords.has(form.origin) || [...altWords].some(word => morphForms(word).includes(form.origin)));
  for (const [, core] of splits) {
    const coreDf = dfWhere(form => form.origin === core);
    if (!(coreDf > 2 * typedDf)) for (const forms of byHandle) for (const [term, form] of [...forms]) if (form.origin === core || morphForms(core).includes(form.origin) || (FAMILY_OF.get(core) || []).includes(form.origin)) if (form.weight <= WEIGHTS.conjunction && !altWords.has(form.origin)) forms.delete(term);
  }
  const forms = new Map();
  for (const handleForms of byHandle) for (const [term, form] of handleForms) if (!forms.has(term) || forms.get(term).weight < form.weight) forms.set(term, { weight: form.weight, origin: form.origin });
  return { token, stop: stopTerms.has(token) || Boolean(optional?.has(token)), optional: Boolean(optional?.has(token)), forms, byHandle };
}

// ---------- Candidate scoring from the index ----------
function popcount(value) { let n = 0; while (value) { n += value & 1; value >>>= 1; } return n; }

// A document of any index is keyed slot · doc (slot = the index's position among the active indexes).
const SLOT = 16777216;
async function candidates(variant, { indexes, allowed }) {
  const stop = new Set(indexes[0].manifest.stopTerms.map(([term]) => term));
  const handles = indexes.map(index => index.handle);
  // One search computes a word's forms once, whatever the number of variants that hold it.
  const memo = arguments[1].memo || new Map();
  const groupOf = token => {
    const id = `${typeof token === 'string' ? token : JSON.stringify(token)}|${variant.optional?.has(typeof token === 'string' ? token : token.label) ? 1 : 0}`;
    if (!memo.has(id)) memo.set(id, termGroup(token, stop, handles, variant.optional));
    return memo.get(id).then(group => ({ ...group }));
  };
  const groups = await Promise.all(variant.tokens.map(groupOf));
  const active = groups.filter(group => !group.stop && group.forms.size);
  const needed = groups.filter(group => !group.stop);
  if (!needed.length) return { groups, docs: [], full: 0, missing: groups.filter(group => !group.stop).map(group => group.token), onlyStop: true };
  const N = indexes.reduce((sum, index) => sum + index.count, 0);
  const mask = new Map();
  const score = new Map();
  const bestWeight = new Map();
  active.forEach(group => {
    const bit = 1 << groups.indexOf(group);
    const seenCache = arguments[1].memo ? (arguments[1].memo.seen ||= new Map()) : null;
    const seenBySlot = seenCache?.get(group.byHandle) || group.byHandle.map((forms, slot) => {
      const seen = new Map();
      const index = indexes[slot];
      for (const [, form] of [...forms].sort((a, b) => b[1].weight - a[1].weight)) {
        for (const doc of decodePostings(form.shard, form.index)) {
          if (!allowed[slot][index.workOf[doc]] || seen.has(doc)) continue;
          seen.set(doc, form.weight);
        }
      }
      return seen;
    });
    seenCache?.set(group.byHandle, seenBySlot);
    const df = seenBySlot.reduce((sum, seen) => sum + seen.size, 0);
    const idf = Math.log(1 + N / Math.max(1, df));
    seenBySlot.forEach((seen, slot) => {
      for (const [doc, weight] of seen) {
        const key = slot * SLOT + doc;
        mask.set(key, (mask.get(key) || 0) | bit);
        score.set(key, (score.get(key) || 0) + idf * weight);
        bestWeight.set(key, Math.min(bestWeight.get(key) ?? 1, weight));
      }
    });
    group.df = df;
    group.idf = idf;
  });
  const want = needed.length;
  const fullMask = needed.reduce((sum, group) => sum | (1 << groups.indexOf(group)), 0);
  const list = [];
  let full = 0;
  for (const [key, m] of mask) {
    const covered = popcount(m & fullMask);
    const complete = covered === want;
    if (complete) full += 1;
    else if (want >= 2 && covered * 2 < want) continue;
    const slot = Math.floor(key / SLOT);
    const doc = key - slot * SLOT;
    const length = bucketLength(indexes[slot].lengthOf[doc]);
    const lengthNorm = 1 / (1 + 0.15 * Math.max(0, Math.log2((length + 1) / 24)));
    list.push({ key, slot, doc, complete, coverage: covered / want, index: score.get(key) * lengthNorm * (complete ? 1 : 0.3 * (covered / want)) * variant.weight, weakest: bestWeight.get(key) });
  }
  const docs = full ? list.filter(item => item.complete) : list;
  docs.sort((a, b) => b.index - a.index || a.key - b.key);
  return { groups, docs, full, missing: needed.filter(group => !group.df).map(group => group.token) };
}

// ---------- Reading the units' text (for reranking and snippets) ----------
const textCache = new Map();
const TEXT_CACHE = 600;
// items: [{ key, slot, doc }] → Map(key → { text, unit|section|entry, heading }). The text cache is keyed by the index's
// id and version, so an updated or removed pack never serves another index's text.
const cacheKey = (indexes, item) => `${indexes[item.slot].handle.id}@${indexes[item.slot].manifest.version || indexes[item.slot].handle.version}:${item.doc}`;
async function unitsOf(items, indexes) {
  const want = items.filter(item => !textCache.has(cacheKey(indexes, item)));
  const byFile = new Map();
  for (const item of want) {
    const index = indexes[item.slot];
    const [workId, , , , , store] = index.manifest.works[index.workOf[item.doc]];
    const work = store === 'pack' ? workById(workId) : null;
    const node = index.nodeOf[item.doc];
    const key = work ? `${workId}#${work.editions[0].parts?.length ? work.editions[0].parts.find(part => node >= part.from && node <= part.to)?.file : ''}` : `${item.slot}:${store}`;
    if (!byFile.has(key)) byFile.set(key, { store, work, index, items: [] });
    byFile.get(key).items.push(item);
  }
  const jobs = [...byFile.values()];
  let yalkut = null;
  let answers = null;
  const run = async job => {
    const { index } = job;
    try {
      if (job.store === 'pack') {
        const chunk = await loadEditionChunk(job.work.editions[0], { node: index.nodeOf[job.items[0].doc] });
        for (const item of job.items) {
          const node = chunk.nodes.find(entry => entry.n === index.nodeOf[item.doc]);
          const unit = node?.units.find(entry => entry.n === index.unitOf[item.doc]);
          if (unit) textCache.set(cacheKey(indexes, item), { text: packUnitText(unit), unit, heading: [unit.title, unit.dh].filter(Boolean).join(' ') });
        }
      } else if (job.store === 'yalkut-yosef') {
        yalkut ||= (await import('../../data/yalkutYosef.mjs')).YALKUT_YOSEF.sections;
        for (const item of job.items) { const section = yalkut[index.unitOf[item.doc] - 1]; if (section) textCache.set(cacheKey(indexes, item), { text: yalkutSectionText(section), section, heading: section.section }); }
      } else if (job.store === 'halacha-answers') {
        if (!answers) {
          const { PRACTICAL_HALACHA_QA_INDEX } = await import('../../data/practicalHalachaQa.mjs');
          answers = PRACTICAL_HALACHA_QA_INDEX;
        }
        const ids = index.manifest.works[index.workOf[job.items[0].doc]][6];
        for (const item of job.items) { const entry = answers[ids[index.unitOf[item.doc] - 1]]; if (entry) textCache.set(cacheKey(indexes, item), { text: answerText(entry), entry, heading: entry.question }); }
      }
    } catch { /* a file that cannot be read now (the web, offline) leaves its units out of this page */ }
  };
  for (let i = 0; i < jobs.length; i += 4) await Promise.all(jobs.slice(i, i + 4).map(run));
  while (textCache.size > TEXT_CACHE) textCache.delete(textCache.keys().next().value);
  return new Map(items.filter(item => textCache.has(cacheKey(indexes, item))).map(item => [item.key, textCache.get(cacheKey(indexes, item))]));
}

// ---------- Reranking by the text itself ----------
function matcher(groups) {
  const byTerm = new Map();
  groups.forEach((group, g) => { for (const [term, form] of group.forms) { const current = byTerm.get(term); if (!current || current.weight < form.weight) byTerm.set(term, { g, weight: form.weight }); } });
  return byTerm;
}
function analyse(text, groups, byTerm, heading) {
  const tokens = scanTokens(text);
  const positions = groups.map(() => []);
  const bestWeight = groups.map(() => 0);
  tokens.forEach((token, i) => {
    const hit = byTerm.get(token.norm);
    const g = hit ? hit.g : groups.findIndex(group => group.stop && group.token === token.norm);
    if (g < 0) return;
    positions[g].push(i);
    bestWeight[g] = Math.max(bestWeight[g], hit ? hit.weight : 1);
  });
  const needed = groups.map((group, g) => (!group.stop ? g : -1)).filter(g => g >= 0);
  // Exact phrase: the query's words in order, adjacent (stop words included).
  let phrase = false;
  if (groups.length > 1) {
    for (const start of positions[0] || []) {
      if (groups.every((group, k) => positions[k].includes(start + k))) { phrase = true; break; }
    }
  }
  // Smallest window holding every needed word.
  let window = Infinity;
  let windowAt = -1;
  const events = needed.flatMap(g => positions[g].map(at => [at, g])).sort((a, b) => a[0] - b[0]);
  const counts = new Map();
  let left = 0;
  for (let right = 0; right < events.length; right += 1) {
    counts.set(events[right][1], (counts.get(events[right][1]) || 0) + 1);
    while (counts.size === needed.length) {
      const span = events[right][0] - events[left][0] + 1;
      if (span < window) { window = span; windowAt = events[left][0]; }
      const g = events[left][1];
      counts.set(g, counts.get(g) - 1);
      if (!counts.get(g)) counts.delete(g);
      left += 1;
    }
  }
  // How often the words stand together (a unit about the pair says it more than once).
  let together = 0;
  if (needed.length > 1) {
    const rarest = needed.reduce((a, b) => (positions[a].length <= positions[b].length ? a : b));
    const reach = needed.length + 1;
    for (const at of positions[rarest]) if (needed.every(g => g === rarest || positions[g].some(p => Math.abs(p - at) <= reach))) together += 1;
  }
  const headingTokens = heading ? new Set(tokenize(heading)) : null;
  const inHeading = Boolean(headingTokens && needed.length && needed.every(g => [...groups[g].forms.keys()].some(term => headingTokens.has(term))));
  const firstHit = positions.flat().sort((a, b) => a - b)[0] ?? 0;
  return { tokens, positions, bestWeight, phrase, window, windowAt: windowAt >= 0 ? windowAt : firstHit, inHeading, needed, together };
}

const SNIPPET_BEFORE = 70;
const SNIPPET_LENGTH = 230;
export function snippetOf(text, tokens, positions, windowAt) {
  const anchor = tokens[windowAt] || tokens[0];
  let start = Math.max(0, (anchor?.start || 0) - SNIPPET_BEFORE);
  let end = Math.min(text.length, start + SNIPPET_LENGTH);
  if (end === text.length) start = Math.max(0, end - SNIPPET_LENGTH);
  // Cut at word boundaries.
  if (start > 0) { const space = text.indexOf(' ', start); if (space > 0 && space < (anchor?.start ?? start)) start = space + 1; }
  if (end < text.length) { const space = text.lastIndexOf(' ', end); if (space > start) end = space; }
  const ranges = mergeRanges(positions.flat().map(i => [tokens[i].start, tokens[i].end]).filter(([s, e]) => s >= start && e <= end)).map(([s, e]) => [s - start, e - start]);
  return { text: text.slice(start, end), highlights: ranges, before: start > 0, after: end < text.length };
}

function rerankScore(item, analysis, groups) {
  let bonus = 0;
  if (analysis.phrase) bonus += 0.4;
  const needed = analysis.needed.length;
  // Adjacent in any order (דגים בחלב · חלב ודגים) > one word between (דגים עם חלב) > a short clause > the same unit.
  if (needed > 1 && Number.isFinite(analysis.window)) bonus += analysis.window <= needed ? 1 : analysis.window <= needed + 1 ? 0.6 : analysis.window <= 8 ? 0.3 : analysis.window <= 20 ? 0.1 : 0;
  if (analysis.together > 1) bonus += Math.min(2, analysis.together - 1) * 0.15;
  // Repetition: a unit that returns to the word is about it (capped, so length never wins by itself).
  const repeats = analysis.needed.reduce((sum, g) => sum + Math.max(0, analysis.positions[g].length - 1), 0);
  bonus += Math.min(0.45, repeats * 0.1);
  if (analysis.inHeading) bonus += 0.3;
  const weights = analysis.needed.map(g => analysis.bestWeight[g] || 0);
  const exactness = weights.length ? weights.reduce((a, b) => a + b, 0) / weights.length : 1;
  // A unit whose text no longer shows every word (a stale unit) keeps only its index score's partial share.
  const present = analysis.needed.every(g => analysis.positions[g].length);
  // Between equals, the text itself before a commentary on it.
  return item.index * (1 + bonus) * (0.5 + 0.5 * exactness) * (present || !item.complete ? 1 : 0.4) * (item.primary ? 1.08 : 1);
}

// Result diversity: after relevance, no work fills the first page alone (at most 3 of the first 10), the strongest
// result always stays first.
export function diversify(results, { window = 10, perWork = 3 } = {}) {
  const head = [];
  const deferred = [];
  const counts = new Map();
  for (const result of results) {
    if (head.length >= window) { deferred.push(result); continue; }
    const key = result.series || result.workId;
    const n = counts.get(key) || 0;
    if (n >= perWork && head.length) { deferred.push(result); continue; }
    counts.set(key, n + 1);
    head.push(result);
  }
  return [...head, ...deferred];
}

// ---------- Hybrid fusion ----------
// When the query was rewritten into the sources' words, each variant ranks the units by itself and the rankings are
// fused by weighted reciprocal rank (RRF, k = 60): a unit found by the words as typed and by the sources' words gathers
// both; a rewrite counts by its lexicon weight (a related word at half), a typo correction at 0.6. Units that hold every
// word of some variant come first; in a question, units holding at least two thirds of the typed words join at half
// weight, marked partial. The fused value is the base the text reranker multiplies (phrase, proximity, heading).
export const RRF_K = 60;
const PER_VARIANT = 400;
export function fuseVariants(outcomes, understood) {
  const fused = new Map();
  let anyComplete = false;
  for (const outcome of outcomes) {
    const { variant } = outcome;
    const complete = outcome.docs.filter(item => item.complete);
    const partial = understood.intent === 'question' && variant.kind === 'typed' ? outcome.docs.filter(item => !item.complete && item.coverage >= 2 / 3) : [];
    const list = complete.length ? [...complete, ...partial] : outcome.docs;
    list.slice(0, PER_VARIANT).forEach((item, rank) => {
      const weight = (variant.weight ?? 1) * (item.complete ? 1 : 0.5);
      const share = weight / (RRF_K + rank + 1);
      const current = fused.get(item.key);
      if (item.complete) anyComplete = true;
      if (!current) fused.set(item.key, { ...item, outcome, rrf: share, via: [{ kind: variant.kind, via: variant.via || null, rank: rank + 1, weight }] });
      else {
        current.rrf += share;
        current.via.push({ kind: variant.kind, via: variant.via || null, rank: rank + 1, weight });
        if (item.complete && !current.complete) Object.assign(current, { complete: true, coverage: item.coverage, outcome });
      }
    });
  }
  const all = [...fused.values()];
  const keep = anyComplete ? all.filter(item => item.complete || item.coverage >= 2 / 3) : all;
  for (const item of keep) item.index = item.rrf * 1000;
  return { pool: keep.sort((a, b) => b.index - a.index || a.key - b.key), anyComplete };
}

// ---------- Public API ----------
const FAMILY_TITLE = Object.fromEntries([...FAMILIES, ...PACK_FAMILIES].map(family => [family.id, family.title]));
let lastRun = null;

// search(query, { family: 'all'|'tanakh'|…, workIds: [...] (in-book search), offset, limit }) →
// { query, reference, results, total, partial, missing, suggestions, variants, indexVersion, ms }
export async function searchTorah(query, { family = 'all', workIds = null, offset = 0, limit = 20, mode = 'hybrid' } = {}) {
  const started = Date.now();
  const text = String(query || '').trim();
  const empty = { query: text, reference: null, results: [], total: 0, partial: false, missing: [], suggestions: [], variants: [], ms: 0 };
  if (normalizeText(text).replace(/\s/g, '').length < 2) return empty;
  const reference = !workIds ? resolveTorahRef(text) : null;
  // The built-in index and every installed pack; a pack whose files cannot be read now is left out of this search.
  await restoreInstalledPacks().catch(() => {});
  const handles = activeHandles();
  const loaded = await Promise.all(handles.map(handle => handleDocs(handle).catch(error => { if (handle === coreHandle()) throw error; return null; })));
  const indexes = loaded.filter(Boolean);
  const allowed = indexes.map(index => index.manifest.works.map(([id, fam]) => (workIds ? workIds.includes(id) : family === 'all' || fam === family)));
  const key = `${text}|${family}|${workIds?.join(',') || ''}|${handlesSignature()}|${mode}`;
  const understood = mode === 'lexical' ? null : analyzeQuery(text, { reference });
  let run = lastRun?.key === key ? lastRun : null;
  if (!run) {
    const variants = searchVariants(text, understood);
    const outcomes = [];
    const memo = new Map();
    for (const variant of variants) outcomes.push({ variant, ...(await candidates(variant, { indexes, allowed, memo })) });
    // Nothing found at all and a typed word is unknown to every index: the nearest word the corpus has (one edit away,
    // the most common such word), as a clearly marked, penalized fallback — never mixed into a search that found something.
    if (understood && !outcomes.some(outcome => outcome.docs.length)) {
      const fix = await typoVariant(outcomes[0], indexes);
      if (fix) outcomes.push({ variant: fix, ...(await candidates(fix, { indexes, allowed, memo })) });
    }
    const fused = understood && outcomes.some(outcome => outcome.variant.kind === 'rewrite' || outcome.variant.kind === 'typo');
    let pool;
    let anyComplete;
    if (!fused) {
      // Stage 0 (and every query the lexicon does not rewrite): a unit keeps its best score over the variants; the
      // words as typed decide what is "complete".
      const merged = new Map();
      for (const outcome of outcomes) for (const item of outcome.docs) {
        const current = merged.get(item.key);
        if (!current || current.index < item.index) merged.set(item.key, { ...item, outcome });
      }
      const all = [...merged.values()];
      anyComplete = all.some(item => item.complete);
      pool = (anyComplete ? all.filter(item => item.complete) : all).sort((a, b) => b.index - a.index || a.key - b.key);
    } else {
      ({ pool, anyComplete } = fuseVariants(outcomes, understood));
    }
    run = { key, indexes, pool, outcomes, fused, partial: !anyComplete && pool.length > 0, reranked: [], rerankedUpTo: 0 };
    lastRun = run;
  }
  // Rerank as far as this page needs (and a margin), by the units' own text.
  const need = Math.min(run.pool.length, Math.max(RERANK, offset + limit + 20));
  // One rerank at a time per run: two calls for the same query (a re-render, a pack registered meanwhile) wait for the
  // same work instead of both appending the same units (which would show a result twice).
  while (run.reranking) await run.reranking;
  run.reranking = (async () => {
    if (run.rerankedUpTo < need) {
      const slice = run.pool.slice(run.rerankedUpTo, need);
      const texts = await unitsOf(slice, run.indexes);
      for (const item of slice) {
        const loadedText = texts.get(item.key);
        if (!loadedText) continue;
        const groups = item.outcome.groups;
        const row = rowOf(run.indexes, item);
        item.primary = row[5] === 'pack' && !workById(row[0])?.relation;
        const analysis = analyse(loadedText.text, groups, matcher(groups), loadedText.heading);
        run.reranked.push({ item, loaded: loadedText, analysis, score: rerankScore(item, analysis, groups) });
      }
      run.rerankedUpTo = need;
      run.reranked.sort((a, b) => b.score - a.score || a.item.key - b.item.key);
    }
  })();
  try { await run.reranking; } finally { run.reranking = null; }
  run.understood = understood;
  const ordered = diversify(run.reranked.map(entry => ({ ...entry, workId: rowOf(run.indexes, entry.item)[0], series: seriesOf(rowOf(run.indexes, entry.item)) })));
  const page = ordered.slice(offset, offset + limit).map(entry => resultOf(entry, run.indexes));
  const typed = run.outcomes[0];
  const blessing = run.understood?.intent === 'question' && offset === 0 ? await blessingAnswer(text).catch(() => null) : null;
  return {
    query: text,
    reference,
    results: page,
    total: run.pool.length,
    shown: Math.min(run.pool.length, offset + page.length),
    partial: run.partial,
    missing: typed?.missing || [],
    onlyStopWords: Boolean(typed?.onlyStop),
    suggestions: !run.pool.length ? suggestionsFor(typed, text) : [],
    variants: run.outcomes.filter(outcome => outcome.variant.via).map(outcome => outcome.variant.via),
    intent: run.understood?.intent || 'lexical',
    corrected: run.outcomes.find(outcome => outcome.variant.kind === 'typo' && outcome.docs.length)?.variant.via || null,
    // A natural question: the Halacha Engine's verified answers among the first results, to show beside the sources.
    answers: run.understood?.intent === 'question' && offset === 0 ? page.slice(0, 10).filter(hit => hit.answer).slice(0, 2) : [],
    blessing,
    indexVersion: run.indexes[0].manifest.version,
    packs: run.indexes.slice(1).map(index => index.handle.id),
    ms: Date.now() - started,
  };
}
const rowOf = (indexes, item) => indexes[item.slot].manifest.works[indexes[item.slot].workOf[item.doc]];

// Diversity groups one series together (every tractate's Bartenura, every book's Rashi, the Shulchan Arukh's parts).
function seriesOf([workId, , , , , store]) {
  if (store !== 'pack') return store;
  const work = workById(workId);
  return work ? `${work.primaryCategory}:${work.group || workId}` : workId;
}

// No unit holds every word: offer each word that does occur, as the user wrote it (deterministic, no guessing).
function suggestionsFor(outcome, text) {
  if (!outcome) return [];
  const written = new Map(scanTokens(text).map(token => [token.norm, text.slice(token.start, token.end)]));
  const found = outcome.groups.filter(group => !group.stop && group.df);
  return found.length && found.length < outcome.groups.length ? found.map(group => ({ label: written.get(group.token) || group.token, query: written.get(group.token) || group.token })) : [];
}

// Why a result is where it is (for tests and debugging; never shown as a score): the variants that found it, its
// lexical base, and the text signals of the reranker.
function explainOf(item, analysis, score) {
  return {
    score: +score.toFixed(4),
    base: +item.index.toFixed(4),
    via: item.via || [{ kind: item.outcome?.variant.kind || 'typed', via: item.outcome?.variant.via || null, weight: item.outcome?.variant.weight ?? 1 }],
    complete: item.complete,
    coverage: +item.coverage.toFixed(2),
    phrase: analysis.phrase,
    window: Number.isFinite(analysis.window) ? analysis.window : null,
    heading: analysis.inHeading,
  };
}
function resultOf({ item, loaded, analysis, score }, indexes) {
  const index = indexes[item.slot];
  const [workId, fam, rights, , , store] = index.manifest.works[index.workOf[item.doc]];
  const node = index.nodeOf[item.doc];
  const unit = index.unitOf[item.doc];
  const snippet = snippetOf(loaded.text, analysis.tokens, analysis.positions, analysis.windowAt);
  const pack = item.slot ? index.handle.id : null;
  const base = { id: pack ? `${pack}:${item.doc}` : item.doc, place: { node, unit }, workId, family: fam, familyTitle: FAMILY_TITLE[fam] || '', rights, offline: true, partial: !item.complete, snippet, explain: explainOf(item, analysis, score), ...(pack ? { pack } : {}) };
  if (store === 'yalkut-yosef') return { ...base, workTitle: 'ילקוט יוסף', displayRef: loaded.section.label, target: yalkutTarget(loaded.section) };
  if (store === 'halacha-answers') {
    // The question is the row's title; the snippet starts after it (its words stay highlighted where they recur).
    const lead = `${loaded.entry.question} · `;
    if (!snippet.before && snippet.text.startsWith(lead)) base.snippet = { ...snippet, text: snippet.text.slice(lead.length), highlights: snippet.highlights.filter(([s0]) => s0 >= lead.length).map(([s0, e0]) => [s0 - lead.length, e0 - lead.length]) };
  }
  if (store === 'halacha-answers') return { ...base, workTitle: loaded.entry.authority === 'ong-shabbat' ? 'עונג שבת · תשובה' : 'תשובת הלכה', displayRef: loaded.entry.question, target: answerTarget(loaded.entry.id), answer: true };
  const work = workById(workId);
  const anchor = loaded.unit?.v || null;
  return {
    ...base,
    workTitle: work.title,
    commentator: work.relation ? work.layerTitle || work.title : null,
    displayRef: displayRef(work, node, unit, { anchor }),
    target: targetFor(work, node, unit, { anchor, unitId: loaded.unit?.id }),
  };
}

// ---------- A future semantic layer's boundary (not implemented) ----------
// A later layer may propose candidate references for a query and rerank references — it never owns text or data.
// Both hooks receive and return canonical references only; the engine above stays the source of every snippet.
export const SEMANTIC_BOUNDARY = Object.freeze({
  candidateRefs: null, // async (query) => [{ workId, section, segment }]
  rerankRefs: null, // async (query, refs) => refs (same set, new order)
});

export { WORKS };
