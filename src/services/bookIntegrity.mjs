export function flattenText(value) {
  if (Array.isArray(value)) return value.flatMap(flattenText);
  return typeof value === 'string' ? [value] : [];
}
export function shapeCount(node) {
  if (Number.isSafeInteger(node) && node >= 0) return node;
  if (Array.isArray(node)) return node.reduce((total, item) => total + shapeCount(item), 0);
  if (node && typeof node === 'object') return shapeCount(node.chapters);
  return 0;
}
export function assessBook(entry, { expectedSegments = null, sourceReachable = false } = {}) {
  const paragraphs = Array.isArray(entry?.hebrew) ? entry.hebrew : [];
  const nonEmpty = paragraphs.filter(p => typeof p === 'string' && p.trim());
  const frequencies = new Map();
  for (const p of nonEmpty) {
    const text = p.trim();
    if (text.length >= 20) frequencies.set(text, (frequencies.get(text) || 0) + 1);
  }
  const duplicateGroups = [...frequencies.values()].filter(n => n > 1).length;
  const issues = [];
  if (!entry) issues.push('missing');
  if (entry && !nonEmpty.length) issues.push('empty');
  if (paragraphs.length !== nonEmpty.length) issues.push('empty-or-invalid-segments');
  if (!Array.isArray(entry?.indexes) || entry.indexes.length !== paragraphs.length) issues.push('index-count-mismatch');
  if (Array.isArray(entry?.indexes) && (new Set(entry.indexes).size !== entry.indexes.length || entry.indexes.some(n => !Number.isInteger(n) || n < 0))) issues.push('invalid-indexes');
  if (!entry?.version) issues.push('missing-edition');
  if (!entry?.license) issues.push('missing-license');
  if (sourceReachable && Number.isSafeInteger(expectedSegments) && expectedSegments > paragraphs.length) issues.push('possible-truncation');
  // A repeated passage can be intentional. Never delete it automatically.
  return { paragraphs: paragraphs.length, nonEmpty: nonEmpty.length, duplicateGroups, expectedSegments,
    sourceReachable, issues, completeness: 'NOT_VERIFIED',
    explanation: 'Counts are structural evidence only; complete text requires edition-specific segment comparison.' };
}
export function validateImportBatch(targets, responses) {
  if (!Array.isArray(targets) || !targets.length || !Array.isArray(responses) || responses.length !== targets.length) throw new Error('Incomplete import batch');
  const bad = targets.filter((_, index) => {
    const r = responses[index];
    return !r || r.error || !flattenText(r.he).some(p => p.trim());
  });
  if (bad.length) throw new Error(`Import aborted; existing text retained. Missing source responses: ${bad.join(', ')}`);
  return responses;
}

export function compareBookEdition(ref, entry, remote) {
  const normalize = value => String(value || '').replaceAll('_', ' ').replace(/\s+/g, ' ').trim();
  const unverified = reason => ({ completeness: 'NOT_VERIFIED', reason });
  if (!entry || !Array.isArray(entry.hebrew) || !entry.version) return unverified('Missing stored edition/text');
  if (!remote || remote.error) return unverified('Source unavailable');
  if (normalize(remote.ref) !== normalize(ref)) return unverified('Requested whole scope was not returned');
  if (remote.heVersionTitle !== entry.version) return unverified('Exact stored edition was not returned');
  const text = flattenText(remote.he);
  if (!text.some(p => p.trim())) return unverified('Source text is empty');
  const length = Math.max(text.length, entry.hebrew.length);
  for (let i = 0; i < length; i++) {
    if (text[i] !== entry.hebrew[i]) return { completeness: 'TEXT_OR_SCOPE_DIFF', firstDifference: i, remoteParagraphs: text.length };
  }
  return { completeness: 'MATCHES_CURRENT_SOURCE_EDITION', remoteParagraphs: text.length };
}
