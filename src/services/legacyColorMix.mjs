// color-mix() for older Android System WebView (Chrome < 111). The app's colours are mixed from theme variables
// (color-mix(in srgb, var(--accent) 12%, var(--surface)) …); an engine without color-mix() drops every such declaration,
// so surfaces turn transparent and borders vanish. Where — and only where — the engine lacks color-mix(), the app's own
// stylesheets are re-read, each color-mix() is computed for the current theme, and the result replaces them in the same
// order (so the cascade is unchanged). A theme change recomputes it. A modern engine never runs any of this.

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// '#rgb' / '#rrggbb' / '#rrggbbaa' / 'rgb()' / 'rgba()' / 'transparent' → [r, g, b, a] (0–255, alpha 0–1), else null.
export function parseColor(input, normalize) {
  let text = String(input ?? '').trim().toLowerCase();
  if (!text) return null;
  if (text === 'transparent') return [0, 0, 0, 0];
  if (text === 'white') return [255, 255, 255, 1];
  if (text === 'black') return [0, 0, 0, 1];
  let hex = text.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3 || digits.length === 4) digits = digits.split('').map(ch => ch + ch).join('');
    if (digits.length !== 6 && digits.length !== 8) return null;
    const value = index => parseInt(digits.slice(index, index + 2), 16);
    return [value(0), value(2), value(4), digits.length === 8 ? value(6) / 255 : 1];
  }
  const rgb = text.match(/^rgba?\(\s*([^)]*)\)$/);
  if (rgb) {
    const parts = rgb[1].split(/\s*[,/]\s*|\s+/).filter(Boolean);
    if (parts.length < 3) return null;
    const channel = part => (part.endsWith('%') ? parseFloat(part) * 2.55 : parseFloat(part));
    const alpha = parts[3] === undefined ? 1 : parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    const color = [channel(parts[0]), channel(parts[1]), channel(parts[2]), alpha];
    return color.every(Number.isFinite) ? color : null;
  }
  if (typeof normalize === 'function') {
    const normalized = normalize(text);
    if (normalized && normalized !== text) return parseColor(normalized);
  }
  return null;
}

export function formatColor([r, g, b, a]) {
  const round = value => Math.round(clamp(value, 0, 255));
  const alpha = Math.round(clamp(a, 0, 1) * 1000) / 1000;
  return alpha === 1 ? `rgb(${round(r)},${round(g)},${round(b)})` : `rgba(${round(r)},${round(g)},${round(b)},${alpha})`;
}

// CSS Color 5: percentages normalised, premultiplied-alpha interpolation in sRGB, the alpha scaled when they sum < 100%.
export function mixColors(first, firstPercent, second, secondPercent) {
  let p1 = firstPercent;
  let p2 = secondPercent;
  if (p1 == null && p2 == null) { p1 = 50; p2 = 50; } else if (p1 == null) p1 = 100 - p2; else if (p2 == null) p2 = 100 - p1;
  const sum = p1 + p2;
  if (!(sum > 0)) return null;
  const w1 = p1 / sum;
  const w2 = p2 / sum;
  const multiplier = sum < 100 ? sum / 100 : 1;
  const alpha = first[3] * w1 + second[3] * w2;
  const channel = index => (alpha === 0 ? 0 : (first[index] * first[3] * w1 + second[index] * second[3] * w2) / alpha);
  return [channel(0), channel(1), channel(2), alpha * multiplier];
}

function splitTopLevel(text, separator = ',') {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    if (char === separator && depth === 0) { parts.push(current.trim()); current = ''; continue; }
    current += char;
  }
  parts.push(current.trim());
  return parts;
}

function matchingParen(text, open) {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === '(') depth += 1;
    else if (text[index] === ')') { depth -= 1; if (depth === 0) return index; }
  }
  return -1;
}

// var(--name[, fallback]) → the variable's value (recursively), using getVar(name) → '' when unset.
export function resolveVars(text, getVar, depth = 0) {
  if (depth > 12 || !text.includes('var(')) return text;
  let out = '';
  let index = 0;
  while (index < text.length) {
    const start = text.indexOf('var(', index);
    if (start < 0) { out += text.slice(index); break; }
    const end = matchingParen(text, start + 3);
    if (end < 0) { out += text.slice(index); break; }
    out += text.slice(index, start);
    const [name, ...rest] = splitTopLevel(text.slice(start + 4, end));
    const value = String(getVar(name.trim()) ?? '').trim();
    const fallback = rest.length ? rest.join(',') : '';
    out += resolveVars(value || fallback, getVar, depth + 1);
    index = end + 1;
  }
  return out;
}

function evaluateMix(args, normalize) {
  const [space, ...colors] = splitTopLevel(args);
  if (!/^in\s+(srgb|srgb-linear|oklab|oklch|lab|lch|hsl|hwb|xyz)/i.test(space) || colors.length !== 2) return null;
  const parsed = colors.map(item => {
    const match = item.match(/^(.*?)(?:\s+(-?\d*\.?\d+)%)?$/s);
    const leading = item.match(/^(-?\d*\.?\d+)%\s+(.*)$/s);
    const color = leading ? leading[2] : match[1];
    const percent = leading ? Number(leading[1]) : match[2] != null ? Number(match[2]) : null;
    return { color: parseColor(color, normalize), percent };
  });
  if (parsed.some(item => !item.color)) return null;
  const mixed = mixColors(parsed[0].color, parsed[0].percent, parsed[1].color, parsed[1].percent);
  return mixed ? formatColor(mixed) : null;
}

// Every color-mix() in a value, innermost first → a plain colour; null when any part cannot be resolved.
export function computeColorMix(value, getVar, normalize) {
  let text = resolveVars(value, getVar);
  for (let guard = 0; guard < 50 && text.includes('color-mix('); guard += 1) {
    const start = text.lastIndexOf('color-mix(');
    const end = matchingParen(text, start + 9);
    if (end < 0) return null;
    const result = evaluateMix(text.slice(start + 10, end), normalize);
    if (!result) return null;
    text = text.slice(0, start) + result + text.slice(end + 1);
  }
  return text;
}

// A whole stylesheet: each declaration value holding color-mix() is replaced by its computed colour (left untouched —
// and so still dropped, as before — when it cannot be resolved).
export function rewriteStylesheet(cssText, getVar, normalize) {
  return cssText.replace(/([{;]\s*)(--[\w-]+|[a-z-]+)(\s*:\s*)([^;{}]*color-mix\([^;{}]*)(?=[;}])/gi, (whole, lead, prop, colon, value) => {
    const important = /!important\s*$/i.test(value);
    const computed = computeColorMix(value.replace(/\s*!important\s*$/i, ''), getVar, normalize);
    return computed === null ? whole : `${lead}${prop}${colon}${computed}${important ? ' !important' : ''}`;
  });
}

export function needsColorMixShim(css = globalThis.CSS) {
  try { return Boolean(css?.supports) && !css.supports('color', 'color-mix(in srgb, red 50%, blue)'); } catch { return false; }
}

function canvasNormalizer(doc) {
  const context = doc.createElement('canvas').getContext('2d');
  if (!context) return null;
  return text => {
    context.fillStyle = '#010203';
    context.fillStyle = text;
    const result = context.fillStyle;
    return result === '#010203' && text !== '#010203' ? null : result;
  };
}

// Runs once at start-up; a no-op on engines with color-mix().
export async function installLegacyColorMix(win = globalThis.window) {
  if (!win?.document || !needsColorMixShim(win.CSS)) return false;
  const doc = win.document;
  const normalize = canvasNormalizer(doc);
  const sources = [];
  for (const node of doc.querySelectorAll('link[rel="stylesheet"], style')) {
    if (node.dataset?.kzColorMix) continue;
    try {
      const text = node.tagName === 'LINK' ? await (await win.fetch(node.href)).text() : node.textContent;
      if (text && text.includes('color-mix(')) sources.push({ node, text });
    } catch { /* a sheet that cannot be read stays as it is */ }
  }
  if (!sources.length) return false;
  for (const source of sources) {
    source.shim = doc.createElement('style');
    source.shim.dataset.kzColorMix = 'true';
    source.node.parentNode.insertBefore(source.shim, source.node.nextSibling);
  }
  const apply = () => {
    // Read the theme's variables from the original sheets (not from a previous theme's computed copy), then swap.
    for (const source of sources) { if (source.node.sheet) source.node.sheet.disabled = false; if (source.shim.sheet) source.shim.sheet.disabled = true; }
    const style = win.getComputedStyle(doc.body || doc.documentElement);
    const getVar = name => style.getPropertyValue(name);
    for (const source of sources) {
      source.shim.textContent = rewriteStylesheet(source.text, getVar, normalize);
      if (source.shim.sheet) source.shim.sheet.disabled = false;
      if (source.node.sheet) source.node.sheet.disabled = true;
    }
  };
  apply();
  // Recompute only when a variable the mixes read has changed (a theme switch), not on every class change.
  const names = [...new Set(sources.flatMap(source => source.text.match(/var\(\s*--[\w-]+/g) || []).map(item => item.replace(/^var\(\s*/, '')))];
  const fingerprint = () => { const style = win.getComputedStyle(doc.body || doc.documentElement); return names.map(name => style.getPropertyValue(name)).join('|'); };
  let last = fingerprint();
  let pending = 0;
  const observer = new win.MutationObserver(() => {
    if (pending) return;
    pending = win.requestAnimationFrame(() => { pending = 0; const next = fingerprint(); if (next !== last) { apply(); last = fingerprint(); } });
  });
  const options = { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] };
  observer.observe(doc.documentElement, options);
  if (doc.body) observer.observe(doc.body, options);
  return true;
}
