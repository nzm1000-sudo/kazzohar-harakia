// Persist navigation DATA, never functions, in History state.
import { backTo } from './scrollRestoration.mjs';
const text = value => typeof value === 'string' ? value : '';
export function serializeReaderNavigation(navigation) {
  if (!navigation || !Array.isArray(navigation.flow) || !navigation.flow.length) return null;
  const flow = navigation.flow.map(item => ({ reference: text(item.reference), title: text(item.title), mode: text(item.mode) || 'nikud' }));
  if (flow.some(item => !item.reference)) return null;
  const index = Number(navigation.index);
  if (!Number.isInteger(index) || index < 0 || index >= flow.length) return null;
  return { flow, index, flowKey: text(navigation.flowKey), flowTitle: text(navigation.flowTitle), returnRoute: text(navigation.returnRoute), backLabel: text(navigation.backLabel), itemEn: text(navigation.itemEn), concept: text(navigation.concept),
    endLabel: text(navigation.endLabel), breadcrumbs: (navigation.breadcrumbs || []).map(b => ({ label: text(b.label), route: text(b.route) })),
    // What comes after the flow's last stop when it is not a text of the flow (סדר השכמת הבוקר → שחרית).
    ...(navigation.continueTo?.reference ? { continueTo: { reference: text(navigation.continueTo.reference), title: text(navigation.continueTo.title), mode: text(navigation.continueTo.mode) || 'nikud' } } : {}) };
}
export function restoreReaderNavigation(saved, { openSource, navigate, onContinue = null }) {
  const spec = serializeReaderNavigation(saved);
  if (!spec) return undefined;
  const returnToContents = () => backTo(spec.returnRoute || 'books', () => navigate(spec.returnRoute || 'books'));
  return {
    ...spec,
    previous: spec.flow[spec.index - 1] || null,
    next: spec.flow[spec.index + 1] || spec.continueTo || null,
    onBack: returnToContents,
    breadcrumbs: spec.breadcrumbs.map(b => ({ label: b.label, onNavigate: b.route ? () => backTo(b.route, () => navigate(b.route)) : undefined })),
    onSelect(target) {
      if (spec.continueTo && target?.reference === spec.continueTo.reference) { onContinue?.(spec.continueTo); return; }
      const index = spec.flow.findIndex(item => item.reference === target.reference);
      if (index < 0) return;
      const next = { ...spec, index, breadcrumbs: spec.breadcrumbs.map((b, i) => i === spec.breadcrumbs.length - 1 && !b.route ? { ...b, label: spec.flow[index].title } : b) };
      // Moving within one prayer/book replaces this entry, so Back returns straight to the index.
      openSource(target.reference, target.title, target.mode, restoreReaderNavigation(next, { openSource, navigate, onContinue }), { replace: true });
    },
  };
}

// How opening a reading writes History (NewApp's openSource):
//   'replace'        — moving within one prayer or book: this reading's entry becomes the next stop (Back → the index);
//   'replace-entry'  — the screen on show was only a way through (the Siddur, opened by "הבא · שחרית" at the end of סדר
//                      השכמת הבוקר to find today's Shacharit): the reading takes its entry, so ONE Back — the app's back
//                      control or the system's — returns to the page before it (the morning order, where it was left);
//   'push'           — everything else: a new entry.
export function sourceEntryWrite({ replace = false, replaceEntry = false, hasSource = false } = {}) {
  if (replace && hasSource) return 'replace';
  if (replaceEntry && !hasSource) return 'replace-entry';
  return 'push';
}
