// Older Android System WebView (Chrome < 108, common on phones whose WebView is never updated) drops CSS declarations it
// does not understand. This PostCSS step (no dependency: Vite already runs PostCSS) writes, just BEFORE each such
// declaration, an equivalent one the old engine understands. A modern engine reads both and keeps the last, i.e. the
// original — so nothing changes on current browsers.
//   • dvh / svh / lvh (Chrome 108)                → the same value in vh
//   • inset (Chrome 87)                           → top / right / bottom / left
//   • inset-inline / inset-block with equal sides → left+right / top+bottom (the same on both sides, so direction-safe)
//   • margin-/padding-inline and -block shorthands (Chrome 87) → their -start / -end longhands (Chrome 69, still logical)
// color-mix() cannot be resolved here (its colours are theme variables); src/services/legacyColorMix.mjs does that at
// run time, only where the engine lacks it.

const SMALL_VIEWPORT = /(\d*\.?\d+)[dsl]vh\b/g;

export function splitSides(value) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of String(value).trim()) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (/\s/.test(char) && depth === 0) { if (current) parts.push(current); current = ''; continue; }
    current += char;
  }
  if (current) parts.push(current);
  return parts;
}

export function fallbackDeclarations(prop, value) {
  const important = /!important\s*$/i.test(value);
  const clean = String(value).replace(/\s*!important\s*$/i, '');
  const out = [];
  if (SMALL_VIEWPORT.test(clean)) {
    SMALL_VIEWPORT.lastIndex = 0;
    out.push([prop, clean.replace(SMALL_VIEWPORT, '$1vh')]);
  }
  SMALL_VIEWPORT.lastIndex = 0;
  const sides = splitSides(clean.replace(SMALL_VIEWPORT, '$1vh'));
  SMALL_VIEWPORT.lastIndex = 0;
  if (prop === 'inset' && sides.length >= 1 && sides.length <= 4) {
    const [top, right = top, bottom = top, left = right] = sides;
    out.push(['top', top], ['right', right], ['bottom', bottom], ['left', left]);
  } else if (prop === 'inset-inline' && (sides.length === 1 || (sides.length === 2 && sides[0] === sides[1]))) {
    out.push(['left', sides[0]], ['right', sides[0]]);
  } else if (prop === 'inset-block' && sides.length >= 1 && sides.length <= 2) {
    out.push(['top', sides[0]], ['bottom', sides[1] ?? sides[0]]);
  } else if (/^(margin|padding)-(inline|block)$/.test(prop) && sides.length >= 1 && sides.length <= 2) {
    out.push([`${prop}-start`, sides[0]], [`${prop}-end`, sides[1] ?? sides[0]]);
  }
  return out.map(([name, val]) => [name, important ? `${val} !important` : val]);
}

export default function legacyCssFallbacks() {
  return {
    postcssPlugin: 'kz-legacy-css-fallbacks',
    Declaration(decl) {
      if (decl.prop.startsWith('--') || decl.__kzLegacy) return;
      const fallbacks = fallbackDeclarations(decl.prop, decl.important ? `${decl.value} !important` : decl.value);
      for (const [prop, value] of fallbacks) {
        const important = / !important$/.test(value);
        const clone = decl.cloneBefore({ prop, value: value.replace(/ !important$/, ''), important });
        clone.__kzLegacy = true;
      }
    },
  };
}
legacyCssFallbacks.postcss = true;
