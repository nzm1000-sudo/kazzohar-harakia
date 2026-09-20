export function backAction({ overlay = false, source = false, depth = 0 }) {
  if (overlay) return 'overlay';
  return source || depth > 0 ? 'history' : 'none';
}
