# Siddur completeness by rite — replaced

This file used to hold a matrix that marked a section COMPLETE whenever a matching leaf existed in a rite's pack.
That proved only that a file existed — not that the prayer was complete, ordered, free of duplicates, or that its
conditions were correct. It is replaced by the Siddur QA:

- `siddur-qa.md` — completeness by rite and service: VERIFIED COMPLETE · TEXT COMPLETE / CONDITIONS PENDING ·
  PARTIAL · SOURCE GAP · UNVERIFIED, with every problem listed;
- `content-table.csv` — every section of every composed service (rite, service, concept, source address, paragraphs,
  order, condition, role, required, verified);
- `text-audit.md` — suspicious text in each edition; `text-corrections.md` — display rules and their reasons.

Generate with `node scripts/siddur-qa.mjs`.
