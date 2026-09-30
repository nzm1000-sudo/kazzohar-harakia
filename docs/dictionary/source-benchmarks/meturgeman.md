# Sefer Meturgeman (Elijah Levita, Isny 1541) — targeted benchmark

- **Rights:** the 1541 work is public domain. Modern annotated editions are copyrighted and are not used.
- **Digital availability (rechecked 2026-09-30):** scans only — HebrewBooks 6244 (403 to scripted requests),
  Google Books 9zVGAAAAYAAJ (full view not confirmed), NLI scans reported. Not on Sefaria, Hebrew Wikisource or
  archive.org (which has Levita's Tishbi, not the Meturgeman). The 1541 Rashi-type print makes OCR impractical.
- **Decision:** not imported (registry `meturgeman`); no gloss can be taken without reading the scan.

## The lookup list (the targeted part)
`docs/dictionary/review/onkelos-meturgeman-lookup.tsv` — the 500 most frequent unresolved Onkelos forms (36,592
unresolved Aramaic tokens in Onkelos; the list covers the head of it), each with its class (GATED_CANDIDATE,
MORPHOLOGY_GAP, LEXICAL_GAP, AMBIGUOUS), the engine's own candidate, and empty columns for the human reader: Meturgeman
entry, extract, edition (Isny 1541), page, scan id (HebrewBooks 6244), verification status (SCAN_LOOKUP_PENDING).
A filled and approved row becomes a reviewed form gloss with the Meturgeman as its basis; until then it is nothing.

The Onkelos gap by class (unresolved-classes.md): morphology 48.0% (a candidate from the grammar, withheld by the
precision gate — the Hebrew verse confirms some of them already), open-source candidates 2.6%, Krupnik-only 16.7%,
true lexical gaps 21.4%, ambiguous 11.2%. The Meturgeman is the source for the lexical gaps and the Krupnik-only part.
