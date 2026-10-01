// The Selector's pure logic (components/ui/Selector.jsx): option shapes, search, keyboard moves. No React here, so the
// tests read it directly.
export const normalizeOptions = (options = []) => options.map(option => (Array.isArray(option)
  ? { value: option[0], label: String(option[1] ?? option[0]), hint: option[2] }
  : option !== null && typeof option === 'object' ? { ...option, label: String(option.label ?? option.value) } : { value: option, label: String(option) }));
export const sameValue = (a, b) => String(a ?? '') === String(b ?? '');
export const plainText = text => String(text ?? '').normalize('NFC').replace(/[\u0591-\u05C7]/g, '').replace(/["'״׳.\-־]/g, '').toLowerCase().trim();
export const filterOptions = (items, query) => { const q = plainText(query); return q ? items.filter(item => plainText(`${item.label} ${item.hint || ''}`).includes(q)) : items; };
// Long lists get a search field by themselves; a grid of short symbols never does.
export const wantsSearch = (count, columns = 1) => columns <= 1 && count > 12;

// The next active option for a key, or null when the key is not a move. In a grid the reading order is right to
// left: ArrowLeft goes on, ArrowRight goes back, Up / Down move a row.
export function nextIndex(current, key, count, columns = 1) {
  if (!count) return null;
  const last = count - 1;
  const clamp = value => Math.max(0, Math.min(last, value));
  const row = Math.max(1, columns);
  switch (key) {
    case 'ArrowDown': return clamp(current + row);
    case 'ArrowUp': return clamp(current - row);
    case 'ArrowLeft': return row > 1 ? clamp(current + 1) : null;
    case 'ArrowRight': return row > 1 ? clamp(current - 1) : null;
    case 'Home': return 0;
    case 'End': return last;
    case 'PageDown': return clamp(current + row * 6);
    case 'PageUp': return clamp(current - row * 6);
    default: return null;
  }
}
