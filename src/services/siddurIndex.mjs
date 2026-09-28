// The Siddur home's index for one rite: the edition's table of contents (Sefaria's schema tree) read through the rite's
// layout (data/nusach/siddurLayouts.mjs). Pure: nodes and a layout in, rows and reading flows out. The same module
// maps a place in one rite to its counterpart in another (changing the rite mid-prayer keeps the user at the same
// prayer and section wherever the other rite has one).
import { siddurLayout, rootKey, halachaConceptForTitle } from '../data/nusach/siddurLayouts.mjs';
import { prayerTypeFromFlowKey } from './prayerConditions.mjs';

export const siddurTitle = (node, lang) => node?.titles?.find(item => item.lang === lang && item.primary)?.text || (lang === 'he' ? node?.heTitle : node?.title) || node?.key || '';

// A root of the layout, found in the tree by its English path; null when this edition has no such node.
export function resolveRoot(nodes, path) {
  const titles = Array.isArray(path) ? path : [path];
  let level = nodes;
  let node = null;
  for (const title of titles) {
    node = (level || []).find(candidate => siddurTitle(candidate, 'en') === title) || null;
    if (!node) return null;
    level = node.nodes;
  }
  return { key: rootKey(titles), path: titles, title: siddurTitle(node, 'he').trim(), en: titles.at(-1), node };
}

const leavesOf = (node, path) => (node.nodes ? node.nodes.flatMap(child => leavesOf(child, [...path, siddurTitle(child, 'en')])) : [{ node, path }]);

// The rows of one root: each child of the root is a row. A leaf opens itself; a group opens as one page made of its
// leaves (an address list joined by "; ", read as one text). `visible(rootKey, name)` applies the day's conditions.
export function rootItems(root, indexTitle, layout, visible = () => true, { has = () => true } = {}) {
  const isHidden = path => (layout.hidden || []).some(hidden => hidden.length === path.length && hidden.every((title, i) => title === path[i]));
  const ref = path => [indexTitle, ...path].join(', ');
  const children = root.node.nodes ? root.node.nodes : [root.node];
  const items = [];
  for (const child of children) {
    const en = siddurTitle(child, 'en');
    const path = root.node.nodes ? [...root.path, en] : root.path;
    if (isHidden(path) || !visible(root.key, en)) continue;
    const leaves = child.nodes ? leavesOf(child, path).filter(leaf => !isHidden(leaf.path) && visible(root.key, leaf.path.at(-1)) && has(ref(leaf.path))) : [{ node: child, path }];
    if (!leaves.length) continue;
    items.push({ reference: leaves.map(leaf => ref(leaf.path)).join('; '), title: siddurTitle(child, 'he').trim() || root.title, en, rootEn: root.key, rootHe: root.title, mode: 'nikud', concept: halachaConceptForTitle(`${en} ${root.en}`) });
  }
  const preferred = layout.flowOrder?.[root.key];
  if (!preferred) return items;
  return [...preferred.map(name => items.find(item => item.en === name)).filter(Boolean), ...items.filter(item => !preferred.includes(item.en))];
}

// Every root of the layout (its groups, then the festival roots), with its rows.
export function siddurRoots(nodes, indexTitle, layout, visible, options = {}) {
  const paths = [...layout.groups.flatMap(group => group.roots), ...(layout.moadimRoots || [])];
  const has = options.has || (() => true);
  return paths.map(path => {
    // A virtual root: rows the layout provides itself (a book of the bundled Tanakh, read in the rite's own order).
    if (path && typeof path === 'object' && !Array.isArray(path)) return { key: path.key, path: [path.key], title: path.title, en: path.key, node: null, items: path.items.map(item => ({ ...item, en: item.en || item.title, rootEn: path.key, rootHe: path.title, mode: item.mode || 'nikud', concept: null })) };
    const root = resolveRoot(nodes, path);
    // A row opens only what the installed pack holds — offline, always.
    return root && { ...root, items: rootItems(root, indexTitle, layout, visible, options).filter(item => item.reference.split('; ').every(has)) };
  }).filter(root => root && root.items.length);
}

// Reading flows: each root is one flow (previous / next inside it), each row a stop; the navigation descriptor is what
// SourceReader expects. `openSource(reference, title, mode, navigation)` is the app's reader entry.
export function buildSiddurFlows(roots, openSource) {
  const navigation = new Map();
  const allItems = [];
  for (const root of roots) {
    const flow = root.items;
    flow.forEach((item, index) => {
      navigation.set(item.reference, {
        flowKey: root.key, flowTitle: root.title, itemEn: item.en, concept: item.concept,
        flow: flow.map(({ reference, title, mode }) => ({ reference, title, mode })),
        index, returnRoute: 'siddur', backLabel: 'חזרה לסידור', breadcrumbs: [{ label: 'סידור', route: 'siddur' }],
        onBack: () => history.back(),
        previous: flow[index - 1] || null, next: flow[index + 1] || null,
        endLabel: `סיימת את ${root.title}`,
        onSelect: target => openSource(target.reference, target.title, target.mode, navigation.get(target.reference)),
      });
    });
    allItems.push(...flow);
  }
  return { allItems, navigation };
}

// Where a place in one rite lives in another: the same prayer (by its root: weekday / Shabbat, Shacharit / Mincha /
// Arvit) and, inside it, the row of the same concept (Amidah, Shema…) or the same English name. Null when the other
// rite has no such prayer (Chabad has no Shabbat services) — the caller then stays on the Siddur home, honestly.
export function counterpartIn(current, targetRoots, { toNusach }) {
  if (!current?.rootEn) return null;
  const prayerType = prayerTypeFromFlowKey(current.rootEn);
  const isShabbat = /shabbat|shabbos/i.test(current.rootEn);
  // A Shabbat prayer maps to a Shabbat prayer only: a rite whose licensed source has no Shabbat services has no counterpart.
  const table = isShabbat ? siddurLayout(toNusach).prayerRoots.shabbat : siddurLayout(toNusach).prayerRoots.weekday;
  const targetKey = prayerType && table ? table[prayerType] || null : null;
  if (prayerType && !targetKey) return null;
  const root = (targetKey && targetRoots.find(item => item.key === targetKey)) || (!prayerType && targetRoots.find(item => item.key === current.rootEn)) || null;
  if (!root) return null;
  const concept = current.concept || halachaConceptForTitle(current.en || '');
  const item = root.items.find(candidate => candidate.en === current.en)
    || (concept && root.items.find(candidate => candidate.concept === concept))
    || root.items[0];
  return item ? { root, item } : null;
}

export { siddurLayout };
