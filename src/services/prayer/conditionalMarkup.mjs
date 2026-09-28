// Resolves the edition's own conditional structure for one prayer day, before display.
// The edition marks a condition with a small-print caption; what it governs is structural:
//   • a caption that opens a small-print group governs the rest of that group
//     ("<small><small>בסוכות:</small> חג הסכות הזה, ביום …</small>");
//   • a paragraph that is only a caption governs the run of wholly small-print paragraphs after it
//     (יעלה ויבוא in Birkat HaMazon: the caption, then eight small-print paragraphs).
// Known conditions that do not apply are removed with everything they govern; a caption whose
// condition holds is removed as well (the day is already decided). Unknown captions stay as printed.
import { evaluateRubric, inlineAlternative, saidInsteadOfRest } from './rubricConditions.mjs';

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
// The text of a small group of plain words (no small print nested in it), or null.
const plainGroupText = node => (node.kind === 'group' && !node.children.some(child => child.kind === 'group' && !isBlank(child)) ? plain(textOf(node)) : null);
// The group without its opening caption (`words` whitespace-separated words, with any tags around them).
function withoutCaption(node, words) {
  const inner = node.children.map(serialize).join('');
  const rest = inner.replace(new RegExp(`^(?:\\s*(?:<[^>]+>\\s*)*[^\\s<]+(?:<\\/[^>]+>)*){${words}}\\s*`), '');
  return { ...node, children: [{ kind: 'text', value: rest }] };
}

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
  // A group holding two or more captions ("<small><small>בקיץ:</small> מוריד הטל. <small>בחורף:</small> משיב הרוח…</small>")
  // is a choice between alternatives: each caption governs only the words after it, never the whole group.
  const captionCount = group.children.filter(child => captionVerdict(child, conditions)).length;
  const caption = group.open && captionCount < 2 ? leadingCaption(group, conditions) : null;
  if (caption && !caption.verdict.applies) return null;
  const children = [];
  let gate = null;
  let closeBracket = false; // an inline alternative in brackets was dropped: its ")" goes too
  for (const child of group.children) {
    if (caption && child === caption.node) continue; // the decided caption is not shown
    if (closeBracket && child.kind === 'text') {
      closeBracket = false;
      if (/^\s*[)\]]/.test(child.value)) { const rest = child.value.replace(/^\s*[)\]]/, ''); if (rest.trim()) children.push({ kind: 'text', value: rest }); continue; }
    }
    // "(בתשעה באב אומרים כאן נחם)": on the day, the rest of the paragraph (the ordinary chatima) is not said.
    const instead = child.kind === 'group' ? plainGroupText(child) : null;
    const insteadVerdict = instead && saidInsteadOfRest(instead, conditions);
    if (insteadVerdict) { if (insteadVerdict.applies) break; children.push(child); continue; }
    // A caption and its words in one small group (rubricConditions.inlineAlternative).
    const alternative = instead && inlineAlternative(instead, conditions);
    if (alternative) {
      if (gate && !gate.applies) continue;
      if (!alternative.applies) {
        const before = children.at(-1);
        if (before?.kind === 'text' && /[([]\s*$/.test(before.value)) { children[children.length - 1] = { kind: 'text', value: before.value.replace(/\s*[([]\s*$/, ' ') }; closeBracket = true; }
        continue;
      }
      children.push(alternative.addition ? withoutCaption(child, alternative.captionWords) : child);
      continue;
    }
    const inline = captionVerdict(child, conditions);
    if (inline) {
      // A caption right after "(" governs only the words up to its ")": "מִן־כָּל־ (<small>בעשי״ת</small> לְעֵֽלָּא
      // לְעֵֽלָּא מִכָּל) בִּרְכָתָֽא…" — the Kaddish goes on after the bracket, whatever the day.
      const before = children.at(-1);
      const bracketed = before?.kind === 'text' && /[([]\s*$/.test(before.value);
      // Mid-sentence and without brackets ("הָאֵל <small>בעשי״ת:</small> הַמֶּלֶךְ הַקָּדוֹשׁ", "…בִּרְכָתָא
      // <small>בעשי״ת:</small> לְעֵלָּא לְעֵלָּא מִכָּל וְשִׁירָתָא"): the edition does not say where the alternative
      // ends, so nothing is hidden — the words stay as printed, with the caption.
      if (!group.open && !bracketed && before?.kind === 'text' && plain(before.value) && !/[:.׃]\s*$/.test(before.value.replace(/<[^>]+>/g, ''))) { children.push(child); gate = null; continue; }
      gate = { ...inline, bracketed };
      if (bracketed && !inline.applies) children[children.length - 1] = { kind: 'text', value: before.value.replace(/\s*[([]\s*$/, ' ') };
      continue;
    }
    if (gate?.bracketed && !gate.applies) {
      if (child.kind !== 'text') continue;
      const close = child.value.search(/[)\]]/);
      if (close < 0) continue;
      gate = null;
      const rest = child.value.slice(close + 1);
      if (rest.trim()) children.push({ kind: 'text', value: ` ${rest.replace(/^\s+/, '')}` });
      continue;
    }
    if (gate?.bracketed) { if (child.kind === 'text' && /[)\]]/.test(child.value)) gate = null; }
    else if (gate && !gate.applies) continue;
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
  // A caption with its own words ("<small>בעשי"ת - וכתב לחיים טובים …</small>") is an alternative, not a caption.
  if (inlineAlternative(text, conditions)) return null;
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
