const KEY = 'learning-memory-v1';

function read() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function write(value) {
  try { localStorage.setItem(KEY, JSON.stringify(value)); } catch {}
}

export function rememberLearning(id, record) {
  if (!id || !record?.reference) return;
  const current = read();
  const previous = current[id] || {};
  const status = previous.status === 'completed' ? 'completed' : previous.status ? 'in_progress' : 'opened';
  write({ ...current, [id]: { ...previous, ...record, status, lastOpenedAt: new Date().toISOString() } });
}

export function completeLearning(id) {
  if (!id) return;
  const current = read();
  if (!current[id]) return;
  write({ ...current, [id]: { ...current[id], status: 'completed', completedToday: true, completedAt: new Date().toISOString() } });
}

export function getLearningMemory() {
  return read();
}
