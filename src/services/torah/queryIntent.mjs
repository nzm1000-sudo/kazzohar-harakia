// Query understanding, deterministic and on the device (no model, no network, nothing leaves the phone):
//   intent       'reference' (an exact place) · 'quote' (words in quotation marks) · 'question' (a natural question)
//                · 'topic' (a few words of the sources)
//   optional     question scaffolding (מה, איך, איפה כתוב, מה עושים, אפשר…) — searched, never required
//   rewrites     the question in the sources' words (data/torah/semanticLexicon.mjs), each weighted below the words
//                as typed and explained; plus conservative morphology (שכחתי → שכח) as its own penalized form
// Nothing here removes a word from the search silently: every rewrite is an extra variant, the typed query stays first.
import { CONCEPTS, QUESTION_OPENERS, QUESTION_SCAFFOLDING, RELATION_WEIGHT, TOPIC_ALIASES } from '../../data/torah/semanticLexicon.mjs';
import { isPrefixOf, tokenize } from './hebrew.mjs';

export const MORPH_WEIGHT = 0.85;
const OPENERS = new Set(QUESTION_OPENERS.map(word => tokenize(word).join('')));
const SCAFFOLDING = new Set(QUESTION_SCAFFOLDING.map(word => tokenize(word).join('')));
const ENTRIES = [...CONCEPTS, ...TOPIC_ALIASES.map((item, i) => ({ id: `topic-${i}`, ...item }))].map(concept => ({
  ...concept,
  forms: concept.forms.map(form => tokenize(form)).filter(form => form.length).sort((a, b) => b.length - a.length),
  // A merely related word is searched only for a concept with nothing closer (כיפה → גילוי הראש); otherwise it would
  // cost a search of a very common word for little.
  expansions: concept.expansions.filter(item => item.rel !== 'related' || concept.expansions.every(other => other.rel === 'related')).map(item => ({ tokens: tokenize(item.text), rel: item.rel, weight: RELATION_WEIGHT[item.rel] ?? 0.5, text: item.text })),
}));

// A query word matches a form word as written or with a prefix letter (כשלא ↔ לא, שמצאתי ↔ מצאתי); only the first
// word of a phrase may carry a prefix.
const wordMatches = (typed, form, first) => typed === form || (first && typed.length > form.length && typed.endsWith(form) && typed.length - form.length <= 2 && isPrefixOf(typed.slice(0, typed.length - form.length)));

// First-person past (שכחתי, בירכתי, מצאתי, אכלתי) → the third person the sources use (שכח, בירכ, מצא, אכל). Only a word of
// five letters or more, and only as an extra form — the typed word always stays.
export function firstPersonStem(token) {
  if (token.length >= 5 && token.endsWith('תי')) return token.slice(0, -2);
  if (token.length >= 5 && token.endsWith('נו') && !token.endsWith('ינו')) return token.slice(0, -2);
  return null;
}

// → { intent, tokens, optional: Set, concepts: [{ id, at, length, expansions }], rewrites: [variant] }
export function analyzeQuery(text, { reference = null } = {}) {
  const raw = String(text || '').trim();
  const tokens = tokenize(raw).filter(token => token.length >= 2).slice(0, 10);
  const quoted = /^["״“”'׳].+["״“”'׳]$/.test(raw) && tokens.length > 1;
  const concepts = [];
  const used = new Array(tokens.length).fill(false);
  for (let i = 0; i < tokens.length; i += 1) {
    if (used[i]) continue;
    let best = null;
    for (const concept of ENTRIES) {
      for (const form of concept.forms) {
        if (i + form.length > tokens.length || (best && form.length <= best.length)) continue;
        if (form.every((word, k) => !used[i + k] && wordMatches(tokens[i + k], word, k === 0))) { best = { id: concept.id, at: i, length: form.length, expansions: concept.expansions, note: concept.note }; break; }
      }
    }
    // One concept once: a second phrase of the same concept (להחזיר חפץ … שנמצא) adds nothing but repetition.
    if (best && concepts.some(item => item.id === best.id)) { for (let k = 0; k < best.length; k += 1) used[best.at + k] = true; best.duplicate = true; }
    if (best && !best.duplicate) { concepts.push(best); for (let k = 0; k < best.length; k += 1) used[best.at + k] = true; }
  }
  const scaffolding = tokens.filter(token => SCAFFOLDING.has(token));
  const firstPerson = tokens.some(token => firstPersonStem(token) && !SCAFFOLDING.has(token));
  const question = !quoted && !reference && (/[?？]\s*$/.test(raw) || OPENERS.has(tokens[0]) || (firstPerson && tokens.length >= 2) || (tokens.length >= 4 && scaffolding.length >= 2));
  const intent = reference ? 'reference' : quoted ? 'quote' : question ? 'question' : 'topic';
  // Scaffolding is optional only in a question, and never every word (something must be searched).
  let optional = new Set(question ? tokens.filter((token, i) => SCAFFOLDING.has(token) && !concepts.some(c => i >= c.at && i < c.at + c.length)) : []);
  if (optional.size >= tokens.length) optional = new Set();
  const rewrites = [];
  if (intent !== 'reference' && intent !== 'quote') {
    // Rewrite n: every concept in the sources' words (its n-th expansion; single words of one concept searched
    // together as alternatives in the first rewrite). Required words that are not concepts stay as typed.
    // In a rewrite, scaffolding never stays required (the rewrite already says the subject in the sources' words), and a
    // word consumed by a repeated concept is dropped.
    const consumed = new Set();
    for (let i = 0; i < tokens.length; i += 1) if (used[i] && !concepts.some(c => i >= c.at && i < c.at + c.length)) consumed.add(i);
    const kept = (i, replaced) => (optional.has(tokens[i]) || SCAFFOLDING.has(tokens[i]) || consumed.has(i) ? null : replaced ?? tokens[i]);
    const build = pick => {
      const out = [];
      let weight = 1;
      const via = [];
      for (let i = 0; i < tokens.length; i += 1) {
        const concept = concepts.find(c => c.at === i);
        if (concept) {
          const chosen = pick(concept);
          if (!chosen) { for (let k = 0; k < concept.length; k += 1) if (!optional.has(tokens[i + k])) out.push(tokens[i + k]); i += concept.length - 1; continue; }
          out.push(...chosen.slots);
          weight = Math.min(weight, chosen.weight);
          via.push(`${tokens.slice(i, i + concept.length).join(' ')} → ${chosen.label}`);
          i += concept.length - 1;
          continue;
        }
        if (concepts.some(c => i > c.at && i < c.at + c.length)) continue;
        const stem = question ? firstPersonStem(tokens[i]) : null;
        if (stem && !optional.has(tokens[i])) { out.push({ label: tokens[i], alts: [[tokens[i], 1], [stem, MORPH_WEIGHT]] }); via.push(`${tokens[i]} → ${stem}`); continue; }
        const word = kept(i);
        if (word) out.push(word);
      }
      return out.length ? { tokens: out, weight, via: via.join(' · '), kind: 'rewrite' } : null;
    };
    if (concepts.length) {
      // 1 — each concept's first expansion; a single word is searched together with the concept's other single words
      //     of the same strength (never with a merely related word).
      rewrites.push(build(concept => {
        const first = concept.expansions[0];
        if (first.tokens.length > 1) return { slots: first.tokens, weight: first.weight, label: first.text };
        const singles = concept.expansions.filter(item => item.tokens.length === 1 && item.rel !== 'related');
        return { slots: [{ label: first.tokens[0], alts: singles.map(item => [item.tokens[0], item.weight]) }], weight: first.weight, label: singles.map(item => item.text).join(' / ') };
      }));
      // 2… — the other expansions (a phrase of its own: כבוד אב ואם, המספר בגנות; or the related single words).
      const extra = Math.max(0, ...concepts.map(concept => concept.expansions.length - 1));
      for (let n = 1; n <= Math.min(extra, 3); n += 1) {
        rewrites.push(build(concept => {
          const item = concept.expansions[n] || concept.expansions[0];
          return { slots: item.tokens.length > 1 ? item.tokens : [{ label: item.tokens[0], alts: [[item.tokens[0], item.weight]] }], weight: item.weight, label: item.text };
        }));
      }
    } else if (question && tokens.some(token => firstPersonStem(token) && !optional.has(token))) {
      rewrites.push(build(() => null));
    }
  }
  const seen = new Set();
  const unique = rewrites.filter(Boolean).filter(item => { const key = JSON.stringify(item.tokens); if (seen.has(key)) return false; seen.add(key); return true; });
  return { intent, tokens, optional, concepts: concepts.map(({ id, at, length, note }) => ({ id, at, length, note })), rewrites: unique };
}
