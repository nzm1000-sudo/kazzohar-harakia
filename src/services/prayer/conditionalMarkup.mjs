// Resolves the edition's own conditional structure for one prayer day, before display.
// The edition marks a condition with a small-print caption; what it governs is structural:
//   • a caption that opens a small-print group governs the rest of that group
//     ("<small><small>בסוכות:</small> חג הסכות הזה, ביום …</small>");
//   • a paragraph that is only a caption governs the run of wholly small-print paragraphs after it
//     (יעלה ויבוא in Birkat HaMazon: the caption, then eight small-print paragraphs).
// Known conditions that do not apply are removed with everything they govern; a caption whose
// condition holds is removed as well (the day is already decided). Unknown captions stay as printed.
import { evaluateRubric } from './rubricConditions.mjs';

const TAG = /<\/?small\b[^>]*>/gi;
const plain = markup => String(markup || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const MAX_CAPTION = 90;
const MAX_STANDALONE = 200;

// Tree of { kind: 'text', value } | { kind: 'group', open, children }.
export function parseSmall(markup) {
  const root = { kind: 'group', open: '', children: [] };
  const stack = [root];
  let offset = 0;
  const source = String(markup || '');
  for (const match of source.matchAll(TAG)) {
    if (match.index > offset) stack.at(-1).children.push({ kind: 'text', value: source.slice(offset, match.index) });
    if (match[0][1] === '/') { if (stack.length > 1) stack.pop(); }
    else { const group = { kind: 'group', open: match[0], children: [] }; stack.at(-1).children.push(group); stack.push(group); }
    offset = match.index + match[0].length;
  }
  if (offset < source.length) stack.at(-1).children.push({ kind: 'text', value: source.slice(offset) });
  return root;
}

const serialize = node => (node.kind === 'text' ? node.value : `${node.open}${node.children.map(serialize).join('')}${node.open ? '</small>' : ''}`);
const textOf = node => (node.kind === 'text' ? node.value : node.children.map(textOf).join(''));
const isBlank = node => !plain(textOf(node));

// A group's leading caption: its first non-blank child, if that child is a small group whose whole text is a known caption.
function leadingCaption(group, conditions) {
  const first = group.children.find(child => !isBlank(child));
  if (!first || first.kind !== 'group') return null;
  const text = plain(textOf(first));
  if (!text || text.length > MAX_CAPTION) return null;
  const verdict = evaluateRubric(text, conditions);
  return verdict.known ? { node: first, verdict } : null;
}

// A small group whose whole text is a known caption (e.g. "<small>בקיץ:</small>").
function captionVerdict(node, conditions) {
  if (node.kind !== 'group' || node.children.some(child => child.kind === 'group' && !isBlank(child))) return null;
  const text = plain(textOf(node));
  if (!text || text.length > MAX_CAPTION) return null;
  const verdict = evaluateRubric(text, conditions);
  return verdict.known ? verdict : null;
}

// A caption that opens a small group governs the rest of that group. A caption among ordinary siblings
// ("<small>בקיץ:</small> מוריד הטל. <small>בחורף:</small> משיב הרוח…") governs the siblings after it,
// up to the next caption or the end of the group.
// "<small>ביום תענית יאמר <br>רִבּוֹן הָעוֹלָמִים…</small>": a caption written as the group's first line.
function leadingLineCaption(group, conditions) {
  const index = group.children.findIndex(child => !isBlank(child));
  const first = group.children[index];
  if (!first || first.kind !== 'text') return null;
  const [head, ...rest] = first.value.split(/<br\s*\/?>/i);
  if (!rest.length) return null;
  const text = plain(head);
  if (!text || text.length > MAX_CAPTION) return null;
  const verdict = evaluateRubric(text, conditions);
  return verdict.known ? { index, verdict, remainder: rest.join('<br>') } : null;
}

function resolveGroup(group, conditions) {
  const line = group.open ? leadingLineCaption(group, conditions) : null;
  if (line && !line.verdict.applies) return null;
  if (line) group = { ...group, children: group.children.map((child, i) => (i === line.index ? { kind: 'text', value: line.remainder } : child)) };
  const caption = group.open ? leadingCaption(group, conditions) : null;
  if (caption && !caption.verdict.applies) return null;
  const children = [];
  let gate = null;
  for (const child of group.children) {
    if (caption && child === caption.node) continue; // the decided caption is not shown
    const inline = captionVerdict(child, conditions);
    if (inline) { gate = inline; continue; }
    if (gate && !gate.applies) continue;
    if (child.kind === 'text') { children.push(child); continue; }
    const resolved = resolveGroup(child, conditions);
    if (resolved) children.push(resolved);
  }
  return { ...group, children };
}

// A paragraph that is nothing but one caption (possibly wrapped in small print).
function standaloneCaption(markup, conditions) {
  const text = plain(markup);
  if (!text || text.length > MAX_STANDALONE || !/<small\b/i.test(markup)) return null;
  // Only a caption: one small group of plain text. "<small><small>בסוכות:</small> חג הסכות…</small>" is a
  // captioned addition, not a caption — its caption governs its own group.
  const top = parseSmall(markup).children.filter(child => !isBlank(child));
  if (top.length !== 1 || top[0].kind !== 'group' || top[0].children.some(child => child.kind === 'group' && !isBlank(child))) return null;
  const verdict = evaluateRubric(text, conditions);
  if (!verdict.known) return null;
  // A season caption alone in its paragraph precedes a whole Birkat HaShanim (rain), not Gevurot (YY 117:2).
  if (verdict.season) return { ...verdict, applies: /קיץ/.test(text) ? conditions.rainSummer || !conditions.resolved : conditions.rainWinter || !conditions.resolved };
  return verdict;
}

const whollySmall = markup => {
  const tree = parseSmall(markup);
  return tree.children.every(child => child.kind === 'group' || !plain(child.value));
};

// markups: the paragraphs' markup (siddurMarkup or text). Returns the same number of entries;
// a removed paragraph becomes '' (callers already skip empty paragraphs).
export function resolveConditionalMarkup(markups = [], conditions = {}) {
  if (!conditions.resolved) return [...markups];
  const out = [];
  let governing = null; // { applies, index, markup } for a run of wholly-small paragraphs after a standalone caption
  for (const markup of markups) {
    const value = String(markup || '');
    const standalone = standaloneCaption(value, conditions);
    if (standalone) { governing = { ...standalone, index: out.length, markup: value, governed: 0 }; out.push(''); continue; }
    if (!plain(value)) { out.push(value); continue; }
    // A season caption alone governs exactly the one paragraph after it (the summer / winter Barech Aleinu).
    if (governing?.season) {
      const applies = governing.applies;
      governing = null;
      out.push(applies ? serialize(resolveGroup(parseSmall(value), conditions)) : '');
      continue;
    }
    if (governing && whollySmall(value)) {
      governing.governed += 1;
      if (!governing.applies) { out.push(''); continue; }
    } else {
      // A caption followed directly by ordinary text governs nothing structural: keep it as printed.
      if (governing && governing.governed === 0) out[governing.index] = governing.markup;
      governing = null;
    }
    out.push(serialize(resolveGroup(parseSmall(value), conditions)));
  }
  return out;
}
