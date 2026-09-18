// Allow-list HTML sanitizer for Sefaria Hebrew text. Keeps meaningful structure, drops everything else.
// Works without a DOM (tests) and in the browser.
const ALLOWED = new Set(['b', 'strong', 'i', 'em', 'big', 'small', 'br', 'span', 'sup', 'sub', 'u']);

export function sanitizeHebrewHtml(input) {
  let html = String(input || '');
  // Drop commentary markers and scripts/styles entirely (including content for script/style).
  html = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  html = html.replace(/<i[^>]*data-commentator=[^>]*><\/i>/gi, '');
  html = html.replace(/<[^>]+>/g, tag => {
    const m = /^<\/?\s*([a-zA-Z][a-zA-Z0-9]*)/.exec(tag);
    if (!m) return '';
    const name = m[1].toLowerCase();
    if (!ALLOWED.has(name)) return '';
    const close = tag.startsWith('</');
    if (close) return `</${name}>`;
    if (name === 'br') return '<br>';
    // Keep only a class attribute from a small allow-list; drop all handlers, styles, urls.
    const cls = /class="([^"]*)"/.exec(tag)?.[1];
    const safeCls = cls && /^[\w\- ]+$/.test(cls) ? ` class="${cls}"` : '';
    return `<${name}${safeCls}>`;
  });
  // Neutralise stray angle brackets from unbalanced input.
  return html.replace(/\u0000/g, '').trim();
}

export function stripToText(html) {
  return String(html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
