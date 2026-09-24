// Malformed links must not throw while React is rendering its route switch.
export function safeDecodeURIComponent(value) {
  const text = String(value ?? '');
  try { return decodeURIComponent(text); } catch { return text; }
}
export function routeParts(value) {
  return String(value ?? '').split('/').map(safeDecodeURIComponent);
}
