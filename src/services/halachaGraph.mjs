// The Halacha knowledge graph, assembled from the app's own structured data (no database). Every node and edge comes
// from data that already exists and is verified elsewhere; the graph only connects it. Loaded on demand.
//   nodes: entry, section (Yalkut Yosef), book, sa (Shulchan Arukh siman), topic, category, context, flow, step,
//          siddur (siddur section), concept (glossary), track
//   edges: sourcedFrom, supportedBy, inBook, parallelOf, sameTopic, inCategory, appliesWhen, decisionOutcome, followUp,
//          differsWhen, appearsInSiddur, usesConcept, partOfTrack, nextInTrack, relatedTo, answeredAlsoIn
import { PRACTICAL_HALACHA_QA } from '../data/practicalHalachaQa.mjs';
import { HALACHA_FLOWS } from '../data/halachaFlows.mjs';
import { FLOW_HINTS } from '../data/halachaFlowHints.mjs';
import { SIDDUR_HALACHA } from '../data/halachaSiddurLinks.mjs';
import { HALACHA_GLOSSARY } from '../data/halachaGlossary.mjs';
import { HALACHA_TRACKS } from '../data/halachaTracks.mjs';
import { HALACHA_SOURCE_MAP } from '../data/halachaSourceMap.mjs';
import { CONTEXT_LABELS, relatedWithReasons } from './halachaEngine.mjs';
import { findGlossaryTerms } from './halachaGlossaryText.mjs';
import { hebrewNumeral } from './hebrewNumerals.mjs';

export function buildHalachaGraph({ withRelated = true } = {}) {
  const nodes = new Map();
  const edges = [];
  const node = (id, type, label) => { if (!nodes.has(id)) nodes.set(id, { id, type, label }); return id; };
  const edge = (from, type, to, extra = {}) => edges.push({ from, type, to, ...extra });
  const published = PRACTICAL_HALACHA_QA.filter(entry => entry.answerStatus === 'published');

  // Each source knows its book: a Yalkut Yosef section (סימן/סעיף) or a halacha of עונג שבת (פרק/הלכה/עמוד).
  const BOOK_OF = { 'local-ong-shabbat': ['book:ong-shabbat', 'עונג שבת', 'עונג שבת'] };
  const bookOf = source => BOOK_OF[source.sourceType] || ['book:yalkut-yosef', 'קיצור שולחן ערוך ילקוט יוסף', 'ילקוט יוסף'];
  node('book:yalkut-yosef', 'book', 'קיצור שולחן ערוך ילקוט יוסף');
  for (const entry of published) {
    const id = node(`entry:${entry.id}`, 'entry', entry.question);
    entry.sources.forEach((source, index) => {
      const [bookId, bookTitle, shortTitle] = bookOf(source);
      node(bookId, 'book', bookTitle);
      const section = node(`section:${source.localSourceId}`, 'section', `${shortTitle}, ${source.citation}`);
      edge(id, index === 0 ? 'sourcedFrom' : 'supportedBy', section);
      if (!edges.some(item => item.from === section && item.type === 'inBook')) edge(section, 'inBook', bookId);
    });
    // The same question answered in another book (עונג שבת ↔ ילקוט יוסף): shown side by side, never merged.
    for (const other of entry.yalkutParallels || []) edge(id, 'answeredAlsoIn', `entry:${other}`);
    const category = node(`category:${entry.category}`, 'category', entry.category);
    const topic = node(`topic:${entry.category}/${entry.topic}`, 'topic', entry.topic);
    edge(id, 'sameTopic', topic);
    if (!edges.some(item => item.from === topic && item.type === 'inCategory')) edge(topic, 'inCategory', category);
    for (const key of entry.contexts || []) edge(id, 'appliesWhen', node(`context:${key}`, 'context', CONTEXT_LABELS[key] || key));
    for (const term of findGlossaryTerms(entry.shortAnswer)) edge(id, 'usesConcept', node(`concept:${term.id}`, 'concept', term.term));
    const parallel = HALACHA_SOURCE_MAP[entry.id];
    if (parallel) {
      const book = node(`book:shulchan-arukh-${parallel.book}`, 'book', `שולחן ערוך ${parallel.bookHe}`);
      const siman = node(`sa:${parallel.book}:${parallel.siman}`, 'sa', `שולחן ערוך ${parallel.bookHe}, סימן ${/^\d+$/.test(String(parallel.siman)) ? hebrewNumeral(Number(parallel.siman)) : parallel.siman}`);
      edge(`section:${entry.sources[0].localSourceId}`, 'parallelOf', siman, { verifiedBy: 'wording', rank: parallel.rank });
      if (!edges.some(item => item.from === siman && item.type === 'inBook')) edge(siman, 'inBook', book);
    }
  }
  for (const flow of HALACHA_FLOWS) {
    const id = node(`flow:${flow.id}`, 'flow', flow.title);
    for (const outcome of Object.values(flow.outcomes)) for (const entryId of outcome.entryIds || []) {
      edge(id, 'decisionOutcome', `entry:${entryId}`);
      edge(`entry:${entryId}`, 'followUp', id);
    }
    for (const [stepId, hint] of Object.entries(FLOW_HINTS[flow.id] || {})) {
      if (!hint.whyAsked?.length) continue;
      const step = node(`step:${flow.id}/${stepId}`, 'step', flow.steps[stepId].question);
      edge(id, 'hasStep', step);
      for (const entryId of hint.whyAsked) edge(step, 'differsWhen', `entry:${entryId}`);
    }
  }
  for (const [key, info] of Object.entries(SIDDUR_HALACHA)) {
    const id = node(`siddur:${key}`, 'siddur', info.title);
    for (const entryId of info.entryIds) edge(id, 'appearsInSiddur', `entry:${entryId}`);
    for (const flowId of info.flows) edge(id, 'appearsInSiddur', `flow:${flowId}`);
  }
  for (const term of HALACHA_GLOSSARY) node(`concept:${term.id}`, 'concept', term.term);
  for (const track of HALACHA_TRACKS) {
    const id = node(`track:${track.id}`, 'track', track.title);
    track.entryIds.forEach((entryId, index) => {
      edge(`entry:${entryId}`, 'partOfTrack', id);
      if (index > 0) edge(`entry:${track.entryIds[index - 1]}`, 'nextInTrack', `entry:${entryId}`, { track: track.id });
    });
  }
  if (withRelated) for (const entry of published) for (const { entry: other, reason } of relatedWithReasons(entry, { pool: published, limit: 3 })) edge(`entry:${entry.id}`, 'relatedTo', `entry:${other.id}`, { reason });
  return { nodes, edges };
}

export function graphStats(graph) {
  const byType = (list, key) => list.reduce((map, item) => ({ ...map, [item[key]]: (map[item[key]] || 0) + 1 }), {});
  return { nodes: graph.nodes.size, edges: graph.edges.length, nodeTypes: byType([...graph.nodes.values()], 'type'), edgeTypes: byType(graph.edges, 'type') };
}

export function danglingEdges(graph) {
  return graph.edges.filter(edge => !graph.nodes.has(edge.from) || !graph.nodes.has(edge.to));
}
