// The Siddur's visual hierarchy — presentation only. It never changes a word, a condition or the order:
// it decides how each piece LOOKS. One shared system for the printed Siddur, the composed Mincha and the
// Smart Siddur.
//
// The edition's own convention is the semantic signal: the words one SAYS are pointed (nikud / te'amim);
// everything editorial — section titles, directions, minhag notes, sources, the ketoret's letter markers —
// is unpointed. So each block is read word by word:
//   prayer      — pointed words (largest, the reading font, ordinary text colour)
//   heading     — a short unpointed title ("ברכת כהנים", "קדושה") — the palette's editorial terracotta, bold
//   instruction — an unpointed direction ("כשעוקר הכהן רגליו לישא כפיו יאמר", "והמסובים עונים", "[אמן]")
//   minhag      — "יש אומרים", "נוהגים", "טוב לומר"… — the instruction style, a little quieter
//   commentary  — a long explanation
//   reference   — a source in parentheses ("(בא״ח תצוה י״ב)", "(תהילים קי״ג)") — smallest, muted
//   marker      — a paragraph letter before recited words ("א: הַצֳּרִי ב: וְהַצִּפֹּרֶן") — terracotta, small
// A direction that opens a paragraph becomes its own line above the words it governs; a source, a marker or a
// response inside a sentence stays inline, so the prayer keeps flowing.
import { removeNikud } from '../../hebrewText.mjs';

const POINTED = /[֑-ׇֽֿׁׂׅׄ]/;
const HEBREW_WORD = /[א-ת]/;
const plain = text => removeNikud(String(text || '')).replace(/<[^>]+>/g, '').replace(/[֑-֯]/g, '').replace(/[״]/g, '"').replace(/׳/g, "'").replace(/\s+/g, ' ').trim();

const MINHAG = /^(?:ו?יש (?:אומרים|נוהגים|שמוסיפים|מוסיפים|מקומות)|ו?נוהגים|טוב לומר|סגולה|למנהג|המנהג)/;
const DIRECTIVE = /(?:^|\s)(?:ו?אומר(?:ים)?|יאמר|ו?מברך|מברכים|יברך|ו?עונים|עונין|ו?נוהגים|קוראים|מתפללים|יטול|יכוין|יכוון|יכרע|כורע|מדלגים|מוסיפים|מוסיף|ו?חוזר(?:ים)?|ממשיכים|ו?מחזירים|מוציאים|פותחים|מוליכים|מגביה|עומדים|יפסע|ויזקוף|כשיאמר|כשמגיע|כשעוקר|כשעומדים|כשמתחיל|כשמביאים|כשלוקח|אסור|הקהל|החזן|הש"ץ|השליח ציבור)(?=\s|$|[:.,])/;
// A paragraph letter is bare ("א", "יא") — never "ה׳", the abbreviated Name.
const NUMERAL = /^[א-ת]{1,2}[.:]?$/;
const REPEAT = /^(?:ב"פ|ג"פ|ב' פעמים|ג' פעמים|שתי פעמים|שלש פעמים|שלוש פעמים|ז' פעמים|פעמים)$/;

// A parenthesis is said text only when most of its words are pointed; a short unpointed one is a source,
// a long one an editorial note in parentheses.
const SOURCE_NAMES = /^\(\s*(?:תהילים|תהלים|בראשית|שמות|ויקרא|במדבר|דברים|יהושע|שופטים|שמואל|מלכים|ישעיה|ישעיהו|ירמיה|ירמיהו|יחזקאל|הושע|יואל|עמוס|עובדיה|יונה|מיכה|נחום|חבקוק|צפניה|חגי|זכריה|מלאכי|משלי|איוב|שיר השירים|רות|איכה|קהלת|אסתר|דניאל|עזרא|נחמיה|דברי הימים|דה"י|בא"ח|בן איש חי|כף החיים|כה"ח|שו"ע|שולחן ערוך|ילקוט יוסף|מורה באצבע|לשון חכמים|סנסן|זוהר|ברכות|שבת|תענית|מגילה|סוכה|יומא|עפ"י|על פי|מגמרא|שם|ספר)/;
// A parenthesis is said text when most of its words are pointed; a source when it names one
// ("(בא״ח תצוה י״ב)", "(תהילים קי״ג)"); otherwise a direction in parentheses ("(בעשרה ויותר: אלהינו)").
function parenthesisKind(value) {
  const words = value.split(/\s+/).filter(word => HEBREW_WORD.test(word));
  const pointed = words.filter(word => POINTED.test(word)).length;
  if (words.length && pointed / words.length >= 0.5) return 'prayer';
  if (SOURCE_NAMES.test(plain(value))) return 'reference';
  return words.length <= 10 ? 'aside' : 'editorial';
}

// Tokens of one block: words, parenthesised groups and bracketed responses, each with its kind.
function tokenize(text) {
  const tokens = [];
  const re = /\([^()]*\)|\[[^\]]*\]|\S+/g;
  let match;
  while ((match = re.exec(String(text || '')))) {
    const value = match[0];
    const pointed = POINTED.test(value);
    let kind;
    if (value.startsWith('(')) kind = parenthesisKind(value);
    else if (value.startsWith('[')) kind = pointed ? 'prayer' : 'response';
    else if (!HEBREW_WORD.test(value)) kind = 'punct';
    else kind = pointed ? 'prayer' : 'editorial';
    tokens.push({ value, kind });
  }
  // A lone unpointed numeral right before recited words is the paragraph letter of a list (the ketoret spices).
  tokens.forEach((token, index) => {
    const next = tokens.slice(index + 1).find(item => item.kind !== 'punct');
    if (token.kind === 'editorial' && NUMERAL.test(plain(token.value)) && next?.kind === 'prayer') token.kind = 'marker';
  });
  // Punctuation and the paseq belong to what precedes them.
  tokens.forEach((token, index) => { if (token.kind === 'punct') token.kind = tokens[index - 1]?.kind || 'prayer'; });
  // An unpointed word between said words is part of them (the abbreviated Name "ה׳", an Aramaic word),
  // unless it is a repetition mark or a direction.
  tokens.forEach((token, index) => {
    if (token.kind !== 'editorial') return;
    let end = index;
    while (tokens[end + 1]?.kind === 'editorial') end += 1;
    const before = tokens.slice(0, index).reverse().find(item => item.kind !== 'reference');
    const after = tokens.slice(end + 1).find(item => item.kind !== 'reference');
    const run = plain(tokens.slice(index, end + 1).map(item => item.value).join(' '));
    if (before?.kind === 'prayer' && after?.kind === 'prayer' && end - index < 2 && !REPEAT.test(run) && !DIRECTIVE.test(run)) {
      for (let k = index; k <= end; k += 1) tokens[k].kind = 'prayer';
    }
  });
  // …and the mirror: a lone pointed word inside a direction or an explanation belongs to it ("בארץ־יִשְׂרָאֵל").
  tokens.forEach((token, index) => {
    if (token.kind !== 'prayer' || token.value.startsWith('(')) return;
    let end = index;
    while (tokens[end + 1]?.kind === 'prayer' && !tokens[end + 1].value.startsWith('(')) end += 1;
    const before = tokens.slice(0, index).reverse().find(item => item.kind !== 'reference');
    const after = tokens.slice(end + 1).find(item => item.kind !== 'reference');
    if (before?.kind === 'editorial' && after?.kind === 'editorial' && end - index < 2) {
      for (let k = index; k <= end; k += 1) tokens[k].kind = 'editorial';
    }
  });
  return tokens;
}

function runs(tokens) {
  const out = [];
  for (const token of tokens) {
    const last = out.at(-1);
    if (last && last.kind === token.kind) last.text += ` ${token.value}`;
    else out.push({ kind: token.kind, text: token.value });
  }
  return out;
}

// An unpointed block by itself: title, direction, minhag, explanation or source.
export function editorialRole(text, type = null) {
  const value = plain(text);
  if (type === 'heading') return 'heading';
  if (type === 'note' || type === 'commentary') return 'commentary';
  if (!value) return 'instruction';
  if (/^\([^()]*\)$/.test(value) || type === 'source') return 'reference';
  if (/^\[[^\]]*\]$/.test(value)) return 'instruction';
  if (MINHAG.test(value)) return 'minhag';
  const words = value.split(' ').length;
  if (/:$/.test(value) || DIRECTIVE.test(value)) return words > 30 ? 'commentary' : 'instruction';
  if (words <= 5 && type !== 'instruction' && type !== 'rubric') return 'heading';
  return words > 30 ? 'commentary' : 'instruction';
}

export const DISPLAY_CLASS = Object.freeze({
  prayer: 'siddur-display-prayer',
  heading: 'siddur-display-heading',
  instruction: 'siddur-display-instruction',
  minhag: 'siddur-display-minhag',
  commentary: 'siddur-display-commentary',
  reference: 'siddur-display-reference',
});
const withDisplay = (block, display, extra = {}) => ({ ...block, ...extra, display, className: `${String(block.className || '').replace(/\s*siddur-display-\S+/g, '')} ${DISPLAY_CLASS[display]}`.trim() });
const INLINE = new Set(['reference', 'marker', 'response', 'aside']);

// One block → one or more presented blocks (a leading/trailing direction is split off; inline pieces stay in).
const pointedShare = text => {
  const words = String(text || '').split(/\s+/).filter(word => HEBREW_WORD.test(word));
  return words.length ? words.filter(word => POINTED.test(word)).length / words.length : 0;
};

function presentOne(block) {
  // A heading is an unpointed title; a pointed verse printed with enlarged letters (שמע ישראל) is said text.
  if (block.type === 'heading') return [withDisplay(block, pointedShare(block.text) >= 0.5 ? 'prayer' : 'heading')];
  if (block.display === 'commentary' || block.type === 'note') return [withDisplay(block, 'commentary')];
  // An insertion's caption kept as its label (todayInsertion): a label, even where the edition points it ("לְסֻכּוֹת:").
  if (block.dayLabel) return [withDisplay(block, editorialRole(block.text, null))];
  if (block.display === 'prayer' && block.forcePrayer) return [withDisplay(block, 'prayer')];
  // An instruction is the editor's words throughout: a few quoted pointed words do not make it prayer.
  if (block.type === 'instruction' && pointedShare(block.text) < 0.5) return [withDisplay(block, editorialRole(block.text, 'instruction'))];
  const parts = runs(tokenize(block.text));
  if (!parts.some(part => part.kind === 'prayer')) {
    const role = parts.length && parts.every(part => part.kind === 'reference') ? 'reference' : editorialRole(block.text, block.type);
    // A source inside a direction keeps the source's quieter look.
    const segments = role !== 'reference' && parts.some(part => part.kind === 'reference') ? parts.map(part => ({ text: part.text, kind: part.kind === 'reference' ? 'reference' : 'text' })) : undefined;
    return [withDisplay(block, role, { segments })];
  }
  const out = [];
  let start = 0;
  let end = parts.length;
  // A direction (with its source) that opens the block is its own line.
  if (parts[0].kind === 'editorial') {
    let lead = 1;
    while (lead < parts.length && (parts[lead].kind === 'reference' || parts[lead].kind === 'editorial')) lead += 1;
    const text = parts.slice(0, lead).map(part => part.text).join(' ');
    const role = editorialRole(parts[0].text, 'instruction');
    out.push(withDisplay({ ...block, id: block.id }, role === 'heading' ? 'instruction' : role, { text, segments: parts.slice(0, lead).map(part => ({ text: part.text, kind: part.kind === 'reference' ? 'reference' : 'text' })) }));
    start = lead;
  }
  // …and so does a direction of two or more words that closes it ("…ואומרים ב׳ פעמים" stays inline).
  const tail = parts.at(-1);
  if (end - start > 1 && tail.kind === 'editorial' && plain(tail.text).split(' ').length >= 3) end -= 1;
  const body = parts.slice(start, end);
  const segments = body.map(part => ({ text: part.kind === 'marker' ? `${plain(part.text).replace(/[.:]$/, '')}:` : part.text, kind: part.kind === 'prayer' ? 'text' : part.kind === 'editorial' || part.kind === 'aside' ? 'instruction' : part.kind }));
  const prayer = withDisplay({ ...block, id: out.length ? `${block.id ?? block.source}.text` : block.id }, 'prayer', { text: body.map(part => part.text).join(' '), segments: segments.some(segment => segment.kind !== 'text') ? segments : undefined });
  out.push(prayer);
  if (end < parts.length) out.push(withDisplay({ ...block, id: `${block.id ?? block.source}.after` }, editorialRole(tail.text, 'instruction'), { text: tail.text, segments: undefined }));
  return out;
}

// A separate small-print piece of the same paragraph (a marker, a source, a response) joins the words
// around it, so the prayer keeps flowing ("א: הַצֳּרִי ב: וְהַצִּפֹּרֶן …").
function inlineKind(block) {
  if (block.type === 'heading') return null;
  const parts = runs(tokenize(block.text));
  if (parts.length !== 1) return null;
  const [part] = parts;
  if (part.kind === 'editorial' && NUMERAL.test(plain(part.text))) return 'marker';
  return INLINE.has(part.kind) ? part.kind : null;
}

// Today's insertion (siddurBlocks.mjs) keeps its own blocks: nothing joins across its mark.
const sameMark = (a, b) => (a.day || null) === (b.day || null) && Boolean(a.frame) === Boolean(b.frame) && !a.dayLabel && !b.dayLabel;

export function presentBlocks(blocks = [], { pointedEdition = null } = {}) {
  // The nikud signal holds for a pointed edition (ours — even in a section that is all directions);
  // text that comes without nikud and without the edition's markup is presented by its semantic type alone.
  const pointed = pointedEdition ?? blocks.some(block => POINTED.test(block.text || ''));
  if (!pointed) {
    return blocks.map(block => withDisplay(block, block.type === 'heading' ? 'heading'
      : block.type === 'source' ? 'reference'
        : block.type === 'note' ? 'commentary'
          : block.type === 'instruction' || block.type === 'rubric' ? (MINHAG.test(plain(block.text)) ? 'minhag' : 'instruction')
            : 'prayer'));
  }
  const out = [];
  let open = null; // the prayer block of the current paragraph that inline pieces may join
  for (const block of blocks) {
    const kind = inlineKind(block);
    if (kind && open && open.source === block.source && sameMark(open, block)) {
      const text = kind === 'marker' ? `${plain(block.text).replace(/[.:]$/, '')}:` : block.text;
      open.segments = [...(open.segments || [{ text: open.text, kind: 'text' }]), { text, kind: kind === 'aside' ? 'instruction' : kind }];
      open.pendingInline = true;
      continue;
    }
    for (const piece of presentOne(block)) {
      const previous = out.at(-1);
      if (piece.display === 'prayer' && previous?.pendingInline && previous.source === piece.source && !piece.caption && sameMark(previous, piece)) {
        previous.segments = [...previous.segments, ...(piece.segments || [{ text: piece.text, kind: 'text' }])];
        previous.text = previous.segments.map(segment => segment.text).join(' ');
        continue;
      }
      if (previous?.pendingInline) delete previous.pendingInline;
      out.push(piece);
      open = piece.display === 'prayer' ? piece : (kind === 'marker' ? null : open);
      if (piece.display !== 'prayer') open = null;
    }
    // A marker that opens a paragraph starts the prayer block that follows it.
    if (kind === 'marker' && (!open || open.source !== block.source)) {
      const last = out.at(-1);
      if (last && last.source === block.source && last.display !== 'prayer') {
        out.pop();
        open = { ...withDisplay(block, 'prayer'), segments: [{ text: `${plain(block.text).replace(/[.:]$/, '')}:`, kind: 'marker' }], text: '', pendingInline: true };
        out.push(open);
      }
    }
  }
  for (const block of out) delete block.pendingInline;
  return out;
}

// Kept for callers that only need the role of a whole block.
export function displayRoleFor(text, type) {
  if (type === 'heading') return 'heading';
  if (type === 'note' || type === 'commentary') return 'commentary';
  if (type === 'source') return 'reference';
  const parts = runs(tokenize(text));
  return parts.some(part => part.kind === 'prayer') ? 'prayer' : editorialRole(text, type);
}

// Back-compat name used by siddurBlocks.
export const withPresentation = presentBlocks;
