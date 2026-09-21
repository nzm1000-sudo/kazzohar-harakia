# Baby Names Catalog Rebuild Audit

Date: 2026-09-21

## Decision

The baby-name catalog was rebuilt from a curated, evidence-first source. Quantity is deliberately lower than the previous generated list. A name is published only when its spelling, category, meaning, and source evidence can be stated without relying on a broad group label.

## Counts

| Measure | Count |
| --- | ---: |
| Previous unique published spellings | 371 |
| New published records | 235 |
| New review records | 42 |
| Previous names retained as published | 198 |
| Previous names moved to review | 1 |
| Previous names removed from publication | 172 |
| New required common names added or restored | 26 |

The previous source contained 532 raw group entries and 416 exact unique spellings in the pre-cleanup audit. The comparison above uses the exported published set from the immediately preceding catalog revision, after its own deduplication.

## Classification Ledger

Every previous published spelling was assigned one of these outcomes:

| Outcome | Meaning | Count |
| --- | --- | ---: |
| `KEEP` | Retained with a canonical record and evidence | 198 |
| `CORRECT` | Retained while correcting source type, gender, meaning, reference, or metadata | Included in `KEEP` |
| `MERGE` | Retained under a canonical spelling or alias | Included in `KEEP`; examples: `אילה` -> `איילה`, `נעם` -> `נועם` |
| `REVIEW` | Preserved outside publication pending spelling or source verification | 1 legacy spelling, plus the broader review queue |
| `REMOVE` | Not published because the available evidence was insufficient or the candidate was noisy/non-name data | 172 |

The complete current ledger is represented by the published and review exports in `src/data/babyNames.mjs`: no candidate is silently surfaced by the UI. The former `בארק` spelling is specifically preserved as a legacy favorite alias and mapped to the verified `ברק` record; it is not published or marked verified.

## Required Coverage

The published set includes the requested common and corrected records, including `שלום`, `ברק`, `אברהם`, `משה`, `דוד`, `שלמה`, `יוסף`, `אליהו`, `רפאל`, `שרה`, `רבקה`, `רחל`, `לאה`, `אביגיל`, `תמר`, `יעל`, `נועה`, `איילה`, `חיה`, `ליבי`, `מאיר`, `מנחם`, and `ידידיה`. `אליה` is categorized as female. `שילה` is retained as a modern unisex record.

## Evidence Strategy

- `biblical`: the name has a local Tanakh book/chapter/verse reference. Tests parse the Hebrew numerals and verify the reference against `src/data/tanakh.json`.
- `traditional` and `rabbinic`: the record is presented as a Jewish traditional name, with Jewish-source metadata and no unsupported biblical claim.
- `modern-hebrew` and `modern-israeli`: the record is presented as contemporary Hebrew/Israeli usage, with Academy metadata. It is not relabeled as biblical without evidence.
- CBS metadata is retained as a usage-evidence direction and source link. The CBS PDF could not be reliably extracted in this rebuild, so the catalog does not claim detailed CBS rank/table coverage.

Each published record carries the compatibility fields `name`, `usage`, `type`, `meaning`, `source`, `id`, and `status`, plus the canonical fields `canonicalHebrew`, `aliases`, `gender`, `sourceType`, `literalMeaning`, `origin`, `biblicalReference`, `evidence`, `gematria`, `reducedNumber`, and `quality`.

## Validation

`tests/babyNames.test.mjs` verifies required-name coverage, unique canonical records, blocked spelling exclusion, review filtering, alias search, favorite migration, deterministic gematria, source-type validity, required evidence, and mechanical Tanakh reference validity.

The migration test covers the existing localStorage key `kz-baby-names-favorites-v1` and maps the legacy favorite `baby-name-בארק-27` to the canonical `ברק` record.
