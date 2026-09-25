// Library search: works by title/author/category, and exact references for Tanakh, Mishnah and Bavli.
// References are resolved only when the whole query parses; loose numbers are never guessed into references.
import { normalizeForSearch } from '../../hebrewText.mjs';
import { hebrewToNumber, parseDafInput } from '../talmud.mjs';
import { categoryById } from '../../data/library/registry.mjs';

const HEBREW_NUMBER = /^(?:\d+|[א-ת]+)$/;
const FILLER = new Set(['פרק', 'פסוק', 'משנה', 'הלכה']);
// Maqaf joins words visually but separates them for search.
const comparable = text => normalizeForSearch(String(text || '').replace(/\u05BE/g, ' ').replace(/[{}()[\]]/g, ' '));
// Plene/defective spelling (שולחן/שלחן) differs only in ו/י; used for matching, never for display.
const skeleton = text => text.replace(/[וי]/g, '');

function numbers(rest) {
  const tokens = normalizeForSearch(rest.replace(/[,:.]/g, ' ')).split(' ').filter(Boolean).filter(token => !FILLER.has(token));
  if (tokens.length > 2 || !tokens.every(token => HEBREW_NUMBER.test(token))) return null;
  const values = tokens.map(hebrewToNumber);
  return values.every(value => Number.isInteger(value) && value > 0) ? values : null;
}

function pointInto(work, [node, unit] = []) {
  const counts = work.editions[0].nodes;
  if (node && !counts[node - 1]) return null;
  if (unit && unit > counts[node - 1]) return null;
  return { node: node || null, unit: unit || null };
}

// Longest title prefix wins, so "שמואל א" is not read as "שמואל" + chapter 1.
function matchTitle(query, candidates) {
  const normalized = normalizeForSearch(query);
  let best = null;
  for (const candidate of candidates) {
    for (const name of candidate.names) {
      const key = normalizeForSearch(name);
      if ((normalized === key || normalized.startsWith(`${key} `)) && (!best || key.length > best.key.length)) best = { candidate, key };
    }
  }
  return best ? { ...best, rest: normalized.slice(best.key.length).trim() } : null;
}

export function resolveLibraryReference(query, works) {
  const text = String(query || '').trim();
  if (!text) return null;
  const packaged = works.filter(work => work.kind === 'pack');
  const tanakh = packaged.filter(work => work.primaryCategory === 'tanakh').map(work => ({ work, names: [work.title] }));
  const mishnah = packaged.filter(work => work.primaryCategory === 'mishnah').map(work => ({ work, names: [work.title, work.title.replace(/^משנה\s+/, '')] }));
  const explicitMishnah = /^משנה\s/.test(normalizeForSearch(text));

  const tanakhHit = !explicitMishnah && matchTitle(text, tanakh);
  if (tanakhHit) {
    const values = tanakhHit.rest ? numbers(tanakhHit.rest) : [];
    const point = values && pointInto(tanakhHit.candidate.work, values);
    if (point) return { kind: 'pack', workId: tanakhHit.candidate.work.workId, ...point, label: tanakhHit.candidate.work.title };
  }
  if (!explicitMishnah) {
    const daf = parseDafInput(text);
    if (daf.amud && !daf.error) return { kind: 'route', route: `talmud/${encodeURIComponent(daf.tractate.title)}/${daf.amud}`, label: `תלמוד בבלי · ${daf.tractate.heTitle}` };
    if (daf.needsSide) return { kind: 'route', route: `talmud/${encodeURIComponent(daf.tractate.title)}/${daf.daf}a`, label: `תלמוד בבלי · ${daf.tractate.heTitle}` };
  }
  const mishnahHit = matchTitle(text.replace(/^משנה\s+/, 'משנה '), mishnah);
  if (mishnahHit) {
    const values = mishnahHit.rest ? numbers(mishnahHit.rest) : [];
    const point = values && pointInto(mishnahHit.candidate.work, values);
    if (point) return { kind: 'pack', workId: mishnahHit.candidate.work.workId, ...point, label: mishnahHit.candidate.work.title };
  }
  const aliased = packaged.filter(work => work.aliases?.length).map(work => ({ work, names: [work.title, ...work.aliases] }));
  const aliasHit = matchTitle(text, aliased);
  if (aliasHit) {
    const values = aliasHit.rest ? numbers(aliasHit.rest) : [];
    const point = values && pointInto(aliasHit.candidate.work, values);
    if (point) return { kind: 'pack', workId: aliasHit.candidate.work.workId, ...point, label: aliasHit.candidate.work.title };
  }
  return null;
}

export function searchWorks(query, works) {
  const needle = comparable(query);
  if (needle.length < 2) return [];
  const terms = needle.split(' ');
  const scored = [];
  for (const work of works) {
    const title = comparable(`${work.title} ${work.shortTitle || ''}`);
    const authors = comparable(work.authors.join(' '));
    const category = comparable([work.primaryCategory, ...work.secondaryCategories].map(id => categoryById(id)?.title || '').join(' '));
    const haystack = `${title} ${authors} ${category} ${comparable(work.sourceTitle || '')} ${comparable((work.aliases || []).join(' '))}`;
    const loose = skeleton(haystack);
    if (!terms.every(term => haystack.includes(term) || loose.includes(skeleton(term)))) continue;
    const score = title === needle ? 0 : title.startsWith(needle) ? 1 : title.includes(needle) ? 2 : authors.includes(needle) ? 3 : skeleton(title).includes(skeleton(needle)) ? 3.5 : 4;
    scored.push({ work, score, matchedAuthor: score === 3 });
  }
  return scored.sort((a, b) => a.score - b.score || a.work.title.localeCompare(b.work.title, 'he'));
}

// In-book search over one loaded chunk. The display text is never modified; only the comparison copy is normalized.
export function searchChunk(chunk, query, limit = 60) {
  const needle = comparable(query);
  if (needle.length < 2) return [];
  const hits = [];
  for (const node of chunk.nodes) {
    for (const unit of node.units) {
      const plain = comparable(unit.text);
      const at = plain.indexOf(needle);
      if (at < 0) continue;
      hits.push({ node: node.n, unit: unit.n, id: unit.id, snippet: `${at > 30 ? '…' : ''}${plain.slice(Math.max(0, at - 30), at + needle.length + 40)}…` });
      if (hits.length >= limit) return hits;
    }
  }
  return hits;
}
