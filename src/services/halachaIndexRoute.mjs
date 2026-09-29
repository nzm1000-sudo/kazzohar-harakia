// "מאגר השאלות השלם" keeps where the reader is in its route: halacha/all[/<group>[/<topic>]].
// Opening a group or a topic rewrites the current history entry (no new Back step), so reading an
// answer and pressing Back returns to that same group and topic, opened, at the same scroll position.
import { routeParts } from './safeRoute.mjs';

const SEP = '\u0001';
export const topicKey = (group, topic) => `${group}${SEP}${topic}`;

export function parseHalachaIndexRoute(mode) {
  const parts = routeParts(mode);
  if (parts[0] !== 'halacha' || parts[1] !== 'all') return null;
  const group = parts[2] || null;
  return { view: 'all', group, topic: group && parts[3] ? parts[3] : null };
}

export function halachaIndexRoute(group = null, topic = null) {
  if (!group) return 'halacha/all';
  return `halacha/all/${encodeURIComponent(group)}${topic ? `/${encodeURIComponent(topic)}` : ''}`;
}

// What is open when the page first appears: the entry's own remembered state when there is one
// (Back to a live entry), otherwise what the route names (a reopened or relaunched link).
export function initialOpenState(route, remembered) {
  if (remembered && Array.isArray(remembered.groups) && Array.isArray(remembered.topics)) return { groups: [...remembered.groups], topics: [...remembered.topics] };
  const group = route?.group || null;
  const topic = group ? route?.topic || null : null;
  return { groups: group ? [group] : [], topics: topic ? [topicKey(group, topic)] : [] };
}

// Opening or closing a group or topic. Closing a group keeps its topics' own state, as <details> does.
export function toggleOpen(state, { group, topic = null, open }) {
  const key = topic ? topicKey(group, topic) : null;
  const list = topic ? state.topics : state.groups;
  const value = topic ? key : group;
  if (open && list.includes(value)) return state;
  if (!open && !list.includes(value)) return state;
  const without = list.filter(item => item !== value);
  const next = open ? [...without, value] : without;
  return topic ? { groups: state.groups, topics: next } : { groups: next, topics: state.topics };
}

// The route names the most recently opened topic whose group is still open, else the latest open group.
export function routeForOpenState(state) {
  const groups = state.groups || [];
  for (const key of [...(state.topics || [])].reverse()) {
    const [group, topic] = key.split(SEP);
    if (groups.includes(group)) return halachaIndexRoute(group, topic);
  }
  return halachaIndexRoute(groups.at(-1) || null);
}

// The Q&A chat opened from the index: its on-screen Back returns to the index (a real Back, restoring it).
export const openedFromIndex = prevHash => /^halacha\/all(\/|$)/.test(String(prevHash || ''));
