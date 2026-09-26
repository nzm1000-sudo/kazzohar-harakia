// Persist navigation DATA, never functions, in History state.
import { backTo } from './scrollRestoration.mjs';
const text = value => typeof value === 'string' ? value : '';
export function serializeReaderNavigation(navigation) {
  if (!navigation || !Array.isArray(navigation.flow) || !navigation.flow.length) return null;
  const flow = navigation.flow.map(item => ({ reference: text(item.reference), title: text(item.title), mode: text(item.mode) || 'nikud' }));
  if (flow.some(item => !item.reference)) return null;
  const index = Number(navigation.index);
  if (!Number.isInteger(index) || index < 0 || index >= flow.length) return null;
  return { flow, index, flowKey: text(navigation.flowKey), flowTitle: text(navigation.flowTitle), returnRoute: text(navigation.returnRoute), backLabel: text(navigation.backLabel),
    endLabel: text(navigation.endLabel), breadcrumbs: (navigation.breadcrumbs || []).map(b => ({ label: text(b.label), route: text(b.route) })) };
}
export function restoreReaderNavigation(saved, { openSource, navigate }) {
  const spec = serializeReaderNavigation(saved);
  if (!spec) return undefined;
  const returnToContents = () => backTo(spec.returnRoute || 'books', () => navigate(spec.returnRoute || 'books'));
  return {
    ...spec,
    previous: spec.flow[spec.index - 1] || null,
    next: spec.flow[spec.index + 1] || null,
    onBack: returnToContents,
    breadcrumbs: spec.breadcrumbs.map(b => ({ label: b.label, onNavigate: b.route ? () => backTo(b.route, () => navigate(b.route)) : undefined })),
    onSelect(target) {
      const index = spec.flow.findIndex(item => item.reference === target.reference);
      if (index < 0) return;
      const next = { ...spec, index, breadcrumbs: spec.breadcrumbs.map((b, i) => i === spec.breadcrumbs.length - 1 && !b.route ? { ...b, label: spec.flow[index].title } : b) };
      // Moving within one prayer/book replaces this entry, so Back returns straight to the index.
      openSource(target.reference, target.title, target.mode, restoreReaderNavigation(next, { openSource, navigate }), { replace: true });
    },
  };
}
