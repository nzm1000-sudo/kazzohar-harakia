// Table of contents in reading order: a part with several chapters is a heading over them; parts nested under a
// common head (בראשית · נח) gather under that head. Row titles drop the heading they already sit under.
export function tocGroups(edition) {
  const total = edition.expected.length;
  if (!edition.sections) return [{ heading: null, nodes: Array.from({ length: total }, (_, i) => i + 1) }];
  const groups = [];
  for (const section of edition.sections) {
    const parts = section.title.split(' · ');
    const size = section.to - section.from + 1;
    const heading = parts.length > 1 ? parts[0] : size > 1 ? section.title : null;
    const nodes = Array.from({ length: size }, (_, i) => section.from + i);
    const last = groups.at(-1);
    if (last && last.heading === heading) last.nodes.push(...nodes); else groups.push({ heading, nodes });
  }
  return groups;
}
