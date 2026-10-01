// Older Android System WebView (Chrome < 98, still found on phones whose WebView is not updated) lacks a few built-ins the
// app and its libraries (@hebcal) call; without them the first render throws and the screen stays empty. Each is added only when
// missing, following the specification's behaviour, so modern browsers are untouched. Imported first by main.jsx.
function define(target, name, value) {
  if (target && !(name in target)) Object.defineProperty(target, name, { value, writable: true, configurable: true, enumerable: false });
}
function at(index) {
  const length = this.length >>> 0;
  let relative = Math.trunc(Number(index)) || 0;
  if (relative < 0) relative += length;
  return relative < 0 || relative >= length ? undefined : this[relative];
}
define(Array.prototype, 'at', at);
define(String.prototype, 'at', function stringAt(index) { return at.call(String(this), index); });
if (typeof Int8Array !== 'undefined') define(Object.getPrototypeOf(Int8Array.prototype), 'at', at);
define(Object, 'hasOwn', (object, key) => Object.prototype.hasOwnProperty.call(Object(object), key));
define(String.prototype, 'replaceAll', function replaceAll(search, replacement) {
  if (search instanceof RegExp) {
    if (!search.global) throw new TypeError('replaceAll must be called with a global RegExp');
    return String(this).replace(search, replacement);
  }
  const pattern = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  return String(this).replace(pattern, typeof replacement === 'function' ? replacement : String(replacement));
});
// structuredClone (Chrome 98), used by @hebcal/learning on plain data: a deep copy of objects, arrays, Dates, Maps and Sets.
if (typeof globalThis.structuredClone !== 'function') {
  const clone = (value, seen) => {
    if (value === null || typeof value !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    if (value instanceof Date) return new Date(value.getTime());
    if (value instanceof RegExp) return new RegExp(value.source, value.flags);
    if (value instanceof Map) { const out = new Map(); seen.set(value, out); value.forEach((item, key) => out.set(clone(key, seen), clone(item, seen))); return out; }
    if (value instanceof Set) { const out = new Set(); seen.set(value, out); value.forEach(item => out.add(clone(item, seen))); return out; }
    if (ArrayBuffer.isView(value)) return value.slice();
    const out = Array.isArray(value) ? [] : {};
    seen.set(value, out);
    for (const key of Object.keys(value)) out[key] = clone(value[key], seen);
    return out;
  };
  define(globalThis, 'structuredClone', value => clone(value, new Map()));
}
