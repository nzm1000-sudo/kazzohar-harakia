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

// Today's insertion (opts.mark): instead of deciding silently, a day insertion that holds keeps its caption as a label
// and is marked "today"; a short one that does not hold is kept, marked "other" — siddurBlocks.mjs keeps those only
// beside one that holds (the list of the day's names in מעין שלוש or יעלה ויבוא), and drops them otherwise. Marks are
// attributes on small-print tags: data-day="today|other" on the insertion, data-day-label on its caption, data-said on
// a wrapper around words that are said (not small print in the edition). The words themselves never change.
const MAX_OTHER = 320;
const markOpen = (open, day) => String(open || '<small>').replace(/^<small\b/i, `<small data-day="${day}"`);
const dayLabel = (text, day) => ({ kind: 'group', open: `<small data-day-label="${day}">`, children: [{ kind: 'text', value: text }] });
const dayWrap = (node, day) => ({ kind: 'group', open: `<small data-day="${day}" data-said="1">`, children: [node] });
const BR = /<br\s*\/?>/i;
const visible = raw => String(raw || '').replace(/<(?!br\b)[^>]+>/gi, '');
// Does a piece begin a line of its own: nothing before it, or the text before ends a sentence or a printed line?
function opensLine(children, index) {
  for (let i = index - 1; i >= 0; i -= 1) {
    const child = children[i];
    const raw = visible(child.kind === 'text' ? child.value : serialize(child));
    if (/<br\s*\/?>\s*$/i.test(raw)) return true;
    const text = raw.replace(/<br\s*\/?>/gi, ' ').trim();
    if (!text) continue;
    return /[:.׃]$/.test(text);
  }
  return true;
}
// A caption that opens a printed line ("…וּבְטָהֳרָה.<br> <small>בשבת:</small> וּרְצֵה …הַזֶּה.<br>"): the line is
// its insertion. The Metsudah Me'ein Shalosh prints its day insertions so, one per line.
function linePosition(children, index) {
  let before = null;
  for (let i = index - 1; i >= 0; i -= 1) { if (!isBlank(children[i]) || (children[i].kind === 'text' && BR.test(children[i].value))) { before = children[i]; break; } }
  if (!before || before.kind !== 'text' || !/<br\s*\/?>\s*$/i.test(before.value)) return false;
  const next = children[index + 1];
  if (!next || next.kind !== 'text') return false;
  const [head, ...rest] = next.value.split(BR);
  return Boolean(plain(head)) && rest.length > 0;
}
// The words a caption among siblings governs: up to the next caption.
function governedText(children, index, conditions) {
  let text = '';
  for (let i = index + 1; i < children.length && !captionVerdict(children[i], conditions); i += 1) text += ` ${plain(textOf(children[i]))}`;
  return text.trim();
}
// A caption in mid-sentence that opens a list of the day's names: its words end at their own ":" (or "."), and right
// after them comes the next caption of the list.
function startsList(children, index, conditions) {
  const next = children[index + 1];
  if (!next || next.kind !== 'text') return false;
  const at = next.value.search(/[:.׃]/);
  if (at < 0 || plain(next.value.slice(at + 1))) return false;
  const after = children.slice(index + 2).find(child => !isBlank(child));
  return Boolean(after && captionVerdict(after, conditions));
}
// A caption alone on the paragraph's first line: nothing before it, a line break right after it.
function headCaption(children, index) {
  if (children.slice(0, index).some(child => !isBlank(child))) return false;
  const next = children[index + 1];
  return Boolean(next && next.kind === 'text' && /^\s*<br\s*\/?>/i.test(next.value));
}
const endsSentencePart = raw => /[.,:;׃]\s*$/.test(plain(raw));
const endsSentence = raw => /[.:׃]\s*$/.test(plain(raw));

function resolveGroup(group, conditions, opts = {}) {
  const mark = Boolean(opts.mark);
  const depth = opts.depth || 0;
  const line = group.open ? leadingLineCaption(group, conditions) : null;
  if (line && !line.verdict.applies) return null;
  if (line) group = { ...group, children: group.children.map((child, i) => (i === line.index ? { kind: 'text', value: line.remainder } : child)) };
  // A group holding two or more captions ("<small><small>בקיץ:</small> מוריד הטל. <small>בחורף:</small> משיב הרוח…</small>")
  // is a choice between alternatives: each caption governs only the words after it, never the whole group.
  const captionCount = group.children.filter(child => captionVerdict(child, conditions)).length;
  const caption = group.open && captionCount < 2 ? leadingCaption(group, conditions) : null;
  // A captioned insertion of its own line or paragraph ("<small><small>בסוכות</small> וְשַׂמְּחֵנוּ…</small>").
  let day = null;
  if (caption && mark && depth === 1 && opts.lineStart && !line) {
    if (caption.verdict.applies) day = 'today';
    else if (!caption.verdict.season && plain(textOf(group)).length <= MAX_OTHER) day = 'other';
  }
  if (caption && !caption.verdict.applies && !day) return null;
  const children = [];
  let gate = null;
  let scope = null; // a line insertion that opens a sentence ("ביום טוב ובחוה״מ: וְשַׂמְּחֵנוּ בְיוֹם"): its lines up to the sentence's end
  let closeBracket = false; // an inline alternative in brackets was dropped: its ")" goes too
  let inList = false; // inside a list of the day's names (startsList)
  // Words inside an opened sentence follow it: shown and marked with it, or gone with it.
  const scoped = (node, inner) => {
    if (!scope) return inner ? (inner.mark ? dayWrap(node, inner.mark) : inner.applies ? node : null) : node;
    if (!scope.applies && !scope.mark) return null;
    const own = inner ? (inner.mark ? dayWrap(node, inner.mark) : inner.applies ? node : null) : node;
    if (!own && scope.applies) return null;
    return scope.mark ? dayWrap(own || node, scope.mark) : own;
  };
  const pushScopedTail = tail => {
    // After an insertion's line: inside an opened sentence, the next uncaptioned line still belongs to it.
    if (!scope) { if (tail) children.push({ kind: 'text', value: tail }); return; }
    const lines = tail.split(BR);
    let i = 1; // lines[0] is the (empty) rest of the insertion's own line
    while (i < lines.length && !plain(lines[i])) i += 1;
    if (i >= lines.length) { children.push({ kind: 'text', value: tail }); return; }
    const own = lines.slice(0, i).join('<br>');
    const continuation = lines[i];
    const rest = lines.slice(i + 1);
    if (own) children.push({ kind: 'text', value: `${own}<br>` });
    const node = scoped({ kind: 'text', value: continuation }, null);
    if (node) children.push(node);
    if (endsSentence(continuation)) scope = null;
    if (rest.length) children.push({ kind: 'text', value: `<br>${rest.join('<br>')}` });
  };
  let para = null; // a caption on its own line at the paragraph's head: it governs the whole paragraph (headCaption)
  const visit = (child, index) => {
    if (caption && child === caption.node) { if (day) children.push(dayLabel(plain(textOf(child)), day)); return; } // a decided caption shows only as a label
    if (closeBracket && child.kind === 'text') {
      closeBracket = false;
      if (/^\s*[)\]]/.test(child.value)) { const rest = child.value.replace(/^\s*[)\]]/, ''); if (rest.trim()) children.push({ kind: 'text', value: rest }); return; }
    }
    // "(בתשעה באב אומרים כאן נחם)": on the day, the rest of the paragraph (the ordinary chatima) is not said.
    const instead = child.kind === 'group' ? plainGroupText(child) : null;
    const insteadVerdict = instead && saidInsteadOfRest(instead, conditions);
    if (insteadVerdict) { if (insteadVerdict.applies) { children.stop = true; } else children.push(child); return; }
    if (children.stop) return;
    // A caption and its words in one small group (rubricConditions.inlineAlternative).
    const alternative = instead && inlineAlternative(instead, conditions);
    if (alternative) {
      if (gate && !gate.applies) return;
      if (!alternative.applies) {
        const before = children.at(-1);
        if (before?.kind === 'text' && /[([]\s*$/.test(before.value)) { children[children.length - 1] = { kind: 'text', value: before.value.replace(/\s*[([]\s*$/, ' ') }; closeBracket = true; }
        return;
      }
      children.push(alternative.addition ? withoutCaption(child, alternative.captionWords) : child);
      return;
    }
    const inline = captionVerdict(child, conditions);
    if (inline) {
      const captionText = plain(textOf(child));
      // "<small>בראש חודש ובחול המועד אומרים:</small><br>אֱלֹהֵינוּ… בְּיוֹם <small>בראש חדש:</small> …" (Torah Or's Ya'ale
      // Veyavo): the caption heads the paragraph on a line of its own, and the paragraph is its passage — the captions
      // inside it name the day within it.
      if (!group.open && !para && headCaption(group.children, index)) {
        const rest = plain(group.children.slice(index + 1).map(textOf).join(' '));
        const paraMark = mark && (inline.applies || (!inline.season && rest.length <= MAX_OTHER)) ? (inline.applies ? 'today' : 'other') : null;
        para = { applies: inline.applies, mark: paraMark };
        if (paraMark) children.push(dayLabel(captionText, paraMark));
        return;
      }
      // A caption that opens a printed line governs that line only.
      if (!group.open && linePosition(group.children, index)) {
        const lineMark = mark && (inline.applies || !inline.season) ? (inline.applies ? 'today' : 'other') : null;
        gate = { ...inline, line: true, mark: lineMark };
        if (lineMark) { const label = dayLabel(captionText, lineMark); children.push(scope?.mark ? dayWrap(label, scope.mark) : label); }
        if (scope && !scope.applies && !scope.mark) gate.applies = false;
        return;
      }
      // A caption right after "(" governs only the words up to its ")": "מִן־כָּל־ (<small>בעשי״ת</small> לְעֵֽלָּא
      // לְעֵֽלָּא מִכָּל) בִּרְכָתָֽא…" — the Kaddish goes on after the bracket, whatever the day.
      const before = children.at(-1);
      const bracketed = before?.kind === 'text' && /[([]\s*$/.test(before.value);
      // A list of the day's names completing one sentence ("בְּיוֹם <small>לר"ח:</small> רֹאשׁ הַחֹֽדֶשׁ הַזֶּה: <small>לפסח:</small>
      // חַג הַמַּצּוֹת הַזֶּה: <small>לסכות:</small> חַג הַסֻּכּוֹת הַזֶּה: זָכְרֵֽנוּ…", the Metsudah Ya'ale Veyavo): each caption
      // governs its words up to their ":", and the sentence goes on after the last.
      if (!group.open && !bracketed && (inList || startsList(group.children, index, conditions))) {
        inList = true;
        const itemMark = mark && (inline.applies || !inline.season) ? (inline.applies ? 'today' : 'other') : null;
        gate = { ...inline, sentence: true, mark: itemMark };
        if (itemMark) children.push(dayLabel(captionText, itemMark));
        return;
      }
      // Mid-sentence and without brackets ("הָאֵל <small>בעשי״ת:</small> הַמֶּלֶךְ הַקָּדוֹשׁ", "…בִּרְכָתָא
      // <small>בעשי״ת:</small> לְעֵלָּא לְעֵלָּא מִכָּל וְשִׁירָתָא"): the edition does not say where the alternative
      // ends, so nothing is hidden — the words stay as printed, with the caption.
      if (!group.open && !bracketed && before?.kind === 'text' && plain(before.value) && !/[:.׃]\s*$/.test(before.value.replace(/<[^>]+>/g, ''))) { children.push(child); gate = null; return; }
      // A caption that opens its paragraph's line ("<small>בקיץ:</small> מוֹרִיד הַטָּל."): its words are the insertion.
      // A long passage the day does not take ("בפורים: בִּימֵי מָרְדְּכַי…") goes as before, caption and all.
      const short = () => governedText(group.children, index, conditions).length <= MAX_OTHER;
      const lineMark = mark && !group.open && !bracketed && opensLine(group.children, index) && (inline.applies || (!inline.season && short())) ? (inline.applies ? 'today' : 'other') : null;
      gate = { ...inline, bracketed, mark: lineMark };
      if (lineMark) children.push(dayLabel(captionText, lineMark));
      if (bracketed && !inline.applies) children[children.length - 1] = { kind: 'text', value: before.value.replace(/\s*[([]\s*$/, ' ') };
      return;
    }
    if (gate?.sentence) {
      const own = gate;
      gate = null;
      if (child.kind === 'text') {
        const at = child.value.search(/[:.׃]/);
        const head = at < 0 ? child.value : child.value.slice(0, at + 1);
        const tail = at < 0 ? '' : child.value.slice(at + 1);
        const node = scoped({ kind: 'text', value: head }, own);
        if (node) children.push(node);
        if (tail) children.push({ kind: 'text', value: tail });
        return;
      }
    }
    if (gate?.line) {
      if (child.kind === 'text') {
        const at = child.value.search(BR);
        const head = at < 0 ? child.value : child.value.slice(0, at);
        const tail = at < 0 ? '' : child.value.slice(at);
        const own = gate;
        gate = null;
        const node = scoped({ kind: 'text', value: head }, own);
        if (node) children.push(node);
        // An insertion whose line leaves its sentence open opens a scope: the lines after it complete it.
        if (!scope && !endsSentencePart(head)) scope = { applies: own.applies, mark: own.mark };
        pushScopedTail(tail);
        return;
      }
      gate = null;
    }
    if (gate?.bracketed && !gate.applies) {
      if (child.kind !== 'text') return;
      const close = child.value.search(/[)\]]/);
      if (close < 0) return;
      gate = null;
      const rest = child.value.slice(close + 1);
      if (rest.trim()) children.push({ kind: 'text', value: ` ${rest.replace(/^\s+/, '')}` });
      return;
    }
    if (gate?.bracketed) { if (child.kind === 'text' && /[)\]]/.test(child.value)) gate = null; }
    else if (gate?.mark) {
      const node = child.kind === 'text' ? child : resolveGroup(child, conditions, { mark, depth: depth + 1, lineStart: false });
      if (node) children.push(dayWrap(node, gate.mark));
      return;
    }
    else if (gate && !gate.applies) return;
    if (child.kind === 'text') { children.push(child); return; }
    const resolved = resolveGroup(child, conditions, { mark, depth: depth + 1, lineStart: opensLine(group.children, index) });
    if (resolved) children.push(resolved);
  };
  group.children.forEach((child, index) => {
    // A paragraph passage the day does not take, unmarked, goes whole; a marked one wraps all it holds.
    if (para && !para.applies && !para.mark) return;
    const from = children.length;
    visit(child, index);
    if (para?.mark) for (let i = from; i < children.length; i += 1) children[i] = dayWrap(children[i], para.mark);
  });
  delete children.stop;
  return { ...group, open: day ? markOpen(group.open, day) : group.open, children };
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
// options.mark: mark today's insertions instead of deciding them silently (see resolveGroup).
export function resolveConditionalMarkup(markups = [], conditions = {}, { mark = false } = {}) {
  if (!conditions.resolved) return [...markups];
  const out = [];
  let governing = null; // { applies, index, markup } for a run of wholly-small paragraphs after a standalone caption
  const resolve = value => serialize(resolveGroup(parseSmall(value), conditions, { mark }));
  // A passage said today under its own caption paragraph (יעלה ויבוא, על הניסים, the summer Barech Aleinu): the
  // caption stays as its label and the passage is marked.
  // Not a passage of the day: what to say if one forgot ("אם שכח לומר רצה או יעלה ויבא…") holds today only for one who did.
  const marksToday = (standalone, value) => mark && standalone.applies && !/^\(?אם שכח/.test(plain(value));
  const label = (standalone, value) => (marksToday(standalone, value) ? `<small data-day-label="today">${plain(value)}</small>` : '');
  const today = (body, on) => (on && body ? `<small data-day="today" data-said="1">${body}</small>` : body);
  for (const markup of markups) {
    const value = String(markup || '');
    const standalone = standaloneCaption(value, conditions);
    if (standalone) { governing = { ...standalone, index: out.length, markup: value, governed: 0, marks: marksToday(standalone, value) }; out.push(label(standalone, value)); continue; }
    if (!plain(value)) { out.push(value); continue; }
    // A season caption alone governs exactly the one paragraph after it (the summer / winter Barech Aleinu); so does a
    // caption that points at it ("בראש חדש ובחול המועד אומרים זה:" before the Metsudah Ya'ale Veyavo).
    if (governing?.season || (governing && !governing.governed && !whollySmall(value) && /אומרים זה:?\s*$/.test(plain(governing.markup)))) {
      const { applies, marks } = governing;
      governing = null;
      out.push(applies ? today(resolve(value), marks) : '');
      continue;
    }
    if (governing && whollySmall(value)) {
      governing.governed += 1;
      if (!governing.applies) { out.push(''); continue; }
      out.push(today(resolve(value), governing.marks));
      continue;
    }
    // A caption followed directly by ordinary text governs nothing structural: keep it as printed.
    if (governing && governing.governed === 0) out[governing.index] = governing.markup;
    governing = null;
    out.push(resolve(value));
  }
  return out;
}
