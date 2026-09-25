// Hebrew text normalization utility
// Centralized text processing for all Hebrew content.
//
// Rendering policies (one per content type — never one destructive rule for everything):
//   tanakh  — letters + nikud + cantillation preserved (Torah, Nevi'im, Ketuvim, Tehillim)
//   siddur  — letters + nikud preserved; cantillation (U+0591–U+05AF) removed
//   source  — text preserved exactly as the edition has it (Talmud, commentaries, Halacha)
//   plain   — letters only; for search/matching, never for display
// No Unicode normalization (NFC/NFD) is applied: Sefaria/tanach.us deliver marks in
// Masoretic order (dagesh → vowel → accent) and canonical reordering would move them
// (dagesh ccc 21, vowels ccc 10–20, shin/sin dot ccc 24–25). Only HTML is removed.

// Precise Unicode classes (see Unicode block "Hebrew"):
const TROPE_RANGE = /[\u0591-\u05AF]/g;                  // cantillation (te'amim) only
const NIKUD_ONLY = /[\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g; // points, dagesh, meteg, rafe, shin/sin dots, qamats qatan
const NIQUD_RANGE = /[\u05B0-\u05C7]/g;                   // legacy wide range (points + maqaf/paseq/sof pasuq) — search only
const HTML_TAGS = /<[^>]+>/g;
// Sefaria editorial apparatus: footnote markers and footnote bodies are not source words.
const FOOTNOTES = /<sup[^>]*class="[^"]*footnote-marker[^"]*"[^>]*>[\s\S]*?<\/sup>|<i[^>]*class="[^"]*footnote[^"]*"[^>]*>[\s\S]*?<\/i>/gi;
const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", thinsp: ' ', ensp: ' ', emsp: ' ' };

export const HEBREW_POLICIES = Object.freeze({
  tanakh: { trope: true, nikud: true },
  siddur: { trope: false, nikud: true },
  source: { trope: true, nikud: true },
  plain: { trope: false, nikud: false },
});
const MODE_ALIASES = { cantillation: 'tanakh', nikud: 'siddur', exact: 'source' };
export const resolvePolicyName = mode => (HEBREW_POLICIES[mode] ? mode : MODE_ALIASES[mode] || 'siddur');

// Decode entities before stripping tags so escaped markup cannot remain visible as text.
export function stripHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(FOOTNOTES, '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code) => {
      if (code[0] === '#') { const cp = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10); return Number.isFinite(cp) ? String.fromCodePoint(cp) : ' '; }
      return code.toLowerCase() in ENTITIES ? ENTITIES[code.toLowerCase()] : ' ';
    })
    .replace(HTML_TAGS, '')
    .replace(/\s+/g, ' ').trim();
}

// Remove cantillation/trope marks only, preserve nikud and Hebrew letters
export function removeTrope(text) {
  if (!text) return '';
  return String(text).replace(TROPE_RANGE, '');
}

// Remove nikud only (for plain text search/comparison)
export function removeNikud(text) {
  if (!text) return '';
  return String(text).replace(NIQUD_RANGE, '');
}

// Normalize Hebrew text for a specific policy. Accepts policy names and legacy aliases.
export function normalizeHebrewText(text, mode = 'siddur') {
  if (!text) return '';
  const policy = HEBREW_POLICIES[resolvePolicyName(mode)];
  let result = stripHtml(text);
  if (!policy.trope) result = result.replace(TROPE_RANGE, '');
  if (!policy.nikud) result = result.replace(NIKUD_ONLY, '').replace(/[\u05BE\u05C0\u05C3\u05C6]/g, m => (m === '\u05BE' ? '-' : ''));
  return result.replace(/\s+/g, ' ').trim();
}

// Split Hebrew text into clean paragraphs for reading
export function splitIntoParagraphs(text) {
  if (!text) return [];
  const clean = normalizeHebrewText(text, 'siddur');
  return clean
    .split(/[\n\r]+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

// Extract clean title from HTML-formatted text
export function extractTitle(text) {
  if (!text) return '';
  const clean = stripHtml(text);
  const lines = clean.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  return lines[0] || '';
}

// Check if text contains cantillation marks
export function hasTrope(text) {
  return /[\u0591-\u05AF]/.test(String(text || ''));
}

// Check if text contains nikud
export function hasNikud(text) {
  return /[\u05B0-\u05C7]/.test(String(text || ''));
}

// Normalize for search (remove nikud, trope, punctuation)
export function normalizeForSearch(text) {
  if (!text) return '';
  return String(text)
    .replace(TROPE_RANGE, '')
    .replace(NIQUD_RANGE, '')
    .replace(/[״׳"'׳\-–—]/g, ' ')
    .replace(/[ךםןףץ]/g, c => ({ך:'כ',ם:'מ',ן:'נ',ף:'פ',ץ:'צ'}[c]))
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Format verse/paragraph with optional numbering
export function formatWithNumbers(paragraphs, startNum = 1) {
  return paragraphs.map((p, i) => ({
    text: p,
    number: startNum + i
  }));
}

const INSTRUCTION_START = /^(?:בליל ראש חודש|בעשרת ימי תשובה|בראש חודש|בחול המועד|בתענית|בחנוכה ובפורים|הסבר על תוספת|הערה למתפלל|תוספת|יש אומרים|אם שכח|נוהגים לומר|יחזור|מדלגים|אומר(?:ים)?(?: ב| לפני| אחר| כאן)?|כשחל|כשאין|במקום זה|אין אומרים|מוריד הטל|משיב הרוח|יעלה ויבוא|ותן טל ומטר)/;
const SOURCE_START = /\((?:בא״ח|בא"ח|שו״ע|שו"ע|ברכות|שבת|סוכה|עיין|ראה|על פי|עפ״י|עפ"י|מגמרא|בסידור)/;

// Keep classification deliberately narrow: uncertain prose remains prayer text.
export function classifyHebrewParagraph(text, index = 0, title = '') {
  const value = String(text || '').trim();
  if (!value) return 'prayer';
  if (index === 0 && title && removeNikud(value) === removeNikud(title)) return 'section-heading';
  if (/אומר:|אומרים:|תאמר:|יאמר:|לומר:/.test(value) && value.length < 90) return 'alternative-label';
  if (INSTRUCTION_START.test(value)) return 'instruction';
  if (SOURCE_START.test(value) || /(?:ע״ב|ע"ב|ז״ל|ז"ל|סימן|סעיף)\)?$/.test(value)) return 'source';
  return 'prayer';
}

export function splitSemanticParagraph(text) {
  const value = String(text || '').trim();
  const match = value.match(/^(.{1,100}?(?:אומר|אומרים|תאמר|יאמר|לומר):)\s+(.+)$/);
  return match ? [{ text: match[1], type: 'alternative-label' }, { text: match[2], type: 'prayer' }] : [{ text: value }];
}

export function semanticHebrewParagraphs(paragraphs, title = '', indexes = null) {
  return paragraphs.flatMap((text, index) => splitSemanticParagraph(text).map((part, offset) => ({
    ...part,
    source: indexes ? indexes[index] : index,
    type: part.type || classifyHebrewParagraph(part.text, index + offset, title),
  })));
}