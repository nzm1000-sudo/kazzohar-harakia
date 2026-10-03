// סדר השכמת הבוקר — one page (owner, 2026-10-03): "כל ברכות השחר ממודה אני ועד ואני אברכם צריכים להיות בלשונית
// אחת", and at its end "הבא" goes on to שחרית — opened right after ברכות השחר, which were just said.
//
// A rite whose layout names a `hashkama` (data/nusach/siddurLayouts.mjs) reads its morning-rising order as ONE reading:
// the edition's own leaves, whole and in order, joined into one address ("A; B; C" — getText reads them as one text).
// Nothing of the text is touched: the page is exactly its leaves, one after another. Inside it, each leaf keeps a
// centred heading (the edition's own title of that leaf) and the reader's "תוכן" jumps between them.
// Pure: no React, no storage.
import { NUSACHIM } from '../data/nusach/registry.mjs';
import { SIDDUR_LAYOUTS } from '../data/nusach/siddurLayouts.mjs';
import { removeNikud } from '../hebrewText.mjs';

export const HASHKAMA_TITLE = 'סדר השכמת הבוקר';
// The page's row in the Siddur's flows (itemEn): what it is said as, ברכות השחר.
export const HASHKAMA_EN = 'Morning Blessings';
// The reader's place in Shacharit when it is opened from the end of the page: the first section after ברכות השחר.
export const AFTER_HASHKAMA = 'after-hashkama';
// The "הבא" of the page: not a text of the edition but the next prayer, שחרית, opened by the Siddur's own route.
export const HASHKAMA_CONTINUE = 'continue:shacharit-after-hashkama';
export const HASHKAMA_NEXT_TITLE = 'שחרית';
export const hashkamaContinueTarget = () => ({ reference: HASHKAMA_CONTINUE, title: HASHKAMA_NEXT_TITLE, mode: 'nikud' });
export const isHashkamaContinue = target => (target?.reference || target) === HASHKAMA_CONTINUE;

const indexOf = nusach => NUSACHIM.find(item => item.id === nusach)?.index || null;
// Only a rite that names one (no fallback to another rite's layout).
export const hashkamaSpec = nusach => SIDDUR_LAYOUTS[nusach]?.hashkama || null;
export const HASHKAMA_ROOTS = Object.freeze(Object.values(SIDDUR_LAYOUTS).map(layout => layout.hashkama?.root).filter(Boolean));
export const isHashkamaRoot = rootKey => HASHKAMA_ROOTS.includes(String(rootKey || ''));

// The full addresses of the page's leaves, in order.
export function hashkamaLeaves(nusach) {
  const spec = hashkamaSpec(nusach);
  const index = indexOf(nusach);
  return spec && index ? spec.leaves.map(path => [index, ...path].join(', ')) : [];
}
export const hashkamaReference = nusach => hashkamaLeaves(nusach).join('; ');

// What an address is to the page: the page itself ({ nusach, leaf: -1 }), one of its leaves — an address of the time
// when each leaf was a page of its own ({ nusach, leaf: n }) — or nothing (null).
export function hashkamaOf(reference) {
  const ref = String(reference || '').trim();
  if (!ref) return null;
  for (const { id } of NUSACHIM) {
    const leaves = hashkamaLeaves(id);
    if (!leaves.length) continue;
    if (ref === leaves.join('; ')) return { nusach: id, leaf: -1 };
    const leaf = leaves.indexOf(ref);
    if (leaf >= 0) return { nusach: id, leaf };
  }
  return null;
}
export const isHashkamaReference = reference => hashkamaOf(reference)?.leaf === -1;

// An old address (a single leaf, kept by "המשך קריאה", a favourite, the learning memory or a history entry) opens the
// one page, at that leaf's heading. Any other address is returned as it is.
export function migrateHashkamaReference(reference) {
  const hit = hashkamaOf(reference);
  if (!hit || hit.leaf < 0) return { reference, anchor: null, migrated: false };
  return { reference: hashkamaReference(hit.nusach), anchor: hit.leaf > 0 ? `leaf:${hit.leaf}` : null, migrated: true, nusach: hit.nusach };
}

// The reading flow of the page, as plain data (it survives History state): one stop, its "הבא" שחרית.
export function hashkamaNavigation(nusach, { title = HASHKAMA_TITLE } = {}) {
  const spec = hashkamaSpec(nusach);
  const reference = hashkamaReference(nusach);
  if (!spec || !reference) return null;
  return {
    flowKey: spec.root, flowTitle: title, itemEn: HASHKAMA_EN, concept: '',
    flow: [{ reference, title, mode: 'nikud' }], index: 0,
    returnRoute: 'siddur', backLabel: 'חזרה לסידור', breadcrumbs: [{ label: 'סידור', route: 'siddur' }],
    continueTo: hashkamaContinueTarget(), endLabel: `סיימת את ${title}`,
  };
}

// The page's sections: one per leaf, titled with the edition's own title of that leaf (its schema), in order.
const titleOf = (node, lang) => node?.titles?.find(item => item.lang === lang && item.primary)?.text || (lang === 'he' ? node?.heTitle : node?.title) || '';
function nodeAt(nodes, path) {
  let level = nodes;
  let node = null;
  for (const title of path) {
    node = (level || []).find(candidate => titleOf(candidate, 'en') === title) || null;
    if (!node) return null;
    level = node.nodes;
  }
  return node;
}
export function hashkamaSections(nusach, nodes = []) {
  const spec = hashkamaSpec(nusach);
  if (!spec) return [];
  const leaves = hashkamaLeaves(nusach);
  return spec.leaves.map((path, leaf) => ({ leaf, reference: leaves[leaf], en: path.at(-1), title: (titleOf(nodeAt(nodes, path), 'he') || path.at(-1)).trim() }));
}

// The joined text numbers its paragraphs leaf by leaf (services/sefaria.mjs getText: index + leaf × 100000).
export const LEAF_STRIDE = 100000;
export const leafOfSource = source => (typeof source === 'number' ? Math.floor(source / LEAF_STRIDE) : -1);

// A printed heading: typed so by the block layer, or presented as one (display 'heading').
const isHeading = block => block?.type === 'heading' || /\bsiddur-display-heading\b/.test(block?.className || '') || block?.display === 'heading';
const plain = text => removeNikud(String(text || '')).replace(/[״׳"'.:]/g, '').replace(/\s+/g, ' ').trim();
// The page's blocks with a heading at the head of every leaf: the leaf's own printed heading when its opening headings
// already name it (Edot HaMizrach prints "ברכות השחר", "ברכות התורה"), else the edition's title of the leaf, added as
// a heading (never as text of the prayer). Every block keeps its place and its words; `anchors[leaf]` is the id the
// contents list jumps to. A leading heading that only repeats the page's own title is dropped from view, as the
// composed prayers do (riteServiceComposer) — the page's title already says it.
export function withHashkamaHeadings(blocks = [], sections = [], { pageTitle = HASHKAMA_TITLE } = {}) {
  const out = [];
  const anchors = {};
  let leaf = -1;
  blocks.forEach((block, index) => {
    const at = leafOfSource(block.source);
    if (at !== leaf && at >= 0) {
      leaf = at;
      const section = sections[at];
      // The run of headings that opens this leaf.
      const opening = [];
      for (let i = index; i < blocks.length && leafOfSource(blocks[i].source) === at && isHeading(blocks[i]); i += 1) opening.push(blocks[i]);
      const own = section ? opening.find(item => plain(item.text) === plain(section.title)) : null;
      if (section && !own) {
        const id = `hashkama-leaf-${at}`;
        out.push({ type: 'heading', role: 'prayer-heading', legacyType: 'section-heading', className: 'siddur-block-heading prayer-heading', text: section.title, source: `hashkama-heading-${at}`, added: true, anchorId: id });
        anchors[at] = id;
      } else if (own) {
        anchors[at] = `segment-${own.source}`;
      }
    }
    if (index === 0 && isHeading(block) && plain(block.text) === plain(pageTitle)) { out.push({ ...block, hidden: true }); return; }
    out.push(block);
  });
  return { blocks: out, anchors };
}

// Where Shacharit opens when it is reached from the page: the first section after the ברכות השחר part — of the Smart
// Siddur's day service (sections grouped 'birchot-hashachar') or of a rite's composed service (part 'birchot-hashachar').
// -1 when the prayer has no such part (it then opens at its top, as always).
export function afterBirchotIndex(sections = []) {
  const inPart = section => section?.group === 'birchot-hashachar' || section?.part === 'birchot-hashachar';
  let last = -1;
  sections.forEach((section, index) => { if (inPart(section)) last = index; });
  if (last < 0) return -1;
  return last + 1 < sections.length ? last + 1 : -1;
}

// An opened reading (NewApp's source entry: { reference, title, navigation, anchor }) as it is opened today: an old
// leaf of the page becomes the page, at that leaf; the page without its flow (opened from "המשך קריאה" or a favourite)
// gets its flow — the one completion and "הבא · שחרית". A leaf opened inside another flow (a rite's printed Shacharit)
// is left as it is.
export function migrateSourceEntry(entry) {
  if (!entry?.reference) return entry;
  const flowKey = entry.navigation?.flowKey;
  if (entry.navigation && flowKey && !isHashkamaRoot(flowKey)) return entry;
  const hit = hashkamaOf(entry.reference);
  if (!hit) return entry;
  if (hit.leaf === -1) return entry.navigation?.continueTo ? entry : { ...entry, title: entry.title || HASHKAMA_TITLE, navigation: hashkamaNavigation(hit.nusach) };
  const moved = migrateHashkamaReference(entry.reference);
  return { ...entry, reference: moved.reference, title: HASHKAMA_TITLE, navigation: hashkamaNavigation(hit.nusach), anchor: entry.anchor || moved.anchor };
}
