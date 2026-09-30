// A small, dependency-free accessibility checker for server-rendered markup (react-dom/server output). It checks what
// can be known from the markup alone: accessible names, required states for roles, valid ARIA attributes and roles,
// labelled form fields, unique ids, images with alt, nothing focusable hidden from assistive technology, and no
// redundant role words in names ("כפתור"). It does not replace a screen-reader test on a device.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const ARIA_ATTRS = new Set(['aria-activedescendant', 'aria-atomic', 'aria-autocomplete', 'aria-busy', 'aria-checked', 'aria-colcount', 'aria-colindex', 'aria-colspan', 'aria-controls', 'aria-current', 'aria-describedby', 'aria-description', 'aria-details', 'aria-disabled', 'aria-errormessage', 'aria-expanded', 'aria-flowto', 'aria-haspopup', 'aria-hidden', 'aria-invalid', 'aria-keyshortcuts', 'aria-label', 'aria-labelledby', 'aria-level', 'aria-live', 'aria-modal', 'aria-multiline', 'aria-multiselectable', 'aria-orientation', 'aria-owns', 'aria-placeholder', 'aria-posinset', 'aria-pressed', 'aria-readonly', 'aria-relevant', 'aria-required', 'aria-roledescription', 'aria-rowcount', 'aria-rowindex', 'aria-rowspan', 'aria-selected', 'aria-setsize', 'aria-sort', 'aria-valuemax', 'aria-valuemin', 'aria-valuenow', 'aria-valuetext']);
const ROLES = new Set(['alert', 'alertdialog', 'application', 'article', 'banner', 'button', 'cell', 'checkbox', 'columnheader', 'combobox', 'complementary', 'contentinfo', 'definition', 'dialog', 'document', 'feed', 'figure', 'form', 'grid', 'gridcell', 'group', 'heading', 'img', 'link', 'list', 'listbox', 'listitem', 'log', 'main', 'marquee', 'math', 'menu', 'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'meter', 'navigation', 'none', 'note', 'option', 'presentation', 'progressbar', 'radio', 'radiogroup', 'region', 'row', 'rowgroup', 'rowheader', 'scrollbar', 'search', 'searchbox', 'separator', 'slider', 'spinbutton', 'status', 'switch', 'tab', 'table', 'tablist', 'tabpanel', 'term', 'text', 'textbox', 'timer', 'toolbar', 'tooltip', 'tree', 'treegrid', 'treeitem']);
const NAMED_ROLES = new Set(['button', 'link', 'tab', 'switch', 'checkbox', 'radio', 'menuitem', 'menuitemradio', 'menuitemcheckbox', 'option', 'slider', 'dialog', 'alertdialog', 'img', 'progressbar', 'meter', 'tabpanel', 'radiogroup', 'listbox', 'tablist', 'menu']);
const REQUIRED_STATE = { tab: 'aria-selected', switch: 'aria-checked', checkbox: 'aria-checked', radio: 'aria-checked', menuitemradio: 'aria-checked', menuitemcheckbox: 'aria-checked', slider: 'aria-valuenow' };

const decode = text => text.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
function parseAttrs(source) {
  const attrs = {};
  for (const match of source.matchAll(/([^\s=/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[match[1].toLowerCase()] = decode(match[2] ?? match[3] ?? match[4] ?? '');
  return attrs;
}

export function parseHtml(html) {
  const root = { tag: '#root', attrs: {}, children: [], parent: null };
  let node = root;
  for (const match of html.matchAll(/<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g)) {
    if (match[0].startsWith('<!--')) continue;
    if (match[5] !== undefined) { node.children.push({ text: decode(match[5]), parent: node }); continue; }
    const [, closing, rawTag, attrSource, selfClosing] = match;
    const tag = rawTag.toLowerCase();
    if (closing) { let up = node; while (up && up.tag !== tag) up = up.parent; if (up?.parent) node = up.parent; continue; }
    const element = { tag, attrs: parseAttrs(attrSource || ''), children: [], parent: node };
    node.children.push(element);
    if (!VOID.has(tag) && !selfClosing) node = element;
  }
  return root;
}

const elements = node => (node.children || []).flatMap(child => (child.tag ? [child, ...elements(child)] : []));
const hiddenFromAT = node => { for (let up = node; up; up = up.parent) if (up.attrs && ('aria-hidden' in up.attrs && up.attrs['aria-hidden'] !== 'false' || 'hidden' in up.attrs)) return true; return false; };
function textOf(node) {
  if (node.text !== undefined) return node.text;
  if (node.attrs?.['aria-hidden'] === 'true' || 'hidden' in (node.attrs || {})) return '';
  if (node.tag === 'img') return node.attrs.alt || '';
  return node.children.map(textOf).join('');
}
const roleOf = el => el.attrs.role || { button: 'button', a: el.attrs.href !== undefined ? 'link' : null, select: 'combobox', textarea: 'textbox', img: 'img', dialog: 'dialog' }[el.tag] || (el.tag === 'input' ? ({ checkbox: 'checkbox', radio: 'radio', range: 'slider', button: 'button', submit: 'button' }[el.attrs.type] || 'textbox') : null);

export function accessibleName(el, byId) {
  if (el.attrs['aria-labelledby']) return el.attrs['aria-labelledby'].split(/\s+/).map(id => (byId.get(id) ? textOf(byId.get(id)) : '')).join(' ').trim();
  if (el.attrs['aria-label']) return el.attrs['aria-label'].trim();
  if (['input', 'select', 'textarea'].includes(el.tag)) {
    for (let up = el.parent; up; up = up.parent) if (up.tag === 'label') return textOf(up).trim();
    if (el.attrs.id) { const label = [...byId.values()].length && el.__labels?.get(el.attrs.id); if (label) return textOf(label).trim(); }
    if (el.attrs.type === 'submit' || el.attrs.type === 'button') return (el.attrs.value || '').trim();
    return (el.attrs.title || '').trim();
  }
  return (textOf(el).trim() || el.attrs.title || '').trim();
}

// Returns a list of problems: { rule, tag, detail }.
export function checkMarkup(html) {
  const root = parseHtml(html);
  const all = elements(root);
  const byId = new Map();
  const problems = [];
  const report = (rule, el, detail = '') => problems.push({ rule, tag: `<${el.tag}${el.attrs.class ? ` class="${el.attrs.class}"` : ''}>`, detail });
  for (const el of all) {
    if (!el.attrs.id) continue;
    if (byId.has(el.attrs.id)) report('duplicate-id', el, el.attrs.id);
    byId.set(el.attrs.id, el);
  }
  const labels = new Map(all.filter(el => el.tag === 'label' && el.attrs.for).map(el => [el.attrs.for, el]));
  for (const el of all) {
    el.__labels = labels;
    for (const name of Object.keys(el.attrs)) if (name.startsWith('aria-') && !ARIA_ATTRS.has(name)) report('invalid-aria-attribute', el, name);
    if (el.attrs.role && !el.attrs.role.split(/\s+/).every(role => ROLES.has(role))) report('invalid-role', el, el.attrs.role);
    const role = roleOf(el);
    if (hiddenFromAT(el)) {
      const focusable = (['button', 'input', 'select', 'textarea'].includes(el.tag) || (el.tag === 'a' && el.attrs.href !== undefined) || (el.attrs.tabindex !== undefined && el.attrs.tabindex !== '-1')) && el.attrs.tabindex !== '-1' && !('disabled' in el.attrs) && !('hidden' in el.attrs) && !(el.tag === 'input' && el.attrs.type === 'hidden');
      if (focusable && !el.parent?.attrs?.hidden && !isInsideHidden(el)) report('focusable-hidden', el, textOf(el).slice(0, 40));
      continue;
    }
    if (el.tag === 'img' && el.attrs.alt === undefined && el.attrs.role !== 'presentation') report('img-alt', el, el.attrs.src || '');
    if (el.tag === 'input' && el.attrs.type === 'hidden') continue;
    if (role && NAMED_ROLES.has(role) || ['input', 'select', 'textarea'].includes(el.tag)) {
      const name = accessibleName(el, byId);
      const optionalName = ['tabpanel', 'radiogroup', 'listbox', 'tablist', 'menu', 'img'].includes(role) && !el.attrs.role;
      if (!name && !optionalName && !(role === 'img' && el.tag === 'img' && el.attrs.alt === '')) report('missing-name', el, role || el.tag);
      if (/כפתור/.test(name)) report('redundant-role-word', el, name);
      if (['input', 'select', 'textarea'].includes(el.tag) && !name && el.attrs.placeholder) report('placeholder-only-label', el, el.attrs.placeholder);
    }
    const state = REQUIRED_STATE[role];
    if (state && el.attrs.role && !(state in el.attrs)) report('missing-state', el, `${role} needs ${state}`);
    if (el.attrs['aria-labelledby']) for (const id of el.attrs['aria-labelledby'].split(/\s+/)) if (!byId.has(id)) report('broken-labelledby', el, id);
  }
  return problems;
}
function isInsideHidden(el) { for (let up = el; up; up = up.parent) if (up.attrs && 'hidden' in up.attrs) return true; return false; }

export const formatProblems = problems => problems.map(p => `${p.rule}: ${p.tag} ${p.detail}`).join('\n');
