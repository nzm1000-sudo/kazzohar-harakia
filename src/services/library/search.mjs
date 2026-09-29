// Library search: works by title/author/category, and exact references for Tanakh, Mishnah and Bavli.
// References are resolved only when the whole query parses; loose numbers are never guessed into references.
import { normalizeForSearch } from '../../hebrewText.mjs';
import { hebrewToNumber, parseDafInput } from '../talmud.mjs';
import { categoryById } from '../../data/library/registry.mjs';
import { nodeForPage } from './pagination.mjs';

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

// A printed page: "זוהר ח"א טו ע"א", "זהר חלק א דף טו.", "זוהר ב קכג:" → volume, daf, amud (all three required).
const PAGE_FILLER = new Set(['חלק', 'דפ', 'דף', 'ח', 'ע', 'עמוד']);
function pageInto(work, rest) {
  const tokens = rest.replace(/\./g, ' א').replace(/:/g, ' ב').replace(/,/g, ' ').split(' ').filter(token => token && !PAGE_FILLER.has(token));
  if (tokens.length !== 3) return null;
  const [volume, daf, side] = tokens;
  const v = /^\d$/.test(volume) ? Number(volume) : hebrewToNumber(volume);
  const d = /^\d+$/.test(daf) ? Number(daf) : hebrewToNumber(daf);
  if (!Number.isInteger(v) || !Number.isInteger(d) || !['א', 'ב'].includes(side)) return null;
  const node = nodeForPage(work.editions[0].pagination, v, `${d}${side === 'א' ? 'a' : 'b'}`);
  return node && work.editions[0].nodes[node - 1] ? { node, unit: null } : null;
}

// Written forms of a reference → the spelling the matcher knows: quote variants, the Shulchan Arukh's abbreviations and
// the words סימן / סעיף / ס"ק around the numbers ("שו״ע אורח חיים סימן שיח סעיף א" → "שולחן ערוך אורח חיים שיח א").
// Only the reference grammar is touched; a query that is not a whole reference still resolves to nothing.
const SA_PART_FORMS = [['אורח חיים', 'או"ח|אורח חיים'], ['יורה דעה', 'יו"ד|יורה דעה'], ['חושן משפט', 'חו"מ|חושן משפט|חשן משפט'], ['אבן העזר', 'אה"ע|אבן העזר']];
export function canonicalReferenceText(query) {
  let text = ` ${String(query || '').replace(/[״“”„]/g, '"').replace(/[׳‘’`´]/g, "'").replace(/\s+/g, ' ').trim()} `;
  for (const [part, forms] of SA_PART_FORMS) text = text.replace(new RegExp(`\\s(?:שו"ע|ש"ע|שולחן ערוך|שלחן ערוך)\\s*,?\\s*(?:${forms})(?=[\\s,])`), ` שולחן ערוך ${part}`);
  text = text
    .replace(/\s(?:ס"ק|סק"|סעיף קטן)(?=\s)/g, ' ')
    .replace(/\s(?:סימן|סי'|סי)(?=\s)/g, ' ')
    .replace(/\s(?:סעיף|סע')(?=\s)/g, ' ')
    .replace(/\s(?:ס"(?!ק)([א-ת]{1,2}))(?=\s)/g, ' $1')
    .replace(/,/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
}
// A daf written with its amud as a mark or a word: "ברכות ב." (ע"א), "שבת קיח:" (ע"ב), "ברכות דף ב עמוד א".
function explicitAmud(text) {
  const m = /^(.+?)\s+(?:דף\s+)?([א-ת"'״׳]+|\d+)\s*(?:([.:])|(?:עמוד|עמ')\s*([אב])|ע["״']?([אב]))$/.exec(text);
  if (!m) return null;
  const side = m[3] === '.' || m[4] === 'א' || m[5] === 'א' ? 'א' : 'ב';
  const daf = parseDafInput(`${m[1].replace(/^מסכת\s+/, '')} ${m[2]} ע"${side}`);
  return daf.amud && !daf.error ? { kind: 'route', route: `talmud/${encodeURIComponent(daf.tractate.title)}/${daf.amud}`, label: `תלמוד בבלי · ${daf.tractate.heTitle}` } : null;
}

export function resolveLibraryReference(query, works) {
  const text = canonicalReferenceText(query);
  if (!text) return null;
  const amudHit = !/^משנה\s/.test(text) && explicitAmud(text);
  if (amudHit) return amudHit;
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
  const paged = packaged.filter(work => work.editions[0].pagination && !work.relation).map(work => ({ work, names: [work.title, ...(work.aliases || [])] }));
  const pageHit = matchTitle(text, paged);
  if (pageHit?.rest) {
    const point = pageInto(pageHit.candidate.work, pageHit.rest);
    if (point) return { kind: 'pack', workId: pageHit.candidate.work.workId, ...point, label: pageHit.candidate.work.title };
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
    // An exact alias is the book's name as learners say it ("זוהר" → ספר הזהר).
    const score = title === needle || (work.aliases || []).some(alias => comparable(alias) === needle) ? 0 : title.startsWith(needle) ? 1 : title.includes(needle) ? 2 : authors.includes(needle) ? 3 : skeleton(title).includes(skeleton(needle)) ? 3.5 : 4;
    scored.push({ work, score, matchedAuthor: score === 3 });
  }
  // On an equal match the Jerusalem Talmud follows the Mishnah and the Bavli of the same name, as learners look for them,
  // and a commentary follows the text it explains ("ברכות": the Mishnah and the Bavli, then Bartenura on Berakhot).
  // A book that belongs to a tractate without being anchored to it (the Rif, on his own pages) is placed like one.
  const later = work => (work.relation || work.onTractate ? 2 : work.group === 'yerushalmi' ? 1 : 0);
  return scored.sort((a, b) => a.score - b.score || later(a.work) - later(b.work) || a.work.title.localeCompare(b.work.title, 'he'));
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
